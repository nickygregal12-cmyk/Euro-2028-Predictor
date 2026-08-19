# vNext Last Man Standing — the product authority

**Status:** Stage 11 deliverable. This is the authority for what the vNext Last
Man Standing surface **is**, what it may claim, and what it must never decide.
**Scope:** one player's current round inside one football competition season —
where they stand, who is left, what the rules are, and the one pick they get.
**Does not govern:** entry/registration into the game, Match Predictor's
score-entry surface, Championship brackets, LMS scoring or progression rules,
settlement, the used-list reset cycle, or any production route.
**Two production FILES changed and no production BEHAVIOUR did** — a
type-only re-export and a DEV-gated route registration, both itemised in §11.

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

**And they must differ ON SCREEN, not only in the model.** `LmsPick.result` was
mapped, fixtured and asserted in the mapper — and then never rendered, so the
two worlds were identical on the page apart from the standing banner, and every
test that "proved" the rule was reading the banner. The page now says both
facts: what the club did, from `lmsRoundModel.ts`'s own copy, beside what the
competition says the player is. Note the draw case says what happened and not
what follows — whether a draw eliminates is a rule this surface may state (§5)
and never apply.

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

### `settled` is a fact about the ROUND, and `postponed` is not one

An earlier version read `settled` off `pickOutcome !== null`, and that was the
worst defect in the stage. Contract 116 computes `pick_outcome` through
`lms_outcome_from_fixture`, whose **first** branch is

```sql
when p_status is distinct from 'played' then 'postponed'
```

So a player who has picked a club whose fixture has not kicked off yet gets
`'postponed'` — which is not null. **`pickOutcome !== null` therefore means "the
player has picked", not "the round produced a result".**

The consequence was the ordinary mid-week state of the game. Pick on Tuesday for
a Saturday deadline, and the page called the round settled: "Picks closed" over
a live deadline, every other club marked `locked`, no prompt, no remaining
count, and an amendment `save_lms_selection` would have accepted refused by the
page. It also discarded contract 164's verdict entirely, because that branch ran
first.

Now `settled` comes from contract 164's `round.settled` — `settles_at <= now()`,
the server's own comparison, under the same window guard as the lock — and
otherwise only from a **played** verdict. `postponed` is excluded by name,
because a round without a standing result never eliminates and is not over.

### The lock fails closed, never open

`seasonLmsFieldModel` decodes `revealed` as `row.revealed === true`, so a
missing or malformed field arrives as `false` — indistinguishable from a genuine
"not locked yet". And `false` short-circuits the instants and forces the round
**open**, which is the wrong direction for a control that spends a club.
Contract 164's own `lms_round_revealed` fails *closed* on an unknown window and
says why.

So a verdict is trusted only where the same payload also carried the instant it
is a verdict about: no `locksAt`, no verdict, fall back to the instants — which
then read an unscheduled window as `not-open`.

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

**But an instant needs a day.** An earlier version used `formatTime`, which
gives "11:00" and nothing else — so a Saturday deadline read on a Tuesday said
"Picks close 11:00", on the one page in the product where missing a deadline
costs a season. It was also a straight regression: the surface being replaced
prints "Sat 15 Nov · 11:00", and every other vNext surface already uses a
day-bearing label. It now uses `formatKickoffLabel`, which takes the instant as
an argument — the model's own `generatedAt`, the same one the state was judged
against — so no clock is read and the words and the state can never be relative
to different moments.

Five sentences, and getting there took three corrections a browser caught:

| the round | what it says |
| --- | --- |
| no `locksAt` at all | "No deadline set yet" |
| not open, with an `opensAt` | "Picks open Sat 12:00" |
| not open, without one | "This round has not opened yet" |
| open | "Picks close Tomorrow 11:00" |
| locked or settled | "Picks closed Sat 11:00" |

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

### Three counts, carried and never derived — and a correction

```sql
'entrants',   count(*) where competition_id = ...
'remaining',  count(*) where ... and outcome <> 'eliminated'
'eliminated', count(*) where ... and outcome  = 'eliminated'
```

**An earlier version of this section, and of four code comments, said these
need not sum**, on the grounds that a NULL `outcome` satisfies neither
predicate. Two of those comments added "I read the migration to establish this."

**It is false.** `bonus_competition_entrants.outcome` is declared

```sql
outcome text not null default 'active' check (
  outcome in ('active', 'qualified', 'survived', 'eliminated', 'champion')
),
```

and no migration has ever relaxed it. **`entrants` always equals `remaining +
eliminated`.** What went wrong is worth naming: a true general fact about SQL
(a NULL satisfies neither `=` nor `<>`) was applied to a column that cannot be
NULL, and the reasoning stopped one step short of the column definition.

Two consequences, and the second is the one that mattered:

