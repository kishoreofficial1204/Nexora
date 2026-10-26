"""
Rules and Institutions Reference Router for VeriScope.
Serves versioned rule packs, checklist schemas, and institution profiles.
"""

from typing import List
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from apps.api.db.database import get_db
from apps.api.models.institution import Institution
from apps.api.schemas.models_schema import InstitutionOut
from apps.api.rules.loader import get_default_rule_pack

router = APIRouter(prefix="/api", tags=["Rules & Reference"])


@router.get("/rules")
def get_rules():
    """Returns active versioned rule pack and checklist items."""
    pack = get_default_rule_pack()
    return pack.dict()


@router.get("/institutions", response_model=List[InstitutionOut])
def get_institutions(db: Session = Depends(get_db)):
    """Returns available institutional profiles."""
    return db.query(Institution).all()
