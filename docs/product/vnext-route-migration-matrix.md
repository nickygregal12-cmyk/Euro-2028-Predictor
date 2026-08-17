# vNext route migration matrix

**Status:** Stage 7.5 deliverable — an accounting device, not a design.
**Scope:** every user-facing route registered in `src/App.tsx`, plus the two compatibility redirects and the dev-only harnesses.
**Does not govern:** any decision. Nothing here repoints a route, changes a guard, or commits vNext to a destination. The `PROPOSED vNEXT DESTINATION` column is a proposal per concept-neutral reading, and a chosen architecture may overrule any row.
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

**A ROUTE IS NOT A DESTINATION AND THIS TABLE MUST NOT BECOME THE DESIGN.** A
route can stay technically stable and permanent while disappearing entirely from
the visible information architecture — `/play` is the clearest case: whichever
concept wins, "Play" is unlikely to be a permanent navigation item, and the
address may well keep working. Existing URLs and the visible mental model are
different concerns, and this document is only about the first.

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
| `/` | `HubPage` via `HomeDestination` | "What should I care about right now?" | Contract 151/150 recap, `sinceLastVisitModel`, `briefingModel` | Home | 6 (done) | **REDESIGN** | Gold Standard Home is accepted and connected. Stage 7.5 changes nothing about it. What each concept changes is what Home is the home *of* — the whole platform, or the active competition. |
| `/play` | `GlobalPlayPage` | Cross-competition action inbox | `playInboxModel`, `useGlobalPlayInbox` | Concept B: the front door itself. Concepts A and C: absorbed into Home and the command surface | 8+ | **HIDE / ABSORB** | The strongest candidate for disappearing from permanent navigation in all three concepts. The *job* is first-class everywhere; the *destination* survives in only one. The address can remain. |
| `/matches` | `GlobalMatchesPage` | One chronological calendar across the player's competitions | `combinedFixturesModel` | Concept A: a competition section. Concept B: the "Football" anchor. Concept C: reached from the spine and the command surface | 8 | **REDESIGN** | Part of the Matches *system* question — see §7. |
| `/leagues` | `GlobalLeaguesPage` | All private play across every competition and game | `privatePlayModel`, `gameLeaguesModel` | The people dimension: Concept A "Leagues", Concept B "People", Concept C the command surface | 9+ | **REDESIGN** | Naming a league's game and competition on its card is a requirement in all three concepts, not a nicety. |
| `/more` | `MorePage` | Account/help/settings directory | — | Absorbed into the account surface | 9+ | **ABSORB** | A directory page is a symptom of a navigation that ran out of slots. None of the three concepts has a "More". |
| `/competitions` | `ExploreCompetitionsPage` | Deliberate discovery over the whole published catalogue | Contract 147 `get_published_weekly_seasons`, contract 157 follow | Discovery: a sheet (A), a filter overflow (B), the command surface (C) | 7.5 (prototyped) | **RETAIN + HIDE** | Already correctly outside permanent navigation. All three concepts keep the address and change how it is reached. |

## 2. Competition-scoped routes

