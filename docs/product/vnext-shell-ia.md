# vNext Stage 7.6 — the selected information architecture

**Status:** DECIDED. This is the accepted vNext information architecture and the contract `src/vnext/app/VNextShell.tsx` implements.
**Scope:** presentation, navigation and information architecture only.
**Does not govern:** scoring, locks, membership, reveal, settlement, progression, profile visibility, provider truth, or any route currently registered in `src/App.tsx`.
**Supersedes:** the "no winner is selected" framing of [`vnext-ia-lab.md`](vnext-ia-lab.md), which remains the evidence for *why* this architecture was chosen.
**Companion:** [`vnext-route-migration-matrix.md`](vnext-route-migration-matrix.md) — every user-facing route with an explicit fate.
**Implementation:** `src/vnext/app/`, `src/vnext/models/shell.ts`, `src/vnext/fixtures/shell/`, reviewed at `vNext/Shell` in Storybook.

---

## 1. The decision

**SELECTED AS THE PRIMARY INFORMATION ARCHITECTURE: Concept A, the Competition
Deck** — competition-context-first.

**REJECTED AS PRIMARY:**

- Concept B, **Attention Inbox**
- Concept C, **Spine and Command**

**RETAINED FROM THE REJECTED CONCEPTS, AS SECONDARY CAPABILITIES:**

| From | Idea retained | Status in the product |
| --- | --- | --- |
| **B** | cross-competition attention — *"something needs you elsewhere"* | a SECONDARY LAYER over a competition-rooted product. Never the front door. |
| **C** | optional Jump / Search, especially on desktop | an OPTIONAL POWER-USER ACCELERATOR. Never required, never primary. |

### The hierarchy is load-bearing

```text
A = THE PRODUCT MENTAL MODEL      the competition is the root
B = AN ATTENTION LAYER            over it, and quiet when there is nothing to say
C = AN OPTIONAL SHORTCUT          past it, and absent for a normal player
```

This is **not a blend of three concepts.** A blend would put "Needs you" and
"Jump" in the primary navigation beside Home and Matches, and the product would
become Concept B with a competition picker attached. `tests/vnext/shellIa.test.tsx`
asserts that neither word appears as a destination, which is the cheapest
possible guard on a distinction that is otherwise only a paragraph.

### The mental model, in one sentence

> **I am inside a football competition. Everything beneath the shell belongs to
> that competition until I deliberately change it.**

```text
Premier League · 2026/27
  → Home        what matters here
  → Matches     this competition's football
  → Games       Match Predictor · Last Man Standing · Predictor Championship
  → Leagues     the people I play against, here

Scottish Premiership · 2026/27
  → Home · Matches · Games · Leagues
```

Football competition is the primary product context. **Game** is a second
dimension within it. **People** is a third. The three are modelled apart in
`src/vnext/models/shell.ts`, with no field derived from another, exactly as
`src/features/hub/playerCompetitions.ts` models Follow, Join and Favourite
apart.

---

## 2. Why Concept A won

Not "A scored highest". The reasons, each of which is a property of the
architecture rather than of the implementation that demonstrated it:

**The strongest sense of place.** A player always knows which football they are
looking at, because the loudest permanent control on the screen says so. B makes
the competition a label on a work item; C makes it a segment in a breadcrumb.
Both are answers to "what should I do"; only A answers "where am I", and a
football product is a place before it is a queue.

**It is personally small.** The permanent chrome is a function of what the
PLAYER plays and never of what the platform publishes. A Premier League–only
player gets a Premier League prediction game; the other nineteen competitions
cost them one small Explore control. `e2e/vnext-shell.spec.ts` measures this
rather than asserting it: the rail is the same width and the masthead the same
height at one competition, four, twelve and twenty-published.

**It is the natural football mental model.** Every mainstream football product a
player already uses — a league app, a broadcaster's app, a fantasy game — puts
the competition at the root. A is the conventional choice, and for a mainstream
prediction game conventional is a feature.

