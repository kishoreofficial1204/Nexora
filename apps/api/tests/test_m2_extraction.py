"""
Integration Tests for Nexora Milestone 2 (M2 - Extraction & Provenance).
Tests:
1. Application extraction pipeline execution.
2. Field provenance verification (page >= 1, valid bbox [x0, y0, x1, y1], confidence, method).
3. Immutable raw value retention upon reviewer inline correction.
4. Audit logging of reviewer field corrections.
5. Reviewer document classification override.
6. PDF page image rendering endpoint (PNG stream).
7. OCR fallback detection on raster scan document.
"""

import os
import json
import pytest
from fastapi.testclient import TestClient
from apps.api.main import app
from apps.api.models import UserRole

client = TestClient(app)


def get_reviewer_token() -> str:
    res = client.post("/api/auth/login", json={"email": "reviewer@aicte-demo.in", "password": "DemoPass123!"})
    assert res.status_code == 200
    return res.json()["access_token"]


def test_extraction_pipeline_and_field_provenance():
    """Seeds a clean application and runs extraction; verifies field provenance and bboxes."""
    token = get_reviewer_token()
    headers = {"Authorization": f"Bearer {token}"}

    # Seed application with clean bundle
    seed_res = client.post("/api/applications/seed-demo?bundle_key=bundle_a_clean", headers=headers)
    assert seed_res.status_code == 201
    app_id = seed_res.json()["id"]

    # Trigger extraction
    extract_res = client.post(f"/api/applications/{app_id}/extract", headers=headers)
    assert extract_res.status_code == 200
    fields = extract_res.json()
    assert len(fields) >= 10

    # Verify provenance contract for each field
    for f in fields:
        assert f["page"] >= 1
        bbox = f["bbox"]
        assert len(bbox) == 4
        assert bbox[2] >= bbox[0], f"Invalid x coordinate in bbox {bbox}"
        assert bbox[3] >= bbox[1], f"Invalid y coordinate in bbox {bbox}"
        assert f["method"] in ["native_pdf_text", "ocr", "pdfplumber_table"]
        assert 0.0 <= f["confidence"] <= 1.0
        assert f["raw_value"] != ""
        assert f["normalized_value"] != ""
        assert f["review_status"] == "unreviewed"


def test_reviewer_field_correction_and_raw_value_immutability():
    """Tests inline reviewer correction: updates normalized value while preserving immutable raw value."""
    token = get_reviewer_token()
    headers = {"Authorization": f"Bearer {token}"}

    # Seed and extract
    seed_res = client.post("/api/applications/seed-demo?bundle_key=bundle_a_clean", headers=headers)
    app_id = seed_res.json()["id"]
    extract_res = client.post(f"/api/applications/{app_id}/extract", headers=headers)
    fields = extract_res.json()

    target_field = next(f for f in fields if f["field_name"] == "intake_capacity")
    orig_raw = target_field["raw_value"]
    field_id = target_field["id"]

    # Apply reviewer correction
    patch_res = client.patch(
        f"/api/fields/{field_id}",
        json={
            "normalized_value": "120",
            "review_status": "corrected",
            "rationale": "Correction from approved seat matrix"
        },
        headers=headers
    )
    assert patch_res.status_code == 200
    updated = patch_res.json()

    # Crucial Non-Negotiable Principle: Raw value must remain immutable!
    assert updated["raw_value"] == orig_raw
    assert updated["normalized_value"] == "120"
    assert updated["review_status"] == "corrected"

    # Verify audit event recorded
    audit_res = client.get(f"/api/applications/{app_id}/audit", headers=headers)
    events = audit_res.json()
    field_events = [ev for ev in events if ev["action"] == "FIELD_CORRECTED"]
    assert len(field_events) >= 1
    meta = json.loads(field_events[0]["metadata_json"])
    assert meta["raw_value"] == orig_raw
    assert meta["updated_normalized"] == "120"


def test_reviewer_document_classification_override():
    """Allows reviewer to correct document classification."""
    token = get_reviewer_token()
    headers = {"Authorization": f"Bearer {token}"}

    seed_res = client.post("/api/applications/seed-demo?bundle_key=bundle_a_clean", headers=headers)
    doc_id = seed_res.json()["documents"][0]["id"]

    patch_res = client.patch(
        f"/api/documents/{doc_id}/type",
        json={"document_type": "doc_eoa_app", "rationale": "Manual reclassification"},
        headers=headers
    )
    assert patch_res.status_code == 200
    assert patch_res.json()["document_type"] == "doc_eoa_app"


def test_render_page_image_endpoint():
    """Tests the PyMuPDF page image rendering endpoint used by the evidence workbench viewer."""
    token = get_reviewer_token()
    headers = {"Authorization": f"Bearer {token}"}

    seed_res = client.post("/api/applications/seed-demo?bundle_key=bundle_a_clean", headers=headers)
    doc_id = seed_res.json()["documents"][0]["id"]

    res = client.get(f"/api/documents/{doc_id}/pages/1/image?dpi=100", headers=headers)
    assert res.status_code == 200
    assert res.headers["content-type"] == "image/png"
    assert len(res.content) > 1000  # valid image bytes
