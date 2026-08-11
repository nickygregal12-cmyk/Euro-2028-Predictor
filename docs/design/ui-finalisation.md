# UI finalisation — owner direction, 10 August 2026

**Status:** current UI authority for the signed-in weekly domestic product.
**Accepted:** owner, 10 August 2026, as the outcome of the August 2026 design workshop; **amended the same day** with the navigation authority, the competition scalability contract and the retention/recap pillar. Where the earlier version and the amendment differ, the amendment wins and this document records the amended position.
**Updated 11 August 2026** by the session that consumed contracts 147–151. Nothing in the direction changed; what changed is that five of the backend gaps it recorded are now closed and the rows that called them blockers were stale. Where this document previously said a thing "needs `MIG-UI-01`/`MIG-UI-03`", it now says what was built.
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

**Follow is stored and read.** Contract 157 (`MIG-UI-10`) added the persistence on 11 August 2026 and the shell consumed it the same day. `followed` and `favourite` are booleans whenever the preference read landed, and `'unknown'` now means only that it did not — never that the player declined. Follow and game membership are **unioned**, not intersected: a player who follows a competition and has joined no game in it is in `mine` with an empty `joinedGames`, which is the state that was previously invisible.

**Which competitions exist, and where each one lives, are both the server's answer (`MIG-UI-12` — closed).** Contract 147's `get_published_weekly_seasons()` returns each published league season's **route slug** beside its season key, competition identity, lifecycle and calendar zone. `HUB_COMPETITIONS` is **gone**: `catalogueFromPublishedSeasons()` builds the catalogue from that read, and publishing a league on the server is now the whole of making it exist AND making it openable. The `kind = 'league_season'` filter lives in the RPC, so Euro (`kind = 'tournament'`) is excluded by what it *is*, its own publication boundary is untouched, and the browser does not re-filter — a second opinion about what the platform publishes is precisely what could disagree.

What remains in the frontend is presentation copy keyed on the **game**, not on the competition: one sentence explaining each of the three weekly game FORMATS, identical in every competition that runs them, so twenty new leagues add twenty catalogue entries and no frontend edit. Whether a season actually SERVES a game is `get_competition_games`, never a frontend list. A slug is still never derived from a name.

**Scaling rules:**

- Global surfaces default to the player's own competitions, never the platform catalogue.
- Navigation shows roughly 4–6 competition shortcuts, then All competitions. The rail's height is a function of what the player plays, never of what the platform publishes.
- The whole catalogue is deliberate discovery at `/competitions`, with search and the player's own pinned. It is not a sixth global destination.
- Adding a competition must require no navigation redesign, and ideally no frontend edit at all: publish it on the server, and it appears.
- **No invented metadata.** Region, country, competition type and popularity are not held anywhere, so Explore is search plus the player's own pinned plus the rest. The grouping seam exists; the taxonomy does not, and guessing one from competition names would be a heading that lies.

