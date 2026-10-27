# Nexora — Project Context

## What this is

Nexora is a human-in-the-loop decision-support workspace for technical-education
application scrutiny. It turns a submitted document bundle into an evidence-backed
review case: intake, extraction, deterministic rule checks, cross-document checks,
simulated registry verification, advisory findings, alerts, reviewer rationale,
audit trail, and exportable dossier.

The current build is a **demo prototype** using synthetic institutions, documents,
and simulated external issuers. It is not connected to AICTE production systems and
does not make automatic approval or rejection decisions.

## Product principles

1. **Decision support only** — findings and recommendations are advisory; a human
   reviewer records the final rationale.
2. **Evidence first** — every extracted fact and finding should point back to a
   document, page, and source location.
3. **Fail closed on uncertainty** — missing or unverifiable evidence becomes
   `manual_review_required` or `not_verified`, never a guessed pass.
4. **Simulated integrations are labelled** — external issuer responses carry a
   visible `SIMULATED` badge.
5. **Synthetic data only** — demo documents are watermarked and contain no real
   personal or institutional data.
6. **Explainable rules** — validation runs through a versioned YAML rule pack with
   citations, not hidden hardcoded branches.

## Current architecture

- **API:** FastAPI + SQLAlchemy + SQLite
- **Pipeline:** PyMuPDF / RapidOCR extraction, generic rule interpreter, findings,
  alerts, verification records, audit logging, forensics signals
- **Web:** Next.js 14 App Router + TypeScript + Tailwind CSS
- **Demo data:** curated synthetic bundles + `apps/api/db/demo_reset.py`

## Repository map

| Path | Purpose |
|---|---|
| `apps/api/` | FastAPI application, models, routers, pipeline, services, tests |
| `apps/web/` | Next.js reviewer console, applicant portal, marketing landing page |
| `rules/packs/` | Versioned YAML rule packs |
| `data/synthetic/` | Generated synthetic bundles and ground truth |
| `eval/` | Evaluation harness and latest report |
| `docs/` | Architecture, assumptions, demo script, limitations, sources |
| `plan/` | Current context, roadmap, decisions, and demo checklist |
| `task.md` | Historical implementation checklist; see `plan/roadmap.md` for current status |

## Run locally

```powershell
# API
.\.venv\Scripts\python.exe -m uvicorn apps.api.main:app --port 8000

# Web
cd apps\web
npm run dev
```

- Web: <http://localhost:3000>
- API docs: <http://localhost:8000/api/docs>
- Demo login: `reviewer@aicte-demo.in` / `DemoPass123!`

## Reset demo data

Stop the API first so SQLite does not hold a write lock:

```powershell
.\.venv\Scripts\python.exe apps\api\db\demo_reset.py
```

Then restart the API.

## Planning documents

| Document | Use it for |
|---|---|
| [`roadmap.md`](./roadmap.md) | Current completion status and what is already working. |
| [`sih-delivery-plan.md`](./sih-delivery-plan.md) | Ordered plan from SIH demo freeze through website submission. |
| [`demo-checklist.md`](./demo-checklist.md) | Pre-demo runbook, reset steps, and recovery notes. |
| [`decisions.md`](./decisions.md) | Product, UI, and technical decisions already made. |
