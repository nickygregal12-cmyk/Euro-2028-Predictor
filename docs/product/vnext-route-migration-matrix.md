# vNext route migration matrix

**Status:** Stage 7.5 deliverable — an accounting device, not a design.
**Scope:** every user-facing route registered in `src/App.tsx`, plus the two compatibility redirects and the dev-only harnesses.
**Does not govern:** any route in production. Nothing here repoints a route, changes a guard or alters Netlify behaviour.
**Updated 2026-08-19 (Stage 12).** The Championship row is being built, and its
stale stage number — "11 (to be scheduled)", which §10 flagged — is corrected to
12. See [`vnext-championship.md`](vnext-championship.md), which is the product
authority for it. §11 records what the audit found, including one predicate item
the current backend cannot satisfy. **It is a TARGET IA decision and it does not
repoint a route.**
**Updated 2026-08-19 (Stage 11).** The Last Man Standing row — the row §6 named
as "the row this matrix exists for" — is BUILT. See [`vnext-lms.md`](vnext-lms.md),
which is the product authority for it. One row below carries the decision, and
§10 records what the audit found. **It is a TARGET IA decision and it does not
repoint a route.**
**Updated 2026-08-18 (Stage 10).** The player-surface question — what is behind
the doorway Stage 9 built, and whether a weekly-season head-to-head is possible
at all — is SETTLED. See [`vnext-player-profiles.md`](vnext-player-profiles.md),
which is the product authority for it. Two rows below carry the decision and one
stale claim in §3 is corrected. **Both are TARGET IA decisions and neither
repoints a route.**
**Updated 2026-08-18 (Stage 9).** The people-surface question — whether `/leagues`
and `/competitions/:c/:s/leagues` merge into one scoped or one unscoped surface —
is SETTLED, and it settled the opposite way round from the way §2 first read it.
See [`vnext-leagues.md`](vnext-leagues.md), which is the product authority for it.
Three rows below carry the decision. **Every one is a TARGET IA decision and not
one repoints a route.**
**Updated 2026-08-18 (Stage 8).** The Matches *system* question §7 left open is
now SETTLED — see [`vnext-matches.md`](vnext-matches.md), which is the product
authority for it. Four rows below carry the decision. **Every one is a TARGET IA
decision and not one repoints a route.**
**Updated 2026-08-17 (Stage 7.6).** The information architecture has been SELECTED — Concept A, the Competition Deck; see [`vnext-shell-ia.md`](vnext-shell-ia.md). The three concept-dependent rows below are resolved, and the `PROPOSED vNEXT DESTINATION` column is now read against the selected architecture rather than concept-neutrally. **A resolved row is a TARGET IA decision and not a routing change**; see "Visible destination versus technical URL" below.
**Last verified:** 2026-08-17, against `src/App.tsx`, `src/app/shellRoutes.ts` and `src/app/weeklyRoutes.ts` at the commit this document was written on.

## Why this exists

Stage 7.5 exists because designing surface-by-surface, in the order the current
navigation happens to list them, produces the old product structure beautifully
redesigned. Last Man Standing is the evidence: it has a full domain — rounds,
picks, used clubs, auto-assignment, settlement, elimination — and it had been
under-scoped in the vNext programme to that point because nothing forced an
inventory.

This matrix is that forcing function. **Every user-facing route gets an explicit
fate before any production cutover.** A route left as "probably covered by
Leagues" is exactly how the next Last Man Standing happens.

## How to read it

### Visible destination versus technical URL

Stage 7.6 makes this distinction load-bearing rather than cautionary, because
three rows now carry a decision:

- a **VISIBLE PRODUCT DESTINATION** is where a player believes they are. The
  selected architecture owns this, and it changed.
- a **TECHNICAL URL** is an address that resolves. Nothing here changed, and
  existing route compatibility may survive right through the cutover.

A resolved row below states the first. Repointing the second is the production
cutover stage's work and is explicitly out of scope for Stage 7.6.

**A ROUTE IS NOT A DESTINATION AND THIS TABLE MUST NOT BECOME THE DESIGN.** A
route can stay technically stable and permanent while disappearing entirely from
the visible information architecture — `/play` is the clearest case, and Stage
7.6 settled it: "Play" is not a permanent navigation item under the selected
architecture, and the address may well keep working. Existing URLs and the
visible mental model are different concerns, and this document is only about the
first.

`FATE` values:

| Value | Meaning |
| --- | --- |
| **RETAIN** | The address and the surface both survive largely as they are. |
| **REDESIGN** | The address survives; the surface is rebuilt in vNext at a named stage. |
| **ABSORB** | The job survives but stops having a page of its own — it becomes part of another surface. |
| **MERGE** | Two or more current routes become one. |
| **REDIRECT** | The address resolves elsewhere and renders nothing of its own. |
| **HIDE** | The route stays reachable and addressable but leaves the permanent navigation. |
| **RETIRE** | The route goes. Nothing in vNext replaces it directly. |

`STAGE` names the vNext stage that owns the work. `—` means no vNext work is
implied.

> **A capability-based companion exists.** This page is keyed on the ROUTE and
> is a dated Stage 7.5 deliverable. Stage 14 needs the other question — *what
> can a player still DO, and where did each of those things go?* — because a
> route may disappear while every useful capability survives, and that is the
> point. That matrix is
> [`vnext-cutover-capability-parity.md`](vnext-cutover-capability-parity.md),
> and it is the live one: a capability whose class changes is edited there, and
> this page is not rewritten to look current.

---

## 1. Global signed-in destinations

