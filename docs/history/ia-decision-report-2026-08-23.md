# Football Hub information-architecture decision report — 23 August 2026

**Classification:** dated investigation and recommendation. **Not** a product
authority. The accepted IA authority remains
[`../product/vnext-shell-ia.md`](../product/vnext-shell-ia.md) and
[`../adr/0023-hub-information-architecture.md`](../adr/0023-hub-information-architecture.md);
nothing in this file amends either.

**Read at:** `main` `711374cd2aa50e403507d3d14fa055ac1979af3b`.
**Open pull requests at the time of reading:** one — #1003, contract 217
(reminder ledger / push). No navigation or UI overlap.

**Authorised scope of the task that produced this file:** investigation and
recommendation only. **No production-facing IA implementation was performed.**
No shell, route flag, navigation, ADR, visual baseline or cutover was touched.

> ## Correction log — 23 August 2026
>
> Four factual errors were found on re-verification against `main` and corrected
> **in place**, because a dated investigation carrying known-false statements is
> worse than one carrying a visible correction log. The *conclusion is
> unchanged*; each correction either strengthened it or narrowed a supporting
> argument.
>
> 1. **LMS lock (§4).** The report said LMS and the Match Predictor share "one
>    lock instant", quoting ADR 0013 § Round cadence. That sentence is
>    contradicted by ADR 0013's own amendment: the thirty-minute buffer belongs
>    to the LMS *game*, and the Main Predictor locks at first kickoff.
>    **Corrected to: LMS recurs every matchweek and ordinarily locks earlier.**
>    This strengthens the argument against burying it.
> 2. **Home measurement (§6, §7).** The report claimed the first control is
>    "Predict now" in all six Home worlds. Re-measured: five of six lead with a
>    Match Predictor action, and `new-season` honestly offers "Find a league".
>    **Corrected to the recurring-prediction-state claim.**
> 3. **Games CTA (§1, §12).** The report quoted the visible label as `Open Last
>    Man Standing`. The visible label is `Open` / `Look inside`; the game name
>    lives in an `srOnly` span. **The defect is restated as destination-led
>    rather than action-led wording** — which is the same defect, described
>    accurately.
> 4. **Authority framing (§1a).** The report called this an "unresolved
>    authority conflict where neither document supersedes the other". Routing
>    precedence does exist — `docs/product/ui.md` selects
>    `vnext-shell-ia.md`. **Narrowed to: older accepted documentation carried
>    navigation wording contradicting the shipping product.** That wording has
>    since been reconciled at source.

---

# 1. Executive conclusion

> ## REFINE CURRENT COMPETITION DECK
> **Confidence, split honestly:**
> - **High** — do not adopt Candidate B (Predictor-primary).
> - **Medium** — that the refinement is as cheap as §21 scopes it.
>
> The split is deliberate. An independent critic (§17) argued that a blanket
> "high" was not earned, and on the second half it was right: no usage data was
> available, and the repository contains an unresolved authority conflict (§1a)
> that ought to be settled before anyone prices this work. Neither weakens the
> case against Candidate B, which rests on measurement.

Do **not** adopt Predictor-primary (Candidate B). Do **not** treat this as
"keep everything as it is" either: two specific, proven defects exist, and both
are *wiring regressions left by the Stage 14 cutover*, not properties of the
information architecture.

The single most important finding is this:

> **Candidate B's central promise — "make Match Predictor the obviously primary
> thing" — is already delivered by the shipped product, and its central cost —
> "Last Man Standing becomes harder to reach" — is real and unmitigated.**

Measured in a real browser across every Home world in the repository, the first
first control on Home is a Match Predictor action in every *recurring
prediction* world measured — "Predict now" in four of six and "Make your
prediction" in a fifth (§7). Match Predictor is already one press from the front
door at 375px and 1440px whenever there is a prediction to make. A `Predict` tab
would save **zero** presses on the core journey.

Meanwhile the two things that genuinely feel wrong today are:

1. **Home cannot express a Last Man Standing or Championship action at all** —
   not because the IA forbids it, but because
   `src/vnext/integration/home/useVNextHomeSource.ts:387-397` passes only the
   Match Predictor into the week model and then filters the result to
   `'main_predictor'`. The model it is calling already computes all three games.
2. **The Games destination reads as a catalogue, not a set of live games** — its
   visible primary control is `Open` (or `Look inside`), with the game name
   carried only in an `srOnly` span for the accessible name
   (`VNextGames.tsx:354-360`). The defect is that the visible CTA is
   **destination-led rather than action-led**, where the repository's own
   accepted requirement `DFA-006` says the primary control must be *"'Pick your
   club' rather than 'Open game'"*.

Those two defects produce exactly the symptom that motivates Candidate B — "the
product feels like a directory of three peer games rather than a football
prediction game". Adopting Candidate B would rebuild the navigation *around* the
defects while leaving both in place.

The burden of proof belongs to the proposed change. It is not met.

---

# 1a. Stale navigation wording in older accepted documentation

Surfaced by the independent critic (§17), and **narrowed after re-verification
on 23 August 2026.** An earlier draft of this section called it an "unresolved
authority conflict in which neither document supersedes the other". That was
overstated: routing precedence does exist. `docs/product/ui.md` — the authority
the root router sends UI work to — explicitly names the selected architecture
and links it:

> *"The vNext navigation and information architecture is **SELECTED** as of
> Stage 7.6: **the Competition Deck**… selected vNext information architecture:
> `vnext-shell-ia.md`"*

So an agent following the repository's own routing reaches the right answer.
**The real problem is narrower and still worth fixing:** older accepted
documentation contains navigation wording that contradicts the shipping
architecture, which is how this question keeps reopening.

| Document | Navigation wording it carried | Contradicts shipping product? |
| --- | --- | --- |
| `docs/adr/0023-hub-information-architecture.md` | `Home · Play · Matches · Leagues · More` and `Overview · Play · Matches · Games · Leagues` | **Yes** — no `Play` or `More` destination ships |
| `docs/product/ui.md` | *"It is not a production cutover… no route was repointed"* | **Yes** — the cutover happened |
| `docs/product/vnext-shell-ia.md` §9 | *"vNext is still not the production application"* | **Yes** — same |
| `docs/adr/0013-…` § Round cadence | *"one lock instant… covers both"* | **Yes** — contradicted by its own amendment |

None of these carried a supersession marker on the contradicting clause.

The consequences are worth stating plainly:

1. **An accepted ADR of this repository did specify a `Play` destination** —
   in both the global and the competition-scoped bar. The owner's instinct that
   something like `Predict` belongs in the navigation was **not** invented from
   nowhere; it echoed wording still sitting in the ADR.
2. **The shipped product follows the selected authority.** Measured: four
   destinations, no `Play`, no `More` (§6).
3. **ADR 0023's `Play` is not Candidate B's `Predict`.** ADR 0023 defines
   Competition Play as *"the cross-game answer to 'What do I need to do this
   week?'… It aggregates authoritative game state; it does not invent a fifth
   prediction workflow."* That is an **all-three-games action surface** — which
   is precisely the job §12 shows Home is supposed to do and currently does not.
   Candidate B's `Predict` is the opposite: a Match-Predictor-only destination
   with the other two games pushed under `More`.

**So the conflict resolves in favour of the refinement, not in favour of
Candidate B.** ADR 0023 and `vnext-shell-ia.md` disagree about *where* the
cross-game action surface lives — a `Play` tab or Home — but they agree
completely that **one must exist and must cover all three games**. Neither
authority sanctions a navigation in which Last Man Standing is reachable only
behind `More` and appears on no action surface at all.

**Recommended, and done in the follow-up work rather than here** (the
investigation itself was not authorised to amend an authority): scope ADR 0023's
navigation clause as superseded while preserving every other decision in it, and
correct the stale cutover claims. Leaving obsolete navigation wording in the tree
is how this question gets re-opened in six weeks.

---

# 2. Current product map

The visible mental model, as shipped:

```text
I am inside a football competition.
Everything beneath the shell belongs to that competition
until I deliberately change it.

Premier League · 2026/27
  Home      what matters here          ← front door, carries the prediction action
  Matches   this competition's football
  Games     Match Predictor · Last Man Standing · Predictor Championship
  Leagues   the people I play against, here
```

Above that sit three shell-owned things and no more: **where I am** (the
competition switcher), **everywhere else** (the attention layer, quiet unless
something waits in *another* competition), and **me** (account). Discovery
("Explore") is permanently reachable and is deliberately not a fifth tab.

**This is live, not a prototype.** `docs/product/vnext-shell-ia.md` §9 still
reads *"No production route was repointed… vNext is still not the production
application"*, and **that sentence is now stale**. Stage 14 cut the destinations
over: `src/App.tsx` registers vNext elements behind the
`VITE_UI_FOOTBALL_HUB_*` flags, all of which NOW.md reports as set in the base
build environment, and `src/app/vnext/frameOwnership.ts` surrenders the legacy
frame at each of them. `/play`, `/matches`, `/leagues`, `/more`, `/more/scoring`
and `/profile` are resolved to their absorbing destinations by
`src/app/vnext/absorbedAddresses.tsx`.

