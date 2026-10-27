"""Non-destructive forensic analysis snapshot for an uploaded document."""

from datetime import datetime
import uuid

from sqlalchemy import Column, String, DateTime, ForeignKey, Text
from sqlalchemy.orm import relationship

from apps.api.db.database import Base


class DocumentAnalysis(Base):
    __tablename__ = "document_analyses"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    document_id = Column(String(36), ForeignKey("documents.id"), nullable=False, unique=True, index=True)

    perceptual_hash = Column(String(64), nullable=True)
    metadata_json = Column(Text, default="{}")
    qr_codes_json = Column(Text, default="[]")
    signature_status = Column(String(50), default="not_checked")
    signature_details_json = Column(Text, default="{}")
    forensics_json = Column(Text, default="{}")
    analysis_version = Column(String(50), default="1.0")
    analyzed_at = Column(DateTime, default=datetime.utcnow)

    document = relationship("Document", lazy="joined")