| Current route | Component / system | User job | Existing product / data authority | Proposed vNext destination | Stage | Fate | Notes |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `/` | `HubPage` via `HomeDestination` | "What should I care about right now?" | Contract 151/150 recap, `sinceLastVisitModel`, `briefingModel` | **Home, of the ACTIVE COMPETITION** | 6 (done) · cutover later | **REDESIGN + MERGE** | **RESOLVED, Stage 7.6.** Under the Competition Deck, Home is competition-contextual: it is the home of the competition you are in, not of the platform. `/` and `/competitions/:c/:s` are ONE visible destination in the target IA. **The address is untouched** — `/` may keep resolving to whatever the player's active competition is, and deciding how is the cutover stage's work. Gold Standard Home itself is unchanged; only what surrounds it changed. |
| `/play` | `GlobalPlayPage` | Cross-competition action inbox | `playInboxModel`, `useGlobalPlayInbox` | **Absorbed: into Home for this competition, and into the attention layer for the others** | 8+ | **HIDE / ABSORB** | **RESOLVED, Stage 7.6.** The job splits in two and both halves have a home: what needs doing HERE is Home's, and what needs doing ELSEWHERE is the shell's secondary attention layer. Neither is a destination. **The word `Play` therefore leaves the navigation entirely**, which is one of the reasons the game catalogue is not renamed to it. The address can remain. |
| `/matches` | `GlobalMatchesPage` | One chronological calendar across the player's competitions | `combinedFixturesModel` | **ABSORBED into the competition's Matches destination, as a SECONDARY SCOPE.** Not a destination of its own | 8 | **HIDE / ABSORB** | **Settled by Stage 8.** The job is real and is kept — a player in three competitions may want tonight's football across them, and contract 197 was written for exactly that — but it is a two-option control *inside* Matches, never a fifth primary destination and never the landing state. Every fixture in that mode names its competition. See [`vnext-matches.md`](vnext-matches.md) §4. *Technical consequence: none.* The address keeps resolving as it does today. |
| `/leagues` | `GlobalLeaguesPage` | All private play across every competition and game | `privatePlayModel`, `gameLeaguesModel` | **ABSORBED into the competition's Leagues destination.** Not a destination of its own | 9 | **HIDE / ABSORB** | **Settled by Stage 9.** `REDESIGN` became `HIDE / ABSORB`, and the reason is a data one rather than a navigation one: a cross-competition people surface would rank players across competitions they do not share, which **ADR 0011 refuses at the data layer**. The job that survives — naming a league's game and competition — survives inside the competition-scoped surface, where the header names both. See [`vnext-leagues.md`](vnext-leagues.md) §14. *Technical consequence: none.* The address keeps resolving as it does today. |
| `/more` | `MorePage` | Account/help/settings directory | — | Absorbed into the account surface | 9+ | **ABSORB** | A directory page is a symptom of a navigation that ran out of slots. None of the three concepts has a "More". |
| `/competitions` | `ExploreCompetitionsPage` | Deliberate discovery over the whole published catalogue | Contract 147 `get_published_weekly_seasons`, contract 157 follow | Discovery: a sheet (A), a filter overflow (B), the command surface (C) | 7.5 (prototyped) | **RETAIN + HIDE** | Already correctly outside permanent navigation. All three concepts keep the address and change how it is reached. |

## 2. Competition-scoped routes

