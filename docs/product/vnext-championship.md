# vNext Predictor Championship — the product authority

**Status:** Stage 12 deliverable, **IN PROGRESS**. This is the authority for
what the vNext Championship surface **is**, what it may claim, and what it must
never decide.
**Scope:** one Championship instance inside one football competition season —
where the reader is in it, and how it is being won.
**Does not govern:** entry/registration, Championship format selection, bracket
generation, settlement, seeding or bye rules, the tournament predictor, or any
production route.

**Reads consulted:** contract 193 `get_season_cup_bracket`. **Backend delta
claimed by this lane so far:** contract 205, a corrective fix to contract 193
(§7). **One further delta is OWED before this stage can be called complete**
(§6) — and that is recorded here as a debt rather than resolved by narrowing
the predicate.

---

## 1. The question this surface answers

> **Where am I in this Championship, what must I do next, and how can I win it?**

Three questions with different answers in different phases, which is why the
page is a set of independent panels rather than one page-shaped object.

---

## 2. THE DECISION THIS STAGE TURNS ON — the bracket is read, never rebuilt

The predicate's strongest clause:

> a launched Championship can be understood from its canonical player-facing
> read **without reconstructing its bracket in React**.

It is satisfiable because **contract 193 returns the bracket as DATA.** Every
seat carries its own `window_sequence`, `bracket_slot` and `round_size`, and the
server orders them `by window_sequence, bracket_slot`. The migration asserts
against its own installed text that no arithmetic is present:

```sql
if v_read ~ 'cup_bracket_order|log\(|power\(|ceil\(' then
  raise exception 'The bracket must be read rather than recomputed';
```

So this lane does none of the following, and each has a test:

| it does not | because |
| --- | --- |
| pair opponents | a seat arrives with both sides in it |
| compute a round count, seat position or slot | all three are per-seat fields |
| sort | the server ordered them, including across a filtered-out fixture |
| infer a bye from a one-sided seat | the read does not say **why** a seat is empty |
| draw a connector line | contract 193 gives a slot per seat and **no edge between them** |

### The connector ban is a data claim, not a style choice

A line between two seats asserts which one feeds which. Nothing in the payload
says so. Drawing one would be reconstructing the bracket by other means, so the
browser suite forbids any `svg`, `line` or `path` inside the bracket, **in every
world at every width**. If a reviewer misses them, that is a conversation to
have — not a defect to fix by drawing one.

---

## 3. THREE VOCABULARIES, THREE TYPES, NO CONVERSION

Stage 11's two-verdicts lesson, three times over. These live in different
tables, are written by different authorities, and answer different questions:

| type | column | question |
| --- | --- | --- |
| `TieDecision` | `bonus_cup_fixtures.decided_by` | how a **tie** was decided |
| eligibility | `game_memberships.status` | whether a **person** may play |
| entrant outcome | `bonus_competition_entrants.outcome` | what the **competition** says they are |

**Only the first is in contract 193.** The other two are the subject of §5 and
§6, and their absence is load-bearing rather than incidental.

### A deterministic outcome carries no numbers

`TieOutcome`'s settled case has **no score field at all**, so a walkover cannot
grow one. Contract 194 writes an audit row asserting `'invented_score', false,
'invented_points', false`; this type makes the same promise structurally rather
than by discipline. A browser test asserts no two digits with a separator
between them appear anywhere on a fully settled bracket.

---

## 4. TWO SHAPES IN THE PAYLOAD THAT WILL CATCH THE NEXT READER

Both were established by reading the migration, and both have their own tests.

### An unfilled seat arrives called "Player"

Contract 193 renders every side as:

```sql
jsonb_build_object('user_id', ...,
                   'display_name', coalesce(profile.display_name, 'Player'))
```

So an **unfilled seat** and a **real player with no profile row** are textually
identical. Only `user_id` separates them, which is why `BracketSide` has an
`empty` case and why the decoder keys on the id. A surface that trusted the name
would show a person called Player standing in every hole in the draw.

The empty seat reads **"To be decided"** — and not "bye", because the read does
not say why it is empty.

### The same payload encodes "no opponent" two different ways

