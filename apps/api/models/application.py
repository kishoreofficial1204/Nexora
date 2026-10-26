"""
Application Model for VeriScope.
Stores submission cases, academic year, category, and configurable assessment date.
"""

from datetime import datetime
import uuid
from sqlalchemy import Column, String, DateTime, ForeignKey, Text
from sqlalchemy.orm import relationship
from apps.api.db.database import Base


class ApplicationStatus:
    PRELIMINARY_REVIEW = "preliminary_review"
    IN_PROGRESS = "in_progress"
    DEFICIENCIES_FLAGGED = "deficiencies_flagged"
    ESCALATED = "escalated"
    REVIEW_COMPLETED = "review_completed"


class Application(Base):
    __tablename__ = "applications"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    institution_id = Column(String(36), ForeignKey("institutions.id"), nullable=False, index=True)
    category = Column(String(100), default="Extension of Approval (EoA)")
    academic_year = Column(String(20), default="2026-27")
    assessment_date = Column(String(10), default="2026-10-26")  # YYYY-MM-DD format
    status = Column(String(50), default=ApplicationStatus.PRELIMINARY_REVIEW)
    recommendation = Column(String(50), nullable=True)  # RECOMMEND_APPROVAL, RECOMMEND_REJECTION, REQUEST_RESUBMISSION, REFER_TO_HEARING
    recommendation_rationale = Column(Text, nullable=True)
    recommendation_by = Column(String(36), nullable=True)
    recommendation_at = Column(DateTime, nullable=True)
    rule_pack_id = Column(String(100), default="pack_eoa_ug_2026")
    created_by_id = Column(String(36), ForeignKey("users.id"), nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relationships
    institution = relationship("Institution", lazy="joined")
    documents = relationship("Document", back_populates="application", cascade="all, delete-orphan", lazy="selectin")
