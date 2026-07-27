# Current quality status

> Live implementation and operations status. Current `main` code, migrations, executable tests and verified hosted evidence override older roadmap, TODO, audit and chat narratives.

## Evidence identity

| Field | Current value |
| --- | --- |
| Repository | `nickygregal12-cmyk/Euro-2028-Predictor` |
| Current `main` | `ea0d0113087cd377379d01b5e09f82706fba6dd3` |
| Repository contract / migration count | 36 / 36 |
| Hosted-development reconciliation | [`2026-07-26-contract-36-development-promotion.md`](reconciliations/2026-07-26-contract-36-development-promotion.md) |
| Final-target preparation | [`2026-07-26-contract-36-final-target-preparation.md`](reconciliations/2026-07-26-contract-36-final-target-preparation.md) |
| Development Supabase | `iouzoutneyjpugbbtdem` — verified contract 36 |
| Non-production Netlify contexts | `dev`, `branch-deploy`, `deploy-preview` — contract 36 |
| Final-target Supabase | `vkfnsqdyhvtwyqkisxhk` — verified current contract 35; migration 36 sole pending repository migration |
| Final-target Netlify declaration | contract 35 |
| Current production deploy | `6a6612da3628de000862baea` — ready, source `16ac10d42ff1e9b547303c3e85b8a29ceaa70056` |
| Retained final-target promotion evidence | [`2026-07-25-contract-35-production-promotion.md`](reconciliations/2026-07-25-contract-35-production-promotion.md) |
| Sentry production delivery | enabled and privacy-safe trace delivery verified |

The environment historically named production is the intended final target. It is not supporting a live Euro 2028 tournament, but its configuration and retained verification data remain controlled.

## Executive verdicts

| Area | Verdict |
| --- | --- |
| Repository development | **Safe to continue at contract 36.** |
| Development database | **Verified at contract 36.** Exact history, guards, privileges and rollback-only behaviour checks passed. |
| Deploy-preview gate | **Restored and merged.** Exact-head 36/36 preview, HTTP smoke and anonymous browser smoke passed on PR #105. |
| Disposable authenticated browser | **Passed.** Browser E2E run 274 completed disposable rebuild, authenticated journeys, signup/recovery and clean teardown. |
| Standard CI | **Passed.** CI run 585 completed build, lint, Vitest and dependency audit. |
| Final-target preparation | **Read-only preparation complete; write not authorized.** History is exactly 1–35, all six migration-36 preflight counts are zero and execution/failure steps are prepared. |
| Final-target database/application | **Retained compatible 35/35 pair.** No final-target SQL, contract or deploy-pointer change has occurred. |
| Recovery gate | **Fresh source bundle required.** The accepted 25 July artifact predates current retained-data changes and cannot be treated as the migration-window backup. |
| Production observability | **Delivery verified; operating policy partial.** Sentry delivery is enabled through the approved privacy boundary; retention, backup recipient, escalation and rollback rehearsal remain. |
| Tournament launch readiness | **Not ready.** Administration, result consumption, official data, operations ownership, accessibility and rehearsal remain incomplete. |

## Development contract-36 evidence

Development contains exactly 36 canonical migration versions through `20260725010000_authoritative_reference_integrity`. The migration SQL hash matches the repository file. Six private security-definer functions have empty search paths and no browser-role execution, six intended triggers are enabled, legal same-tournament writes passed and all six cross-tournament relationship classes were rejected in rollback-only verification.

The connected migration action could not accept the canonical timestamp and was blocked before SQL execution. Exact SQL application and canonical history recording were therefore performed separately and verified. This was not described as a Supabase CLI dry run.

## Hosted environment position

| Context | Supabase | Verified contract | Position |
| --- | --- | ---: | --- |
| local/disposable | local | 36 | Full rebuild, lint, pgTAP and parity authority |
| Netlify `dev` | development `iouzoutneyjpugbbtdem` | 36 | Aligned |
| Netlify `branch-deploy` | development `iouzoutneyjpugbbtdem` | 36 | Aligned |
| Netlify `deploy-preview` | development `iouzoutneyjpugbbtdem` | 36 | Aligned and exact-head smoke verified |
| Netlify `production` | final target `vkfnsqdyhvtwyqkisxhk` | 35 | Intentionally retained pending fresh backup and explicit approval |

Merging PR #105 did not move production. Netlify still serves the ready contract-35 production deploy from commit `16ac10d42ff1e9b547303c3e85b8a29ceaa70056`.

## Final-target contract-36 preparation

Read-only inspection established:

- exactly 35 canonical migration versions through `20260724003000_exact_function_execution_allowlist`;
- migration 36 is the sole repository migration not yet applied;
- none of the six migration-36 private functions or triggers is installed yet;
- all six fail-closed incompatibility counts are zero;
- production contract and deploy remain 35/35 and ready;
- no final-target write occurred.