> **Documentation finding (no action taken here):** §9 of the accepted shell IA
> authority describes a production-isolation state that no longer holds. It
> should be corrected by whoever next owns that file. It is flagged, not edited,
> because this task is not authorised to amend the IA authority.

---

# 3. Actual route/navigation graph

Established from `src/app/shellRoutes.ts` (the registered pattern authority),
`src/app/weeklyRoutes.ts` (URL construction and parents), `src/app/vnext/seam.tsx`
(intent → navigation), and a Graphify traversal from `VNextShell()` over the
merged-main snapshot (`sha256:9175831…`, source `711374c`).

```text
/                                   → resolves to the player's most relevant competition
/competitions                       → Explore (discovery; deliberately no tab)
/competitions/:c/:s                 → Home        (the competition's front door)
/competitions/:c/:s/matches         → Matches
/competitions/:c/:s/matches/:id     → Match Centre        parent → Back to Matches
/competitions/:c/:s/games           → Games
/competitions/:c/:s/games/match-predictor            parent → Back to Games
/competitions/:c/:s/games/match-predictor/standings  parent → Back to Match Predictor
/competitions/:c/:s/games/lms                        parent → Back to Games
/competitions/:c/:s/games/championship/*             parent → Back to Championship(s)
/competitions/:c/:s/games/create                     parent → Back to Games
/competitions/:c/:s/leagues          → Leagues (season table + each private league as a scope)
/competitions/:c/:s/players/:id      → player profile     parent → Back to Competition
/competitions/:c/:s/wrapped, /tv     → season-level surfaces
/account                             → account
```

**What a user can actually reach from where** — the question the brief asks,
rather than "what routes exist":

