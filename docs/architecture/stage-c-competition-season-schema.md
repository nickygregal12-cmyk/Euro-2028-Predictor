# Stage C — competition-season schema design

**Status:** Proposed design; requires owner approval of the three decisions in §6. No migration or hosted change exists.  
**Status date:** 30 July 2026  
**Baseline:** `main` at `69f6e364132f6586d5de9ed8706b0802d14ec0fc`  
**Decision authority:** [ADR 0011](../adr/0011-multi-competition-platform.md), [ADR 0012](../adr/0012-season-predictor-rules.md) and [ADR 0015](../adr/0015-commercial-and-social-model.md)  
**Engineering sequence:** [`multi-competition-hub-build-plan.md`](multi-competition-hub-build-plan.md) §7  
**Implementation truth:** [`../quality/current-status.md`](../quality/current-status.md)

## 1. Purpose and boundary

Stage C introduces one database model that can represent a bounded tournament and a rolling domestic league season without creating parallel tournament and season implementations.

This document is design-only. It does **not**:

- create a migration;
- change application code or RPC contracts;
- alter development or production Supabase;
- change Euro 2028 scoring, locks, results, access or presentation;
- implement ingestion, season Predictor, Last Man Standing or Predictor Cup.

Those later behaviours remain owned by Stages D–G and ADRs 0012–0014.

## 2. Evidence reviewed

The design is grounded in:

- current `main` through PR #239;
- read-only introspection of development project `iouzoutneyjpugbbtdem` on Postgres 17;
- 34 RLS-enabled public tables plus the `entry_totals` view;
- the current foreign-key, unique/check, trigger, RLS-policy and public/internal-function graph;
- the existing `predictor_internal` same-tournament validators;
- Stage B's shared competition-context and lock-state authority;
- the concurrent Stage C proposal in PR #242.

No application rows or personal data were read. Only catalogue metadata and function definitions were inspected.

Measured facts that affect the design:

- four current foreign keys cascade directly from `auth.users`: `entries`, `league_members`, `rank_history` and `rate_limit_events`;
- `entries` is itself a cascade parent for predictions, score events and tie-resolution data;
- every current instant column is `timestamptz`; there are no naked `timestamp` columns;
- current same-tournament protection is partly declarative and partly enforced by internal trigger assertions;
- public functions and application callers widely use the established `tournament_id` / `p_tournament_id` contract.

## 3. Adopted constraints

ADR 0011 already decides the following and this design does not reopen them:

- competition shape is data, not code branches;
- the same context and lock engines serve tournaments and league seasons;
- round/matchweek lock deadlines are derived from current fixture kickoffs and are never stored as planned timestamps;
- a per-match server guard rejects predictions at or after that match's kickoff;
- lock outcomes are monotonic and fail closed;
- same-tournament safeguards widen to same-competition-season without weakening;
- Euro 2028 remains behaviourally unchanged as one `tournament` configuration;
- no score or rank aggregates across competitions, seasons or games.

## 4. Stable safeguards

The identifiers below are permanent design references for migration comments, pgTAP tests and application contract tests.

| ID | Safeguard |
| --- | --- |
| `CS-001` | One stable competition identity owns one or more separately identified seasons/editions. |
| `CS-002` | Every season declares `tournament` or `league_season`, one IANA timezone and bounded dates. |
| `CS-003` | Every season-scoped relationship is proven by a database constraint or named internal validator; separate foreign keys are insufficient. |
| `CS-004` | A fixture, participant, round, prediction, score event, league or bonus-game row cannot cross season boundaries. |
| `CS-005` | Round deadlines are derived from current fixture kickoffs; no round stores an authoritative planned lock timestamp. |
| `CS-006` | A recorded lock transition is monotonic: a locked scope never reopens after rescheduling or stale data. |
| `CS-007` | A per-fixture server guard rejects every prediction submitted at or after that fixture's kickoff. |
| `CS-008` | Entries, standings, score history and game enrolment remain independent per season and game. |
| `CS-009` | Account deletion anonymises a durable competitor identity instead of rewriting settled competition history. |
| `CS-010` | A season with user or settled result data is archived, not hard-deleted. |
| `CS-011` | New public-schema objects are RLS-enabled and receive explicit Data API grants only where browser access is required. |
| `CS-012` | Euro 2028 backfill preserves every identifier, rule, score, result, league, entry and access boundary. |
| `CS-013` | No aggregate score or rank can span seasons or game authorities. |
| `CS-014` | Schema, SQL functions, TypeScript models and generated database types change together and pass the full parity harness. |
| `CS-015` | Season Predictor ties resolve by the approved season-only order and never use tournament-only criteria. |

