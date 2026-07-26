# Hosted migration inventory and rollout status

Live source of truth for repository migration count, hosted semantic state and rollout status.

## Current status — 26 July 2026

| Environment | Deployment contract | Hosted migration state | Status |
| --- | ---: | --- | --- |
| Repository `main` | 36 | 36 authoritative files through `20260725010000` | **Repository verified** |
| Development Supabase `iouzoutneyjpugbbtdem` | 36 for dev/branch/preview | exactly canonical versions 1–36 | **Development verified** |
| Final-target Supabase `vkfnsqdyhvtwyqkisxhk` | production declaration 35 | last verified exactly versions 1–35 | **Migration 36 not approved/applied** |

The Netlify context and Supabase project historically named production are the controlled final target, not an active tournament. They remain isolated and protected.

## Migration 36

| # | Migration | Purpose | Repository | Development | Final target |
| ---: | --- | --- | --- | --- | --- |
| 36 | `20260725010000_authoritative_reference_integrity.sql` | Fail-closed tournament/reference scope for group-team assignments, match references, players, result revisions, Golden Boot and score-event references | Merged/verified | Applied/verified | Pending explicit approval |

Migration 36:

- refuses installation over incompatible rows;
- validates same-tournament relationships without denormalised copied IDs;
- protects `group_teams`, `matches`, `players`, `match_result_revisions`, `tournaments` and `score_events`;
- uses private `predictor_internal` trigger functions with empty search paths;
- revokes execution from `public`, `anon` and `authenticated`;
- preserves legal same-tournament workflows.

## Development promotion evidence

Pre-change development history was exactly 1–35. All six preflight counts were zero.

Post-change:

- history count: 36;
- latest version/name: `20260725010000` / `authoritative_reference_integrity`;
- stored SQL MD5: `f6852376a28d3d60c06f9fb25424f9c1`, matching the repository file;
- six private functions verified as security-definer, fixed search path and browser-role execution revoked;
- six triggers verified present/enabled;
- rollback-only same-tournament writes succeeded;
- all six cross-tournament classes were rejected;
- zero temporary verification rows remained.

The connected migration action could not accept the repository timestamp and was blocked before SQL execution. The exact canonical SQL was applied transactionally through the database query channel, then the canonical history row was stored only after schema verification. This is not described as a Supabase CLI dry run.

Netlify non-production declarations were updated only after database verification:

- `dev`: 36;
- `branch-deploy`: 36;
- `deploy-preview`: 36;
- `production`: remains 35.

Exact-head PR #105 preview, HTTP smoke and anonymous browser smoke passed against development. Full evidence: `docs/quality/reconciliations/2026-07-26-contract-36-development-promotion.md`.

## Retained contract-35 final-target evidence

- migration history exactly 1–35 through `20260724003000`;
- 63-check verifier passed;
- rollback-only bracket, submission and result-lifecycle smoke passed;
- no score/result/revision/rank data was invented;
- deployed application and database declared contract 35;
- production Supabase/environment isolation verified.

These remain valid until a separately approved 36/36 final-target reconciliation replaces them.

## Required final-target sequence

1. Inspect final-target history and relevant rows read-only.
2. Preserve recoverable pre-change evidence.
3. Establish migration 36 as the only canonical pending migration.
4. Run the six fail-closed preflight checks.
5. Prepare exact application, verification and rollback-safe smoke commands.
6. Obtain explicit owner approval before SQL.
7. Apply migration 36.
8. Verify exact history, functions, triggers, privileges and rollback-only behaviour.
9. Update production Netlify declaration from 35 to 36.
10. Require exact-head deployment, release identity, environment isolation and HTTP/browser smoke.
11. Record dated final-target reconciliation.

Do not mark migration 36 applied before its SQL executes. Do not repair migration history without a separately proven metadata requirement. Do not modify the final target merely to unblock a build.

## Related documents

- `docs/quality/current-status.md`
- `docs/quality/reconciliations/2026-07-26-contract-36-development-promotion.md`
- `docs/quality/reconciliations/2026-07-26-contract-36-repository-reconciliation.md`
- `docs/quality/reconciliations/2026-07-25-contract-35-production-promotion.md`
- `docs/ops-hosted-migration-rollout.md`
- `config/deployment-contract.json`
