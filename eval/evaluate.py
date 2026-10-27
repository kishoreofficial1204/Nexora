"""
Evaluation Harness for VeriScope.

Runs the real extraction + deterministic validation pipeline over the synthetic
bundles and compares the resulting findings and fields against ground truth.
Metrics are computed from those predictions; they are not hand-coded.

The benchmark is intentionally small (nine synthetic bundles). It demonstrates
pipeline behaviour and failure modes, not production accuracy.
"""

import hashlib
import json
import os
import re
import sys
from collections import defaultdict
from datetime import datetime
from typing import Any, Dict, Iterable, List, Optional

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
PROJECT_ROOT = os.path.dirname(BASE_DIR)
if PROJECT_ROOT not in sys.path:
    sys.path.insert(0, PROJECT_ROOT)

import fitz  # PyMuPDF
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

import apps.api.models  # noqa: F401 - register all ORM models
from apps.api.db.database import Base
from apps.api.models import (
    Application,
    ApplicationStatus,
    Document,
    DocumentSourceStatus,
    ExtractedField,
    Institution,
    InstitutionRecord,
    User,
    UserRole,
)
from apps.api.pipeline.extractor import extract_document_fields
from apps.api.pipeline.validator import normalize_institution_name, validate_application
from eval.metrics_model import (
    EvaluationReport,
    FieldExtractionMetric,
    DetectionMetric,
    AnomalySignalMetric,
)

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
DATA_DIR = os.path.join(os.path.dirname(BASE_DIR), "data", "synthetic")
GROUND_TRUTH_FILE = os.path.join(DATA_DIR, "ground_truth.json")
BUNDLES_DIR = os.path.join(DATA_DIR, "bundles")
OUTPUT_REPORT_JSON = os.path.join(BASE_DIR, "latest_eval_report.json")
OUTPUT_REPORT_MD = os.path.join(BASE_DIR, "latest_eval_report.md")

WATERMARK = "SAMPLE: NOT AN OFFICIAL DOCUMENT"
ASSESSMENT_DATE = "2026-10-26"
RULE_PACK_ID = "pack_eoa_ug_2026"
TYPE_PREFIXES = [
    "doc_eoa_app",
    "doc_prev_eoa",
    "doc_univ_affil",
    "doc_fire_safety",
    "doc_building_stability",
    "doc_infra_photos",
]


def _safe_div(numerator: float, denominator: float) -> float:
    return round(numerator / denominator, 4) if denominator else 0.0


def _canonical(field_name: str, value: Any) -> str:
    text = str(value or "").strip()
    if "name" in field_name:
        return normalize_institution_name(text)
    if field_name in {"intake_capacity", "approved_intake", "photo_count", "geotag_count"}:
        digits = re.sub(r"[^\d]", "", text)
        return digits or text
    if field_name.endswith("_date"):
        match = re.search(r"([12]\d{3}-\d{2}-\d{2})", text)
        return match.group(1) if match else text
    return " ".join(text.split()).lower()


def _document_type(file_name: str) -> str:
    for prefix in TYPE_PREFIXES:
        if file_name.startswith(prefix):
            return prefix
    return "unknown"


def _expected_findings(bundle_info: Dict[str, Any]) -> List[Dict[str, Any]]:
    raw = bundle_info.get("expected_findings") or []
    if isinstance(raw, dict):
        return [raw]
    return raw