## 5. Schema evolution strategy

### 5.1 Generalise the existing root in place

Stage C will **generalise the existing `tournaments` table in place**. It will not create a parallel `competition_seasons` table and will not rename or drop the existing table or established `tournament_id` / `p_tournament_id` database contract in this migration.

This is a deliberate compatibility decision:

- the existing `tournaments.id` already identifies one bounded edition/season;
- current validators, RLS policies, RPCs and application calls already agree on `tournament_id`;
- renaming the physical contract would create a large simultaneous API migration without improving integrity;
- ADR 0011 requires evolution rather than a rewrite.

Within architecture and TypeScript, the row is a **competition season**. Within the Stage C database contract, `tournaments` and `tournament_id` remain the stable physical names. The distinction is documented rather than hidden. A future cosmetic rename is outside Stage C and may occur only after every caller has migrated behind compatibility wrappers.

### 5.2 New `competitions` parent

Stable identity for the recurring product, such as UEFA European Championship, Premier League or Scottish Premiership.

| Column | Rule |
| --- | --- |
| `id uuid` | primary key |
| `slug text` | immutable, globally unique machine key |
| `name text` | human-readable competition name |
| `sport text` | initially constrained to `football` |
| `created_at timestamptz` | default `now()` |

Deletion is `RESTRICT` while any season row exists.

### 5.3 Additive season fields on `tournaments`

| Column | Rule |
| --- | --- |
| `competition_id uuid` | FK to `competitions`, `ON DELETE RESTRICT` |
| `season_key text` | stable edition key, e.g. `2028` or `2027-28` |
| `kind text` | `tournament` or `league_season`, default `tournament` |
| `display_timezone text` | validated IANA zone; Euro backfill uses `Europe/London` |
| `status text` | `draft`, `scheduled`, `active`, `complete`, `archived` |

Unique: `(competition_id, season_key)`.

Existing `id`, `name`, `year`, `starts_on`, `ends_on`, `created_at` and compatibility fields remain. `year` is not the new season authority; `season_key` supports seasons spanning two calendar years.

The current stored tournament `lock_at` remains a compatibility field for Euro while Stage C lands. New season/matchweek authority must not read it. Removal or repurposing requires a later separately reviewed compatibility change.

### 5.4 No global club/player master in Stage C

Current `teams` and `players` remain season-scoped records. A durable cross-season club/player identity depends on provider ingestion, transfer handling and source reconciliation, which belong to Stage D.

## 6. Owner decisions required before migration

### 6.1 Season Predictor tie-break

Tournament tie-break criteria include knockout/champion/total-goals predictions that do not exist in the season game.

**Recommended decision:**

1. most exact scores;
2. most correct results;
3. joint rank when still level.

Rejected alternatives:

- fewer matchweeks played: rewards late entry and conflicts with rolling-entry fairness;
- head-to-head: not defined consistently for the overall standing;
- a tournament-shaped criterion the season game does not produce.

Approval of this design confirms the recommended order and `CS-015`.

### 6.2 Account deletion and anonymisation

**Recommended decision:** anonymise, do not delete settled competitive history.

Add a durable `competitors` table:

| Column | Rule |
| --- | --- |
| `id uuid` | primary key; existing user UUID may be reused during backfill |
| `user_id uuid null` | unique FK to `auth.users(id) ON DELETE SET NULL` |
| `display_name text` | competition-visible name |
| `anonymized_at timestamptz null` | set when the account is removed |
| `created_at timestamptz` | preserved/backfilled |

Existing account preferences remain in `profiles`. Entries, league membership, rank history and bonus-game entrant records move from direct auth ownership to `competitor_id`.

On account deletion:

- authentication and private profile/preferences are removed;
- `competitors.user_id` becomes null;
- the public name becomes a stable non-identifying label, recommended format `Former player ####` derived without exposing the UUID;
- entries, predictions, score events, rank history and settled outcomes remain;
- league ownership is transferred or the league is archived first;
- `rate_limit_events` remains disposable housekeeping and continues to cascade.

Approval confirms this preservation model and the recommended public label. Legal/privacy review remains a later product gate; this design does not claim that pseudonymisation alone settles every data-protection obligation.

