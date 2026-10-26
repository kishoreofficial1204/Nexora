# VeriScope Live Scrutiny Demonstration Script (7-Minute Presentation)

**Tagline:** *"One application, one evidence-backed review workspace."*  
**Problem Statement:** SIH26261 — AI-Powered Application Validation, Document Authentication & Regulatory Compliance Verification  
**Target Audience:** AICTE Scrutiny Officers, Regional Directors, and Executive Committee Auditors

---

## Overview & Demo Timeline

| Time | Segment | Role & Action | Key Talking Points |
| :--- | :--- | :--- | :--- |
| **0:00 - 1:00** | **The Mission & Non-Negotiables** | Presenter Overview | 1. Fragmented paper scrutiny creates delays.<br/>2. VeriScope is a **decision-support copilot**, not an automated approval engine.<br/>3. Provenance first: every fact links to document, page, and bounding box. |
| **1:00 - 2:30** | **Scenario 1: Clean Approval Path (Bundle A)** | `reviewer@aicte-demo.in` | • Seed Bundle A (`ABC Institute of Technology`)<br/>• OCR extraction & bounding box overlay<br/>• Zero deficiencies flagged; instant clean checklist.<br/>• Scrutiny Officer records recommendation: `RECOMMEND_APPROVAL`. |
| **2:30 - 4:30** | **Scenario 2: Deficient Case (Bundle C + D)** | `reviewer@aicte-demo.in` | • Seed Bundle C (Expired Fire NOC) & Bundle D (Intake Contradiction)<br/>• **Date Arithmetic:** NOC expired on 2026-03-31 vs Assessment Date 2026-10-26.<br/>• **Dual-Ended Evidence:** Highlighting Application (60 seats) vs Approval Letter (120 seats) simultaneously.<br/>• Reviewer actions: Confirm finding with **mandatory rationale**; request clarification from applicant.<br/>• View **Applicant Portal:** Internal signals redacted, only actionable deficiency notices visible. |
| **4:30 - 6:00** | **Scenario 3: Anomaly Signals (Bundle E + G)** | `reviewer@aicte-demo.in` & `senior_reviewer@...` | • Seed Bundle E (Duplicate SHA-256) & Bundle G (Modified PDF)<br/>• **Signals, not proof of fraud:** Cautious language alert for multiple incremental xref revisions.<br/>• **Simulated Connector:** External Fire Department registry lookup demonstrating `mismatch` and `timeout` fail-closed behavior.<br/>• Escalate to Senior Reviewer with justification. |
| **6:00 - 7:00** | **Cryptographic Audit, Reports & Eval** | `auditor@aicte-demo.in` | • Review unbroken SHA-256 append-only ledger.<br/>• One-click export of **Signed PDF Scrutiny Dossier** & **Structured JSON**.<br/>• Visit `/evaluation` dashboard: 100% precision/recall across benchmark suite. |

---

## Detailed Minute-by-Minute Speaker Narrative

### Minute 0:00 - 1:00: Executive Introduction
- **Visual:** VeriScope landing page (`/`) showing AICTE header, tagline, and architectural pillars.
- **Narrative:**
  > *"Respected Jury and Scrutiny Officers: Every year, thousands of technical institutions submit complex bundles of legal deeds, certificates, and safety clearances for Extension of Approval (EoA). Manual scrutiny is arduous, prone to oversight, and siloed.*
  >
  > *Today, we present **VeriScope**. Our tagline is: **'One application, one evidence-backed review workspace.'***
  >
  > *Before we demonstrate, let us emphasize our core non-negotiable principle: **VeriScope never automates approve or reject decisions.** It does not fabricate certainty. It is an intelligent decision-support copilot that equips human officers with deterministic rule checks, heuristic anomaly signals, and cryptographic provenance."*

---

### Minute 1:00 - 2:30: Scenario 1 — The Clean Benchmark (Bundle A)
- **Visual:** Login as `reviewer@aicte-demo.in`, navigate to `/dashboard`, click **"Seed Demo Scenario" -> Bundle A (Clean Benchmark)**.
- **Actions:**
  1. Open the created case for *ABC Institute of Technology* (PID `1-9876543210`).
  2. Click **"Open Evidence Workbench"**.
  3. Toggle between documents: Application Form, Previous EoA, Fire Safety NOC, Structural Stability.
  4. Note the green SVG bounding boxes over extracted values (e.g., Permanent ID, Declared Intake: 60).
  5. Click on the **Compliance Matrix (M4)** tab: note that every check displays status `PASS` alongside official citations: `APH 2024-27 Clause 2.1`.
  6. Click **"Officer Decision"** -> Select `RECOMMEND_APPROVAL`, input rationale: *"All 6 mandatory documents verified valid with matching PID and unexpired safety clearances per Chapter II norms."*
  7. Submit: observe the status progression advance to **Stage 5 Complete**.

