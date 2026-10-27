"""Reviewer alert centre endpoints."""

from datetime import datetime
from typing import Any, Dict, List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, field_validator
from sqlalchemy import desc
from sqlalchemy.orm import Session

from apps.api.core.audit_logger import log_audit_event
from apps.api.core.security import require_roles
from apps.api.db.database import get_db
from apps.api.models.alert import Alert, AlertStatus
from apps.api.models.application import Application
from apps.api.models.audit import AuditAction
from apps.api.models.user import User, UserRole

router = APIRouter(prefix="/api", tags=["Alerts"])

REVIEW_ROLES = [UserRole.REVIEWER, UserRole.SENIOR_REVIEWER, UserRole.ADMIN]
READ_ROLES = REVIEW_ROLES + [UserRole.AUDITOR]


class AlertAcknowledgeRequest(BaseModel):
    note: Optional[str] = None


class AlertResolveRequest(BaseModel):
    resolution_note: str

    @field_validator("resolution_note")
    def validate_note(cls, value: str) -> str:
        clean = (value or "").strip()
        if len(clean) < 5:
            raise ValueError("A resolution note of at least 5 characters is required.")
        return clean


def serialize_alert(alert: Alert) -> Dict[str, Any]:
    return {
        "id": alert.id,
        "application_id": alert.application_id,
        "finding_id": alert.finding_id,
        "verification_id": alert.verification_id,
        "alert_type": alert.alert_type,
        "severity": alert.severity,
        "title": alert.title,
        "message": alert.message,
        "status": alert.status,
        "created_at": alert.created_at.isoformat() + "Z" if alert.created_at else None,
        "acknowledged_by": alert.acknowledged_by,
        "acknowledged_at": alert.acknowledged_at.isoformat() + "Z" if alert.acknowledged_at else None,
        "resolved_by": alert.resolved_by,
        "resolved_at": alert.resolved_at.isoformat() + "Z" if alert.resolved_at else None,
        "resolution_note": alert.resolution_note,
    }


@router.get("/alerts")
def list_alerts(
    status_filter: Optional[str] = Query(None, alias="status"),
    application_id: Optional[str] = Query(None),
    current_user: User = Depends(require_roles(READ_ROLES)),
    db: Session = Depends(get_db),
):
    query = db.query(Alert).order_by(desc(Alert.created_at))
    if status_filter:
        query = query.filter(Alert.status == status_filter)
    if application_id:
        query = query.filter(Alert.application_id == application_id)
    return [serialize_alert(alert) for alert in query.all()]


@router.get("/applications/{id}/alerts")
def list_application_alerts(
    id: str,
    current_user: User = Depends(require_roles(READ_ROLES)),
    db: Session = Depends(get_db),
):
    app = db.query(Application).filter(Application.id == id).first()
    if not app:
        raise HTTPException(status_code=404, detail="Application case not found.")
    alerts = (
        db.query(Alert)
        .filter(Alert.application_id == id)
        .order_by(desc(Alert.created_at))
        .all()
    )
    return [serialize_alert(alert) for alert in alerts]


@router.post("/alerts/{id}/acknowledge")
def acknowledge_alert(
    id: str,
    req: AlertAcknowledgeRequest,
    current_user: User = Depends(require_roles(REVIEW_ROLES)),
    db: Session = Depends(get_db),
):
    alert = db.query(Alert).filter(Alert.id == id).first()
    if not alert:
        raise HTTPException(status_code=404, detail="Alert not found.")
    if alert.status == AlertStatus.RESOLVED:
        raise HTTPException(status_code=400, detail="Resolved alerts cannot be acknowledged.")

    alert.status = AlertStatus.ACKNOWLEDGED
    alert.acknowledged_by = current_user.email
    alert.acknowledged_at = datetime.utcnow()
    log_audit_event(
        db=db,
        actor_id=current_user.id,
        action=AuditAction.ALERT_ACKNOWLEDGED,
        entity_type="alert",
        entity_id=alert.id,
        metadata={
            "application_id": alert.application_id,
            "note": req.note,
            "status": alert.status,
        },
    )
    db.commit()
    db.refresh(alert)
    return serialize_alert(alert)


@router.post("/alerts/{id}/resolve")
def resolve_alert(
    id: str,
    req: AlertResolveRequest,
    current_user: User = Depends(require_roles(REVIEW_ROLES)),
    db: Session = Depends(get_db),
):
    alert = db.query(Alert).filter(Alert.id == id).first()
    if not alert:
        raise HTTPException(status_code=404, detail="Alert not found.")

    alert.status = AlertStatus.RESOLVED
    alert.resolved_by = current_user.email
    alert.resolved_at = datetime.utcnow()
    alert.resolution_note = req.resolution_note
    log_audit_event(
        db=db,
        actor_id=current_user.id,
        action=AuditAction.ALERT_RESOLVED,
        entity_type="alert",
        entity_id=alert.id,
        metadata={
            "application_id": alert.application_id,
            "resolution_note": req.resolution_note,
            "status": alert.status,
        },
    )
    db.commit()
    db.refresh(alert)
    return serialize_alert(alert)
