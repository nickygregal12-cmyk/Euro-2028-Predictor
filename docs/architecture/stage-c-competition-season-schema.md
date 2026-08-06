# Stage C — competition-season schema design

**Status:** Approved design baseline. No migration or hosted change exists.  
**Status date:** 30 July 2026  
**Baseline:** `main` at `1c1aa639009c09357e9ec4c8f5b9f6922e0f8ad2`  
**Decision authority:** [ADR 0011](../adr/0011-multi-competition-platform.md), [ADR 0012](../adr/0012-season-predictor-rules.md) and [ADR 0015](../adr/0015-commercial-and-social-model.md)  
**Engineering sequence:** [`multi-competition-hub-build-plan.md`](multi-competition-hub-build-plan.md) §7  
**Implementation truth:** [`../quality/current-status.md`](../quality/current-status.md)

## 1. Purpose and boundary

Stage C introduces one database model for bounded tournaments and rolling domestic league seasons without creating parallel tournament and season implementations.

This document is design-only. It does **not**:

- create a migration;
- change application code or RPC contracts;
- alter development or production Supabase;
- change Euro 2028 scoring, locks, results, access or presentation;
- implement ingestion, season Predictor, Last Man Standing or Predictor Cup;
- introduce a materialised standings table for ACQ-R02.

Those behaviours remain owned by later stages and ADRs 0012–0014. The companion [`stage-c-schema-coverage.md`](stage-c-schema-coverage.md) is the exhaustive implementation manifest.

Approval of this document authorises pre-migration contract-test planning only. It does not authorise SQL or a hosted schema operation.

## 2. Evidence reviewed

The design is grounded in:

- current `main` through merged PR #230 and the control sequence through PR #266;
- read-only introspection of development project `iouzoutneyjpugbbtdem` on Postgres 17;
- 34 RLS-enabled public tables plus the `entry_totals` view;
- the current foreign-key, unique/check, trigger, RLS-policy, grant and public/internal-function graph;
- the existing `predictor_internal` same-tournament validators;
- Stage B's shared competition-context and lock-state authority;
- the owner decisions recorded during the superseded concurrent proposal in PR #242;
- PR #245's timezone-authority characterisation;
- PR #246's effective account-deletion action characterisation;
- PR #250's public-table RLS and security-definer `search_path` guard;
- PR #252's landed competition/viewer timezone seam;
- PRs #255, #258 and #261's exhaustive committed TypeScript/TSX compiler-project coverage;
- PR #264's typechecking of the three JavaScript deploy gates and explicit deferred JavaScript inventory;
- PR #265's public-view and direct browser relation-grant guard;
- PR #266's disposable-local ACQ-R02 scale evidence.

No application rows or personal data were read. Only catalogue metadata and function definitions were inspected.

### 2.1 Timezone before-state and landed seam

The combined PR #245, PR #252 and PR #255 coverage proves:

- `lockState.ts` and `matchState.ts` compare UTC instants and do not read a timezone;
- surface adapters distinguish `competitionTimeZone` from `viewerTimeZone`;
- domain context receives the competition timezone rather than discovering it;
- adapters currently fall back to viewer timezone when competition timezone is absent, so viewers can disagree about which fixtures are “today”;
- supplying a competition timezone overrides viewer location and makes viewers agree;
- an invalid timezone currently fails quietly to empty day buckets and `no_matches_today`;
- lock equality is tested through real `lockScopes`, not removed `activeLock` properties;
- fixtures construct the real config field `competitionTimeZone`.

The timezone-free lock behaviour and landed seam are invariants. Viewer fallback for authoritative grouping and fail-quiet invalid-zone behaviour are Stage C defects.

### 2.2 Account-deletion before-state

PR #246 resolves the effective, last-declaration-wins actions of every `auth.users` reference:

- `CASCADE`: `profiles.id`, `entries.user_id`, `league_members.user_id`, `rank_history.user_id`, `rate_limit_events.user_id`, `bonus_competition_entrants.user_id`, `bonus_knockout_predictions.user_id`;
- `RESTRICT`: `leagues.owner_id`, with a transfer-first rule;
- `SET NULL`: `match_result_revisions.actor_id`, `actual_third_place_resolutions.updated_by`, `actual_third_place_resolution_revisions.actor_id`, `bonus_competition_audit.actor_id`;
- implicit `NO ACTION`: `bonus_cup_fixtures.winner_user_id`;
- at least seven competitive tables cascade from `entries(id)`;
- no current table references `profiles`;
- `profiles.id` already equals the stored auth UUID, so ownership can be repointed without remapping row identities.

