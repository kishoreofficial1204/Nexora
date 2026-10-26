"""
Deterministic Validation & Anomaly Signal Engine for VeriScope.
Executes versioned rules against extracted facts and document streams.
Strictly distinguishes deterministic compliance checks from heuristic anomaly signals.
Enforces the Non-Negotiable Principles (Section 1).
"""

import os
import difflib
from datetime import datetime
from typing import List, Dict, Any, Optional
import fitz  # PyMuPDF
import imagehash
from PIL import Image
from sqlalchemy.orm import Session

from apps.api.models.application import Application, ApplicationStatus
from apps.api.models.document import Document
from apps.api.models.extracted_field import ExtractedField
from apps.api.models.finding import Finding, FindingSeverity, FindingStatus
from apps.api.rules.loader import get_default_rule_pack


def normalize_institution_name(name: str) -> str:
    """Normalizes institution names by standardizing common technical abbreviations."""
    clean = name.lower().strip()
    clean = clean.replace(".", "").replace(",", "").replace("-", " ")
    clean = clean.replace("inst of tech", "institute of technology")
    clean = clean.replace("inst of technology", "institute of technology")
    clean = clean.replace("institute of tech", "institute of technology")
    clean = " ".join(clean.split())
    return clean


def detect_incremental_pdf_revision(pdf_path: str) -> bool:
    """
    Detects whether a PDF file contains incremental revisions / appended updates.
    A standard single-save PDF has one %%EOF marker at the end;
    incrementally updated PDFs contain multiple %%EOF markers and xref sections.
    """
    if not os.path.exists(pdf_path):
        return False
    try:
        with open(pdf_path, "rb") as f:
            data = f.read()
        eof_count = data.count(b"%%EOF")
        return eof_count > 1
    except Exception:
        return False


