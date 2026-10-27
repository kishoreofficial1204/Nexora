"""Validation orchestration for Nexora.

The validator is deliberately thin: it builds a case context, executes every
rule in the selected YAML rule pack through the generic interpreter, persists
explainability records, and turns non-pass outcomes into findings and alerts.
It never approves or rejects an application automatically.
"""

from __future__ import annotations

import json
from datetime import datetime
from typing import Any, Dict, List, Optional

from sqlalchemy.orm import Session

from apps.api.models.alert import Alert, AlertStatus, AlertType
from apps.api.models.application import Application, ApplicationStatus
from apps.api.models.document import Document
from apps.api.models.extracted_field import ExtractedField
from apps.api.models.finding import Finding, FindingSeverity, FindingStatus
from apps.api.models.institution_record import InstitutionRecord
from apps.api.models.validation_run import RuleExecution, ValidationRun, ValidationRunStatus
from apps.api.pipeline.rule_engine import (
    STATUS_FAIL,
    STATUS_MANUAL_REVIEW,
    STATUS_WARNING,
    ValidationContext,
    evaluate_rule,
    normalize_institution_name,
)
from apps.api.rules.loader import get_rule_pack_for_application

# Backwards-compatible re-export used by older routers/tests.
__all__ = ["validate_application", "normalize_institution_name"]


def _alert_type_for_finding(finding_type: str, is_heuristic: bool) -> str:
    if finding_type == "missing_document":
        return AlertType.MISSING_DOCUMENT
    if finding_type in {"certificate_expired", "expired_document"}:
        return AlertType.EXPIRED_DOCUMENT
    if finding_type in {
        "low_confidence_extraction",
        "missing_field",
        "unparseable_field",
        "institution_record_unavailable",
        "qr_unresolved",
    }:
        return AlertType.MANUAL_REVIEW
    if is_heuristic or "signal" in finding_type:
        return AlertType.ANOMALY_SIGNAL
    return AlertType.INCONSISTENCY


def _alert_severity(severity: str) -> str:
    return severity if severity in {
        FindingSeverity.FAIL,
        FindingSeverity.WARNING,
        FindingSeverity.MANUAL_REVIEW,
        FindingSeverity.INFO,
    } else FindingSeverity.WARNING


def _build_context(
    app: Application,
    db: Session,
    rule_pack,
    documents: List[Document],
    fields_by_doc: Dict[str, Dict[str, ExtractedField]],
    record: Optional[InstitutionRecord],
) -> ValidationContext:
    doc_by_type: Dict[str, List[Document]] = {}
    for doc in documents:
        doc_by_type.setdefault(doc.document_type, []).append(doc)

    assessment_date = datetime.strptime(app.assessment_date or "2026-10-26", "%Y-%m-%d").date()
    return ValidationContext(
        app=app,
        db=db,
        rule_pack=rule_pack,
        documents=documents,
        fields_by_doc=fields_by_doc,
        doc_by_type=doc_by_type,
        doc_by_id={doc.id: doc for doc in documents},
        checklist_by_id={item.id: item for item in rule_pack.checklist_items},
        assessment_date=assessment_date,
        institution_record=record,
    )


