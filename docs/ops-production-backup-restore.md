# Production backup and restore rehearsal

**Status date:** 27 July 2026  
**Scope:** Canonical recovery procedure, completed contract-35 evidence and the owner-triggered contract-36 backup workflow.  
**Authority:** This document prepares, records and verifies recovery evidence. It does not by itself authorize a production restore or future migration.

## Current verified position

Production Supabase project `vkfnsqdyhvtwyqkisxhk` is on the Free plan. Automatic daily backups and PITR must not be assumed. Production recovery therefore relies on fresh logical exports, encrypted off-machine custody and proven disposable restores.

The contract-35 rollout was completed with accepted recovery evidence. Migration 36 was subsequently applied to production on 27 July 2026 under an explicit owner-approved recovery exception: no fresh backup and restore rehearsal preceded that write. Until the exception is closed, no fresh recovery mechanism has been proven at contract 36.

Latest records:

- recovery acceptance (contract 35): `docs/quality/reconciliations/2026-07-25-final-recovery-acceptance.md`;
- production execution (contract 35): `docs/quality/reconciliations/2026-07-25-contract-35-production-promotion.md`;
- contract-36 promotion with open recovery exception: `docs/quality/reconciliations/2026-07-27-contract-36-final-target-promotion.md`;
- backup workflow record: `docs/quality/reconciliations/2026-07-XX-production-backup-workflow.md`.

## GitHub Actions backup workflow (owner-triggered, no local machine)

`.github/workflows/production-backup.yml` produces an encrypted, restore-verified logical backup of production entirely from the GitHub Actions UI. It exists to close the recovery exception recorded in the 27 July 2026 promotion reconciliation; that exception is closed only by this workflow's **first successful run**, not by the workflow merely existing.

### Required repository secrets