def _run_bundle_pipeline(
    session,
    bundle_key: str,
    bundle_info: Dict[str, Any],
    institution_id: str,
    reviewer_id: str,
) -> Dict[str, Any]:
    """Extract and validate one bundle in the isolated evaluation database."""
    app = Application(
        institution_id=institution_id,
        category="Extension of Approval (EoA)",
        academic_year="2026-27",
        assessment_date=ASSESSMENT_DATE,
        status=ApplicationStatus.PRELIMINARY_REVIEW,
        rule_pack_id=RULE_PACK_ID,
        created_by_id=reviewer_id,
    )
    session.add(app)
    session.flush()

    fields_by_doc: Dict[str, Dict[str, str]] = defaultdict(dict)
    bundle_path = os.path.join(BUNDLES_DIR, bundle_key)
    pipeline_errors: List[str] = []

    for file_name in sorted(bundle_info.get("documents", [])):
        source_path = os.path.join(bundle_path, file_name)
        if not os.path.exists(source_path):
            pipeline_errors.append(f"missing_file:{file_name}")
            continue

        with open(source_path, "rb") as handle:
            content = handle.read()
        sha256 = hashlib.sha256(content).hexdigest()
        doc_type = _document_type(file_name)
        pdf = fitz.open(source_path)
        page_count = pdf.page_count
        pdf.close()

        document = Document(
            application_id=app.id,
            document_type=doc_type,
            filename=os.path.basename(source_path),
            original_filename=file_name,
            file_size=len(content),
            mime_type="application/pdf",
            hash_sha256=sha256,
            storage_path=source_path,
            page_count=page_count,
            source_status=DocumentSourceStatus.UPLOADED,
        )
        session.add(document)
        session.flush()

        try:
            detected_type, raw_fields = extract_document_fields(
                pdf_path=source_path,
                document_type_hint=doc_type,
            )
            if doc_type == "unknown" and detected_type != "unknown":
                document.document_type = detected_type

            for raw in raw_fields:
                session.add(
                    ExtractedField(
                        document_id=document.id,
                        field_name=raw.field_name,
                        raw_value=raw.raw_value,
                        normalized_value=raw.normalized_value,
                        page=raw.page,
                        bbox_json=json.dumps(raw.bbox),
                        method=raw.method,
                        confidence=raw.confidence,
                        review_status="unreviewed",
                    )
                )
                fields_by_doc[file_name][raw.field_name] = raw.normalized_value
            document.source_status = DocumentSourceStatus.PARSED
        except Exception as exc:
            document.source_status = DocumentSourceStatus.ERROR
            pipeline_errors.append(f"{file_name}:{exc}")

    session.commit()
    session.refresh(app)
    findings = validate_application(app, session)

    return {
        "app_id": app.id,
        "findings": [
            {
                "id": finding.id,
                "rule_id": finding.rule_id,
                "finding_type": finding.finding_type,
                "severity": finding.severity,
                "is_heuristic": finding.is_heuristic,
            }
            for finding in findings
        ],
        "fields_by_doc": fields_by_doc,
        "pipeline_errors": pipeline_errors,
    }


def _detection_metrics(
    ground_truth: Dict[str, Any],
    results: Dict[str, Dict[str, Any]],
    categories: Iterable[tuple[str, str]],
) -> List[DetectionMetric]:
    metrics: List[DetectionMetric] = []
    total = len(ground_truth)
    for category, expected_type in categories:
        tp = fp = fn = tn = 0
        for bundle_key, bundle_info in ground_truth.items():
            expected = any(
                item.get("finding_type") == expected_type
                for item in _expected_findings(bundle_info)
            )
            predicted = any(
                finding["finding_type"] == expected_type
                for finding in results.get(bundle_key, {}).get("findings", [])
            )
            if expected and predicted:
                tp += 1
            elif predicted and not expected:
                fp += 1
            elif expected and not predicted:
                fn += 1
            else:
                tn += 1
        precision = _safe_div(tp, tp + fp)
        recall = _safe_div(tp, tp + fn)
        f1 = _safe_div(2 * precision * recall, precision + recall) if precision + recall else 0.0
        metrics.append(
            DetectionMetric(
                category=category,
                true_positives=tp,
                false_positives=fp,
                false_negatives=fn,
                true_negatives=tn,
                precision=precision,
                recall=recall,
                f1_score=f1,
                sample_size=total,
            )
        )
    return metrics


def _field_metrics(
    ground_truth: Dict[str, Any],
    results: Dict[str, Dict[str, Any]],
) -> List[FieldExtractionMetric]:
    observations: Dict[str, Dict[str, int]] = defaultdict(
        lambda: {"total": 0, "exact": 0, "normalized": 0}
    )

    for bundle_key, bundle_info in ground_truth.items():
        actual_fields = results.get(bundle_key, {}).get("fields_by_doc", {})
        for doc_name, expected_fields in (bundle_info.get("expected_fields") or {}).items():
            actual_for_doc = actual_fields.get(doc_name, {})
            for field_name, expected_value in (expected_fields or {}).items():
                observations[field_name]["total"] += 1
                if field_name not in actual_for_doc:
                    continue
                actual_value = actual_for_doc[field_name]
                if str(actual_value).strip() == str(expected_value).strip():
                    observations[field_name]["exact"] += 1
                if _canonical(field_name, actual_value) == _canonical(field_name, expected_value):
                    observations[field_name]["normalized"] += 1

    notes = {
        "institution_name": "Exact and normalized name comparison (legal suffix and punctuation tolerant).",
        "institute_pid": "AICTE Permanent Institute ID compared as a normalized string.",
        "intake_capacity": "Declared intake compared after numeric parsing.",
        "academic_year": "Academic-year label compared as a normalized string.",
        "valid_until_date": "Certificate validity date compared as YYYY-MM-DD.",
    }
    metrics: List[FieldExtractionMetric] = []
    for field_name, counts in sorted(observations.items()):
        metrics.append(
            FieldExtractionMetric(
                field_type=field_name,
                sample_size=counts["total"],
                exact_match_rate=_safe_div(counts["exact"], counts["total"]),
                normalized_match_rate=_safe_div(counts["normalized"], counts["total"]),
                notes=notes.get(field_name, "Pipeline-extracted field compared to ground truth."),
            )
        )
    return metrics


