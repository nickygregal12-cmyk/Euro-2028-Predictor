# Hosted migration inventory and rollout status

Live source of truth for repository migration count, hosted state and pending rollout scope.

## Current status — 27 July 2026

| Environment | Contract | Hosted migration state | Pending |
| --- | ---: | --- | --- |
| Repository `main` | 38 | 38 canonical files through `20260727080159` | none |
| Development Supabase `iouzoutneyjpugbbtdem` | 38 | exactly 38 canonical versions through `20260727080159` | none |
| Netlify `dev`, `branch-deploy`, `deploy-preview` | 38 | development Supabase | none |
| Production Supabase `vkfnsqdyhvtwyqkisxhk` | 38 | exactly 38 canonical versions through `20260727080159` | none |
| Netlify `production` | 38 | production Supabase; verified milestone deploy is locked | none |

Production is a controlled future-tournament target, not an active tournament. Contract 38 promotion is complete.

## Migration 37–38 hosted history

| # | Canonical migration | Purpose | Development | Production |
| ---: | --- | --- | --- | --- |
| 37 | `20260727075922_admin_result_authorization.sql` | Browser-authorised administrator result confirmation, correction, clearing and revision access | Applied and verified | Applied and verified |
| 38 | `20260727080159_admin_result_revision_timestamp.sql` | Correct administrator result-revision timestamp projection | Applied and verified | Applied and verified |

No repository migration is pending on either hosted project.

The repository filenames match the exact canonical versions recorded in development. With one final LF stripped, their verified MD5 values are:

- migration 37: `3ee6879dd2a8d8607ae437ba56787853`;
- migration 38: `b478b3eaadf0897e5985346075ca0a9e`.

Do not renumber, reapply under another timestamp, repair history, or alter either SQL file.

## Future rollout authority

Contract 38 promotion is closed. Future production migrations follow the milestone gate in `AGENTS.md`: current history, fresh recovery evidence when stored data is at risk, dry-run/preflight, explicit owner approval, exact application scope and full verification.

## Related evidence

- `docs/quality/reconciliations/2026-07-27-admin-migration-version-reconciliation.md`
- `docs/quality/reconciliations/2026-07-27-contract-36-final-target-promotion.md`
- `docs/quality/reconciliations/2026-07-27-production-backup-workflow.md`
- `docs/quality/reconciliations/2026-07-27-contract-38-final-target-promotion.md`
- `docs/ops-production-backup-restore.md`
- `config/deployment-contract.json`
