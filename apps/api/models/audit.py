"""
Append-Only Tamper-Evident Audit Event Model for VeriScope.
Implements cryptographic SHA-256 hash chaining (each block references prev_hash).
"""

from datetime import datetime
import hashlib
import json
import uuid
from sqlalchemy import Column, String, DateTime, Text
from apps.api.db.database import Base

GENESIS_HASH = "0" * 64


class AuditAction:
    APPLICATION_CREATED = "APPLICATION_CREATED"
    DOCUMENT_UPLOADED = "DOCUMENT_UPLOADED"
    DOCUMENT_DELETED = "DOCUMENT_DELETED"
    ANALYSIS_TRIGGERED = "ANALYSIS_TRIGGERED"
    EXTRACTION_COMPLETED = "EXTRACTION_COMPLETED"
    FIELD_CORRECTED = "FIELD_CORRECTED"
    FINDING_CONFIRMED = "FINDING_CONFIRMED"
    FINDING_DISMISSED = "FINDING_DISMISSED"
    CLARIFICATION_REQUESTED = "CLARIFICATION_REQUESTED"
    CASE_ESCALATED = "CASE_ESCALATED"
    REPORT_EXPORTED = "REPORT_EXPORTED"


class AuditEvent(Base):
    __tablename__ = "audit_events"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    actor_id = Column(String(36), nullable=False, index=True)
    action = Column(String(100), nullable=False, index=True)
    entity_type = Column(String(50), nullable=False)
    entity_id = Column(String(36), nullable=False, index=True)
    timestamp = Column(DateTime, default=datetime.utcnow, nullable=False)
    metadata_json = Column(Text, default="{}")
    prev_hash = Column(String(64), nullable=False)
    current_hash = Column(String(64), nullable=False, index=True)

    @staticmethod
    def compute_hash(prev_hash: str, event_id: str, actor_id: str, action: str, entity_type: str, entity_id: str, timestamp_iso: str, metadata_json: str) -> str:
        """Computes SHA-256 hash chain digest for an audit entry."""
        payload = f"{prev_hash}|{event_id}|{actor_id}|{action}|{entity_type}|{entity_id}|{timestamp_iso}|{metadata_json}"
        return hashlib.sha256(payload.encode("utf-8")).hexdigest()
