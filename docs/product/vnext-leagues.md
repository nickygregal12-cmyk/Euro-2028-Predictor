# vNext Leagues — the product authority

**Status:** Stage 9 deliverable. This is the authority for what vNext Leagues
**is**, what it may claim, and what it must never assert.
**Scope:** the people layer of the Competition Deck — the season's standings and
a private league's own table, inside one competition and one game.
**Does not govern:** player profiles or head-to-head (Stage 10), Last Man
Standing (11), the Predictor Championship (12), league creation, joining,
invitations or membership administration, scoring, settlement, or any production
route. **No production surface changed in Stage 9.**

**Reads consulted:** contract 191 `get_season_leaderboard`, contract 128
`get_season_league_standings`, contract 150 `get_season_league_movement`,
`get_my_game_leagues`. **Backend delta: none.** No migration, no RPC, no RLS
change, no provider call, no write of any kind.

---

## 1. The question this surface answers

> **WHO AM I COMPETING AGAINST HERE, AND WHERE DO I STAND?**

"Here" is load-bearing. A standings table is the easiest place in the product to
lose track of what is being ranked: *Sunday Club* alone could be any of three
games in any of twenty competitions. So the page states all three dimensions —
competition, game, people — and the shell has kept them apart since Stage 7.6
for exactly this reason.

Leagues is the **third** of the four competition-scoped destinations. It is not
a social network, not a directory, not a friends list and not a search surface.
There is no follower, no request, no message and no cross-competition player
identity anywhere in it.

---

## 2. THE SOCIAL IDENTITY RULE — the decision this stage turns on

**A player row is addressable because the SERVER said the caller may address it,
never because the browser found a display name it liked.**

Contract 191 sends three things per row and `seasonLeaderboardModel.ts` states
the rule in terms: *matching players by display name is the defect the reference
exists to make impossible, and inferring `reach` from the presence of `playerId`
would put a permission rule in the browser.*

| field | what it is |
| --- | --- |
| `playerRef` | a season-scoped stable reference. The IDENTITY. |
| `reach` | `self` \| `profile` \| `compare` \| `name-only` — **the server's permission decision** |
| `playerId` | present only where a profile will actually answer. The ADDRESS. |

### How the model holds it

`LeaguePlayer.destination` is a discriminated union with **exactly one openable
case, and that case requires the id**:

```ts
type LeaguePlayerDestination =
  | { kind: 'you' }
  | { kind: 'open'; playerId: string }
  | { kind: 'closed'; reason: 'not-shared' | 'not-stated' }
```

A row the caller may not open **has no id anywhere in its model**. A surface
cannot construct a link to it, because there is nothing to construct one from —
this is a structural guarantee rather than a discipline.

The mapping is one function, `destinationOf(reach, playerId, isYou)`:

- `self` → `you`. Drawn, never linked: you do not open yourself from a table you
  are already standing in.
- `profile` **with** an id → `open`. The one addressable case.
- `profile` **without** an id → `closed`, reason `not-stated`. The server said
  the caller may look and did not say where; a surface cannot open a door it was
  given no handle for.
- `compare` → `closed`, reason `not-shared` — **even when an id is present.**
  This is the mirror case, and it is the one a `playerId !== null` test gets
  wrong.
- `name-only` → `closed`, `not-shared`.

### Two players with one name

`duplicateNames` is the binding world and exists because three separate defects
are visible only in it:

1. **both strangers become clickable** — if a destination were derived from a
   name;
2. **pressing one opens the other** — if an intent carried a name;
3. **React reuses one person's row for another** — if rows were keyed by name.

`leagueRowKey(player, position)` returns `player.ref`, falling back to
`position:<n>` — a fact about the page, never a claim about a person. And
`LeaguesIntent` has no name field at all:

```ts
| { kind: 'openPlayer'; playerId: string }
```

A host wiring this to a router literally cannot receive a display name to route
by. `e2e/vnext-leagues.spec.ts` presses the one openable "Sam Docherty" by click
and by keyboard and reads what the page **emitted**, rather than reading an id
back off the element it selected by that id.

### What a closed row looks like

**Plain text.** Not a disabled button, not a link that refuses, not a lock icon.
A disabled control teaches a player there is something they are missing out on,
when the truthful reading is that most of a season's entrants are simply people
they have never shared a league with. `frame-nothing-openable-phone` asserts
there is no control **and nothing disabled** anywhere in that table.

---

## 3. TWO TABLES, AND THEY ARE NOT ONE

