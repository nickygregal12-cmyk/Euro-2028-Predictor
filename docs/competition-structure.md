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

The Euro baseline implements Original Predictor, KO Predictor, tournament LMS and tournament Predictor Cup machinery. The reusable competition-season catalogue and substantial backend authorities for season Match Predictor, season LMS and Predictor Championship are also present, including recurring jobs, scoring/settlement, standings, repeatable instances, the complete Contract 107–109 LMS restart lifecycle and split persistence. Contract 109 derives the next eligible future league matchweek from the established lock authority and creates the successor calendar exactly once; the backend restart deferral is closed. Contract 110 supplies the Championship's round calendar, without which `bonus_cup_fixtures.window_id` being `NOT NULL` meant no season Championship fixture could be stored in either phase. Contract 111 launches a private season Championship from that calendar; the public one waits for the multi-group driver. Contract 113 gives each round the window it is played over, and Contract 114 gives the season matchweek card its bounded browser path, which is what `fixtureReassignment.ts` resolves a moved kickoff against; rounds bound the time they are played rather than tiling the calendar, so a midweek date between matchweeks belongs to no round and a move into it is refused rather than guessed. Contract 112 adds the provider identity map, which relates a provider's season, round and team identifiers to these rows and is what every ingestion step was blocked on; it imports no fixture, because the authority for a moved kickoff resolves by round window and no window authority existed yet. Contract 115 supplies the last missing link on the ingestion side: `pg_net` was available and not installed, so the database could make no outbound HTTP request and the deployed provider Edge Function had a scheduler that could not reach it. It installs the extension, forbids any browser-reachable function in an exposed schema from calling into `net`, and drives the Edge Function from `pg_cron` at each target's declared cadence — importing no fixture and recording no target, so nothing is polled until an operator configures one. Contract 117 then gives a provider kickoff change a repeatable path to the fixture: it revises an existing kickoff and refuses to create, delete or move a fixture between rounds, so a rescheduled match keeps the matchweek it was scheduled in. Contract 119 then gives that fixture its own lock: its prediction stays editable to its own kickoff, while every matchweek nobody disturbed still locks together at its earliest. Contract 116 lets a season Last Man Standing entrant SEE the round they can already pick in: contract 86 widened the selection trigger to season fixtures, but the read was never widened — `get_my_lms` resolves every window through `bonus_window_fixtures` joined to `public.matches`, so a season round comes back with an empty fixture array. `get_season_lms_round` reads `season_cup_window_fixtures` joined to `season_fixtures`, returns one round — the earliest still open to a pick — and answers survival from `predictor_internal.season_lms_pick_outcome`, the same authority the settlement replay folds over, rather than handing a browser raw scores to judge, because a season fixture carries no winner column. Nothing about any other entrant appears in it; no table grant is added and no rule moves. Contract 120 gives the Championship's phase and continuing table a bounded browser read: contract 102 persisted the split phase and contract 105 derived its continuing table, and until now no browser-reachable function read either. The Championship still needs its phase driver, and the remaining season games still need bounded browser reads and product surfaces. Those remaining journeys land through the roadmap sequence—backend presence is not a completed user journey. **Contract 121 gives a season its play context**: which season a URL means and which matchweek its card opens at — the two facts that kept the season Match Predictor surface off the production route table. The slug lives in `public.competitions`, revoked from every browser role, and two seasons sharing a `season_key` are told apart only by `competition_id`; `(competitions.slug, tournaments.season_key)` is a real composite key because both are unique. It decides nothing new — `predictor_internal.next_eligible_league_round` has answered the matchweek question since contract 109, ordering by the derived lock instant rather than by `ordinal` so a rescheduled season resolves to the round that actually locks next. A season past its last lock reports a null matchweek; an unknown or tournament-shaped competition raises. **Contract 122 makes ADR 0012's two retention tables answerable. Contract 123 keeps that window fresh: contract 117 moves the kickoffs contract 113's stored span is derived from, and a refresh whose proposed span would overlap another round's window leaves the old window intact and queues a row for review rather than raising, which is what stops a derived view's recomputation being able to fail a provider import. Contract 124 then makes the Championship split actually happen — the phase-transition driver contracts 102, 105 and 120 were all waiting on, reading its plan from the launch record, carrying points and draw numbers, eliminating nobody, and letting the smaller half finish its round-robin early rather than giving it a calendar of its own. Contract 125 then closes the one that was holding all of them: a season fixture could not be given a result at all, so nothing downstream of a result had anything to show. Contract 126 then narrows a refusal that was firing too early: leaving a Last Man Standing competition blocked re-entry from the moment it was published, when ADR 0013 closes entry only once the first round locks.** Contract 127 then opens a season competition for play at all: measured, both season Last Man Standing competitions hold no round and no setup row, and both season Championships hold no group because contract 111's launch driver has never had a caller — so an administrator call writes the public Classic setup ADR 0022 pins, generates a first instance's calendar from the same derivation contract 109 uses for a successor, and hands the Championship to contract 111 unchanged. It is an operator action rather than a job, because the launch fixes the draw at whatever field size it finds. Contract 128 then gives a season league a standings table of its own: `get_league_members` derives every metric from `standing_metrics`, `score_events`, `matches` and `match_predictions`, which a competition season writes none of, so a league on a season returned every member on zero in alphabetical order with no error — the sixth instance of that shape. It is a new read rather than a widened one, because ADR 0012 ranks a season on cumulative points and pairs the total with matchweeks played while the tournament table carries five approved final tie-breakers; the totals come from `season_standings` so a league cannot disagree with the season, the rank is recomputed inside the league because a private league is its own table, and the tournament read now refuses a season league by naming the one that answers. Contract 129 then gives a season a head-to-head at all — `get_rival_entry` reads `entry_totals`, `match_predictions` over `public.matches` and `predicted_progression`, none of which a competition season writes — and its reveal boundary is the MATCHWEEK's own lock rather than the one tournament instant, hiding rather than revealing when a round's kickoffs are incomplete. Contract 130 adds the prediction consensus keyed on the round for the same reason, reusing contract 61's minimum cohort of ten but counting the entries that predicted THAT matchweek, since a season with fifty entrants of whom six played matchweek 30 is exactly what the protection exists for. Contract 131 makes contract 122's retention tables able to name their players, optionally and off by default, adding the flag as a required fourth parameter and retiring the three-argument form by revoking rather than dropping it, and mapping over what the parity-checked authorities returned so their order and their agreement with `standings.ts` are untouched. `monthlyStandings` and `rollingFormPoints` have existed in `src/domain/season/standings.ts` since contract 94 and were called by nothing. A matchweek belongs to exactly one month because `season_matchweek_scores` is keyed per matchweek and never per fixture, so the only question is which instant names it: the round's `window_opens_at`, read in the competition's `display_timezone`, because a month boundary is not a UTC fact — a 23:30Z kickoff on 31 July is August in Europe/London. An unplaceable settled matchweek refuses the whole monthly table rather than misranking a month. Form needs no calendar and answers on a season whose windows were never derived. The migration runs contract 113's deriver once per league season, which nothing had ever called; keeping the windows fresh is deliberately left open, because re-deriving after contract 117's provider import could make an ordinary import start failing when a postponed fixture extends a round's span into the next one's.

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

