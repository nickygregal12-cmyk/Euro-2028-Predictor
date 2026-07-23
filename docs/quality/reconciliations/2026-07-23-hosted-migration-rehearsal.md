# Hosted migrations 21–33 rehearsal and production preflight

**Workstream:** `OPS-006-HOSTED-SCHEMA-COMPATIBILITY`  
**Date:** 23 July 2026  
**Repository baseline:** `main` after PR #15  
**Development project:** `iouzoutneyjpugbbtdem`  
**Production project:** `vkfnsqdyhvtwyqkisxhk`

## Verdict

| Area | Result |
| --- | --- |
| Disposable local rebuild | **Passed previously in database-parity CI.** All 33 committed migrations rebuild, lint, run pgTAP and pass TypeScript/PostgreSQL differential verification. |
| Hosted development data reset | **Completed.** Disposable competition data was cleared while Auth users, profiles and the 51-match reference skeleton were preserved. |
| Hosted development migrations 21–33 | **Applied and structurally verified.** |
| Production entry replay | **Passed in development using the exact normalized production payload.** |
| Production read-only structural preflight | **Passed.** |
| Production rollout | **Not performed. Requires an approved window, backup evidence, migration-history reconciliation and the operator procedure in `docs/ops-hosted-migration-rollout.md`.** |

This work does not claim that production is current. Production remains on the original 20-migration schema until a separate explicitly approved rollout is completed.

## Safety boundary

- Production was queried read-only only.
- No production schema, data, Auth setting, Netlify setting or deployment was changed.
- Development-only disposable competition data was deleted by design.
- Development Auth users and profiles were retained.
- The repository migration files were not squashed, renamed or rewritten.
- No failing preflight was bypassed.

## Development reset

The development database originally contained:

- 23 profiles and 23 entries;
- 22 submitted entries;
- 20 legacy 16-row progression snapshots;
- two current 8-row progression snapshots;
- 12 matches with legacy scores;
- leagues, predictions, derived positions, score events and rank history generated for hostile seed testing.

The controlled reset removed tournament-scoped disposable state:

- entries and all cascading predictions, bonuses, ties, positions, progression and score events;
- leagues and memberships;
- rank history and rate-limit events;
- the 12 unclassified legacy match scores.

It preserved:

- 23 Auth-backed profiles;
- the Euro 2028 tournament;
- six groups and 24 provisional teams;
- the 51-match group and knockout reference skeleton.

The result-lifecycle preflight then saw zero legacy scores and did not need to guess regulation, extra-time or penalty classifications.

## Migration application record

Migrations were applied in repository timestamp order:

| # | Migration | Development result |
| --- | --- | --- |
| 21 | `20260723170000_predictor_internal_schema.sql` | Passed |
| 22 | `20260723173000_predicted_group_order_resolver.sql` | Passed |
| 23 | `20260723174500_harden_entry_lock_functions.sql` | Passed |
| 24 | `20260723175000_submitted_entry_preflight.sql` | Passed |
| 25 | `20260723175500_entry_boundary_preflight.sql` | Passed |
| 26 | `20260723180000_entry_boundary_integrity.sql` | Passed |
| 27 | `20260723181000_entry_submission_revalidation.sql` | Passed |
| 28 | `20260723183000_knockout_result_lifecycle.sql` | Passed |
| 29 | `20260723183100_result_method_guard.sql` | Passed |
| 30 | `20260723183200_lock_result_revision_log.sql` | Exact revoke applied through SQL after the connector wrapper blocked the statement; verified no service-role table privileges remain |
| 31 | `20260723184000_knockout_bracket_tree_integrity.sql` | Passed |
| 32 | `20260723184100_bracket_tree_compatibility.sql` | Passed |
| 33 | `20260723190000_atomic_bracket_persistence.sql` | Passed |

## Development structural verification

Verified after migration 33:

- `predictor_internal` exists;
- `anon` and `authenticated` have no `USAGE` on the private schema;
- the PostgreSQL predicted-group resolver exists;
- the shared submission and predicted-bracket validators exist;
- result-state, method, 90-minute, 120-minute, shootout, winner, version and audit columns exist;
- `replace_predicted_progression()` exists;
- authenticated clients cannot update `entries`;
- authenticated clients cannot insert or update derived group positions;
- authenticated clients cannot insert, update or delete progression rows directly;
- authenticated clients may execute the owner-checked atomic progression RPC;
- anonymous clients cannot execute that RPC;
- browser roles cannot execute result confirm/correct/clear functions;
- the service role may execute result functions but cannot directly read or write the revision table.

