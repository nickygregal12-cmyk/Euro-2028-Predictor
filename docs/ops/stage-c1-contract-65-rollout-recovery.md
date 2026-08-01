# Stage C1 contract 65 rollout and recovery evidence

**Status:** hosted operational evidence committed; rollout still requires the gates below
**Scope:** Stage C1 contract 65
**Governance:** satisfies issue #303's one coherent migration requirement  
**Hosted development:** remains contract 64  
**Production:** remains contract 63 and is out of scope

## Purpose

This runbook records how the Stage C1 competition-season foundation can later be
reviewed, applied to hosted development and recovered without treating a green
repository build as permission to mutate a remote database.

It covers only:

- `20260730235602_stage_c1_competition_season_foundation.sql`.

It does not authorise profile ownership, account erasure, pseudonymisation or any
other Stage C2 change. Issue #272 remains the blocking authority for that work.

## Current evidence

At the PR #317 repository candidate:

- deployment contract 65 names exactly 65 canonical migrations;
- a zero-to-current disposable Supabase rebuild succeeds with the existing Euro seed;
- database lint succeeds;
- all pgTAP suites succeed;
- TypeScript/PostgreSQL parity succeeds;
- Euro identifiers, fixture shape and the C2 ownership/deletion before-state remain guarded;
- no hosted Supabase migration and no production deploy has been performed.

This proves rebuildability and compatibility in a disposable environment. It does
not prove the current contents, privileges, load or recovery point of either hosted
project.

## First hosted attempt: failed and rolled back

The first attempt to apply contract 65 to development `iouzoutneyjpugbbtdem`
failed and rolled back atomically. Hosted development stayed at contract 64,
latest migration `20260730180000`, with no Stage C1 object present and
preservation counts unchanged.

The failing statement was the `bonus_competition_audit` scope backfill.
`bonus_competition_audit` is the one backfill target guarded by a row-level
`before update or delete` immutability trigger, and a row-level trigger does not
fire when a statement matches no rows. Every disposable rebuild reached Stage C1
with an empty audit table, so that statement had never run against a row. Hosted
development held nine audit rows, so it raised SQLSTATE 42501.

The correction amends the unhosted contract-65 migration rather than adding a
contract 66: every data-bearing database fails while applying contract 65, so it
can never reach a later repair. Around that one statement — and only that one —
the named trigger `block_bonus_audit_mutation` is suspended, the derived
`tournament_id` is written, and the trigger is enabled again before any further
migration work. The suspension is transactional DDL under `access exclusive`, so
no concurrent session observes it and a rollback anywhere later in the migration
restores it.

Recorded audit history is untouched: the statement writes only `tournament_id`,
only where it is still null, and derives it only through the existing immutable
`competition_id -> bonus_competitions.tournament_id` relationship. No audit event
is created to describe the backfill, because a schema-maintenance operation must
not appear in user-facing audit history.

The gap that let this reach hosted is closed by a migration-transition rehearsal
that crosses contract 64 to 65 with populated audit tables
(`tests/migration-transition/`), plus a source-order guard over the suspension
itself (`tests/scripts/stageC1AuditScopeBackfillSource.test.ts`).

## Required approval boundary

A hosted development write requires a new explicit owner approval after all of the
following are attached to the proposed action:

1. exact PR head and the migration checksum;
2. confirmed target project ID and current hosted contract;
3. fresh read-only preflight output;
4. a fresh restorable backup when the target contains data worth preserving;
5. the exact application and database postflight queries;
6. a named recovery decision and person authorised to invoke it.

Passing CI, Database parity or Browser E2E does not satisfy this approval.

## Hosted development preflight

Before applying the migration, verify read-only:

- the target is development Supabase project `iouzoutneyjpugbbtdem`;
- canonical migration history is exactly contract 64 and contains no unknown or
  partially applied Stage C migration;
- production project `vkfnsqdyhvtwyqkisxhk` is not the active target;
- current public-table RLS, browser grants and security-definer function ownership
  match the contract-64 repository expectations;
- the PR #246 auth foreign-key action matrix and direct ownership policies still
  match the frozen C2 before-state;