`my_tie.opponent` is a **scalar subselect from `profiles`**, so it is `null`
outright. `my_ties[].opponent` is a **built object**, so the same situation
arrives as `{user_id: null, display_name: 'Player'}`. Same concept, two
encodings, both handled.

---

## 5. A WALKOVER CANNOT BE ATTRIBUTED

`decided_by` distinguishes `walkover` from `admin_walkover` — the competition's
rule firing versus an organiser acting — and stops there. **Why** the opponent
was absent is `game_memberships.status` (`active | left | disqualified`), which
contract 193 never returns.

So the model has **nowhere to put a reason**, deliberately: a surface holding a
walkover has no field to guess into. Both the unit and browser suites assert the
words "withdrew" and "disqualified" never appear.

---

## 6. THE ELIMINATION GAP — CLOSED BY CONTRACT 207

**Status: RESOLVED, 19 August 2026, by
`supabase/migrations/20260819130000_cup_bracket_outcome_and_knockout_stage.sql`.**
The section below is kept because it is the reasoning the correction was
derived from, and because the discipline it argues for — silence over
inference — is what the surface still does where the read carries nothing. What
changed is that the read now carries something.

`get_season_cup_bracket` returns `your_outcome`:
`bonus_competition_entrants.outcome`, verbatim, for the caller alone.
`ChampionshipStanding` is that column and nothing else, and the mapper's three
former fallbacks are gone — see §6.1.

---

### The gap as it stood

The predicate requires:

> eliminated/champion/no-action-required states are **complete**.

**`champion` was present. `eliminated` was returned by no season Championship
read this surface could call** — not contract 193, not 133, not 167, not 120.
The authoritative fact is `bonus_competition_entrants.outcome`.

Two TOURNAMENT-scoped reads do expose it — `get_bonus_games`
(`20260805140000:163`) and `get_my_cup` (`20260804263000:715`) — and an earlier
draft of this section said no read anywhere returned it, which was broader than
what had been checked. Neither is usable here, and the reason is structural
rather than a matter of taste: `get_my_cup` selects into a single record with no
limit and raises for a season running several Championship instances, which is
precisely the case this surface exists for. So the gap below stands, but it is
"no read this page can make", not "no read exists".

### What this lane does, and does not do

- **Where an authority states it, the surface renders it.**
- **Where none does, the surface stays silent** — `ChampionshipStanding` has a
  `not-stated` case and no banner is drawn at all.
- **Nothing is derived.** Not from a lost tie, not from a missing seed, not from
  bracket position, not from an absent later tie.

The binding world is `lostButNotStated`: the reader lost their only tie, has no
later one, and the page says nothing. The inference is available, looks
conclusive, and is **wrong whenever a competition has not finished
eliminating** — and it would sit exactly where a real verdict goes, which is
what makes it the guess a reader would believe.

### The qualification line is a draw fact, and is phrased as one

`you_qualified` is `exists(member.seed is not null)`. It becomes true when a
seed is dealt and **never becomes false** — being knocked out does not retract
it. Rendered in the standing slot it read as a CURRENT status, so a player
eliminated in round one saw "You qualified for the knockout" above the very seat
recording their defeat: not a derived claim, but a true sentence in a place that
made it say something untrue.

The copy now names the draw — *"You were seeded into the knockout draw."* — which
is what the field knows and claims nothing about survival. This is a smaller
correction than the gap below and does not close it.

### That asymmetry did NOT satisfy the predicate, and was not called complete

Stated plainly, because the tempting move was to call truthful silence
"complete":

> The contract asks for these states to be complete. Truthful silence is the
> correct behaviour given the current backend, and it is **not** completeness.

**Stage 12 therefore owed a backend delta**: the smallest read change exposing a
canonical season-wide elimination fact. Contract 207 wrote exactly the candidate
this section named — `entrants.outcome` on contract 193's payload, one column,
already joined for entrancy, already the vocabulary `ChampionshipStanding` is
modelled on.

---

## 6.1 What the correction changed, and what it deliberately narrowed