def validate_application(app: Application, db: Session) -> List[Finding]:
    """Execute the selected rule pack and persist findings, alerts and a run log."""
    rule_pack = get_rule_pack_for_application(
        category=app.category,
        rule_pack_id=app.rule_pack_id,
        academic_year=app.academic_year,
    )
    documents = list(app.documents)

    doc_ids = [doc.id for doc in documents]
    all_fields = (
        db.query(ExtractedField).filter(ExtractedField.document_id.in_(doc_ids)).all()
        if doc_ids
        else []
    )
    fields_by_doc: Dict[str, Dict[str, ExtractedField]] = {}
    for field in all_fields:
        fields_by_doc.setdefault(field.document_id, {})[field.field_name] = field

    record = (
        db.query(InstitutionRecord)
        .filter(
            InstitutionRecord.institution_id == app.institution_id,
            InstitutionRecord.academic_year == app.academic_year,
        )
        .first()
    )

    context = _build_context(app, db, rule_pack, documents, fields_by_doc, record)
    run = ValidationRun(
        application_id=app.id,
        rule_pack_id=rule_pack.rule_pack.id,
        rule_pack_version=rule_pack.rule_pack.version,
        status=ValidationRunStatus.RUNNING,
    )
    db.add(run)
    db.flush()

    results = []
    try:
        for rule in rule_pack.rules:
            results.append(evaluate_rule(rule, context))
    except Exception:
        run.status = ValidationRunStatus.FAILED
        run.completed_at = datetime.utcnow()
        db.commit()
        raise

    # Re-runs supersede open findings/alerts. Resolved or dismissed history is
    # retained; only the current actionable queue is replaced.
    db.query(Alert).filter(
        Alert.application_id == app.id,
        Alert.status == AlertStatus.OPEN,
    ).delete(synchronize_session=False)
    db.query(Finding).filter(
        Finding.application_id == app.id,
        Finding.status == FindingStatus.OPEN,
    ).delete(synchronize_session=False)

    findings: List[Finding] = []
    for result in results:
        execution = RuleExecution(
            validation_run_id=run.id,
            rule_id=result.rule_id,
            rule_version=result.rule_version,
            status=result.status,
            finding_type=result.finding_type,
            explanation=result.explanation,
            evidence_refs_json=json.dumps(result.evidence_refs),
            is_heuristic=result.is_heuristic,
        )
        db.add(execution)

        if not result.creates_finding:
            continue

        finding = Finding(
            application_id=app.id,
            rule_id=result.rule_id,
            rule_version=result.rule_version,
            finding_type=result.finding_type,
            severity=_alert_severity(result.severity),
            status=FindingStatus.OPEN,
            title=result.title,
            explanation=result.explanation,
            recommended_action=result.recommended_action,
            confidence=result.confidence,
            is_heuristic=result.is_heuristic,
        )
        finding.evidence_refs = result.evidence_refs
        db.add(finding)
        db.flush()
        findings.append(finding)

        db.add(
            Alert(
                application_id=app.id,
                finding_id=finding.id,
                alert_type=_alert_type_for_finding(result.finding_type, result.is_heuristic),
                severity=finding.severity,
                title=finding.title,
                message=finding.explanation,
                status=AlertStatus.OPEN,
            )
        )

    has_fail = any(result.status == STATUS_FAIL for result in results)
    has_manual = any(result.status == STATUS_MANUAL_REVIEW for result in results)
    has_warning = any(result.status == STATUS_WARNING for result in results)

    if has_fail:
        app.status = ApplicationStatus.DEFICIENCIES_FLAGGED
    elif has_manual:
        app.status = "manual_review_required"
    elif has_warning:
        app.status = ApplicationStatus.PRELIMINARY_REVIEW
    else:
        app.status = ApplicationStatus.PRELIMINARY_REVIEW

    status_counts: Dict[str, int] = {}
    for result in results:
        status_counts[result.status] = status_counts.get(result.status, 0) + 1

    run.status = ValidationRunStatus.COMPLETED
    run.completed_at = datetime.utcnow()
    run.findings_count = len(findings)
    run.summary_json = json.dumps(
        {
            "rule_pack_id": rule_pack.rule_pack.id,
            "rule_pack_version": rule_pack.rule_pack.version,
            "rules_executed": len(results),
            "status_counts": status_counts,
            "documents": len(documents),
            "institution_record_id": record.id if record else None,
            "institution_record_is_simulated": bool(record.is_simulated) if record else None,
            "human_review_required": bool(findings),
        },
        sort_keys=True,
    )

    db.commit()
    for finding in findings:
        db.refresh(finding)
    return findings