### 6.3 Timezone contract

**Recommended decision:** one display timezone per competition season.

- every instant remains `timestamptz` and is stored in UTC;
- date-only metadata remains `date`;
- `tournaments.display_timezone` stores one valid IANA identifier;
- matchweek/day grouping and deadline communication use that season timezone;
- the timezone is resolved at the route boundary and passed to pure domain code;
- a viewer's device timezone may affect optional presentation only, never lock, matchweek or scoring decisions.

Approval confirms this contract.

## 7. Rounds, fixtures and lock evidence

### 7.1 `competition_rounds`

| Column | Rule |
| --- | --- |
| `id uuid` | primary key |
| `tournament_id uuid` | FK to the season row |
| `round_key text` | stable key such as `MD1`, `R16`, `MW01` |
| `ordinal integer` | positive order within the season |
| `kind text` | `group_matchday`, `knockout_round`, `league_matchweek` |
| `label text` | display label |
| `created_at timestamptz` | default `now()` |

Unique: `(tournament_id, round_key)` and `(tournament_id, ordinal)`.

A tournament may have many rounds even where its Predictor entry has one tournament-wide lock scope. Round structure and entry lock scope are separate concepts.

There is deliberately no `lock_at` column.

### 7.2 Monotonic lock-transition evidence

ADR 0011 rejects storing the **derived deadline** and rejects a surface-owned boolean. It also requires that a scope which has locked never reopen.

Stage C may therefore add an append-only `competition_lock_events` table which records the fact that a transition occurred, not the planned deadline:

| Column | Rule |
| --- | --- |
| `id uuid` | primary key |
| `tournament_id uuid` | season scope |
| `scope_type text` | `entry`, `round`, `match` |
| `scope_key text` | stable key within season |
| `locked_at timestamptz` | actual transition observation |
| `fixture_basis_hash text` | fixture-set evidence used at transition |
| `created_at timestamptz` | default `now()` |

Unique: `(tournament_id, scope_type, scope_key)`.

The resolver still derives the current deadline from fixtures and returns the outcome. Event existence is one monotonic input to that resolver; it is not a stored effective deadline or a surface-owned lock boolean.

### 7.3 Matches

Add `matches.round_id`, backfill every Euro fixture to a round, validate the composite `(tournament_id, round_id)` reference, then make it non-null.

Add a fixture-administration state distinct from official result state, capable of representing at least:

- `scheduled`;
- `postponed`;
- `abandoned`;
- `void`;
- `cancelled`.

The current result lifecycle remains authoritative for confirmation, correction, scores, method and winner.

Tournament-only group/bracket columns remain nullable and are validated against `tournaments.kind = 'tournament'`. League-season fixtures require a `league_matchweek` round and no tournament group/bracket source.

## 8. Season-scoped relationships

Every directly season-scoped parent receives a unique `(tournament_id, id)` key where needed. Children use composite foreign keys wherever the rule is simple same-season equality.

### Teams, groups and players

- `teams` remains one season participant row;
- `groups` remains tournament-only and gains kind/scope validation;
- `players` uses a composite same-season team reference;
- group letters/counts remain Euro configuration until another grouped tournament requires generalisation.

### Entries, leagues, scores and history

- `entries` replaces direct auth ownership with `competitor_id` and remains unique per competitor/season;
- leagues remain Predictor-only and season-scoped; rerun/copy creates a new target-season league rather than a durable cross-season league object;
- prediction rows joining entries to matches/groups/teams/players gain explicit season keys and composite references;
- tie-resolution arrays remain internally validated because PostgreSQL cannot foreign-key array elements;
- `score_events` and `rank_history` carry explicit season and competitor scope;
- no view or RPC aggregates points across seasons or game authorities.

### Awards

Add `competition_awards(tournament_id, award_key, winner_player_id, result_version, confirmed_at)` as an additive general award result model. The current Golden Boot compatibility field remains until a later parity-proven cleanup.

### Bonus games

`bonus_competitions.tournament_id` remains the season root. Composite keys strengthen window, fixture, entrant, team, match and Cup-group relationships. Stage C establishes safe scoping only; ADRs 0013–0014 decide season game rules.

## 9. Declarative constraints, triggers, RLS and grants

Prefer composite foreign keys and unique keys for simple same-season equality. Retain internal triggers for parent-kind checks, conditional references, arrays, current time and lifecycle logic.

