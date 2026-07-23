# Hosted migrations 21–33 — controlled rollout runbook

This runbook prepares and governs the production rollout of repository migrations 21–33.

It does **not** authorize the rollout by itself. The owner must explicitly approve the production change after reviewing the current preflight, backup evidence, migration-history plan and deployment window.

## Absolute rules

- Production is never reset.
- Never run `supabase db reset --linked` against production.
- Never use development Supabase as a production fallback.
- Never apply only migration 33.
- Never bypass or edit a failing preflight during the rollout window.
- Never update a rollout-guard fingerprint during the rollout window.
- Never use `migration repair` unless the corresponding schema effect is independently proven present.
- Never use `--include-seed` on production.
- One operator performs the database change; no concurrent migration push is allowed.
- Application and database compatibility are verified as one release.

## Current evidence

The 23 July 2026 rehearsal established:

- disposable CI rebuilds all 33 migrations successfully;
- hosted development now has the semantic effects of migrations 21–33;
- the exact normalized production entry passed group reconstruction, R16 derivation, full 15-match bracket replay and submission validation in development;
- production’s read-only structural preflight passed;
- production still has zero legacy match results;
- production itself remains on migrations 1–20 until this procedure is approved and executed.

The committed preflight is bound to the exact payload that was rehearsed:

| Payload | Rollout-guard fingerprint |
| --- | --- |
| 36 match predictions | `8d76619fe4b44fdac17de1cc2afe5aaa` |
| two manual tie decisions | `a4dcf183f5c48e3ba11ff75c59622598` |
| eight progression rows | `0d7bc491daa9b24013204d061a2d38f1` |

If any fingerprint or the submitted timestamp changes, stop and repeat the production-to-development clone and full replay. A legitimate user edit is not a reason to weaken the guard; it creates a new payload that must be rehearsed.

See `docs/quality/reconciliations/2026-07-23-hosted-migration-rehearsal.md`.

## Required inputs

Before starting, record:

- repository commit to deploy;
- production Supabase project reference;
- production Netlify deploy/commit;
- operator name;
- start time and change window;
- backup/export identifier and retrieval location;
- output of `supabase migration list`;
- output of `supabase db push --dry-run`;
- output of `scripts/database-rollout/production-preflight.sql`;
- rollout-guard fingerprints from that output;
- rollback decision owner.

Do not place credentials, database passwords, access tokens or private backup URLs in the repository.

## Phase 1 — freeze and verify identity

1. Freeze ordinary production deployments and database writes.
2. Confirm the repository working tree is clean and checked out at the approved commit.
3. Confirm the linked Supabase project before every linked command:

```bash
supabase projects list
supabase link --project-ref vkfnsqdyhvtwyqkisxhk
```

4. Confirm the public domains still use production Supabase.
5. Confirm no preview/branch deploy will be used for the production smoke test unless its environment is isolated from production data.

**Stop if the linked project cannot be proven.**

## Phase 2 — backup and recovery evidence

Obtain a current production database backup or export using an approved Supabase-supported method.

Record:

- creation time;
- backup/export type;
- scope;
- retention/retrieval location;
- person who verified it exists;
- recovery decision if migration application fails.

A Netlify deploy rollback is not a database rollback. Do not start without database recovery evidence.

## Phase 3 — immediate production preflight

Run the committed read-only script:

```text
scripts/database-rollout/production-preflight.sql
```

Required outcome:

- `overall_structural_pass = true`;
- exactly one submitted entry remains with timestamp `2026-07-21 21:51:49.639442+00` and it remains before lock;
- every group remains 4 teams / 6 valid fixtures / 6 predictions;
- exactly one group tie row and one third-place tie row remain valid;
- all three rollout-guard fingerprints match the rehearsed values;
- progression remains `4/2/1/1` with eight rows;
- old hosted group-position rows remain zero before migration 26 rebuilds them;
- score events and rank history remain zero;
- no cross-tournament anomaly exists;
- no legacy score exists;
- knockout source tree remains `8/4/2/1` with 14 valid unique winner sources.

**Any failure is a stop condition.** Investigate outside the rollout window. If the source payload changed, repeat the exact clone and replay rather than editing expected values in place.

## Phase 4 — reconcile migration history

The schema effects of migrations 1–20 were applied manually and may not be represented in `supabase_migrations.schema_migrations`.

1. Inspect local versus remote history:

```bash
supabase migration list
```