This remains the before-side of the approved pseudonymised-history design. The test must be updated, not removed, when Stage C changes the actions.

### 2.3 Security and compiler invariants already true

PR #250 proves in ordinary CI:

- all 34 current `public` tables have RLS enabled;
- all 110 current security-definer functions pin `search_path`;
- effective definitions are parsed comment-safe, schema-aware and last-definition-wins.

PR #265 proves:

- the public view set is explicitly reviewed;
- every view is revoked from both `anon` and `authenticated` unless deliberately exposed;
- the `entry_totals` revoke and rationale remain intact;
- direct browser relation grants are explicitly allowlisted;
- `anon` has no direct relation grant.

PRs #255, #258 and #261 make `tsc -b` cover every committed `.ts`/`.tsx` file and fail if a future file falls outside the referenced project graph. Strictness is stated explicitly. PR #264 additionally checks the three JavaScript files that decide whether a build can reach production; the remaining JavaScript backlog is measured and explicit rather than falsely described as checked.

These are preservation gates, not Stage C gaps.

### 2.4 ACQ-R02 performance evidence

PR #266 confirms that `get_overall_leaderboard` aggregates the full submitted field before pagination and scales primarily with `score_events` volume.

The disposable-local synthetic evidence measured about 35 ms per page at the enforced 250-entry case with 15,000 events, and about 652 ms mean per page at 5,000 entries with 300,000 events. Hosted concurrency remains untested.

This does not justify a materialised standings table inside Stage C. ACQ-R02 remains open and must be reviewed before a material cap increase or if rehearsal/hosted evidence becomes adverse.

## 3. Adopted constraints

ADR 0011 already decides:

- competition shape is data, not code branches;
- the same context and lock engines serve tournaments and league seasons;
- round/matchweek deadlines derive from current fixture kickoffs, not stored planned timestamps;
- a per-match server guard rejects predictions at or after kickoff;
- locks are monotonic and fail closed;
- same-tournament safeguards widen to same-competition-season without weakening;
- Euro 2028 remains behaviourally unchanged as one `tournament` configuration;
- scores and ranks never aggregate across competitions, seasons or games.

## 4. Stable safeguards

These identifiers are permanent references for migration comments, pgTAP and application contract tests.

| ID | Safeguard |
| --- | --- |
| `CS-001` | One stable competition identity owns one or more separately identified seasons/editions. |
| `CS-002` | Every season declares `tournament` or `league_season`, one validated IANA competition timezone and bounded dates. |
| `CS-003` | Every season-scoped relationship is proven by a database constraint or named validator; separate foreign keys are insufficient. |
| `CS-004` | A fixture, participant, round, prediction, score event, league or bonus-game row cannot cross season boundaries. |
| `CS-005` | Round deadlines derive from current fixture kickoffs; no round stores an authoritative planned lock timestamp. |
| `CS-006` | A locked scope never reopens after rescheduling or stale data. |
| `CS-007` | A per-fixture server guard rejects every prediction submitted at or after kickoff. |
| `CS-008` | Entries, standings, score history and game enrolment remain independent per season and game. |
| `CS-009` | Account deletion erases auth identity while preserving a pseudonymised competitive record. **Scoped 6 August 2026 to ordinary Close Account (`PRIV-003`); formal erasure (`PRIV-005`) is a separate journey — see § 6.2.** |
| `CS-010` | A season with user or settled result data is archived, not hard-deleted. |
| `CS-011` | Every public table has RLS, browser relation/view grants are explicit, and every security-definer function pins `search_path`. |
| `CS-012` | Euro 2028 backfill preserves every identifier, rule, score, result, league, entry and access boundary. |
| `CS-013` | No aggregate score or rank spans seasons or game authorities. |
| `CS-014` | Schema, SQL functions, TypeScript models and generated database types change together and pass parity. |
| `CS-015` | Season Predictor ties resolve by exact scores, then correct results, then joint rank. |
| `CS-016` | UTC instants decide locks/outcomes; competition timezone decides grouping; viewer timezone decides displayed clock time. |
| `CS-017` | Invalid/unavailable competition timezone is rejected or explicitly unavailable; it never silently becomes an empty competition day. |
| `CS-018` | Every `auth.users` foreign key has an explicit reviewed action; competitive history is profile-owned. |
| `CS-019` | Every committed TypeScript/TSX source and every production-decision JavaScript gate remains inside an enforced compiler project; passing runtime tests alone is insufficient. |