1. the surface still prints **"83 still in · 37 out · 120 entered"** — three
   stated figures — and never "83 of 120". That phrasing was right for a
   different reason: a fraction claims one figure is a part of the other, and
   these are three separate `count(*)`s over three predicates;
2. **the fixtures were deliberately non-summing, and every one was therefore a
   page the database cannot produce** — the exact defect class Stage 10 shipped
   and §11 claims this lane fixed structurally. They now sum, and the
   anti-derivation guard moved to a mapper test that hands `buildLmsModel` an
   impossible payload and requires it to carry the figures through unrepaired.
   That is the right home for it: a fixture world depicts a page, and a mapper
   test probes a function.

The reason to carry rather than derive is therefore **authority, not
arithmetic**. A derivation would currently agree. It would stop agreeing the day
the schema gains a sixth outcome or a soft-deleted entrant, and this lane would
own a number the database never computed.

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

### The read count, stated accurately

**Three RPCs, not two, and the first is serial.** Before either LMS read can
start, `get_season_play_context` must resolve the season slug to a
`tournamentId` that both of the others need. So a visit is one round trip and
then a concurrent pair — not two concurrent reads, as an earlier version of this
section claimed and as §11's diagram omitted entirely.

**Nothing scales with what is on the page.** No count grows with fixtures,
clubs, ties or entrants — a round of ten fixtures costs what a round of two
does, and there is no per-club or per-row request anywhere.

**But the payload does grow with entrants, and honesty requires saying so.**
Contract 164's `entrants[]` has no `LIMIT`, and the decoder maps every row
before this lane discards all of them. A four-thousand-entrant competition
therefore transfers and parses four thousand objects per visit — and again after
every pick, because the write forces a re-read. Only the *rendering* is
constant. Bounding that array is a backend change and so out of scope here; it
is the first thing to raise if this surface is ever put in front of a
competition that large.

---

## 7. THE WRITE — three refusals, kept apart

This is the **first vNext surface that writes**. Stages 8, 9 and 10 read.

It writes through `save_lms_selection` and nothing else: no new mutation, no
second path, no client-side eligibility check standing in for the server's.

| outcome | SQLSTATE | what it means | what the page does |
| --- | --- | --- | --- |
| **conflict** | `PT409` | changed elsewhere while this page held an older version | says so, **re-reads** — never retries |
| **refused** | `23505`, `55000`, `42501`, `02000`, `23514` | the server declined on one of its **five** rules | says **which rule**, **re-reads** — the view is stale, not wrong |
| **failed** | anything else | a fault | says so, and "try again" is a sensible suggestion |

The five refusals, from `save_lms_selection`:

| SQLSTATE | raised when |
| --- | --- |
| `unique_violation` / `23505` | the club is already spent this cycle |
| `55000` | the entrant has been eliminated |
| `insufficient_privilege` / `42501` | not an entrant, or not authenticated |
| `no_data_found` / `02000` | the window is not a live LMS round |
| `check_violation` / `23514` | from the row trigger: the round is locked or unopened, or no club was sent |

### And this table was wrong, in the way that costs a player most

An earlier version of it said `23514` alone meant "round locked, club spent,
entry ineligible", and the hook carried **its own classifier** matching that
belief. So four of the five refusals — including **the likeliest one on this
surface, picking a club already used** — fell through to `failed`, whose
sentence is *"We could not save that pick. Nothing has changed, so you can try
again."*

Both halves were false. Something *had* changed: the used-list had moved. And
the retry it invited could never succeed, because a spent club stays spent. The
page also skipped the re-read, so it kept offering the club the server had just
refused.

**The cause was a second authority.** `src/features/season/lmsRefusal.ts`
already maps every one of these codes to the sentence it deserves, and exists
because *"being told to retry a pick that will be refused every time is worse
than useless"*. This lane wrote a worse second copy — while §7 credited itself
for reusing `isVersionConflict`.

