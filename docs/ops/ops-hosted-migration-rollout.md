# Hosted migrations 21–35 — completed production rollout record

This document records the controlled production rollout of repository migrations 21–35 and the release of application/database contract 35 on 25 July 2026. It also preserves the safety rules that must be reused for any later hosted migration.

The full evidence record is [`quality/reconciliations/2026-07-25-contract-35-production-promotion.md`](quality/reconciliations/2026-07-25-contract-35-production-promotion.md).

## Final production state

| Item | Verified value |
| --- | --- |
| Repository/deployed source | `902a37aa6c50c967f8080d751147a5733b251fe3` |
| Repository migration count | 35 |
| Production migration history | exactly 35 canonical versions through `20260724003000` |
| Production Supabase | `vkfnsqdyhvtwyqkisxhk` |
| Production Netlify contract | 35 |
| Production deploy | `6a652c3d3416d26d595ae2ef` |
| Pending migrations through 35 | 0 |
| Draft migration 36 | absent/unapplied; PR #76 unchanged |

Required contract-35 RPCs are present:

- `public.replace_predicted_progression(uuid,jsonb,jsonb)`;
- `public.delete_match_prediction(uuid,uuid,integer)`.

## Absolute rules retained

- Production is never reset.
- Never run `supabase db reset --linked` against production.
- Never use development Supabase as a production fallback.
- Never bypass/edit a failing preflight or rollout fingerprint during a window.
- Never use `migration repair` unless matching schema effects are independently proven present.
- Never use `--include-seed` on production.
- Never restore direct-table client writes as a compatibility shortcut.
- Never change a production deployment contract merely to make a build pass.
- One named operator performs a database change.
- Treat executable application code, current Netlify release, repository contract and hosted schema as one verified release pair.
- An encrypted but unrestored dump is not recovery evidence.
- A Netlify rollback is not a database rollback.
- A future migration must not be bundled into an already approved window without new review and approval.

## Executed change record

The owner separately approved the database write window and Netlify production promotion. The approved scope excluded migration 36, PR #76, Supabase URL/key changes, non-production Netlify contexts and domains.

Recorded evidence includes:

- approved repository commit and contract file;
- exact 35-file migration inventory;
- production Supabase and Netlify identity;
- accepted encrypted backup and corrected clean restore;
- production baseline/source preflights;
- migration list before and after history repair;
- exact 21–35 dry run;
- migration application output;
- 63-check verifier results;
- security/performance advisor review;
- rollback-only database smoke tests;
- production contract-value change;
- exact ready deploy and live browser evidence.

No password, token, raw Auth data, private backup URL or secret checksum is stored in the repository.

## Phase 1 — identity and freeze: completed

Before writes, the operation verified:

- correct clean repository checkout and exact approved commit;
- repository contract 35 and exactly 35 migrations;
- production Supabase project identity;
- production source counts, submitted timestamp and fingerprints;
- production contract still 20 before database execution;
- both contract-35 RPCs absent before migration;
- migration 36 absent;
- ordinary production promotion frozen for the operation.

## Phase 2 — recovery evidence: completed and accepted

The accepted artifact passed:

- off-device retrieval and encrypted checksum proof;
- restricted decryption and plaintext checksum proof;
- archive safety checks;
- complete empty-target restore using `prepare-disposable-restore-target.sql` before `schema.sql`;
- source counts, Auth/profile, Storage and signup-trigger checks;
- migration-history repair for 1–20;
- exact dry run and successful migration of 21–35;
- 63-check post-verification;
- zero pending migrations;
- hosted advisor review;
- rollback-only authenticated/service smoke checks;
- final clean replay without manual ACL repair.

The owner explicitly accepted OpenSSL AES-256-CBC with PBKDF2 as the encryption method actually used by the verified artifact.

## Phase 3 — immediate production preflight: completed

The committed read-only files passed immediately before production writes:

```text
scripts/database-rollout/production-baseline-1-20-verification.sql
scripts/database-rollout/production-preflight.sql
```

Required source evidence passed:

- exactly one submitted entry and the rehearsed submitted timestamp;
- 36 predictions;
- one valid group tie and one valid third-place tie;
- fingerprints `320cf25d...`, `a4dcf183...`, `0d7bc491...`;
- eight progression rows and valid knockout source tree;
- zero stored results, revisions, score events and rank history;
- no scope anomaly.

## Phase 4 — migration-history reconciliation: completed

Production already contained migration 1–20 structural effects without canonical tracking. The operator:

1. retained the pre-repair migration list;
2. reran the baseline verifier;
3. marked exactly versions 1–20 applied using `supabase migration repair --status applied`;
4. reran the migration list;
5. required the dry run to list exactly migrations 21–35.