def _anomaly_metrics(
    ground_truth: Dict[str, Any],
    results: Dict[str, Dict[str, Any]],
) -> List[AnomalySignalMetric]:
    signals = [
        ("incremental_pdf_revision", "structural_change_signal"),
        ("near_duplicate_perceptual_hash", "near_duplicate_signal"),
        ("low_confidence_extraction", "low_confidence_extraction"),
    ]
    metrics: List[AnomalySignalMetric] = []
    total = len(ground_truth)
    for signal_type, finding_type in signals:
        flagged = known = tp = fp = tn = 0
        for bundle_key, bundle_info in ground_truth.items():
            expected = any(
                item.get("finding_type") == finding_type
                for item in _expected_findings(bundle_info)
            )
            predicted = any(
                finding["finding_type"] == finding_type
                for finding in results.get(bundle_key, {}).get("findings", [])
            )
            if expected:
                known += 1
            if predicted:
                flagged += 1
            if expected and predicted:
                tp += 1
            elif predicted and not expected:
                fp += 1
            elif not expected and not predicted:
                tn += 1
        metrics.append(
            AnomalySignalMetric(
                signal_type=signal_type,
                flagged_count=flagged,
                known_modified_count=known,
                precision=_safe_div(tp, tp + fp),
                false_positive_rate=_safe_div(fp, fp + tn),
                sample_size=total,
                classification="signal_only_not_proof",
            )
        )
    return metrics


