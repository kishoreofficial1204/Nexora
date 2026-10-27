"""Persisted issuer-verification service.

The prototype uses the simulated issuer connector, but the surrounding workflow
is real: the query is scoped to an application/document, the response is
persisted with provenance, non-verified outcomes create findings/alerts, and the
action is written to the audit chain.
"""

from __future__ import annotations

import json
from datetime import datetime
from typing import Any, Dict, List, Optional, Tuple

from sqlalchemy.orm import Session

from apps.api.core.audit_logger import log_audit_event
from apps.api.models.alert import Alert, AlertStatus, AlertType
from apps.api.models.application import Application
from apps.api.models.audit import AuditAction
from apps.api.models.document import Document
from apps.api.models.extracted_field import ExtractedField
from apps.api.models.finding import Finding, FindingSeverity, FindingStatus
from apps.api.models.user import User
from apps.api.models.verification import VerificationRecord, VerificationStatus, VerificationType
from apps.api.services.mock_issuer import MockIssuerConnector, SIMULATED_BANNER


AUTHORITY_DOCUMENT_TYPES = {
    "aicte_portal": ["doc_eoa_app", "doc_prev_eoa"],
    "state_university": ["doc_univ_affil"],
    "fire_department": ["doc_fire_safety"],
    "municipal_corporation": ["doc_building_stability"],
}


def _fields_by_name(db: Session, document_id: str) -> Dict[str, ExtractedField]:
    fields = db.query(ExtractedField).filter(ExtractedField.document_id == document_id).all()
    return {field.field_name: field for field in fields}


def _pick_document(
    app: Application,
    authority_id: str,
    document_id: Optional[str],
    db: Session,
) -> Optional[Document]:
    if document_id:
        doc = (
            db.query(Document)
            .filter(Document.id == document_id, Document.application_id == app.id)
            .first()
        )
        return doc
    for document_type in AUTHORITY_DOCUMENT_TYPES.get(authority_id, []):
        doc = next((item for item in app.documents if item.document_type == document_type), None)
        if doc:
            return doc
    return app.documents[0] if app.documents else None


def _build_query_payload(
    app: Application,
    authority_id: str,
    doc: Optional[Document],
    db: Session,
) -> Dict[str, Any]:
    fields = _fields_by_name(db, doc.id) if doc else {}
    institution = app.institution
    payload: Dict[str, Any] = {
        "application_id": app.id,
        "academic_year": app.academic_year,
        "institution_name": (
            fields.get("institution_name").normalized_value
            if fields.get("institution_name")
            else (institution.name if institution else None)
        ),
        "institute_pid": (
            fields.get("institute_pid").normalized_value
            if fields.get("institute_pid")
            else (institution.permanent_id if institution else None)
        ),
    }

    if authority_id == "aicte_portal":
        payload["intake_capacity"] = (
            fields.get("intake_capacity").normalized_value if fields.get("intake_capacity") else None
        )
    elif authority_id == "state_university":
        payload["order_number"] = (
            fields.get("order_number").normalized_value if fields.get("order_number") else None
        )
    elif authority_id == "fire_department":
        payload["certificate_number"] = (
            fields.get("certificate_no").normalized_value if fields.get("certificate_no") else None
        )
        payload["valid_until_date"] = (
            fields.get("valid_until_date").normalized_value
            if fields.get("valid_until_date")
            else None
        )
    elif authority_id == "municipal_corporation":
        payload["certificate_number"] = (
            fields.get("certificate_no").normalized_value if fields.get("certificate_no") else None
        )
        payload["valid_until_date"] = (
            fields.get("valid_until_date").normalized_value
            if fields.get("valid_until_date")
            else None
        )
        payload["engineer_reg_no"] = (
            fields.get("engineer_reg_no").normalized_value
            if fields.get("engineer_reg_no")
            else None
        )
    return {key: value for key, value in payload.items() if value not in (None, "")}


def _map_status(raw_status: str) -> str:
    return {
        "verified": VerificationStatus.VERIFIED,
        "mismatch": VerificationStatus.MISMATCH_DETECTED,
        "expired": VerificationStatus.EXPIRED,
        "not_found": VerificationStatus.NOT_VERIFIED,
        "timeout": VerificationStatus.SOURCE_UNAVAILABLE,
        "service_down": VerificationStatus.SOURCE_UNAVAILABLE,
    }.get(raw_status, VerificationStatus.MANUAL_REVIEW_REQUIRED)


def _compare_response(
    authority_id: str,
    query_payload: Dict[str, Any],
    response_payload: Optional[Dict[str, Any]],
) -> Tuple[List[Dict[str, Any]], List[Dict[str, Any]]]:
    matched: List[Dict[str, Any]] = []
    mismatched: List[Dict[str, Any]] = []
    if not response_payload:
        return matched, mismatched

    checks = []
    if authority_id == "aicte_portal":
        checks = [
            ("institute_pid", "matched_institution_pid"),
            ("institution_name", "matched_institution_name"),
            ("intake_capacity", "approved_intake"),
        ]
    elif authority_id == "state_university":
        checks = [("order_number", "affiliation_order_no"), ("academic_year", "academic_year")]
    elif authority_id == "fire_department":
        checks = [
            ("certificate_number", "noc_number"),
            ("valid_until_date", "valid_until"),
        ]
    elif authority_id == "municipal_corporation":
        checks = [("certificate_number", "certificate_number"), ("valid_until_date", "valid_until")]

    for query_key, response_key in checks:
        submitted = query_payload.get(query_key)
        registry = response_payload.get(response_key)
        if submitted in (None, "") or registry in (None, ""):
            continue
        entry = {
            "field": query_key,
            "submitted": str(submitted),
            "registry": str(registry),
        }
        if str(submitted).strip().lower() == str(registry).strip().lower():
            matched.append(entry)
        else:
            mismatched.append(entry)

    if response_payload.get("discrepancy") and not mismatched:
        mismatched.append(
            {
                "field": "registry_discrepancy",
                "submitted": json.dumps(query_payload, sort_keys=True),
                "registry": str(response_payload.get("discrepancy")),
            }
        )
    return matched, mismatched