The repair changed migration metadata only. Source counts, timestamp and fingerprints remained unchanged.

Production history was canonical through migration 35 at the close of this record (since advanced to 38 by the contract-38 milestone). Do not repair it again without a separately proven metadata defect.

## Phase 5 — migrations 21–35: completed

The following files applied in strict timestamp order:

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

No migration was skipped. Migration 36 was not present or applied.

## Phase 6 — database post-verification: completed

`scripts/database-rollout/post-rollout-verification.sql` returned exactly 63 passing checks before and after smoke tests.

Verified controls include:

- private resolver and browser boundaries;
- source-equivalent `entry_totals` ACLs;
- denied direct entry/group-position/progression/deletion writes;
- exact authenticated/service allowlists and zero anonymous application execution;
- both required client RPCs;
- result lifecycle and immutable revision controls;
- fixed helper search paths and closed future defaults, except the separately documented trigger-only `enforce_joker_rules` warning;
- preserved submission timestamp and source fingerprints;
- exactly 24 derived positions and eight progression rows;
- valid bracket replay/submission;
- no invented result, revision, score-event or rank-history row.

Security advisors returned no `ERROR` finding. Performance advisors returned informational findings only.

## Phase 7 — rollback-only database smoke: completed

Rollback-only checks passed for:

- authenticated identity;
- atomic bracket replacement;
- submission settlement;
- service-role result confirmation and clearing;
- direct revision-table access denial.

Every smoke-test write rolled back. The 63 checks and fingerprints passed again afterward.

## Phase 8 — Netlify contract lift and publish: completed

Only the production declaration changed:

```text
EURO28_DEPLOYED_DB_CONTRACT: 20 → 35
```

Deploy-preview, branch-deploy and dev remained at 35 and continued using development Supabase.

Netlify published deploy `6a652c3d3416d26d595ae2ef` from exact commit `902a37aa6c50c967f8080d751147a5733b251fe3`. Both prebuild guards passed, the deploy reached ready state and the production pointer advanced.

## Phase 9 — live application verification and close: completed

Read-only live verification passed:

- production alias and immutable deploy returned HTTP 200 and matching HTML;
- metadata and canonical URL were correct;
- CSP, HSTS and committed security headers were present;
- SPA route fallbacks and initial assets were healthy;
- the complete production Supabase URL was present;
- the complete development Supabase URL was absent;
- no browser request targeted development or an unexpected Supabase host;
- login, signup, reset, signed-out protected-route and not-found journeys passed.

No form was submitted and no database write occurred during live application verification.

The production freeze was lifted after evidence capture. The compatible release pair is recorded in the production reconciliation.

## Failure handling for future migrations

### Recovery failure

Do not repair production history or run SQL. Correct backup/custody/restore outside the window.

### Identity, contract, preflight or history mismatch

Stop before SQL. Do not invent history or weaken a guard.

### Migration failure

Stop and determine whether the current file rolled back. Do not skip. Prepare a reviewed forward repair or owner-approved recovery decision.

### Privilege/post-verification failure

Keep the application contract at the previously verified value. Never restore broad `PUBLIC` grants. Compare exact missing/surplus signatures with repository allowlists.

### Application smoke failure

Keep or restore a known-compatible production deploy. Do not point production at development or reintroduce direct-table fallbacks.

### Deploy failure after a future contract lift

Keep the previous ready deploy and investigate without changing the verified database or weakening guards.

## Procedure for future production migrations

(As written at the close of this record for "migration 36 or later"; migrations 36–38 have since shipped to production and 39–44 to development. `AGENTS.md` → Production milestones is the current authority; this list matches it.)

1. review and merge the migration through normal CI/database/browser gates;
2. update the repository deployment contract deliberately;
3. verify hosted development first;
4. create and accept a fresh production backup/restore record appropriate to the change;
5. identify the exact production source/deploy/database pair;
6. run read-only production preflights;
7. require a dry run listing only approved pending migrations;
8. obtain explicit owner approval before SQL;
9. apply in timestamp order and stop on first failure;
10. run post-verification, advisors and required smoke tests;
11. change the production Netlify contract only after database verification passes;
12. publish and verify the exact application/database pair;
13. update current status, migration inventory, risk register, feature baseline and a dated reconciliation.

## Separate follow-up work

Do not mix into a future database window (items marked delivered have since shipped as their own reviewed scopes):

- unrelated migration 36 product decisions;
- Turnstile context configuration;
- legacy Netlify site action;
- leaked-password protection;
- branch protection;
- automatic real R16 population *(delivered — migration 39, PR #122)*;
- browser administration UI *(delivered — PRs #120 and #126)*;
- bonus games or design changes.