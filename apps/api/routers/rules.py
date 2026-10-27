"""
Rules, Sources, and Test Harness Router for VeriScope.
Serves versioned rule packs, handbook citations, source search, and test harness execution.
"""

from typing import List, Dict, Any, Optional
from datetime import datetime
from fastapi import APIRouter, Depends, Query, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session

from apps.api.db.database import get_db
from apps.api.models.institution import Institution
from apps.api.models.user import User, UserRole
from apps.api.schemas.models_schema import InstitutionOut
from apps.api.rules.loader import get_default_rule_pack
from apps.api.services.source_search import search_handbook_sources, DRAFT_BANNER, SOURCE_PLACEHOLDER
from apps.api.pipeline.validator import normalize_institution_name
from apps.api.core.security import require_roles

router = APIRouter(prefix="/api", tags=["Rules & Reference"])

READ_ROLES = [UserRole.REVIEWER, UserRole.SENIOR_REVIEWER, UserRole.ADMIN, UserRole.AUDITOR]
REVIEW_ROLES = [UserRole.REVIEWER, UserRole.SENIOR_REVIEWER, UserRole.ADMIN]


class RuleSearchRequest(BaseModel):
    query: str
    limit: Optional[int] = 5


class RuleTestEvalRequest(BaseModel):
    rule_id: str
    test_facts: Dict[str, Any]


@router.get("/rules")
def get_rules(
    current_user: User = Depends(require_roles(READ_ROLES)),
):
    """Returns active versioned rule pack and checklist items."""
    pack = get_default_rule_pack()
    return pack.dict()


@router.post("/rules/search")
def search_rules(
    req: RuleSearchRequest,
    current_user: User = Depends(require_roles(READ_ROLES)),
):
    """
    Search official AICTE handbook clauses, chapters, and rule pack citations.
    Returns excerpts with official draft disclaimers.
    """
    return search_handbook_sources(req.query, limit=req.limit or 5)


@router.post("/rules/test-eval")
def test_evaluate_rule(
    req: RuleTestEvalRequest,
    current_user: User = Depends(require_roles(REVIEW_ROLES)),
):
    """
    Interactive rule evaluation test harness.
    Allows scrutiny officers or developers to test a specific rule with synthetic facts.
    """
    pack = get_default_rule_pack()
    rule = next((r for r in pack.rules if r.rule_id == req.rule_id), None)
    if not rule:
        raise HTTPException(status_code=404, detail=f"Rule {req.rule_id} not found in active pack.")

    facts = req.test_facts
    result_status = "pass"
    explanation = f"Test evaluation passed rule '{rule.title}'."

    # Evaluation logic per rule
    if req.rule_id == "RULE-EOA-001":
        present_docs = facts.get("present_docs", [])
        missing = [req_doc for req_doc in rule.required_evidence if req_doc not in present_docs]
        if missing:
            result_status = "fail"
            explanation = f"Required application supporting document '{missing[0]}' is missing."
        else:
            explanation = "All mandatory checklist items are present in submission bundle."

    elif req.rule_id in ("RULE-EOA-002", "RULE-EOA-003"):
        valid_until = facts.get("valid_until_date")
        assessment_date = facts.get("assessment_date", "2026-10-26")
        if not valid_until:
            result_status = "fail"
            explanation = "Certificate validity date is missing from test inputs."
        else:
            try:
                exp_dt = datetime.strptime(valid_until, "%Y-%m-%d").date()
                as_dt = datetime.strptime(assessment_date, "%Y-%m-%d").date()
                if exp_dt < as_dt:
                    result_status = "fail"
                    explanation = f"Certificate expired on {valid_until} (prior to assessment date {assessment_date})."
                else:
                    explanation = f"Certificate remains valid until {valid_until} (post-dates assessment date {assessment_date})."
            except Exception as e:
                result_status = "fail"
                explanation = f"Invalid date format: {str(e)}"

    elif req.rule_id == "RULE-EOA-004":
        academic_year = facts.get("academic_year")
        expected_year = facts.get("expected_year", "2026-27")
        if academic_year != expected_year:
            result_status = "fail"
            explanation = f"Affiliation letter academic year '{academic_year}' does not match expected '{expected_year}'."
        else:
            explanation = f"Affiliation letter covers current academic year '{expected_year}'."

    elif req.rule_id == "RULE-EOA-005":
        app_intake = facts.get("app_intake")
        prev_intake = facts.get("prev_intake")
        if app_intake != prev_intake:
            result_status = "warning"
            explanation = f"Application claims intake of {app_intake}, but previous approval letter specifies {prev_intake} seats."
        else:
            explanation = f"Declared intake ({app_intake}) matches previously approved quota."

    elif req.rule_id == "RULE-EOA-006":
        name_a = str(facts.get("name_a", "")).strip()
        name_b = str(facts.get("name_b", "")).strip()
        if name_a.lower() != name_b.lower():
            result_status = "warning"
            explanation = f"Institution name variation detected: '{name_a}' vs '{name_b}'."
        else:
            explanation = "Institution name identical across compared records."

    elif req.rule_id == "RULE-EOA-007":
        pid_a = str(facts.get("pid_a", "")).strip()
        pid_b = str(facts.get("pid_b", "")).strip()
        if pid_a != pid_b:
            result_status = "fail"
            explanation = f"PID contradiction detected: '{pid_a}' on application vs '{pid_b}' on previous approval."
        else:
            explanation = f"Permanent Institute ID '{pid_a}' verified consistent."

    elif req.rule_id == "RULE-EOA-008":
        count = int(facts.get("photo_count", 0))
        if count < 4:
            result_status = "fail"
            explanation = f"Only {count} campus photographs submitted; minimum 4 required."
        else:
            explanation = f"{count} infrastructure photographs verified."

    elif req.rule_id == "RULE-EOA-009":
        hashes = facts.get("hashes", [])
        if len(hashes) != len(set(hashes)):
            result_status = "warning"
            explanation = "Duplicate cryptographic SHA-256 hash detected across documents."
        else:
            explanation = "All submitted documents possess distinct SHA-256 hashes."

    return {
        "rule_id": rule.rule_id,
        "title": rule.title,
        "source_document": rule.source_document,
        "section_page": rule.section_page,
        "status": result_status,
        "explanation": explanation,
        "severity": rule.severity,
        "is_heuristic": rule.is_heuristic,
        "banner_notice": DRAFT_BANNER,
        "placeholder_notice": SOURCE_PLACEHOLDER
    }


@router.get("/institutions", response_model=List[InstitutionOut])
def get_institutions(
    current_user: User = Depends(require_roles(READ_ROLES)),
    db: Session = Depends(get_db),
):
    """Returns available institutional profiles."""
    return db.query(Institution).all()
