# Stage C schema coverage manifest

**Status:** Design inventory; no migration exists.  
**Source:** Read-only development schema introspection plus landed PR #245 and PR #246 characterisation tests, 30 July 2026.  
**Baseline:** `main` at `972febd017dbecf0ef3b02b16b55c07c74535038`.  
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

## 2. Identity and timezone contract

The owner decisions are closed and implementation coverage must preserve them:

- `profiles.id` becomes the durable competitive identifier;
- `profiles.auth_user_id` is the nullable link to `auth.users` and resolves authenticated ownership;
- competitive rows reference `profiles(id)` rather than `auth.users(id)`;
- `rate_limit_events` remains auth housekeeping and continues to cascade;
- account deletion erases auth identity and pseudonymises the profile without deleting settled competition history;
- UTC instants decide locks and outcomes;
- `tournaments.display_timezone` decides competition calendar/day/matchweek grouping;
- viewer/device timezone decides displayed kickoff clock time only;
- invalid competition timezone values are rejected and cannot silently blank the competition day.

## 3. Landed before-state characterisations

### 3.1 Timezone authority — PR #245

The landed `tests/domain/competition/timeZoneAuthority.test.ts` currently pins:

- timezone-free `lockState.ts` and `matchState.ts`;
- the complete device-timezone reader set:
  - `src/features/home/useHomeData.ts`;
  - `src/features/matches/MatchCentrePage.tsx`;
  - `src/features/matches/MatchesPage.tsx`;
  - `src/features/shared/useTournamentEntryLocked.ts`;
- domain context receiving, rather than discovering, the timezone;
- device-dependent `completedToday` and `dayState` divergence for identical competition data;
- lock, entry and match state remaining identical across zones;
- an invalid timezone currently resolving quietly to empty day buckets and `no_matches_today`.

Stage C must update this test to the approved after-state. It must not delete it, weaken it or replace the behaviour assertions with source-text-only checks.

### 3.2 Account deletion — PR #246

The landed `tests/database-parity/accountDeletionSemantics.test.ts` resolves effective migration actions last-declaration-wins.

| Effective action | Current references | Stage C disposition |
| --- | --- | --- |
| `CASCADE` | `profiles.id`, `entries.user_id`, `league_members.user_id`, `rank_history.user_id`, `rate_limit_events.user_id`, `bonus_competition_entrants.user_id`, `bonus_knockout_predictions.user_id` | remove direct auth ownership from every competitive reference; retain cascade only for disposable auth identity/housekeeping where deliberately approved |
| `RESTRICT` | `leagues.owner_id` | preserve the documented transfer-first invariant while repointing ownership to `profiles(id)` |
| `SET NULL` | `match_result_revisions.actor_id`, `actual_third_place_resolutions.updated_by`, `actual_third_place_resolution_revisions.actor_id`, `bonus_competition_audit.actor_id` | retain explicit attributable-or-null audit behaviour unless a later immutable pseudonymous actor decision replaces it |
| undeclared PostgreSQL `NO ACTION` | `bonus_cup_fixtures.winner_user_id` | replace with an explicit reviewed profile-owned action; undeclared deletion semantics are prohibited |

Additional pinned facts:

- at least seven competition tables cascade from `entries(id)`;
- no current table references `profiles`;
- `profiles.id` already equals the stored auth UUID, so the repoint is a constraint migration without competitive-row identity remapping;
- every future `auth.users` reference must appear in the test with an explicit action and rationale.

Stage C must update this test to the approved after-state. The effective-action inventory remains exhaustive after migration.

## 4. Public relations

### Shared root and identity

| Current object | Stage C action |
| --- | --- |
| `tournaments` | preserve table/UUID; add competition parent, season key, kind, IANA competition timezone and lifecycle status |
| `profiles` | become durable competitive/profile anchor; add nullable unique `auth_user_id`, pseudonymisation timestamp and deletion-safe ownership contract |
| `rate_limit_events` | remain account/action housekeeping and continue cascading on auth deletion |
| `entry_totals` view | redefine over season-scoped entries/score events; require explicit season boundary |

### Direct season scope

