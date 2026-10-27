"""
Configurable rule interpreter for Nexora.

Rules are data, not code: each YAML rule declares an operator and the interpreter
resolves the required documents/fields from the case context. The interpreter is
intentionally conservative: missing or unreadable evidence becomes
`manual_review_required`, never a fabricated pass or failure.
"""

from __future__ import annotations

import os
import re
import difflib
from dataclasses import dataclass, field
from datetime import date, datetime
from typing import Any, Dict, Iterable, List, Optional, Sequence, Tuple
from urllib.parse import urlparse

from sqlalchemy.orm import Session

from apps.api.models.application import Application
from apps.api.models.document import Document
from apps.api.models.extracted_field import ExtractedField
from apps.api.models.institution_record import InstitutionRecord
from apps.api.rules.loader import ChecklistItem, RuleDefinition, RulePack


STATUS_PASS = "pass"
STATUS_FAIL = "fail"
STATUS_WARNING = "warning"
STATUS_MANUAL_REVIEW = "manual_review_required"
STATUS_NOT_APPLICABLE = "not_applicable"
STATUS_NOT_VERIFIED = "not_verified"


def normalize_institution_name(name: str) -> str:
    """Normalizes common technical-institute abbreviations for comparison."""
    clean = (name or "").lower().strip()
    clean = clean.replace(".", "").replace(",", "").replace("-", " ")
    clean = clean.replace("inst of tech", "institute of technology")
    clean = clean.replace("inst of technology", "institute of technology")
    clean = clean.replace("institute of tech", "institute of technology")
    clean = clean.replace("univ", "university")
    return " ".join(clean.split())


def _parse_date(value: Optional[str]) -> Optional[date]:
    if not value:
        return None
    for fmt in ("%Y-%m-%d", "%d-%m-%Y", "%d/%m/%Y"):
        try:
            return datetime.strptime(value.strip(), fmt).date()
        except Exception:
            continue
    return None


def _same_value(a: Any, b: Any) -> bool:
    return str(a).strip().lower() == str(b).strip().lower()


@dataclass
class ValidationContext:
    app: Application
    db: Session
    rule_pack: RulePack
    documents: List[Document]
    fields_by_doc: Dict[str, Dict[str, ExtractedField]]
    doc_by_type: Dict[str, List[Document]]
    doc_by_id: Dict[str, Document]
    checklist_by_id: Dict[str, ChecklistItem]
    assessment_date: date
    institution_record: Optional[InstitutionRecord] = None

    def first_doc(self, document_type: str) -> Optional[Document]:
        docs = self.doc_by_type.get(document_type) or []
        return docs[0] if docs else None

    def field(self, doc: Optional[Document], field_name: str) -> Optional[ExtractedField]:
        if not doc:
            return None
        return self.fields_by_doc.get(doc.id, {}).get(field_name)

    def field_value(self, doc: Optional[Document], field_name: str) -> Optional[str]:
        found = self.field(doc, field_name)
        return found.normalized_value if found else None

    def docs_for_rule(self, rule: RuleDefinition) -> List[Document]:
        docs: List[Document] = []
        for evidence_ref in rule.required_evidence:
            item = self.checklist_by_id.get(evidence_ref)
            # Rules may reference either a checklist item ID (chk_...) or a
            # document type (doc_...). Support both so packs stay declarative.
            document_type = item.document_type if item else evidence_ref
            docs.extend(self.doc_by_type.get(document_type, []))
        return docs


@dataclass
class RuleEvaluationResult:
    rule_id: str
    rule_version: str
    status: str
    title: str
    finding_type: str
    explanation: str
    recommended_action: str
    severity: str
    evidence_refs: List[Dict[str, Any]] = field(default_factory=list)
    confidence: float = 1.0
    is_heuristic: bool = False
    metadata: Dict[str, Any] = field(default_factory=dict)

    @property
    def creates_finding(self) -> bool:
        return self.status not in {STATUS_PASS, STATUS_NOT_APPLICABLE}


