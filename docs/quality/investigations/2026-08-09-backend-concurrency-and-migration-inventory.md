# Backend concurrency and remaining migration inventory — 9 August 2026

| Field | Value |
| --- | --- |
| Status | Dated evidence and recommendation at the commit it was written against |
| Purpose | Identify backend work that can proceed alongside the active frontend programme, and inventory the migrations still required for a fully functioning site — live score feeds, results-to-points automation, club badges and the rest of the cacheable provider data |
| Measured against | `main` at `7afa332`, repository contract **134**, hosted development **133**, production **132** |
| Authorities that outrank this | [`../current-status.md`](../current-status.md), [`../../roadmap.md`](../../roadmap.md), [`../accepted-requirements.md`](../accepted-requirements.md), [`../../adr/README.md`](../../adr/README.md), [`../../architecture/provider-enrichment-plan.md`](../../architecture/provider-enrichment-plan.md) |
| Does not authorise | Any migration, contract number, hosted write, provider spend, rule change or production movement |

Every contract number below is a **proposed slot, not a claim**. Contract 135 is
currently reserved by open PR [#602](https://github.com/nickygregal12-cmyk/Euro-2028-Predictor/pull/602);
the first number free on `main` today is 136, and it must be re-checked against
open pull requests immediately before any branch takes it.

---

## Executive finding

**The football data is already arriving and is already being retained. Nothing
consumes it.**

`pg_cron` dispatches `provider-poll` every five minutes. The Edge Function
archives the verbatim provider response, decodes it with the committed decoders
— which already extract per-fixture `status`, `homeScore` and `awayScore` for
all three providers — and writes the decoded array to
`predictor_internal.provider_response_processing.normalized_payload`.

Then the pipeline stops. Measured rather than assumed:

- `predictor_internal.import_provider_fixture_revisions` (contract 117, redefined
  by contract 123) has **no caller** anywhere in `supabase/`, `src/` or the Edge
  Function;
- `predictor_internal.stage_provider_fixture_proposals` (contract 132) has **no
  caller** either;
- nothing reads `normalized_payload` except that uncalled staging function;
- **no relation anywhere stores a per-fixture provisional live score.** The only
  columns that hold a provider score are
  `provider_fixture_proposals.provider_home_score` / `provider_away_score`, and
  they are a one-off snapshot taken when an *initial calendar* is staged.

So the single highest-value backend slice is not a new provider integration. It
is the missing driver between two authorities that already exist, plus the
projection table and the read that let a player and an administrator see the
result. That work costs no additional provider request, needs no new
subscription, and does not touch any scoring, lock or settlement rule.

Three further gaps of the same shape were measured while confirming this:

- contract 132 grants `admin_approve_initial_provider_fixtures` and
  `admin_reject_initial_provider_fixtures` to `authenticated`, but **no read
  exposes the queue those decisions act on** — an administrator can approve a
  calendar they cannot see. This is the seventh instance of the contract
  86 / 98 / 116 / 118 / 120 / 128 defect: an authority is built and nothing
  browser-reachable can read it;
- of the 75 RPC signatures in `config/deployment-contract.json`, **none** returns
  a season fixture list, a Match Centre, a live score, a pending provider
  proposal, or any team identity beyond the platform's own name;
- `predictor_internal.settle_season_cup_tie` still has no caller outside pgTAP
  `126_season_cup_rules.sql`, so a season Championship tie cannot resolve from a
  confirmed result.

### On "badges"

There is **no club crest or badge storage in the repository at all**, and adding
it is a rights decision before it is a schema decision. The 8 August capability
audit records that SportMonks, football-data.org, API-SPORTS and SportDB all
state that club logos and player photos remain the copyright of their owners and
that the customer must arrange proof of rights. `DFA-003`'s shirt-style
`ClubIdentity` component exists precisely because it needs no licence.

The prepared work is not lost: PR [#595](https://github.com/nickygregal12-cmyk/Euro-2028-Predictor/pull/595)
(`feature/provider-enrichment-foundation-contract-134`, closed 9 August to
release the contract-134 number) holds a reviewed
`predictor_internal.provider_team_profiles` populated for all 12 Scottish clubs
from already-archived responses, storing `image_path` as a **non-rendering
reference pending rights proof**. That branch should be restacked onto a fresh
contract number rather than rebuilt.

---

## Part 1 — What is already automated, and what is not

| Job | Cadence | What it actually does |
| --- | --- | --- |
| `process_due_entry_submissions` | every minute | automatic submission at lock |
| season matchweek scheduler | every minute | recurring matchweek submission scheduling |
| LMS settlement | hourly | correction-aware LMS round settlement |
| LMS successor windows | hourly at :15 | contract 109 successor calendar |
| season matchweek scoring | hourly at :30 | **full rederivation** of every league season's scores |
| provider poll dispatch | every 5 minutes | archives + decodes provider responses, then stops |

The important consequence: **points automation already exists and works.** The
scoring job rederives from scratch on every run, which is what makes corrections
work. Once a season fixture has a confirmed result, points are awarded within the
hour with no further code.

The chain is therefore complete except for one link:

```
provider poll ──► raw archive ──► decode ──► normalized_payload ──► [ NOTHING ]
                                                                       ▲
                                                                       │  the gap
                                                                       ▼
season_fixtures.home_score ──► hourly rederivation ──► points, standings, LMS,
                               Championship, monthly/form tables, leagues, H2H
```

`admin_confirm_season_fixture_result` (contract 125) is the only writer of that
score, and today it can only be called by hand with a score a human typed.

---

## Part 2 — What can run concurrently with the frontend

### The frontend programme currently in flight

`DFA-004` canonical route authority merged (#600). Active or next: `EURO-002`
publication state (#602, contract 135), `EURO-003`/`EURO-004` Euro removal and
route guards, `DFA-006` action cards and Play aggregation, `DFA-007` Scottish
rehearsal journeys, `DFA-010` Hub Home. All of these **consume existing reads**;
none adds a relation.

### Concurrency verdict

Backend work in the tiers below is architecturally independent of every one of
those items. New relations live in `predictor_internal`; new reads are new
`public.` functions rather than widened existing ones — the pattern contracts
116, 120, 128, 129 and 130 all followed for exactly this reason.

**But architectural independence is not merge independence.** Every migration PR
in this repository must touch the same seven files, which guarantees a textual
conflict between any two concurrent backend branches:

| Serialisation point | Why it collides |
| --- | --- |
| `config/deployment-contract.json` | `contractVersion`, `requiredMigrationCount` and `requiredRpcSignatures` all move |
| `scripts/check-migration-timestamps.mjs` | added migrations must sort strictly after the last; two branches cannot both be last. Renaming is only permitted while a migration has never been applied |
| documentation sweep | a change adding a migration must touch `AGENTS.md`, `CLAUDE.md`, `MASTER-TODO.md`, `docs/roadmap.md`, `docs/quality/current-status.md`, `docs/ops/ops-pending-migrations.md`, `docs/quality/feature-baseline.md`, `docs/adr/README.md` and `docs/design/README.md` |
| `supabase/tests/NNN_*.sql` | sequential pgTAP numbering. `186` and `188` are free on `main` today; `187` is taken and #602 holds `188` |
| `schemaSecurityInvariants`, `stageC1NonInterference`, `rpcAllowlistParity` | each new internal relation, `auth.users` FK and pre-auth read must be registered in a counted list |
| `NOW.md` | generated by `npm run generate:now` |

**Recommendation:** run backend development concurrently, but merge it
serially — one backend contract in flight against `main` at a time, with the next
prepared on a stacked branch and restacked after merge. Batch logically related
migrations into **one** contract PR rather than splitting them, because the fixed
cost per contract is the nine-document sweep, not the SQL.

---

## Part 3 — Full migration inventory to a fully functioning site

Slots are proposed sequence, not reservations. "Concurrent" means safe to develop
alongside the frontend programme; every item still merges serially per Part 2.

### Tier A — Close the provider pipeline (highest value, no provider spend)

| Slot | Migration | What it adds | Blocked by | Concurrent |
| ---: | --- | --- | --- | --- |
| 136 | **Provider ingestion driver** | The missing caller. A `pg_cron` driver that walks unconsumed `provider_response_processing` rows and routes each decoded fixture: mapped + existing → contract 117 revision import; unknown → contract 132 proposal staging; unmapped → the existing gap report. Idempotent, append-only, consumes each processing row exactly once | — | yes |
| 137 | **Provisional live state projection** | `predictor_internal.season_fixture_live_state`: latest provider status, score, minute and provenance per season fixture, with an explicit staleness instant. Never writes `season_fixtures.home_score`. Fed only by 136 | 136 | yes |
| 138 | **Season fixtures / Match Centre read** | `get_season_matchweek_fixtures` and `get_season_match_centre`: fixtures **ordered by kickoff and labelled by round** (closes the open ADR 0020 ordering item), the caller's own prediction, and provisional live state rendered as visibly provisional beside any confirmed result | 137 | yes |
| 139 | **Provider result proposal + confirmation queue** | Provider final scores become *proposed* results in a queue, plus the reads contract 132 never got: `get_pending_provider_fixture_proposals` and `get_pending_result_proposals`. Confirmation still routes through `admin_confirm_season_fixture_result`, so points flow from the existing hourly job. One tap per fixture, or bulk per matchweek | 136 | yes |
| 140 | **Stale-data fail-closed proof** | Prove that an unavailable or stale provider response degrades to "no live data" and never to a wrong score or a blocked settlement. Closes two open Stage D items | 137 | yes |

> **Owner decision required before "fully automatic" results.** ADR 0020 and
> `INGEST-006` state that provider data never becomes official result truth
> automatically, and `171_ingestion_write_boundary.sql` enforces it. Slot 139 is
> the fastest path that respects that rule: provider proposes, an administrator
> confirms in one action, the existing job awards the points. Auto-confirming a
> provider final — even after a delay with no dispute — is a **rule change
> requiring an ADR amendment**, not a migration. Recommended, but yours to decide.

### Tier B — Make the season games finishable

| Slot | Migration | What it adds | Blocked by | Concurrent |
| ---: | --- | --- | --- | --- |
| 141 | **Championship tie settlement driver** | The caller `settle_season_cup_tie` has never had. Settles ties from confirmed results on the existing correction-aware pattern | Tier A results | yes |
| 142 | **Championship multi-group shape** | Seeding, draw and bracket for the field every public hundred-entrant competition takes. Contract 111 launched the single-group shape only; contract 124's split driver explicitly refuses a multi-group field | — | yes |
| 143 | **Championship knockout + Penalty Number reads** | Bracket state and the Penalty Number journey, which have drivers but no browser read | 142 | yes |
| 144 | **LMS withdrawal eligibility read** | `leave_competition_game` refuses once a `bonus_score_events` row exists and no read exposes that, so a Leave control cannot honestly predict its own availability. A read before a button | — | yes |
| 145 | **Private container creation for LMS and Championship** (`DFA-008`) | Leagues have `create_league` / `create_game_league`; the other two game types have no private create/invite/join path | — | yes |

### Tier C — Enrichment cache: badges and everything else from the APIs

Governed by [`../../architecture/provider-enrichment-plan.md`](../../architecture/provider-enrichment-plan.md)
and the 8 August capability audit. Every item is enrichment only: a missing crest
or a stale injury must never block confirmation, settlement or points.

| Slot | Migration | What it adds | Blocked by | Concurrent |
| ---: | --- | --- | --- | --- |
| 146 | **Team profile foundation** | Restack of the parked PR #595 branch: `provider_team_profiles` — name, short code, founded year, country, venue id, provenance, and `image_path` as a **non-rendering reference**. Populated for all 12 Scottish clubs from already-archived responses at zero request cost | fresh contract number | yes |
| 147 | **Club badge / crest rights resolution** | The actual "badges" slice. A `team_assets` mapping resolving each club to either a rights-cleared provider URL or an owner-supplied asset, with `ClubIdentity` keeping its shirt-pattern fallback where no right exists | **owner rights decision** — do not ship provider crests because a URL exists | develop, do not merge |
| 148 | **Venue and competition profile cache** | Venue name, city, capacity, coordinates; competition metadata not owned by the platform's own authority | 146 | yes |
| 149 | **Fixture-scoped kit colours** | Outfield and goalkeeper shirt/number/border colours per **fixture + team**, so the same club can wear different colours in different matches — generated kit UI without copyrighted artwork | **API-Football current-season entitlement**, measured as blocked | no — measure first |
| 150 | **Confirmed lineups and formations** | Starting XI, substitutes, formation, shirt numbers, captain, coach; frozen as historical fact once the fixture is final | measure SportMonks free-plan lineup coverage first | measure, then yes |
| 151 | **Match event timeline** | Goals, scorer, assist, minute, penalties, own goals, cards, substitutions, VAR where exposed. Presentation evidence only | 150 | yes |
| 152 | **Match statistics** | Possession, shots, shots on target, corners, fouls, offsides, cards, saves, pass accuracy | 150 | yes |
| 153 | **Availability context** | Injuries and suspensions with reason, expected return, provider and fetched instant. Freshness is part of the UI contract — never present stale availability as current | measure endpoint coverage | yes |
| 154 | **Derived form, H2H and goal trends** | Computed from **our own** canonical settled fixtures. No provider coupling, no request cost, reproducible history. The single best value-per-effort item in Tier C | Tier A results existing | yes |
| 155 | **Player identity and squads** | Player id, name, position, squad number, nationality, current club | 146 | yes |
| 156 | **Player match statistics and advanced metrics** | Minutes, goals, assists, shots, tackles, saves, ratings, xG where licensed. Explicitly a second wave | 155 | yes |
| 157 | **Provider standings and top-scorer snapshots** | Football-information surfaces only. Where the platform can derive a table from its own settled fixtures, the local derivation wins and the provider table is supporting evidence — useful for governing-body point deductions that are not derivable from scores | — | yes |
| 158 | **SportDB enrichment-only adapter** | Promotes SportDB from candidate to measured provider through a controlled read that can never gain result authority | its actual plan/terms unmeasured; Production use requires a paid plan | yes |

### Tier D — Product, retention and administration

| Slot | Migration | What it adds | Blocked by | Concurrent |
| ---: | --- | --- | --- | --- |
| 159 | **Competition admin readiness read** (`DFA-009`) | One read answering fixture/provider state, current matchweek, Match Predictor availability, LMS setup, Championship launch/field/phase, result-confirmation readiness and every refusal condition. Never a second rules engine | — | yes |
| 160 | **Cross-game weekly action read** (`DFA-006`) | "What do I need to do this week?" derived from each game's own authoritative state, across entered games | — | yes |
| 161 | **Favourite team preference** (`DFA-002`) | One optional changeable preference keyed to canonical team identity, provably consumed by no competitive rule | — | yes |
| 162 | **Onboarding state persistence** (`DFA-001`) | Followed competitions, per-competition game selection, private-play choice, interrupted-resume and pending-invite survival | — | yes |
| 163 | **Reminder eligibility and notification preferences** (`DFA-012`) | **No notification or reminder relation exists in the repository at all.** Server-state eligibility for incomplete Match Predictor cards and missing LMS picks near lock, plus per-user preference | — | yes |
| 164 | **Player history reads** (`DFA-012`) | Season history for all three games | Tier A results | yes |
| 165 | **Provider change approval queue** (`INGEST-002`, `-003`, `-005`) | Newly discovered fixtures, removals, cancellations, abandonments, material identity or round changes → review, recording provider evidence, operator, decision and resulting calendar change | 136 | yes |
| 166 | **Operating limits** (`CAP-003`, `CAP-006`, `CAP-007`) | Active-league ceiling counting active rather than lifetime rows; public-user cap movement; optional per-league membership cap | **owner approval — no value is approved** | no |
| 167 | **18+ signup rule** (`AGE-001`) | Server-side eligibility rule with matching wording and fixtures, on the pattern the display-name and password rules already use. Footer copy does not close it | — | yes |
| 168 | **Acquisition source field** (`ACCOUNT-005`) | Analytics metadata, provably read by no policy, grant or visibility check | — | yes |

### Tier E — Blocked, listed so it is not forgotten

| Item | Status |
| --- | --- |
| `PRIV-003`–`PRIV-006` account closure and erasure | **Blocked by `PRIV-007`**, the independent UK data-protection review. Issue #272 stays open. Documentation and test planning may proceed; hosted implementation may not |
| Stage C2 ownership and replacement RLS | Same blocker |
| Production promotion of anything above | Separately controlled milestone; repository or development progress authorises none of it |

---

## Part 4 — Recommended next batch (copy-back report)

**Take Tier A as one contract, in one pull request.**

### The batch

| Slot | Migration | Deliverable |
| ---: | --- | --- |
| 136 | `provider_ingestion_driver` | the missing caller between decode and the two import authorities |
| 137 | `season_fixture_live_state` | per-fixture provisional score/status/staleness with provenance |
| 138 | `season_fixture_reads` | `get_season_matchweek_fixtures`, `get_season_match_centre` |
| 139 | `provider_result_proposals` | proposal queue + the admin reads contract 132 never got |

Verify the free contract number and free pgTAP indices against open pull requests
before claiming them: contract 135 and pgTAP 188 are held by #602; 136 and pgTAP
186 are the first free on `main` today.

### Why this batch and not another

1. **It is the only work that unblocks everything downstream.** Until a season
   fixture has a score, the leaderboard has nothing to rank, the monthly and
   rolling-form tables have no settled matchweek to place, the Championship's
   windows never settle, LMS survival never resolves, private league tables sit
   at zero and every Match Centre is blank. `DFA-007`'s remaining rehearsal gaps
   are all downstream of it.
2. **It costs nothing new.** The responses are already archived, already decoded,
   already retained. No new subscription, no new provider, no additional request
   spend.
3. **It changes no rule.** The protected confirmation gate stays exactly where it
   is; the hourly rederivation job is untouched; `171_ingestion_write_boundary.sql`
   continues to hold, and the driver must be added to its named-function list —
   which is the property that makes it a guard rather than a snapshot.
4. **It closes the seventh instance of a recurring defect** — an authority that
   exists and nothing browser-reachable can read — rather than adding an eighth.
5. **It collides with nothing the frontend is doing.** New relations are internal;
   the new reads are new functions, not widened ones.

### Boundaries this batch must hold

- the driver writes a **kickoff** (contract 117) or a **proposal** (contract 132)
  and nothing else — no fixture creation, no `competition_round_id`, no score;
- `season_fixture_live_state` is provisional evidence and is never joined into a
  settlement, standing, score or lock path;
- an unmapped identifier fails the **whole payload**, matching contract 117;
- confirmation stays with `require_result_admin()`; no second admin model;
- the reads disclose no other entrant's prediction before that fixture's own
  kickoff, on contract 129's matchweek-lock boundary.

### Evidence required before merge

Full CI, `local-supabase` pgTAP against a database rebuilt from all migrations,
Database parity, Browser E2E, the migration timestamp guard, the nine-document
sweep, and the ingestion write-boundary suite extended to name the new driver.
Hosted development apply is the ordinary ADR 0024 fast lane; production is not in
scope.

### What to queue behind it

1. Tier B slots 141 and 144 — the Championship tie driver and the LMS
   withdrawal read, both small and both closing honest-control gaps.
2. Tier C slot 146 — restack the parked PR #595 team-profile branch onto a fresh
   contract number. It is already reviewed and measured.
3. Tier C slot 154 — derived form, H2H and goal trends from our own settled
   fixtures. Best value per unit of effort in the whole enrichment lane, and no
   provider dependency at all.
4. Tier D slot 159 — the competition admin readiness read, which is what makes
   the Tier A confirmation queue operable by a person rather than by SQL.

### Two decisions to put in front of the owner now

- **Automatic result confirmation.** Slot 139 keeps a human in the loop because
  ADR 0020 requires it. If you want a provider final to become official truth
  without a tap, that is an ADR amendment and should be decided before 139 is
  built, not after.
- **Club badge rights.** Slot 147 cannot be built on a provider URL alone. Either
  obtain rights for the crests you intend to display, or accept the shirt-style
  `ClubIdentity` as the permanent visual answer. Everything else in Tier C
  proceeds either way.
