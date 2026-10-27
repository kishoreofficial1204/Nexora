"""
Institution Model for Nexora.
Stores institutional profiles and AICTE Permanent Institute IDs (PID).
"""

from datetime import datetime
import uuid
from sqlalchemy import Column, String, DateTime
from apps.api.db.database import Base


class Institution(Base):
    __tablename__ = "institutions"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    name = Column(String(255), nullable=False, index=True)
    permanent_id = Column(String(50), nullable=False, unique=True, index=True)
    address = Column(String(500), nullable=False)
    state = Column(String(100), nullable=False)
    institution_type = Column(String(100), default="Engineering & Technology - Undergraduate")
    profile_source = Column(String(100), default="synthetic_seed")
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