def _doc_evidence(doc: Document, field_obj: Optional[ExtractedField] = None) -> Dict[str, Any]:
    evidence: Dict[str, Any] = {
        "document_id": doc.id,
        "document_name": doc.original_filename,
        "document_type": doc.document_type,
        "sha256": doc.hash_sha256,
    }
    if field_obj is not None:
        evidence.update(
            {
                "page": field_obj.page,
                "field_name": field_obj.field_name,
                "value": field_obj.normalized_value,
                "raw_value": field_obj.raw_value,
                "bbox": field_obj.bbox,
                "confidence": field_obj.confidence,
                "method": field_obj.method,
            }
        )
    return evidence


def _result(
    rule: RuleDefinition,
    status: str,
    *,
    finding_type: str,
    explanation: str,
    evidence_refs: Optional[List[Dict[str, Any]]] = None,
    confidence: float = 1.0,
    metadata: Optional[Dict[str, Any]] = None,
) -> RuleEvaluationResult:
    severity = rule.severity
    if status == STATUS_MANUAL_REVIEW:
        severity = "manual_review_required"
    return RuleEvaluationResult(
        rule_id=rule.rule_id,
        rule_version=rule.version,
        status=status,
        title=rule.title,
        finding_type=finding_type,
        explanation=explanation,
        recommended_action=rule.reviewer_action,
        severity=severity,
        evidence_refs=evidence_refs or [],
        confidence=confidence,
        is_heuristic=rule.is_heuristic,
        metadata=metadata or {},
    )


def _missing_field_result(rule: RuleDefinition, doc: Document, field_name: str) -> RuleEvaluationResult:
    return _result(
        rule,
        STATUS_MANUAL_REVIEW,
        finding_type="missing_field",
        explanation=(
            f"Required field '{field_name}' could not be extracted from "
            f"'{doc.original_filename}'. Manual verification is required."
        ),
        evidence_refs=[_doc_evidence(doc)],
        confidence=0.35,
        metadata={"missing_field": field_name},
    )


def _all_present(rule: RuleDefinition, ctx: ValidationContext) -> RuleEvaluationResult:
    missing: List[Dict[str, Any]] = []
    for checklist_id in rule.required_evidence:
        item = ctx.checklist_by_id.get(checklist_id)
        if not item:
            continue
        if not ctx.doc_by_type.get(item.document_type):
            missing.append(
                {
                    "checklist_id": item.id,
                    "document_type": item.document_type,
                    "title": item.title,
                }
            )
    if missing:
        names = ", ".join(m["title"] for m in missing)
        explanation = rule.explanation_template.format(
            missing_item=missing[0]["checklist_id"],
            missing_documents=names,
        )
        explanation = f"{explanation} Missing document type: {missing[0]['document_type']}."
        return _result(
            rule,
            STATUS_FAIL,
            finding_type="missing_document",
            explanation=explanation,
            evidence_refs=missing,
            confidence=1.0,
            metadata={"missing": missing},
        )
    return _result(
        rule,
        STATUS_PASS,
        finding_type="completeness",
        explanation="All mandatory checklist documents are present.",
    )


def _date_on_or_after(rule: RuleDefinition, ctx: ValidationContext) -> RuleEvaluationResult:
    field_name = rule.validation_logic.get("field", "valid_until_date")
    docs = ctx.docs_for_rule(rule)
    if not docs:
        return _result(rule, STATUS_NOT_APPLICABLE, finding_type="date_validity", explanation="No required document was submitted.")

    expired: List[Tuple[Document, ExtractedField]] = []
    missing: List[Document] = []
    invalid: List[Document] = []
    for doc in docs:
        field_obj = ctx.field(doc, field_name)
        if not field_obj:
            missing.append(doc)
            continue
        expiry = _parse_date(field_obj.normalized_value)
        if expiry is None:
            invalid.append(doc)
            continue
        if expiry < ctx.assessment_date:
            expired.append((doc, field_obj))

    if expired:
        doc, field_obj = expired[0]
        return _result(
            rule,
            STATUS_FAIL,
            finding_type="certificate_expired",
            explanation=rule.explanation_template.format(
                field_val=field_obj.normalized_value,
                assessment_date=ctx.assessment_date.isoformat(),
            ),
            evidence_refs=[_doc_evidence(d, f) for d, f in expired],
            confidence=field_obj.confidence,
            metadata={"expired_count": len(expired)},
        )
    if missing:
        return _missing_field_result(rule, missing[0], field_name)
    if invalid:
        return _result(
            rule,
            STATUS_MANUAL_REVIEW,
            finding_type="unparseable_field",
            explanation=f"Field '{field_name}' exists but is not a valid ISO date.",
            evidence_refs=[_doc_evidence(invalid[0])],
            confidence=0.4,
        )
    return _result(
        rule,
        STATUS_PASS,
        finding_type="date_validity",
        explanation=f"All submitted validity dates are on or after {ctx.assessment_date.isoformat()}.",
    )


