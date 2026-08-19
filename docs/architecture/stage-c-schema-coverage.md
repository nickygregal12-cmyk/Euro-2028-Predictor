# Stage C schema coverage manifest

**Status:** Approved design inventory; no migration exists.  
**Source:** Read-only development schema introspection plus landed PR #245, #246, #250, #252, #255, #258, #261, #264, #265 and #266 evidence, 30 July 2026.  
**Baseline:** `main` at `1c1aa639009c09357e9ec4c8f5b9f6922e0f8ad2`.  
**Design:** [`stage-c-competition-season-schema.md`](stage-c-competition-season-schema.md)

This is the minimum implementation coverage. No Stage C change may omit an object because it is dormant, tournament-only, a view, or hidden behind an RPC.

## 1. Physical naming rule

- `tournaments` remains the physical season-instance table;
- `tournament_id` and `p_tournament_id` remain the Stage C season-scope names;
- architecture and TypeScript may call the row a competition season;
- no parallel `competition_seasons` table or second scope column is permitted;
- a cosmetic rename is outside Stage C and requires its own compatibility plan.

Coverage checks season integrity, not absence of the word `tournament`.

## 2. Decided identity and timezone contract

- `profiles.id` becomes the durable competitive identifier;
- `profiles.auth_user_id` is the nullable auth link;
- competitive rows reference `profiles(id)`, not `auth.users(id)`;
- `rate_limit_events` remains disposable auth housekeeping;
- deletion erases auth identity and pseudonymises the profile without deleting settled history;
- UTC instants decide locks/outcomes;
- `tournaments.display_timezone` decides competition day/matchweek grouping;
- viewer timezone decides displayed kickoff clock only;
- invalid competition timezone cannot silently blank a competition day.

## 3. Landed control evidence

### 3.1 Timezone authority and seam — PR #245, #252 and #255

Landed coverage pins:

- timezone-free `lockState.ts` and `matchState.ts`;
- explicit `competitionTimeZone` and `viewerTimeZone` inputs;
- viewer fallback while the Stage C season value is absent;
- current viewer-dependent day grouping under fallback;
- supplied competition timezone overriding viewer location;
- real `lockScopes` equality across zones;
- current invalid-zone fail-quiet behaviour;
- TypeScript rejection of removed `activeLock` and wrong config-field fixtures.

Stage C must change the fallback, divergence and invalid-zone expectations to the approved after-state without removing or weakening the tests.

### 3.2 Account deletion — PR #246

| Effective action | Current references | Stage C disposition |
| --- | --- | --- |
| `CASCADE` | `profiles.id`, `entries.user_id`, `league_members.user_id`, `rank_history.user_id`, `rate_limit_events.user_id`, `bonus_competition_entrants.user_id`, `bonus_knockout_predictions.user_id` | remove direct auth ownership from competitive references; retain cascade only for deliberately disposable auth data |
| `RESTRICT` | `leagues.owner_id` | preserve transfer-first ownership while repointing to `profiles(id)` |
| `SET NULL` | `match_result_revisions.actor_id`, `actual_third_place_resolutions.updated_by`, `actual_third_place_resolution_revisions.actor_id`, `bonus_competition_audit.actor_id` | preserve explicit attributable-or-null audit behaviour unless separately changed |
| implicit `NO ACTION` | `bonus_cup_fixtures.winner_user_id` | replace with an explicit reviewed profile-owned action |

Additional pinned facts:

- at least seven competitive tables cascade from `entries(id)`;
- no current table references `profiles`;
- profile ids already equal stored auth UUIDs;
- every future auth FK must appear in the effective-action test with rationale.

### 3.3 RLS and function security — PR #250

- all 34 current `public` tables have RLS;
- all 110 current security-definer functions pin `search_path`;
- effective definitions are parsed comment-safe, schema-aware and last-definition-wins.

Stage C must keep this ordinary-CI guard green alongside database lint.

### 3.4 Views and direct Data API surface — PR #265

- the set of public views is explicitly pinned;
- each public view must be revoked from `anon` and `authenticated` unless deliberately exposed;
- the `entry_totals` revoke and rationale are load-bearing;
- direct browser relation grants are explicitly allowlisted;
- `anon` has no direct relation grant;
- a new direct grant or view fails ordinary CI until reviewed.

Stage C must update the allowlist atomically with any deliberate new table/view exposure. RLS on tables does not protect a view.

### 3.5 Compiler coverage — PR #255, #258, #261 and #264