The existing same-tournament validators must be generalised, not removed. Coverage includes group/team, match references, predictions, positions, progression, score events, players, awards, result revisions and every bonus-game relationship.

For new public objects:

- enable RLS explicitly;
- grant browser access only where the application requires it;
- grant no direct browser writes where an RPC/trigger authority exists;
- keep internal lock/audit evidence unexposed;
- rewrite ownership policies through `competitors.user_id = auth.uid()`;
- revoke `PUBLIC` execution from internal/security-definer functions before granting exact roles.

## 10. Deletion and archival rules

- `competitions`: `RESTRICT` while seasons exist;
- a `tournaments` season row may be hard-deleted only while `status = 'draft'` and no entry, entrant, confirmed result, score event or rank-history row exists;
- once competitive or result history exists, the season can only become `archived`;
- ordinary browser roles receive no season delete grant;
- an internal admin function may delete an empty draft in one controlled transaction.

Reference rows may continue to cascade beneath an empty draft because the root guard proves there is no durable history.

## 11. Migration implementation boundary

Stage C implementation should be one coherent PR and one ordered append-only **development** migration unless local rehearsal proves PostgreSQL lock duration requires a second migration in the same PR.

Required order:

1. commit pre-migration contract tests and preservation oracles;
2. capture row counts, identifiers, score totals and relationship results;
3. create `competitions`, `competitors`, `competition_rounds`, `competition_lock_events` and `competition_awards`;
4. add nullable additive columns to existing tables and backfill them;
5. add composite unique keys and `NOT VALID` foreign keys;
6. validate every constraint and prove cross-season violation queries return zero rows;
7. make required columns non-null;
8. replace functions, triggers, RLS policies, views and application contracts atomically;
9. update generated TypeScript types and fixtures;
10. preserve established physical table/column/RPC names during Stage C;
11. run the full gate set before proposing any hosted application.

No hosted development or production migration is authorised by this design.

## 12. Required evidence

### Static and contract tests committed first

- every season-sensitive table/function/trigger/policy/RPC is in the coverage manifest;
- every multi-parent row has a composite season constraint or named validator;
- no ranking/score query lacks a season and game boundary;
- no round stores an authoritative planned deadline;
- new public tables have RLS and explicit grants;
- internal security-definer functions are not executable by `PUBLIC`;
- the environment/deployment/database privilege contracts landed through PR #235 remain green.

### Disposable Supabase proof

- zero-to-current migration rebuild;
- migration timestamp and canonical applied-state checks;
- database lint and pgTAP;
- the complete `tests/database-parity/` directory;
- generated TypeScript types match the schema;
- hostile cross-season insert/update attempts fail;
- stale/missing fixture data fails locks closed;
- a previously locked scope cannot reopen;
- per-match late prediction insertion fails;
- account deletion anonymises but does not change settled totals/ranks;
- non-empty season deletion fails and empty-draft deletion succeeds only through the internal path.

### Euro preservation oracle (`CS-012`)

Before and after migration, assert equality for:

- the Euro season UUID and all team/group/match UUIDs;
- 51 fixture references and current result lifecycle values;
- entry, prediction, league/member and bonus-game counts;
- score events, totals, rank history and leaderboard order;
- Golden Boot prediction/result/scoring;
- group order, third-place resolution and knockout progression;
- RLS-visible rows for owner, league co-member, unrelated authenticated user and anonymous role;
- Stage B competition-context outputs under deterministic clocks.

## 13. Explicitly deferred

- cross-season club/player provider identity — Stage D;
- ingestion, rescheduling audit and feed correction — Stage D;
- recurring Predictor submission/scoring implementation — Stage E, after the tie-break decision is approved;
- season Last Man Standing and Predictor Cup — Stages F–G;
- cross-competition UI and notification preferences — Stages H–I;
- hosted migration or production promotion — separate explicit owner approval.

## 14. Design exit

The design is ready for approval when the owner confirms §6.1–§6.3 and reviewers agree that:

- additive in-place evolution is safer than a physical rename in Stage C;
- the lock-event record does not violate the derived-deadline rule;
- every current object is represented in the coverage manifest;
- preservation and hostile cross-season tests are specified before SQL;
- no open question permits a parallel tournament/season implementation or weakens an existing safeguard.

Only then should pre-migration tests and the Stage C development migration be created.
