# Football Prediction Hub — information architecture

**Status:** Accepted target design, 3 August 2026; Domestic Frontend Alpha reconciliation 7 August 2026. No implementation is implied.  
**Decision authority:** [ADR 0023](../adr/0023-hub-information-architecture.md), scoped by [ADR 0026](../adr/0026-public-site-separation-shared-accounts-and-euro-2028-acquisition.md).  
**State authority:** [`../architecture-and-tournament-states.md`](../architecture-and-tournament-states.md).  
**Visual authority:** [`../design-system.md`](../design-system.md) for built component contracts; target presentation/delivery is elaborated by [`../design/ui-modernisation-execution.md`](../design/ui-modernisation-execution.md).

| Field | Value |
| --- | --- |
| Authority | Supporting — elaborates ADR 0023, may not reverse it |
| Status | Accepted target design — partially implemented |
| Last verified | 2026-08-07 |
| Governs | The **weekly platform's** route tree, shell behaviour, page ownership, onboarding steps, deterministic parent navigation and responsive interaction rules |
| Does not govern | Any decision (ADRs 0023 and 0026); the Euro 2028 site's surfaces; scoring, locks, settlement or reveal; current implementation state ([`../quality/current-status.md`](../quality/current-status.md)) |
| Supersedes | Tournament-era route and navigation descriptions where they disagree with ADR 0023 |
| Superseded by | § 5's navigation model only, by the [UI finalisation direction](../design/ui-finalisation.md) § 2 of 10 August 2026. The rest of this document stands |
| Related work | Domestic Frontend Alpha is the next named weekly-frontend milestone; exact current implementation remains in current status / feature baseline |
| Implementation truth | The route tree below is the target. What is registered today is decided by `src/App.tsx` and the route-declaration tests, not by this file |

This document is the build-ready information-architecture authority for the Hub, competition shells, onboarding and cross-game navigation. Older tournament-era route and navigation descriptions are compatibility history where they disagree with ADR 0023.

## 0. Two frontends, one backend

Added 6 August 2026 under [ADR 0026](../adr/0026-public-site-separation-shared-accounts-and-euro-2028-acquisition.md).

**This document describes the weekly platform.** There are two frontend deployments over one shared Supabase backend (`SITE-001`, `SITE-002`): the weekly platform on the eventual umbrella-brand domain (`SITE-003`) and Euro 2028 on the purchased tournament domain (`SITE-004`). The Euro site's information architecture is a separate, later design and is **not** the route tree below.

One account and one profile work on both sites (`ACCOUNT-001`, `ACCOUNT-002`); separate browser sessions are acceptable initially (`ACCOUNT-003`). Signing up on either site joins no competition, game or private container (`ACCOUNT-004`) — the onboarding in § 3 is how weekly-platform entry happens, and there is no path around voluntary game membership.

**Competition visibility is a server-owned publication state** — hidden, prelaunch, registration-open, live, completed, archived (`EURO-002`). While a competition's state is `hidden` it is absent from every weekly surface this document defines: Hub Home, Play, Matches, Leagues, the competition catalogue, every switcher, page metadata, the sitemap, Open Graph content, and its own routes (`EURO-001`, `EURO-003`). Absence is produced by the state and a route guard, never by a client catalogue that happens to omit an entry (`EURO-004`).

Euro 2028's hidden-state implementation gap remains a current requirement, not a reason to preserve tournament-era weekly navigation.

## 1. Product hierarchy and Domestic Frontend Alpha

```text
Football Prediction Hub
└── Competition season
    ├── Competition overview
    ├── Match Predictor
    ├── Last Man Standing
    ├── Predictor Championship
    └── competition-scoped matches, leagues and statistics
```

For the weekly Domestic Frontend Alpha the active product scope is Premier League 2026/27 and Scottish Premiership 2026/27, with Match Predictor, Last Man Standing and Predictor Championship. Tournament-only games belong to the later Euro frontend rather than the weekly Alpha.

The Hub is the global product. A competition season is the user's football context. A game is an independently joined competition with its own rules, entry, status and standings.

The frontend test is simple: within a few seconds the player can tell what needs action, when it locks, what is happening in the football, and how they are doing.

## 2. Canonical weekly routes