`your_outcome` is read by the entrancy gate — which already looked the row up,
so no join was added — and emitted verbatim beside `entered`. It is the
**caller's own** and is reached exactly once, scoped to `v_uid`, the same
construction the Penalty Number uses: a per-seat outcome would turn a draw sheet
into a disclosure of every entrant's standing. The in-transaction guard asserts
all three properties against the installed text, and
`supabase/tests/253_cup_bracket_outcome_and_knockout_stage.sql` proves them
against a competition with four entrants holding four different outcomes.

**Three mapper fallbacks were removed, and the page says LESS in one case.**
`standingOf` used to reach for `panel.champion?.isYou` and then for
`youQualified`. Both are gone:

| was | why it went |
| --- | --- |
| the bracket names you as the final's winner → `champion` | a fact about a FIXTURE standing in for a fact about an ENTRANT. The settlement job is what moves one to the other. The champion is still announced — by the bracket panel, where a fixture fact belongs |
| `you_qualified` → `qualified` | a fact about the DRAW wearing the settlement vocabulary's word. It is now `seededIntoKnockout`, rendered beneath the verdict in the past tense, because it becomes true when a seed is dealt and **never becomes false** when the player is knocked out |
| nothing → `not-stated` | unchanged, and now means "this database is behind contract 207" rather than "no read anywhere carries this" |

So a database at contract 205 or earlier now shows no standing where it
previously showed two other facts under this one's name. That is the correction,
not a regression: `lostButNotStated` remains a shipped world for exactly that
case, and the page is as silent in it as it was when the fact existed nowhere.

`ChampionshipOutcome` carries all **five** constrained values, `survived`
included. The column is shared with Last Man Standing, and a record keyed on the
four the Championship happens to write throws on the fifth — a crash where a
sentence belongs.

**`eliminatedInGroups` is the binding world now.** Group phase, no knockout, no
settled tie, no seed: every inference the old surface could have made returns
"still in", and the reader is told they are out because the settlement authority
says so.

---

## 7. CONTRACT 205 — a defect found before the first caller existed

Contract 193 has existed since 17 August with a pgTAP suite, a parity test and
**no application caller**. Stage 12 is its first consumer, and the audit that
preceded this lane found that

> `get_season_cup_bracket` **raises an exception** for every entrant in a
> Championship that has reached its split phase.

`qualification.your_seed` was a **scalar** subquery over `bonus_cup_members`
filtered by competition and user alone. Contract 102 keyed that table
`(competition_id, user_id, phase_kind)` so one entrant may hold both an
`initial` and a `split` membership, and contract 124's split transition inserts
the second without deleting the first — so the subquery matched two rows and
raised `more than one row returned by a subquery used as an expression`, failing
the **whole read**.

Reproduced on a scratch PostgreSQL 16 against the real key shape before the fix
was written. Contract 205 pins the lookup to the initial membership, which is
not a tie-break: `bonus_cup_members_split_metadata_empty` requires a split row
to carry `seed` as NULL, so the initial row is the only one that can hold the
value being asked for.

### A second, separate defect — FIXED BY CONTRACT 207

Contract 193 used `stage <> 'group'` in **four** places, where contracts 194 and
195 use `stage in ('playoff','knockout')` — and 194 *asserts against* the broad
form reappearing. Contract 195's own SQL says why:

> `stage <> 'group'` would sweep in a `split` fixture, which is a group-phase
> table row with no Penalty Number.

A split fixture can never settle, so `my_tie`'s `winner_user_id is null` filter
does not exclude it: a `single_group` Championship that reached its split was
offered a **league fixture as a knockout tie**, with null `round_size` and
`bracket_slot`, and a Penalty Number lane for a fixture that has none — and
`qualification.drawn` reported `true` with an empty bracket.

It was deliberately not folded into contract 205, whose job was to stop an
exception. **Contract 207 narrows all four**, and its guard fails if the broad
form returns or if fewer than four predicates name the knockout stages. Proved
by A/B against the previous definition on PostgreSQL 16:

```
BEFORE  my_tie.stage        -> split
AFTER   my_tie              -> null
BEFORE  qualification.drawn -> true
AFTER   qualification.drawn -> false
```