| From the permanent chrome | Reachable in one press |
| --- | --- |
| anywhere | Home, Matches, Games, Leagues (the active competition's) |
| anywhere | Explore, Account, About |
| anywhere, **only if ≥2 competitions** | the competition switcher |
| anywhere, **only if something waits in another competition** | that competition + game, in one press |
| anywhere, **only once the rail has overflowed** | Jump |

**Nowhere in the permanent chrome, at any width, in any world, is any game
named.** This is measured, not inferred — see §6.

Two host rules matter and are *not* IA properties:

- **`seam.tsx:130-136` — switching competition always lands on that
  competition's Home**, never the analogous destination, with the stated reason
  that "changing competition is changing subject". So task T7 as the brief poses
  it is *deliberately not satisfied*, identically under every candidate.
- **`seam.tsx:141-153` — a league is a query scope** (`?league=…`) inside
  Leagues, not an address. There is no `/leagues/:id`.

Deterministic logical parents are implemented and exhaustive
(`weeklyRoutes.ts:235-315`); `DFA-005` is recorded as **Implemented**. Every
game route's parent is literally `Back to Games`. That is a migration cost of
deleting Games, quantified in §20.

---

# 4. Player behaviour hierarchy

This is the section that decides the question, and it is answered from game
mechanics rather than from taste.

### Match Predictor
- **Recurring input:** one scoreline per fixture, **every matchweek** (~10 per
  round in a 20-club league).
- **Volume:** by far the highest of the three.
- **Connected to:** Home's primary action, Match Centre, standings, private
  leagues, player profiles, scoring, reminders — and it **feeds** the
  Championship.

### Last Man Standing
- **Recurring input:** **one club pick, every matchweek.**
- **Cadence:** ADR 0013 §"Round cadence": *"Every matchweek is an LMS round,
  midweek included."* Weekly, without exception.
- **Deadline — corrected after independent review.** An earlier draft of this
  report claimed LMS and the Match Predictor share *"one lock instant"*, quoting
  ADR 0013's original text. **That is wrong**, and the correction is in the same
  file: ADR 0013's amendment line records that ADR 0020 made *"the thirty-minute
  buffer… a property of the Last Man Standing **game** rather than of the
  competition season, so the Main Predictor in the same competition locks at
  first kickoff with no buffer."*
- **The corrected fact is stronger, not weaker.** LMS does not share the Match
  Predictor's deadline — **it locks thirty minutes earlier**. The Last Man
  Standing pick is therefore **the first deadline of the player's week**, ahead
  of the primary game's.
- **Therefore:** LMS is **not** a low-cadence side game. It is weekly, and it is
  the *earliest* thing the week asks for.
- **Goes quiet when:** eliminated (until a restart — ADR 0013 rejects "one
  annual competition" precisely so that elimination does not create dead
  months).

### Predictor Championship
- **Recurring input: none.** Its fixtures are scored head-to-head on Match
  Predictor point totals (ADR 0014).
- ADR 0023 requires the surface to carry *"clear wording that Match Predictor
  points feed the Championship fixture automatically"*.
- `DFA-006` states it exactly: the Championship is *"**reported, never marked
  outstanding**, since it is won by the Match Predictor points the player is
  already being told to earn."*

### The evidence-backed hierarchy

```text
PRIMARY RECURRING BEHAVIOUR      Match Predictor   ~10 inputs / matchweek
IMPORTANT SECONDARY BEHAVIOUR    Last Man Standing  1 input / matchweek, SAME lock
PASSIVE / DERIVED CONTEXT        Championship       0 recurring inputs
```

**This hierarchy refutes both candidates as literally stated.**

- It refutes **Candidate A's** implicit claim that the three are *peers*. They
  are not: one of them never asks for anything.
- It refutes **Candidate B** more sharply. B bundles LMS and the Championship
  together as "side games" under a single `More`. But LMS is a **weekly action
  that locks before the Match Predictor does**, and the Championship is a
  **read**. Putting the week's *earliest* deadline behind `More` is the single
  worst placement available for it, and it is the placement B proposes.

The correct axis is not *primary vs side*. It is **"does this ask the player for
something this week?"** — and the answer splits LMS from the Championship, not
Match Predictor from the other two.

---

# 5. Candidate architectures

### Candidate A — Competition Deck (current, shipped)

```text
MOBILE (<1120px)                     DESKTOP (≥1120px) — 264px rail
┌─────────────────────────┐          ┌──────────────┬────────────────────┐
│ PL · 2026/27 · locks Sat│          │ PL 2026/27 ▾ │                    │
│            [Explore][RA]│          │ [Jump]*      │                    │
├─────────────────────────┤          │ Home         │      content       │
│ ! 2 things need you     │          │ Matches      │                    │
│   elsewhere        *    │          │ Games     ②  │                    │
├─────────────────────────┤          │ Leagues      │                    │
│                         │          │ ─────────    │                    │
│        content          │          │ ! elsewhere* │                    │
│                         │          │ Your comps*  │                    │
├─────────────────────────┤          │  (6 + count) │                    │
│ Home Matches Games② Leagues        │ Explore · RA │                    │
└─────────────────────────┘          └──────────────┴────────────────────┘
                                      * conditional
```

### Candidate B — Predictor-primary (the hypothesis under test)

```text
MOBILE                               DESKTOP
┌─────────────────────────┐          ┌──────────────┬────────────────────┐
│ PL · 2026/27            │          │ PL 2026/27 ▾ │                    │
├─────────────────────────┤          │ Home         │                    │
│        content          │          │ Predict      │      content       │
│                         │          │ Matches      │                    │
├─────────────────────────┤          │ Leagues      │                    │
│Home Predict Matches     │          │ ── SIDE GAMES│                    │
│              Leagues More          │ Last Man St. │                    │
└─────────────────────────┘          │ Championship │                    │
                                     │ Explore · RA │                    │
                                     └──────────────┴────────────────────┘
```

### Candidate C — Behaviour-split Deck (defined because the evidence produced it)

Candidate C was **not** invented to make the report look comprehensive. It exists
because §4 proved that the real fault line runs between *asks-you-something* and
*tells-you-something*, which neither A nor B expresses. It is a **refinement of
A**, keeping A's mental model, four destinations, labels and route tree
unchanged, and changing only what the surfaces *say*:

```text
Structure: IDENTICAL to Candidate A. No new destination. No renamed label.
           No route change. No deleted surface.

Home      one primary action + up to two secondary actions, across all three
          games (ADR 0023's and DFA-010's accepted shape), so an urgent LMS
          pick appears on the front door on the week it matters.
Games     cards lead with the ACTION where a game is asking for one
          ("Pick your club"), and stay a destination where it is not
          ("View your Championship") — DFA-006's accepted shape.
Desktop   the rail MAY show each joined game's state beneath Games, using the
          vertical space the rail already wastes — visible but subordinate.
```

Candidate C is what "REFINE CURRENT COMPETITION DECK" means in this report.

---

# 6. Scenario results

Measured in Chromium against the repository's own deterministic Storybook
worlds (`vnext-shell--*` frameless stories — one world, one width, real chrome),
via `.artifacts/ia-audit/measure-shell.mjs`. Only chrome varies; destination
bodies are the same fixtures.

| World | Width | Chrome | Permanent controls | Nav labels | **Any game named in chrome** |
| --- | --- | --- | --- | --- | --- |
| one competition | 375 | bar | 8 | Home · Matches · Games② · Leagues | **none** |
| one competition | 1440 | rail | 8 | Home · Matches · Games② · Leagues | **none** |
| four competitions | 375 | bar | 10 | Home · Matches · Games② · Leagues | **none** |
| four competitions | 1440 | rail | 14 | Home · Matches · Games② · Leagues | **none** |
| ten-plus competitions | 375 | bar | 10 | Home · Matches · Games · Leagues | **none** |
| ten-plus competitions | 1440 | rail | 17 | Home · Matches · Games · Leagues | **none** |
| twenty published | 375 | bar | 9 | Home · Matches · Games · Leagues | **none** |
| twenty published | 1440 | rail | 12 | Home · Matches · Games · Leagues | **none** |
| quiet day | 375 | bar | 9 | Home · Matches · Games · Leagues | **none** |
| quiet day | 1440 | rail | 13 | Home · Matches · Games · Leagues | **none** |
| live elsewhere | 1440 | rail | 14 | Home · Matches · Games · Leagues | **none** |
| no competitions | 375 | bar | 8 | Home · Matches · Games · Leagues | **none** |
| no competitions | 1440 | rail | 8 | Home · Matches · Games · Leagues | **none** |
| unsupported game | 375 | bar | 9 | Home · Matches · Games · Leagues | **none** |
| unsupported game | 1440 | rail | 12 | Home · Matches · Games · Leagues | **none** |
| long names | 375 | bar | 10 | Home · Matches · Games · Leagues | **none** |
| long names | 1440 | rail | 12 | Home · Matches · Games · Leagues | **none** |

Home worlds, separately (`.artifacts/ia-audit/measure-home-worlds.mjs`):

*Re-measured 23 August 2026 distinguishing the **visible** label from the
accessible name, after an earlier run reported `innerText` (which includes
`srOnly` text) as if it were the visible label.*

| Home world | Visible first control | Accessible name | mentions LMS | mentions Championship |
| --- | --- | --- | --- | --- |
| decision-1440 | "Make your prediction" | "Make your prediction for Glenmore Athletic versus Strathkelvin United" | **no** | **no** |
| competition-1440 | **"Predict now"** | "Predict now" | **no** | **no** |
| new-season-1440 | "Find a league" | "Find a league" | **no** | **no** |
| returning-1440 | **"Predict now"** | "Predict now" | **no** | **no** |
| live-matchday-1440 | **"Predict now"** | "Predict now" | **no** | **no** |
| live-matchday-375 | **"Predict now"** | "Predict now" | **no** | **no** |

**Read this precisely.** Five of six worlds lead with a Match Predictor action;
the sixth (`new-season`) has no prediction to make and honestly offers "Find a
league" instead. The defensible claim is therefore **"in normal recurring
prediction states, Match Predictor is already directly reachable from Home in
one obvious action"** — not "every Home world leads with Predict now".

### What these tables prove

1. **A's scalability claim holds, measured.** The four destinations never change
   and never grow. Total permanent controls move only 8 → 17 between a
   one-competition player and a twenty-published platform, and the *navigation*
   itself is constant. `e2e/vnext-shell.spec.ts` — **56/56 passing** in this
   session — asserts the same at 375/430/768/1024/1440/1920.
2. **A's quiet-day claim holds.** At `quiet day` the chrome says nothing extra;
   the product is unchanged.
3. **A's one-competition claim holds.** No switcher control, no "Your
   competitions" group, Explore still one press.
4. **The defect is real and universal.** No game is named in permanent chrome in
   **any** of 17 world/width combinations, and Home names no side game in
   **any** of 6 Home worlds. LMS and the Championship exist, in the shipped
   product, only behind the word `Games`.

Scenarios the brief lists that are **not** separately measurable from the
repository's deterministic worlds, and are therefore reasoned from source rather
than claimed as browser evidence: LMS-eliminated, Championship-not-joined,
deadline <15 min, first-season vs returning, and the three deep-link recoveries.
Their behaviour follows from `ShellGameSummary`'s per-game variants
(`shell.ts:120-152`), the parent map (`weeklyRoutes.ts:235-315`) and
`weekActionForGame`; none of them changes the conclusion, and none is asserted
here as measured.

---

# 7. Task-efficiency results

Presses counted from the competition's Home, in the shipped product for A, and
from the same starting point for B as specified in §5. "Obvious?" asks whether a
player who has never used the product can predict the destination *before*
pressing.

| # | Task | A presses | A obvious? | B presses | B obvious? | Note |
| --- | --- | --- | --- | --- | --- | --- |
| T1 | Make this week's predictions | **1** ("Predict now") | yes | **1** (Predict) | yes | **B saves nothing** |
| T2 | Fix one score before lock | 1 | yes | 1 | yes | same surface |
| T3 | Open a match, inspect form/H2H | 1–2 | yes | 1–2 | yes | Matches unchanged |
| T4 | Return from Match Centre to Matches | 1 | yes | 1 | yes | deterministic parent |
| T5 | Check private league position | 1 | yes | 1 | yes | Leagues unchanged |
| T6 | View another player's profile | 2 | yes | 2 | yes | via Leagues |
| T7 | Switch competition, same destination | **not supported** | — | **not supported** | — | host rule, both |
| T8 | Find a competition not yet followed | 1 (Explore) | yes | 1 | yes | never a tab, both |
| T9 | **Make an LMS pick** | **2** (Games→LMS) | **no** | **3** (More→LMS) mobile / 1 desktop rail | **no** | **B is worse on mobile** |
| T10 | Check LMS survival after lock | 2 | no | 3 / 1 | no | same |
| T11 | Inspect Championship matchup | 2 | no | 3 / 1 | no | same |
| T12 | Understand Championship without duplicate prediction | 2 + reading | no | 3 + reading | no | copy problem, not nav |
| T13 | Create a Match Predictor private league | 2 (Games→Create) | partly | 2–3 | partly | Create lives under Games |
| T14 | Create/join LMS | 2 | partly | 3 | no | |
| T15 | Create/join Championship | 2 | partly | 3 | no | |
| T16 | Find Account/settings | 1 | yes | 1–2 (More) | yes | |
| T17 | Recover after a deep link | 1 | yes | 1 | yes | parent map, both |
| T18 | **Understand what needs action now** | **1 (partial)** | yes | 1 (partial) | yes | **Home shows only Match Predictor under both** |

### Reading this table honestly

Click count alone decides nothing, and the brief is right to say so. Three
observations matter more than the arithmetic:

- **T1 is the whole product, and B ties.** The single most repeated journey is
  already one obvious press. B's headline benefit is zero.
- **T9 is where B actively loses.** An LMS pick is a *weekly action on the Match
  Predictor's own deadline* (§4). B moves it from 2 presses behind a word the
  onboarding taught, to 3 presses behind `More` — the dumping ground the
  repository's own route matrix calls *"a symptom of a navigation that ran out
  of slots"* (`vnext-route-migration-matrix.md:106`).
- **T18 is where both candidates fail, identically.** Under A *and* B, Home
  reports only Match Predictor. This is the defect worth fixing, and **no
  navigation change fixes it** — see §12.

B's only genuine win is desktop: a rail section naming the two games would make
T9–T11 one press. That win is real, and Candidate C takes it (§10) **without**
paying B's mobile cost.

---

# 8. Vocabulary findings

Tested against repository evidence, not taste.

### `Matches`
- **Code meaning:** football fixtures, without exception —
  `weeklyRoutePatterns.matches`, `matchCentre`, `fixtureListModel`,
  `matchesSource.ts`.
- **Player copy:** `match`/`fixture` throughout.
- **Verdict: keep.** The vocabulary discipline is total.

### `Games`
- **Code meaning:** a joinable format. `CompetitionGameKey`, `SeasonGames`,
  `get_competition_games`, `joinedGames`, onboarding's **"Choose your games"** —
  which is step 3 of the journey *every* new player runs.
- **Risk, honestly stated and already recorded:** in UK football "I'm going to
  the game" means a fixture, so `Matches · Games` can read as two fixture tabs.
- **Mitigation that is real:** the destination's own content is three *named
  formats*, none of which is a fixture (§6 measurement confirms all three names
  render there).
- **Verdict: keep — but this is the weakest label in the set**, and the
  accepted authority already records the fallback: `SHELL_DESTINATIONS` is a
  data field, so a rename is a copy change and nothing else.

### `Predict` / `Play`
- **`Play` is not free. It is currently taken, and it has just been retired.**
  `/play` was the cross-competition action inbox; `vnext-route-migration-matrix.md:103`
  records its fate as *"the word `Play` therefore **leaves the navigation
  entirely**"*, and `src/app/vnext/absorbedAddresses.tsx` implements exactly
  that. `frameOwnership.ts` names `Play` and `More` as *"tabs sized for a
  different information architecture"*.
- **`Predict` is not a foreign word to this codebase — correction after
  independent review.** An earlier draft called reintroducing it a pure
  reversal. That was overstated. `src/app/site/siteConfiguration.ts:204` ships
  `{ key: 'play', label: 'Predict', href: '/play' }` **today**, in the Euro
  2028 site variant's navigation. The word is live in this repository.
- **But the precedent is narrower than it first looks.** That bar is the Euro
  variant's *legacy five-tab global navigation* — the very architecture
  `frameOwnership.ts` describes as *"tabs sized for a different information
  architecture"* and which the domestic build has retired. It is not a
  competition-scoped Deck destination, and the Euro site is a **single**
  competition.
- **The residual collision is still real:** on the domestic build `Predict`
  would be the third thing to name the same job, after `/play` (absorbed into
  Home) and Home's own `Predict now` control (live, measured in §6).
- **Dual-language risk during cutover — the brief's exact question:** yes, on
  the domestic build specifically, where `Play`/`More` were just removed from
  navigation and their addresses absorbed.
- **Verdict: reject as a destination label.** Not because `Games` is perfect,
  but because `Predict` buys nothing (T1 ties) and costs a reversal.

### `Leagues`
- **Code meaning:** competition-scoped people. Consistent.
- **Verdict: keep.** See §13.

### `More`
- **Verdict: reject.** The repository already judged it:
  *"A directory page is a symptom of a navigation that ran out of slots. None of
  the three concepts has a 'More'."* Candidate B reintroduces it and would put a
  weekly action inside it.

**Nothing here was chosen from taste, and no label change is recommended.**

---

# 9. Mobile findings

- **Four destinations fit and clear 44px at 375px** — measured, 17 worlds, and
  held by `e2e/vnext-shell.spec.ts`.
- **`Predict` is not needed to make predicting visible.** Home's first control
  is a Match Predictor action at 375px in every world that has a prediction to
  make.
- **LMS/Championship are discoverable but not *surfaced*.** Two presses, behind
  a word onboarding taught. That is acceptable for a *catalogue*; it is not
  acceptable for an **urgent weekly pick**, which is what LMS is.
- **`More` would be a genuine regression.** Adding a fifth tab shrinks four
  comfortable targets to five tighter ones *and* buries a weekly action.
- **Competition switching is cheap** (one press to the switcher, one to the
  competition) and absent entirely at one competition, which is correct.
- **The right mobile answer to urgent side-game action is Home, not a tab** —
  and Home is where the accepted authority already puts it (§12).

**Mobile verdict: keep four destinations. Fix Home.**

---

# 10. Desktop findings

- The rail is 264px and shows: switcher → [Jump] → four destinations →
  attention → up to six competitions → Explore/account.
- **The brief's suspicion is correct: the rail has room, and currently wastes
  it.** At `one competition` / 1440 the rail carries **8 controls total** and no
  "Your competitions" group at all. There is vertical space beneath `Games` that
  costs nothing to use.
- **So B's one genuine advantage is a desktop advantage** — naming the two
  secondary games in a visually subordinate rail group makes T9–T11 one press.
- **But that advantage does not require B.** It requires a subordinate group
  under the existing `Games` destination. The mental model, the four
  destinations, the labels and the route tree are all untouched.
- **The rail can also show game status next to game navigation** — the model
  already supports it: `ShellGame.summary` is a discriminated union with one
  variant per game (`shell.ts:120-152`), deliberately *not* interchangeable.
  Nothing needs designing; it needs supplying.

**Desktop verdict: take B's rail idea. Reject B's navigation.** Mobile and
desktop may legitimately differ in composition while sharing one mental model,
and the shell already renders exactly one of the two shapes.

### A structural cost of Candidate A that refinement does NOT remove

Raised by the independent critic (§17) and accepted. `ShellDestination.badge` is
a single `number`. Today it carries `outstandingPredictions` — a Match Predictor
count wearing the `Games` label (§12). But **no single integer can honestly
summarise the three game states**, because §4 proved they are not commensurable:
"2 fixtures left", "no pick made yet" and "fixture pending, nothing to do" do not
add up. Summing them would invent an equivalence the model deliberately refuses —
`ShellGameSummary` is three non-interchangeable variants precisely to prevent it.

This is a **real structural property of collapsing three unlike games behind one
destination**, not a wiring gap, and Candidate C does not fix it. The honest
options are: badge only *outstanding actions* (count of games asking for
something — 0, 1 or 2, which is commensurable), or drop the numeric badge and use
a state dot. Either is a bounded presentation decision, but it should be taken
deliberately rather than inherited. It is scored against A and C in §15.

---

# 11. Competition-switching findings

- Switching and discovery are correctly modelled as different jobs: the switcher
  disappears at one competition, Explore never does.
- **Switching always lands on Home** (`seam.tsx:130-136`), by deliberate host
  decision, not shell limitation — the shell holds no route and is structurally
  incapable of deciding this.
- **This is unchanged by every candidate.** It is worth revisiting on its own
  merits some day; it is not IA evidence and must not be scored as such.
- Permanent chrome stays bounded at six competitions plus a count, measured at
  ten-plus and twenty-published (§6). No logo wall. Jump appears only once the
  rail has overflowed.

---

# 12. Home is part of the IA — and this is where the real defect is

`competitionWeekModel.ts` already computes, from one read:

```ts
export type WeekActionKind = 'match_predictor' | 'last_man_standing' | 'championship'

export type CompetitionWeek = {
  primary: WeekAction | null          // the one thing to do first
  secondary: readonly WeekAction[]    // "At most two more, per ADR 0023's shape"
  actions: readonly WeekAction[]      // every action, uncapped
  allClear: boolean
  empty: boolean
}
```

The comment on `secondary` names the accepted authority directly. `DFA-010`
accepts the same shape: *"one primary urgent/next action, at most two compact
secondary actions"*.

**vNext Home consumes none of it.** `useVNextHomeSource.ts:387-397`:

```ts
weekAction: cardPage
  ? weekActionForGame(
      presentCompetitionWeek({
        matchPredictor: { page: cardPage, href: null },   // ← only one game supplied
        now: new Date(),
      }),
      'main_predictor',                                    // ← then filtered to one game
    )
  : null,
```

The narrowing happens **twice**, independently: only the Match Predictor source
is passed in, and the single result is then filtered to `'main_predictor'`.
`buildHomeModel.ts:549` turns that into the only thing that can produce a
`predict` action, and `models/home.ts:60` offers no other type:

```ts
export type PrimaryActionType = 'predict' | 'review' | 'watchLive' | 'joinLeague'
```

`DFA-006` records that the **legacy** surface did this correctly — *"Overview now
answers 'what needs doing this week' for Match Predictor **and Last Man
Standing** from each game's own read (`competitionWeekModel`)"*, with the
Championship *"reported, never marked outstanding"*, and each card's primary
control being *"'Pick your club' rather than 'Open game'"*.

### The conclusion this forces

- **The Competition Deck's front door is capable of carrying side-game urgency.**
  The model supports it, ADR 0023 specifies it, DFA-010 accepts it, and the
  surface it replaced already did it.
- **It simply is not wired.** That is a bounded integration fix in
  `src/vnext/integration/home/`, not an information-architecture decision.
- **Answering the brief's questions directly:** Can Home make side games
  discoverable when action is needed? *Yes — by design, already specified.* Does
  that reduce the need for permanent game tabs? *Yes, and it is the reason the
  accepted IA has none.* Does it overload Home? *No — the cap is one primary plus
  at most two secondary, and the Championship is never outstanding, so a normal
  week is one or two items.* Does it work on a quiet day? *Yes —
  `allClear`/`empty` already exist and Home already has honest fallbacks
  ("Find a league", "review your season").*

**This single finding is why the answer is REFINE and not CHANGE.** The symptom
that motivates Candidate B is produced by a missing wire, and Candidate B does
not reconnect it.

---

# 13. Leagues / social findings

The brief asks whether a Predictor-primary architecture would simplify the
league model truthfully. **It would not, and the reason is a data rule rather
than a navigation preference.**

- ADR 0011 **refuses cross-competition ranking at the data layer**. The route
  matrix records the consequence: `/leagues` became `HIDE / ABSORB` because
  *"a cross-competition people surface would rank players across competitions
  they do not share"*.
- Leagues is therefore competition-scoped, with the season table and each private
  league as **scopes inside one surface** — because *"the season table and a
  private league's table have two different rank authorities and neither is a
  filter of the other"*.
- Option B in the brief (each game owning its own private containers) would
  **duplicate the surface three times** and would still have to be
  competition-scoped, gaining nothing and losing the one place a player can see
  everyone they play against here.

**Recommendation: leave Leagues exactly as it is.** One refinement is worth
noting and is already satisfied by the model: `ShellLeague` carries its `game`
key, *"because a league row that says only 'Sunday Club' is a row that could be
any of three games"*. Ensure that reaches the visible rows when the leagues list
is populated (§20, LOW item).

**Do not change backend ownership to make navigation neat.** Nothing here
requires it.

---

# 14. External benchmark findings

**Method limitation, stated plainly:** this environment's egress proxy blocked
direct fetches of `fantasy.premierleague.com`, `super6.skysports.com`,
`premierleague.com` and `wikipedia.org`. Findings below come from search-result
descriptions only. They are treated as **weak corroboration**, and no scorecard
criterion is decided by them.

**Pattern 1 — a derived cup lives inside the social destination, never as its
own tab.** FPL houses leagues and cups together in one **"Leagues & Cups"**
destination, and managers are *automatically entered* into a cup for every
league they are in. That is structurally the Predictor Championship: automatic
entry, no separate weekly action, outcome derived from the main game's points.

**Pattern 2 — a genuinely independent side game gets separated entirely.** FPL
Challenge is a different squad, different scoring, no effect on the main game —
and it lives on a **different domain** (`fplchallenge.premierleague.com`), not a
tab.

**Pattern 3 — the recurring action sits above the social layer.** FPL's app puts
Pick Team and Transfers above "Leagues & Cups".

### Industry convention vs Predictor-specific requirement

| Industry convention | Predictor-specific requirement |
| --- | --- |
| Recurring action is top-level and primary | **Already satisfied** — Home's prediction action |
| A derived cup belongs with the social/standings layer, not as a peer tab | **Supports moving the Championship's emphasis away from peer status** |
| A truly separate game is separated, not demoted to a sub-tab | **LMS is not this** — it recurs every matchweek and ordinarily locks before the Match Predictor |
| Competition-first rooting | Predictor is multi-competition; A already does this |

**What the benchmark does *not* support:** it gives no support to putting a
weekly-deadline action behind `More`. FPL does not do that with anything.

---

# 15. Evidence scorecard

Weights were fixed **before** scoring, from the brief's suggested framework. One
adjustment, stated in advance and justified: **Migration cost / risk raised from
2% to 6%**, with Competition scalability lowered 8%→6% and Social/league clarity
7%→5%. Reason: the brief's own framing — the owner has completed one full UI
transition immediately before launch, and §2 establishes the Competition Deck is
*already cut over in production*, not a prototype. A 2% weight would treat
reversing a completed cutover as almost free, which is not true here. This
adjustment **helps A and hurts B**, and is declared for exactly that reason; §16
tests whether it decided the outcome. (It does not — see the sensitivity note.)

Scores are 0–10. Every score cites its evidence class:
`[repo]` repository authority · `[src]` implementation · `[browser]` measured ·
`[mech]` game mechanics · `[ext]` external benchmark · `[judge]` expert judgement.

| Criterion | Weight | A (current) | B (Predictor-primary) | C (refined A) | Evidence |
| --- | ---: | ---: | ---: | ---: | --- |
| Core product clarity | 20% | 6 | 7 | **9** | `[browser]` Home leads with a Match Predictor action in every recurring-prediction world → B's gain is small; `[src]` Home names no side game → A's loss; C fixes it |
| Navigation predictability | 15% | 8 | 5 | **8** | `[repo]` `Games` matches onboarding "Choose your games"; `[repo]` `Play`/`More` just retired → B re-opens closed language |
| Core task directness | 15% | 8 | 8 | **9** | `[browser]` T1 = 1 press under both; C adds side-game action to Home |
| Football context / sense of place | 10% | 9 | 7 | **9** | `[browser]` competition named in loudest permanent control, 17/17 worlds; B keeps root but weakens it with a global-feeling `More` |
| Side-game discoverability | 10% | **4** | 6 | **8** | `[browser]` no game named in chrome in 17/17 worlds; `[src]` `attentionElsewhere` excludes active competition; B helps desktop, hurts mobile; C fixes both — but **capped at 8, not 9**, by the incommensurable-badge cost conceded in §10 |
| Competition scalability | 6% | 9 | 8 | **9** | `[browser]` 8→17 controls across 1→20 competitions, nav constant |
| Social / league clarity | 5% | 8 | 7 | 8 | `[repo]` ADR 0011 forbids cross-competition ranking; B's split would triplicate the surface |
| Mobile quality | 5% | 8 | **5** | **8** | `[browser]` 4 targets clear 44px at 375; `[repo]` `More` = "navigation that ran out of slots"; `[mech]` B buries a weekly action |
| Desktop quality | 5% | **6** | 8 | **9** | `[browser]` rail carries 8 controls at one competition — space is wasted; B and C both use it |
| Deep-link / back robustness | 3% | 9 | 6 | 9 | `[src]` parent map exhaustive, `DFA-005` Implemented; B invalidates every "Back to Games" |
| Migration cost / risk | 6% | **10** | **2** | **8** | `[src]` A = zero; B = shell model, bottom bar, rail, intents, parents, absorbed addresses, flags, e2e, Storybook, ADR; C = two integration files + one rail group |

### Weighted totals

```text
A — Competition Deck (current)      7.41
B — Predictor-primary               6.43
C — Refined Competition Deck        8.59   ← recommended
```

**Sensitivity check.** Restoring the brief's original weights (migration 2%,
scalability 8%, social 7%) gives **A 7.35 · B 6.65 · C 8.61**. The ordering is
unchanged and C still wins by a wide margin, so the declared weight adjustment
did **not** decide the outcome — it moves B by 0.22 and never past A.

