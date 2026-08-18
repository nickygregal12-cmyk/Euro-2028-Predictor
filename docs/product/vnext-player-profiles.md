# vNext Player Profiles and H2H — the product authority

**Status:** Stage 10 deliverable. This is the authority for what a vNext player
profile **is**, what it may claim, and what it must never assert.
**Scope:** one player's season inside one competition and one game — who they
are, how they are performing, and how the reader compares with them.
**Does not govern:** player search or a directory, followers, friend requests, a
cross-competition identity graph, direct messages or an activity feed, league
membership administration, scoring, settlement, or any production route.
**No production surface changed in Stage 10**, beyond moving one predicate into
the module that owns the read it describes (§11).

**Reads consulted:** contract 151 `get_season_player_profile`, contract 192
`get_season_rank_history`, contract 192 `get_season_rivalry`, contract 191's
`reach` (through all three). **Backend delta: none.** No migration, no RPC, no
RLS change, no provider call, no write of any kind.

---

## 1. The question this surface answers

> **Who is this player, how are they performing, and how do we compare?**

Inside one football competition season, and inside one of its games. Stage 9
built the doorway — a league row the SERVER said the caller may open — and this
is what is behind it.

A profile is a profile IN A SEASON. Points, positions and prediction history are
facts about a player in a competition, not properties of a person, and the page
never claims otherwise. There is no cross-competition identity here and Stage 10
does not own one.

---

## 2. THE DECISION THIS STAGE TURNS ON — three reads, three permissions, and
they do not travel together

Everything else in this document follows from one fact about the server.

The page is assembled from three contracts whose disclosure boundaries are
**different**:

| read | boundary | why |
| --- | --- | --- |
| contract 151 `get_season_player_profile` | a **shared private league** | a season may have fifty thousand entrants and none of them agreed to be looked up; sharing a private league is a mutual act |
| contract 192 `get_season_rank_history` | contract 191's **`compare`** | a matchweek, a cumulative total and a position are exactly what `get_season_leaderboard` already shows every entrant, **and no prediction appears in the payload at all** |
| contract 192 `get_season_rivalry` | contract 191's **`compare`** | same, and both sides' figures are computed over the same compared matchweeks |

So **a player whose profile the caller may not open can still have a readable
rank history and a readable head-to-head.** That is not an edge case; it is the
ordinary state for two entrants who share a competition and no private league.

### What follows structurally

**There is no page-level permission in this lane, and there must never be one.**
Each panel carries its own outcome union:

```ts
export type PlayerProfilePanel =
  | { kind: 'profile'; detail: PlayerProfileDetail }
  | { kind: 'not-entered' }
  | { kind: 'refused' }
  | { kind: 'unavailable' }
```

and the rank-history and rivalry panels carry their own, with their own extra
cases. A page with a single `permitted` flag could not draw the world above: it
would hide two panels the server was willing to answer, and tell the reader they
may not see something they may.

`ProfileRefused` is the deterministic world that holds this, and
`tests/vnext/buildPlayerProfileModel.test.ts` asserts it at the mapper, where it
is visible — a page cannot show what it never received.

### Refusal, absence and failure are three different sentences

| state | it is a fact about | retry? |
| --- | --- | --- |
| `refused` | **permission** — the server said no | **no.** It will answer identically next time |
| `not-entered` | **the player** — they hold no entry in this season | no |
| `unaddressable` | **this build** — the doorway carried no season reference | no |
| `unavailable` | **the read** — it did not answer | **yes** |

Collapsing any two produces the failure Stage 9 spent a review round removing: a
failed read rendered as a fact about a person. A retry beside a refusal is worse
than useless — it spends a press proving a permission has not changed.

---

## 3. IDENTITY — two server-issued addresses, and never a name

Contract 191, and Stage 10 holds it in a stronger form than Stage 9 could.

