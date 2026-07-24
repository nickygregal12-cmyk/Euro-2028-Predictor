# Hosted migration inventory and rollout status

This is the live source of truth for repository migration count, hosted semantic state and rollout readiness.

## Current status — 24 July 2026

| Environment | Semantic schema state | Migration-history state | Status |
| --- | --- | --- | --- |
| Development `iouzoutneyjpugbbtdem` | Migrations 1–35 effects present; exact data, ACL and prediction-delete contracts verified | Partial/tool-generated remote history; requires CLI reconciliation | **Hosted rehearsal complete through migration 35** |
| Production `vkfnsqdyhvtwyqkisxhk` | Original migrations 1–20 effects independently verified | `supabase_migrations.schema_migrations` does not exist; exact 1–20 metadata-only repair prepared but not executed | **15 pending; rollout not performed** |

No production migration is approved merely because it exists in the repository, passed CI or passed a read-only preflight.

## Current production application boundary

Netlify automatically published commit `a403b0796853453cb4115aea55729aced192a6ca` after PR #20 merged. Deploy `6a62c49dfaa87100087a6ab1` is the current production application.

That client expects two functions from the pending chain:

| Client path | Required function | Introduced by | Production state |
| --- | --- | --- | --- |
| Atomic complete-bracket persistence | `replace_predicted_progression(uuid,jsonb,jsonb)` | Migration 33 | **Absent** |
| Persisted score clearing | `delete_match_prediction(uuid,uuid,integer)` | Migration 35 | **Absent** |

Read-only production inspection also confirmed the old broad owner `ALL` policies remain on `predicted_progression` and `match_predictions`, with authenticated direct progression DML and match-prediction deletion still granted.

The application/database pair is therefore incompatible at both write boundaries. Do not restore old direct-table client writes as a workaround. The approved recovery remains the complete 21–35 chain or another explicitly compatible production application release.

## Repository migration chain

### Proven production baseline — 1–20

| # | Migration | Purpose | Production proof |
| --- | --- | --- | --- |
| 1 | `20260719120000_init_v0_1.sql` | Initial tournament, entry and prediction schema with RLS | Present |
| 2 | `20260719130000_add_match_prediction_joker.sql` | Joker flag | Present |
| 3 | `20260719140000_add_predicted_tie_resolutions.sql` | Manual predicted tie decisions | Present |
| 4 | `20260719150000_enforce_joker_rules.sql` | Joker limit and kickoff commitment | Present |
| 5 | `20260719160000_add_bonus_and_submit.sql` | Players, bonus predictions and original submit RPC | Present |
| 6 | `20260719170000_lock_and_leaderboard.sql` | Tournament lock and leaderboard | Present |
| 7 | `20260719180000_add_leagues.sql` | Leagues and membership | Present |
| 8 | `20260720120000_league_fk_semantics.sql` | League FK deletion semantics | Present |
| 9 | `20260720130000_add_scoring.sql` | Initial SQL scorer | Present |
| 10 | `20260720140000_fix_recompute_trigger.sql` | Recompute-trigger correction | Present |
| 11 | `20260720150000_add_last_seen.sql` | Catch-up fields | Present |
| 12 | `20260720160000_add_profile_welcomed_at.sql` | Welcome gate field | Present |
| 13 | `20260720170000_reveal_after_lock.sql` | Rival entry reveal RPC | Present |
| 14 | `20260720180000_add_rank_history.sql` | Rank history | Present |
| 15 | `20260720190000_profile_on_signup.sql` | Server-created profile on signup | Present |
| 16 | `20260720200000_display_name_moderation.sql` | Display-name policy | Present |
| 17 | `20260720210000_rate_limits.sql` | Prediction and league-join rate limits | Present |
| 18 | `20260721120000_scoring_positions_knockout_awards.sql` | Position, knockout and award scoring | Present |
| 19 | `20260721130000_match_centre.sql` | Match-centre aggregate RPCs | Present |
| 20 | `20260722120000_write_integrity.sql` | Optimistic versions and original structural checks | Present |

`scripts/database-rollout/production-baseline-1-20-verification.sql` returned every structural check true. The migration-history metadata remains absent because these files were applied manually rather than through a clean CLI migration push.

### Development applied / production pending — 21–35

