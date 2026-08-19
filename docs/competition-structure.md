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

### What recent contracts meant for competition and game structure

**What each contract *is* lives in [`../CLAUDE.md`](../CLAUDE.md).** This table records only
the consequence for competition, game, format and membership structure, which is the question this document exists to
answer. A contract with no consequence here is **absent rather than restated** —
until 11 August 2026 all eighteen were restated in full, byte-identical to
CLAUDE.md and to five other documents, and the copy was the whole reason the
same paragraph existed in seven places at once.

| Contract | Effect on a competition, game, format or membership |
| --- | --- |
| 133 | **None.** It makes several season Championship instances observable to entitled players without changing the format: the current public instance stays discoverable, and a private instance is returned only to its existing entrants |
| 134 | **None.** It revokes browser privileges on `public.rate_limit_events`, an application-wide abuse control belonging to no competition, closing risk-register `DB-005` |
| 135–136 | **Neither changes a competition, game, format or membership.** Contract 135 changes who may write the RESULT of a league-season fixture — a measured provider final status now does, with no human action, under the owner's ADR 0020 amendment — while the tournament path keeps the protected confirmation gate in full. What a competition *consists of* is untouched: a fixture this platform does not hold is still not created by ingestion. Contract 136 is presentation reference data |
| 137 | **None.** A correction to presentation reference data |
| 138–139 | **Neither changes a competition, game, format or membership** |
| 140–141 | **Neither changes a competition, game, format or membership** |
| 142 | **None** |

| 160 | A competition season may now publish its **own table rules** — points values, ordered tie-breaks, promotion/playoff/relegation boundaries — per season rather than per competition, so a historic table keeps the rules it was played under |
| 166–167 | A Predictor Championship may run as **multiple parallel groups** for a field one group cannot seat, with every group's round-robin over the same windows; a smaller group simply has no fixture in the last rounds |
| 169 | A season Championship group is ranked over **every matchday it has played and settled**, not over the tournament's three; the tournament's own table is unchanged |
| 170 | A matchweek is an ACTION between its play window opening and its own lock — both from the authorities that already own them |
| 171 | A private league larger than a read's cap keeps its LEADER at the top, because the cap now keeps the top rows rather than an arbitrary set |
| 172 | **None.** No competition, game, round, lock or settlement rule moves; three existing jobs acquire a schedule |
| 173 | A settled matchweek is worth telling a player about for **seven days**, which is contract 162's own stated intention made executable rather than a new rule |
| 174 | A fixture may now be **added to or removed from** a season after its calendar was approved — but only by an administrator, and never over a fixture that already carries a result |
| 175–178 | **No structural change.** A projection, a set of derived metrics, a batch submission and an integrity check: none of them alters what a competition is, how it is scored, when it locks or who is in it |
| 179 | **No structural change.** Two reads over private competition containers that already existed. It creates no competition and changes no membership rule |
| 180 | **One structural clarification, and it is the point.** A season prediction entry and a Match Predictor game membership were the same fact; they are now two. `game_definitions.uses_season_prediction_card` says which games READ the shared card, `requires_prediction_entry` keeps saying which game OWNS it, and a card may exist with no membership of the owning game. No scoring value, lock, settlement or reveal rule moves |

| 181 | **No structural change to a competition.** A per-league membership ceiling of 100 on the ordinary private league, enforced on `public.league_members`. It does not govern a private Last Man Standing or Championship container, whose field is not in that table |

| 182 | **No structural change, and one rule pinned.** ADR 0028 § 7 names `cup_season_group_tables` the sole season Championship group-stage authority; a guard now refuses any function that reaches the per-tie rule and also writes the group stage. Nothing about what a competition is, how it is scored or who is in it moves |

| 183 | **No structural change.** Two bounded reads over facts that already exist: a season's clubs, and a window of the standings around the caller |
| 185 | **No competition structural change.** The private AI Lab owns an independent analytical fixture lifecycle and cannot write platform fixtures, official results, scores, locks, standings or progression |

