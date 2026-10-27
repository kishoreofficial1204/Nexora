"""
Integration Tests for VeriScope Milestone 1 (M1 - Intake & Security).
Tests:
1. Authentication & JWT issuance for all 5 roles.
2. Server-side RBAC enforcement (Applicant forbidden from Reviewer actions).
3. Application creation with explicit assessment date (2026-10-26).
4. Safe document ingestion (extension rejection, safe storage, SHA-256 integrity).
5. Synthetic demo bundle seeding.
6. Cryptographic tamper-evident audit trail hash-chaining.
"""

import os
import io
import pytest
from fastapi.testclient import TestClient
from apps.api.main import app
from apps.api.db.database import SessionLocal
from apps.api.models import User, UserRole, Institution, AuditEvent
from apps.api.core.audit_logger import verify_audit_chain

client = TestClient(app)


def get_auth_token(email: str, password: str = "DemoPass123!") -> str:
    res = client.post("/api/auth/login", json={"email": email, "password": password})
    assert res.status_code == 200, f"Login failed for {email}: {res.text}"
    return res.json()["access_token"]


def test_auth_all_roles_and_me():
    """Verify login and JWT token retrieval for all 5 RBAC roles."""
    roles = [
        ("reviewer@aicte-demo.in", UserRole.REVIEWER),
        ("senior_reviewer@aicte-demo.in", UserRole.SENIOR_REVIEWER),
        ("admin@aicte-demo.in", UserRole.ADMIN),
        ("auditor@aicte-demo.in", UserRole.AUDITOR),
        ("applicant@aicte-demo.in", UserRole.APPLICANT),
    ]

    for email, expected_role in roles:
        token = get_auth_token(email)
        headers = {"Authorization": f"Bearer {token}"}
        me_res = client.get("/api/auth/me", headers=headers)
        assert me_res.status_code == 200
        assert me_res.json()["role"] == expected_role
        assert me_res.json()["email"] == email


def test_rbac_applicant_forbidden_from_seeding():
    """Applicants must be forbidden from administrative/reviewer seed actions."""
    applicant_token = get_auth_token("applicant@aicte-demo.in")
    headers = {"Authorization": f"Bearer {applicant_token}"}

    res = client.post("/api/applications/seed-demo?bundle_key=bundle_a_clean", headers=headers)
    assert res.status_code == 403
    assert "Forbidden" in res.json()["detail"]


def test_create_application_with_assessment_date():
    """Verify application creation with configurable assessment date (default 2026-10-26)."""
    reviewer_token = get_auth_token("reviewer@aicte-demo.in")
    headers = {"Authorization": f"Bearer {reviewer_token}"}

    payload = {
        "category": "Extension of Approval (EoA)",
        "academic_year": "2026-27",
        "assessment_date": "2026-10-26",
        "rule_pack_id": "pack_eoa_ug_2026"
    }

    res = client.post("/api/applications", json=payload, headers=headers)
    assert res.status_code == 201
    data = res.json()
    assert data["assessment_date"] == "2026-10-26"
    assert data["status"] == "preliminary_review"
    assert data["institution"]["name"] == "ABC Institute of Technology"


def test_safe_document_upload_and_rejections():
    """Tests file upload safety: rejects dangerous extensions and accepts valid watermarked PDFs."""
    reviewer_token = get_auth_token("reviewer@aicte-demo.in")
    headers = {"Authorization": f"Bearer {reviewer_token}"}

    # 1. Create target application
    app_res = client.post("/api/applications", json={"assessment_date": "2026-10-26"}, headers=headers)
    app_id = app_res.json()["id"]

    # 2. Reject unsafe file extension (.exe)
    fake_exe = io.BytesIO(b"MZ executable dummy content")
    files = [("files", ("malicious.exe", fake_exe, "application/x-msdownload"))]
    reject_res = client.post(
        f"/api/applications/{app_id}/documents",
        files=files,
        data={"document_type": "doc_eoa_app"},
        headers=headers
    )
    assert reject_res.status_code == 400
    assert "Unsupported file extension" in reject_res.json()["detail"]

    # 3. Accept valid synthetic PDF
    pdf_path = os.path.join("data", "synthetic", "bundles", "bundle_a_clean", "doc_fire_safety.pdf")
    with open(pdf_path, "rb") as f:
        pdf_bytes = f.read()

    files = [("files", ("doc_fire_safety.pdf", io.BytesIO(pdf_bytes), "application/pdf"))]
    upload_res = client.post(
        f"/api/applications/{app_id}/documents",
        files=files,
        data={"document_type": "doc_fire_safety"},
        headers=headers
    )
    assert upload_res.status_code == 201
    docs = upload_res.json()
    assert len(docs) == 1
    assert docs[0]["document_type"] == "doc_fire_safety"
    assert docs[0]["page_count"] == 1
    assert len(docs[0]["hash_sha256"]) == 64


def test_seed_demo_bundle_and_audit_hash_chain():
    """Seeds a full synthetic bundle and verifies the cryptographic audit hash chain."""
    reviewer_token = get_auth_token("reviewer@aicte-demo.in")
    headers = {"Authorization": f"Bearer {reviewer_token}"}

    res = client.post("/api/applications/seed-demo?bundle_key=bundle_a_clean", headers=headers)
    assert res.status_code == 201
    app_data = res.json()
    assert len(app_data["documents"]) == 6

    # Verify audit events for this application
    audit_res = client.get(f"/api/applications/{app_data['id']}/audit", headers=headers)
    assert audit_res.status_code == 200
    events = audit_res.json()
    assert len(events) >= 6

    # Cryptographically verify the unbroken hash chain
    verify_res = client.get("/api/audit/verify", headers=headers)
    assert verify_res.status_code == 200
    verification = verify_res.json()
    assert verification["verified"] is True
    assert verification["status"] == "cryptographically_verified"
    assert verification["chain_length"] > 0


def test_audit_chain_detects_broken_prev_hash_linkage():
    """A tampered prev_hash must break verification even if current_hash is valid."""
    db = SessionLocal()
    event = db.query(AuditEvent).order_by(AuditEvent.timestamp.asc()).first()
    assert event is not None, "Expected seeded audit events before running this test."
    original_prev_hash = event.prev_hash
    try:
        event.prev_hash = "f" * 64
        db.commit()
        result = verify_audit_chain(db)
        assert result["verified"] is False
        assert result["status"] == "broken_link"
        assert result["tampered_at_event_id"] == event.id
    finally:
        event.prev_hash = original_prev_hash
        db.commit()
        db.close()