**The acceptance test is executable, and it now exercises the real route model.** `src/dev/scaleFixture.ts` is a synthetic platform of twenty published competitions where the player plays in three — deliberately not the first three. Since contract 147 it supplies the rows `get_published_weekly_seasons()` would return, **including each season's slug**, and feeds them through the real `catalogueFromPublishedSeasons` — so the twenty are routable for the same reason the real ones are, rather than because a frontend array was extended to twenty. `tests/features/hub/twentyCompetitionScale.test.ts`, `tests/features/hub/serverDrivenCatalogue.test.ts` and `tests/app/desktopRail.test.tsx` assert against it. With the real catalogue's two entries a bounded list and an unbounded one are indistinguishable.

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
| **Since you were last here** | What changed that the player cares about, since their last visit | **Delivered for results, and its consequence now sits beside it.** The Hub lists matches in the player's competitions that finished since the local marker, and the Matchweek Recap below carries the points and rank half that used to be a disclaimer. One failure edge was also fixed: the marker used to advance on mount, so a Hub whose reads then failed silently consumed a period the player never saw. It now advances only once at least one competition has answered |
| **Matchweek Recap** | Deterministic recap once a matchweek settles: points, movement, exacts, Joker, league winner, gap change | **Delivered for the current settled matchweek.** Contract 151 supplies banked matchweek points, the season total, rank of field size and the exact/correct counts; contract 150 supplies movement inside a private league. A matchweek counts as settled when its points are banked — never a clock comparison — and a competition with nothing settled contributes no card. The bounds are stated on the surface rather than applied silently: three competitions, and league movement for the most relevant one. Permanent Wrapped/history remains `MIG-UI-08` |
| **Rival Watch** | One or two private-league co-members pinned as close rivals, with the gap and what a result did to it | **Partial** — the gap to the nearest rival and the leader is derived in the league table, and contract 150's movement now shows what a settled matchweek did to the caller's position and their gap to the leader. Pinning a rival across devices still needs `MIG-UI-09`, which stays optional and not a blocker |
| **Rank context** | Never a bare rank: "384th of 4,812 · Top 8%", "4th of 18 · ↑3" | **Delivered.** Rank and field size travel together everywhere they appear — the season standings, contract 151's player profile and the Hub recap — and contract 150 supplies the "↑3" inside a private league. There is no season-wide movement read and none is claimed: movement appears beside the league it was measured in |
| **Points explanation** | One reusable component driven by the canonical scoring authority, never a second copy of the rules | **Delivered.** `src/features/scoring/MatchweekPoints.tsx` over `matchweekPointsModel`, mounted on the season Match Predictor card and rendering nothing until the matchweek settles. It is the other half of `explainFixtureScore`, which the Match Centre has used to explain ONE fixture since it shipped — the reasons come from that shared authority and never from a comparison written again in a component. The per-fixture numbers and the total are the server's: the rows are itemisation, the total is what the season banked, and where the two do not meet the surface says so rather than resolving it in the player's favour or against it. The Joker is one line after the fixtures, because ADR 0012 doubles the matchweek — doubling each row reaches the same total by a route the rule does not take |
| **Trophy / career record** | Meaningful football achievements, no XP economy; competition scoring stays separate | Outstanding. `MIG-UI-02` is closed and the season record it blocked is delivered, but a durable career/trophy record needs the immutable archive `MIG-UI-08` owns. `/profile` deliberately renders no trophy furniture rather than an empty cabinet |
| **Streaks** | Context, not another points system | Outstanding |
| **Share cards** | Explicit, branded, never exposing unrevealed predictions or league membership by default | Outstanding |
| **Season / Tournament Wrapped** | A deterministic end-of-season story from measured facts; no generative copy that can hallucinate a claim | **Delivered for the season, as the archive rather than as a story.** Contract 156 stores an immutable end-of-season snapshot and the profile renders exactly what it stored — no derived percentile, no career total, no trophy count, because the archive holds none of them. There is no generative copy anywhere in it. A narrative Wrapped built on those same facts remains open, and is a presentation decision rather than a missing read |
| **Season history** | Wrapped becomes permanent history under the profile | **Delivered** — `MIG-UI-08` and `MIG-UI-17` are both closed. `/profile` lists every season the player took part in through contract 161, which keys on PARTICIPATION rather than publication, so an archived season stays in the history of the player who played it. A season still being played is listed and says so rather than being rendered as zeros |

**Nothing in this layer may invent a fact.** Narrative copy is derived from stored facts only, and a surface that cannot read what it would need says so rather than estimating.

## 4B. First-sign-in onboarding

The complete flow remains accepted and unbuilt (`DFA-001`, `DFA-002`): account/display name → choose competitions to follow → optional favourite team → choose games **independently per followed competition** → optional private play → finish into a personalised Hub. It must be persisted and resumable, and a pending invitation must survive authentication and onboarding.

Competition selection must not become a flat wall of cards: search, sensible grouping, selected competitions pinned, a clear selected count, deliberate Explore behaviour. Bulk game selection ("apply these games to all selected competitions", then "customise by competition") is acceptable **provided every membership choice stays explicit and reviewable** — nothing is silently joined.