def _equals(rule: RuleDefinition, ctx: ValidationContext) -> RuleEvaluationResult:
    field_name = rule.validation_logic.get("field", "")
    expected = str(rule.validation_logic.get("expected", ""))
    docs = ctx.docs_for_rule(rule)
    if not docs:
        return _result(rule, STATUS_NOT_APPLICABLE, finding_type="field_equality", explanation="No required document was submitted.")

    mismatches: List[Tuple[Document, ExtractedField]] = []
    missing: List[Document] = []
    for doc in docs:
        field_obj = ctx.field(doc, field_name)
        if not field_obj:
            missing.append(doc)
            continue
        if not _same_value(field_obj.normalized_value, expected):
            mismatches.append((doc, field_obj))

    if mismatches:
        doc, field_obj = mismatches[0]
        return _result(
            rule,
            STATUS_FAIL,
            finding_type="field_mismatch",
            explanation=rule.explanation_template.format(
                field_val=field_obj.normalized_value,
                expected=expected,
            ),
            evidence_refs=[_doc_evidence(d, f) for d, f in mismatches],
            confidence=field_obj.confidence,
        )
    if missing:
        return _missing_field_result(rule, missing[0], field_name)
    return _result(
        rule,
        STATUS_PASS,
        finding_type="field_equality",
        explanation=f"Field '{field_name}' matches expected value '{expected}'.",
    )


def _cross_doc_equals(rule: RuleDefinition, ctx: ValidationContext) -> RuleEvaluationResult:
    logic = rule.validation_logic
    source_doc_type = logic.get("source_doc")
    target_doc_type = logic.get("target_doc")
    source_field = logic.get("source_field")
    target_field = logic.get("target_field")
    common_field = logic.get("field")

    pairs: List[Tuple[Document, ExtractedField, Document, ExtractedField]] = []

    if source_doc_type and target_doc_type and source_field and target_field:
        source_doc = ctx.first_doc(source_doc_type)
        target_doc = ctx.first_doc(target_doc_type)
        if not source_doc or not target_doc:
            return _result(rule, STATUS_NOT_APPLICABLE, finding_type="cross_document_consistency", explanation="One or both required documents are absent.")
        source_field_obj = ctx.field(source_doc, source_field)
        target_field_obj = ctx.field(target_doc, target_field)
        if not source_field_obj:
            return _missing_field_result(rule, source_doc, source_field)
        if not target_field_obj:
            return _missing_field_result(rule, target_doc, target_field)
        if not _same_value(source_field_obj.normalized_value, target_field_obj.normalized_value):
            pairs.append((source_doc, source_field_obj, target_doc, target_field_obj))
    else:
        docs = ctx.docs_for_rule(rule)
        if len(docs) < 2:
            return _result(rule, STATUS_NOT_APPLICABLE, finding_type="cross_document_consistency", explanation="Fewer than two required documents were submitted.")
        field_objs: List[Tuple[Document, ExtractedField]] = []
        for doc in docs:
            field_obj = ctx.field(doc, common_field or "")
            if not field_obj:
                return _missing_field_result(rule, doc, common_field or "required_field")
            field_objs.append((doc, field_obj))
        for idx in range(len(field_objs)):
            for jdx in range(idx + 1, len(field_objs)):
                a_doc, a_field = field_objs[idx]
                b_doc, b_field = field_objs[jdx]
                if not _same_value(a_field.normalized_value, b_field.normalized_value):
                    pairs.append((a_doc, a_field, b_doc, b_field))

    if not pairs:
        return _result(
            rule,
            STATUS_PASS,
            finding_type="cross_document_consistency",
            explanation="Compared document values are consistent.",
        )

    source_doc, source_field_obj, target_doc, target_field_obj = pairs[0]
    evidence = [
        _doc_evidence(source_doc, source_field_obj),
        _doc_evidence(target_doc, target_field_obj),
    ]
    return _result(
        rule,
        rule.severity if rule.severity in {STATUS_FAIL, STATUS_WARNING} else STATUS_WARNING,
        finding_type="intake_mismatch" if rule.rule_id == "RULE-EOA-005" else "cross_document_mismatch",
        explanation=rule.explanation_template.format(
            val_a=source_field_obj.normalized_value,
            val_b=target_field_obj.normalized_value,
        ),
        evidence_refs=evidence,
        confidence=min(source_field_obj.confidence, target_field_obj.confidence),
        metadata={"mismatch_pairs": len(pairs)},
    )


