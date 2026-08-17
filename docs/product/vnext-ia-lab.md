# vNext Stage 7.5 — information architecture, navigation and competition discovery lab

**Status:** SUPERSEDED AS A SELECTION SURFACE — the selection was made in Stage 7.6. This document is now the EVIDENCE for that decision: what was built, what was found, and what the two rejected concepts contributed.
**The decision:** [`vnext-shell-ia.md`](vnext-shell-ia.md) — Concept A, the Competition Deck, is the accepted vNext information architecture. Concept B contributed cross-competition attention as a secondary layer; Concept C contributed Jump as an optional accelerator.
**Do not build on B or C as primary architectures.** They are kept, unmodified, because a decision record whose losing options have been deleted is a decision record nobody can audit.
**Scope:** presentation and information architecture only.
**Does not govern:** scoring, locks, membership, reveal, settlement, progression, profile visibility, provider truth or any route currently registered in `src/App.tsx`.
**Companion:** [`vnext-route-migration-matrix.md`](vnext-route-migration-matrix.md) — every user-facing route with an explicit fate.
**Implementation:** `src/vnext/ia/`, `src/vnext/models/ia.ts`, `src/vnext/fixtures/ia/`, reviewed at `vNext/IA Lab (Stage 7.5)` in Storybook. **All three concepts still render and are still reviewable.** The accepted shell does not import any of it; `src/vnext/models/shell.ts` is the product contract and `models/ia.ts` remains the lab's own.

---

## 1. Why Stage 7.5 exists

Stages 3 to 7 designed **surfaces**: Home, then the Match Predictor. Both are
accepted and neither is touched here. The obvious next move was to keep going —
Matches, then Leagues, then Last Man Standing, then the Championship — taking
them in the order the current navigation lists them.

That move produces **the old product structure, beautifully redesigned.**

The evidence that the risk is real is Last Man Standing. It has a complete
domain — rounds, picks, used-club cycles, auto-assignment, refusals, settlement,
elimination, restart lifecycle — and it had been treated in the vNext programme
as one more page in a queue. Nothing had forced an inventory, so nothing had
noticed.

Stage 7.5 is a deliberate change of method: before designing another surface,
decide what the **mental model** of the product is.

### The current routes are capability authorities, not design authority

`src/App.tsx` and `src/app/shellRoutes.ts` are an excellent record of what the
platform can *do*. They are not a statement of what the interface should *be*.
A route exists because a job exists; a navigation item exists because a player
needs a permanent place to stand. Those are different arguments, and the current
product answers the second by copying the first.

Nothing in this stage repoints a route, and the route migration matrix exists
precisely so that the two concerns can be kept apart on paper before they are
kept apart in code.

---

## 2. The three dimensions

The central claim of Stage 7.5 is that this product has **three independent
dimensions** that the current interface lets collapse into one flat selector.

| Dimension | Question | Examples |
| --- | --- | --- |
| **Football context** | Which competition's football am I looking at? | Premier League · 2026/27, Champions League, Euro 2028 |
| **Game** | What am I doing with that football? | Match Predictor, Last Man Standing, Predictor Championship |
| **People** | Who am I doing it against? | The global table, a private league, one rival, a head-to-head |

They are modelled apart in `src/vnext/models/ia.ts` — three types, no field
derived from another — for the same reason `src/features/hub/playerCompetitions.ts`
models Follow, Join and Favourite apart: a rule promised in a comment lasts until
the next refactor. A concept that wants to draw a competition, a game and a
private league in one list has to reach into three types to do it, and that
friction is the point.

**A season is part of the football context, not a fourth dimension.** A player is
in "Premier League · 2026/27"; a cup with no season carries `null`. Making it a
level of its own would put a segment in every breadcrumb that changes about once
a year.

---

## 3. The three concepts

All three render the **same twelve deterministic worlds** and share **every
destination body** — the same league table, the same game status lines, the same
discovery catalogue. The only variable is the chrome: what is permanently on
screen, what a switch costs, what is one press away and what is three. That is
the only fair way to review an information architecture.

### Concept A — the Competition Deck

> *"I am inside a competition. Everything I see belongs to it until I say otherwise."*