The second decision this stage turns on, and it is not ours — it is ADR 0011's
and contract 128's. `seasonLeagueStandingsModel.ts`:

> the totals come from `season_standings` so a league cannot disagree with the
> season, but the RANK is recomputed inside the league … a shared parser would
> invite a shared presenter, which is how a competition-wide ranking gets
> asserted by accident.

So:

- `LeaguesGlobalTable` and `LeaguesPrivateTable` are **different types** with
  different row shapes — not one table with a `kind`, and not one row type with
  half its fields nullable;
- `GlobalStandingsTable` and `PrivateStandingsTable` are **two components** —
  one component with `kind="private"` is the shared presenter the model warns
  about, and the columns genuinely differ (owner, entry state and movement exist
  only in a league);
- the same player carries a season rank of 318 and a league rank of 2, and
  **neither is ever reconciled with the other.**

### Rank is never computed anywhere in this lane

Not sorted, not renumbered, not derived from points, not inferred from array
position. `rank`, `tied` and `position` are three different server-supplied
facts and all three are carried and printed as given.

The temptation is specific: `rows.map((row, index) => index + 1)` produces
something that looks exactly like a rank and is wrong the first time two players
tie or a page starts anywhere but the top. Contract 160 warns about it for the
football table in as many words; contract 128 recomputes a private league's rank
server-side precisely so nobody has to here.

`tiedRanks` is the world that makes it visible: four players share rank 2 and
the next row is rank 6, so a renumbering produces 1–6, looks entirely plausible,
and is wrong in five places.

### Points never travel alone

ADR 0012: *two players on 84 points from 22 and 23 matchweeks are not tied in
meaning.* Every points cell in this lane is followed by its matchweek count, and
there is no variant that drops it. `leagueTied` is the world: two players on the
same server rank, on the same points, from 12 and 11 matchweeks.

### `hasMore` is the server's

Never derived from `shown < total`. The two usually agree, and the day they do
not is exactly the day a player would be told there is nothing further while the
read is still holding a page back.

---

## 4. THE READER IS USUALLY NOT ON THE PAGE

The commonest real shape of a season table is 412 entrants, twenty-five shown,
and the person asking standing 318th. Both reads therefore return the caller's
own row **separately**, and the page pins it below the table when it is not
already in it.

A surface that searched the rows for `isYou` would show most players nothing at
all — which is the whole answer to the question the page exists to answer.

`youOnPage` is decided by `rows.some(row => row.isYou)`, the server's own mark.
A comparison on rank would call two players tied on one rank the same person; a
comparison on display name is the defect contract 191 exists to remove.

---

## 5. MOVEMENT ONLY EXISTS OVER A SETTLED MATCHWEEK

Contract 150 answers `settled: false` with no rows for an unsettled matchweek.
That is an answer, not a failure, and it is the state a new season is in for
most of its first weeks.

**Before anything settles there is no movement column at all** — not a column of
em-dashes. A column of dashes says "nobody moved"; the truth is "nothing has
been settled yet", and those are different sentences. The page says the second
one in words: *Movement appears once a matchweek settles.*

The mapper enforces it rather than passing the flag downstream: an unsettled
payload produces an **empty map**, so a component cannot draw movement it was
never given, even if it tried.

`movementSettled: true` with `movement: null` on a row is a third, real state —
a member who joined after the matchweek. The dash is `aria-hidden`, so it is
paired with an sr-only **"no movement recorded"**: without it that cell is
completely silent to a screen reader, and a silent cell is indistinguishable
from a broken one.

**The flag and the map come from one predicate**, and it requires a labelled
settled matchweek **that named somebody**. `settled: true` with an empty member
list is constructible and would otherwise draw a "Moved" column in which every
row is a dash. The rest of the reason: A surface reads
`movementSettled` to decide whether to *draw* the column and the map to *fill*
it, so they must agree — a payload saying `settled: true` with a matchweek
carrying no label maps to no movement at all, and a flag that disagreed would
draw a "Moved" column in which every row is a dash. That is exactly the column
of em-dashes this section forbids, arriving through a mismatch instead of a
decision.

**The sign is the server's.** `movement` is `rankBefore - rankAfter`, positive
for a climb, copied rather than recomputed from the two ranks beside it: two
ways of producing one number is one chance for them to disagree.

**Movement is never listed as unavailable.** It is absent far more often than it
is present, and "movement unavailable" on every table before the first
settlement would be an apology for the ordinary state of a new season.

---

## 6. A MEMBER WHO NEVER ENTERED THE GAME