The referenced compiler graph covers:

- application code;
- `tests/`;
- Playwright/e2e fixtures;
- `production-smoke/anonymous.spec.ts`;
- TypeScript scripts;
- Playwright configs;
- the three JavaScript deploy gates.

The graph also:

- states strictness explicitly;
- fails when a committed `.ts`/`.tsx` file falls outside a referenced project;
- proves derived projects extend a strict base;
- keeps unconverted JavaScript scripts in a measured deferred allowlist;
- fails if a new JavaScript gate appears without coverage.

Every Stage C source/test/config file must stay inside this graph.

### 3.6 ACQ-R02 scale evidence — PR #266

- `get_overall_leaderboard` aggregates the full submitted field before pagination;
- cost scales primarily with `score_events` volume;
- disposable-local synthetic mean page time was about 35 ms at 250 entries/15,000 events and about 652 ms at 5,000 entries/300,000 events;
- hosted concurrency remains untested;
- ACQ-R02 remains open;
- Stage C does not add a materialised standings table.

## 4. Public relations

### Shared root and identity

| Current object | Stage C action |
| --- | --- |
| `tournaments` | preserve table/UUID; add competition parent, season key, kind, IANA timezone and lifecycle |
| `profiles` | durable competitive/profile anchor; add nullable unique auth link and pseudonymisation timestamp |
| `rate_limit_events` | remain auth housekeeping and cascade on auth deletion |
| `invite_code_registry` | own the invite-code namespace shared by leagues and private competitions; browser-revoked so codes cannot be enumerated, read only through the contract 155 resolver |
| `entry_totals` view | preserve browser revokes and rationale; redefine over explicit season-scoped entries/events if required by schema change |

### Direct season scope

| Current object | Stage C action |
| --- | --- |
| `teams` | retain scope; add `(tournament_id, id)` key |
| `groups` | tournament-only child; composite scope and parent-kind validation |
| `matches` | shared fixture/result table; add round authority, admin state and composite participant references |
| `entries` | repoint owner to profile; one Predictor entry per profile/season |
| `leagues` | repoint owner to profile; preserve transfer-first rule; Predictor-only |
| `players` | composite same-season team reference |
| `rank_history` | repoint user to profile; bind to season/round where applicable |
| `actual_third_place_resolutions` | preserve tournament scope, immutability and nullable actor |
| `actual_third_place_resolution_revisions` | preserve tournament scope, immutability and nullable actor |
| `match_result_revisions` | composite season/match scope and nullable actor |
| `entry_automatic_submission_outcomes` | composite season/entry scope |
| `bonus_competitions` | preserve independent season/game instance |

### Relationship and prediction scope

| Current object | Stage C action |
| --- | --- |
| `group_teams` | explicit composite group/team season proof where required |
| `league_members` | repoint auth user to profile; league supplies season |
| `match_predictions` | explicit season key; composite entry/match scope |
| `predicted_group_positions` | composite entry/group/team season scope |
| `predicted_progression` | composite entry/team season scope |
| `predicted_tie_resolutions` | explicit season key; retain UUID-array validation |
| `bonus_predictions` | composite entry/player season scope |
| `score_events` | composite entry/match/team season scope |

### Bonus-game graph

| Current object | Stage C action |
| --- | --- |
| `bonus_competition_entrants` | repoint auth user to profile; preserve game boundary |
| `bonus_competition_windows` | composite competition key; no stored future round deadline |
| `bonus_window_fixtures` | same-season window/match proof |
| `bonus_knockout_predictions` | repoint user to profile; composite competition/match/team scope |
| `bonus_lms_selections` | composite competition/window/entrant/team scope |
| `bonus_score_events` | composite competition/window/match scope |
| `bonus_competition_audit` | immutable audit with nullable actor |
| `bonus_cup_groups` | composite competition/group key |
| `bonus_cup_members` | composite competition/group/entrant scope |
| `bonus_cup_fixtures` | composite competition/group/window/entrant scope; explicit profile-owned winner action |
| `bonus_cup_penalty_numbers` | composite competition/window/entrant scope |

## 5. New relations

| New object | Purpose |
| --- | --- |
| `competitions` | recurring competition identity |
| `competition_rounds` | tournament rounds and league matchweeks under one authority |
| `competition_lock_events` | append-only observed lock transition, never planned deadline |
| `competition_awards` | additive season-scoped award results |

No `competitors` table is introduced: existing profile UUIDs are reused.

