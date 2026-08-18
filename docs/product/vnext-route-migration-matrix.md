# vNext route migration matrix

**Status:** Stage 7.5 deliverable — an accounting device, not a design.
**Scope:** every user-facing route registered in `src/App.tsx`, plus the two compatibility redirects and the dev-only harnesses.
**Does not govern:** any route in production. Nothing here repoints a route, changes a guard or alters Netlify behaviour.
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

---

## 1. Global signed-in destinations

| Current route | Component / system | User job | Existing product / data authority | Proposed vNext destination | Stage | Fate | Notes |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `/` | `HubPage` via `HomeDestination` | "What should I care about right now?" | Contract 151/150 recap, `sinceLastVisitModel`, `briefingModel` | **Home, of the ACTIVE COMPETITION** | 6 (done) · cutover later | **REDESIGN + MERGE** | **RESOLVED, Stage 7.6.** Under the Competition Deck, Home is competition-contextual: it is the home of the competition you are in, not of the platform. `/` and `/competitions/:c/:s` are ONE visible destination in the target IA. **The address is untouched** — `/` may keep resolving to whatever the player's active competition is, and deciding how is the cutover stage's work. Gold Standard Home itself is unchanged; only what surrounds it changed. |
| `/play` | `GlobalPlayPage` | Cross-competition action inbox | `playInboxModel`, `useGlobalPlayInbox` | **Absorbed: into Home for this competition, and into the attention layer for the others** | 8+ | **HIDE / ABSORB** | **RESOLVED, Stage 7.6.** The job splits in two and both halves have a home: what needs doing HERE is Home's, and what needs doing ELSEWHERE is the shell's secondary attention layer. Neither is a destination. **The word `Play` therefore leaves the navigation entirely**, which is one of the reasons the game catalogue is not renamed to it. The address can remain. |
| `/matches` | `GlobalMatchesPage` | One chronological calendar across the player's competitions | `combinedFixturesModel` | **ABSORBED into the competition's Matches destination, as a SECONDARY SCOPE.** Not a destination of its own | 8 | **HIDE / ABSORB** | **Settled by Stage 8.** The job is real and is kept — a player in three competitions may want tonight's football across them, and contract 197 was written for exactly that — but it is a two-option control *inside* Matches, never a fifth primary destination and never the landing state. Every fixture in that mode names its competition. See [`vnext-matches.md`](vnext-matches.md) §4. *Technical consequence: none.* The address keeps resolving as it does today. |
| `/leagues` | `GlobalLeaguesPage` | All private play across every competition and game | `privatePlayModel`, `gameLeaguesModel` | The people dimension: Concept A "Leagues", Concept B "People", Concept C the command surface | 9+ | **REDESIGN** | Naming a league's game and competition on its card is a requirement in all three concepts, not a nicety. |
| `/more` | `MorePage` | Account/help/settings directory | — | Absorbed into the account surface | 9+ | **ABSORB** | A directory page is a symptom of a navigation that ran out of slots. None of the three concepts has a "More". |
| `/competitions` | `ExploreCompetitionsPage` | Deliberate discovery over the whole published catalogue | Contract 147 `get_published_weekly_seasons`, contract 157 follow | Discovery: a sheet (A), a filter overflow (B), the command surface (C) | 7.5 (prototyped) | **RETAIN + HIDE** | Already correctly outside permanent navigation. All three concepts keep the address and change how it is reached. |

## 2. Competition-scoped routes

