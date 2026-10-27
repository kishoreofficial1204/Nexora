"""Non-destructive document forensics used by validation rules.

All outputs here are *signals*, not proof of fraud. The prototype deliberately
keeps the analysis best-effort and degrades gracefully when optional libraries
(OpenCV, pyHanko, QR decoders) are unavailable.
"""

from __future__ import annotations

import json
import os
import re
from datetime import datetime
from typing import Any, Dict, List, Optional, Tuple

import fitz  # PyMuPDF
import imagehash
from PIL import Image
from sqlalchemy.orm import Session

from apps.api.models.document import Document
from apps.api.models.document_analysis import DocumentAnalysis


ANALYSIS_VERSION = "1.0-prototype"


def _normalise_text(text: str) -> str:
    clean = re.sub(r"\s+", " ", (text or "")).strip().lower()
    return clean


def _insert_ocr_word_boundaries(text: str) -> str:
    """RapidOCR sometimes drops spaces between words; restore likely boundaries."""
    text = re.sub(r"(?<=[a-z])(?=[A-Z])", " ", text or "")
    text = re.sub(r"(?<=[A-Za-z])(?=\d)", " ", text)
    text = re.sub(r"(?<=\d)(?=[A-Za-z])", " ", text)
    return re.sub(r"[ \t]+", " ", text)


def _extract_text_and_ocr_flag(pdf_path: str) -> Tuple[str, bool]:
    doc = fitz.open(pdf_path)
    chunks: List[str] = []
    used_ocr = False
    try:
        for page in doc:
            chunks.append(page.get_text())
        native_text = "\n".join(chunks)
        if len(native_text.strip()) >= 25:
            return native_text, False

        # Raster/scan fallback. Keep this optional so a missing OCR model does
        # not break document intake.
        try:
            from apps.api.pipeline.ocr_engine import get_ocr_engine

            engine = get_ocr_engine()
            ocr_chunks: List[str] = []
            for page in doc:
                pix = page.get_pixmap(dpi=150)
                image = Image.frombytes("RGB", [pix.width, pix.height], pix.samples)
                blocks = engine.extract_text_and_boxes(image)
                ocr_chunks.append("\n".join(_insert_ocr_word_boundaries(b.text) for b in blocks))
            used_ocr = True
            return "\n".join(ocr_chunks), used_ocr
        except Exception:
            return native_text, used_ocr
    finally:
        doc.close()


def _perceptual_hash(pdf_path: str) -> Optional[str]:
    try:
        doc = fitz.open(pdf_path)
        try:
            if doc.page_count == 0:
                return None
            pix = doc[0].get_pixmap(dpi=96)
            image = Image.frombytes("RGB", [pix.width, pix.height], pix.samples)
            return str(imagehash.phash(image))
        finally:
            doc.close()
    except Exception:
        return None


def _pdf_metadata(pdf_path: str) -> Dict[str, Any]:
    metadata: Dict[str, Any] = {}
    try:
        with open(pdf_path, "rb") as handle:
            raw = handle.read()
        metadata["incremental_eof_count"] = raw.count(b"%%EOF")
        metadata["file_size"] = len(raw)
    except Exception:
        metadata["incremental_eof_count"] = 0

    try:
        doc = fitz.open(pdf_path)
        try:
            metadata.update(
                {
                    "page_count": doc.page_count,
                    "producer": (doc.metadata or {}).get("producer"),
                    "creator": (doc.metadata or {}).get("creator"),
                    "creation_date": (doc.metadata or {}).get("creationDate"),
                    "mod_date": (doc.metadata or {}).get("modDate"),
                    "is_encrypted": bool(doc.is_encrypted),
                }
            )
        finally:
            doc.close()
    except Exception:
        pass
    return metadata


