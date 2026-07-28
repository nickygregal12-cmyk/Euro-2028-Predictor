# Hosted migration inventory and rollout status

Live source of truth for repository migration count, hosted state and pending rollout scope.

## Current status — 28 July 2026

| Environment | Contract | Hosted migration state | Pending |
| --- | ---: | --- | --- |
| Repository | 56 | 56 canonical files through `20260729050000_predictor_cup_knockouts.sql` | none |
| Development Supabase `iouzoutneyjpugbbtdem` | 56 | exactly 56 canonical versions; history, grants and posture verified after the contract-56 application | none |
| Netlify `dev`, `branch-deploy`, `deploy-preview` | 55 | development Supabase; exact preview HTTP and Chromium smoke passed at 55 | owner `EURO28_DEPLOYED_DB_CONTRACT=56` update |
| Production Supabase `vkfnsqdyhvtwyqkisxhk` | 55 | exactly 55 canonical versions; contracts 49–55 applied after encrypted backup, dry-run and preserved-data verification | none |
| Netlify `production` | 55 | production Supabase; deploy `6a68e4f9ee76002a26ffbee6` from `af5aa15a151f5c4236ba3f2756faab4b357f31ee` | none |

Production is re-locked at contract 55; contract 56 is development-only. Any later production migration requires a new approved milestone gate; ordinary application development must not mutate production.

## Contracts 45–55

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
| 56 | `20260729050000_predictor_cup_knockouts.sql` | Cup qualification, knockouts, Penalty Numbers and honours (B7c) | verified | not applied — awaits a later milestone gate |

The migration versions match the exact canonical repository filenames. Do not renumber or reapply them under another timestamp.

## Contract-55 production evidence

- fresh encrypted production backup completed and restored into disposable local Supabase before mutation;
- preflight found exactly seven pending canonical migrations, 49–55;
- `supabase db push --dry-run` passed before application;
- all seven migrations applied in canonical order;
- production history contains exactly 55 versions through `20260729030000`;
- existing production counts remained one Auth user, one profile, one entry, one league, 51 matches and 36 group predictions;
- no synthetic Bonus Games entrants, selections, groups, members or fixtures were created;
- security-definer search paths are empty; anonymous execution is denied; internal Cup/LMS helpers are not Data API callable;
- production database lint passed;
- deploy `6a68e4f9ee76002a26ffbee6` reports contract 55, production Supabase and exact commit `af5aa15a151f5c4236ba3f2756faab4b357f31ee`;
- production HTTP and Chromium smoke passed.

## Future rollout authority

Future production promotions must follow `AGENTS.md`: exact target and current contract, fresh recovery evidence when stored data is at risk, dry-run/preflight, explicit owner approval, exact application scope, hosted verification and exact release smoke.

## Related authority

- `docs/quality/current-status.md`
- `docs/roadmap.md`
- `docs/ops-production-backup-restore.md`
- `config/deployment-contract.json`
