# VeriScope — Roadmap and Current Status

Last reviewed: 2026-10-27

## Completion snapshot

These estimates are for the **prototype scope**, not a production rollout.

| View of the project | Estimate | Notes |
|---|---:|---|
| End-to-end demo journey | **~92%** | Intake → extraction → rules → findings → verification → alerts → review → audit → export works. Reviewer clarification and applicant re-upload now persist; re-validation remains a reviewer action. |
| Planned P0/P1 checklist | **~82%** | Core backend and UI are substantially built. Remaining work is final QA, documentation reconciliation, and deeper test coverage. |
| Production readiness (P2) | **~10–15%** | Real integrations, IAM hardening, retention, load/security work are intentionally out of scope. |

## What is working

- [x] Synthetic bundle intake with safe storage and SHA-256 document hashes.
- [x] PDF/image extraction with field provenance and no fabricated fallbacks.
- [x] Generic YAML rule interpreter; all active rules execute and persist.
- [x] Missing-document, expiry, intake-mismatch, duplicate, name-variant, and
      suspicious-PDF findings.
- [x] Institutional-record checks against a seeded synthetic record.
- [x] Persisted verification records for simulated external issuers.
- [x] Alerts generated from findings/verification outcomes, with acknowledge and
      resolve endpoints.
- [x] Reviewer finding dispositions with mandatory rationale.
- [x] Overall recommendation workflow with mandatory justification.
- [x] Hash-chained audit log plus tamper detection (hash and linkage checks).
- [x] JSON/PDF dossier export.
- [x] Applicant-facing view that redacts internal heuristic signals.
- [x] Persisted rectification requests, applicant replacement submission, and
      reviewer resolution with audit events.
- [x] Applicant ownership recorded on intake, with an additive migration for local
      demo databases.
- [x] Auth/RBAC on dossier exports, applicant view, rectifications, rules,
      institutions, and evaluation routes.
- [x] Evaluation harness that runs extraction + validation over the synthetic
      bundles and computes field, detection, and anomaly metrics from predictions.
- [x] Light/dark theme system, editorial landing/login, responsive nav, dashboard,
      application overview, alert centre, rules explorer, evaluation page, and
      governance page.
- [x] Curated demo reset script with synthetic applicant ownership.
- [x] Authenticated workbench page rendering and original-PDF opening.
- [x] Generated, watermarked sample PDF packet pre-attached on new intake.

> For the ordered demo → submission execution sequence, see
> [`sih-delivery-plan.md`](./sih-delivery-plan.md).

## What is partial

- [~] **Rectification re-validation:** reviewer clarification and applicant
  re-upload persist, but a reviewer must explicitly re-run extraction/validation
  after a replacement arrives. This is intentional for human control.
- [~] **Applicant demo path:** curated demo cases are owned by the seeded applicant,
  but the reviewer-facing portal link remains the primary demo path.
- [~] **Test coverage:** 38 tests pass, including auth, rectification, and audit
  linkage checks. Error-path and UI-level tests remain.
- [~] **Documentation:** README, `docs/demo_script.md`, and `docs/limitations.md`
  have been reconciled, but a final pass against the UI is still worthwhile.

## Next priorities

### P0 — demo correctness

1. Final visual QA in light and dark themes at desktop and mobile widths.
2. Re-run the curated demo reset and verify the API + web journey end to end.
3. Add targeted tests for forbidden cross-applicant access and malformed
   rectification submissions.
4. Confirm the evaluation report is regenerated after pipeline changes.

### P1 — demo polish

5. Update `task.md` with a short "current status" pointer and archive stale detail.
6. Add a concise "known gaps" panel or speaker note for the demo.
7. Add an applicant-owned demo login path to the demo checklist.
8. Improve anomaly display on the evaluation page using the new `anomaly_metrics`.

### P2 — production only

Real AICTE/DigiLocker integrations, production IAM/SSO/MFA, encryption at rest,
retention automation, rate limiting, full CV/forensics, load testing, observability,
and legal review of rule content.

## Time estimate

- **Demo-ready:** ~4–8 focused hours (tests, auth, demo reset, docs, final QA).
- **All planned P0/P1 items:** ~2–3 focused days (16–24 hours).
- **Production-ready:** multi-week effort; not part of this prototype.
