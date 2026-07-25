# Hosted migration inventory and rollout status

This is the live source of truth for repository migration count, hosted semantic state and rollout readiness.

## Current status — 25 July 2026

| Environment | Semantic schema state | Migration-history state | Status |
| --- | --- | --- | --- |
| Development `iouzoutneyjpugbbtdem` | Migrations 1–35 effects present; schema, ACL and application contracts verified | **Exactly 35 canonical versions aligned** | **Contract 35 complete; no pending migration through 35** |
| Production `vkfnsqdyhvtwyqkisxhk` | Original migration 1–20 effects independently verified | `supabase_migrations.schema_migrations` absent; exact metadata-only repair prepared but not executed | **15 pending; rollout blocked by unproven restore** |

No production migration is approved merely because it exists, passes CI or passes read-only preflight. Draft migration 36 exists only in PR #76 and is not part of this inventory’s approved production chain.

## Production application/release boundary

Application-code baseline `a403b0796853453cb4115aea55729aced192a6ca` introduced executable paths requiring:

| Client path | Required function | Introduced by | Production state |
| --- | --- | --- | --- |
| Atomic complete-bracket persistence | `replace_predicted_progression(uuid,jsonb,jsonb)` | Migration 33 | **Absent** |
| Persisted score clearing | `delete_match_prediction(uuid,uuid,integer)` | Migration 35 | **Absent** |

Current ready production deploy is `6a630e4de510f100077bc120`, source `a6d3f1c97a93d48789435457769fd627c305ff27`.

Production contract remains 20; repository/non-production contract remains 35. The application/database pair is incompatible at both write boundaries, but the deployment gate prevents further incompatible production promotion. Do not restore direct-table fallbacks.

## Repository migration chain

### Proven production baseline — 1–20

| # | Migration | Purpose | Production proof |
| ---: | --- | --- | --- |
| 1 | `20260719120000_init_v0_1.sql` | Initial tournament, entry and prediction schema/RLS | Present |
| 2 | `20260719130000_add_match_prediction_joker.sql` | Joker flag | Present |
| 3 | `20260719140000_add_predicted_tie_resolutions.sql` | Manual predicted tie decisions | Present |
| 4 | `20260719150000_enforce_joker_rules.sql` | Joker limit and kickoff commitment | Present |
| 5 | `20260719160000_add_bonus_and_submit.sql` | Players, bonus prediction and original submit RPC | Present |
| 6 | `20260719170000_lock_and_leaderboard.sql` | Tournament lock and leaderboard | Present |
| 7 | `20260719180000_add_leagues.sql` | Leagues and membership | Present |
| 8 | `20260720120000_league_fk_semantics.sql` | League FK deletion semantics | Present |
| 9 | `20260720130000_add_scoring.sql` | Initial SQL scorer | Present |
| 10 | `20260720140000_fix_recompute_trigger.sql` | Recompute-trigger correction | Present |
| 11 | `20260720150000_add_last_seen.sql` | Catch-up fields | Present |
| 12 | `20260720160000_add_profile_welcomed_at.sql` | Welcome field | Present |
| 13 | `20260720170000_reveal_after_lock.sql` | Rival-entry reveal RPC | Present |
| 14 | `20260720180000_add_rank_history.sql` | Rank history | Present |
| 15 | `20260720190000_profile_on_signup.sql` | Server-created profile on signup | Present |
| 16 | `20260720200000_display_name_moderation.sql` | Display-name policy | Present |
| 17 | `20260720210000_rate_limits.sql` | Prediction/league-join rate limits | Present |
| 18 | `20260721120000_scoring_positions_knockout_awards.sql` | Position, knockout and award scoring | Present |
| 19 | `20260721130000_match_centre.sql` | Match-centre aggregate RPCs | Present |
| 20 | `20260722120000_write_integrity.sql` | Optimistic versions and original structural checks | Present |

The committed baseline verifier returned every structural check true on 25 July. Production history remains absent because the original effects were applied outside a canonical CLI migration history.

### Development applied / production pending — 21–35

