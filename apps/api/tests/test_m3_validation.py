"""
Integration Tests for Nexora Milestone 3 (M3 - Validation & Consistency).
Tests known seeded synthetic bundles against upfront ground truth:
1. bundle_a_clean: Clean baseline produces 0 failures.
2. bundle_b_missing_doc: Triggers RULE-EOA-001 missing affiliation document.
3. bundle_c_expired_cert: Triggers RULE-EOA-002 fire NOC expiry vs 2026-10-26.
4. bundle_d_intake_mismatch: Triggers RULE-EOA-005 linking BOTH evidence locations.
5. bundle_e_exact_duplicate: Triggers RULE-EOA-009 duplicate SHA-256 detection.
6. bundle_g_modified_pdf: Triggers structural change incremental PDF signal.
7. bundle_i_name_variant: Triggers RULE-EOA-006 heuristic name variation signal.
"""

import pytest
from fastapi.testclient import TestClient
from apps.api.main import app

client = TestClient(app)


def get_reviewer_token() -> str:
    res = client.post("/api/auth/login", json={"email": "reviewer@aicte-demo.in", "password": "DemoPass123!"})
    assert res.status_code == 200
    return res.json()["access_token"]


def seed_and_extract(bundle_key: str, headers: dict) -> str:
    """Helper to provision a synthetic bundle and run fact extraction."""
    seed_res = client.post(f"/api/applications/seed-demo?bundle_key={bundle_key}", headers=headers)
    assert seed_res.status_code == 201
    app_id = seed_res.json()["id"]

    extract_res = client.post(f"/api/applications/{app_id}/extract", headers=headers)
    assert extract_res.status_code == 200
    return app_id


def test_bundle_a_clean_validation():
    """Clean benchmark bundle must have zero compliance failures."""
    token = get_reviewer_token()
    headers = {"Authorization": f"Bearer {token}"}

    app_id = seed_and_extract("bundle_a_clean", headers)
    val_res = client.post(f"/api/applications/{app_id}/validate", headers=headers)
    assert val_res.status_code == 200
    findings = val_res.json()

    # Zero fail severity findings on clean benchmark
    fail_findings = [f for f in findings if f["severity"] == "fail"]
    assert len(fail_findings) == 0


def test_bundle_b_missing_affiliation_document():
    """Bundle B must flag RULE-EOA-001 for missing university affiliation order."""
    token = get_reviewer_token()
    headers = {"Authorization": f"Bearer {token}"}

    app_id = seed_and_extract("bundle_b_missing_doc", headers)
    val_res = client.post(f"/api/applications/{app_id}/validate", headers=headers)
    assert val_res.status_code == 200
    findings = val_res.json()

    missing_findings = [f for f in findings if f["rule_id"] == "RULE-EOA-001"]
    assert len(missing_findings) >= 1
    assert missing_findings[0]["severity"] == "fail"
    assert missing_findings[0]["finding_type"] == "missing_document"
    assert "doc_univ_affil" in missing_findings[0]["explanation"]


def test_bundle_c_expired_certificate():
    """Bundle C must flag RULE-EOA-002 for fire safety NOC expired on 2026-03-31."""
    token = get_reviewer_token()
    headers = {"Authorization": f"Bearer {token}"}

    app_id = seed_and_extract("bundle_c_expired_cert", headers)
    val_res = client.post(f"/api/applications/{app_id}/validate", headers=headers)
    assert val_res.status_code == 200
    findings = val_res.json()

    expired_findings = [f for f in findings if f["rule_id"] == "RULE-EOA-002"]
    assert len(expired_findings) >= 1
    assert expired_findings[0]["severity"] == "fail"
    assert expired_findings[0]["finding_type"] == "certificate_expired"
    assert "2026-03-31" in expired_findings[0]["explanation"]


def test_bundle_d_intake_mismatch_and_dual_evidence():
    """Bundle D must flag RULE-EOA-005 and link BOTH evidence locations (Application 60 vs Approval Letter 120)."""
    token = get_reviewer_token()
    headers = {"Authorization": f"Bearer {token}"}

    app_id = seed_and_extract("bundle_d_intake_mismatch", headers)
    val_res = client.post(f"/api/applications/{app_id}/validate", headers=headers)
    assert val_res.status_code == 200
    findings = val_res.json()

    intake_findings = [f for f in findings if f["rule_id"] == "RULE-EOA-005"]
    assert len(intake_findings) == 1
    f = intake_findings[0]
    assert f["severity"] == "warning"
    assert f["finding_type"] == "intake_mismatch"
    assert "60" in f["explanation"] and "120" in f["explanation"]

    # Crucial PRD requirement: Links BOTH evidence locations!
    assert len(f["evidence_refs"]) == 2
    docs_linked = [ref["document_name"] for ref in f["evidence_refs"]]
    assert "doc_eoa_app.pdf" in docs_linked
    assert "doc_prev_eoa_120.pdf" in docs_linked


def test_bundle_e_exact_duplicate_detection():
    """Bundle E must detect duplicate SHA-256 hash across uploaded documents."""
    token = get_reviewer_token()
    headers = {"Authorization": f"Bearer {token}"}

    app_id = seed_and_extract("bundle_e_exact_duplicate", headers)
    val_res = client.post(f"/api/applications/{app_id}/validate", headers=headers)
    assert val_res.status_code == 200
    findings = val_res.json()

    dup_findings = [f for f in findings if f["rule_id"] == "RULE-EOA-009"]
    assert len(dup_findings) >= 1
    assert dup_findings[0]["finding_type"] == "duplicate_file_hash"


def test_bundle_g_modified_pdf_incremental_revision_signal():
    """Bundle G must detect authentic PyMuPDF incremental PDF revisions as a structural signal."""
    token = get_reviewer_token()
    headers = {"Authorization": f"Bearer {token}"}

    app_id = seed_and_extract("bundle_g_modified_pdf", headers)
    val_res = client.post(f"/api/applications/{app_id}/validate", headers=headers)
    assert val_res.status_code == 200
    findings = val_res.json()

    struct_findings = [f for f in findings if f["rule_id"] == "RULE-ANOMALY-INCREMENTAL-PDF"]
    assert len(struct_findings) >= 1
    assert struct_findings[0]["finding_type"] == "structural_change_signal"
    assert struct_findings[0]["is_heuristic"] is True
    assert "needs human comparison" in struct_findings[0]["explanation"].lower()


def test_bundle_i_institution_name_variation_signal():
    """Bundle I must detect abbreviation name variance ('ABC Institute of Technology' vs 'A.B.C. Inst. of Tech.')."""
    token = get_reviewer_token()
    headers = {"Authorization": f"Bearer {token}"}

    app_id = seed_and_extract("bundle_i_name_variant", headers)
    val_res = client.post(f"/api/applications/{app_id}/validate", headers=headers)
    assert val_res.status_code == 200
    findings = val_res.json()

    name_findings = [f for f in findings if f["rule_id"] == "RULE-EOA-006"]
    assert len(name_findings) >= 1
    assert name_findings[0]["finding_type"] == "name_variation_signal"
    assert name_findings[0]["is_heuristic"] is True
    assert len(name_findings[0]["evidence_refs"]) == 2
