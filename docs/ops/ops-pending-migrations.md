# Hosted migration inventory and rollout status

Live source of truth for repository migration count, hosted state and pending rollout scope.

## Current status — 29 July 2026

| Environment | Contract | Hosted migration state | Pending |
| --- | ---: | --- | --- |
| `main` | 63 | 63 canonical files through `20260729154931_prediction_consensus_minimum_cohort.sql` | none |
| Development Supabase `iouzoutneyjpugbbtdem` | 63 | exactly 63 versions; history, cohort gate and public/private privileges verified | none |
| Production Supabase `vkfnsqdyhvtwyqkisxhk` | 63 | exactly 63 canonical versions through `20260729154931`; preserved-data and privilege postflight passed | none |
| Netlify `dev`, `branch-deploy`, `deploy-preview` | 63 | contract 63; each uses development Supabase | none |
| Netlify `production` | 63 | contract 63; uses production Supabase; deploy `6a6a53af58a0a500096b7cb1` ready from `ff633396e04eca77ed4456c5537ab361d9d259ee` | none |

Repository, both hosted databases, all Netlify contract declarations and the published production application are aligned at 63. No migration is pending. No baseline tag has been created.

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
| 63 | `20260729154931_prediction_consensus_minimum_cohort.sql` | Ten-entry tournament-wide consensus gate and explicit successful suppression state | verified | verified |

The migration versions match the exact canonical repository filenames in both hosted projects. Do not renumber or reapply them under another timestamp.

## Contract-63 evidence

- disposable clean rebuild through all 63 migrations passed;
- database lint, all pgTAP and TypeScript/PostgreSQL parity passed;
- both Supabase projects contain exactly 63 canonical versions through `20260729154931`;
- production promotion required the exact contract-60 baseline before applying 61–63;
- production user/profile/entry/league/member/match/prediction and Bonus Games counts were identical before and after promotion;
- public consensus is authenticated/service-only and anonymous execution is denied;
- private consensus and standings helpers are not executable by browser roles;
- rollback-only production verification returned the approved suppressed response;
- all Netlify contexts declare 63 with development/production Supabase URLs correctly separated;
- exact production deploy `6a6a53af58a0a500096b7cb1` is ready from the merged contract-63 commit.

## Related authority

- `docs/quality/current-status.md`
- `docs/quality/risk-register.md`
- `docs/quality/investigations/2026-07-29-euro-2028-baseline-readiness.md`
- `docs/ops/ops-production-backup-restore.md`
- `config/deployment-contract.json`