- **`playerId`** is the ACCOUNT id. It addresses contract 151.
- **`playerRef`** is contract 191's SEASON-SCOPED entry id. It addresses both
  contract-192 reads.

They are different identifiers for different purposes and **are never
substituted for one another**. Stage 9's `openPlayer` intent was widened to
carry both, because a doorway carrying only one leaves a panel unaddressable:

```ts
| {
    readonly kind: 'openPlayer'
    readonly playerId: string
    readonly playerRef: string | null
  }
```

The ref is nullable and the id is not, and that asymmetry is real: the id comes
from `LeaguePlayerDestination`'s single openable case and is required by it,
while the ref is absent below contract 191. A null ref is answered honestly —
"Season positions are not available from here" — and never as a refusal.

### The page never receives a display name

**This is the strongest available form of the social identity rule.** Not "we do
not route by the display name" but *there is no display name here to route by*:

- Stage 9's intent has no name field, so nothing routing to a profile has one to
  pass;
- `VNextPlayerProfileScreen` has no name prop and `useVNextPlayerProfileSource`
  has no name input;
- the dev harness's URL carries no name and its form has no field for one.

The heading is therefore **the server's**, taken from whichever read answered, in
a **fixed priority**: contract 151 first (the narrowest boundary, so the most
authoritative answer available), then the rivalry's opponent side, then the rank
history. The priority is fixed rather than "whichever landed first" because two
of the three can refuse independently, and a heading that depended on load order
would rename the player between renders.

**All three failing leaves the name `null`**, and the page says "Player". It
genuinely does not know who this is, and a remembered or guessed label would be
the one thing on the page nobody read.

### Two players with one display name

The comparison is where two people are on screen at once, and it stays
unambiguous **structurally**: the caller's column is labelled **"You"** whatever
they are called, so the two headings differ even when the two names do not. Rows
are keyed by `playerRef`. The `DuplicateName` world is the picture and both the
render suite and the browser suite assert the headings are distinct.

---

## 4. THE CHART PLOTS A POSITION, NOT A TOTAL

The Stage 10 predicate turns on this, and contract 192's RPC states the reason
beside the field it added:

> Points over time is derivable from the matchweek scores; POSITION over time is
> not.

A running points total is a line that only ever climbs, drawn for a player who
may have been overtaken every week. It looks like a chart and answers a question
nobody asked.

### The geometry lives in one function

`rankPlot` is the only place in the lane where a rank becomes a coordinate, and
it exists because both ways of getting this wrong are **silent**:

1. **A rank improves as it FALLS.** On a naive linear scale a season of
   promotions is drawn as a slide downhill. The inversion happens once, in
   `rankPlot`, and `Climbing` and `Falling` are the two worlds that catch it.
2. **A zero span divides by zero.** One settled matchweek, or a season spent
   entirely at one position, has no range. Both plot on the CENTRE LINE — pinned
   to an edge, an unchanged season reads as the best or the worst of a career.

`rankBounds` returns the same numbers the axis is labelled with, so **the line
and its caption come from one calculation**. A chart scaled by one rule and
captioned by another is the classic chart lie and looks completely normal.

### The axis is zoomed, and says so

Fourth to seventh in a field of 412, scaled to `[1, 412]`, is three pixels of a
flat line: the entire truth and no information. So the chart is scaled to the
range actually occupied — which is honest **only because the axis prints those
same two bounds**. `BigField` is that world, and the browser suite asserts the
axis labels are the positions the table beside it states.

The field size is named beneath the chart, and named as having CHANGED where it
did: "7th of 60" and "7th of 412" are different facts, so one number under a line
drawn across both would be wrong for most of it.

### It is readable without seeing it

The `<svg>` is `aria-hidden` and the same series is a real `<table>` beneath it,
rendered **from the same array**, so the two cannot drift. The table is the
authority and the line is the illustration.

