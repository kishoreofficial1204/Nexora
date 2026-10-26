# VeriScope System Limitations & Governance Disclaimers

### 1. Prototype & Decision Support Nature
- **Not an Official AICTE System:** VeriScope is an independent prototype engineered for SIH26261. It does not possess direct connectivity to official, restricted AICTE production databases or applicant repositories.
- **Advisory Signals Only:** All findings, mismatches, and compliance statuses are advisory signals for authorized scrutiny officers. The platform strictly forbids automated rejection or automated approval decisions.

### 2. External Issuer Connectors
- **Simulated Connectors:** The demo includes a `MockIssuerConnector`. In accordance with regulatory integrity guidelines, this is explicitly marked and badged as `SIMULATED` across all views, API payloads, and reports.
- **Fail-Closed Verification:** When an external registry is unreachable or unsupported, the status will report `source_unavailable` or `not_independently_verified`. The system never infers verification from silence or visual elements.

### 3. Document Analysis & Anomaly Detection
- **Signals vs. Proof:** Structural diffs, font anomalies, incremental PDF updates, and metadata discrepancies are signals indicating areas that warrant human inspection. They are not forensic proof of fraud, as harmless processes (such as re-scanning, printer driver conversions, compression, or redaction) frequently cause similar signatures.
- **Infrastructure Evidence:** Verification of physical infrastructure (classrooms, laboratories, barrier-free access) from photographs and layout plans is strictly triaged for completeness and visual anomalies. Real-world existence, structural safety, and capacity must be verified through official site inspection or competent authority certifications.

### 4. Rule Engine Baseline
- **Draft Status:** All rules derived from the AICTE Approval Process Handbook (APH) 2024–25 to 2026–27 are seeded as `draft` and labelled `UNVERIFIED AGAINST CURRENT HANDBOOK`. Handbooks are subject to administrative notifications and court directives; rules must be vetted by administrators prior to enforcement.