def _cross_doc_fuzzy_match(rule: RuleDefinition, ctx: ValidationContext) -> RuleEvaluationResult:
    field_name = rule.validation_logic.get("field", "institution_name")
    threshold = float(rule.validation_logic.get("threshold", 0.88))
    docs = ctx.docs_for_rule(rule)
    if len(docs) < 2:
        return _result(rule, STATUS_NOT_APPLICABLE, finding_type="name_variation_signal", explanation="Fewer than two documents contain the compared field.")

    values: List[Tuple[Document, ExtractedField]] = []
    for doc in docs:
        field_obj = ctx.field(doc, field_name)
        if not field_obj:
            return _missing_field_result(rule, doc, field_name)
        values.append((doc, field_obj))

    seen_pairs = set()
    for idx in range(len(values)):
        for jdx in range(idx + 1, len(values)):
            a_doc, a_field = values[idx]
            b_doc, b_field = values[jdx]
            raw_a, raw_b = a_field.normalized_value.strip(), b_field.normalized_value.strip()
            if raw_a == raw_b:
                continue
            key = tuple(sorted((raw_a.lower(), raw_b.lower())))
            if key in seen_pairs:
                continue
            seen_pairs.add(key)
            norm_a = normalize_institution_name(raw_a)
            norm_b = normalize_institution_name(raw_b)
            similarity = difflib.SequenceMatcher(None, norm_a, norm_b).ratio()
            if norm_a == norm_b or similarity >= threshold:
                return _result(
                    rule,
                    STATUS_WARNING,
                    finding_type="name_variation_signal",
                    explanation=rule.explanation_template.format(val_a=raw_a, val_b=raw_b),
                    evidence_refs=[_doc_evidence(a_doc, a_field), _doc_evidence(b_doc, b_field)],
                    confidence=round(min(a_field.confidence, b_field.confidence), 2),
                    metadata={"similarity": round(similarity, 3), "normalized_equal": norm_a == norm_b},
                )

    return _result(
        rule,
        STATUS_PASS,
        finding_type="name_variation_signal",
        explanation="Institution names are consistent across the compared documents.",
    )


def _date_ordered(rule: RuleDefinition, ctx: ValidationContext) -> RuleEvaluationResult:
    start_field = rule.validation_logic.get("start_field", "issue_date")
    end_field = rule.validation_logic.get("end_field", "valid_until_date")
    docs = ctx.docs_for_rule(rule)
    if not docs:
        return _result(rule, STATUS_NOT_APPLICABLE, finding_type="date_ordering", explanation="No required document was submitted.")

    invalid_pairs: List[Tuple[Document, ExtractedField, ExtractedField]] = []
    missing: List[Tuple[Document, str]] = []
    for doc in docs:
        start = ctx.field(doc, start_field)
        end = ctx.field(doc, end_field)
        if not start:
            missing.append((doc, start_field))
            continue
        if not end:
            missing.append((doc, end_field))
            continue
        start_date = _parse_date(start.normalized_value)
        end_date = _parse_date(end.normalized_value)
        if start_date is None or end_date is None:
            missing.append((doc, start_field if start_date is None else end_field))
            continue
        if start_date > end_date:
            invalid_pairs.append((doc, start, end))

    if invalid_pairs:
        doc, start, end = invalid_pairs[0]
        return _result(
            rule,
            STATUS_FAIL,
            finding_type="temporal_paradox",
            explanation=rule.explanation_template.format(
                issue_date=start.normalized_value,
                valid_until_date=end.normalized_value,
            ),
            evidence_refs=[_doc_evidence(doc, start), _doc_evidence(doc, end)],
            confidence=min(start.confidence, end.confidence),
        )
    if missing:
        doc, field_name = missing[0]
        return _missing_field_result(rule, doc, field_name)
    return _result(
        rule,
        STATUS_PASS,
        finding_type="date_ordering",
        explanation="All document issue dates precede their validity dates.",
    )


