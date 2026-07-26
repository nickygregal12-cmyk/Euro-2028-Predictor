# Hosted migration inventory and rollout status

This is the live source of truth for repository migration count, hosted semantic state and rollout status.

## Current status — 26 July 2026

| Environment | Repository/deployment contract | Hosted migration state | Status |
| --- | ---: | --- | --- |
| Repository `main` | 36 | 36 authoritative migration files through `20260725010000` | **Contract 36 is repository authority** |
| Development Supabase `iouzoutneyjpugbbtdem` | last verified deployment declaration: 35 | last verified at exactly migrations 1–35 | **Migration 36 pending hosted verification/application** |
| Final-target Supabase `vkfnsqdyhvtwyqkisxhk` | last verified Netlify declaration: 35 | last verified at exactly migrations 1–35 | **Migration 36 not yet approved or applied** |

The Netlify context called `production` and the Supabase project historically called production are the final-target environment. They do not currently support a live tournament and are not serving real competition operations. They must still remain isolated and controlled because they preserve the intended final schema, configuration and retained test entry.

PR #76 merged migration 36 and changed `config/deployment-contract.json` to contract 36. Therefore, migration 36 is no longer a draft or future repository migration. The two hosted databases remain at their last verified contract-35 evidence point until separately inspected and deliberately upgraded.

## Contract-36 migration

| # | Migration | Purpose | Repository | Development | Final target |
| ---: | --- | --- | --- | --- | --- |
| 36 | `20260725010000_authoritative_reference_integrity.sql` | Fail-closed tournament/reference scope enforcement for group-team assignments, match references, players, result revisions, Golden Boot selection and score-event references | Merged | Pending verification/application | Pending later approval |

Migration 36:

- refuses installation when incompatible existing data is present;
- validates same-tournament relationships without copying additional `tournament_id` columns into child tables;
- protects `group_teams`, `matches`, `players`, `match_result_revisions`, `tournaments` and `score_events`;
- uses private `predictor_internal` trigger functions with fixed empty search paths;
- revokes function execution from `public`, `anon` and `authenticated`;
- preserves existing legal correction/result workflows where references remain within the same tournament.

## Contract-35 hosted evidence retained

The last verified hosted baseline remains contract 35:

- development migration history was exactly 1–35;
- final-target migration history was exactly 1–35 through `20260724003000`;
- the final-target 63-check verifier passed;
- rollback-only bracket, submission and result-lifecycle smoke checks passed;
- no score, result, revision or rank-history data was invented;
- the deployed final-target application declared contract 35.

These facts remain valid historical evidence. They must not be rewritten as contract-36 hosted evidence until migration 36 is actually verified in the relevant environment.

## Required development upgrade sequence

1. Confirm repository CI and database-parity results for the merged migration-36 commit.
2. Inspect development migration history and relevant rows read-only.
3. Run a development dry run and require migration 36 to be the only pending migration.
4. Confirm migration preflight queries find no incompatible existing data.
5. Apply migration 36 to development only.
6. Verify the migration-history row, six trigger functions, six triggers, privileges and same-tournament behaviour.
7. Run database tests and application/browser regression evidence against development.
8. Update development deployment declarations to 36 only when the hosted database is confirmed at 36.
9. Record dated evidence.

## Required final-target upgrade sequence

The final-target environment may be upgraded after development evidence is accepted. Because it is not live, scheduling risk is low, but the operation must remain deliberate:

1. inspect final-target state read-only;
2. preserve a recoverable pre-change snapshot or equivalent accepted backup evidence;
3. require a dry run showing only migration 36;
4. confirm the fail-closed preflight will pass;
5. obtain explicit owner approval for the database write;
6. apply migration 36;
7. run post-migration verification and rollback-safe smoke checks;
8. update the final-target Netlify contract declaration from 35 to 36;
9. verify release identity, environment isolation and browser smoke;
10. record a dated final-target reconciliation.

Do not mark migration 36 applied before its SQL executes. Do not repair migration history unless a separately proven metadata defect exists.

## Related documents

- `docs/quality/current-status.md`
- `docs/quality/reconciliations/2026-07-26-contract-36-repository-reconciliation.md`
- `docs/quality/reconciliations/2026-07-25-contract-35-production-promotion.md`
- `docs/ops-hosted-migration-rollout.md`
- `config/deployment-contract.json`
