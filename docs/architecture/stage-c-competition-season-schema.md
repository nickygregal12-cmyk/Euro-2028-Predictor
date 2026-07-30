# Stage C — competition-season schema design

**Status:** Proposed design; no migration or hosted change exists.  
**Status date:** 30 July 2026  
**Decision authority:** [ADR 0011](../adr/0011-multi-competition-platform.md) and [ADR 0015](../adr/0015-commercial-and-social-model.md)  
**Engineering sequence:** [`multi-competition-hub-build-plan.md`](multi-competition-hub-build-plan.md) §7  
**Implementation truth:** [`../quality/current-status.md`](../quality/current-status.md)

## 1. Purpose and boundary

Stage C introduces one database model that can represent a bounded tournament and a rolling domestic league season without creating parallel tournament and season implementations.

This document is design-only. It does **not**:

- create a migration;
- change application code or RPC contracts;
- alter development or production Supabase;
- change Euro 2028 scoring, locks, results, access or presentation;
- introduce provider ingestion, season Predictor rules, Last Man Standing rules or Predictor Cup formats.

Those later behaviours remain owned by Stages D–G and ADRs 0012–0014.

## 2. Evidence reviewed

The design is grounded in:

- current `main` through `eba31f34a7d8e9c00282972a82e8c8c043c57047`;
- read-only introspection of development project `iouzoutneyjpugbbtdem` on Postgres 17;
- 34 RLS-enabled public tables plus the `entry_totals` view;
- the current foreign-key, unique/check, trigger, RLS-policy and public-function graph;
- the existing `predictor_internal` same-tournament validators;
- Stage B's shared competition-context and lock-state authority.

No application rows or personal data were read. Only catalogue metadata and function definitions were inspected.

The present schema already protects several same-tournament relationships with internal triggers, including group/team assignment, match references, entry/match predictions, group positions, progression, score events, player/team references, result revisions and tournament bonus-game links. Stage C must widen those protections to competition season; it must not replace them with client filtering.

## 3. Stable safeguards

The identifiers below are permanent design references for migration comments, pgTAP tests and application contract tests.

| ID | Safeguard |
| --- | --- |
| `CS-001` | One stable competition identity owns one or more separately identified seasons/editions. |
| `CS-002` | Every season declares `tournament` or `league_season`, an IANA timezone and bounded dates. |
| `CS-003` | Every season-scoped relationship is proven by a database constraint or internal validator; separate foreign keys are insufficient. |
| `CS-004` | A fixture, participant, round, prediction, score event, league or bonus-game row cannot cross competition-season boundaries. |
| `CS-005` | Round deadlines are derived from current fixture kickoffs; an authoritative scheduled lock timestamp is never stored. |
| `CS-006` | Lock transitions are monotonic: a recorded locked scope never reopens after rescheduling or stale data. |
| `CS-007` | A per-fixture server guard rejects every prediction submitted at or after that fixture's kickoff. |
| `CS-008` | Entries, standings, score history and game enrolment remain independent per competition season and game. |
| `CS-009` | Account deletion anonymises a durable competitor identity instead of rewriting settled competition history. |
| `CS-010` | A season with user or settled result data is archived, not hard-deleted. |
| `CS-011` | New public-schema objects are RLS-enabled and receive explicit Data API grants only when browser access is required. |
| `CS-012` | Euro 2028 backfill preserves every identifier, rule, score, result, league, entry and access boundary. |
| `CS-013` | No aggregate score or rank can span competition seasons or game authorities. |
| `CS-014` | Schema, SQL functions, TypeScript models and generated database types change together and pass the full parity harness. |

## 4. Chosen evolution strategy

### 4.1 Evolve the existing model in place

Do not add a second season-only set of teams, fixtures, entries or standings beside the tournament tables. That would create the parallel implementation rejected by ADR 0011.

The migration will instead:

1. add a stable `competitions` identity table;
2. evolve `tournaments` into the shared `competition_seasons` table;
3. rename season-scope columns from `tournament_id` to `competition_season_id`;
4. add a generic round/matchweek authority;
5. widen current teams, matches, entries, leagues, history and bonus-game relationships to the shared season key;
6. retain tournament-only columns as explicitly constrained tournament shape, not as assumptions for every season.

PostgreSQL renames preserve row identifiers, foreign-key targets and migration history. Application and RPC callers must be updated atomically in the implementation PR.

### 4.2 No global club/player master in Stage C

Current `teams` and `players` are season-scoped records. Stage C keeps them season-scoped.

A durable cross-season club/player identity depends on provider ingestion, transfer handling and source reconciliation, which belong to Stage D. Inventing that authority now would be speculative. Stage C leaves room for a later nullable provider/entity link without requiring it.

