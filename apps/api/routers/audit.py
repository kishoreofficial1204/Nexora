"""
Audit Router for Nexora.
Provides access to append-only tamper-evident audit timelines and cryptographic verification.
"""

from typing import List
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import desc

from apps.api.db.database import get_db
from apps.api.models.user import User, UserRole
from apps.api.models.application import Application
from apps.api.models.audit import AuditEvent
from apps.api.schemas.models_schema import AuditEventOut, AuditVerificationOut
from apps.api.core.security import get_current_user, require_roles
from apps.api.core.audit_logger import verify_audit_chain

router = APIRouter(prefix="/api", tags=["Audit Ledger"])


@router.get("/applications/{id}/audit", response_model=List[AuditEventOut])
def get_application_audit_trail(
    id: str,
    current_user: User = Depends(require_roles([UserRole.REVIEWER, UserRole.SENIOR_REVIEWER, UserRole.ADMIN, UserRole.AUDITOR])),
    db: Session = Depends(get_db)
):
    app = db.query(Application).filter(Application.id == id).first()
    if not app:
        raise HTTPException(status_code=404, detail="Application not found.")

    doc_ids = [d.id for d in app.documents]
    events = db.query(AuditEvent).filter(
        (AuditEvent.entity_id == id) |
        (AuditEvent.entity_id.in_(doc_ids)) |
        (AuditEvent.metadata_json.like(f"%{id}%"))
    ).order_by(desc(AuditEvent.timestamp)).all()

    return events


@router.get("/audit/verify", response_model=AuditVerificationOut)
def verify_ledger_integrity(
    current_user: User = Depends(require_roles([UserRole.REVIEWER, UserRole.SENIOR_REVIEWER, UserRole.ADMIN, UserRole.AUDITOR])),
    db: Session = Depends(get_db)
):
    """
    Performs cryptographic validation of the SHA-256 hash chain
    to verify that no historical logs or officer rationales have been tampered with.
    """
    result = verify_audit_chain(db=db)
    return AuditVerificationOut(**result)
