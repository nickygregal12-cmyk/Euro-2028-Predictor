# ADR 0020 — Football Prediction Hub product model

- **Status:** Accepted
- **Date:** 1 August 2026
- **Supersedes:** the product-positioning and rehearsal-name deferral in ADR 0019. ADR 0019's club-identity and formal clearance cautions remain relevant to any later distinctive brand.

## Context

The repository already implements a multi-competition football prediction platform, but its visible root route and application title still present Euro 2028 as the whole product. The owner has now defined the operating product for the 2026/27 rehearsal season.

The platform is football-only. Euro and World Cup tournaments remain focused competitions with their own tournament rules and domains, while domestic league seasons run reusable weekly game formats. The purchased `euro28predictor.com` domain remains useful: it may host the whole private rehearsal hub during 2026/27 and should open directly into Euro 2028 when that tournament becomes the public acquisition event.

## Decision

### Product hierarchy

The visible product is **Football Prediction Hub** until a later distinctive-brand decision replaces that descriptive working name.

Users enter the global hub first, choose a competition season and then reach a competition dashboard. They separately opt into each game they want to play and may later join or leave available games without creating another account.

```text
Football Prediction Hub
└── Competition season
    ├── Competition dashboard
    ├── Main or Original Predictor
    ├── Last Man Standing
    ├── Predictor Championship
    └── competition-specific leagues, standings and statistics
```

### First competition seasons

The first domestic rehearsal seasons are:

- Premier League 2026/27;
- Scottish Premiership 2026/27, with earlier fixtures and predictions backfilled where necessary.

Both domestic competitions should support:

- Main Predictor;
- Last Man Standing;
- Predictor Championship.

Euro 2028 remains the preserved tournament baseline and later supports its tournament-specific Original Predictor, KO Predictor and the reusable game formats appropriate to that competition.

### Competition dashboards

Opening a competition always lands on its dashboard, not directly inside one game. The dashboard prioritises the user's current actions and state, including:

- incomplete predictions;
- next matchweek or tournament lock;
- live and recent results;
- predictor points and rank;
- Predictor Championship opponent/result;
- Last Man Standing selection/status;
- joined games and competition-specific private leagues.

### Domestic Main Predictor

Domestic league seasons use score predictions only. The existing non-cumulative score-prediction principle remains: exact score replaces correct-result points rather than adding to them. Missing predictions score zero and predictions remain editable until the matchweek lock.

A domestic matchweek locks exactly at its earliest kickoff. A fixture moved or postponed after locking reopens and later relocks at its new authoritative kickoff. Abandoned matches wait for the replay or official completion. Admin overrides are permitted and permanently audited.

Domestic Main Predictor has ten Jokers:

- five available in matchweeks 1–19;
- five available in matchweeks 20–38;
- unused first-half Jokers do not carry forward;
- more than one Joker may be used in a matchweek;
- each Joker doubles the normal points;
- a moved/postponed Joker remains attached to its fixture but can be changed while the fixture is reopened.

Scottish league implementations must parameterise the season shape rather than assume 38 matchweeks. Their equivalent Joker windows must be configured explicitly before launch.

### Last Man Standing

Users opt into Last Man Standing separately. A global game accepts entry only at its start, while private LMS competitions may be created to begin at a later matchweek. LMS presents survival and selection state rather than pretending to be a points leaderboard.

### Predictor Championship

Predictor Championship runs every matchweek of the selected domestic competition. Each head-to-head fixture compares the participants' total Main Predictor points for that matchweek and awards football standings points:

- win: 3;
- draw: 1;
- loss: 0.

A simple entrant set may use one league table. Larger competitions use groups followed by playoffs. Knockout ties use the already approved extra-time and penalties tie-break sequence. For the Scottish Premiership, playoffs begin once the post-split fixtures are known.

### Entries, leagues and career state

- one global account and profile spans all competition seasons;
- one Main Predictor score prediction is reused across every private league for that competition;
- each game has a separate competition-season entry;
- private leagues are competition-specific and do not auto-renew;
- users may join the domestic Main Predictor late and start on zero;
- users may leave a game where its rules permit;
- career profiles and global summaries may aggregate competitions, but every game keeps its own authoritative points, standings and state.

Tournament-specific headline points remain tournament points. LMS, Predictor Championship and Main/Original Predictor carry equal product weight and expose the state meaningful to their own rules rather than being forced into one universal leaderboard.

### Ingestion and notifications

Three provider integrations may be tested through adapters against one internal fixture/result model. Fixture changes import automatically and notify an administrator for review. Results do not require confirmation before entering the feed, but official scoring/progression authority remains governed by the existing fail-closed result rules.

The rehearsal includes in-app and email reminders one hour before a lock only when the user has incomplete predictions. Users control notifications per competition and per game.

### Routes

Competition routes use stable slugs:

```text
/competitions/premier-league/2026-27
/competitions/scottish-premiership/2026-27
/competitions/euro/2028
```

Game routes are children of the competition season. Existing Euro routes may remain temporarily as compatibility paths while the full competition-scoped routing migration is completed.

## Consequences

- `/` becomes the authenticated competition hub rather than the Euro dashboard.
- The existing Euro dashboard moves behind the Euro 2028 competition route without changing its scoring or stored data.
- Game engines and entries are reusable products attached to competition seasons, not features owned by one competition.
- Stage C1 remains the persistence dependency for real competition-season records.
- Stage C2 account-erasure/profile-ownership work remains independently blocked by issue #272 and does not block hub surfaces, season configuration or game-rule development.
- The first implementation should favour a thin end-to-end domestic slice while preserving the Euro baseline, rather than another broad generic abstraction phase.
