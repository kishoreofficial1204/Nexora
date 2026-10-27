"""
Validation & Findings Router for Nexora.
Executes deterministic compliance rules and anomaly checks.
Serves evidence-linked findings for the scrutiny review console.
"""

from typing import List, Dict, Any, Optional
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, ConfigDict
from sqlalchemy.orm import Session
from sqlalchemy import desc

from apps.api.db.database import get_db
from apps.api.models.user import User, UserRole
from apps.api.models.application import Application
from apps.api.models.finding import Finding
from apps.api.models.audit import AuditAction
from apps.api.core.security import get_current_user, require_roles
from apps.api.core.audit_logger import log_audit_event
from apps.api.pipeline.validator import validate_application

router = APIRouter(prefix="/api", tags=["Validation & Findings"])


class FindingOut(BaseModel):
    id: str
    application_id: str
    rule_id: str
    rule_version: str
    finding_type: str
    severity: str
    status: str
    title: str
    explanation: str
    recommended_action: str
    evidence_refs: List[Dict[str, Any]]
    confidence: float
    is_heuristic: bool

    model_config = ConfigDict(from_attributes=True)


@router.post("/applications/{id}/validate", response_model=List[FindingOut])
def run_validation_endpoint(
    id: str,
    current_user: User = Depends(require_roles([UserRole.REVIEWER, UserRole.SENIOR_REVIEWER, UserRole.ADMIN])),
    db: Session = Depends(get_db)
):
    """
    Executes the deterministic validation and anomaly detection pipeline.
    Produces evidence-linked findings without ever issuing an automated rejection.
    """
    app = db.query(Application).filter(Application.id == id).first()
    if not app:
        raise HTTPException(status_code=404, detail="Application case not found.")

    findings = validate_application(app=app, db=db)

    log_audit_event(
        db=db,
        actor_id=current_user.id,
        action=AuditAction.ANALYSIS_TRIGGERED,
        entity_type="application",
        entity_id=app.id,
        metadata={
            "findings_count": len(findings),
            "fails": sum(1 for f in findings if f.severity == "fail"),
            "warnings": sum(1 for f in findings if f.severity == "warning"),
            "overall_preliminary_status": app.status
        }
    )

    return findings


@router.get("/applications/{id}/findings", response_model=List[FindingOut])
def get_application_findings(
    id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Returns all findings for an application case."""
    app = db.query(Application).filter(Application.id == id).first()
    if not app:
        raise HTTPException(status_code=404, detail="Application case not found.")

    if current_user.role == UserRole.APPLICANT and app.owner_id != current_user.id:
        raise HTTPException(status_code=403, detail="Forbidden: You do not have access to this application.")

    # RBAC constraint: Applicants must not see internal risk signals or heuristic notes
    findings_query = db.query(Finding).filter(Finding.application_id == id).order_by(desc(Finding.created_at))

    if current_user.role == UserRole.APPLICANT:
        # Applicants only see permitted deficiency items (e.g. missing documents, expired certificates)
        findings_query = findings_query.filter(Finding.is_heuristic == False)

    return findings_query.all()