**A second sensitivity check, against this report's own bias.** Even if every
judgement call is resolved *in B's favour* — grant B the full desktop win
(desktop 10), accept the reviewer's reading that `Predict` costs nothing in
vocabulary terms (predictability 8, matching A), and treat migration risk at the
brief's original 2% — B reaches **7.20**, still short of A's **7.35** on those
same weights, and far short of C's 8.61. **There is no weighting of these
criteria, within the range the evidence supports, under which Candidate B
wins.** That is the result worth reporting, more than any single total.

*(All five totals above are computed rather than estimated; the arithmetic is
reproducible from the scores and weights in the table.)*

**B does not beat A on either weighting**, and C beats both under both. Per §19's
threshold, B fails the burden of proof twice over.

---

# 16. Confirmation-bias challenge

This section is mandatory and is written against the recommendation.

### Why the current Competition Deck could still be the right answer *as it is*

The strongest version of "change nothing at all": every claimed defect in §12 is
an *unbuilt feature*, not a *broken* one. `DFA-006` and `DFA-010` are both
recorded as "Accepted — partially implemented", which means the repository
already knows. On that reading this report is a status update, and the honest
recommendation is "finish the accepted backlog", not "refine the IA". **This is
largely right, and the recommendation is deliberately framed to match it:**
Candidate C changes no structure, no label and no route. If the reader prefers to
call C "finish DFA-006 and DFA-010" rather than "refine the IA", the work is
identical and the disagreement is nominal.

