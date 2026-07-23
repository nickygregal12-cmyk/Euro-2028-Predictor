# Hosted migration inventory and rollout status

This is the live source of truth for repository migration count, hosted semantic state and rollout readiness.

## Current status — 24 July 2026

| Environment | Semantic schema state | Migration-history state | Status |
| --- | --- | --- | --- |
| Development `iouzoutneyjpugbbtdem` | Migrations 1–34 effects present; exact post-rollout data and function-privilege contract verified | Partial/tool-generated remote history; requires CLI reconciliation | **Hosted rehearsal complete through migration 34** |
| Production `vkfnsqdyhvtwyqkisxhk` | Original migrations 1–20 effects independently verified | Hosted history list empty; exact 1–20 metadata-only repair prepared but not executed | **14 pending; read-only preflights passed; rollout not performed** |

No production migration is approved merely because it exists on `main`, passed local CI or passed a read-only preflight.

## Repository migration chain

### Original hosted baseline — 1–20

| # | Migration | Purpose | Production proof |
| --- | --- | --- | --- |
| 1 | `20260719120000_init_v0_1.sql` | Initial tournament, entry and prediction schema with RLS | Proven present |
| 2 | `20260719130000_add_match_prediction_joker.sql` | Joker flag | Proven present |
| 3 | `20260719140000_add_predicted_tie_resolutions.sql` | Manual predicted tie decisions | Proven present |
| 4 | `20260719150000_enforce_joker_rules.sql` | Joker limit and kickoff commitment | Proven present |
| 5 | `20260719160000_add_bonus_and_submit.sql` | Players, bonus predictions and original submit RPC | Proven present |
| 6 | `20260719170000_lock_and_leaderboard.sql` | Tournament lock and leaderboard | Proven present |
| 7 | `20260719180000_add_leagues.sql` | Leagues and membership | Proven present |
| 8 | `20260720120000_league_fk_semantics.sql` | League FK deletion semantics | Proven present |
| 9 | `20260720130000_add_scoring.sql` | Initial SQL scorer | Proven present |
| 10 | `20260720140000_fix_recompute_trigger.sql` | Recompute-trigger correction | Proven present |
| 11 | `20260720150000_add_last_seen.sql` | Catch-up fields | Proven present |
| 12 | `20260720160000_add_profile_welcomed_at.sql` | Welcome gate field | Proven present |
| 13 | `20260720170000_reveal_after_lock.sql` | Rival entry reveal RPC | Proven present |
| 14 | `20260720180000_add_rank_history.sql` | Rank history | Proven present |
| 15 | `20260720190000_profile_on_signup.sql` | Server-created profile on signup | Proven present |
| 16 | `20260720200000_display_name_moderation.sql` | Display-name policy | Proven present |
| 17 | `20260720210000_rate_limits.sql` | Prediction and league-join rate limits | Proven present |
| 18 | `20260721120000_scoring_positions_knockout_awards.sql` | Group-position, knockout and award scoring | Proven present |
| 19 | `20260721130000_match_centre.sql` | Match-centre aggregate RPCs | Proven present |
| 20 | `20260722120000_write_integrity.sql` | Optimistic row versions and original structural checks | Proven present |

The production verifier returned `all_structural_effects_present = true` with every individual check true. See:

- `scripts/database-rollout/production-baseline-1-20-verification.sql`;
- `docs/quality/reconciliations/2026-07-23-production-migration-history-1-20.md`.

### Hosted development rehearsed / production pending — 21–34