**The decoder's own `playoff | knockout` filter stays**, and its status changes
rather than its code. It was the authority; it is now the second of two. A
hosted environment reaches a contract on its own schedule, so a decoder that
trusted an unapplied migration would render the defect in exactly the
environments that still have it. `seasonCupBracketModel.ts` says so, and the
filter may be retired once every hosted environment is at 208 or later.

---

## 8. THE AUDIT — contract 193, classified

| property | classification | note |
| --- | --- | --- |
| `entered` | REAL + AUTHORITATIVE | entrancy is the disclosure boundary |
| `server_now` | REAL + AUTHORITATIVE | the database's own clock, carried |
| `format.kind` | REAL + AUTHORITATIVE | from the launch record, not inferred |
| `format.produces_knockout` | **REAL BUT UNRELIABLE FOR ONE FORMAT** | computed as `v_launch.format_kind = 'groups'` — a **format-name check** standing in for a calendar fact. Contract 198 states the underlying truth plainly: *"whether a single group ends in a knockout depends on how the league rounds happen to divide the calendar, so neighbouring field sizes end differently. Over 38 matchweeks 18 entrants reach a knockout and 19 do not."* So a `single_group` Championship that **does** reach one reports `false` here. Not consumed by this lane; see §8.1 |
| `qualification.drawn` | REAL + AUTHORITATIVE **since contract 207** | was `exists(fixture.stage <> 'group')` — one of the four broad-form uses §7 enumerates — so a `single_group` competition that had merely reached its SPLIT reported `drawn: true` with no knockout in existence. Now `exists(stage in ('playoff','knockout'))`. Still consumed beside the seat list rather than alone; see §8.1 |
| `qualification.qualifiers` | REAL + AUTHORITATIVE | aggregate; safe across a split |
| `qualification.your_seed` | REAL + AUTHORITATIVE | **only since contract 205**; §7 |
| `qualification.you_qualified` | REAL + AUTHORITATIVE | `exists`; safe across a split |
| `my_tie.*` | REAL + AUTHORITATIVE | **server-filtered** to `playoff\|knockout` since contract 207; the decoder's own filter is retained as defence in depth for hosted environments behind it. §7 |
| `my_tie.locks_at` | REAL + AUTHORITATIVE | `cup_window_first_kickoff` |
| `penalty_number.locked` / `.open` | REAL + AUTHORITATIVE | **server-evaluated, and not complements** — an unscheduled round returns both `false` |
| `penalty_number.value` | REAL + AUTHORITATIVE | the caller's own only; `0` is legal, so null never defaults |
| the **opponent's** Penalty Number | **ABSENT BY CONSTRUCTION** | never returned under any condition; the migration asserts the table is reached once and scoped to the caller |
| whether the opponent has submitted | **ABSENT BY CONSTRUCTION** | withheld for the same reason |
| `my_ties[].decided_by` | REAL + AUTHORITATIVE | the settlement vocabulary |
| `my_ties[].settled_at` | REAL, **not yet rendered** | `bracket[]` carries no equivalent |
| `bracket[]` | REAL + AUTHORITATIVE | ordered server-side; **unbounded**, but a bracket is bounded by its own draw |
| `champion` | REAL + AUTHORITATIVE | the final's winner. A fact about a FIXTURE — it is NOT the reader's standing, which is `your_outcome`; §6.1 |
| `your_outcome` | REAL + AUTHORITATIVE | **contract 207.** `bonus_competition_entrants.outcome`, verbatim, the caller's own only. The one authority for elimination |
| `visibility_kind`, `availability_status` | **NOT CONSUMED** | no surface for them in this stage |

### 8.1 Why `produces_knockout` is decoded and not used

It is carried through the decoder because it is a real field, and it is not read
by the surface, because for one format it answers a different question from the
one it appears to answer.

`groups` must end in a knockout — a field that cannot be one league. For
`single_group` it is conditional on calendar arithmetic, which contract 198
exists to compute (`cup_knockout_rounds`) and which a format name cannot stand
in for. A page that printed "no knockout" from this field would be wrong for
exactly the single-group competitions that reach one.

**`qualification.drawn` is the better signal**, because it is a fact about
fixtures that exist rather than a prediction about whether any will. But it is
NOT `exists(knockout fixtures)`, as an earlier draft of this document claimed.
The SQL is:

