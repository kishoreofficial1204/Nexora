"""
Documents Router for Nexora.
Handles safe multi-file upload, integrity verification, and short-lived streaming.
"""

from typing import List
from fastapi import APIRouter, Depends, HTTPException, status, UploadFile, File, Form
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session

from apps.api.db.database import get_db
from apps.api.models.user import User, UserRole
from apps.api.models.application import Application
from apps.api.models.document import Document, DocumentSourceStatus
from apps.api.models.audit import AuditAction
from apps.api.schemas.models_schema import DocumentOut
from apps.api.core.security import get_current_user, require_roles
from apps.api.core.audit_logger import log_audit_event
from apps.api.services.storage import storage_service

router = APIRouter(prefix="/api", tags=["Documents"])


@router.post("/applications/{id}/documents", response_model=List[DocumentOut], status_code=status.HTTP_201_CREATED)
async def upload_documents(
    id: str,
    files: List[UploadFile] = File(...),
    document_type: str = Form("unknown"),
    current_user: User = Depends(require_roles([UserRole.APPLICANT, UserRole.REVIEWER, UserRole.ADMIN])),
    db: Session = Depends(get_db)
):
    app = db.query(Application).filter(Application.id == id).first()
    if not app:
        raise HTTPException(status_code=404, detail="Application case not found.")

    if current_user.role == UserRole.APPLICANT and app.owner_id != current_user.id:
        raise HTTPException(status_code=403, detail="Forbidden: Cannot upload documents to another applicant's case.")

    created_docs = []
    for upload_file in files:
        stored_info = storage_service.validate_and_store_file(
            application_id=app.id,
            upload_file=upload_file
        )

        doc_rec = Document(
            application_id=app.id,
            document_type=document_type,
            filename=stored_info["filename"],
            original_filename=stored_info["original_filename"],
            file_size=stored_info["file_size"],
            mime_type=stored_info["mime_type"],
            hash_sha256=stored_info["hash_sha256"],
            storage_path=stored_info["storage_path"],
            page_count=stored_info["page_count"],
            source_status=DocumentSourceStatus.UPLOADED
        )
        db.add(doc_rec)
        db.commit()
        db.refresh(doc_rec)

        log_audit_event(
            db=db,
            actor_id=current_user.id,
            action=AuditAction.DOCUMENT_UPLOADED,
            entity_type="document",
            entity_id=doc_rec.id,
            metadata={
                "application_id": app.id,
                "original_filename": doc_rec.original_filename,
                "sha256": doc_rec.hash_sha256,
                "document_type": doc_rec.document_type,
                "page_count": doc_rec.page_count
            }
        )
        created_docs.append(doc_rec)

    return created_docs


@router.get("/documents/{id}/file")
def get_document_file(
    id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    doc = db.query(Document).filter(Document.id == id).first()
    if not doc:
        raise HTTPException(status_code=404, detail="Document record not found.")

    # Check access to application
    app = db.query(Application).filter(Application.id == doc.application_id).first()
    if not app:
        raise HTTPException(status_code=404, detail="Associated application case not found.")

    if current_user.role == UserRole.APPLICANT and app.owner_id != current_user.id:
        raise HTTPException(status_code=403, detail="Forbidden: You cannot access documents from this application.")

    import os
    if not os.path.exists(doc.storage_path):
        raise HTTPException(status_code=404, detail="Physical document file missing in storage.")

    return FileResponse(
        path=doc.storage_path,
        media_type=doc.mime_type,
        filename=doc.original_filename
    )