**Audit before migrating.** Game memberships already have server authorities and must keep using them; do not create a parallel frontend membership model. `MIG-UI-10` asked what could store the non-game choices, and contract 157 answered it — so wiring the flow is now a frontend task rather than a blocked one.

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
| `UI-F03` | Hub: action-led, live football, Since you were last here, compact competition summaries, Rival Watch, Matchweek Recap entry, discovery last | **Substantially delivered** — the order, the next action, today's football, Since-you-were-last-here and compact summaries were already there; the Matchweek Recap is now real, from contracts 151 and 150, and the "points and rank are not shown yet" disclaimer is gone with the gap it described. The last-visit marker no longer advances before the data resolves. Rival Watch's cross-device pinning stays optional (`MIG-UI-09`) |
| `UI-F04` | Global Play as a cross-competition inbox; competition Play preserved beneath the shell; Overview as a state-driven dashboard | **Delivered for global Play and the Overview composition**; competition-scoped Play is unchanged beneath the shell |
| `UI-F05` | Match Predictor: flagship flow, completion/lock/Joker polish, desktop insights panel | **Partial** — desktop panel delivered; the route stays behind `VITE_UI_SEASON_MATCH_PREDICTOR` until its migration reaches a hosted environment |
| `UI-F06` | Football Insights: form, H2H, table/goals context, enrichment slots | **Partial** — contract 141 form and club head-to-head render in the Match Centre |
| `UI-F07` | Player & League Insights: comparison, profiles, rank movement and percentile, Rival Watch, post-lock predictions, reusable points explanation | **Delivered for the pillar's core** — consensus, one-matchweek head-to-head, the rival-gap line, rank percentile and the reusable points explanation were already there; contracts 149, 150 and 151 added league-wide named predictions after the matchweek's lock, rank movement over a settled matchweek, and the season player profile with its exact/correct counts. What remains is optional: multi-matchweek rivalry history (`MIG-UI-04`) and pinned rivals (`MIG-UI-09`) |
| `UI-F08` | Games brought to equal presentation quality | **Delivered** — every card carries joined state, the game's own outstanding action and deadline, a direct action label, honest refusals with no dead controls, joined games sorted before available ones, and now a "How this works" disclosure per game. The rules gap is closed without a second scoring authority: `src/features/season/gameRules.ts` imports every figure from the module that decides it (`domain/season/scoring`, `lmsPresets`, `lmsRoundResolution`, `cupTieSettlement`) and nothing links to `docs/scoring-rules.md`, which is the preserved Euro configuration for a different game |
| `UI-F09` | LMS: selection, status, survival context | **Partial** — the pick, the round, the deadline, the survival verdict from the settlement authority, and now a desktop form guide beside the pick list derived from contract 141. Other-player information waits on a read that does not exist |
| `UI-F10` | Predictor Championship: fixture, table, opponent, phase, player links | **Partial** — My Fixture now carries a compact standing panel (position, three rows, phase, and where the points come from) built from the view it already loaded. Entry, the Penalty Number journey and the knockout bracket still wait on drivers and reads |
| `UI-F11` | Matches & Match Centre: dedicated journey, consequences, league comparison, consensus, movement | **Delivered** — the route is genuinely self-contained: contract 148 resolves the fixture by its own id, so the `?on=` day, the three-week window search and the "that match is not in this window" state are gone. The page composes three deliberately distinct answers: **You** (the player's prediction and points) in the main column, **Your leagues** (contract 149's named predictions after the matchweek's lock, with contract 150's movement) and **Everyone** (contract 130's anonymous consensus with its minimum cohort) beside it. A named league prediction is never presented as a consensus |
| `UI-F12` | Leagues: private-play workspace, Table / Matchweek / Members | **Delivered for the Match Predictor league** — global `/leagues` lists all private play, and a league now opens into the accepted workspace. **Table** is contract 128's ranking with the rival and leader gaps; **Matchweek** is contract 149, as a desktop comparison matrix that scrolls inside its own container and a purpose-built phone layout with the player's own row first in every fixture — never the matrix shrunk; **Members** is the same rows ordered by name, with a route into each player's season. Contract 150's movement sits above the tabs and only from a settled matchweek. Which league is open and which tab lives in the URL, so Back from a player's season returns to it. Private LMS and Championship containers are created and joined since 11 August 2026 (contracts 153–155); a private COMPETITION still has no workspace of its own and lands in the `/leagues` list |
| `UI-F13` | Create / Join: one wizard, universal join code | **Delivered** — one creation journey covering all three weekly games, dispatching to `create_game_league`, `create_private_season_lms` or `create_private_season_cup` and showing only the selected game's fields; and one code entry point over `resolve_invite_code`, on both `/join/:code` and the code sheet, with the server's `joinWith` deciding which join is called. The refusal screens for the other two games are gone with the reason for them |
| `UI-F14` | Player profile: predictions, H2H, history, season record, trophy cabinet, streaks | **Delivered for the season record and prediction history** (contract 151), on `/competitions/:competitionSlug/:seasonSlug/players/:playerId`: identity under the server's co-member boundary, entered/not-entered, season points, rank of field size, matchweeks played, exact-score and correct-outcome counts, Joker summary and per-matchweek history after each matchweek's own lock. The refusal is rendered as a refusal, never as an empty profile, and there is no player directory. `/profile` is the platform-level identity above it and is no longer inside the Euro boundary. Streaks and a trophy cabinet are still absent rather than empty: contract 156's archive stores neither, and inventing either in the browser would be a claim the archive never made |
| `UI-F15` | Retention and recap: Since you were last here, Matchweek Recap, rank/rival movement, milestones, share entry points | **Partial, and substantially advanced** — Since you were last here, the Matchweek Recap, rank/rival movement, the points explanation and permanent season history are all delivered (see § 4A). **Milestones, streaks and share cards remain outstanding, and share cards are the one that is blocked rather than unstarted:** the share stack under `src/features/share/` draws a tournament bracket onto a canvas from country flags, a predicted champion and a knockout pipeline, none of which a league season has. A season card is a second renderer over club identity, not a variant of the existing one, and it is a design decision before it is an implementation |
| `UI-F16` | Season Wrapped and history | **Delivered** for what contract 156 stores, on `/profile`: final points, finishing position of field size, matchweeks played, best matchweek, exact/correct counts and Jokers, recomputed nowhere. A season no longer published cannot be found (`MIG-UI-17`), and the surface says so. Unchanged: the CURRENT settled-matchweek recap now ships from contracts 151 and 150, which is deliberately a different thing — it is derived live each time, while Wrapped must be an immutable snapshot that does not change when a later formula does |
| `UI-F17` | Account, preferences, onboarding | **Delivered** — the four steps are the live `/welcome` journey: progress written as the player moves, both step and choices resumed from contract 157, every step after the first skippable, a pending invite handed back at the end, and a failed catalogue read never a trap. Account gains follow/unfollow for any published competition and a favourite club per competition, and every write reloads the shell so the Hub, rail, switcher and Match Centre agree immediately |
| `UI-F18` | Final design pass: spacing, typography, hover/focus, motion, skeletons, all states, both themes, density | **Partial** — a measured responsive sweep at 390 / 768 / 1023 / 1024 / 1280 / 1440 / 1800 in both themes found no horizontal overflow anywhere and no undersized tap target on a shipping season surface; the three it did find were in the parked tournament Match Centre and were fixed anyway. See § 13 |
| `UI-F19` | Full signed-in acceptance: phone + desktop, light + dark | Outstanding |
| `UI-F20` | Public acquisition landing page | **Partial, and now two pages.** ADR 0026's deployment seam landed on 11 August 2026, so the weekly landing page has a tournament-led sibling: `EuroLandingPage` leads with Euro Predictor and groups the three weekly games beneath it as Bonus Games, keyed on contract 143's publication state and closed by default. Both keep the production design system. What remains of `UI-F20` is the acquisition polish the row was written for — the isolated presentation states, the pause controls, and the desktop composition pass — on both variants |
| `UI-F21` | Two deployments from one commit: variant-selected brand, navigation, landing, metadata, sitemap and route visibility | **Delivered for brand, navigation, landing and metadata.** `VITE_SITE_VARIANT` and one typed `SiteConfiguration` (`src/app/site/`), failing closed to the Hub. The document head, sitemap and `robots.txt` are generated per deployment; an unconfigured origin emits none of them rather than falling back to the other site's domain. **Route visibility is built and not turned on:** the deployment gate refusing the tournament's player routes exists and is proven, and both deployments still serve them, because withdrawing them from the weekly app deletes the `euro-2028-baseline` browser evidence rather than moving it. That flip is an owner decision plus a browser-suite move |

## 12. The backend boundary

**The visual finalisation itself needs no migration.** Some of the planned social and private-play behaviour cannot be completed with the reads the weekly season currently exposes. Those items are a separate backend workstream and are registered as `MIG-UI-01`–`MIG-UI-12` in [`../quality/accepted-requirements.md`](../quality/accepted-requirements.md). A UI session that reaches one of them records the precise data requirement and continues with other UI work; it does not create a speculative migration, and it does not fake the behaviour in the client.

**Five of them are closed, and this section is where that is stated once.** Contracts 147–151 landed on 10 August 2026 and were consumed by the frontend on 11 August:

| Row | Contract | What the frontend now does |
| --- | --- | --- |
| `MIG-UI-01` | 149 | The Match Centre's "Your leagues" section and the private-league workspace's Matchweek tab — named co-member predictions after that matchweek's own lock, hidden completely before it |
| `MIG-UI-02` | 151 | `/competitions/:competitionSlug/:seasonSlug/players/:playerId`, and the platform profile at `/profile` that links into it |
| `MIG-UI-03` | 150 | Rank movement over a settled matchweek: above the league workspace's tabs, in the Match Centre's league section, and in the Hub's Matchweek Recap |
| `MIG-UI-11` | 148 | The Match Centre resolves its fixture by id. The `?on=` day, the date-window search and the "that match is not in this window" state are all gone |
| `MIG-UI-12` | 147 | The catalogue, with route slugs, from the server. `HUB_COMPETITIONS` is deleted |

**Consumed on 11 August 2026.** `MIG-UI-05`, `-06`, `-07`, `-08`, `-09` and `-10` had their backend landed the same day by contracts 152–157, and the frontend called all six: the unified three-game creation journey, the universal invite resolver on both join surfaces, the platform profile's Season history, the persisted first-sign-in journey, Account's followed-competitions card and the Hub's Rival Watch. **None of it is applied to a hosted environment by this note** — these remain repository facts, and the signed-in hosted acceptance is still `UI-F19`. Two gaps the pass reached and could not close from the browser are recorded as `MIG-UI-16` and `MIG-UI-17`.

`MIG-UI-04` remains optional and is explicitly not a blocker.

**Contract 158 narrows what Join with code may show, and lengthens what it must accept.**
`SEC-001`'s invite-code hardening bears directly on § 7 and `UI-F13`, so it is recorded
here rather than left to be discovered:

- **Codes are now up to twelve characters.** `JoinLeagueModal` never validated length —
  it refuses only an empty field — so a long code already works. Its placeholder still
  reads `ABC234`, which now shows a shorter code than the server issues. Codes issued
  before the change keep their six characters until an owner rotates them, so the field
  must go on accepting both.
- **`get_league_preview` no longer returns the member count or the owner's display name**,
  because together they turned a guessed code into a positively identified private group
  with a real person's name attached. The join step can show the league's name and whether
  the caller is already a member, and nothing else. `fetchLeaguePreview` already reads only
  those two fields, so nothing is broken — but a future "who else is in here?" line on the
  join screen is a disclosure decision, not a missing read, and must not be added back
  from another source.
- **A leaked code is recoverable** through `rotate_league_invite_code`, owner-only, and
  since 11 August 2026 a league owner can rotate one from the interface. The control is
  offered only to an owner, which is presentation rather than the authorisation: the
  server is owner-only inside, and a refusal reaching a stale page is shown.

**Contracts 159 to 168 land the backend for two of the three gaps below, and close
the door contract 158 left open.** Recorded here because each bears on a surface this
document governs:

- **`MIG-UI-13` is built and consumed.** Contract 160's `get_competition_table` supplies
  the Table segment the Matches section had no authority for, including a competition's
  own points values, ordered tie-breaks, promotion/playoff/relegation boundaries, points
  deductions and awarded outcomes — and `SeasonMatchesRoute` renders it. *(This paragraph
  said "not yet consumed" until 11 August 2026; the consumption landed the same day and
  the claim was stale rather than wrong.)*
- **`MIG-UI-14` is built** — contract 162 stores exactly what the audit found missing: a
  stable per-action identity and per-player seen/dismissed state, so a bell would neither
  shout for ever nor forget on a second device. **Not yet consumed**, so the AppBar still
  carries no notification control, and only Last Man Standing picks generate an item.
- **`MIG-UI-15` remains deliberately unstarted**, and contract 163 does not touch it:
  the reminder ledger records delivery, never behaviour, and names no processor.
- **Two organiser and administration surfaces are now backed, and all four are consumed.**
  Contract 165 supplies a private Last Man Standing organiser's entrant list and chase
  count (disclosing no selection, and offering no organiser command, because no accepted
  authority grants one) and is read by `GlobalLeaguesPage`; contract 168 supplies the
  staged-proposal and entrant reads `/admin/season` named as absent, and `SeasonAdminPage`
  reads both; contract 167's group-stage view is read by `SeasonGameRoutes`. *(This
  paragraph said "None is consumed" until 11 August 2026 and was stale the same day.)*