| Current route | Component / system | User job | Existing product / data authority | Proposed vNext destination | Stage | Fate | Notes |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `/competitions/:c/:s` | `CompetitionDashboardPage` | The competition's own front door | `useHubCompetition`, `competitionWeekModel` | **This IS Home** | 8+ | **MERGE** | **RESOLVED, Stage 7.6.** The concept-defining row, and Concept A won it: this and `/` are the same surface with a different competition in context. A competition dashboard that is separate from Home is the old structure — two front doors, one per scope. **No redirect is added in this stage**; both addresses keep working and the merge is a visible-destination decision. |
| `/competitions/:c/:s/play` | `SeasonPlayRoute` | Competition-scoped action list | `seasonPlayContextModel` | Absorbed into Home or the queue | 8+ | **ABSORB** | Same argument as `/play`, one level down. Two "what needs doing" surfaces at two scopes is one too many. |
| `/competitions/:c/:s/matches` | `SeasonMatchesRoute` | The competition's football | `fixtureListModel`, `useSeasonFixtureWindow` | **Matches** — one of the four competition-scoped destinations | 8 | **REDESIGN** | **Built in Stage 8** as `src/vnext/matches/VNextMatches.tsx`, on contracts 121 and 139. *Technical consequence at the time of the build: none.* The legacy route was untouched, and the vNext surface was reachable only from the dev-only `/dev/vnext-matches` harness. **Stage 14 cut this address over** — see §13. The vNext surface serves it in production now, and the legacy route stays mounted behind its `VITE_UI_FOOTBALL_HUB_*` flag so unsetting the flag restores it. |
| `/competitions/:c/:s/matches/:fixtureId` | `SeasonMatchCentreRoute` | One fixture in full | Contract 148 `get_season_fixture`, `matchCentreModel` | **Match Centre**, reached from Matches | 8 | **RETAIN + REDESIGN** | **Built in Stage 8** as `src/vnext/matches/VNextMatchCentre.tsx`. The address shape is KEPT unchanged, because the addressability is the strength: contract 148 resolves the fixture from its id alone, so a deep refresh and a shared link both work with no date hint and no window. *Technical consequence: none.* |
| `/competitions/:c/:s/games` | `CompetitionGamesPage` | The game catalogue and the player's memberships | `get_competition_games` | **`Games` — a first-class permanent destination** | 9+ | **REDESIGN** | **RESOLVED, Stage 7.6: it survives, and it is one of the four.** The only surface where Match Predictor, Last Man Standing and the Predictor Championship are PEERS, which is the thing that stopped LMS being "another little tab". Labelled `Games` and not `Play` — see [`vnext-shell-ia.md`](vnext-shell-ia.md) §3. Stage 7.6 builds no page here beyond a Storybook navigation stub. |
| `/competitions/:c/:s/games/match-predictor` | `SeasonMatchPredictorRoute` | Predict the matchweek | Contract 113 card, `useSeasonMatchPredictor` | Match Predictor | 7 (done) | **REDESIGN** | Accepted and unchanged by Stage 7.5. Used here as a real arrival test for each concept. |
| `…/games/match-predictor/standings` | `SeasonStandingsRoute` | How am I doing against the field | Contract 95 season leaderboard | The people dimension | 9+ | **ABSORB** | A game's standings and a private league's table answer the same question at two scopes. **The identity gap this row used to point at is closed**: contract 191 supplies `playerRef`, `reach` and `playerId`, Stage 9's table links a player where the server allows it, and Stage 10 built what is behind the link. |
| `/competitions/:c/:s/games/lms` | `SeasonLmsRoute` | Survive the round | Contract 116 `get_season_lms_round`, contract 164 `get_season_lms_field`, `save_lms_selection`, `lmsRoundModel` | Last Man Standing | 11 | **REDESIGN** | **Built in Stage 11** as `src/vnext/lms/VNextLms.tsx`. §6 called this "the row this matrix exists for", and the build bore that out: it is the first vNext surface that WRITES, and the first where the page's own heading is a verdict rather than a total. Two reads with two outcomes — the round a player acts on, and the pool they act against — so a field read that fails cannot withhold the pick. **The lock is the SERVER'S**: contract 164's `revealed` is `locks_at <= now()` evaluated by the database, and the instants are only the fallback. See [`vnext-lms.md`](vnext-lms.md). *Technical consequence at the time of the build: none.* The legacy route was untouched, and the vNext surface was reachable only from the dev-only `/dev/vnext-lms` harness. **Stage 14 cut this address over** — see §13. The vNext surface serves it in production now, and the legacy route stays mounted behind its `VITE_UI_FOOTBALL_HUB_*` flag so unsetting the flag restores it. |
| `/competitions/:c/:s/games/championship/*` | `SeasonChampionshipRouter` | A season-long fixture list against named opponents | Contract 193 `get_season_cup_bracket`, contract 133 `get_season_cup_player_view`, contract 167 group stage, `submit_cup_penalty_number`, `championshipStandingModel`, `cupPhaseModel` | Predictor Championship | 12 | **REDESIGN** | **Stage number corrected from "11 (to be scheduled)", which §10 flagged as stale — this is Stage 12 in the programme this matrix serves.** **Built in Stage 12** as `src/vnext/championship/VNextChampionship.tsx`. **Four addresses become two**, and from the data rather than from a preference: `SeasonChampionshipPages.tsx` branches on a `mode` after loading a SINGLE player view and says so about its own neighbour table — *"IT USES WHAT THE PAGE ALREADY LOADED … this costs no request"* — so three addresses over one read is a navigation habit, not a data boundary. That is the opposite of Stage 9's leagues, where two tables had two different rank authorities and had to stay apart. The index keeps its address because `get_my_season_cup_instances` is genuinely its own read. See [`vnext-championship.md`](vnext-championship.md). *Technical consequence at the time of the build: none.* The legacy route was untouched, and the vNext surface was reachable only from the dev-only `/dev/vnext-championship` harness. **Stage 14 cut this address over** — see §13. The vNext surface serves it in production now, and the legacy route stays mounted behind its `VITE_UI_FOOTBALL_HUB_*` flag so unsetting the flag restores it. |
| `/competitions/:c/:s/leagues` | `SeasonLeaguesRoute` | Private play inside this competition | Contract 191 `get_season_leaderboard`, contract 128 `get_season_league_standings`, contract 150 movement, `get_my_game_leagues` | **Leagues** — one of the four competition-scoped destinations | 9 | **REDESIGN** | **Built in Stage 9** as `src/vnext/leagues/VNextLeagues.tsx`. The merge landed the other way round from the way §2 first read it: this row absorbs `/leagues`, rather than the two merging into something unscoped — because the season table and a private league's table have **two different rank authorities** and neither is a filter of the other. The season table and each private league are SCOPES inside this one surface. See [`vnext-leagues.md`](vnext-leagues.md). *Technical consequence at the time of the build: none.* The legacy route was untouched, and the vNext surface was reachable only from the dev-only `/dev/vnext-leagues` harness. **Stage 14 cut this address over** — see §13. The vNext surface serves it in production now, and the legacy route stays mounted behind its `VITE_UI_FOOTBALL_HUB_*` flag so unsetting the flag restores it. |
| `/competitions/:c/:s/players/:playerId` | `SeasonPlayerProfileRoute` | One player's season | Contract 151 `get_season_player_profile`, contract 192 `get_season_rank_history`, contract 192 `get_season_rivalry` | Player profile, reached from Leagues | 10 | **RETAIN + REDESIGN** | **Built in Stage 10** as `src/vnext/player/VNextPlayerProfile.tsx`. The address shape is KEPT and competition-scoped for the reason it always was: points, rank and prediction history are facts about a player IN a season, and flattening to `/profile/:id` would assert a cross-competition identity ADR 0011 refuses at the data layer. **What changed is the shape of what is behind it.** The page is three reads with THREE DIFFERENT permission boundaries, so a player whose profile is refused can still have a plotted season and a head-to-head — see [`vnext-player-profiles.md`](vnext-player-profiles.md) §2. *Technical consequence at the time of the build: none.* The legacy route was untouched, and the vNext surface was reachable only from the dev-only `/dev/vnext-player` harness. **Stage 14 cut this address over** — see §13. The vNext surface serves it in production now, and the legacy route stays mounted behind its `VITE_UI_FOOTBALL_HUB_*` flag so unsetting the flag restores it. |
| `/competitions/:c/:s/tv` | `SeasonTvModeRoute` | A matchday screen on a wall | `tvModeModel` (`INNOV-006`) | Unchanged, outside the shell | later | **RETAIN** | Already outside the signed-in frame by design. **Stage 8 audited it and decided its relationship rather than rebuilding it:** SHARED DATA CONTRACT eventually (it should consume `MatchState` rather than grow a second one), SEPARATE PRESENTATION MODE, and the redesign DEFERRED to a stage of its own. It must stay shell-less — a room display with a bottom navigation bar is the wrong product. See [`vnext-matches.md`](vnext-matches.md) §12. **Nothing about it changed in Stage 8.** |

## 3. Cross-cutting player and social routes

| Current route | Component / system | User job | Existing product / data authority | Proposed vNext destination | Stage | Fate | Notes |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `/profile` | `PlatformProfilePage` | The player's own platform identity and season history | Contract 156 archive, contract 161 participation history | Account / You | 9+ | **RETAIN + REDESIGN** | Deliberately platform-level and outside the tournament boundary. Keep it that way. |
| `/account` | `AccountPage` | Settings, follow/unfollow, favourite team | Contract 157 `get_my_preferences` | Account / You | 9+ | **RETAIN** | Where a future haptic-feedback preference would live (§9). |
| `/more/scoring` | `ScoringRulesPage` | How does scoring work | `matchweekPointsModel`, ADR 0012 | Reached from a game, not from a directory | 9+ | **ABSORB** | Rules belong beside the game they govern. |
| `/league/:id` | `LeagueDetailRoutePage` | One private league (Euro tournament) | Tournament league authorities | People | **15** | **REDESIGN** | **Deferred by Stage 9, deliberately.** Euro-scoped, and its weekly counterpart is now built — but the tournament league authorities are a different set of reads, and rebuilding them here would be Stage 15's Euro adoption done early and out of order. See [`vnext-leagues.md`](vnext-leagues.md) §14. |
| `/h2h/:rivalId` | `H2HPage` | Compare with one rival | `get_rival_entry`, `get_h2h_rank_history` | Player profile → compare | 10 (weekly) · 15 (Euro) | **ABSORB** | **Settled by Stage 10, and the previous note was wrong.** It read "there is no weekly-season head-to-head read"; there are two — contract 129 `get_season_head_to_head` and contract 192 `get_season_rivalry` — and the second is the one a season comparison must use, because contract 129 is PER-MATCHWEEK and building a season out of it is the "one RPC per matchweek" the Stage 10 predicate forbids. The comparison is now a PANEL inside the player profile rather than a destination, absorbed exactly as this row always said. **The Euro-scoped `/h2h/:rivalId` itself is untouched** and its tournament reads are Stage 15's, for the same reason `/league/:id` is. See [`vnext-player-profiles.md`](vnext-player-profiles.md) §5. *Technical consequence: none.* |
| `/tournament/profile` | `ProfilePage` | The player's own tournament profile | Tournament profile authorities | Merged into the player surface | 9+ | **MERGE** | Three profile systems exist today (platform, tournament, season). vNext must not add a fourth. |
| `/tournament/profile/:playerId` | `OtherPlayerProfilePage` | Another player's tournament profile | `20260728113000_other_player_profiles.sql` | Merged into the player surface | 9+ | **MERGE** | Same. |

