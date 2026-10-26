# VeriScope: Project Assumptions & Regulatory Baseline

**Date:** 2026-10-26  
**Problem Statement:** SIH26261 — AI-Powered Application Validation, Document Authentication & Regulatory Compliance Verification  
**Operational Status:** Prototype / MVP Decision-Support Workspace (Not an Official AICTE System)

---

## 1. Regulatory Context & Scope
1. **Target Category for MVP:**
   - "Extension of Approval (EoA) — Engineering & Technology (Degree / Undergraduate)" for Academic Year 2026–27.
2. **Handbook Baseline:**
   - Reference starting point: *AICTE Approval Process Handbook (APH) 2024–25 to 2026–27*.
   - **Crucial Rule:** All rule pack rules are seeded with status `draft` and carry the banner `"UNVERIFIED AGAINST CURRENT HANDBOOK"`. Section numbers and citations are marked as `"TBD: confirm against official handbook"`. They must be formally reviewed and approved by an authorized administrator before being promoted to `active`.
3. **Assessment Date Baseline:**
   - Fixed default assessment date: `2026-10-26`.
   - The assessment date is strictly configurable per application instance; the system never silently defaults to `datetime.now()`.

---

## 2. Decision Support Boundaries (Non-Negotiable)
1. **No Automated Approvals or Rejections:**
   - The system is purely an evidence-backed decision-support console for AICTE scrutiny officers.
   - Final statutory decisions, physical inspections, and approval issuances reside solely with competent AICTE authorities.
2. **Anomaly Signals vs. Forensic Proof:**
   - Visual differences, incremental PDF updates, metadata conflicts, and OCR disparities are flagged as **Signals**, never proof of fraud or forgery.
   - Standard terminology: *"Structural change signal: needs human comparison"*, *"Intake mismatch signal: requires original source comparison"*.
3. **Fail-Closed Verification:**
   - Any external connector outage, missing record, OCR failure, or unverified QR code results in explicit states: `source_unavailable`, `not_independently_verified`, `pending`, or `manual_review_required`.
   - Under no circumstances does the system fabricate or presume a `verified` outcome.

---

## 3. External Integrations & Connectors
1. **Mock Connector ("SIMULATED"):**
   - The platform includes a `MockIssuerConnector` that simulates external registry lookups (e.g., State Technical University affiliation registry, AICTE portal database).
   - All simulated responses are explicitly badged in the UI, API responses, and exported reports as `SIMULATED`.
   - No access to live private AICTE systems, DigiLocker, or API Setu is assumed or pretended.
2. **QR Code & Signature Handling:**
   - QR codes are evaluated against an explicit allowlist of government domains. Arbitrary external URLs are never fetched.
   - Digital signatures check cryptographic integrity (pyHanko) where available, but a valid cryptographic signature does not equate to independent institutional verification without authoritative registry confirmation.

---

## 4. Synthetic Data & Privacy
1. **Zero Live Data Policy:**
   - All application packages, certificates, affiliation letters, and land documents are purely synthetic.
   - Every synthetic document is prominently watermarked: `"SAMPLE: NOT AN OFFICIAL DOCUMENT"`.
2. **Data Minimization & Provenance:**
   - Only fields strictly required for compliance rules are extracted.
   - Every extracted field retains full provenance: `document_id`, `page`, `bbox`, `raw_value`, `normalized_value`, `extraction_method`, and `confidence`.
3. **Immutable Audit Trail:**
   - All reviewer actions, field edits, and pipeline state changes are recorded in an append-only, SHA-256 hash-chained audit log.
