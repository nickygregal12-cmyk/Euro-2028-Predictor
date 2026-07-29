# Hosted migration inventory and rollout status

Live source of truth for repository migration count, hosted state and pending rollout scope.

## Current status — 29 July 2026

| Environment | Contract | Hosted migration state | Pending |
| --- | ---: | --- | --- |
| PR #193 repository candidate | 63 | 63 canonical files through `20260729154931_prediction_consensus_minimum_cohort.sql` | exact final-head gates, merge and release |
| Development Supabase `iouzoutneyjpugbbtdem` | 63 | exactly 63 versions; history, cohort gate and public/private privileges verified | none |
| Production Supabase `vkfnsqdyhvtwyqkisxhk` | 63 | exactly 63 canonical versions through `20260729154931`; preserved-data and privilege postflight passed | none |
| Netlify `dev`, `branch-deploy`, `deploy-preview` | 63 | contract 63; each uses development Supabase | exact PR preview verification |
| Netlify `production` | 63 | contract 63; uses production Supabase | exact application production deploy after merge |

Repository, development database, production database and environment contract declarations are aligned at 63. The live application remains the previous contract-60 artifact until PR #193 passes final-head gates, is merged and the exact production release is verified. No baseline tag has been created.

## Contracts 45–63

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
| 58 | `20260729090000_clear_predictions_race_safety.sql` | Retire cleared entry identity so delayed autosaves cannot resurrect picks | verified | verified |
| 59 | `20260729100000_predictor_cup_lint_safe_progression.sql` | Lint-resolvable playoff/byes-to-bracket progression | verified | verified |
| 60 | `20260729110000_predictor_cup_lint_safe_qualification.sql` | Lint-resolvable Cup qualification/seeding | verified | verified |
| 61 | `20260729122100_prediction_consensus.sql` | Bounded authenticated post-lock Original Predictor consensus | verified | verified |
| 62 | `20260729122200_final_standings_tiebreaks.sql` | Final overall/private standings tie-break activation | verified | verified |
| 63 | `20260729154931_prediction_consensus_minimum_cohort.sql` | Constant ten-entry tournament-wide consensus gate and explicit successful suppression state | verified | verified |

The migration versions match the exact canonical repository filenames in both hosted projects. Do not renumber or reapply them under another timestamp.

## Contract-63 verification evidence

- disposable clean rebuild through all 63 migrations passed;
- local database lint passed;
- all pgTAP suites passed, including below/at/above consensus threshold and caller-counting assertions;
- TypeScript/PostgreSQL differential parity passed;
- both Supabase projects contain exactly 63 canonical versions through `20260729154931`;
- production promotion required the exact contract-60 baseline before applying 61–63;
- production user/profile/entry/league/member/match/prediction and Bonus Games counts were identical before and after promotion;
- `get_prediction_consensus` is authenticated/service-only and anonymous execution is denied in production;
- `predictor_internal.get_prediction_consensus_unsuppressed` and `predictor_internal.standing_metrics` are not executable by browser roles;
- rollback-only production verification returned `suppressed: true`, `reason: not_enough_entries`, minimum ten and zero submitted entries;
- all Netlify contexts declare 63 with development/production Supabase URLs correctly separated.

## Production preservation snapshot

The 60→63 promotion preserved:

- one Auth user;
- one profile;
- one Original entry;
- one league and one league member;
- 51 matches;
- 36 saved Original predictions;
- three Bonus Games;
- zero Bonus Games entrants;
- zero Last Man Standing selections;
- zero KO Predictor selections.

## Remaining release sequence

1. Pass exact PR #193 final-head CI, Database parity, authenticated Browser E2E and deploy-preview smoke.
2. Merge PR #193 to `main`.
3. Verify the exact contract-63 production deploy, release metadata, environment identity and production smoke.
4. Record final deploy evidence and prepare the baseline tag.

## Related authority

- `docs/quality/current-status.md`
- `docs/quality/risk-register.md`
- `docs/roadmap.md`
- `docs/ops-production-backup-restore.md`
- `config/deployment-contract.json`