## 4. Compatibility, auth, onboarding and administration

| Current route | Component / system | User job | Authority | Proposed vNext destination | Stage | Fate | Notes |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `/fixtures` | `Navigate` → `/matches` | Old address | — | — | — | **REDIRECT** | Already a redirect. Keep. |
| `/league` | `Navigate` → `/leagues` | Old address | — | — | — | **REDIRECT** | Already a redirect. Keep. |
| `/more/points` | `Navigate` → `/profile` | Old address | — | — | — | **REDIRECT** | Already a redirect. Keep. |
| `/admin` | `Navigate` → `/admin/results` | Old address | — | — | — | **REDIRECT** | Keep. |
| `/auth/login` | `LoginPage` | Sign in | Auth | Unchanged | — | **RETAIN** | Out of scope for vNext. |
| `/auth/signup` | `SignUpPage` behind `EuroSignupGate` | Register | Contract 143 publication | Unchanged | — | **RETAIN** | The gate is a route guard and must stay one. |
| `/auth/reset`, `/auth/update-password` | Auth pages | Recover access | Auth | Unchanged | — | **RETAIN** | |
| `/join/:code` | `JoinLandingPage` | Accept an invitation | `joinDestination`, `pendingJoin` | Unchanged address; lands in the chosen IA | 9+ | **RETAIN** | A pending invitation must survive authentication and onboarding — an existing accepted requirement, unchanged. |
| `/welcome` | `WelcomePage` | First sign-in | `RequireWelcome`, contract 157 | Onboarding | 9+ | **REDESIGN** | **Built and routed.** `WelcomePage` runs the four-step `OnboardingJourney` — display name → follow competitions → optional favourite club → games per followed competition → review — resumable from a stored draft. The Stage 7.5 capability audit checked this against the tree; documents still describing `DFA-001`/`DFA-002` as "accepted and unbuilt" are stale, and contract 157 closed the gap that blocked them. REDESIGN is therefore vNext presentation over an existing flow, not a flow to be written. §6 of this matrix's companion audit. |
| `/admin/results` | `AdminResultsWorkspacePage` | Confirm results | Tournament authorities | Unchanged | — | **RETAIN** | Administration is out of vNext scope entirely. |
| `/admin/users` | `AdminUsersPage` | Administer users | — | Unchanged | — | **RETAIN** | |
| `/admin/season` | `SeasonAdminPage` | Administer seasons | Season authorities | Unchanged | — | **RETAIN** | |
| `/admin/euro` | `EuroPublicationPage` | Publish the tournament | Contract 143 | Unchanged | — | **RETAIN** | |
| `/admin/ai` | `AiLabPage` | Private analytical lab | Contract 185, ADR 0029 | Unchanged | — | **RETAIN** | Hub-only and inside the domestic boundary. |
| `*` | `NotFoundPage` | Not found | — | Unchanged | — | **RETAIN** | Every concept still needs a deterministic parent from a not-found. |
| `/dev/**` (21 routes) | Dev harnesses | Real-data review | — | Unchanged | — | **RETAIN** | Behind `import.meta.env.DEV`; eliminated from production builds. Stage 13 adds five (account, games, discovery, invite, onboarding) and the count is corrected with them — it had read 11 since Stage 7.5. |

## 5. Counts

| Fate | Count |
| --- | ---: |
| RETAIN | 19 |
| REDESIGN | 10 |
| ABSORB | 7 |
| MERGE | 3 |
| REDIRECT | 4 |
| HIDE | 4 |
| RETIRE | 0 |

**Stage 10 moved no row and built two.** `/competitions/:c/:s/players/:playerId`
keeps `RETAIN + REDESIGN` and is now BUILT rather than planned; `/h2h/:rivalId`
keeps `ABSORB` and the absorbing surface now exists. **No count changes**, which
is the honest outcome — Stage 10 answered what was behind two rows rather than
changing either row's fate. What it did change is a factual error in the H2H
row's note; see §3.

**Stage 9 moved two rows and built one.** `/leagues` went from `REDESIGN` to
`HIDE / ABSORB`, and `/competitions/:c/:s/leagues` went from `MERGE` to
`REDESIGN` — the merge happened, but into the competition-scoped row rather than
out of it. `MERGE` falls by one and `HIDE` and `ABSORB` each gain one;
`REDESIGN` is unchanged because the two moves cancel. `/league/:id` keeps its
fate and gains a stage.

**Stage 8 moved one row and built two.** `/matches` went from `REDESIGN` to
`HIDE / ABSORB` — it is not redesigned as a page, its job is absorbed into a
secondary scope inside Matches — so `REDESIGN` falls by one while `HIDE` and
`ABSORB` each gain one. The two competition-scoped rows keep their fates and are
now BUILT rather than planned.

Rows carrying two fates (`RETAIN + REDESIGN`, `RETAIN + HIDE`, `HIDE / ABSORB`,
`REDESIGN / MERGE`) are counted under each, so the totals exceed the row count.
**39 distinct routes are accounted for and none is unresolved.**

**RETIRE is zero, and that is a finding rather than an omission.** Nothing in the
current tree turned out to be dead. Everything either survives, is rebuilt, is
absorbed into a surface that does its job better, or is already a redirect. The
things that disappear in vNext disappear from the *navigation*, not from the
*address space* — which is the distinction this whole document exists to hold.

## 6. Resolved by the Stage 7.6 selection

Both rows that depended on the concept selection are now settled. **Every one is
a TARGET IA decision; not one repoints a route.**

1. **`/` versus `/competitions/:c/:s` — MERGE.** The Competition Deck roots
   everything in a football competition, so Home is competition-contextual and
   these are ONE visible destination. `REDESIGN / MERGE` became `MERGE`.
   *Technical consequence: none yet.* Both addresses keep resolving exactly as
   they do today; how `/` chooses a competition is the cutover stage's work.
2. **`/competitions/:c/:s/games` — SURVIVES, as a first-class destination.** It
   is one of the four competition-scoped destinations and the only place where
   the three games are peers. Labelled `Games`, not `Play` — the comparison and
   its repository evidence are in [`vnext-shell-ia.md`](vnext-shell-ia.md) §3.
   *Technical consequence: none yet.* Stage 7.6 builds no page here beyond a
   Storybook navigation stub.