2. For each migration 1–20, compare the live schema object/policy/function evidence with the migration file.
3. Mark only independently proven migrations as applied:

```bash
supabase migration repair <migration-timestamp> --status applied
```

4. Re-run:

```bash
supabase migration list
```

5. Preview the pending SQL:

```bash
supabase db push --dry-run
```

The dry run must show **only migrations 21–33**, in timestamp order.

**Stop if it proposes migrations 1–20, skips any migration 21–33, includes an unknown migration, or the history cannot be explained.**

`migration repair` updates tracking metadata only. It does not apply SQL.

## Phase 5 — apply the repository chain

After owner approval of the dry-run output:

```bash
supabase db push
```

The expected pending files are:

1. `20260723170000_predictor_internal_schema.sql`
2. `20260723173000_predicted_group_order_resolver.sql`
3. `20260723174500_harden_entry_lock_functions.sql`
4. `20260723175000_submitted_entry_preflight.sql`
5. `20260723175500_entry_boundary_preflight.sql`
6. `20260723180000_entry_boundary_integrity.sql`
7. `20260723181000_entry_submission_revalidation.sql`
8. `20260723183000_knockout_result_lifecycle.sql`
9. `20260723183100_result_method_guard.sql`
10. `20260723183200_lock_result_revision_log.sql`
11. `20260723184000_knockout_bracket_tree_integrity.sql`
12. `20260723184100_bracket_tree_compatibility.sql`
13. `20260723190000_atomic_bracket_persistence.sql`

Do not continue past a failed migration. Preserve the error and current state for investigation.

## Phase 6 — database post-verification

Run:

```text
scripts/database-rollout/post-rollout-verification.sql
```

Required conditions include:

- private schema exists and browser roles have no usage;
- entry update and delete privileges are denied to authenticated users;
- group-position and progression direct insert/update/delete are denied;
- atomic progression RPC exists and is authenticated-only;
- result lifecycle columns/functions exist;
- confirm, correct and clear functions are denied to browser roles and allowed only to the service role;
- revision table direct select/insert/update/delete are denied to browser and service roles;
- exactly one submitted entry and its original timestamp are preserved;
- all three rollout-guard fingerprints are unchanged;
- the submitted entry has 24 server-derived positions;
- complete bracket replay returns true;
- no result, revision, score event or rank-history row was invented;
- production progression and source predictions are preserved.

Then run Supabase security advisors and retain the output. Expected legacy advisor findings remain tracked under `SECURITY-003`; new warnings caused by the rollout are a stop condition.

## Phase 7 — application smoke test

Using the approved production application and a controlled owner account:

1. open the existing entry;
2. confirm all 36 group predictions load;
3. confirm manual ties and the complete bracket load;
4. make one reversible pre-lock bracket change;
5. wait for the save state to confirm success;
6. reload and confirm persistence through `replace_predicted_progression`;
7. reverse the test change and confirm persistence;
8. verify Review remains valid and submission timestamp is preserved;
9. confirm leagues, profile and points views still load.

Do not use an unisolated production deploy preview for this test.

## Phase 8 — compatibility and deployment decision

Only after database and application smoke tests pass:

- confirm the deployed application commit expects the now-live schema;
- lift the deployment/write freeze;
- record completion in `docs/quality/current-status.md`;
- update `docs/ops-pending-migrations.md`;
- retain preflight, dry-run, push and verification outputs in the incident/change record.

## Failure handling

### Preflight failure

Stop. Do not mutate production. Open a remediation workstream using the exact failing rows.

### Migration failure before commit

Stop. Preserve logs and identify whether the migration transaction rolled back. Do not manually skip the file.

### Migration failure after earlier files committed

Keep production connected to production Supabase. Do not reset. Determine the last applied migration from schema and history, then prepare a reviewed forward repair or database recovery decision.

### Application smoke-test failure

Do not point production at development. Either:

- repair the application against the new production schema; or
- restore a known-good production application deploy that remains compatible with the migrated production schema.

Database restore is a separate owner-approved action based on the backup evidence.

## Explicitly separate follow-up work

Do not silently mix these into the migration window:

- Netlify deploy-context isolation (`OPS-007`);
- legacy function grant/search-path hardening (`SECURITY-003`);
- leaked-password protection;
- pending-write submission flush (`REL-003`);
- automatic real R16 population;
- browser administration UI;
- bonus games or design changes.