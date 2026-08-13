# Stage C — trigger binding inventory

**Status:** Repository contract 105 after-state; C2 ownership work remains blocked by issue #272.
**Baseline:** Contract 65 competition-season foundation, contract 66 C1b game catalogue and the effective trigger set through contract 105.
**Parent design:** [`stage-c-competition-season-schema.md`](stage-c-competition-season-schema.md)
**Object coverage:** [`stage-c-schema-coverage.md`](stage-c-schema-coverage.md)

## Purpose

Stage C changes season scope across a heavily defended schema. Defining a validator
function is not sufficient: its trigger must remain attached to the intended table.
This inventory pins every effective non-internal trigger on a `public` table to its
function at the current repository contract.

The C1 foundation adds preparation, lock-evidence, competition-identity and award
bindings. C1b adds game-availability preparation, canonical membership linkage and
append-only membership-event bindings while preserving the established lock,
result, scoring, audit, rate-limit and ownership authorities. Contract 102 adds two
Cup split-persistence authorities: one validates split-group parentage and the other
keeps a group-shaped fixture aligned with the phase named by its stage. Contract 105
adds the member-side ancestry binding: every split member comes from the child group's one initial parent, and source membership remains fixed. The executable
comparison is `tests/database-parity/stageCTriggerBindingCoverage.test.ts`.

No hosted database write or C2 ownership change is claimed by this inventory.

## Current effective bindings

