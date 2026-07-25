# Hosted migration inventory and rollout status

This is the live source of truth for repository migration count, hosted semantic state and rollout status.

## Current status — 25 July 2026

| Environment | Semantic schema state | Migration-history state | Status |
| --- | --- | --- | --- |
| Development `iouzoutneyjpugbbtdem` | Migrations 1–35 effects present; schema, ACL and application contracts verified | Exactly 35 canonical versions aligned | **Contract 35 complete; zero pending through 35** |
| Production `vkfnsqdyhvtwyqkisxhk` | Migrations 1–35 effects present; 63-check verifier and rollback-only smoke passed | Exactly 35 canonical versions aligned through `20260724003000` | **Contract 35 complete; zero pending through 35** |

Repository and hosted environments contain exactly 35 authoritative migration files/versions. The final production `supabase db push --dry-run` reported the remote database was up to date.

Draft migration 36 exists only in PR #76. It is unmerged, was absent from the approved production checkout and was not applied to development or production.

## Production application/release boundary

Current compatible production pair:

| Item | Verified value |
| --- | --- |
| Repository/deployed commit | `902a37aa6c50c967f8080d751147a5733b251fe3` |
| Netlify deploy | `6a652c3d3416d26d595ae2ef` |
| Repository contract | 35 |
| Production Netlify contract | 35 |
| Production Supabase | `vkfnsqdyhvtwyqkisxhk` |
| Atomic bracket RPC | `replace_predicted_progression(uuid,jsonb,jsonb)` present |
| Protected score-clear RPC | `delete_match_prediction(uuid,uuid,integer)` present |

The former contract-20 application/database mismatch is resolved. Do not restore direct-table compatibility fallbacks.

## Authoritative repository chain

| # | Migration | Purpose | Development | Production |
| ---: | --- | --- | --- | --- |
| 1 | `20260719120000_init_v0_1.sql` | Initial tournament, entry and prediction schema/RLS | Applied | Applied/history aligned |
| 2 | `20260719130000_add_match_prediction_joker.sql` | Joker flag | Applied | Applied/history aligned |
| 3 | `20260719140000_add_predicted_tie_resolutions.sql` | Manual predicted tie decisions | Applied | Applied/history aligned |
| 4 | `20260719150000_enforce_joker_rules.sql` | Joker limit and kickoff commitment | Applied | Applied/history aligned |
| 5 | `20260719160000_add_bonus_and_submit.sql` | Players, bonus prediction and original submit RPC | Applied | Applied/history aligned |
| 6 | `20260719170000_lock_and_leaderboard.sql` | Tournament lock and leaderboard | Applied | Applied/history aligned |
| 7 | `20260719180000_add_leagues.sql` | Leagues and membership | Applied | Applied/history aligned |
| 8 | `20260720120000_league_fk_semantics.sql` | League FK deletion semantics | Applied | Applied/history aligned |
| 9 | `20260720130000_add_scoring.sql` | Initial SQL scorer | Applied | Applied/history aligned |
| 10 | `20260720140000_fix_recompute_trigger.sql` | Recompute-trigger correction | Applied | Applied/history aligned |
| 11 | `20260720150000_add_last_seen.sql` | Catch-up fields | Applied | Applied/history aligned |
| 12 | `20260720160000_add_profile_welcomed_at.sql` | Welcome field | Applied | Applied/history aligned |
| 13 | `20260720170000_reveal_after_lock.sql` | Rival-entry reveal RPC | Applied | Applied/history aligned |
| 14 | `20260720180000_add_rank_history.sql` | Rank history | Applied | Applied/history aligned |
| 15 | `20260720190000_profile_on_signup.sql` | Server-created profile on signup | Applied | Applied/history aligned |
| 16 | `20260720200000_display_name_moderation.sql` | Display-name policy | Applied | Applied/history aligned |
| 17 | `20260720210000_rate_limits.sql` | Prediction/league-join rate limits | Applied | Applied/history aligned |
| 18 | `20260721120000_scoring_positions_knockout_awards.sql` | Position, knockout and award scoring | Applied | Applied/history aligned |
| 19 | `20260721130000_match_centre.sql` | Match-centre aggregate RPCs | Applied | Applied/history aligned |
| 20 | `20260722120000_write_integrity.sql` | Optimistic versions and structural checks | Applied | Applied/history aligned |
| 21 | `20260723170000_predictor_internal_schema.sql` | Private resolver schema | Applied | Applied |
| 22 | `20260723173000_predicted_group_order_resolver.sql` | PostgreSQL group resolver | Applied/parity verified | Applied/verified |
| 23 | `20260723174500_harden_entry_lock_functions.sql` | Qualified lock helpers | Applied | Applied |
| 24 | `20260723175000_submitted_entry_preflight.sql` | Submitted-entry preflight | Applied | Applied |
| 25 | `20260723175500_entry_boundary_preflight.sql` | Entry/scope preflight | Applied | Applied |
| 26 | `20260723180000_entry_boundary_integrity.sql` | RPC submission and derived positions | Applied | Applied/verified |
| 27 | `20260723181000_entry_submission_revalidation.sql` | Submitted-entry revalidation | Applied | Applied/verified |
| 28 | `20260723183000_knockout_result_lifecycle.sql` | Result lifecycle/revisions | Applied | Applied/verified |
| 29 | `20260723183100_result_method_guard.sql` | Result-method integrity | Applied | Applied |
| 30 | `20260723183200_lock_result_revision_log.sql` | Immutable revision log | Applied | Applied |
| 31 | `20260723184000_knockout_bracket_tree_integrity.sql` | Predicted replay/real propagation | Applied | Applied/verified |
| 32 | `20260723184100_bracket_tree_compatibility.sql` | Compatibility/preflight | Applied | Applied |
| 33 | `20260723190000_atomic_bracket_persistence.sql` | Complete-bracket RPC | Applied | Applied/smoke passed |
| 34 | `20260724001500_harden_function_privileges.sql` | Exact allowlists/search paths | Applied | Applied/verified |
| 35 | `20260724003000_delete_match_prediction_rpc.sql` | Version-safe score clearing | Applied | Applied/verified |