Football context is the **root**. The largest permanent control in the product is
the competition itself, and the four destinations beneath it — Home, Matches,
Games, Leagues — are that competition's own. There is no global Play, no global
Matches and no global Leagues.

| | |
| --- | --- |
| **Global navigation** | Four competition-scoped destinations. A bottom bar under 1120px, a rail at and above it. |
| **Competition switching** | A large permanent switcher: a full-width control on a phone, the head of the rail on a desktop. It opens a sheet of recents, then the player's own, then the whole catalogue. **At one competition it is not a button at all** — it renders as a label. |
| **Competition discovery** | A separate, deliberately small **Explore** control: a row in the rail on a desktop ("All competitions"), one quiet button beside the competition on a phone. **It is not the switcher and never becomes it.** Switching between competitions the player already has and browsing the ones they do not are different actions, and only the first is worth removing when there is one competition. Explore is present at every scale, so an EPL-only player on a phone still has a route into the other nineteen. |
| **Game switching** | Games is a destination. Every game is a peer inside it, with its own status vocabulary. |
| **Social model** | Leagues is one of the four. Private leagues and the global table sit on the same surface, scoped to the competition. |
| **Desktop** | A 264px rail: the switcher, the four destinations, a bounded six competition shortcuts, then All competitions and the account. The switch becomes free because the list is already open. |
| **Mobile** | The competition bar is the loudest permanent thing on screen; the four destinations are small, and Explore is smaller still. |
| **Advantages** | The clearest answer to "where am I" of the three. A one-competition player pays literally nothing. Games — and therefore Last Man Standing — get a place where they are peers. Closest to what the existing backend and route tree already assume, so the migration is the cheapest. |
| **Weaknesses** | **No cross-competition view of what needs doing, at any time.** Urgency in a competition the player is not currently in is a dot on a rail row, and a dot cannot say what. A four-competition player with one deadline has to already know which competition it is in. The rail is also the most expensive chrome of the three. |

### Concept B — the Attention Inbox

> *"The product tells me what to do. Competitions are labels on the work."*

The front door is a **queue**, not a place: everything that needs the player,
across every competition and every game, ordered by how much it needs them.
Football context is demoted to a **filter**. Games are never navigation at all —
a game is the *shape* of a card.

| | |
| --- | --- |
| **Global navigation** | Three anchors: Needs you, Football, People. |
| **Competition switching** | A filter chip row (a scroller on a phone, a column on a desktop), starting on **All**. Switching narrows the queue; it never changes destination. |
| **Game switching** | There is none, deliberately. A game appears when it has something to say. |
| **Social model** | People is one of three anchors, and is unscoped by default. |
| **Desktop** | The filter becomes a 240px permanent column carrying the anchors and every competition with its own count; the queue takes the rest. |
| **Mobile** | Three anchors over a horizontal filter scroller. |
| **Advantages** | **The best scaling of the three, by construction** — nothing in the permanent chrome grows with the catalogue, because the catalogue is not in the chrome. The strongest deadline and matchday behaviour. Last Man Standing is structurally impossible to bury: there is no tab for it to be the fourth of, and its card has its own shape and its own leading edge. |
| **Weaknesses** | **"Where am I" is the weakest of the three** — the honest answer is usually "all of them", which is not what a football product feels like. Browsing is second-class: reading a table on a quiet Tuesday means leaving the thing the architecture is for. A quiet day is an empty front door, and it degrades to "here is what just happened". It also has **no natural place to say that a competition does not run a game** — the lab had to add a sentence under the filter to give it one, which is a real cost the other two do not pay. |

### Concept C — the Spine and the Command Surface

> *"There is one home and one way to jump anywhere. Hierarchy is a spine, not a set of tabs."*

Two anchors — Home and You — and everything else through two things: a **spine**
(`Premier League ▸ Match Predictor`, where every segment is a menu) and a
**command surface** that is the competition switcher, the game switcher and
discovery, in one control.