| Secret | Value |
| --- | --- |
| `SUPABASE_PROD_DB_URL` | The full Postgres connection string for production project `vkfnsqdyhvtwyqkisxhk` (Supabase dashboard → Database → connection string). Used only as an environment variable consumed by dump/inventory commands; never echoed or written to any file that is uploaded unencrypted. |
| `BACKUP_AGE_PUBLIC_KEY` | An [age](https://github.com/FiloSottile/age) recipient public key (`age1...`). Generate the keypair anywhere private; the matching **private key must never be stored on GitHub** in any form — not as a secret, file or comment. |

The workflow fails immediately, before any dump step, if either secret is missing, and refuses a connection string that does not reference the production project ref.

### What one run does

1. dumps roles, schema and COPY-format data read-only — including the `auth.users` / `public.profiles` data path required by `create-production-backup.sh` — plus the `supabase_migrations` history via `pg_dump`;
2. restores the plaintext dump into a disposable local Supabase inside the same job and verifies that the restored migration history has exactly 36 versions ending in `20260725010000` / `authoritative_reference_integrity`;
3. prints inventory-equivalent counts from the restored copy (counts only — never emails, display names or row contents), then tears the disposable instance down;
4. age-encrypts the bundle to `BACKUP_AGE_PUBLIC_KEY` as `euro28-prod-<UTC>.backup.tar.gz.age` and shreds every plaintext dump file before the artifact step;
5. uploads only the encrypted file as a workflow artifact with 7-day retention, failing if any non-`.age` dump file would be uploaded;
6. writes a job summary with UTC timestamp, plaintext/encrypted sizes, restored-migration count and the inventory counts.

### How the owner triggers it

GitHub → **Actions** → **Production backup** → **Run workflow** (on `main`). No local machine, CLI install or credential entry is needed beyond the two stored secrets. It is `workflow_dispatch` only and must never gain push or schedule triggers.

### Artifact custody

- This repository is public and workflow artifacts are downloadable by anyone, which is why only the age-encrypted file is ever uploaded; the ciphertext is useless without the offline private key.
- Retention is 7 days. After a green run, download the artifact promptly and store it in private, owner-controlled storage off GitHub.
- Record custody without secrets: artifact identifier, encrypted checksum, run timestamp, storage location and retention.

### Offline decryption sketch (owner-only)

On a private machine holding the age private key — never on GitHub, never in CI:

```bash
age --decrypt -i /path/to/age-private-key.txt \
  -o euro28-prod-<UTC>.backup.tar.gz \
  euro28-prod-<UTC>.backup.tar.gz.age
tar -tzf euro28-prod-<UTC>.backup.tar.gz   # list first; extract only on a trusted machine
```

The extracted bundle contains `roles.sql`, `schema.sql`, `data.sql`, `migration-history.sql`, the source inventory and provenance evidence, `SHA256SUMS`, and the restore helper/verification scripts; follow the restore sequence later in this document. Losing the private key makes every artifact unrecoverable — keep at least one secure offline copy of it.

## Accepted recovery evidence — completed

The accepted source artifact was created on 25 July 2026 outside the repository and contains:

- `roles.sql`;
- `schema.sql`;
- COPY-format `data.sql`;
- `auth.users` and `public.profiles` data;
- database inventory;
- repository commit and migration inventory;
- Supabase/PostgreSQL/tool version records;
- managed Auth customization evidence;
- baseline, preflight and post-rollout verification scripts;
- recursive `SHA256SUMS`.

Verified controls:

- required files present and non-empty;
- owner-only permissions on sensitive files;
- all plaintext checksums passed;
- OpenSSL AES-256-CBC with PBKDF2 and 250,000 iterations used;
- encrypted archive decrypted and listed successfully;
- encrypted archive checksum passed;
- encrypted archive retained off the working Mac;
- off-device retrieval and checksum verification passed;
- restricted decryption, gzip and archive-path safety checks passed;
- all plaintext checksums and provenance passed after retrieval.

The owner explicitly accepted OpenSSL AES-256-CBC with PBKDF2 as the encryption method actually used by the verified artifact.

No credential, raw Auth record, archive passphrase, encrypted checksum value or private storage URL is stored in the repository.

## Corrected clean restore evidence — completed

The first logical restore exposed inherited target-default privileges that incorrectly granted browser roles access to `public.entry_totals`. Production itself was checked read-only and was not exposed.

The procedure was corrected by running `prepare-disposable-restore-target.sql` after `roles.sql` and before `schema.sql`. A new genuinely empty hosted target then passed the full sequence without manual ACL reconciliation:

1. restore roles;
2. prepare target defaults;
3. restore schema;
4. restore data with replication triggers disabled for import;
5. restore managed Auth customization;
6. verify the contract-20 source baseline;
7. verify source counts, Auth/profile/Storage and signup trigger;
8. repair exactly migrations 1–20 as metadata;
9. dry-run exactly migrations 21–35;
10. apply migrations 21–35;
11. run the 63-check post-rollout verifier;
12. run advisors and rollback-only authenticated/service smoke checks;
13. rerun all checks after rollback.

Final clean replay results:

- all twenty contract-20 baseline checks passed;
- source-equivalent `entry_totals` ACLs passed;
- Auth/profile restore and rollback-only signup/profile creation passed;
- source counts, submitted timestamp and all fingerprints matched;
- exactly 35 canonical history versions were recorded;
- exactly 63 post-rollout checks passed;
- no migrations remained pending;
- both client RPCs and the private resolver were present;
- 24 derived group positions were created;
- no result, revision, score-event or rank-history data was invented;
- every smoke write rolled back;
- security advisors returned no `ERROR` finding.

This evidence was explicitly accepted and then used to support the controlled production rollout.

## Production execution and artifact integrity

A fresh preproduction encrypted backup remained intact during the production operation. The production history repair, migrations 21–35, final verifier, rollback-only smoke and zero-pending dry run all passed.

Recovery proof and production execution are complete. Remaining `OPS-003` work concerns monitoring, alert ownership, periodic rehearsal, retention policy and final launch rollback readiness—not the validity of the accepted artifact.

## What qualifies as recovery evidence

A future production-changing operation should require all applicable items:

1. fresh logical source bundle after the release/write freeze;
2. separate roles, schema and data dumps;
3. `auth.users` and `public.profiles` present;
4. managed Auth/Storage drift evidence and signup-trigger restore statement;
5. source inventory, repository/tool provenance, migration list and checksums;
6. restricted plaintext permissions;
7. explicitly approved encryption method;
8. verified off-machine copy with custody and retention record;
9. checksum verification after retrieval;
10. successful disposable restore;
11. Auth, critical public data, trigger, source-equivalent object privileges and fingerprint verification;
12. forward migration rehearsal when the backup supports a migration window;
13. retained non-secret acceptance and cleanup evidence.

A Netlify rollback is not a database rollback.

## Safety boundary

- Never commit a backup bundle, database connection string or password.
- Never run restore commands against production without an explicit incident decision.
- Never run `supabase db reset --linked`.
- Never use development Supabase as a production fallback.
- Never expose database/archive passwords in screenshots, docs, transcripts or issue comments.
- Never skip a failed restore object or casually edit a dump.
- Never use an unrestored backup to authorize production migration.
- Treat the bundle as highly sensitive because it includes Auth identities and password hashes.
- Do not assume the 25 July artifact remains the correct backup for future migrations after material production data changes; create a fresh source bundle.

## Source bundle creation procedure

Use the repository script where local files are available:

```bash
read -s -p "Production database URL: " PRODUCTION_DB_URL
export PRODUCTION_DB_URL
printf '\n'

export BACKUP_ROOT="/absolute/path/on/secure-volume"
export CONFIRM_PRODUCTION_PROJECT_REF="vkfnsqdyhvtwyqkisxhk"

bash scripts/database-rollout/create-production-backup.sh
```

The script must:

- refuse a dirty checkout;
- refuse an output path inside the repository;
- validate the production project reference;
- capture read-only inventory;
- create roles, schema and COPY-format data dumps;
- require `auth.users` and `public.profiles`;
- capture Auth/Storage drift evidence;
- include managed customization, restore-target preparation and verifier files;
- generate manifest/provenance and recursive checksums;
- set owner-only permissions;
- never migrate, reset, seed or upload a project.

The 25 July bundle was assembled through equivalent linked Supabase CLI dump steps after URI authentication difficulties. The resulting files passed the same critical-table, permission and checksum checks. Future runs should prefer the fail-closed script where practical.

## Inspect before encryption

Without printing user data:

```bash
cd "/path/to/euro28-prod-<UTC_TIMESTAMP>"

shasum -a 256 -c SHA256SUMS
grep -E '(COPY|INSERT INTO)[[:space:]]+"?auth"?\."?users"?' data.sql >/dev/null
grep -E '(COPY|INSERT INTO)[[:space:]]+"?public"?\."?profiles"?' data.sql >/dev/null
```

Review non-secret metadata only:

- manifest/source inventory;
- migration file list;
- Auth/Storage diff;
- managed customization statement;
- repository/tool versions.

Any unexpected managed-schema drift must become an explicit reviewed restore step.

## Encrypt and retain off-site

Use the approved encryption method and store the passphrase separately. Record without secrets:

- artifact identifier;
- encrypted artifact checksum;
- creation timestamp;
- operator;
- encryption method/key identifier;
- off-site storage system and retrieval reference;
- retention/expiry;
- reviewer/acceptance.

Do not delete the only plaintext staging copy until the encrypted copy has been retrieved and the disposable restore has succeeded.

## Restore target requirements

Use a newly created or explicitly approved disposable target. Before restoring, confirm:

- exact target project reference and database version;
- operator and start time;
- target contains no required data;
- target `public` schema contains no user tables/views;
- production and development references are not being used;
- target is not connected to any Netlify context.

## Baseline restore sequence

Use a target-specific `RESTORE_DB_URL`. Never reuse a production variable.

```bash
read -s -p "Disposable restore database URL: " RESTORE_DB_URL
export RESTORE_DB_URL
printf '\n'

psql "$RESTORE_DB_URL" --single-transaction --variable ON_ERROR_STOP=1 --file roles.sql
psql "$RESTORE_DB_URL" --single-transaction --variable ON_ERROR_STOP=1 --file prepare-disposable-restore-target.sql
psql "$RESTORE_DB_URL" --single-transaction --variable ON_ERROR_STOP=1 --file schema.sql
psql "$RESTORE_DB_URL" --single-transaction --variable ON_ERROR_STOP=1 --command 'SET session_replication_role = replica' --file data.sql
psql "$RESTORE_DB_URL" --single-transaction --variable ON_ERROR_STOP=1 --file managed-schema-customizations.sql
```

`prepare-disposable-restore-target.sql` is mandatory for a new hosted Supabase target. It removes inherited target defaults before source object creation so the dump's explicit grants/revocations recreate the source ACL.

Review `auth-storage-diff.sql`. Apply only statements proven to be genuine source customizations not recreated elsewhere.

Stop on the first failure. Preserve non-secret output and do not skip objects.

## Baseline restore verification

Against the restored target:

1. run `verification/production-baseline-1-20-verification.sql` or the baseline appropriate to the new artifact;
2. require every structural and ACL check true;
3. run `verification/production-preflight.sql` and require exact captured source invariants;
4. compare source counts with captured inventory;
5. verify Auth users/profiles without exposing rows;
6. verify `on_auth_user_created` and `public.handle_new_user()`;
7. prove signup/profile creation with a disposable user;
8. verify Storage against the source inventory;
9. verify browser roles do not gain target-default privileges.

A SQL import without these checks is not a proven restore.

## Forward-rollout rehearsal

For a future migration window:

1. prove restored baseline effects and ACLs;
2. repair only independently proven historical versions as metadata;
3. require `supabase db push --dry-run` to show only approved pending files;
4. apply migrations in timestamp order;
5. run the committed post-rollout verifier;
6. run security advisors;
7. run relevant rollback-only authenticated/service smoke tests;
8. require zero pending migrations and unchanged source evidence after rollback.

This rehearsal does not authorize production. It proves the backup can be restored and advanced through the intended release path.

## Recovery acceptance record

A qualifying record should include:

- source application/release/database identity;
- source project and repository commit;
- backup timestamp and source inventory;
- plaintext checksum-set verification;
- encrypted artifact checksum and custody reference;
- explicitly accepted encryption method;
- restore target and database version;
- restore helper/verifier repository commit, tool versions and commands;
- baseline and preflight outputs;
- Auth trigger/signup proof;
- forward-rollout proof where applicable;
- operator, reviewer and cleanup confirmation.

Do not include secrets, raw Auth data or private backup URLs.

## Current gate status

At 25 July 2026:

- backup tooling/source bundle: **passed**;
- encrypted off-device custody and retrieval: **passed**;
- plaintext integrity and provenance: **passed**;
- corrected clean disposable restore: **passed**;
- Auth/profile/Storage/fingerprint checks: **passed**;
- history repair and migrations 21–35 rehearsal: **passed**;
- 63-check verifier, advisors and rollback-only smoke: **passed**;
- recovery acceptance: **passed**;
- production migrations 21–35: **passed**;
- production Netlify contract/deploy promotion: **passed**;
- periodic rehearsal/monitoring/final launch rollback: **open operational work**.

At 27 July 2026:

- contract-36 production write executed under an explicit recovery exception: **exception open**;
- owner-triggered encrypted backup workflow (`production-backup.yml`): **added; first successful run pending**;
- the recovery exception closes only after that first successful run and the owner's off-GitHub artifact download.

## Related documents

- `docs/quality/current-status.md`
- `docs/quality/risk-register.md`
- `docs/quality/reconciliations/2026-07-25-final-recovery-acceptance.md`
- `docs/quality/reconciliations/2026-07-25-contract-35-production-promotion.md`
- `docs/ops-hosted-migration-rollout.md`
- `docs/ops-pending-migrations.md`
- `.github/workflows/production-backup.yml`
- `scripts/database-rollout/create-production-backup.sh`
- `scripts/database-rollout/prepare-disposable-restore-target.sql`
- `scripts/database-rollout/production-backup-inventory.sql`
- `scripts/database-rollout/restore-rehearsal-verification.sql`
- `scripts/database-rollout/managed-schema-customizations.sql`