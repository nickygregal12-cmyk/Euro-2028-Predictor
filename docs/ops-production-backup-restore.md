# Production backup and restore rehearsal

**Status date:** 24 July 2026  
**Scope:** Recovery evidence required before any production migrations 21–35 window.  
**Authority:** This runbook prepares and verifies a backup. It does not authorize a migration or production restore.

## Current verified position

Production Supabase project `vkfnsqdyhvtwyqkisxhk` is healthy and belongs to a **Free-plan** organization.

Official Supabase guidance states that automatic daily backups are provided for Pro, Team and Enterprise projects. Free projects should create regular logical exports with `supabase db dump` and retain them off-site. Point-in-time recovery is not available on the current plan.

Read-only production inventory found:

| Item | Current value |
| --- | ---: |
| Database size | approximately 12 MB |
| Auth users | 4 |
| Public profiles | 4 |
| Entries | 4 |
| Submitted entries | 1 |
| Match predictions | 36 |
| Tie resolutions | 2 |
| Progression rows | 8 |
| Stored match scores | 0 |
| Storage buckets/objects | 0 / 0 |
| Edge Functions | 0 |

The database has one intentional customization on a managed schema: `auth.users` trigger `on_auth_user_created`, executing `public.handle_new_user()`. The Realtime publication exists but currently contains no published table.

There is no existing dump, checksum, off-site custody record or restore-test evidence in the repository. Backup/recovery remains an open rollout gate.

## What qualifies as recovery evidence

All of the following are required:

1. A fresh logical bundle created after the production write/deploy freeze and before migrations begin.
2. Separate roles, schema and data dumps.
3. `auth.users` visibly present in the data dump.
4. Managed Auth/Storage drift evidence plus the known signup-trigger restore statement.
5. Source inventory, repository commit, CLI versions, migration list and SHA-256 checksums.
6. Restricted permissions while the plaintext staging bundle exists.
7. Encryption using an organization-approved method.
8. A copy stored off the working machine with recorded custody, retention and retrieval details.
9. Successful checksum verification after retrieval.
10. Successful restore to a disposable Supabase-compatible target.
11. Verification of Auth users, signup trigger, critical public data and rollout-guard fingerprints.
12. Preferably, successful application of migrations 21–35 to the restored disposable target followed by the exact post-rollout verifier.

A local plaintext directory, a Netlify rollback or a dump that has not been restored does **not** qualify.

## Safety boundary

- Never commit a backup bundle or database connection string.
- Never run restore commands against production.
- Never use `db reset --linked`.
- Never use development Supabase as a production fallback.
- Never expose the database password in screenshots, docs, terminal transcripts or issue comments.
- Never use an unreviewed backup to justify a production migration.
- The backup contains Auth identities and password hashes; treat it as highly sensitive.

## Prerequisites

On the operator’s trusted machine:

- clean checkout of the owner-approved repository commit;
- Supabase CLI and Docker;
- PostgreSQL `psql` client;
- Python 3;
- verified production database connection string, preferably the IPv4-compatible session pooler string where required;
- secure local staging destination outside the repository;
- approved encryption and off-site storage destination;
- named operator and recovery decision owner.

Verify tools without printing secrets:

```bash
supabase --version
psql --version
docker --version
git status --short
```

## Create the staging bundle

From the repository root, set values in the current shell only:

```bash
read -s -p "Production database URL: " PRODUCTION_DB_URL
export PRODUCTION_DB_URL
printf '\n'

export BACKUP_ROOT="/absolute/path/on/secure-volume"
export CONFIRM_PRODUCTION_PROJECT_REF="vkfnsqdyhvtwyqkisxhk"

./scripts/database-rollout/create-production-backup.sh
```

The script:

- refuses a dirty repository;
- refuses an output path inside the repository;
- validates the production project reference;
- captures read-only database inventory;
- creates `roles.sql`, `schema.sql` and `data.sql`;
- requires `auth.users` and `public.profiles` in the data dump;
- captures Auth/Storage drift evidence with `supabase db diff`;
- includes the known managed-schema signup-trigger restoration statement;
- includes exact verification scripts and migration-file inventory;
- creates a manifest and `SHA256SUMS`;
- writes files with owner-only permissions;
- never links, migrates, resets, seeds or uploads a project.

The generated directory is a sensitive **plaintext staging bundle**. It is deliberately marked `qualifying_recovery_evidence = false` until encryption, off-site custody and restore rehearsal are complete.

## Inspect before encryption

Without printing user data, confirm:

```bash
cd "/path/to/euro28-prod-<UTC_TIMESTAMP>"

ls -la
shasum -a 256 -c SHA256SUMS

grep -E 'COPY[[:space:]]+"?auth"?\."?users"?' data.sql >/dev/null
grep -E 'COPY[[:space:]]+"?public"?\."?profiles"?' data.sql >/dev/null
```

