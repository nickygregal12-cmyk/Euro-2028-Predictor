# Production backup and restore rehearsal

**Status date:** 25 July 2026  
**Scope:** Recovery evidence required before any production migrations 21–35 window.  
**Authority:** This runbook prepares, records and verifies recovery evidence. It does not authorize a migration or production restore.

## Current verified position

Production Supabase project `vkfnsqdyhvtwyqkisxhk` is on the Free plan. Automatic daily backups and PITR must not be assumed; the release gate therefore relies on a manually created logical export and a proven disposable restore.

The rollout-sensitive source shape verified on 25 July is:

| Item | Current rollout value |
| --- | ---: |
| Submitted entries | 1 |
| Match predictions | 36 |
| Tie resolutions | 2 |
| Progression rows | 8 |
| Stored match scores | 0 |
| Score events / rank history | 0 / 0 |
| Storage buckets / objects | 0 / 0 |

Total Auth users, profiles and unsubmitted entries may legitimately change and are not rollout guards.

The database has one intentional managed-schema customization: `auth.users` trigger `on_auth_user_created`, executing `public.handle_new_user()`.

## Recovery evidence completed on 25 July 2026

A fresh source bundle was created on the owner’s Mac outside the repository. Operator-observed evidence confirms it contains:

- `roles.sql`;
- `schema.sql`;
- COPY-format `data.sql`;
- `auth.users` and `public.profiles` data;
- database inventory;
- repository commit and migration inventory;
- Supabase, PostgreSQL and Docker version records;
- managed Auth customization evidence;
- baseline, preflight and post-rollout verification scripts;
- recursive `SHA256SUMS`.

Observed validation:

- all required files were present and non-empty;
- core files had owner-only permissions;
- every plaintext checksum passed;
- the bundle was archived and encrypted with OpenSSL AES-256-CBC using PBKDF2 and 250,000 iterations;
- the encrypted archive decrypted and listed successfully;
- the encrypted archive SHA-256 checksum passed;
- the encrypted archive and checksum file were copied off the working Mac.

No credential, raw Auth record, archive passphrase, encrypted checksum value or private storage URL is stored in the repository.

### Method acceptance note

Issue #32 originally described 7-Zip AES-256 as the default. The artifact actually created used OpenSSL AES-256-CBC with PBKDF2. Recovery acceptance must explicitly accept the executed method or require a replacement artifact; do not silently describe it as 7-Zip evidence.

## Evidence still required

The artifact is not qualifying recovery evidence until all of the following pass:

1. retrieve the encrypted archive from the off-device custody location;
2. verify the encrypted archive checksum after retrieval;
3. decrypt into a restricted temporary directory on a trusted machine;
4. verify every plaintext checksum from `SHA256SUMS`;
5. restore roles, schema, data and managed customization to an approved disposable Supabase-compatible target;
6. verify source counts and all rollout fingerprints;
7. verify all Auth users and profiles without exposing their contents;
8. verify `on_auth_user_created -> public.handle_new_user()`;
9. create/remove one disposable test Auth user and prove profile creation;
10. verify Storage state;
11. preferably rehearse the exact history repair and migrations 21–35;
12. retain a non-secret evidence record and cleanup confirmation.

A local or encrypted archive that has not been restored does not prove recovery.

## What qualifies as recovery evidence

All of the following are required:

1. fresh logical source bundle after the release/write freeze;
2. separate roles, schema and data dumps;
3. `auth.users` and `public.profiles` present;
4. managed Auth/Storage drift evidence and signup-trigger restore statement;
5. source inventory, repository/tool provenance, migration list and checksums;
6. restricted plaintext permissions;
7. approved encryption method;
8. verified off-machine copy with custody and retention record;
9. checksum verification after retrieval;
10. successful disposable restore;
11. Auth, critical public data, trigger and fingerprint verification;
12. preferably successful forward migration rehearsal.

A Netlify rollback is not a database rollback.

## Safety boundary

- Never commit a backup bundle, database connection string or password.
- Never run restore commands against production.
- Never run `supabase db reset --linked`.
- Never use development Supabase as a production fallback.
- Never expose database/archive passwords in screenshots, docs, transcripts or issue comments.
- Never skip a failed restore object or edit a dump casually.
- Never use an unrestored backup to authorize production migration.
- Treat the bundle as highly sensitive because it includes Auth identities and password hashes.

## Source bundle creation procedure

This procedure remains the canonical repeatable method for future backups. Use the repository script where local files are available:

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
- include managed customization and verifier files;
- generate manifest/provenance and recursive checksums;
- set owner-only permissions;
- never migrate, reset, seed or upload a project.

