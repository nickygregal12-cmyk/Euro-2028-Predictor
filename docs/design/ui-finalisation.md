# UI finalisation — owner direction, 10 August 2026

**Status:** current UI authority for the signed-in weekly domestic product.
**Accepted:** owner, 10 August 2026, as the outcome of the August 2026 design workshop.
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

## 2. Responsive shell — decided, and implemented

**Phone and desktop share the product rules and components but need not share composition.** Desktop must never be a mobile page stretched into an 800px column.

- A **persistent left rail** on desktop: 240px expanded, 64px collapsed, the choice persisted. This is the design authority's existing rail contract and it is now built (`src/design-system/SideRail.tsx`).
- **Exactly one navigation is visible at a width.** Bottom bar below 1024px, rail at and above it. Both are always in the DOM, so no JavaScript width measurement decides navigation.
- The rail's first group **is** the bottom bar's five destinations in the bar's order. This is a change of presentation, not the destination swap §7.2 of the design plan forbids. Only the Leagues label differs — "Leagues & Competitions" on desktop, where there is room for the distinction.
- **Desktop may expose more direct navigation than mobile.** The rail adds a Competitions group, expanding the competition the player is currently inside into its sections and games, and a More group reaching How to play, Profile and Account directly.
- **Page composition** is main column plus an optional contextual panel (`src/design-system/Workspace.tsx`): shell about 1440px, reading/list column about 820px, panel 320px sticky at and above 1280px and stacked in source order below it. Nothing may be reachable only from the panel, and the panel derives rather than duplicates.

Worked examples: Match Predictor — predictions left, insights right. Standings — the table full width with the retention tables beside it. Competition Overview — the week's actions with the competition's fixtures alongside. Match Centre — result and football in the main column, player and league consequence beside it.

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
| `UI-F01` | Responsive shell: persistent desktop rail, desktop composition system, mobile preserved | **Delivered** — `SideRail`, `Workspace`, `PageShell`; adopted on Competition Overview, Match Predictor and standings. Remaining: adoption breadth on the other sections |
| `UI-F02` | Global football presentation: shared local-time kickoff formatting, date grouping, card hierarchy | **Delivered for formatting** — `src/shared/time/kickoff.ts` and its production-graph guard. Card hierarchy work continues under `UI-F16` |
| `UI-F03` | Hub: premium personalised signed-in home | Outstanding (`DFA-010`) |
| `UI-F04` | Competition Overview composition | **Partial** — desktop composition delivered; the personalised summary depends on `MIG-UI-03` |
| `UI-F05` | Match Predictor: flagship flow, completion/lock/Joker polish, desktop insights panel | **Partial** — desktop panel delivered; the route stays behind `VITE_UI_SEASON_MATCH_PREDICTOR` until its migration reaches a hosted environment |
| `UI-F06` | Football Insights: form, H2H, table/goals context, future enrichment slots | **Partial** — contract 141 form and club head-to-head render in the Match Centre |
| `UI-F07` | Player & League Insights | **Partial** — consensus, one-matchweek head-to-head and the rival-gap line are delivered; league-wide named predictions (`MIG-UI-01`), profiles (`MIG-UI-02`) and movement (`MIG-UI-03`) are backend-blocked |
| `UI-F08` | Games brought to equal presentation quality | Outstanding |
| `UI-F09` | LMS: selection, status, survival context | **Partial** |
| `UI-F10` | Predictor Championship: fixture, table, opponent, phase, player links | **Partial** |
| `UI-F11` | Matches & Match Centre: dedicated journey, consequences, league comparison, consensus, movement | **Partial** — inline Match Centre with own prediction, result, points, club form, head-to-head and LMS stake. The addressable route, league comparison and movement are outstanding |
| `UI-F12` | Leagues & Competitions workspace: Table / Matchweek / Members | **Partial** — Table only; the other two need `MIG-UI-01` |
| `UI-F13` | Create / Join: one wizard, universal join code | Outstanding (`DFA-008`, `MIG-UI-05`–`MIG-UI-07`) |
| `UI-F14` | Player profile: domestic profiles, predictions, H2H, history | Outstanding (`MIG-UI-02`) |
| `UI-F15` | Account, preferences, onboarding | Outstanding (`DFA-001`, `DFA-002`) |
| `UI-F16` | Final design pass: spacing, typography, hover/focus, motion, skeletons, all states, both themes, density | Outstanding |
| `UI-F17` | Full signed-in acceptance: phone + desktop, light + dark | Outstanding |
| `UI-F18` | Public acquisition landing page | Outstanding, and deliberately last (`DFA-011`) |

## 12. The backend boundary

**The visual finalisation itself needs no migration.** Some of the planned social and private-play behaviour cannot be completed with the reads the weekly season currently exposes. Those items are a separate backend workstream and are registered as `MIG-UI-01`–`MIG-UI-07` in [`../quality/accepted-requirements.md`](../quality/accepted-requirements.md). A UI session that reaches one of them records the precise data requirement and continues with other UI work; it does not create a speculative migration, and it does not fake the behaviour in the client.

Provider enrichment and odds are separate again: measure entitlement, terms and payload before any schema is committed, and do not create schema for an unused toggle.
