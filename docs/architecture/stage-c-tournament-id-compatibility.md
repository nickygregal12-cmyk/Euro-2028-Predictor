# Stage C — `tournament_id` compatibility inventory

**Status:** Repository contract 66 C1b after-state; C2 ownership work remains blocked by issue #272.  
**Baseline:** Contract 65 competition-season foundation plus migration `20260803070000_c1b_game_catalogue_memberships.sql`.  
**Parent design:** [`stage-c-competition-season-schema.md`](stage-c-competition-season-schema.md)  
**Object coverage:** [`stage-c-schema-coverage.md`](stage-c-schema-coverage.md)

## Purpose

Stage C evolves the existing physical `tournaments` / `tournament_id` contract in
place. Architecture calls the row a competition season, but working identifiers
and RPC signatures are not renamed merely to match new vocabulary.

Contract 66 stores direct season scope wherever a relationship previously had
to infer it through another parent, including the C1b game-membership lifecycle.
Every column below is reviewed, `uuid NOT NULL`, backfilled where applicable and
guarded by composite foreign keys or a preparation/shape validator. The exit
condition remains zero unreviewed tournament-only assumptions, not zero retained
compatibility names.

The list is supported by:

- the effective committed migration history;
- disposable zero-to-current rebuild and catalogue checks;
- `tests/database-parity/stageCTournamentIdCompatibility.test.ts`.

No hosted database write is claimed by this inventory.

## Current direct columns

Every current column below is `uuid NOT NULL`.