```sql
'drawn', exists (
  select 1 from public.bonus_cup_fixtures fixture
   where fixture.competition_id = p_competition_id
     and fixture.stage <> 'group'),
```

— the same broad `stage <> 'group'` form §7 catalogues, and it counts `split`
fixtures as evidence of a draw. So a `single_group` competition that has reached
its split reports `drawn: true` while its bracket is empty.

**So the surface consumes it beside the decoded seat list, not alone.**
`bracketPanelOf` answers `not-drawn` when `drawn` is false OR when the filtered
bracket is empty, and the second half is what makes the split case correct: the
decoder drops `split` fixtures, so a split-only competition arrives with zero
seats and is reported as not drawn. Dropping the length check on the strength of
"drawn is the server's word" would render an empty bracket panel to every split
competition.

This is a `NOT CONSUMED` classification with a reason rather than an oversight,
and it is worth a later contract stating the reserved depth in the payload.

### Absent, and therefore not shown

| the stage wanted | status |
| --- | --- |
| a season-wide **eliminated** fact | **PRESENT since contract 207** as `your_outcome`, the caller's own. §6 |
| **why** a walkover happened | **ABSENT.** §5 |
| the group table / group stage | **NOT YET READ.** Contracts 167 and 133 are the next reads this lane takes |
| the qualification **cut line** | **ABSENT.** `cup_group_automatic_places` and `cup_group_qualifying_limit` are revoked from `authenticated` and reached by no public read. The page may say whether YOU qualified; it may not draw a line on a table |

---

## 8.5 THE GROUP PHASE — contract 167, read beside contract 193

The Championship spends most of its life BEFORE the knockout exists. For four
commits this page answered that phase with a single sentence — *"The knockout
draw has not been made yet."* — which is true, and was the whole of what it said
about the phase.

Contract 167 (`get_season_cup_group_stage`) has held those standings since it
shipped alongside contract 166's draw. Production reads it
(`SeasonCupGroupStage.tsx`); this lane did not. Unlike the elimination gap
above, this needed **no backend delta at all** — only the read.

### The two reads disagree by design

A Championship in its group phase has a REAL TABLE and NO BRACKET. That is not
an error state; it is the ordinary shape of the competition for most of a
season. So the two reads:

- are issued **concurrently**, with a **catch per promise** rather than one
  around the pair — a `Promise.all` over unguarded promises discards an answer
  that already arrived;
- resolve into **separate panel unions**, so neither read's failure can silence
  the other's answer.

`championshipSourceLifecycle.test.tsx` holds all three cases: bracket fails and
groups survive, groups fail and the bracket survives, and both fail and the page
still reaches `ready`.

### What the panel carries, and what it refuses to compute

| Fact | Source | Rule |
| --- | --- | --- |
| `rank` | the standings authority | printed in the position it arrived; **nothing sorts** |
| `tablePoints`, `pointsFor`, `pointsAgainst`, `exacts`, `corrects` | the same | carried, never totalled here |
| `scorelineError` | the same | **nullable, and stays null** — no settled prediction is not an error of zero |
| `isYou` | contract 167's `is_me` | the server's flag; no name or id is compared |
| `isYours` | contract 167's `is_my_group` | the same |
| `yourOrdinal` | `my_group_ordinal` | **null is a real answer** — holding no group is not the same as there being no groups |

A mutation that sorts the rows by rank and one that defaults the scoreline error
to zero both fail.

`GroupPanel` has four states and none is inferred from another: `unavailable`
(the read failed), `not-entered` (`entered: false` — a competition the caller is
not in), `no-groups` (`available: false`, or a drawn stage with no tables yet)
and `groups`.

### Contract 167 is the INITIAL group stage, and that is a scope limit

Read from the function rather than its name. `get_season_cup_group_stage` pins
three things to `phase_kind = 'initial'`:

```sql
select member.group_id into v_my_group ...  and member.phase_kind = 'initial';
from public.bonus_cup_groups cup_group     where ... cup_group.phase_kind = 'initial'
'group_count', (select count(*) ...        where ... g.phase_kind = 'initial')
```

