# Hosted migration inventory and rollout status

Live source of truth for repository migration count, hosted state and pending rollout scope.

## Current status — 28 July 2026

| Environment | Contract | Hosted migration state | Pending |
| --- | ---: | --- | --- |
| Repository | 47 | 47 canonical files through `20260728113000_other_player_profiles.sql` in PR #143 | merge after final exact-head gates |
| Development Supabase `iouzoutneyjpugbbtdem` | 47 | exactly 47 canonical versions through `20260728113000`; history, grants and baseline data verified | none for contract 47 |
| Netlify `dev`, `branch-deploy`, `deploy-preview` | 47 | development Supabase; compatible PR #143 preview rebuilding | exact-head preview smoke |
| Production Supabase `vkfnsqdyhvtwyqkisxhk` | 44 | exactly 44 canonical versions through `20260727191942`; locked milestone | contracts 45–47 intentionally deferred |
| Netlify `production` | 44 | production Supabase; deploy `6a686e30f2f13c07f10e30d8` from `515e794aa483a779c971e16a364fcbd243fa7ee6` | exact-head Production Smoke workflow |

Production is a controlled future-tournament target, not an active tournament. Contracts 45–47 are development-only. Do not update the production database, production Netlify contract declaration or locked production release without explicit owner approval and the full milestone gate.

## Migration 37–47 hosted history

| # | Canonical migration | Purpose | Development | Production |
| ---: | --- | --- | --- | --- |
| 37 | `20260727075922_admin_result_authorization.sql` | Browser-authorised administrator result confirmation, correction, clearing and revision access | Applied and verified | Applied and verified |
| 38 | `20260727080159_admin_result_revision_timestamp.sql` | Correct administrator result-revision timestamp projection | Applied and verified | Applied and verified |
| 39 | `20260727150621_actual_round_of_16_population.sql` | Server-owned actual R16 population from completed groups, best-third allocation and safe upstream replay | Applied and verified | Applied and verified (28 July 2026) |
| 40 | `20260727163339_actual_third_place_resolution.sql` | Authorised exact-set resolution of actual third-place qualification-boundary ties, immutable revisions and transactional R16 replay | Applied and verified | Applied and verified (28 July 2026) |
| 41 | `20260727174658_automatic_entry_submission.sql` | Database-scheduled automatic submission of complete valid entries at lock with immutable owner-visible outcomes | Applied and verified | Applied and verified (28 July 2026); Cron active |
| 42 | `20260727182300_bounded_read_models.sql` | Explicit server-side bounds for standings, user league lists, match-pick comparisons and rival-entry payloads | Applied and verified | Applied and verified (28 July 2026) |
| 43 | `20260727183900_bounded_overall_leaderboard.sql` | Server-ranked keyset pagination for overall standings with independent caller context | Applied and verified | Applied and verified (28 July 2026) |
| 44 | `20260727191942_operating_cap_enforcement.sql` | Transaction-serialised public-user and total-league operating limits with authoritative write-boundary enforcement | Applied and verified | Applied and verified (28 July 2026) |
| 45 | `20260727214500_paginated_private_league_standings.sql` | Keyset-paginated private-league standings, independent caller position, owner-only transfer search and hardened touched functions | Applied and verified; hosted scale evidence captured | Not applied — milestone locked |
| 46 | `20260727221000_private_league_summary_activity.sql` | Lightweight league summaries retain latest activity without loading standings | Applied and verified | Not applied — milestone locked |
| 47 | `20260728113000_other_player_profiles.sql` | Co-member-only player profiles with safe pre-lock summary and bounded authoritative post-lock detail | Applied and verified; hosted privacy/payload evidence captured | Not applied — milestone locked |

Development's migration versions match the exact canonical repository filenames. Do not renumber or reapply them under another timestamp.

## Contract-47 development evidence

- all 47 migrations rebuild from zero in disposable local Supabase;
- database lint, pgTAP and TypeScript/PostgreSQL parity pass;
- `get_player_profile(uuid,uuid)` is security-definer with an immutable empty search path;
- anonymous execution is denied; authenticated and service-role execution are explicitly allowed;
- non-co-members are denied server-side while self access remains available;
- pre-lock response contains identity, tournament league count and entry state only;
- post-lock detail is capped at 36 group predictions, 24 progression rows and 100 score events;
- rollback-only hosted evidence measured a 195-byte pre-lock payload in 2.408 ms and a fully capped 21,273-byte post-lock payload in 9.691 ms;
- the measured post-lock execution plan completed in 4.836 ms with 193 shared-buffer hits and no disk/temp reads or writes;
- hosted baseline counts remained 23 Auth users, 23 profiles, 21 entries, 3 leagues, 37 memberships and 252 score events after rollback;
- authenticated Browser E2E proves the hidden-to-full profile transition and Profile/H2H navigation on desktop and phone;
- non-production Netlify contexts declare contract 47 and remain isolated from production;
- production Supabase and Netlify production remain aligned and locked at contract 44.

See `docs/quality/investigations/2026-07-28-stage-4-secure-player-profile-evidence.md`.

## Earlier development evidence

- PR #134 delivered contract 43 with server-ranked overall pagination, current-user context, database assertions, browser standings journeys and exact-head preview validation;
- PR #136 delivered contract 44 with operating-cap enforcement, concurrency assertions and capacity browser journeys;
- PR #138 delivered contracts 45–46 with private-league pagination/search and 250-member hosted evidence;
- PR #141 closed the Stage 3C2 own Profile/H2H resilient-state pass;
- `docs/quality/investigations/2026-07-28-stage-3c2-scale-read-recompute-evidence.md` records the 250-entry non-league read and recomputation tranche;
- the hosted apply sequences preserved all existing tournament data.

## Future rollout authority

The contract-38 and contract-44 production promotions are closed (`quality/reconciliations/2026-07-27-contract-38-final-target-promotion.md`, `quality/reconciliations/2026-07-28-contract-44-production-promotion.md`). A future production promotion for contracts 45+ must follow the milestone gate in `AGENTS.md`: current hosted history, fresh recovery evidence when stored data is at risk, dry-run/preflight, explicit owner approval, exact application scope and full verification.

## Related evidence

- `docs/quality/current-status.md`
- `docs/roadmap.md`
- PRs #122, #124, #126, #128, #131, #134, #136, #138, #141 and #143
- `docs/quality/investigations/2026-07-28-stage-3c2-scale-read-recompute-evidence.md`
- `docs/quality/investigations/2026-07-28-stage-3c2-private-league-evidence.md`
- `docs/quality/investigations/2026-07-28-stage-4-secure-player-profile-evidence.md`
- `docs/quality/reconciliations/2026-07-28-contract-44-production-promotion.md`
- `docs/ops-production-backup-restore.md`
- `config/deployment-contract.json`
