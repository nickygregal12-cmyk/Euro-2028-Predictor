# Competition and game structure

**Status:** platform target authority; exact merged/hosted implementation remains in [`quality/current-status.md`](quality/current-status.md).  
**Product model:** [ADR 0020](adr/0020-football-prediction-hub-product-model.md).  
**Information architecture and private-container decision:** [ADR 0023](adr/0023-hub-information-architecture.md).

The core law is simple: a **competition season** supplies real football; each **prediction game** is entered separately and owns its own rules, state and standings.

## 1. Product hierarchy

```text
Football Prediction Hub
└── Competition season
    ├── football fixtures, results, table/groups/bracket and statistics
    ├── Match or Original Predictor
    ├── Last Man Standing
    ├── Predictor Championship
    ├── KO Predictor where supported
    └── game-scoped private leagues/competitions
```

One account/profile spans the Hub. Following a competition does not enter a game.

## 2. Public game catalogue

| Public name | Purpose | Typical scope | Private option |
| --- | --- | --- | --- |
| **Match Predictor** | weekly domestic score predictions and cumulative points | league season | private leagues |
| **Original Predictor** | full pre-tournament groups/bracket/awards entry | tournament | private leagues |
| **Last Man Standing** | one surviving team selection per round | season or tournament | private LMS competitions |
| **Predictor Championship** | head-to-head fixtures using raw Predictor points | season; tournament compatibility machinery | private Championships |
| **KO Predictor** | rolling knockout score/advance picks | knockout tournaments | global at first launch unless later decided |

`Main Predictor`, `Predictor Cup` and `bonus_*` names may remain inside code/schema for compatibility. User-facing copy follows the table.

## 3. Separation law

- Entry into every game is separate and voluntary.
- Joining a private league never enrols a user in its game; game membership is a prerequisite.
- One game's points, survival state or progression never alter another's.
- Match/Original Predictor leagues do not become tabs for LMS or Championship.
- Every page, card, invitation and standings view names the active competition season and game.
- Leaving, losing or completing one game does not affect any other.
- Official fixture/result correction is entered once and each affected game recomputes independently.
- Raw predictions may be shared only through a neutral contract where explicitly authorised; entries, scoring and standings remain game-owned.
- Predicted and real brackets never blend.
- Scoring is platform-standard for the game. Private creators do not customise scoring.

## 4. Private containers

The first domestic release includes:

- Match Predictor private leagues;
- private Last Man Standing competitions;
- private Predictor Championships.

The global Leagues surface groups them into `My leagues` and `My competitions` without pretending they are the same lifecycle.

Every invitation identifies:

```text
Competition season → Game → League or competition
```

Creation limits and rate limits are governed by ADR 0023 and enforced server-side. Completed/archived containers may be copied or run again without a durable cross-season friend-group entity.

## 5. Private Last Man Standing

Any eligible user may create a private LMS beginning at a future round, subject to the active/rate cap.

The creator chooses only options authorised by ADR 0013/0022. Setup becomes immutable at the first lock. Entry closes for accounts and managed entrants at that same instant.

Managed/offline entrants exist only here:

- creator adds them before start;
- creator may bulk-enter selections before the ordinary lock;
- every action records actor/time;
- standings mark them visibly;
- no late add or override exists;
- claiming attaches a real account while preserving history.

## 6. Private Predictor Championship

The creator chooses name, competition, start round and access. The creator does not choose the structure or scoring.

Entrant count and remaining rounds deterministically select head-to-head, single group, split, seeded playoff or balanced groups/knockout according to ADR 0014/0022. The format is previewed before close; the audited schedule publishes at entry close and is immutable.

## 7. Standings visibility

For public games:

- signed-in non-entrant: top 10, field size, status/format and open join action;
- active entrant: full paginated table and neighbourhood.

For private containers:

- anonymous/invited preview: bounded metadata only;
- participant/authorised creator: full field.

This does not change prediction-detail reveal rules.

## 8. Routing and navigation

Canonical routes and shell ownership live in [`architecture/hub-information-architecture.md`](architecture/hub-information-architecture.md).

The former future design in which Bonus Games lived at `More → Games` is retired. Existing `/games/*` and Euro routes may remain as compatibility paths until migrated, but they do not define the platform architecture.

## 9. Implementation relationship

The Euro baseline implements Original Predictor, KO Predictor, tournament LMS and tournament Predictor Cup machinery. The reusable competition-season catalogue and substantial backend authorities for season Match Predictor, season LMS and Predictor Championship are also present, including recurring jobs, scoring/settlement, standings, repeatable instances, the complete Contract 107–109 LMS restart lifecycle and split persistence. Contract 109 derives the next eligible future league matchweek from the established lock authority and creates the successor calendar exactly once; the backend restart deferral is closed. Contract 110 supplies the Championship's round calendar, without which `bonus_cup_fixtures.window_id` being `NOT NULL` meant no season Championship fixture could be stored in either phase. Contract 111 launches a private season Championship from that calendar; the public one waits for the multi-group driver. Contract 113 gives each round the window it is played over, and Contract 114 gives the season matchweek card its bounded browser path, which is what `fixtureReassignment.ts` resolves a moved kickoff against; rounds bound the time they are played rather than tiling the calendar, so a midweek date between matchweeks belongs to no round and a move into it is refused rather than guessed. Contract 112 adds the provider identity map, which relates a provider's season, round and team identifiers to these rows and is what every ingestion step was blocked on; it imports no fixture, because the authority for a moved kickoff resolves by round window and no window authority exists yet. The Championship still needs its phase driver, and all season games still need bounded browser reads and product surfaces. Those remaining journeys land through the roadmap sequence—backend presence is not a completed user journey.

Physical compatibility objects such as `entries`, `bonus_competitions`, `bonus_competition_entrants`, `bonus_score_events` and `bonus_cup_*` may be extended safely rather than renamed for presentation. Current code/tests and verified hosted evidence decide what is live.

## 10. Guardrails

1. No combined entry, score or standings authority.
2. No automatic game entry.
3. No creator-custom scoring.
4. No managed entrants outside LMS without a new decision.
5. No payment, pot, prize or stake administration.
6. No silent feature disappearance when hosted configuration is absent; show an honest state.
7. No production registration opening without a deliberate recorded instant.
8. Privacy and reveal remain server-enforced.
9. The roadmap is the only live execution sequence; this file owns structure, not delivery status.
