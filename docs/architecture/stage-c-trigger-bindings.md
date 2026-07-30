# Stage C — trigger binding inventory

**Status:** Pre-migration contract; no Stage C schema implementation exists.  
**Baseline:** `main` at `23f011d7e88740293c9ceedf26c356bcb34edc62`.  
**Parent design:** [`stage-c-competition-season-schema.md`](stage-c-competition-season-schema.md)  
**Object coverage:** [`stage-c-schema-coverage.md`](stage-c-schema-coverage.md)

## Purpose

Stage C changes season scope across a heavily defended schema. Defining a validator
function is not sufficient: its trigger must remain attached to the intended table.
This inventory pins every current non-internal trigger on a `public` table to its
effective function.

A Stage C implementation must update this inventory atomically when it adds,
removes, renames or rebinds a trigger. Scope validators should widen from
same-tournament to same-season semantics, while locks, result boundaries, scoring,
audit immutability, rate limits and unrelated profile/operating controls must remain
attached unless a separately approved design changes them.

The list is supported by the effective committed migration history, a read-only
development catalogue check on 30 July 2026 and
`tests/database-parity/stageCTriggerBindingCoverage.test.ts`. The catalogue check
read metadata only and performed no database write.

## Current effective bindings

| Table and trigger | Effective function | Stage C disposition |
| --- | --- | --- |
| `actual_third_place_resolution_revisions.block_actual_tie_revision_mutation` | `predictor_internal.block_actual_tie_revision_mutation` | preserve revision immutability |
| `actual_third_place_resolutions.validate_actual_third_place_resolution` | `predictor_internal.validate_actual_third_place_resolution` | preserve tournament-only resolution validation |
| `bonus_competition_audit.block_bonus_audit_mutation` | `predictor_internal.block_bonus_audit_mutation` | preserve audit immutability |
| `bonus_knockout_predictions.assert_bonus_knockout_prediction_shape` | `predictor_internal.assert_bonus_knockout_prediction_shape` | generalise same-season bonus shape validation |
| `bonus_lms_selections.assert_bonus_lms_selection_shape` | `predictor_internal.assert_bonus_lms_selection_shape` | generalise same-season bonus shape validation |
| `bonus_predictions.enforce_lock_bonus` | `public.enforce_entry_lock_generic` | preserve monotonic entry lock enforcement |
| `bonus_predictions.enforce_version_bonus_predictions` | `public.enforce_write_version` | preserve optimistic write-version enforcement |
| `bonus_predictions.validate_bonus_scope` | `predictor_internal.validate_bonus_scope` | generalise same-season bonus scope validation |
| `bonus_window_fixtures.assert_bonus_window_fixture_shape` | `predictor_internal.assert_bonus_window_fixture_shape` | generalise same-season fixture/window validation |
| `entries.validate_bracket_on_submission` | `predictor_internal.validate_bracket_on_submission` | preserve authoritative submission validation |
| `entry_automatic_submission_outcomes.block_automatic_submission_outcome_mutation` | `predictor_internal.block_automatic_submission_outcome_mutation` | preserve outcome immutability |
| `group_teams.validate_group_team_scope` | `predictor_internal.validate_group_team_scope` | generalise same-season group/team validation |
| `league_members.rate_limit_league_membership` | `public.trg_rate_limit_league_membership` | preserve membership rate limiting |
| `leagues.enforce_total_league_limit` | `predictor_internal.enforce_total_league_limit` | preserve operating-cap enforcement |
| `match_predictions.enforce_joker_rules_trg` | `public.enforce_joker_rules` | preserve Joker authority |
| `match_predictions.enforce_lock_match_prediction_delete` | `public.enforce_entry_lock_generic` | preserve post-lock delete rejection |
| `match_predictions.enforce_lock_scores` | `public.enforce_entry_lock_scores` | preserve per-fixture/entry score lock enforcement |
| `match_predictions.enforce_version_match_predictions` | `public.enforce_write_version` | preserve optimistic write-version enforcement |
| `match_predictions.rate_limit_prediction_save` | `public.trg_rate_limit_prediction_save` | preserve prediction rate limiting |
| `match_predictions.refresh_group_positions_after_match_prediction` | `predictor_internal.refresh_group_positions_from_match` | preserve derived predicted-group refresh |
| `match_predictions.validate_match_prediction_scope` | `predictor_internal.validate_match_prediction_scope` | generalise same-season entry/match validation |
| `match_result_revisions.validate_result_revision_scope` | `predictor_internal.validate_result_revision_scope` | generalise same-season revision/match validation |
| `matches.enforce_knockout_participant_boundary` | `predictor_internal.enforce_knockout_participant_boundary` | preserve knockout participant authority |
| `matches.enforce_match_result_boundary_insert` | `predictor_internal.enforce_match_result_boundary` | preserve result lifecycle on insert |
| `matches.enforce_match_result_boundary_update` | `predictor_internal.enforce_match_result_boundary` | preserve result lifecycle on update |
| `matches.enforce_round_of_16_participant_boundary` | `predictor_internal.enforce_round_of_16_participant_boundary` | preserve round-of-16 participant authority |
| `matches.propagate_knockout_winner` | `predictor_internal.propagate_knockout_winner` | preserve authoritative winner propagation |
| `matches.recompute_bonus_scores_on_result` | `predictor_internal.trg_recompute_bonus_on_result` | preserve independent bonus scoring authority |
| `matches.recompute_scores_on_result` | `public.trg_recompute_on_result` | preserve Predictor scoring authority; ACQ-R03 remains separate |
| `matches.validate_match_reference_scope` | `predictor_internal.validate_match_reference_scope` | generalise all match references to same-season validation |
| `players.validate_player_team_scope` | `predictor_internal.validate_player_team_scope` | generalise same-season player/team validation |
| `predicted_group_positions.enforce_lock_group_positions` | `public.enforce_entry_lock_generic` | preserve monotonic entry lock enforcement |
| `predicted_group_positions.validate_group_position_scope` | `predictor_internal.validate_group_position_scope` | generalise same-season entry/group/team validation |
| `predicted_progression.enforce_lock_progression` | `public.enforce_entry_lock_generic` | preserve monotonic entry lock enforcement |
| `predicted_progression.enforce_version_predicted_progression` | `public.enforce_write_version` | preserve optimistic write-version enforcement |
| `predicted_progression.validate_progression_scope` | `predictor_internal.validate_progression_scope` | generalise same-season entry/team validation |
| `predicted_tie_resolutions.enforce_lock_tie_resolutions` | `public.enforce_entry_lock_generic` | preserve monotonic entry lock enforcement |
| `predicted_tie_resolutions.refresh_group_positions_after_tie_resolution` | `predictor_internal.refresh_group_positions_from_tie` | preserve derived predicted-group refresh |
| `predicted_tie_resolutions.validate_tie_resolution_scope` | `predictor_internal.validate_tie_resolution_scope` | generalise same-season tie-resolution validation |
| `profiles.enforce_display_name` | `public.enforce_display_name_policy` | preserve profile naming policy independently of Stage C identity work |
| `score_events.validate_score_event_scope` | `predictor_internal.validate_score_event_scope` | generalise same-season entry/match/team validation |
| `tournaments.recompute_scores_on_golden_boot` | `public.trg_recompute_on_golden_boot` | preserve tournament award scoring authority |
| `tournaments.validate_tournament_award_scope` | `predictor_internal.validate_tournament_award_scope` | preserve tournament-only award validation |

## Change rules

1. Every new, removed, renamed or rebound non-internal trigger on a `public` table
   must update this inventory and the contract test in the same PR.
2. A validator listed in the Stage C coverage manifest must remain attached to at
   least one effective trigger unless its rule moves to a reviewed declarative
   constraint with equivalent hostile-write evidence.
3. Trigger removal is not accepted merely because the function still exists.
4. A new declarative composite foreign key may replace a simple equality trigger,
   but the replacement and hostile cross-season pgTAP must land atomically.
5. ACQ-R03 scoring-performance work remains separately governed; this inventory
   preserves the current scoring trigger and does not choose a recomputation model.
6. This inventory does not assume the outcome of data-protection issue #272 and
   does not authorise SQL, a migration or a hosted schema operation.