## 5. Proposed relational model

### 5.1 `competitions`

Stable identity for the recurring product, such as UEFA European Championship, Premier League or Scottish Premiership.

| Column | Rule |
| --- | --- |
| `id uuid` | primary key |
| `slug text` | immutable, globally unique machine key |
| `name text` | human-readable competition name |
| `sport text` | initially constrained to `football` |
| `created_at timestamptz` | default `now()` |

Deletion is `RESTRICT` while any season exists.

No entitlement table is created. The schema avoids coupling competition identity to payment so ADR 0015's future entitlement concept can be added without changing competitive records.

### 5.2 `competition_seasons`

Rename and widen the current `tournaments` table.

| Column | Rule |
| --- | --- |
| `id uuid` | existing tournament UUID remains unchanged |
| `competition_id uuid` | FK to `competitions`, `ON DELETE RESTRICT` |
| `season_key text` | stable edition key, e.g. `2028` or `2026-27` |
| `name text` | current display name |
| `kind text` | `tournament` or `league_season` |
| `time_zone text` | validated IANA zone; Euro backfill uses `Europe/London` |
| `starts_on date` / `ends_on date` | interpreted in `time_zone`; end cannot precede start |
| `status text` | `draft`, `scheduled`, `active`, `complete`, `archived` |
| `created_at timestamptz` | preserved |

Unique: `(competition_id, season_key)`.

Tournament-only fields must not become generic assumptions:

- the current stored `lock_at` is deprecated as an authority and retained only during the compatibility transition;
- `golden_boot_player_id` moves to the award model described below;
- the implementation may keep compatibility columns for one release only if a database trigger proves parity with the new authority.

### 5.3 `competitors`

Durable competitive identity, separated from an authentication account.

| Column | Rule |
| --- | --- |
| `id uuid` | primary key; existing user UUID is reused during backfill |
| `user_id uuid null` | unique FK to `auth.users(id) ON DELETE SET NULL` |
| `display_name text` | competition-visible name |
| `anonymized_at timestamptz null` | set when the account is removed |
| `created_at timestamptz` | preserved/backfilled |

Existing account preferences remain in `profiles`. `entries`, league membership, rank history and bonus-game entrant records move from `user_id` to `competitor_id`.

When `user_id` becomes null, an internal trigger replaces the display name with a non-identifying value and clears any future personal fields. Competitive rows remain, so settled standings do not change after account deletion. This is a technical behaviour decision; privacy copy and retention policy still require the later legal/privacy gate.

RLS maps an authenticated user through `competitors.user_id = auth.uid()`.

### 5.4 `competition_rounds`

One generic sequence authority for tournament matchdays/knockout rounds and league matchweeks.

| Column | Rule |
| --- | --- |
| `id uuid` | primary key |
| `competition_season_id uuid` | FK to season |
| `round_key text` | stable key such as `MD1`, `R16`, `MW01` |
| `sequence integer` | positive tournament/season order |
| `kind text` | `group_matchday`, `knockout_round`, `league_matchweek` |
| `label text` | display label |
| `created_at timestamptz` | default `now()` |

Unique: `(competition_season_id, round_key)` and `(competition_season_id, sequence)`.

No scheduled lock timestamp is stored here.

### 5.5 `competition_lock_events`

Records the irreversible fact that a scope has locked; it does not store the planned deadline.

| Column | Rule |
| --- | --- |
| `id uuid` | primary key |
| `competition_season_id uuid` | season scope |
| `scope_type text` | `entry`, `round`, `match` |
| `scope_key text` | stable key within season |
| `locked_at timestamptz` | actual transition time |
| `fixture_basis_hash text` | fixture-set evidence used when transition occurred |
| `created_at timestamptz` | default `now()` |

Unique: `(competition_season_id, scope_type, scope_key)`.

Effective deadline remains a query over current valid fixtures:

- season/tournament entry scope: earliest applicable kickoff;
- league round: earliest kickoff in the round;
- match guard: that match's kickoff.

If fixture data is missing, invalid or stale, write authorities fail closed. Once a lock event exists, the scope remains locked regardless of later fixture changes.

### 5.6 Season-scoped teams, groups, players and matches

Existing tables remain the implementation; their scope is renamed to `competition_season_id`.

Each directly season-scoped table receives a unique `(competition_season_id, id)` key so children can use composite foreign keys.

#### `teams`

- remains one season participant row;
- unique `(competition_season_id, name)` during the current provider-free phase;
- no cross-season team identity is asserted.

#### `groups`

- tournament-only;
- composite FK to a `tournament` season;
- current A–F constraint remains Euro configuration, not the generic group-count law. Before another grouped tournament is added, letter/size configuration must move to data.

