# Stage C1 contract 66 rollout and recovery evidence

**Status:** repository/disposable evidence only  
**Scope:** PR #317, contracts 65–66  
**Hosted development:** remains contract 64  
**Production:** remains contract 63 and is out of scope

## Purpose

This runbook records how the Stage C1 competition-season foundation can later be
reviewed, applied to hosted development and recovered without treating a green
repository build as permission to mutate a remote database.

It covers only:

- `20260730235602_stage_c1_competition_season_foundation.sql`;
- `20260730235721_stage_c1_competition_season_compatibility.sql`.

It does not authorise profile ownership, account erasure, pseudonymisation or any
other Stage C2 change. Issue #272 remains the blocking authority for that work.

## Current evidence

At the PR #317 repository candidate:

- deployment contract 66 names exactly 66 canonical migrations;
- a zero-to-current disposable Supabase rebuild succeeds with the existing Euro seed;
- database lint succeeds;
- all pgTAP suites succeed;
- TypeScript/PostgreSQL parity succeeds;
- Euro identifiers, fixture shape and the C2 ownership/deletion before-state remain guarded;
- no hosted Supabase migration and no production deploy has been performed.

This proves rebuildability and compatibility in a disposable environment. It does
not prove the current contents, privileges, load or recovery point of either hosted
project.

## Required approval boundary

A hosted development write requires a new explicit owner approval after all of the
following are attached to the proposed action:

1. exact PR head and the two migration checksums;
2. confirmed target project ID and current hosted contract;
3. fresh read-only preflight output;
4. a fresh restorable backup when the target contains data worth preserving;
5. the exact application and database postflight queries;
6. a named recovery decision and person authorised to invoke it.

Passing CI, Database parity or Browser E2E does not satisfy this approval.

## Hosted development preflight

Before applying either migration, verify read-only:

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

## Apply sequence

Apply contracts 65 and 66 sequentially to the same approved development target.
Do not publish a contract-66 application between them.

1. Reconfirm the target identity and contract 64 immediately before the write.
2. Apply contract 65 using the repository migration runner.
3. Confirm contract 65 is recorded once and no migration error occurred.
4. Apply contract 66 using the same runner and connection context.
5. Confirm the highest canonical version and count are exactly contract 66.
6. Run the complete postflight before changing any Netlify contract declaration.

Do not manually insert migration-history rows, skip contract 65, replay a migration
whose history is uncertain, or run fragments from either file in the SQL editor.

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
- lock events are append-only and lock/Joker functions resolve to the contract-66
  security-definer definitions with pinned `search_path`;
- the PR #246 auth/deletion matrix and ownership RLS predicates are unchanged;
- the preserved Euro and Bonus Game row counts match preflight;
- authenticated Original, leagues, KO Predictor, LMS and Cup journeys work against
  the migrated development database;
- only after database and application verification, the non-production Netlify
  contract declaration may be changed to 66 and an exact-origin preview tested.

Any mismatch stops the rollout. Do not continue into production.

## Recovery decisions

### Migration fails before commit

Stop immediately. Confirm PostgreSQL rolled back the failed migration transaction
and that migration history still reports the last fully applied contract. Do not
mark the migration complete manually. Preserve logs and diagnose in a disposable
copy before another attempt.

### Database reaches 66 but the application fails

If database integrity and preservation checks pass, roll the application back to
the last contract-64-compatible build. The repository adapter deliberately retains
contract-64 fallback while hosted rollout is staged. Leave the healthy database at
66 and fix forward in a reviewed PR; do not destructively remove columns merely to
match an older client.

### Integrity, privilege or preservation postflight fails

Quarantine the migrated development project from application traffic. Restore the
preflight backup into a separate recovery project or freshly recreated development
project, then verify contract 64, preserved counts, privileges and authenticated
journeys before repointing any environment.

Do not attempt an improvised down migration. Contracts 65–66 add non-null columns,
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

This document does not authorise contracts 64, 65 or 66 on production. Production
remains contract 63 with deploys paused. A later production milestone requires a
fresh production-specific preflight, backup/restore proof, explicit approval,
sequential migration plan, exact approved application build and production smoke.

## Exit from PR draft

PR #317 may leave draft only when:

- ordinary CI and disposable Database parity are green on the exact head;
- authenticated disposable-browser journeys are green;
- any unavailable Netlify preview is recorded as external missing evidence rather
  than misreported as a passing smoke;
- the exact two-migration split is accepted or consolidated before merge;
- a reviewer confirms this recovery model is adequate for a later hosted
  development proposal;
- the PR continues to make no hosted-alignment or C2 claim.