```text
/                                             Hub Home
/play                                         global action inbox
/matches                                      followed-competition matches
/leagues                                      all joined private containers
/more                                         account/help/settings directory

/competitions/:competition/:season            competition Overview
/competitions/:competition/:season/play       competition actions
/competitions/:competition/:season/matches    football information
/competitions/:competition/:season/games      game catalogue and joined games
/competitions/:competition/:season/leagues    private leagues/competitions

/competitions/:competition/:season/games/match-predictor
/competitions/:competition/:season/games/lms
/competitions/:competition/:season/games/championship

/competitions/:competition/:season/matches/:fixtureId
/competitions/:competition/:season/leagues/:containerId
/competitions/:competition/:season/players/:playerId
```

Compatibility paths may redirect to canonical routes during migration. They do not remain a second information architecture. `main_predictor` and similar compatibility identifiers may remain internal without dictating a user-facing route.

Route construction should converge on one typed/generated authority instead of independently maintained string literals in cards, breadcrumbs, tests and redirects.

**Every route above is subject to the publication state in § 0.** A competition whose state is `hidden` has no reachable weekly-platform route. A guessable path that renders, or that answers anything other than the site's ordinary not-found response, is a leak (`EURO-003`). Route guards, not catalogue omission, produce that (`EURO-004`).

### 2.1 Deterministic parent / exit map

Browser history is useful but never the only way out of a page. A deep URL may be the first route opened.

| Route class | Deterministic parent |
| --- | --- |
| Competition page | **Back to Hub** |
| Game page | **Back to Games**, while retaining competition-shell navigation |
| Private container / creation page | **Back to Leagues** |
| Match Centre | **Back to Matches**, restoring useful date/filter/scroll context where practical |
| Player / H2H page | Originating standings/container when known; otherwise safe competition context |
| Failure / not-found | Logical parent plus Hub |

Executable route/navigation coverage must enumerate shipped weekly routes and prove each non-root route has a parent/fallback. This is separate from checking that React can render the route.

## 3. First-sign-in onboarding and returning users

### Step 1 — account identity

Complete authentication, email verification where required and moderated display-name creation.

### Step 2 — choose competitions to follow

Show the available domestic competition seasons:

- Premier League 2026/27;
- Scottish Premiership 2026/27.

The user may follow either or both. Following controls football visibility and personalisation; it does not join a game.

### Step 3 — optional favourite team

Offer one optional favourite club from the currently visible domestic teams. `No favourite / Skip` is always available.

Favourite team is:

- a profile preference;
- changeable later;
- never a competition/game membership;
- never a prediction, score, rank or permission input;
- permitted to affect subtle prominence/personalisation only;
- always lower priority than an urgent or incomplete action.

The selector may use the shirt-style club identity in § 18, but team name/label remains present.

### Step 4 — choose games per followed competition

Show only the three weekly launch games supported by that competition. Nothing is preselected.

| Game | Onboarding description |
| --- | --- |
| **Match Predictor** | Predict each match score every matchweek. Exact scores and correct results build a season total, with the game's existing Joker rules. |
| **Last Man Standing** | Pick one team to win each round under the existing used-team and reset rules. |
| **Predictor Championship** | Match Predictor points become football fixtures against named opponents: win for three table points, draw for one. |

Each card names cadence, what the player actually does, current availability/start state, lock/deadline shape and private availability. Match Predictor may be visually primary, but entry remains voluntary.

### Step 5 — private play

Offer:

- enter invitation code;
- create a permitted private league/competition;
- skip.

### Step 6 — finish into personalised Hub

The first signed-in destination after completed onboarding is a Hub primarily shaped by the player's followed competitions, game memberships and current actions rather than the whole catalogue.

### Returning / interrupted flows

- completed onboarding → personalised Hub directly;
- interrupted onboarding → resume the incomplete step rather than restart;
- pending invitation → survives authentication **and onboarding**, then resumes at the exact competition, game and private container;
- followed competitions and favourite team → editable later through normal preferences;
- game participation → editable only where the game's lifecycle allows it.

## 4. Global Hub shell

### Navigation

```text
Home · Play · Matches · Leagues · More
```

Mobile uses bottom navigation. Desktop may use a left rail. Meaning and order remain identical.

