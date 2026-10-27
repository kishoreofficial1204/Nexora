"""Reset and curate the VeriScope demo database.

This is intentionally a demo utility, not a production migration. It wipes all
case data, recreates the demo users/institution, then builds a small curated
queue that demonstrates the end-to-end scrutiny story without the clutter left
behind by repeated smoke tests.

Usage (stop the API first so SQLite does not hold a write lock):

    .\\.venv\\Scripts\\python.exe apps\\api\\db\\demo_reset.py
"""

from __future__ import annotations

import os
import shutil
import sys
from datetime import datetime

PROJECT_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", ".."))
if PROJECT_ROOT not in sys.path:
    sys.path.insert(0, PROJECT_ROOT)

from apps.api.db.database import Base, engine, SessionLocal
from apps.api.db.seed import seed_database
from apps.api.models import (
    Alert,
    AlertStatus,
    Application,
    ApplicationStatus,
    AuditAction,
    Document,
    DocumentAnalysis,
    ExtractedField,
    Finding,
    FindingStatus,
    Institution,
    Job,
    RectificationRequest,
    RuleExecution,
    User,
    UserRole,
    ValidationRun,
    VerificationRecord,
)
from apps.api.core.audit_logger import log_audit_event
from apps.api.routers.applications import seed_demo_application
from apps.api.routers.extraction import run_application_extraction
from apps.api.routers.validation import run_validation_endpoint
from apps.api.routers.review import (
    ApplicationRecommendationRequest,
    FindingReviewRequest,
    record_officer_recommendation,
    review_finding,
)
from apps.api.services.verification import verify_application_document


BUNDLES = [
    "bundle_a_clean",
    "bundle_b_missing_doc",
    "bundle_c_expired_cert",
    "bundle_d_intake_mismatch",
    "bundle_e_exact_duplicate",
    "bundle_i_name_variant",
    "bundle_g_modified_pdf",
]


def _clear_database() -> None:
    print("[RESET] Dropping and recreating all demo tables...")
    Base.metadata.drop_all(bind=engine)
    Base.metadata.create_all(bind=engine)

    storage_root = os.path.join(PROJECT_ROOT, "storage", "documents")
    if os.path.isdir(storage_root):
        for entry in os.listdir(storage_root):
            path = os.path.join(storage_root, entry)
            if os.path.isdir(path):
                shutil.rmtree(path, ignore_errors=True)
            elif entry != ".gitkeep":
                try:
                    os.remove(path)
                except OSError:
                    pass
    print("[RESET] Case storage cleared.")


def _process_bundle(
    db,
    reviewer: User,
    bundle_key: str,
    *,
    validate: bool = True,
    verification_modes: dict[str, str] | None = None,
) -> Application:
    app = seed_demo_application(bundle_key=bundle_key, current_user=reviewer, db=db)
    if not validate:
        print(f"  + {bundle_key}: ingested only ({len(app.documents)} documents)")
        return app

    run_application_extraction(id=app.id, current_user=reviewer, db=db)
    findings = run_validation_endpoint(id=app.id, current_user=reviewer, db=db)
    db.refresh(app)

    if verification_modes:
        for authority_id, mode in verification_modes.items():
            try:
                verify_application_document(
                    db=db,
                    app=app,
                    actor=reviewer,
                    authority_id=authority_id,
                    mode=mode,
                    simulated_delay_ms=20,
                )
            except ValueError as exc:
                print(f"    ! verification skipped for {authority_id}: {exc}")

    db.refresh(app)
    print(
        f"  + {bundle_key}: {len(app.documents)} docs, {len(findings)} findings, "
        f"{app.status}"
    )
    return app


def _resolve_alert(db, alert: Alert, reviewer: User, note: str) -> None:
    alert.status = AlertStatus.RESOLVED
    alert.resolved_by = reviewer.email
    alert.resolved_at = datetime.utcnow()
    alert.resolution_note = note
    log_audit_event(
        db=db,
        actor_id=reviewer.id,
        action=AuditAction.ALERT_RESOLVED,
        entity_type="alert",
        entity_id=alert.id,
        metadata={
            "application_id": alert.application_id,
            "resolution_note": note,
            "status": alert.status,
            "seeded_demo": True,
        },
    )


def _acknowledge_alert(db, alert: Alert, reviewer: User, note: str) -> None:
    alert.status = AlertStatus.ACKNOWLEDGED
    alert.acknowledged_by = reviewer.email
    alert.acknowledged_at = datetime.utcnow()
    log_audit_event(
        db=db,
        actor_id=reviewer.id,
        action=AuditAction.ALERT_ACKNOWLEDGED,
        entity_type="alert",
        entity_id=alert.id,
        metadata={
            "application_id": alert.application_id,
            "note": note,
            "status": alert.status,
            "seeded_demo": True,
        },
    )


