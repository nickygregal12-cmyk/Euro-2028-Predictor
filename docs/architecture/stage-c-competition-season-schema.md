# Stage C — competition-season schema design

**Status:** Owner decisions recorded; ready for design review. No migration or hosted change exists.  
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
- the measured findings and owner decisions recorded in the superseded concurrent proposal PR #242.

No application rows or personal data were read. Only catalogue metadata and function definitions were inspected.

Measured facts that affect the design:

- four current foreign keys cascade directly from `auth.users`: `entries`, `league_members`, `rank_history` and `rate_limit_events`;
- `entries` is itself a cascade parent for predictions, score events and tie-resolution data;
- `profiles.id` and the current competition `user_id` values use the same auth UUID;
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
| `CS-002` | Every season declares `tournament` or `league_season`, one validated IANA competition timezone and bounded dates. |
| `CS-003` | Every season-scoped relationship is proven by a database constraint or named internal validator; separate foreign keys are insufficient. |
| `CS-004` | A fixture, participant, round, prediction, score event, league or bonus-game row cannot cross season boundaries. |
| `CS-005` | Round deadlines are derived from current fixture kickoffs; no round stores an authoritative planned lock timestamp. |
| `CS-006` | A recorded lock transition is monotonic: a locked scope never reopens after rescheduling or stale data. |
| `CS-007` | A per-fixture server guard rejects every prediction submitted at or after that fixture's kickoff. |
| `CS-008` | Entries, standings, score history and game enrolment remain independent per season and game. |
| `CS-009` | Account deletion erases the auth identity while preserving a pseudonymised competitive record, so settled history is not rewritten. |
| `CS-010` | A season with user or settled result data is archived, not hard-deleted. |
| `CS-011` | New public-schema objects are RLS-enabled and receive explicit Data API grants only where browser access is required. |
| `CS-012` | Euro 2028 backfill preserves every identifier, rule, score, result, league, entry and access boundary. |
| `CS-013` | No aggregate score or rank can span seasons or game authorities. |
| `CS-014` | Schema, SQL functions, TypeScript models and generated database types change together and pass the full parity harness. |
| `CS-015` | Season Predictor ties resolve by exact scores, then correct results, then joint rank. |
| `CS-016` | UTC instants decide locks and outcomes; competition timezone decides calendar grouping; viewer timezone decides displayed clock time only. |

## 5. Schema evolution strategy

### 5.1 Generalise the existing root in place

Stage C will **generalise the existing `tournaments` table in place**. It will not create a parallel `competition_seasons` table and will not rename or drop the existing table or established `tournament_id` / `p_tournament_id` database contract in this migration.

This is a deliberate compatibility decision:

- the existing `tournaments.id` already identifies one bounded edition/season;
- current validators, RLS policies, RPCs and application calls already agree on `tournament_id`;
- renaming the physical contract would create a large simultaneous API migration without improving integrity;
- ADR 0011 requires evolution rather than a rewrite.

Within architecture and TypeScript, the row represents a **competition season**. Within the Stage C database contract, `tournaments` and `tournament_id` remain the stable physical names. A future cosmetic rename is outside Stage C and may occur only with a separately reviewed compatibility plan.

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
| `display_timezone text` | validated IANA competition timezone; Euro backfill uses `Europe/London` |
| `status text` | `draft`, `scheduled`, `active`, `complete`, `archived` |

Unique: `(competition_id, season_key)`.

Existing `id`, `name`, `year`, `starts_on`, `ends_on`, `created_at` and compatibility fields remain. `year` is not the new season authority; `season_key` supports seasons spanning two calendar years.

The current stored tournament `lock_at` remains a compatibility field for Euro while Stage C lands. New season/matchweek authority must not read it. Removal or repurposing requires a later separately reviewed compatibility change.

### 5.4 No global club/player master in Stage C

Current `teams` and `players` remain season-scoped records. A durable cross-season club/player identity depends on provider ingestion, transfer handling and source reconciliation, which belong to Stage D.

## 6. Owner decisions — closed 30 July 2026

