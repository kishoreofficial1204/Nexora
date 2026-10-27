"""Persisted validation-run and rule-execution records for explainability/audit."""

from datetime import datetime
import uuid

from sqlalchemy import Column, String, Integer, Boolean, DateTime, ForeignKey, Text
from sqlalchemy.orm import relationship

from apps.api.db.database import Base


class ValidationRunStatus:
    RUNNING = "running"
    COMPLETED = "completed"
    FAILED = "failed"


class ValidationRun(Base):
    __tablename__ = "validation_runs"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    application_id = Column(String(36), ForeignKey("applications.id"), nullable=False, index=True)
    rule_pack_id = Column(String(100), nullable=False)
    rule_pack_version = Column(String(50), nullable=False)
    status = Column(String(50), default=ValidationRunStatus.RUNNING)
    started_at = Column(DateTime, default=datetime.utcnow)
    completed_at = Column(DateTime, nullable=True)
    findings_count = Column(Integer, default=0)
    summary_json = Column(Text, default="{}")

    application = relationship("Application", lazy="joined")
    executions = relationship("RuleExecution", back_populates="validation_run", cascade="all, delete-orphan")


class RuleExecution(Base):
    __tablename__ = "rule_executions"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    validation_run_id = Column(String(36), ForeignKey("validation_runs.id"), nullable=False, index=True)
    rule_id = Column(String(100), nullable=False, index=True)
    rule_version = Column(String(50), nullable=False)
    status = Column(String(50), nullable=False)
    finding_type = Column(String(100), nullable=True)
    explanation = Column(Text, nullable=True)
    evidence_refs_json = Column(Text, default="[]")
    is_heuristic = Column(Boolean, default=False)
    created_at = Column(DateTime, default=datetime.utcnow)

    validation_run = relationship("ValidationRun", back_populates="executions")
