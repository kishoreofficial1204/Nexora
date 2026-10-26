"""
Evaluation Harness Router for VeriScope.
Serves evaluation benchmarks, precision/recall metrics, and confusion matrices.
Allows running the evaluation suite dynamically.
"""

import os
import json
from fastapi import APIRouter, HTTPException
from eval.evaluate import run_evaluation, OUTPUT_REPORT_JSON, GROUND_TRUTH_FILE

router = APIRouter(prefix="/api/evaluation", tags=["Evaluation Harness"])


@router.get("/latest")
def get_latest_evaluation_report():
    """Returns latest stored evaluation benchmark report."""
    if not os.path.exists(OUTPUT_REPORT_JSON):
        # Run if not generated
        run_evaluation()

    with open(OUTPUT_REPORT_JSON, "r", encoding="utf-8") as f:
        data = json.load(f)
    return data


@router.post("/run")
def trigger_evaluation_run():
    """Triggers real-time evaluation over synthetic bundles and returns fresh metrics."""
    try:
        report = run_evaluation()
        return report.dict()
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Evaluation failed: {str(e)}")


@router.get("/bundles")
def get_benchmark_bundles():
    """Returns synthetic benchmark bundle catalog with upfront ground truth."""
    if not os.path.exists(GROUND_TRUTH_FILE):
        raise HTTPException(status_code=404, detail="Ground truth file not found.")

    with open(GROUND_TRUTH_FILE, "r", encoding="utf-8") as f:
        gt = json.load(f)

    return {
        "assessment_date": gt.get("metadata", {}).get("assessment_date", "2026-10-26"),
        "bundles": gt.get("bundles", {})
    }