| | |
| --- | --- |
| **Global navigation** | Home, Jump, You. The Jump control is the centre and the largest. |
| **Competition switching** | The spine's first segment, or the command surface, or — on a desktop — one press in the permanent command centre. |
| **Game switching** | The spine's second segment. It is the only place the three games are enumerated, and it states in words which games the competition does not run. |
| **Social model** | Not an anchor. Leagues, standings and rivals are indexed in the command surface alongside competitions and games, in **separate groups** so a league never looks like a competition. |
| **Desktop** | A 300px command centre showing the player's **whole position at once**: every competition, every joined game, and each game's status in its own vocabulary. No other concept puts that on screen permanently, and no phone can. |
| **Mobile** | Two anchors, a Jump control, and the spine. |
| **Advantages** | **Gets structurally cheaper as the platform grows** — the opposite of the other two. The spine states the football context and the game in four words and makes both changeable in place, which is the most economical answer to the two-dimension problem anywhere in this lab. The best desktop of the three by a distance. |
| **Weaknesses** | **It asks the player to know what they want.** A command surface rewards someone who can name the thing; a mainstream football audience may not. Game discoverability rests entirely on a caret in the spine. It is by far the least conventional — every phone football product this audience already uses has a bar of destinations, and this has two. |

---

## 4. Scenario comparison

Twelve deterministic worlds, in `src/vnext/fixtures/ia/scenarios.ts`. `✓` means
the architecture answers it without strain; `~` means it answers it at a cost
stated in the note; `✗` means it does not answer it.

| Scenario | A | B | C | Note |
| --- | :-: | :-: | :-: | --- |
| **1 competition** | ✓ | ~ | ✓ | A's switcher becomes a label and costs nothing, while Explore keeps the catalogue one press away — the first build of A dropped the second half on a phone, where there is no rail to carry it, and left the player with four competition-scoped destinations and no way out. B keeps a filter row with one useful chip — furniture for a player who will never use it. C's spine reads as a title and Jump is unaffected. |
| **3–4 competitions** | ✓ | ✓ | ✓ | All three are comfortable. This is the width at which the concepts are hardest to tell apart, which is why it is not the deciding scenario. |
| **10+ competitions** | ~ | ✓ | ✓ | A's rail bounds at six and then says "+5 more" — honest, and the point at which a permanent list stops being a permanent list. B and C are unaffected. |
| **~20 published** | ✓ | ✓ | ✓ | Measured, not asserted: the browser suite compares permanent chrome height at twenty published against four played and fails a concept that grows by more than 8px. All three pass. |
| **Matchday (live)** | ~ | ✓ | ~ | B shows live football in two competitions in one view. A and C show the active competition's live football and a dot or a status line for the other. |
| **Deadline** | ~ | ✓ | ~ | The `deadline` world has nine minutes, three missing scorelines **and** an unmade Last Man Standing pick in the same competition. B puts both at the top of the front door. A and C get there in one press *if the player is already in the right competition*. |
| **Quiet day** | ✓ | ~ | ✓ | Inverted. A and C have somewhere to be; B's front door is a recap of things already done. |
| **Discovery** | ✓ | ✓ | ✓ | A: the sheet's last row. B: the end of the filter row. C: the command surface, which is discovery and switching in one control. |
| **Match Predictor** | ✓ | ✓ | ✓ | All three reach it in one press from their front door and keep the competition visible while predicting — A in the bar, B on the card that led there, C in the spine. |
| **Last Man Standing** | ✓ | ✓ | ~ | A gives it a peer row under Games. B gives it a card shape of its own that cannot be confused with a progress bar. C reaches it only through the spine's game menu or the command surface, which is the concept's stated discoverability risk. |
| **Predictor Championship** | ✓ | ✓ | ✓ | All three hang it off the same place as Last Man Standing, which is what Stage 7.5 needed to establish. |
| **Private league** | ✓ | ✓ | ~ | A and B have a people destination. C indexes leagues in the command surface — findable, not browsable. |
| **Global leaderboard** | ✓ | ✓ | ✓ | Identical in all three, and constrained by the backend rather than by the architecture. See §5. |
| **H2H / profile** | ✓ | ✓ | ✓ | Identical in all three: a rival is one press from a private-league table and the way back names where it goes. |
| **Unsupported game** | ✓ | ~ | ✓ | A and C say it on a surface that already exists. B had to be given a sentence. |
| **First-time / nothing selected** | ✓ | ✓ | ✓ | All three open on discovery when there is no context. |

