# Hosted migration inventory and rollout status

Repository migration truth and owner-verification requirements for hosted environments.

## Current repository status — 29 July 2026

| Environment | Contract | Evidence | Pending |
| --- | ---: | --- | --- |
| Repository `main` | 60 | **Verified:** 60 canonical files through `20260729110000_predictor_cup_lint_safe_qualification.sql`; deployment contract requires 60 | none for contract-60 repository baseline |
| PR #193 candidate | 62 | Open, draft and unmerged; adds `20260729122100_prediction_consensus.sql` and `20260729122200_final_standings_tiebreaks.sql`; exact head repository gates are green | privacy decision `PRIV-001`, owner hosted checks and merge decision |
| Development Supabase `iouzoutneyjpugbbtdem` | unknown in this review | **REQUIRES OWNER VERIFICATION:** run migration-history/privilege SQL below and record verifier/date | establish actual contract |
| Netlify `dev`, `branch-deploy`, `deploy-preview` | unknown in this review | **REQUIRES OWNER VERIFICATION:** inspect environment variables and exact `/release.json`; record verifier/date | establish actual contract/project split |
| Production Supabase `vkfnsqdyhvtwyqkisxhk` | unknown in this review | **REQUIRES OWNER VERIFICATION:** run migration count/highest-version query and record verifier/date | establish actual contract |
| Netlify `production` | unknown in this review | **REQUIRES OWNER VERIFICATION:** inspect production `/release.json`, deploy identity and Supabase project; record verifier/date | establish actual application/database split |

The tag-readiness assessment deliberately describes the contract-60 repository baseline because PR #193 is unmerged. It does not assert hosted alignment.

## Canonical contracts 45–60 on `main`

| # | Canonical migration | Purpose |
| ---: | --- | --- |
| 45 | `20260727214500_paginated_private_league_standings.sql` | Private-league keyset pagination and owner-transfer search |
| 46 | `20260727221000_private_league_summary_activity.sql` | Lightweight latest-activity summaries |
| 47 | `20260728113000_other_player_profiles.sql` | Co-member-only bounded player profiles |
| 48 | `20260728122500_h2h_rank_history.sql` | Bounded H2H rank history and hardened checkpoint capture |
| 49 | `20260728150000_bonus_games_platform.sql` | Deny-all Bonus Games platform foundation |
| 50 | `20260728170000_bonus_games_hub.sql` | Voluntary registration/withdrawal and Games hub |
| 51 | `20260728190000_shared_knockout_prediction_store.sql` | Shared per-kickoff knockout prediction store |
| 52 | `20260728210000_ko_predictor_scoring.sql` | KO Predictor scoring and standings |
| 53 | `20260728230000_last_man_standing.sql` | Tournament-format Last Man Standing |
| 54 | `20260729010000_predictor_cup_foundation.sql` | Predictor Cup draw, groups, members and fixtures |
| 55 | `20260729030000_predictor_cup_group_scoring.sql` | Regulation-time Cup group scoring and tables |
| 56 | `20260729050000_predictor_cup_knockouts.sql` | Cup qualification, knockouts, Penalty Numbers and honours |
| 57 | `20260729070000_account_entry_controls.sql` | Private Account reminder preference and pre-lock Original entry clear |
| 58 | `20260729090000_clear_predictions_race_safety.sql` | Retire cleared entry identity so delayed autosaves cannot resurrect picks |
| 59 | `20260729100000_predictor_cup_lint_safe_progression.sql` | Lint-resolvable playoff/byes-to-bracket progression |
| 60 | `20260729110000_predictor_cup_lint_safe_qualification.sql` | Lint-resolvable Cup qualification/seeding |

The 60 canonical timestamps are unique. Do not renumber or reapply them.

## Unmerged contracts 61–62

| # | Candidate migration | Plain-English change | Baseline status |
| ---: | --- | --- | --- |
| 61 | `20260729122100_prediction_consensus.sql` | Adds an authenticated post-lock aggregate read over submitted Original entries. It is read-only, bounded and separate from Bonus Games, but has no minimum cohort threshold; one submitted entry can produce output. | PR #193 only; excluded from contract-60 baseline |
| 62 | `20260729122200_final_standings_tiebreaks.sql` | Automatically switches overall/private standings from live points/shared ranks to the five final tie-breakers after every tournament result is confirmed/corrected. It does not change score awards, entries, predictions or lock rules. | PR #193 only; excluded from contract-60 baseline |

Both candidate timestamps are strictly greater than `20260729110000` and do not collide with each other.

## Owner verification commands

### Hosted migration history

Run against development and production separately, recording project, verifier and date:

```sql
select count(*)::integer as migration_count,
       max(version) as highest_version
from supabase_migrations.schema_migrations;

select version, name
from supabase_migrations.schema_migrations
order by version;
```

For development contract 62 validation, also run:

```sql
select
  has_function_privilege('authenticated', 'public.get_prediction_consensus(uuid)', 'execute') as authenticated_consensus,
  has_function_privilege('anon', 'public.get_prediction_consensus(uuid)', 'execute') as anonymous_consensus,
  has_function_privilege('authenticated', 'predictor_internal.standing_metrics(uuid)', 'execute') as browser_internal_metrics;
```

### Application release identity

```bash
curl -fsS https://deploy-preview-193--euro28predictor.netlify.app/release.json
curl -fsS https://euro28predictor.com/release.json
```

Record exact commit, context, application contract, expected database contract and Supabase project. Do not infer production state from the deploy preview.

## Timestamp control finding

The current canonical chain contains no duplicate timestamps. Repository review did not find a CI check that rejects a pull request merely because a new migration timestamp is less than or equal to the highest timestamp on `main`. The existing rebuild catches duplicate-version/application failures, but it is not a monotonic timestamp guard. This remains an open control gap recorded in the readiness report and risk register.

## Future rollout authority

Future production promotions must follow [`../AGENTS.md`](../AGENTS.md): exact target/current contract, recovery evidence when stored data is at risk, dry-run/preflight, explicit owner approval, hosted verification and exact release smoke.

## Related authority

- [`quality/current-status.md`](quality/current-status.md)
- [`roadmap.md`](roadmap.md)
- [`ops-production-backup-restore.md`](ops-production-backup-restore.md)
- [`../config/deployment-contract.json`](../config/deployment-contract.json)