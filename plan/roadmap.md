# VeriScope — Roadmap and Current Status

Last reviewed: 2026-10-27

## Completion snapshot

These estimates are for the **prototype scope**, not a production rollout.

| View of the project | Estimate | Notes |
|---|---:|---|
| End-to-end demo journey | **~85%** | Intake → extraction → rules → findings → verification → alerts → review → audit → export works with synthetic data. Applicant re-upload is UI-simulated. |
| Planned P0/P1 checklist | **~70%** | Core backend and UI are substantially built; evaluation harness, rectification backend, auth hardening, and test expansion remain. |
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
- [x] Light/dark theme system, editorial landing/login, responsive nav, dashboard,
      application overview, alert centre, rules explorer, evaluation page, and
      governance page.
- [x] Curated demo reset script.

## What is partial

- [~] **Rectification flow:** reviewer clarification and applicant re-upload are
  represented in the UI, but the applicant submit action is simulated and does not
  persist a `RectificationRequest` or re-run validation.
- [~] **Auth hardening:** core case routes and verification/alerts require roles,
  but dossier exports, applicant-view, rules, and evaluation routes still need a
  consistent auth policy.
- [~] **Evaluation harness:** reports exist and the UI runs, but metrics are still
  baseline/hardcoded rather than computed from per-case predictions.
- [~] **Tests:** 30/32 pre-existing tests passed before the auth fixture fix. New
  verification, alert, rectification, and auth tests are still needed.
- [~] **Documentation:** README and `docs/` contain some stale claims, old paths,
  and dates that should be reconciled before submission.

## Next priorities

### P0 — demo correctness

1. Re-run the test suite after the verification-auth fixture fix.
2. Add auth headers/policies to remaining sensitive routes and their tests.
3. Replace hardcoded evaluation metrics with actual pipeline predictions.
4. Add a persisted rectification request + applicant re-upload path, then re-run
   validation.
5. Reset the curated demo database after tests.

### P1 — demo polish

6. Update README, `docs/demo_script.md`, `docs/limitations.md`, and `task.md` so
   they match the current UI and honest prototype status.
7. Final visual QA in light and dark themes at desktop and mobile widths.
8. Add a short "known gaps" note to the demo script so limitations are stated
   confidently rather than avoided.

### P2 — production only

Real AICTE/DigiLocker integrations, production IAM/SSO/MFA, encryption at rest,
retention automation, rate limiting, full CV/forensics, load testing, observability,
and legal review of rule content.

## Time estimate

- **Demo-ready:** ~4–8 focused hours (tests, auth, demo reset, docs, final QA).
- **All planned P0/P1 items:** ~2–3 focused days (16–24 hours).
- **Production-ready:** multi-week effort; not part of this prototype.
