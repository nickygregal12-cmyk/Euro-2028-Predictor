# vNext Last Man Standing — the product authority

**Status:** Stage 11 deliverable. This is the authority for what the vNext Last
Man Standing surface **is**, what it may claim, and what it must never decide.
**Scope:** one player's current round inside one football competition season —
where they stand, who is left, what the rules are, and the one pick they get.
**Does not govern:** entry/registration into the game, Match Predictor's
score-entry surface, Championship brackets, LMS scoring or progression rules,
settlement, the used-list reset cycle, or any production route.
**No production surface changed in Stage 11.**

**Reads consulted:** contract 116 `get_season_lms_round`, contract 164
`get_season_lms_field`. **Write used:** `save_lms_selection`, the one that
already existed. **Backend delta: none.** No migration, no RPC, no RLS change,
no provider call, no new mutation.

---

## 1. The question this surface answers

> **One consequential pick → survive or be eliminated.**

Match Predictor asks for a score on every fixture and rewards accuracy. This
asks for **one club** and takes the season away if it is wrong. The Stage 11
predicate requires the two be "visually and interactionally distinct", and the
distinction here is structural rather than decorative:

| | Match Predictor | Last Man Standing |
| --- | --- | --- |
| what it asks for | a scoreline on every fixture | one club out of the whole round |
| the control | numeric inputs, a form | pressable club names, a choice |
| the page's headline | a points total | **the player's standing** |
| a wrong answer costs | some points | **the season** |
| what is permanent furniture | nothing | the clubs already spent |

**There is no numeric input anywhere in `src/vnext/lms/`, and no scoreline.** A
fixture appears in this game only as the two clubs it offers. That is enforced
by the model rather than by discipline: `LmsFixtureChoice` has no score field to
render.

---

## 2. THE DECISION THIS STAGE TURNS ON — a club winning is not a player surviving

Everything else follows from one fact, and it is not this lane's discovery —
`src/features/season/lmsRoundModel.ts` states it in terms:

> `pickOutcome` is what the picked club **did** — won, lost, drew, or its fixture
> produced no standing result. `entryOutcome` is what the competition says the
> **player** now is — active, survived, eliminated, champion. **Only the second
> is a survival verdict, and only the settlement job writes it.**

So `LmsClubResult` and `LmsStanding` are **different types with no conversion
between them**, and nothing in this lane derives one from the other.

The gap is not pedantry. Whether a draw eliminates is a **stored rule with a
parameter** (`season_lms_setups.draws_rule`, folded together with lives and
saves by the settlement replay). A page that read "drew" and printed "you are
out" would be inventing a rule it cannot see, and would be wrong in exactly the
seasons configured differently from its guess. A postponed fixture may leave a
player alive with no result at all.

### It is proven by two worlds that are mirror images

| world | the club did | the player is |
| --- | --- | --- |
| `wonButEliminated` | **won** | **eliminated** |
| `lostButAlive` | **lost** | **active** |

A derivation gets both backwards and looks completely normal in every other
world. These two are the binding fixtures for the whole stage.

---

## 3. AN INELIGIBLE CLUB HAS NOTHING TO PICK WITH

The predicate requires that "used/ineligible teams cannot be made selectable by
presentation shortcuts". That is a **type problem**, not a discipline problem.

```ts
export type LmsPickAction =
  | { kind: 'pick'; teamId: string }   // the ONLY case with an id
  | { kind: 'chosen' }
  | { kind: 'used' }
  | { kind: 'unavailable'; reason: 'locked' | 'not-open' | 'eliminated' | 'not-entered' }
```

**A team id appears nowhere else in `src/vnext/models/lms.ts`** — not on the
option, not on the fixture, not on the round. A component holding a used club
literally has no id to submit. `LmsTeamOption.key` is built from the fixture and
the side, so it is stable across renders and useless as a submission.

The rendering rule is one line: `action.kind === 'pick'` and nothing else. Not
"is it used", not "is the round open" — no test a component could get subtly
wrong.

This is **Stage 9's social identity rule in another costume**: there, a row the
caller may not open has no id to open it with; here, a club the player may not
pick has no id to pick it with.

### A spent club is text, not a dead button

It still appears — a player needs to see which clubs are gone and which fixture
they were in — but as a marked name rather than a control that refuses. A
disabled button advertises something the player cannot have and invites the
press anyway; the mark states a fact. Every state carries a **visible mark and
not merely a colour** (§31).

