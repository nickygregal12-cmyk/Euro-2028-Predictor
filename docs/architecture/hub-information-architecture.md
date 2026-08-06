# Football Prediction Hub — information architecture

**Status:** Accepted target design, 3 August 2026. No implementation is implied.  
**Decision authority:** [ADR 0023](../adr/0023-hub-information-architecture.md), scoped by [ADR 0026](../adr/0026-public-site-separation-shared-accounts-and-euro-2028-acquisition.md).  
**State authority:** [`../architecture-and-tournament-states.md`](../architecture-and-tournament-states.md).  
**Visual authority:** [`../design-system.md`](../design-system.md).

| Field | Value |
| --- | --- |
| Authority | Supporting — elaborates ADR 0023, may not reverse it |
| Status | Accepted target design — unimplemented |
| Last verified | 2026-08-06 |
| Governs | The **weekly platform's** route tree, shell behaviour, page ownership, onboarding steps and responsive interaction rules |
| Does not govern | Any decision (ADRs 0023 and 0026); the Euro 2028 site's surfaces; scoring, locks, settlement or reveal; current implementation state ([`../quality/current-status.md`](../quality/current-status.md)) |
| Supersedes | Tournament-era route and navigation descriptions where they disagree with ADR 0023 |
| Superseded by | None |
| Related work | No open pull request implements the shell described here |
| Implementation truth | The route tree in § 2 is a target. What is registered today is decided by `src/App.tsx` and the route-declaration tests, not by this file |

This document is the build-ready information-architecture authority for the Hub, competition shells, onboarding and cross-game navigation. Older tournament-era route and navigation descriptions are compatibility history where they disagree with ADR 0023.

## 0. Two frontends, one backend

Added 6 August 2026 under [ADR 0026](../adr/0026-public-site-separation-shared-accounts-and-euro-2028-acquisition.md).

**This document describes the weekly platform.** There are two frontend deployments over one shared Supabase backend (`SITE-001`, `SITE-002`): the weekly platform on the eventual umbrella-brand domain (`SITE-003`) and Euro 2028 on the purchased tournament domain (`SITE-004`). The Euro site's information architecture is a separate, later design and is **not** the route tree below.

One account and one profile work on both sites (`ACCOUNT-001`, `ACCOUNT-002`); separate browser sessions are acceptable initially (`ACCOUNT-003`). Signing up on either site joins no competition, game or private container (`ACCOUNT-004`) — the onboarding in § 3 is how entry happens, and there is no path around it.

**Competition visibility is a server-owned publication state** — hidden, prelaunch, registration-open, live, completed, archived (`EURO-002`). While a competition's state is `hidden` it is absent from every surface this document defines: Hub Home, Play, Matches, Leagues, the competition catalogue in § 9, every switcher, page metadata, the sitemap, Open Graph content, and its own routes in § 2 (`EURO-001`, `EURO-003`). Absence is produced by the state and a route guard, never by a client catalogue that happens to omit an entry (`EURO-004`).

Euro 2028's state is `hidden` and the weekly Hub currently lists it from a static catalogue. That is a known violation, recorded as `EURO-001` in [`../quality/accepted-requirements.md`](../quality/accepted-requirements.md); it is implementation work and is not addressed by this document.

## 1. Product hierarchy

```text
Football Prediction Hub
└── Competition season
    ├── Competition overview
    ├── Match or Original Predictor
    ├── Last Man Standing
    ├── Predictor Championship
    ├── KO Predictor where supported
    └── competition-scoped matches, leagues and statistics
```

The Hub is the global product. A competition season is the user's football context. A game is an independently joined competition with its own rules, entry, status and standings.

## 2. Canonical routes

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
/competitions/:competition/:season/games/original-predictor
/competitions/:competition/:season/games/lms
/competitions/:competition/:season/games/championship
/competitions/:competition/:season/games/ko-predictor