A third row moved with them, though it was never marked open:
**`/play` — HIDE / ABSORB, confirmed.** Its job splits between Home (what needs
doing here) and the shell's secondary attention layer (what needs doing
elsewhere). Neither is a destination.

The rationale for all three is in [`vnext-shell-ia.md`](vnext-shell-ia.md); the
lab that produced the options is [`vnext-ia-lab.md`](vnext-ia-lab.md).

## 7. Resolved by Stage 8

The Matches *system* question — which the rows above deferred to "§7" — is settled.
**Every one is a TARGET IA decision; not one repoints a route.**

1. **`/matches` — HIDE / ABSORB.** A cross-competition calendar is a real job and
   contract 197 was written for it, but it is a **secondary scope inside the
   competition's Matches destination**, never a fifth primary destination and never
   the landing state. *Technical consequence: none yet.*
2. **`/competitions/:c/:s/matches` — REDESIGN, built.** The competition's football,
   competition-scoped first, on contracts 121 and 139.
3. **`/competitions/:c/:s/matches/:fixtureId` — RETAIN + REDESIGN, built.** The
   address shape is kept exactly, because contract 148's fixture-id-alone
   resolution is what makes a Match Centre linkable and refreshable.
4. **`/competitions/:c/:s/tv` — RETAIN, relationship decided, redesign deferred.**

The rationale for all four is in [`vnext-matches.md`](vnext-matches.md).

## 8. Resolved by Stage 9

The people-surface question is settled. **Every one is a TARGET IA decision; not
one repoints a route.**

1. **`/competitions/:c/:s/leagues` — REDESIGN, built.** The people dimension,
   competition-scoped and game-scoped, with the season table and each private
   league as SCOPES inside one surface.
2. **`/leagues` — MERGE became HIDE / ABSORB.** §2 read the merge as "one people
   surface, scoped or unscoped". Stage 9 answers **scoped**, and for a data
   reason rather than a navigation one: a cross-competition people surface would
   rank players across competitions they do not share, which **ADR 0011 refuses
   at the data layer**. There is no read that could supply it honestly and none
   should be built to.
3. **`/league/:id` — REDESIGN, deferred to Stage 15.** Euro-scoped. Its weekly
   counterpart is now built; the tournament one belongs with the rest of the
   Euro adoption rather than being pulled forward.
4. **`/league` — REDIRECT, unchanged.**

Two rows Stage 9 deliberately did **not** move, and the reason matters:
`/competitions/:c/:s/players/:playerId` (`RETAIN + REDESIGN`) and `/h2h/:rivalId`
(`ABSORB`) are **Stage 10's**. Stage 9 builds the doorway to a player and decides
whether it exists; it does not build what is behind it. A stage that redesigned
the profile because it was adjacent is exactly the surface-by-surface drift this
matrix exists to prevent.

The rationale for all four is in [`vnext-leagues.md`](vnext-leagues.md).

## 9. Resolved by Stage 10

The player-surface question is settled. **Both are TARGET IA decisions; neither
repoints a route.**

1. **`/competitions/:c/:s/players/:playerId` — RETAIN + REDESIGN, built.** The
   address shape is kept and stays competition-scoped. What Stage 10 settled is
   what is behind it: three reads with three different permission boundaries,
   drawn as three independent panels, because a page with one permission flag
   cannot express "you may plot this player and compare with them, and you may
   not open their season" — which is the ordinary state for two entrants who
   share a competition and no private league.
2. **`/h2h/:rivalId` — ABSORB, and the row's note corrected.** It claimed there
   is no weekly-season head-to-head read. There are two, and choosing between
   them was the stage's architectural decision: contract 129 is per-matchweek,
   so contract 192's `get_season_rivalry` is the bounded season answer the
   predicate requires. The comparison is a panel inside the profile. The
   Euro-scoped route is untouched and its tournament reads are Stage 15's.

Two rows Stage 10 deliberately did **not** move: `/tournament/profile` and
`/tournament/profile/:playerId` (`MERGE`). They are the tournament profile
system, and merging them into the season surface would be Stage 15's Euro
adoption pulled forward and out of order — the same reasoning Stage 9 applied to
`/league/:id`.

The rationale for both is in
[`vnext-player-profiles.md`](vnext-player-profiles.md).

---

## 10. Resolved by Stage 11

The Last Man Standing row is built, and the audit behind it changed two things
this matrix had recorded.

1. **`/competitions/:c/:s/games/lms` — REDESIGN, built.** The address is
   unchanged. What Stage 11 settled is that this is a **first-class game**
   rather than a Match Predictor reskin: no numeric input exists anywhere in the
   lane, a fixture appears only as the two clubs it offers, and the page's own
   headline is the player's standing rather than a total.

2. **The row's data authority column was incomplete, and the gap mattered.** It
   named `lmsRoundModel`, `lmsRefusal` and `lmsStakeModel`. The read that
   supplies the **pool and the lock** — contract 164 `get_season_lms_field` —
   was not listed, and I had begun the stage on the assumption it did not exist.
   Reading the migrations rather than the decoders corrected that. It supplies
   three things contract 116 does not carry at all:

   - `field.remaining` — "83 still in", the atmosphere of a survival round;
   - `rules.draws_rule` — the stored rule `lmsRoundModel.ts` says it "cannot
     see". This lane may now STATE it and still never apply it;
   - `round.revealed` — `locks_at <= now()` evaluated **by the database**, which
     turns the lock from a presentation judgement into the server's answer.

3. **`/competitions/:c/:s/games/championship/*` is next**, and its stage number
   in §2 reads "11 (to be scheduled)" against a programme in which it is
   **Stage 12**. That is a stale number rather than a decision, and Stage 12
   will correct the row when it builds it.

Three things Stage 11 deliberately did **not** take on, each because no
authority supplies them: a per-round survival history (contract 116 returns one
round by design, and one call per round is an N+1 this lane refuses), a private
LMS league container (no contract scopes an LMS field to one), and entry into
the game (Stage 11 does not own registration, so the surface offers no join
button — a control there would be a door onto a corridor that has not been
built).

The rationale for all of it is in [`vnext-lms.md`](vnext-lms.md).

---

## 11. Resolved by Stage 12

1. **`/competitions/:c/:s/games/championship/*` — REDESIGN, and FOUR ADDRESSES
   BECOME TWO.** The decision came from the reads: production's three instance
   modes are three arrangements of one payload, so they are sections of one
   phase-aware page; the index has its own read and keeps its address. The row's
   stale stage number is corrected in the same edit.

