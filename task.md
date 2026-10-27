# VeriScope — Implementation Checklist

> **Status note (2026-10-27):** This is the original phase checklist. Several items
> have since been implemented or partially implemented. Use
> [`plan/roadmap.md`](plan/roadmap.md) for the current status and next priorities.

> **Scope decision (2026-10-27):** this is an **SIH prototype submission**, not a
> production regulatory platform. The goal is a convincing, working,
> evidence-backed prototype on synthetic data. We will not spend time on
> production-scale concerns (multi-region deployment, real AICTE integration,
> exhaustive category packs, full CV training, formal security certification).
> Those remain documented as future work below.
>
> Legend: `[x]` done · `[~]` partial/demo · `[ ]` not implemented · `[!]` blocked
> Priority: **P0 = prototype must-have**, **P1 = prototype differentiator**,
> **P2 = future/production only**

## Prototype Definition of Done

- [x] Clean synthetic bundle produces zero false compliance failures.
- [x] Missing document, expired certificate, intake mismatch, duplicate, and
      suspicious-PDF bundles produce evidence-linked findings.
- [x] Every YAML rule in the EoA pack is actually executed by a generic interpreter.
- [x] Missing extracted fields never become fabricated values.
- [x] Institutional-record checks work against a seeded synthetic record.
- [ ] An issuer verification is persisted with source, timestamp, status, and audit.
- [ ] Reviewer can request rectification; applicant can re-upload; validation re-runs.
- [~] Alerts are generated from validation findings; acknowledgement/resolution APIs are pending.
- [ ] Sensitive endpoints reject unauthenticated/unauthorized access.
- [ ] Audit chain detects hash tampering **and** broken `prev_hash` linkage.
- [ ] Evaluation metrics are computed from actual pipeline runs.
- [~] 32 existing tests pass; new verification/alert/rectification/auth tests are pending.

## Phase 0 — Environment and baseline

- [x] Restore Python environment (SQLAlchemy, bcrypt, imagehash, pytest installed)
- [x] Run existing tests after seeding: **32 passed**
- [x] Add root `task.md` with prototype and future scope
- [ ] Add a root `requirements.txt` that mirrors the API requirements
- [ ] Record baseline limitations in `docs/limitations.md`

## Phase 1 — Real configurable rule engine (P0)

- [x] Add category → rule-pack resolver (`get_rule_pack_for_application`)
- [x] Add all 10 original rules plus institutional-record and anomaly rules to YAML
- [x] Create generic operator-based interpreter (`pipeline/rule_engine.py`)
- [x] Replace hardcoded checks in `pipeline/validator.py` with the interpreter
- [x] Persist `ValidationRun` and `RuleExecution` records for explainability
- [x] Execute every rule and record pass/fail/manual-review/not-applicable
- [~] Evaluate conditional checklist predicates (current pack has no active predicate)
- [ ] Add automated tests proving every rule is executed

## Phase 2 — Extraction integrity and completeness (P0)

- [x] Remove fabricated fallback values from `pipeline/extractor.py`
- [x] Extract only fields actually present in the document
- [x] Improve generic extraction for names, PIDs, dates, intake, certificate numbers
- [x] Generate `missing_field` / `manual_review_required` findings for required fields
- [ ] Add tests for blank, partial, and malformed documents
- [x] Ensure low-confidence OCR routes to manual review (verified on bundle H)

## Phase 3 — Institutional records and consistency (P0)

- [x] Add `InstitutionRecord` model
- [x] Seed a synthetic institutional record (PID, name, intake, programmes,
      previous EoA, compliance status, TER status, application history)
- [x] Execute record-based rules through the generic interpreter
- [ ] Add tests for match, mismatch, and missing-record cases

## Phase 4 — Persisted issuer verification (P0)