| Current route | Component / system | User job | Existing product / data authority | Proposed vNext destination | Stage | Fate | Notes |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `/competitions/:c/:s` | `CompetitionDashboardPage` | The competition's own front door | `useHubCompetition`, `competitionWeekModel` | **This IS Home** | 8+ | **MERGE** | **RESOLVED, Stage 7.6.** The concept-defining row, and Concept A won it: this and `/` are the same surface with a different competition in context. A competition dashboard that is separate from Home is the old structure — two front doors, one per scope. **No redirect is added in this stage**; both addresses keep working and the merge is a visible-destination decision. |
| `/competitions/:c/:s/play` | `SeasonPlayRoute` | Competition-scoped action list | `seasonPlayContextModel` | Absorbed into Home or the queue | 8+ | **ABSORB** | Same argument as `/play`, one level down. Two "what needs doing" surfaces at two scopes is one too many. |
| `/competitions/:c/:s/matches` | `SeasonMatchesRoute` | The competition's football | `fixtureListModel`, `useSeasonFixtureWindow` | **Matches** — one of the four competition-scoped destinations | 8 | **REDESIGN** | **Built in Stage 8** as `src/vnext/matches/VNextMatches.tsx`, on contracts 121 and 139. *Technical consequence: none.* The legacy route is untouched; the vNext surface is reachable only from the dev-only `/dev/vnext-matches` harness until the cutover stage. |
| `/competitions/:c/:s/matches/:fixtureId` | `SeasonMatchCentreRoute` | One fixture in full | Contract 148 `get_season_fixture`, `matchCentreModel` | **Match Centre**, reached from Matches | 8 | **RETAIN + REDESIGN** | **Built in Stage 8** as `src/vnext/matches/VNextMatchCentre.tsx`. The address shape is KEPT unchanged, because the addressability is the strength: contract 148 resolves the fixture from its id alone, so a deep refresh and a shared link both work with no date hint and no window. *Technical consequence: none.* |
| `/competitions/:c/:s/games` | `CompetitionGamesPage` | The game catalogue and the player's memberships | `get_competition_games` | **`Games` — a first-class permanent destination** | 9+ | **REDESIGN** | **RESOLVED, Stage 7.6: it survives, and it is one of the four.** The only surface where Match Predictor, Last Man Standing and the Predictor Championship are PEERS, which is the thing that stopped LMS being "another little tab". Labelled `Games` and not `Play` — see [`vnext-shell-ia.md`](vnext-shell-ia.md) §3. Stage 7.6 builds no page here beyond a Storybook navigation stub. |
| `/competitions/:c/:s/games/match-predictor` | `SeasonMatchPredictorRoute` | Predict the matchweek | Contract 113 card, `useSeasonMatchPredictor` | Match Predictor | 7 (done) | **REDESIGN** | Accepted and unchanged by Stage 7.5. Used here as a real arrival test for each concept. |
| `…/games/match-predictor/standings` | `SeasonStandingsRoute` | How am I doing against the field | Contract 95 season leaderboard | The people dimension | 9+ | **ABSORB** | A game's standings and a private league's table answer the same question at two scopes. See the identity gap in §5 — this is the surface that cannot link a player. |
| `/competitions/:c/:s/games/lms` | `SeasonLmsRoute` | Survive the round | `lmsRoundModel`, `lmsRefusal`, `lmsStakeModel`, contracts for pick/settlement | Last Man Standing | **10 (to be scheduled)** | **REDESIGN** | §6. The row this matrix exists for. |
| `/competitions/:c/:s/games/championship/*` | `SeasonChampionshipRouter` | A season-long fixture list against named opponents | `championshipStandingModel`, `cupPhaseModel` | Predictor Championship | **11 (to be scheduled)** | **REDESIGN** | A nested system, not a page — index, instance, table and fixtures. §8. |
| `/competitions/:c/:s/leagues` | `SeasonLeaguesRoute` | Private play inside this competition | `gameLeaguesModel`, `leagueStandingsModel` | The people dimension | 9+ | **MERGE** | Merges with `/leagues`: one people surface, scoped or unscoped, rather than two that differ only by filter. |
| `/competitions/:c/:s/players/:playerId` | `SeasonPlayerProfileRoute` | One player's season | Contract 151 `get_season_player_profile` | Player profile | 9+ | **RETAIN + REDESIGN** | Competition-scoped for a real reason: points, rank and prediction history are facts about a player IN a season. Do not flatten to `/profile/:id`. |
| `/competitions/:c/:s/tv` | `SeasonTvModeRoute` | A matchday screen on a wall | `tvModeModel` (`INNOV-006`) | Unchanged, outside the shell | later | **RETAIN** | Already outside the signed-in frame by design. **Stage 8 audited it and decided its relationship rather than rebuilding it:** SHARED DATA CONTRACT eventually (it should consume `MatchState` rather than grow a second one), SEPARATE PRESENTATION MODE, and the redesign DEFERRED to a stage of its own. It must stay shell-less — a room display with a bottom navigation bar is the wrong product. See [`vnext-matches.md`](vnext-matches.md) §12. **Nothing about it changed in Stage 8.** |

## 3. Cross-cutting player and social routes

| Current route | Component / system | User job | Existing product / data authority | Proposed vNext destination | Stage | Fate | Notes |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `/profile` | `PlatformProfilePage` | The player's own platform identity and season history | Contract 156 archive, contract 161 participation history | Account / You | 9+ | **RETAIN + REDESIGN** | Deliberately platform-level and outside the tournament boundary. Keep it that way. |
| `/account` | `AccountPage` | Settings, follow/unfollow, favourite team | Contract 157 `get_my_preferences` | Account / You | 9+ | **RETAIN** | Where a future haptic-feedback preference would live (§9). |
| `/more/scoring` | `ScoringRulesPage` | How does scoring work | `matchweekPointsModel`, ADR 0012 | Reached from a game, not from a directory | 9+ | **ABSORB** | Rules belong beside the game they govern. |
| `/league/:id` | `LeagueDetailRoutePage` | One private league (Euro tournament) | Tournament league authorities | People | 9+ | **REDESIGN** | Euro-scoped; the weekly counterpart is `…/leagues`. |
| `/h2h/:rivalId` | `H2HPage` | Compare with one rival | `get_rival_entry`, `get_h2h_rank_history` | Player profile → compare | 9+ | **ABSORB** | **Tournament only.** There is no weekly-season head-to-head read. See §5. |
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
| `/dev/**` (11 routes) | Dev harnesses | Real-data review | — | Unchanged | — | **RETAIN** | Behind `import.meta.env.DEV`; eliminated from production builds. Stage 7.5 adds none — the IA lab is fixture-only and reviewed in Storybook. |

## 5. Counts

| Fate | Count |
| --- | ---: |
| RETAIN | 19 |
| REDESIGN | 10 |
| ABSORB | 6 |
| MERGE | 4 |
| REDIRECT | 4 |
| HIDE | 3 |
| RETIRE | 0 |

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
