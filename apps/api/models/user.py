"""
User and Role Model for VeriScope.
Enforces server-side RBAC across applicant, reviewer, senior_reviewer, admin, and auditor roles.
"""

from datetime import datetime
import uuid
from sqlalchemy import Column, String, Boolean, DateTime
from apps.api.db.database import Base


class UserRole:
    APPLICANT = "applicant"
    REVIEWER = "reviewer"
    SENIOR_REVIEWER = "senior_reviewer"
    ADMIN = "admin"
    AUDITOR = "auditor"

    ALL = [APPLICANT, REVIEWER, SENIOR_REVIEWER, ADMIN, AUDITOR]


class User(Base):
    __tablename__ = "users"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    email = Column(String(255), unique=True, index=True, nullable=False)
    hashed_password = Column(String(255), nullable=False)
    full_name = Column(String(255), nullable=False)
    role = Column(String(50), nullable=False, default=UserRole.REVIEWER)
    organization = Column(String(255), nullable=True)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.utcnow)
