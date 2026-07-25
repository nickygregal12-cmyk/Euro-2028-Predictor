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

## Evidence completed and remaining

The off-device artifact was retrieved on 25 July 2026 and passed:

1. encrypted checksum verification after retrieval;
2. restricted decryption;
3. gzip and archive-path safety checks;
4. every plaintext checksum;
5. production project and repository provenance checks;
6. disposable baseline restore;
7. source-count and rollout-fingerprint comparison;
8. Auth/profile presence and signup-trigger verification;
9. rollback-only signup/profile creation;
10. migration-history repair for 1–20;
11. dry run and successful application of migrations 21–35;
12. all committed post-rollout checks;
13. zero pending migrations.

The first logical restore also exposed a restore-procedure defect. The disposable
target's default table privileges granted `anon` and `authenticated` direct
access to `public.entry_totals` while the source production object grants neither
role access. Production itself was checked read-only and was not exposed.

The disposable target was manually reconciled to the source ACL. All committed
checks, fingerprints, migration history and hosted advisors then passed, with no
security-advisor errors.

Remaining before recovery acceptance:

1. merge the reviewed restore-helper and verifier correction;
2. repeat a clean disposable restore from an empty target;
3. run `prepare-disposable-restore-target.sql` after roles and before schema;
4. require the baseline verifier to reject any restored client access to
   `entry_totals`;
5. migrate the clean replay through 21–35;
6. require the post-rollout verifier and security advisors to pass without any
   manual ACL reconciliation;
7. retain final non-secret evidence and cleanup confirmation.

The manually reconciled rehearsal proves the payload and migrations. A final
clean replay is required to prove the corrected restore procedure end to end.

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
11. Auth, critical public data, trigger, source-equivalent object privileges and fingerprint verification;
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
- include managed customization, restore-target preparation and verifier files;
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
- target `public` schema contains no user tables or views;
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
  --file prepare-disposable-restore-target.sql

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

`prepare-disposable-restore-target.sql` is mandatory for a new hosted Supabase
target. It temporarily removes inherited target defaults before object creation,
allowing the dump's explicit object grants and revocations to recreate the source
ACL. `schema.sql` restores the source project's own default privileges.

Review `auth-storage-diff.sql`. Apply only statements proven to be genuine source customizations not recreated elsewhere.

Stop on the first failure. Preserve non-secret output and do not skip objects.

## Baseline restore verification

Against the restored target:

1. run `verification/production-baseline-1-20-verification.sql`;
2. require all twenty structural checks true;
3. specifically require migration 9 to prove:
   - no `anon` access to `public.entry_totals`;
   - no `authenticated` access to `public.entry_totals`;
   - retained `service_role` access;
   - no direct browser-role grant rows on the view;
4. run `verification/production-preflight.sql` and require the exact source
   invariants/fingerprints;
5. compare source counts with the captured inventory;
6. verify Auth users and profiles exist without exposing rows;
7. verify `on_auth_user_created` exists and calls
   `public.handle_new_user()`;
8. prove signup/profile creation with a disposable test user;
9. confirm Storage is empty unless source inventory says otherwise;
10. confirm the baseline lacks both contract-35 RPCs.

Required fingerprints:

- predictions `320cf25d62767dee307d3602212909af`;
- ties `a4dcf183f5c48e3ba11ff75c59622598`;
- progression `0d7bc491daa9b24013204d061a2d38f1`.

A SQL import without these checks is not a proven restore.

## Preferred forward-rollout rehearsal

For highest confidence on the restored disposable target:

1. prove migration 1–20 structural effects and restored view ACLs;
2. apply the exact metadata-only history repair for 1–20;
3. require `supabase db push --dry-run` to show 21–35 only;
4. apply migrations 21–35;
5. run `verification/post-rollout-verification.sql`;
6. require every object, privilege, function ACL and data check true, including
   source-equivalent `entry_totals` privileges;
7. run security advisors and require no unexplained security error;
8. run authenticated bracket, submission-settlement and score-clear smoke tests.

This rehearsal does not authorize production. It proves the backup can be
restored and migrated through the intended release path.

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
- optional forward-rollout proof;
- operator, reviewer and cleanup confirmation.

Do not include secrets, raw Auth data or private backup URLs.

## Current gate status

At 25 July 2026:

- backup tooling/source bundle: **passed**;
- encrypted off-device custody and retrieval: **passed**;
- plaintext integrity and provenance: **passed**;
- disposable baseline restore: **passed**;
- Auth/profile/Storage/fingerprint checks: **passed**;
- history repair and migrations 21–35 rehearsal: **passed**;
- post-rollout verifier and zero-pending check: **passed**;
- initial restore ACL drift: **identified and manually reconciled**;
- security-advisor errors after reconciliation: **zero**;
- corrected clean restore replay: **not yet performed**;
- recovery acceptance: **blocked pending clean replay**;
- production migration window: **blocked**.

## Related documents

- `docs/quality/current-status.md`
- `docs/quality/risk-register.md`
- `docs/ops-hosted-migration-rollout.md`
- `docs/ops-pending-migrations.md`
- `docs/quality/reconciliations/2026-07-25-production-backup-and-repeat-audit.md`
- `scripts/database-rollout/create-production-backup.sh`
- `scripts/database-rollout/prepare-disposable-restore-target.sql`
- `scripts/database-rollout/production-backup-inventory.sql`
- `scripts/database-rollout/managed-schema-customizations.sql`