- **A league prediction list can say how much of the league it is showing.**
  Contract 171 adds `members_returned`/`members_truncated` and the tournament
  equivalents, so "showing 200 of 205" replaces a truncated list presented as the
  whole league. It also fixes which 200: contract 149's cap had no ordering, so
  the league leader could be absent from the league's own table. **Not consumed, and nothing
  blocks it.** It was not consumable when this work was done — the function had
  reached no hosted environment — and both Development and Production reached 171
  the same day. The types regeneration named here as the remaining step was not
  one: this read is typed `Returns: Json`, so its fields are decoded by hand and
  the generated types never constrained them. Extending the decoder is all that
  stands between here and the two lists saying "showing 200 of 205".
- **The action centre has something to show most players.** Contract 170 adds the
  matchweek generator contract 162 left for later, carrying `predicted` and
  `fixtures` so the item reads "6 of 10" rather than "incomplete". **Still not
  consumed**, and the AppBar still carries no notification control. 170 is now
  hosted, so no rollout is outstanding — but the
  Championship generator is deliberately unwritten (`CUP-002`), so the feed is
  still not complete, which is the reason the action centre stays interim.
- **A Championship table now says what it was ranked over.** Contract 169 corrects the
  span the season group table is ranked on — the tournament's three matchdays, for a
  competition that plays thirty-eight — and adds `table_source` to `get_season_cup_phase`
  so a surface can label the table honestly instead of inferring the span from the
  competition's kind. It adds no surface and changes no layout. **The label is not
  rendered**, and the reason is not the generated types: `get_season_cup_phase` is
  typed `Returns: Json`, so `table_source` is decoded by hand like every other
  field on it. The function is hosted at 171; extending `cupPhaseModel` is the
  whole of the remaining work.