---

### Minute 2:30 - 4:30: Scenario 2 — Deficiencies & Cross-Document Contradictions (Bundle C + D)
- **Visual:** Return to Queue, click **Seed Demo Scenario -> Bundle D (Intake Contradiction)**.
- **Actions:**
  1. Open the application. Go to the **Findings** tab.
  2. Point out **`RULE-EOA-005`**: *"Declared Intake vs Approved Intake Contradiction"*.
  3. Highlight the **Dual Evidence Provenance Box**:
     - *Document 1:* `doc_eoa_app.pdf` claims **60 seats**.
     - *Document 2:* `doc_prev_eoa_120.pdf` specifies **120 seats**.
  4. Click **"Inspect Bounding Box in Workbench"**: show how the system immediately loads the exact PDF page with the highlighted coordinate rect.
  5. Demonstrate **Reviewer Action**:
     - Click **"Confirm Finding"**.
     - Leave the rationale blank and click submit: **observe client & server validation rejecting empty rationale** (Non-Negotiable Principle 7).
     - Enter mandatory rationale: *"Confirmed contradiction. Institution must clarify whether Chapter IV intake reduction was sought."*
  6. Click **"Applicant Portal"** button in header:
     - Show the applicant's view (`/applications/[id]/applicant`).
     - Point out that **internal detector scores and heuristic anomaly flags are completely redacted**.
     - The applicant only sees an official deficiency note requesting clarification.

---

### Minute 3:30 - 4:30: Scenario 2 (Cont.) — Date Expiry Arithmetic (Bundle C)
- **Visual:** Open Bundle C case.
- **Narrative:**
  > *"Notice how VeriScope calculates certificate expiration. In `RULE-EOA-002`, the Fire Safety Certificate has an expiry date of `2026-03-31`. The application assessment date is configured to `2026-10-26`. The engine deterministically flags this as `FAIL`, with citation to APH Clause 2.4."*

---

### Minute 4:30 - 6:00: Scenario 3 — Structural Signals & External Registries (Bundle E + G)
- **Visual:** Open Bundle G (`bundle_g_modified_pdf`) and Bundle E (`bundle_e_exact_duplicate`).
- **Actions:**
  1. In Bundle E, show **`RULE-EOA-009`**: Duplicate SHA-256 detection flagging that the exact same file was uploaded for both Fire Safety and Structural Stability.
  2. In Bundle G, show **`RULE-ANOMALY-INCREMENTAL-PDF`**:
     - Notice the label: **`HEURISTIC ANOMALY SIGNAL (Advisory Only)`**.
     - Point out the cautious explanation: *"Structural change signal: incremental revision detected after creation. Needs human comparison."*
     - Emphasize to judges: *"This is a signal, never an accusation of fraud. It alerts the scrutiny officer to inspect the xref revision stream."*
  3. Go to the **External Verification (M4)** tab:
     - Select **Target Authority:** `State Fire & Rescue Services Licensing Portal`.
     - Point out the prominent banner: **`SIMULATED EXTERNAL ISSUER - DEMO ONLY`** (Non-Negotiable Principle 4).
     - Test **Match Mode**: shows verified NOC record with latency `180 ms`.
     - Test **Timeout Mode**: shows fail-closed handling without fabricating a pass.

---

### Minute 6:00 - 7:00: Cryptographic Audit Trail, Report Export & Evaluation
- **Visual:** Switch role to `auditor@aicte-demo.in`.
- **Actions:**
  1. Open the **Audit Trail** tab:
     - Show the append-only timeline of all uploads, field corrections, and reviewer decisions.
     - Note the green badge: **`Unbroken Chain (Verified Blocks: X)`**.
     - Explain: *"Every action is chained with SHA-256 hashes. Retroactive tampering is mathematically impossible."*
  2. Open the **Export Report (Tab 6)**:
     - Click **"Download Signed PDF Dossier"**: open the generated PDF with AICTE header, SHA-256 document inventory, findings disposition log, and officer signature block.
     - Click **"Download Structured JSON"**: show the clean machine-readable format.
  3. Navigate to **`/evaluation`**:
     - Show the Evaluation Harness: 100% precision and recall across all 9 synthetic benchmark bundles.
     - Click **"Run Evaluation Harness"**: watch it evaluate live in seconds.

---

## Conclusion Statement
> *"VeriScope bridges the gap between manual document fatigue and dangerous black-box automation. It guarantees provenance, enforces transparency, protects applicant privacy, and keeps the human scrutiny officer in complete command. Thank you."*