- [x] Add `VerificationRecord` model with the required statuses
- [x] Extend the mock issuer connector with an `expired` simulation mode
- [ ] Build verification service: query → compare → persist → audit → finding
- [ ] Add `POST /api/applications/{id}/verify` and verification-history endpoints
- [ ] Authenticate verification endpoints
- [ ] Add tests for verified, mismatch, expired, timeout, and manual-review results
- [ ] (P1) QR decode with official-domain allowlist
- [ ] (P1) Optional pyHanko signature status adapter

## Phase 5 — Auth, RBAC, and audit integrity (P0)

- [ ] Require auth on exports, applicant view, verification, rules, evaluation,
      institutions, and admin routes
- [ ] Add object-level authorization for applicants
- [ ] Fix audit chain to validate `prev_hash` linkage as well as block hashes
- [ ] Add tests for unauthenticated access, forbidden roles, and tampered chains
- [ ] (P2) Rate limiting, CSRF, encryption at rest, retention automation

## Phase 6 — Alerts and rectification (P0)

- [x] Add `Alert` model
- [x] Add `RectificationRequest` model
- [ ] Generate alerts from findings/verification results
- [ ] Add alert list/acknowledge/resolve endpoints
- [ ] Add reviewer request → applicant re-upload → re-validation flow
- [ ] Show rectification status in the applicant view
- [ ] Add tests for the full lifecycle

## Phase 7 — Anomaly/forensics signals (P1, prototype subset)

- [x] Add `DocumentAnalysis` model
- [x] Near-duplicate perceptual hash + text-similarity guard (verified on bundle F)
- [x] PDF metadata capture and incremental-revision signal (verified on bundle G)
- [x] QR allowlist check (best-effort; no QR in current synthetic bundles)
- [x] Digital-signature status (best-effort structural check)
- [x] Every signal includes evidence, reason, confidence, and
      `signal_only_not_proof`
- [ ] (P2) ELA, copy-move, EXIF geotag, floor-plan CV, video review

## Phase 8 — Evaluation harness (P0)

- [ ] Replace hardcoded `1.00` metrics with actual pipeline runs
- [ ] Compute extraction exact/normalized match rates
- [ ] Compute validation/anomaly precision, recall, F1 from ground truth
- [ ] Store per-case predictions and comparisons
- [ ] Keep sample sizes and honest notes in the report
- [ ] (P1) Verification success rate and average verification time
- [ ] (P2) Large-scale/load evaluation

## Phase 9 — Dashboard and frontend wiring (P1)

- [ ] Wire the dashboard to real validation/verification/alert data
- [ ] Replace the hardcoded verification tab with persisted records
- [ ] Add applicant rectification/re-upload UI
- [ ] Add reviewer alert center
- [ ] Remove fake metrics from the evaluation page
- [ ] (P2) Accessibility, responsive polish, offline support

## Phase 10 — Documentation and demo (P0)

- [ ] Replace unsupported README claims with honest prototype status
- [ ] Document simulated vs real issuer adapters
- [ ] Document rule-pack authoring and category selection
- [ ] Add a 5–7 minute demo script covering all prototype scenarios
- [ ] Document known limitations and production gaps
- [ ] Final end-to-end demo verification

## Future / production plan (P2 — documented, not built for SIH)

- [ ] Real authorized AICTE/DigiLocker/issuer API integrations
- [ ] Additional application categories and full APH rule packs
- [ ] Rule authoring/approval/versioning workflow
- [ ] Production IAM, SSO, MFA, audit retention, encryption at rest
- [ ] PII masking, data-retention automation, DLP, CSRF/rate limiting
- [ ] Full CV pipeline for infrastructure photos, floor plans, and videos
- [ ] Human-in-the-loop state machine with dual control for adverse decisions
- [ ] Load/performance testing, observability, backup/DR
- [ ] Legal review of APH rule content and source licensing

## Known current limitations

- [~] Only one draft EoA rule pack exists.
- [~] External issuer responses are simulated and clearly badged.
- [~] Frontend has several demo/hardcoded paths.
- [~] Existing tests are happy-path/synthetic and need expansion.
- [~] No production authentication hardening or data-retention automation.
