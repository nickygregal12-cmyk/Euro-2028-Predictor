# Hosted migration inventory and rollout status

Live source of truth for repository migration count, hosted state and pending rollout scope.

## Current status — 27 July 2026

| Environment | Contract | Hosted migration state | Pending |
| --- | ---: | --- | --- |
| Repository | 41 | 41 canonical files through `20260727174658` | none in development |
| Development Supabase `iouzoutneyjpugbbtdem` | 41 | exactly 41 canonical versions through `20260727174658` | verification only |
| Netlify `dev`, `branch-deploy`, `deploy-preview` | 41 | development Supabase | none |
| Production Supabase `vkfnsqdyhvtwyqkisxhk` | 38 | exactly 38 canonical versions through `20260727080159` | migrations 39–41 deferred to a later approved milestone |
| Netlify `production` | 38 | production Supabase; verified milestone deploy is locked | no change approved |

Production is a controlled future-tournament target, not an active tournament. Contracts 39–41 are intentionally development-only. Do not update the production database, production Netlify contract declaration or locked production release without explicit owner approval and the full milestone gate.

## Migration 37–41 hosted history

| # | Canonical migration | Purpose | Development | Production |
| ---: | --- | --- | --- | --- |
| 37 | `20260727075922_admin_result_authorization.sql` | Browser-authorised administrator result confirmation, correction, clearing and revision access | Applied and verified | Applied and verified |
| 38 | `20260727080159_admin_result_revision_timestamp.sql` | Correct administrator result-revision timestamp projection | Applied and verified | Applied and verified |
| 39 | `20260727150621_actual_round_of_16_population.sql` | Server-owned actual R16 population from completed groups, best-third allocation and safe upstream replay | Applied and verified | Not applied; later milestone only |
| 40 | `20260727163339_actual_third_place_resolution.sql` | Authorised exact-set resolution of actual third-place qualification-boundary ties, immutable revisions and transactional R16 replay | Applied and verified | Not applied; later milestone only |
| 41 | `20260727174658_automatic_entry_submission.sql` | Database-scheduled automatic submission of complete valid entries at lock with immutable owner-visible outcomes | Applied and verified | Not applied; later milestone only |

The repository migration filenames for 39–41 match the exact canonical versions recorded by development Supabase. Do not renumber or reapply them under another timestamp.

## Contract-41 development evidence

- all 41 migrations rebuild from zero in disposable local Supabase;
- database lint passes;
- the complete pgTAP suite passes, including the deterministic 51-match lifecycle, 31-assertion boundary-tie lifecycle and 28-assertion automatic-submission lifecycle;
- TypeScript/PostgreSQL predicted-group-order parity passes;
- the automatic processor submits complete entries, records invalid entries, remains idempotent and preserves manual submission semantics;
- the authenticated Review journey exposes successful and failed automatic outcomes to the correct owners;
- development Supabase records `20260727174658_automatic_entry_submission` as its latest migration;
- the hosted apply preserved all 51 fixtures and the existing 12 development result records;
- no automatic outcome row was created during promotion;
- Supabase Cron job `euro28-auto-submit-due-entries` is active on a one-minute schedule;
- non-production Netlify contexts declare contract 41 and remain isolated from production;
- production Supabase and Netlify production remain at contract 38.

## Future rollout authority

Contract 38 production promotion is closed. Migrations 39–41 are not emergency or launch-critical production changes. A future production promotion must follow the milestone gate in `AGENTS.md`: current hosted history, fresh recovery evidence when stored data is at risk, dry-run/preflight, explicit owner approval, exact application scope and full verification.

## Related evidence

- `docs/quality/current-status.md`
- `docs/roadmap.md`
- PRs #122, #124, #126 and #128
- `docs/quality/reconciliations/2026-07-27-admin-migration-version-reconciliation.md`
- `docs/quality/reconciliations/2026-07-27-contract-36-final-target-promotion.md`
- `docs/quality/reconciliations/2026-07-27-production-backup-workflow.md`
- `docs/quality/reconciliations/2026-07-27-contract-38-final-target-promotion.md`
- `docs/ops-production-backup-restore.md`
- `config/deployment-contract.json`
