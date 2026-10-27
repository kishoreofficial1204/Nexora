"""Applicant rectification requests and their submitted replacement documents."""

from datetime import datetime
import uuid

from sqlalchemy import Column, String, DateTime, ForeignKey, Text
from sqlalchemy.orm import relationship

from apps.api.db.database import Base


class RectificationStatus:
    OPEN = "open"
    SUBMITTED = "submitted"
    RESOLVED = "resolved"
    CANCELLED = "cancelled"


class RectificationRequest(Base):
    __tablename__ = "rectification_requests"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    application_id = Column(String(36), ForeignKey("applications.id"), nullable=False, index=True)
    finding_id = Column(String(36), ForeignKey("findings.id"), nullable=True, index=True)

    document_type = Column(String(100), nullable=False)
    request_message = Column(Text, nullable=False)
    status = Column(String(50), nullable=False, default=RectificationStatus.OPEN, index=True)

    requested_by = Column(String(36), nullable=True)
    requested_at = Column(DateTime, default=datetime.utcnow)
    submitted_document_id = Column(String(36), ForeignKey("documents.id"), nullable=True)
    submitted_at = Column(DateTime, nullable=True)
    resolved_by = Column(String(36), nullable=True)
    resolved_at = Column(DateTime, nullable=True)
    resolution_note = Column(Text, nullable=True)

    application = relationship("Application", lazy="joined")
    finding = relationship("Finding", lazy="joined")
    submitted_document = relationship("Document", lazy="joined")