2. **The row's data-authority column was incomplete in a way that mattered.** It
   named `championshipStandingModel` and `cupPhaseModel` — two presentation
   models — and no contract at all. The canonical player-facing read, contract
   193 `get_season_cup_bracket`, **had never been called by any application
   code**, and would have gone on not being called if the matrix had been
   trusted. It is now named, along with the group-stage reads and the Penalty
   Number write.

3. **Two defects were found in that read by being its first consumer**, and they
   are recorded rather than absorbed:

   - it **raised an exception** for every entrant in a Championship that had
     split, because its seed lookup did not name a membership phase. Fixed as
     **contract 205**, reproduced on a scratch PostgreSQL 16 first;
   - it uses `stage <> 'group'` in four places where its sibling contracts use
     the narrow form and contract 194 *asserts against* the broad one, so a
     split competition would be offered a league fixture as a knockout tie. The
     decoder filters it, and says in the code that it is a workaround.

4. **One predicate item the current backend cannot satisfy.** No season
   Championship read returns a canonical `eliminated` fact. The surface states
   what an authority states and stays silent otherwise — it never derives
   elimination from a lost tie — and that truthful asymmetry is recorded as a
   **backend delta owed before Stage 12 is complete**, not as a reason to
   reinterpret the requirement. See [`vnext-championship.md`](vnext-championship.md) §6.

The rationale for all of it is in [`vnext-championship.md`](vnext-championship.md).

---

## 12. Resolved by Stage 13

The supporting surfaces around the games. The full derivation — including the
check that no user-facing route is missing from this matrix — is in
[`vnext-supporting-surfaces.md`](vnext-supporting-surfaces.md).

1. **`/account`, `/profile`, `/more` — RETAIN, REDESIGN, ABSORB, all three
   built as one platform-scoped surface.** The finding that ordered the stage
   was not a missing page: `VNextShell` emits a `kind: 'account'` intent from
   two places, showing the signed-in player's own name, and **no vNext surface
   answered it** — so in every surface Stages 8–12 built, pressing your own name
   dropped you out of vNext into the production visual system. The escape hatch
   worked, which is why it went unnoticed.

2. **`/competitions/:c/:s/games` — REDESIGN, built as the peer hub.** Every game
   is the same size at every width, and the only grouping is whether the PLAYER
   is in one. **No rejoin control exists in any world**, including the ones
   where a rejoin would certainly succeed: `allow_rejoin` bites only once a
   competition is running, and `competition_is_running` is revoked from
   `authenticated`, so no browser can learn the fact a rejoin control would have
   to assume.

3. **`/more/scoring` — ABSORB, and it is a control rather than a page.** The
   three games' rules sit beside the games, one game at a time behind a
   segmented control, with the numbers imported from `src/domain/season/scoring.ts`
   rather than retyped.

4. **`/welcome` — REDESIGN, and the row's own scoping was the right one.** vNext
   presentation over the existing journey: same four steps, same resume from
   contract 157. **The commit was deliberately not written a second time** —
   `OnboardingJourney` owns the only copy of the follows/entries/completion
   order, so the vNext screen writes nothing and hands `finish` to its host.

5. **`/tournament/profile` and `/tournament/profile/:playerId` — MERGE, and
   still not performed.** §9's reasoning stands unchanged: performing the merge
   is Stage 15's Euro adoption. Stage 13 records the fate rather than executing
   it, which is what its predicate asks for.

6. **`…/games/match-predictor/standings` — ABSORB, and now genuinely absorbed.**
   Nothing in Stage 13 was needed for it; the row is discharged by Stage 9's
   league table and Stage 10's player surface, and this is recorded so the row
   is not mistaken for outstanding work.

## 13. Resolved by Stage 14 — the cutover, ON

Stage 14 is where this matrix stopped being a plan. Every row above had a decided
**fate** and, until this stage, not one of them had a decided **production
behaviour**. The two are not the same thing, and the gap between them was the
whole stage: thirteen vNext surfaces existed, every one reachable only from a
`/dev/**` harness, while all 41 non-dev routes served the component they had
served since before the programme began.

**That gap is now closed and the flags are ON.** This section is written in the
order it happened — the Matches pair first, then the other nine — because the
sequence is the evidence that the switch works in both positions, and a reader
arriving after a rollback needs the OFF half to still be here.

> **What a route matrix cannot see, found 23 August 2026 and now guarded.**
> This document owns route fate, and route fate is not the whole of a cutover.
> `vNextOwnsFrame` makes `AppShell` render no `AppBar` on a Hub destination, and
> the AppBar was the only way into the legacy Action Centre — so
> `get_my_actions` went unreachable from the production frame for a whole stage
> while its generators and its `pg_cron` caller kept filling the table, and
> `MIG-UI-14` stayed marked *Implemented* because the claim had been true when
> it was written. **No row here could have caught it: the Action Centre was
> never a route.** `tests/app/vnextChromeParity.test.ts` is the guard that can —
> it reads `AppBarProps` out of the source and requires every affordance the
> legacy chrome offers to be answered in the vNext frame or dropped on purpose.
> **Stage 15 is the same cutover shape against the Euro frame**, which is why
> this is recorded here rather than left in a pull request.

### What landed first, and why this pair

`/competitions/:c/:s/matches` and `/competitions/:c/:s/matches/:fixtureId` are
the first routes to get an intentional production behaviour. They were chosen
because they exercise **both directions** of the adapter a cutover needs, and
the smallest pair that does:

- **inward** — a route supplies the competition and season from `useParams`,
  where the harness supplied them from a form, and has to behave when they are
  absent;
- **outward** — an `openMatch` intent must become a URL. The harness swapped a
  piece of local state, which is exactly what makes it a harness: a destination
  a player cannot link to, share or press *back* out of is not a destination.

Contract 148 makes the outward half honest. The fixture id alone resolves the
match, so the address carries no `?on=` window, and a deep link survives a
refresh and a share. That property was asserted in Stage 8 and is now an
address.

### The switch, and the fact that it is now ON

`src/app/routeFlags.ts` gains `footballHubMatches`, reading
`VITE_UI_FOOTBALL_HUB_MATCHES`. **It shipped unset, and unset means legacy** —
`enabled()` matches the exact string `'true'` and nothing else, so an empty
value, a misspelling, `TRUE` and `1` all select the legacy route. For the life of
that first change, a player's Matches route was the same `SeasonMatchesRoute` it
had always been.

That was not caution for its own sake. The Stage 14 contract separates **READY
FOR CUTOVER**, which autonomous engineering may reach, from **CUT OVER AND
VERIFIED**, which requires explicit authority for the exact action. Building the
switch is the first; throwing it is the second, and the two were kept apart
until the authority existed.