`hasEntry: false` is a real person who joined a league and never entered the
game. `get_season_league_standings` includes them deliberately, *because the
alternative hides a league from the person who created it* — and in
`leagueWithNonEntrants` one of them **is** the organiser.

Drawing them on zero points beside players who have actually played, with
nothing to say so, would be a lie of omission. They are marked "Not entered",
quietened, and **not hidden and not struck through**: they are in the league,
they have simply not played.

---

## 7. THE SCOPE IS A CHOICE, NOT A FILTER — and the page holds no state for it

"Season" and each private league are two different tables with two different
rank authorities, so the control **switches between tables** rather than
narrowing one.

**`VNextLeagues` has no local scope state.** Stage 8's filter is local because
filtering a list the page already holds changes nothing about what was read.
Switching scope is not that: the model carries exactly one table, and a pressed
state that ran ahead of the model would show "Sunday Club" selected above the
season's rows — the chooser claiming a table the page is not drawing, which is
the one thing a control over two rankings must never do.

So pressing fires an intent and nothing else. `selectedLeagueId` is an **input**
to `VNextLeaguesScreen`, the host changes it, and the highlight moves because
the **table** moved. The browser suite proves it by pressing a league and
asserting the ROWS changed, not that a highlight did.

### The chooser disappears below two choices

A player in no private league sees the season table with no chooser at all — the
shell's own rule for its competition switcher, applied one layer down. A switch
offering one option teaches a player there is a decision and then spends their
press proving there is not.

The league list is read in **both** scopes, deliberately: without it a player
looking at the season standings would have no way to reach their own league.

---

## 8. AN EMPTY ANSWER IS A SENTENCE, NOT AN EMPTY TABLE

A `<table>` carrying column headers over an empty `<tbody>` announces a table
structure with nothing in it. It is worse prose than a sentence and it is a
genuine WCAG 1.3.1 failure — the accessibility scan in
`tests/vnext/leagues.test.tsx` found exactly that before the empty state
existed.

Zero rows is also **not an error**. It is the server's own answer, and the early
days of a season legitimately have one. The unavailable strip is where a read
that did not answer is reported; the sentence is where a read that answered
"nobody" is.

---

## 9. WHAT THE APPLICATION COULD NOT ANSWER

`LeaguesModel.unavailable` names it — *"your private leagues"*, *"the season
table"*, *"this league's table"* — and the page says so in one strip. It is
never an error state.

Two rules hold everywhere in this lane:

1. **A failed read is a fact about the request, never about the people.** "We
   could not load these standings" and never "you are not in any league" or
   "there is nobody here". Only the server can say the second, and when it does
   the page draws an ordinary empty table instead.
2. **A partial page stays a page**, and it is the ACQUISITION that guarantees
   it, not the presentation. Only a failed **play context** takes the whole
   surface down, because without it there is no id to address anything with.
   Every read below it resolves to `null` instead; each read the strip names is
   named there:

   - league list fails, table answers → the table is drawn in full;
   - chosen league's table fails, list answers → **the chooser stays usable**;
   - list fails while a league's table answers → **`leaguesSwitchable` is still
     true**, because `scope.kind === 'private'` is itself the second choice.
     Without that exception the reader stands in a league the page cannot name
     with no control to leave it by — the same stranding, arriving through the
     mirror case;
   - movement fails → the table loses its arrows and nothing else.

   The **retry lives in the ready state**, beside the sentence that admits the
   gap, precisely because a partial read now produces a ready page. A whole-page
   failure notice would take away the only control that could get the reader out
   of the league that failed.

   `tests/vnext/leaguesSourceLifecycle.test.tsx` holds all of this, and holds one
   thing no other test could see: **a superseded request never writes.** Switch
   from league A to league B, let B answer and A then reject, and a stale write
   would store `failed` under A's identity — which the hook's memo reads as
   `loading` forever, with unchanged effect deps and nothing left to refetch. A
   skeleton with no chooser and no retry until a reload.

An unnamed league is called **"This league"**. Inventing a name from the id
would be worse than admitting the list did not answer.

### `leagues: []` has two meanings, and the model separates them

An empty league list means either *the player is in no private league* or *the
read did not answer*, and only the first entitles the page to say anything about
the reader. `LeaguesModel.leaguesKnown` carries the difference — `true` when the
list answered, even with nothing — and `leaguesKnownEmpty(model)` is the only
thing that unlocks the sentence *"You are not in a private league … yet."*