| Current column | Stage C disposition |
| --- | --- |
| `actual_third_place_resolution_revisions.tournament_id` | retain direct season scope; object remains tournament-only |
| `actual_third_place_resolutions.tournament_id` | retain direct season scope; object remains tournament-only |
| `bonus_competition_audit.tournament_id` | explicit season scope for immutable game audit evidence |
| `bonus_competition_entrants.tournament_id` | explicit season/game entrant scope; auth ownership remains C2 |
| `bonus_competition_windows.tournament_id` | explicit season/game window scope |
| `bonus_competitions.tournament_id` | retain as the season scope of each independent game availability |
| `bonus_cup_fixtures.tournament_id` | explicit season/game/group/window fixture scope |
| `bonus_cup_groups.tournament_id` | explicit season/game group scope |
| `bonus_cup_members.tournament_id` | explicit season/game/group entrant scope; auth ownership remains C2 |
| `bonus_cup_penalty_numbers.tournament_id` | explicit season/game/window entrant scope; auth ownership remains C2 |
| `bonus_knockout_predictions.tournament_id` | explicit season/game/match/team scope; auth ownership remains C2 |
| `bonus_lms_selections.tournament_id` | explicit season/game/window/team scope; auth ownership remains C2 |
| `bonus_predictions.tournament_id` | explicit entry/player season proof |
| `bonus_score_events.tournament_id` | explicit season/game/window/match score scope |
| `bonus_window_fixtures.tournament_id` | explicit same-season window/match proof |
| `competition_awards.tournament_id` | additive season-scoped award result authority |
| `competition_lock_events.tournament_id` | append-only observed season lock evidence |
| `competition_rounds.tournament_id` | round or matchweek parent season |
| `entries.tournament_id` | retain as the Predictor entry season scope |
| `entry_automatic_submission_outcomes.tournament_id` | retain and prove composite equality with the entry season |
| `game_membership_events.tournament_id` | immutable membership-event season proof, composite-bound to its membership |
| `game_memberships.tournament_id` | canonical user/game membership season scope, composite-bound to game availability |
| `group_teams.tournament_id` | explicit same-season group/team proof |
| `groups.tournament_id` | retain; groups remain valid only for tournament seasons |
| `leagues.tournament_id` | retain as the league's competition-season scope |
| `match_predictions.tournament_id` | explicit same-season entry/match proof |
| `match_result_revisions.tournament_id` | retain and prove composite equality with the revised fixture |
| `matches.tournament_id` | retain as the shared fixture/result season scope |
| `players.tournament_id` | retain until provider/global identity work in Stage D |
| `predicted_group_positions.tournament_id` | explicit entry/group/team season proof |
| `predicted_progression.tournament_id` | explicit entry/team season proof |
| `predicted_tie_resolutions.tournament_id` | explicit entry season scope; UUID-array validation remains separate |
| `rank_history.tournament_id` | retain and bind history to the relevant season authority |
| `season_matchweek_jokers.tournament_id` | contract 69; the Joker's season scope, so a Joker cannot be played on another season's matchweek |
| `season_predictions.tournament_id` | contract 69; the prediction's season scope, keying it to both the entry and the fixture of the same season |
| `season_fixtures.tournament_id` | contract 68; the league-season fixture carries the same season scope as every other competition-season object, and its composite keys make a cross-season club or matchweek impossible |
| `season_matchweek_cards.tournament_id` | contract 81; the card's season scope, so its composite keys cannot pair an entry from one season with a matchweek from another |
| `season_matchweek_submission_outcomes.tournament_id` | contract 81; the same scope on the append-only record of what the lock did, so an outcome cannot be attributed across seasons |
| `season_matchweek_scores.tournament_id` | contract 90; the settled total's season scope, so its composite keys cannot pair one season's entry with another season's matchweek — a failure that would leave every total arithmetically right and attached to the wrong competition |
| `season_wrapped.tournament_id` | contract 156; the archive's season scope, so a permanent record cannot be read against the wrong competition |
| `competition_follows.tournament_id` | contract 157; which competition is followed, keyed on canonical identity so a twenty-competition platform needs no schema change per league |
| `pinned_rivals.tournament_id` | contract 157; a pin is scoped to one season, because a rivalry in one competition is not a rivalry in another |
| `season_table_rules.tournament_id` | contract 160; the table's rules are keyed on the SEASON rather than the competition, so a historic table keeps the points values and tie-break order it was actually played under |
| `season_table_adjustments.tournament_id` | contract 160; a points deduction belongs to one season, and the composite key to `teams(tournament_id, id)` is what stops a Premier League deduction naming a Scottish Premiership club |
| `season_fixture_awards.tournament_id` | contract 160; an awarded outcome carries its season so a trigger can refuse one that names a fixture from another |
| `player_action_items.tournament_id` | contract 162; every action type belongs to a season, including a league invitation, and an action with no season could not be routed anywhere on a multi-competition platform |
| `provider_entity_map.tournament_id` | contract 112; the season a provider identifier is being mapped WITHIN, and the reason the map has real referential integrity. A provider's team identifier is global and ours is not — the same club is a different `teams` row in every season — so it is the leading column of composite keys to `competition_rounds` and `teams`, and the database itself refuses a club from a different season. Present for every mapping kind, because a mapping without a season is not a fact |
| `provider_poll_targets.tournament_id` | contract 115; the competition season a provider endpoint is polled on behalf of. Not decoration: it is the reason deleting a season stops the job calling a provider about a competition this platform no longer runs, and the reason two seasons of the same league are two targets rather than one shared poll whose results nobody can attribute |
| `score_events.tournament_id` | explicit entry/match/team season proof |
| `teams.tournament_id` | retain; teams remain season participants in Stage C |

## Change rules

1. A new direct `tournament_id` column must be added here with its reason and
   relationship proof in the same PR.
2. Removing or renaming one of these columns requires an atomic caller/RPC/type
   compatibility plan; absence alone is not an improvement.
3. All retained columns remain season identifiers for both bounded tournaments and
   league seasons unless their row is explicitly tournament-only.
4. Simple parent/child equality uses composite foreign keys where practical;
   triggers remain for arrays, conditional shape, parent kind, time and lifecycle.
5. C1b does not change any `profiles.auth_user_id`, profile ownership policy or
   account-erasure behaviour. Those remain C2 and blocked by issue #272.