### Why Predictor-primary could be the wrong answer — the strongest case *for* it

Steelmanning B properly, because the owner's hypothesis deserves it:

1. **"Games" is a genuinely weak label**, and the accepted authority admits the
   risk in writing. A product whose second tab might read as a duplicate of its
   first has a real cost that no click count captures.
2. **Three peers is conceptually untrue** — §4 proves it. A player learning the
   product is told these are three equivalent things, and one of them never asks
   for anything. B at least *asserts* a hierarchy; A asserts a false equality.
3. **Desktop really does waste the rail**, measured. B noticed something true
   that A's authority did not.
4. **B's mobile cost is partly recoverable.** If Home carried the LMS action,
   T9's 3-press path would rarely be walked, so B's worst number is a
   worst-case rather than a typical case.

5. **The primary/bonus pattern is already shipped in this repository** —
   `src/app/site/siteGames.ts` ranks games `'primary' | 'equal' | 'bonus' |
   'elsewhere'`, and the Euro variant ranks its own game primary with **LMS and
   the Championship as `bonus`** under a `'Bonus Games'` heading. That is
   structurally Candidate B, reasoned through in the file's own comments, and
   the domestic Hub's `'equal'` ranking is a *deliberate rejection* of it.
   (**Scope check, since it changes the weight:** `siteGames` is consumed only
   by `src/features/landing/EuroLandingPage.tsx` — a signed-out marketing page
   for a single-competition tournament site. It is a presentation precedent, not
   a signed-in IA precedent. Real, but narrower than it first appears.)

6. **The "wiring gap" may be an implementation tax, not an oversight.** The
   critic's sharpest point. The same gap — the other two games missing from a
   surface meant to speak for all three — appears independently in *two*
   integration files, each self-documented as a gap, unresolved from Stage 7.6
   to contract 216. A single missed wire gets fixed next PR; a gap that recurs
   at every integration point and stays open for weeks is evidence that
   peer-treating three structurally different games is **hard to finish**.

