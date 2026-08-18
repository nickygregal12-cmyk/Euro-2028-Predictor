# vNext Matches and Match Centre

**Status:** Stage 8 deliverable — **PRODUCT AUTHORITY** for the vNext Matches system.
**Scope:** what the Matches destination is, what a Match Centre is, the match-state
presentation contract, the live-data honesty rules, which optional context may be
drawn, and the relationship between Matches, the games, Home and TV Mode.
**Does not govern:** any production route. Nothing here repoints a route, changes a
guard or alters Netlify behaviour. **No backend change of any kind is implied.**
**Consumes:** [`vnext-shell-ia.md`](vnext-shell-ia.md) — the selected Competition
Deck architecture, which is settled and is not reopened here.
**Last verified:** 2026-08-18, against `src/vnext/`, `src/services/supabase/` and
`supabase/migrations/` at the commit this document was written on, and re-verified
after reconciling with `origin/main` at `04ebee6` (contract 198).

---

## 1. What Matches is for

> **WHAT FOOTBALL IS HAPPENING?**

and, when a player chooses a fixture:

> **WHAT IS HAPPENING IN THIS MATCH?**

Those are two different questions and they get two different models. `MatchesModel`
answers the first, `MatchCentreModel` the second, and neither is a widening of the
other. A list row needs the clubs, the state and one line of context; a Match Centre
needs the competition's table, both form runs and this season's meetings. A single
universal `MatchModel` would force every row in a list of ten to carry a table it
never draws, and would turn "does this surface have a table?" into a question about
`null` rather than about the type.

## 2. Football is not a game

The load-bearing distinction of the stage, and it is held by **vocabulary** rather
than by a rule:

| | |
| --- | --- |
| **A MATCH** | a real football fixture. `Matches` is where they live. |
| **A GAME** | a joinable prediction format — Match Predictor, Last Man Standing, the Predictor Championship. `Games` is where they live. |

`src/vnext/models/matches.ts` has no type for a game at all. The single place the
two touch is `MatchPredictionBadge`: a **status** a fixture row may carry, which is
optional, carries no command, no editability and no lock, and **cannot be pressed**.
`tests/vnext/matches.test.tsx` asserts that a fixture list contains no spinbutton,
no textbox and no predict/save/submit/joker control, and that no row contains a
nested button.

**Stage 7.6's `Games` naming is not reopened.** Implementing Matches surfaced no new
concrete blocker: the destination's own `<h1>` says "Matches", the rows are
fixtures, and the badge that mentions a prediction says "You: 2–1" rather than
naming a game. The distinction reads correctly in practice.

## 3. Matches is competition-scoped first

Under the Competition Deck the player is **inside a competition**, so the default
Matches experience is that competition's football:

```
Premier League → Matches
Champions League → Matches
```

This is a **data shape rather than a promise**: `MatchesModel` carries exactly one
`competition`, the connected source is addressed by one `get_season_play_context` +
one `get_season_fixtures`, and there is no code path from a Matches page to a
platform catalogue.

**The binding product test** is the `singleCompetition` world and
`e2e/vnext-matches.spec.ts` § "the one-competition player": at 375 and at 1440, the
page shows **no scope control**, and **no other competition's name appears anywhere
on the page** — asserted as a text search over the whole rendered frame, not as a
promise.

## 4. The combined view — RETAINED, as a secondary scope

### The decision

| | |
| --- | --- |
| **Retained** | Yes — as a **scope inside the Matches destination**. |
| **Placement** | A two-option control at the top of Matches: *In {competition}* / *Across your N competitions*. |
| **Never** | A fifth primary destination. Never the landing state. Never a global `/matches` dashboard. |
| **Offered when** | The player is in more than one competition **and** the host can actually answer a cross-competition calendar. Otherwise the control does not render at all. |

### Why it earned its existence