The 25 July bundle was assembled through equivalent linked Supabase CLI dump steps after URI authentication difficulties. The resulting roles/schema/data files and supporting evidence passed the same critical-table, permission and checksum checks. Future runs should prefer the fail-closed script where practical.

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

## Restore target

The owner confirmed project `eckuehkcmkhuhmsfxtxu` is disposable, contains nothing required and may be overwritten. This confirmation permits a restore rehearsal; it does not permit any production change.

Before restoring, re-confirm:

- exact target project reference;
- target database version;
- operator and start time;
- target contains no required data;
- the production and development references are not being used.

## Baseline restore sequence

Use a target-specific `RESTORE_DB_URL`. Never reuse a production variable.

```bash
read -s -p "Disposable restore database URL: " RESTORE_DB_URL
export RESTORE_DB_URL
printf '\n'

psql "$RESTORE_DB_URL" \
  --single-transaction \
  --variable ON_ERROR_STOP=1 \
  --file roles.sql

psql "$RESTORE_DB_URL" \
  --single-transaction \
  --variable ON_ERROR_STOP=1 \
  --file schema.sql

psql "$RESTORE_DB_URL" \
  --single-transaction \
  --variable ON_ERROR_STOP=1 \
  --command 'SET session_replication_role = replica' \
  --file data.sql

psql "$RESTORE_DB_URL" \
  --single-transaction \
  --variable ON_ERROR_STOP=1 \
  --file managed-schema-customizations.sql
```

Review `auth-storage-diff.sql`. Apply only statements proven to be genuine source customizations not recreated elsewhere.

Stop on the first failure. Preserve non-secret output and do not skip objects.

## Baseline restore verification

Against the restored target:

1. run `verification/production-baseline-1-20-verification.sql` and require all twenty checks true;
2. run `verification/production-preflight.sql` and require the exact source invariants/fingerprints;
3. compare source counts with the captured inventory;
4. verify Auth users and profiles exist without exposing rows;
5. verify `on_auth_user_created` exists and calls `public.handle_new_user()`;
6. prove signup/profile creation with a disposable test user;
7. confirm Storage is empty unless source inventory says otherwise;
8. confirm the baseline lacks both contract-35 RPCs.

Required fingerprints:

- predictions `320cf25d62767dee307d3602212909af`;
- ties `a4dcf183f5c48e3ba11ff75c59622598`;
- progression `0d7bc491daa9b24013204d061a2d38f1`.

A SQL import without these checks is not a proven restore.

## Preferred forward-rollout rehearsal

For highest confidence on the restored disposable target:

1. prove migration 1–20 structural effects;
2. apply the exact metadata-only history repair for 1–20;
3. require `supabase db push --dry-run` to show 21–35 only;
4. apply migrations 21–35;
5. run `verification/post-rollout-verification.sql` and require every object, privilege and data check true;
6. run security advisors;
7. run authenticated bracket, submission-settlement and score-clear smoke tests.

This rehearsal does not authorize production. It proves the backup can be restored and migrated through the intended release path.

## Recovery acceptance record

A qualifying record should include:

- source application/release/database identity;
- source project and repository commit;
- backup timestamp and source inventory;
- plaintext checksum-set verification;
- encrypted artifact checksum and custody reference;
- explicitly accepted encryption method;
- restore target and database version;
- restore tool versions and commands;
- baseline and preflight outputs;
- Auth trigger/signup proof;
- optional forward-rollout proof;
- operator, reviewer and cleanup confirmation.

Do not include secrets, raw Auth data or private backup URLs.

## Current gate status

At 25 July 2026:

- backup tooling/runbook: prepared;
- fresh production source bundle: **created and plaintext checksums verified**;
- encrypted archive: **created, locally decrypted and checksum verified**;
- off-device copy: **owner-confirmed**;
- off-device retrieval proof: **not performed**;
- disposable restore: **not performed**;
- recovery acceptance: **not granted**;
- production migration window: **blocked**.

## Related documents

- `docs/quality/current-status.md`
- `docs/quality/risk-register.md`
- `docs/ops-hosted-migration-rollout.md`
- `docs/ops-pending-migrations.md`
- `docs/quality/reconciliations/2026-07-25-production-backup-and-repeat-audit.md`
- `scripts/database-rollout/create-production-backup.sh`
- `scripts/database-rollout/production-backup-inventory.sql`
- `scripts/database-rollout/managed-schema-customizations.sql`
