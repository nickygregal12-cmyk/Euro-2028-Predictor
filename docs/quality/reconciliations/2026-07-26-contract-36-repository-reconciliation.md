# Contract 36 repository reconciliation

**Date:** 26 July 2026  
**Scope:** Repository authority, migration-36 acceptance and hosted-environment boundary  
**Branch:** `agent/reconcile-contract-36`

## Trigger

PR #76 merged migration `20260725010000_authoritative_reference_integrity.sql` and changed the repository deployment contract from 35 to 36.

Several live authority documents still described migration 36 as draft, outside `main` and unapplied. Those statements became stale when PR #76 merged.

## Environment terminology

The Supabase project historically called `production` is the intended final-target database. It is not supporting a live Euro 2028 tournament. Euro 2028 remains approximately two years away.

Documentation now distinguishes:

- **repository contract** — current `main` migration/application contract;
- **development hosted environment** — development Supabase and non-production Netlify contexts;
- **final-target hosted environment** — the Supabase and Netlify context historically named `production`;
- **live tournament production** — not yet applicable.

This terminology correction does not remove safety controls. The final-target environment contains retained verification data and remains the intended final configuration.

## Verified repository facts

- PR #76 merged at commit `9dafad1bcb9635caab1b6552e2eed7c80679d2a4`.
- Its final head was `75b238d357a96a58e7224eef1fad06c9c3145658`.
- Migration 36 is present on `main` as `supabase/migrations/20260725010000_authoritative_reference_integrity.sql`.
- `config/deployment-contract.json` declares contract 36.
- Migration 36 adds authoritative tournament/reference integrity protections.
- Database test and deployment-contract guard coverage changed with the migration.

### Required workflow evidence

All required workflows completed successfully on the final PR #76 head:

| Workflow | Run | Result |
| --- | ---: | --- |
| CI | 366 | **Success** |
| Database parity | 112 | **Success** |
| Browser E2E | 103 | **Success** |

This confirms the application checks, disposable 36-migration rebuild/parity gate and browser regression suite passed before merge.

## Migration-36 acceptance audit

| Issue #72 requirement | Evidence | Classification |
| --- | --- | --- |
| Inspect migration chain and reference paths | Constraint inventory committed in PR #76 | **Complete** |
| Identify application-only or weak relationships | Inventory selected six remaining authoritative relationship groups | **Complete** |
| Preserve legal correction/admin paths | Guards validate tournament scope rather than freezing all updates | **Complete** |
| Additive and fail-closed migration | Pre-install checks raise on existing incompatible rows | **Complete** |
| Rebuild from migration 1 | Database parity workflow succeeded | **Complete** |
| Database lint and pgTAP | Database parity workflow succeeded | **Complete** |
| TypeScript/PostgreSQL parity | Database parity workflow succeeded | **Complete** |
| Application regression | CI succeeded | **Complete** |
| Browser regression | Browser E2E succeeded | **Complete** |
| Deployment contract update | Contract changed from 35 to 36 | **Complete** |
| Avoid scoring/rule changes | Migration is limited to reference integrity | **Complete** |
| Hosted development compatibility | PR #76 records zero invalid development preflight rows; hosted application remains to be executed/verified | **Implementation compatible; rollout pending** |

## Guard inventory

Migration 36 installs fail-closed protection for:

1. `group_teams.group_id` and `team_id` belonging to the same tournament;
2. `matches.group_id`, `home_team_id`, `away_team_id` and `winner_team_id` belonging to `matches.tournament_id`;
3. `players.team_id` belonging to `players.tournament_id`;
4. `match_result_revisions.match_id` belonging to `match_result_revisions.tournament_id`;
5. `tournaments.golden_boot_player_id` belonging to that tournament;
6. `score_events.match_id` and `team_id` belonging to the referenced entry tournament.

Each trigger function:

- lives in `predictor_internal`;
- is `SECURITY DEFINER` with `search_path = ''`;
- has execution revoked from `public`, `anon` and `authenticated`;
- raises explicit foreign-key or check-violation errors;
- permits valid same-tournament insert/update correction paths.

## DATA-003 and DATA-006 classification

`DATA-003` is implemented and verified at repository/disposable level. It should remain open only for the narrow hosted-development execution evidence, or be closed with hosted rollout tracked separately.

`DATA-006` must not continue as a generic duplicate of `DATA-003`. Any remaining fixture/source immutability concern must identify an exact table, column and unsupported mutation. No such residual defect has been established by this reconciliation.

## Hosted environment boundary

The last verified evidence for both hosted Supabase projects is contract 35. This reconciliation does not claim either hosted database is contract 36 and does not apply migration 36.

Required next evidence:

1. read-only migration-history and schema inspection for development Supabase;
2. migration-36 precondition checks against development data;
3. exact one-migration dry run;
4. controlled development upgrade and post-verification;
5. deploy-preview release identity and browser smoke at contract 36;
6. separate final-target upgrade decision and evidence.

Because the final-target environment is not live tournament production, this is controlled pre-launch engineering rather than emergency production change management. Backup, preflight, verification and rollback discipline still apply.

## Documentation reconciliation completed on this branch

- `README.md`;
- `docs/quality/current-status.md`;
- `docs/build-todo.md`;
- `docs/ops-pending-migrations.md`;
- `docs/quality/risk-register.md`;
- this dated reconciliation.

## Safety boundary

No hosted database, Netlify configuration, scoring rule, tournament rule, Auth setting or retained prediction data was changed during this documentation and evidence pass.
