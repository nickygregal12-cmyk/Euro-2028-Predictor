# Hosted migrations 21–35 — controlled rollout runbook

This runbook governs the production rollout of repository migrations 21–35 and release of application/database contract 35.

It does **not** authorize rollout. The owner must explicitly approve the change only after reviewing accepted recovery evidence, fresh preflights, migration-history repair, dry-run output, the named operator and the change window.

## Absolute rules

- Production is never reset.
- Never run `supabase db reset --linked` against production.
- Never use development Supabase as a production fallback.
- Never apply migration 33, 34 or 35 alone.
- Never include draft migration 36 in this rollout.
- Never bypass/edit a failing preflight or rollout fingerprint during the window.
- Never use `migration repair` unless matching schema effects are independently proven present.
- Never use `--include-seed` on production.
- Never restore old direct-table client writes as a compatibility shortcut.
- Never change production `EURO28_DEPLOYED_DB_CONTRACT` from 20 to 35 merely to make a build pass.
- One named operator performs the database change.
- Treat executable application code, current Netlify release, repository contract and hosted schema as one verified release pair.
- An encrypted but unrestored dump is not recovery evidence.
- A Netlify rollback is not a database rollback.

## Current release and contract state

Repository contract 35 requires exactly 35 migration files and these RPCs:

- `public.replace_predicted_progression(uuid,jsonb,jsonb)`;
- `public.delete_match_prediction(uuid,uuid,integer)`.

Netlify declarations:

| Context | Declared database contract |
| --- | ---: |
| production | 20 |
| deploy-preview | 35 |
| branch-deploy | 35 |
| dev | 35 |

The production declaration intentionally blocks new contract-35 application builds while production remains on the original 20-migration semantic schema.

Current ready production deploy:

- deploy `6a630e4de510f100077bc120`;
- source `a6d3f1c97a93d48789435457769fd627c305ff27`;
- production Supabase `vkfnsqdyhvtwyqkisxhk`;
- both required contract-35 RPCs absent.

Current audited repository `main` is `f872a28b27a5b8025803415ad1671d836dcde5d3`. Draft PR #76 proposes contract 36 and is not part of this window.

## Current evidence

Verified before the future window:

- full 35-migration rebuild passes in disposable CI;
- database lint, pgTAP and TypeScript/PostgreSQL parity pass;
- hosted development has exact 35-row canonical migration history and matching physical schema;
- normalized production entry replayed successfully through contract 35;
- production migration 1–20 structural verifier passes;
- production source preflight passes;
- production has no stored match results, score events or rank history;
- production has no migration-history table;
- production lacks both executable-client RPC dependencies;
- production remains on Free-plan recovery constraints;
- non-production Netlify contexts use development Supabase;
- the contract gate prevents further incompatible production release;
- the encrypted off-device source artifact was retrieved and verified;
- disposable baseline restore, history repair and migrations 21–35 passed;
- the first logical restore inherited incorrect browser grants on
  `public.entry_totals`;
- production was read-only verified not to have that exposure;
- the disposable ACL was reconciled and all checks/advisors passed;
- production remains blocked pending one clean replay with the corrected
  pre-schema default-privilege procedure.

Current source rollout guards:

| Payload | Required fingerprint |
| --- | --- |
| 36 match predictions | `320cf25d62767dee307d3602212909af` |
| two manual tie decisions | `a4dcf183f5c48e3ba11ff75c59622598` |
| eight progression rows | `0d7bc491daa9b24013204d061a2d38f1` |

The earlier `8d76619fe4b44fdac17de1cc2afe5aaa` prediction value belongs to a different development payload and is **not** the current production rollout guard.

If the submitted timestamp or any guard changes, stop, repeat the production-to-development clone/replay and update the committed preflight through reviewed repository change before a window. Never edit values during the window.

## Required change record

Record without secrets:

- approved repository commit and contract file;
- repository migration count;
- current production Netlify deploy and source;
- production declared contract;
- production project reference;
- operator and recovery decision owner;
- start/end window;
- source bundle identifier and plaintext checksum verification;
- encrypted artifact method/checksum/custody/retrieval evidence;
- disposable restore target and accepted restore verification;
- production baseline and source preflight outputs;
- migration list before/after history repair;
- `db push --dry-run` output;
- post-verification/advisor/smoke evidence;
- production contract-value change and final deploy pair.

Do not record passwords, tokens, raw Auth data or private backup URLs.

## Phase 1 — freeze and verify identity

1. Freeze ordinary production deployments and database writes for the approved operation.
2. Fetch the current production Netlify deploy live and confirm it is ready.
3. Confirm the approved repository commit and clean checkout.
4. Confirm repository contract 35 and exactly 35 migration files.
5. Confirm production Netlify still declares contract 20.
6. Confirm production/public domains use production Supabase.
7. Link the CLI to `vkfnsqdyhvtwyqkisxhk` and verify the project reference.
8. Confirm both required RPCs remain absent.
9. Confirm draft migration 36 is not in the approved checkout.
10. Do not use a preview or branch deployment for production smoke testing.

Stop on any identity, contract or source ambiguity.

## Phase 2 — complete and accept recovery evidence

Follow `docs/ops-production-backup-restore.md`.

Completed on 25 July 2026:

- off-device retrieval and encrypted checksum proof;
- restricted decryption and plaintext checksum proof;
- complete disposable baseline restore;
- source counts, Auth/profile, Storage and signup-trigger checks;
- migration-history repair for 1–20;
- exact dry run and successful migration of 21–35;
- committed post-rollout verification;
- zero pending migrations;
- hosted advisor review.

The first restore revealed that the new hosted target's default table privileges
could grant browser roles access while `schema.sql` was creating objects.
`public.entry_totals` therefore differed from production until manually
reconciled. Production itself remained unchanged and did not expose the view.

Required remaining work:

1. merge the reviewed restore procedure/verifier correction;
2. start again from an empty approved disposable target;
3. run `prepare-disposable-restore-target.sql` after `roles.sql` and before
   `schema.sql`;
4. require baseline migration 9 to prove source-equivalent `entry_totals` ACLs;
5. repeat history repair and migrations 21–35;
6. require post-rollout privilege checks and security advisors to pass without
   manual reconciliation;
7. retain non-secret evidence and cleanup confirmation;
8. obtain explicit recovery acceptance, including acceptance of the actual
   OpenSSL AES-256-CBC/PBKDF2 encryption method.

Do not proceed to production history repair until this clean replay and recovery
acceptance exist.

## Phase 3 — immediate production preflight

Run the committed read-only files:

```text
scripts/database-rollout/production-baseline-1-20-verification.sql
scripts/database-rollout/production-preflight.sql
```

Required baseline result:

- `all_structural_effects_present = true`;
- all twenty checks true;
- known ACL drift only;
- history still absent/unrepaired.

Required source result:

- `overall_structural_pass = true`;
- exactly one submitted entry with rehearsed timestamp before lock;
- six groups, four teams, six valid fixtures and six predictions each;
- 36 predictions;
- one valid group tie and one valid third-place tie;
- required fingerprints exactly match;
- progression shape `4/2/1/1`;
- old group-position rows zero;
- no scores, score events or rank history;
- no scope anomaly;
- knockout shape `8/4/2/1` and fourteen valid winner sources.

Total user/profile/unsubmitted-entry growth alone is not a failed guard.

Any required failure is a stop condition.

## Phase 4 — reconcile migration history

Production contains migration 1–20 structural effects but no tracked history.

1. Run `supabase migration list` and retain output.
2. Rerun the baseline verifier.
3. Only with all twenty checks true, run metadata-only repair:

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

4. Rerun `supabase migration list`.
5. Require 1–20 aligned and 21–35 pending.
6. Run:

```bash
supabase db push --dry-run
```

The dry run must show only migrations 21–35 in timestamp order. Stop if it proposes 1–20, includes 36, skips a pending file, includes an unknown file or is otherwise unexplained.

`migration repair` updates metadata only. Never mark 21–35 applied before SQL executes.

## Phase 5 — apply migrations 21–35

