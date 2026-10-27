# Nexora — Decisions and Constraints

## Product decisions

- **Advisory, not autonomous.** The system may recommend, flag, and explain, but it
  never approves or rejects. Reviewer rationale is mandatory.
- **Demo-first scope.** The target is a convincing SIH prototype on synthetic data,
  not a production regulatory platform.
- **One clear review story.** The UI is organized around the reviewer journey:
  queue → case overview → evidence → findings → verification → decision → audit.
- **Honest simulation.** External issuers are clearly labelled as simulated. The
  demo does not imply real registry connectivity.
- **Synthetic institution profile.** New intake attaches to a seeded synthetic
  institution; the form explains this instead of showing fake editable identity
  fields.

## UI/UX decisions

- **Light editorial default.** Warm paper background, serif display headings, deep
  teal accent, generous spacing, and a subtle grid texture.
- **Dark theme is first-class.** A persistent light/dark toggle uses the
  `nexora-theme` storage key and an inline no-flash script.
- **Theme-aware legacy bridge.** Existing utility classes are mapped through CSS
  variables so older panels, badges, and status colours remain readable in both
  themes.
- **No opacity modifiers on custom tokens.** Classes such as `bg-surface-card/90`
  do not work with the current Tailwind token setup; use semantic tokens or solid
  utilities instead.
- **Full-width navigation.** The app nav spans the viewport with standard responsive
  padding rather than a centred max-width container.
- **Explainability over density.** The dashboard prioritizes four KPIs, a short
  workflow explanation, and a suggested demo path over a wall of metrics.

## Technical decisions

- **Deterministic rules first.** YAML rule packs and a generic interpreter are the
  source of validation logic.
- **Evidence provenance is mandatory.** Extracted fields keep document, page,
  bounding box, method, and confidence.
- **Fail closed.** Unknown or missing evidence routes to manual review or
  not-verified status.
- **Global audit chain.** Audit events are chained globally; verification checks
  both the recomputed hash and the `prev_hash` linkage.
- **SQLite is sufficient for the demo.** Production persistence, concurrency, and
  retention are future work.
- **Demo reset is a utility, not a migration.** Run it with the API stopped, then
  restart the API.

## Known constraints

- Only one draft EoA rule pack exists.
- External issuer responses are simulated.
- Applicant re-upload is UI-only at present.
- The evaluation report is not yet based on real per-case prediction scoring.
- Some older pages still use legacy utility classes that rely on theme bridge rules.
- No production authentication hardening, encryption at rest, or rate limiting.