**The authority was given and the switch has been thrown.**
`config/vnext-programme.json` now carries `productionCutoverAuthorized: true`,
and `netlify.toml` sets all ten flags in `[build.environment]`. The fail-closed
reading has not changed and is now the rollback rather than the default:
removing one line from `netlify.toml` restores that one journey on the next
deploy, with no migration and no data rollback.

`NOW.md` is generated from the machine records and states the live position of
every flag. **Read it there** — this page deliberately does not keep its own
copy of a value that moves, for the same reason
[`vnext-cutover-capability-parity.md`](vnext-cutover-capability-parity.md)
stopped keeping one.

### One flag per destination, not one for the hub

The stage contract asks for a *staged deployment/rollback plan*. A single
hub-wide switch is neither: it cannot be advanced one surface at a time, and
rolling it back withdraws the surfaces that were fine along with the one that
was not.

### The legacy pair stays mounted, and a test says so

`SeasonMatchesRoute` and `SeasonMatchCentreRoute` are untouched, still mounted
on the off branch of the flag and still passing their own tests. Nothing was
deleted to make room, which is precisely what makes the flag a rollback rather
than a gesture. The contract's *"deleting recoverable legacy code before rollback safety
is proven"* is listed under what Stage 14 does **not** own, and retirement stays
a later, separately gated act.

`tests/vnext/vnextCutoverRouting.test.tsx` asserts the off branch **first**,
because that is the state this ships in — a test that proves only the on branch
proves the feature and not the release gate. It also reads `App.tsx` directly to
confirm both routes actually consult the flag and that both legacy elements are
still routed, because a route that forgot to ask renders legacy for ever and is
indistinguishable from a correctly-off flag.

### The production boundary, narrowed rather than flipped

`tests/vnext/vnextProductionBoundary.test.ts` asserted that **no** vNext module
is reachable from `src/main.tsx`. Wiring a vNext surface to a real route breaks
that by construction, and this programme's rule is explicit: *never flip a guard
merely to keep the loop moving.* So it was not flipped.

Read what the guard says it protects against: *"one import added from a
production surface because a component looked reusable … while looking like an
ordinary refactor."* **That is an accident.** A cutover is its opposite —
deliberate, contracted, flag-gated, and argued for here. The guard was written
for a lane that had no sanctioned door, and Stage 14 is the stage that builds
one. A guard that must be DELETED the first time the programme reaches its own
stated goal was never protecting anything.

It is narrowed, exactly as this suite was narrowed once before: Stage 6 turned a
blanket ban into a directional rule when `integration/` legitimately needed the
application. `src/app/vnext/` is now stopped at, precisely as `src/dev/` already
was, and **the original assertion is then made verbatim against the whole rest
of the tree** — any accidental import from anywhere else still fails it.

Three new cases prove the door is a door and not a hole:

1. **vNext is reachable through the seam and nowhere else.** Production is
   walked *without* stopping at the seam, then everything the seam legitimately
   pulls in is subtracted; anything left is a second route in, and fails.
2. **The seam is entered lazily.** A static import would put vNext in the entry
   chunk — measured below — so `lazy()` is load-bearing rather than tidy.
3. **Every seam route is gated by a rollback flag.** An adapter mounted
   unconditionally is a cutover, not a switch.

All three are mutation-proved: an accidental `VNextRoot` import from
`src/app/Providers.tsx` fails (1), converting the lazy wrapper to a static
import fails (2), and dropping the flag from a route fails (3).

### The kickoff formatter, which the cutover exposed

Wiring the routes also tripped `tests/app/kickoffFormattingAuthority.test.ts`,
and this one was not a boundary question — it was a **defect that had been true
and invisible for six stages**.

`src/vnext/foundations/format.ts` built its own `Intl.DateTimeFormat` pinned to
`en-GB` / `Europe/London`. That is right for a workshop: a story must render
17:30 on a laptop and 17:30 in CI or a screenshot comparison is worthless. The
file said so itself, and said what it cost — *"the pinned zone is a workshop
decision, not a product one; real integration will use the user's zone."*

Stage 14 is real integration. Shipped as it stood, **Matches — a surface that is
almost entirely kickoff times — would have told a player in Dublin, New York or
Sydney what time the match starts in London.** The guard caught it the instant a
vNext module entered the shipping graph, which is the only moment it could have.

The owner's 10 August 2026 direction, which that guard enforces, asks for two
things: kickoffs in the viewer's own device zone, **and one shared helper**
across Matches, the Match Predictor, LMS, the Championship and the Match Centre.
vNext's formatter was a sixth local copy of exactly the kind that once left five
implementations disagreeing about whose zone a kickoff belongs to. So it is not
an `ALLOWED` entry, and it was not given one.

**vNext now delegates.** `formatTime`, `formatDayKey`, `formatDayHeading` and
the weekday inside `formatKickoffLabel` call `src/shared/time/kickoff.ts`. The
options already matched where the authority had an equivalent — `hourCycle: 'h23'`
is vNext's `hour12: false`, and the day key was `en-CA` in both — so the visible
output is unchanged and all 2015 vNext tests pass untouched. The two forms the
authority lacked, an abbreviated weekday and a short-weekday day heading, were
added **to the authority** rather than kept locally.

Which zone is still vNext's choice, and it defaults to the workshop pin:
`configureVNextTimeZone` is called only from `src/app/vnext/`, so stories and
jsdom tests stay deterministic and production gets `viewerTimeZone()`.

### Bundle cost, measured — and then removed entirely

The predicate asks that bundle regression be *acceptable*. It turns out the
repository already enforces that: `scripts/check-bundle-budget.mjs` runs in CI
as **Compressed bundle budgets**, and the first two drafts of this change failed
it. Three ratchets, all breached:

| budget | `main` | static import | lazy import | limit |
| --- | ---: | ---: | ---: | ---: |
| largest JS chunk | 73.2 KB gz | 133.3 | 79.8 | 77 |
| all JS | 354.0 KB gz | — | 411.2 | 366 |
| all CSS | 42.5 KB gz | — | 49.1 | 44 |

**Lazy loading was not enough, and the CSS row is why.** `vite.config.ts` sets
`cssCodeSplit: false` deliberately — collapsing 39 per-route stylesheets into
one *saved* 15 KB, because per-file gzip overhead cost more than the content —
so there is exactly one stylesheet and **every visitor downloads it**. A lazy
chunk defers the JavaScript and not the styles. With the flag off and nobody
able to see a vNext surface, every visitor would still have paid 6.6 KB gz for
its design language.

The budget file also already explained the entry-chunk residue this section
previously recorded as unexplained: *"splitting a route out of this bundle
hoists the modules it shares with the rest into the entry chunk, so the chunk
grows while total JavaScript barely moves."*

