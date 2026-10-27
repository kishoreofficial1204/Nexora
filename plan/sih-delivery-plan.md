# Nexora — SIH Delivery Plan

Last updated: 2026-10-27

This is the ordered execution plan for turning the current prototype into a
convincing SIH demo and then a complete SIH website submission. It complements,
rather than replaces, the status snapshot in [`roadmap.md`](./roadmap.md).

**Scope rule:** no new platform architecture, real government integrations, or
automatic approval/rejection work before the demo and submission are frozen.

## Current baseline

| Area | State |
|---|---|
| Reviewer journey | Intake → extraction → rules → findings → verification → alerts → review → audit → export works end to end. |
| Applicant journey | Authenticated applicant view, owned cases, persisted clarification, replacement upload, and reviewer resolution work. |
| Evidence viewer | Authenticated page images and original-PDF opening now work; page render failures show a readable error instead of a broken image. |
| Demo intake | New application screens pre-attach a generated, watermarked synthetic PDF packet; presenters can remove or replace files. |
| Evaluation | Pipeline-based extraction, detection, and anomaly metrics over a small synthetic benchmark. |
| Quality gates | Backend tests pass; TypeScript check and production build pass. |
| Deployment | Local-only API. Frontend deployment config exists, but no public backend is deployed. |
| Honest completion | Demo journey ~94%; planned P0/P1 ~86%; production readiness ~10–15%. |

## Phase 0 — Freeze the demo candidate (now)

Do this before adding more features so the story stops moving underneath the
presenter.

- [ ] Confirm `main` is clean and the demo commit is recorded.
- [ ] Reset the demo database, restart the API, and build/start the web app.
- [ ] Run the full demo twice in light mode and once in dark mode.
- [ ] Capture the exact known-good commit hash in the demo notes.
- [ ] Freeze demo-only copy; no “Prototype”, statement-ID, or placeholder labels
      in the reviewer-facing flow.

**Exit criteria:** two consecutive clean run-throughs with the same commit and
seed data, no browser console errors, and no broken assets or images.

## Phase 1 — Demo blockers (P0)

| ID | Type | Item | Why it matters | Acceptance criteria |
|---|---|---|---|---|
| DEMO-P0-01 | Bug | Guard the Next.js dev/build asset conflict | Running `next build` while `next dev` is active served 404s for `/_next/static/*` and left pages on “Loading…”. | Demo runbook always uses `npm run start` after a build. A pre-demo check confirms all page assets return `200`. |
| DEMO-P0-02 | Bug | Authenticated PDF/page viewer | Protected page images cannot be loaded by a bare `<img src>`, which produced a broken image. | Workbench page images load with the bearer token; original PDF opens in a new tab; failures show a readable message. **Done in the current build.** |
| DEMO-P0-03 | Feature | Default demo PDF packet | Presenters should not have to find files on disk during a live walkthrough. | New Application pre-attaches ten generated, watermarked synthetic PDFs and clearly marks them as demo samples. **Done in the current build.** |
| DEMO-P0-04 | QA | Applicant clarification walkthrough | The applicant re-upload path is persisted but easy to miss if the seeded notice is absent. | Demo reset seeds one open clarification; applicant can submit a replacement; reviewer sees the response and audit event. |
| DEMO-P0-05 | QA | Cross-role authorization spot checks | A demo reviewer must not be able to read another applicant’s evidence, and an applicant must not access reviewer-only routes. | API returns `403` for cross-applicant document/export access; reviewer-only routes reject applicants. Add one negative test if missing. |
| DEMO-P0-06 | Docs | Reconcile stale wording | “Public Applicant View” and old “simulated upload” language undermine trust. | README, demo script, limitations, and checklist all describe the authenticated, persisted flow. |
| DEMO-P0-07 | Ops | Demo reset is repeatable | Tests and experiments pollute the queue; reset requires the API to be stopped. | Reset completes with API stopped; API restarts cleanly; expected 7 cases and one open clarification are present. |
| DEMO-P0-08 | Demo | Offline fallback | Venue Wi-Fi or local services can fail. | Local API, local web server, seeded DB, generated PDFs, and screenshots are available without internet. |

## Phase 2 — Demo polish (P1)

