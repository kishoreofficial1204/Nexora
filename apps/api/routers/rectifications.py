"""
Rectification Router for VeriScope.

Persists reviewer clarification requests and applicant replacement submissions.
The prototype keeps validation advisory: submitting evidence marks the request as
submitted and leaves the final re-validation to a reviewer.
"""

from datetime import datetime
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, field_validator
from sqlalchemy.orm import Session

from apps.api.core.audit_logger import log_audit_event
from apps.api.core.security import get_current_user, require_roles
from apps.api.db.database import get_db
from apps.api.models.application import Application, ApplicationStatus
from apps.api.models.document import Document
from apps.api.models.finding import Finding, FindingStatus
from apps.api.models.rectification import RectificationRequest, RectificationStatus
from apps.api.models.user import User, UserRole

router = APIRouter(prefix="/api", tags=["Rectifications"])

REVIEW_ROLES = [UserRole.REVIEWER, UserRole.SENIOR_REVIEWER, UserRole.ADMIN]
SUBMIT_ROLES = [UserRole.APPLICANT, UserRole.REVIEWER, UserRole.SENIOR_REVIEWER, UserRole.ADMIN]


class RectificationCreateRequest(BaseModel):
    document_type: str
    request_message: str
    finding_id: Optional[str] = None

    @field_validator("document_type", "request_message")
    def validate_text(cls, v: str) -> str:
        clean = v.strip()
        if len(clean) < 3:
            raise ValueError("This field must contain at least 3 characters.")
        return clean


class RectificationSubmitRequest(BaseModel):
    document_id: str
    applicant_note: Optional[str] = None


class RectificationResolveRequest(BaseModel):
    resolution_note: str

    @field_validator("resolution_note")
    def validate_note(cls, v: str) -> str:
        clean = v.strip()
        if len(clean) < 5:
            raise ValueError("A resolution note of at least 5 characters is required.")
        return clean


def _ensure_case_access(application: Application, current_user: User) -> None:
    if current_user.role == UserRole.APPLICANT and application.owner_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Forbidden: You do not have access to this application.",
        )


def _serialize(rectification: RectificationRequest) -> dict:
    return {
        "id": rectification.id,
        "application_id": rectification.application_id,
        "finding_id": rectification.finding_id,
        "document_type": rectification.document_type,
        "request_message": rectification.request_message,
        "status": rectification.status,
        "requested_by": rectification.requested_by,
        "requested_at": (
            rectification.requested_at.isoformat() + "Z"
            if rectification.requested_at
            else None
        ),
        "submitted_document_id": rectification.submitted_document_id,
        "submitted_at": (
            rectification.submitted_at.isoformat() + "Z"
            if rectification.submitted_at
            else None
        ),
        "resolved_by": rectification.resolved_by,
        "resolved_at": (
            rectification.resolved_at.isoformat() + "Z"
            if rectification.resolved_at
            else None
        ),
        "resolution_note": rectification.resolution_note,
    }


