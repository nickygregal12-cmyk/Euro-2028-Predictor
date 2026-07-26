# Current quality status

> Live implementation and operations status. Current `main` code, migrations, executable tests and verified hosted evidence override older roadmap, TODO, audit and chat narratives.

## Evidence identity

| Field | Current value |
| --- | --- |
| Repository | `nickygregal12-cmyk/Euro-2028-Predictor` |
| Repository contract / migration count | 36 / 36 |
| Latest hosted-development reconciliation | [`2026-07-26-contract-36-development-promotion.md`](reconciliations/2026-07-26-contract-36-development-promotion.md) |
| Development Supabase | `iouzoutneyjpugbbtdem` — verified contract 36 |
| Non-production Netlify contexts | `dev`, `branch-deploy`, `deploy-preview` — contract 36 |
| Current exact-head preview | PR #105 on `euro28predictor` — 36/36, HTTP/browser smoke passed |
| Final-target Supabase | `vkfnsqdyhvtwyqkisxhk` — last verified contract 35 |
| Final-target Netlify declaration | contract 35 |
| Retained final-target evidence | [`2026-07-25-contract-35-production-promotion.md`](reconciliations/2026-07-25-contract-35-production-promotion.md) |
| Sentry production delivery | enabled and privacy-safe trace delivery verified |

The environment historically named production is the intended final target. It is not supporting a live Euro 2028 tournament, but its configuration and retained verification data remain controlled.

## Executive verdicts

| Area | Verdict |
| --- | --- |
| Repository development | **Safe to continue at contract 36.** |
| Development database | **Verified at contract 36.** Exact history, guards, privileges and rollback-only behaviour checks passed. |
| Deploy-preview gate | **Restored.** Exact-head 36/36 preview, HTTP smoke and anonymous browser smoke passed on the current Netlify project. |
| Disposable authenticated browser | **Passed.** Browser E2E run 273 completed both authenticated and preview-smoke jobs on the final PR #105 head. |
| Standard CI | **Passed.** CI run 584 completed build, lint, Vitest and dependency audit on the final PR #105 head. |
| Final-target database/application | **Retained compatible contract-35 pair.** No final-target change was made. |
| Production observability | **Delivery verified; operating policy partial.** Sentry error/trace delivery is enabled through the approved privacy boundary; retention, backup recipient, alert escalation and rollback rehearsal remain. |
| Tournament launch readiness | **Not ready.** Administration, result consumption, official data, operations ownership, accessibility and rehearsal remain incomplete. |

## Development contract-36 evidence

Before migration, development history contained exactly versions 1–35. The six migration-36 preflight checks returned zero incompatible rows.

After applying the canonical repository SQL:

- migration history contains exactly 36 versions;
- latest version is `20260725010000` named `authoritative_reference_integrity`;
- stored migration SQL MD5 is `f6852376a28d3d60c06f9fb25424f9c1`, matching the repository file;
- all six `predictor_internal` functions are `SECURITY DEFINER` with empty search paths;
- execution is revoked from `public`, `anon` and `authenticated`;
- all six triggers are attached and enabled;
- rollback-only tests proved valid same-tournament writes and rejected all six cross-tournament relationship classes;
- no temporary verification row remained.

The connected migration action could not accept the canonical timestamp and was blocked before SQL execution. Exact SQL application and canonical history recording were therefore performed separately and verified. This was not described as a Supabase CLI dry run.

## Hosted environment position

| Context | Supabase | Verified contract | Position |
| --- | --- | ---: | --- |
| local/disposable | local | 36 | Full rebuild, lint, pgTAP and parity authority |
| Netlify `dev` | development `iouzoutneyjpugbbtdem` | 36 | Aligned |
| Netlify `branch-deploy` | development `iouzoutneyjpugbbtdem` | 36 | Aligned |
| Netlify `deploy-preview` | development `iouzoutneyjpugbbtdem` | 36 | Aligned and exact-head smoke verified |
| Netlify `production` | final target `vkfnsqdyhvtwyqkisxhk` | 35 | Intentionally retained pending separate approval |