**The game hierarchy is clean.** `Games` is a real destination where Match
Predictor, Last Man Standing and the Predictor Championship are PEERS with their
own status vocabularies. That is the single strongest thing this architecture
does for Last Man Standing, which had been under-scoped in the vNext programme
precisely because nothing gave it a place to be a peer.

**It behaves best on a quiet day.** With nothing waiting anywhere, B's front
door is an empty queue and C's command surface has nothing to command. A is
unchanged: you are still in the Premier League, and Home still shows you the
football. Most days are quiet days.

**LMS and the Championship have a natural home** — a row under Games — so
Stages 10 and 11 can design them without revisiting the shell.

**The backend aligns without being exposed.** `get_season_play_context`,
`get_competition_games` and the season-scoped route tree are already
competition-rooted. A uses that alignment without leaking a single service shape
into the visual tree; the shell reaches no Supabase type and no generated
database type, and `tests/vnext/vnextProductionBoundary.test.ts` holds it.

### Its weaknesses, and the mitigations that are why B and C were not discarded

| Weakness of A | Mitigation | Where |
| --- | --- | --- |
| Cross-competition urgency is invisible: a player inside the Premier League cannot see that the Champions League locks in 18 minutes. A's own answer was an urgency DOT, and a dot cannot say *what*. | **B's attention idea, as a secondary layer.** A control that names the competition and the game separately and goes there in one press. | `src/vnext/app/AttentionElsewhere.tsx` |
| Scaling cost for power users: at twelve or twenty competitions the rail stops being complete and switching becomes hunting. | **C's Jump, as an optional accelerator**, offered only where the rail has overflowed. | `src/vnext/app/JumpSearch.tsx` |

---

## 3. Games versus Play — the naming comparison

Independent review of Stage 7.5 raised a real question: in a UK football
product, **"Matches" and "Games" can sound synonymous.** "I'm going to the game"
means a fixture. A bottom bar reading `Home · Matches · Games · Leagues` risks
reading as two fixture destinations, and the ambiguity only resolves on the
first press — which is exactly the cost information architecture exists to
avoid.

`Play` was evaluated as the alternative. **The selected label is `Games`.**

### The evidence, from the repository rather than from opinion

**"Game" is this product's own word for a joinable format, everywhere, without
exception.**

| Where | What it says |
| --- | --- |
| `services/supabase/competitionGamesModel.ts` | `CompetitionGameKey`, `CompetitionGame`, `SeasonGames` |
| contract C1b | `get_competition_games` |
| `features/hub/playerCompetitions.ts` | `joinedGames`, "the games the player has actually joined here" |
| `features/onboarding/OnboardingGamesStep.tsx` | **"Choose your games"** — step 3 of the four-step journey every new player runs |
| `features/profile/PlatformProfilePage.tsx` | "You have not joined a **game** yet" |
| `app/ActionCentre.tsx` | "Nothing to do yet — join a **game** in a competition" |
| `features/leagues/CreatePrivateJourney.tsx` | "Private play is one **game** inside one competition" |

**And player-facing copy never uses "game" to mean a fixture.** Football is
`match` and `fixture` throughout — `SeasonMatchesRoute`, `SeasonMatchCentreRoute`,
`fixtureListModel`, `matchCentreModel`, `/competitions/:c/:s/matches`. The
vocabulary discipline is already total; the visible label either inherits it or
fights it.

**"Play" is already taken, and it means something else.**

| Where | What `Play` means today |
| --- | --- |
| `/play` → `GlobalPlayPage` | the cross-competition **action inbox** — "what needs doing" |
| `/competitions/:c/:s/play` → `SeasonPlayPage` | the same job, competition-scoped |
| `features/season/SeasonCompetitionShell.tsx` | tabs `{ id: 'play' }` **and** `{ id: 'games' }` — they coexist as siblings, because they are different things |
| `design-system/BottomNav.tsx` | `{ key: 'predict', label: 'Play' }`, with a comment recording the Hub/Predict naming split |

### The four questions the brief asks