The one exception is the club the player **holds**, marked rather than pressable
because re-picking it changes nothing.

---

## 4. THE LOCK — the server's answer where there is one

The predicate asks that "lock/deadline states come from authority, not browser
inference", so it matters exactly where the answer comes from. **An earlier
draft of this lane got this wrong twice**, and the correction is worth stating.

### What each contract actually gives

| | contract 116 `get_season_lms_round` | contract 164 `get_season_lms_field` |
| --- | --- | --- |
| `opens_at` / `locks_at` | ✅ stored instants | ✅ same instants |
| a lock **verdict** | ❌ none — no state field, no server clock | ✅ `round.revealed` |

`revealed` is `locks_at is not null and locks_at <= now()` **evaluated by the
database, against the database's own clock**. That is the authority, so
`buildLmsModel` prefers it.

### It may only speak for the window it is about

Both contracts resolve the current round through the same
`predictor_internal.season_lms_current_window(competition, now())` — contract
164 whenever `p_window_sequence` is omitted, which is how this lane calls it. But
they are **two calls**, and a round can lock between them. So the window ids are
compared, and a mismatch **discards** the verdict rather than applying it to a
round it did not describe. A confident wrong lock on the most consequential
control in the product is worse than no verdict at all.

### `revealed: false` is not "open"

It answers "has the lock passed", which is equally false of a round that has not
started. So `opensAt` still decides between `not-open` and `open`, and the
server's answer is used for the one question it actually answers.

### The fallback is one comparison, in one place

Where no verdict is available — the field read failed, the caller is not
entered, the windows disagree — the state comes from the instants against
**the instant the source supplied**, judged in `buildLmsModel` and nowhere else.
No component reads a clock. A component that did could offer a control the
header says is closed, and the two would disagree on screen.

**This is not the thing Stage 8 forbade.** Stage 8 bans *inventing a value the
server never stated* — a live minute computed from `Date.now() - kickoff`.
Reading a stated boundary to decide which control to offer fabricates no figure.

### And the server still adjudicates the write

`save_lms_selection` refuses a pick after the lock regardless of what was
offered. So **a pick offered near the boundary can still be refused**, and that
refusal is a state the surface shows rather than a failure it swallows. A clock
that is slightly wrong must cost a player an explanation, never a silent no-op.

### The deadline is said, not counted

`locksAt` is printed as an instant. **There is no countdown**: the browser does
not own this deadline and a ticking number implies it does.

Three sentences, and getting to three took two corrections a browser caught:

| the round | what it says |
| --- | --- |
| no `locksAt` at all | "No deadline set yet" |
| not open, with an `opensAt` | "Picks open 12:00" |
| not open, without one | "This round has not opened yet" |
| open | "Picks close 11:00" |
| locked or settled | "Picks closed 11:00" |

An earlier version had two branches — open, else closed — so **a round that had
not started announced "Picks closed 11:00"**, telling a player they had missed a
deadline that has not arrived. No unit test could catch it: the markup was
perfectly well-formed and merely untrue. The fix then said "Picks open 12:00" on
an **unscheduled** window, implying picking becomes possible when the defining
fact is that no closing time exists. Absent deadline is now checked first.

---

## 5. THE FIELD — how many are left, and under what rules

Stage 11 owns "player pool remaining/league standing context **where real**".
Contract 164 makes it real, so the page shows it.

### Three counts, and they need not add up

```sql
'entrants',   count(*) where competition_id = ...
'remaining',  count(*) where ... and outcome <> 'eliminated'
'eliminated', count(*) where ... and outcome  = 'eliminated'
```

**A NULL outcome satisfies neither predicate.** So `entrants` can exceed
`remaining + eliminated`, and `entrants - eliminated` is **not** `remaining`.

Two consequences, both load-bearing:

1. the surface prints **"83 still in · 33 out · 120 entered"** — three stated
   figures — and never "83 of 120", a form that reads as a fraction of a whole
   the database never agreed to;
2. **every fixture is deliberately non-summing** (120 / 83 / 33), so a mapper
   that derived one count from the others fails a test rather than passing by
   arithmetic luck.

### `picked` is null before the lock, and null is the answer

Contract 164 withholds how many entrants have picked until `revealed`, for the
same reason it withholds each rival's `has_picked`: **when the clubs are a
depleting resource, knowing that somebody has already committed is itself
information.**

