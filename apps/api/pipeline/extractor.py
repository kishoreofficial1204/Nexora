"""
Field Extraction Engine for Nexora.

Extracts structured compliance fields with provenance (page, bbox, confidence,
method). Native PyMuPDF text is preferred; RapidOCR is used for raster pages.

Important: this module never invents a value when a field is absent. A missing
field is returned as absent and the validation engine turns that into an explicit
missing-field/manual-review finding.
"""

import os
import re
from typing import List, Dict, Any, Optional, Tuple, Pattern
import fitz  # PyMuPDF
from PIL import Image

from apps.api.pipeline.ocr_engine import get_ocr_engine
from apps.api.pipeline.classifier import classify_document_text


DATE_RE = r"([12]\d{3}-\d{2}-\d{2})"
PID_RE = r"([1-9]-\d{9,10})"


class RawFieldResult:
    def __init__(
        self,
        field_name: str,
        raw_value: str,
        normalized_value: Any,
        page: int,
        bbox: List[float],
        method: str,
        confidence: float,
    ):
        self.field_name = field_name
        self.raw_value = str(raw_value).strip()
        self.normalized_value = str(normalized_value).strip()
        self.page = page
        self.bbox = [round(float(c), 2) for c in bbox]
        self.method = method
        self.confidence = round(float(confidence), 2)

    def to_dict(self) -> Dict[str, Any]:
        return {
            "field_name": self.field_name,
            "raw_value": self.raw_value,
            "normalized_value": self.normalized_value,
            "page": self.page,
            "bbox": self.bbox,
            "method": self.method,
            "confidence": self.confidence,
            "review_status": "unreviewed",
        }


def _search(pattern: str, text: str, flags: int = re.IGNORECASE | re.MULTILINE) -> Optional[re.Match]:
    try:
        return re.search(pattern, text, flags)
    except re.error:
        return None


def _first_match(patterns: List[str], text: str) -> Optional[re.Match]:
    for pattern in patterns:
        match = _search(pattern, text)
        if match:
            return match
    return None


def _normalise_value(field_name: str, value: str) -> str:
    value = (value or "").strip().strip(".,;:")
    if field_name in {"intake_capacity", "approved_intake", "photo_count", "geotag_count"}:
        digits = re.sub(r"[^\d]", "", value)
        return str(int(digits)) if digits else value
    if field_name.endswith("_date"):
        match = re.search(DATE_RE, value)
        if match:
            return match.group(1)
    return " ".join(value.split())