## 6. Public functions and RPCs

### Retained `p_tournament_id` signatures

These names may remain but their semantics must support both kinds safely:

- `admin_actual_third_place_tie_revisions`
- `admin_actual_third_place_tie_status`
- `admin_approve_initial_provider_fixtures`
- `admin_clear_actual_third_place_tie`
- `admin_provider_change_proposals`
- `admin_provider_proposal_detail`
- `admin_record_table_adjustment`
- `admin_set_competition_table_rules`
- `get_competition_table`
- `get_season_lms_field`
- `admin_reject_initial_provider_fixtures`
- `get_provider_review_queues`
- `get_season_fixtures`
- `get_game_leave_eligibility`
- `get_season_club_form`
- `get_season_club_head_to_head`
- `get_season_clubs`
- `get_season_leaderboard_neighbourhood`
- `admin_resolve_actual_third_place_tie`
- `capture_rank_history`
- `clear_my_predictions`
- `create_league`
- `get_bonus_games`
- `get_competition_games`
- `get_h2h_rank_history`
- `get_ko_predictor_standings`
- `get_leaderboard`
- `get_my_cup`
- `get_my_knockout_predictions`
- `get_my_leagues`
- `get_my_lms`
- `get_my_season_cup_instances`
- `get_player_profile`
- `get_prediction_consensus`
- `get_rival_entry`
- `get_season_head_to_head`
- `get_season_leaderboard`
- `get_season_lms_round`
- `get_season_matchweek_card`
- `get_season_period_standings`
- `get_season_player_profile`
- `get_season_player_profile_by_ref`
- `resolve_season_player`
- `get_season_rank_history`
- `get_season_rivalry`
- `create_private_season_lms`
- `create_private_season_cup`
- `get_season_wrapped`
- `set_competition_follow`
- `set_pinned_rival`
- `get_season_prediction_consensus`
- `save_season_prediction`
- `set_season_matchweek_joker`
- `confirm_season_matchweek_card`
- `recompute_tournament_scores`
- `get_season_matchweek_projection`
- `get_season_prediction_dna`
- `save_season_predictions_batch`
- `run_shadow_scoring_verification`
- `admin_shadow_scoring_report`

Named JSON arguments make any later parameter rename atomic or wrapper-backed.

### Bodies with implicit tournament joins

Review in the same implementation PR:

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

### Season-scoped reads identified without a tournament argument

These carry no `p_tournament_id` to widen, so the compatibility question above
does not apply to them. They resolve a season from the two slugs in a route and
their C1 review is a different one: that the resolution predicate identifies
exactly one season. `(competitions.slug, tournaments.season_key)` is a real
composite key — `slug` is unique and `(competition_id, season_key)` is unique —
but two seasons may share a `season_key`, so a predicate that dropped the
competition would still return a season and would return the wrong one.

- `get_season_play_context`

### Bonus-game functions requiring season proof

- `admin_draw_predictor_cup`
- `admin_finalise_predictor_cup_groups`
- `admin_settle_predictor_cup_round`
- `delete_knockout_prediction`
- `register_bonus_competition`
- `save_lms_selection`
- `submit_cup_penalty_number`
- `withdraw_bonus_competition`

### Global/account regression review

- account deletion/anonymisation routine
- `delete_league`
- `get_league`
- `get_league_preview`
- `get_public_capacity`
- `join_league`
- `search_league_transfer_candidates`
- `set_operating_limits`
- `transfer_ownership`

The deletion path must erase personal/auth data, pseudonymise the profile, transfer/archive owned leagues, preserve settled history and define Cup winner ownership atomically.

## 7. Existing validators and authorities

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
- `assert_bonus_cup_group_parent`
- `assert_bonus_cup_fixture_group_phase`
- `assert_bonus_cup_member_split_parent`

Prefer composite FKs for simple season equality; retain triggers for arrays, conditional shape, parent kind, time and lifecycle.

### Lock/write authorities to preserve

- `validate_bracket_on_submission`
- `enforce_entry_lock_generic`
- `enforce_entry_lock_scores`
- `enforce_joker_rules`
- `enforce_write_version`
- prediction rate limiting
- bonus window/selection locks

### Result/scoring/progression authorities

- `enforce_match_result_boundary`
- `enforce_knockout_participant_boundary`
- `enforce_round_of_16_participant_boundary`
- `propagate_knockout_winner`
- `trg_recompute_on_result`
- `trg_recompute_bonus_on_result`
- `trg_recompute_on_golden_boot`
- group-position refresh triggers