/competitions/:competition/:season/matches/:fixtureId
/competitions/:competition/:season/leagues/:containerId
/competitions/:competition/:season/players/:playerId
```

Existing Euro paths may redirect to these routes during migration. Compatibility paths do not remain a second information architecture.

**Every route above is subject to the publication state in § 0.** A competition whose state is `hidden` has no reachable route on the weekly platform — including `/competitions/euro/2028` and everything beneath it. A guessable path that renders, or that answers anything other than the site's ordinary not-found response, is a leak (`EURO-003`). Route guards, not catalogue omission, produce that (`EURO-004`).

## 3. First-run onboarding

### Step 1 — account identity

Complete authentication, email verification where required and moderated display-name creation.

### Step 2 — choose competitions

Show every available competition season as a card. The user may follow one or several without joining a game. One may be marked favourite.

### Step 3 — choose games

Show only games supported by each selected competition. Nothing is preselected. Match Predictor may carry a non-coercive `Recommended` label.

| Game | Onboarding description |
| --- | --- |
| **Match Predictor** | Predict each match score every matchweek. Exact scores and correct results build a season total, with strategic whole-matchweek Jokers. |
| **Original Predictor** | Predict the complete tournament before it begins: groups, qualification, bracket, champion and awards. |
| **Last Man Standing** | Pick one team to win each round. Survive, but do not reuse a team until the available-team list resets. |
| **Predictor Championship** | Match Predictor points become football fixtures against named opponents: win for three table points, draw for one. |
| **KO Predictor** | Predict knockout scores round by round and choose who advances when a draw is predicted. |

Each card names cadence, lock style, private availability and whether late entry is permitted.

### Step 4 — private play

Offer:

- enter invitation code;
- create a permitted private league/competition;
- skip.

An invitation survives authentication and resumes at the exact competition, game and private container.

## 4. Global Hub shell

### Navigation

```text
Home · Play · Matches · Leagues · More
```

Mobile uses bottom navigation. Desktop may use a left rail. The meaning and order remain identical.

### Global top bar

- Hub identity;
- notification indicator;
- avatar/account menu.

A competition switcher is not necessary on Hub Home because the competition cards are the primary selector.

### Hub Home order

1. compact Broadcast Grid masthead;
2. one primary action;
3. at most two compact secondary actions;
4. live matches when present;
5. favourite competition;
6. other followed competitions;
7. recent results, weekly recap and league movement;
8. available games and competition discovery.

Live football moves above ordinary browsing and non-urgent actions. An urgent incomplete-action warning remains visible.

### Play

The global action inbox groups tasks by urgency and deadline. Every task names competition season and game. Suggested groups:

- Urgent;
- This week;
- Complete/waiting.

### Matches

Combine followed competitions chronologically. Default groups:

- Live;
- Today;
- Upcoming;
- Results.

Provide clear competition labels and filters. Opening and returning from a match preserves the selected date/filter where practical.

### Leagues

Separate:

- My leagues — Match/Original Predictor;
- My competitions — LMS and Predictor Championship.

Cards show competition, game, format, status, creator and next action.

### More

Profile, notifications, account, following/game preferences, How to Play, scoring/rules, accessibility, support and legal. Admin appears only to an authorised role.

## 5. Competition shell

Entering a competition replaces the global tab bar/rail with:

```text
Overview · Play · Matches · Games · Leagues
```

The shell includes:

- obvious Back to Hub;
- competition name and season;
- competition switcher;
- notification/avatar access;
- compact competition masthead;
- focused competition navigation.

The two navigation systems are never shown together.

## 6. Competition Overview

Overview is a state-driven dashboard, not a static collection of game cards.

Baseline order before detailed state workshops:

1. competition masthead;
2. primary action;
3. next/live fixtures;
4. joined games;
5. league position and movement;
6. recent results/recap;
7. available games;
8. competition information.

When any match is live, live football becomes the dominant content. When a lock is urgent, its warning remains above or attached to the live block.

Joined game cards show the state meaningful to that game:

- Match/Original Predictor — points, rank, completion and next lock;
- LMS — selection/survival/elimination;
- Championship — opponent, current result and table position;
- KO Predictor — round completion and standings.

## 7. Competition Play

One competition-scoped task list across its joined games. It prevents users opening three game homes simply to discover whether action is required.

Actions retain game identity and open the exact relevant stage/round. Completed and locked items remain visible in a quiet waiting state rather than disappearing without explanation.

## 8. Competition Matches

### Domestic

```text
Fixtures · Results · Table · Stats
```

### Tournament

```text
Fixtures · Groups · Bracket · Stats
```

The switcher:

- sits immediately beneath the competition masthead/navigation context;
- is horizontally scrollable where required;
- becomes sticky on long tables;
- has an unmistakable active state;
- remembers the last selected subview for that competition;
- preserves useful scroll on detail/back navigation.

Contextual links may move between subviews:

- View league table;
- See Group B;
- View bracket;
- See qualification picture.

The Match Centre shows real score/state, user prediction, provisional/final points, scoring explanation, private-league picks, movement and relevant LMS/Championship context. Live feed data remains provisional until official confirmation.

## 9. Competition Games

Joined games first; available games second. Every card states:

- game name;
- separate entry/status;
- separate points or survival state;
- deadline;
- direct action;
- concise rules link.

The game catalogue stays visible in honest `not open`, `unavailable` or `not joined` states. Missing hosted configuration never silently erases a delivered game.

## 10. Competition Leagues

Show private Match/Original Predictor leagues and private LMS/Championship competitions in separate sections. Creation actions are game-specific.

Every invitation and container header names:

```text
Competition season → Game → League or competition
```

Creator tools include invite regeneration, participant removal where lawful, ownership transfer, archive/copy and game-specific management. No money, prize or payment administration exists.

## 11. Private creation limits

Server-side per owner and competition season:

- 10 active private containers total;
- maximum 5 active LMS;
- maximum 5 active Championships;
- maximum 3 successful creations per rolling 24 hours.

Completed/archived containers cease counting. Transfers validate the recipient cap. Authorised exception is explicit and audited.

These are **per-owner product limits** (`CAP-002`) and are unchanged. They are a different class from the platform-wide public-user and league circuit breaker (`CAP-001`), from any per-league membership limit (`CAP-003`, no value approved) and from future commercial entitlements (`CAP-004`). See [ADR 0023 § Operating-limit classes](../adr/0023-hub-information-architecture.md#operating-limit-classes) — a staged change to the circuit breaker does not move the figures above.

Championship creators choose name, start round and access only. Structure is calculated and previewed from entrants and remaining rounds; the audited full schedule publishes at entry close.

LMS creators choose name, start round, preset/access and permitted immutable setup. Offline entrants may be added only before the first lock.

## 12. Standings and discovery

Signed-in non-entrants see public top 10 plus field size/status. Entrants see full pagination and their neighbourhood.

Private invitation previews are bounded. Full private standings are participant/creator surfaces.

Standings visibility does not grant pre-lock prediction detail. Reveal remains governed separately.

## 13. Favourite and following

Favourite affects ordering on Home, Play, Matches and switchers. It never:

- joins a game;
- hides urgent actions elsewhere;
- changes a score;
- removes other followed competitions.

Following gives access to football information and discovery without requiring competitive entry.

## 14. Managed LMS entrants

Creator bulk view lists managed name, current pick and action status. Managed entrants:

- carry a visible marker;
- share the exact lock;
- cannot be added after start;
- are audited per action;
- may later be claimed with history preserved.

No other launch game supports managed entrants.

## 15. Administration

Initial assignment: one Super Admin.

Future permission capabilities:

- results;
- competition configuration;
- support/moderation;
- role administration.

Provider fixture changes archive before decode, update automatically when valid, audit old/new values and create review alerts. Ambiguity fails closed. Official result confirmation/correction stays protected and returns an impact summary.

## 16. Read-model boundary

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

## 17. Responsive rules

Phone-first at 360px.

- Hub and competition modes each have one primary navigation system.
- Competition and Matches switchers remain directly accessible, not buried in dropdowns.
- Long tables retain sticky headers/switcher and a visible user neighbourhood.
- Desktop may add a contextual right column without changing content priority.
- Mastheads remain contained bands, never large heroes.

## 18. Next workshop sequence

The next design authority to settle is the Competition Overview across:

1. normal week;
2. deadline approaching;
3. matches live;
4. finished/awaiting confirmation;
5. matchweek complete.

Then: Play → Matches detail → Games → Leagues → global Home → creation/onboarding detail → admin.
