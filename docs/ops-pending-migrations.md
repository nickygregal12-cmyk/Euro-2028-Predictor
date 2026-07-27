# Hosted migration inventory and rollout status

Live source of truth for repository migration count, hosted state and pending rollout scope.

## Current status — 27 July 2026

| Environment | Contract | Hosted migration state | Pending |
| --- | ---: | --- | --- |
| Repository PR #122 | 39 | 39 canonical files through `20260727150621` | merge after required gates |
| Repository `main` / locked release baseline | 38 | 38 canonical files through `20260727080159` | contract 39 not yet merged |
| Development Supabase `iouzoutneyjpugbbtdem` | 39 | exactly 39 canonical versions through `20260727150621` | verification only |
| Netlify `dev`, `branch-deploy`, `deploy-preview` | 39 | development Supabase | exact-head PR preview verification |
| Production Supabase `vkfnsqdyhvtwyqkisxhk` | 38 | exactly 38 canonical versions through `20260727080159` | migration 39 deferred to a later approved milestone |
| Netlify `production` | 38 | production Supabase; verified milestone deploy is locked | no change approved |

Production is a controlled future-tournament target, not an active tournament. Contract 39 is intentionally development-only. Do not update the production database, production Netlify contract declaration or locked production release without explicit owner approval and the full milestone gate.

## Migration 37–39 hosted history

| # | Canonical migration | Purpose | Development | Production |
| ---: | --- | --- | --- | --- |
| 37 | `20260727075922_admin_result_authorization.sql` | Browser-authorised administrator result confirmation, correction, clearing and revision access | Applied and verified | Applied and verified |
| 38 | `20260727080159_admin_result_revision_timestamp.sql` | Correct administrator result-revision timestamp projection | Applied and verified | Applied and verified |
| 39 | `20260727150621_actual_round_of_16_population.sql` | Server-owned actual R16 population from completed groups, best-third allocation and safe upstream replay | Applied; disposable 51-match lifecycle and database parity passed | Not applied; later milestone only |

The repository migration-39 filename matches the exact canonical version recorded by development Supabase. Do not renumber or reapply it under another timestamp.

## Contract-39 development evidence

- all 39 migrations rebuild from zero in disposable local Supabase;
- database lint passes;
- the complete pgTAP suite passes, including the deterministic 51-match lifecycle;
- TypeScript/PostgreSQL predicted-group-order parity passes;
- development Supabase records `20260727150621_actual_round_of_16_population` as its latest migration;
- non-production Netlify contexts declare contract 39 and remain isolated from production;
- production Supabase and Netlify production remain at contract 38.

## Future rollout authority

Contract 38 production promotion is closed. Migration 39 is not an emergency or launch-critical production change. A future production promotion must follow the milestone gate in `AGENTS.md`: current hosted history, fresh recovery evidence when stored data is at risk, dry-run/preflight, explicit owner approval, exact application scope and full verification.

## Related evidence

- `docs/quality/current-status.md`
- `docs/roadmap.md`
- `docs/quality/reconciliations/2026-07-27-admin-migration-version-reconciliation.md`
- `docs/quality/reconciliations/2026-07-27-contract-36-final-target-promotion.md`
- `docs/quality/reconciliations/2026-07-27-production-backup-workflow.md`
- `docs/quality/reconciliations/2026-07-27-contract-38-final-target-promotion.md`
- `docs/ops-production-backup-restore.md`
- `config/deployment-contract.json`
