# ADR 0020 — Football Prediction Hub product model

- **Status:** Accepted direction — partially implemented
- **Date:** 1 August 2026
- **Supersedes:** the product-positioning and rehearsal-name deferral in ADR 0019. ADR 0019's club-identity and formal clearance cautions remain relevant to any later distinctive brand.
- **Amends:** five named rules in ADRs 0012, 0013 and 0014, and the lock-policy ownership in ADR 0011. **Amended by its own 5 August 2026 owner amendment below, which reverses § Fixture exceptions: a rescheduled fixture stays in its matchweek and its prediction stays open to its own kickoff, rather than being reassigned to another round.** Every other rule in those records remains authoritative — see [§ Rule reconciliation](#rule-reconciliation-with-adrs-00110014).
- **Amended by:** [ADR 0026](0026-public-site-separation-shared-accounts-and-euro-2028-acquisition.md) — the Context paragraph placing the whole hub on `euro28predictor.com` is superseded by two frontend sites over one shared backend, and § Routes gains the Euro visibility boundary. The product model itself is unchanged.

> **Implementation progress — 5 August 2026.** The competition-season/game data model, separate game memberships, game-owned locks and substantial Match Predictor/LMS/Championship backend authorities are merged. The finished Football Prediction Hub shell, onboarding and complete game surfaces remain governed by ADR 0023 and the target design authority.

## Context

The repository already implements a multi-competition football prediction platform, but its visible root route and application title still present Euro 2028 as the whole product. The owner has now defined the operating product for the 2026/27 rehearsal season.

The platform is football-only. Euro and World Cup tournaments remain focused competitions with their own tournament rules and domains, while domestic league seasons run reusable weekly game formats. The purchased `euro28predictor.com` domain remains useful: it may host the whole private rehearsal hub during 2026/27 and should open directly into Euro 2028 when that tournament becomes the public acquisition event.

> **Superseded in part by [ADR 0026](0026-public-site-separation-shared-accounts-and-euro-2028-acquisition.md), 6 August 2026.** The sentence above is retained as the reasoning of the time; the arrangement it describes is not the decision. `euro28predictor.com` does **not** host the whole hub. There are two frontend sites over one shared backend (`SITE-001`, `SITE-002`): the weekly platform on the eventual umbrella-brand domain (`SITE-003`) and Euro 2028 on the purchased tournament domain (`SITE-004`). One account and one profile work on both (`ACCOUNT-001`), and Euro 2028 is **completely hidden from the weekly platform** until an owner-approved publication state (`EURO-001`). Everything else in this record — the product hierarchy, competition seasons, separately joined games and game-owned locks — is unchanged.

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

A domestic Main Predictor matchweek locks exactly at its earliest kickoff, with no buffer. Abandoned matches wait for the replay or official completion. Admin overrides are permitted and permanently audited.

Domestic Main Predictor has **ten whole-matchweek Jokers**:

- five available in the first half of the season, five in the second;
- unused first-half Jokers do not carry forward;
- **a maximum of one Joker per matchweek**;
- a Joker doubles the points earned from that **whole matchweek**, not from a single fixture;
- the Joker is declared before the matchweek locks and attaches to the matchweek, never to an individual fixture.

Scottish league implementations must parameterise the season shape rather than assume 38 matchweeks, and their half-season Joker boundary is computed from the configured round count rather than inherited from the Premier League. The boundary is derived from competition structure and is deliberately **not** tied to the SPFL post-split phase.

### Fixture exceptions

A fixture postponed or materially rescheduled before it completes **is reassigned to the round its new kickoff falls in**, and its prediction becomes editable again under that round's lock. This reverses ADR 0012's decision to freeze such a prediction indefinitely: a fixture replayed months later is played in a materially different context — form, injuries, and often a title or relegation situation that did not exist when the prediction was made.

**This is reassignment, not unlocking, and the distinction is binding.** ADR 0011's lock law is unchanged and remains authoritative:

- a locked round **never** reopens, whatever subsequently happens to the fixture list;
- the round lock stays derived from the earliest kickoff among the fixtures **currently assigned** to that round;
- the per-match guard remains the integrity floor — no prediction is accepted for any match after that match's own kickoff, enforced server-side;
- locks continue to fail closed on stale, unavailable or invalid fixture data.

What moves is the fixture, not the lock. Completed fixtures and the points already earned from them are never altered, and the originating round's settled points stand.

Because the Joker attaches to the matchweek rather than to a fixture, a departing fixture does not carry a Joker with it. The Joker continues to double whatever that matchweek's remaining fixtures earn, and the round displays that it settled on a reduced fixture set.

### Lock policy is owned by the game, not the competition

`bufferMinutes` must not remain a property of the competition season. Two games inside one competition legitimately need different deadlines, so lock policy moves to the game:

| Game | Lock |
| --- | --- |
| Main Predictor (domestic) | exactly at the matchweek's first kickoff; no buffer |
| Last Man Standing | 30 minutes before the round's first relevant kickoff |
| Euro Original Predictor | single tournament-start lock |
| Any other game | explicit game-owned policy; no inherited default |

The derived-lock, monotonicity, per-match-guard and fail-closed rules in ADR 0011 apply to every game policy. A game policy chooses its buffer and scope; it cannot opt out of the integrity floor.

### Last Man Standing

Users opt into Last Man Standing separately. A global game accepts entry only at its start, while private LMS competitions may be created to begin at a later matchweek. LMS presents survival and selection state rather than pretending to be a points leaderboard.

ADR 0013 remains the domestic LMS authority in full, including entry timing, team reuse, the mandatory team-pool reset, postponement handling, public and private endgames, and the available presets.

**Leave and rejoin, reconciled with ADR 0013.** A user may leave an LMS competition, but may **not** rejoin that same running competition — an entrant returning with an unused team pool while survivors have burned eight teams is a structural advantage, which is why ADR 0013 rejects rolling entry. They may enter the next LMS competition, which open continuously, or a newly created private LMS beginning at a later matchweek.

Main Predictor and Predictor Championship are accumulation games where late or resumed entry is a self-correcting disadvantage, so ordinary leave and rejoin from a later unlocked matchweek applies to them.

### Predictor Championship

Predictor Championship runs every matchweek of the selected domestic competition. Each head-to-head fixture compares the participants' total Main Predictor points for that matchweek and awards football standings points:

- win: 3;
- draw: 1;
- loss: 0.

**Predictor Championship is the interface name for the game the repository implements as the Predictor Cup.** This is a display-label change only. Internal identifiers — `bonus_cup_*` tables, `get_my_cup` and the other RPCs, existing migration filenames — are deliberately left unchanged. A schema rename would consume a migration against contract 64 and add risk without product benefit.

**ADR 0014 remains the format authority in full and is not restated here.** Its deterministic model governs: a group is capped at 20 entrants, `meetings = floor(remaining_rounds / (N − 1))`, an odd meeting count produces a split and an even count a seeded knockout playoff, fields of 21 or more use balanced groups with cross-group ranking by points per game, and the format arithmetic runs on *remaining* rounds so mid-season starts are handled by the same calculation.

Knockout ties use the approved sequence already documented in [`../predictor-cup-rules.md`](../predictor-cup-rules.md): normal points, then the Extra-Time Accuracy Score, then the mandatory Penalty Number, which is opposite-parity and therefore cannot end in a draw.

**Entry timing:**

- the global competition closes entry at Matchday 1;
- a private competition may start later wherever ADR 0014's scheduling formula proves the remaining calendar completes a valid format.

There is no fixed minimum-matchweek threshold. The deterministic calculator already answers the question, and a hard-coded floor would contradict it at some field sizes.

For the Scottish Premiership, only 33 rounds are known when the season begins because post-split fixtures are not announced until the split occurs. Size the league phase against the known calendar and let the five post-split rounds serve as the finish, per ADR 0014.

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

> **Clarified 6 August 2026.** "Fixture changes import automatically" was never a single rule and had begun to read as one. The boundary is by change class, and it is stated in full in [ADR 0023](0023-hub-information-architecture.md) § Administration and provider changes: an existing correctly mapped fixture's **kickoff** may be revised automatically under the delivered safeguards (`INGEST-001`), while a **newly discovered** fixture, a removal, a cancellation, an abandonment, a material identity change or a material round change each require administrative approval (`INGEST-002`, `INGEST-003`). Ambiguity fails closed (`INGEST-004`). The last sentence above is unchanged and is the reason the rest can be permissive: provider data never becomes official result truth automatically (`INGEST-006`).

The rehearsal includes in-app and email reminders one hour before a lock only when the user has incomplete predictions. Users control notifications per competition and per game.

### Routes

Competition routes use stable slugs:

```text
/competitions/premier-league/2026-27
/competitions/scottish-premiership/2026-27
/competitions/euro/2028
```

Game routes are children of the competition season. Existing Euro routes may remain temporarily as compatibility paths while the full competition-scoped routing migration is completed.

> **Amended by [ADR 0026](0026-public-site-separation-shared-accounts-and-euro-2028-acquisition.md), 6 August 2026.** The slug shapes above are unchanged, but they no longer all live on one site. `/competitions/euro/2028` belongs to the Euro site; while the Euro publication state is `hidden` it must not be reachable on the weekly platform — including as a guessable path, in the sitemap or in Open Graph content (`EURO-003`). A route is withheld by a server-owned visibility state and a route guard (`EURO-004`), never by omission from a client catalogue.

## Rule reconciliation with ADRs 0011–0014

An earlier draft of this record was written from the owner brief and contradicted ADRs 0012, 0013 and 0014 while claiming to supersede only ADR 0019. That is corrected here. This section is the complete list of amendments; **anything not named below remains authoritative in its original record.**

| # | Rule | Superseded position | Position now in force |
| --- | --- | --- | --- |
| 1 | Joker count | ADR 0012: eight per season, split four and four | **Ten per season, split five and five**, no carry-over between halves |
| 2 | Joker unit | Earlier draft of this ADR: per fixture, more than one per matchweek | **Whole matchweek, maximum one per matchweek** — ADR 0012's matchweek unit is *upheld*, not superseded |
| 3 | Postponement after lock | ADR 0012: the prediction stands, locked, and scores whenever played | **The fixture is reassigned to its new round and the prediction is editable under that round's lock**; ADR 0011 monotonicity is preserved |
| 4 | Lock policy ownership | ADR 0011/0013: buffer carried by the competition season; 30 minutes applied competition-wide | **Buffer and scope are owned by the game.** Main Predictor 0, LMS 30 |
| 5 | Championship entry close | ADR 0014: entry closes at the draw; the first public Cup opens once the field justifies it | **Global entry closes at Matchday 1**; private starts are governed by the ADR 0014 formula |

Explicitly **unchanged** and still binding: ADR 0012's scoring values, non-cumulative exact-score rule, rolling entry, cumulative-total ranking law and secondary-ranking prohibition on feeding back into the total; every ADR 0013 rule except the buffer ownership in row 4 and the leave/rejoin clarification above; every ADR 0014 format, tie-break, draw-publication and jokers-never-apply-to-Cup rule except row 5; and every ADR 0011 rule including derived locks, monotonicity, the per-match guard and fail-closed behaviour.

### Recorded reversal — the per-fixture Joker

The owner brief specified ten per-fixture Jokers with more than one usable per matchweek. That is reversed here in favour of a single whole-matchweek Joker, on ADR 0012's arithmetic rather than on precedent.

Ten doubled fixtures across roughly 380 in a season contribute about 2.6% of a season total — decorative rather than strategic, and not worth the interface, scoring and parity cost of a per-fixture token. Applied to a whole matchweek the same ten contribute on the order of 20%, which is close to the calibration the shipped tournament game already uses at five Jokers over thirty-six group matches. The matchweek unit is also materially easier to explain, to display and to reason about when a fixture leaves the round.

This is recorded rather than silently applied because it reverses a direct owner instruction, and because ADR 0012 had already reached the same conclusion by the same arithmetic — a second record arriving at the opposite answer would have been the more suspicious outcome.

### Owner amendment, 5 August 2026 — a rescheduled fixture does not move rounds

**This reverses § Fixture exceptions above.** That section says a postponed or
materially rescheduled fixture "is reassigned to the round its new kickoff falls
in". The owner's decision is that it is **not** reassigned:

- **the fixture stays in the matchweek it was scheduled in.** It still belongs to
  that round for prediction, scoring, settlement and the matchweek Joker;
- **its prediction stays editable until that fixture's own kickoff**, whether it
  is replayed midweek alongside other games or on its own;
- **a single moved match never creates a round of its own.** This was named
  explicitly for Last Man Standing, where one rearranged fixture must not become
  a round; it holds generally;
- **the round is a label, not a position.** The fixture is still *titled* a
  Matchweek 3 game after it is replayed past Matchweek 4, and it still scores
  into Matchweek 3 — but anywhere fixtures are listed by date it appears at its
  ACTUAL kickoff, in true chronological position, carrying its original
  matchweek as its label.

That last point is the one an implementation is most likely to get wrong in the
comfortable direction. Grouping strictly by round is the easy read of "it stays
in Matchweek 3", and it produces a fixture list where a match played in
November sits under a heading from September, above matches that were played
weeks earlier. What the owner asked for is the opposite: **order by kickoff,
label by round.** Round membership decides scoring; the kickoff decides where it
is shown and when it locks.

### Owner decision, 5 August 2026 — which fixtures get their own lock

The amendment above says a rescheduled fixture's prediction stays open to its
own kickoff. Making that executable exposed a fork the amendment does not
settle, because two readings share the same arithmetic:

- **only a rescheduled fixture** gets its own lock, and every other matchweek
  keeps locking together at its earliest kickoff;
- **every fixture** locks at its own kickoff, moved or not.

They agree on every fixture that moved, so no test of a moved fixture can tell
them apart. They differ on the ones nobody touched: applied universally, an
ordinary Friday-to-Monday matchweek becomes predictable in stages, and Monday's
game could be predicted knowing Saturday's results.

**The owner chose the narrow reading.** An ordinary matchweek locks together
exactly as it does today; a fixture gets its own lock only because it moved.
That preserves the fairness property the season Match Predictor already had.

"Moved" is a stored fact rather than an inference: a fixture is rescheduled when
`predictor_internal.season_fixture_revisions` holds a row for it, which is
contract 117's append-only record of what a provider changed. The alternative —
deciding a fixture moved because its kickoff falls outside some window — would
need that window defined, and would silently reclassify fixtures whenever the
definition was tuned.

The rule is strictly permissive. A fixture's own kickoff is never earlier than
its round's earliest, so the instant this produces is never earlier than the
matchweek instant: no prediction that was legal becomes illegal, and no player
loses a window they had.

**Why this is simpler than what it replaces, and not merely different.** The
machinery it needs already exists. § Fixture exceptions already states the
per-match guard as the integrity floor — "no prediction is accepted for any
match after that match's own kickoff, enforced server-side" — and Stage C1's
lock enforcement already compares against each fixture's *current* kickoff. This
amendment promotes that guard from a floor to the operative rule for a moved
fixture, rather than introducing anything new.

It also removes a whole class of question that reassignment created. Nothing has
to decide which round a midweek date belongs to, no boundary has to be placed
between two matchweeks, a fixture cannot land in a round nobody predicted it in,
and points cannot move between matchweeks after the fact. The reduced-fixture-set
label and the Joker rules are unaffected, because the fixture never leaves.

ADR 0011's lock law is untouched and still authoritative: a locked round never
reopens, and the round lock stays derived from the earliest kickoff among the
fixtures assigned to it. What this amendment changes is that a rescheduled
fixture's *own* prediction remains open to its own kickoff — the round is not
reopened for anything else.

**What this supersedes in the repository, stated so it is not discovered later:**

- `src/domain/season/fixtureReassignment.ts` decides a destination round by
  window and returns `reassign` / `kickoff_revision` / `refused`. Its
  reassignment model is superseded; the kickoff-revision and audit halves remain
  meaningful. It has no caller today.
- Contract 113 gave `competition_rounds` a play window and a resolver in order to
  answer "which round does this kickoff fall in". **That question is no longer
  asked by reassignment.** The window remains a true and useful fact — it is when
  a round is played — but this amendment removes its original consumer, and any
  later use of it needs its own justification rather than inheriting this one.

### Owner amendment, 9 August 2026 — a provider result is official for a league season

**This reverses § Ingestion's provisional-only rule for league seasons, and only
for league seasons.** That section, and `INGEST-006` beside it, said that
provider data never becomes official result truth automatically and that
protected confirmation remains the scoring and progression gate.

The owner's decision, in their own words: the provider **is** final truth for
awarding points, and it must remain auditable and correctable from the admin
panel in the unlikely event a correction is needed.

**What is now in force**

1. A provider status that this platform has measured as meaning *finished*, with
   both scores present, writes the official result of a league-season fixture
   with no human action.
2. That write goes through the same audited writer an administrator uses. It is
   numbered, it records the result it replaced, and it cannot be rewritten —
   a correction is another revision, never an edit.
3. Every provider-written revision is attributable: the provider is named, with
   the archived response behind it.
4. **An administrator's correction ends provider authority over that fixture.**
   Once a signed-in administrator has confirmed, corrected or cleared a result,
   the provider stops writing it and the refusal is recorded rather than
   discarded. A human decision stands until a human changes it.
5. Nothing settles as a side effect. The existing rederivation job produces the
   points, which is also how a correction has always reached the table.

**What this amendment does NOT change**

- **The tournament path.** Euro 2028's results remain confirmable only by a
  signed-in administrator through the tournament RPCs. No part of the provider
  path may so much as name `public.matches` or `public.match_result_revisions`.
- **What a competition consists of.** A fixture this platform does not hold is
  still not created by ingestion. `INGEST-002`, `INGEST-003` and `INGEST-005`
  stand: a newly discovered fixture, a removal, a cancellation, an abandonment
  or a material identity change still requires administrative approval. The
  amendment is about the *result of a fixture we already hold*, and nothing
  wider.
- **Failing closed.** An unmeasured provider status is not a result. A final
  status with no score is not a nil-nil draw. One unmapped identifier still
  fails the whole payload.

**Why it is recorded rather than quietly applied.** It reverses a rule this
repository had made structural: `171_ingestion_write_boundary.sql` existed to
prove no ingestion function could write a result. That guard was amended in the
same change rather than deleted, and now asserts the narrower boundary above —
including that the applier reaches the audited writer and writes nothing itself.
A rule that moves without its guard moving is how the guard comes to pass while
proving nothing.

Implemented by contract 135.

## Consequences

- `/` becomes the authenticated competition hub rather than the Euro dashboard.
- The existing Euro dashboard moves behind the Euro 2028 competition route without changing its scoring or stored data.
- Game engines and entries are reusable products attached to competition seasons, not features owned by one competition.
- Stage C1 remains the persistence dependency for real competition-season records.
- Stage C2 account-erasure/profile-ownership work remains independently blocked by issue #272 and does not block hub surfaces, season configuration or game-rule development.
- The first implementation should favour a thin end-to-end domestic slice while preserving the Euro baseline, rather than another broad generic abstraction phase.
- **`lockPolicy` moves off `CompetitionConfig`.** `src/domain/competition/kinds.ts` currently pins `bufferMinutes` to the competition — 0 for `tournament`, exactly 30 for `league_season`, enforced by `isLeagueSeasonCompetitionConfig`. That guard must become a game-owned policy before the domestic Main Predictor is built, or Predictor and LMS can never hold different deadlines inside one competition season. The refactor is behaviour-preserving for Euro 2028, which has one game policy at zero buffer.
- **Persistence stays split.** Stage C1 (PR #317) carries competitions, rounds, lock events, awards and season-scoping columns only. Competition membership, the game catalogue, game availability, game membership, active/inactive state and join/leave/rejoin audit history belong to a separate **C1b** migration. Folding them into C1 would break `stageC1ContractClassification.test.ts` and `stageC1SchemaOverlayCoverage.test.ts`, which make the approved boundary executable.
- **Domestic Jokers need their own scoring authority** with SQL-versus-TypeScript parity coverage, and `docs/scoring-rules.md` must state that tournament and domestic Jokers are separate rules for separate competitions. ADR 0012's prohibition on merging them into one implementation is unchanged.
- **Fixture reassignment becomes a lock-critical path.** Moving a fixture between rounds changes two derived locks at once, so ingestion must audit the old and new round assignment alongside the kickoff change, and the reduced-fixture-set label required by ADR 0014 applies to any round that settles short.
- Renaming Predictor Cup to Predictor Championship in the interface only means user-facing copy, route labels and help content diverge deliberately from schema identifiers. That divergence should be stated where developers meet it rather than discovered.