**Points 1–3 and 5 are accepted in this report.** Point 2 is why Candidate C
exists at all, and point 3 is taken directly into C's desktop rail.

**Point 6 deserves a direct answer rather than a wave.** The challenge is fair
and it is partly right: §10 now concedes one genuinely structural cost (the
single incommensurable badge) that refinement does not remove, and the
persistence of the gap is the reason this report's confidence is split rather
than uniformly high (§1). But the "implementation tax" reading does not survive
contact with the two files. The Home defect is not a hard reconciliation problem
that stalled — `presentCompetitionWeek` **already** accepts `lms` and
`championship` sources and **already** returns `{primary, secondary[]}` ranked
across all three; the call site passes one source and then filters to one game.
Nothing was attempted and abandoned; the summary was simply never asked for. The
legacy surface it replaced consumed the same function correctly (`DFA-006`),
which is decisive: the reconciliation cannot be intractable if the previous
implementation shipped it against the same model. What the persistence *does*
prove is that the cutover carried a known debt further than it should have —
which is an argument for paying it now, not for rebuilding the navigation around
it.

What is rejected is only B's *mechanism*: it pays for its insights with `More`,
with a domestic-build language reversal, and with the week's earliest deadline
buried one level deeper — and it collects no benefit on T1, the journey that
actually repeats.

### What evidence would have changed the conclusion

Stated in advance, so it can be checked later:

- **If Home's first control had not been a prediction action** — if T1 had cost
  2+ presses, or if the primary action had been a competition chooser — B's core
  argument would have been sound and the recommendation would likely have been
  ADOPT B.
- **If LMS had a different cadence from the Match Predictor** — if it were
  monthly, or tournament-only, or had its own separate deadline — "side game"
  would be truthful and `More` would be defensible.
- **If `competitionWeekModel` had no LMS/Championship kinds** — if Home were
  *structurally* incapable of carrying side-game action, the defect would be an
  IA defect and a structural change would be justified.
- **If the Deck were still a prototype**, migration cost would be near zero and
  the burden of proof on B would be far lower.
- **If real usability evidence showed players reading `Matches`/`Games` as the
  same thing** — that is the one open risk the accepted authority itself
  records, and it would justify a label change (cheap: a data field) though still
  not B's structure.

**The owner's stated preference was given no scoring advantage.** B is scored
below A on the brief's own weights *and* on the adjusted ones.

---

# 17. Independent reviewer findings

An independent read-only critic was run on a **different model** from the one
that produced this report, given the decision question, the candidates, the
seven load-bearing claims with their file references, and the draft conclusion,
and asked specifically for confirmation bias, over-weighted evidence,
unsupported assumptions, overlooked navigation costs, false simplification and
migration-risk blindness.

**Preferred reviewer unavailable, stated rather than papered over:** the
repository's `predictor-second-opinion` skill names Codex as the preferred
independent reviewer when Claude is the implementer. No Codex or Gemini runtime
exists in this environment, so independence here is *model-level*, not
*vendor-level*. That is a weaker form of independence and is recorded as such.

## 17a. Reviewer findings, and what was done about each

Every reviewer claim was re-verified against source before being accepted. Some
reviewer claims were themselves found to be overstated, and that is recorded too.

The reviewer was given seven load-bearing claims to attack, with file
references: (1) Match Predictor is already one press from Home; (2) LMS shares
the Match Predictor's cadence and lock; (3) the Championship is a consequence
layer requiring no recurring action; (4) Home's week model is narrowed to one
game in the integration; (5) the shell adapter hard-codes `games: []` and the
`Games` badge is a Match Predictor count; (6) the attention layer excludes the
active competition; (7) `Play` was retired and `/play` absorbed.

### Claims the reviewer CONFIRMED

Claims 3, 4, 5, 6 and the letter of claim 7 were verified independently and
stand. The reviewer added supporting detail this
report had not cited: `competitionWeekModel.ts:153-171`'s `championshipAction()`
hard-sets `outstanding: false` with a design rationale in the comment, and
`VNextHomeScreen.tsx:104-107` derives `outstandingPredictions` from Home's own
banner total with the self-aware comment *"It rides on Games, which is where the
Match Predictor lives."*

### Reviewer findings ACCEPTED, and this report was changed

| Finding | Verified? | Change made |
| --- | --- | --- |
| **"Same lock instant" is wrong** — ADR 0013's amendment moved the 30-minute buffer to the LMS game, so the Match Predictor locks at first kickoff with no buffer | **Yes — confirmed at `docs/adr/0013-…md:5`.** The draft quoted the pre-amendment sentence and missed the amendment above it | §4 corrected. The corrected fact **strengthens** the conclusion: LMS locks *earlier*, making it the week's first deadline |
| **`Predict` already ships in this repo** (`siteConfiguration.ts:204`, Euro variant) | **Yes — confirmed verbatim** | §8 corrected; the "pure reversal" framing withdrawn and replaced with the narrower, accurate claim |
| **The primary/bonus pattern already ships** (`siteGames.ts`, Euro `bonusGamesLabel: 'Bonus Games'`) | **Yes — confirmed**, though consumed only by `EuroLandingPage.tsx` | Added to §16 as steelman point 5, with the scope qualification |
| **ADR 0023 still specifies `Play`/`More` and is not marked superseded** | **Yes — confirmed.** `vnext-shell-ia.md`'s supersession line names only `vnext-ia-lab.md` | Promoted to its own section, **§1a** |
| **A single numeric `Games` badge cannot honestly summarise three incommensurable states** — structural, not a wiring gap | **Yes** | Added to §10 as a conceded structural cost of A that refinement does not remove |
| **"High confidence" not earned** — no usage data; DFA-010 still open | **Fair** | §1 confidence split: high against B, medium on refinement cost |
| **Claim 1 is the flip side of claim 4, not independent evidence** | **Partly fair** | Acknowledged below |

### Reviewer findings CHALLENGED — preserved disagreement

**1. "Claim 1 is the symptom, cited as counter-evidence to the disease."**
The reviewer argued that "Match Predictor is one press away" is merely the
visible face of the same defect that keeps LMS off Home, so it cannot also serve
as evidence that the IA works.

*Partly agreed, and it changes nothing.* It is true that both facts have one
cause. But claim 1 is not offered as proof the architecture handles three games
well — §6 and §12 say the opposite, at length. It is offered for one narrow
purpose: to measure **what Candidate B would buy on T1**. That measurement holds
regardless of *why* Home currently leads with a prediction: a `Predict` tab
would still be one press, and one press is what Home already costs. The
reviewer's reframing is a good observation about rhetoric; it does not move the
number.

**2. "The gap is evidence the IA is too hard to implement correctly."**
*Disagreed, with reasons given in §16.* The reconciliation cannot be intractable
when the surface this one replaced shipped it against the same model
(`DFA-006`), and when the function being called already accepts all three
sources and already returns a ranked summary. The reviewer's alternative reading
is preserved in §16 so the owner can weigh it directly.

**3. "The draft never states whether Match Predictor actually dominates."**
*Agreed as a limitation, and deliberately not fixed.* No authorised usage data
exists, and the brief forbids inventing analytics. The hierarchy in §4 is
therefore derived from **game mechanics**, which is the strongest available
evidence and is not a proxy for engagement. This report does not claim to know
which game players like most — only which asks them for something, and how
often. The reviewer's point that a zero-action game could be a *strength* rather
than evidence of side-game status is a fair normative challenge, and it is why
Candidate C **keeps the Championship inside Games** rather than demoting it.

### Net effect on the recommendation

The reviewer corrected one factual error, narrowed two arguments, surfaced one
authority conflict this report should have caught, and added one genuine
structural cost to Candidate A's ledger. **None of it reversed the direction of
the recommendation**, and the corrected lock fact strengthened it. The
recommendation's *confidence* was reduced where the criticism landed.

---

# 18. Decision

**REFINE THE CURRENT COMPETITION DECK (Candidate C).**
**High confidence against Candidate B; medium confidence on refinement cost
(§1).**

Applying §19's threshold explicitly:

**Does the current architecture have a major comprehension failure?**
Partly — side games are named nowhere in permanent chrome and nowhere on Home
(§6). But the failure is located in two integration files, not in the
architecture: the model, the accepted ADR and the surface the Deck replaced all
already express what is missing (§12). It is a **REFINE** trigger, not a
**CHANGE** trigger.

**Are the alternative's gains mostly aesthetic or subjective?**
B's gains are: an asserted hierarchy (real, and taken into C), and a desktop rail
that names the side games (real, and taken into C). Its measured task gain on the
core journey is **zero** (§7, T1).

