# Production recovery readiness reconciliation

**Date:** 24 July 2026  
**Production Supabase:** `vkfnsqdyhvtwyqkisxhk`  
**Organization plan:** Free  
**Scope:** Read-only recovery inventory and repository backup/restore preparation.  
**Production mutations:** None.

## Verdict

The production migration window remains blocked by missing recovery evidence.

The repository now contains fail-closed tooling and a detailed restore-rehearsal runbook, but no production dump has been created, encrypted, stored off-site or restored. Prepared tooling is not backup evidence.

Because the organization is on Supabase Free, the project must not rely on automatic daily backups or point-in-time recovery. Official Supabase guidance recommends regular logical exports with `supabase db dump` for Free projects and off-site retention. Automatic daily backups are documented for Pro, Team and Enterprise plans; PITR requires an eligible paid plan/add-on.

## Read-only production inventory

Production was inspected through read-only SQL and project metadata.

### Database

| Item | Value |
| --- | --- |
| Health | Active/healthy |
| Region | `eu-west-2` |
| PostgreSQL | 17.6 |
| Database size | approximately 12 MB |
| Public schema footprint | approximately 2.4 MB |
| Auth schema footprint | approximately 2.6 MB |
| Storage schema footprint | approximately 640 KB |

### Data counts

| Object | Count |
| --- | ---: |
| Auth users | 4 |
| Profiles | 4 |
| Entries | 4 |
| Submitted entries | 1 |
| Match predictions | 36 |
| Tie resolutions | 2 |
| Progression rows | 8 |
| Stored match scores | 0 |
| Storage buckets | 0 |
| Storage objects | 0 |
| Edge Functions | 0 |

### Recovery-relevant configuration

- one intentional managed-schema customization exists: trigger `auth.on_auth_user_created` on `auth.users`, calling `public.handle_new_user()`;
- the Supabase Realtime publication exists and currently publishes no table;
- no logical replication subscription exists;
- no application-specific custom login/database role was identified; one Supabase-managed ETL role is present;
- custom application tables/functions/triggers are concentrated in repository migrations and the public schema;
- production migration-history metadata remains absent;
- production remains on the original twenty-migration semantic shape.

## Repository evidence search

A repository search found runbook/TODO references to backup and restore, but no actual:

- roles/schema/data dump;
- encrypted backup artifact;
- dump checksum;
- off-site custody/retrieval record;
- restore-target record;
- restore verification output;
- backup-created timestamp tied to a production freeze;
- independently verified recovery test.

`OPS-003` therefore remains open. The production rollout must not proceed on the basis of documentation alone.

## Prepared backup package

This workstream adds:

- `scripts/database-rollout/create-production-backup.sh`;
- `scripts/database-rollout/production-backup-inventory.sql`;
- `scripts/database-rollout/managed-schema-customizations.sql`;
- `docs/ops-production-backup-restore.md`;
- automated Bash syntax and safety-policy tests;
- `.gitignore` protections for common local backup bundle names.

The creation script is deliberately fail-closed. It requires:

- explicit production project acknowledgement;
- a production DB URL containing the expected project reference;
- clean repository provenance;
- a secure output directory outside the repository;
- Supabase CLI, Docker, `psql`, Git and Python 3.

It creates:

- `roles.sql`;
- `schema.sql`;
- `data.sql` using COPY;
- read-only `database-state.json`;
- Auth/Storage drift evidence;
- the known signup-trigger restoration statement;
- repository commit and migration inventory;
- CLI/tool versions;
- exact verification scripts;
- `manifest.json`;
- recursive `SHA256SUMS`.

It verifies that the data dump visibly contains `auth.users` and `public.profiles`. It never links, migrates, resets, seeds or uploads a project.

## Sensitive-data position

The logical data dump contains Auth identities and password hashes. The script therefore:

- sets owner-only file/directory permissions;
- refuses repository-local output;
- marks the bundle as sensitive plaintext;
- records `qualifying_recovery_evidence = false` in the manifest;
- requires later encryption, off-site custody and restore proof.

The script does not choose an encryption key or storage platform because those are organizational custody decisions and must not be embedded in repository code.

## Managed Auth/Storage schemas

Supabase logical dumps intentionally filter managed Auth and Storage schemas. Production nevertheless has a custom signup trigger on `auth.users`.

Recovery therefore requires both:

1. Auth user data in `data.sql`;
2. explicit restoration/proof of `on_auth_user_created` after `public.handle_new_user()` exists.

The package captures Auth/Storage drift evidence using `supabase db diff --schema auth,storage` and includes an idempotent known-customization SQL file. Any unexpected non-empty drift must be reviewed before the backup can qualify.

Storage has no buckets or objects at the current snapshot, so no separate object download is required now. A fresh inventory immediately before backup is still mandatory because this can change.

## Required restore proof

A qualifying backup must be restored to a disposable Supabase-compatible target—not production and not the active development project.

Minimum proof:

1. encrypted artifact retrieved successfully;
2. encrypted and plaintext checksums verified;
3. roles, schema and data restored without ignored errors;
4. baseline migrations 1–20 structural verifier passes;
5. production source preflight and rollout fingerprints pass;
6. all four Auth users and profiles are present;
7. signup-trigger behavior is tested with a disposable user;
8. Storage state matches the source inventory;
9. both migrations-33/35 RPCs are absent in the restored pre-rollout baseline;
10. disposable target and plaintext staging data are cleaned up after evidence retention.

Preferred additional proof:

- repair migration history 1–20 on the disposable target;
- require dry run showing 21–35 only;
- apply migrations 21–35;
- run the exact post-rollout verifier and security advisors;
- smoke-test bracket persistence, submission settlement and score clearing.

## Current gate status

| Recovery requirement | Status |
| --- | --- |
| Production size/scope inventory | Complete, read-only |
| Free-plan backup policy confirmed | Complete |
| Backup creation tooling | Prepared in repository |
| Restore runbook | Prepared in repository |
| Script syntax/safety test | Added; CI required |
| Actual production logical bundle | Not created |
| Encrypted off-site artifact | Not present |
| Artifact retrieval/checksum proof | Not performed |
| Disposable restore | Not performed |
| Restore validation | Not performed |
| Forward 21–35 rehearsal from actual dump | Not performed |
| Production rollout approval | Blocked |

## Next approved operator action

Once the owner chooses the trusted machine, secure storage destination, encryption/custody method, operator and recovery reviewer:

1. freeze production writes/deployments;
2. verify the current Netlify release and executable application baseline;
3. rerun production source/baseline preflights;
4. run `create-production-backup.sh` with the production DB URL supplied securely;
5. encrypt and store the artifact off-site;
6. retrieve and restore it to a disposable target;
7. retain non-secret verification evidence;
8. only then consider approving the migrations 21–35 production window.

No step in this reconciliation authorizes those future write operations.

## Related documents

- `docs/ops-production-backup-restore.md`
- `docs/ops-hosted-migration-rollout.md`
- `docs/quality/current-status.md`
- `docs/quality/risk-register.md`
- `docs/quality/reconciliations/2026-07-24-post-merge-production-release-state.md`