`picked ?? 0` would print "0 players picked" to every player before the lock — a
confident claim about rivals the server deliberately refused to make. So the
withholding is **said**: *"How many players have picked stays hidden until picks
close."* A player who sees a number after the lock and a sentence before it
should be told which of those two they are looking at.

### The rules may be STATED and must never be APPLIED

`lmsRoundModel.ts` refuses to say whether a draw eliminates because it is "a
stored rule this surface cannot see". Through contract 164 this page **can** see
it — `rules.lives`, `rules.saves`, `rules.drawsRule`.

That permission extends **exactly as far as printing it.** Reporting "a draw
counts as a loss" describes the organiser's setup. Reading `drawsRule` beside a
drawn pick to produce an elimination would be *running the settlement*, and that
is the settlement job's alone. A mapper test pairs `pickOutcome: 'drew'` with
`drawsRule: 'A draw counts as a loss'` and asserts the standing stays `active`.

### Absent rules are absent, not zero

An organiser who wrote no setup has not chosen "0 lives, no saves". `rules` is
null and the line renders **nothing at all** — printing zeroes would describe a
harsher game than the one being played.

### The entrant array is deliberately not rendered

Contract 164 returns a row per player, ordered by display name. Stage 11 shows
the **counts** and not the list, for three reasons:

1. **it is unbounded.** Contract 116 caps its fixtures at 16; this array has no
   LIMIT, and a season may hold thousands. Rendering it makes the page's weight
   a function of how popular the competition got;
2. **the counts exist precisely so a browser need not walk it** — the migration
   says so in as many words, because the array is redacted before the lock and a
   count taken from it would be wrong;
3. **Stage 9's identity rule.** The rows carry `user_id` and no `playerRef`, so
   they could not be navigable anyway.

A bounded, ordered field list is a legitimate future surface. It is not this
stage's, and inventing an order or a cap for it here would be this lane deciding
something the read did not.

---

## 6. TWO READS, AND NEITHER MAY WITHHOLD THE OTHER

```
contract 116  get_season_lms_round   the round, the clubs, the standing
contract 164  get_season_lms_field   the pool, the rules, the LOCK
—             save_lms_selection     the pick, through the SHARED write
```

They are issued **concurrently** and each catches **its own** failure:

```ts
const [page, field] = await Promise.all([
  lms.load().catch(() => null),
  fetchSeasonLmsField(context.tournamentId).catch(() => null),
])
```

The `.catch` is per-promise rather than around the pair on purpose. A
`Promise.all` over unguarded promises rejects on the first failure and **discards
the other answer even when it had already arrived** — which on this page would
mean a field read falling over and taking with it the round a player came to act
on.

So the model carries **two independent unions**, and there is no page-level
"loaded" in this lane:

| | round read | field read |
| --- | --- | --- |
| both answer | the round | the pool |
| field fails | **the pick is still there** | one quiet sentence, no retry |
| round fails | "could not load this round" + retry | **still says how many are left** |
| both fail | retry | one quiet sentence |

That is Stage 10's three-panel discipline in a two-read page. The field panel
offers **no retry of its own**: the pool is context, the round is the thing a
player came for, and a second retry control beside a working page would invite a
re-read of everything to fix an aside.

**Two reads is the whole count.** It does not grow with fixtures, clubs or
entrants: a round of ten fixtures costs what a round of two does, and a
competition of four thousand players costs what one of four does.

---

## 7. THE WRITE — three refusals, kept apart

This is the **first vNext surface that writes**. Stages 8, 9 and 10 read.

It writes through `save_lms_selection` and nothing else: no new mutation, no
second path, no client-side eligibility check standing in for the server's.

| outcome | SQLSTATE | what it means | what the page does |
| --- | --- | --- | --- |
| **conflict** | `PT409` | changed elsewhere while this page held an older version | says so, **re-reads** — never retries |
| **refused** | `23514` / `check_violation` | the server declined on its own rules: round locked, club spent, entry ineligible | says so, **re-reads** — the view is stale, not wrong |
| **failed** | anything else | a fault | says so, and "try again" is a sensible suggestion |

`isVersionConflict` is the **shared** classifier and lives beside the write
contract it describes; this lane reuses it rather than writing a second copy.

**The first two are why the lock preference is safe.** The mapper decides which
controls to *offer*; the server decides which picks to *accept*. When a clock
disagreement puts those out of step the player gets a sentence and a fresh read
— never a silent no-op, and never a pick they believe landed.

