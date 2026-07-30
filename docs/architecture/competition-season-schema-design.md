# Stage C — competition-season schema design

**Date:** 30 July 2026
**Status:** **DECIDED BY THE OWNER, 30 July 2026.** Sections 5a, 5b and 5c were open questions; all three are now closed and recorded inline. This document is ready to be promoted to an ADR — see §8 for why that is not done here. One dependency remains before §5b is implemented: a data-protection read on the erasure boundary.
**Baseline:** `main` at [`69f6e36`](https://github.com/nickygregal12-cmyk/Euro-2028-Predictor/commit/69f6e36)
**Stage:** C, authorised because Stage B merged as `2648540` (see [`../quality/current-status.md`](../quality/current-status.md))
**Governing decisions:** ADR 0011–0014. This document implements them; where it appears to differ, the ADR wins.

## 1. Why this exists before any migration

`MASTER-TODO.md` places three decisions under Stage C with the instruction to settle them *before dependent records exist*: season tie-breaks, account deletion and anonymisation effects on historical integrity, and the UTC storage and rendering contract.

That ordering is not bureaucratic. Each of the three is cheap to decide now and expensive to migrate later, because each determines the shape of rows that will exist in the hundreds of thousands. A tie-break rule chosen after standings exist requires recomputing history; a deletion policy chosen after accounts have been deleted cannot recover what cascaded away.

I verified none of the three is settled: no ADR under `docs/adr/` mentions tie-breaks outside the Bonus Games context, anonymisation, or a timezone contract.

## 2. What is already decided — not reopened here

ADR 0011 fixes the platform shape, and this design implements it rather than revisiting it:

- competition shape is **data, not code branches** — a season carries a kind, `tournament` or `league_season`, and one engine resolves both; parallel per-kind implementations are prohibited;
- **lock state is a resolver** over a scope (entry, round, matchweek, match), never a stored boolean;
- **the lock instant is derived, never stored** — the effective round lock is the earliest kickoff among fixtures currently in that round, recomputed on ingestion, because broadcast rescheduling is routine;
- **a per-match guard sits underneath the round lock** as the integrity floor;
- **locks are monotonic and fail closed** — a locked round never reopens, and stale or invalid fixture data resolves to locked;
- **`SAFE-008` broadens** from same-tournament to same-competition-season, preserved in strength;
- **entry stays opt-in per competition instance**; preference is a display filter, never enrolment;
- **Euro 2028 becomes a configuration** — a season of kind `tournament` with a single lock scope, rules unchanged.

ADR 0012 fixes season Predictor rules: weekly scorelines only, cumulative; exact 5 / result 3 unchanged; eight jokers per season applied per *matchweek*, four and four across the halves; rolling entry; cumulative total as the only ranking that decides the season, with matches played displayed alongside; and postponed / abandoned / void as three distinct states never collapsed into one flag.

**ADR 0012 does not settle how a tie on cumulative total is broken.** That is §5a.

## 3. Current schema baseline — measured, not assumed

Eleven tables carry `tournament_id`: `tournaments`, `teams`, `groups`, `matches`, `entries`, `profiles`, `bonus_competitions`, `match_result_revisions`, `entry_automatic_submission_outcomes`, `actual_third_place_resolutions`, `actual_third_place_resolution_revisions`.

`tournaments` is already close to a season row:

```sql
create table tournaments (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  year smallint not null,
  starts_on date,
  ends_on date,
  created_at timestamptz not null default now()
);  -- lock_at added by a later migration
```

`SAFE-008` is enforced by trigger-raised assertions, nine of them across six relationship groups in `20260725010000_authoritative_reference_integrity.sql` — for example *"Match group must belong to the match tournament"* and *"Score event match must belong to the entry tournament"*. These are the assertions that must broaden without weakening.

## 4. Schema shape

**Generalise `tournaments` in place rather than introduce a parallel `competition_seasons` table.** Eleven tables and nine trigger assertions already key on `tournament_id`; a second scoping column would mean every safeguard must decide which one governs, and that ambiguity is precisely how a same-scope guard gets weakened by accident.

Additive changes, all append-only:

| Change | Purpose |
| --- | --- |
| `tournaments.kind` — enum `tournament \| league_season`, default `tournament`, not null | ADR 0011's data-not-branches decision. The default makes Euro 2028 a configuration with no backfill. |
| `tournaments.competition_id` → new `competitions` table | Separates the *competition* (Premier League) from the *season* (2027/28). Honours and history hang off the competition; standings off the season. |
| New `rounds` table — `(id, tournament_id, ordinal, label, kind)` | The lock scope for `league_season`. A `tournament` season has one row; a league season has one per matchweek. Generalises the existing `matchday`/`round` columns on `matches` without dropping them. |
| `matches.round_id` — nullable FK, added alongside the existing `round`/`matchday` columns | Lets ingestion reassign a fixture to a different round when it is rescheduled, which ADR 0011 requires. Nullable so the Euro configuration is untouched. |
| `matches.status` — enum covering `scheduled \| postponed \| abandoned \| void` plus existing states | ADR 0012's three distinct reschedule states, never collapsed. `void` must also remove the fixture from the matches-played denominator. |
| Rename nothing; drop nothing | The migration-control regime is append-only, and the tagged Euro baseline must stay recoverable. |

**No stored lock instant.** `rounds` deliberately has no `lock_at`. Per ADR 0011 the effective lock is the earliest kickoff among the fixtures currently assigned to the round, resolved by `src/domain/competition/lockState.ts`, which already exists on `main`.

## 5. The three decisions — all closed 30 July 2026

### 5a. Season tie-breaks — **DECIDED**

> **Owner decision, 30 July 2026: exact scores → correct results → joint.** Option 1 below, as recommended.

ADR 0012 makes cumulative total the only ranking that decides the season, and requires matches played to be displayed alongside it. It does not say what happens when two players finish level.

The tournament game has a five-step order in `docs/scoring-rules.md` §5, but it is **tournament-shaped**: most exact scores, most correct outcomes, most correct knockout teams, correct champion, closest total goals. Three of those five have no season equivalent — there are no knockout teams, no champion prediction and no total-goals prediction in the season Predictor per ADR 0012's "no pre-season predictions".

Options:

1. **Exact scores, then correct results, then joint.** Uses only quantities the season game actually produces, and mirrors the surviving two steps of the tournament order.
2. **Fewer matchweeks played wins** — rewards efficiency. Rejected in this proposal: it inverts ADR 0012's rolling-entry fairness, rewarding late entry, which ADR 0013 exists to prevent elsewhere.
3. **Head-to-head across the season, then exact scores.** Defensible in a private league but undefined in the overall standing where two players may share no comparison basis.
4. **Declare ties joint with no tie-break.** Honest and cheap, but produces joint firsts in a season-long competition where a winner is expected.

**Chosen: option 1, with explicit joint rank when still level.** It reuses `docs/scoring-rules.md` §5's surviving criteria, needs no new stored data, and is computable from `score_events` as they already exist. Season standings may therefore compute `rank` from stored totals plus those two counts, with no stored ordering.

### 5b. Account deletion and anonymisation — **DECIDED**

> **Owner decision, 30 July 2026: anonymise the competition record, erase the identity record.** Implemented by decoupling competition data from `auth.users`, per the revised recommendation below. Blocked on one dependency: a data-protection read on the erasure boundary.
>
> **Retraction.** An earlier draft of this document recommended changing the competition foreign keys from `on delete cascade` to `on delete restrict`. That was wrong and is withdrawn: `restrict` would *prevent* account deletion outright while a player held entries, which collides with a right-to-erasure request. Decoupling achieves the preservation goal without foreclosing erasure.

This is the decision with a live defect behind it, and it already affects Euro 2028.

**Measured on `main`:** four tables declare `user_id … references auth.users (id) on delete cascade` — `entries`, `league_members`, `rank_history` and `rate_limit_events`. No anonymisation or soft-delete mechanism exists anywhere in the migrations.

Only three of those four are competition data. `rate_limit_events` is housekeeping with no historical value and **should keep cascading**; a recommendation to change all four indiscriminately would be wrong.

The reach is wider than the four, because `entries` is itself a cascade parent: `match_predictions`, `score_events` and the predicted tie-resolution tables all declare `entry_id … references entries (id) on delete cascade`. So deleting one `auth.users` row removes that player's entries, every prediction, every score event and every rank-history snapshot. Two consequences follow, and neither is recoverable:

- the player's own historical standings vanish, so a completed competition's final table silently changes after the fact;
- **other players' historical ranks become wrong.** A snapshot recording "3rd of 20" survives while the cohort it was computed against shrinks, so preserved rows now disagree with a recomputation.

ADR 0015 covers the commercial and social model and ADR 0011 requires preserving independent entries, standings, honours and historical seasons — which the current cascade does not do.

Options:

1. **Decouple competition history from `auth.users`, then anonymise.** Chosen — detailed below.
2. **Cascade as today.** Simplest, and wrong: it rewrites completed competitions.
3. **Tombstone the user and cascade only unsubmitted work.** Middle ground; needs a rule for a partially-played season and adds a state to every read.

#### The chosen design

Two facts make this cheap. `profiles.id` is already the auth user id, and every competition `user_id` already holds that same value — so repointing is a constraint change with **no data movement**. And the actual personal data (email, password hash, auth metadata) lives in `auth.users`, which Supabase manages; `profiles` holds only `display_name`.

1. **Make `profiles` the durable player anchor.** Keep `profiles.id` as the stable player identifier, drop its `on delete cascade` to `auth.users`, and add a nullable `auth_user_id uuid references auth.users (id) on delete set null` alongside.
2. **Repoint the competition foreign keys from `auth.users (id)` to `profiles (id)`** — `entries`, `league_members`, `rank_history`, and transitively everything cascading from `entries` (`match_predictions`, `score_events`, the predicted tie-resolution tables). Identical values, so a constraint swap.
3. **Leave `rate_limit_events` cascading from `auth.users`.** Housekeeping with no historical value; it *should* disappear.
4. **Deletion becomes:** delete the `auth.users` row — genuinely erasing credentials and email — set `profiles.display_name` to a stable pseudonym derived deterministically from the profile id (for example `Former player 4821`, so historical standings stay legible across recomputations), and null `auth_user_id`.

The result is the legally coherent split: **erasure of the identity record, pseudonymisation of the competition record.** A completed season's table never silently changes, and preserved ranks keep agreeing with a recomputation.

> **Remaining dependency:** a data-protection read on that boundary before implementation. The reasoning here is architectural, not legal advice. What matters is that this design makes the conversation possible, where `restrict` would have foreclosed it.

### 5c. UTC storage and rendering contract — **DECIDED**

> **Owner decision, 30 July 2026: split the two concerns.** Calendar grouping uses the competition's timezone; the clock shown to a viewer uses their own device timezone. Both were previously served by a single input, which is the substance of this decision.

#### The distinction that matters

The owner asked the right question: if you go on holiday, shouldn't the app show the correct local time? **Yes — and it already does.** `useTournamentEntryLocked.ts` and `MatchesPage.tsx` both feed in `Intl.DateTimeFormat().resolvedOptions().timeZone`. That behaviour is correct and is kept.

What must *not* depend on the device is calendar grouping. Verified on `main`:

| Concern | Timezone | Evidence |
| --- | --- | --- |
| Is a round locked? Has kickoff passed? | **None** — UTC instant comparison | `lockState.ts` and `matchState.ts` contain no timezone reference at all |
| Which matchweek, or which day, does a fixture belong to? | **Competition** (season row) | `context.ts` uses the timezone only in `dateKey` → `today`, to decide which fixtures are "today" |
| "Kicks off 16:30" | **Viewer's device** | already the behaviour; travelling shows local time |

So locks are already timezone-independent and need no change. The defect is narrower and specific: **the single `timeZone` input conflates grouping with rendering.** With a UK-centric audience and one tournament that is harmless. For a league season it breaks — a Sunday 16:30 London kickoff is Monday 01:30 in Sydney, so a Sydney viewer would group it under the wrong day, and once matchweeks exist, potentially the wrong matchweek.

#### The contract

- **store** every instant as `timestamptz`, always UTC — already true, 113 such columns and zero naked `timestamp`; date-only competition metadata stays `date`;
- **derive, never store** the round lock instant, per ADR 0011;
- **add** `tournaments.display_timezone` — an IANA identifier, validated against a real zone, one per competition season. Season-level rather than on the `competitions` parent because the season is the scoping unit every other decision here uses, and a parent-plus-override needs a resolution rule for no real benefit. In practice it will be constant per competition. Euro 2028 configures as `Europe/London`; the UK and Ireland host nations share offsets, so there is no split-boundary problem;
- **split** the current single `timeZone` input into a `competitionTimeZone` (grouping, matchweek and day boundaries) and a `viewerTimeZone` (rendered clock times), resolved at the route boundary and passed into the domain as inputs — the same pattern Stage B established for the clock, so no new architectural concept;
- **never** let device timezone decide a lock, a matchweek boundary or a scoring outcome. Presentation only.

Rejected: per-viewer matchweek boundaries. "Which matchweek is this fixture in?" would become viewer-dependent, and standings cannot tolerate that question having two answers.

## 6. Broadening SAFE-008 without weakening it

The nine assertions currently say "… must belong to the same tournament". Under the generalisation in §4 the column keeps its name, so the assertions keep working unchanged — which is the main argument for generalising in place.

What must be *added* rather than changed:

- `matches.round_id` must belong to the same season as `matches.tournament_id`;
- a round's fixtures must all belong to that round's season;
- prediction rows must reference a match in the same season as the entry's season — the existing score-event assertion already has this shape and should be mirrored for round-scoped predictions;
- cross-season adversarial tests, per MASTER-TODO's "extend applied-state, RLS and adversarial cross-season tests in the same change" — the pgTAP suite is the right home, alongside `080_function_privileges.sql`'s existing exhaustive style.

No existing assertion may be relaxed to accommodate a nullable `round_id`. Where the column is null, the assertion should pass trivially rather than be skipped by a broader predicate.

## 7. Verification this design commits Stage C to

Stage C implementation must produce, in the same change:

- canonical applied-state evidence and a migration-count/contract update — `config/deployment-contract.json` is now enforced, so a new RPC must be declared or the build fails;
- disposable Supabase rebuild from committed migrations, database lint and pgTAP;
- TypeScript/PostgreSQL parity for any value duplicated across the boundary — the `tests/database-parity/` suite now runs wholesale, so a new subject is picked up without a workflow change;
- adversarial cross-season RLS tests;
- relationship-safeguard and preservation evidence.

**This environment cannot produce that evidence.** Container image pulls fail with 403 at the blob store on both Docker Hub and `ghcr.io`, so the disposable Supabase rebuild, database lint, pgTAP and parity gates cannot run locally. Stage C implementation needs either an environment that can pull those images or a reviewer running the gates in CI. That is a stated constraint, not a reason to author an unverified migration.

## 8. Out of scope

- Season scoring rule changes — ADR 0012 owns them.
- Last Man Standing and Predictor Cup season formats — ADRs 0013 and 0014.
- Fixture and result ingestion, including provider choice and evidence.
- Any hosted schema mutation, which requires the applicable approval and preflight process.
- Converting this document into an ADR. That needs an entry in [`../adr/README.md`](../adr/README.md), which is currently in PR #207's diff, so the index edit should wait until #207 lands.

## 9. Concurrency

This file is new and touched by no open pull request. Checked against every open branch at the time of writing: #207 (`claude/documentation-audit-b2h2ch`) touches `docs/adr/README.md`, `docs/adr/0010-bonus-games-platform.md` and `docs/architecture/acquisition-target-architecture.md`; #194, #206 and #211 touch no `docs/adr/` or `docs/architecture/` file. Nothing here edits any of those paths.