#### `players`

- composite `(competition_season_id, team_id)` FK;
- nullable team remains permitted only where current behaviour requires it.

#### `matches`

The existing table becomes the shared fixture/result store.

Add `round_id` with a composite `(competition_season_id, round_id)` FK. Backfill Euro rounds from current `round` and `matchday` values.

Common columns remain authoritative for both kinds:

- season, fixture reference, round, home/away team, date/kickoff, venue;
- result state/method, 90/120/penalty scores, winner and result revision metadata.

Tournament-only shape becomes nullable and kind-validated:

- `group_id`;
- bracket `home_source` / `away_source`;
- tournament-stage compatibility values.

League-season fixtures require a `league_matchweek` round, no tournament group/bracket source, and two teams from the same season.

The current result lifecycle remains unchanged.

### 5.7 Entries, leagues, scores and history

#### `entries`

- rename scope to `competition_season_id`;
- replace `user_id` with `competitor_id`;
- unique `(competitor_id, competition_season_id)`;
- remains the Predictor entry authority; bonus games retain separate entrant tables.

#### `leagues` / `league_members`

- leagues remain Predictor-only and season-scoped;
- owner/member references use `competitor_id`;
- no durable group entity or cross-season league record is introduced;
- the later copy/rerun action creates a new league in the target season.

#### `match_predictions`, group/progression/tie predictions, bonus predictions

Every table that joins an entry to a match, group, team or player carries `competition_season_id` and uses composite foreign keys. Arrays such as ordered tie teams keep an internal validator because PostgreSQL cannot foreign-key array elements.

#### `score_events` and `rank_history`

- both carry `competition_season_id` explicitly;
- score-event entry/match/team links are composite and same-season;
- rank history uses competitor, season and round keys;
- no view, RPC or index may aggregate points across seasons or across game authorities.

### 5.8 Awards and honours

Replace `competition_seasons.golden_boot_player_id` with:

`competition_awards(competition_season_id, award_key, winner_player_id, result_version, confirmed_at)`.

For Euro backfill, `award_key = 'golden_boot'` preserves current scoring. Other awards are added only when an accepted rule requires them.

Per-season settled winners may be retained, but ADR 0015 forbids a durable cross-competition friend-group honours board. No such aggregate is introduced.

### 5.9 Bonus-game graph

`bonus_competitions` renames `tournament_id` to `competition_season_id` and remains the game-instance root.

Strengthen existing links with composite keys:

- window ↔ competition;
- window fixture ↔ competition and same-season match;
- LMS selection ↔ competition, window, entrant and same-season team;
- KO prediction ↔ eligible competition and same-season knockout match/team;
- Cup group/member/fixture ↔ the same bonus competition;
- bonus score event ↔ competition, window and same-season match.

KO Predictor remains unavailable to a `league_season`; Last Man Standing and Predictor Cup availability is governed later by ADRs 0013–0014. Stage C establishes safe scoping only.

## 6. Declarative constraints versus triggers

Prefer composite foreign keys and unique keys for simple same-season equality. Keep internal triggers for rules that need parent-kind inspection, conditional references, arrays, current time or multi-row lifecycle logic.

The current validator names should evolve rather than disappear. At minimum the implementation must update the authorities corresponding to:

- group/team scope;
- match reference scope;
- match prediction scope;
- group position and progression scope;
- score-event scope;
- player/team and award scope;
- result-revision scope;
- bonus window/fixture, LMS and KO-prediction scope.

A migration is incomplete if the tables are renamed but a security-definer function, trigger, RLS policy, RPC parameter or application query still assumes `tournament_id`.

## 7. Deletion and archival rules

### Competition and season deletion

- `competitions`: `RESTRICT` while seasons exist.
- `competition_seasons`: hard deletion allowed only while `status = 'draft'` and no entry, entrant, confirmed result, score event or rank-history row exists.
- once user or result data exists, the season can only move to `archived`;
- an internal admin function may delete an empty draft in a controlled transaction;
- ordinary browser roles receive no delete grant.

Reference rows may retain `ON DELETE CASCADE` beneath a draft season because the guard proves no durable competitive history exists. The season guard, not a casual client delete, controls that path.

### Account deletion

- Auth and private profile/preferences are removed;
- durable competitor identity is anonymised;
- entries, settled score events, rank history and competition outcomes remain under the anonymous competitor id;
- league ownership must be transferred or the league archived before account removal;
- unsettled private invitations and notification preferences are deleted.

## 8. Timezone contract