### 6.1 Season Predictor tie-break — decided

Season standings use:

1. most exact scores;
2. most correct results;
3. joint rank when still level.

This uses only quantities the season game produces and reuses the surviving tournament tie-break criteria. Fewer matchweeks played is rejected because it rewards late entry; head-to-head is not consistently defined for the overall standing.

### 6.2 Account deletion and anonymisation — decided

**Decision:** erase the auth identity while preserving a pseudonymised competitive record.

The durable competitive anchor is the existing `profiles` row rather than a new parallel identity table.

Add or alter the profile contract as follows:

| Column | Rule |
| --- | --- |
| `id uuid` | existing stable competitive/profile identifier; remains unchanged |
| `auth_user_id uuid null` | unique FK to `auth.users(id) ON DELETE SET NULL` |
| `display_name text` | competition-visible name; pseudonymised on account deletion |
| `anonymized_at timestamptz null` | records pseudonymisation time |
| existing preference fields | retained while the account exists; cleared or reset when personal |

Implementation sequence:

1. preserve existing profile ids;
2. backfill `auth_user_id = profiles.id`;
3. replace the current `profiles.id → auth.users` cascade dependency with the nullable auth link;
4. repoint competitive ownership foreign keys from `auth.users(id)` to `profiles(id)` without changing stored UUID values;
5. keep `rate_limit_events` linked to `auth.users` with `ON DELETE CASCADE` because it is disposable housekeeping;
6. update RLS ownership checks to resolve the authenticated profile through `profiles.auth_user_id = auth.uid()`.

On account deletion:

- Supabase Auth credentials, email and auth metadata are erased with the `auth.users` row;
- `profiles.auth_user_id` becomes null;
- `profiles.display_name` becomes a stable non-identifying label, recommended format `Former player ####` derived without exposing the UUID;
- personal preferences or fields that no longer have a user purpose are cleared;
- entries, predictions, score events, rank history, league membership and settled outcomes remain under the profile id;
- league ownership is transferred or the league is archived before deletion;
- `rate_limit_events` is deleted by cascade.

This fixes the current historical-integrity defect without blocking account deletion through `RESTRICT`.

**Implementation dependency:** obtain a data-protection review of the erasure/pseudonymisation boundary before migration. This design is architectural, not legal advice.

### 6.3 Timezone contract — decided

The contract separates three concerns:

| Concern | Authority |
| --- | --- |
| Has kickoff passed? Is a lock effective? | UTC instant comparison; no timezone conversion |
| Which competition day or matchweek contains the fixture? | `tournaments.display_timezone` (`competitionTimeZone`) |
| What kickoff clock time is shown to the viewer? | viewer/device timezone (`viewerTimeZone`) |

Rules:

- every instant remains `timestamptz` and is stored in UTC;
- date-only metadata remains `date`;
- `tournaments.display_timezone` stores one validated IANA competition timezone;
- calendar grouping, matchweek boundaries and deadline communication use `competitionTimeZone`;
- rendered kickoff times use `viewerTimeZone`, preserving correct local display when a user travels;
- route boundaries provide both inputs explicitly where needed;
- device timezone never changes lock state, matchweek assignment, scoring or any authoritative outcome.

The current single `timeZone` input must be split where it conflates calendar grouping and clock rendering. Pure lock and match-state resolvers remain timezone-free.

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

Stage C may add an append-only `competition_lock_events` table which records the fact that a transition occurred, not the planned deadline:

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

### Profiles, entries, leagues, scores and history

- `profiles.id` is the durable competitive identifier and `profiles.auth_user_id` is the nullable auth link;
- `entries`, league ownership/membership, rank history and bonus-game entrant records reference `profiles(id)` rather than `auth.users(id)`;
- entries remain unique per profile/season;
- leagues remain Predictor-only and season-scoped; rerun/copy creates a new target-season league rather than a durable cross-season league object;
- prediction rows joining entries to matches/groups/teams/players gain explicit season keys and composite references;
- tie-resolution arrays remain internally validated because PostgreSQL cannot foreign-key array elements;
- `score_events` and `rank_history` carry explicit season and profile scope;
- no view or RPC aggregates points across seasons or game authorities.

