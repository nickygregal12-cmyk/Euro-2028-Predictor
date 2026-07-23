# Hosted migration inventory and rollout status

This is the live source of truth for repository migration count and hosted applied state. It supersedes the former statement that both databases were fully current at 20 migrations.

## Current status — 23 July 2026 (`2026-07-23L`)

| Environment | Verified hosted shape | Repository shape | Status |
| --- | --- | --- | --- |
| Development `iouzoutneyjpugbbtdem` | Original migrations 1–20 only | 33 migrations | **13 pending; legacy seed data blocks direct application** |
| Production `vkfnsqdyhvtwyqkisxhk` | Original migrations 1–20 only | 33 migrations | **13 pending; exact production preflight required** |

The hosted projects were created through manual SQL application, so a Supabase CLI migration-history table is not available as the sole verifier. Applied state must be established from current schema, functions, grants, policies and exact migration preflights.

No pending hosted migration is approved merely because it exists on `main` or passes disposable-local CI.

## Repository migration chain

### Hosted in development and production — 1–20

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

### Repository-only and pending hosted rollout — 21–33

| # | Migration | Workstream | Hosted status |
| --- | --- | --- | --- |
| 21 | `20260723170000_predictor_internal_schema.sql` | Private resolver schema boundary | Pending dev + prod |
| 22 | `20260723173000_predicted_group_order_resolver.sql` | PostgreSQL predicted-group-order resolver | Pending dev + prod |
| 23 | `20260723174500_harden_entry_lock_functions.sql` | Qualified lock functions/search paths | Pending dev + prod |
| 24 | `20260723175000_submitted_entry_preflight.sql` | Submitted-entry fail-closed preflight | Pending dev + prod |
| 25 | `20260723175500_entry_boundary_preflight.sql` | Cross-scope and entry-boundary preflight | Pending dev + prod |
| 26 | `20260723180000_entry_boundary_integrity.sql` | RPC-only submission and derived group positions | Pending dev + prod |
| 27 | `20260723181000_entry_submission_revalidation.sql` | Revalidate existing submitted entries | Pending dev + prod |
| 28 | `20260723183000_knockout_result_lifecycle.sql` | Authoritative result lifecycle and revisions | Pending dev + prod |
| 29 | `20260723183100_result_method_guard.sql` | Result-method integrity guard | Pending dev + prod |
| 30 | `20260723183200_lock_result_revision_log.sql` | Immutable result revision log | Pending dev + prod |
| 31 | `20260723184000_knockout_bracket_tree_integrity.sql` | Predicted tree replay and real winner propagation | Pending dev + prod |
| 32 | `20260723184100_bracket_tree_compatibility.sql` | Compatibility/preflight for bracket-tree rules | Pending dev + prod |
| 33 | `20260723190000_atomic_bracket_persistence.sql` | Atomic expected-version complete-bracket RPC | Pending dev + prod |

## Confirmed live-schema differences

Both hosted projects currently lack:

- `predictor_internal.resolve_predicted_group_order`;
- the private predicted-bracket validator;
- RPC-only entry submission policies/grants;
- protected server-derived group positions;
- result lifecycle columns and confirm/correct/clear functions;
- result revision history;
- real winner propagation;
- `replace_predicted_progression`.

Both hosted projects still grant authenticated direct write privileges to `entries`, `predicted_group_positions` and `predicted_progression` under the original owner policies.

## Current compatibility incident

Production Netlify serves application commit `51d8ac6`, which calls `replace_predicted_progression`. Production Supabase does not contain that RPC. Treat this as `OPS-006`: a deployed application/schema mismatch. Do not perform normal production promotion until a reviewed recovery plan restores a compatible pair.

## Development rollout blocker

Read-only inspection found:

- 22 submitted development entries;
- 20 with the legacy 16-row progression representation;
- 2 with the current 8-row representation;
- 12 scored matches.

The later entry/bracket preflights and result-lifecycle preflight are expected to fail. Choose explicitly between:

1. resetting disposable/seeded development data and rebuilding all 33 migrations; or
2. preserving selected data through a reviewed remediation script.

Development reset logic must never be reused against production.

## Production preflight position

Read-only inspection found:

- one submitted entry;
- 36 match predictions;
- two saved tie decisions;
- a complete 8-row `4/2/1/1` progression shape;
- no stored results;
- no inspected cross-tournament prediction anomalies.

This improves the likelihood of a clean rollout but does not prove it. Before approval, execute the exact preflights in migrations 24, 25, 27, 28 and 32 inside a reviewed read-only/dry-run procedure and retain the real rows/errors.

## Rollout rules

1. **No hosted migration without explicit approval.**
2. **Development first.** Rebuild and verify all 33 migrations in the intended development state.
3. **Do not bypass fail-closed preflights.** A failure requires investigation or remediation.
4. **Preserve environment isolation.** Production never points to development.
5. **Back up/record before production.** A recovery plan and compatibility decision must be reviewed before applying the chain.
6. **Apply in strict timestamp order.** Do not paste only the final migration.
7. **Verify schema and behavior, not “Success”.** Record columns, grants, policies, function signatures and functional tests.
8. **Deploy compatible code and schema as one controlled release.** A successful Netlify build is not a database verification.
9. **Re-run Supabase security advisors after rollout.** Triage every remaining browser-executable `SECURITY DEFINER` function and mutable search path.

## Minimum post-rollout verification

After applying the chain to a target environment, confirm at least:

- `predictor_internal` exists but is inaccessible to `anon`/`authenticated`;
- authenticated users cannot update `entries.submitted_at` directly;
- authenticated users cannot insert/update/delete `predicted_group_positions`;
- authenticated users cannot insert/update/delete `predicted_progression` directly;
- `submit_entry` is owner-checked, lock-aware and validates the complete tree;
- `replace_predicted_progression` exists and rejects stale complete snapshots;
- result lifecycle columns and service-role-only result RPCs exist;
- direct result writes and revision writes are denied;
- winner propagation and downstream correction order work;
- scoring and rank history remain correct;
- the live application can save/reload a bracket through the RPC;
- production deploy previews do not use production Supabase.

## Related evidence

- `docs/quality/current-status.md`
- `docs/quality/audits/2026-07-23-live-environment-audit.md`
- `docs/quality/reconciliations/2026-07-23-entry-boundary-integrity.md`
- `docs/quality/reconciliations/2026-07-23-knockout-result-lifecycle.md`
- `docs/quality/reconciliations/2026-07-23-knockout-bracket-tree-integrity.md`
- `docs/quality/reconciliations/2026-07-23-atomic-bracket-persistence.md`
- `docs/ops-prod-cutover.md`