- `competition_seasons.time_zone` is a valid IANA identifier checked against PostgreSQL timezone names by an internal validator;
- all instants remain `timestamptz`;
- calendar dates and day grouping are interpreted in the season timezone;
- domain and SQL functions receive the effective instant explicitly for tests where possible;
- no shared domain code reads the ambient clock;
- Euro 2028 backfills `Europe/London`; UTC offsets are never stored as the season timezone.

## 9. Data API, RLS and function exposure

Supabase changed new-table exposure behaviour in 2026: new public tables may require explicit grants before the Data API can access them. Stage C must therefore declare grants deliberately rather than rely on project defaults.

- enable RLS on every public table;
- grant authenticated `SELECT` only for browser-readable reference data;
- grant no direct browser writes where an RPC/trigger authority is required;
- keep internal lock/audit tables unexposed;
- rewrite policies through competitor ownership and season scope;
- revoke `PUBLIC` execution from new internal/security-definer functions before granting the exact caller roles;
- run Supabase security and performance advisors after the local migration.

References:

- [Supabase breaking change: new tables are not exposed automatically](https://supabase.com/changelog/45329-breaking-change-tables-not-exposed-to-data-and-graphql-api-automatically)
- [Supabase Row Level Security](https://supabase.com/docs/guides/database/postgres/row-level-security)
- [Supabase database advisors](https://supabase.com/docs/guides/database/database-advisors)

## 10. Migration implementation boundary

The implementation should be one coherent Stage C PR and one ordered append-only development migration unless local rehearsal proves that PostgreSQL lock duration requires a second migration in the same PR.

Required order:

1. capture pre-migration row counts, identifiers, score totals and relationship-oracle results;
2. create new root/round/competitor/lock/award tables;
3. backfill competition, Euro season, rounds, competitors and season keys using existing UUIDs;
4. add nullable season/competitor columns to children and backfill them;
5. add composite unique keys and `NOT VALID` foreign keys;
6. validate every new constraint and prove all cross-season violation queries return zero rows;
7. make new columns non-null where required;
8. rename the shared table/column authorities and update indexes;
9. replace functions, triggers, RLS policies, views and RPC argument contracts atomically;
10. update application queries, generated TypeScript types and test fixtures;
11. remove compatibility columns only after parity checks pass in the same local rehearsal;
12. run the full gate set before any hosted application is proposed.

No hosted development or production migration is authorised by this design.

## 11. Required pre-migration and exit evidence

### Static/database contract tests committed first

- every season-scoped table is listed in a coverage manifest;
- no `tournament_id` column/function parameter remains outside an explicit compatibility allowlist;
- every multi-parent row has a composite season constraint or named validator;
- no ranking/score query lacks a season and game boundary;
- new public tables have RLS and explicit grants;
- internal security-definer functions are not executable by `PUBLIC`.

### Disposable Postgres/Supabase proof

- migration rebuild from zero;
- migration timestamp and canonical applied-state checks;
- database lint and pgTAP;
- all files under `tests/database-parity/` execute in the Supabase harness;
- generated TypeScript types match the migrated schema;
- hostile cross-season insert/update attempts fail;
- stale/missing fixture data fails locks closed;
- a previously locked round cannot reopen;
- per-match late prediction insertion fails;
- account deletion anonymises but does not change settled totals/ranks;
- non-empty season deletion fails; empty draft deletion succeeds only through the internal path.

### Euro preservation oracle (`CS-012`)

Before and after migration, assert equality for:

- the Euro season UUID and all team/group/match UUIDs;
- 51 fixture references and current result lifecycle values;
- entry, prediction, league/member and bonus-game counts;
- score events, totals, rank history and leaderboard order;
- Golden Boot prediction/result/scoring;
- group order, third-place resolution and knockout progression;
- RLS-visible rows for owner, league co-member, unrelated authenticated user and anonymous role;
- the Stage B competition-context outputs under deterministic clocks.

## 12. Explicitly deferred

- provider ids and cross-season club/player identity — Stage D;
- ingestion, rescheduling audit and correction feeds — Stage D;
- recurring Predictor scoring/submission rules — Stage E / ADR 0012;
- season Last Man Standing and managed entrants — Stage F / ADR 0013;
- season Predictor Cup formats — Stage G / ADR 0014;
- cross-competition UI and notification preferences — Stage H/I;
- hosted migration, production promotion or data copy — requires a later explicit owner approval.

## 13. Design exit

This design is ready for implementation review when:

- every current table, validator, trigger, RLS policy and RPC affected by scope widening is represented in the migration coverage manifest;
- the chosen rename/backfill sequence has a reversible local rehearsal plan;
- the preservation and hostile cross-season tests are specified before SQL is written;
- no open question permits a parallel tournament/season implementation or weakens an existing safeguard.

Only then should the append-only Stage C development migration be created.