@router.get("/applications/{id}/rectifications")
def list_rectifications(
    id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    app = db.query(Application).filter(Application.id == id).first()
    if not app:
        raise HTTPException(status_code=404, detail="Application not found.")
    _ensure_case_access(app, current_user)

    rectifications = (
        db.query(RectificationRequest)
        .filter(RectificationRequest.application_id == app.id)
        .order_by(RectificationRequest.requested_at.desc())
        .all()
    )
    return [_serialize(item) for item in rectifications]


@router.post(
    "/applications/{id}/rectifications",
    status_code=status.HTTP_201_CREATED,
)
def create_rectification(
    id: str,
    req: RectificationCreateRequest,
    current_user: User = Depends(require_roles(REVIEW_ROLES)),
    db: Session = Depends(get_db),
):
    app = db.query(Application).filter(Application.id == id).first()
    if not app:
        raise HTTPException(status_code=404, detail="Application not found.")

    finding = None
    if req.finding_id:
        finding = (
            db.query(Finding)
            .filter(
                Finding.id == req.finding_id,
                Finding.application_id == app.id,
            )
            .first()
        )
        if not finding:
            raise HTTPException(status_code=404, detail="Finding not found for this application.")

    rectification = RectificationRequest(
        application_id=app.id,
        finding_id=finding.id if finding else None,
        document_type=req.document_type,
        request_message=req.request_message,
        status=RectificationStatus.OPEN,
        requested_by=current_user.id,
    )
    db.add(rectification)
    db.flush()

    if finding:
        finding.status = FindingStatus.CLARIFICATION_REQUESTED
        finding.review_rationale = req.request_message
        finding.reviewed_by = current_user.email
        finding.reviewed_at = datetime.utcnow()

    log_audit_event(
        db=db,
        actor_id=current_user.id,
        action="RECTIFICATION_REQUESTED",
        entity_type="RectificationRequest",
        entity_id=rectification.id,
        metadata={
            "application_id": app.id,
            "finding_id": finding.id if finding else None,
            "document_type": req.document_type,
            "request_message": req.request_message,
        },
    )
    db.commit()
    db.refresh(rectification)
    return _serialize(rectification)


@router.post("/rectifications/{id}/submit")
def submit_rectification(
    id: str,
    req: RectificationSubmitRequest,
    current_user: User = Depends(require_roles(SUBMIT_ROLES)),
    db: Session = Depends(get_db),
):
    rectification = (
        db.query(RectificationRequest)
        .filter(RectificationRequest.id == id)
        .first()
    )
    if not rectification:
        raise HTTPException(status_code=404, detail="Rectification request not found.")

    app = db.query(Application).filter(Application.id == rectification.application_id).first()
    if not app:
        raise HTTPException(status_code=404, detail="Application not found.")
    _ensure_case_access(app, current_user)

    if rectification.status not in (
        RectificationStatus.OPEN,
        RectificationStatus.SUBMITTED,
    ):
        raise HTTPException(
            status_code=409,
            detail=f"Rectification request is already {rectification.status}.",
        )

    document = (
        db.query(Document)
        .filter(
            Document.id == req.document_id,
            Document.application_id == app.id,
        )
        .first()
    )
    if not document:
        raise HTTPException(status_code=404, detail="Replacement document not found for this application.")

    if document.document_type in ("unknown", "", None):
        document.document_type = rectification.document_type

    rectification.submitted_document_id = document.id
    rectification.submitted_at = datetime.utcnow()
    rectification.status = RectificationStatus.SUBMITTED
    app.status = ApplicationStatus.IN_PROGRESS

    log_audit_event(
        db=db,
        actor_id=current_user.id,
        action="RECTIFICATION_SUBMITTED",
        entity_type="RectificationRequest",
        entity_id=rectification.id,
        metadata={
            "application_id": app.id,
            "finding_id": rectification.finding_id,
            "document_id": document.id,
            "document_sha256": document.hash_sha256,
            "applicant_note": req.applicant_note,
        },
    )
    db.commit()
    db.refresh(rectification)
    return _serialize(rectification)


@router.post("/rectifications/{id}/resolve")
def resolve_rectification(
    id: str,
    req: RectificationResolveRequest,
    current_user: User = Depends(require_roles(REVIEW_ROLES)),
    db: Session = Depends(get_db),
):
    rectification = (
        db.query(RectificationRequest)
        .filter(RectificationRequest.id == id)
        .first()
    )
    if not rectification:
        raise HTTPException(status_code=404, detail="Rectification request not found.")

    if rectification.status == RectificationStatus.CANCELLED:
        raise HTTPException(status_code=409, detail="Cancelled rectifications cannot be resolved.")

    rectification.status = RectificationStatus.RESOLVED
    rectification.resolved_by = current_user.email
    rectification.resolved_at = datetime.utcnow()
    rectification.resolution_note = req.resolution_note

    if rectification.finding_id:
        finding = (
            db.query(Finding)
            .filter(Finding.id == rectification.finding_id)
            .first()
        )
        if finding:
            finding.status = FindingStatus.RESOLVED
            finding.review_rationale = req.resolution_note
            finding.reviewed_by = current_user.email
            finding.reviewed_at = datetime.utcnow()

    log_audit_event(
        db=db,
        actor_id=current_user.id,
        action="RECTIFICATION_RESOLVED",
        entity_type="RectificationRequest",
        entity_id=rectification.id,
        metadata={
            "application_id": rectification.application_id,
            "finding_id": rectification.finding_id,
            "resolution_note": req.resolution_note,
        },
    )
    db.commit()
    db.refresh(rectification)
    return _serialize(rectification)
