# Hosted migration inventory and rollout status

Live source of truth for repository migration count, hosted state and pending rollout scope.

## Current status — 28 July 2026

| Environment | Contract | Hosted migration state | Pending |
| --- | ---: | --- | --- |
| Repository | 46 | 46 canonical files through `20260727221000` in draft PR #138 | merge PR #138 after final gates |
| Development Supabase `iouzoutneyjpugbbtdem` | 46 | exactly 46 canonical versions through `20260727221000`; history aligned and baseline data unchanged | surface/state verification only |
| Netlify `dev`, `branch-deploy`, `deploy-preview` | 46 | development Supabase; exact PR #138 preview available | exact-head preview smoke |
| Production Supabase `vkfnsqdyhvtwyqkisxhk` | 44 | exactly 44 canonical versions through `20260727191942`; locked milestone | contracts 45–46 intentionally deferred |
| Netlify `production` | 44 | production Supabase; deploy `6a686e30f2f13c07f10e30d8` from `515e794aa483a779c971e16a364fcbd243fa7ee6` | exact-head Production Smoke workflow |

Production is a controlled future-tournament target, not an active tournament. Contracts 45–46 are development-only. Do not update the production database, production Netlify contract declaration or locked production release without explicit owner approval and the full milestone gate.

## Migration 37–46 hosted history

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

Development's migration versions match the exact canonical repository filenames. Do not renumber or reapply them under another timestamp.

## Contract-45/46 development evidence

- all 46 migrations rebuild from zero in disposable local Supabase;
- database lint, pgTAP and TypeScript/PostgreSQL parity pass on the unchanged contract code;
- authenticated Browser E2E proves five-page private-league navigation, outside-page caller context, owner search and real ownership transfer;
- `get_league_members(uuid,integer,text)` defaults to 50 rows and clamps at 100, with deterministic cursor traversal and server-owned rank/tie/position semantics;
- `search_league_transfer_candidates(uuid,text,integer)` is owner-only, independently clamped and does not expose the standings payload;
- `get_league`, `get_league_members`, `get_my_leagues`, `search_league_transfer_candidates` and `transfer_ownership` use empty security-definer search paths, deny anonymous execution and permit only authenticated/service-role execution;
- rollback-only hosted evidence traversed 250 unique members across five 50-row pages with warm pages around 23–24 ms and approximately 14 kB, owner search around 3.2 ms and the summary around 1.2 ms;
- baseline and post-evidence hosted data counts were identical;
- non-production Netlify contexts declare contract 46 and remain isolated from production;
- production Supabase and Netlify production remain aligned and locked at contract 44.

See `docs/quality/investigations/2026-07-28-stage-3c2-private-league-evidence.md`.

## Earlier bounded-read evidence

- PR #134 delivered contract 43 with server-ranked overall pagination, current-user context, database assertions, browser standings journeys and exact-head preview validation;
- PR #136 delivered contract 44 with operating-cap enforcement, concurrency assertions and capacity browser journeys;
- `docs/quality/investigations/2026-07-28-stage-3c2-scale-read-recompute-evidence.md` records the 250-entry non-league read and recomputation tranche;
- the hosted apply sequence preserved all existing tournament data and created no automatic-submission outcome during promotion.

## Future rollout authority

The contract-38 and contract-44 production promotions are closed (`quality/reconciliations/2026-07-27-contract-38-final-target-promotion.md`, `quality/reconciliations/2026-07-28-contract-44-production-promotion.md`). A future production promotion for contracts 45+ must follow the milestone gate in `AGENTS.md`: current hosted history, fresh recovery evidence when stored data is at risk, dry-run/preflight, explicit owner approval, exact application scope and full verification.

## Related evidence

- `docs/quality/current-status.md`
- `docs/roadmap.md`
- PRs #122, #124, #126, #128, #131, #134, #136 and draft #138
- `docs/quality/investigations/2026-07-28-stage-3c2-scale-read-recompute-evidence.md`
- `docs/quality/investigations/2026-07-28-stage-3c2-private-league-evidence.md`
- `docs/quality/reconciliations/2026-07-28-contract-44-production-promotion.md`
- `docs/ops-production-backup-restore.md`
- `config/deployment-contract.json`