---

## 5. Player, profile and social capability audit

Audited against the migrations and service models, not against memory.

### REAL NOW

| Capability | Authority |
| --- | --- |
| One player's season — points, rank of field size, matchweeks played, exact-score and correct-outcome counts, Joker usage, per-matchweek points and predictions | Contract 151 `get_season_player_profile` |
| Their predictions, **after that matchweek's own lock** | Contract 151, using the same per-round boundary as contract 149 |
| Prediction DNA — tendencies, accuracy, consensus divergence, clubs, scorelines | Contract 176 `get_season_prediction_dna`, over locked matchweeks only |
| Private-league standings with a **usable player identifier** | Contract 150 — `userId` per row |
| One settled matchweek's movement inside a private league — rank before/after, points before/after, the climb | Contract 150 `SeasonLeagueMovement` |
| Global season leaderboard — display name, points, rank, matchweeks played, tied, position, isYou | Contract 95 `get_season_leaderboard` |
| Follow / unfollow a competition; favourite club per competition | Contract 157 `get_my_preferences` |
| Season archive and participation history on the platform profile | Contracts 156 and 161 |
| Tournament head-to-head and rank history | `get_rival_entry`, `get_h2h_rank_history` |

### PARTIAL

| Capability | What is missing |
| --- | --- |
| **Head-to-head** | It exists, and it is **tournament-shaped**. `get_h2h_rank_history` gates on `tournaments.lock_at` — a single competition-wide lock instant. A league season does not have one; that is exactly why contract 151 uses the round's own lock. So there is no weekly-season head-to-head in practice, and the three profile surfaces in this lab say so rather than drawing a control that would refuse. |
| **Rank history over time** | Contract 151's history is **points per matchweek, not rank per matchweek**. Contract 150 gives a rank movement for **one** settled matchweek inside **one** private league. A rank-over-time series for a weekly season — the thing a profile chart would draw — is not held anywhere. |
| **Rival Watch** | The gap to the nearest rival and to the leader is derivable from the league table, and contract 150 supplies the movement. Pinning a rival across devices still needs `MIG-UI-09`. |

### ABSENT

| Capability | Note |
| --- | --- |
| **Following a player** | There is no follow graph and none is proposed. The accepted direction is explicit: *people you play with are private-league members*, with no friendship graph, discovery or social moderation in the first release. All three concepts respect that; none of them has a "followers" surface. |
| **A player directory** | Deliberate, and stated in contract 151's own preamble: the read answers about **one named player** and cannot enumerate, search or rank the population. Nothing in this lab searches for people, and the command surface in Concept C indexes competitions, games and leagues — never players. |
| **Recently viewed competitions** | The model has a `recency` field and the fixtures supply it, but **the platform stores nothing of the kind.** `src/features/hub/lastVisit.ts` is a single local marker for "when this device last showed the Hub" — not a per-competition recency, and explicitly local-only. Concept A's "Recently viewed" group is therefore a **proposal**, not a rendering of existing state. |

### BACKEND GAP / PRODUCT DECISION

**GAP 1 — a global leaderboard row has no address, and this is the finding of the stage.**

`get_season_leaderboard` (contract 95) builds every row from `displayName`,
`points`, `rank`, `matchweeksPlayed`, `tied`, `position` and `isYou`. **There is
no user id in the payload, and none in `SeasonLeaderboardRow`.**

This is stronger than the visibility rule the brief anticipated. It is not that
the server would refuse a caller who shares no private league — although
[contract 151 does exactly that](../../supabase/migrations/20260810170000_season_player_profile.sql),
with the words *"You do not share a private league with that player"*. It is that
**there is no address to refuse**. A frontend could not link a global leaderboard
row even if the permission were widened, because it does not know who the row is.

