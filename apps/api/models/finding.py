"""
Finding Model for Nexora.
Stores evidence-backed findings linking rules, source documents, pages, and severity.
Strictly distinguishes deterministic rules from heuristic anomaly signals.
"""

from datetime import datetime
import uuid
import json
from typing import List, Dict, Any
from sqlalchemy import Column, String, Float, Boolean, DateTime, ForeignKey, Text
from sqlalchemy.orm import relationship
from apps.api.db.database import Base


class FindingSeverity:
    FAIL = "fail"
    WARNING = "warning"
    MANUAL_REVIEW = "manual_review_required"
    INFO = "info"


class FindingStatus:
    OPEN = "open"
    CONFIRMED = "confirmed"
    DISMISSED = "dismissed"
    CLARIFICATION_REQUESTED = "clarification_requested"
    ESCALATED = "escalated"
    RESOLVED = "resolved"


class Finding(Base):
    __tablename__ = "findings"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    application_id = Column(String(36), ForeignKey("applications.id"), nullable=False, index=True)
    rule_id = Column(String(100), nullable=False, index=True)
    rule_version = Column(String(50), default="1.0-draft")
    finding_type = Column(String(100), nullable=False, index=True)
    severity = Column(String(50), default=FindingSeverity.WARNING)
    status = Column(String(50), default=FindingStatus.OPEN)
    title = Column(String(255), nullable=False)
    explanation = Column(Text, nullable=False)
    recommended_action = Column(Text, nullable=False)
    evidence_refs_json = Column(Text, default="[]")  # List[Dict[str, Any]]
    confidence = Column(Float, default=1.0)
    is_heuristic = Column(Boolean, default=False)
    review_rationale = Column(Text, nullable=True)
    reviewed_by = Column(String(36), nullable=True)
    reviewed_at = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relationships
    application = relationship("Application", lazy="joined")

    @property
    def evidence_refs(self) -> List[Dict[str, Any]]:
        try:
            return json.loads(self.evidence_refs_json)
        except Exception:
            return []

    @evidence_refs.setter
    def evidence_refs(self, value: List[Dict[str, Any]]):
        self.evidence_refs_json = json.dumps(value)
