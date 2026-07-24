# Hosted migrations 21–35 — controlled rollout runbook

This runbook governs the production rollout of repository migrations 21–35. It does **not** authorize the rollout. The owner must explicitly approve the change after reviewing fresh preflights, recovery evidence, migration-history repair and the deployment window.

## Absolute rules

- Production is never reset.
- Never run `supabase db reset --linked` against production.
- Never use development Supabase as a production fallback.
- Never apply migration 33, 34 or 35 alone.
- Never bypass or edit a failing preflight during the rollout window.
- Never change rollout-guard fingerprints during the rollout window.
- Never use `migration repair` unless the matching schema effect is independently proven present.
- Never use `--include-seed` on production.
- One named operator performs the database change.
- Treat application and database compatibility as one release.

## Current evidence

The 23–24 July 2026 work established:

- disposable CI can rebuild the full 35-migration chain;
- hosted development has the semantic effects of migrations 21–35;
- the normalized production entry passes group reconstruction, R16 derivation, full bracket replay and submission validation;
- migration 35 provides version-safe persisted score clearing;
- production structural/source preflights pass;
- production has zero legacy match results;
- development’s function ACL and helper search-path contract passes;
- production itself remains on migrations 1–20.

Evidence:

- `scripts/database-rollout/production-baseline-1-20-verification.sql`;
- `scripts/database-rollout/production-preflight.sql`;
- `docs/quality/reconciliations/2026-07-23-hosted-migration-rehearsal.md`;
- `docs/quality/reconciliations/2026-07-24-function-privilege-hardening.md`;
- `docs/quality/reconciliations/2026-07-24-score-clearing.md`.

Current rollout guards:

| Payload | Fingerprint |
| --- | --- |
| 36 match predictions | `8d76619fe4b44fdac17de1cc2afe5aaa` |
| two manual tie decisions | `a4dcf183f5c48e3ba11ff75c59622598` |
| eight progression rows | `0d7bc491daa9b24013204d061a2d38f1` |

If a fingerprint or submitted timestamp changes, stop and repeat the production-to-development clone and replay. Do not weaken a guard to accommodate changed source data.

## Required change record

Record before starting:

- approved repository commit;
- production Supabase project reference;
- production Netlify deploy/commit;
- operator and recovery decision owner;
- start time and change window;
- backup/export identifier and verified retrieval location;
- both production preflight outputs;
- migration-list output before and after repair;
- `db push --dry-run` output;
- rollout-guard fingerprints;
- final verification, advisor and smoke-test outputs.

Do not place credentials, database passwords, tokens or private backup URLs in the repository.

## Phase 1 — freeze and verify identity

1. Freeze ordinary production deployments and database writes.
2. Confirm a clean checkout at the approved commit.
3. Confirm the linked Supabase project:

```bash
supabase projects list
supabase link --project-ref vkfnsqdyhvtwyqkisxhk
```

4. Confirm public domains still use production Supabase.
5. Do not use an unisolated preview/branch deploy for production testing.

Stop if the target project cannot be proven.

## Phase 2 — backup and recovery evidence

Obtain a current production backup/export through an approved Supabase-supported method. Record creation time, type, scope, retention/retrieval location, verifier and recovery decision.

A Netlify rollback is not a database rollback. Do not start without database recovery evidence.

## Phase 3 — immediate production preflight

Run:

```text
scripts/database-rollout/production-baseline-1-20-verification.sql
scripts/database-rollout/production-preflight.sql
```

Required baseline result:

- `all_structural_effects_present = true`;
- all twenty per-migration checks true;
- function ACL drift matches the known production state repaired by migration 34.

Required source result:

- `overall_structural_pass = true`;
- exactly one submitted entry with timestamp `2026-07-21 21:51:49.639442+00`, before lock;
- each group remains four teams, six valid fixtures and six predictions;
- one valid group tie and one valid third-place tie;
- all rollout fingerprints match;
- progression remains eight rows in `4/2/1/1` shape;
- old group-position rows remain zero;
- score events, rank history and legacy scores remain zero;
- no scope anomaly exists;
- knockout source tree remains `8/4/2/1` with fourteen valid winner sources.

Any failure is a stop condition. Investigate outside the change window.

## Phase 4 — reconcile migration history

Production contains the structural effects of migrations 1–20 but no tracked history rows.

1. Inspect history:

```bash
supabase migration list
```

Expected before repair: local files 1–35; production history missing 1–20.

2. Re-run the baseline verifier and retain its all-true output.

3. Only when every baseline check is true, repair tracking metadata:

```bash
supabase migration repair \
  20260719120000 \
  20260719130000 \
  20260719140000 \
  20260719150000 \
  20260719160000 \
  20260719170000 \
  20260719180000 \
  20260720120000 \
  20260720130000 \
  20260720140000 \
  20260720150000 \
  20260720160000 \
  20260720170000 \
  20260720180000 \
  20260720190000 \
  20260720200000 \
  20260720210000 \
  20260721120000 \
  20260721130000 \
  20260722120000 \
  --status applied
```

4. Re-run `supabase migration list`.

Required result: migrations 1–20 align; migrations 21–35 remain pending.

5. Run:

```bash
supabase db push --dry-run
```

The dry run must show **only migrations 21–35**, in timestamp order. Stop if it proposes 1–20, skips a pending file, includes an unknown file or cannot be explained.

`migration repair` updates metadata only. Never mark migrations 21–35 applied before their SQL executes.

## Phase 5 — apply the chain

After explicit approval of the dry-run output:

```bash
supabase db push
```

Expected pending files:

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
14. `20260724001500_harden_function_privileges.sql`
15. `20260724003000_delete_match_prediction_rpc.sql`

Do not continue past a failed migration. Preserve the error and exact state.

## Phase 6 — database post-verification

Run:

```text
scripts/database-rollout/post-rollout-verification.sql
```

Every reported value must be true, including:

- private schema exists and browser roles lack usage;
- entry update/delete privileges are denied to authenticated users;
- group-position and progression direct writes are denied;
- direct `match_predictions` deletion is denied to authenticated and service API roles;
- `delete_match_prediction(uuid,uuid,integer)` exists, is authenticated/service allowlisted and anonymous-denied;
- atomic progression RPC exists and is authenticated-only;
- result lifecycle columns/functions exist;
- result administration is service-role-only;
- revision table direct access is denied;
- anonymous roles execute no public application function;
- authenticated/service allowlists are exact;
- future public functions default owner-only;
- helper search paths are empty and immutable;
- the submitted entry, timestamp and three fingerprints are preserved;
- 24 derived positions and eight progression rows remain;
- submission and bracket validators pass;
- no result, revision, score event or rank-history row was invented.

Then run Supabase security advisors and retain output.

Expected:

- no anonymous security-definer execution warning;
- no mutable-search-path warning;
- signed-in warnings only for intentional authenticated RPCs;
- leaked-password protection remains separate unless independently approved;
- internal deny-all tables may retain informational no-policy notices.

Any unexpected privilege, object, data or advisor result is a stop condition.

## Phase 7 — authenticated application smoke tests

Using the approved production application and controlled owner account:

### Existing data and bracket

1. Confirm all 36 predictions, both tie decisions and the complete bracket load.
2. Make one reversible pre-lock bracket change.
3. Wait for saved status, reload and confirm persistence through `replace_predicted_progression`.
4. Reverse the change and confirm persistence.
5. Confirm Review remains valid and the submission timestamp is preserved.

### Submission settlement

6. Make a final score edit and immediately submit.
7. Confirm submission waits for the save and succeeds only after persistence.
8. Confirm a controlled save error/conflict blocks submission.

### Persisted score clearing

9. Clear one side of a previously saved complete score.
10. Wait for saved status and reload; confirm the score remains cleared.
11. Confirm the affected predicted group positions become incomplete/absent until the score is restored.
12. Restore the score and confirm positions rebuild.
13. Exercise a stale-device/version conflict and confirm newer work is not deleted.
14. Confirm a post-lock clear is refused and the stored row remains.

### Other critical reads

15. Confirm leaderboard, Match Centre distribution, leagues, profiles and points views load.

Do not use an unisolated production preview for these tests.

## Phase 8 — compatibility decision

Only after database and application verification pass:

- confirm the deployed app commit expects the live schema;
- lift the freeze;
- record the exact app/schema pair;
- update `current-status.md` and `ops-pending-migrations.md`;
- retain all preflight, history, dry-run, push, advisor and smoke-test evidence.

## Failure handling

### Preflight or history mismatch

Stop before SQL application. Do not mutate production or invent history rows.

### Migration failure

Stop, preserve logs and determine whether the current file rolled back. Do not skip it. If earlier files committed, prepare a reviewed forward repair or owner-approved database recovery decision.

### Privilege verification failure

Keep the freeze. Never restore broad `PUBLIC` grants. Compare exact missing/surplus signatures with repository allowlists.

### Application smoke-test failure

Do not point production at development. Either repair the application against the migrated schema or restore a known-good production application that is compatible with that schema. Database recovery remains a separate owner-approved decision.

## Separate follow-up work

Do not mix these into the database window:

- Netlify deploy-context isolation (`OPS-007`);
- leaked-password protection;
- browser E2E infrastructure beyond required smoke evidence;
- automatic real R16 population;
- browser administration UI;
- bonus games or design changes.