So the journey the brief names — *global leaderboard → click player* — is
currently impossible for two independent reasons, and the frontend can solve
neither. `src/vnext/models/ia.ts` models this as `PlayerReach`, and
`PlayerName` in `src/vnext/ia/shared/Surfaces.tsx` renders `name-only` as **text
rather than as a disabled control**: a control that exists and refuses teaches a
player the product is broken; a name that was never a control teaches them
nothing false.

**The product decision, stated and not taken here:**

> **A.** Semi-private profiles. A player is reachable only from a private league
> they share with the caller. The current authority, and a coherent position: a
> season may have fifty thousand entrants and none of them agreed to be looked
> up by the others. Sharing a private league is a mutual act.
>
> **B.** Competition-visible profiles, with unrevealed predictions still
> protected. A player in a competition may open any other entrant's season page;
> what they see is points, rank and accuracy, and the per-matchweek prediction
> detail stays behind that matchweek's own lock exactly as it does today.

**Option B is not a frontend change.** It requires `get_season_leaderboard` to
emit an identifier *and* contract 151's boundary to be widened. Both are backend
work under a decision this lab does not have. **Nothing here bypasses either**,
and the two audits above are the evidence a decision would be made on.

There is also a consequence worth naming: the same person can be reachable in
one place and not in another **on the same screen**. In the lab's `regular`
world, Priya Balasubramanian appears in the global Premier League table and in
the private Office Survivors league — a name in one and a door in the other.
That is what the reads make true today, and it is a legitimate reason to prefer
option B.

**GAP 2 — three profile systems already exist.** Platform (`/profile`),
tournament (`/tournament/profile`, `/tournament/profile/:playerId`) and season
(`/competitions/:c/:s/players/:playerId`). **vNext must not create a fourth.**
The route migration matrix marks the tournament pair as MERGE for this reason,
and no concept in this lab introduces a profile surface of its own — all three
share one, which is exactly what "settle the navigation contract" means here.

---

## 6. Competition discovery and personalisation audit

### REAL NOW

- **Follow, Join and Favourite are three separate stored choices** — contract
  157 for follow and favourite, `get_competition_games` for membership. They are
  modelled apart in `playerCompetitions.ts` and are unioned, never intersected: a
  player who follows a competition and has joined nothing is relevant to it. All
  three concepts preserve that; `ContextRelationship` in the vNext model has
  `playing`, `following` and `browsing` for exactly this reason.
- **The catalogue is the server's** — contract 147 `get_published_weekly_seasons`
  returns each published season's identity **and its route slug**, so publishing
  a league is the whole of making it exist and making it openable. There is no
  static competition array left. **Adding a twenty-first competition requires no
  frontend edit in any of the three concepts.**
- **Onboarding is built and routed.** `/welcome` runs `OnboardingJourney`:
  display name → follow competitions → optional favourite club → games per
  followed competition → review, resumable from a stored draft. The claim in
  older documents that the flow is "accepted and unbuilt" is stale; contract 157
  closed the gap that blocked it.
- **Discovery has an address and is correctly outside permanent navigation.**
  `/competitions` is a page a player can be linked to and bookmark, reached from
  the Hub and the rail rather than from a sixth tab.

### ABSENT

- **Recently viewed competitions.** See §5. Concept A proposes it; nothing stores it.
- **Any competition taxonomy.** No region, country, competition type or
  popularity is held anywhere. Discovery in this lab is therefore **search, plus
  the player's own pinned, plus the rest** — the existing authority's own answer,
  and the reason no concept groups the catalogue under headings. A heading
  guessed from a competition's name would be a heading that lies.

### What each concept commits to

| Question | A | B | C |
| --- | --- | --- | --- |
| How does a competition become part of my normal experience? | Follow or join it; it appears in the switcher sheet and the rail | Follow or join it; it becomes a filter chip | Follow or join it; it appears in the command centre and the command surface index |
| How is it removed? | Unfollow, in the account surface — unchanged from today | Same | Same |
| How is another one explored? | Explore, beside the competition on a phone and a rail row on a desktop; and the sheet's last row when the sheet exists | The filter row's last chip | The command surface, which *is* discovery |
| What does Home use as the active context? | The switcher's competition — explicit and permanent | **Nothing.** Home is the unfiltered queue | The spine's competition |
| What happens with no competition selected? | Opens on discovery; the switcher says "No competition yet" | Opens on discovery; the queue is empty and says so | Opens on discovery; the spine says "No competition chosen yet" |