| ID | Type | Improvement | Acceptance criteria |
|---|---|---|---|
| DEMO-P1-01 | UX | Put applicant responses in the reviewer’s line of sight | Case overview shows “Applicant response received — re-run validation” with a link to the response and audit trail. |
| DEMO-P1-02 | UX | Make re-validation explicit after rectification | Reviewer action re-runs validation on the replacement and records a new audit event; no automatic approval or rejection. |
| DEMO-P1-03 | UX | Loading, empty, and error states | Every data-driven page has a bounded loading state, an empty state, and an API-error state; no infinite spinner. |
| DEMO-P1-04 | UX | Evaluation anomaly visibility | Evaluation page shows anomaly precision/recall or explicitly labels the anomaly table as not yet available; no hidden metrics. |
| DEMO-P1-05 | QA | Light/dark and viewport pass | All reviewer and applicant screens are readable at 1280 px and 1440 px in both themes; contrast issues are fixed. |
| DEMO-P1-06 | QA | Keyboard and focus pass | Modals trap/restore focus; tab order follows the visual order; icon-only buttons have accessible labels. |
| DEMO-P1-07 | Content | Tighten the demo narrative | 5–7 minute story: problem → intake → extraction → contradictory evidence → human decision → applicant loop → audit/export → impact. |
| DEMO-P1-08 | Evidence | Screenshot and recording set | Store final screenshots for landing, queue, workbench, findings, applicant portal, and export in the submission asset folder. |
| DEMO-P1-09 | Docs | Explain known limitations confidently | Presenter can answer: synthetic data, draft rules, simulated issuer adapters, manual re-validation, no production IAM. |
| DEMO-P1-10 | Ops | Pre-demo health script | One command checks API health, web routes, demo login, asset `200`s, case count, and the seeded clarification. |

**Demo exit criteria:** the full story runs in under 8 minutes, every claim maps to
a visible screen or audit event, and the presenter has a tested fallback.

## Phase 3 — SIH website submission readiness (P0)

The submission is not only a working app. It needs a coherent public package that
a judge can inspect without a live presenter.

### 3.1 Public prototype and deployment

| ID | Type | Item | Acceptance criteria |
|---|---|---|---|
| SUB-P0-01 | Deployment | Choose the public demo shape | Either a hosted API + web frontend, or a clearly labelled video/repository-first submission if hosting is not available. Prefer a hosted demo. |
| SUB-P0-02 | Deployment | Host the API | API runs on a managed host with a persistent disk for SQLite, or with PostgreSQL; `/api/health` is public and stable. |
| SUB-P0-03 | Config | Replace localhost CORS | Allowed origins come from environment configuration; localhost remains allowed only in development. |
| SUB-P0-04 | Security | Remove development JWT default | Hosted deployment sets a strong `JWT_SECRET_KEY`; the service fails closed if production config is unsafe. |
| SUB-P0-05 | Data | Bootstrap demo data explicitly | Hosted demo data is seeded once through a deliberate command/endpoint; startup never drops production data. |
| SUB-P0-06 | Frontend | Point the web app at the hosted API | `NEXT_PUBLIC_API_URL` is set at build time; login, uploads, exports, and page images work from the public URL. |
| SUB-P0-07 | Ops | Basic hosting guardrails | Demo credentials are documented; synthetic-data banner remains; no secrets or local paths are exposed; request size limits are sane. |
| SUB-P0-08 | Fallback | Local fallback remains runnable | The repository’s local setup still works if hosting fails during judging. |

**Important:** SQLite on an ephemeral filesystem loses data on restart. Either mount
a persistent volume or use PostgreSQL; do not assume a free host will retain the
demo database.

### 3.2 Submission assets

| Asset | Required content | Acceptance criteria |
|---|---|---|
| Final presentation | Problem, users, current pain, solution, architecture, demo evidence, impact, feasibility, risks, roadmap | 8–10 slides; every metric has a source or is labelled synthetic; no unsupported claims. |
| Demo video | 2–3 minute narrated walkthrough of the strongest path | Clear audio, readable text, captions if possible, no dead time, no broken page images. |
| Public prototype link | Hosted web app or clearly labelled walkthrough | Login works from a clean browser; credentials are supplied; demo data is present. |
| Repository link | Clean public repo with setup instructions | README, `.env.example`, architecture, run commands, test commands, limitations, and license status are clear. |
| Architecture diagram | Intake, storage, extraction, rules, verification, findings, review, audit, exports | Diagram matches the code; external issuers are labelled simulated. |
| Test and evaluation evidence | Test count, build status, evaluation report, audit-tamper test | Claims are reproducible with documented commands. |
| Known limitations | Synthetic data, draft rules, simulated adapters, no production IAM, manual re-validation | Limitations are visible, not buried. |
| Team and contact details | Names, roles, institution, contact | Consistent across PPT, portal, and repository. |

### 3.3 Repository and documentation polish

