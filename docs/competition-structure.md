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

The Euro baseline implements Original Predictor, KO Predictor, tournament LMS and tournament Predictor Cup machinery. The reusable competition-season catalogue and substantial backend authorities for season Match Predictor, season LMS and Predictor Championship are also present, including recurring jobs, scoring/settlement, standings, repeatable instances, the complete Contract 107–109 LMS restart lifecycle and split persistence. Contract 109 derives the next eligible future league matchweek from the established lock authority and creates the successor calendar exactly once; the backend restart deferral is closed. Contract 110 supplies the Championship's round calendar, without which `bonus_cup_fixtures.window_id` being `NOT NULL` meant no season Championship fixture could be stored in either phase. Contract 111 launches a private season Championship from that calendar; the public one waits for the multi-group driver. Contract 113 gives each round the window it is played over, and Contract 114 gives the season matchweek card its bounded browser path, which is what `fixtureReassignment.ts` resolves a moved kickoff against; rounds bound the time they are played rather than tiling the calendar, so a midweek date between matchweeks belongs to no round and a move into it is refused rather than guessed. Contract 112 adds the provider identity map, which relates a provider's season, round and team identifiers to these rows and is what every ingestion step was blocked on; it imports no fixture, because the authority for a moved kickoff resolves by round window and no window authority existed yet. Contract 115 supplies the last missing link on the ingestion side: `pg_net` was available and not installed, so the database could make no outbound HTTP request and the deployed provider Edge Function had a scheduler that could not reach it. It installs the extension, forbids any browser-reachable function in an exposed schema from calling into `net`, and drives the Edge Function from `pg_cron` at each target's declared cadence — importing no fixture and recording no target, so nothing is polled until an operator configures one. Contract 117 then gives a provider kickoff change a repeatable path to the fixture: it revises an existing kickoff and refuses to create, delete or move a fixture between rounds, so a rescheduled match keeps the matchweek it was scheduled in. Contract 119 then gives that fixture its own lock: its prediction stays editable to its own kickoff, while every matchweek nobody disturbed still locks together at its earliest. Contract 116 lets a season Last Man Standing entrant SEE the round they can already pick in: contract 86 widened the selection trigger to season fixtures, but the read was never widened — `get_my_lms` resolves every window through `bonus_window_fixtures` joined to `public.matches`, so a season round comes back with an empty fixture array. `get_season_lms_round` reads `season_cup_window_fixtures` joined to `season_fixtures`, returns one round — the earliest still open to a pick — and answers survival from `predictor_internal.season_lms_pick_outcome`, the same authority the settlement replay folds over, rather than handing a browser raw scores to judge, because a season fixture carries no winner column. Nothing about any other entrant appears in it; no table grant is added and no rule moves. Contract 120 gives the Championship's phase and continuing table a bounded browser read: contract 102 persisted the split phase and contract 105 derived its continuing table, and until now no browser-reachable function read either. The Championship still needs its phase driver, and the remaining season games still need bounded browser reads and product surfaces. Those remaining journeys land through the roadmap sequence—backend presence is not a completed user journey. **Contract 121 gives a season its play context**: which season a URL means and which matchweek its card opens at — the two facts that kept the season Match Predictor surface off the production route table. The slug lives in `public.competitions`, revoked from every browser role, and two seasons sharing a `season_key` are told apart only by `competition_id`; `(competitions.slug, tournaments.season_key)` is a real composite key because both are unique. It decides nothing new — `predictor_internal.next_eligible_league_round` has answered the matchweek question since contract 109, ordering by the derived lock instant rather than by `ordinal` so a rescheduled season resolves to the round that actually locks next. A season past its last lock reports a null matchweek; an unknown or tournament-shaped competition raises. **Contract 122 makes ADR 0012's two retention tables answerable. Contract 123 keeps that window fresh: contract 117 moves the kickoffs contract 113's stored span is derived from, and a refresh whose proposed span would overlap another round's window leaves the old window intact and queues a row for review rather than raising, which is what stops a derived view's recomputation being able to fail a provider import. Contract 124 then makes the Championship split actually happen — the phase-transition driver contracts 102, 105 and 120 were all waiting on, reading its plan from the launch record, carrying points and draw numbers, eliminating nobody, and letting the smaller half finish its round-robin early rather than giving it a calendar of its own. Contract 125 then closes the one that was holding all of them: a season fixture could not be given a result at all, so nothing downstream of a result had anything to show.** `monthlyStandings` and `rollingFormPoints` have existed in `src/domain/season/standings.ts` since contract 94 and were called by nothing. A matchweek belongs to exactly one month because `season_matchweek_scores` is keyed per matchweek and never per fixture, so the only question is which instant names it: the round's `window_opens_at`, read in the competition's `display_timezone`, because a month boundary is not a UTC fact — a 23:30Z kickoff on 31 July is August in Europe/London. An unplaceable settled matchweek refuses the whole monthly table rather than misranking a month. Form needs no calendar and answers on a season whose windows were never derived. The migration runs contract 113's deriver once per league season, which nothing had ever called; keeping the windows fresh is deliberately left open, because re-deriving after contract 117's provider import could make an ordinary import start failing when a postponed fixture extends a round's span into the next one's.

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

Contract 118 makes the games hub listing competition-neutral: a season window's fixtures reach `get_bonus_games` through `predictor_internal.bonus_window_fixture_facts`, so a season competition's rounds advance in the hub as a tournament's always did.