Review:

- `manifest.json`;
- `database-state.json`;
- `migration-files.txt`;
- `auth-storage-diff.sql`;
- `managed-schema-customizations.sql`.

Any unexpected Auth/Storage diff must be reviewed and converted into an explicit restore step before the backup qualifies.

## Encrypt and store off-site

Use the organization’s approved encryption method. Examples include an encrypted managed volume or an encrypted archive created with an approved public-key tool. Do not place an encryption passphrase in an environment file, shell history or repository.

Record outside the repository where appropriate, and in the change record without secrets:

- encrypted artifact name;
- SHA-256 checksum of the encrypted artifact;
- creation timestamp;
- operator;
- encryption method/key identifier, not the private key;
- off-site storage system and retrieval reference;
- retention/expiry;
- second-person verification where required.

After the encrypted off-site copy has been verified, securely remove unnecessary plaintext copies according to organizational policy.

## Restore rehearsal target

Use a disposable Supabase-compatible target that can be destroyed after evidence is retained. The target must not be production or the active development project.

Before restoring, record:

- disposable project/target identifier;
- database version;
- operator;
- start time;
- proof that the target contains no required data;
- explicit confirmation that modification/destruction of that target is allowed.

Retrieve the encrypted artifact to a trusted machine, decrypt into a restricted temporary directory and verify:

```bash
shasum -a 256 -c SHA256SUMS
```

Stop on any checksum failure.

## Baseline restore sequence

Use the disposable target connection string as `RESTORE_DB_URL`. Never reuse the production URL variable.

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

Review `auth-storage-diff.sql`. Apply only reviewed statements that represent real production customizations not already recreated by the repository/managed customization file. An empty file is acceptable when version-controlled migrations fully explain the managed-schema state.

If a command fails, preserve the exact output and stop. Do not skip a failed object or edit the dump casually.

## Baseline verification

Against the restored disposable target:

1. Run `verification/production-baseline-1-20-verification.sql` and require every check true.
2. Run `verification/production-preflight.sql` and require the source invariants/fingerprints to match.
3. Compare restored counts with `database-state.json`.
4. Verify all Auth users and profiles exist without exposing their contents.
5. Verify `on_auth_user_created` exists and calls `public.handle_new_user()`.
6. Create and remove one disposable test Auth user through an approved test path; confirm the profile trigger works.
7. Confirm Storage remains empty unless the source inventory changed before backup.
8. Confirm both migrations-33/35 RPCs remain absent in the restored **baseline**, matching the pre-rollout production state.

A restore that only imports SQL without these checks is not proven.

## Optional but preferred forward-rollout rehearsal

For the highest-confidence migration gate, use the restored disposable target to rehearse the exact production forward path:

1. Link the CLI to the disposable project only.
2. Prove migrations 1–20 structural effects.
3. Apply the exact 1–20 migration-history repair on the disposable target.
4. Require `supabase db push --dry-run` to show migrations 21–35 only.
5. Apply migrations 21–35.
6. Run `verification/post-rollout-verification.sql` and require every value true.
7. Run security advisors.
8. Run authenticated bracket, submission-settlement and score-clearing smoke tests.

This does not authorize production. It proves the actual backup can be restored and migrated through the intended release path.

## Evidence record

A qualifying evidence record should include:

- source application-code baseline and current Netlify release;
- source Supabase project reference;
- backup timestamp and repository commit;
- source database size/count inventory;
- plaintext bundle `SHA256SUMS`;
- encrypted artifact checksum and storage reference;
- restore-target identifier and database version;
- restore commands/tool versions;
- baseline verifier and source preflight outputs;
- signup-trigger test result;
- optional migrations 21–35 dry-run/push/post-verification evidence;
- operator and independent reviewer;
- cleanup confirmation for disposable target and plaintext staging data.

Do not include secrets or raw Auth data in the evidence record.

## Current gate status

At 24 July 2026:

- backup tooling and runbook: prepared in repository;
- actual production bundle: **not created**;
- encrypted off-site artifact: **not present/verified**;
- restore rehearsal: **not performed**;
- production migration window: **blocked**.

## Related documents

- `docs/quality/current-status.md`
- `docs/quality/risk-register.md`
- `docs/ops-hosted-migration-rollout.md`
- `docs/ops-pending-migrations.md`
- `docs/quality/reconciliations/2026-07-24-production-recovery-readiness.md`
- `scripts/database-rollout/create-production-backup.sh`
- `scripts/database-rollout/production-backup-inventory.sql`
- `scripts/database-rollout/managed-schema-customizations.sql`