Current retained-data counts include one submitted entry, 36 predictions, four Jokers, three tie-resolution rows, eight progression rows and 24 derived group-position rows. Result, revision, score-event and rank-history counts remain zero.

The previous promotion reconciliation recorded two tie-resolution rows. The final target now contains three, with a later update on 26 July. Fresh non-sensitive fingerprints and timestamps were captured in the preparation record. This drift makes a fresh backup/restore acceptance mandatory immediately before migration.

The technical preparation verdict is positive: migration 36 is the sole pending migration and the current data passes its preflight. The operation remains stopped at the explicit owner-approval gate.

## Preview and smoke position

Both smoke implementations require `EURO28_SMOKE_EXPECTED_CONTRACT`:

- previews require contract 36, exact PR head and development Supabase;
- production currently requires the retained contract-35 release and final-target Supabase.

Because contract-36 `main` cannot deploy to a contract-35 final-target database, production smoke verifies the existing compatible 35/35 release rather than waiting for an intentionally blocked exact `main` commit. Exact-head production verification must return during final-target promotion.

The legacy `euro28-predictor-dev.netlify.app` site was not used or changed.

## Operational assurance

Provider-neutral capture, release identity, the official Sentry React SDK and read-only smoke tooling are implemented. Production uses a build-scoped public DSN with `VITE_SENTRY_ENABLED=true`; production trace delivery was manually verified through the approved privacy boundary. Replay, logs, profiling, automatic user context, breadcrumbs, fetch/XHR tracing, trace propagation and source-map upload remain disabled.

Open observability controls:

- actual Sentry retention setting;
- confirmation of server-side/IP scrubbing settings;
- named backup alert recipient and escalation path;
- retained push-triggered smoke evidence where accessible;
- owner-approved Netlify rollback promotion rehearsal.

Supabase advisor observations remain separate work:

- `public.enforce_joker_rules` has a mutable search path;
- authenticated `SECURITY DEFINER` functions require continued allowlist review;
- leaked-password protection is disabled;
- several foreign keys lack supporting indexes;
- unused-index notices require representative-load evidence before action.

Do not bundle those unrelated findings into the migration-36 final-target window.

## Feature and safeguard status

Implemented repository/development foundations include canonical predicted group ordering, manual tie decisions, RPC-only submission, authoritative results/revisions, serialized scoring, bracket replay/persistence, version-safe clearing, exact function allowlists, contract-36 reference guards, exact-head preview assurance and privacy-safe Sentry production delivery.

Still partial/planned:

- final-target migration-36 promotion after fresh recovery evidence and approval;
- administrator authorization and browser result management;
- authoritative frontend knockout winner/method/extra-time/penalty consumption;
- actual R16 population and actual-tie workflow;
- automatic submission/reminders;
- other-player profile and richer H2H;
- post-lock trends and bonus games;
- official tournament data;
- monitoring policy completion, full accessibility and tournament rehearsal.

## Current finding positions

- `DATA-003` — repository and development hosted implementation verified; final-target rollout remains under `OPS-006`.
- `DATA-006` — no concrete residual relationship defect established.
- `OPS-006` — final-target 35 versus repository/development 36; read-only preparation passed, fresh backup and approval remain.
- `TEST-001` — hosted development migration and preview smoke closed; result admin, penalty-winner UI, final-target controlled mutation and screen-reader evidence remain.
- `DATA-005`, `REL-007` — backend implementation exists; final-target browser mutation evidence remains.
- `FUNC-002`, `DATA-004`, `OPS-002` — automatic submission, actual ties and administrator model remain open.
- `OPS-003` — Sentry production delivery verified; retention, backup alert ownership, escalation and rollback rehearsal remain.
- `AUTH-001`, `OPS-008`, `A11Y-001`, typing/performance/abuse findings remain open or partial.

## Scoring status

No scoring changed. Authority remains:

- group result 3;
- exact score 5 total;
- five Jokers, group-match points only;
- positions 2 each plus 5 full-order bonus;
- knockout 10 / 15 / 20 / 25 / 40, stacking;
- Golden Boot 25;
- group goals 40 / 30 / 20.

Automatic valid-entry submission is approved target behaviour but not implemented.

## Immediate order

1. Merge the final-target preparation record.
2. Create and accept a fresh final-target backup/restore record in a controlled quiet window.
3. Rerun history, six preflight checks, retained-data counts and fingerprints.
4. Require a CLI dry run listing exactly migration 36.
5. Obtain explicit owner approval before any final-target SQL or production Netlify change.
6. After approval, apply/verify migration 36, lift production to 36 and restore exact-head production smoke.
7. Correct/rebase draft admin PR #102 onto current preview/contract rules.
8. Repair authoritative knockout-result consumption in Match Centre and H2H.

## Documentation authority

Use current code/tests, verified hosted evidence, this file, latest reconciliation, feature baseline/risk register, then historical audits. Roadmap/TODO prove intent only.