- **The rotate control § 7 said nobody could reach is now reachable.** An owner rotates a
  league's invite code from the season Leagues surface, behind a confirmation that names
  the code about to break rather than asking "are you sure?". Contract 159 narrowed
  `resolve_invite_code` the way 158 narrowed the preview — the member count and the target
  id are gone, and a wrong guess now costs a limit slot — so the same rule still applies
  to the universal code entry point: a "who else is in here?" line must not be added back
  from it either.

**Three gaps were newly found on 11 August and registered rather than approximated:**

- `MIG-UI-13` — a domestic **league table**. The Matches section's accepted shape is Fixtures · Results · Table · Stats, and Table has no authority: contract 141's derivation is explicitly not a league table, because a table carries competition rules — deductions, tie-break order, promotion boundaries — that belong to the competition, and its read caps at twenty matches. So the section ships **Recent form** from that read, labelled as form, and **no Table control at all**. A dead segment is worse than a missing one.
- `MIG-UI-14` — an **action centre**. What a notification would SAY is already derivable; what nobody stores is what a player has already SEEN. A bell over an inbox with no read cursor either shouts for ever or forgets on a second device, so the AppBar keeps theme and avatar and gains no notification control.
- `MIG-UI-15` — **product analytics**. There is no analytics authority in the repository, only Sentry for errors. Choosing a processor, a lawful basis and a retention period is a data-processing decision, not a frontend one, so the opportunity is recorded and nothing was introduced.