Every position in that table is printed with the field it was out of. A rank
never travels alone anywhere in this lane — the decoder drops a point that
carries only one of the pair, the rivalry reports an unranked player as
`standing: null` rather than zeroth, and the surface says "Not yet ranked".

---

## 5. THE COMPARISON IS BOUNDED, AND STATES ITS DENOMINATOR

### Why it is not contract 129

`get_season_head_to_head` is **per-matchweek**: one call answers one matchweek. A
season comparison assembled from it would be one RPC per matchweek, which the
Stage 10 predicate forbids in terms. `get_season_rivalry` is the bounded
season-wide answer in a single call. Contract 129 remains the drill-down into one
matchweek's fixtures and is not used by this surface.

**The whole page costs three reads**, whatever the season's length. Nothing loops
over matchweeks, fixtures or rows, and there is no field in `PlayerProfileSource`
that a per-item request would fill.

### The denominator is stated, never counted

`recent` is truncated server-side (`p_recent`, clamped 1..20) and
`matchweeksCompared` arrives as its own figure. A record tallied off the strip
reports the last five matchweeks of a thirty-matchweek rivalry as the whole
story. The RPC says it plainly: *a record without its denominator is the
misleading half.* The panel draws the count first, and `TruncatedWindow` is the
world where thirty are compared and five are drawn.

### 0-0-0 out of nothing is not a draw

Before any matchweek has settled, revealed and banked **for both players**, every
figure in the payload is zero. "0-0-0, level on points" is a sentence about two
people who have never met. `rivalryComparable` reads the stated denominator so a
surface asks rather than infers, and the panel says there is nothing to compare.
`NewSeason` and `LevelRivalry` are deliberately adjacent: identical symmetric
records, opposite meanings, and only the denominator separates them.

### Only matchweeks both players banked are compared

The RPC's own rule, via `season_revealed_settled_rounds`: **a matchweek the
opponent could not play is not a win.** Accuracy is computed over those compared
matchweeks only and identically for both sides, so the two columns are comparable
by construction. Nothing in this lane recomputes a count, a rate, a record or a
ranking from the parts, and the points gap keeps the server's sign — positive
means the opponent is ahead, and `pointsGapLabel` is the one place it becomes a
sentence.

---

## 6. THE REVEAL BOUNDARY IS ENFORCED BY ABSENCE

Contract 151 does not blank an unrevealed matchweek — it **omits it**. Its
`where` clause admits a round only once that round's own lock has passed (or the
profile is the caller's own, because those are their own picks), and only where
the player actually predicted.

Two consequences, and the lane is built around both.

### Nothing may be inferred from a gap

A missing matchweek means "not yet revealed" **or** "they did not play it", and
the payload does not say which. So there is **no "3 of 12"**, no progress bar and
no percentage of the season anywhere on this page. The heading counts what is
shown and says so — "5 matchweeks you can see". Every one of the alternatives
needs a denominator this page does not have, and inventing one puts a claim about
a player's participation on screen that no read established.

`PlayerProfileDetail` has exactly four fields and none of them is a total; the
mapper suite asserts the key set.

### A present-but-unsettled matchweek is not a zero

On the caller's own profile a locked-but-unmarked matchweek arrives with null
points. `ProfileMatchweekResult` makes that a distinct case rather than a
nullable number:

```ts
export type ProfileMatchweekResult =
  | { kind: 'settled'; points: number }
  | { kind: 'pending' }
```

There is no zero to reach for. "0 pts" against an unmarked matchweek is a
scoreline the player did not get, and it is one `?? 0` away at all times.
`PendingMatchweek` is the world.

### The picks are counted, not named — REAL BUT PARTIAL

Contract 151 keys predictions by **season fixture id** and carries no team names,
no kickoff and no result. Naming the fixtures would take one read per matchweek,
which is the N+1 the predicate forbids; printing "2–1" beside an opaque
identifier would be a scoreline against nobody.

