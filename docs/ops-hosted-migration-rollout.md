# Hosted migrations 21–35 — controlled rollout runbook

This runbook governs the production rollout of repository migrations 21–35 and the release of application/database contract 35.

It does **not** authorize the rollout. The owner must explicitly approve the change only after reviewing accepted recovery evidence, fresh preflights, migration-history repair, dry-run output, the named operator and the deployment window.

## Absolute rules

- Production is never reset.
- Never run `supabase db reset --linked` against production.
- Never use development Supabase as a production fallback.
- Never apply migration 33, 34 or 35 alone.
- Never bypass or edit a failing preflight during the rollout window.
- Never change rollout-guard fingerprints during the rollout window.
- Never use `migration repair` unless the matching schema effect is independently proven present.
- Never use `--include-seed` on production.
- Never restore old direct-table client writes as a compatibility shortcut.
- Never change production `EURO28_DEPLOYED_DB_CONTRACT` from `20` to `35` merely to make a build pass.
- One named operator performs the database change.
- Treat executable application code, the current Netlify release, the repository deployment contract and the hosted database schema as one verified release pair.
- Prepared backup tooling, an unencrypted dump or an untested dump is not recovery evidence.
- A Netlify rollback is not a database rollback.

## Current release and contract state

The repository currently requires application/database contract 35:

- contract source: `config/deployment-contract.json`;
- required migration count: 35;
- required RPCs:
  - `public.replace_predicted_progression(uuid,jsonb,jsonb)`;
  - `public.delete_match_prediction(uuid,uuid,integer)`.

Netlify build-context declarations:

| Context | Declared hosted database contract |
| --- | ---: |
| `production` | 20 |
| `deploy-preview` | 35 |
| `branch-deploy` | 35 |
| `dev` | 35 |

The production declaration intentionally blocks new production builds while production remains on the original 20-migration schema.

Current verified ready production deploy at the time the gate was introduced:

- deploy ID `6a630e4de510f100077bc120`;
- source commit `a6d3f1c97a93d48789435457769fd627c305ff27`;
- executable application lineage includes the two client RPC dependencies;
- production Supabase lacks both RPCs.

PR #25 merged contract enforcement as commit `2424a7bffc5390f55cb34ddffc3cc7c56d48bcdc`. The current production pointer remained on the earlier ready deploy. This is the intended release freeze, not an outage.

## Current evidence

The 23–24 July 2026 work established:

- disposable CI rebuilds the full 35-migration chain;
- hosted development has migrations 21–35 applied and verified;
- the normalized production entry passes group reconstruction, R16 derivation, full bracket replay and submission validation;
- migration 35 provides version-safe persisted score clearing;
- production structural/source preflights pass;
- production has zero legacy match results;
- development’s function ACL and helper search-path contract passes;
- production remains on migrations 1–20 with no migration-history table;
- read-only production inspection confirms both executable-client RPC dependencies are absent;
- production is approximately 12 MB, with four Auth users, no Storage objects and no Edge Functions;
- the Supabase organization is on Free, so the rollout must rely on a manually created and proven logical recovery bundle;
- Netlify non-production contexts are isolated to development Supabase;
- the application/database deployment contract blocks further incompatible production releases.

Evidence:

- `scripts/database-rollout/production-baseline-1-20-verification.sql`;
- `scripts/database-rollout/production-preflight.sql`;
- `scripts/database-rollout/post-rollout-verification.sql`;
- `docs/ops-production-backup-restore.md`;
- `docs/quality/reconciliations/2026-07-23-hosted-migration-rehearsal.md`;
- `docs/quality/reconciliations/2026-07-24-function-privilege-hardening.md`;
- `docs/quality/reconciliations/2026-07-24-score-clearing.md`;
- `docs/quality/reconciliations/2026-07-24-production-recovery-readiness.md`;
- `docs/quality/reconciliations/2026-07-24-netlify-environment-isolation.md`;
- `docs/quality/reconciliations/2026-07-24-app-schema-deployment-gate.md`.