## Contract 132 provider-calendar note

For supported domestic season competitions, contract 132 may create the initial canonical teams, rounds and scheduled fixtures only from a complete approved provider proposal set. It does not change competition scoring rules and does not confirm results automatically.

> **Contract 133 boundary (8 August 2026):** Contract 133 makes multiple season Predictor Championship instances observable to entitled players without changing the competition format: the current public instance remains discoverable, while a private instance is returned only to its existing entrants.

> **Contract 145 boundary (10 August 2026):** Contract 145 closes the atomicity half of risk-register `DATA-007`. `enforce_rate_limit` counted, compared and then inserted with nothing between the read and the write, so under the read-committed isolation the Data API uses, concurrent transactions for one caller each observed a count below the ceiling and all proceeded — a limit that could be overshot simply by running the attempts in parallel, which a scripted client does and a human never does. It now takes a transaction-scoped advisory lock keyed on the caller before the prune, the count and the insert, the same idiom `20260727191942_operating_cap_enforcement.sql` has always used for the two site-wide counters. One key per caller and never per action, so the function cannot hold two of its own locks and cannot deadlock against itself. It moves **no** relation, policy, trigger, threshold, grant or rule, and changes no scoring, lock, settlement, progression or reveal. It closes the atomicity half **only**: invalid operations still consume no limit, the expensive read RPCs are still unbounded, and there are still no edge/IP controls or alerting — so `DATA-007` stays open, reduced, and `SEC-001` is reduced rather than closed.