- no existing row violates the same-season relationships that contract 65 will
  validate;
- all existing tournaments have valid names, years and date bounds suitable for
  deterministic competition/season backfill;
- Euro 2028 identifiers and preservation counts are captured for tournaments,
  groups, teams, fixtures, players, entries, predictions, leagues, score events
  and every Bonus Game relation.

Capture the preflight output as a dated artefact. Do not copy the values into a
permanent live-status document as if they cannot change.

The canonical query and runner are committed at:

- `supabase/ops/stage-c1/stage-c1-hosted-preflight.sql`;
- `supabase/ops/stage-c1/stage-c1-audit-digest.sql`;
- `scripts/ops/run-stage-c1-hosted-preflight.mjs`.

From an exact, clean `origin/main`, linked to the approved development project,
run the pinned Supabase CLI and write the artifact outside the repository:

```bash
SUPABASE_BIN=/absolute/path/to/supabase \
node scripts/ops/run-stage-c1-hosted-preflight.mjs \
  --project-ref iouzoutneyjpugbbtdem \
  --output /secure/path/stage-c1-preflight-UTC.json
```

The runner refuses production, a different linked project, repository or
migration drift, a CLI version other than 2.84.2, an existing output file and a
repository-local evidence path. The SQL itself refuses anything other than the
complete, populated contract-64 before-state. The digest returned by this run is
the only canonical audit baseline; the earlier undefined digest is not a gate.

## Backup and restore point

If hosted development contains entries, leagues, scores or other data that matters,
create a fresh encrypted logical backup immediately before the write and prove it
can be read by the selected restore tooling.

The recovery point must include:

- `auth` data required to preserve the current ownership model;
- all `public` schema definitions and rows;
- migration history;
- role/grant information needed to reconstruct the Data API boundary.

A backup filename alone is not restore evidence. Record the backup checksum, tool
version, target contract and a successful restore or schema/data inspection in an
isolated destination.

The qualifying development command is committed at
`scripts/ops/create-verified-supabase-backup.mjs`. It reruns the canonical
preflight, requires it to match the supplied artifact, captures roles, public and
managed data (including `auth.users`), migration history and repository
verification SQL, restores the bundle into a disposable local Supabase, compares
the restored counts and preservation snapshots with the source, encrypts to the
owner-controlled age recipient and shreds plaintext staging files. It writes only
the encrypted artifact and a non-sensitive checksum/evidence sidecar outside the
repository.

```bash
BACKUP_AGE_PUBLIC_KEY='age1...' \
SUPABASE_BIN=/absolute/path/to/supabase \
SHRED_BIN=/absolute/path/to/shred \
node scripts/ops/create-verified-supabase-backup.mjs \
  --project-ref iouzoutneyjpugbbtdem \
  --preflight /secure/path/stage-c1-preflight-UTC.json \
  --backup-root /secure/path/development-backups
```

Do not substitute a newly invented recipient for the owner-controlled recovery
key. Missing encryption, Docker, PostgreSQL client or secure-deletion tooling is a
hard stop. A plaintext dump, a failed restore comparison or a cleanup failure is
not qualifying evidence.

## Apply sequence

Apply contract 65 as one coherent migration to the approved development target.

1. Reconfirm the target identity and contract 64 immediately before the write by
   rerunning the canonical preflight and backup comparison above.
2. Require `supabase db push --linked --dry-run` to name only
   `20260730235602_stage_c1_competition_season_foundation.sql`, then apply once
   with `supabase db push --linked` from the same exact main commit.
3. Confirm contract 65 is recorded once and no migration error occurred.
4. Run the complete postflight before changing any Netlify contract declaration.

Do not manually insert migration-history rows, replay a migration whose history is
uncertain, or run fragments from the file in the SQL editor.

## Postflight

The hosted development postflight must prove:

- exactly one recurring competition parent owns the existing Euro 2028 season;
- Euro 2028 retains its UUID and carries season key `2028`, kind `tournament`,
  timezone `Europe/London` and the expected lifecycle status;
- `competitions`, `competition_rounds`, `competition_lock_events` and
  `competition_awards` exist with RLS enabled and no unintended browser writes;