Rollout guards:

| Payload | Fingerprint |
| --- | --- |
| 36 match predictions | `8d76619fe4b44fdac17de1cc2afe5aaa` |
| two manual tie decisions | `a4dcf183f5c48e3ba11ff75c59622598` |
| eight progression rows | `0d7bc491daa9b24013204d061a2d38f1` |

If a fingerprint or submitted timestamp changes, stop and repeat the production-to-development clone and replay. Do not weaken a guard to accommodate changed source data.

## Required change record

Record before starting:

- owner-approved repository commit and `config/deployment-contract.json` content;
- repository migration count;
- current production Netlify release commit/deploy fetched live;
- current Netlify production `EURO28_DEPLOYED_DB_CONTRACT` value;
- production Supabase project reference;
- operator and recovery decision owner;
- start time and change window;
- plaintext bundle identifier and checksum set;
- encrypted artifact checksum, retention and verified off-site retrieval reference;
- disposable restore target and accepted restore-verification evidence;
- both production preflight outputs;
- migration-list output before and after repair;
- `db push --dry-run` output;
- rollout-guard fingerprints;
- database post-verification, advisor and smoke-test outputs;
- production contract-value change and final deploy evidence.

Do not place credentials, database passwords, tokens, raw Auth data or private backup URLs in the repository.

## Phase 1 — freeze and verify identity

1. Freeze ordinary production deployments and database writes for the approved operation.
2. Fetch the current production Netlify deploy live.
3. Confirm the current ready deploy remains available.
4. Confirm the repository application/database contract is 35 and the repository has exactly 35 migration files.
5. Confirm production Netlify declares `EURO28_DEPLOYED_DB_CONTRACT=20` before database rollout.
6. Confirm a clean checkout at the approved repository commit.
7. Confirm the linked Supabase project:

```bash
supabase projects list
supabase link --project-ref vkfnsqdyhvtwyqkisxhk
```

8. Confirm public domains still use production Supabase.
9. Confirm both `replace_predicted_progression` and `delete_match_prediction` remain absent before rollout. Unexpected presence is a stop-and-investigate condition.
10. Do not use a preview/branch deploy for production smoke testing.

Stop if any target identity, contract value or executable diff cannot be proven.

## Phase 2 — create and prove recovery evidence

Follow `docs/ops-production-backup-restore.md` exactly. This phase must finish **before** migration-history repair, dry-run approval or SQL application.

### 2A — create the source bundle

On the named operator’s trusted machine:

1. Confirm the approved source commit and a clean repository.
2. Confirm Supabase CLI, Docker, `psql` and Python are available.
3. Set the production URL only in the current shell, set a secure staging path outside the repository and explicitly acknowledge project `vkfnsqdyhvtwyqkisxhk`.
4. Run:

```bash
bash scripts/database-rollout/create-production-backup.sh
```

5. Require the script to complete without bypassing any guard.
6. Confirm the bundle contains roles, schema and data dumps, source inventory, Auth/Storage drift evidence, managed-schema customizations, repository/tool provenance, `manifest.json` and `SHA256SUMS`.
7. Confirm `data.sql` contains `auth.users` and `public.profiles`.
8. Confirm the plaintext staging bundle records `qualifying_recovery_evidence = false`.

Any failed identity, clean-tree, dump, Auth-data, inventory or checksum guard is a stop condition.

### 2B — encrypt and retain off-site

1. Encrypt the bundle using the approved organizational method.
2. Record the encrypted artifact checksum and key identifier without recording a secret or private key.
3. Store a verified copy off the working machine.
4. Record custody, retention/expiry and retrieval reference.
5. Retrieve the artifact through the recorded path and verify the encrypted artifact checksum.
6. Decrypt only into a restricted temporary location and require every plaintext checksum in `SHA256SUMS` to pass.

A local-only copy, unencrypted archive or unchecked retrieval does not satisfy this phase.

