# Production backup workflow — XX July 2026

Replace `XX` in this file's name and title with the merge date when this record is finalized.

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
- the restored migration history lists exactly 36 versions ending in `20260725010000` / `authoritative_reference_integrity`;
- restored inventory-equivalent counts print to the job log and summary (counts only);
- the plaintext dump is shredded before upload and only the age-encrypted artifact is uploaded — the job fails if any non-`.age` dump file would be uploaded.

## Security position

- Every production connection in the workflow is a dump or read-only inventory `SELECT`; the workflow contains no statement that writes to production.
- The production connection string is consumed only as an environment variable by dump/inventory commands and is never echoed, logged or written to an uploaded plaintext file.
- The repository is public, so only the encrypted artifact is uploaded; the age private key is held offline by the owner and appears nowhere in the repository, the workflow or CI.

## Exception closure boundary

Merging the pull request that adds this workflow does **not** close the recovery exception recorded in `2026-07-27-contract-36-final-target-promotion.md`. That exception is closed only after the **first successful run** of the `Production backup` workflow — a green run whose encrypted artifact the owner has downloaded and stored off GitHub — is completed and recorded here. Until then the exception remains visible and open, and no fresh contract-36 recovery mechanism exists.

## First-run record (complete after the first successful run)

- run identifier and UTC timestamp: _pending_;
- plaintext/encrypted sizes and restored-migration count from the job summary: _pending_;
- owner download and off-GitHub custody reference (no secrets): _pending_;
- exception closure decision: _pending_.
