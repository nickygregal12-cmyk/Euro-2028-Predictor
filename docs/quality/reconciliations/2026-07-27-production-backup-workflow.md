# Production backup workflow — 27 July 2026

## Scope

This record reconciles the addition of an owner-triggered GitHub Actions workflow that produces an encrypted, restore-verified logical backup of the production database. It was created because the contract-36 final-target promotion on 27 July 2026 proceeded under an explicit owner-approved recovery exception: no fresh backup and restore rehearsal preceded that production write, and a logical dump is the only recovery mechanism for the Free-plan production project.

## What was added

- `.github/workflows/production-backup.yml` — `workflow_dispatch` only, never push or schedule. A single job that:
  1. fails closed before any dump step if repository secret `SUPABASE_PROD_DB_URL` or `BACKUP_AGE_PUBLIC_KEY` is missing, or if the connection string does not reference production project `vkfnsqdyhvtwyqkisxhk`;
  2. dumps roles, schema and COPY-format data read-only — including the `auth.users` / `public.profiles` data path required by `create-production-backup.sh` — plus the `supabase_migrations` history via `pg_dump`, and captures the read-only source inventory into the bundle;
  3. restores the plaintext dump into a disposable local Supabase in the same job, using the same disposable-instance mechanism as `database-parity.yml`;
  4. verifies the restored copy and tears the disposable instance down;
  5. age-encrypts the bundle to the owner's recipient public key as `euro28-prod-<UTC>.backup.tar.gz.age`, shreds every plaintext dump file, and uploads only the encrypted artifact at 7-day retention;
  6. writes a job summary with UTC timestamp, plaintext/encrypted sizes, restored-migration count and inventory counts — no personal data.
- `scripts/database-rollout/restore-rehearsal-verification.sql` — counts-only verification of the restored disposable copy; it raises on any migration-history mismatch and never selects emails, display names or row contents.
- `tests/scripts/productionBackupWorkflow.test.ts` — regression tests asserting the workflow stays manual-trigger-only, references both secrets, rehearses restore before encryption, uploads only `.age` artifacts and keeps 7-day retention.
- Documentation updates in `docs/ops-production-backup-restore.md` (workflow procedure, secrets, custody, offline decryption sketch) and `docs/quality/risk-register.md` (recovery-gate reference).

## What a successful run verifies

- both required secrets are present and the connection string is pinned to the production project;
- roles, schema, data and migration-history dumps are non-empty, and `data.sql` visibly contains `auth.users` and `public.profiles`;
- the plaintext dump actually restores into a disposable local Supabase;
- for the first run, the restored migration history listed exactly 36 versions ending in `20260725010000` / `authoritative_reference_integrity`;
- restored inventory-equivalent counts print to the job log and summary (counts only);
- the plaintext dump is shredded before upload and only the age-encrypted artifact is uploaded — the job fails if any non-`.age` dump file would be uploaded.

## Security position

- Every production connection in the workflow is a dump or read-only inventory `SELECT`; the workflow contains no statement that writes to production.
- The production connection string is consumed only as an environment variable by dump/inventory commands and is never echoed, logged or written to an uploaded plaintext file.
- The repository is public, so only the encrypted artifact is uploaded; the age private key is held offline by the owner and appears nowhere in the repository, the workflow or CI.

## First-run record

- GitHub Actions run: `30264080847`, captured `20260727T120017Z`, completed successfully at `2026-07-27T12:03:58Z`;
- source commit: `202da34ff256908fa63d98da5bc3c458a94f175b`;
- restored migration history: 36 versions through `20260725010000` / `authoritative_reference_integrity`;
- restored representative counts: one Auth user, one profile, one submitted entry, 36 match predictions, three tie resolutions and eight progression rows;
- encrypted file: `euro28-prod-20260727T120017Z.backup.tar.gz.age`, 113,147 bytes;
- GitHub artifact: `production-backup-encrypted`, artifact ID `8652151058`, ZIP size 113,388 bytes;
- GitHub-recorded and independently downloaded ZIP SHA-256: `f27345d78dfe4b1651b892297176e61d9a7162b1cd041f7b87d964862ad309bc`;
- owner custody: the encrypted file was downloaded, its ZIP digest matched GitHub, and it was preserved in private off-GitHub storage; the matching private key remains owner-controlled and outside GitHub;
- exception closure: **closed** before the separately approved contract-38 production promotion.

The workflow baseline is updated to contract 38 by the release-closure change after that promotion. Future runs must therefore restore exactly 38 versions through `20260727080159` / `admin_result_revision_timestamp`.
