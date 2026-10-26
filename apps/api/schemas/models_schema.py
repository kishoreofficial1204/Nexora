from pydantic import BaseModel, ConfigDict
from typing import Optional, List
from datetime import datetime


class InstitutionOut(BaseModel):
    id: str
    name: str
    permanent_id: str
    address: str
    state: str
    institution_type: str

    model_config = ConfigDict(from_attributes=True)


class DocumentOut(BaseModel):
    id: str
    application_id: str
    document_type: str
    filename: str
    original_filename: str
    file_size: int
    mime_type: str
    hash_sha256: str
    page_count: int
    source_status: str
    upload_time: datetime

    model_config = ConfigDict(from_attributes=True)


class ApplicationCreate(BaseModel):
    institution_id: Optional[str] = None
    category: str = "Extension of Approval (EoA)"
    academic_year: str = "2026-27"
    assessment_date: str = "2026-10-26"
    rule_pack_id: str = "pack_eoa_ug_2026"


class ApplicationOut(BaseModel):
    id: str
    institution_id: str
    category: str
    academic_year: str
    assessment_date: str
    status: str
    rule_pack_id: str
    created_by_id: str
    created_at: datetime
    updated_at: datetime
    institution: Optional[InstitutionOut] = None
    documents: List[DocumentOut] = []

    model_config = ConfigDict(from_attributes=True)


class AuditEventOut(BaseModel):
    id: str
    actor_id: str
    action: str
    entity_type: str
    entity_id: str
    timestamp: datetime
    metadata_json: str
    prev_hash: str
    current_hash: str

    model_config = ConfigDict(from_attributes=True)


class AuditVerificationOut(BaseModel):
    verified: bool
    chain_length: int
    status: str
    tampered_at_event_id: Optional[str] = None