### Global top bar

- Hub identity;
- notification indicator;
- avatar/account menu.

Competition switching does not permanently occupy Hub Home because the Hub is intentionally cross-competition.

### Final personalised Hub Home order

The current competition chooser may remain an intermediate shell until the reads below exist. The final signed-in Home prioritises:

1. one primary urgent/next action;
2. at most two compact secondary actions;
3. live football;
4. favourite-team / followed-competition context;
5. current rank and league movement;
6. recent matchweek results/recap;
7. private league/competition activity;
8. appropriate domestic discovery.

Urgent incomplete action stays visible even while live football becomes prominent.

### Play

The global action inbox groups tasks by urgency/deadline and names competition season plus game. It may group as Urgent / This week / Complete or waiting, but the underlying requirement is the same as Competition Play in § 7: it aggregates game-owned truth instead of recomputing deadlines in the browser.

### Matches

Combine followed competitions chronologically. Default groups may include Live / Today / Upcoming / Results. Provide clear competition labels and filters. Opening and returning from Match Centre preserves selected date/filter and useful position where practical.

### Leagues

Separate:

- My leagues — Match Predictor;
- My competitions — LMS and Predictor Championship.

Cards show competition, game, format, status, creator and next action.

### More

Profile, notifications, account, followed competitions, favourite team, game preferences, How to Play, scoring/rules, accessibility, support and legal. Admin appears only to an authorised capability.

**This is the target list, not a checklist to fill with empty rows.** What ships is
what can be made truthful: Account, Profile and How the games work exist today.
Followed competitions and favourite team wait on `MIG-UI-10`; notifications wait
on an action-centre audit finding enough real state to be worth a control. A row
that leads to an empty screen is the dead control § 10 of the UI finalisation
direction forbids.

**Profile is the PLATFORM's, not a competition's.** `/profile` holds display
identity and the player's competition seasons, and links into each season's own
player profile at
`/competitions/:competitionSlug/:seasonSlug/players/:playerId` (contract 151).
It reads no tournament and depends on no publication state — it used to be the
Euro tournament profile, which meant every visible Profile control sent a
domestic player into a boundary that refuses while Euro is hidden.

## 5. Competition shell

> **Superseded in part, 10 August 2026.** The two paragraphs marked below —
> "entering a competition **replaces** the global tab bar/rail" and "the two
> navigation systems are **never shown together**" — were reversed by the owner's
> [UI finalisation direction](../design/ui-finalisation.md) § 2, which is the
> current navigation authority. The direction is newer and it wins.
>
> **What is true now.** The global navigation is PERMANENT: a bottom bar below
> 1024px and a persistent left rail at and above it, visible inside competition
> context and never swapping its destinations. The competition's own navigation
> lives BENEATH THE COMPETITION MASTHEAD, in the content column, and the two are
> deliberately visible at once on desktop because they answer different
> questions — "what do I want to do across my account" and "what do I want to do
> inside this competition". A competition shortcut in the rail opens that
> competition's Overview and never expands into its sections.
>
> **This is recorded rather than rewritten.** The superseded text stays below as
> dated evidence of what was accepted on 3 August 2026, so a later reader can see
> that the model changed and when. It must not be re-implemented: `src/app/
> AppShell.tsx`, `src/design-system/SideRail.tsx` and `tests/app/desktopRail.test.tsx`
> hold the current behaviour, and `tests/app/globalNavigation.test.tsx` fails if
> the global navigation is hidden inside a competition.

*Superseded text, 3 August 2026 — historical:*

> Entering a competition replaces the global tab bar/rail with:
>
> ```text
> Overview · Play · Matches · Games · Leagues
> ```
>
> The two navigation systems are never shown together.

The shell includes:

- obvious Back to Hub;
- competition name and season;
- quick competition switcher between visible domestic competition seasons;
- notification/avatar access;
- compact competition masthead;
- focused competition navigation.

## 6. Competition Overview

Overview is a state-driven dashboard, not a static collection of game cards.

Baseline order:

1. competition masthead;
2. primary action;
3. next/live fixtures;
4. joined games;
5. league position and movement;
6. recent results/recap;
7. available games;
8. competition information.