| # | Migration | Workstream | Development | Production |
| --- | --- | --- | --- | --- |
| 21 | `20260723170000_predictor_internal_schema.sql` | Private resolver schema boundary | Applied + verified | Pending |
| 22 | `20260723173000_predicted_group_order_resolver.sql` | PostgreSQL predicted-group-order resolver | Applied + verified | Pending |
| 23 | `20260723174500_harden_entry_lock_functions.sql` | Qualified lock functions/search paths | Applied + verified | Pending |
| 24 | `20260723175000_submitted_entry_preflight.sql` | Submitted-entry fail-closed preflight | Passed | Read-only equivalent passed |
| 25 | `20260723175500_entry_boundary_preflight.sql` | Cross-scope and entry-boundary preflight | Passed | Read-only equivalent passed |
| 26 | `20260723180000_entry_boundary_integrity.sql` | RPC-only submission and derived group positions | Applied + verified | Pending |
| 27 | `20260723181000_entry_submission_revalidation.sql` | Revalidate existing submitted entries | Applied + exact production clone passed | Pending |
| 28 | `20260723183000_knockout_result_lifecycle.sql` | Authoritative result lifecycle and revisions | Applied + behaviour rehearsed | Zero-score preflight passed; pending |
| 29 | `20260723183100_result_method_guard.sql` | Result-method integrity guard | Applied + verified | Pending |
| 30 | `20260723183200_lock_result_revision_log.sql` | Immutable result revision log | Exact revoke applied + verified | Pending |
| 31 | `20260723184000_knockout_bracket_tree_integrity.sql` | Predicted tree replay and real winner propagation | Applied + behaviour rehearsed | Pending |
| 32 | `20260723184100_bracket_tree_compatibility.sql` | Compatibility/preflight for bracket-tree rules | Applied + exact production clone passed | Read-only source-tree check passed; pending |
| 33 | `20260723190000_atomic_bracket_persistence.sql` | Atomic expected-version complete-bracket RPC | Applied + PT409 rehearsal passed | Pending |
| 34 | `20260724001500_harden_function_privileges.sql` | Exact function execution allowlists, closed defaults and fixed helper search paths | Applied + exact ACL/advisor/trigger/RPC verification passed | Pending |

## Development rehearsal result

Development disposable competition state was reset while preserving Auth-backed profiles and reference data.

Verified after migration 34:

- private schema is inaccessible to browser roles;
- direct authenticated updates/deletes to entry submission state are denied;
- direct authenticated insert/update/delete on group positions and progression are denied;
- submission and bracket replacement use protected RPCs;
- result confirm/correct/clear functions are service-role-only;
- the result revision table is inaccessible to browser roles and the service role;
- result confirmation, correction, clearing and winner propagation work;
- stale complete-bracket snapshots raise `PT409` without partial writes;
- anonymous roles can execute no public application function;
- authenticated and service roles have exact allowlists with no missing or surplus function;
- future public functions default to owner-only execution;
- the three previously mutable helper search paths are fixed and empty;
- signup trigger execution still works despite direct function execution being denied;
- authenticated leaderboard, distribution and idempotent submission smoke tests pass.

After behavioural evidence was captured, the development-only result revisions were cleared and the clone timestamp was restored to production. The final hosted development mirror has zero revisions, zero score events and zero rank history.

See:

- `docs/quality/reconciliations/2026-07-23-hosted-migration-rehearsal.md`;
- `docs/quality/reconciliations/2026-07-24-function-privilege-hardening.md`.

## Exact production-entry replay

The normalized production payload was mapped into development by match reference and team name.

Current rollout-guard fingerprints:

- predictions: `8d76619fe4b44fdac17de1cc2afe5aaa`;
- tie decisions: `a4dcf183f5c48e3ba11ff75c59622598`;
- progression: `0d7bc491daa9b24013204d061a2d38f1`.

The clone regenerated all 24 group positions, resolved eight R16 fixtures and passed the complete 15-match bracket and submission validators.

Any source-payload or submitted-timestamp change requires a fresh production-to-development clone and replay before the expected guards may be updated through review.

## Production read-only preflights

The committed entry preflight returned `overall_structural_pass = true` for the source state required by migrations 21–34.

Current production evidence:

