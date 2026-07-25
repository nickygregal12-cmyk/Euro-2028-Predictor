# Production backup and restore rehearsal

**Status date:** 25 July 2026  
**Scope:** Canonical recovery procedure and completed evidence for the contract-35 production rollout.  
**Authority:** This document prepares, records and verifies recovery evidence. It does not by itself authorize a production restore or future migration.

## Current verified position

Production Supabase project `vkfnsqdyhvtwyqkisxhk` is on the Free plan. Automatic daily backups and PITR must not be assumed. Production recovery therefore relies on fresh logical exports, encrypted off-machine custody and proven disposable restores.

The contract-35 rollout is complete. Production now has exactly migrations 1–35 and zero pending migrations through 35. The accepted recovery artifact and corrected restore procedure were proven before production execution.

Latest records:

- recovery acceptance: `docs/quality/reconciliations/2026-07-25-final-recovery-acceptance.md`;
- production execution: `docs/quality/reconciliations/2026-07-25-contract-35-production-promotion.md`.

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

## Related documents

- `docs/quality/current-status.md`
- `docs/quality/risk-register.md`
- `docs/quality/reconciliations/2026-07-25-final-recovery-acceptance.md`
- `docs/quality/reconciliations/2026-07-25-contract-35-production-promotion.md`
- `docs/ops-hosted-migration-rollout.md`
- `docs/ops-pending-migrations.md`
- `scripts/database-rollout/create-production-backup.sh`
- `scripts/database-rollout/prepare-disposable-restore-target.sql`
- `scripts/database-rollout/production-backup-inventory.sql`
- `scripts/database-rollout/managed-schema-customizations.sql`