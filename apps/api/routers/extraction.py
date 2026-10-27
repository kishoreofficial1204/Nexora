"""
Extraction and Field Provenance Router for Nexora.
Handles asynchronous extraction execution, field retrieval with bounding box coordinates,
inline reviewer corrections with immutable raw value retention, and page image rendering.
"""

import io
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, status, Response, Query
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from sqlalchemy.orm import Session
import fitz  # PyMuPDF
from PIL import Image

from apps.api.db.database import get_db
from apps.api.models.user import User, UserRole
from apps.api.models.application import Application
from apps.api.models.document import Document, DocumentSourceStatus
from apps.api.models.extracted_field import ExtractedField, FieldReviewStatus
from apps.api.models.audit import AuditAction
from apps.api.core.security import get_current_user, require_roles
from apps.api.core.audit_logger import log_audit_event
from apps.api.pipeline.extractor import extract_document_fields

router = APIRouter(prefix="/api", tags=["Extraction & Provenance"])


def _ensure_document_access(document: Document, current_user: User, db: Session) -> None:
    if current_user.role != UserRole.APPLICANT:
        return
    app = db.query(Application).filter(Application.id == document.application_id).first()
    if not app or app.owner_id != current_user.id:
        raise HTTPException(
            status_code=403,
            detail="Forbidden: You cannot access documents from this application.",
        )


class FieldCorrectionRequest(BaseModel):
    normalized_value: str
    review_status: str = FieldReviewStatus.CORRECTED
    rationale: Optional[str] = "Reviewer manual correction"


class DocumentTypeCorrectionRequest(BaseModel):
    document_type: str
    rationale: Optional[str] = "Reviewer corrected document type classification"


from pydantic import BaseModel, ConfigDict

class ExtractedFieldOut(BaseModel):
    id: str
    document_id: str
    field_name: str
    raw_value: str
    normalized_value: str
    page: int
    bbox: List[float]
    method: str
    confidence: float
    review_status: str

    model_config = ConfigDict(from_attributes=True)


@router.post("/applications/{id}/extract", response_model=List[ExtractedFieldOut])
def run_application_extraction(
    id: str,
    current_user: User = Depends(require_roles([UserRole.REVIEWER, UserRole.SENIOR_REVIEWER, UserRole.ADMIN])),
    db: Session = Depends(get_db)
):
    """
    Executes the extraction pipeline across all documents attached to the application.
    Extracts structured fields, assigns page provenance and bounding boxes.
    """
    app = db.query(Application).filter(Application.id == id).first()
    if not app:
        raise HTTPException(status_code=404, detail="Application case not found.")

    all_created_fields: List[ExtractedField] = []

    for doc in app.documents:
        # Clear any prior unreviewed extractions for idempotent re-runs
        db.query(ExtractedField).filter(
            ExtractedField.document_id == doc.id,
            ExtractedField.review_status == FieldReviewStatus.UNREVIEWED
        ).delete()

        try:
            detected_type, raw_fields = extract_document_fields(
                pdf_path=doc.storage_path,
                document_type_hint=doc.document_type
            )

            if doc.document_type == "unknown" and detected_type != "unknown":
                doc.document_type = detected_type

            doc.source_status = DocumentSourceStatus.PARSED

            import json
            for rf in raw_fields:
                field_rec = ExtractedField(
                    document_id=doc.id,
                    field_name=rf.field_name,
                    raw_value=rf.raw_value,
                    normalized_value=rf.normalized_value,
                    page=rf.page,
                    bbox_json=json.dumps(rf.bbox),
                    method=rf.method,
                    confidence=rf.confidence,
                    review_status=FieldReviewStatus.UNREVIEWED
                )
                db.add(field_rec)
                all_created_fields.append(field_rec)

        except Exception as e:
            doc.source_status = DocumentSourceStatus.ERROR
            print(f"Error extracting from {doc.filename}: {e}")

    db.commit()

    for f in all_created_fields:
        db.refresh(f)

    log_audit_event(
        db=db,
        actor_id=current_user.id,
        action=AuditAction.EXTRACTION_COMPLETED,
        entity_type="application",
        entity_id=app.id,
        metadata={
            "document_count": len(app.documents),
            "fields_extracted": len(all_created_fields)
        }
    )

    return all_created_fields