- exactly one submitted entry with the rehearsed timestamp, before lock;
- 36 group predictions;
- exactly one group tie and one third-place tie, both valid;
- all three rollout-guard fingerprints match;
- complete `4/2/1/1` progression shape;
- zero old group-position rows;
- zero legacy match scores, score events and rank history;
- zero inspected scope anomalies;
- valid `8/4/2/1` knockout source tree;
- 14 unique, correctly ordered winner-source references.

The baseline 1–20 verifier separately proved every historical structural effect. Its function-ACL section describes the existing production drift that migration 34 repairs.

Production has no persisted predicted group positions under the old schema. Development proved the new server boundary derives all 24 from the existing production inputs.

The migrations 21–34 post-rollout verifier returned `overall_pass = true` on hosted development, including the exact function ACL matrix.

## Function privilege position — `SECURITY-003`

Repository and hosted development are fixed through migration 34.

The security-advisor delta on development is:

- all anonymous `SECURITY DEFINER` execution warnings removed;
- all mutable-search-path warnings removed;
- intentionally authenticated application RPC warnings remain because those functions are the designed signed-in API boundary;
- leaked-password protection remains a separate Auth configuration warning;
- no-policy INFO notices on internal deny-all tables remain intentional.

Production remains on the old broad grants until migrations 21–34 are applied. Do not replay migrations 1–20 as a function-security repair.

## Migration-history boundary

The original hosted schema was created through manual SQL, not a clean CLI push. Production’s migration-history list remains empty.

The exact 1–20 metadata-only repair is prepared in `docs/ops-hosted-migration-rollout.md`, but it has not been executed.

Before any `db push`:

1. link to the exact production project;
2. run both committed production preflight scripts;
3. run `supabase migration list`;
4. apply only the prepared 1–20 history repair when every baseline check remains true;
5. rerun the list and require 1–20 aligned with 21–34 pending;
6. require `supabase db push --dry-run` to show migrations 21–34 only.

Do not edit `supabase_migrations.schema_migrations` directly and do not use history repair to pretend SQL has run. Do not mark migrations 21–34 applied before their SQL runs.

## Production rollout prerequisites

All are required:

- explicit owner approval;
- verified backup/export or equivalent recovery evidence;
- named operator and rollback decision owner;
- production write/deploy freeze;
- immediate rerun of both production preflight scripts;
- exact timestamp and rollout-guard fingerprint match;
- baseline verifier all true;
- reviewed migration-history repair output;
- dry run showing migrations 21–34 only;
- strict timestamp-order push;
- `scripts/database-rollout/post-rollout-verification.sql` passing, including exact function allowlists;
- production application save/reload smoke test through the atomic bracket RPC;
- retained security-advisor output and change record.

Follow `docs/ops-hosted-migration-rollout.md`.

## Rollout rules

1. **No production migration without explicit approval.**
2. **No production reset.** Never use `db reset --linked` against production.
3. **Do not bypass fail-closed preflights.**
4. **Do not update rollout guards during the change window.**
5. **Preserve environment isolation.** Production remains connected to production Supabase.
6. **Apply in strict timestamp order.** Never apply only migration 33 or 34.
7. **Verify schema and behaviour, not a generic success message.**
8. **Application and database form one release pair.**
9. **Re-run security advisors after rollout.** Expected signed-in application-RPC warnings must be distinguished from anonymous/internal exposure.

## Related evidence

- `docs/quality/current-status.md`
- `docs/quality/audits/2026-07-23-live-environment-audit.md`
- `docs/quality/reconciliations/2026-07-23-hosted-migration-rehearsal.md`
- `docs/quality/reconciliations/2026-07-23-production-migration-history-1-20.md`
- `docs/quality/reconciliations/2026-07-24-function-privilege-hardening.md`
- `docs/ops-hosted-migration-rollout.md`
- `scripts/database-rollout/production-baseline-1-20-verification.sql`
- `scripts/database-rollout/production-preflight.sql`
- `scripts/database-rollout/post-rollout-verification.sql`