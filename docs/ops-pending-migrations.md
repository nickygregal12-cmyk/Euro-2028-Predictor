# Hosted migration inventory and rollout status

Live source of truth for repository migration count, hosted state and pending rollout scope.

## Current status — 29 July 2026

| Environment | Contract | Hosted migration state | Pending |
| --- | ---: | --- | --- |
| Stacked PR #196 repository candidate | 63 | 63 canonical files through `20260729154931_prediction_consensus_minimum_cohort.sql` | complete exact-head verification and stacked-PR disposition |
| Development Supabase `iouzoutneyjpugbbtdem` | 63 | owner-verified 29 July 2026 at exactly 63 versions; history and consensus public/private privileges verified | none |
| Netlify `dev`, `branch-deploy`, `deploy-preview` | 63 required | **REQUIRES OWNER VERIFICATION** that each context declares 63 and uses development Supabase | align before exact preview smoke |
| Production Supabase `vkfnsqdyhvtwyqkisxhk` | 60 | exactly 60 canonical versions; backup, dry-runs, preserved-data, privilege and hosted-lint checks passed | contracts 61–63 require separate approval |
| Netlify `production` | 60 | production Supabase; current production release remains contract 60 | no change authorised |

The development-63/production-60 split is intentional. It allows the post-lock/final-standings batch and privacy hardening to be verified in development without mutating the controlled production target. Production must not receive contracts 61–63 or a contract-63 application until a fresh milestone preflight, recovery check and explicit owner approval.

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
| 61 | `20260729122100_prediction_consensus.sql` | Bounded authenticated post-lock Original Predictor consensus | verified | pending approval |
| 62 | `20260729122200_final_standings_tiebreaks.sql` | Final overall/private standings tie-break activation | verified | pending approval |
| 63 | `20260729154931_prediction_consensus_minimum_cohort.sql` | Constant ten-entry tournament-wide consensus gate and explicit successful suppression state | verified | pending approval |

The migration versions match the exact canonical repository filenames. Development history contains `20260729122100`, `20260729122200` and `20260729154931` exactly. Do not renumber or reapply them under another timestamp.

## Contract-63 development evidence

- disposable clean rebuild through all 63 migrations passed;
- local database lint passed;
- all pgTAP suites passed, including below/at/above consensus threshold and caller-counting assertions;
- TypeScript/PostgreSQL differential parity passed;
- development Supabase contains exactly 63 canonical versions through `20260729154931`;
- `get_prediction_consensus` remains authenticated/service-only and anonymous execution is denied;
- `predictor_internal.get_prediction_consensus_unsuppressed` is not executable by anonymous or authenticated roles;
- below ten submitted entries the public RPC returns `suppressed: true`, `reason: not_enough_entries`, the threshold and truthful submitted count;
- at ten or more submitted entries the existing bounded aggregate is returned with `suppressed: false`;
- Netlify non-production contract-63 alignment remains **REQUIRES OWNER VERIFICATION**;
- production remains contract 60 and was not mutated.

## Contract-60 production evidence

- fresh encrypted production backup completed and restored into disposable Supabase before mutation;
- production history contains exactly 60 versions through `20260729110000`;
- existing production user/profile/entry/league/match/prediction counts were preserved;
- no synthetic Bonus Games entrants, selections, draws, scores or results were created;
- production database lint passed at contract 60;
- permanent backup verification is pinned to 60 and passed after restore;
- the verified contract-60 production application remains the PR #184 Bonus Games release.

## Future rollout authority

Production promotion of contracts 61–63 must follow `AGENTS.md`: exact target/current contract, fresh recovery evidence when stored data is at risk, dry-run/preflight, explicit owner approval, exact application scope, hosted verification and exact release smoke.

## Related authority

- `docs/quality/current-status.md`
- `docs/roadmap.md`
- `docs/ops-production-backup-restore.md`
- `config/deployment-contract.json`