Provider enrichment and odds are separate again: measure entitlement, terms and payload before any schema is committed, and do not create schema for an unused toggle.

## 13. The responsive sweep, and what it measured

The `UI-F18` sweep is a measurement rather than an impression. Every reachable surface — the component gallery and the season/match-centre development harnesses, which render the real page components — was loaded at **390, 768, 1023, 1024, 1280, 1440 and 1800** CSS pixels, in **both themes**, and at each combination three properties were read from the live document:

- **Horizontal overflow.** `documentElement.scrollWidth - clientWidth`, plus every element whose box extends past the viewport. A wide table or diagram may scroll inside its own container; the page body may not.
- **Tap targets.** Every `button`, `a[href]`, `input` and `select` shorter than 40px. A visually-hidden input inside a label is measured at its label, because the label is the target — measuring the input reports every accessible radio group as a 13px control, which is the false positive this check has to avoid to be worth running.
- **The rail breakpoint.** Whether the desktop rail and the mobile bottom navigation are each present, so the 1024px handover is observed rather than assumed.

Result: **no horizontal overflow at any width in either theme, on any surface.**

On tap targets the sweep found three undersized controls, and it is worth being exact about where: `Previous`, `Next` and `Back` in the **tournament** Match Centre topbar, at 34px, 34px and 26px. `src/features/matches/` is parked Euro code rather than a shipping weekly surface, so this is not a live defect; it was fixed anyway in `MatchCentre.module.css`, because a two-line stylesheet correction is cheaper than a note explaining why it was left.