### 2C — disposable restore rehearsal

Use a disposable Supabase-compatible target that is neither production nor the active development project.

1. Record the target identifier, database version, operator and proof that destructive testing is permitted.
2. Restore roles, schema, data and the reviewed managed-schema customization file in the order defined by the backup/restore runbook.
3. Review `auth-storage-diff.sql`; apply only reviewed production customizations not recreated elsewhere.
4. Run the copied baseline verifier and source preflight.
5. Require restored source counts and all three rollout fingerprints to match.
6. Verify all Auth users/profiles exist without exposing their contents.
7. Verify `on_auth_user_created` calls `public.handle_new_user()` and prove the signup/profile path with a disposable test user.
8. Verify Storage remains empty unless the fresh source inventory proves otherwise.
9. Verify the restored baseline still lacks the migration-33 and migration-35 RPCs.
10. Preferably rehearse the exact 1–20 history repair, 21–35-only dry run, full 21–35 push and post-rollout verification on this restored target.
11. Retain non-secret evidence and confirm cleanup of the disposable target and plaintext staging files.

The restore must succeed and be reviewed. Merely generating a dump does not satisfy the recovery gate.

### 2D — recovery acceptance

Before proceeding, the owner/recovery decision owner must accept a record containing source/release identity, bundle and encrypted checksums, verified off-site retrieval, disposable restore evidence, baseline/source verification, Auth-trigger proof, operator/reviewer identity and cleanup confirmation.

If any required evidence is absent, the production migration window remains blocked.

## Phase 3 — immediate production preflight

Run:

```text
scripts/database-rollout/production-baseline-1-20-verification.sql
scripts/database-rollout/production-preflight.sql
```

Required baseline result:

- `all_structural_effects_present = true`;
- all twenty per-migration checks true;
- function ACL drift matches the known production state repaired by migration 34;
- migration-history metadata remains absent/unrepaired until Phase 4.

Required source result:

- `overall_structural_pass = true`;
- exactly one submitted entry with the rehearsed timestamp, before lock;
- each group remains four teams, six valid fixtures and six predictions;
- one valid group tie and one valid third-place tie;
- all rollout fingerprints match;
- progression remains eight rows in `4/2/1/1` shape;
- old group-position rows remain zero;
- score events, rank history and legacy scores remain zero;
- no scope anomaly exists;
- knockout source tree remains `8/4/2/1` with fourteen valid winner sources.

Profile/entry totals may increase through legitimate signup activity. Total-count growth alone is not a failed guard; inspect ownership and submitted-entry/source invariants.

Any required failure is a stop condition.

## Phase 4 — reconcile migration history

Production contains the structural effects of migrations 1–20 but no tracked history rows.

1. Inspect history:

```bash
supabase migration list
```

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
5. Require migrations 1–20 to align and migrations 21–35 to remain pending.
6. Run:

```bash
supabase db push --dry-run
```

The dry run must show **only migrations 21–35**, in timestamp order. Stop if it proposes 1–20, skips a pending file, includes an unknown file or cannot be explained.

`migration repair` updates metadata only. Never mark migrations 21–35 applied before their SQL executes.

## Phase 5 — apply migrations 21–35

After explicit owner approval of the accepted recovery record, fresh preflights, history repair and dry-run output:

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

- private schema and browser boundaries;
- denied direct entry, group-position, progression and match-prediction deletion writes;
- authenticated/service allowlists and zero anonymous application execution;
- both required application RPCs;
- result lifecycle and revision boundaries;
- immutable helper search paths and owner-only future defaults;
- preserved submitted entry, timestamp and fingerprints;
- 24 derived positions and eight progression rows;
- valid submission/bracket replay;
- no invented result, revision, score-event or rank-history row.

Run Supabase security advisors and retain output.

Expected:

- no anonymous security-definer warning;
- no mutable-search-path warning;
- signed-in warnings only for intentional application RPCs;
- leaked-password protection remains separate unless independently approved;
- internal deny-all tables may retain informational no-policy notices.

