"""
Audit Logger Service for VeriScope.
Appends tamper-evident audit events with SHA-256 hash chaining.
Provides cryptographic chain validation.
"""

from datetime import datetime
import json
from typing import Optional, Dict, Any, List
from sqlalchemy.orm import Session
from sqlalchemy import desc

from apps.api.models.audit import AuditEvent, GENESIS_HASH


def log_audit_event(
    db: Session,
    actor_id: str,
    action: str,
    entity_type: str,
    entity_id: str,
    metadata: Optional[Dict[str, Any]] = None
) -> AuditEvent:
    """Creates and appends a hash-chained audit event."""
    # Retrieve the most recent event to obtain prev_hash
    last_event = db.query(AuditEvent).order_by(desc(AuditEvent.timestamp), desc(AuditEvent.id)).first()
    prev_hash = last_event.current_hash if last_event else GENESIS_HASH

    event_id = None
    # Pre-generate UUID
    import uuid
    event_id = str(uuid.uuid4())
    timestamp = datetime.utcnow()
    timestamp_iso = timestamp.isoformat() + "Z"
    metadata_json = json.dumps(metadata or {}, sort_keys=True)

    current_hash = AuditEvent.compute_hash(
        prev_hash=prev_hash,
        event_id=event_id,
        actor_id=actor_id,
        action=action,
        entity_type=entity_type,
        entity_id=entity_id,
        timestamp_iso=timestamp_iso,
        metadata_json=metadata_json
    )

    event = AuditEvent(
        id=event_id,
        actor_id=actor_id,
        action=action,
        entity_type=entity_type,
        entity_id=entity_id,
        timestamp=timestamp,
        metadata_json=metadata_json,
        prev_hash=prev_hash,
        current_hash=current_hash
    )

    db.add(event)
    db.commit()
    db.refresh(event)
    return event


def verify_audit_chain(db: Session, entity_id: Optional[str] = None) -> Dict[str, Any]:
    """
    Verifies that the audit event hash chain is unbroken and unmodified.
    Returns audit status, total blocks verified, and any tamper points detected.
    """
    query = db.query(AuditEvent).order_by(AuditEvent.timestamp.asc(), AuditEvent.id.asc())
    if entity_id:
        query = query.filter(AuditEvent.entity_id == entity_id)

    events: List[AuditEvent] = query.all()

    if not events:
        return {
            "verified": True,
            "chain_length": 0,
            "status": "empty_chain",
            "tampered_at_event_id": None
        }

    expected_prev = GENESIS_HASH
    for idx, ev in enumerate(events):
        # In a global chain, ev.prev_hash must connect to the previous record.
        if ev.prev_hash != expected_prev:
            return {
                "verified": False,
                "chain_length": len(events),
                "status": "broken_link",
                "tampered_at_event_id": ev.id,
                "index": idx
            }

        # Verify current_hash matches the event payload.
        timestamp_iso = ev.timestamp.isoformat() + "Z"
        recomputed = AuditEvent.compute_hash(
            prev_hash=ev.prev_hash,
            event_id=ev.id,
            actor_id=ev.actor_id,
            action=ev.action,
            entity_type=ev.entity_type,
            entity_id=ev.entity_id,
            timestamp_iso=timestamp_iso,
            metadata_json=ev.metadata_json
        )

        if recomputed != ev.current_hash:
            return {
                "verified": False,
                "chain_length": len(events),
                "status": "hash_mismatch",
                "tampered_at_event_id": ev.id,
                "index": idx
            }

        expected_prev = ev.current_hash

    return {
        "verified": True,
        "chain_length": len(events),
        "status": "cryptographically_verified",
        "tampered_at_event_id": None
    }
