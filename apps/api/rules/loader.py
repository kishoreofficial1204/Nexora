"""
Rule Pack Loader & Schema Validation.
Parses versioned YAML rule packs and exposes typed validation models.
Preserves rule ID, version, draft status, and regulatory references.
"""

import os
import yaml
from typing import List, Optional, Dict, Any
from pydantic import BaseModel, Field


class ChecklistItem(BaseModel):
    id: str
    document_type: str
    title: str
    is_required: bool
    condition_predicate: Optional[str] = None
    description: str


class RuleDefinition(BaseModel):
    rule_id: str
    title: str
    source_document: str
    source_url: str
    section_page: str
    version: str
    effective_from: str
    effective_to: str
    status: str
    applicability: Dict[str, Any]
    required_evidence: List[str] = []
    expected_fields: List[str] = []
    validation_logic: Dict[str, Any]
    severity: str
    explanation_template: str
    reviewer_action: str
    is_heuristic: bool = False


class RulePackMetadata(BaseModel):
    id: str
    name: str
    academic_year: str
    version: str
    status: str
    banner_notice: str
    effective_from: str
    effective_to: str
    approved_by: Optional[str] = None
    source_register_ref: str


class RulePack(BaseModel):
    rule_pack: RulePackMetadata
    checklist_items: List[ChecklistItem]
    rules: List[RuleDefinition]


def load_rule_pack(yaml_path: str) -> RulePack:
    """Loads and validates a rule pack YAML file."""
    if not os.path.exists(yaml_path):
        raise FileNotFoundError(f"Rule pack YAML not found at: {yaml_path}")

    with open(yaml_path, "r", encoding="utf-8") as f:
        data = yaml.safe_load(f)

    return RulePack(**data)


def get_default_rule_pack(rules_dir: Optional[str] = None) -> RulePack:
    """Convenience helper to retrieve default Extension of Approval 2026-27 draft pack."""
    if rules_dir is None:
        # Relative to project root
        project_root = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", ".."))
        rules_dir = os.path.join(project_root, "rules", "packs")

    default_pack_path = os.path.join(rules_dir, "eoa_v2026_draft.yaml")
    return load_rule_pack(default_pack_path)
