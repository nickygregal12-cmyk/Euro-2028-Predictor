# Hosted migration inventory and rollout status

Live source of truth for repository migration count, hosted state and pending rollout scope.

## Current status — 27 July 2026

| Environment | Contract | Hosted migration state | Pending |
| --- | ---: | --- | --- |
| Repository | 44 | 44 canonical files through `20260727191942` | draft PR #138 (contracts 45–46) not yet merged |
| Development Supabase `iouzoutneyjpugbbtdem` | 44 | exactly 44 canonical versions through `20260727191942` | verification only |
| Netlify `dev`, `branch-deploy`, `deploy-preview` | 44 | development Supabase | none |
| Production Supabase `vkfnsqdyhvtwyqkisxhk` | 38 | exactly 38 canonical versions through `20260727080159` | migrations 39–44 deferred to a later approved milestone |
| Netlify `production` | 38 | production Supabase; verified milestone deploy is locked | no change approved |

Production is a controlled future-tournament target, not an active tournament. Contracts 39–44 are intentionally development-only. Do not update the production database, production Netlify contract declaration or locked production release without explicit owner approval and the full milestone gate.

## Migration 37–44 hosted history

| # | Canonical migration | Purpose | Development | Production |
| ---: | --- | --- | --- | --- |
| 37 | `20260727075922_admin_result_authorization.sql` | Browser-authorised administrator result confirmation, correction, clearing and revision access | Applied and verified | Applied and verified |
| 38 | `20260727080159_admin_result_revision_timestamp.sql` | Correct administrator result-revision timestamp projection | Applied and verified | Applied and verified |
| 39 | `20260727150621_actual_round_of_16_population.sql` | Server-owned actual R16 population from completed groups, best-third allocation and safe upstream replay | Applied and verified | Not applied; later milestone only |
| 40 | `20260727163339_actual_third_place_resolution.sql` | Authorised exact-set resolution of actual third-place qualification-boundary ties, immutable revisions and transactional R16 replay | Applied and verified | Not applied; later milestone only |
| 41 | `20260727174658_automatic_entry_submission.sql` | Database-scheduled automatic submission of complete valid entries at lock with immutable owner-visible outcomes | Applied and verified | Not applied; later milestone only |
| 42 | `20260727182300_bounded_read_models.sql` | Explicit server-side bounds for overall standings, user league lists, league member/pick comparisons and rival-entry payloads | Applied and verified | Not applied; later milestone only |
| 43 | `20260727183900_bounded_overall_leaderboard.sql` | Server-ranked keyset pagination for overall standings (50 default / 100 maximum rows, deterministic cursors, current-user position context), replacing the contract-42 capped standings RPC | Applied and verified | Not applied; later milestone only |
| 44 | `20260727191942_operating_cap_enforcement.sql` | Transaction-serialised public-user and total-league operating limits with `BEFORE INSERT` enforcement, anonymous-safe capacity RPC and service-role-only limit adjustment | Applied and verified | Not applied; later milestone only |

The repository migration filenames for 39–44 match the exact canonical versions recorded by development Supabase. Do not renumber or reapply them under another timestamp.

## Contract-43/44 development evidence

- PR #134 delivered contract 43 with the full 43-migration Database parity rebuild, pgTAP (including the 392-line `099_paginated_overall_leaderboard` suite), updated function-privilege assertions, browser standings journeys (`e2e/overall-standings.spec.ts`) and exact-head preview validation;
- PR #136 delivered contract 44 with the 44-migration rebuild, the 387-line `100_operating_cap_enforcement` pgTAP lifecycle, capacity browser journeys (`e2e/auth-capacity.spec.ts`, `e2e/operating-cap.spec.ts`) and updated privilege assertions;
- development Supabase records `20260727191942_operating_cap_enforcement` as its latest canonical migration;
- production Supabase and Netlify production remain at contract 38.

## Contract-42 development evidence

- all 42 migrations rebuild from zero in disposable local Supabase;
- database lint passes;
- the complete pgTAP suite passes, including the deterministic 51-match lifecycle, 31-assertion boundary-tie lifecycle, 28-assertion automatic-submission lifecycle and 17-assertion excess-data bounded-read fixture;
- TypeScript/PostgreSQL predicted-group-order parity passes;
- overall standings return no more than the top 250 submitted entries after deterministic ordering;
- one user's league list returns no more than 20 leagues;
- league standings and match-pick detail return no more than 250 members/picks while preserving truthful aggregate counts;
- rival-entry payloads return only the fixed 36 group predictions and no more than 24 tournament teams;
- the five bounded reads retain authenticated/service-role execution, deny anonymous execution and use empty immutable search paths;
- development Supabase recorded `20260727182300_bounded_read_models` as its latest migration at the time (since superseded by contract 43);
- the hosted apply preserved all 51 fixtures, 12 existing result records, 21 entries and 3 leagues;
- no automatic outcome row was created during promotion;
- non-production Netlify contexts declared contract 42 at the time (now 43) and remain isolated from production;
- production Supabase and Netlify production remain at contract 38.

## Future rollout authority

Contract 38 production promotion is closed. Migrations 39–44 are not emergency or launch-critical production changes. A future production promotion must follow the milestone gate in `AGENTS.md`: current hosted history, fresh recovery evidence when stored data is at risk, dry-run/preflight, explicit owner approval, exact application scope and full verification.

## Related evidence

- `docs/quality/current-status.md`
- `docs/roadmap.md`
- PRs #122, #124, #126, #128, #131, #134 and #136
- `docs/quality/reconciliations/2026-07-27-admin-migration-version-reconciliation.md`
- `docs/quality/reconciliations/2026-07-27-contract-36-final-target-promotion.md`
- `docs/quality/reconciliations/2026-07-27-production-backup-workflow.md`
- `docs/quality/reconciliations/2026-07-27-contract-38-final-target-promotion.md`
- `docs/ops-production-backup-restore.md`
- `config/deployment-contract.json`