Gating that sentence on the chooser's absence instead would look identical until
the day the list fails, at which point the page would tell a player something
about themselves on the strength of a read that never came back. The flag exists
rather than a check against `unavailable`, because `unavailable` is a list of
SENTENCES for a reader and matching against its contents would make a display
string load-bearing.

---

## 10. NO N+1, HELD BY THE TYPE

A standings list of fifty costs exactly what a list of five costs. Nothing loops
over rows to fetch anything, and **`LeaguePlayer` has no field a per-player read
would fill**:

```ts
type LeaguePlayer = {
  ref: string | null
  displayName: string
  destination: LeaguePlayerDestination
}
```

Contract 191 already carries the reach and the id that decide whether a row
opens; contract 128 already carries `isYou`, `isOwner` and `hasEntry`. There is
no avatar, no form, no rank history, no head-to-head and no favourite club on a
row — so a row cannot start asking even by accident. This is the same discipline
Stage 8 used to keep head-to-head out of a fixture list.

`tests/vnext/leaguesIntegration.test.ts` holds it as an assertion on the key set
rather than as a note.

**One table per visit.** The source reads the season table *or* a league's table
and its movement, never both — the page shows one table, and the unused one is
not a useful fallback for the other.

### The one precondition this lane does not enforce

`tournamentId` (from the play context) and `gameCompetitionId` (from the host)
arrive as **independent inputs**. A host pairing a `gameCompetitionId` from one
competition with a competition/season slug from another would produce private
rows marked openable whose ids contract 191's `season_player_reach` would answer
`compare` for in the tournament actually being viewed.

So the openability guarantee is structural **given a well-formed host pair**, and
nothing here asserts that pair. It is not exploitable from the surface — the
server refuses the profile read regardless, which is where the boundary actually
lives — but it is a precondition rather than a proof, and the cutover stage owns
making the host supply both from one place.

---

## 11. WHAT IS NOT HERE, AND WHY

| Absent | Why |
| --- | --- |
| Player profiles | Stage 10. This stage owns the doorway and whether it exists; not what is behind it. |
| Head-to-head | Stage 10, contract 129. It needs an opponent id and a locked matchweek, neither of which a standings row is the place to decide. |
| Rank over time | Contract 192, Stage 10. A sparkline in a table row is a second read per row. |
| League creation / joining / invites | Not Stage 9's scope. The page says what a private league IS when a player has none, and offers no button — a control here would be a door onto a corridor that has not been built. |
| An invite code | The list read supplies one; a standings surface has no business with it, and a model that carried one is a model somebody renders. Asserted absent. |
| Period / matchweek tables | `seasonPeriodStandings` exists; a period selector is a second axis this stage did not need to answer its question. Deferred, not forgotten. |
| Pagination controls | The page shows one page of a table it did not paginate itself. A "load more" would be a promise this surface cannot keep without a second read it was not given — so it says *"Showing 12 of 240 members"* and stops. |
| Any prediction, score or lock | Leagues ranks people. Football is Matches; the games are Games. |

---

## 12. ACCESSIBILITY AND PRESENTATION

- **They are real `<table>`s** — `<th scope="col">`, a rank in `<th
  scope="row">`, a visually hidden `<caption>` as the accessible name. **The
  pinned "your standing" table carries its own headers too**: a one-row data
  table without them reads its rank as a bare "318" with nothing to associate it
  to, and axe does not flag a header-less data table, so only an assertion
  catches it. A
  standings table IS tabular; `LeagueLadder` on Home uses an `<ol>` because it
  shows a five-row window around one person. The markup follows the content
  rather than the house style.
- **Nothing is carried by colour alone.** A tie is `=` **and** an sr-only
  "tied". Movement is a colour **and** an arrow **and** a word **and** the
  matchweek it is over. "You" is an accent **and** the word **and**
  `aria-current`. The table is fully readable in greyscale.
- **No display name is ever clipped.** No `text-overflow`, no line clamp, no
  ellipsis anywhere in `leagues.module.css`. `overflow-wrap: anywhere` stops one
  long word widening the table; the row grows instead. A truncated name is the
  contract-191 failure arriving through CSS.
- **The table and the chooser scroll inside their own boxes**, never the page.
  Measured at 375 in the browser suite — on `main`, the page's own landmark,
  because the workshop frame root is `overflow-x: clip` and Chromium reports its
  `scrollWidth` from descendants an intermediate scroller has already clipped.
  Measuring the frame, as the Matches suite correctly does for a page with no
  internal scroller, would report both of these as the page scrolling sideways.
- **A player's name is a 44px target**, not the 20px height of the word. The row
  grows to hold it.