### Immutable/audit authorities

- actual third-place revision mutation block
- automatic-submission outcome mutation block
- bonus competition audit mutation block

## 8. RLS, views, grants and definer coverage

Implementation must:

- resolve ownership through `profiles.auth_user_id = auth.uid()`;
- prove null-auth profiles cannot regain owner access;
- add season predicates to direct reads;
- enable RLS on every new public table;
- explicitly review every public view;
- preserve `entry_totals` browser revokes unless a separately reviewed bounded replacement exists;
- keep direct browser relation grants in the PR #265 allowlist;
- use explicit grants and no blanket browser access;
- keep internal lock/audit authorities unexposed;
- revoke `PUBLIC` execute before exact function grants;
- pin `search_path` on every security-definer function;
- keep deployment-RPC/privilege parity;
- keep every remaining auth FK in the deletion-action allowlist;
- keep PR #250 and PR #265 green against effective definitions.

## 9. Timezone and calendar coverage

Required checks:

- travelling changes displayed clock but not round/matchweek;
- viewers in different zones share competition grouping;
- device timezone cannot change lock/result/scoring/eligibility;
- all PR #252 adapters receive persisted competition timezone;
- `display_timezone` accepts only a valid IANA zone;
- invalid/unavailable zone fails closed or explicitly unavailable;
- invalid zone cannot produce silent empty buckets;
- no local timestamp string becomes authoritative;
- PR #245/#255 real `lockScopes` positive control remains;
- viewer fallback is removed from authoritative grouping after backfill.

## 10. Integrity gaps to close

Add declarative composite protection where possible for:

- match ↔ round/group/home/away/winner teams;
- entry ↔ profile/season/predicted references;
- league owner/member ↔ profile/season;
- rank history ↔ profile/season/round;
- score event ↔ entry/match/team;
- result revision ↔ season/match;
- player ↔ season/team;
- bonus entrant/prediction ↔ profile/competition;
- bonus window ↔ real fixture;
- LMS selection ↔ competition/window/team;
- bonus score event ↔ competition/window/match;
- Cup group/member/fixture/window links;
- Cup winner ↔ profile/competition/fixture with explicit deletion action.

Tie-resolution arrays remain trigger-validated.

## 11. Decided safeguards

Pre-migration tests encode:

- `CS-009`: erase auth identity, preserve pseudonymised history;
- `CS-011`: tables, views, direct grants and definer security remain explicit;
- `CS-015`: exact scores → correct results → joint rank;
- `CS-016`: competition grouping, viewer clock, UTC rules;
- `CS-017`: invalid zone cannot silently become empty day;
- `CS-018`: every auth FK has explicit reviewed action;
- `CS-019`: every committed TS/TSX file and every deploy-gate JavaScript file remains in an enforced compiler project.

Data-protection review remains required before deletion implementation.

## 12. Compiler coverage

For every Stage C source, test or config file:

- place `.ts`/`.tsx` files in the existing referenced project graph;
- preserve explicit strictness, aliases, JSX and environment types;
- fail CI on stale renamed/removed domain fields;
- keep runtime tests separate;
- keep PR #261's Git-aware project-coverage guard green;
- keep PR #264's `allowJs`/`checkJs` deploy-gate project and deferred JavaScript inventory green;
- do not add an unaccounted JavaScript production gate.

## 13. Exit gate

Before Stage C implementation exits:

1. every object above has a disposition;
2. no unreviewed tournament-only assumption remains;
3. every retained physical name is intentional compatibility;
4. every changed relationship has hostile cross-season pgTAP;
5. identity-erasure and anonymous-profile RLS tests pass;
6. deletion-semantics test has no undeclared auth action;
7. timezone separation and invalid-zone tests pass;
8. viewers share grouping while preserving local display and instant-only locks;
9. PR #252 seam is wired to persisted timezone with no authoritative fallback;
10. PR #250 proves every effective public table has RLS and every definer pins `search_path`;
11. PR #265 proves every view and direct browser relation grant is reviewed;
12. PR #261/#264 compiler coverage remains exhaustive for its declared scope;
13. Euro preservation and RLS-role oracles pass;
14. complete Database parity runs;
15. environment, CSP, deployment, privilege and deploy-gate guards remain green;
16. no compatibility name changes without an atomic caller plan;
17. no materialised standings table is introduced without a separately reviewed ACQ-R02 decision.