**No shipping season surface has an undersized control.** Two classes of sub-44px element remain and neither is a defect. The development harnesses' own scenario switchers are not shipping UI and are now marked `data-harness`, so the sweep says so instead of the reader having to know. The score stepper's `+`/`−` is 44px wide and 36px tall — under the minimum on one axis only, with 4px gaps either side — which is a decision recorded in `ScoreInput.module.css` rather than an oversight, and it stands.

What the sweep cannot cover is the signed-in application routes, which need a session. Those remain part of the hosted acceptance in `UI-F19`, and the Team-SSO boundary on that environment is a genuine gate rather than an obstacle to work around.

## 14. Visual baselines, and the defect the first render found

Nine gallery sections are declared in `e2e/visual-gallery.spec.ts` beyond the original curated list: `mobile-bottom-navigation`, `desktop-navigation-rail`, `lms-form-guide-panel`, `fixture-consensus-panel`, the three onboarding sections, `create-private-play-journey` and `game-rules-disclosure`. A baseline is only meaningful when rendered on the machine that compares it, so all of them come from a dispatch of **Visual contracts** (`.github/workflows/visual-contracts.yml`) with `update_baselines: true` and `commit_baselines: true`, which pushes the images to the branch and refuses to write to the default branch.

**The first render found a real loss of coverage, which is what the run was for.** The `pageshell-bottomnav` baseline came back with no bottom bar in it — five tabs gone and a fifth of the file with them. The cause is not a product defect: `PageShell` hides the bar above 1024px, and that is a **viewport** media query, while the gallery pins each panel's **width** in CSS. The runner's window therefore puts both the phone and desktop panels above the breakpoint, and the section named after the bar could no longer photograph one. In the application the viewport *is* the width, so a phone gets the bar and a desktop gets the rail, exactly as intended.

The fix restores the coverage rather than relaxing it: `mobile-bottom-navigation` renders `BottomNav` directly, which is viewport-independent and is the same thing the rail section has always done. Two framing corrections came from reviewing the same images — the rail frame was 420px tall and clipped everything below the third competition shortcut, so the baseline could not show that "All competitions" exists, which is the bound's whole point; and the frame stretched to the panel, leaving ~900px of empty pixels for a pixel comparison to look through.

`AWAITING_BASELINE` in the same spec names any section declared but not yet rendered. `visualContractHarness` excludes those from its baseline count and **fails once a name in it has baselines on disk**, so an entry expires with the dispatch that satisfies it and cannot become the way new sections are added.

## 15. What the browser suite caught

The Playwright suite cannot run in a development container, so its first execution was on the pull request — and it found two things nothing local could:

- **The root's document title still said "Competitions."** The page's heading, the bottom bar and the rail all say Home; the browser tab was the last place the retired chooser survived. `getRouteTitle('/')` is Home now, in both signed-out and signed-in states, and the unit assertion that used to record the difference between them records the convergence with the reason attached.
- **`globalNav()` asked for the rail by accessible name without `exact`.** Playwright matches accessible names as a case-insensitive substring, so on a competition route at desktop width `'Sections'` matched both the rail and the competition's own "Premier League sections" sub-navigation, and every assertion routed through the helper died on a strict-mode violation rather than on anything about the product.

Neither is reachable from jsdom — one needs a real document title, the other needs two navigations in one tree at a width jsdom does not have. Six specs also carried the old Hub heading and were updated; the keyboard journey's "open a competition" step moved to `/competitions`, which is where the catalogue now lives.
