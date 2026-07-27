# Current quality status

> Live implementation and operations status. Current `main` code, migrations, executable tests and verified hosted evidence override older roadmap, TODO, audit and chat narratives.

## Evidence identity

| Field | Current value |
| --- | --- |
| Repository | `nickygregal12-cmyk/Euro-2028-Predictor` |
| Current `main` | `fa215d2ece6137f52934840c00189b36082d3136` |
| Repository contract / migration count | 38 / 38 |
| Hosted-development reconciliation | [`2026-07-27-admin-migration-version-reconciliation.md`](reconciliations/2026-07-27-admin-migration-version-reconciliation.md) |
| Final-target promotion | [`2026-07-27-contract-36-final-target-promotion.md`](reconciliations/2026-07-27-contract-36-final-target-promotion.md) |
| Development Supabase | `iouzoutneyjpugbbtdem` — verified contract 38 with the canonical 38-version history |
| Non-production Netlify contexts | `dev`, `branch-deploy`, `deploy-preview` — declared contract 38 |
| Final-target Supabase | `vkfnsqdyhvtwyqkisxhk` — verified contract 36; migrations 37–38 pending |
| Final-target Netlify declaration | contract 36 |
| Production recovery | Manual `Production backup` workflow is merged; the first-run reconciliation record is still incomplete |
| Sentry production delivery | enabled and privacy-safe trace delivery verified |

The environment historically named production is the intended final target. It is not supporting a live Euro 2028 tournament, but its configuration and retained verification data remain controlled.

## Executive verdicts

| Area | Verdict |
| --- | --- |
| Repository development | **Safe to continue at contract 38.** The canonical 38-migration chain is merged. |
| Development database | **Verified at contract 38.** Browser-safe admin wrappers and revision history are present under the exact repository versions. |
| Final-target database | **Intentionally retained at contract 36.** Exactly migrations 37–38 are pending. |
| Netlify declarations | **Non-production contexts declare 38; production remains 36 pending controlled promotion.** |
| Administrator foundation | **Merged.** Protected routes, capability checks, read-only control room and authorised result RPC wrappers are present. |
| Administrator result UI | **Partial.** Result mutation forms, confirmation review and browser E2E acceptance still remain. |
| Recovery gate | **Workflow implemented; record incomplete.** Do not claim the July exception closed until the dated first-run record is finalized from retained evidence. |
| Tournament launch readiness | **Not ready.** Administrator UI acceptance, result consumption, scalability hot paths, background operations, official data, accessibility and rehearsal remain incomplete. |

## Contract evidence

Current `main`, development Supabase and non-production Netlify are aligned at contract 38. The final-target database and production declaration remain at contract 36, with exactly the canonical administrator migrations `20260727075922` and `20260727080159` pending. The existing authoritative result lifecycle remains the implementation underneath those wrappers; scoring values and result rules are unchanged.

## Hosted environment position

| Context | Supabase | Declared contract | Position |
| --- | --- | ---: | --- |
| local/disposable | local | 38 | Full rebuild, lint, pgTAP and parity authority |
| Netlify `dev` | development `iouzoutneyjpugbbtdem` | 38 | Aligned |
| Netlify `branch-deploy` | development `iouzoutneyjpugbbtdem` | 38 | Aligned |
| Netlify `deploy-preview` | development `iouzoutneyjpugbbtdem` | 38 | Aligned |
| Netlify `production` | final target `vkfnsqdyhvtwyqkisxhk` | 36 | Intentionally retained pending 36→38 promotion |

The legacy `euro28-predictor-dev.netlify.app` site was not used or changed and should remain separately controlled or be decommissioned.

## Recovery exception

The fresh logical backup and disposable restore rehearsal described by the promotion preparation were not completed before final-target contract-36 promotion. The owner explicitly accepted that exception.

The manual backup workflow now exists. Its dated first-run record is still incomplete and therefore remains the documentary closure gate. Do not fill its placeholders without the retained run and custody evidence. Closure must record:

- a fresh logical backup from the current final target;
- encrypted custody and named ownership;
- a disposable restore rehearsal;
- verification of migration history, representative retained data and application contract after restore.

## Operational assurance

Provider-neutral capture, release identity, the official Sentry React SDK and read-only smoke tooling are implemented. Production uses a build-scoped public DSN with `VITE_SENTRY_ENABLED=true`; privacy-safe trace delivery was manually verified.

Open operational controls include Sentry retention and escalation ownership, rollback rehearsal, and future job/queue health alerting when background processing is introduced.

Supabase advisor observations remain separate controlled work:

- `public.enforce_joker_rules` has a mutable search path;
- authenticated security-definer functions require continued allowlist review;
- leaked-password protection is disabled;
- several foreign keys lack supporting indexes;
- unused-index notices require representative-load evidence before action.

## Feature and safeguard status

Implemented on current `main`:

- protected `/admin`, `/admin/results` and `/admin/users` routes;
- fail-closed `app_metadata` capability parsing;
- `super_admin` and scoped result capability support;
- read-only result status and awaiting-result queue;
- browser-authorised confirm, correct, clear and revision-history RPCs;
- immutable authoritative result lifecycle delegated to existing internal functions;
- contract 38 repository, development and preview alignment.

Still partial or planned:

- administrator result mutation forms and confirmation review;
- browser E2E for confirm, correct, clear and unauthorised rejection;
- authoritative frontend knockout winner/method/extra-time/penalty consumption;
- automatic submission and reminders;
- bounded global leaderboard and current-user standing endpoints;
- maintained standings and reconciliation;
- asynchronous incremental scoring and background jobs;
- batched prediction saves and action-level rate limiting;
- reference-data caching and explicit multi-tournament isolation;
- live results/standings refresh;
- product analytics and lifecycle email;
- stronger authentication and league-invite abuse controls;
- official tournament data, GDPR self-service, full accessibility and tournament rehearsal.

## Acquisition audit reconciliation

The 27 July 2026 acquisition audit is an historical snapshot against contract 36. It is retained at [`docs/audits/2026-07-27-acquisition-technical-audit.md`](../audits/2026-07-27-acquisition-technical-audit.md).

Its accepted forward direction is documented in:

- [`docs/architecture/acquisition-target-architecture.md`](../architecture/acquisition-target-architecture.md)
- [`docs/roadmap/acquisition-readiness-roadmap.md`](../roadmap/acquisition-readiness-roadmap.md)
- [`docs/quality/acquisition-risk-register.md`](acquisition-risk-register.md)
- ADRs 0003–0009 under `docs/adr/`

Audit-derived critical and high items are launch gates unless implemented, verified and marked mitigated, or explicitly accepted by the owner with a dated residual-risk record.

## Scoring status

No scoring values changed. Authority remains:

- group result 3;
- exact score 5 total;
- five Jokers, group-match points only;
- positions 2 each plus 5 full-order bonus;
- knockout 10 / 15 / 20 / 25 / 40, stacking;
- Golden Boot 25;
- group goals 40 / 30 / 20.

Automatic valid-entry submission and asynchronous incremental scoring remain approved target behaviours but are not implemented by these administrator migrations.

## Immediate order

1. Finalize the dated first-run backup record from retained evidence; never invent it.
2. Execute the controlled production 36→38 promotion only under [`docs/ops-production-promotion-contract-38.md`](../ops-production-promotion-contract-38.md).
3. Complete and accept the administrator result mutation UI and browser E2E.
4. Repair authoritative knockout-result consumption in Match Centre and H2H.
5. Establish background jobs and auto-submit before the lock workflow is considered complete.
6. Implement maintained standings, bounded leaderboard reads and asynchronous incremental scoring.
7. Run representative large-seed, lock-window and full-tournament rehearsals.
8. Complete authentication, accessibility, privacy and repository launch-assurance gates.

## Documentation authority

Use current code/tests, verified hosted evidence, this file, latest reconciliation, the acquisition risk register, then target architecture and historical audits. Roadmaps and ADRs prove accepted intent and rationale, not implementation.
