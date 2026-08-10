# UI finalisation — owner direction, 10 August 2026

**Status:** current UI authority for the signed-in weekly domestic product.
**Accepted:** owner, 10 August 2026, as the outcome of the August 2026 design workshop; **amended the same day** with the navigation authority, the competition scalability contract and the retention/recap pillar. Where the earlier version and the amendment differ, the amendment wins and this document records the amended position.
**What it governs:** the final presentation layer of the signed-in weekly platform — responsive composition, information hierarchy, date/kickoff presentation, player and league comparison, Match Centre, private create/join UX, and the light/dark quality bar.
**What it does not govern:** any scoring, lock, membership, settlement, progression or reveal rule. Like the two design authorities it sits beside, this is presentation and delivery only and sits below the ADRs. Where it restates a rule it is recording one, not creating one.

## Why this document exists

The workshop's conclusion was that the product **does not need another visual redesign**. The visual direction is broadly correct; what is missing is the product layer that makes it feel deliberate — real desktop composition, stronger hierarchy, better use of the football data already held, much stronger player/league comparison, richer Match Centre journeys, cleaner private creation and joining, localised kickoff presentation, and finished loading/empty/locked/reveal/completed/error states in both themes.

That conclusion changes the *shape* of the remaining frontend work rather than its content, so it is recorded here rather than by rewriting [`hub-architecture-and-modernisation-plan.md`](hub-architecture-and-modernisation-plan.md). The target design in that plan stands. The delivery order in [`ui-modernisation-execution.md`](ui-modernisation-execution.md) stands except where its 10 August amendment says otherwise. **The UI programme is now a finalisation programme with an end, not an open-ended continuation of UI Alpha.**

## 1. The five-second test

A returning player answers these within about five seconds, or the surface is not finished:

1. What do I need to do?
2. When does it lock?
3. What is happening in the football?
4. How am I doing?
5. How are the people I play with doing?

## 2. Navigation — three layers, and a rail that stays global

**Phone and desktop share the product rules and components but need not share composition.** Desktop must never be a mobile page stretched into an 800px column.

The finished product uses **three deliberately separate navigation layers**, and they may all be visible at once on desktop because they answer different questions.

| Layer | Question | Where it lives |
| --- | --- | --- |
| Global platform | What do I want to do across my whole account? | Bottom bar on phone; persistent left rail on desktop |
| Competition | What do I want to do inside this football competition? | Beneath the competition masthead, in the content column |
| Game | What do I want to do inside this game? | Beneath the game's own heading |

### The global rail

- **Permanent, and never a competition tree.** 240px expanded, 64px collapsed, the choice persisted (`src/design-system/SideRail.tsx`).
- **Exactly one navigation is visible at a width.** Bottom bar below 1024px, rail at and above it. Both are always in the DOM, so no JavaScript width measurement decides navigation.
- Group 1 is the bar's own destinations in the bar's order: **Home, Play, Matches, Leagues**. "Leagues", not "Leagues & Competitions" — the page explains the difference between a private league and a private LMS or Championship competition, and a navigation label is a worse place to teach it.
- Group 2 is **My competitions**: a bounded set of the player's own, then **All competitions**.
- Group 3 is **More**: How to play, Profile, Account & settings.
- **A competition shortcut opens that competition's Overview and nothing deeper.** It must never expand into Overview / Play / Matches / Games / Leagues; those belong to the competition content shell, and two navigations answering the same question is worse than one. *(This corrected a first implementation that did expand the tree; `tests/app/desktopRail.test.tsx` is the record.)*

### Page composition

Main column plus an optional contextual panel (`src/design-system/Workspace.tsx`): shell about 1440px, reading/list column about 820px, panel 320px sticky at and above 1280px and stacked in source order below it. Nothing may be reachable only from the panel, and the panel derives rather than duplicates. Worked examples: Match Predictor — predictions left, insights right. Standings — the table full width with the retention tables beside it. Hub — the next action with today's football and competition summaries alongside. Match Centre — result and football in the main column, player and league consequence beside it.

### Competition switching

A **compact selector** in the masthead (`Premier League ▾`), listing the player's own competitions and then All competitions, preserving the equivalent section across the switch. Never a "Switch to <the other one>" control: that assumes there will always be exactly two.

## 2A. The competition scalability contract — binding

The launch product has two domestic competitions. The information architecture must behave correctly at **20+ published competitions**, and this is an acceptance requirement rather than an aspiration.

**Three player choices, never collapsed into one:**

| Choice | Meaning | Effect |
| --- | --- | --- |
| **Follow** | I want this competition's football, fixtures and context | Personalisation and visibility on global surfaces. Joins no game |
| **Join game** | I play this game in this competition | Independent per game and per competition. Server-owned |
| **Favourite** | Give this a little more prominence | Presentation only. Never membership, scoring, locks, permissions, ranking or urgency |

