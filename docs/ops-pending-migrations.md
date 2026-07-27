# Hosted migration inventory and rollout status

Live source of truth for repository migration count, hosted semantic state and rollout status.

## Current status — 26 July 2026

| Environment | Deployment contract | Hosted migration state | Status |
| --- | ---: | --- | --- |
| Repository `main` | 36 | 36 authoritative files through `20260725010000` | **Repository verified** |
| Development Supabase `iouzoutneyjpugbbtdem` | 36 for dev/branch/preview | exactly canonical versions 1–36 | **Development verified** |
| Final-target Supabase `vkfnsqdyhvtwyqkisxhk` | production declaration 35 | exactly canonical versions 1–35; migration 36 sole pending repository migration | **Read-only preflight passed; write not authorized** |

The Netlify context and Supabase project historically named production are the controlled final target, not an active tournament. They remain isolated and protected.

## Migration 36

| # | Migration | Purpose | Repository | Development | Final target |
| ---: | --- | --- | --- | --- | --- |
| 36 | `20260725010000_authoritative_reference_integrity.sql` | Fail-closed tournament/reference scope for group-team assignments, match references, players, result revisions, Golden Boot and score-event references | Merged/verified | Applied/verified | Sole pending migration; six preflight groups clean; fresh recovery evidence and approval required |

Migration 36:

- refuses installation over incompatible rows;
- validates same-tournament relationships without denormalised copied IDs;
- protects `group_teams`, `matches`, `players`, `match_result_revisions`, `tournaments` and `score_events`;
- uses private `predictor_internal` trigger functions with empty search paths;
- revokes execution from `public`, `anon` and `authenticated`;
- preserves legal same-tournament workflows.

## Development promotion evidence

Development was promoted from canonical history 1–35 to exactly 1–36 after all six preflight counts returned zero. Post-change verification proved the exact history/version/name/hash, six private functions, six enabled triggers, browser-role execution revocations, legal same-tournament writes, rejection of all six cross-tournament classes and zero temporary verification rows.

The connected migration action could not accept the repository timestamp and was blocked before SQL execution. The exact canonical SQL was applied transactionally through the database query channel, then the canonical history row was stored only after schema verification. This is not described as a Supabase CLI dry run.

Netlify non-production declarations were updated only after database verification:

- `dev`: 36;
- `branch-deploy`: 36;
- `deploy-preview`: 36;
- `production`: remains 35.

Exact-head PR #105 preview, HTTP smoke, anonymous browser smoke and disposable authenticated Browser E2E passed. PR #105 merged without changing the production deploy pointer or contract.

## Final-target read-only preparation

Final-target inspection on 26 July established:

- history count: 35;
- first version: `20260719120000`;
- latest version/name: `20260724003000` / `exact_function_execution_allowlist`;
- migration-36 private functions installed: 0;
- migration-36 triggers installed: 0;
- migration 36 is the sole canonical repository migration not yet applied;
- all six migration-36 incompatibility counts: 0;
- production Netlify contract: 35;
- production Supabase ref: `vkfnsqdyhvtwyqkisxhk`;
- current production deploy: `6a6612da3628de000862baea`, ready;
- no final-target write or Netlify mutation occurred.

Retained-data snapshot:

- one Auth user/profile and one submitted entry;
- 36 predictions and four Jokers;
- three tie-resolution rows;
- eight progression rows;
- 24 derived group-position rows;
- zero score events, result revisions and rank-history rows.

Current non-sensitive fingerprints:

- match predictions: `0f8dd7807a87b2dced1678e026fcb7f5`;
- tie resolutions: `d7315c50d02bf833e72bf2e57cf02e19`;
- progression: `2d5df35a81a3c2a48f926517d1b001e0`;
- group positions: `721fcb70165b1dd52892960fe22acb5b`.

The 25 July recovery artifact predates a third tie-resolution row and later retained-data updates. It remains accepted historical recovery proof but is not the fresh source bundle required for the migration-36 write window.

Full preparation: `docs/quality/reconciliations/2026-07-26-contract-36-final-target-preparation.md`.

## Retained contract-35 final-target evidence

The final target remains a compatible 35/35 pair:

- migration history exactly 1–35;
- 63-check verifier passed during contract-35 promotion;
- rollback-only bracket, submission and result-lifecycle smoke passed;
- deployed application/database contract 35;
- production Supabase/environment isolation verified.

Current data counts/fingerprints must be taken from the new preparation record, not assumed from the older promotion snapshot.

## Required final-target sequence

Completed preparation:

1. inspect final-target history/data read-only;
2. establish migration 36 as the only canonical pending migration;
3. run the six fail-closed preflight checks;
4. capture current counts, timestamps and fingerprints;
5. inspect production deploy/contract/environment identity;
6. prepare exact application, verification and failure-handling steps.

Still required before SQL:

7. create and accept a fresh source backup/restore record after the quiet window begins;
8. rerun history, preflight, counts and fingerprints;
9. require `supabase db push --dry-run` to list exactly migration 36;
10. obtain explicit owner approval.

Only after approval:

11. apply migration 36;
12. verify exact history, functions, triggers, privileges, rollback-only behaviour and zero pending migrations;
13. update only the production Netlify declaration from 35 to 36;
14. restore exact-head production-smoke semantics at contract 36;
15. publish and verify the exact application/database pair;
16. record dated final-target promotion evidence.

Do not mark migration 36 applied before its SQL executes. Do not repair migration history without a separately proven metadata defect. Do not modify the final target merely to unblock a build.

## Related documents

- `docs/quality/current-status.md`
- `docs/quality/reconciliations/2026-07-26-contract-36-final-target-preparation.md`
- `docs/quality/reconciliations/2026-07-26-contract-36-development-promotion.md`
- `docs/quality/reconciliations/2026-07-25-contract-35-production-promotion.md`
- `docs/ops-production-backup-restore.md`
- `docs/ops-hosted-migration-rollout.md`
- `config/deployment-contract.json`