**The fix is to make the off branch cost nothing at all, which it now does.**
`VITE_*` values are build-time literals in Vite, so `src/App.tsx` gates the
lazy import on `import.meta.env.VITE_UI_FOOTBALL_HUB_MATCHES === 'true'`
inline. The branch folds, Rollup drops the whole subtree — JavaScript and CSS
— and with the flag off the bundle measures **73.2 / 354.0 / 42.5: byte-identical
to `main`**.

That upgrades the rollback promise from a claim about behaviour to one about
bytes. A build with this flag off is the build that shipped yesterday.

**It has to be inline.** Re-exporting the same comparison as a `const` from
`routeFlags.ts` was tried and does **not** fold across the module boundary — the
import survives and every byte comes back. The duplication is a bundler
constraint, not a preference, and
`tests/vnext/vnextCutoverRouting.test.tsx` pins the two readings to the same
variable and the same string so they cannot drift.

**With the flag ON the budgets fail, and that is left standing on purpose.**
Turning the flag on is the production mutation this stage gates behind explicit
authority. The ratchet failing at that moment is the correct behaviour: it
forces the real cost of shipping two design languages to be confronted *when
someone decides to ship it*, with a measurement in hand, rather than smuggled in
now while no player can see the benefit.

### The rest of the cutover, and the switch in its ON position

**Nine destinations, nine flags, and every legacy element still mounted.** The
Matches pair proved the shape; the rest follow it exactly. `src/app/vnext/` now
carries `VNextMatchesDestination.tsx`, `VNextHubDestinations.tsx` and the shared
`seam.tsx`, and `src/App.tsx` selects between each vNext element and the legacy
one it replaces:

| Address | Legacy element | vNext element | Flag |
| --- | --- | --- | --- |
| `/competitions/:c/:s` | `CompetitionDashboardPage` | `VNextHomeDestination` | `VITE_UI_FOOTBALL_HUB_HOME` |
| `…/matches` and `…/matches/:fixtureId` | `SeasonMatchesRoute`, `SeasonMatchCentreRoute` | `VNextMatchesDestination`, `VNextMatchCentreDestination` | `VITE_UI_FOOTBALL_HUB_MATCHES` |
| `…/games` | `CompetitionGamesPage` | `VNextGamesDestination` | `VITE_UI_FOOTBALL_HUB_GAMES` |
| `…/leagues` | `SeasonLeaguesRoute` | `VNextLeaguesDestination` | `VITE_UI_FOOTBALL_HUB_LEAGUES` |
| `…/players/:playerId` | `SeasonPlayerProfileRoute` | `VNextPlayerProfileDestination` | `VITE_UI_FOOTBALL_HUB_PLAYER_PROFILE` |
| `…/games/lms` | `SeasonLmsRoute` | `VNextLmsDestination` | `VITE_UI_FOOTBALL_HUB_LMS` |
| `…/games/championship/*` | `SeasonChampionshipRouter` | `VNextChampionshipDestination` | `VITE_UI_FOOTBALL_HUB_CHAMPIONSHIP` |
| `/competitions` | `ExploreCompetitionsPage` | `VNextDiscoveryDestination` | `VITE_UI_FOOTBALL_HUB_DISCOVERY` |
| `/account` | `AccountPage` | `VNextAccountDestination` | `VITE_UI_FOOTBALL_HUB_ACCOUNT` |

**The Match Predictor is the tenth and it already had a flag.**
`VITE_UI_SEASON_MATCH_PREDICTOR` predates Stage 14 and moves to
`[build.environment]` with the rest.

**`/` IS UNTOUCHED, AND THAT IS THE MATRIX'S OWN DECISION.** §1 says the address
may keep resolving to whatever the player's active competition is and that
*"deciding how is the cutover stage's work"*. The decision taken is to leave it:
`HomeDestination` still dispatches by site variant to the Hub page, which is the
surface a player with NO competition needs, and a player who has one reaches
vNext Home the moment they open it. Making `/` redirect would change what a
signed-in player sees at the root and is a product decision this stage has no
authority for.

### The attention layer is supplied, closing the seam this section named

The Matches change recorded a follow-up: the adapter *"does not yet SUPPLY the
attention, so until the seam is closed the production Matches route would show a
player nothing about the competitions they are not looking at."*

`VNextSeamLayout` is that closure. It is a LAYOUT ROUTE inside `RequireWelcome`
and outside `AppShell`, so `VNextShellElsewhereHost` mounts once above every
signed-in route and survives every destination change — which is what
`useVNextShellElsewhere` requires of a host in terms, because the inbox costs a
play-context read plus up to three game reads per competition.

### The shell navigates now

`useShellIntentNavigation` answered only Matches and deliberately dropped the
other three, because routing them would have dropped a player into a legacy page
mid-journey. All four are vNext, so all four are answered — and `context`, `game`
and `league` intents resolve their competition through the player's own list
rather than through a template string, so an intent naming a competition the
player is not in navigates nowhere instead of to a 404.

### What this does not yet do

Still outstanding, and named rather than implied: authenticated performance and
perceived-performance measurement at the real routes against a real database;
monitoring and alerting for the new surfaces; and `UX-007`, the suspected
focus-obscured exposure behind the sticky masthead, which becomes exercisable
now that the shell is the production frame and should be the first thing the
next session looks at.

**The `/play` attention layer is NOT on that list, and an earlier draft of this
section wrongly put it there.** It is built in PR #930, on
`claude/vnext-precutover-gaps-fdxai5`, by another session:
`buildShellAttention.ts`, `useVNextShellElsewhere.ts`,
`VNextShellElsewhereHost.tsx` and a `buildShellModel` that accepts several
contexts. Recording it as outstanding here would have invited a second
implementation of a surface that already exists — the precise duplication this
matrix is supposed to prevent.

### The one seam between this change and PR #930

They do not overlap in code — #930's `src/App.tsx` edit is confined to the
`/dev/**` harness routes and this one is in the competition-scoped table — but
they meet at a real seam, and whichever lands second owns closing it.

#930 adds an **optional** `shellElsewhere` prop to `VNextMatchesScreen` and
`VNextMatchCentreScreen`, and says of the acquisition that *"the expensive
acquisition is meant to be mounted once above page navigation, which is the
host's job and is not claimed here."*

`src/app/vnext/VNextMatchesDestination.tsx` is the first real host. Because the
prop is optional, nothing breaks in either merge order: this adapter compiles
and runs against #930's screens untouched. What it does not yet do is SUPPLY the
attention, so until the seam is closed the production Matches route would show a
player nothing about the competitions they are not looking at. That is a
follow-up with a named owner, not a defect in either branch.

*Fate counts are unchanged.* Stage 14 moves no row — it implements them.