def _create_verification_outcome(
    db: Session,
    app: Application,
    record: VerificationRecord,
    status: str,
    raw_status: str,
    response_payload: Optional[Dict[str, Any]],
) -> None:
    if status == VerificationStatus.VERIFIED:
        return

    severity = (
        FindingSeverity.FAIL
        if status in {VerificationStatus.MISMATCH_DETECTED, VerificationStatus.EXPIRED}
        else FindingSeverity.MANUAL_REVIEW
    )
    title = f"External verification: {record.authority_name}"
    explanation = (
        f"Simulated registry lookup for {record.authority_name} returned '{raw_status}'. "
        f"Human review is required before relying on this document."
    )
    if response_payload and response_payload.get("discrepancy"):
        explanation += f" Registry note: {response_payload['discrepancy']}"

    finding = Finding(
        application_id=app.id,
        rule_id=f"VERIFY-{record.authority_id.upper()}",
        rule_version="verification-1.0",
        finding_type="verification_mismatch" if severity == FindingSeverity.FAIL else "verification_pending",
        severity=severity,
        status=FindingStatus.OPEN,
        title=title,
        explanation=explanation,
        recommended_action="Compare the submitted document with the issuer master record and record a review rationale.",
        confidence=0.9,
        is_heuristic=False,
    )
    finding.evidence_refs = [
        {
            "verification_id": record.id,
            "authority_id": record.authority_id,
            "authority_name": record.authority_name,
            "verification_status": status,
            "badge": record.badge,
            "is_simulated": record.is_simulated,
        }
    ]
    db.add(finding)
    db.flush()

    db.add(
        Alert(
            application_id=app.id,
            finding_id=finding.id,
            verification_id=record.id,
            alert_type=AlertType.VERIFICATION,
            severity=severity,
            title=title,
            message=explanation,
            status=AlertStatus.OPEN,
        )
    )


def verify_application_document(
    db: Session,
    app: Application,
    actor: User,
    authority_id: str,
    document_id: Optional[str] = None,
    mode: str = "match",
    simulated_delay_ms: int = 120,
) -> VerificationRecord:
    if authority_id not in MockIssuerConnector.SUPPORTED_AUTHORITIES:
        raise ValueError(f"Unsupported authority '{authority_id}'.")

    doc = _pick_document(app, authority_id, document_id, db)
    if not doc:
        raise ValueError("No document is available for verification on this application.")

    query_payload = _build_query_payload(app, authority_id, doc, db)
    result = MockIssuerConnector.query_registry(
        authority_id=authority_id,
        query_payload=query_payload,
        mode=mode,
        simulated_delay_ms=simulated_delay_ms,
    )
    status = _map_status(result.get("status", ""))
    response_payload = result.get("response_payload")
    matched, mismatched = _compare_response(authority_id, query_payload, response_payload)

    record = VerificationRecord(
        application_id=app.id,
        document_id=doc.id,
        authority_id=authority_id,
        authority_name=result.get("authority_name", authority_id),
        verification_type=VerificationType.API,
        status=status,
        query_payload_json=json.dumps(query_payload, sort_keys=True),
        response_payload_json=json.dumps(response_payload or {}, sort_keys=True),
        matched_fields_json=json.dumps(matched, sort_keys=True),
        mismatch_fields_json=json.dumps(mismatched, sort_keys=True),
        source_timestamp=result.get("timestamp"),
        checked_by_id=actor.id,
        badge=result.get("badge", SIMULATED_BANNER),
        is_simulated=True,
        error_message=result.get("error_message"),
        notes="Persisted verification record. External authority response is simulated for the prototype.",
    )
    db.add(record)
    db.flush()

    _create_verification_outcome(db, app, record, status, result.get("status", ""), response_payload)

    log_audit_event(
        db=db,
        actor_id=actor.id,
        action=AuditAction.VERIFICATION_RECORDED,
        entity_type="application",
        entity_id=app.id,
        metadata={
            "verification_id": record.id,
            "authority_id": authority_id,
            "document_id": doc.id,
            "status": status,
            "raw_status": result.get("status"),
            "mode": mode,
            "is_simulated": True,
            "matched_fields": len(matched),
            "mismatch_fields": len(mismatched),
        },
    )
    db.commit()
    db.refresh(record)
    return record


def serialize_verification(record: VerificationRecord) -> Dict[str, Any]:
    def loads(value: str, default: Any) -> Any:
        try:
            return json.loads(value or "")
        except Exception:
            return default

    return {
        "id": record.id,
        "application_id": record.application_id,
        "document_id": record.document_id,
        "authority_id": record.authority_id,
        "authority_name": record.authority_name,
        "verification_type": record.verification_type,
        "status": record.status,
        "query_payload": loads(record.query_payload_json, {}),
        "response_payload": loads(record.response_payload_json, {}),
        "matched_fields": loads(record.matched_fields_json, []),
        "mismatch_fields": loads(record.mismatch_fields_json, []),
        "source_timestamp": record.source_timestamp,
        "checked_at": record.checked_at.isoformat() + "Z" if record.checked_at else None,
        "checked_by_id": record.checked_by_id,
        "badge": record.badge,
        "is_simulated": record.is_simulated,
        "error_message": record.error_message,
        "notes": record.notes,
    }