**A successful pick re-reads** rather than patching the model locally. The write
moves the version, the selection and possibly the eligibility of everything else
on screen. An optimistic update would be a second authority on eligibility,
which is the one thing this stage is built to avoid.

**The version never enters this lane.** `seasonLms.ts` keeps it private to the
gateway on the grounds that "a pick is a player's intention and carries no
version". The presentation model has no version field, the intent has none, and
nothing in `src/vnext/models/` knows the concept exists.

---

## 8. THE AUDIT — what the two reads supply, classified

Per the Stage 8 rule: every property classified, nothing fabricated.

### Contract 116 `get_season_lms_round`

| property | classification | note |
| --- | --- | --- |
| `available` | REAL + AUTHORITATIVE | the season runs this game at all |
| `entered` | REAL + AUTHORITATIVE | server-side: an entrant row exists |
| `entry_outcome` | REAL + AUTHORITATIVE | the settlement job's verdict. The only survival answer |
| `used_team_ids` | REAL + AUTHORITATIVE | **ids only**, scoped to the caller's current cycle per ADR 0013 |
| `window.{id,sequence,label}` | REAL + AUTHORITATIVE | the round |
| `window.opens_at` / `locks_at` | REAL + AUTHORITATIVE | stored instants. **No verdict** — see §4 |
| `selection.team_id` | REAL + AUTHORITATIVE | the caller's own pick |
| `selection.version` | REAL + AUTHORITATIVE | private to the gateway; never reaches this lane |
| `pick_outcome` | REAL + AUTHORITATIVE | what the CLUB did. Not a survival verdict |
| `fixtures[].{id,kickoff_at}` | REAL + AUTHORITATIVE | |
| `fixtures[].{home,away}.name` | REAL + AUTHORITATIVE | already shortened by the club-name authority |
| `fixtures[]` (the list) | **REAL BUT PARTIAL** | capped at `limit 16`. A league round is ten; the cap is a bound, not a rule |
| `fixtures[].home_score` / `away_score` | **NOT REQUIRED** | decoded by the gateway, deliberately unused here: this game has no scoreline |
| `fixtures[].status` | **NOT REQUIRED** | same |
| `window.settles_at` | **NOT CONSUMED** | decoded by the gateway, unread by this lane |
| `used_cycle` | **NOT CONSUMED** | decoded by the gateway, unread by this lane |

### Contract 164 `get_season_lms_field`

| property | classification | note |
| --- | --- | --- |
| `field.entrants` / `remaining` / `eliminated` | REAL + AUTHORITATIVE | three separate `count(*)`s. **Never derived from each other** |
| `field.picked` | REAL + AUTHORITATIVE, **null before the lock** | null is the answer, never 0 |
| `rules.lives` / `saves` | REAL + AUTHORITATIVE | null as a whole when the organiser wrote no setup |
| `rules.draws_rule` | REAL + AUTHORITATIVE | **stated, never applied** |
| `rules.endgame_scope` | **NOT CONSUMED** | decoded; no surface for it in this stage |
| `round.revealed` | REAL + AUTHORITATIVE | the server's lock verdict. §4 |
| `round.settled` | **NOT CONSUMED** | `settles_at <= now()`, a different question from "did my pick produce a result" |
| `my_outcome` | REAL, **duplicated** | contract 116's `entry_outcome` is the one this lane reads |
| `entrants[]` | REAL + AUTHORITATIVE, **not rendered** | unbounded; §5 |
| `entrants[].{lives,saves,pick,has_picked}` | REAL, **null before the lock** | the reveal boundary. Not rendered at all here |

### Absent from both, and therefore not shown

| Stage 11 wanted | status |
| --- | --- |
| survival streak / per-round history | **ABSENT.** Contract 116 returns *one* round by design ("a season runs ~38 windows"). Contract 164 can address a past round via `p_window_sequence`, but one call per round is the N+1 this lane refuses |
| a private LMS league / container | **ABSENT.** No contract scopes an LMS field to a private league |
| a join / entry control | **NOT OWNED.** Stage 11 does not own entry, so there is no join button — a control here would be a door onto a corridor that has not been built |

---

## 9. WHAT THE PAGE SAYS WHEN A READ DOES NOT ANSWER

Five different situations, five different sentences, and only one has a retry.

