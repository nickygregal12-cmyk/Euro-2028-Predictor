# Hosted migration inventory and rollout status

This is the live source of truth for repository migration count, hosted semantic state and rollout readiness.

## Current status — 23 July 2026

| Environment | Semantic schema state | Migration-history state | Status |
| --- | --- | --- | --- |
| Development `iouzoutneyjpugbbtdem` | Migrations 1–33 effects present; cleaned to the expected post-rollout production mirror | Partial/tool-generated remote history; requires CLI reconciliation | **Hosted rehearsal complete** |
| Production `vkfnsqdyhvtwyqkisxhk` | Original migrations 1–20 only | Original migrations were manually applied; authoritative 1–20 CLI history absent | **13 pending; hardened read-only preflight passed; rollout not performed** |

No production migration is approved merely because it exists on `main`, passed local CI or passed the read-only preflight.

## Repository migration chain

### Original hosted baseline — 1–20

| # | Migration | Purpose |
| --- | --- | --- |
| 1 | `20260719120000_init_v0_1.sql` | Initial tournament, entry and prediction schema with RLS |
| 2 | `20260719130000_add_match_prediction_joker.sql` | Joker flag |
| 3 | `20260719140000_add_predicted_tie_resolutions.sql` | Manual predicted tie decisions |
| 4 | `20260719150000_enforce_joker_rules.sql` | Joker limit and kickoff commitment |
| 5 | `20260719160000_add_bonus_and_submit.sql` | Players, bonus predictions and original submit RPC |
| 6 | `20260719170000_lock_and_leaderboard.sql` | Tournament lock and leaderboard |
| 7 | `20260719180000_add_leagues.sql` | Leagues and membership |
| 8 | `20260720120000_league_fk_semantics.sql` | League FK deletion semantics |
| 9 | `20260720130000_add_scoring.sql` | Initial SQL scorer |
| 10 | `20260720140000_fix_recompute_trigger.sql` | Recompute-trigger correction |
| 11 | `20260720150000_add_last_seen.sql` | Catch-up fields |
| 12 | `20260720160000_add_profile_welcomed_at.sql` | Welcome gate field |
| 13 | `20260720170000_reveal_after_lock.sql` | Rival entry reveal RPC |
| 14 | `20260720180000_add_rank_history.sql` | Rank history |
| 15 | `20260720190000_profile_on_signup.sql` | Server-created profile on signup |
| 16 | `20260720200000_display_name_moderation.sql` | Display-name policy |
| 17 | `20260720210000_rate_limits.sql` | Prediction and league-join rate limits |
| 18 | `20260721120000_scoring_positions_knockout_awards.sql` | Group-position, knockout and award scoring |
| 19 | `20260721130000_match_centre.sql` | Match-centre aggregate RPCs |
| 20 | `20260722120000_write_integrity.sql` | Optimistic row versions and original structural checks |

### Hosted development rehearsed / production pending — 21–33

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

## Development rehearsal result

Development disposable competition state was reset while preserving Auth-backed profiles and reference data.

Verified after migration 33:

- private schema is inaccessible to browser roles;
- direct authenticated updates/deletes to entry submission state are denied;
- direct authenticated insert/update/delete on group positions and progression are denied;
- submission and bracket replacement use protected RPCs;
- result confirm/correct/clear functions are service-role-only;
- the result revision table is inaccessible to browser roles and the service role;
- result confirmation, correction, clearing and winner propagation work;
- stale complete-bracket snapshots raise `PT409` without partial writes.

After behavioural evidence was captured, the development-only result revisions were cleared and the clone timestamp was restored to production. The final hosted development mirror has zero revisions, zero score events and zero rank history.

See `docs/quality/reconciliations/2026-07-23-hosted-migration-rehearsal.md`.

## Exact production-entry replay

The normalized production payload was mapped into development by match reference and team name.

Current rollout-guard fingerprints:

- predictions: `8d76619fe4b44fdac17de1cc2afe5aaa`;
- tie decisions: `a4dcf183f5c48e3ba11ff75c59622598`;
- progression: `0d7bc491daa9b24013204d061a2d38f1`.

The clone regenerated all 24 group positions, resolved eight R16 fixtures and passed the complete 15-match bracket and submission validators.

Any source-payload or submitted-timestamp change requires a fresh production-to-development clone and replay before the expected guards may be updated through review.

## Production read-only preflight

The hardened committed preflight script returned `overall_structural_pass = true`.

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

Production has no persisted predicted group positions under the old schema. Development proved the new server boundary derives all 24 from the existing production inputs.

The hardened post-rollout verifier returned `overall_pass = true` on cleaned migrated development.

## Migration-history boundary

The original hosted schema was created through manual SQL, not a clean CLI push.

Development now has the correct semantic schema, but the connector recorded tool-generated migration timestamps for 12 operations and migration 30 was executed separately. Production has not been changed.

Before any `db push`:

1. link to the exact target project;
2. run `supabase migration list`;
3. verify the schema effect of every migration claimed as already applied;
4. use `supabase migration repair <timestamp> --status applied` only for proven existing effects;
5. rerun the list;
6. require `supabase db push --dry-run` to show only genuinely pending repository files.

Do not edit `supabase_migrations.schema_migrations` directly and do not use history repair to pretend SQL has run.

## Production rollout prerequisites

All are required:

- explicit owner approval;
- verified backup/export or equivalent recovery evidence;
- named operator and rollback decision owner;
- production write/deploy freeze;
- immediate rerun of `scripts/database-rollout/production-preflight.sql`;
- exact timestamp and rollout-guard fingerprint match;
- reviewed migration-history repair output;
- dry run showing migrations 21–33 only;
- strict timestamp-order push;
- `scripts/database-rollout/post-rollout-verification.sql` passing;
- production application save/reload smoke test through the atomic bracket RPC;
- retained advisor output and change record.

Follow `docs/ops-hosted-migration-rollout.md`.

## Rollout rules

1. **No production migration without explicit approval.**
2. **No production reset.** Never use `db reset --linked` against production.
3. **Do not bypass fail-closed preflights.**
4. **Do not update rollout guards during the change window.**
5. **Preserve environment isolation.** Production remains connected to production Supabase.
6. **Apply in strict timestamp order.** Never paste only migration 33.
7. **Verify schema and behaviour, not a generic success message.**
8. **Application and database form one release pair.**
9. **Re-run security advisors after rollout.** Legacy `SECURITY-003` items remain a separate follow-up.

## Related evidence

- `docs/quality/current-status.md`
- `docs/quality/audits/2026-07-23-live-environment-audit.md`
- `docs/quality/reconciliations/2026-07-23-hosted-migration-rehearsal.md`
- `docs/ops-hosted-migration-rollout.md`
- `scripts/database-rollout/production-preflight.sql`
- `scripts/database-rollout/post-rollout-verification.sql`