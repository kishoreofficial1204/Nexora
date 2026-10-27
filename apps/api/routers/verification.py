"""External verification routes.

The connector is simulated, but verification records are persisted against the
application and document, and non-verified outcomes create findings and alerts.
"""

from typing import Any, Dict, List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, field_validator
from sqlalchemy import desc
from sqlalchemy.orm import Session

from apps.api.core.security import get_current_user, require_roles
from apps.api.db.database import get_db
from apps.api.models.application import Application
from apps.api.models.user import User, UserRole
from apps.api.models.verification import VerificationRecord
from apps.api.services.mock_issuer import MockIssuerConnector, SIMULATED_BANNER
from apps.api.services.verification import serialize_verification, verify_application_document

router = APIRouter(prefix="/api/verification", tags=["External Verification"])

REVIEW_ROLES = [UserRole.REVIEWER, UserRole.SENIOR_REVIEWER, UserRole.ADMIN]
READ_ROLES = REVIEW_ROLES + [UserRole.AUDITOR]


class VerificationQueryRequest(BaseModel):
    authority_id: str
    query_payload: Dict[str, Any]
    mode: Optional[str] = "match"
    simulated_delay_ms: Optional[int] = 150

    @field_validator("mode")
    def validate_mode(cls, value: str) -> str:
        allowed = {"match", "mismatch", "expired", "not_found", "timeout", "service_down"}
        if value not in allowed:
            raise ValueError(f"mode must be one of: {', '.join(sorted(allowed))}")
        return value


class PersistedVerificationRequest(BaseModel):
    authority_id: str
    document_id: Optional[str] = None
    mode: str = "match"
    simulated_delay_ms: int = 120

    @field_validator("mode")
    def validate_mode(cls, value: str) -> str:
        allowed = {"match", "mismatch", "expired", "not_found", "timeout", "service_down"}
        if value not in allowed:
            raise ValueError(f"mode must be one of: {', '.join(sorted(allowed))}")
        return value


@router.get("/authorities")
def get_supported_authorities(current_user: User = Depends(get_current_user)):
    """Lists simulated external authorities available for registry verification."""
    return {
        "badge": SIMULATED_BANNER,
        "authorities": [
            {
                "id": key,
                "name": value,
                "type": "simulated_registry",
                "supported_modes": [
                    "match",
                    "mismatch",
                    "expired",
                    "not_found",
                    "timeout",
                    "service_down",
                ],
            }
            for key, value in MockIssuerConnector.SUPPORTED_AUTHORITIES.items()
        ],
    }


@router.post("/query")
def query_external_registry(
    req: VerificationQueryRequest,
    current_user: User = Depends(require_roles(REVIEW_ROLES)),
):
    """Executes a stateless simulated registry query (no persistence)."""
    result = MockIssuerConnector.query_registry(
        authority_id=req.authority_id,
        query_payload=req.query_payload,
        mode=req.mode or "match",
        simulated_delay_ms=req.simulated_delay_ms or 150,
    )
    return result


@router.post("/applications/{id}/verify")
def verify_application(
    id: str,
    req: PersistedVerificationRequest,
    current_user: User = Depends(require_roles(REVIEW_ROLES)),
    db: Session = Depends(get_db),
):
    """Runs and persists a verification for an application document."""
    app = db.query(Application).filter(Application.id == id).first()
    if not app:
        raise HTTPException(status_code=404, detail="Application case not found.")
    try:
        record = verify_application_document(
            db=db,
            app=app,
            actor=current_user,
            authority_id=req.authority_id,
            document_id=req.document_id,
            mode=req.mode,
            simulated_delay_ms=req.simulated_delay_ms,
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))
    return serialize_verification(record)


@router.get("/applications/{id}/verifications")
def list_application_verifications(
    id: str,
    current_user: User = Depends(require_roles(READ_ROLES)),
    db: Session = Depends(get_db),
):
    app = db.query(Application).filter(Application.id == id).first()
    if not app:
        raise HTTPException(status_code=404, detail="Application case not found.")
    records = (
        db.query(VerificationRecord)
        .filter(VerificationRecord.application_id == id)
        .order_by(desc(VerificationRecord.checked_at))
        .all()
    )
    return [serialize_verification(record) for record in records]


@router.get("/records/{id}")
def get_verification_record(
    id: str,
    current_user: User = Depends(require_roles(READ_ROLES)),
    db: Session = Depends(get_db),
):
    record = db.query(VerificationRecord).filter(VerificationRecord.id == id).first()
    if not record:
        raise HTTPException(status_code=404, detail="Verification record not found.")
    return serialize_verification(record)
