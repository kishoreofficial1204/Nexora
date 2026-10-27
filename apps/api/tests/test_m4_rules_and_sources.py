"""
Integration Tests for VeriScope Milestone 4 (M4 - Rules, Sources & Simulated Connectors).
Validates:
1. Rule pack parsing, schema adherence, and draft status notices.
2. Citation integrity: Every rule must possess an official source document and handbook page/section.
3. Draft banner notice and 'TBD: confirm against official handbook' placeholder presence.
4. MockIssuerConnector response modes (match, mismatch, not_found, timeout, service_down).
5. Mandatory 'SIMULATED EXTERNAL ISSUER - DEMO ONLY' badging on all simulated outputs.
6. Handbook regulatory search scoring and citations.
7. Real-time rule evaluation test harness execution.
"""

import pytest
from fastapi.testclient import TestClient
from apps.api.main import app
from apps.api.rules.loader import get_default_rule_pack
from apps.api.services.mock_issuer import SIMULATED_BANNER

client = TestClient(app)


def _reviewer_headers() -> dict:
    res = client.post(
        "/api/auth/login",
        json={"email": "reviewer@aicte-demo.in", "password": "DemoPass123!"},
    )
    assert res.status_code == 200, f"Login failed: {res.text}"
    return {"Authorization": f"Bearer {res.json()['access_token']}"}


def test_rule_pack_citation_integrity():
    """Every rule in the active pack must cite an official source document and section."""
    pack = get_default_rule_pack()
    assert len(pack.rules) >= 10

    for rule in pack.rules:
        assert rule.source_document is not None and len(rule.source_document.strip()) > 0
        assert rule.section_page is not None and len(rule.section_page.strip()) > 0
        # Mandatory placeholder check per Non-Negotiable Principle 10
        assert "TBD: confirm against official handbook" in rule.section_page


def test_rule_pack_draft_banner_notice():
    """Rule pack must display the unverified draft banner notice."""
    pack = get_default_rule_pack()
    assert pack.rule_pack.status == "draft"
    assert "UNVERIFIED AGAINST CURRENT HANDBOOK" in pack.rule_pack.banner_notice


def test_mock_issuer_all_response_modes():
    """MockIssuerConnector must faithfully support all 5 simulation modes with mandatory badge."""
    modes = ["match", "mismatch", "not_found", "timeout", "service_down"]
    headers = _reviewer_headers()

    for mode in modes:
        res = client.post(
            "/api/verification/query",
            headers=headers,
            json={
                "authority_id": "fire_department",
                "query_payload": {
                    "certificate_number": "FS/2026/8891",
                    "valid_until_date": "2027-01-09"
                },
                "mode": mode,
                "simulated_delay_ms": 10
            }
        )
        assert res.status_code == 200
        data = res.json()

        # Non-Negotiable Principle 4: Labeled SIMULATED everywhere
        assert data["badge"] == SIMULATED_BANNER
        assert "SIMULATED" in data["note"]
        assert data["status"] == ("verified" if mode == "match" else mode)

        if mode == "match":
            assert data["response_payload"]["statutory_compliance_status"] == "COMPLIANT"
            assert data["error_message"] is None
        elif mode == "mismatch":
            assert "discrepancy" in data["response_payload"]
        elif mode == "not_found":
            assert data["response_payload"]["registry_status"] == "RECORD_NOT_FOUND"
        elif mode == "timeout":
            assert data["response_payload"] is None
            assert "timeout" in data["error_message"].lower()
        elif mode == "service_down":
            assert data["response_payload"] is None
            assert "503" in data["error_message"]


def test_supported_external_authorities_list():
    """Listing external authorities must return supported licensing bodies with simulated notice."""
    res = client.get("/api/verification/authorities", headers=_reviewer_headers())
    assert res.status_code == 200
    data = res.json()
    assert data["badge"] == SIMULATED_BANNER
    auth_ids = [a["id"] for a in data["authorities"]]
    assert "aicte_portal" in auth_ids
    assert "fire_department" in auth_ids
    assert "state_university" in auth_ids
    assert "municipal_corporation" in auth_ids


def test_handbook_source_search():
    """Querying the regulatory handbook index must return relevant excerpts with citations."""
    res = client.post("/api/rules/search", json={"query": "intake capacity increase norms"})
    assert res.status_code == 200
    data = res.json()
    assert data["total_matches"] >= 1
    assert "UNVERIFIED AGAINST CURRENT HANDBOOK" in data["banner_notice"]

    top_result = data["results"][0]
    assert "Chapter IV" in top_result.get("chapter", "") or "Intake" in top_result.get("title", "")
    assert "https://aicte.gov.in" in top_result["source_url"]


def test_interactive_rule_test_harness():
    """Interactive rule evaluation endpoint must accurately evaluate supplied synthetic facts."""
    # Test 1: Fire safety expiry check with expired date
    res_fail = client.post(
        "/api/rules/test-eval",
        json={
            "rule_id": "RULE-EOA-002",
            "test_facts": {
                "valid_until_date": "2026-03-31",
                "assessment_date": "2026-10-26"
            }
        }
    )
    assert res_fail.status_code == 200
    data_fail = res_fail.json()
    assert data_fail["status"] == "fail"
    assert "expired on 2026-03-31" in data_fail["explanation"]
    assert "UNVERIFIED AGAINST CURRENT HANDBOOK" in data_fail["banner_notice"]

    # Test 2: Fire safety expiry check with valid date
    res_pass = client.post(
        "/api/rules/test-eval",
        json={
            "rule_id": "RULE-EOA-002",
            "test_facts": {
                "valid_until_date": "2027-01-09",
                "assessment_date": "2026-10-26"
            }
        }
    )
    assert res_pass.status_code == 200
    data_pass = res_pass.json()
    assert data_pass["status"] == "pass"
    assert "remains valid until 2027-01-09" in data_pass["explanation"]

    # Test 3: Intake contradiction check
    res_intake = client.post(
        "/api/rules/test-eval",
        json={
            "rule_id": "RULE-EOA-005",
            "test_facts": {
                "app_intake": 60,
                "prev_intake": 120
            }
        }
    )
    assert res_intake.status_code == 200
    data_intake = res_intake.json()
    assert data_intake["status"] == "warning"
    assert "60" in data_intake["explanation"] and "120" in data_intake["explanation"]
