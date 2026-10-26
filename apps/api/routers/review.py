"""
Review Console, Recommendations, and Case Dossier Export Router for VeriScope.
Enforces:
1. Mandatory rationale validation for all reviewer decisions (cannot dismiss or confirm without non-empty rationale).
2. Append-only cryptographic audit logging with SHA-256 chaining.
3. Exportable scrutiny dossiers in structured JSON and watermarked PDF formats.
4. Restricted applicant-facing view with internal heuristic signals redacted.
"""

from datetime import datetime
from typing import Dict, Any, Optional
from fastapi import APIRouter, Depends, HTTPException, Response, status
from pydantic import BaseModel, field_validator
from sqlalchemy.orm import Session

from apps.api.db.database import get_db
from apps.api.models.application import Application, ApplicationStatus
from apps.api.models.finding import Finding, FindingStatus
from apps.api.models.user import User
from apps.api.core.security import get_current_user, require_roles
from apps.api.core.audit_logger import log_audit_event
from apps.api.services.report_generator import build_case_dossier_json, generate_case_dossier_pdf

router = APIRouter(prefix="/api", tags=["Review Console & Reports"])


class FindingReviewRequest(BaseModel):
    action: str  # confirm, dismiss, request_clarification, escalate
    rationale: str
    clarification_item: Optional[str] = None

    @field_validator("action")
    def validate_action(cls, v: str) -> str:
        allowed = {"confirm", "dismiss", "request_clarification", "escalate"}
        if v not in allowed:
            raise ValueError(f"Action must be one of: {', '.join(allowed)}")
        return v

    @field_validator("rationale")
    def validate_rationale(cls, v: str) -> str:
        clean = v.strip()
        if len(clean) < 5:
            raise ValueError("Review rationale is mandatory and must contain at least 5 characters.")
        return clean


class ApplicationRecommendationRequest(BaseModel):
    recommendation: str  # RECOMMEND_APPROVAL, RECOMMEND_REJECTION, REQUEST_RESUBMISSION, REFER_TO_HEARING
    rationale: str

    @field_validator("recommendation")
    def validate_rec(cls, v: str) -> str:
        allowed = {"RECOMMEND_APPROVAL", "RECOMMEND_REJECTION", "REQUEST_RESUBMISSION", "REFER_TO_HEARING"}
        if v not in allowed:
            raise ValueError(f"Recommendation must be one of: {', '.join(allowed)}")
        return v

    @field_validator("rationale")
    def validate_rationale(cls, v: str) -> str:
        clean = v.strip()
        if len(clean) < 10:
            raise ValueError("Scrutiny officer justification is mandatory and must contain at least 10 characters.")
        return clean


@router.post("/findings/{id}/review")
def review_finding(
    id: str,
    req: FindingReviewRequest,
    current_user: User = Depends(require_roles(["reviewer", "senior_reviewer", "admin"])),
    db: Session = Depends(get_db)
):
    """
    Submits a scrutiny officer decision on an individual finding with mandatory rationale.
    Enforces non-empty rationale validation and logs an append-only audit event.
    """
    finding = db.query(Finding).filter(Finding.id == id).first()
    if not finding:
        raise HTTPException(status_code=404, detail="Finding not found.")

    status_map = {
        "confirm": FindingStatus.CONFIRMED,
        "dismiss": FindingStatus.DISMISSED,
        "request_clarification": FindingStatus.CLARIFICATION_REQUESTED,
        "escalate": FindingStatus.ESCALATED
    }

    old_status = finding.status
    new_status = status_map[req.action]

    finding.status = new_status
    finding.review_rationale = req.rationale
    finding.reviewed_by = current_user.email
    finding.reviewed_at = datetime.utcnow()

    # Append-only cryptographic audit logging
    log_audit_event(
        db=db,
        actor_id=current_user.id,
        action="FINDING_REVIEWED",
        entity_type="Finding",
        entity_id=finding.id,
        metadata={
            "application_id": finding.application_id,
            "rule_id": finding.rule_id,
            "action": req.action,
            "old_status": old_status,
            "new_status": new_status,
            "rationale": req.rationale,
            "clarification_item": req.clarification_item
        }
    )

    db.commit()
    db.refresh(finding)

    return {
        "id": finding.id,
        "status": finding.status,
        "review_rationale": finding.review_rationale,
        "reviewed_by": finding.reviewed_by,
        "reviewed_at": finding.reviewed_at.isoformat() + "Z"
    }