The evidence is in the repository rather than in an opinion. **Contract 197's
`get_my_football_calendar`** (`supabase/migrations/20260818020000_my_football_calendar.sql`,
merged in #842) was written for exactly this job: one chronological calendar across
the seasons the player has **entered**, server-side, bounded to contract 111's window
and limits, with contract 111's fixture projection field for field. Its own header
records that the alternative is "call `get_season_fixtures` once per season the
player has entered and merge in the browser", and why that is worse than an N+1 —
the merge is a **sort across competitions**, so a client cannot page it, cannot
bound it and cannot know it has the next fixture without fetching every season in
full.

A backend contract written specifically to make this view possible without a browser
loop is strong evidence the job is real. It is **secondary** because the selected
architecture says competition context is primary, and it does not undermine the
Competition Deck because:

- it is reached from **inside** a competition and returns there in one press;
- **every fixture names its competition**, without exception — see §5;
- it spans the **player's** competitions, never the platform's twenty.

### The rule the mode lives under

> **EVERY FIXTURE IN COMBINED SCOPE NAMES ITS COMPETITION.**

The moment a reader cannot tell which competition a match is in, the combined view
has erased the architecture it is a layer over. It is enforced three ways:
`MatchCompetitionRef` is **non-optional** on `MatchListItem` (a row without one does
not compile), `buildMatchesModel` puts the competition first in `contextLabel` in
combined scope, and both the unit suite and the browser suite check every rendered
row for a competition name.

### What is not built yet, and exactly why

`MatchesSource.combined` is `null` on every connected path today, and that is a
**recorded backend position rather than a design decision**:

- contract 197 is one of **eight migrations pending on hosted development**
  (`NOW.md` at the reconciled head: repository 198, development hosted 190);
- it is therefore **absent from `src/services/supabase/database.types.ts`**, which
  is regenerated from the hosted schema.

Consuming it today would need either an untyped RPC call or a cast, and both would
be this lane asserting a capability the running database does not have — the same
trade Stage 7.6 refused for the shell's attention layer. The **type exists**
(`MatchesCombinedSource`, shaped for contract 197 exactly), the **presentation is
finished**, and the deterministic `combinedTonight` world is the design. The day 197
is applied and the types are regenerated, this is a source change and not a redesign.

**Minimum contract to close it:** apply `20260818020000_my_football_calendar.sql` to
hosted development and run `npm run generate:types`. No new server work.

## 5. The match-state model

`src/vnext/models/matches.ts`. A **discriminated union**, so the brief's own example
— a scheduled match carrying `minute: 73` and `finalScore: 2-1` — does not
typecheck.

| State | What it means | Carries |
| --- | --- | --- |
| `scheduled` | the platform says this is on and nothing has happened | kickoff only |
| `live` | a provider currently reports it in play | an **observation** |
| `awaitingResult` | a provider reports it **over**; the platform has not settled it | an **observation** |
| `finished` | the **platform** settled a result | a **required** result |
| `postponed` | the platform moved it out of its slot | a note |
| `abandoned` | the platform recorded it abandoned | a note |
| `void` | the platform voided it | a note |

A **clock exists only inside `MatchObservation`**, and an observation exists only on
the two states a provider has actually reported on. A scheduled match therefore has
**no field that could hold a minute**, and a finished match has none either.

`matchScoreClaim(state)` is the **single** function that answers "is there a score,
and what kind of claim is it" — so the provisional/official distinction cannot be
lost by one component reaching into `state.observation.score` itself.

## 6. Provider truth versus platform truth

Two different claims, kept in two different fields by the read and by this contract:

| | Source | Decides |
| --- | --- | --- |
| **PROVIDER** | `predictor_internal.season_fixture_live_state` (contract 135) — a status token, a `kind`, two optional scores, an `observed_at` | **nothing** |
| **PLATFORM** | `public.season_fixtures.status` and the result it is allowed to carry | **everything** |

Three consequences, all held by tests:

1. **A provider may only REFINE a fixture the platform still calls `scheduled`** —
   into `live`, or into `awaitingResult`. It may **not** postpone, abandon or cancel
   one. Contract 135's vocabulary includes all three and a feed reports them for
   ordinary reasons (a delayed kickoff, an outage, a mis-mapped fixture); letting one
   through would empty a fixture list on a provider's say-so.
2. **`awaitingResult` exists** because a feed may report a match final while the
   platform has not confirmed a result. Collapsing it into `finished` would be a
   browser promoting a feed to a settlement.
3. **A platform state drops any provider score.** A postponed fixture a feed once
   reported in play must not keep the numbers.

## 7. Live-data honesty — the rule this stage turns on

> **A MATCH CLOCK IS PROVIDER DATA OR IT DOES NOT EXIST.**

**Contract 135's projection carries no minute, no period and no added time.** So:

- `buildMatchesModel`'s `observationOf` sets `clock: null` **unconditionally**;
- there is no argument in its scope a minute could be derived from;
- **`LIVE` with no minute is a designed, first-class state**, not a degradation.

Acceptable, and drawn: `Live` · `Live 67'` · `Half-time` · `Full time` · `Postponed`.
Unacceptable, and impossible here: `Live · 72'` because kickoff was 72 minutes ago.

**Proof.** `tests/vnext/matchesIntegration.test.ts` maps a fixture that kicked off
four hours before the model's instant, with no provider block, and requires
`scheduled` with no observation — the answer a clock-reading mapper gets wrong. The
browser suite loads a live world with a real clock running, waits past the entrance,
and asserts the clockless live row contains **no minute-shaped text** while still
saying "Live".

**Freshness** is the **server's** `observed_at`, never a component's mount time and
never a model's build time. The Match Centre says "observed at 15:41", which is
checkable; it never says "34 seconds ago", which would need a clock this lane does
not have.

## 8. Date versus matchweek — the browsing hierarchy

> **ORDERED BY KICKOFF, LABELLED BY STAGE.**

The owner's 5 August amendment, and the reason the day is the grouping key: a
fixture postponed out of matchweek 5 into November keeps `competition_round_id = 5`
**deliberately**, so grouping by round files a November match under a September
heading.

**`MatchStageRef.label` is the competition's own word and is printed verbatim** —
"Matchweek 7", "Quarter-finals", "Group A · Matchday 2", "Semi-final, second leg".
Nothing builds a label from an ordinal and nothing reads a date to decide what stage
a competition is at. `ordinal` orders and is never printed.

This is what makes every competition type behave correctly with **one** presentation:
a weekly league, a group stage, a knockout and a tournament stage all name their own
rounds, and the surface prints what it was given.

## 9. Match Centre

**A football surface, not a prediction form.** Its `<h1>` is the fixture itself —
"Glenmore Athletic v Strathkelvin United" — because a page whose heading says "Match
Centre" is a page named after its own file.

**Header hierarchy:** competition · season → the two clubs, large, in their own
colours → the score or the kickoff → the state → stage, day and kickoff → for a live
or recently observed match, when the provider last reported.

**Composition:** one column on a phone (hero, then the football around it, in source
order); two columns at ≥1120px, with the football and the player's own side in the
**working** column and the competition context beside it.

### Tiers, and what actually renders

| Tier | Module | State | Source |
| --- | --- | --- | --- |
| 1 | identity, clubs, kickoff, state, score, stage, competition | **REAL** | contract 148 |
| 2 | recent form (both sides) | **REAL** | contract 141 `get_season_club_form` |
| 2 | league table window | **REAL** | contract 160 `get_competition_table` |
| 2 | this season's meetings | **REAL** | contract 141 `get_season_club_head_to_head` |
| 3 | event timeline | **DEFERRED** | no canonical event source exists |
| 3 | lineups | **DEFERRED** | no lineup source exists |
| 3 | match statistics | **DEFERRED** | no statistics source exists |
| 3 | injuries | **DEFERRED** | no injury source exists |
| 3 | venue | **DEFERRED** | `season_fixtures` has no venue column |
| 3 | broadcast | **DEFERRED** | no broadcast source exists |
| 3 | referee | **DEFERRED** | no official is stored |

`matchCentreModules(model)` is the **single** answer to what renders, so no section
decides for itself and **no empty card can appear**. The `coreOnly` world is the
review surface for the floor: two clubs, a kickoff and a stage, with every optional
module **absent rather than empty** — no heading over nothing, no zeroed possession
bar, no "coming soon".

**Tier 3 absences are not listed in `unavailable`.** They are not "unavailable just
now"; they are things this platform does not hold, and apologising for them on every
match would be an apology for a product decision.

### Head-to-head, and the N+1 that is not there

`get_season_club_head_to_head` is addressed by **two team ids**, so it is
pair-at-a-time by construction. That is correct for a page about one pair and is
exactly why it must not appear in a list. **`MatchListItem` has no field for it**, so
a fixture list cannot begin issuing per-fixture requests even by accident.

The team ids are joined from the form read **by name**, because contract 148 sends
`teams.name` and no id. Both names are the same column of the same rows, so it is an
equality on one source of truth — the same reasoning `SeasonMatchCentreRoute`
records for the same join.

## 10. Prediction status on a fixture list — OMITTED, deliberately

§14 permits a badge only where authoritative state can supply it **cheaply and
without N+1**, and requires it omitted otherwise. The only read carrying a player's
predictions is `get_season_matchweek_card`, which answers **one matchweek**. A
Matches window ordinarily spans three, and on a week with a rescheduled fixture
deliberately mixes them.

One card read would badge **some** rows and not others — and a row with no badge in
a list where other rows have one does not read as "we could not answer this one", it
reads as **"nothing is needed here"**. That is the exact trade Stage 7.6 refused for
the shell's attention layer, and it is refused here.

`MatchListItem.prediction` is therefore `null` on every connected row. The model is
capable, the worlds carry the design, and the surface would draw it unchanged.

**Minimum contract to close it:** a read answering, for one tournament and one date
window, the caller's own prediction state per fixture — `{ fixture_id, status,
home_score, away_score, points, outcome }` — bounded by the same window and limits
as contract 139. **Exact consumer:** `MatchesSource`, a new nullable field mapped in
`itemOf`. **Current read:** `get_season_matchweek_card`, one matchweek only.
**Missing server truth:** per-window prediction status.

## 11. Backend gaps, stated for the parallel lane

| # | Gap | Exact consumer | Current read | Missing server truth | Minimum contract |
| --- | --- | --- | --- | --- | --- |
| 1 | **Cross-competition calendar not reachable** | `MatchesSource.combined` | contract 197 exists in the repo | it is pending on hosted development, so it is absent from the generated types | apply `20260818020000_my_football_calendar.sql` to development and run `npm run generate:types`. **No new server work.** |
| 2 | **Per-window prediction status** | `MatchListItem.prediction` | `get_season_matchweek_card`, one matchweek | prediction state across a date window | see §10 |
| 3 | **Round kind is not projected** | `MatchStageRef.kind` | contracts 139 and 148 send `{id, ordinal, label}` | `competition_rounds.kind` (`league_matchweek` / `group_matchday` / `knockout_round`) genuinely exists in the schema and is not in either payload | add `'kind', round.kind` to both round objects. One line each. |
| 4 | **No live clock** | `MatchObservation.clock` | contract 135's live projection | minute, period, added time | a provider ingestion decision, not a frontend one. **Out of Stage 8's scope by §41.** |
| 5 | **No match events, lineups, statistics, injuries, venue, broadcast, referee** | the six Tier 3 fields | nothing | all of it | provider expansion. **Out of Stage 8's scope by §41.** |
| 6 | **No extra time, penalties or aggregate** | `MatchDecision`, `MatchAggregate` | `season_fixtures` holds one score pair | a knockout's decision method and a tie's aggregate | schema work on `season_fixtures`. **Out of Stage 8's scope by §41.** |
| 7 | **Tournament-shape fixtures excluded** | the whole Matches surface | `get_season_fixtures` and contract 197 both refuse `kind <> 'league_season'` by design | — | **not a gap.** A tournament has its own fixture surfaces, lock model and reveal model, and folding it in is a product decision this stage has no authority to take. Stage 15 owns Euro 2028's vNext adoption. |

## 12. TV Mode — SHARED DATA CONTRACT, SEPARATE PRESENTATION, DEFER THE REDESIGN

**Audited:** `src/app/shellRoutes.ts` registers `/competitions/:c/:s/tv` **outside
the signed-in shell**, with `isTvModePath()` read by `AppShell` to render the route
bare. `src/features/season/SeasonTvModeRoute.tsx` and
`src/features/season/tvModeModel.ts` are its surface and model (`INNOV-006`).

**Decision, all three parts:**

| | |
| --- | --- |
| **A. Share the match model?** | **YES, eventually.** TV Mode asks the same football questions Matches does — what is on, what is live, what the score is — so the day it is rebuilt in vNext it should consume `MatchListItem` and `MatchState` rather than a second state machine. Two answers to "is this match live" is precisely the drift this stage exists to prevent. **Nothing is changed today**; `tvModeModel.ts` is untouched. |
| **B. Remain shell-less?** | **YES, and that is not negotiable.** A frame built for a phone in a pocket is the wrong frame for a screen on a wall. Putting TV Mode inside `VNextShell` would give a room display a bottom navigation bar nobody can press and an account control nobody should. Its route is deliberately outside the signed-in shell and stays there. |
| **C. Redesign now?** | **NO — DEFERRED to its own later stage.** Stage 8's brief says not to rebuild it, and nothing found in the audit argues otherwise: TV Mode is passive and glanceable, Match Centre is interactive and personal, and they are different products over the same football. |

**Match Centre versus TV Mode**, as a product distinction:

| Match Centre | TV Mode |
| --- | --- |
| one person, one device, one fixture | a room, a wall, a whole matchday |
| interactive: filters, links, context modules | passive: no controls beyond an exit |
| inside the shell | deliberately outside it |

**Nothing about TV Mode was deleted, replaced or repointed in Stage 8.**

## 13. Boundaries confirmed

| Surface | Stage 8's relationship |
| --- | --- |
| **Home** | Untouched. Home answers *what should I care about right now*; Matches answers *what football is happening*. No fixture browser was duplicated onto Home and no Home file changed. |
| **Match Predictor** | Untouched. Score entry did not move. A Match Centre may offer **one link** to the Match Predictor, and only where the host says it can act on it — contextual navigation, never the page's purpose. No prediction state and no submission authority is duplicated. |
| **Leagues, profiles, player H2H** | Not built. Stages 9 and 10 own them. A Match Centre does not need a private-league comparison to be interesting. |
| **LMS, Championship** | Not built. Matches may later be the football context those games consume; Stage 8 implements none of their workflows. |
| **Betting** | None. No odds, no bet slip, no value bets, no implied probability, no stake control, no CTA. |

## 14. Routing

**Target mental model** — unchanged from the existing address space, which is
already right:

```
/competitions/:competitionSlug/:seasonSlug/matches
/competitions/:competitionSlug/:seasonSlug/matches/:fixtureId
```

**Nothing is repointed.** Stage 8 registers one **dev-only** harness at
`/dev/vnext-matches`, behind `import.meta.env.DEV`, exactly as Stages 6 and 7 did.

**Addressability** is the property worth stating: a Match Centre resolves from the
**canonical fixture id alone** (contract 148), so a deep refresh resolves the same
fixture and a shared link works for a match outside any default window. Nothing
identifies a fixture by `home + away + date` or by array position — `MatchListItem.id`
is the only thing that crosses the boundary to a host.

**Browsing state** is deliberately small: the page owns the filter interaction and
accepts an `initialView` so a host can restore it. There is no query-string state
machine.

## 15. Performance — the N+1 audit

| Surface | Round trips | Why it cannot grow |
| --- | --- | --- |
| **Matches**, any number of fixtures | **2** — `get_season_play_context`, then `get_season_fixtures` | `MatchListItem` has no field for a table, a form run, a head-to-head or a prediction, so a list cannot start asking |
| **Match Centre**, one fixture | **≤5** — contract 148 and contract 121 in parallel; then contracts 141 and 160 in parallel; then **one** head-to-head | every one is addressed by a season or by this pair, and each fails alone |

A list of ten fixtures issues **two** requests. Not ten head-to-head calls, twenty
club reads, ten prediction reads and ten table reads. **This is a property of the
model's shape rather than a measurement that could drift.**

## 16. Presentation architecture

```
existing reads/services
  → MatchesSource / MatchCentreSource      (what the application hands over)
  → useVNextMatchesSource / …CentreSource  (acquisition only, no mapping)
  → buildMatchesModel / buildMatchCentreModel   (PURE: no network, storage, clock or React)
  → MatchesModel / MatchCentreModel
  → VNextMatches / VNextMatchCentre        (visual, model-only)
```

Supabase, the generated database types and provider payloads stay **out of the
visual tree**; `tests/vnext/vnextProductionBoundary.test.ts` holds the direction and
now covers `src/vnext/matches/` on the same terms as Home and the Predictor.

**One state machine, not two.** `buildMatchCentreModel` **imports** `matchStateOf`
and `summarise` from the list's mapper. A fixture must describe itself identically
whether it was reached from the calendar or from a link — that is the whole reason
contract 148 returns contract 139's entry field for field — and two state machines
over one payload is exactly how that stops being true.

## 17. Production isolation

vNext is still not the production application. No production route was repointed,
replaced, redirected or deleted; the legacy `SeasonMatchesRoute` and
`SeasonMatchCentreRoute` are untouched; Netlify behaviour is unchanged; and no
Supabase, migration, RLS, RPC, provider, cron, settlement, scoring, lock or reveal
work is included. **Expected backend delta: NONE. Delivered: NONE.**
