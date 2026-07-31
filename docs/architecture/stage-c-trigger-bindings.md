# Stage C — trigger binding inventory

**Status:** Contract 65 C1 after-state; C2 ownership work remains blocked by issue #272.  
**Baseline:** PR #317, migrations `20260730235602` and `20260730235721`.  
**Parent design:** [`stage-c-competition-season-schema.md`](stage-c-competition-season-schema.md)  
**Object coverage:** [`stage-c-schema-coverage.md`](stage-c-schema-coverage.md)

## Purpose

Stage C changes season scope across a heavily defended schema. Defining a validator
function is not sufficient: its trigger must remain attached to the intended table.
This inventory pins every effective non-internal trigger on a `public` table to its
function after contract 65.

The C1 migration adds preparation, lock-evidence, competition-identity and award
bindings while preserving the established lock, result, scoring, audit, rate-limit
and ownership authorities. The executable comparison is
`tests/database-parity/stageCTriggerBindingCoverage.test.ts`.

No hosted database write or C2 ownership change is claimed by this inventory.

## Current effective bindings

| Table and trigger | Effective function | Stage C disposition |
| --- | --- | --- |
| `actual_third_place_resolution_revisions.block_actual_tie_revision_mutation` | `predictor_internal.block_actual_tie_revision_mutation` | preserve revision immutability |
| `actual_third_place_resolutions.validate_actual_third_place_resolution` | `predictor_internal.validate_actual_third_place_resolution` | preserve tournament-only resolution validation |
| `bonus_competition_audit.a_prepare_competition_season_scope` | `predictor_internal.prepare_competition_season_scope` | derive and validate stored season scope |
| `bonus_competition_audit.block_bonus_audit_mutation` | `predictor_internal.block_bonus_audit_mutation` | preserve audit immutability |
| `bonus_competition_entrants.a_prepare_competition_season_scope` | `predictor_internal.prepare_competition_season_scope` | derive and validate stored season/game scope |
| `bonus_competition_windows.a_prepare_competition_season_scope` | `predictor_internal.prepare_competition_season_scope` | derive and validate stored season/game scope |
| `bonus_cup_fixtures.a_prepare_competition_season_scope` | `predictor_internal.prepare_competition_season_scope` | derive and validate Cup fixture scope |
| `bonus_cup_groups.a_prepare_competition_season_scope` | `predictor_internal.prepare_competition_season_scope` | derive and validate Cup group scope |
| `bonus_cup_members.a_prepare_competition_season_scope` | `predictor_internal.prepare_competition_season_scope` | derive and validate Cup member scope |
| `bonus_cup_penalty_numbers.a_prepare_competition_season_scope` | `predictor_internal.prepare_competition_season_scope` | derive and validate Cup penalty scope |
| `bonus_knockout_predictions.a_prepare_competition_season_scope` | `predictor_internal.prepare_competition_season_scope` | derive and validate KO Predictor scope |
| `bonus_knockout_predictions.assert_bonus_knockout_prediction_shape` | `predictor_internal.assert_bonus_knockout_prediction_shape` | preserve KO prediction shape validation |
| `bonus_lms_selections.a_prepare_competition_season_scope` | `predictor_internal.prepare_competition_season_scope` | derive and validate LMS scope |
| `bonus_lms_selections.assert_bonus_lms_selection_shape` | `predictor_internal.assert_bonus_lms_selection_shape` | preserve LMS selection shape validation |
| `bonus_predictions.a_prepare_competition_season_scope` | `predictor_internal.prepare_competition_season_scope` | derive and validate Original award scope |
| `bonus_predictions.enforce_lock_bonus` | `public.enforce_entry_lock_generic` | preserve monotonic entry lock enforcement |
| `bonus_predictions.enforce_version_bonus_predictions` | `public.enforce_write_version` | preserve optimistic write-version enforcement |
| `bonus_predictions.validate_bonus_scope` | `predictor_internal.validate_bonus_scope` | preserve award scope validation |
| `bonus_score_events.a_prepare_competition_season_scope` | `predictor_internal.prepare_competition_season_scope` | derive and validate bonus score scope |
| `bonus_window_fixtures.a_prepare_competition_season_scope` | `predictor_internal.prepare_competition_season_scope` | derive and validate window/fixture season scope |
| `bonus_window_fixtures.assert_bonus_window_fixture_shape` | `predictor_internal.assert_bonus_window_fixture_shape` | preserve fixture/window shape validation |
| `competition_awards.validate_competition_award_scope` | `predictor_internal.validate_competition_award_scope` | enforce same-season award winners |
| `competition_lock_events.prevent_lock_event_mutation` | `predictor_internal.prevent_lock_event_mutation` | keep observed lock evidence append-only |
| `competitions.prevent_competition_identity_change` | `predictor_internal.prevent_competition_identity_change` | keep stable competition slug immutable |
| `entries.validate_bracket_on_submission` | `predictor_internal.validate_bracket_on_submission` | preserve authoritative submission validation |
| `entry_automatic_submission_outcomes.block_automatic_submission_outcome_mutation` | `predictor_internal.block_automatic_submission_outcome_mutation` | preserve outcome immutability |
| `group_teams.a_prepare_competition_season_scope` | `predictor_internal.prepare_competition_season_scope` | derive and validate group/team season scope |
| `group_teams.validate_group_team_scope` | `predictor_internal.validate_group_team_scope` | preserve group/team validation |
| `league_members.rate_limit_league_membership` | `public.trg_rate_limit_league_membership` | preserve membership rate limiting |
| `leagues.enforce_total_league_limit` | `predictor_internal.enforce_total_league_limit` | preserve operating-cap enforcement |
| `match_predictions.a_prepare_competition_season_scope` | `predictor_internal.prepare_competition_season_scope` | derive and validate entry/match season scope |
| `match_predictions.enforce_joker_rules_trg` | `public.enforce_joker_rules` | preserve Joker authority |
| `match_predictions.enforce_lock_match_prediction_delete` | `public.enforce_entry_lock_generic` | preserve post-lock delete rejection |
| `match_predictions.enforce_lock_scores` | `public.enforce_entry_lock_scores` | preserve per-fixture and entry score locks |
| `match_predictions.enforce_version_match_predictions` | `public.enforce_write_version` | preserve optimistic write-version enforcement |
| `match_predictions.rate_limit_prediction_save` | `public.trg_rate_limit_prediction_save` | preserve prediction rate limiting |
| `match_predictions.refresh_group_positions_after_match_prediction` | `predictor_internal.refresh_group_positions_from_match` | preserve derived predicted-group refresh |
| `match_predictions.validate_match_prediction_scope` | `predictor_internal.validate_match_prediction_scope` | preserve entry/match validation |
| `match_result_revisions.validate_result_revision_scope` | `predictor_internal.validate_result_revision_scope` | preserve revision/match validation |
| `matches.a_prepare_match_season_scope` | `predictor_internal.prepare_match_season_scope` | derive and validate round/matchweek authority |
| `matches.enforce_knockout_participant_boundary` | `predictor_internal.enforce_knockout_participant_boundary` | preserve knockout participant authority |
| `matches.enforce_match_result_boundary_insert` | `predictor_internal.enforce_match_result_boundary` | preserve result lifecycle on insert |
| `matches.enforce_match_result_boundary_update` | `predictor_internal.enforce_match_result_boundary` | preserve result lifecycle on update |
| `matches.enforce_round_of_16_participant_boundary` | `predictor_internal.enforce_round_of_16_participant_boundary` | preserve round-of-16 participant authority |
| `matches.propagate_knockout_winner` | `predictor_internal.propagate_knockout_winner` | preserve authoritative winner propagation |
| `matches.recompute_bonus_scores_on_result` | `predictor_internal.trg_recompute_bonus_on_result` | preserve independent bonus scoring authority |
| `matches.recompute_scores_on_result` | `public.trg_recompute_on_result` | preserve Predictor scoring authority |
| `matches.record_match_lock_transition` | `predictor_internal.record_match_lock_transition` | persist first observed fixture lock transition |
| `matches.validate_match_reference_scope` | `predictor_internal.validate_match_reference_scope` | enforce same-season match references |
| `players.validate_player_team_scope` | `predictor_internal.validate_player_team_scope` | preserve player/team validation |
| `predicted_group_positions.a_prepare_competition_season_scope` | `predictor_internal.prepare_competition_season_scope` | derive and validate entry/group/team scope |
| `predicted_group_positions.enforce_lock_group_positions` | `public.enforce_entry_lock_generic` | preserve monotonic entry lock enforcement |
| `predicted_group_positions.validate_group_position_scope` | `predictor_internal.validate_group_position_scope` | preserve entry/group/team validation |
| `predicted_progression.a_prepare_competition_season_scope` | `predictor_internal.prepare_competition_season_scope` | derive and validate progression season scope |
| `predicted_progression.enforce_lock_progression` | `public.enforce_entry_lock_generic` | preserve monotonic entry lock enforcement |
| `predicted_progression.enforce_version_predicted_progression` | `public.enforce_write_version` | preserve optimistic write-version enforcement |
| `predicted_progression.validate_progression_scope` | `predictor_internal.validate_progression_scope` | preserve entry/team validation |
| `predicted_tie_resolutions.a_prepare_competition_season_scope` | `predictor_internal.prepare_competition_season_scope` | derive and validate tie-resolution season scope |
| `predicted_tie_resolutions.enforce_lock_tie_resolutions` | `public.enforce_entry_lock_generic` | preserve monotonic entry lock enforcement |
| `predicted_tie_resolutions.refresh_group_positions_after_tie_resolution` | `predictor_internal.refresh_group_positions_from_tie` | preserve derived predicted-group refresh |
| `predicted_tie_resolutions.validate_tie_resolution_scope` | `predictor_internal.validate_tie_resolution_scope` | preserve tie-resolution validation |
| `profiles.enforce_display_name` | `public.enforce_display_name_policy` | preserve profile naming policy |
| `score_events.a_prepare_competition_season_scope` | `predictor_internal.prepare_competition_season_scope` | derive and validate entry/match/team score scope |
| `score_events.validate_score_event_scope` | `predictor_internal.validate_score_event_scope` | preserve score-event validation |
| `tournaments.a_prepare_tournament_season` | `predictor_internal.prepare_tournament_season` | derive and validate competition-season metadata |
| `tournaments.recompute_scores_on_golden_boot` | `public.trg_recompute_on_golden_boot` | preserve tournament award scoring authority |
| `tournaments.record_tournament_lock_transition` | `predictor_internal.record_tournament_lock_transition` | persist first observed entry lock transition |
| `tournaments.validate_tournament_award_scope` | `predictor_internal.validate_tournament_award_scope` | preserve tournament-only award validation |

## Change rules

1. Every new, removed, renamed or rebound non-internal trigger on a `public` table
   must update this inventory and its executable comparison in the same PR.
2. A named Stage C authority must remain attached unless its rule moves to a
   reviewed declarative constraint with equivalent hostile-write evidence.
3. Trigger removal is not accepted merely because the function still exists.
4. Preparation triggers remain `ENABLE ALWAYS` so controlled replica-mode imports
   cannot bypass required non-null competition-season scope.
5. ACQ-R03 scoring-performance work remains separately governed.
6. C1 does not alter profile ownership or account-erasure behaviour; those remain
   C2 and blocked by issue #272.