`Follow ≠ Join game ≠ Favourite`, and no frontend implementation may merge them to simplify the UI. They are modelled apart in `src/features/hub/playerCompetitions.ts`.

**Follow has no persistence today.** Nothing in the repository stores a followed competition, so `followed` is `'unknown'` everywhere and the surfaces fall back to **game membership**, which is a real server authority. That is a fallback for an absent read, not a definition of Follow, and it is narrower: a player who follows a competition without joining a game is currently invisible to it. The audit is `MIG-UI-10`.

**Scaling rules:**

- Global surfaces default to the player's own competitions, never the platform catalogue.
- Navigation shows roughly 4–6 competition shortcuts, then All competitions. The rail's height is a function of what the player plays, never of what the platform publishes.
- The whole catalogue is deliberate discovery at `/competitions`, with search and the player's own pinned. It is not a sixth global destination.
- Adding a competition must require no navigation redesign.

**The acceptance test is executable.** `src/dev/scaleFixture.ts` is a synthetic platform of twenty published competitions where the player plays in three — deliberately not the first three — and `tests/features/hub/twentyCompetitionScale.test.ts` plus `tests/app/desktopRail.test.tsx` assert against it. With the real catalogue's two entries a bounded list and an unbounded one are indistinguishable.

## 2B. The global destinations are destinations, not choosers

`/play`, `/matches` and `/leagues` were competition choosers: each asked which competition before answering anything, which got worse with every competition added. They are now:

- **`/play` — a cross-competition action inbox.** Urgent / This week / Complete and waiting, from **joined games only**; an available game the player has not joined is discovery, never an action. Every card names competition, game, what is needed, when it locks and where to go. A player never chooses a competition to discover what needs doing.
- **`/matches` — one chronological calendar** across the player's competitions. Today / Upcoming / Results, filterable, defaulting to **All mine** rather than the platform catalogue. A fixture opens its addressable Match Centre.
- **`/leagues` — all private play the player belongs to**, across Match Predictor leagues, LMS competitions and Championships, each card naming its competition and game. A player never has to remember which football competition a private league belongs to.
- **`/` — the personalised Hub**, in this order: next required action; live football where relevant; Since you were last here; compact competition summaries; private-league / Rival Watch context; Matchweek Recap; discovery.

All three name a competition they could not read rather than dropping it: a list that silently omits one tells a player they are up to date while a lock passes.

## 3. Date and kickoff presentation — a reversal, recorded

**Kickoffs display in the viewer's local browser/device timezone.** No location permission. A 16:45 UTC kickoff reads `17:45` to a UK viewer in August and the equivalent local time elsewhere.

This **reverses** the rule the Matches section shipped under, which resolved days and times in the competition's persisted zone on the reasoning that "a Saturday 15:00 kickoff is Saturday to everyone who follows that league". Both rules are defensible; two of them in one product is not. The owner's direction decides for the device, and the reversal is recorded here and in the source rather than quietly applied.

- **The day and the time move together.** Grouping by the competition's day while printing the viewer's time would give an Auckland reader "Saturday 22 August" with 04:45 beneath it.
- **Under a date heading, a row shows the time alone:** `17:45`. Where nothing above carries the date: `Sat 22 Aug · 17:45`. A standalone Match Centre may use `Saturday 22 August · 17:45`.
- **No raw timestamp, "Invalid Date" or ISO string ever reaches a player.** An unformattable instant drops its line.
- **The clock face is 24-hour everywhere**; the day wording follows the viewer's locale. Football schedules are published on a 24-hour clock and a fixture list is a column of times a reader scans and compares.
- **One authority**, `src/shared/time/kickoff.ts`, used by every surface. `tests/app/kickoffFormattingAuthority.test.ts` walks the production import graph and fails any shipping module that formats an instant itself.
- **What did not change:** contract 122's retention month still resolves in the competition's own zone, because which month a *round belongs to* is not the same question as what time a fixture starts for the reader. The same applies to competition-day keys in `src/domain/competition/`.

## 4. Player & League Insights is a product pillar

It is separate from Football Insights and is not a small post-lock extra. Football Insights answers *what should I predict*; this answers *how am I doing compared with everyone else*.

The loop:

| When | Question |
| --- | --- |
| Before the match | What should I predict? |
| After lock | What did everyone else predict? |
| During the match | What does this result mean for me and the people I play with? |
| After the match | Who scored what, who moved, and what did everyone predict? |
| Any time | How do I compare with a specific rival, my league, and the overall field? |

