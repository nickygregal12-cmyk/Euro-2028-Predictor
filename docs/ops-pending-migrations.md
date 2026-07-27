# Hosted migration inventory and rollout status

Live source of truth for repository migration count, hosted state and pending rollout scope.

## Current status — 27 July 2026

| Environment | Contract | Hosted migration state | Pending |
| --- | ---: | --- | --- |
| Repository `main` | 38 | 38 canonical files through `20260727080159` | none |
| Development Supabase `iouzoutneyjpugbbtdem` | 38 | exactly 38 canonical versions through `20260727080159` | none |
| Netlify `dev`, `branch-deploy`, `deploy-preview` | 38 | development Supabase | none |
| Production Supabase `vkfnsqdyhvtwyqkisxhk` | 36 | exactly 36 canonical versions through `20260725010000` | migrations 37–38 |
| Netlify `production` | 36 | final-target Supabase | contract lift follows database verification |

Production is a controlled final target, not an active tournament. Its contract must remain 36 until both pending migrations have been applied and verified.

## Exact production pending inventory

| # | Canonical migration | Purpose | Development | Production |
| ---: | --- | --- | --- | --- |
| 37 | `20260727075922_admin_result_authorization.sql` | Browser-authorised administrator result confirmation, correction, clearing and revision access | Applied and verified | Pending |
| 38 | `20260727080159_admin_result_revision_timestamp.sql` | Correct administrator result-revision timestamp projection | Applied and verified | Pending |

No other repository migration is pending on production. Development has no pending migration.

The repository filenames match the exact canonical versions recorded in development. With one final LF stripped, their verified MD5 values are:

- migration 37: `3ee6879dd2a8d8607ae437ba56787853`;
- migration 38: `b478b3eaadf0897e5985346075ca0a9e`.

Do not renumber, reapply under another timestamp, repair history, or alter either SQL file.

## Promotion authority

Use [`docs/ops-production-promotion-contract-38.md`](ops-production-promotion-contract-38.md) for the strict production 36→38 checklist.

The promotion must require:

1. a fresh green `Production backup` workflow run, with the encrypted artifact stored off GitHub, dated within 24 hours of the window;
2. a read-only history check showing exactly versions 1–36;
3. `supabase db push --dry-run` listing exactly `20260727075922` and `20260727080159`;
4. explicit owner approval;
5. application and verification of exactly those two canonical migrations;
6. production Netlify contract 38 only after database verification;
7. exact-head production smoke and a dated reconciliation.

No backup, history mismatch, surplus dry-run migration, failed verification or missing owner approval means stop.

## Related evidence

- `docs/quality/reconciliations/2026-07-27-admin-migration-version-reconciliation.md`
- `docs/quality/reconciliations/2026-07-27-contract-36-final-target-promotion.md`
- `docs/quality/reconciliations/2026-07-XX-production-backup-workflow.md`
- `docs/ops-production-backup-restore.md`
- `config/deployment-contract.json`
