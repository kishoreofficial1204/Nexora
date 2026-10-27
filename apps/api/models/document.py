"""
Document Model for Nexora.
Stores immutable upload records, cryptographic hashes, page counts, and storage locations.
"""

from datetime import datetime
import uuid
from sqlalchemy import Column, String, Integer, DateTime, ForeignKey
from sqlalchemy.orm import relationship
from apps.api.db.database import Base


class DocumentSourceStatus:
    UPLOADED = "uploaded"
    PENDING_PARSING = "pending_parsing"
    PARSED = "parsed"
    ERROR = "error"


class Document(Base):
    __tablename__ = "documents"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    application_id = Column(String(36), ForeignKey("applications.id"), nullable=False, index=True)
    document_type = Column(String(100), nullable=False, default="unknown")
    filename = Column(String(255), nullable=False)
    original_filename = Column(String(255), nullable=False)
    file_size = Column(Integer, nullable=False)
    mime_type = Column(String(100), default="application/pdf")
    hash_sha256 = Column(String(64), nullable=False, index=True)
    storage_path = Column(String(500), nullable=False)
    page_count = Column(Integer, default=1)
    source_status = Column(String(50), default=DocumentSourceStatus.UPLOADED)
    upload_time = Column(DateTime, default=datetime.utcnow)

    # Relationship back to application
    application = relationship("Application", back_populates="documents")