def _unique_hashes(rule: RuleDefinition, ctx: ValidationContext) -> RuleEvaluationResult:
    seen: Dict[str, Document] = {}
    duplicates: List[Tuple[Document, Document]] = []
    for doc in ctx.documents:
        digest = doc.hash_sha256
        if digest in seen:
            duplicates.append((seen[digest], doc))
        else:
            seen[digest] = doc
    if duplicates:
        first, second = duplicates[0]
        return _result(
            rule,
            STATUS_WARNING,
            finding_type="duplicate_file_hash",
            explanation=rule.explanation_template.format(doc_a=second.original_filename, doc_b=first.original_filename),
            evidence_refs=[_doc_evidence(first), _doc_evidence(second)],
            confidence=1.0,
            metadata={"duplicate_pairs": len(duplicates)},
        )
    return _result(
        rule,
        STATUS_PASS,
        finding_type="duplicate_file_hash",
        explanation="All submitted documents have distinct SHA-256 hashes.",
    )


def _minimum_count(rule: RuleDefinition, ctx: ValidationContext) -> RuleEvaluationResult:
    field_name = rule.validation_logic.get("field", "")
    minimum = int(rule.validation_logic.get("min_value", 0))
    docs = ctx.docs_for_rule(rule)
    if not docs:
        return _result(rule, STATUS_NOT_APPLICABLE, finding_type="minimum_count", explanation="No required document was submitted.")

    for doc in docs:
        field_obj = ctx.field(doc, field_name)
        if not field_obj:
            return _missing_field_result(rule, doc, field_name)
        try:
            value = int(float(field_obj.normalized_value))
        except Exception:
            return _result(
                rule,
                STATUS_MANUAL_REVIEW,
                finding_type="unparseable_field",
                explanation=f"Field '{field_name}' is not numeric.",
                evidence_refs=[_doc_evidence(doc, field_obj)],
                confidence=0.4,
            )
        if value < minimum:
            return _result(
                rule,
                STATUS_WARNING,
                finding_type="minimum_count_not_met",
                explanation=rule.explanation_template.format(field_val=value, minimum=minimum),
                evidence_refs=[_doc_evidence(doc, field_obj)],
                confidence=field_obj.confidence,
                metadata={"value": value, "minimum": minimum},
            )
    return _result(
        rule,
        STATUS_PASS,
        finding_type="minimum_count",
        explanation=f"Minimum count requirement ({minimum}) is met.",
    )


def _institution_record_equals(rule: RuleDefinition, ctx: ValidationContext) -> RuleEvaluationResult:
    record = ctx.institution_record
    if not record:
        return _result(
            rule,
            STATUS_MANUAL_REVIEW,
            finding_type="institution_record_unavailable",
            explanation="No authorized institutional-record snapshot is available for this institution and academic year.",
            confidence=0.2,
        )

    field_name = rule.validation_logic.get("field", "")
    record_field = rule.validation_logic.get("record_field", "")
    docs = ctx.docs_for_rule(rule)
    if not docs:
        return _result(rule, STATUS_NOT_APPLICABLE, finding_type="institution_record_mismatch", explanation="No required document was submitted.")

    doc = docs[0]
    field_obj = ctx.field(doc, field_name)
    if not field_obj:
        return _missing_field_result(rule, doc, field_name)

    if record_field == "permanent_id":
        record_value = ctx.app.institution.permanent_id if ctx.app.institution else None
    elif record_field == "name":
        record_value = ctx.app.institution.name if ctx.app.institution else None
    else:
        record_value = getattr(record, record_field, None)

    if record_value is None:
        return _result(
            rule,
            STATUS_MANUAL_REVIEW,
            finding_type="institution_record_unavailable",
            explanation=f"Institutional record does not contain '{record_field}'.",
            confidence=0.2,
        )

    if not _same_value(field_obj.normalized_value, record_value):
        return _result(
            rule,
            rule.severity if rule.severity in {STATUS_FAIL, STATUS_WARNING} else STATUS_WARNING,
            finding_type="institution_record_mismatch",
            explanation=rule.explanation_template.format(
                field_val=field_obj.normalized_value,
                record_val=record_value,
            ),
            evidence_refs=[
                _doc_evidence(doc, field_obj),
                {
                    "source": record.source,
                    "source_type": "authorized_institutional_record",
                    "record_id": record.id,
                    "record_field": record_field,
                    "record_value": str(record_value),
                    "last_synced_at": record.last_synced_at.isoformat() + "Z" if record.last_synced_at else None,
                    "is_simulated": record.is_simulated,
                },
            ],
            confidence=field_obj.confidence,
            metadata={"record_id": record.id},
        )

    return _result(
        rule,
        STATUS_PASS,
        finding_type="institution_record_consistency",
        explanation=f"Field '{field_name}' matches the authorized institutional record.",
        metadata={"record_id": record.id},
    )