- all existing rows in the 33 direct season-scope relations have non-null UUID
  scope and zero cross-season violations;
- all composite foreign keys are validated;
- all 68 reviewed trigger bindings are present, including 18 always-on scope
  preparation bindings;
- lock events are append-only and lock/Joker functions resolve to the contract-65
  security-definer definitions with pinned `search_path`;
- the PR #246 auth/deletion matrix and ownership RLS predicates are unchanged;
- the preserved Euro and Bonus Game row counts match preflight;
- every historical `bonus_competition_audit` row carries a `tournament_id` equal to
  its competition parent's, with no row deleted, duplicated or added, and with the
  original ids, actions, details, actors and timestamps unchanged;
- `block_bonus_audit_mutation` is enabled, no other trigger is left disabled, and a
  rollback-safe probe proves audit `update` and `delete` still fail with 42501;
- authenticated Original, leagues, KO Predictor, LMS and Cup journeys work against
  the migrated development database;
- only after database and application verification, the non-production Netlify
  contract declaration may be changed to 65 and an exact-origin preview tested.

Any mismatch stops the rollout. Do not continue into production.

The canonical postflight query and comparison runner are committed at:

- `supabase/ops/stage-c1/stage-c1-hosted-postflight.sql`;
- `scripts/ops/run-stage-c1-hosted-postflight.mjs`.

```bash
SUPABASE_BIN=/absolute/path/to/supabase \
node scripts/ops/run-stage-c1-hosted-postflight.mjs \
  --project-ref iouzoutneyjpugbbtdem \
  --baseline /secure/path/stage-c1-preflight-UTC.json \
  --output /secure/path/stage-c1-postflight-UTC.json
```

The SQL asserts the database-local contract-65 shape and performs rollback-safe
audit mutation probes. The runner separately compares the audit digest, row
counts, Euro UUID and stable fields, auth foreign keys, ownership policies,
browser grants, RLS, function security and pre-existing trigger bindings with the
canonical preflight. An artifact is written only after every comparison passes.

## Recovery decisions

### Migration fails before commit

Stop immediately. Confirm PostgreSQL rolled back the failed migration transaction
and that migration history still reports the last fully applied contract. Do not
mark the migration complete manually. Preserve logs and diagnose in a disposable
copy before another attempt.

### Database reaches 65 but the application fails

If database integrity and preservation checks pass, roll the application back to
the last contract-64-compatible build. The repository adapter deliberately retains
contract-64 fallback while hosted rollout is staged. Leave the healthy database at
65 and fix forward in a reviewed PR; do not destructively remove columns merely to
match an older client.

### Integrity, privilege or preservation postflight fails

Quarantine the migrated development project from application traffic. Restore the
preflight backup into a separate recovery project or freshly recreated development
project, then verify contract 64, preserved counts, privileges and authenticated
journeys before repointing any environment.

Do not attempt an improvised down migration. Contract 65 adds non-null columns,
composite constraints, triggers and lock evidence; deleting them after writes could
lose information or reopen prediction boundaries. A tested restore is the rollback
mechanism for a committed integrity failure.

### A defect is safe to fix forward

Fix forward only when all of these are true:

- preserved data and ownership checks pass;
- no browser privilege is broader than intended;
- locks fail closed and no settled scope can reopen;
- the defect is isolated to compatibility or presentation;
- the application can remain on or return to a safe version while the fix is reviewed.

Otherwise restore.

## Production boundary

This document does not authorise contract 64 or 65 on production. Production
remains contract 63 with deploys paused. A later production milestone requires a
fresh production-specific preflight, backup/restore proof, explicit approval,
ordered migration plan, exact approved application build and production smoke.

## Exit from PR draft

PR #317 may leave draft only when:

- ordinary CI and disposable Database parity are green on the exact head;
- authenticated disposable-browser journeys are green;
- any unavailable Netlify preview is recorded as external missing evidence rather
  than misreported as a passing smoke;
- the single migration remains coherent and reviewable before merge;
- a reviewer confirms this recovery model is adequate for a later hosted
  development proposal;
- the PR continues to make no hosted-alignment or C2 claim.
