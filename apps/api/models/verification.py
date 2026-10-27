"""Persisted external-source verification records.

A verification is a first-class case artefact: it stores what was asked, which
authority answered, when it answered, what it returned, and how the submitted
document compared with that response.
"""

from datetime import datetime
import uuid

from sqlalchemy import Column, String, Boolean, DateTime, ForeignKey, Text
from sqlalchemy.orm import relationship

from apps.api.db.database import Base


class VerificationStatus:
    VERIFIED = "verified"
    MISMATCH_DETECTED = "mismatch_detected"
    EXPIRED = "expired"
    VERIFICATION_PENDING = "verification_pending"
    SOURCE_UNAVAILABLE = "source_unavailable"
    MANUAL_REVIEW_REQUIRED = "manual_review_required"
    NOT_VERIFIED = "not_verified"

    ALL = [
        VERIFIED,
        MISMATCH_DETECTED,
        EXPIRED,
        VERIFICATION_PENDING,
        SOURCE_UNAVAILABLE,
        MANUAL_REVIEW_REQUIRED,
        NOT_VERIFIED,
    ]


class VerificationType:
    API = "api"
    PORTAL = "portal"
    QR = "qr"
    DIGITAL_SIGNATURE = "digital_signature"
    MANUAL = "manual"


class VerificationRecord(Base):
    __tablename__ = "verification_records"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    application_id = Column(String(36), ForeignKey("applications.id"), nullable=False, index=True)
    document_id = Column(String(36), ForeignKey("documents.id"), nullable=True, index=True)

    authority_id = Column(String(100), nullable=False, index=True)
    authority_name = Column(String(255), nullable=False)
    verification_type = Column(String(50), default=VerificationType.API)
    status = Column(String(50), nullable=False, default=VerificationStatus.NOT_VERIFIED, index=True)

    query_payload_json = Column(Text, default="{}")
    response_payload_json = Column(Text, default="{}")
    matched_fields_json = Column(Text, default="[]")
    mismatch_fields_json = Column(Text, default="[]")

    source_timestamp = Column(String(100), nullable=True)
    checked_at = Column(DateTime, default=datetime.utcnow)
    checked_by_id = Column(String(36), ForeignKey("users.id"), nullable=True)
    badge = Column(String(255), nullable=True)
    is_simulated = Column(Boolean, default=True)
    error_message = Column(Text, nullable=True)
    notes = Column(Text, nullable=True)

    application = relationship("Application", lazy="joined")
    document = relationship("Document", lazy="joined")