The accepted contract-35 final-target evidence remains valid: exactly migrations 1–35, required client RPCs, 63/63 verifier, rollback-only bracket/submission/result smoke and environment isolation.

## Preview and smoke position

PR #105 uses:

- `https://deploy-preview-105--euro28predictor.netlify.app`;
- exact PR head identity;
- application contract 36;
- hosted contract 36;
- development Supabase `iouzoutneyjpugbbtdem`;
- security-header, SPA-route, asset and Supabase-isolation HTTP checks;
- anonymous login/signup/reset, signed-out gate and not-found browser checks.

Both smoke implementations require an explicit `EURO28_SMOKE_EXPECTED_CONTRACT`. Preview workflows pass 36; production smoke passes 35 while the final target is intentionally retained.

Because contract-36 `main` cannot deploy to a contract-35 final-target database, the current production smoke verifies the existing compatible 35/35 release rather than waiting for an intentionally blocked exact `main` commit. Exact-head production verification must return during final-target promotion.

The legacy `euro28-predictor-dev.netlify.app` site was not used or changed.

## Operational assurance

Provider-neutral capture, release identity, the official Sentry React SDK and read-only smoke tooling are implemented. Production uses a build-scoped public DSN with `VITE_SENTRY_ENABLED=true`; production trace delivery was manually verified through the approved privacy boundary. Replay, logs, profiling, automatic user context, breadcrumbs, fetch/XHR tracing, trace propagation and source-map upload remain disabled.

Open observability controls are:

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

Migration-36 private functions were not exposed to browser roles.

## Feature and safeguard status

Implemented repository/development foundations include:

- canonical predicted group ordering and manual tie decisions;
- RPC-only submission and server-derived positions;
- authoritative result lifecycle and immutable revisions;
- serialized scoring;
- predicted bracket replay and real winner propagation;
- atomic bracket persistence and version-safe score clearing;
- exact function allowlists;
- contract-36 authoritative reference guards;
- exact-head development preview assurance;
- privacy-safe Sentry production delivery.

Still partial/planned:

- final-target migration-36 promotion;
- administrator authorization and browser result management;
- authoritative frontend knockout winner/method/extra-time/penalty consumption;
- actual R16 population and actual-tie workflow;
- automatic submission/reminders;
- other-player profile and richer H2H;
- post-lock trends and bonus games;
- official tournament data;
- monitoring policy completion, full accessibility and tournament rehearsal.

## Current finding positions

- `DATA-003` — repository and development hosted implementation verified; final-target promotion remains under `OPS-006` rather than an integrity-implementation defect.
- `DATA-006` — no concrete residual relationship defect established.
- `OPS-006` — narrowed to final-target contract 35 versus repository/development 36. The guard is correctly fail-closed.
- `TEST-001` — hosted development migration and preview-smoke gaps are closed; result admin, penalty-winner UI, final-target controlled mutation and screen-reader evidence remain.
- `DATA-005`, `REL-007` — backend implementation exists; final-target browser mutation evidence remains.
- `FUNC-002`, `DATA-004`, `OPS-002` — automatic submission, actual ties and administrator model remain open.
- `OPS-003` — Sentry production delivery is verified; retention, backup alert ownership, escalation and rollback rehearsal remain.
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

1. Merge PR #105 development promotion and preview evidence.
2. Prepare final-target migration 36 read-only; do not write without explicit owner approval.
3. Correct/rebase draft admin PR #102 onto current preview/contract rules.
4. Continue server-authorized administrator/result-management work.
5. Repair authoritative knockout-result consumption in Match Centre and H2H.
6. Implement real R16/actual tie decisions, then automatic submission.
7. Complete Auth/CAPTCHA, branch protection, monitoring policy, accessibility and rehearsal.

## Documentation authority

Use current code/tests, verified hosted evidence, this file, latest reconciliation, feature baseline/risk register, then historical audits. Roadmap/TODO prove intent only.
