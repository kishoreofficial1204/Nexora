"""
Rule Pack Loader & Schema Validation.
Parses versioned YAML rule packs and exposes typed validation models.
Preserves rule ID, version, draft status, and regulatory references.
"""

import os
import re
import yaml
from functools import lru_cache
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


def _default_rules_dir(rules_dir: Optional[str] = None) -> str:
    if rules_dir is not None:
        return rules_dir
    project_root = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", ".."))
    return os.path.join(project_root, "rules", "packs")


def _normalise_category(value: str) -> str:
    """Makes category matching tolerant of common portal/UI labels."""
    clean = (value or "").lower()
    clean = clean.replace("extension of approval (eoa)", "extension of approval")
    clean = clean.replace("extension of approval", "extension of approval")
    clean = clean.replace("eoa", "extension of approval")
    clean = re.sub(r"[^a-z0-9]+", " ", clean).strip()
    return clean


@lru_cache(maxsize=8)
def _load_cached(path: str, mtime_ns: int) -> RulePack:
    return load_rule_pack(path)


def load_rule_pack_cached(yaml_path: str) -> RulePack:
    """Loads a pack while invalidating the cache when the file changes."""
    stat = os.stat(yaml_path)
    return _load_cached(os.path.abspath(yaml_path), stat.st_mtime_ns)


def list_rule_packs(rules_dir: Optional[str] = None) -> List[RulePack]:
    directory = _default_rules_dir(rules_dir)
    if not os.path.isdir(directory):
        return []
    packs: List[RulePack] = []
    for filename in sorted(os.listdir(directory)):
        if not filename.lower().endswith((".yaml", ".yml")):
            continue
        try:
            packs.append(load_rule_pack_cached(os.path.join(directory, filename)))
        except Exception:
            # A malformed pack must not silently become the active pack.
            continue
    return packs


def get_rule_pack_by_id(pack_id: str, rules_dir: Optional[str] = None) -> Optional[RulePack]:
    for pack in list_rule_packs(rules_dir):
        if pack.rule_pack.id == pack_id:
            return pack
    return None


def get_rule_pack_for_application(
    category: Optional[str] = None,
    rule_pack_id: Optional[str] = None,
    academic_year: Optional[str] = None,
    rules_dir: Optional[str] = None,
) -> RulePack:
    """Selects the active pack by explicit ID, then category/year, then default.

    Selection is intentionally fail-safe: an unknown category falls back to the
    default EoA pack and the caller records that fallback in the validation run.
    """
    if rule_pack_id:
        selected = get_rule_pack_by_id(rule_pack_id, rules_dir)
        if selected:
            return selected

    target_category = _normalise_category(category or "")
    target_year = (academic_year or "").strip()
    candidates = list_rule_packs(rules_dir)

    for pack in candidates:
        for rule in pack.rules:
            applicability = rule.applicability or {}
            rule_category = _normalise_category(str(applicability.get("category", "")))
            rule_year = str(applicability.get("academic_year", "")).strip()
            if target_category and rule_category and target_category == rule_category:
                if not target_year or not rule_year or target_year == rule_year:
                    return pack

    return get_default_rule_pack(rules_dir)


def get_default_rule_pack(rules_dir: Optional[str] = None) -> RulePack:
    """Convenience helper to retrieve default Extension of Approval 2026-27 draft pack."""
    directory = _default_rules_dir(rules_dir)
    default_pack_path = os.path.join(directory, "eoa_v2026_draft.yaml")
    return load_rule_pack_cached(default_pack_path)