---

## 7. Where the Matches system sits

**Stage 7.5 does not design it, and this PR builds none of it.** What it settles
is where it hangs, because the current product has four football-browsing
concepts — global Matches, competition Matches, Match Centre and TV Mode — and
Stage 8 should treat them as one **system** rather than rebuilding one page.

- **Concept A** makes Matches a competition section. Global browsing across
  competitions has no home and would need one.
- **Concept B** makes Football one of three anchors and scopes it by the filter,
  which is the closest of the three to "one chronological calendar across the
  player's competitions".
- **Concept C** reaches it from the spine and the command surface, with no
  permanent anchor at all.

**TV Mode is untouched in all three.** It is already outside the signed-in frame
by design — a frame built for a phone in a pocket is the wrong frame for a screen
on a wall — and no concept should pull it back in.

The addressable Match Centre (`…/matches/:fixtureId`, self-contained since
contract 148) is a strength in every concept and must survive the selection.

---

## 8. Where the Predictor Championship sits

It is **a nested system, not a page**: an index, an instance, a table and a
fixture list, already routed as `…/games/championship/*`. All three concepts hang
it in the same place as Last Man Standing — under the game dimension, never
beside a competition and never beside a private league.

That is the whole of what Stage 7.5 needed to establish. A later stage can
redesign the entire Championship system without revisiting the global
architecture, which is the property being bought here.

---

## 9. Last Man Standing in the architecture

LMS is not a smaller Match Predictor and the model refuses to let it be drawn as
one. `GameStatus` has one variant per game and they are not interchangeable:

- Match Predictor is a **fraction against a deadline**;
- Last Man Standing is a **life and a club**, with a count of who is left;
- the Championship is a **position in a field**, against a named opponent.

A single `{ headline, detail }` shape would let a concept draw all three
identically, which is exactly how Last Man Standing became "another little tab".

The `lms` world in the lab makes the psychology visible: everything else is
finished — ten of ten predicted, the Championship idle — and the only live
decision is one club with a consequence and twenty-six minutes.

**Where a future LMS surface hangs, per concept:** Concept A, a peer row under
Games; Concept B, a card shape of its own in the queue with a heavier leading
edge; Concept C, the spine's game segment. In all three it is reachable in one
press from the front door when it is urgent, and in none of them is it a
competition or a private league.

The eventual surface will need alive/eliminated, the current selection, the
selection deadline, used clubs, unavailable clubs, players remaining and survival
history. The existing domain already supplies all of it —
`lmsRoundModel.ts` carries `entryOutcome`, `pick`, `pickOutcome`, `used` per
club and `locksAt`. **No LMS page is built here.**

---

## 10. Interaction feedback and haptics

### The principle under test

> Visual feedback, motion and optional haptic feedback should describe the
> **same semantic state change**.

A component says *what happened*; one shared module decides whether that becomes
a vibration. `src/vnext/ia/feedback.ts` prototypes it with four semantics —
`selection`, `success`, `important`, `warning` — and an explicit `off`.

### The design decisions worth reviewing

- **There is deliberately no `navigation` semantic.** Ordinary navigation,
  opening a card, scrolling and every button press are the bad uses, so the
  vocabulary cannot express them. A developer who wants a buzz on a tab change
  has to add a semantic and argue for it in review, which is the friction that
  was missing. `tests/vnext/iaFeedback.test.ts` also sweeps every call site and
  fails one inside a navigation function.
- **It lives under `ia/`, not under `foundations/`.** `foundations/` is the
  accepted vNext language; putting an unreviewed abstraction there would make it
  look settled. A test asserts that no accepted vNext surface imports it.
- **It returns an outcome and nothing renderable.** `emitted` / `suppressed` /
  `unsupported`, so a component cannot make the haptic load-bearing.
- **Unsupported devices are the normal case, not a degraded one.** Every state
  change in this lane is already carried by a colour, a word *and* a shape.