| 184 | **One rule generalised, no structure moved.** Qualification from a Championship group is now defined at every size 3 to 20 rather than at 3 and 4 only. The tournament's own two sizes are unchanged, asserted |

| 186 | **No structure moved.** Where a season group stage ends becomes a stored fact rather than an inference |
| 187 | **The season Championship gains the structure it was missing.** A season group stage is now qualified over the matchdays it actually plays, and its knockout windows are appended after it rather than assumed at the tournament's sequence 4. The tournament's own shape is unchanged, asserted |
| 188 | **No structure moved.** Everything is inside the separately revoked `ai` schema |

*Current to contract 189.*

> **Contract 190:** does not alter competition structure, scoring, entry, or ownership. Its scope is limited to private AI betting-evidence actionability.

> **Contract 191:** does not alter competition structure, scoring, entry, ranking or ownership. It adds a season-scoped player reference to two standings reads and one bounded resolver, and consolidates an existing disclosure rule.

> **Contract 192:** does not alter competition structure, scoring, entry or ranking rules. It derives cumulative position at settled matchweeks from the banked scores that already exist, and adds two bounded reads.

> **Contract 193:** does not alter Championship structure, qualification, seeding, pairing or settlement. It reads the rows the canonical drivers wrote and adds one bounded entrant read.

> **Contract 194:** does not alter Championship qualification, seeding, pairing or scoring. It adds an eligibility question above the existing settlement ladder and leaves that ladder unedited.

> **Contract 195:** does not alter Championship qualification, seeding, pairing, Penalty Number or settlement rules. It reads the conditions `submit_cup_penalty_number` already enforces and turns them into one action item per contestable side.

> **Contract 196:** does not alter any competition outcome, only the date recorded beside it. `survived` is excluded from the consequence feed because it is written every Last Man Standing round for every survivor.

> **Contract 197:** does not alter competition structure. It lists existing season fixtures across the seasons one player has entered, excluding the tournament shape exactly as `get_season_fixtures` refuses it.

> **Contract 198:** a single group is a league and finishes as one; its league is never shortened to fit a bracket, and a knockout follows only when the rounds left after it can hold one. A multi-group competition always ends in a knockout and reserves its calendar first, which shrinks the groups.

> **Contract 199:** does not alter competition structure, scoring, entry, ownership or any player-facing rule. Its scope is the private AI Lab's betting evidence: which of several repeated paper-bet rows counts as evidence for one fixture and market, and whether a settlement may exist without a scoreline.

> **Contract 200:** does not alter competition structure. It states how often the private AI Lab may poll for paid odds prices, and touches no competition, scoring or player relation.

> **Contract 201:** does not alter competition structure. It adds three read-only competition-admin views of the private AI Lab and reports the decisions already recorded there; it evaluates no gate and touches no competition, scoring or player relation.

> **Contract 202:** does not alter competition structure. It widens the private AI Lab's forecast-horizon vocabulary so a fixture is re-forecast as new completed matches arrive, and touches no competition, scoring or player relation.

> **Contract 207:** does not alter competition structure. It redefines one season Championship read at its existing signature, adding the caller's own stored outcome to the payload and narrowing four stage predicates to the knockout stages. No competition, group, fixture or scoring relation changes.

> **Contract 206:** does not alter competition structure. It redefines one season Championship read at its existing signature, naming the phase its membership lookup means so the primary key identifies one row. No competition, group, fixture or scoring relation changes.

> **Contract 205:** does not alter competition structure. It redefines one season Championship read at its existing signature, pinning the caller's seed lookup to their initial membership so the read survives the split phase contract 124 introduced. No competition, group, fixture or scoring relation changes.

> **Contract 204:** does not alter competition structure. It redefines two private AI Lab admin reads at their existing signatures and adds one view in schema `ai`, touching no competition, scoring or player relation.

> **Contract 203:** does not alter competition structure. It redefines the private Bet Builder's two admin reads at their existing signatures so a superseded BET cannot be offered as a leg, and touches no competition, scoring or player relation.