@router.post("/applications/{id}/recommendation")
def record_officer_recommendation(
    id: str,
    req: ApplicationRecommendationRequest,
    current_user: User = Depends(require_roles(["reviewer", "senior_reviewer", "admin"])),
    db: Session = Depends(get_db)
):
    """
    Records overall scrutiny officer recommendation with mandatory justification.
    """
    app = db.query(Application).filter(Application.id == id).first()
    if not app:
        raise HTTPException(status_code=404, detail="Application not found.")

    app.recommendation = req.recommendation
    app.recommendation_rationale = req.rationale
    app.recommendation_by = current_user.email
    app.recommendation_at = datetime.utcnow()
    app.status = ApplicationStatus.REVIEW_COMPLETED

    log_audit_event(
        db=db,
        actor_id=current_user.id,
        action="APPLICATION_RECOMMENDATION_RECORDED",
        entity_type="Application",
        entity_id=app.id,
        metadata={
            "recommendation": req.recommendation,
            "rationale": req.rationale,
            "reviewed_by": current_user.email
        }
    )

    db.commit()
    db.refresh(app)

    return {
        "id": app.id,
        "overall_status": app.status,
        "recommendation": app.recommendation,
        "recommendation_rationale": app.recommendation_rationale,
        "recommendation_by": app.recommendation_by,
        "recommendation_at": app.recommendation_at.isoformat() + "Z"
    }


@router.get("/applications/{id}/export/json")
def export_application_dossier_json(
    id: str,
    db: Session = Depends(get_db)
):
    """Returns complete machine-readable case dossier in structured JSON format."""
    app = db.query(Application).filter(Application.id == id).first()
    if not app:
        raise HTTPException(status_code=404, detail="Application not found.")

    return build_case_dossier_json(app, db)


@router.get("/applications/{id}/export/pdf")
def export_application_dossier_pdf(
    id: str,
    db: Session = Depends(get_db)
):
    """Generates and downloads an exportable scrutiny dossier in signed PDF format."""
    app = db.query(Application).filter(Application.id == id).first()
    if not app:
        raise HTTPException(status_code=404, detail="Application not found.")

    pdf_bytes = generate_case_dossier_pdf(app, db)
    filename = f"VeriScope_Dossier_{app.id[:8]}_{datetime.utcnow().strftime('%Y%m%d')}.pdf"

    return Response(
        content=pdf_bytes,
        media_type="application/pdf",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'}
    )


@router.get("/applications/{id}/applicant-view")
def get_applicant_restricted_view(
    id: str,
    db: Session = Depends(get_db)
):
    """
    Restricted applicant-facing view.
    Redacts internal heuristic signals, detector confidence scores, and scrutiny notes.
    Only exposes confirmed deficiencies and official clarification requests.
    """
    app = db.query(Application).filter(Application.id == id).first()
    if not app:
        raise HTTPException(status_code=404, detail="Application not found.")

    findings = db.query(Finding).filter(Finding.application_id == app.id).all()

    # Redact heuristic anomaly signals and internal detector metrics
    # Only confirmed findings and clarification requests are shown to the applicant
    applicant_notices = []
    for f in findings:
        if f.status in (FindingStatus.CONFIRMED, FindingStatus.CLARIFICATION_REQUESTED):
            applicant_notices.append({
                "notice_id": f.id,
                "document_reference": f.evidence_refs[0].get("document_name") if f.evidence_refs else "General Submission",
                "notice_type": "CLARIFICATION_REQUEST" if f.status == FindingStatus.CLARIFICATION_REQUESTED else "DEFICIENCY_NOTE",
                "title": f.title,
                "requirement_summary": f.recommended_action,
                "scrutiny_rationale": f.review_rationale or "Please provide updated official document.",
                "status": f.status
            })

    documents_summary = [
        {
            "document_type": d.document_type,
            "filename": d.original_filename,
            "upload_timestamp": d.upload_time.isoformat() + "Z" if d.upload_time else None,
            "page_count": d.page_count
        }
        for d in app.documents
    ]

    return {
        "application_id": app.id,
        "academic_year": app.academic_year,
        "category": app.category,
        "institution_name": app.institution.name if app.institution else "ABC Institute of Technology",
        "permanent_id": app.institution.permanent_id if app.institution else "1-9876543210",
        "current_scrutiny_stage": "Deficiencies Flagged" if applicant_notices else "Preliminary Scrutiny Underway",
        "overall_status": app.status,
        "submitted_documents": documents_summary,
        "action_items_for_applicant": applicant_notices,
        "note": "Official AICTE Scrutiny Communication Portal (Applicant View)."
    }