When any match is live, live football becomes the dominant content. When a lock is urgent, its warning remains above or attached to the live block.

Joined game cards expose state meaningful to the game:

- Match Predictor — completion, complete/incomplete, next lock, useful points/rank and Continue/View action;
- LMS — pick required/current pick, active/eliminated, current round, next lock and Make/View pick;
- Championship — current opponent, fixture/result state, table position, phase/group and matchup/table action, with the reminder that Match Predictor points feed it automatically.

## 7. Competition Play — “What do I need to do this week?”

Competition Play is one competition-scoped task list across its joined games. It prevents the player opening three game homes just to discover whether action is required.

Typical states:

```text
Match Predictor incomplete  → Continue predictions
LMS selection missing       → Make pick
Predictor Championship      → View matchup/status
                               (Match Predictor points feed it automatically)
```

Actions retain game identity and open the exact relevant stage/round. Completed and locked items remain visible in a quiet waiting state rather than disappearing without explanation.

Each game's own server authority continues to decide whether action is genuinely required, when it locks and what may be written. The Competition Play model may later feed Hub Home priority and reminder eligibility.

## 8. Competition Matches

### Domestic

```text
Fixtures · Results · Table · Stats
```

A matchweek switcher belongs on Match Predictor and domestic Matches/history where matchweek is meaningful. LMS and Predictor Championship retain their own round/fixture terminology and server-owned state.

The Matches switcher:

- sits immediately beneath competition context;
- remains phone-accessible;
- has an unmistakable active state;
- remembers the last selected subview for that competition;
- preserves useful scroll on detail/back navigation.

### Match Centre

After the basic playable Alpha, Match Centre becomes a primary engagement surface connecting football to prediction consequences. High-value combinations include:

- score/state and timing;
- the player's prediction;
- provisional/final prediction points and status;
- scoring explanation;
- post-lock consensus/trends;
- private-league position/movement where supported;
- H2H/rival comparison where supported;
- LMS relevance when the player's selected club is involved;
- Predictor Championship matchup context.

Provider/live state remains visibly provisional until protected official result confirmation.

## 9. Competition Games

Joined games first; available games second. The weekly Alpha exposes exactly:

1. Match Predictor;
2. Last Man Standing;
3. Predictor Championship.

Every card states:

- game name;
- entry/membership status;
- meaningful current state;
- next action;
- deadline/round where relevant;
- direct canonical route;
- concise rules/help route.

The game catalogue remains honest in `not open`, `unavailable` or `not joined` states. A delivered game with a valid route/backend authority does not become an unexplained dead end.

## 10. Game-level secondary navigation

This navigation is subordinate to competition context and always includes a clear route back to Competition Games.

### Match Predictor

```text
Play · Standings · Trends · History
```

### Last Man Standing

```text
Pick · Standings · History · Rules
```

### Predictor Championship

```text
My Fixture · Table · Fixtures · History
```

It is direct and phone-friendly; it is not a third global shell.

## 11. Competition Leagues and private creation

Separate:

### My leagues

- Match Predictor private leagues.

### My competitions

- Last Man Standing private competitions;
- Predictor Championship private competitions.

Explicit creation actions:

```text
Create Match Predictor League
Create LMS Competition
Create Predictor Championship
```

Canonical creation routes converge on:

```text
/competitions/:competition/:season/leagues/new/match-predictor
/competitions/:competition/:season/leagues/new/lms
/competitions/:competition/:season/leagues/new/championship
```

Every invitation and container header names:

```text
Competition season → Game → League or competition
```

Match Predictor setup covers name, access/invite, create and share/join. LMS setup uses the existing permitted start/setup/preset/access rules and managed entrants only where authorised. Championship setup covers name, starting round, access/invite, entrant field and a calculated format preview from the deterministic format authority.

Creator tools and limits remain governed by ADR 0023. No money, prize or payment administration exists.

## 12. Private creation limits

Server-side per owner and competition season:

- 10 active private containers total;
- maximum 5 active LMS;
- maximum 5 active Championships;
- maximum 3 successful creations per rolling 24 hours.

Completed/archived containers cease counting. Transfers validate the recipient cap. Authorised exception is explicit and audited.

