"""Authorized institutional-record snapshot used for consistency checks.

The record is a synthetic/seed snapshot in this prototype. In production it would
be synchronised from an authorized AICTE registry adapter. Every check that uses
this record must retain the source and snapshot timestamp.
"""

from datetime import datetime
import uuid

from sqlalchemy import Column, String, Integer, Boolean, DateTime, ForeignKey, Text, UniqueConstraint
from sqlalchemy.orm import relationship

from apps.api.db.database import Base


class InstitutionRecord(Base):
    __tablename__ = "institution_records"
    __table_args__ = (
        UniqueConstraint("institution_id", "academic_year", name="uq_institution_record_year"),
    )

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    institution_id = Column(String(36), ForeignKey("institutions.id"), nullable=False, index=True)
    academic_year = Column(String(20), nullable=False, index=True)

    approved_intake = Column(Integer, nullable=True)
    approved_programmes_json = Column(Text, default="[]")
    previous_eoa_valid_until = Column(String(10), nullable=True)
    compliance_status = Column(String(50), default="COMPLIANT")
    deficiency_notes = Column(Text, nullable=True)
    ter_payment_status = Column(String(50), default="PAID")
    application_history_json = Column(Text, default="[]")

    source = Column(String(100), default="synthetic_registry")
    is_simulated = Column(Boolean, default=True)
    last_synced_at = Column(DateTime, default=datetime.utcnow)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    institution = relationship("Institution", lazy="joined")