| case | subject | what it says |
| --- | --- | --- |
| `not-offered` | the **competition** | "This competition season does not run Last Man Standing." |
| `not-entered` | the **player** | "You are not entered in Last Man Standing for this season." |
| `no-round` | the **competition** | "There is no round to play right now." |
| `unavailable` | the **read** | "We could not load this round just now." **+ retry** |
| empty `choices` | the **round** | "This round has no fixtures to pick from yet." |

Folding `not-offered` into `no-round` would tell somebody the game is between
rounds when it was never offered. `not-entered` is an **ordinary answer** — this
game is opt-in — and is not styled as a failure.

---

## 10. ACCESSIBILITY AND PRESENTATION

- **the standing is the headline.** "You are still in" is the only thing a
  player actually wants to know, so it is the first thing on the page — a word,
  not a colour (§31), with the champion's trophy `aria-hidden`;
- **`STANDING_COPY` has no default case.** An unrecognised value would be a
  contract this build does not know, and saying "you are still in" to somebody
  who is out is the worst sentence this page could produce;
- **`Remaining` is its own component** purely so the singular cannot be got
  wrong. "1 clubs still available" is the sentence a player reads in exactly the
  round where the count is the whole warning;
- the rules line handles "1 life" / "2 lives" and "no saves" / "1 save" / "n
  saves" for the same reason;
- **nothing clips.** A club name is the one thing a player must read exactly
  before spending it, so `longClubNames` runs Inverness Caledonian Thistle
  against Heart of Midlothian at 375;
- the pool counts **wrap** — three figures and two separators do not fit one
  line on a 320px phone, and a survival count running off the edge would hide
  the number the section exists to show;
- **a pick notice is `role="status"`**, so a screen reader hears the outcome of
  a write it cannot see;
- container queries throughout (`vnext-page`); one fixture column on a phone,
  two from 640, three from 1120.

Measured in a browser at six widths and under axe. The browser suite is the one
that caught the "Picks closed" sentence: it was well-formed and untrue.

---

## 11. ARCHITECTURE

```
get_season_lms_round ─┐
                      ├─→ LmsSource ─→ buildLmsModel ─→ LmsPageModel ─→ VNextLms
get_season_lms_field ─┘   (data)        (pure)           (contract)      (visual)
                                                                            │
                          save_lms_selection ←── useVNextLmsSource ←────────┘
```

| file | what it owns |
| --- | --- |
| `src/vnext/models/lms.ts` | the presentation contract and its selectors |
| `src/vnext/integration/lms/lmsSource.ts` | what the application hands the lane |
| `src/vnext/integration/lms/buildLmsModel.ts` | the **only** mapper. Pure: no network, no storage, no clock, no React |
| `src/vnext/integration/lms/useVNextLmsSource.ts` | acquisition, the write, and classification |
| `src/vnext/integration/lms/VNextLmsScreen.tsx` | the connected screen |
| `src/vnext/lms/VNextLms.tsx`, `LmsPickList.tsx` | the visual surface |
| `src/vnext/fixtures/lms/scenarios.ts` | 25 deterministic worlds, each a premise |

The vNext production boundary holds: `components → models`, `integration →
services`, never `components → services`
(`tests/vnext/vnextProductionBoundary.test.ts`).

**No change outside the lane.** Stage 11 added no service module, no migration
and no export to a production file — contract 164's gateway and decoder already
existed for `SeasonLmsField`, and this lane imports them as they are.

### Two lessons from earlier stages, applied structurally

- **fixtures must only express states the mapper can produce.** Stage 10 shipped
  a world pairing two figures the real read never emits together, and four
  layers of tests passed against it because every layer trusted the fixture. A
  cross-world test now asserts the pairing rules over *every* world at once, so
  a new one cannot be added in an impossible state;
- **mutation-prove the assertions.** Seven mapper mutations and two hook
  mutations were applied, confirmed failing, and reverted.

---

## 12. ROUTES

| route | status |
| --- | --- |
| `/vnext/competitions/:competition/:season/games/lms` | the vNext lane |
| `/dev/vnext-lms` | connected harness. **Pressing a club really spends it** |
| Storybook `vNext/Last Man Standing` | 25 worlds, the review surface |
| `/competitions/:competition/:season/games/lms` | **production, untouched** |

---

## 13. PRODUCTION ISOLATION

Stage 11 is a parallel lane. **No production route was cut over**, no production
component was edited, and the production `SeasonLmsPage` continues to serve the
live game unchanged. Cutover is Stage 14 and requires explicit authority.
