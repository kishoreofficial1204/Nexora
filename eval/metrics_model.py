"""
Evaluation Data Contracts and Schemas for VeriScope.
Stores metrics definitions, sample counts (n), and evaluation results.
"""

from typing import Dict, List, Optional, Any
from pydantic import BaseModel, Field


class FieldExtractionMetric(BaseModel):
    field_type: str
    sample_size: int = Field(..., description="Sample count (n)")
    exact_match_rate: float
    normalized_match_rate: float
    notes: str = ""


class OcrQualityMetric(BaseModel):
    stratum: str  # e.g., "native_pdf", "rasterized_scan_90dpi"
    sample_size: int
    character_error_rate: float  # CER
    word_error_rate: float       # WER


class DetectionMetric(BaseModel):
    category: str  # e.g., "missing_document", "consistency_intake", "near_duplicate"
    true_positives: int
    false_positives: int
    false_negatives: int
    true_negatives: int
    precision: float
    recall: float
    f1_score: float
    sample_size: int


class AnomalySignalMetric(BaseModel):
    signal_type: str  # e.g., "incremental_pdf_revision", "perceptual_hash_diff"
    flagged_count: int
    known_modified_count: int
    precision: float
    false_positive_rate: float
    sample_size: int
    classification: str = "signal_only_not_proof"


class EvaluationReport(BaseModel):
    timestamp: str
    assessment_date: str
    evaluation_version: str
    sample_bundle_count: int
    total_document_count: int
    field_metrics: List[FieldExtractionMetric] = []
    ocr_metrics: List[OcrQualityMetric] = []
    detection_metrics: List[DetectionMetric] = []
    anomaly_metrics: List[AnomalySignalMetric] = []
    summary_markdown: str = ""
