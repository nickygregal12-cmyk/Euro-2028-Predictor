# Stage C1 schema implementation overlay

**Status:** Approved implementation overlay; no migration exists  
**Date:** 30 July 2026  
**Authority:** [`stage-c1-c2-governance.md`](stage-c1-c2-governance.md), [`stage-c1-contract-classification.md`](stage-c1-contract-classification.md) and issue [#303](https://github.com/nickygregal12-cmyk/Euro-2028-Predictor/issues/303)  
**Blocks:** issue [#272](https://github.com/nickygregal12-cmyk/Euro-2028-Predictor/issues/272) continues to block all C2 work  
**Overlays:** [`stage-c-competition-season-schema.md`](stage-c-competition-season-schema.md) and [`stage-c-schema-coverage.md`](stage-c-schema-coverage.md)

## 1. Interpretation rule

The two original Stage C documents remain the complete combined design record. This overlay is the implementation authority wherever those documents combine competition-season work with profile ownership or account erasure.

When a combined instruction conflicts with this overlay:

1. C1 follows this overlay;
2. the combined wording remains historical design evidence;
3. the C2 portion is deferred intact to issue #272;
4. no temporary profile-owned model is permitted.

Physical compatibility remains unchanged: `tournaments`, `tournament_id` and `p_tournament_id` stay in place. Architecture may call the row a competition season, but C1 does not perform a cosmetic rename.

## 2. C1 after-state

C1 implements only the competition-season foundation:

- create the stable `competitions` parent;
- add `competition_id`, `season_key`, `kind`, validated `display_timezone` and lifecycle `status` to `tournaments`;
- create `competition_rounds`, `competition_lock_events` and `competition_awards`;
- assign every fixture to an explicit round or matchweek;
- derive round deadlines from current fixture kickoffs rather than storing a planned deadline;
- make observed lock transitions monotonic and fail closed;
- reject every score write at or after the selected fixture kickoff;
- broaden current same-tournament protection to same-competition-season protection without weakening any existing validator;
- keep every competition, season and game score/rank authority independent;
- wire persisted competition timezone through the landed `competitionTimeZone` seam;
- reject invalid competition timezones and remove viewer-timezone fallback from authoritative grouping;
- preserve viewer-local display clocks and UTC-only lock/result comparisons;
- preserve every Euro 2028 identifier, fixture, score, rank, entry, league, Bonus Game and access boundary;
- update generated database types, TypeScript models, RPC compatibility and disposable parity together.

The C1 migration may add season predicates to an existing ownership policy, but it may not change the policy's current direct `auth.uid()` ownership anchor.

## 3. Shared before-state preserved through C1

C1 keeps the complete current auth-owned model unchanged.

Effective `auth.users` references remain:

| Action | References preserved through C1 |
| --- | --- |
| `CASCADE` | `profiles.id`, `entries.user_id`, `league_members.user_id`, `rank_history.user_id`, `rate_limit_events.user_id`, `bonus_competition_entrants.user_id`, `bonus_knockout_predictions.user_id` |
| `RESTRICT` | `leagues.owner_id`, `bonus_cup_fixtures.winner_user_id` |
| `SET NULL` | `match_result_revisions.actor_id`, `actual_third_place_resolutions.updated_by`, `actual_third_place_resolution_revisions.actor_id`, `bonus_competition_audit.actor_id` |

The Cup winner reference is **explicit `RESTRICT` at contract 64**. The original combined coverage row describing implicit `NO ACTION` is stale before-state history and must not be implemented.

Shared preservation also means:

- no current table references `profiles` as an ownership parent;
- `profiles.id` remains the auth UUID and continues to cascade from `auth.users`;
- all 14 effective ownership policies retain their current direct auth-owned anchor;
- no account-erasure, anonymisation or pseudonymisation routine exists;
- `accountDeletionSemantics.test.ts` remains unchanged;
- `stageC1NonInterference.test.ts` must stay green before and after C1 SQL.

## 4. C2 blocked after-state

The following work is outside C1 and remains blocked by issue #272:

- adding `profiles.auth_user_id`;
- replacing `profiles.id -> auth.users`;
- repointing entries, leagues, memberships, ranks, Bonus Game entrants or predictions to `profiles`;
- choosing or implementing account erasure, anonymisation or pseudonymisation behaviour;
- changing transfer/archive consequences for a departing league owner;
- rewriting ownership RLS through a profile/auth link;
- changing any current `auth.users` foreign-key action for the target ownership model;
- deciding former-player history, retained predictions, backup retention or re-identification rules;
- implementing a neutral Cup/LMS placeholder or historical recomputation path for account removal.

Nothing in this overlay approves a C2 target. Technical research recorded under issue #272 remains input to the independent review, not implementation authority.

## 5. Relation-by-relation disposition

### Shared roots and identity

| Object | C1 action | C2 action / boundary |
| --- | --- | --- |
| `tournaments` | Preserve UUID/table; add competition parent, season key, kind, timezone and lifecycle | None |
| `profiles` | Preserve exact schema, FK and policy behaviour | All profile/auth-link and pseudonymisation changes are C2 |
| `rate_limit_events` | Preserve as auth housekeeping | Final deletion rationale remains C2 review evidence |
| `entry_totals` | Preserve browser revokes; redefine only if explicit season scoping requires it | Ownership follows the later C2 entry model, not C1 |

### Direct season scope

| Object | C1 action | C2 action / boundary |
| --- | --- | --- |
| `teams` | Retain season scope; add reviewed `(tournament_id, id)` compatibility key | None |
| `groups` | Tournament-only child; add composite scope and parent-kind validation | None |
| `matches` | Add round authority, fixture administration state and composite season references | None |
| `entries` | Preserve `user_id`; add/strengthen season and relationship scope only | Repointing owner to profile is C2 |
| `leagues` | Preserve `owner_id` and transfer-first behaviour; add season/game scope only | Repointing owner is C2 |
| `players` | Add composite same-season team reference | None |
| `rank_history` | Preserve `user_id`; bind safely to season/round | Repointing user is C2 |
| `actual_third_place_resolutions` | Preserve tournament scope, immutability and nullable auth actor | Actor/retention review remains C2 evidence |
| `actual_third_place_resolution_revisions` | Preserve tournament scope, immutability and nullable auth actor | Actor/retention review remains C2 evidence |
| `match_result_revisions` | Add composite season/match scope; preserve nullable auth actor | Actor/retention review remains C2 evidence |
| `entry_automatic_submission_outcomes` | Add composite season/entry scope | Ownership remains inherited from auth-owned entry |
| `bonus_competitions` | Preserve independent season/game instance | None |

### Relationship, prediction and score scope

| Object | C1 action | C2 action / boundary |
| --- | --- | --- |
| `group_teams` | Prove group/team same-season scope | None |
| `league_members` | Preserve `user_id`; league supplies season boundary | Repointing member identity is C2 |
| `match_predictions` | Add explicit season and entry/match scope; preserve entry ownership path | Later C2 ownership remains indirect through entry |
| `predicted_group_positions` | Composite entry/group/team season scope | Later C2 ownership remains indirect through entry |
| `predicted_progression` | Composite entry/team season scope | Later C2 ownership remains indirect through entry |
| `predicted_tie_resolutions` | Explicit season key and retained UUID-array validation | Later C2 ownership remains indirect through entry |
| `bonus_predictions` | Composite entry/player season scope | Later C2 ownership remains indirect through entry |
| `score_events` | Composite entry/match/team season scope | Later C2 ownership remains indirect through entry |

### Bonus Game graph

| Object | C1 action | C2 action / boundary |
| --- | --- | --- |
| `bonus_competition_entrants` | Preserve `user_id`; add competition/season boundary | Repointing entrant identity is C2 |
| `bonus_competition_windows` | Composite competition key; no stored planned round deadline | None |
| `bonus_window_fixtures` | Same-season window/match proof | None |
| `bonus_knockout_predictions` | Preserve `user_id`; add competition/match/team scope | Repointing user identity is C2 |
| `bonus_lms_selections` | Composite competition/window/entrant/team scope | C2 may later alter entrant identity only |
| `bonus_score_events` | Composite competition/window/match scope | C2 may later alter entrant identity only |
| `bonus_competition_audit` | Preserve immutable audit and nullable auth actor | Retention/actor review remains C2 evidence |
| `bonus_cup_groups` | Composite competition/group key | None |
| `bonus_cup_members` | Composite competition/group/entrant scope | C2 may later alter entrant identity only |
| `bonus_cup_fixtures` | Composite competition/group/window/entrant scope; preserve winner `RESTRICT` | Any placeholder/removal model and winner ownership change is C2 |
| `bonus_cup_penalty_numbers` | Composite competition/window/entrant scope | C2 may later alter entrant identity only |

### New C1 relations

| Object | C1 purpose | Browser boundary |
| --- | --- | --- |
| `competitions` | Stable recurring competition identity | Read only where required; RLS enabled |
| `competition_rounds` | Tournament rounds and league matchweeks | Read only where required; RLS enabled |
| `competition_lock_events` | Internal append-only observed lock transition. **Evidence only — never an enforcement input.** `lock_at` and `kickoff_at` remain the sole lock authorities, so a corrected deadline reopens the entry or fixture. An earlier draft consulted this table inside `enforce_entry_lock_generic`, `enforce_entry_lock_scores` and `enforce_joker_rules`, which made a lock permanent once observed and left no admin route back — see the entry-lock decision in `docs/quality/current-status.md` | No direct browser authority |
| `competition_awards` | Additive season-scoped award results | Read through reviewed bounded paths |

No `competitors` table or parallel `competition_seasons` table is introduced.

## 6. Function and RPC disposition

### C1 season-scope review with auth ownership preserved

The following retained signatures may remain physically named `p_tournament_id`, but C1 must make their season semantics safe without changing current auth ownership:

- `admin_actual_third_place_tie_revisions`
- `admin_actual_third_place_tie_status`
- `admin_clear_actual_third_place_tie`
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
- `get_player_profile`
- `get_prediction_consensus`
- `get_rival_entry`
- `recompute_tournament_scores`

C1 also reviews the implicit tournament joins in:

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

Bonus Game C1 scope review covers:

- `admin_draw_predictor_cup`
- `admin_finalise_predictor_cup_groups`
- `admin_settle_predictor_cup_round`
- `delete_knockout_prediction`
- `register_bonus_competition`
- `save_lms_selection`
- `submit_cup_penalty_number`
- `withdraw_bonus_competition`

### Shared/current-auth functions

C1 may add season validation where required but preserves current auth ownership in:

- `delete_league`
- `get_league`
- `get_league_preview`
- `get_public_capacity`
- `join_league`
- `search_league_transfer_candidates`
- `set_operating_limits`
- `transfer_ownership`

The account deletion/anonymisation routine is C2-only and must not be created in C1.

## 7. RLS, grants, views and definer security

C1 must:

- enable RLS on every new public table;
- add season predicates to direct reads where required;
- keep every existing ownership policy name, command and direct auth-owned predicate;
- preserve the `entry_totals` browser revokes and rationale;
- keep all public views and direct browser relation grants inside the reviewed PR #265 allowlist;
- grant no direct browser write to lock events, internal validators or audit authority;
- revoke `PUBLIC` execute before exact function grants;
- pin `search_path` on every security-definer function;
- keep deployment-RPC/privilege parity and the PR #250/PR #265 guards green.

C1 must not resolve ownership through a profile/auth link or change a policy from `user_id = auth.uid()` / entry-owner lookup to any profile-owned predicate.

## 8. C1 migration sequence

The later C1 migration must be one coherent append-only development-intent migration unless a measured lock-duration issue requires a second migration in the same reviewed PR.

Required order:

1. capture Euro identifiers, counts, totals, ranks, access and current ownership/deletion matrices;
2. create `competitions`, `competition_rounds`, `competition_lock_events` and `competition_awards` with RLS and minimum grants;
3. add nullable C1 season fields and backfill Euro 2028;
4. add composite unique keys and `NOT VALID` same-season foreign keys;
5. validate zero cross-season violations before making required fields non-null;
6. replace validators, lock authorities, season-safe functions and views atomically;
7. wire persisted competition timezone and remove authoritative viewer fallback;
8. update generated types, TypeScript models and fixtures;
9. update only C1 after-state assertions; keep all nine shared-before-state assertions unchanged;
10. run zero-to-current rebuild, database lint, all pgTAP, full Database parity and Euro preservation;
11. review the exact migration and rollback/recovery evidence before any hosted development write.

No step may add a profile ownership dependency to make a composite season constraint easier.

## 9. C1 evidence and exit

C1 does not exit until all of the following pass:

- every current and new relation/function above has a reviewed disposition;
- every retained physical `tournament_id`/`p_tournament_id` name remains intentional compatibility;
- hostile cross-season writes fail;
- null/stale fixture data fails locks closed;
- an observed locked scope never reopens. Round locks are monotonic; Stage C1 supplies the round, fixture-assignment and append-only lock-evidence primitives required for an *incomplete* rescheduled fixture to be reassigned to the round its new kickoff falls within, where it becomes governed by that destination round's lock (ADR 0020). The ingestion and administrative reassignment workflow is delivered separately, and Stage C1 does not claim to complete that behaviour;
- every prediction write at or after the fixture's current kickoff fails;
- invalid competition timezones are rejected or explicitly unavailable;
- viewers share competition grouping while retaining local display clocks;
- Euro UUIDs, 51 fixtures, scores, totals, ranks, leagues, Bonus Games and role-visible rows are preserved;
- all public-table RLS, view/grant, definer `search_path`, compiler and deployment controls remain green;
- `accountDeletionSemantics.test.ts`, `stageC1ContractClassification.test.ts` and `stageC1NonInterference.test.ts` remain green;
- no C2 schema, function, policy or ownership change appears in the diff;
- no materialised standings table is introduced without a separate ACQ-R02 decision.

This overlay completes the design/coverage split only. It does not authorise SQL, a hosted development mutation or any production change.