- **Patterns are short and distinct** — 10ms to 90ms total, one double-tap, one
  longer pulse — because a vocabulary a player cannot tell apart is one signal
  wearing four names.

### Recommendation

**Adopt the shared semantic model; do not adopt any specific call site yet.**
The one place the lab actually emits is a deliberate competition switch, as
`selection`. The good uses the brief names — the last missing prediction, Joker
activation, an LMS selection lock, joining a private league, a rank moment — all
belong to surfaces that are later stages, and wiring them now would be
retrofitting pages this stage is not allowed to touch.

**A preference belongs in Account,** beside follow and favourite. It does not
exist yet, and `system` currently resolves to on — stated here rather than
hidden in a default.

### The open question, reported rather than answered

**Reduced motion is deliberately NOT wired to haptics.** A vestibular preference
and a preference about being buzzed are different preferences, held by different
people, for different reasons. Guessing they are the same would silently remove a
channel from a player who wanted it. The brief says not to couple them without
research, and this lane has none — so they are independent, and the question goes
up.

---

## 11. Evaluation

Scored 1–5 against the brief's rubric. **These are arguments for a reviewer, not
a verdict**, and they are deliberately not totalled: a sum would present a
weighting nobody agreed as a result.

| | A — Competition Deck | B — Attention Inbox | C — Spine and Command |
| --- | :-: | :-: | :-: |
| **A. Clarity** — where am I, what competition, what game, what next | **5** | 3 | 4 |
| **B. Scale** — 1 / 4 / 10 / 20 | 3 | **5** | **5** |
| **C. Game separation** | **5** | 4 | 3 |
| **D. Discovery** | 4 | 4 | **5** |
| **E. Social** | 4 | **5** | 3 |
| **F. Matchday** | 3 | **5** | 3 |
| **G. Quiet day** | **5** | 2 | 4 |
| **H. Deadline** | 3 | **5** | 3 |
| **I. Mobile** | **5** | 4 | 3 |
| **J. Desktop** | 4 | 4 | **5** |
| **K. Accessibility** | 4 | 4 | 3 |
| **L. Future-proofing** | 3 | **5** | **5** |
| **M. Mental load** | **5** | 3 | 3 |

**The shape of the disagreement, which is the useful part:** A wins clarity and
loses scale; B wins scale and urgency and loses place; C wins the future and the
desktop and loses conventionality. They are not three versions of one idea, and
no two of them can be blended without losing the thing that makes each work.

**Accessibility is the one row where the difference is a real risk rather than a
trade-off.** All three pass axe at wcag2a/2aa/21aa/22aa with no critical or
serious violation, survive reduced motion, and — now measured rather than
claimed — clear **44×44 in both axes** and return focus to the control that was
actually pressed. C scores lower because it puts more behind menus and dialogs
than the other two, which is more surface area for a future regression rather
than a defect today.

Both of those were corrected after the first independent review, and both had
passed a test that was not testing them:

- **The target assertion was `height ≥ 44` and `width ≥ 44` in the report and
  `height ≥ 44`, `width ≥ 24` in the browser suite.** The written contract is
  the one that survives — `--vnext-tap-target` is 44 and the vNext
  accessibility authority is not weakened to keep a lab green — so the
  assertion now measures the control's own layout box in both axes.
  **No exception is carved for any concept.** The question of whether inline
  text links are held to the same size does not arise here: every interactive
  thing in all three concepts is a button, an input or the skip link, and there
  is no prose link in the chrome or in the shared bodies.
- **Focus return pointed at the wrong copy of a duplicated control.** All three
  concepts render a phone navigation and a desktop navigation and let CSS show
  one. A restores focus after its sheet closes and used a single `useRef`
  shared by both switchers, so the desktop returned focus to the phone's
  `display: none` copy; C used the phone's Jump button as the restoration
  target while the desktop opens the surface from the command centre instead.
  In both cases the browser refused the focus call and the keyboard user landed
  on `<body>`. **jsdom could not have caught it** — it evaluates no container
  query, so both copies are "visible" there. `ia/shared/focusReturn.ts` now
  captures the opener from the triggering press and verifies it still has a
  layout box before focusing it, and `e2e/vnext-ia.spec.ts` asserts the return
  path in both layout modes for both concepts, including that no hidden
  duplicate holds focus. **B was audited in the same seam and left alone**: it
  duplicates its anchors and filter identically, but opens no overlay at all
  and therefore restores no focus. A test holds that property so a future
  overlay cannot be added without adopting the same capture.