| Current object | Stage C action |
| --- | --- |
| `teams` | retain `tournament_id`; add `(tournament_id, id)` key |
| `groups` | tournament-only season child; add composite season key and parent-kind validator |
| `matches` | shared fixture/result table; retain scope, add round authority, fixture-administration state and composite participant references |
| `entries` | retain scope; repoint ownership from auth user to `profiles(id)`; preserve one Predictor entry per profile/season |
| `leagues` | retain scope; repoint owner to profile id and preserve transfer-first deletion semantics; remain Predictor-only |
| `players` | retain scope; composite same-season team reference |
| `rank_history` | retain scope; repoint auth user to profile id; bind to a season round where applicable |
| `actual_third_place_resolutions` | tournament-only season child; preserve scope, immutability and explicit nullable actor semantics |
| `actual_third_place_resolution_revisions` | tournament-only season child; preserve scope, immutability and explicit nullable actor semantics |
| `match_result_revisions` | preserve scope; composite same-season match reference and explicit nullable actor semantics |
| `entry_automatic_submission_outcomes` | preserve scope; composite same-season entry reference |
| `bonus_competitions` | preserve scope; keep game instance independent per season/game |

### Relationship and prediction scope

| Current object | Stage C action |
| --- | --- |
| `group_teams` | add explicit scope if required for composite group/team references; preserve tournament-only shape |
| `league_members` | repoint auth user to profile id; league supplies season boundary |
| `match_predictions` | add explicit season key; composite entry/match references; preserve current tournament Predictor rules |
| `predicted_group_positions` | add explicit season key; composite entry/group/team references |
| `predicted_progression` | add explicit season key; composite entry/team reference |
| `predicted_tie_resolutions` | add explicit season key; retain internal validation for UUID arrays |
| `bonus_predictions` | add explicit season key; composite entry/player reference |
| `score_events` | add explicit season key; composite entry/match/team references |

### Bonus-game graph

| Current object | Stage C action |
| --- | --- |
| `bonus_competition_entrants` | repoint auth user to profile id; preserve competition/game boundary |
| `bonus_competition_windows` | add composite `(competition_id, id)` key; do not store future season round deadlines here |
| `bonus_window_fixtures` | add season proof; composite window and same-season match references |
| `bonus_knockout_predictions` | repoint auth user to profile id; attach to eligible bonus competition; composite season match/team references |
| `bonus_lms_selections` | composite competition/window/entrant/same-season team references |
| `bonus_score_events` | composite competition/window/same-season match references |
| `bonus_competition_audit` | preserve immutable audit and explicit nullable actor; competition supplies season boundary |
| `bonus_cup_groups` | add composite `(competition_id, id)` key |
| `bonus_cup_members` | composite competition/group/entrant references |
| `bonus_cup_fixtures` | composite competition/group/window/entrant references; replace `winner_user_id` with an explicit profile-owned winner reference and reviewed deletion action |
| `bonus_cup_penalty_numbers` | composite competition/window/entrant references |

## 5. New relations required by the design

| New object | Purpose |
| --- | --- |
| `competitions` | stable recurring competition identity |
| `competition_rounds` | tournament matchdays/rounds and league matchweeks under one authority; scoped by `tournament_id` |
| `competition_lock_events` | append-only evidence that a derived scope transitioned to locked; not a stored deadline |
| `competition_awards` | additive season-scoped award results while current Golden Boot compatibility remains |

No `competitors` table is introduced. The existing `profiles` UUID is reused so the ownership migration does not require a second identity graph or data copy.

## 6. Public functions and RPCs

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

- account deletion/anonymisation routine;
- `delete_league`
- `get_league`
- `get_league_preview`
- `get_public_capacity`
- `join_league`
- `search_league_transfer_candidates`
- `set_operating_limits`
- `transfer_ownership`

The account-deletion path must clear auth/personal data, pseudonymise the profile, transfer or archive owned leagues, preserve settled competitive rows and define the Predictor Cup winner reference atomically.

## 7. Existing triggers and internal validators

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

## 8. RLS and grants

Current browser policies are concentrated on:

- public authenticated reference reads for tournaments, teams, groups, group teams, matches and players;
- own account/entry/prediction reads and writes;
- own rank/score history;
- league membership-bounded reads.

Implementation coverage must include:

- replacing direct auth ownership joins with `profiles.auth_user_id = auth.uid()`;
- ensuring a profile with `auth_user_id is null` cannot authenticate or regain owner-level access merely because historical rows remain;
- adding season predicates where direct browser reads could otherwise mix seasons;
- enabling RLS on every new public table;
- explicit grants for new Data API objects;
- no browser grants for internal lock/audit authorities;
- explicit revocation of `PUBLIC` execute on new security-definer functions;
- continued parity between deployment RPC declarations and database privilege evidence;
- an exhaustive allowlist proving every remaining `auth.users` reference has an explicit reviewed action.

## 9. Timezone and calendar coverage

Implementation and regression coverage must distinguish:

- UTC instant comparison in lock and match-state resolvers;
- `competitionTimeZone` for day/matchweek/calendar grouping;
- `viewerTimeZone` for displayed kickoff times.

Required checks:

- travelling changes the rendered kickoff clock time but not the assigned round/matchweek;
- two viewers in different timezones see the same competition day/matchweek assignment;
- device timezone cannot change lock state, result state, scoring or eligibility;
- each of the four current reader surfaces receives competition timezone for context grouping and viewer timezone only for presentation;
- `tournaments.display_timezone` accepts only a valid IANA zone;
- an invalid or unavailable competition timezone fails closed or returns an explicit unavailable state;
- an invalid timezone cannot silently produce empty day buckets or `no_matches_today`;
- no naked local timestamp string becomes an authoritative input;
- the PR #245 characterisation is updated to the approved after-state and remains a positive guard.

## 10. Existing integrity gaps Stage C must close

The current database often has separate foreign keys plus a trigger. Add declarative composite protection where possible for:

- match ↔ round/group/home team/away team/winner team;
- entry ↔ profile/season/predicted match/group/team/player;
- league owner/member ↔ profile/season;
- rank history ↔ profile/season/round;
- score event ↔ entry/match/team;
- result revision ↔ season/match;
- player ↔ season/team;
- bonus entrant ↔ profile/competition;
- shared knockout prediction ↔ profile/competition/match/team;
- bonus competition window ↔ real fixture;
- LMS selection ↔ competition/window/team;
- bonus score event ↔ competition/window/match;
- Cup group/member/fixture/window links;
- Predictor Cup winner ↔ profile/competition/fixture with an explicit deletion action.

Arrays in predicted and actual tie resolution remain trigger-validated.

## 11. Owner-decision and safeguard coverage — closed

Pre-migration tests must encode the decided contracts:

- `CS-015`: exact scores, then correct results, then joint rank;
- `CS-009`: auth identity erased, profile pseudonymised and historical competition rows preserved;
- `CS-016`: competition timezone controls grouping, viewer timezone controls displayed clock time and UTC instants control rules;
- `CS-017`: invalid competition timezones are rejected and cannot silently become an empty competition day;
- `CS-018`: every `auth.users` reference has an explicit reviewed action, with profile-owned competitive history, set-null audit actors, disposable housekeeping cascades and deliberate blockers only.

A data-protection review remains a dependency before the account-deletion schema is implemented; it is not an open architectural choice.

## 12. Coverage gate

Before Stage C implementation can exit:

1. every object above has an implementation disposition;
2. repository search finds no unreviewed tournament-only assumption in schema, SQL, TypeScript or tests;
3. every retained `tournament_id` / `p_tournament_id` use is recognised as the intentional physical season key, not a single-tournament assumption;
4. every new or changed relationship has hostile cross-season pgTAP coverage;
5. identity-erasure/pseudonymisation and anonymous-profile RLS tests pass;
6. the PR #246 deletion-semantics test enumerates the approved after-state and finds no undeclared `auth.users` action;
7. competition/viewer timezone separation and invalid-timezone tests pass;
8. the PR #245 timezone-authority test proves identical competition grouping across viewer zones while preserving viewer-local display and instant-only locks;
9. Euro preservation and RLS-role oracles pass;
10. the complete `tests/database-parity/` directory runs in the disposable Supabase job;
11. environment, CSP, deployment RPC and privilege-contract guards remain green;
12. no compatibility name is removed or changed without a separate atomic caller plan.