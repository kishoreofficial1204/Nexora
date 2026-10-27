"""Reviewer alerts generated from findings, verification results, and pending work."""

from datetime import datetime
import uuid

from sqlalchemy import Column, String, DateTime, ForeignKey, Text
from sqlalchemy.orm import relationship

from apps.api.db.database import Base


class AlertStatus:
    OPEN = "open"
    ACKNOWLEDGED = "acknowledged"
    RESOLVED = "resolved"


class AlertType:
    MISSING_DOCUMENT = "missing_document"
    EXPIRED_DOCUMENT = "expired_document"
    INCONSISTENCY = "inconsistency"
    ANOMALY_SIGNAL = "anomaly_signal"
    VERIFICATION = "verification"
    MANUAL_REVIEW = "manual_review"
    RECTIFICATION = "rectification"


class Alert(Base):
    __tablename__ = "alerts"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    application_id = Column(String(36), ForeignKey("applications.id"), nullable=False, index=True)
    finding_id = Column(String(36), ForeignKey("findings.id"), nullable=True, index=True)
    verification_id = Column(String(36), ForeignKey("verification_records.id"), nullable=True, index=True)

    alert_type = Column(String(50), nullable=False, index=True)
    severity = Column(String(50), nullable=False, default="warning")
    title = Column(String(255), nullable=False)
    message = Column(Text, nullable=False)
    status = Column(String(50), nullable=False, default=AlertStatus.OPEN, index=True)

    created_at = Column(DateTime, default=datetime.utcnow)
    acknowledged_by = Column(String(36), nullable=True)
    acknowledged_at = Column(DateTime, nullable=True)
    resolved_by = Column(String(36), nullable=True)
    resolved_at = Column(DateTime, nullable=True)
    resolution_note = Column(Text, nullable=True)

    application = relationship("Application", lazy="joined")