- [ ] Correct README wording for the authenticated applicant view.
- [ ] Add a “Run the demo in 5 minutes” section with exact commands and ports.
- [ ] Document production/deployment environment variables.
- [ ] Add architecture and data-flow diagrams.
- [ ] Add screenshots or a short GIF to the README.
- [ ] Confirm no generated secrets, local DB, logs, or private paths are tracked.
- [ ] Add a top-level `LICENSE` decision or explicitly state the repository’s usage terms.
- [ ] Verify `docs/` and `plan/` links resolve.
- [ ] Record the exact submission commit/tag.

**Submission exit criteria:** a judge can open the link, log in, understand the
problem and evidence trail, and reproduce the local setup from the README without
asking the team for missing context.

## Phase 4 — Final QA and submission freeze

1. Run backend tests, TypeScript check, production build, and evaluation.
2. Reset demo data; restart API and web; run the health script.
3. Test the public URL from a clean browser and a second network.
4. Review the video and PPT against the live UI; remove stale screenshots.
5. Freeze assets and tag the commit, for example `v0.1.0-sih`.
6. Keep an offline copy of the video, PPT, screenshots, DB seed, and repository.
7. Submit through the SIH portal and record the confirmation.

## Phase 5 — After submission (not demo scope)

Only start these after the submission is locked. They are production concerns, not
reasons to delay the demo.

- Real issuer integrations and signed webhook/callback handling.
- Production IAM, SSO, MFA, organisation scoping, and key rotation.
- PostgreSQL, migrations, backups, retention, and deletion workflows.
- Malware scanning, file-type hardening, and storage encryption.
- Human-review workload analytics, SLA tracking, and reviewer assignment.
- Larger, independently labelled evaluation set; confidence calibration.
- Accessibility audit and formal security review.

## Prioritized backlog

### Bugs

| Priority | Item | Status |
|---|---|---|
| P0 | Workbench PDF/page viewer uses unauthenticated image URLs | Fixed |
| P0 | New intake has no default evidence packet | Fixed |
| P0 | Demo assets can 404 after a dev/build collision | Mitigated by runbook |
| P0 | README calls the applicant view “public” | Open |
| P1 | Applicant response/re-validation prompt is not prominent in reviewer view | Open |
| P1 | Evaluation anomaly metrics not surfaced in UI | Open |
| P1 | Cross-applicant negative authorization test should be explicit | Open |
| P2 | No automated frontend E2E coverage | Open |

### Features

| Priority | Item | Phase |
|---|---|---|
| P0 | Generated default PDF packet for demo intake | Done |
| P0 | Authenticated original-PDF opening from workbench | Done |
| P0 | Public hosted prototype | Submission |
| P1 | Reviewer “response received” banner and re-validation action | Demo polish |
| P1 | Submission asset pack and one-command health check | Submission |
| P2 | Reviewer workload/SLA views | After submission |

### Improvements

| Priority | Item | Phase |
|---|---|---|
| P0 | Environment-driven CORS and production secret checks | Submission |
| P0 | Persistent hosted database | Submission |
| P1 | Error/empty/loading state audit | Demo polish |
| P1 | Accessibility and contrast pass | Demo polish |
| P2 | Broader evaluation and OCR quality reporting | After submission |

## Risks and mitigations

| Risk | Impact | Mitigation |
|---|---|---|
| Public API unavailable during judging | Demo link fails | Keep local fallback, video, and screenshots; test hosted URL before submission. |
| SQLite data lost on host restart | Empty queue / broken login | Persistent disk or PostgreSQL; explicit seed step. |
| Draft rules mistaken for official policy | Loss of credibility | Keep draft banners, source register, and limitations visible. |
| Synthetic data mistaken for real evidence | Ethical/credibility risk | Watermark PDFs, label simulated issuers, state synthetic-data boundary in PPT and README. |
| Presenter overruns time | Weak narrative | Rehearse a 5–7 minute path; keep optional screens out of the main flow. |
| Build/dev asset mismatch | Stuck loading screens | Build with dev server stopped; use production server for demo; run asset check. |
| Secrets or local data committed | Security/reputational risk | Review `.gitignore`, environment files, logs, and generated storage before push. |

## Suggested sequencing

| Window | Focus | Done when |
|---|---|---|
| Day 1 | Phase 0 + Phase 1 blockers | Clean run-through, viewer works, demo packet works, reset verified. |
| Day 2 | Phase 2 polish + submission assets | Story rehearsed, screenshots/video captured, PPT and README aligned. |
| Day 3 | Phase 3 deployment + Phase 4 freeze | Public link or fallback ready, all assets reviewed, submission commit tagged. |

Dates are relative; the point is to avoid starting deployment or new features
before the demo story and evidence are stable.
