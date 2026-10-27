# VeriScope System Limitations & Governance Disclaimers

### 1. Prototype & Decision Support Nature
- **Not an Official AICTE System:** VeriScope is an independent decision-support prototype. It does not possess direct connectivity to official, restricted AICTE production databases or applicant repositories.
- **Advisory Signals Only:** All findings, mismatches, and compliance statuses are advisory signals for authorized scrutiny officers. The platform strictly forbids automated rejection or automated approval decisions.

### 2. External Issuer Connectors
- **Simulated Connectors:** The demo includes a `MockIssuerConnector`. In accordance with regulatory integrity guidelines, this is explicitly marked and badged as `SIMULATED` across all views, API payloads, and reports.
- **Fail-Closed Verification:** When an external registry is unreachable or unsupported, the status will report `source_unavailable` or `not_independently_verified`. The system never infers verification from silence or visual elements.

### 3. Document Analysis & Anomaly Detection
- **Signals vs. Proof:** Structural diffs, font anomalies, incremental PDF updates, and metadata discrepancies are signals indicating areas that warrant human inspection. They are not forensic proof of fraud, as harmless processes (such as re-scanning, printer driver conversions, compression, or redaction) frequently cause similar signatures.
- **Infrastructure Evidence:** Verification of physical infrastructure (classrooms, laboratories, barrier-free access) from photographs and layout plans is strictly triaged for completeness and visual anomalies. Real-world existence, structural safety, and capacity must be verified through official site inspection or competent authority certifications.

### 4. Rectification and Verification Boundaries
- **Applicant re-upload is simulated:** The applicant portal demonstrates the clarification/re-upload interaction, but the submitted replacement is not yet persisted as a rectification request and does not automatically re-run validation.
- **Verification is persisted but simulated:** Verification records include source, timestamp, status, and audit events, but the external issuer response is produced by a clearly labelled mock connector.

### 5. Evaluation Metrics
- **Baseline instrumentation only:** The current evaluation report is a demo baseline and must not be cited as production accuracy. Metrics are being replaced with per-case predictions from the actual pipeline.

### 6. Rule Engine Baseline
- **Draft Status:** All rules derived from the AICTE Approval Process Handbook (APH) 2024–25 to 2026–27 are seeded as `draft` and labelled `UNVERIFIED AGAINST CURRENT HANDBOOK`. Handbooks are subject to administrative notifications and court directives; rules must be vetted by administrators prior to enforcement.