| # | Migration | Workstream | Development | Production |
| ---: | --- | --- | --- | --- |
| 21 | `20260723170000_predictor_internal_schema.sql` | Private resolver schema | Applied/history aligned | Pending |
| 22 | `20260723173000_predicted_group_order_resolver.sql` | PostgreSQL group resolver | Applied/parity verified | Pending |
| 23 | `20260723174500_harden_entry_lock_functions.sql` | Qualified lock helpers | Applied/verified | Pending |
| 24 | `20260723175000_submitted_entry_preflight.sql` | Submitted-entry preflight | Applied | Read-only equivalent passed |
| 25 | `20260723175500_entry_boundary_preflight.sql` | Entry/scope preflight | Applied | Read-only equivalent passed |
| 26 | `20260723180000_entry_boundary_integrity.sql` | RPC submission and derived positions | Applied/verified | Pending |
| 27 | `20260723181000_entry_submission_revalidation.sql` | Submitted-entry revalidation | Applied/rehearsed | Pending |
| 28 | `20260723183000_knockout_result_lifecycle.sql` | Result lifecycle/revisions | Applied/rehearsed | Pending |
| 29 | `20260723183100_result_method_guard.sql` | Result-method integrity | Applied/verified | Pending |
| 30 | `20260723183200_lock_result_revision_log.sql` | Immutable revision log | Applied/verified | Pending |
| 31 | `20260723184000_knockout_bracket_tree_integrity.sql` | Predicted replay/real propagation | Applied/rehearsed | Pending |
| 32 | `20260723184100_bracket_tree_compatibility.sql` | Compatibility/preflight | Applied/rehearsed | Read-only source check passed; pending |
| 33 | `20260723190000_atomic_bracket_persistence.sql` | Complete-bracket RPC | Applied/conflict verified | Pending; live client requires it |
| 34 | `20260724001500_harden_function_privileges.sql` | Exact allowlists/search paths | Applied/ACL verified | Pending |
| 35 | `20260724003000_delete_match_prediction_rpc.sql` | Version-safe score clearing | Applied/RPC verified | Pending; live client requires it |

## Verified development contract

Development proof through migration 35 includes:

- exactly 35 canonical migration-history versions;
- empty final application-schema diff;
- private resolver denied to browser roles;
- RPC-only submission and server-derived positions;
- same-tournament and pre-lock boundaries;
- result confirm/correct/clear, immutable revisions and serialized scoring;
- real winner propagation and predicted-bracket replay;
- expected-version atomic bracket replacement;
- zero anonymous application-function execution;
- exact authenticated/service allowlists;
- owner-only future defaults and fixed helper paths;
- version-safe score deletion and denied direct table deletion;
- stale/unknown version conflicts, derived-position invalidation, idempotency and post-lock refusal.

Do not run more migration-history repair against development.

## Production source evidence

Read-only 25 July evidence confirms:

- one submitted entry;
- 36 group predictions;
- two valid tie resolutions;
- eight progression rows;
- zero stored match scores, score events and rank history;
- both required RPCs absent;
- old direct table privileges/policies still present;
- no migration-history table.

Required fingerprints:

- predictions `320cf25d62767dee307d3602212909af`;
- ties `a4dcf183f5c48e3ba11ff75c59622598`;
- progression `0d7bc491daa9b24013204d061a2d38f1`.

The obsolete development prediction fingerprint `8d76619fe4b44fdac17de1cc2afe5aaa` is not a production guard.

Any source timestamp/fingerprint change requires a new clone/replay and reviewed guard update before rollout.

## Recovery and rollout boundary

Completed recovery preparation:

- fresh logical production bundle created;
- roles/schema/data and critical Auth/profile tables verified;
- plaintext checksums passed;
- encrypted archive decrypted/checksum verified;
- off-device copy owner-confirmed.

Still mandatory:

- retrieve off-device copy and verify checksum after retrieval;
- disposable restore;
- counts/fingerprint/Auth/trigger/Storage verification;
- recovery acceptance;
- preferably forward migration rehearsal.

Before production `db push`:

1. verify current production deploy/repository contract;
2. complete and accept recovery evidence;
3. link to exact production project;
4. rerun both committed preflights;
5. run `supabase migration list`;
6. repair only proven 1–20 history metadata;
7. require 1–20 aligned and 21–35 pending;
8. require `supabase db push --dry-run` to show only 21–35;
9. obtain explicit approval before SQL.

Do not edit migration history directly or mark 21–35 applied before SQL executes.

## Mandatory production rollout checks

- explicit owner approval;
- accepted recovery record;
- named operator/recovery owner;
- production write/deploy freeze;
- fresh baseline/source preflights;
- verified release/contract identity;
- exact timestamps/fingerprints;
- reviewed history repair;
- 21–35-only dry run;
- strict timestamp-order application;
- post-rollout verifier and security advisors;
- bracket, submission-settlement and score-clear production smoke tests;
- retained change record;
- production contract changed to 35 only after all verification passes.

Follow `docs/ops-hosted-migration-rollout.md`.