> **Contract 144 boundary (9 August 2026):** Contract 144 gives an already-mapped provider team a place to keep its current provider-supplied profile facts — name, short code, founded year, country, venue and image reference — in `predictor_internal.provider_team_profiles`, with a definer writer that derives provider and fetch instant from contract 112's custody row rather than accepting them from its caller, refuses evidence older than the fact it would replace, and advances `last_changed_at` only when a fact actually changed. It is **not** a second identity system: `provider_entity_map` remains the authority for which provider team is which of ours, and the profile row is keyed on that mapping. It is **not** a result path — nothing in it writes a fixture, score, status, lock, settlement or progression, and missing enrichment stays a normal no-data state rather than becoming a game-correctness dependency. The writer is granted to **nobody**, `service_role` included, so the provider poll gains no enrichment side effect merely because storage now exists; a Development backfill is an explicit operator action through its own `workflow_dispatch` job, which refuses unless Development already holds contract 144 and refuses the Production project by name. Provider image URLs are retained for provenance only and establish no right to render or re-host club imagery — the shirt a player sees still comes from contract 136's owner-controlled reference.

> **Contract 143 boundary (9 August 2026):** Contract 143 implements ADR 0026's `EURO-002`: one server-owned Euro 2028 publication state with the lifecycle `hidden -> prelaunch -> registration-open -> live -> completed -> archived`, defaulting to `hidden` so publication fails closed before any owner acts. A bounded `euro_publication_state()` read exposes the state and the instant it last changed and nothing else, and it is the second function an anonymous visitor may execute — deliberately, because ADR 0026 requires the public site and its route guard to fail closed from server truth rather than from a client-side catalogue filter. Mutation is narrower than ordinary competition administration: `admin_transition_euro_publication_state` is granted to `authenticated` only, refuses inside on `super_admin`, advances one adjacent state at a time, and demands both an expected current state and a reason it appends to an immutable history. **It does not publish Euro 2028 and it does not address `EURO-001`** — Euro is still reachable from the weekly platform, which stays a recorded defect. `EURO-003` and `EURO-004` are its consumers and remain unbuilt.

> **Contract 142 boundary (9 August 2026):** Contract 142 maps SportMonks state 22 to `in_play`, measured from retained payloads rather than documentation — the same fixture carried that token with a different score at different times, and a score cannot change after full time. It writes no result and settles nothing: it fixes the live projection for a fixture observed during its second half. It is the first thing contract 135's fail-closed vocabulary and contract 138's review queue found together, and it is the case those two were built for. No competition, game, format or membership changes.

> **Contract 140–141 boundary (9 August 2026):** Contract 140 gives a Leave control the fact it needs to predict itself — `leave_competition_game` refuses once a `bonus_score_events` row exists for the caller and nothing exposed that, so the dashboard could only render a control the server would refuse or hide one that would have worked. Contract 141 derives recent club form and club head-to-head from settled season fixtures alone, which the enrichment plan classes as derive-ourselves work and which contract 135 made possible by producing results at all. Neither reads a prediction, an entry or a score event, and neither costs a provider request. Neither changes a competition, game, format or membership.

> **Contract 138–139 boundary (9 August 2026):** Contract 138 gives an administrator the provider review queues nothing could see — measured, seven append-only queues existed and the only browser-reachable functions naming any of them were contract 132's two decision writers, so an administrator could approve a calendar they could not see and could not see the other six at all. It reads all of them bounded per section and lets an administrator acknowledge an item, which contracts 117 and 123 had always anticipated with a `reviewed_at` nothing ever set; acknowledging is never a decision about the item. Contract 139 gives a season a fixtures read at all, ordered by kickoff and labelled by round, closing the ADR 0020 amendment item that had no implementation because a season had no fixture list: a match postponed out of matchweek 5 into November now sorts into November while still saying Matchweek 5. Neither changes a competition, game, format or membership.

> **Contract 137 boundary (9 August 2026):** Changes no competition, game, format or membership; it is a
> correction to presentation reference data.

> **Contract 135–136 boundary (9 August 2026):** Neither changes a competition, game, format or
> membership. Contract 135 changes who may write the RESULT of a league-season fixture: a measured
> provider final status now does so with no human action, under the owner's ADR 0020 amendment, while
> the tournament path keeps the protected confirmation gate in full. What a competition consists of is
> untouched — a fixture this platform does not hold is still not created by ingestion. Contract 136 is
> presentation reference data: a club code and colours.

> **Contract 134 boundary (9 August 2026):** Contract 134 changes no competition, game, format or membership. It revokes browser privileges on `public.rate_limit_events`, an application-wide abuse control that belongs to no competition, closing risk-register `DB-005`.
