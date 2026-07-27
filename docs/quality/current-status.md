# Current quality status

> Live implementation and operations status. Current `main` code, migrations, executable tests and verified hosted evidence override older roadmap, TODO, audit and chat narratives.

## Evidence identity

| Field | Current value |
| --- | --- |
| Repository | `nickygregal12-cmyk/Euro-2028-Predictor` |
| Current `main` | `7872f39a9c41e2357ed32bac985ff83e88be2f56` |
| Repository contract / migration count | 36 / 36 |
| Hosted-development reconciliation | [`2026-07-26-contract-36-development-promotion.md`](reconciliations/2026-07-26-contract-36-development-promotion.md) |
| Final-target preparation | [`2026-07-26-contract-36-final-target-preparation.md`](reconciliations/2026-07-26-contract-36-final-target-preparation.md) |
| Final-target promotion | [`2026-07-27-contract-36-final-target-promotion.md`](reconciliations/2026-07-27-contract-36-final-target-promotion.md) |
| Development Supabase | `iouzoutneyjpugbbtdem` — verified contract 36 |
| Non-production Netlify contexts | `dev`, `branch-deploy`, `deploy-preview` — contract 36 |
| Final-target Supabase | `vkfnsqdyhvtwyqkisxhk` — verified contract 36 |
| Final-target Netlify declaration | contract 36 |
| Current production deploy | A fresh contract-36 production build and exact-head smoke remain to be verified |
| Sentry production delivery | enabled and privacy-safe trace delivery verified |

The environment historically named production is the intended final target. It is not supporting a live Euro 2028 tournament, but its configuration and retained verification data remain controlled.

## Executive verdicts

| Area | Verdict |
| --- | --- |
| Repository development | **Safe to continue at contract 36.** |
| Development database | **Verified at contract 36.** Exact history, guards, privileges and rollback-only behaviour checks passed. |
| Final-target database | **Promoted and verified at contract 36.** Migration 36, reference guards, privileges and canonical history were verified. |
| Netlify declarations | **All contexts declare contract 36.** Production still requires a fresh build and exact-head verification. |
| Deploy-preview gate | **Restored and merged.** Exact-head 36/36 preview, HTTP smoke and anonymous browser smoke passed on PR #105. |
| Disposable authenticated browser | **Passed.** Browser E2E run 274 completed disposable rebuild, authenticated journeys, signup/recovery and clean teardown. |
| Standard CI | **Passed at the last recorded evidence point.** New branches must supply their own current checks. |
| Recovery gate | **Exception open.** Contract 36 was promoted without completing the fresh logical backup, encrypted custody check and disposable restore rehearsal first. |
| Production observability | **Delivery verified; operating policy partial.** Sentry delivery is enabled through the approved privacy boundary; retention, backup recipient, escalation and rollback rehearsal remain. |
| Tournament launch readiness | **Not ready.** Administration acceptance, result consumption, scalability hot paths, background operations, official data, accessibility and rehearsal remain incomplete. |

## Contract-36 evidence

Development and final-target databases contain exactly 36 canonical migration versions through `20260725010000_authoritative_reference_integrity`. The migration SQL identity was reconciled to the repository version. Six private security-definer functions have fixed empty search paths and no browser-role execution; six intended validation triggers are installed and enabled; authoritative-reference integrity checks remained clean.

The connected migration action initially recorded a generated execution timestamp. Migration metadata was reconciled to the repository canonical version only after schema objects and migration identity were verified.

## Hosted environment position

| Context | Supabase | Declared contract | Position |
| --- | --- | ---: | --- |
| local/disposable | local | 36 | Full rebuild, lint, pgTAP and parity authority |
| Netlify `dev` | development `iouzoutneyjpugbbtdem` | 36 | Aligned |
| Netlify `branch-deploy` | development `iouzoutneyjpugbbtdem` | 36 | Aligned |
| Netlify `deploy-preview` | development `iouzoutneyjpugbbtdem` | 36 | Aligned; exact-head smoke evidence exists for the contract-36 promotion path |
| Netlify `production` | final target `vkfnsqdyhvtwyqkisxhk` | 36 | Contract declaration aligned; fresh production build and exact-head smoke still required |

The legacy `euro28-predictor-dev.netlify.app` site was not used or changed and should remain separately controlled or be decommissioned.

## Recovery exception

The fresh logical backup and disposable restore rehearsal described by the promotion preparation were not completed before final-target contract-36 promotion. The owner explicitly accepted that exception.

This exception remains open until evidence records:

- a fresh logical backup from the current final target;
- encrypted custody and named ownership;
- a disposable restore rehearsal;
- verification of migration history, representative retained data and application contract after restore.

## Operational assurance

Provider-neutral capture, release identity, the official Sentry React SDK and read-only smoke tooling are implemented. Production uses a build-scoped public DSN with `VITE_SENTRY_ENABLED=true`; privacy-safe trace delivery was manually verified. Replay, logs, profiling, automatic user context, breadcrumbs, fetch/XHR tracing, trace propagation and source-map upload remain disabled.