So the surface draws the COUNT — "8 predictions" — which is true, and the
scorelines wait for a fixture join that is not this stage's. The model still
carries the picks rather than only their number, because the count is derived
from the revealed fact and throwing the fact away would cost the next stage the
data it needs.

**Classification: REAL BUT PARTIAL.** The predictions are real, authoritative and
reveal-safe; what is missing is the fixture context to render them meaningfully,
and it is missing from the payload rather than from the code.

---

## 7. THE AUDIT — what the three reads supply, classified

| property | classification | note |
| --- | --- | --- |
| display name | REAL + AUTHORITATIVE | from all three reads; the page picks by fixed priority |
| `playerRef` / `playerId` | REAL + AUTHORITATIVE | contract 191; two addresses, never interchanged |
| `reach` | REAL + AUTHORITATIVE | the server's permission, never inferred in the browser |
| season points, matchweeks played | REAL + AUTHORITATIVE | banked, from the authority the season and the leagues read |
| season rank + field size | REAL + AUTHORITATIVE | paired always; absent rather than zeroth |
| rank per settled matchweek | REAL + AUTHORITATIVE | contract 192's `standing_rank`; the read exists precisely because it is not derivable |
| exact scores / correct outcomes | REAL + AUTHORITATIVE | derived by the RPC over settled matchweeks, with its own denominator |
| accuracy **rate** | DERIVED, AND REFUSED ON ZERO | the one division in the lane; `accuracyRate` returns null rather than 0% |
| jokers played, joker points | REAL + AUTHORITATIVE | contract 151 |
| revealed matchweek history | REAL BUT PARTIAL | reveal-safe and complete as sent; its GAPS are not countable — §6 |
| predictions per matchweek | REAL BUT PARTIAL | fixture ids only, no team names — §6 |
| head-to-head record | REAL + AUTHORITATIVE | with `matchweeksCompared` as its denominator |
| recent matchweek window | REAL + AUTHORITATIVE | truncated by the server; a window, never the denominator |
| matchweek outcome | REAL + AUTHORITATIVE | the server's verdict; never recomputed from the two figures |
| Prediction DNA (contract 176) | **NOT REQUIRED — not read here** | the production season route reads it; Stage 10 did not pull it into vNext, because it is a fourth read with a fourth denominator and the predicate does not ask for it |
| per-fixture detail behind a pick | **ABSENT** | no team, no kickoff, no result in this payload — §6 |
| cross-competition history | **ABSENT, AND DELIBERATELY** | ADR 0011; there is no read and none should be built |

---

## 8. WHAT THE PAGE DOES WHEN A READ DOES NOT ANSWER

Only the **play context** can fail the whole page, because without it there is no
competition name and no id to address anything with. Everything after it resolves
to its own outcome, and the three panels are drawn from three of them.

A partial page is a **ready** page. Each failed panel gets its own sentence and
its own retry; the message carries `role="status"` and the control sits **outside**
the live region, so a second failure is announced to a reader who just asked for
exactly this answer without the button re-announcing itself. That shape was
settled in Stage 9's review and is unchanged here.

`AllUnavailable` is the world where all three fail: the page is still a page, the
heading admits it does not know who this is, and three separate sentences appear
rather than one error screen standing in for three different failures.

---

## 9. WHAT IS NOT HERE, AND WHY

- **No player search and no directory.** Stage 10 does not own one, and this
  lane must never become the seam for one. The reads answer about ONE named
  player and cannot enumerate, search or rank the population.
- **No followers, friend requests, feed or messages.**
- **No cross-competition identity.** ADR 0011 refuses a combined ranking at the
  data layer; a profile spanning competitions would be the same claim in a
  different shape.
- **No fourth profile system.** Three exist today — platform, tournament,
  season. This is the season one, redesigned, and it adds nothing.
- **No unrevealed prediction, ever.** §6.
- **No client-side recomputation** of a ranking, a record or a head-to-head.
- **No contract 129 call.** §5.

---