## 5. Schema evolution strategy

### 5.1 Generalise the existing root in place

Stage C generalises `tournaments` in place. It does not create `competition_seasons`, rename `tournaments`, or replace established `tournament_id` / `p_tournament_id` contracts.

Reasons:

- `tournaments.id` already identifies one bounded edition/season;
- validators, RLS, RPCs and callers already agree on `tournament_id`;
- a physical rename would create a large simultaneous API migration without improving integrity;
- ADR 0011 requires evolution rather than a rewrite.

Architecture and TypeScript may call the row a competition season. The physical names remain a deliberate Stage C compatibility contract.

### 5.2 `competitions` parent

| Column | Rule |
| --- | --- |
| `id uuid` | primary key |
| `slug text` | immutable globally unique key |
| `name text` | human-readable name |
| `sport text` | initially constrained to `football` |
| `created_at timestamptz` | default `now()` |

Deletion is `RESTRICT` while any season exists.

### 5.3 Additive season fields on `tournaments`

| Column | Rule |
| --- | --- |
| `competition_id uuid` | FK to `competitions`, `ON DELETE RESTRICT` |
| `season_key text` | stable key such as `2028` or `2027-28` |
| `kind text` | `tournament` or `league_season`, default `tournament` |
| `display_timezone text` | validated IANA competition timezone; Euro uses `Europe/London` |
| `status text` | `draft`, `scheduled`, `active`, `complete`, `archived` |

Unique: `(competition_id, season_key)`.

Existing identity/date/compatibility fields remain. `year` is not the new season authority. Existing `lock_at` remains Euro compatibility only; new matchweek authority must not read it.

### 5.4 No global team/player master in Stage C

Current teams and players remain season-scoped. Cross-season provider identity and transfer reconciliation belong to Stage D.

## 6. Owner decisions — closed 30 July 2026

### 6.1 Season Predictor tie-break

1. most exact scores;
2. most correct results;
3. joint rank when still level.

Fewer matchweeks played is rejected because it rewards late entry. Head-to-head is not consistently defined for the overall standing.

### 6.2 Account deletion and anonymisation

**Decision:** erase the auth identity while preserving a pseudonymised competitive record.

