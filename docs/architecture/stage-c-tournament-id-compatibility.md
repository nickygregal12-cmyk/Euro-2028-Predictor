# Stage C — `tournament_id` compatibility inventory

**Status:** Pre-migration contract; no Stage C schema implementation exists.  
**Baseline:** `main` at `e878afb1aed7c832c7926da2cf3696c7b627906e`.  
**Parent design:** [`stage-c-competition-season-schema.md`](stage-c-competition-season-schema.md)  
**Object coverage:** [`stage-c-schema-coverage.md`](stage-c-schema-coverage.md)

## Purpose

Stage C deliberately evolves the existing physical `tournaments` / `tournament_id`
contract in place. Architecture may call the row a competition season, but the
migration must not rename or replace a working scope merely to make the physical
name match the new vocabulary.

This inventory pins every current direct `public.*.tournament_id` column. A Stage C
implementation must preserve, generalise or deliberately replace every row below
in the same reviewed change. The exit condition is **zero unreviewed tournament-only
assumptions**, not zero retained compatibility names.

The list is supported by:

- the effective committed migration history;
- a read-only development catalogue check on 30 July 2026;
- `tests/database-parity/stageCTournamentIdCompatibility.test.ts`.

The catalogue check read column metadata only. It did not read application rows or
write to Supabase.

## Current direct columns

Every current column below is `uuid NOT NULL`.

| Current column | Stage C disposition |
| --- | --- |
| `actual_third_place_resolution_revisions.tournament_id` | retain direct season scope; object remains tournament-only |
| `actual_third_place_resolutions.tournament_id` | retain direct season scope; object remains tournament-only |
| `bonus_competitions.tournament_id` | retain as the season scope of each independent bonus-game instance |
| `entries.tournament_id` | retain as the Predictor entry season scope |
| `entry_automatic_submission_outcomes.tournament_id` | retain and prove composite equality with the entry season |
| `groups.tournament_id` | retain; groups remain valid only for `kind = 'tournament'` |
| `leagues.tournament_id` | retain as the league's competition-season scope |
| `match_result_revisions.tournament_id` | retain and prove composite equality with the revised fixture |
| `matches.tournament_id` | retain as the shared fixture/result season scope |
| `players.tournament_id` | retain until provider/global identity work in Stage D |
| `rank_history.tournament_id` | retain and bind history to the relevant season/round authority |
| `teams.tournament_id` | retain; teams remain season participants in Stage C |

## Change rules

1. A new direct `tournament_id` column must be added here with its reason and
   relationship proof in the same PR.
2. Removing or renaming one of these columns requires an atomic caller/RPC/type
   compatibility plan; absence alone is not an improvement.
3. All retained columns remain season identifiers for both bounded tournaments and
   league seasons unless their row is explicitly tournament-only.
4. Simple parent/child equality should use composite foreign keys where practical;
   triggers remain for arrays, conditional shape, parent kind, time and lifecycle.
5. This inventory does not decide the account-erasure model blocked by issue #272
   and does not authorise SQL, a migration or a hosted schema operation.