## 10. ACCESSIBILITY AND PRESENTATION

- One `<main>` and one `<h1>` in every world; panels are `<h2>` and their
  subheadings `<h3>`, so no level is skipped.
- The chart is `aria-hidden` and paired with a real table of the same series.
- The recent strip becomes a horizontal scroller at 640 and up and contains no
  control, so **the list itself takes focus and carries a name** — a scrollable
  region with nothing focusable inside it is unreachable by keyboard. (Stage 9's
  chooser escapes the same rule only because it is made of buttons.)
- **Colour never carries a fact alone.** A matchweek outcome is a colour AND a
  word; a joker is a colour AND the word "Joker".
- **No display name is ever clipped.** No `text-overflow`, no line clamp;
  `overflow-wrap: anywhere` lets a long name wrap and the block grow. A
  truncated name is the defect contract 191 exists to prevent, arriving through
  CSS instead of through code — and it nearly did: `.recentOutcome` was
  `white-space: nowrap` and a fifty-character name made the page scroll sideways
  by 29 pixels at 375. Only the browser suite could see it.
- Every control clears 44×44.
- Reduced motion changes the arrival transition and never the content. The
  chart is a static drawing either way.

---

## 11. ARCHITECTURE

The Stage 8/9 shape exactly:

```
three reads  →  PlayerProfileSource  →  buildPlayerProfileModel  →  PlayerProfileModel  →  components
```

- `src/vnext/models/playerProfile.ts` — the presentation contract and its
  selectors. Imports nothing.
- `src/vnext/integration/playerProfile/playerProfileSource.ts` — what the
  application hands the page, with each read's outcome.
- `…/buildPlayerProfileModel.ts` — pure: no network, no storage, no clock, no
  React. Every state in the output is already a state in the input; this file
  converts payloads and decides no permission.
- `…/useVNextPlayerProfileSource.ts` — fetches and CLASSIFIES. Three concurrent
  reads, an identity carried with the payload, and every write behind the same
  `active` guard.
- `…/VNextPlayerProfileScreen.tsx` — resolves the state, builds the model,
  renders the page.
- `src/vnext/player/` — the visual components. They import models, never
  services, which `tests/vnext/vnextProductionBoundary.test.ts` enforces.

### One change outside the lane, and it is a move rather than an addition

`refusedByPrivacy` lived inside `SeasonPlayerProfileRoute.tsx`. It is now
`seasonProfileRefused`, exported from `seasonPlayerProfile.ts` — the module that
owns the read it describes — and the production route imports it. Same logic, no
behaviour change; the alternative was a second copy of a privacy predicate, which
is the kind of duplication that drifts silently.

It stays a **predicate** rather than a thrown class because
`fetchSeasonPlayerProfile` already has callers that receive the raw error, and
changing its rejection type would change what they see. The two contract-192
reads are new and throw typed refusals, checked with `instanceof` — the
convention `SeasonHeadToHead.tsx` already uses.

---

## 12. ROUTES

**No production route changed.** The vNext profile is reachable only from the
dev-only `/dev/vnext-player` harness, which `/dev/vnext-leagues` navigates to
when a player row is pressed — carrying the two identifiers the doorway emitted.
That path is how the predicate's "a safely addressable permitted player can be
opened from at least one real competition context" is demonstrated against real
data rather than asserted by a fixture.

Two matrix rows are settled by this stage; see
[`vnext-route-migration-matrix.md`](vnext-route-migration-matrix.md) §9.

---

## 13. PRODUCTION ISOLATION

`src/features/season/SeasonPlayerProfileRoute.tsx`, `H2HPage` and every other
production surface are untouched except for the predicate move in §11. The dev
harness is behind `import.meta.env.DEV` at its import site in `App.tsx`, so a
production build resolves that to `false`, tree-shakes the lazy import and emits
no chunk. Nothing in the product's navigation points at it and there is no flag
that turns it on.
