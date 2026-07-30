# Stage C schema coverage manifest

**Status:** Design inventory; no migration exists.  
**Source:** Read-only development schema introspection, project `iouzoutneyjpugbbtdem`, 30 July 2026.  
**Design:** [`stage-c-competition-season-schema.md`](stage-c-competition-season-schema.md)

This manifest is the minimum implementation coverage. A Stage C migration or application change must not omit an object because it is dormant, tournament-only or currently hidden behind an RPC.

## 1. Physical naming rule

Stage C generalises the existing physical database contract in place:

- `tournaments` remains the season-instance table;
- established `tournament_id` and `p_tournament_id` names remain the physical season-scope contract during Stage C;
- architecture and TypeScript may describe those rows as competition seasons;
- no parallel `competition_seasons` table or second scope column is permitted;
- a future cosmetic rename is outside Stage C and requires its own compatibility plan.

Coverage therefore checks **season integrity**, not absence of the word `tournament`.

## 2. Public relations

### Shared root and identity

| Current object | Stage C action |
| --- | --- |
| `tournaments` | preserve table/UUID; add competition parent, season key, kind, IANA timezone and lifecycle status |
| `profiles` | remain private account preferences; remove competitive-history ownership from direct auth identity |
| `rate_limit_events` | remain account/action housekeeping and continue cascading on account deletion |
| `entry_totals` view | redefine over season-scoped entries/score events; require explicit season boundary |

### Direct season scope

| Current object | Stage C action |
| --- | --- |
| `teams` | retain `tournament_id`; add `(tournament_id, id)` key |
| `groups` | tournament-only season child; add composite season key and parent-kind validator |
| `matches` | shared fixture/result table; retain scope, add round authority, fixture-administration state and composite participant references |
| `entries` | retain scope; replace direct `user_id` ownership with `competitor_id`; preserve one Predictor entry per competitor/season |
| `leagues` | retain scope; replace owner auth id with competitor id; remain Predictor-only |
| `players` | retain scope; composite same-season team reference |
| `rank_history` | retain scope; replace user with competitor; bind to a season round where applicable |
| `actual_third_place_resolutions` | tournament-only season child; preserve scope and behaviour |
| `actual_third_place_resolution_revisions` | tournament-only season child; preserve scope and immutability |
| `match_result_revisions` | preserve scope; composite same-season match reference |
| `entry_automatic_submission_outcomes` | preserve scope; composite same-season entry reference |
| `bonus_competitions` | preserve scope; keep game instance independent per season/game |

### Relationship and prediction scope

| Current object | Stage C action |
| --- | --- |
| `group_teams` | add explicit scope if required for composite group/team references; preserve tournament-only shape |
| `league_members` | replace auth user with competitor; league supplies season boundary |
| `match_predictions` | add explicit season key; composite entry/match references; preserve current tournament Predictor rules |
| `predicted_group_positions` | add explicit season key; composite entry/group/team references |
| `predicted_progression` | add explicit season key; composite entry/team reference |
| `predicted_tie_resolutions` | add explicit season key; retain internal validation for UUID arrays |
| `bonus_predictions` | add explicit season key; composite entry/player reference |
| `score_events` | add explicit season key; composite entry/match/team references |

### Bonus-game graph

| Current object | Stage C action |
| --- | --- |
| `bonus_competition_entrants` | replace auth user with competitor; preserve competition/game boundary |
| `bonus_competition_windows` | add composite `(competition_id, id)` key; do not store future season round deadlines here |
| `bonus_window_fixtures` | add season proof; composite window and same-season match references |
| `bonus_knockout_predictions` | attach to eligible bonus competition; composite season match/team references |
| `bonus_lms_selections` | composite competition/window/entrant/same-season team references |
| `bonus_score_events` | composite competition/window/same-season match references |
| `bonus_competition_audit` | preserve immutable audit; competition supplies season boundary |
| `bonus_cup_groups` | add composite `(competition_id, id)` key |
| `bonus_cup_members` | composite competition/group/entrant references |
| `bonus_cup_fixtures` | composite competition/group/window/entrant references |
| `bonus_cup_penalty_numbers` | composite competition/window/entrant references |

## 3. New relations required by the design

| New object | Purpose |
| --- | --- |
| `competitions` | stable recurring competition identity |
| `competitors` | durable anonymisable competitive identity separate from auth account |
| `competition_rounds` | tournament matchdays/rounds and league matchweeks under one authority; scoped by `tournament_id` |
| `competition_lock_events` | append-only evidence that a derived scope transitioned to locked; not a stored deadline |
| `competition_awards` | additive season-scoped award results while current Golden Boot compatibility remains |

## 4. Public functions and RPCs

### Established season-scope signatures

The functions below may retain `p_tournament_id` during Stage C, but their semantics, queries and callers must support both `tournament` and `league_season` rows safely. A retained name is not permission to retain tournament-only assumptions.

- `admin_actual_third_place_tie_revisions(p_tournament_id)`
- `admin_actual_third_place_tie_status(p_tournament_id)`
- `admin_clear_actual_third_place_tie(p_tournament_id, p_reason)`
- `admin_resolve_actual_third_place_tie(p_tournament_id, p_ordered_team_ids, p_reason)`
- `capture_rank_history(p_tournament_id)`
- `clear_my_predictions(p_tournament_id)`
- `create_league(p_tournament_id, p_name)`
- `get_bonus_games(p_tournament_id)`
- `get_h2h_rank_history(p_rival_id, p_tournament_id)`
- `get_ko_predictor_standings(p_tournament_id, p_limit, p_after)`
- `get_leaderboard(p_tournament_id, p_limit, p_after)`
- `get_my_cup(p_tournament_id)`
- `get_my_knockout_predictions(p_tournament_id)`
- `get_my_leagues(p_tournament_id)`
- `get_my_lms(p_tournament_id)`
- `get_player_profile(p_player_id, p_tournament_id)`
- `get_prediction_consensus(p_tournament_id)`
- `get_rival_entry(p_rival_id, p_tournament_id)`
- `recompute_tournament_scores(p_tournament_id)`