and its own comment says so: *"Contract 167, amended by contract 169. The
**initial** group stage of a Predictor Championship."*

So a competition that has SPLIT still shows its INITIAL groups here. That is the
contract's stated scope, not a defect, and it is the honest thing to render —
the initial table is a real table that really happened. But it is **not the
reader's current group** once a split exists.

**Contract 133 (`get_season_cup_player_view`) was expected to answer the split.
Read against the SQL, it does not** — and an earlier draft of this section said
it did, which was wrong. It carries facts 167 does not hold at all (the caller's
own group FIXTURES: `is_my_fixture`, `matchday`, `home_points`/`away_points`,
`opens_at`/`locks_at`, and a per-fixture `result`), and it returns `phase_kind`.
But it does not resolve its own group: it takes it from contract 120.

```sql
v_group_id := (v_phase #>> '{group,id}')::uuid;   -- contract 133
```

and contract 120's lookup is unfiltered:

```sql
select member.group_id, member.phase_kind          -- get_season_cup_phase
  into v_group_id, v_phase_kind
  from public.bonus_cup_members member
 where member.competition_id = p_competition_id
   and member.user_id = v_uid;
```

no `phase_kind`, no `order by`, no `limit`. `bonus_cup_members`'s primary key is
`(competition_id, user_id, phase_kind)` (contract 102), so **one entrant holds
two rows once a split exists** — and a plain PL/pgSQL `SELECT … INTO` over two
rows takes one and raises nothing.

Driven on a disposable PostgreSQL 16 against both shapes, with one entrant
holding both memberships:

```
 CONTRACT 120 SHAPE ->  initial / aaaaaaaa-…      <- the PRE-SPLIT group, silently
 SCALAR SUBQUERY SHAPE -> SQLSTATE 21000 : more than one row returned by a
                          subquery used as an expression
```

**This is contract 205's defect again, in its quieter and worse form.** Contract
193 used a scalar subquery, so it raised and was found. Contract 120 uses
`SELECT … INTO`, so it *chooses* — and a split entrant is shown their pre-split
group, its members, its table and its fixtures, with no error anywhere.

It is not confined to this lane: **contract 120 is called in production** at
`src/services/supabase/seasonCup.ts:88`.

So contract 133 is **not consumed**, and would not be consumed for the split
case even if it were, because the group it answers about is not determinate.

**Recorded as deliberate scope, not as done.** Stage 12 renders the group phase
from contract 167 because that closes the predicate's gap — the phase now has a
real UI state rather than one sentence. Two things remain open and are named
here so neither is mistaken for shipped:

1. a split competition's CURRENT group table, and
2. the reader's group-phase fixtures.

Both were expected to be frontend-only. **They are not.** Contract 133 is the
read that holds them, and its group resolution is indeterminate after a split
for the reason proved above, so consuming it would put an arbitrary answer on
the page. This is therefore a **second owed backend delta**, distinct from §6's:

> **Owed: pin `get_season_cup_phase`'s membership lookup to a determinate row**,
> the way contract 205 pinned contract 193's seed lookup. The correction is the
> same shape — the caller's CURRENT phase is the one a phase read should answer
> about — but it is a behaviour change to a function production already calls,
> so it needs its own contract, its own regression test proving a
> both-memberships entrant resolves to the split group, and its own review.

**No migration is written here.** Migrations, including this one and §6's, are
another session's work. Recorded rather than attempted.

### It is a `<table>`

Rank, name and five measures per row is tabular data. A screen reader navigating
by column needs headers a grid of `<div>`s cannot supply. Eight columns do not
fit a phone, so the TABLE scrolls inside its own container and the page does
not — dropping columns at narrow widths would be this file deciding which of the
standings authority's measures matter.

---

## 9. THE BRACKET ON A PHONE

The predicate asks for a layout that works "on phone and desktop without
becoming unreadable", and the honest reading is that **a knockout tree does not
work on a phone**: sixteen seats across four columns at 375px is four columns
nobody can read.

So this is **not a scaled tree**. Rounds are sections, and the container query
changes how many sit side by side rather than how small they are:

| width | shape |
| --- | --- |
| < 700px | one round per row — the reader reads **down** the competition |
| ≥ 700px | two rounds across |
| ≥ 1180px | rounds as **columns** — the shape a bracket is usually drawn in, reached by **widening** rather than by shrinking |

`auto-fit` rather than a fixed column count, because how many rounds a
Championship has is the server's business and not the stylesheet's.

**Measured, not asserted.** jsdom evaluates no container query, so the browser
suite reads the rendered geometry: at 375 a sixteen-seat draw resolves to four
rows and one column with zero horizontal overflow; at 1920 to one row and
several columns; at 768, two by two. Both geometric assertions were
mutation-proved — pushing the expanded query out of reach fails the columns
test, and forcing four columns at every width fails the stacking test.

---

## 10. ARCHITECTURE

```
get_season_cup_bracket ──→ ChampionshipSource ──→ buildChampionshipModel ──→ model ──→ VNextChampionship
   (contract 193)            (data)                 (pure)                  (contract)   (visual)
```

| file | owns |
| --- | --- |
| `src/services/supabase/seasonCupBracketModel.ts` | contract 193's decoder — **split from the query wrapper** so it can be tested without Supabase configuration, following `seasonLmsFieldModel` |
| `src/services/supabase/seasonCupBracket.ts` | the RPC call |
| `src/vnext/models/championship.ts` | the presentation contract |
| `src/vnext/integration/championship/buildChampionshipModel.ts` | the **only** mapper. Pure: no network, storage, clock or React |
| `src/vnext/integration/championship/useVNextChampionshipSource.ts` | acquisition and classification |
| `src/vnext/championship/VNextChampionship.tsx` | the visual surface |
| `src/vnext/fixtures/championship/scenarios.ts` | 25 deterministic worlds, each a premise |

**Reads get independent outcomes** — and here for a reason beyond "they can fail
separately": `get_season_cup_phase` selects the caller's membership row with no
`ORDER BY` and no `LIMIT`, and after a split that table holds two rows per
player, so it can answer about the initial group while a sibling read answers
about the split one. **Two reads that can disagree must not be merged behind one
"loaded".**

**Who "you" are comes from `my_ties[].is_home`**, never from an id passed in —
Stage 9's identity rule in the one place this page could break it. `is_yours`
marks the SEAT and is not enough: it does not say which SIDE of the tie the
caller holds. Contract 193 states that separately, per fixture, and states it
for SETTLED ties too — which is why it still answers after the final, where
`my_tie` (filtered `winner_user_id is null`) has gone null. Pairing one of the
caller's own ties with its seat by `fixture_id` names the caller outright.

An earlier build derived the side by subtracting the CURRENT opponent out of the
caller's seat. That marked the wrong player from round two onward — a reader who
had been the away side saw `(you)` against their old opponent — and it made
`champion` unreachable, because a champion has no live tie to subtract with. The
seat flag alone cannot answer a question about sides.

---

## 11. ROUTES

Production runs four addresses: index, instance, instance+table,
instance+fixtures. **Stage 12's target is two**, and the reason is in the data
rather than in a preference for fewer pages.

`SeasonChampionshipPages.tsx` branches on a `mode` after loading a **single**
`ChampionshipPlayerView`, and says so about its own neighbour table: *"IT USES
WHAT THE PAGE ALREADY LOADED … this costs no request."* Three addresses over one
read is a navigation habit, not a data boundary — the opposite of Stage 9's
leagues, where two tables had **two different rank authorities** and had to stay
apart. The index is a genuinely separate read (`get_my_season_cup_instances`)
and keeps its address.

| route | status |
| --- | --- |
| `/dev/vnext-championship` | connected harness. **Contract 193's first caller** |
| Storybook `vNext/Predictor Championship` | 25 worlds, the review surface |
| `/competitions/:c/:s/games/championship/*` | **production, untouched** |

---

## 12. PRODUCTION ISOLATION

Stage 12 is a parallel lane. No production route was cut over and no production
component's rendered output differs by a character. One production file is in
the diff — `src/App.tsx`, for the `import.meta.env.DEV`-gated harness route, in
the shape Stages 6 through 11 already use, tree-shaken out of a production
build.

Cutover is Stage 14 and requires explicit authority.