> **Amended 6 August 2026 — this section describes one journey; there are two.**
>
> The owner approved a split model, recorded in [`stage-c1-c2-governance.md`](stage-c1-c2-governance.md) § Approved product direction. The shape below is the **ordinary Close Account** path (`PRIV-003`) and remains the design for it. A **formal erasure request** (`PRIV-005`) is a separate data-rights workflow that may delete granular competitive history and recompute standings — precisely what this section's "preserving a pseudonymised competitive record" does not do. A product that offers only the path below, while describing it as erasure, is the specific error the split exists to prevent.
>
> Two constraints this table does not yet carry:
>
> - **`PRIV-004` — the pseudonymised `display_name` must not become a permanent public identifier spanning competitions.** A stable label beside the same person's rows in every competition re-identifies by correlation. A generic or competition-specific placeholder is required; `anonymized_at` is unaffected.
> - **`PRIV-006` — settled Cup and Last Man Standing outcomes are preserved deterministically.** Removal must not resurrect an eliminated entrant or alter a settled winner, and neutral settled-outcome placeholders are the mechanism rather than retaining the former player's identity.
>
> **The block is unchanged:** none of this may be implemented in a hosted environment until `PRIV-007` — qualified independent UK data-protection review, and the LIA, DPIA, retention, privacy and process work it requires — is complete. Issue [#272](https://github.com/nickygregal12-cmyk/Euro-2028-Predictor/issues/272) stays open, no legal approval is claimed, and this remains a design document that authorises no migration.

The durable competitive anchor is the existing `profiles` row.

| Column | Rule |
| --- | --- |
| `id uuid` | existing stable profile/competitive identifier |
| `auth_user_id uuid null` | unique FK to `auth.users(id) ON DELETE SET NULL` |
| `display_name text` | pseudonymised on account deletion |
| `anonymized_at timestamptz null` | pseudonymisation timestamp |
| existing preference fields | clear/reset when personal and no longer needed |

Implementation sequence:

1. preserve existing profile ids;
2. add and backfill `profiles.auth_user_id = profiles.id`;
3. replace the `profiles.id → auth.users` cascade with the nullable auth link;
4. repoint competitive ownership to `profiles(id)` without changing stored UUIDs;
5. preserve transfer-first league ownership;
6. replace Predictor Cup's implicit winner action with an explicit profile-owned action;
7. keep `rate_limit_events → auth.users ON DELETE CASCADE`;
8. retain explicit `SET NULL` audit actors unless separately changed;
9. resolve RLS ownership through `profiles.auth_user_id = auth.uid()`.

On deletion, credentials/email/auth metadata are erased; the profile is unlinked and pseudonymised; settled entries, predictions, scores, ranks, membership and outcomes remain. League ownership is transferred or archived first.

**Implementation dependency:** obtain a data-protection review of the erasure/pseudonymisation boundary. This is architecture, not legal advice.

### 6.3 Timezone contract

| Concern | Authority |
| --- | --- |
| Lock/kickoff/result state | UTC instant comparison |
| Competition day or matchweek | `tournaments.display_timezone` / `competitionTimeZone` |
| Displayed kickoff clock | viewer/device `viewerTimeZone` |

Rules:

- instants remain `timestamptz`; date-only metadata remains `date`;
- `display_timezone` is a validated IANA zone;
- PR #252 adapters receive the persisted competition value explicitly;
- device timezone never changes lock, matchweek assignment, scoring or eligibility;
- invalid zones are rejected; unavailable values fail closed or produce an explicit unavailable state, never `no_matches_today`.

Stage C removes authoritative viewer fallback while preserving viewer-local presentation.

## 7. Rounds, fixtures and lock evidence

### 7.1 `competition_rounds`

| Column | Rule |
| --- | --- |
| `id uuid` | primary key |
| `tournament_id uuid` | season FK |
| `round_key text` | stable key such as `MD1`, `R16`, `MW01` |
| `ordinal integer` | positive order |
| `kind text` | `group_matchday`, `knockout_round`, `league_matchweek` |
| `label text` | display label |
| `created_at timestamptz` | default `now()` |

Unique: `(tournament_id, round_key)` and `(tournament_id, ordinal)`. There is no `lock_at` column.

### 7.2 Monotonic lock-transition evidence

An append-only `competition_lock_events` table may record an observed irreversible transition, not a planned deadline:

| Column | Rule |
| --- | --- |
| `id uuid` | primary key |
| `tournament_id uuid` | season scope |
| `scope_type text` | `entry`, `round`, `match` |
| `scope_key text` | stable key |
| `locked_at timestamptz` | observed transition |
| `fixture_basis_hash text` | fixture-set evidence |
| `created_at timestamptz` | default `now()` |

Unique: `(tournament_id, scope_type, scope_key)`. Event existence is an input to monotonic resolution, not a stored effective deadline or surface-owned boolean.

### 7.3 Matches

- add, backfill and validate `matches.round_id`, then make it non-null;
- add fixture administration states including `scheduled`, `postponed`, `abandoned`, `void`, `cancelled`;
- preserve the existing official result lifecycle;
- validate tournament-only group/bracket fields against `kind = 'tournament'`;
- require league-season fixtures to reference a `league_matchweek` round.

## 8. Season-scoped relationships

Every directly scoped parent gains a unique `(tournament_id, id)` key where needed. Children use composite FKs for simple same-season equality; triggers remain for arrays, conditional shape, parent kind, time and lifecycle logic.

Core rules:

- teams remain season participants;
- groups remain tournament-only;
- players use same-season team references;
- profiles own competitive identity;
- entries remain unique per profile/season;
- leagues remain Predictor-only and season-scoped;
- predictions, scores and rank history carry explicit season/profile scope;
- no view or RPC aggregates across seasons or game authorities;
- `competition_awards` provides additive general award results;
- Bonus Games retain independent season/game boundaries.

The exhaustive table/function/trigger/RPC disposition is in the coverage manifest.

## 9. RLS, grants, views and function security

For every new or changed public object:

- enable RLS on tables;
- explicitly review every view and revoke it from browser roles unless deliberately exposed;
- grant browser access only where required and keep direct relation grants in the reviewed allowlist;
- keep authoritative writes behind RPC/trigger paths;
- expose no internal lock/audit authority;
- resolve ownership through `profiles.auth_user_id = auth.uid()`;
- prove null-auth profiles cannot regain owner access;
- revoke `PUBLIC` execute before exact function grants;
- pin `search_path` on every security-definer function;
- keep PR #250 and PR #265 exhaustive guards green;
- keep every `auth.users` FK in the deletion-action allowlist.

The `entry_totals` view remains unavailable to `anon` and `authenticated`; bounded leaderboard RPCs remain the browser path.

## 10. Deletion and archival

- `competitions`: `RESTRICT` while seasons exist;
- a season may be hard-deleted only while draft and empty of competitive/result history;
- otherwise it may only be archived;
- browser roles receive no season delete grant;
- one internal transaction may delete an empty draft.

## 11. Migration implementation boundary

Stage C should be one coherent PR and one append-only **development** migration unless rehearsal proves lock duration requires a second migration in the same PR.

Required order:

1. commit pre-migration tests/oracles inside the landed compiler-project graph;
2. retain PR #245 and PR #246 as before-state contracts;
3. preserve PRs #250, #261, #264 and #265 as security/compiler invariants;
4. capture row counts, ids, totals, ranks and relationships;
5. create new parent/round/lock-event/award relations;
6. add nullable fields and backfill;
7. add composite unique keys and `NOT VALID` FKs;
8. validate constraints and prove zero cross-season violations;
9. make required columns non-null;
10. replace functions, triggers, policies, views and application contracts atomically;
11. update generated types and fixtures;
12. update timezone/deletion tests to the approved after-state;
13. wire persisted competition timezone through PR #252's seam;
14. preserve physical compatibility names;
15. run the full gate set before proposing any hosted application.

No hosted development or production migration is authorised by this design.

## 12. Required evidence

### Static and contract gates

- complete manifest coverage;
- composite scope protection or named validator for every multi-parent row;
- no cross-season/game ranking query;
- no stored round deadline;
- RLS, view, direct-grant and `search_path` guards remain green;
- deployment/privilege and deploy-gate compiler contracts remain green;
- corrected timezone tests prove real `lockScopes`, persisted competition grouping and fail-closed invalid zones;
- deletion tests enumerate the approved after-state;
- PR #252 seam no longer uses viewer fallback for authoritative grouping;
- all committed `.ts`/`.tsx` files and the three JavaScript deploy gates remain covered by their referenced projects.

### Disposable Supabase proof

- zero-to-current rebuild;
- canonical applied-state, migration timestamp, lint and pgTAP;
- complete Database parity;
- generated types match schema;
- hostile cross-season writes fail;
- stale/missing fixtures fail locks closed;
- locked scopes never reopen;
- late predictions fail;
- invalid timezone inserts fail;
- viewers share competition grouping;
- account deletion preserves totals, ranks, membership and outcomes;
- every auth FK has the approved action;
- non-empty season deletion fails.

### Euro preservation oracle (`CS-012`)

Before/after equality for:

- Euro season/team/group/match UUIDs;
- 51 fixtures and current result lifecycle;
- entry, prediction, league/member and Bonus Games counts;
- score events, totals, rank history and leaderboard order;
- Golden Boot, group order, third-place resolution and knockout progression;
- RLS-visible rows by role;
- Stage B context outputs, except the deliberate competition/viewer timezone split.

## 13. Explicitly deferred

- cross-season provider identity and ingestion — Stage D;
- recurring Predictor — Stage E;
- season Last Man Standing and Predictor Cup — Stages F–G;
- hub/notifications — Stages H–I;
- ACQ-R02 materialised standings mitigation — only after cap/rehearsal/hosted-concurrency evidence justifies it;
- hosted migration or production promotion — separate explicit approval.

## 14. Design exit

The design is approved because:

- additive in-place evolution is safer than a physical rename;
- lock events do not violate derived-deadline authority;
- every current object is represented in the manifest;
- profile-owned deletion covers PR #246's full action matrix;
- persisted timezone wiring covers PR #245/#252 failure paths;
- PR #250 and PR #265 security controls and PR #261/#264 compiler controls are mandatory migration gates;
- preservation and hostile cross-season tests precede SQL;
- no parallel implementation or weakened safeguard remains;
- ACQ-R02 remains a separately governed performance risk rather than an unapproved Stage C schema addition.

Approval authorises pre-migration test planning only. It does not authorise a migration or hosted schema operation.