Open observability controls:

- actual Sentry retention setting;
- confirmation of server-side/IP scrubbing settings;
- named backup alert recipient and escalation path;
- retained push-triggered smoke evidence where accessible;
- owner-approved Netlify rollback promotion rehearsal;
- job/queue health and delayed-scoring alert policy when background processing is introduced.

Supabase advisor observations remain separate controlled work:

- `public.enforce_joker_rules` has a mutable search path;
- authenticated security-definer functions require continued allowlist review;
- leaked-password protection is disabled;
- several foreign keys lack supporting indexes;
- unused-index notices require representative-load evidence before action.

## Feature and safeguard status

Implemented repository/development foundations include canonical predicted group ordering, manual tie decisions, RPC-only submission, authoritative results/revisions, serialized scoring, bracket replay/persistence, version-safe clearing, exact function allowlists, contract-36 reference guards, preview assurance and privacy-safe Sentry production delivery.

Still partial or planned:

- accepted browser administrator result operations on current `main`;
- authoritative frontend knockout winner/method/extra-time/penalty consumption;
- actual R16 population and actual-tie workflow;
- automatic submission and reminders;
- bounded global leaderboard and current-user standing endpoints;
- maintained standings and reconciliation;
- asynchronous incremental scoring and background jobs;
- batched prediction saves and action-level rate limiting;
- reference-data caching and explicit multi-tournament isolation;
- live results/standings refresh;
- product analytics and lifecycle email;
- stronger authentication and league-invite abuse controls;
- other-player profile and richer H2H;
- post-lock trends and bonus games;
- official tournament data;
- monitoring policy completion, GDPR self-service, full accessibility and tournament rehearsal.

## Acquisition audit reconciliation

The 27 July 2026 acquisition audit is an historical snapshot against contract 36. It is retained at [`docs/audits/2026-07-27-acquisition-technical-audit.md`](../audits/2026-07-27-acquisition-technical-audit.md).

Its accepted forward direction is documented in:

- [`docs/architecture/acquisition-target-architecture.md`](../architecture/acquisition-target-architecture.md)
- [`docs/roadmap/acquisition-readiness-roadmap.md`](../roadmap/acquisition-readiness-roadmap.md)
- [`docs/quality/acquisition-risk-register.md`](acquisition-risk-register.md)
- ADRs 0003–0009 under `docs/adr/`

Audit-derived critical and high items are launch gates unless implemented, verified and marked mitigated, or explicitly accepted by the owner with a dated residual-risk record.

## Current finding positions

- `DATA-003` — repository, development and final-target contract-36 implementation verified.
- `DATA-006` — no concrete residual relationship defect established.
- `OPS-006` — contract mismatch closed; deferred backup/restore evidence remains a separate recovery exception.
- `TEST-001` — hosted development migration and preview smoke closed; accepted result-admin, penalty-winner UI, scalable scoring and screen-reader evidence remain.
- `DATA-005`, `REL-007` — backend implementation exists; accepted browser mutation evidence remains.
- `FUNC-002`, `DATA-004`, `OPS-002` — automatic submission, actual ties and accepted administrator operations remain open.
- `OPS-003` — Sentry production delivery verified; retention, backup alert ownership, escalation and rollback rehearsal remain.
- `AUTH-001`, `AUTH-002`, `OPS-008`, `A11Y-001`, typing, performance and abuse findings remain open or partial.
- Acquisition risks `ACQ-R01` through `ACQ-R27` are tracked in the acquisition risk register.

## Scoring status

No scoring values changed. Authority remains:

- group result 3;
- exact score 5 total;
- five Jokers, group-match points only;
- positions 2 each plus 5 full-order bonus;
- knockout 10 / 15 / 20 / 25 / 40, stacking;
- Golden Boot 25;
- group goals 40 / 30 / 20.

Automatic valid-entry submission is approved target behaviour but not implemented. Asynchronous incremental scoring is an accepted architectural direction but is not implemented on `main`; the current authoritative scoring path remains unchanged until migrations and tests prove otherwise.

## Immediate order

1. Publish and verify a fresh production build from current `main` at contract 36.
2. Complete and record the deferred backup, custody and disposable restore rehearsal.
3. Complete and accept the protected administrator result workflow on a current-main branch.
4. Repair authoritative knockout-result consumption in Match Centre and H2H.
5. Establish background jobs and auto-submit before the lock workflow is considered complete.
6. Implement the critical scalability sequence: maintained standings, bounded leaderboard reads and asynchronous incremental scoring.
7. Run representative large-seed, lock-window and full-tournament rehearsals.
8. Complete authentication, accessibility, privacy and repository launch-assurance gates.

## Documentation authority

Use current code/tests, verified hosted evidence, this file, latest reconciliation, the acquisition risk register, then target architecture and historical audits. Roadmaps and ADRs prove accepted intent and rationale, not implementation.