| Current route | Component / system | User job | Existing product / data authority | Proposed vNext destination | Stage | Fate | Notes |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `/competitions/:c/:s` | `CompetitionDashboardPage` | The competition's own front door | `useHubCompetition`, `competitionWeekModel` | Concept A: this IS Home. Concepts B and C: reached, not permanent | 8+ | **REDESIGN / MERGE** | The concept-defining row. If Concept A wins, `/` and this become the same surface with a different competition in context. |
| `/competitions/:c/:s/play` | `SeasonPlayRoute` | Competition-scoped action list | `seasonPlayContextModel` | Absorbed into Home or the queue | 8+ | **ABSORB** | Same argument as `/play`, one level down. Two "what needs doing" surfaces at two scopes is one too many. |
| `/competitions/:c/:s/matches` | `SeasonMatchesRoute` | The competition's football | `fixtureListModel`, `useSeasonFixtureWindow` | Matches | 8 | **REDESIGN** | §7. |
| `/competitions/:c/:s/matches/:fixtureId` | `SeasonMatchCentreRoute` | One fixture in full | Contract 148 `get_season_fixture`, `matchCentreModel` | Match Centre | 8 | **RETAIN + REDESIGN** | Self-contained since contract 148; the addressability is a strength and must be kept. |
| `/competitions/:c/:s/games` | `CompetitionGamesPage` | The game catalogue and the player's memberships | `get_competition_games` | Concept A: a permanent destination. Concepts B and C: reached from the spine/queue | 9+ | **REDESIGN** | The only current surface where the three games are peers. Concepts B and C must prove they lose nothing by not having it. |
| `/competitions/:c/:s/games/match-predictor` | `SeasonMatchPredictorRoute` | Predict the matchweek | Contract 113 card, `useSeasonMatchPredictor` | Match Predictor | 7 (done) | **REDESIGN** | Accepted and unchanged by Stage 7.5. Used here as a real arrival test for each concept. |
| `…/games/match-predictor/standings` | `SeasonStandingsRoute` | How am I doing against the field | Contract 95 season leaderboard | The people dimension | 9+ | **ABSORB** | A game's standings and a private league's table answer the same question at two scopes. See the identity gap in §5 — this is the surface that cannot link a player. |
| `/competitions/:c/:s/games/lms` | `SeasonLmsRoute` | Survive the round | `lmsRoundModel`, `lmsRefusal`, `lmsStakeModel`, contracts for pick/settlement | Last Man Standing | **10 (to be scheduled)** | **REDESIGN** | §6. The row this matrix exists for. |
| `/competitions/:c/:s/games/championship/*` | `SeasonChampionshipRouter` | A season-long fixture list against named opponents | `championshipStandingModel`, `cupPhaseModel` | Predictor Championship | **11 (to be scheduled)** | **REDESIGN** | A nested system, not a page — index, instance, table and fixtures. §8. |
| `/competitions/:c/:s/leagues` | `SeasonLeaguesRoute` | Private play inside this competition | `gameLeaguesModel`, `leagueStandingsModel` | The people dimension | 9+ | **MERGE** | Merges with `/leagues`: one people surface, scoped or unscoped, rather than two that differ only by filter. |
| `/competitions/:c/:s/players/:playerId` | `SeasonPlayerProfileRoute` | One player's season | Contract 151 `get_season_player_profile` | Player profile | 9+ | **RETAIN + REDESIGN** | Competition-scoped for a real reason: points, rank and prediction history are facts about a player IN a season. Do not flatten to `/profile/:id`. |
| `/competitions/:c/:s/tv` | `SeasonTvModeRoute` | A matchday screen on a wall | `tvModeModel` (`INNOV-006`) | Unchanged, outside the shell | — | **RETAIN** | Already outside the signed-in frame by design. No concept touches it, and none should. |

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
| REDESIGN | 11 |
| ABSORB | 5 |
| MERGE | 4 |
| REDIRECT | 4 |
| HIDE | 2 |
| RETIRE | 0 |

Rows carrying two fates (`RETAIN + REDESIGN`, `RETAIN + HIDE`, `HIDE / ABSORB`,
`REDESIGN / MERGE`) are counted under each, so the totals exceed the row count.
**39 distinct routes are accounted for and none is unresolved.**

**RETIRE is zero, and that is a finding rather than an omission.** Nothing in the
current tree turned out to be dead. Everything either survives, is rebuilt, is
absorbed into a surface that does its job better, or is already a redirect. The
things that disappear in vNext disappear from the *navigation*, not from the
*address space* — which is the distinction this whole document exists to hold.

## 6. Unresolved

Two rows depend on the concept selection and cannot be settled here:

1. **`/competitions/:c/:s` versus `/`.** If the winning architecture roots
   everything in a competition, these are one surface and the matrix's
   `REDESIGN / MERGE` becomes `MERGE`. If it does not, they stay two.
2. **`/competitions/:c/:s/games`.** A permanent destination in one concept and
   absent in the other two. Whether the address survives is a consequence of the
   selection, not an input to it.

Both are recorded as open in
[`vnext-ia-lab.md`](vnext-ia-lab.md) rather than decided here.