Any unexpected privilege, object, data or advisor result is a stop condition.

**Do not update the production Netlify contract yet.**

## Phase 7 — authenticated application smoke tests while the gate remains closed

Use the existing verified ready production deploy and a controlled owner account. The application already contains the required client paths; the database has just been migrated.

### Existing data and bracket

1. Confirm all submitted-entry predictions, both tie decisions and the complete bracket load.
2. Make one reversible pre-lock bracket change.
3. Wait for saved status, reload and confirm persistence through `replace_predicted_progression`.
4. Reverse the change and confirm persistence.
5. Confirm Review remains valid and submission timestamp is preserved.

### Submission settlement

6. Make a final score edit and immediately submit.
7. Confirm submission waits for persistence.
8. Confirm a controlled save error/conflict blocks submission.

### Persisted score clearing

9. Clear one side of a previously saved complete score.
10. Wait for saved status and reload; confirm the score remains cleared.
11. Confirm affected predicted group positions become incomplete/absent until restoration.
12. Restore the score and confirm positions rebuild.
13. Exercise a stale-device/version conflict and confirm newer work is not deleted.
14. Confirm a post-lock clear is refused and the stored row remains.

### Other critical reads

15. Confirm leaderboard, Match Centre distribution, leagues, profiles and points views load.

Any failure keeps the deployment contract at 20 and the release freeze active.

## Phase 8 — lift the deployment contract and publish

Only after Phases 6 and 7 pass:

1. Obtain explicit owner/recovery-owner approval to lift the release gate.
2. Update the **production** Netlify build variable:

```text
EURO28_DEPLOYED_DB_CONTRACT: 20 → 35
```

3. Do not change deploy-preview, branch-deploy or dev values; they already remain 35.
4. Retry or trigger the approved production deploy from the reviewed repository commit.
5. Require both prebuild guards to pass.
6. Require the production deploy state to become ready.
7. Verify the current production pointer advances to the approved commit.
8. Confirm the public site still uses production Supabase.
9. Re-run a concise bracket-save and score-clear smoke test on the newly current deploy.

Changing the variable is an operational assertion that production contract 35 has been independently proven. It is not itself database evidence.

## Phase 9 — close the change window

Only after the new production deploy and final smoke checks pass:

- lift the write/deployment freeze;
- record the exact Netlify deploy, repository commit, application contract and database contract;
- update `current-status.md`, `ops-pending-migrations.md`, the risk register and production release reconciliation;
- retain all recovery, preflight, history, dry-run, push, advisor, contract-change and smoke-test evidence.

## Failure handling

### Recovery evidence failure

Do not proceed to migration-history repair. Preserve non-secret evidence and correct the backup, custody or restore process outside the window.

### Preflight, identity, contract or history mismatch

Stop before SQL application. Do not mutate production, invent history rows or weaken a guard.

### Migration failure

Stop, preserve logs and determine whether the current file rolled back. Do not skip it. If earlier files committed, prepare a reviewed forward repair or an owner-approved database recovery decision using the accepted artifact.

### Privilege or post-verification failure

Keep the freeze and production contract at 20. Never restore broad `PUBLIC` grants. Compare exact missing/surplus signatures with repository allowlists.

### Application smoke-test failure

Keep the current ready deploy and production contract 20. Do not point production at development and do not add old direct-table fallbacks. Repair the application/database pair or make a separate owner-approved recovery decision.

### Production deploy failure after contract lift

Keep the previous ready production deploy. Investigate the build without changing the database or weakening either prebuild guard. If the database remains verified contract 35, correct the application/deploy issue and retry through review.

## Separate follow-up work

Do not mix these into the database window:

- Turnstile domain/context verification;
- separately maintained development Netlify site verification;
- leaked-password protection;
- browser E2E infrastructure beyond required smoke evidence;
- automatic real R16 population;
- browser administration UI;
- bonus games or design changes.