**It must not be buried behind several navigation steps.** The existing Euro Match Centre and player-profile implementations are useful references; they are adapted to weekly seasons, not copied.

**People you play with = private league members.** No friendship graph, following, discovery or social moderation in the first release.

## 4A. Product memory and retention

The product should remember the season the player is having, not only display the current state. The loop is **act → understand → compare → feel the consequence → remember → share**.

It is a retention layer, not a scoring system. **No XP, levels, engagement points, rewards that touch football scoring, or public follower mechanics.**

| Surface | What it is | State |
| --- | --- | --- |
| **Since you were last here** | What changed that the player cares about, since their last visit | **Partial** — the Hub lists matches in the player's competitions that finished since a local marker, and says plainly that the points and rank half is not shown yet. Points, rank movement and rival movement need `MIG-UI-01`/`MIG-UI-03` |
| **Matchweek Recap** | Deterministic recap once a matchweek settles: points, movement, exacts, Joker, league winner, gap change | Outstanding — needs `MIG-UI-03` for movement |
| **Rival Watch** | One or two private-league co-members pinned as close rivals, with the gap and what a result did to it | **Partial** — the gap to the nearest rival and the leader is derived in the league table. Pinning needs `MIG-UI-09`, cross-fixture swing needs `MIG-UI-03` |
| **Rank context** | Never a bare rank: "384th of 4,812 · Top 8%", "4th of 18 · ↑3" | Outstanding — field size is available, percentile derivable, movement is not |
| **Points explanation** | One reusable component driven by the canonical scoring authority, never a second copy of the rules | Outstanding |
| **Trophy / career record** | Meaningful football achievements, no XP economy; competition scoring stays separate | Outstanding — `MIG-UI-02` |
| **Streaks** | Context, not another points system | Outstanding |
| **Share cards** | Explicit, branded, never exposing unrevealed predictions or league membership by default | Outstanding |
| **Season / Tournament Wrapped** | A deterministic end-of-season story from measured facts; no generative copy that can hallucinate a claim | Outstanding — `MIG-UI-08` |
| **Season history** | Wrapped becomes permanent history under the profile | Outstanding — `MIG-UI-08` |

**Nothing in this layer may invent a fact.** Narrative copy is derived from stored facts only, and a surface that cannot read what it would need says so rather than estimating.

## 4B. First-sign-in onboarding

The complete flow remains accepted and unbuilt (`DFA-001`, `DFA-002`): account/display name → choose competitions to follow → optional favourite team → choose games **independently per followed competition** → optional private play → finish into a personalised Hub. It must be persisted and resumable, and a pending invitation must survive authentication and onboarding.

Competition selection must not become a flat wall of cards: search, sensible grouping, selected competitions pinned, a clear selected count, deliberate Explore behaviour. Bulk game selection ("apply these games to all selected competitions", then "customise by competition") is acceptable **provided every membership choice stays explicit and reviewable** — nothing is silently joined.

**Audit before migrating.** Game memberships already have server authorities and must keep using them; do not create a parallel frontend membership model. `MIG-UI-10` is the audit of what can store the non-game choices.

## 5. Match Centre target

The weekly Match Centre becomes the main post-lock/post-match surface, combining: the match and result; the player's prediction and points; football insights; private-league predictions after reveal; overall anonymous consensus; the relevant LMS/Championship consequence; and rank/points movement after settlement. It should move toward a proper addressable journey rather than remaining only an inline fixture expansion.

## 6. Private leagues become a workspace

Table / Matchweek / Members. Desktop may use a comparison matrix across fixtures; **mobile must use a purpose-built fixture-by-fixture layout rather than a shrunken table.** Player names become links where reveal rules permit.

## 7. Private creation and joining

`Create → Choose game → Setup → Review → Create & share`, for Match Predictor, Last Man Standing and Predictor Championship, plus **one universal `Join with code`** where the player never has to know which game a code belongs to. The server resolves competition, season, game, container, eligibility and any required underlying membership. No client-side guessing, and no faked backend behaviour.

## 8. Data, enrichment and identity boundaries

- Use data already available: form, head-to-head, standings, goals and context. Design optional slots for future injuries, lineups, stats and advanced metrics; never invent unavailable provider data, and never let provider absence make a core page unusable.
- **No API-generated winner predictions before lock. No betting odds in the default UI**, and no dead odds toggle before an odds integration exists.
- **Keep the generated shirt identity.** Provider image URLs are not proof of display rights.

## 9. Privacy and reveal

Existing rules are not weakened. No other player's prediction is shown while it can still be edited; season reveals are matchweek-specific; league named predictions stay league-scoped; overall consensus stays anonymous with a minimum cohort; no client clock is a reveal authority. **"Hidden by rule", "empty", "unavailable" and "failed" remain four distinct states.**