| Question | `Games` | `Play` |
| --- | --- | --- |
| Where do I enter predictions? | Games → Match Predictor. One hop, and onboarding already taught the word. | Play. Marginally more direct — this is `Play`'s one clear win. |
| Where is Last Man Standing? | Games. LMS **is** a game in this product's own vocabulary and in its database. | Ambiguous. "Play" does not obviously contain a survival game you may already be eliminated from. |
| Where do I see actual football fixtures? | Matches. | Matches. Neutral. |
| Does the label mislead? | Mild risk of reading as a second fixtures tab. | **Higher risk**: `Play` currently names the action queue, whose job the Competition Deck moves into **Home**. A player who knew `/play` would press `Play` and find a catalogue. |

### Why `Games` wins

The ambiguity `Play` was proposed to fix is real but **self-resolving and local**:
the icons differ, and the destination's own content is three named formats —
Match Predictor, Last Man Standing, Predictor Championship — none of which is a
fixture. The ambiguity `Play` would *introduce* is neither local nor
self-resolving: it recycles a word this product currently uses for a different
job, during a cutover in which both interfaces exist, and it puts the visible
label permanently out of step with every model, RPC, document and onboarding
step beneath it.

**Recorded risk, not denied:** if usability evidence later shows players reading
`Matches` and `Games` as the same thing, the fix is a copy change to
`SHELL_DESTINATIONS` and nothing else. The label is a data field on the shell
model, not a hard-coded string in a component, precisely so that this decision
stays cheap to revisit.

**This is a naming decision only.** No fourth concept was created and Stage 7.5
was not reopened.

---

## 4. What the shell owns

The active football context · competition switching · the competition discovery
entry · primary destination navigation · the cross-competition attention
indicator · the optional Jump accelerator · the player/account entry · the
canvas and its competition atmosphere · the page bounds · the sticky masthead ·
the single `<main>` landmark · the skip link · mobile safe-area clearance · the
width at which the bar becomes a rail.

**Home and the Match Predictor own none of it.** They own what is inside
`<main>` and their one `<h1>`.

```text
the shell answers   WHERE AM I
Home answers        WHAT MATTERS HERE
```

Stage 5's dependency rule survives intact: nothing under `src/vnext/app/` may
import from `home/`, `fixtures/` or the Stage 7.5 lab, and
`tests/vnext/shell.test.tsx` holds all three directions.

### The model

`src/vnext/models/shell.ts` is the presentation contract. It separates, as
required:

- **football context** — id, name, short name, monogram, season label, colours,
  and `relationship: 'playing' | 'following'` (contract 157's real distinction,
  never collapsed);
- **competition navigation** — the player's own contexts, the active one,
  whether switching is meaningful (`shellSwitchable`), and whether discovery is
  reachable;
- **destinations** — four ids and their labels, with optional counts. No page
  component is named and no URL appears;
- **game status** — one variant per game, not interchangeable: a progress
  fraction, a survival state and a table position;
- **player** — a presentation name and initials, and an account destination.

No Supabase type, no generated database type and no RPC shape reaches the visual
tree.

---

## 5. Mobile and desktop compose differently

**Below 1120px** — a context bar (the competition, its season, its tempo, a
small Explore control and the account) above the page, a full-width attention
strip only when something is waiting elsewhere, and a four-item bottom bar of
that competition's destinations. Jump is not offered; the competition sheet's
own search does the same job at the same scale.

**At 1120px and above** — a 264px competition rail: the switcher at its head,
then Jump if it is offered, then the four destinations, then attention, then a
BOUNDED list of the player's competitions (six, then a count), then Explore and
the account.

Both shapes carry the same three things: **where I am, everywhere else, and me.**
Exactly one is ever rendered — the other is `display: none`, which removes it
from the accessibility tree as well as from the page.

---

## 6. The binding contracts

### One competition

For a player who participates only in the Premier League:

- Premier League is the obvious product context, stated once;
- there is **no switcher control** — the competition is a `<span>`, not a
  disabled button and not a button that opens a list of one;
- there is no "Your competitions" group;
- no other competition's name appears anywhere in the permanent chrome;
- **Explore is still one press away at every width**, because the catalogue is
  not the player's competitions and never was;
