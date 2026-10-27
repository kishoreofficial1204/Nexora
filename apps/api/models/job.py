"""
Job Model for Nexora.
Tracks asynchronous background parsing and validation tasks with visible job state.
"""

from datetime import datetime
import uuid
from sqlalchemy import Column, String, Integer, DateTime, ForeignKey, Text
from apps.api.db.database import Base


class JobStatus:
    QUEUED = "queued"
    PROCESSING = "processing"
    COMPLETED = "completed"
    FAILED = "failed"


class Job(Base):
    __tablename__ = "jobs"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    application_id = Column(String(36), ForeignKey("applications.id"), nullable=False, index=True)
    job_type = Column(String(100), default="document_pipeline")
    status = Column(String(50), default=JobStatus.QUEUED)
    progress_pct = Column(Integer, default=0)
    stage_message = Column(String(255), default="Initialized")
    error_message = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