def run_evaluation() -> EvaluationReport:
    if not os.path.exists(GROUND_TRUTH_FILE):
        raise FileNotFoundError(f"Ground truth not found at {GROUND_TRUTH_FILE}")

    with open(GROUND_TRUTH_FILE, "r", encoding="utf-8") as handle:
        gt = json.load(handle)

    bundles: Dict[str, Any] = gt.get("bundles", {})
    total_docs = 0
    for bundle_key, bundle_info in bundles.items():
        bundle_path = os.path.join(BUNDLES_DIR, bundle_key)
        for doc_name in bundle_info.get("documents", []):
            doc_path = os.path.join(bundle_path, doc_name)
            if not os.path.exists(doc_path):
                raise FileNotFoundError(f"Missing expected bundle document: {doc_path}")
            total_docs += 1
            pdf = fitz.open(doc_path)
            try:
                has_watermark = any(WATERMARK in page.get_text() for page in pdf)
                if not has_watermark and any(page.get_images() for page in pdf):
                    # Raster scans carry the watermark in the rendered bitmap.
                    has_watermark = True
                if not has_watermark:
                    raise ValueError(f"Synthetic watermark missing from {doc_path}")
            finally:
                pdf.close()

    engine = create_engine(
        "sqlite://",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    Base.metadata.create_all(bind=engine)
    Session = sessionmaker(bind=engine)
    session = Session()

    try:
        reviewer = User(
            email="evaluation@veriscope.local",
            hashed_password="not-used",
            full_name="Evaluation Pipeline Runner",
            role=UserRole.REVIEWER,
            organization="Synthetic Evaluation",
            is_active=True,
        )
        institution = Institution(
            name="ABC Institute of Technology",
            permanent_id="1-9876543210",
            address="Synthetic evaluation campus",
            state="Tamil Nadu",
            institution_type="Engineering & Technology - Undergraduate",
            profile_source="synthetic_eval",
        )
        session.add_all([reviewer, institution])
        session.flush()
        record = InstitutionRecord(
            institution_id=institution.id,
            academic_year="2026-27",
            approved_intake=60,
            approved_programmes_json='["Computer Science & Engineering", "Mechanical Engineering"]',
            previous_eoa_valid_until="2026-06-30",
            compliance_status="COMPLIANT",
            ter_payment_status="PAID",
            application_history_json="[]",
            source="synthetic_eval",
            is_simulated=True,
        )
        session.add(record)
        session.commit()

        results: Dict[str, Dict[str, Any]] = {}
        pipeline_errors: List[str] = []
        for bundle_key, bundle_info in bundles.items():
            result = _run_bundle_pipeline(
                session=session,
                bundle_key=bundle_key,
                bundle_info=bundle_info,
                institution_id=institution.id,
                reviewer_id=reviewer.id,
            )
            results[bundle_key] = result
            pipeline_errors.extend(result["pipeline_errors"])

        detection_metrics = _detection_metrics(
            bundles,
            results,
            categories=[
                ("missing_document", "missing_document"),
                ("expired_certificate", "certificate_expired"),
                ("intake_consistency", "intake_mismatch"),
                ("duplicate_sha256", "duplicate_file_hash"),
                ("near_duplicate", "near_duplicate_signal"),
                ("incremental_pdf_revision", "structural_change_signal"),
                ("low_confidence_extraction", "low_confidence_extraction"),
                ("name_variation", "name_variation_signal"),
            ],
        )
        field_metrics = _field_metrics(bundles, results)
        anomaly_metrics = _anomaly_metrics(bundles, results)

        report = EvaluationReport(
            timestamp=datetime.utcnow().isoformat() + "Z",
            assessment_date=gt.get("metadata", {}).get("assessment_date", ASSESSMENT_DATE),
            evaluation_version="Pipeline-v1",
            sample_bundle_count=len(bundles),
            total_document_count=total_docs,
            field_metrics=field_metrics,
            detection_metrics=detection_metrics,
            anomaly_metrics=anomaly_metrics,
        )

        md_lines = [
            "# VeriScope Evaluation Harness Benchmark Report",
            f"**Run Timestamp:** {report.timestamp}  ",
            f"**Assessment Date:** {report.assessment_date}  ",
            f"**Evaluation Stage:** {report.evaluation_version}  ",
            f"**Evaluated Bundles (n):** {report.sample_bundle_count} | **Total Documents (n):** {report.total_document_count}",
            "",
            "Metrics below are generated by running the extraction and deterministic validation",
            "pipeline over the synthetic bundles and comparing the output to ground truth.",
            "They are a demo benchmark, not production accuracy.",
            "",
            "### 1. Deterministic Detection Metrics",
            "| Evaluation Category | Sample Size (n) | TP | FP | FN | Precision | Recall | F1 Score |",
            "|:--------------------|:----------------|:---|:---|:---|:----------|:-------|:---------|",
        ]
        for metric in report.detection_metrics:
            md_lines.append(
                f"| {metric.category} | n = {metric.sample_size} | {metric.true_positives} | "
                f"{metric.false_positives} | {metric.false_negatives} | {metric.precision:.2f} | "
                f"{metric.recall:.2f} | {metric.f1_score:.2f} |"
            )

        md_lines.extend(
            [
                "",
                "### 2. Anomaly Signal Diagnostics (Signals Only — Never Proof of Fraud)",
                "| Signal Type | Sample Size (n) | Flagged | Known Modified | Precision | False Positive Rate | Classification |",
                "|:------------|:----------------|:--------|:---------------|:----------|:--------------------|:---------------|",
            ]
        )
        for metric in report.anomaly_metrics:
            md_lines.append(
                f"| {metric.signal_type} | n = {metric.sample_size} | {metric.flagged_count} | "
                f"{metric.known_modified_count} | {metric.precision:.2f} | "
                f"{metric.false_positive_rate:.2f} | {metric.classification} |"
            )

        md_lines.extend(
            [
                "",
                "### 3. Field Extraction & Provenance",
                "| Field Name | Sample Size (n) | Exact Match Rate | Normalized Match Rate | Specification Note |",
                "|:-----------|:----------------|:-----------------|:----------------------|:-------------------|",
            ]
        )
        for metric in report.field_metrics:
            md_lines.append(
                f"| {metric.field_type} | n = {metric.sample_size} | "
                f"{metric.exact_match_rate:.2f} | {metric.normalized_match_rate:.2f} | {metric.notes} |"
            )

        md_lines.append("")
        md_lines.append(
            f"**Pipeline errors during this run:** {len(pipeline_errors)}"
        )
        if pipeline_errors:
            for error in pipeline_errors[:10]:
                md_lines.append(f"- `{error}`")
        md_lines.append("")
        md_lines.append(
            "> **Scope note:** This harness uses nine synthetic bundles. Use it to inspect "
            "pipeline behaviour and regressions, not to claim production precision or recall."
        )

        report.summary_markdown = "\n".join(md_lines)
    finally:
        session.close()
        engine.dispose()

    with open(OUTPUT_REPORT_JSON, "w", encoding="utf-8") as handle:
        handle.write(report.model_dump_json(indent=2))

    with open(OUTPUT_REPORT_MD, "w", encoding="utf-8") as handle:
        handle.write(report.summary_markdown)

    print(
        f"[SUCCESS] Evaluation complete. Output written to {OUTPUT_REPORT_JSON} "
        f"and {OUTPUT_REPORT_MD}"
    )
    return report


if __name__ == "__main__":
    run_evaluation()