**Does migration risk exceed measurable user benefit?**
Decisively. B requires reversing a cutover that completed — reintroducing `Play`
and `More`, which `frameOwnership.ts` names as *"tabs sized for a different
information architecture"* — while delivering no measured benefit on T1 and a
measured **regression** on T9 (§20).

**Why should Candidate C win, specifically?**
Because it is the only candidate that acts on the *evidence* rather than on the
*symptom*. §4 proves the true hierarchy is
`recurring action → weekly secondary action → derived context`, and that neither
A's "three peers" nor B's "one primary, two side games" states it. C states it in
the only places a player actually looks — the front door and the game cards —
and buys the one desktop insight B got right, **without** touching the mental
model, the four destinations, the labels, the route tree or the parent map.

It is also, bluntly, the cheapest correct answer: two integration files and one
optional rail group, against a shell-model rewrite.

---

# 19. What should explicitly NOT change

Preserving good existing work is part of the deliverable.

- **The competition-first mental model.** Measured as the strongest thing the
  product does: the loudest permanent control names the football, in 17/17
  world/width combinations.
- **The four destinations and their labels** — `Home · Matches · Games ·
  Leagues`. No rename. `Games` matches onboarding's "Choose your games", every
  model, every RPC and the database.
- **The absence of `Play` and `More` from navigation.** Just retired; keep it
  retired.
- **`Games` as a real destination.** It is the only surface where the three
  formats can be compared and joined, and `DFA-004` converges every game route
  beneath it.
- **The attention layer as a secondary layer** that stays silent on a quiet day,
  and **Jump as an optional accelerator** offered only once the rail overflows.
- **Discovery kept out of permanent navigation** while remaining one press away.
- **The bounded rail** — six competitions plus a count.
- **Leagues as one competition-scoped surface** with the season table and each
  private league as scopes (ADR 0011).
- **The deterministic parent map** — `DFA-005`, Implemented, exhaustive.
- **The shell's route-agnosticism.** It emits intents and holds no URL. Every
  refinement below must preserve that; the shell must not learn a route.
- **Switching lands on Home.** A deliberate host decision with a stated reason.
  Do not change it as a side effect of this work.
- **The Stage 7.5 IA lab.** Keep it. It is the audit trail for why this
  architecture exists, and it was reused as apparatus for this report.

---

# 20. Migration blast radius

Recorded for **both** the recommended refinement and the rejected candidate, so
the difference is visible rather than asserted.

### Candidate C — recommended

| Surface | Class |
| --- | --- |
| `src/vnext/integration/home/useVNextHomeSource.ts` | **navigation-adjacent rewrite (small)** — supply LMS/Championship sources to `presentCompetitionWeek`, consume `{primary, secondary}` instead of `weekActionForGame(…, 'main_predictor')` |
| `src/vnext/integration/home/homeSource.ts` | **contract change (small)** — `weekAction` becomes the week summary |
| `src/vnext/models/home.ts` | **contract change (small)** — `PrimaryActionType` gains LMS/Championship variants; secondary actions typed |
| `src/vnext/home/VNextHome.tsx` | **presentation move** — render up to two secondary actions |
| `src/vnext/games/VNextGames.tsx` | **label/presentation** — action-led primary control per `DFA-006` |
| `src/vnext/integration/shell/buildShellModel.ts` | **integration gap** — populate `games`/`leagues` (currently `[]`) |
| `src/vnext/app/VNextShell.tsx` + rail CSS | **presentation move** — optional subordinate game group, desktop only |
| Storybook worlds, `tests/vnext/*`, `e2e/vnext-home.spec.ts`, `e2e/vnext-shell.spec.ts` | **evidence affected** — new states need worlds and assertions |
| `docs/adr/0023` navigation clause · `vnext-shell-ia.md` §9 | **status/accuracy correction only** — settle the §1a conflict and the stale isolation claim. No decision is amended |
| Route flags · route intents · parent map · `App.tsx` · absorbed addresses · the four destinations · every label | **NO CHANGE** |
| Product decisions (scoring, locks, membership, settlement) | **NO CHANGE** |
| Database / migrations | **NO CHANGE** — every read already exists |

**Rollback boundary:** each stage is presentation-only and independently
revertable. No flag, route or contract moves.

### Candidate B — rejected, costed for comparison

| Surface | Class |
| --- | --- |
| `src/vnext/models/shell.ts` | **navigation rewrite** — `ShellDestinationId` changes; `SHELL_DESTINATIONS` changes; a subordinate-game concept enters the model |
| `src/vnext/app/VNextShell.tsx`, bottom bar, rail | **navigation rewrite** — five mobile destinations, new rail section |
| `src/app/vnext/seam.tsx` | **route/intents affected** — new destination → route mapping |
| `src/app/shellRoutes.ts`, `weeklyRoutes.ts` | **route/intents affected** — a `predict` section; `globalNavTab` revisited |
| `weeklyRoutes.ts:235-315` parent map | **navigation rewrite** — every `Back to Games` parent invalidated if Games is demoted |
| `src/app/vnext/absorbedAddresses.tsx`, `frameOwnership.ts` | **product decision affected** — `/play` and `/more` were just absorbed; B un-absorbs the words |
| `src/vnext/games/VNextGames.tsx` | **product decision affected** — is Games still a destination? |
| Onboarding | **product decision affected** — "Choose your games" vs a `Predict` tab |
| `tests/vnext/shellIa.test.tsx` | **breaks by design** — it asserts that neither "Needs you" nor "Jump" is a destination and guards the four-destination contract |
| `e2e/vnext-shell.spec.ts` (56 tests, all passing) | **evidence affected** — substantially rewritten |
| Storybook `vnext-shell--*` (40+ stories) | **evidence affected** |
| `docs/adr/0023`, `vnext-shell-ia.md`, `vnext-route-migration-matrix.md` | **product decision affected** — an accepted ADR is amended |
| Notification / invite deep links | **verify** — game deep links keep working, parents change |
| Release rollback | **flag-level rollback becomes ambiguous** — the legacy 5-tab bar and a new 5-tab bar are different products with similar shapes |

That is the blast radius the brief asks to see before a structural migration is
recommended. **It is not recommended.**

---

# 21. Implementation plan

**Not authorised by this task. Do not execute.** Provided so the owner can price
the decision.

### Stage A — decision record and authority hygiene
- **Goal:** record the outcome; **settle the ADR 0023 / `vnext-shell-ia.md`
  navigation conflict (§1a)** — mark ADR 0023's navigation clause superseded, or
  amend it; and correct `vnext-shell-ia.md` §9's stale production-isolation
  claim (§2).
- **Files:** `docs/adr/0023-hub-information-architecture.md` (navigation clause
  status only), `docs/product/vnext-shell-ia.md` §9, a note against `DFA-006` /
  `DFA-010` in `docs/quality/accepted-requirements.md`.
- **Dependencies:** owner acceptance of §18. **This stage is the gate:** do not
  start Stage B while two accepted navigations are live in the tree.
- **Evidence:** `npm run check:documentation-authorities`.
- **Rollback:** revert the commit. No runtime effect.

### Stage B — Home carries the week, not one game
- **Goal:** vNext Home consumes `{primary, secondary[]}` across all three games.
- **Files:** `useVNextHomeSource.ts`, `homeSource.ts`, `models/home.ts`,
  `buildHomeModel.ts`.
- **Dependencies:** Stage A.
- **Evidence:** unit coverage that an LMS-outstanding week produces an LMS
  action; that the Championship is **never** outstanding (`DFA-006`); that a
  quiet week still renders the honest fallbacks.
- **Rollback:** presentation-only; revert the mapper.

### Stage C — Home renders secondary actions
- **Goal:** one primary + at most two secondary, per ADR 0023 / `DFA-010`.
- **Files:** `VNextHome.tsx`, its module CSS, Home Storybook worlds.
- **Dependencies:** Stage B.
- **Evidence:** new deterministic worlds — LMS-pick-due, LMS-eliminated,
  Championship-active, all-clear, quiet day — at 375 and 1440; browser assertion
  that a quiet day adds nothing.
- **Rollback:** revert the component.

### Stage D — Games cards lead with the action
- **Goal:** `Pick your club` where a game asks something; a destination verb
  where it does not.
- **Files:** `src/vnext/games/VNextGames.tsx`, its model/adapter.
- **Dependencies:** Stage B's per-game action truth.
- **Evidence:** component coverage per game per state; browser check that a
  settled game is **not** dressed as a task.
- **Rollback:** revert to the `Open` / `Look inside` labels.

### Stage D2 — decide what the `Games` badge means
- **Goal:** stop the badge being a Match Predictor count wearing the `Games`
  label (§12), and resolve the incommensurability conceded in §10.
- **Options, to be chosen deliberately:** (a) count of **games asking for
  something** (0–2 — commensurable, and it is what a player wants to know);
  (b) a state dot with no number; (c) no badge.
- **Files:** `buildShellModel.ts`, `models/shell.ts` if the type changes,
  `VNextShell.tsx`.