def seed_curated_demo() -> None:
    _clear_database()
    seed_database()

    db = SessionLocal()
    try:
        reviewer = db.query(User).filter(User.role == UserRole.REVIEWER).first()
        if not reviewer:
            raise RuntimeError("Demo reviewer account was not created.")
        applicant = db.query(User).filter(User.role == UserRole.APPLICANT).first()

        print("[SEED] Building curated synthetic queue...")
        apps: dict[str, Application] = {}

        apps["bundle_a_clean"] = _process_bundle(
            db,
            reviewer,
            "bundle_a_clean",
            verification_modes={
                "fire_department": "match",
                "state_university": "match",
                "aicte_portal": "match",
            },
        )
        record_officer_recommendation(
            id=apps["bundle_a_clean"].id,
            req=ApplicationRecommendationRequest(
                recommendation="RECOMMEND_APPROVAL",
                rationale=(
                    "All mandatory documents are present, validity checks pass against the assessment date, "
                    "intake is consistent across the bundle, and simulated registry lookups confirm the "
                    "submitted credentials. No open findings remain."
                ),
            ),
            current_user=reviewer,
            db=db,
        )

        apps["bundle_b_missing_doc"] = _process_bundle(
            db,
            reviewer,
            "bundle_b_missing_doc",
            verification_modes={"fire_department": "match", "aicte_portal": "match"},
        )

        apps["bundle_c_expired_cert"] = _process_bundle(
            db,
            reviewer,
            "bundle_c_expired_cert",
            verification_modes={"fire_department": "expired", "aicte_portal": "match"},
        )

        apps["bundle_d_intake_mismatch"] = _process_bundle(
            db,
            reviewer,
            "bundle_d_intake_mismatch",
            verification_modes={"aicte_portal": "mismatch", "fire_department": "match"},
        )
        # The registry mismatch is a fail-severity signal, so surface the case in
        # the deficiencies lane rather than leaving it in preliminary review.
        apps["bundle_d_intake_mismatch"].status = ApplicationStatus.DEFICIENCIES_FLAGGED

        apps["bundle_e_exact_duplicate"] = _process_bundle(
            db,
            reviewer,
            "bundle_e_exact_duplicate",
            verification_modes={"fire_department": "match"},
        )

        apps["bundle_i_name_variant"] = _process_bundle(
            db,
            reviewer,
            "bundle_i_name_variant",
            verification_modes={"state_university": "match", "fire_department": "match"},
        )

        # Leave one freshly-ingested case for the live "Run full scrutiny" demo.
        apps["bundle_g_modified_pdf"] = _process_bundle(
            db,
            reviewer,
            "bundle_g_modified_pdf",
            validate=False,
        )

        # Seed one live clarification request so the applicant portal has a
        # persisted action item and the re-upload path is demo-ready.
        expired_finding = (
            db.query(Finding)
            .filter(
                Finding.application_id == apps["bundle_c_expired_cert"].id,
                Finding.status == FindingStatus.OPEN,
            )
            .first()
        )
        if expired_finding:
            review_finding(
                id=expired_finding.id,
                req=FindingReviewRequest(
                    action="request_clarification",
                    rationale=(
                        "The submitted Fire Safety NOC expires before the assessment date. "
                        "Please upload a renewed certificate for re-validation."
                    ),
                    clarification_item="Renewed Fire Safety NOC",
                ),
                current_user=reviewer,
                db=db,
            )

        # Curated cases belong to the demo applicant so the applicant portal is
        # usable while the reviewer still sees the full queue.
        if applicant:
            for app in apps.values():
                app.applicant_id = applicant.id

        db.commit()

        # A little reviewer activity makes the alert centre feel lived-in.
        duplicate_alert = (
            db.query(Alert)
            .filter(
                Alert.application_id == apps["bundle_e_exact_duplicate"].id,
                Alert.status == AlertStatus.OPEN,
            )
            .order_by(Alert.created_at.asc())
            .first()
        )
        if duplicate_alert:
            _acknowledge_alert(
                db,
                duplicate_alert,
                reviewer,
                "Duplicate hash confirmed. Reviewer will request a replacement structural-safety certificate.",
            )

        name_alert = (
            db.query(Alert)
            .filter(
                Alert.application_id == apps["bundle_i_name_variant"].id,
                Alert.status == AlertStatus.OPEN,
            )
            .order_by(Alert.created_at.asc())
            .first()
        )
        if name_alert:
            _resolve_alert(
                db,
                name_alert,
                reviewer,
                "Abbreviation checked against the affiliation order and institutional profile; treated as a naming variant, not a substantive discrepancy.",
            )

        db.commit()
        print("[DONE] Curated demo queue ready.")
        for key, app in apps.items():
            db.refresh(app)
            print(f"  {key:<26} {app.status:<22} {app.id}")

    finally:
        db.close()


if __name__ == "__main__":
    seed_curated_demo()
