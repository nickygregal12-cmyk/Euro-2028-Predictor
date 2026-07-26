# Current quality status

> This is the live implementation and operations status document. Current `main` code, migrations and executable tests override older roadmap, TODO, audit and chat narratives. Hosted claims require separate hosted evidence.

## Evidence identity

| Field | Current value |
| --- | --- |
| Repository | `nickygregal12-cmyk/Euro-2028-Predictor` |
| Repository application/database contract | 36 |
| Repository migration count | 36 |
| Latest repository reconciliation | [`2026-07-26-contract-36-repository-reconciliation.md`](reconciliations/2026-07-26-contract-36-repository-reconciliation.md) |
| Latest final-target contract-35 reconciliation | [`2026-07-25-contract-35-production-promotion.md`](reconciliations/2026-07-25-contract-35-production-promotion.md) |
| Development Supabase | `iouzoutneyjpugbbtdem` — last verified at contract 35 |
| Final-target Supabase | `vkfnsqdyhvtwyqkisxhk` — last verified at contract 35 |
| Final-target Netlify declaration | last verified at contract 35 |

The environment historically named `production` is the intended final database/application environment. It is not supporting a live Euro 2028 tournament and there is no active competition traffic. It remains controlled because it preserves the intended final configuration and retained verification data.

## Executive verdicts

| Area | Verdict |
| --- | --- |
| Repository development | **Safe to continue controlled development at contract 36.** Migration 36 is merged and repository-authoritative. |
| Migration 36 implementation | **Implemented and repository-verified.** CI, Database parity and Browser E2E all passed on the final PR #76 head. |
| Development hosted database | **Last verified at contract 35.** Inspect read-only, dry-run and apply migration 36 before declaring alignment. |
| Final-target database/application | **Last verified as a compatible contract-35 pair.** It may be upgraded later after accepted development evidence. |
| Tournament launch readiness | **Not ready.** Official data, administration, monitoring ownership, accessibility review and dress rehearsal remain incomplete. |

## Contract-36 repository authority

PR #76 merged `supabase/migrations/20260725010000_authoritative_reference_integrity.sql` and updated the deployment contract to 36.

Migration 36 closes remaining authoritative reference gaps for:

- group-to-team assignments;
- match group, home-team, away-team and winner references;
- player-to-team references;
- result revision-to-match references;
- Golden Boot player selection;
- score-event match/team references relative to the entry tournament.

The migration is additive and fail-closed. It checks existing data before installing guards, uses private trigger functions with fixed search paths, and revokes browser-role execution of those functions.

Successful final-head workflow evidence for PR #76:

- CI run 366;
- Database parity run 112;
- Browser E2E run 103.

This proves repository/disposable implementation. It is not proof that either hosted database has migration 36 applied.

## Hosted environment position

| Context | Supabase project | Last verified DB contract | Current action |
| --- | --- | ---: | --- |
| local/disposable | local | 36 | Verified by Database parity |
| deploy-preview / branch / dev | development `iouzoutneyjpugbbtdem` | 35 | Inspect, dry-run, apply and verify 36 |
| final-target Netlify context (`production`) | final-target `vkfnsqdyhvtwyqkisxhk` | 35 | Leave unchanged until development evidence is accepted |

The accepted contract-35 final-target evidence remains valid:

- migration history exactly 1–35;
- both required client RPCs present;
- 63/63 verifier checks passed;
- rollback-only bracket, submission and result-lifecycle smoke passed;
- final-target application and database were compatible at contract 35;
- environment isolation was verified.

## Operational assurance

The provider-neutral observability and smoke foundation has progressed beyond the former PR #92 draft state. Sentry React SDK integration and production-smoke gating were subsequently merged, while final-target external reporting remains intentionally disabled.

This does not yet establish full operational monitoring. Alert ownership, retention/privacy decisions, final-target delivery and rehearsal remain separate controls.

## Repository and test position

Current repository evidence includes:

- guarded build/type-check, lint, Vitest and dependency audit;
- disposable Supabase rebuild and database-parity workflow through migration 36;
- authenticated Playwright coverage for predictions, submission, conflicts, locks, leagues and auth journeys;
- Match Centre lifecycle and navigation browser coverage;
- anonymous release/environment smoke tooling;
- Sentry client integration with reporting kept disabled in the final-target environment.

## Feature and safeguard status

Implemented repository/database foundations include:

- canonical predicted group ordering;
- RPC-only submission and server-derived positions;
- authoritative result lifecycle and immutable revisions;
- serialized scoring recomputation;
- predicted bracket replay and real winner propagation;
- atomic complete-bracket persistence;
- version-safe score clearing;
- exact function allowlists and closed future defaults;
- contract-36 authoritative reference guards.

Still partial or planned:

- hosted migration-36 rollout;
- administrator authorization and result-management UI;
- automatic valid-entry submission and reminders;
- actual R16 population and unresolved actual-tie workflow;
- other-player profile and richer H2H;
- post-lock prediction trends;
- KO Predictor, Last Man Standing and Predictor Cup;
- official tournament data replacement;
- full accessibility and tournament dress rehearsal.

## Current finding positions

### Implemented in repository; hosted rollout pending

- `DATA-003` — repository implementation and required workflows are complete. Close after reconciliation, with hosted rollout tracked separately.
- `DATA-006` — no concrete residual gap has yet been established beyond migration 36. Any continuing finding must name an exact uncovered table/column relationship.

### Still open or partial

- `DATA-005`, `REL-007`, `TEST-001` — final controlled browser mutation evidence remains incomplete.
- `FUNC-002`, `DATA-004`, `OPS-002` — automatic submission, actual-tie workflow and administrator model.
- `OPS-003` — reporting ownership, final-target delivery and periodic rehearsal.
- `OPS-008`, `AUTH-001` — legacy environment and Turnstile/CAPTCHA work.
- `A11Y-001`, `UX-001`, `UX-002`, `UX-003` — remaining experience/accessibility work.
- `TYPE-001`, `PERF-001`, `PERF-002`, `SEC-001`, `DATA-007` — typing, performance and abuse controls.

## Scoring status

`docs/scoring-rules.md`, TypeScript configuration, SQL scorer and tests remain the authority:

- group result: 3;
- exact group score: 5 total;
- five Jokers, doubling group-match points only;
- group positions: 2 each plus 5 complete-order bonus;
- knockout: 10 / 15 / 20 / 25 / 40, stacking;
- Golden Boot: 25;
- group-goals bands: 40 / 30 / 20.

Migration 36 does not change scoring.

## Immediate order of work

1. Complete issue #72 disposition and merge this documentation reconciliation.
2. Inspect development Supabase read-only.
3. Require a development dry run showing only migration 36.
4. Apply and verify migration 36 in development.
5. Verify deploy-preview release identity and application behaviour at contract 36.
6. Prepare, but do not automatically execute, the final-target contract-36 upgrade.
7. Continue with the administrator authorization/result-management workstream after contract alignment.

## Documentation authority

Use sources in this order:

1. current `main` code, migrations and executable tests;
2. verified current hosted evidence;
3. this file;
4. latest reconciliation and formal audit;
5. feature baseline and risk register;
6. historical audits;
7. roadmap/TODO for future intent only.

Do not claim either hosted database is at contract 36 until its migration history and behaviour are verified.