The expected select/insert entry policies and select-only group-position/progression policies were present.

## Exact production-entry rehearsal

The one submitted production entry was copied into development by stable reference values only:

- group match reference;
- predicted score and Joker flag;
- team name and group for manual tie decisions;
- team name and predicted progression stage.

No production user identity or Auth credential was copied.

Normalized fingerprints matched between production and the development clone:

| Payload | Fingerprint |
| --- | --- |
| 36 match predictions | `2844328a25f2ab315bd2af602e1e1159` |
| two manual tie decisions | `a82498444d2d8249cc59eb1f5dba3e5b` |
| eight progression rows | `0d7bc491daa9b24013204d061a2d38f1` |

The clone produced:

- 36 group predictions;
- five Jokers;
- two exact-set tie decisions;
- 24 server-derived predicted group positions;
- eight predicted Round of 16 fixtures;
- a complete `4/2/1/1` progression shape;
- a successful full 15-match predicted bracket replay;
- a successful shared submission-snapshot validation;
- a successful `submit_entry()` call.

This proves the current production picks are compatible with the repository’s new resolver and bracket-tree contract after reference-ID mapping.

## Atomic bracket rehearsal

The clone was written through `replace_predicted_progression()` with an empty initial expected-version snapshot.

A second call deliberately supplied a stale empty version snapshot while eight rows existed. It:

- raised SQLSTATE `PT409`;
- left all eight rows unchanged;
- preserved a valid predicted bracket tree.

This verifies the expected complete-snapshot conflict behaviour on hosted development.

## Result lifecycle and propagation rehearsal

A scheduled R16 fixture was temporarily assigned two development teams and exercised through the protected result functions:

1. confirmation selected the home winner and populated the winner-fed QF participant;
2. correction reversed the winner and replaced the QF participant;
3. clearing returned the source match to scheduled and removed the propagated QF participant.

After the rehearsal:

- the R16 and QF participants were restored to their original null/scheduled state;
- score events returned to zero;
- three immutable confirm/correct/clear revisions remained;
- direct service-role access to the revision table remained denied.

## Production read-only preflight

The production structural query returned `overall_structural_pass = true`.

Confirmed:

- the submitted timestamp is before the configured lock;
- the lock is configured;
- six groups exist;
- every group has four teams, six valid group matches and six predictions;
- 36 predictions exist in total;
- both manual tie rows have valid exact team sets, scope and tie keys;
- progression has exactly four QF, two SF, one final and one champion row;
- no match, progression or existing group-position cross-tournament anomalies were found;
- no legacy match score exists;
- the knockout source tree contains 8 R16, 4 QF, 2 SF and 1 final;
- all 14 winner-source references are unique and point to the required previous round.

Production currently has zero persisted predicted group-position rows. That is expected under the old hosted schema. The exact production clone proved migration 26 rebuilds all 24 positions from the saved predictions and tie decisions before revalidation.

## Migration-history caveat

The original hosted migrations were applied manually, so neither hosted project began with an authoritative 1–20 CLI history.

The connector application recorded 12 development migration operations with tool-generated timestamps. Migration 30 was applied exactly through SQL and therefore has no matching connector history row. The semantic development schema is correct, but its remote history is not yet a clean mirror of the 33 repository filenames.

Before using `supabase db push` against either hosted project:

1. link to the intended project explicitly;
2. inspect `supabase migration list`;
3. reconcile only migrations whose schema effects have been independently verified using `supabase migration repair --status applied <timestamp>`;
4. re-run `supabase migration list`;
5. require `supabase db push --dry-run` to show only the genuinely pending repository migrations.

`migration repair` changes tracking metadata only; it must never be used to pretend missing SQL has run.

## Remaining rollout gates

Production rollout is technically promising but remains blocked until all are true:

- an operator has a verified database backup/export or equivalent recovery artifact;
- the exact migration-history repair commands are reviewed against `migration list` output;
- production writes and deployments are frozen for the window;
- the preflight SQL is rerun immediately before change;
- migration 21–33 order is preserved;
- post-rollout grants, policies, functions and browser bracket persistence are verified;
- production deploy previews are isolated from production Supabase;
- the separate `SECURITY-003` legacy function-grant/search-path review has an owner and follow-up plan.

## Current recommendation

The migration chain and current production entry are **ready for a controlled production rollout plan**, but production migration execution is a separate approval action. Follow `docs/ops-hosted-migration-rollout.md`; do not paste only migration 33 and do not run a linked reset against production.