## Production rollout evidence

Production execution proved:

- exact metadata-only repair for versions 1–20;
- exact dry run of versions 21–35;
- successful application in timestamp order;
- exactly 35 history records afterward;
- final zero-pending dry run;
- exactly 63 passing post-rollout checks;
- unchanged submitted timestamp and source fingerprints;
- 24 derived positions and eight preserved progression rows;
- no invented result, revision, score-event or rank-history data;
- both required client RPCs present;
- private resolver and browser-role boundaries correct;
- rollback-only atomic bracket, submission and result lifecycle smoke passed.

Required evidence-point fingerprints:

- predictions `320cf25d62767dee307d3602212909af`;
- ties `a4dcf183f5c48e3ba11ff75c59622598`;
- progression `0d7bc491daa9b24013204d061a2d38f1`.

These values record the rollout evidence point; legitimate future user changes require new evidence rather than treating the old values as permanent runtime invariants.

## Future migration rules

For migration 36 or any later migration:

1. merge only after repository CI, database parity and required browser checks pass;
2. update `config/deployment-contract.json` deliberately;
3. verify development first;
4. prepare a fresh production backup and recovery evidence appropriate to the change;
5. run read-only production preflight;
6. require a dry run listing only approved pending files;
7. obtain explicit owner approval before production SQL;
8. run post-verification and application smoke before changing the production Netlify contract;
9. update this inventory and the current production reconciliation.

Do not run additional migration-history repair against development or production unless a separately proven metadata defect exists. Never mark a future migration applied before its SQL executes.

## Related documents

- `docs/quality/current-status.md`
- `docs/quality/reconciliations/2026-07-25-contract-35-production-promotion.md`
- `docs/ops-hosted-migration-rollout.md`
- `docs/ops-production-backup-restore.md`
- `config/deployment-contract.json`