- **Container queries on `vnext-page`.** A standings table is one block that
  occupies the working column at every width, so the page's own container is the
  right thing to ask — there is no equivalent of a match row's self-measurement
  because there is no equivalent of a match row.

---

## 13. ARCHITECTURE

```
get_season_leaderboard (191) ┐
get_my_game_leagues          ├→ LeaguesSource
get_season_league_standings (128) │
get_season_league_movement (150) ┘
        ↓  buildLeaguesModel        PURE — no clock, no rank arithmetic, no React
     LeaguesModel                   global and private kept apart
        ↓
     VNextLeagues                   model-only, inside VNextShell, destination="leagues"
```

`VNextLeagues({ model })` is usable with no network, no auth and no Supabase —
enforced by `tests/vnext/vnextProductionBoundary.test.ts`, which forbids
`components → services`. Storybook and every render test hand it a model
directly.

**Files**

| | |
| --- | --- |
| `src/vnext/models/leagues.ts` | the presentation contract and its selectors |
| `src/vnext/integration/leagues/leaguesSource.ts` | what the application hands vNext |
| `src/vnext/integration/leagues/buildLeaguesModel.ts` | the pure mapper |
| `src/vnext/integration/leagues/useVNextLeaguesSource.ts` | acquisition, three waves |
| `src/vnext/integration/leagues/VNextLeaguesScreen.tsx` | the connected surface |
| `src/vnext/integration/leagues/VNextLeaguesStates.tsx` | loading, signed out, no competition, failed |
| `src/vnext/leagues/VNextLeagues.tsx` | the page |
| `src/vnext/leagues/LeagueTables.tsx` | the two tables |
| `src/vnext/leagues/LeaguePlayerCell.tsx` | the one place a row's openability is decided |
| `src/vnext/fixtures/leagues/scenarios.ts` | twenty-one deterministic worlds |
| `src/vnext/stories/Leagues.stories.tsx` | the review surface |
| `tests/vnext/leaguesIntegration.test.ts` | the mapping, as truth |
| `tests/vnext/leaguesSourceLifecycle.test.tsx` | acquisition: superseded requests, and which failures are partial |
| `tests/vnext/leagues.test.tsx` | the promises, plus the accessibility floor |
| `e2e/vnext-leagues.spec.ts` | the picture, and the two real interactions |
| `src/dev/VNextLeaguesPreview.tsx` | the connected proof, dev-only |

---

## 14. ROUTES

Stage 9 resolves the four rows the migration matrix left to it. **Every one is a
TARGET IA decision and not one repoints a route.** See
[`vnext-route-migration-matrix.md`](vnext-route-migration-matrix.md) §8.

| Route | Fate | Stage 9's answer |
| --- | --- | --- |
| `/competitions/:c/:s/leagues` | **REDESIGN, built** | The people surface, competition-scoped and game-scoped, with the season table and each private league as scopes inside it. |
| `/leagues` | **MERGE → HIDE / ABSORB** | Its job — all private play across every competition — is absorbed. A cross-competition people surface would rank players across competitions they do not share, which ADR 0011 refuses at the data layer. |
| `/league/:id` | **REDESIGN, deferred to Stage 15** | Euro-scoped. Its weekly counterpart is now built; the tournament one belongs with the rest of the Euro adoption. |
| `/league` | **REDIRECT** | Unchanged. |

**Technical consequence at the time of Stage 9: none.** Every address kept
resolving as it did, and the vNext surface was reachable only from the dev-only
`/dev/vnext-leagues` harness. **Stage 14 cut it over.**
`/competitions/:c/:s/leagues` is served by the vNext surface in production now,
behind `VITE_UI_FOOTBALL_HUB_LEAGUES`, with `SeasonLeaguesRoute` still mounted
so unsetting the flag restores it. See
[`vnext-route-migration-matrix.md`](vnext-route-migration-matrix.md) §13.

---

## 15. PRODUCTION ISOLATION

Nothing in Stage 9 touches a production surface, a production route or a
production build. `VNextLeaguesPreview` is behind `import.meta.env.DEV` at its
import site in `src/App.tsx`, so a production build resolves that to `false`,
tree-shakes the lazy import and emits no chunk. Nothing in the product's
navigation points at it and there is no flag that turns it on.

The existing `GlobalLeaguesPage`, `SeasonLeaguesRoute` and
`LeagueDetailRoutePage` are untouched.

**This section records Stage 9's diff, and stays true of it.** The isolation it
describes ended at Stage 14, which cut the Leagues destination over — see §14.