def extract_document_fields(
    pdf_path: str,
    document_type_hint: Optional[str] = None,
) -> Tuple[str, List[RawFieldResult]]:
    """
    Parses a PDF file, classifies its type if unknown, and extracts only fields
    that are actually present in the document.
    """
    if not os.path.exists(pdf_path):
        raise FileNotFoundError(f"Document file not found at {pdf_path}")

    doc = fitz.open(pdf_path)
    total_pages = doc.page_count
    full_text = ""
    pages_text: List[str] = []
    is_scanned_doc = False

    for page_idx in range(total_pages):
        page = doc[page_idx]
        text = page.get_text()
        if len(text.strip()) < 25:
            is_scanned_doc = True
        pages_text.append(text)
        full_text += f"\n--- PAGE {page_idx + 1} ---\n" + text

    ocr_blocks_by_page: Dict[int, List[Any]] = {}
    if is_scanned_doc:
        ocr_engine = get_ocr_engine()
        for page_idx in range(total_pages):
            page = doc[page_idx]
            pix = page.get_pixmap(dpi=150)
            img = Image.frombytes("RGB", [pix.width, pix.height], pix.samples)
            blocks = ocr_engine.extract_text_and_boxes(img)
            ocr_blocks_by_page[page_idx + 1] = blocks
            # Keep OCR line boundaries and restore likely word boundaries where
            # RapidOCR merged words (e.g. "InstitutionName").
            ocr_lines = []
            for block in blocks:
                line = re.sub(r"(?<=[a-z])(?=[A-Z])", " ", block.text or "")
                ocr_lines.append(line)
            ocr_text = "\n".join(ocr_lines)
            full_text += f"\n--- OCR PAGE {page_idx + 1} ---\n" + ocr_text

    doc_type = document_type_hint
    if not doc_type or doc_type == "unknown":
        doc_type, _ = classify_document_text(full_text, os.path.basename(pdf_path))

    extracted_fields: List[RawFieldResult] = []

    def locate_bbox(page_num: int, target_text: str, fallback_bbox: Optional[List[float]] = None) -> Tuple[List[float], str, float]:
        """Finds a bounding box in PDF points, falling back to OCR blocks."""
        if fallback_bbox is None:
            fallback_bbox = [54.0, 100.0, 400.0, 120.0]

        safe_page = max(1, min(page_num, total_pages))
        page = doc[safe_page - 1]
        target = (target_text or "").strip()
        if target:
            rects = page.search_for(target)
            if rects:
                r = rects[0]
                return [r.x0, r.y0, r.x1, r.y1], "native_pdf_text", 0.98

            if safe_page in ocr_blocks_by_page:
                for block in ocr_blocks_by_page[safe_page]:
                    if target.lower() in (block.text or "").lower():
                        return block.bbox, "ocr", block.confidence

        return fallback_bbox, ("ocr" if is_scanned_doc else "native_pdf_text"), (0.55 if is_scanned_doc else 0.72)

    def add_field(
        field_name: str,
        patterns: List[str],
        *,
        page: int = 1,
        fallback_bbox: Optional[List[float]] = None,
        group: int = 1,
    ) -> None:
        match = _first_match(patterns, full_text)
        if not match:
            return
        try:
            raw_value = match.group(group)
        except IndexError:
            return
        if raw_value is None:
            return
        raw_value = str(raw_value).strip().strip(".,;:")
        if not raw_value:
            return
        normalized = _normalise_value(field_name, raw_value)
        if not normalized:
            return
        bbox, method, confidence = locate_bbox(page, raw_value, fallback_bbox)
        extracted_fields.append(
            RawFieldResult(
                field_name=field_name,
                raw_value=raw_value,
                normalized_value=normalized,
                page=page,
                bbox=bbox,
                method=method,
                confidence=confidence,
            )
        )

    # Common fields: only added when the document really contains them.
    institution_name_patterns = [
        r"Institution\s*Name\s*:\s*([^\n\r]+)",
        r"Institution\s*:\s*([^\n\r]+)",
        r"Issued\s*To\s*:\s*\n?\s*([^\n\r]+)",
        r"Certified\s*Institution\s*:\s*([^\n\r]+)",
        r"To\s+The\s+Principal\s*/\s*Director\s*,\s*\n\s*([^\n\r,]+)",
    ]
    pid_patterns = [
        rf"(?:Permanent\s*Institute\s*ID|Permanent\s*Institute\s*Id|PID)\s*[:\-]?\s*{PID_RE}",
    ]

    if doc_type == "doc_eoa_app":
        add_field("institution_name", institution_name_patterns, fallback_bbox=[220.0, 135.0, 450.0, 155.0])
        add_field("institute_pid", pid_patterns, fallback_bbox=[220.0, 110.0, 320.0, 130.0])
        add_field(
            "intake_capacity",
            [
                r"Undergraduate\s+(?<!\d)(\d{2,3})(?!\d)",
                r"Intake Capacity[\s\S]{0,250}?(?<!\d)(\d{2,3})(?!\d)",
                r"Approved Intake[\s\S]{0,250}?(?<!\d)(\d{2,3})(?!\d)",
            ],
            fallback_bbox=[420.0, 260.0, 460.0, 280.0],
        )
        add_field(
            "academic_year",
            [r"(?:Academic\s*Year|AY)\s*[:\-]?\s*([20]\d{3}-\d{2})"],
            fallback_bbox=[220.0, 185.0, 300.0, 205.0],
        )
        add_field(
            "issue_date",
            [r"(?:Application Date|Issue Date|Date)\s*:\s*" + DATE_RE],
            fallback_bbox=[420.0, 110.0, 500.0, 130.0],
        )

    elif doc_type == "doc_prev_eoa":
        add_field("institution_name", institution_name_patterns, fallback_bbox=[54.0, 155.0, 300.0, 175.0])
        add_field("institute_pid", pid_patterns, fallback_bbox=[220.0, 170.0, 320.0, 190.0])
        add_field(
            "approved_intake",
            [
                r"State Tech University[\s\S]{0,100}?(?<!\d)(\d{2,3})(?!\d)",
                r"Approved Intake[\s\S]{0,250}?(?<!\d)(\d{2,3})(?!\d)",
            ],
            fallback_bbox=[440.0, 285.0, 470.0, 305.0],
        )
        add_field(
            "academic_year",
            [r"(?:Academic\s*Year|AY)\s*[:\-]?\s*([20]\d{3}-\d{2})"],
            fallback_bbox=[400.0, 85.0, 460.0, 105.0],
        )
        add_field("issue_date", [r"(?:Issue Date|Date)\s*:\s*" + DATE_RE], fallback_bbox=[420.0, 110.0, 500.0, 130.0])

    elif doc_type == "doc_univ_affil":
        add_field("institution_name", institution_name_patterns, fallback_bbox=[120.0, 165.0, 400.0, 185.0])
        add_field(
            "academic_year",
            [r"(?:Affiliation\s*Academic\s*Year|Academic\s*Year|AY)\s*[:\-]?\s*([20]\d{3}-\d{2})"],
            fallback_bbox=[200.0, 185.0, 260.0, 205.0],
        )
        add_field("issue_date", [r"(?:Issue Date|Date)\s*:\s*" + DATE_RE], fallback_bbox=[420.0, 110.0, 500.0, 130.0])
        add_field("order_number", [r"Ref\s*:\s*([A-Z0-9/\-]+)"], fallback_bbox=[54.0, 115.0, 300.0, 135.0])

    elif doc_type == "doc_fire_safety":
        add_field("institution_name", institution_name_patterns, fallback_bbox=[130.0, 145.0, 350.0, 165.0])
        add_field("certificate_no", [r"Certificate No\s*:\s*([A-Z0-9/\-]+)"], fallback_bbox=[54.0, 110.0, 220.0, 130.0])
        add_field(
            "valid_until_date",
            [r"(?:Validity Expiry Date|Valid Until Date|Valid Until|Expiry Date)\s*:?\s*" + DATE_RE],
            fallback_bbox=[220.0, 200.0, 310.0, 220.0],
        )
        add_field("issue_date", [r"Issue Date\s*:\s*" + DATE_RE], fallback_bbox=[420.0, 110.0, 500.0, 130.0])

    elif doc_type == "doc_building_stability":
        add_field("institution_name", institution_name_patterns, fallback_bbox=[200.0, 145.0, 400.0, 165.0])
        add_field(
            "valid_until_date",
            [r"(?:Valid Until Date|Valid Until|Validity Expiry Date)\s*:?\s*" + DATE_RE],
            fallback_bbox=[200.0, 170.0, 290.0, 190.0],
        )
        add_field("issue_date", [r"Issue Date\s*:\s*" + DATE_RE], fallback_bbox=[420.0, 110.0, 500.0, 130.0])
        add_field("engineer_reg_no", [r"Regn No\s*:\s*([A-Z0-9\-]+)"], fallback_bbox=[300.0, 65.0, 420.0, 85.0])

    elif doc_type == "doc_infra_photos":
        add_field(
            "photo_count",
            [r"(?:Total\s+)?(?:Photographic\s+)?Views Attached\s*:\s*(\d+)"],
            fallback_bbox=[230.0, 90.0, 260.0, 110.0],
        )
        geotag_count = len(re.findall(r"LAT\s*:", full_text, re.IGNORECASE))
        if geotag_count:
            extracted_fields.append(
                RawFieldResult(
                    "geotag_count",
                    str(geotag_count),
                    geotag_count,
                    1,
                    [54.0, 120.0, 500.0, 520.0],
                    "native_pdf_text",
                    0.95,
                )
            )

    else:
        # Unknown/other documents still receive safe generic facts when present.
        add_field("institution_name", institution_name_patterns)
        add_field("institute_pid", pid_patterns)
        add_field("issue_date", [r"(?:Issue Date|Date)\s*:\s*" + DATE_RE])
        add_field("valid_until_date", [r"(?:Valid Until Date|Validity Expiry Date|Valid Until)\s*:?\s*" + DATE_RE])

    doc.close()
    return doc_type, extracted_fields