### Awards

Add `competition_awards(tournament_id, award_key, winner_player_id, result_version, confirmed_at)` as an additive general award result model. The current Golden Boot compatibility field remains until a later parity-proven cleanup.

### Bonus games

`bonus_competitions.tournament_id` remains the season root. Composite keys strengthen window, fixture, entrant, team, match and Cup-group relationships. Stage C establishes safe scoping only; ADRs 0013–0014 decide season game rules.

## 9. Declarative constraints, triggers, RLS and grants

Prefer composite foreign keys and unique keys for simple same-season equality. Retain internal triggers for parent-kind checks, conditional references, arrays, current time and lifecycle logic.

The existing same-tournament validators must be generalised, not removed. Coverage includes group/team, match references, predictions, positions, progression, score events, players, awards, result revisions and every bonus-game relationship.

For new or changed public objects:

- enable RLS explicitly;
- grant browser access only where the application requires it;
- grant no direct browser writes where an RPC/trigger authority exists;
- keep internal lock/audit evidence unexposed;
- rewrite ownership policies through `profiles.auth_user_id = auth.uid()`;
- prevent anonymous profiles from authenticating merely because their competitive rows remain;
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
2. obtain the data-protection review required by §6.2 before changing account-deletion behaviour;
3. capture row counts, identifiers, score totals and relationship results;
4. create `competitions`, `competition_rounds`, `competition_lock_events` and `competition_awards`;
5. add nullable additive columns to `tournaments`, `profiles`, matches and season-sensitive children and backfill them;
6. swap competitive ownership foreign keys from `auth.users` to `profiles` without changing UUID values;
7. add composite unique keys and `NOT VALID` foreign keys;
8. validate every constraint and prove cross-season violation queries return zero rows;
9. make required columns non-null;
10. replace functions, triggers, RLS policies, views and application contracts atomically;
11. update generated TypeScript types and fixtures;
12. preserve established physical table/column/RPC names during Stage C;
13. run the full gate set before proposing any hosted application.

No hosted development or production migration is authorised by this design.

## 12. Required evidence

### Static and contract tests committed first

- every season-sensitive table/function/trigger/policy/RPC is in the coverage manifest;
- every multi-parent row has a composite season constraint or named validator;
- no ranking/score query lacks a season and game boundary;
- no round stores an authoritative planned deadline;
- competition and viewer timezone inputs are not conflated in authoritative calendar logic;
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
- account deletion erases auth identity, pseudonymises the profile and does not change settled totals/ranks;
- deleted-account RLS access fails while historical public/bounded views remain arithmetically stable;
- competition calendar grouping remains stable across viewer timezones while displayed kickoff times localise;
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
- Stage B competition-context outputs under deterministic clocks;
- viewer-local kickoff presentation and competition-timezone calendar grouping.

## 13. Explicitly deferred

- cross-season club/player provider identity — Stage D;
- ingestion, rescheduling audit and feed correction — Stage D;
- recurring Predictor submission/scoring implementation — Stage E, using the decided tie-break;
- season Last Man Standing and Predictor Cup — Stages F–G;
- cross-competition UI and notification preferences — Stages H–I;
- legal approval of the pseudonymised-history retention boundary — required before account-deletion migration;
- hosted migration or production promotion — separate explicit owner approval.

## 14. Design exit

The design is ready for approval when reviewers agree that:

- additive in-place evolution is safer than a physical rename in Stage C;
- using `profiles` as the durable competitive anchor preserves history without preventing auth erasure;
- the split competition/viewer timezone contract preserves both authoritative grouping and local display;
- the lock-event record does not violate the derived-deadline rule;
- every current object is represented in the coverage manifest;
- preservation and hostile cross-season tests are specified before SQL;
- no open question permits a parallel tournament/season implementation or weakens an existing safeguard.

Approval of this document authorises pre-migration contract-test work only. It does not authorise a migration or any hosted schema operation.
