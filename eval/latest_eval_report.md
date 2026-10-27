# VeriScope Evaluation Harness Benchmark Report
**Run Timestamp:** 2026-10-27T06:43:54.977653Z  
**Assessment Date:** 2026-10-26  
**Evaluation Stage:** M0-Baseline  
**Evaluated Bundles (n):** 9 | **Total Documents (n):** 54  

### 1. Deterministic Detection Metrics
| Evaluation Category | Sample Size (n) | Precision | Recall | F1 Score | Notes |
|:--------------------|:----------------|:----------|:-------|:---------|:------|
| missing_document | n = 9 | 1.00 | 1.00 | 1.00 | Ground truth aligned |
| expired_certificate | n = 9 | 1.00 | 1.00 | 1.00 | Ground truth aligned |
| intake_consistency | n = 9 | 1.00 | 1.00 | 1.00 | Ground truth aligned |
| duplicate_sha256 | n = 9 | 1.00 | 1.00 | 1.00 | Ground truth aligned |

### 2. Anomaly Signal Diagnostics (Signals Only — Never Proof of Fraud)
| Signal Type | Sample Size (n) | Flagged | Known Modified | Precision | False Positive Rate | Classification |
|:------------|:----------------|:--------|:---------------|:----------|:--------------------|:---------------|
| incremental_pdf_revision | n = 9 | 1 | 1 | 1.00 | 0.00 | signal_only_not_proof |
| near_duplicate_perceptual_hash | n = 9 | 1 | 1 | 1.00 | 0.00 | signal_only_not_proof |

### 3. Field Extraction & Provenance Baseline
| Field Name | Sample Size (n) | Exact Match Rate | Normalized Match Rate | Specification Note |
|:-----------|:----------------|:-----------------|:----------------------|:-------------------|
| institution_name | n = 9 | 1.00 | 1.00 | Normalized removes trailing punctuation and standardizes abbreviations |
| institute_pid | n = 9 | 1.00 | 1.00 | Matches AICTE standard regex pattern ^1-[0-9]{10}$ |
| intake_capacity | n = 9 | 1.00 | 1.00 | Numerical parsing of declared approved intake |

> **Important:** All metrics above are computed directly from the synthetic test suite with sample sizes indicated (`n`). No marketing claims or unverified percentages are permitted.