After explicit owner approval of accepted recovery evidence, fresh preflights, repaired history and reviewed dry run:

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

Stop on the first failed migration. Preserve exact non-secret output and state. Do not skip a file.

## Phase 6 — database post-verification

Run:

```text
scripts/database-rollout/post-rollout-verification.sql
```

Require every object, privilege, function ACL and data check true, including:

- private resolver and browser boundaries;
- source-equivalent `entry_totals` ACLs with no anonymous or authenticated
  direct access;
- denied direct entry/group-position/progression/deletion writes;
- exact authenticated/service allowlists and zero anonymous application execution;
- both required client RPCs;
- result lifecycle and immutable revision controls;
- fixed helper search paths and closed future defaults;
- preserved submission timestamp and source fingerprints;
- 24 derived positions and eight progression rows;
- valid bracket replay/submission;
- no invented result, revision, score-event or rank-history row.

Run Supabase security advisors and retain output. Unexpected privilege, object, data or advisor results are stop conditions.

**Do not update the production Netlify contract yet.**

## Phase 7 — authenticated smoke tests while the gate remains closed

Use the existing ready production application and a controlled owner account.

### Existing data and bracket

1. Confirm predictions, both ties and full bracket load.
2. Make one reversible pre-lock bracket change.
3. Wait for saved status, reload and confirm RPC persistence.
4. Reverse the change and confirm persistence.
5. Confirm Review remains valid and submitted timestamp is preserved.

### Submission settlement

6. Make a final score edit and immediately submit.
7. Confirm submission waits for persistence.
8. Confirm controlled save error/conflict blocks submission.

### Persisted score clearing

9. Clear one side of a saved complete score.
10. Wait for saved status and reload; confirm it remains cleared.
11. Confirm derived positions invalidate.
12. Restore the score and confirm positions rebuild.
13. Exercise a stale-version conflict and confirm newer work is retained.
14. Confirm post-lock clear is refused.

### Other critical reads

15. Confirm leaderboard, Match Centre distribution, leagues, profile and points views load.

Any failure keeps production contract 20 and the release freeze active.

## Phase 8 — lift contract and publish

Only after database post-verification, advisors and smoke tests pass:

1. obtain explicit owner/recovery-owner approval;
2. update production Netlify build variable:

```text
EURO28_DEPLOYED_DB_CONTRACT: 20 → 35
```

3. leave deploy-preview, branch-deploy and dev at 35;
4. trigger/retry the reviewed production deploy;
5. require both prebuild guards to pass;
6. require ready state;
7. verify current production pointer advances to approved commit;
8. confirm the site still uses production Supabase;
9. repeat concise bracket-save and score-clear smoke checks.

Changing the variable is an assertion that contract 35 is already proven; it is not database evidence.

## Phase 9 — close the window

After the new release and final smoke checks:

- lift the freeze;
- record exact deploy, commit, application contract and database contract;
- update current status, pending migrations, risk register and release reconciliation;
- retain recovery, preflight, history, dry-run, push, advisor, contract and smoke evidence.

## Failure handling

### Recovery failure

Do not repair production history. Correct backup/custody/restore outside the window.

### Identity, contract, preflight or history mismatch

Stop before SQL. Do not invent history or weaken a guard.

### Migration failure

Stop and determine whether the current file rolled back. Do not skip. If earlier files committed, prepare a reviewed forward repair or owner-approved recovery decision using the accepted artifact.

### Privilege/post-verification failure

Keep freeze and contract 20. Never restore broad `PUBLIC` grants. Compare exact missing/surplus signatures with repository allowlists.

### Application smoke failure

Keep current ready deploy and contract 20. Do not point production at development or reintroduce direct-table fallbacks.

### Deploy failure after contract lift

Keep the previous ready deploy. Investigate the application/deploy problem without changing the verified database or weakening guards.

## Separate follow-up work

Do not mix into the database window:

- migration 36 / PR #76;
- Turnstile context configuration;
- legacy Netlify site action;
- leaked-password protection;
- branch protection;
- automatic real R16 population;
- browser administration UI;
- bonus games or design changes.