| # | Migration | Workstream | Development | Production |
| --- | --- | --- | --- | --- |
| 21 | `20260723170000_predictor_internal_schema.sql` | Private resolver schema | Applied + verified | Pending |
| 22 | `20260723173000_predicted_group_order_resolver.sql` | PostgreSQL group-order resolver | Applied + parity verified | Pending |
| 23 | `20260723174500_harden_entry_lock_functions.sql` | Qualified lock helpers | Applied + verified | Pending |
| 24 | `20260723175000_submitted_entry_preflight.sql` | Submitted-entry preflight | Passed | Read-only equivalent passed |
| 25 | `20260723175500_entry_boundary_preflight.sql` | Entry/scope preflight | Passed | Read-only equivalent passed |
| 26 | `20260723180000_entry_boundary_integrity.sql` | RPC submission and derived positions | Applied + verified | Pending |
| 27 | `20260723181000_entry_submission_revalidation.sql` | Submitted-entry revalidation | Production clone passed | Pending |
| 28 | `20260723183000_knockout_result_lifecycle.sql` | Result lifecycle and revisions | Behaviour rehearsed | Zero-score preflight passed; pending |
| 29 | `20260723183100_result_method_guard.sql` | Result-method integrity | Applied + verified | Pending |
| 30 | `20260723183200_lock_result_revision_log.sql` | Immutable revision log | Applied + verified | Pending |
| 31 | `20260723184000_knockout_bracket_tree_integrity.sql` | Predicted replay and real winner propagation | Behaviour rehearsed | Pending |
| 32 | `20260723184100_bracket_tree_compatibility.sql` | Bracket-tree compatibility/preflight | Production clone passed | Read-only source check passed; pending |
| 33 | `20260723190000_atomic_bracket_persistence.sql` | Atomic complete-bracket RPC | PT409 rollback rehearsed | Pending; live client already requires it |
| 34 | `20260724001500_harden_function_privileges.sql` | Exact function allowlists and fixed search paths | ACL/advisor/RPC verified | Pending |
| 35 | `20260724003000_delete_match_prediction_rpc.sql` | Version-safe persisted score clearing | RPC/client/pgTAP/hosted proof verified | Pending; live client already requires it |

## Verified development contract

Development verification through migration 35 includes:

- private resolver schema denied to browser roles;
- RPC-only submission and server-derived positions;
- same-tournament and pre-lock prediction boundaries;
- result confirm/correct/clear, immutable revisions and serialized scoring;
- real winner propagation and complete predicted-bracket replay;
- atomic expected-version bracket replacement;
- zero anonymous public-function execution;
- exact authenticated and service-role function allowlists;
- owner-only future function defaults and fixed helper search paths;
- version-safe `delete_match_prediction(...)` with direct table deletion denied;
- unknown/stale delete versions returning `PT409`;
- successful deletion invalidating the affected group-position snapshot;
- idempotent repeated clearing and post-lock refusal.

Hosted proof was rollback-only where source rows were temporarily changed. The normalized development mirror remains at 36 predictions, 24 derived positions, eight progression rows and the exact submitted timestamp/fingerprints.

See:

- `docs/quality/reconciliations/2026-07-23-hosted-migration-rehearsal.md`;
- `docs/quality/reconciliations/2026-07-24-function-privilege-hardening.md`;
- `docs/quality/reconciliations/2026-07-24-score-clearing.md`;
- `docs/quality/reconciliations/2026-07-24-post-merge-production-release-state.md`.

## Production source evidence

The post-deploy read-only snapshot found:

- 4 profiles and 4 entries;
- exactly one submitted entry;
- 36 group predictions;
- two valid tie resolutions;
- eight progression rows;
- zero stored match scores;
- both client-required RPCs absent;
- old direct table privileges/policies still present.

The rollout-guard fingerprints remain:

- predictions `8d76619fe4b44fdac17de1cc2afe5aaa`;
- tie decisions `a4dcf183f5c48e3ba11ff75c59622598`;
- progression `0d7bc491daa9b24013204d061a2d38f1`.

Any submitted timestamp, source payload or fingerprint change requires a fresh preflight and production-to-development replay.

## Migration-history and rollout boundary

Before any production `db push`:

1. link to the exact production project;
2. rerun both committed production preflights;
3. run `supabase migration list`;
4. apply only the prepared metadata repair for proven migrations 1–20;
5. require the list to show 1–20 aligned and 21–35 pending;
6. require `supabase db push --dry-run` to show migrations 21–35 only;
7. obtain explicit approval before applying SQL.

Do not edit migration history directly. Do not mark migrations 21–35 applied before their SQL executes.

## Production rollout prerequisites

All are mandatory:

- explicit owner approval;
- verified backup/export or equivalent recovery evidence;
- named operator and rollback decision owner;
- production write/deploy freeze;
- fresh baseline and source-data preflights;
- exact timestamp and fingerprints;
- reviewed 1–20 history-repair output;
- dry run showing 21–35 only;
- strict timestamp-order application;
- `scripts/database-rollout/post-rollout-verification.sql` passing;
- security-advisor evidence;
- bracket save/reload smoke test;
- score clear/reload, conflict and post-lock refusal smoke tests;
- retained change record.

Follow `docs/ops-hosted-migration-rollout.md`.

## Non-negotiable rollout rules

1. No production migration without explicit approval.
2. Never use `db reset --linked` against production.
3. Never bypass fail-closed preflights.
4. Never alter rollout guards during the change window.
5. Preserve environment isolation.
6. Apply migrations 21–35 in strict order; never apply migration 33, 34 or 35 alone.
7. Verify schema, privileges, data and application behaviour—not a generic success message.
8. Treat application and database as one release pair.
