# Hosted migration inventory and rollout status

Live source of truth for repository migration count, hosted state and pending rollout scope.

## Current status — 29 July 2026

| Environment | Contract | Hosted migration state | Pending |
| --- | ---: | --- | --- |
| Repository | 60 | 60 canonical files through `20260729110000_predictor_cup_lint_safe_qualification.sql` | none |
| Development Supabase `iouzoutneyjpugbbtdem` | 60 | exactly 60 canonical versions; history, grants and posture verified | none |
| Netlify `dev`, `branch-deploy`, `deploy-preview` | 60 | development Supabase; exact preview HTTP and Chromium smoke passed | none |
| Production Supabase `vkfnsqdyhvtwyqkisxhk` | 60 | exactly 60 canonical versions; backup, dry-runs, preserved-data, privilege and hosted-lint checks passed | none |
| Netlify `production` | 60 | production Supabase; current application publishes from the contract-60 release-alignment merge | exact release smoke before closure |

Production database and repository are aligned at contract 60. Any later migration requires a new approved milestone gate; ordinary application development must not mutate production.

## Contracts 45–60

| # | Canonical migration | Purpose | Development | Production |
| ---: | --- | --- | --- | --- |
| 45 | `20260727214500_paginated_private_league_standings.sql` | Private-league keyset pagination and owner transfer search | verified | verified |
| 46 | `20260727221000_private_league_summary_activity.sql` | Lightweight latest-activity summaries | verified | verified |
| 47 | `20260728113000_other_player_profiles.sql` | Co-member-only bounded player profiles | verified | verified |
| 48 | `20260728122500_h2h_rank_history.sql` | Bounded H2H rank history and hardened checkpoint capture | verified | verified |
| 49 | `20260728150000_bonus_games_platform.sql` | Deny-all Bonus Games platform foundation | verified | verified |
| 50 | `20260728170000_bonus_games_hub.sql` | Voluntary registration/withdrawal and Games hub | verified | verified |
| 51 | `20260728190000_shared_knockout_prediction_store.sql` | Shared per-kickoff knockout prediction store | verified | verified |
| 52 | `20260728210000_ko_predictor_scoring.sql` | KO Predictor scoring and standings | verified | verified |
| 53 | `20260728230000_last_man_standing.sql` | Tournament-format Last Man Standing | verified | verified |
| 54 | `20260729010000_predictor_cup_foundation.sql` | Predictor Cup draw, groups, members and fixtures | verified | verified |
| 55 | `20260729030000_predictor_cup_group_scoring.sql` | Regulation-time Cup group scoring and tables | verified | verified |
| 56 | `20260729050000_predictor_cup_knockouts.sql` | Cup qualification, knockouts, Penalty Numbers and honours | verified | verified |
| 57 | `20260729070000_account_entry_controls.sql` | Private Account reminder preference and pre-lock Original entry clear | verified | verified |
| 58 | `20260729090000_clear_predictions_race_safety.sql` | Retire the cleared entry identity so delayed autosaves cannot resurrect picks | verified | verified |
| 59 | `20260729100000_predictor_cup_lint_safe_progression.sql` | Lint-resolvable playoff/byes-to-bracket seat progression | verified | verified |
| 60 | `20260729110000_predictor_cup_lint_safe_qualification.sql` | Lint-resolvable Cup qualification/seeding and loop-declaration cleanup | verified | verified |

The migration versions match the exact canonical repository filenames. Do not renumber or reapply them under another timestamp.

## Contract-60 production evidence

- fresh encrypted production backup completed and restored into disposable local Supabase before mutation;
- preflight found exactly the approved pending canonical chain 56–58, followed by the isolated function-only 59 and 60 hotfixes;
- every production `supabase db push --dry-run` passed before application;
- production history contains exactly 60 versions through `20260729110000`;
- existing production counts remained one Auth user, one profile, one entry, one league, one league member, 51 matches and 36 saved predictions;
- no synthetic Bonus Games entrants, selections, groups, members, fixtures or Penalty Number rows were created;
- Account clear execution remains denied to anonymous callers and allowed only to authenticated/service roles;
- Predictor Cup qualification and settle remain service-role-only;
- no application SQL function retains a `pg_temp` or temporary-table dependency;
- production database lint passed at contract 60;
- exact application release identity, HTTP and Chromium smoke are required before the milestone is closed.

## Future rollout authority

Future production promotions must follow `AGENTS.md`: exact target and current contract, fresh recovery evidence when stored data is at risk, dry-run/preflight, explicit owner approval, exact application scope, hosted verification and exact release smoke.

## Related authority

- `docs/quality/current-status.md`
- `docs/roadmap.md`
- `docs/ops-production-backup-restore.md`
- `config/deployment-contract.json`