Supabase RPC calls use named JSON arguments. Any later rename must update every caller atomically or provide an explicit compatibility wrapper.

### Functions whose bodies carry implicit tournament joins

Review and update in the same migration/application PR:

- `_actual_group_order`
- `_group_h2h_stats`
- `_resolve_group_cluster`
- `delete_match_prediction`
- `enforce_entry_lock_generic`
- `enforce_entry_lock_scores`
- `enforce_joker_rules`
- `get_entry_submission_status`
- `get_league_match_picks`
- `get_league_members`
- `get_match_prediction_distribution`
- `process_due_entry_submissions`
- `replace_predicted_progression`
- `save_knockout_prediction`
- `submit_entry`
- `trg_recompute_on_result`

### Bonus-game functions requiring season proof

- `admin_draw_predictor_cup`
- `admin_finalise_predictor_cup_groups`
- `admin_settle_predictor_cup_round`
- `delete_knockout_prediction`
- `register_bonus_competition`
- `save_lms_selection`
- `submit_cup_penalty_number`
- `withdraw_bonus_competition`

### Global/account functions

These are not automatically season-scoped but must be regression-reviewed:

- `delete_league`
- `get_league`
- `get_league_preview`
- `get_public_capacity`
- `join_league`
- `search_league_transfer_candidates`
- `set_operating_limits`
- `transfer_ownership`

## 5. Existing triggers and internal validators

### Same-reference validators to generalise

- `validate_group_team_scope`
- `validate_match_reference_scope`
- `validate_match_prediction_scope`
- `validate_group_position_scope`
- `validate_progression_scope`
- `validate_score_event_scope`
- `validate_player_team_scope`
- `validate_bonus_scope`
- `validate_result_revision_scope`
- `validate_tie_resolution_scope`
- `validate_tournament_award_scope`
- `assert_bonus_window_fixture_shape`
- `assert_bonus_lms_selection_shape`
- `assert_bonus_knockout_prediction_shape`

Prefer composite foreign keys where the rule is equality of season keys. Retain triggers for parent-kind checks, arrays, conditional shape, time and lifecycle rules.

### Lock/write authorities to preserve

- `validate_bracket_on_submission`
- `enforce_entry_lock_generic`
- `enforce_entry_lock_scores`
- `enforce_joker_rules`
- `enforce_write_version`
- prediction save rate limiting
- bonus window/selection lock checks

Stage C changes scope, not the current Euro lock or concurrency outcome. No round stores a planned `lock_at`; a lock event may only record the irreversible transition used by the shared resolver.

### Result/scoring/progression authorities to preserve

- `enforce_match_result_boundary`
- `enforce_knockout_participant_boundary`
- `enforce_round_of_16_participant_boundary`
- `propagate_knockout_winner`
- `trg_recompute_on_result`
- `trg_recompute_bonus_on_result`
- `trg_recompute_on_golden_boot`
- group-position refresh triggers

### Immutable/audit authorities to preserve

- actual third-place revision mutation block
- automatic-submission outcome mutation block
- bonus competition audit mutation block

## 6. RLS and grants

Current browser policies are concentrated on:

- public authenticated reference reads for tournaments, teams, groups, group teams, matches and players;
- own account/entry/prediction reads and writes;
- own rank/score history;
- league membership-bounded reads.

Implementation coverage must include:

- replacing ownership joins with `competitors.user_id = auth.uid()`;
- adding season predicates where direct browser reads could otherwise mix seasons;
- enabling RLS on every new public table;
- explicit grants for new Data API objects;
- no browser grants for internal lock/audit authorities;
- explicit revocation of `PUBLIC` execute on new security-definer functions;
- continued parity between deployment RPC declarations and database privilege evidence.

## 7. Existing integrity gaps Stage C must close

The current database often has separate foreign keys plus a trigger. Add declarative composite protection where possible for:

- match ↔ round/group/home team/away team/winner team;
- entry ↔ predicted match/group/team/player;
- score event ↔ entry/match/team;
- result revision ↔ season/match;
- player ↔ season/team;
- bonus competition window ↔ real fixture;
- LMS selection ↔ competition/window/team;
- bonus score event ↔ competition/window/match;
- Cup group/member/fixture/window links.

Arrays in predicted and actual tie resolution remain trigger-validated.

## 8. Owner-decision coverage

Before migration tests are committed, review evidence must confirm:

- `CS-015` tie-break: exact scores, then correct results, then joint;
- account deletion: competition rows retained through `competitors`, public label approved, `rate_limit_events` still cascades;
- timezone: one IANA display timezone per season, with UTC `timestamptz` storage and no device-timezone effect on rules.

## 9. Coverage gate

Before Stage C implementation can exit:

1. every object above has an implementation disposition;
2. repository search finds no unreviewed tournament-only assumption in schema, SQL, TypeScript or tests;
3. every retained `tournament_id` / `p_tournament_id` use is recognised as the intentional physical season key, not a single-tournament assumption;
4. every new or changed relationship has hostile cross-season pgTAP coverage;
5. Euro preservation and RLS-role oracles pass;
6. the complete `tests/database-parity/` directory runs in the disposable Supabase job;
7. environment, CSP, deployment RPC and privilege-contract guards remain green;
8. no compatibility name is removed or changed without a separate atomic caller plan.