These are **per-owner product limits** (`CAP-002`) and are unchanged. They are distinct from the platform-wide circuit breaker (`CAP-001`), any future per-league membership limit (`CAP-003`, no value approved) and future commercial entitlements (`CAP-004`).

## 13. Standings and discovery

Signed-in non-entrants see public top 10 plus field size/status. Entrants see full pagination and their neighbourhood.

Private invitation previews are bounded. Full private standings are participant/creator surfaces.

Standings visibility does not grant pre-lock prediction detail. Reveal remains governed separately.

## 14. Following and favourite team

Following gives football information/discovery without competitive entry.

Favourite team may affect subtle ordering/prominence and club-flavoured context. It never:

- joins a competition or game;
- hides urgent actions elsewhere;
- changes a score, prediction or rank;
- grants a permission;
- removes other followed competitions.

## 15. Managed LMS entrants

Creator bulk view lists managed name, current pick and action status. Managed entrants:

- carry a visible marker;
- share the exact lock;
- cannot be added after start;
- are audited per action;
- may later be claimed with history preserved.

No other launch game supports managed entrants.

## 16. Scottish Premiership Development rehearsal

Scottish Premiership is the first truthful end-to-end domestic Development rehearsal.

### Matchweek 1

Use real completed Matchweek 1 football results. Do not fabricate scores.

Where seeded test users require historical prediction state, synthetic predictions may be inserted only with timestamps/states consistent with the original lock, after which the normal protected result/scoring/rederivation path produces standings and downstream state. Provider data remains provisional evidence until protected result confirmation.

### Matchweek 2

Use Matchweek 2 as:

- the first playable Last Man Standing round;
- the starting round of the seeded Development Predictor Championship.

LMS invents no Matchweek 1 history. The player can join, see the actual Matchweek 2 clubs, select one, change it before lock and reload with the choice preserved.

The Championship seeded field uses the authoritative deterministic format. Opponent, fixtures, phase/group and table are reachable through normal frontend routes, and Match Predictor points feed its fixtures through the existing authoritative mechanism. No invented Matchweek 1 Championship history is required.

## 17. Development competition administration

Development needs a visible operator journey for competition readiness rather than relying on invisible SQL/manual knowledge.

At minimum show:

- season/provider and fixture readiness;
- current matchweek;
- Match Predictor availability;
- LMS setup/current round;
- Championship launch/field/phase;
- result-confirmation readiness;
- relevant refusal/review states.

Where server authorities already permit it, Competition Admin may expose guarded preview/execute actions such as starting LMS at a permitted round or launching Predictor Championship from a permitted round. The UI remains a caller of authoritative server rules, not a second rules engine.

Provider fixture handling and official-result boundaries remain those of ADR 0023.

## 18. Reusable shirt-style club identity

The target weekly presentation includes one reusable team/club shirt identity component (implementation name not prescribed).

It supports a bounded pattern vocabulary sufficient for active clubs, for example:

- solid;
- horizontal hoops;
- vertical stripes;
- halves/panels where needed;
- primary/secondary colour combinations.

Examples are recognisable abstract treatments such as Rangers blue and Celtic green-and-white hoops; the requirement is not replica-kit reproduction.

Component contract:

- key from canonical team identity, never provider IDs;
- render consistently across repeated football rows/selections;
- preserve a neutral initials/identity fallback;
- expose an accessible team name/label;
- work in light and dark themes;
- never be the sole team identifier;
- preserve row height/layout stability;
- remain restrained enough for the premium design language.

Initial adoption order: onboarding favourite-team selector → Match Predictor rows → Matches/results → Match Centre → LMS club selector → relevant Championship opponent/fixture context → other team selectors where space allows.

This is a **target component contract**. Until the component is implemented, `docs/design-system.md` remains truthful about the design system that actually exists and should not pretend the shirt mark is already built.

## 19. Reminders and player history

Post-core-Alpha reminder priority starts with:

- Match Predictor incomplete near lock;
- LMS selection missing near lock.

Eligibility derives from server-owned game/lock state, with a simple user enable/disable preference. The frontend does not reconstruct a separate deadline.

History then becomes intentional retention surface:

- Match Predictor — matchweeks, points/performance, best week, exact/correct-result totals, monthly/form where supported;
- LMS — runs, survival/elimination, round history, picks/used clubs, best run;
- Championship — fixtures/results, W/D/L, table/phase and opponent history.

## 20. Public landing page and scripted phone preview

The public acquisition page has two delivery stages.

### Define early

Settle:

- headline and short proposition;
- Create account / Sign in CTAs;
- domestic competition positioning;
- concise three-game explanation;
- reserved phone-preview area;
- responsive and accessibility rules.

### Final visual implementation late

The final landing visual, especially the phone-framed walkthrough, is built only after the signed-in Alpha journeys and visual language have settled. An earlier implemented landing shell may remain useful for acquisition, but it is not the final visual source of truth.

The final preview reuses real product visual patterns and the shirt-style identity from § 18. It is presentation-only and non-interactive. A representative sequence may show personalised Hub → Match Predictor completion → LMS club selection → Championship opponent/table → Match Centre provisional impact → return to Hub.

Requirements:

- fixed/local demo data;
- no account/session dependency;
- no live competitive API calls;
- no prediction submission;
- no links/forms inside the simulated phone;
- pointer/touch cannot activate simulated controls;
- keyboard focus does not enter the simulated UI;
- real Create account / Sign in CTAs remain outside the phone;
- subtle `Demo` / `Product preview` label;
- respect `prefers-reduced-motion` with a useful static state;
- pause when page visibility is lost;
- avoid rapid flashing / distracting perpetual motion;
- preferably play one coherent walkthrough then rest on a strong Hub state;
- if continuously looping, expose an external pause/play control.

Phone content order keeps conversion first: headline → proposition → CTAs → preview. The landing page should primarily show the product rather than explain every feature in long copy.

## 21. Alpha phone-first acceptance

The Development Alpha is not complete until a phone-width journey proves:

- first sign-in guided setup before personalised Hub;
- returning sign-in directly to personalised Hub;
- optional/changeable favourite team reflected through appropriate identity;
- weekly Hub limited to the two domestic competition seasons while Euro is hidden;
- Match Predictor real current fixtures save/reload correctly;
- truthful Scottish Matchweek 1 settled state;
- Scottish LMS begins at Matchweek 2 with selectable club;
- Scottish Championship starts from Matchweek 2 with opponent/table/fixtures reachable;
- all three games reachable for both domestic competitions;
- private create/invite/join for all three game types;
- Competition Play summarises the right weekly actions;
- global, competition and game navigation match this authority;
- every deep page has a deterministic parent/exit;
- shirt-style identity is present on core football rows/selections;
- Match Centre shows player prediction plus meaningful game context;
- final public product preview is unclickable and built from settled real product visual states;
- core journeys remain usable and understandable at phone width.

## 22. Read-model boundary

Major surfaces should receive bounded page-shaped snapshots, whether RPC-shaped or assembled behind one service boundary:

```text
get_hub_page
get_play_actions
get_competition_dashboard
get_competition_play
get_matches_page
get_match_centre
get_games_page
get_leagues_page
get_game_page
get_profile_page
get_admin_control_room
```

These names are architectural examples, not pre-authorised public RPC signatures. Components do not assemble raw business truth.

## 23. Responsive rules

Phone-first at 360px.

- Hub and competition modes each have one primary navigation system.
- Competition, game and Matches switchers remain directly accessible rather than buried in dropdowns.
- Long tables retain usable headers/context and a visible user neighbourhood.
- Desktop may add a contextual right column without changing content priority.
- Mastheads remain contained bands, never large heroes.
- Deterministic parent/exit controls remain visible at deep-link entry, not only after browser navigation.

## 24. Delivery authority relationship

This file owns **where things live and how the user moves between them**. It does not own implementation order. The immediate Domestic Frontend Alpha sequence is recorded in ADR 0023 and the execution authorities [`../design/ui-modernisation-execution.md`](../design/ui-modernisation-execution.md) / [`../roadmap.md`](../roadmap.md).

Current implementation truth remains in [`../quality/current-status.md`](../quality/current-status.md) and [`../quality/feature-baseline.md`](../quality/feature-baseline.md). Accepted-but-unimplemented requirements remain in [`../quality/accepted-requirements.md`](../quality/accepted-requirements.md) until evidence closes them.
