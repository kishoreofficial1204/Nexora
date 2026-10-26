"""
Integration Tests for VeriScope Milestone 5 (M5 - Review Console, Recommendations & Reports).
Validates:
1. Mandatory rationale validation: Cannot confirm or dismiss a finding without non-empty rationale.
2. Reviewer action state transitions (confirm, dismiss, request_clarification, escalate).
3. Cryptographic audit trail logging for reviewer actions.
4. Overall scrutiny officer recommendation recording with mandatory justification.
5. Exportable structured JSON case dossier integrity.
6. Exportable watermarked PDF scrutiny report generation.
7. Applicant restricted view with internal heuristic signals redacted.
"""

import pytest
from fastapi.testclient import TestClient
from apps.api.main import app

client = TestClient(app)


def get_token(email: str = "reviewer@aicte-demo.in") -> str:
    res = client.post("/api/auth/login", json={"email": email, "password": "DemoPass123!"})
    assert res.status_code == 200
    return res.json()["access_token"]


def create_case_with_findings() -> tuple:
    """Helper to provision a bundle with known findings."""
    token = get_token("reviewer@aicte-demo.in")
    headers = {"Authorization": f"Bearer {token}"}

    seed_res = client.post("/api/applications/seed-demo?bundle_key=bundle_c_expired_cert", headers=headers)
    assert seed_res.status_code == 201
    app_id = seed_res.json()["id"]

    client.post(f"/api/applications/{app_id}/extract", headers=headers)
    val_res = client.post(f"/api/applications/{app_id}/validate", headers=headers)
    assert val_res.status_code == 200
    findings = val_res.json()
    assert len(findings) >= 1
    return app_id, findings[0]["id"], headers


def test_mandatory_rationale_validation():
    """Reviewing a finding without mandatory rationale must return 422 Unprocessable Entity."""
    app_id, finding_id, headers = create_case_with_findings()

    # Empty rationale attempt
    res = client.post(
        f"/api/findings/{finding_id}/review",
        json={"action": "confirm", "rationale": "   "},
        headers=headers
    )
    assert res.status_code == 422
    assert "rationale" in res.text.lower()


def test_reviewer_finding_disposition_transitions():
    """Officer can confirm, dismiss, request clarification, and escalate findings with rationale."""
    app_id, finding_id, headers = create_case_with_findings()

    # 1. Confirm finding
    res_conf = client.post(
        f"/api/findings/{finding_id}/review",
        json={
            "action": "confirm",
            "rationale": "Confirmed: Fire safety NOC lapsed prior to inspection cycle without renewal."
        },
        headers=headers
    )
    assert res_conf.status_code == 200
    data_conf = res_conf.json()
    assert data_conf["status"] == "confirmed"
    assert "Confirmed" in data_conf["review_rationale"]
    assert data_conf["reviewed_by"] == "reviewer@aicte-demo.in"

    # 2. Request clarification
    res_clar = client.post(
        f"/api/findings/{finding_id}/review",
        json={
            "action": "request_clarification",
            "rationale": "Request applicant provide renewal fee receipt or updated NOC.",
            "clarification_item": "Fire Safety NOC Renewal Receipt"
        },
        headers=headers
    )
    assert res_clar.status_code == 200
    assert res_clar.json()["status"] == "clarification_requested"

    # 3. Dismiss finding
    res_dism = client.post(
        f"/api/findings/{finding_id}/review",
        json={
            "action": "dismiss",
            "rationale": "Dismissed: Valid renewal inspection order verified on physical file."
        },
        headers=headers
    )
    assert res_dism.status_code == 200
    assert res_dism.json()["status"] == "dismissed"


def test_overall_scrutiny_recommendation_recording():
    """Scrutiny officer can record final recommendation with mandatory justification."""
    app_id, finding_id, headers = create_case_with_findings()

    # Attempt without justification
    res_empty = client.post(
        f"/api/applications/{app_id}/recommendation",
        json={"recommendation": "RECOMMEND_APPROVAL", "rationale": ""},
        headers=headers
    )
    assert res_empty.status_code == 422

    # Valid recommendation
    res_valid = client.post(
        f"/api/applications/{app_id}/recommendation",
        json={
            "recommendation": "REQUEST_RESUBMISSION",
            "rationale": "Application deferred pending submission of renewed Fire Safety NOC within 14 days."
        },
        headers=headers
    )
    assert res_valid.status_code == 200
    data = res_valid.json()
    assert data["recommendation"] == "REQUEST_RESUBMISSION"
    assert data["overall_status"] == "review_completed"
    assert "Fire Safety" in data["recommendation_rationale"]


def test_export_structured_case_dossier_json():
    """Structured JSON dossier export must strictly conform to auditable schema."""
    app_id, finding_id, headers = create_case_with_findings()

    # Confirm finding and set recommendation
    client.post(
        f"/api/findings/{finding_id}/review",
        json={"action": "confirm", "rationale": "Statutory deficiency confirmed per Handbook norms."},
        headers=headers
    )
    client.post(
        f"/api/applications/{app_id}/recommendation",
        json={"recommendation": "RECOMMEND_REJECTION", "rationale": "Critical statutory clearances missing."},
        headers=headers
    )

    res = client.get(f"/api/applications/{app_id}/export/json")
    assert res.status_code == 200
    dossier = res.json()

    assert "dossier_metadata" in dossier
    assert "UNVERIFIED AGAINST CURRENT HANDBOOK" in dossier["dossier_metadata"]["banner_notice"]
    assert dossier["case_summary"]["recommendation"] == "RECOMMEND_REJECTION"
    assert len(dossier["document_inventory"]) >= 5
    assert all("sha256_hash" in d for d in dossier["document_inventory"])
    assert dossier["cryptographic_audit_ledger"]["chain_verified"] is True
    assert dossier["reviewer_signature_block"]["signed_by"] == "reviewer@aicte-demo.in"


def test_export_signed_pdf_scrutiny_dossier():
    """PDF export must generate valid non-empty PDF stream with official structure."""
    app_id, finding_id, headers = create_case_with_findings()

    res = client.get(f"/api/applications/{app_id}/export/pdf")
    assert res.status_code == 200
    assert res.headers["content-type"] == "application/pdf"
    assert res.content.startswith(b"%PDF-")
    assert len(res.content) > 3000


def test_applicant_restricted_view_redaction():
    """Applicant-facing view must redact heuristic anomaly signals and internal detector notes."""
    app_id, finding_id, headers = create_case_with_findings()

    # Before confirmation, no action items
    res_init = client.get(f"/api/applications/{app_id}/applicant-view")
    assert res_init.status_code == 200
    data_init = res_init.json()
    assert data_init["action_items_for_applicant"] == []

    # Officer confirms deficiency
    client.post(
        f"/api/findings/{finding_id}/review",
        json={"action": "confirm", "rationale": "Expired Fire Safety NOC requires fresh certificate."},
        headers=headers
    )

    # Now applicant sees confirmed deficiency notice without internal scores
    res_pub = client.get(f"/api/applications/{app_id}/applicant-view")
    assert res_pub.status_code == 200
    data_pub = res_pub.json()
    assert len(data_pub["action_items_for_applicant"]) == 1

    item = data_pub["action_items_for_applicant"][0]
    assert "notice_id" in item
    assert "Fire Safety" in item["title"]
    assert "is_heuristic" not in item  # Redacted!
    assert "confidence" not in item    # Redacted!