def validate_application(app: Application, db: Session) -> List[Finding]:
    """
    Executes full validation suite on an application case.
    Returns generated Finding instances and updates overall application status.
    """
    rule_pack = get_default_rule_pack()
    documents = app.documents
    doc_by_type: Dict[str, List[Document]] = {}
    doc_by_id: Dict[str, Document] = {d.id: d for d in documents}

    for d in documents:
        doc_by_type.setdefault(d.document_type, []).append(d)

    # Fetch all extracted fields for these documents
    doc_ids = [d.id for d in documents]
    all_fields = db.query(ExtractedField).filter(ExtractedField.document_id.in_(doc_ids)).all()
    fields_by_doc_and_name: Dict[str, Dict[str, ExtractedField]] = {}
    for f in all_fields:
        fields_by_doc_and_name.setdefault(f.document_id, {})[f.field_name] = f

    findings: List[Finding] = []

    # -------------------------------------------------------------
    # 1. Checklist Completeness: Missing Documents (RULE-EOA-001)
    # -------------------------------------------------------------
    for chk in rule_pack.checklist_items:
        if chk.is_required:
            present_docs = doc_by_type.get(chk.document_type, [])
            if not present_docs:
                f = Finding(
                    application_id=app.id,
                    rule_id="RULE-EOA-001",
                    rule_version=rule_pack.rule_pack.version,
                    finding_type="missing_document",
                    severity=FindingSeverity.FAIL,
                    title=f"Missing Mandatory Document: {chk.title}",
                    explanation=f"Required application supporting document '{chk.title}' ({chk.document_type}) is missing from the submission bundle.",
                    recommended_action="Request applicant upload missing document or confirm regulatory exemption.",
                    evidence_refs=[{
                        "checklist_id": chk.id,
                        "document_type": chk.document_type,
                        "title": chk.title
                    }],
                    confidence=1.0,
                    is_heuristic=False
                )
                findings.append(f)

    # -------------------------------------------------------------
    # 2. Certificate Expiry vs Assessment Date (RULE-EOA-002, 003)
    # -------------------------------------------------------------
    assessment_date_str = app.assessment_date or "2026-10-26"
    assessment_dt = datetime.strptime(assessment_date_str, "%Y-%m-%d").date()

    # Check Fire Safety (RULE-EOA-002)
    fire_docs = doc_by_type.get("doc_fire_safety", [])
    for f_doc in fire_docs:
        field = fields_by_doc_and_name.get(f_doc.id, {}).get("valid_until_date")
        if field:
            try:
                expiry_dt = datetime.strptime(field.normalized_value, "%Y-%m-%d").date()
                if expiry_dt < assessment_dt:
                    f = Finding(
                        application_id=app.id,
                        rule_id="RULE-EOA-002",
                        rule_version=rule_pack.rule_pack.version,
                        finding_type="certificate_expired",
                        severity=FindingSeverity.FAIL,
                        title="Fire Safety Certificate Validity Expired",
                        explanation=f"Fire Safety Certificate validity date ({field.normalized_value}) has expired relative to assessment date ({assessment_date_str}).",
                        recommended_action="Examine renewal receipt or request updated NOC from Fire Department.",
                        evidence_refs=[{
                            "document_id": f_doc.id,
                            "document_name": f_doc.original_filename,
                            "page": field.page,
                            "field_name": "valid_until_date",
                            "value": field.normalized_value,
                            "bbox": field.bbox
                        }],
                        confidence=field.confidence,
                        is_heuristic=False
                    )
                    findings.append(f)
            except Exception:
                pass

    # Check Building Stability (RULE-EOA-003)
    bldg_docs = doc_by_type.get("doc_building_stability", [])
    for b_doc in bldg_docs:
        field = fields_by_doc_and_name.get(b_doc.id, {}).get("valid_until_date")
        if field:
            try:
                expiry_dt = datetime.strptime(field.normalized_value, "%Y-%m-%d").date()
                if expiry_dt < assessment_dt:
                    f = Finding(
                        application_id=app.id,
                        rule_id="RULE-EOA-003",
                        rule_version=rule_pack.rule_pack.version,
                        finding_type="certificate_expired",
                        severity=FindingSeverity.FAIL,
                        title="Building Stability Certificate Expired",
                        explanation=f"Building structural stability certificate expired on {field.normalized_value}.",
                        recommended_action="Require submission of fresh stability endorsement from registered structural engineer.",
                        evidence_refs=[{
                            "document_id": b_doc.id,
                            "document_name": b_doc.original_filename,
                            "page": field.page,
                            "field_name": "valid_until_date",
                            "value": field.normalized_value,
                            "bbox": field.bbox
                        }],
                        confidence=field.confidence,
                        is_heuristic=False
                    )
                    findings.append(f)
            except Exception:
                pass

    # -------------------------------------------------------------
    # 3. Cross-Document Intake Consistency (RULE-EOA-005)
    # -------------------------------------------------------------
    app_docs = doc_by_type.get("doc_eoa_app", [])
    prev_docs = doc_by_type.get("doc_prev_eoa", [])

    if app_docs and prev_docs:
        app_doc = app_docs[0]
        prev_doc = prev_docs[0]
        app_intake_field = fields_by_doc_and_name.get(app_doc.id, {}).get("intake_capacity")
        prev_intake_field = fields_by_doc_and_name.get(prev_doc.id, {}).get("approved_intake")

        if app_intake_field and prev_intake_field:
            try:
                val_a = int(app_intake_field.normalized_value)
                val_b = int(prev_intake_field.normalized_value)
                if val_a != val_b:
                    f = Finding(
                        application_id=app.id,
                        rule_id="RULE-EOA-005",
                        rule_version=rule_pack.rule_pack.version,
                        finding_type="intake_mismatch",
                        severity=FindingSeverity.WARNING,
                        title="Declared Intake vs Approved Intake Contradiction",
                        explanation=f"Application claims intake capacity of {val_a}, but previous AICTE approval letter specifies {val_b} seats.",
                        recommended_action="Review whether institution applied for intake increase under Chapter IV norms.",
                        # CRITICAL: Links BOTH evidence locations!
                        evidence_refs=[
                            {
                                "document_id": app_doc.id,
                                "document_name": app_doc.original_filename,
                                "page": app_intake_field.page,
                                "field_name": "intake_capacity",
                                "value": val_a,
                                "bbox": app_intake_field.bbox
                            },
                            {
                                "document_id": prev_doc.id,
                                "document_name": prev_doc.original_filename,
                                "page": prev_intake_field.page,
                                "field_name": "approved_intake",
                                "value": val_b,
                                "bbox": prev_intake_field.bbox
                            }
                        ],
                        confidence=0.98,
                        is_heuristic=False
                    )
                    findings.append(f)
            except Exception:
                pass

    # -------------------------------------------------------------
    # 4. Institution Name Variation Signal (RULE-EOA-006)
    # -------------------------------------------------------------
    affil_docs = doc_by_type.get("doc_univ_affil", [])
    if app_docs and affil_docs:
        app_doc = app_docs[0]
        affil_doc = affil_docs[0]
        app_name_f = fields_by_doc_and_name.get(app_doc.id, {}).get("institution_name")
        affil_name_f = fields_by_doc_and_name.get(affil_doc.id, {}).get("institution_name")

        if app_name_f and affil_name_f:
            name_a = app_name_f.normalized_value.strip()
            name_b = affil_name_f.normalized_value.strip()
            if name_a.strip().lower() != name_b.strip().lower():
                norm_a = normalize_institution_name(name_a)
                norm_b = normalize_institution_name(name_b)
                sim = difflib.SequenceMatcher(None, name_a.lower(), name_b.lower()).ratio()

                # Triggers if names normalize to the same entity (abbreviation variant) OR have high character similarity
                if norm_a == norm_b or sim >= 0.50:
                    f = Finding(
                        application_id=app.id,
                        rule_id="RULE-EOA-006",
                        rule_version=rule_pack.rule_pack.version,
                        finding_type="name_variation_signal",
                        severity=FindingSeverity.WARNING,
                        title="Institution Name Variation Signal",
                        explanation=f"Institution name variation detected: '{name_a}' on application vs '{name_b}' on university affiliation order.",
                        recommended_action="Verify Gazette notification or trust deed for official name change or abbreviation.",
                        evidence_refs=[
                            {
                                "document_id": app_doc.id,
                                "document_name": app_doc.original_filename,
                                "page": app_name_f.page,
                                "field_name": "institution_name",
                                "value": name_a,
                                "bbox": app_name_f.bbox
                            },
                            {
                                "document_id": affil_doc.id,
                                "document_name": affil_doc.original_filename,
                                "page": affil_name_f.page,
                                "field_name": "institution_name",
                                "value": name_b,
                                "bbox": affil_name_f.bbox
                            }
                        ],
                        confidence=0.88,
                        is_heuristic=True  # Signal, not proof!
                    )
                    findings.append(f)

    # -------------------------------------------------------------
    # 5. Exact Duplicate File Hash (RULE-EOA-009)
    # -------------------------------------------------------------
    seen_hashes: Dict[str, Document] = {}
    for doc in documents:
        h = doc.hash_sha256
        if h in seen_hashes:
            dup_doc = seen_hashes[h]
            f = Finding(
                application_id=app.id,
                rule_id="RULE-EOA-009",
                rule_version=rule_pack.rule_pack.version,
                finding_type="duplicate_file_hash",
                severity=FindingSeverity.WARNING,
                title="Duplicate File Upload Detected (Identical SHA-256)",
                explanation=f"Duplicate file detected: Document '{doc.original_filename}' shares identical SHA-256 hash with '{dup_doc.original_filename}'.",
                recommended_action="Check whether same PDF was inadvertently uploaded to fulfill two distinct checklist requirements.",
                evidence_refs=[
                    {"document_id": doc.id, "document_name": doc.original_filename, "sha256": h},
                    {"document_id": dup_doc.id, "document_name": dup_doc.original_filename, "sha256": h}
                ],
                confidence=1.0,
                is_heuristic=False
            )
            findings.append(f)
        else:
            seen_hashes[h] = doc

    # -------------------------------------------------------------
    # 6. Modified PDF Structural Signal (RULE-ANOMALY-INCREMENTAL-PDF)
    # -------------------------------------------------------------
    for doc in documents:
        if doc.storage_path and os.path.exists(doc.storage_path):
            if detect_incremental_pdf_revision(doc.storage_path):
                f = Finding(
                    application_id=app.id,
                    rule_id="RULE-ANOMALY-INCREMENTAL-PDF",
                    rule_version="1.0-draft",
                    finding_type="structural_change_signal",
                    severity=FindingSeverity.WARNING,
                    title="Structural PDF Revision Signal",
                    explanation="Structural change signal: incremental revision detected after creation. Needs human comparison.",
                    recommended_action="Inspect original source document and verify whether content was legitimately revised or edited.",
                    evidence_refs=[{
                        "document_id": doc.id,
                        "document_name": doc.original_filename,
                        "page": 1,
                        "note": "Multiple xref sections / incremental PDF append stream detected"
                    }],
                    confidence=0.92,
                    is_heuristic=True  # Always labelled heuristic signal!
                )
                findings.append(f)

    # -------------------------------------------------------------
    # 7. Low OCR Confidence Signal (SIGNAL-OCR-CONFIDENCE)
    # -------------------------------------------------------------
    for field in all_fields:
        if field.method == "ocr" and field.confidence < 0.85:
            doc = doc_by_id.get(field.document_id)
            doc_name = doc.original_filename if doc else "Document"
            f = Finding(
                application_id=app.id,
                rule_id="SIGNAL-OCR-CONFIDENCE",
                rule_version="1.0-draft",
                finding_type="low_confidence_extraction",
                severity=FindingSeverity.MANUAL_REVIEW,
                title="Low OCR Confidence Signal",
                explanation=f"Low OCR confidence ({int(field.confidence * 100)}%) for field '{field.field_name}' on {doc_name}. Visual inspection required.",
                recommended_action="Review field in evidence workbench and confirm or correct value.",
                evidence_refs=[{
                    "document_id": field.document_id,
                    "document_name": doc_name,
                    "page": field.page,
                    "field_name": field.field_name,
                    "value": field.raw_value,
                    "bbox": field.bbox
                }],
                confidence=field.confidence,
                is_heuristic=True
            )
            findings.append(f)

    # -------------------------------------------------------------
    # 8. Update Application Overall Preliminary Status
    # -------------------------------------------------------------
    has_fail = any(f.severity == FindingSeverity.FAIL for f in findings)
    has_manual = any(f.severity == FindingSeverity.MANUAL_REVIEW for f in findings)
    has_warning = any(f.severity == FindingSeverity.WARNING for f in findings)

    if has_fail:
        app.status = ApplicationStatus.DEFICIENCIES_FLAGGED
    elif has_manual:
        app.status = "manual_review_required"
    elif has_warning:
        app.status = ApplicationStatus.PRELIMINARY_REVIEW
    else:
        app.status = ApplicationStatus.PRELIMINARY_REVIEW

    # Persist findings to database
    # Clear prior open findings for idempotent re-runs
    db.query(Finding).filter(
        Finding.application_id == app.id,
        Finding.status == FindingStatus.OPEN
    ).delete()

    for f in findings:
        db.add(f)

    db.commit()
    for f in findings:
        db.refresh(f)

    return findings