@router.get("/documents/{id}/fields", response_model=List[ExtractedFieldOut])
def get_document_fields(
    id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    doc = db.query(Document).filter(Document.id == id).first()
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found.")
    _ensure_document_access(doc, current_user, db)

    fields = db.query(ExtractedField).filter(ExtractedField.document_id == id).all()
    return fields


@router.patch("/fields/{id}", response_model=ExtractedFieldOut)
def correct_extracted_field(
    id: str,
    correction: FieldCorrectionRequest,
    current_user: User = Depends(require_roles([UserRole.REVIEWER, UserRole.SENIOR_REVIEWER, UserRole.ADMIN])),
    db: Session = Depends(get_db)
):
    """
    Allows scrutiny officers to correct or confirm an extracted field value.
    CRITICAL: Preserves the original raw_value unmodified, and logs a tamper-evident audit event.
    """
    field = db.query(ExtractedField).filter(ExtractedField.id == id).first()
    if not field:
        raise HTTPException(status_code=404, detail="Field record not found.")

    old_val = field.normalized_value
    field.normalized_value = correction.normalized_value
    field.review_status = correction.review_status

    db.commit()
    db.refresh(field)

    log_audit_event(
        db=db,
        actor_id=current_user.id,
        action=AuditAction.FIELD_CORRECTED,
        entity_type="field",
        entity_id=field.id,
        metadata={
            "application_id": field.document.application_id if field.document else "",
            "field_name": field.field_name,
            "document_id": field.document_id,
            "raw_value": field.raw_value,
            "previous_normalized": old_val,
            "updated_normalized": field.normalized_value,
            "review_status": field.review_status,
            "rationale": correction.rationale
        }
    )

    return field


@router.patch("/documents/{id}/type", response_model=dict)
def correct_document_type(
    id: str,
    req: DocumentTypeCorrectionRequest,
    current_user: User = Depends(require_roles([UserRole.REVIEWER, UserRole.SENIOR_REVIEWER, UserRole.ADMIN])),
    db: Session = Depends(get_db)
):
    doc = db.query(Document).filter(Document.id == id).first()
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found.")

    old_type = doc.document_type
    doc.document_type = req.document_type
    db.commit()

    log_audit_event(
        db=db,
        actor_id=current_user.id,
        action="DOCUMENT_TYPE_CORRECTED",
        entity_type="document",
        entity_id=doc.id,
        metadata={
            "previous_type": old_type,
            "new_type": doc.document_type,
            "rationale": req.rationale
        }
    )

    return {"message": "Document type updated", "document_type": doc.document_type}


@router.get("/documents/{id}/pages/{page}/image")
def render_page_image(
    id: str,
    page: int,
    dpi: int = Query(140, ge=72, le=300),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Renders a specific page of a PDF document as a PNG image stream.
    Used for browser-native canvas/image view in the evidence workbench.
    """
    doc_rec = db.query(Document).filter(Document.id == id).first()
    if not doc_rec:
        raise HTTPException(status_code=404, detail="Document not found.")
    _ensure_document_access(doc_rec, current_user, db)

    import os
    if not os.path.exists(doc_rec.storage_path):
        raise HTTPException(status_code=404, detail="File not found in storage.")

    try:
        pdf = fitz.open(doc_rec.storage_path)
        if page < 1 or page > pdf.page_count:
            pdf.close()
            raise HTTPException(status_code=400, detail=f"Invalid page number. Document has {pdf.page_count} pages.")

        pdf_page = pdf[page - 1]
        pix = pdf_page.get_pixmap(dpi=dpi)
        img_bytes = pix.tobytes("png")
        pdf.close()

        return Response(content=img_bytes, media_type="image/png")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to render document page: {str(e)}")
