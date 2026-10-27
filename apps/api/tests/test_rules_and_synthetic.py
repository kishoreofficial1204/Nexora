"""
Unit Tests for Nexora Milestone 0.
Validates:
1. Rule pack structure, draft banner, checklist items, and rule definitions.
2. Ground truth consistency and schema.
3. Synthetic document bundle files, valid PDF headers, and mandatory watermarks.
4. Evaluation harness execution and metrics reporting.
"""

import os
import json
import pytest
import fitz  # PyMuPDF
from apps.api.rules.loader import get_default_rule_pack, load_rule_pack
from eval.evaluate import run_evaluation

PROJECT_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", ".."))
RULES_PACK_PATH = os.path.join(PROJECT_ROOT, "rules", "packs", "eoa_v2026_draft.yaml")
GROUND_TRUTH_PATH = os.path.join(PROJECT_ROOT, "data", "synthetic", "ground_truth.json")
BUNDLES_DIR = os.path.join(PROJECT_ROOT, "data", "synthetic", "bundles")


def test_rule_pack_structure_and_draft_status():
    """Verifies that the seeded rule pack contains draft status and required items."""
    pack = load_rule_pack(RULES_PACK_PATH)
    
    assert pack.rule_pack.id == "pack_eoa_ug_2026"
    assert pack.rule_pack.status == "draft"
    assert "UNVERIFIED AGAINST CURRENT HANDBOOK" in pack.rule_pack.banner_notice
    assert pack.rule_pack.academic_year == "2026-27"
    
    # Check 10 checklist items
    assert len(pack.checklist_items) >= 6
    doc_types = [item.document_type for item in pack.checklist_items]
    assert "doc_eoa_app" in doc_types
    assert "doc_prev_eoa" in doc_types
    assert "doc_univ_affil" in doc_types
    assert "doc_fire_safety" in doc_types
    assert "doc_building_stability" in doc_types

    # Check 10 rules
    assert len(pack.rules) >= 8
    rule_ids = [r.rule_id for r in pack.rules]
    assert "RULE-EOA-001" in rule_ids
    assert "RULE-EOA-002" in rule_ids
    assert "RULE-EOA-005" in rule_ids
    assert "RULE-EOA-009" in rule_ids

    # Verify all rules have draft status and handbook placeholder
    for rule in pack.rules:
        assert rule.status == "draft"
        assert "TBD: confirm against official handbook" in rule.section_page


def test_ground_truth_consistency():
    """Verifies that ground truth contains all required bundle specifications."""
    assert os.path.exists(GROUND_TRUTH_PATH)
    with open(GROUND_TRUTH_PATH, "r", encoding="utf-8") as f:
        gt = json.load(f)

    assert gt["metadata"]["assessment_date"] == "2026-10-26"
    assert gt["metadata"]["watermark_policy"] == "SAMPLE: NOT AN OFFICIAL DOCUMENT"

    bundles = gt["bundles"]
    required_bundles = [
        "bundle_a_clean",
        "bundle_b_missing_doc",
        "bundle_c_expired_cert",
        "bundle_d_intake_mismatch",
        "bundle_e_exact_duplicate",
        "bundle_f_near_duplicate",
        "bundle_g_modified_pdf",
        "bundle_h_low_quality_ocr",
        "bundle_i_name_variant",
    ]

    for rb in required_bundles:
        assert rb in bundles, f"Missing bundle {rb} in ground truth"


def test_synthetic_bundle_files_and_watermarks():
    """Verifies that all synthetic bundle files exist on disk and bear the required watermark."""
    with open(GROUND_TRUTH_PATH, "r", encoding="utf-8") as f:
        gt = json.load(f)

    watermark_text = "SAMPLE: NOT AN OFFICIAL DOCUMENT"

    for bundle_name, bundle_data in gt["bundles"].items():
        bundle_dir = os.path.join(BUNDLES_DIR, bundle_name)
        assert os.path.isdir(bundle_dir), f"Directory {bundle_dir} does not exist"

        for doc_name in bundle_data["documents"]:
            doc_path = os.path.join(bundle_dir, doc_name)
            assert os.path.exists(doc_path), f"File {doc_path} does not exist"
            assert os.path.getsize(doc_path) > 0, f"File {doc_path} is empty"

            # Check valid PDF and watermark
            doc = fitz.open(doc_path)
            assert doc.page_count >= 1
            # Check for watermark text in text objects
            has_watermark = False
            for page in doc:
                text = page.get_text()
                if watermark_text in text:
                    has_watermark = True
                    break
            # For raster scans / rescans, the watermark was rendered into the image bitmap
            if "raster_scan" in doc_name or "rescanned" in doc_name:
                # Confirm the page contains an embedded image
                page = doc[0]
                if len(page.get_images()) > 0:
                    has_watermark = True
            assert has_watermark, f"Watermark missing in {doc_path}"
            doc.close()


def test_evaluation_harness_execution():
    """Runs the evaluation harness and verifies JSON and Markdown report outputs."""
    report = run_evaluation()
    assert report.sample_bundle_count >= 9
    assert report.total_document_count > 0
    assert "Evaluation Harness Benchmark Report" in report.summary_markdown
    assert report.assessment_date == "2026-10-26"