- Jump is not offered.

Proved at 375 and 1440 in `e2e/vnext-shell.spec.ts` and in
`tests/vnext/shellIa.test.tsx`.

### Switching versus discovery

Two different jobs, and the shell says so loudest of the three concepts.
**Switching** moves between competitions the player already has, and the control
disappears when there is nothing to switch between. **Discovery** browses the
ones they do not, and never disappears.

Switching emits an intent and nothing else — the shell holds no route — so
"the destination survives the switch" is the host's rule to keep and the shell is
structurally incapable of breaking it.

### Ten-plus and twenty-published

Permanent chrome stays bounded: six rail rows and a count, whatever the number.
No horizontal logo wall. No giant dropdown as the only solution. Jump becomes
available exactly when the rail stops being complete. Twenty published
competitions with three relevant renders as a three-competition product, and the
seventeen others are named nowhere in the chrome.

---

## 7. Recently viewed competitions

**Omitted, deliberately — option A of the brief's two.**

Stage 7.5's audit found no per-competition recency authority anywhere in the
platform: `lastVisit.ts` is a single local marker for when this device last
showed the Hub. Concept A's lab drew a "Recently viewed" group from a fixture
field that had no counterpart in the product.

`VNextShellModel` therefore has **no recency field at all**. That is stronger
than omitting the group from the component: a shell that wanted to draw
fictional recent history would have to add the type first. No storage policy is
needed because nothing is stored.

If it is wanted later it is a small local presentation preference — four to six
competition ids, convenience only, never membership — and it can be added
without touching anything else here.

---

## 8. Haptics

**Not adopted. No new call sites.** Stage 7.5's `src/vnext/ia/feedback.ts`
proposal is preserved exactly as it was, still under `ia/`, still imported by no
accepted surface. Nothing in this shell vibrates: not navigation, not opening
the competition switcher, not Jump, not the ordinary destinations.

Reduced motion and a haptic preference remain separate concerns and are still
not coupled.

---

## 9. Production isolation — *as it stood at Stage 7.6, and superseded by Stage 14*

> **Current status, 23 August 2026: this architecture is SHIPPING.** Stage 14
> cut the destinations over. `src/App.tsx` registers vNext elements behind the
> `VITE_UI_FOOTBALL_HUB_*` journey flags, `src/app/vnext/frameOwnership.ts`
> surrenders the legacy frame at each cut-over address, and
> `src/app/vnext/absorbedAddresses.tsx` resolves the addresses vNext absorbed —
> `/play`, `/matches`, `/leagues`, `/more`, `/more/scoring` and `/profile` —
> to the surfaces that took their job. Each destination's flag is still the
> rollback seam. Which flags are set is build/hosted state and is not restated
> here.
>
> The paragraph below records what was true **of Stage 7.6**, and is kept
> because a stage contract is evidence at its own commit. It is no longer a
> statement about the product today.

**No production route was repointed, replaced, redirected or deleted** *(at
Stage 7.6)*. The legacy Hub navigation was untouched, Netlify route behaviour
was unchanged, and vNext was not yet the production application. The review
surface was Storybook; the connected surfaces were the `import.meta.env.DEV`
harnesses at `/dev/vnext-home` and `/dev/vnext-match-predictor`.

The shell is *incapable* of repointing a route: it holds no URL, imports no
router and names no page component. Every control emits a `ShellIntent` and the
host decides what it means.

**Expected database delta: NONE.** No migration, schema, RPC, RLS, view, trigger
or backfill. **Expected dependency delta: NONE.**

---

## 10. What Stage 7.6 did not do

No Matches system (Stage 8). No Leagues redesign. No Last Man Standing page. No
Predictor Championship. No profile or permission change. No leaderboard
identifier change. No head-to-head. No provider work. No Home redesign — its
composition, zones, emphasis system and masthead are untouched. No Match
Predictor redesign — same. No production cutover.

The Stage 7.5 lab is **kept**, not deleted. Concepts B and C are the evidence
for why this architecture exists, and a decision record whose losing options
have been deleted is a decision record nobody can audit.