def _institution_status_compliant(rule: RuleDefinition, ctx: ValidationContext) -> RuleEvaluationResult:
    record = ctx.institution_record
    if not record:
        return _result(
            rule,
            STATUS_MANUAL_REVIEW,
            finding_type="institution_record_unavailable",
            explanation="No authorized institutional-record snapshot is available for compliance/TER checks.",
            confidence=0.2,
        )

    compliance = (record.compliance_status or "").strip().upper()
    ter = (record.ter_payment_status or "").strip().upper()
    if compliance in {"COMPLIANT", "ACTIVE", "CLEAR"} and ter in {"PAID", "CLEAR", "NOT_APPLICABLE"}:
        return _result(
            rule,
            STATUS_PASS,
            finding_type="institution_status",
            explanation="Institutional compliance and TER status are clear.",
            metadata={"record_id": record.id},
        )

    return _result(
        rule,
        STATUS_WARNING,
        finding_type="institution_status_deficiency",
        explanation=rule.explanation_template.format(
            compliance_status=record.compliance_status,
            ter_status=record.ter_payment_status,
        ),
        evidence_refs=[
            {
                "source": record.source,
                "source_type": "authorized_institutional_record",
                "record_id": record.id,
                "compliance_status": record.compliance_status,
                "ter_payment_status": record.ter_payment_status,
                "deficiency_notes": record.deficiency_notes,
                "last_synced_at": record.last_synced_at.isoformat() + "Z" if record.last_synced_at else None,
                "is_simulated": record.is_simulated,
            }
        ],
        confidence=0.95,
        metadata={"record_id": record.id},
    )


def _institution_record_fuzzy_match(rule: RuleDefinition, ctx: ValidationContext) -> RuleEvaluationResult:
    record = ctx.institution_record
    if not record or not ctx.app.institution:
        return _result(
            rule,
            STATUS_MANUAL_REVIEW,
            finding_type="institution_record_unavailable",
            explanation="No authorized institutional-record snapshot is available for name comparison.",
            confidence=0.2,
        )

    docs = ctx.docs_for_rule(rule)
    if not docs:
        return _result(rule, STATUS_NOT_APPLICABLE, finding_type="institution_record_mismatch", explanation="No required document was submitted.")
    doc = docs[0]
    field_name = rule.validation_logic.get("field", "institution_name")
    field_obj = ctx.field(doc, field_name)
    if not field_obj:
        return _missing_field_result(rule, doc, field_name)

    record_name = ctx.app.institution.name
    similarity = difflib.SequenceMatcher(
        None,
        normalize_institution_name(field_obj.normalized_value),
        normalize_institution_name(record_name),
    ).ratio()
    threshold = float(rule.validation_logic.get("threshold", 0.88))
    if similarity < threshold:
        return _result(
            rule,
            STATUS_WARNING,
            finding_type="institution_record_mismatch",
            explanation=rule.explanation_template.format(
                field_val=field_obj.normalized_value,
                record_val=record_name,
                similarity=similarity,
            ),
            evidence_refs=[
                _doc_evidence(doc, field_obj),
                {
                    "source": record.source,
                    "source_type": "authorized_institutional_record",
                    "record_id": record.id,
                    "record_field": "name",
                    "record_value": record_name,
                    "last_synced_at": record.last_synced_at.isoformat() + "Z" if record.last_synced_at else None,
                    "is_simulated": record.is_simulated,
                },
            ],
            confidence=round(field_obj.confidence, 2),
            metadata={"similarity": round(similarity, 3)},
        )
    return _result(
        rule,
        STATUS_PASS,
        finding_type="institution_record_consistency",
        explanation="Institution name matches the authorized institutional record.",
    )


