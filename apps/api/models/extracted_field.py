"""
ExtractedField Model for Nexora.
Stores every extracted field with strict provenance (page, bounding box, extraction method,
confidence, raw string, and normalized value).
"""

from datetime import datetime
import uuid
import json
from sqlalchemy import Column, String, Integer, Float, DateTime, ForeignKey, Text
from sqlalchemy.orm import relationship
from apps.api.db.database import Base


class FieldReviewStatus:
    UNREVIEWED = "unreviewed"
    CONFIRMED = "confirmed"
    CORRECTED = "corrected"
    FLAGGED = "flagged"


class ExtractedField(Base):
    __tablename__ = "extracted_fields"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    document_id = Column(String(36), ForeignKey("documents.id"), nullable=False, index=True)
    field_name = Column(String(100), nullable=False, index=True)
    raw_value = Column(Text, nullable=False)
    normalized_value = Column(Text, nullable=False)
    page = Column(Integer, default=1, nullable=False)
    bbox_json = Column(String(255), default="[0, 0, 0, 0]")  # [x0, y0, x1, y1]
    method = Column(String(50), default="native_pdf_text")   # native_pdf_text, ocr, pdfplumber_table
    confidence = Column(Float, default=1.0)
    review_status = Column(String(50), default=FieldReviewStatus.UNREVIEWED)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relationship back to document
    document = relationship("Document", lazy="joined")

    @property
    def bbox(self):
        try:
            return json.loads(self.bbox_json)
        except Exception:
            return [0, 0, 0, 0]

    @bbox.setter
    def bbox(self, value):
        self.bbox_json = json.dumps(value)
