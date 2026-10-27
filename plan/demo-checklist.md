# VeriScope — Demo Checklist

## Before the demo

1. Stop any stray API processes and start one clean instance.
2. Reset curated data with the API stopped:

   ```powershell
   .\.venv\Scripts\python.exe apps\api\db\demo_reset.py
   ```

3. Restart the API on port 8000 and the web app on port 3000.
4. Open `/login` and verify both light and dark themes.
5. Log in as `reviewer@aicte-demo.in` / `DemoPass123!`.
6. Confirm the queue shows the curated cases and the alert badge is populated.
7. Open the clean case and confirm zero findings and a healthy verification record.

## Suggested 5–7 minute path

1. **Landing page** — one-sentence problem and the evidence-first promise.
2. **Dashboard** — four KPIs, workflow, priority alerts, and suggested demo path.
3. **Clean case** — show extracted evidence, rule results, and the “next best action”
   panel.
4. **Deficient case** — show an expired certificate or intake mismatch with dual
   evidence and an advisory finding.
5. **Verification** — run a simulated issuer check and show the persisted result and
   audit event.
6. **Alert centre** — acknowledge/resolve an alert with a note.
7. **Decision** — record a recommendation with rationale.
8. **Audit/Governance** — verify the hash chain and state the human-in-the-loop and
   simulated-integration boundaries.
9. **Applicant view** — show redaction of internal heuristic signals.

## Things to say explicitly

- All institutions, documents, and registry responses are synthetic/simulated.
- Findings are advisory; no automatic approval or rejection.
- The demo does not connect to real AICTE, DigiLocker, or issuer databases.
- Applicant re-upload is simulated in the current prototype.
- Evaluation metrics are being upgraded from the baseline harness to real
  per-case predictions.

## Recovery steps

- If the queue looks polluted after tests, rerun `demo_reset.py`.
- If the UI looks unstyled or stale, restart the Next dev server after removing
  `apps/web/.next`.
- If the API returns old schemas, restart the single uvicorn instance on port 8000.