---

## 12. Technical implications of a selection

| | A | B | C |
| --- | --- | --- | --- |
| **Shell change** | The accepted `VNextShell`'s four fixed destinations become competition-scoped, and it gains a rail. A material change to `app/`. | The shell's destinations change and it gains a filter region. Material. | The shell loses most of its navigation and gains a spine. The largest change of the three. |
| **Route work** | Smallest. The competition tree already assumes this shape. | Moderate — the global destinations become one queue. | Moderate — most addresses stay and stop being navigation. |
| **New backend need** | Recently-viewed competitions (absent today) | None | None |
| **Risk** | Cross-competition urgency is unsolved and would need a fifth thing | Losing "place" in a football product | Discoverability with a mainstream audience |

**None of the three needs a router, a state library or any new dependency.** The
lab is `useState` and container queries throughout.

---

## 13. Dependency decisions

**Delta: NONE.** Nothing was added and nothing was proposed. No Radix, no Zod,
no TanStack, no React Hook Form, no MSW, no state library, no routing library, no
animation framework. Icons are `lucide-react`, which `VNextNav` already uses;
motion is `framer-motion`, already present.

Three places the lab could have reached for a dependency and did not:

- **The sheet, the menu and the command surface** are `useState` plus focus
  management. A headless dialog library would have been ~15 lines of behaviour
  in exchange for a permanent dependency.
- **The command surface's search** is `String.includes` over a list the model
  already holds. A fuzzy-search library over twenty competitions would be
  measuring nothing.
- **Navigation state** is one `useState` and a pure parent function. Adding a
  router to compare three navigations would have answered a different question.

---

## 14. What is deliberately undecided

**Items 1, 3, 4 and 6 were RESOLVED by Stage 7.6.** They are struck through
rather than deleted, so the record still shows what was open when the concepts
were reviewed.

1. ~~**Which concept wins.**~~ **RESOLVED.** Concept A, the Competition Deck,
   with cross-competition attention retained from B as a secondary layer and
   Jump retained from C as an optional accelerator. See
   [`vnext-shell-ia.md`](vnext-shell-ia.md) §1–2 for the rationale.
2. **Whether global-leaderboard identity should exist at all** — §5, GAP 1. A
   product and backend decision, not a frontend one.
3. ~~**Whether `/` and `/competitions/:c/:s` are one surface or two.**~~
   **RESOLVED as a TARGET IA decision.** They are ONE competition-rooted Home
   concept. No route was repointed; see the route matrix.
4. ~~**Whether a Games index survives.**~~ **RESOLVED: yes**, as a first-class
   competition-scoped destination. It is where Match Predictor, Last Man
   Standing and the Predictor Championship are peers.
5. **Whether reduced motion should imply no haptics** — §10. Still open. Stage
   7.6 adopted no haptics and added no call site, so nothing turns on it yet.
6. ~~**Whether recently-viewed competitions should be stored**~~ — **RESOLVED
   for now: no.** `VNextShellModel` carries no recency field at all, so the
   accepted shell cannot draw a history the platform does not hold. Whether to
   store one later, locally or server-side, is still open; nothing depends on
   it. See [`vnext-shell-ia.md`](vnext-shell-ia.md) §7.
7. **Whether a weekly-season head-to-head should exist.** There is no read for
   it and the tournament's is not shaped for a season's per-round locks.
8. **Time-zone policy**, carried over unresolved from Stage 7 and untouched here.

---

## 15. What this stage did not do

No Home redesign. No Match Predictor redesign. No Last Man Standing page. No
Predictor Championship implementation. No Matches Stage 8 work. No final profile
system. No migration, schema, RPC, view, trigger, RLS or backfill change. No
scoring, lock, reveal or settlement change. No provider work. No profile
visibility change. No production route repointed and no navigation replaced. No
dependency added. No winner selected.