def _near_duplicate_documents(rule: RuleDefinition, ctx: ValidationContext) -> RuleEvaluationResult:
    from apps.api.services.forensics import (
        get_or_compute_perceptual_hash,
        get_or_compute_text_fingerprint,
    )

    max_distance = int(rule.validation_logic.get("max_hamming_distance", 12))
    fingerprints: List[Tuple[Document, str, str]] = []
    for doc in ctx.documents:
        digest = get_or_compute_perceptual_hash(ctx.db, doc)
        if digest:
            fingerprints.append((doc, digest, get_or_compute_text_fingerprint(ctx.db, doc)))

    for idx in range(len(fingerprints)):
        for jdx in range(idx + 1, len(fingerprints)):
            a_doc, a_hash, a_text = fingerprints[idx]
            b_doc, b_hash, b_text = fingerprints[jdx]
            if a_doc.hash_sha256 == b_doc.hash_sha256:
                continue
            try:
                distance = _hamming(a_hash, b_hash)
            except Exception:
                continue
            if distance > max_distance:
                continue
            # pHash alone is too permissive for documents that share a common
            # watermark/template (e.g. different certificates). Require the
            # visible text to also be substantially similar.
            text_similarity = 0.0
            if a_text and b_text:
                text_similarity = difflib.SequenceMatcher(None, a_text, b_text).ratio()
            if text_similarity < 0.60:
                continue
            return _result(
                rule,
                STATUS_WARNING,
                finding_type="near_duplicate_signal",
                explanation=rule.explanation_template.format(
                    doc_a=a_doc.original_filename,
                    doc_b=b_doc.original_filename,
                    distance=distance,
                ),
                evidence_refs=[_doc_evidence(a_doc), _doc_evidence(b_doc)],
                confidence=round(max(0.5, 1.0 - distance / 64.0), 2),
                metadata={
                    "hamming_distance": distance,
                    "text_similarity": round(text_similarity, 3),
                    "classification": "signal_only_not_proof",
                },
            )
    return _result(
        rule,
        STATUS_PASS,
        finding_type="near_duplicate_signal",
        explanation="No near-duplicate page fingerprints were detected.",
    )


def _hamming(a: str, b: str) -> int:
    return bin(int(a, 16) ^ int(b, 16)).count("1")


def _incremental_pdf(rule: RuleDefinition, ctx: ValidationContext) -> RuleEvaluationResult:
    for doc in ctx.documents:
        if doc.storage_path and os.path.exists(doc.storage_path):
            try:
                with open(doc.storage_path, "rb") as handle:
                    data = handle.read()
                if data.count(b"%%EOF") > 1:
                    return _result(
                        rule,
                        STATUS_WARNING,
                        finding_type="structural_change_signal",
                        explanation=rule.explanation_template,
                        evidence_refs=[
                            {
                                **_doc_evidence(doc),
                                "page": 1,
                                "note": "Multiple %%EOF markers / incremental xref updates detected",
                                "classification": "signal_only_not_proof",
                            }
                        ],
                        confidence=0.92,
                        metadata={"eof_count": data.count(b"%%EOF")},
                    )
            except Exception:
                continue
    return _result(
        rule,
        STATUS_PASS,
        finding_type="structural_change_signal",
        explanation="No incremental PDF revision signal was detected.",
    )