| Table and trigger | Effective function | Stage C disposition |
| --- | --- | --- |
| `actual_third_place_resolution_revisions.block_actual_tie_revision_mutation` | `predictor_internal.block_actual_tie_revision_mutation` | preserve revision immutability |
| `actual_third_place_resolutions.validate_actual_third_place_resolution` | `predictor_internal.validate_actual_third_place_resolution` | preserve tournament-only resolution validation |
| `bonus_competition_audit.a_prepare_competition_season_scope` | `predictor_internal.prepare_competition_season_scope` | derive and validate stored season scope |
| `bonus_competition_audit.block_bonus_audit_mutation` | `predictor_internal.block_bonus_audit_mutation` | preserve audit immutability |
| `bonus_competition_entrants.a_prepare_competition_season_scope` | `predictor_internal.prepare_competition_season_scope` | derive and validate stored season/game scope |
| `bonus_competition_entrants.aa_prepare_bonus_entrant_membership` | `predictor_internal.prepare_bonus_entrant_membership` | attach ordinary Bonus Games entrants to canonical membership |
| `bonus_competition_windows.a_prepare_competition_season_scope` | `predictor_internal.prepare_competition_season_scope` | derive and validate stored season/game scope |
| `bonus_competition_windows.assert_successor_window_after_predecessor` | `predictor_internal.assert_successor_window_after_predecessor` | refuse a restarted competition a round that opened or locked before its predecessor finished (contract 108); first instances are exempt, so the Euro catalogue is untouched |
| `provider_entity_map.touch_provider_entity_map` | `predictor_internal.touch_provider_entity_map` | stamp `updated_at` when a provider identifier is repointed (contract 112); a remap is a fact somebody may later have to account for, and the row is the only place that date can live |
| `provider_poll_targets.touch_provider_poll_target` | `predictor_internal.touch_provider_poll_target` | stamp `updated_at` when a poll target changes (contract 115); cadence and enablement are operational settings, and the only way to tell later whether a quiet target was disabled deliberately or drifted is the date somebody last touched it |
| `competition_rounds.assert_round_window_disjoint` | `predictor_internal.assert_round_window_disjoint` | refuse two rounds of one competition season claiming the same instant (contract 113). Bounds are inclusive at both ends, matching the domain module's containment test, so windows that merely touch overlap and are refused — an instant on a shared boundary would fall in both, which is exactly the ambiguity being excluded |
| `bonus_competitions.a_prepare_game_availability_status` | `predictor_internal.prepare_game_availability_status` | keep legacy publication and canonical availability state coherent |
| `bonus_competitions.prepare_competition_lineage` | `predictor_internal.prepare_competition_lineage` | default a bare insert to instance 1 of its own new series (contract 103); a chain is only ever continued by explicit lineage |
| `bonus_competitions.assert_game_availability_shape` | `predictor_internal.assert_game_availability_shape` | enforce game availability against competition-season kind |
| `bonus_cup_fixtures.a_prepare_competition_season_scope` | `predictor_internal.prepare_competition_season_scope` | derive and validate Cup fixture scope |
| `bonus_cup_fixtures.assert_bonus_cup_fixture_group_phase` | `predictor_internal.assert_bonus_cup_fixture_group_phase` | contract 102; require group and split fixtures to reference a same-competition group from the phase their stage declares |
| `bonus_cup_groups.a_prepare_competition_season_scope` | `predictor_internal.prepare_competition_season_scope` | derive and validate Cup group scope |
| `bonus_cup_groups.assert_bonus_cup_group_parent` | `predictor_internal.assert_bonus_cup_group_parent` | contract 102; require every split group to point directly to a same-competition initial group and protect existing children from parent relabelling |
| `bonus_cup_members.a_prepare_competition_season_scope` | `predictor_internal.prepare_competition_season_scope` | derive and validate Cup member scope |
| `bonus_cup_members.assert_bonus_cup_member_split_parent` | `predictor_internal.assert_bonus_cup_member_split_parent` | contract 105; require a split member to come from the child group's single initial parent and keep that source membership permanent while the split row exists |
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
| `entries.aa_prepare_entry_game_membership` | `predictor_internal.prepare_entry_game_membership` | attach ordinary Main/Original entries to canonical membership |
| `entries.validate_bracket_on_submission` | `predictor_internal.validate_bracket_on_submission` | preserve authoritative submission validation |
| `entry_automatic_submission_outcomes.block_automatic_submission_outcome_mutation` | `predictor_internal.block_automatic_submission_outcome_mutation` | preserve outcome immutability |
| `game_membership_events.block_game_membership_event_mutation` | `predictor_internal.block_game_membership_event_mutation` | keep membership history append-only while allowing parent cascades |
| `game_memberships.record_game_membership_event` | `predictor_internal.record_game_membership_event` | record joined, left, rejoined and disqualified transitions |
| `group_teams.a_prepare_competition_season_scope` | `predictor_internal.prepare_competition_season_scope` | derive and validate group/team season scope |
| `group_teams.validate_group_team_scope` | `predictor_internal.validate_group_team_scope` | preserve group/team validation |
| `league_members.rate_limit_league_membership` | `public.trg_rate_limit_league_membership` | preserve membership rate limiting |
| `league_members.enforce_league_member_limit` | `predictor_internal.enforce_league_member_limit` | contract 181 / `CAP-003`: refuse the 101st member of one ordinary private league, serialised per league before counting |
| `bonus_cup_launches.bonus_cup_launches_immutable` | `predictor_internal.block_cup_launch_update` | contract 186 / `CUP-002` prerequisite: refuse any UPDATE of a Championship launch record. DELETE is deliberately not blocked, so the competition's own deletion still cascades; what must not move is the group-stage span, because fixtures are played and predicted inside it |
| `leagues.trg_register_league_invite_code` | `predictor_internal.register_league_invite_code` | register a league's code in the shared namespace so a private competition cannot reissue it |
| `bonus_competitions.trg_register_competition_invite_code` | `predictor_internal.register_competition_invite_code` | register a private competition's code in the same namespace, and release it when the code is cleared or the row is deleted |
| `season_wrapped.trg_season_wrapped_immutable` | `predictor_internal.refuse_wrapped_rewrite` | keep a finalised season archive immutable, so a later formula cannot restate a past a player was already shown |
| `season_fixture_awards.season_fixture_awards_season_scope` | `predictor_internal.assert_fixture_award_season` | contract 160; refuse an awarded outcome that names a fixture from another season. A composite foreign key cannot express it, because `season_fixtures` has no `(tournament_id, id)` unique key and adding one to a hot table is a change this contract has no reason to make |
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
| `season_matchweek_jokers.assert_season_joker_allowance` | `predictor_internal.assert_season_joker_allowance` | contract 69; ten Jokers per season and five per half, with no carry-over between halves |
| `season_matchweek_jokers.enforce_season_matchweek_lock` | `predictor_internal.enforce_season_matchweek_lock` | contract 69; a Joker cannot be played on a locked matchweek |
| `season_predictions.enforce_season_matchweek_lock` | `predictor_internal.enforce_season_matchweek_lock` | contract 69; a scoreline cannot be written after its matchweek locks, and unconfirmed kickoffs lock rather than open |
| `season_predictions.enforce_season_matchweek_lock_on_delete` | `predictor_internal.enforce_season_matchweek_lock` | contract 113; clearing a banked prediction after lock would retroactively blank a frozen fixture, so the delete path refuses too |
| `season_predictions.enforce_version_season_predictions` | `public.enforce_write_version` | contract 113; the shared optimistic write-version check, so a season save that lost a race refuses as PT409 rather than silently overwriting |
| `season_matchweek_jokers.enforce_season_matchweek_lock_on_delete` | `predictor_internal.enforce_season_matchweek_lock` | contract 113; un-playing a Joker after lock would halve a frozen matchweek, so taking one back refuses too |
| `season_lms_entrant_state.assert_lms_entrant_allowance` | `predictor_internal.assert_lms_entrant_allowance` | contract 72; an entrant never holds more lives or saves than their competition's setup granted |
| `season_lms_setups.assert_lms_setup_game` | `predictor_internal.assert_lms_setup_game` | contract 72; a Last Man Standing setup belongs to a last_man_standing competition |
| `season_fixtures.assert_season_fixture_shape` | `predictor_internal.assert_season_fixture_shape` | contract 68; enforce league-season kind, league-matchweek round, and one appearance per club per matchweek — none expressible as a column CHECK |
| `season_matchweek_scores.assert_season_matchweek_score_shape` | `predictor_internal.assert_season_matchweek_score_shape` | contract 90; enforce league-season kind and league-matchweek round on a settled total. The composite foreign keys cannot say it — a tournament knockout round satisfies them perfectly |
| `season_fixtures.assert_season_fixture_replay_acyclic` | `predictor_internal.assert_season_fixture_replay_acyclic` | contract 92; refuse a cycle in the replay chain, and bound the walk. No CHECK can see a cycle: `A abandoned → B` with `B abandoned → A` satisfies every column constraint, then both fixtures leave the matches-played denominator while neither slot is ever filled — and the matchweek still settles, so nothing looks stuck |
| `season_matchweek_submission_outcomes.block_season_matchweek_outcome_mutation` | `predictor_internal.block_season_matchweek_outcome_mutation` | contract 81; keep the record of what the lock did append-only, as `entry_automatic_submission_outcomes` already is. An editable outcome lets a refusal become a submission with no trace, and the recurring scheduler reads the rewrite as truth |
| `tournaments.ensure_original_predictor_availability` | `predictor_internal.ensure_original_predictor_availability` | ensure every tournament season has its hidden Original availability |
| `tournaments.recompute_scores_on_golden_boot` | `public.trg_recompute_on_golden_boot` | preserve tournament award scoring authority |
| `tournaments.record_tournament_lock_transition` | `predictor_internal.record_tournament_lock_transition` | persist first observed entry lock transition |
| `tournaments.validate_tournament_award_scope` | `predictor_internal.validate_tournament_award_scope` | preserve tournament-only award validation |

## Change rules

1. Every new, removed, renamed or rebound non-internal trigger on a `public` table
   must update this inventory and its executable comparison in the same PR.
2. A named Stage C authority must remain attached unless its rule moves to a
   reviewed declarative constraint with equivalent hostile-write evidence.
3. Trigger removal is not accepted merely because the function still exists.
4. Preparation triggers remain `ENABLE ALWAYS` where the migration marks them so
   controlled replica-mode imports cannot bypass required non-null season scope.
5. ACQ-R03 scoring-performance work remains separately governed.
6. C1b does not alter profile ownership or account-erasure behaviour; those remain
   C2 and blocked by issue #272.