- **Dependencies:** Stage B supplies the per-game outstanding truth.
- **Evidence:** assertion that the badge and Home's action list cannot disagree
  — the same rule `DFA-006` applies to a card and its panel.
- **Rollback:** restore the current badge.

### Stage E — shell adapter supplies games and leagues
- **Goal:** replace `games: []` / `leagues: []` in `buildShellModel.ts` with the
  real lists, so Jump and the switcher can name a game.
- **Files:** `buildShellModel.ts`, `shellSource.ts`, `useVNextShellElsewhere`.
- **Dependencies:** none on B–D; independent.
- **Evidence:** Jump groups its three dimensions (already asserted in
  `e2e/vnext-shell.spec.ts`) now with real rows; **no additional per-navigation
  read** — the read-cost note in `seam.tsx` is the constraint to respect.
- **Rollback:** restore the empty lists.

### Stage F — desktop rail game group (optional, desktop only)
- **Goal:** a visually subordinate group beneath `Games` naming each joined game
  with its own status variant.
- **Files:** `VNextShell.tsx`, `VNextShell.module.css`.
- **Dependencies:** Stage E.
- **Evidence:** rail height still bounded at one/four/twenty competitions;
  `display:none` below 1120 keeps it out of the accessibility tree; focus order
  re-measured (the skip-link ordering defect is on record).
- **Rollback:** remove the group; nothing else depends on it.

### Stage G — accessibility and journey evidence
- **Goal:** keyboard journey, landmark order, focus-after-navigation, 44px
  targets, reduced motion across the new states.
- **Files:** `e2e/vnext-shell.spec.ts`, `e2e/vnext-home.spec.ts`,
  `e2e/axe-accessibility.spec.ts`.
- **Dependencies:** C, D, F.
- **Evidence:** the 56 existing shell assertions still pass, plus new ones.
- **Rollback:** n/a — evidence only.

### Stage H — controlled release
- **Goal:** ship behind the existing journey flags; no new flag, no cutover.
- **Evidence:** flags already gate every affected destination.
- **Rollback:** unset the destination's flag, exactly as today.

### Stage I — post-release regression sweep
- **Goal:** confirm no unrelated journey moved.
- **Evidence:** full `npm test`, `test:e2e:vnext`, `check:dead-code`,
  `check:documentation-authorities`.

**There is no Stage for repointing routes, deleting Games, adding Predict,
moving LMS or amending ADR 0023 — because none is recommended.**

---

# 22. Cost of being wrong

### If we keep (refine) the current IA and that is wrong

- **Symptom:** players read `Matches` and `Games` as the same thing, or still
  cannot find LMS after Stages B–F.
- **Cost: low, and bounded.** `SHELL_DESTINATIONS` is a data field — a rename is
  a copy change and nothing else, which the accepted authority arranged
  deliberately for this exact scenario. The route tree, parent map and mental
  model survive a relabel untouched.
- **Detection:** first real usability evidence after launch, and Stage C/D give
  a much better product to gather it from.
- **Worst case:** we revisit the label, not the architecture.

### If we change to Predictor-primary and that is wrong

- **Symptom:** LMS participation falls (a weekly action moved behind `More`),
  and `More` re-accumulates as it did before.
- **Cost: high, and not bounded.** The shell model, mobile bar, desktop rail,
  intents, route helpers, parent map, absorbed addresses, onboarding language,
  56 browser assertions, 40+ Storybook worlds and an accepted ADR would all have
  moved. Reverting is a **second** structural migration, and it would land after
  launch with real players holding bookmarks.
- **Detection is slow:** a discoverability regression shows up as a quiet
  participation decline, not as an error.
- **And the asymmetry that matters:** the owner has already paid for one full UI
  transition before launch. A second one that has to be reverted costs the
  transition, the reversal, and the credibility of the next decision.

**The costs are not symmetric, and the burden of proof is on the change. It has
not been discharged.**

---

# 23. Final recommendation in plain English

If this were my product and I had to freeze the navigation before launch, I would
**ship what is there now, and spend the remaining time making the front door tell
the truth.**

Here is the whole thing without jargon.

You already built the important part. When someone opens the app, the first
button is the prediction itself — "Predict now" in most weeks. That is the game.
Moving that same button behind a
tab called *Predict* would not save anyone a single tap — I measured it in a real
browser across every version of the home screen in the repository, and it is one
tap either way.

What is actually wrong is smaller and more annoying than a navigation problem.
Your home screen currently only knows how to talk about one of your three games.
If a player has a Last Man Standing pick due in an hour — ordinarily *before*
their prediction deadline — the home screen says nothing about it. Not because you
designed it that way; you did not. Your own design document says the home screen
should show one main thing to do plus up to two smaller ones, and the code that
works out those three things already exists and already understands all three
games. The new home screen just asks it about the predictor and throws the rest
away. Two files.

The second annoyance: the Games screen's buttons say *"Open"* and *"Look
inside"* when the one for a game that wants something should say *"Pick your
club"*. Your own requirements already say that, in those
words. Right now the games screen reads like a menu instead of like something
that is happening.

Fix those two things and the feeling you are chasing — *this is a football
prediction game, and I can see what it wants from me* — arrives without moving a
single tab.

On the specific idea of demoting Last Man Standing: I would not. It looks like a
side game, but mechanically it is not. It asks the player for something **every
single week — and its deadline is half an hour *earlier* than the prediction
deadline**, so it is actually the first thing your week asks for. The
Championship is the genuine side item: it never asks for anything at all, it just
tallies up the points you already earned. So the two things you were going to
bundle together under *More* are the most and least demanding of your secondary
features. Burying the earliest deadline of the week is the one move I would
definitely avoid.

One thing your instinct got right, and I would take it: on a wide screen, the
left-hand menu is half empty. Listing the two other games there — smaller and
quieter than the main four — costs nothing and makes them easy to find on
desktop. Take that idea. Leave the phone alone.

And one practical warning. On the main site you have *just finished* removing the
words *Play* and *More* from the navigation. They are gone, the old addresses now
redirect to the new screens, and the code says in writing that those tabs
belonged to an architecture you have moved on from. Bringing them back a few
weeks before launch means doing that migration again, in reverse, for a benefit I
could not measure. (To be fair: the word *Predict* does still exist in your code
— it is the label on the Euro 2028 site's menu. So it is not a foreign word. But
that is the old-style menu on a one-tournament site, which is a different shape
of product.)

One housekeeping thing that is worth an hour of somebody's time. You have **two
documents that both describe the navigation and they disagree** — the older ADR
still lists a *Play* tab, and it was never marked as replaced by the newer design
document the app actually follows. That is worth settling before you build
anything, partly so this question stops resurfacing, and partly because it means
your instinct was not coming from nowhere: one of your own accepted documents
does say there should be a *Play* destination. It just meant something different
from what you are imagining — a place that shows you what *all three* games need
from you this week, which is exactly the job the home screen is supposed to be
doing and currently is not.

So: keep the shape, fix the front door, use the empty space on desktop, tidy up
the two documents, and go and launch it.

---

## Appendix — how this was established

- **Repository state:** `main` `711374c`; local clone had diverged on unrelated
  history and was reset to `origin/main` before any reading.
- **Graphify:** merged-main snapshot, input fingerprint `sha256:9175831…`,
  15,862 nodes / 36,168 edges, traversal from `VNextShell()`. Used for
  orientation only; every conclusion was verified in source.
- **Browser evidence:** Chromium 141 against the repository's own deterministic
  Storybook worlds. `e2e/vnext-shell.spec.ts` — **56/56 passing**. Custom
  measurement scripts in `.artifacts/ia-audit/` (gitignored, not committed):
  `measure-shell.mjs` (17 world/width combinations), `measure-home-worlds.mjs`
  (6 Home worlds), `measure-games.mjs`, `measure-home.mjs`.
- **Experimental discipline preserved:** only chrome/navigation varied; the
  deterministic destination bodies and fixtures were held constant, as the
  Stage 7.5 lab required.
- **External research:** search descriptions only — direct fetches were blocked
  by this environment's egress proxy. Weighted as weak corroboration.
- **Independent critic:** different model, read-only, findings in §17a. Preferred
  vendor-level reviewer (Codex) unavailable in this environment.

### Sources consulted for §14

- [FPL basics explained: Leagues and cups](https://www.premierleague.com/en/news/2174934/fpl-basics-leagues-and-cups)
- [League Cups starting SOON in Fantasy mini-leagues](https://www.premierleague.com/en/news/4623478/what-are-league-cups-in-fantasy)
- [Fantasy Challenge: A beginner's guide](https://www.premierleague.com/en/news/3938805)
- [Fantasy Challenge 2026/27](https://fplchallenge.premierleague.com/)
- [Sky Sports Super 6](https://super6.skysports.com/)
- [Fantasy Premier League](https://fantasy.premierleague.com/)