## 10. Definition of finished

A surface is not complete because it renders. It must be immediately understandable, responsive, accessible, visually polished, correct in both themes, free of raw technical values, free of dead controls, truthful about unavailable data, and connected to the next useful action.

## 11. Execution order and current state

| ID | Item | State |
| --- | --- | --- |
| `UI-F01` | Responsive shell: permanent global desktop rail with no competition-tree expansion, real multi-column composition, compact mobile competition switcher, mobile preserved | **Delivered** — `SideRail`, `Workspace`, rail-aware `PageShell`, `CompetitionSwitcher`, bounded competition shortcuts and `/competitions`. Remaining: `Workspace` adoption breadth on the other sections |
| `UI-F02` | Global football presentation: shared local-time kickoff formatting, date grouping, card hierarchy | **Delivered for formatting** — `src/shared/time/kickoff.ts` and its production-graph guard. Card hierarchy continues under `UI-F18` |
| `UI-F03` | Hub: action-led, live football, Since you were last here, compact competition summaries, Rival Watch, Matchweek Recap entry, discovery last | **Partial** — the order, the next action, today's football, Since-you-were-last-here (results only) and compact summaries are delivered. Rival Watch and the Recap entry need `MIG-UI-01`/`MIG-UI-03` |
| `UI-F04` | Global Play as a cross-competition inbox; competition Play preserved beneath the shell; Overview as a state-driven dashboard | **Delivered for global Play and the Overview composition**; competition-scoped Play is unchanged beneath the shell |
| `UI-F05` | Match Predictor: flagship flow, completion/lock/Joker polish, desktop insights panel | **Partial** — desktop panel delivered; the route stays behind `VITE_UI_SEASON_MATCH_PREDICTOR` until its migration reaches a hosted environment |
| `UI-F06` | Football Insights: form, H2H, table/goals context, enrichment slots | **Partial** — contract 141 form and club head-to-head render in the Match Centre |
| `UI-F07` | Player & League Insights: comparison, profiles, rank movement and percentile, Rival Watch, post-lock predictions, reusable points explanation | **Partial** — consensus, one-matchweek head-to-head and the rival-gap line are delivered. League-wide named predictions (`MIG-UI-01`), profiles (`MIG-UI-02`) and movement (`MIG-UI-03`) are backend-blocked |
| `UI-F08` | Games brought to equal presentation quality | Outstanding |
| `UI-F09` | LMS: selection, status, survival context | **Partial** |
| `UI-F10` | Predictor Championship: fixture, table, opponent, phase, player links | **Partial** |
| `UI-F11` | Matches & Match Centre: dedicated journey, consequences, league comparison, consensus, movement | **Partial** — the addressable route is delivered and every fixture list links into it; league comparison and movement need `MIG-UI-01`/`MIG-UI-03`, and an exact fixture read is `MIG-UI-11` |
| `UI-F12` | Leagues: private-play workspace, Table / Matchweek / Members | **Partial** — global `/leagues` lists all private play; the workspace's Matchweek and Members tabs need `MIG-UI-01` |
| `UI-F13` | Create / Join: one wizard, universal join code | Outstanding (`DFA-008`, `MIG-UI-05`–`MIG-UI-07`) |
| `UI-F14` | Player profile: predictions, H2H, history, season record, trophy cabinet, streaks | Outstanding (`MIG-UI-02`) |
| `UI-F15` | Retention and recap: Since you were last here, Matchweek Recap, rank/rival movement, milestones, share entry points | **Partial** — see § 4A |
| `UI-F16` | Season Wrapped and history | Outstanding (`MIG-UI-08`) |
| `UI-F17` | Account, preferences, onboarding | Outstanding (`DFA-001`, `DFA-002`, `MIG-UI-10`) |
| `UI-F18` | Final design pass: spacing, typography, hover/focus, motion, skeletons, all states, both themes, density | Outstanding |
| `UI-F19` | Full signed-in acceptance: phone + desktop, light + dark | Outstanding |
| `UI-F20` | Public acquisition landing page | Outstanding, and deliberately last (`DFA-011`) |

## 12. The backend boundary

**The visual finalisation itself needs no migration.** Some of the planned social and private-play behaviour cannot be completed with the reads the weekly season currently exposes. Those items are a separate backend workstream and are registered as `MIG-UI-01`–`MIG-UI-11` in [`../quality/accepted-requirements.md`](../quality/accepted-requirements.md). A UI session that reaches one of them records the precise data requirement and continues with other UI work; it does not create a speculative migration, and it does not fake the behaviour in the client.

Provider enrichment and odds are separate again: measure entitlement, terms and payload before any schema is committed, and do not create schema for an unused toggle.