def _detect_qr_codes(pdf_path: str) -> List[Dict[str, Any]]:
    """Best-effort QR decode. Returns [] when OpenCV is unavailable."""
    try:
        import cv2  # type: ignore
        import numpy as np

        doc = fitz.open(pdf_path)
        found: List[Dict[str, Any]] = []
        detector = cv2.QRCodeDetector()
        try:
            for page_number, page in enumerate(doc, start=1):
                pix = page.get_pixmap(dpi=150)
                image = np.frombuffer(pix.samples, dtype=np.uint8).reshape(pix.height, pix.width, pix.n)
                if pix.n == 4:
                    image = cv2.cvtColor(image, cv2.COLOR_RGBA2RGB)
                elif pix.n == 3:
                    image = cv2.cvtColor(image, cv2.COLOR_RGB2BGR)
                data, _, _ = detector.detectAndDecode(image)
                if data:
                    found.append({"page": page_number, "data": data, "method": "opencv_qr"})
        finally:
            doc.close()
        return found
    except Exception:
        return []


def _signature_status(pdf_path: str) -> Tuple[str, Dict[str, Any]]:
    """Cheap structural signature check; full crypto validation is future work."""
    try:
        with open(pdf_path, "rb") as handle:
            raw = handle.read()
        has_sig = b"/Type /Sig" in raw or b"/Type/Sig" in raw
        if not has_sig:
            return "no_signature", {"note": "No PDF signature dictionary found."}
        return (
            "unverified",
            {
                "note": "Signature dictionary present; cryptographic validation is not enabled in the prototype.",
                "classification": "signal_only_not_proof",
            },
        )
    except Exception as exc:
        return "not_checked", {"error": str(exc)}


def analyze_document(db: Session, doc: Document, force: bool = False) -> DocumentAnalysis:
    existing = db.query(DocumentAnalysis).filter(DocumentAnalysis.document_id == doc.id).first()
    if existing and not force:
        return existing

    analysis = existing or DocumentAnalysis(document_id=doc.id)
    analysis.analysis_version = ANALYSIS_VERSION
    analysis.analyzed_at = datetime.utcnow()

    path = doc.storage_path
    if not path or not os.path.exists(path):
        analysis.forensics_json = json.dumps({"error": "file_missing"})
        if not existing:
            db.add(analysis)
        db.commit()
        db.refresh(analysis)
        return analysis

    text, used_ocr = _extract_text_and_ocr_flag(path)
    metadata = _pdf_metadata(path)
    metadata["text_source"] = "ocr" if used_ocr else "native_pdf_text"

    analysis.perceptual_hash = _perceptual_hash(path)
    analysis.metadata_json = json.dumps(metadata, sort_keys=True)
    analysis.qr_codes_json = json.dumps(_detect_qr_codes(path))
    signature_status, signature_details = _signature_status(path)
    analysis.signature_status = signature_status
    analysis.signature_details_json = json.dumps(signature_details, sort_keys=True)
    analysis.forensics_json = json.dumps(
        {
            "text_fingerprint": _normalise_text(text)[:4000],
            "text_source": metadata["text_source"],
            "classification": "signal_only_not_proof",
        },
        sort_keys=True,
    )

    if not existing:
        db.add(analysis)
    db.commit()
    db.refresh(analysis)
    return analysis


def _analysis_payload(analysis: DocumentAnalysis) -> Dict[str, Any]:
    try:
        return json.loads(analysis.forensics_json or "{}")
    except Exception:
        return {}


def get_or_compute_perceptual_hash(db: Session, doc: Document) -> Optional[str]:
    analysis = analyze_document(db, doc)
    return analysis.perceptual_hash


def get_or_compute_text_fingerprint(db: Session, doc: Document) -> str:
    analysis = analyze_document(db, doc)
    return str(_analysis_payload(analysis).get("text_fingerprint") or "")


def get_or_compute_qr_codes(db: Session, doc: Document) -> List[Dict[str, Any]]:
    analysis = analyze_document(db, doc)
    try:
        return json.loads(analysis.qr_codes_json or "[]")
    except Exception:
        return []


def get_or_compute_signature_status(db: Session, doc: Document) -> Tuple[str, Dict[str, Any]]:
    analysis = analyze_document(db, doc)
    try:
        details = json.loads(analysis.signature_details_json or "{}")
    except Exception:
        details = {}
    return analysis.signature_status or "not_checked", details
