# DATA-003 — tournament/reference constraint inventory

**Date:** 2026-07-25  
**Scope:** repository and connected development Supabase only  
**Production:** not queried or changed  
**Development project:** `iouzoutneyjpugbbtdem`

## Purpose

This document records the evidence inventory required before any additive migration is designed for `DATA-003`. It distinguishes relationships already protected by database constraints or validation triggers from relationships that still rely on single-column foreign keys and therefore cannot independently prove same-tournament consistency.

No schema change is included in this stage.

## Existing tournament roots

The following public tables carry `tournament_id` directly and reference `tournaments(id)`:

- `entries`
- `groups`
- `leagues`
- `matches`
- `match_result_revisions`
- `players`
- `rank_history`
- `teams`

Existing tournament-scoped uniqueness includes:

- `entries(user_id, tournament_id)`
- `groups(tournament_id, letter)`
- `matches(tournament_id, match_ref)`
- `rank_history(user_id, tournament_id, matchday_key)`
- `teams(tournament_id, name)`

## Relationships already protected by explicit scope-validation triggers

| Child table | References | Current protection |
| --- | --- | --- |
| `match_predictions` | `entry_id`, `match_id` | `predictor_internal.validate_match_prediction_scope()` on insert/update verifies the prediction belongs to the same tournament. |
| `predicted_group_positions` | `entry_id`, `group_id`, `team_id` | `predictor_internal.validate_group_position_scope()` on insert/update verifies entry, group and team scope. |
| `predicted_progression` | `entry_id`, `team_id` | `predictor_internal.validate_progression_scope()` on insert/update verifies progression scope. |
| `bonus_predictions` | `entry_id`, `golden_boot_player_id` | `predictor_internal.validate_bonus_scope()` on insert/update verifies bonus scope. |

These trigger-backed relationships are not automatically candidates for duplicate composite foreign keys. Any migration must preserve the current RPC/admin write paths and avoid adding redundant constraints without a demonstrated benefit.

## Authoritative/reference relationships not protected by a same-tournament composite constraint

| Table / relationship | Current database relationship | Same-tournament risk |
| --- | --- | --- |
| `group_teams.group_id -> groups.id`; `group_teams.team_id -> teams.id` | Independent single-column foreign keys | A group from tournament A can theoretically reference a team from tournament B. |
| `matches.group_id -> groups.id` with `matches.tournament_id` | Independent single-column foreign keys | A group-stage match can theoretically carry a group from another tournament. |
| `matches.home_team_id -> teams.id` with `matches.tournament_id` | Independent single-column foreign key | A match can theoretically reference a home team from another tournament. |
| `matches.away_team_id -> teams.id` with `matches.tournament_id` | Independent single-column foreign key | A match can theoretically reference an away team from another tournament. |
| `matches.winner_team_id -> teams.id` with `matches.tournament_id` | Independent single-column foreign key plus result-shape checks | Result-shape checks prove the winner is a participant, but the participant references themselves are not same-tournament composite foreign keys. |
| `players.team_id -> teams.id` with `players.tournament_id` | Independent single-column foreign key | A player can theoretically reference a team from another tournament. |
| `match_result_revisions.match_id -> matches.id` with `match_result_revisions.tournament_id` | Independent single-column foreign keys | A revision row can theoretically declare a tournament different from its match. |
| `tournaments.golden_boot_player_id -> players.id` | Single-column foreign key | The selected Golden Boot player can theoretically belong to another tournament. |
| `score_events.entry_id`, `match_id`, `team_id` | Independent single-column foreign keys; no scope-validation trigger found | A score event can theoretically combine references from different tournaments. This table needs write-path and recomputation analysis before choosing constraints. |

## Relationships inherited through an owning row

The following tables do not carry `tournament_id` directly and inherit scope through their owner/reference row:

- `league_members` through `leagues`
- `predicted_tie_resolutions` through `entries`
- child prediction tables through `entries`

Not carrying `tournament_id` is not itself a defect. A new column should not be added merely for symmetry. The migration design must be based on an enforceable invariant and current query/write requirements.

## Required pre-migration checks

Before adding any constraint, the implementation stage must:

1. inspect all 35 repository migrations to identify existing intent and avoid conflicting names or duplicate enforcement;
2. inspect functions and triggers that insert/update `matches`, `group_teams`, `players`, `match_result_revisions`, `score_events` and tournament awards;
3. run read-only orphan/cross-tournament queries on development for every proposed constraint;
4. decide whether each invariant is best expressed as:
   - a composite unique key plus composite foreign key;
   - a narrowly scoped validation trigger;
   - an immutable derived value;
   - or no change because an existing protected write boundary is sufficient;
5. preserve legitimate result correction, fixture assignment and tournament setup paths;
6. implement only additive, fail-closed migration SQL;
7. rebuild from migration 1 and pass database lint, pgTAP, TypeScript/PostgreSQL parity, application CI and Browser E2E.

## Current classification

`DATA-003` remains **open — partially implemented**.

The development database has substantial trigger-backed scope validation for user prediction data, but authoritative fixture/reference relationships remain incompletely constrained at the database layer. This inventory is evidence for migration design; it is not closure evidence and does not establish production readiness.