def _low_confidence_fields(rule: RuleDefinition, ctx: ValidationContext) -> RuleEvaluationResult:
    threshold = float(rule.validation_logic.get("threshold", 0.85))
    for doc in ctx.documents:
        for field_obj in ctx.fields_by_doc.get(doc.id, {}).values():
            if field_obj.method == "ocr" and field_obj.confidence < threshold:
                return _result(
                    rule,
                    STATUS_MANUAL_REVIEW,
                    finding_type="low_confidence_extraction",
                    explanation=rule.explanation_template.format(
                        confidence=field_obj.confidence,
                        field_name=field_obj.field_name,
                        document_name=doc.original_filename,
                    ),
                    evidence_refs=[_doc_evidence(doc, field_obj)],
                    confidence=field_obj.confidence,
                    metadata={"threshold": threshold},
                )
    return _result(
        rule,
        STATUS_PASS,
        finding_type="low_confidence_extraction",
        explanation="No low-confidence OCR fields were detected.",
    )


def _qr_allowlist(rule: RuleDefinition, ctx: ValidationContext) -> RuleEvaluationResult:
    from apps.api.services.forensics import get_or_compute_qr_codes

    allowed = [str(d).lower() for d in rule.validation_logic.get("allowed_domains", [])]
    for doc in ctx.documents:
        for qr in get_or_compute_qr_codes(ctx.db, doc):
            payload = str(qr.get("data", "")).strip()
            parsed = urlparse(payload)
            domain = (parsed.hostname or "").lower()
            if not domain:
                return _result(
                    rule,
                    STATUS_MANUAL_REVIEW,
                    finding_type="qr_unresolved",
                    explanation=f"QR payload on '{doc.original_filename}' is not a resolvable URL.",
                    evidence_refs=[{**_doc_evidence(doc), "qr_payload": payload}],
                    confidence=0.6,
                )
            if not any(domain == allowed_domain or domain.endswith("." + allowed_domain) for allowed_domain in allowed):
                return _result(
                    rule,
                    STATUS_WARNING,
                    finding_type="qr_domain_not_allowlisted",
                    explanation=rule.explanation_template.format(domain=domain),
                    evidence_refs=[{**_doc_evidence(doc), "qr_payload": payload, "domain": domain}],
                    confidence=0.8,
                    metadata={"classification": "signal_only_not_proof"},
                )
    return _result(
        rule,
        STATUS_NOT_APPLICABLE,
        finding_type="qr_verification",
        explanation="No QR code was detected in the submitted documents.",
    )


def _digital_signature_status(rule: RuleDefinition, ctx: ValidationContext) -> RuleEvaluationResult:
    from apps.api.services.forensics import get_or_compute_signature_status

    for doc in ctx.documents:
        status, details = get_or_compute_signature_status(ctx.db, doc)
        if status in {"invalid", "revoked", "expired"}:
            return _result(
                rule,
                STATUS_WARNING,
                finding_type="signature_invalid",
                explanation=rule.explanation_template.format(signature_status=status),
                evidence_refs=[{**_doc_evidence(doc), "signature_details": details}],
                confidence=0.85,
                metadata={"classification": "signal_only_not_proof"},
            )
    return _result(
        rule,
        STATUS_NOT_APPLICABLE,
        finding_type="signature_verification",
        explanation="No digitally signed PDF was detected, or signature validation is unavailable.",
    )


def evaluate_rule(rule: RuleDefinition, ctx: ValidationContext) -> RuleEvaluationResult:
    operator = (rule.validation_logic or {}).get("operator", "")
    dispatch = {
        "all_present": _all_present,
        "date_on_or_after": _date_on_or_after,
        "equals": _equals,
        "cross_doc_equals": _cross_doc_equals,
        "cross_doc_fuzzy_match": _cross_doc_fuzzy_match,
        "date_ordered": _date_ordered,
        "unique_hashes": _unique_hashes,
        "minimum_count": _minimum_count,
        "institution_record_equals": _institution_record_equals,
        "institution_status_compliant": _institution_status_compliant,
        "institution_record_fuzzy_match": _institution_record_fuzzy_match,
        "near_duplicate_documents": _near_duplicate_documents,
        "incremental_pdf": _incremental_pdf,
        "low_confidence_fields": _low_confidence_fields,
        "qr_allowlist": _qr_allowlist,
        "digital_signature_status": _digital_signature_status,
    }
    handler = dispatch.get(operator)
    if handler is None:
        return _result(
            rule,
            STATUS_MANUAL_REVIEW,
            finding_type="unsupported_rule_operator",
            explanation=f"Rule operator '{operator}' is not supported by this interpreter.",
            confidence=0.0,
        )
    return handler(rule, ctx)