Both classifiers are now the incumbent's, reached through the gateway:
`isLmsRefusal` decides, `lmsRefusal` supplies the sentence, and both read the
same map so they cannot drift. A refusal's sentence travels in the notice, so
the surface never re-chooses copy the write contract already chose.

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
| `used_team_ids` | **REAL BUT PARTIAL** | **ids only**, scoped to the caller's **current** cycle. On the round where ADR 0013's reset falls, the read still reports the old cycle while `lms_cycle_for_pick` would accept a new one — so every club can read as spent on the round the reset exists to rescue. Not a Stage 11 regression (the production page has the same input from the same read), but the surface must not say "no clubs left" absolutely, and this row must not read as unqualified authority |
| `fixtures[].{home,away}.team_id` | REAL + AUTHORITATIVE | **the field the whole stage turns on** — the `used` set-membership test and the only id `LmsPickAction.pick` can carry. §3 argues about it at length and an earlier version of this table omitted it entirely |
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
| `field.picked` | REAL + AUTHORITATIVE, **null before the lock** | null is the answer, never 0. Also null when there is no round at all, because `revealed` is `window_id is not null and …` |
| `rules.lives` / `saves` | REAL + AUTHORITATIVE | null as a whole when the organiser wrote no setup |
| `rules.draws_rule` | REAL + AUTHORITATIVE | **stated, never applied** |
| `rules.endgame_scope` | **NOT CONSUMED** | decoded; no surface for it in this stage |
| `available`, `entered` | REAL + AUTHORITATIVE | they decide `not-counted`, and they gate the lock verdict |
| `round.window_id` | REAL + AUTHORITATIVE | **the window-id guard §4 is built on** |
| `round.{sequence,label,opens_at,locks_at,settles_at}` | REAL + AUTHORITATIVE | `locks_at` is read as the guard on trusting `revealed`; the rest duplicate contract 116, which is the copy this lane reads |
| `round.revealed` | REAL + AUTHORITATIVE | the server's lock verdict. §4 |
| `round.settled` | REAL + AUTHORITATIVE | `settles_at <= now()`. **Now consumed** — it is the only round-level settlement answer, and reading it off `pickOutcome` instead was the stage's worst defect |
| `my_outcome` | REAL, **duplicated** | contract 116's `entry_outcome` is the copy this lane reads |
| `entrants[].{user_id,display_name,is_me,outcome,still_in}` | REAL + AUTHORITATIVE | not rendered; the array is unbounded and carries no `playerRef`, so its rows could not be navigable |
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

### There is no join control, and the reason is scope, not absence

Four places in an earlier draft said a join button *"would be a door onto a
corridor that has not been built."* **The corridor is built and shipped.**
`src/features/season/lmsRegistrationModel.ts`, `SeasonLmsRegistration.tsx` and
`useSeasonLmsRegistration.ts` run over `register_bonus_competition`, and they
exist precisely because the production page *"has been telling a non-entrant
'Join Last Man Standing to make a pick' while offering no way to join."*
`SeasonLmsPage` renders it today.

So the honest statement is the plain one: **Stage 11 does not own entry.** That
is a legitimate scope boundary, and it has a real cost worth recording rather
than dressing up — the vNext `not-entered` state is a dead end where the surface
it replaces is not. Wiring registration in is the first thing Stage 13 or the
cutover stage should do with this page, and it is a build, not a discovery.

---

## 10. ACCESSIBILITY AND PRESENTATION

- **an eliminated player is not invited to pick.** Elimination blocks the
  *player* and leaves the round *open*, so gating the prompt on the round's
  state alone put "Pick one club to win" and then "No clubs left for you to
  pick" directly under "You have been eliminated";
- **every club state carries a visible mark except `unavailable`**, which
  deliberately carries none: the reason belongs to the round and the page states
  it once above, and repeating it on twenty clubs would be twenty copies of one
  sentence. An earlier version of this list claimed every state carries a mark,
  which the component itself contradicts;
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

### Two changes outside the lane, and both are itemised rather than waved away

Contract 164's gateway and decoder already existed for `SeasonLmsField`, and
this lane imports them exactly as they are. But two production files are in the
diff, and calling the stage "no production change" would be the overstatement
this document exists to avoid:

1. **`src/services/supabase/seasonLms.ts`** — one `export type` line
   re-exporting `LmsClub` and `LmsRoundPage` from `lmsRoundModel.ts`. The shapes
   stay where they are, beside the presentation that first needed them; moving
   them would churn a working surface for no gain. The line exists so a consumer
   of THIS gateway can depend on the gateway rather than reach past it into a
   feature directory, which is the import direction the vNext lane is built on.
   **Type-only: it emits nothing and changes no behaviour.**

2. **`src/App.tsx`** — the `/dev/vnext-lms` route, behind `import.meta.env.DEV`
   in exactly the shape Stages 6 through 10 already use. It is tree-shaken out
   of a production build. It is nonetheless a production file, and worth naming
   because this harness is the first one that WRITES: pressing a club there
   calls `save_lms_selection` and spends it for the season. The DEV gate is
   doing real work, not ceremony.

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
| `/dev/vnext-lms` | connected harness. **Pressing a club really spends it** |
| Storybook `vNext/Last Man Standing` | 25 worlds, the review surface |
| — | **The vNext lane has no application route of its own**, and an earlier version of this table invented one. It is reached from the harness and from Storybook until the cutover stage. |
| `/competitions/:competition/:season/games/lms` | **production, untouched** |

---

## 13. PRODUCTION ISOLATION

Stage 11 is a parallel lane. **No production route was cut over** and the
production `SeasonLmsPage` continues to serve the live game unchanged — no
production component's rendered output differs by a single character.

Two production files are in the diff and both are named in §11: a type-only
re-export that emits nothing, and a `import.meta.env.DEV`-gated route for the
harness, tree-shaken out of a production build. Neither reaches a user.

Cutover is Stage 14 and requires explicit authority.
