# Competition context and state contract

**Status: adopted state/context authority.** The tournament-era information architecture previously held in §0 was retired on 3 August 2026; Hub routes and navigation are now governed by [ADR 0023](adr/0023-hub-information-architecture.md) and [`architecture/hub-information-architecture.md`](architecture/hub-information-architecture.md).

**This document states contracts, never implementation status.** Which of them are built is [`quality/current-status.md`](quality/current-status.md)'s answer and only its answer. A dated status paragraph stood here until 11 August 2026, synced on 3 August and never again — the ordinary fate of a moving fact kept in a second place, and the reason `DOC-AI-001` gives every important fact one home. Nothing was lost by removing it: it named no contract the live authority does not, and a reader who wants it has one link to follow.

The multi-competition context and lock generalisation is governed by [ADR 0011](adr/0011-multi-competition-platform.md); season Match Predictor locks and fixture reassignment by [ADR 0012](adr/0012-season-predictor-rules.md) as amended by [ADR 0020](adr/0020-football-prediction-hub-product-model.md); season Last Man Standing by [ADR 0013](adr/0013-last-man-standing-season-rules.md); client-distribution constraints by [ADR 0016](adr/0016-client-and-distribution.md). Where this document and an ADR differ, the ADR wins.

## 0. Platform framing and information-architecture boundary

The app is the **Football Prediction Hub**: several real competition seasons, several independently joined prediction games, one shared identity/social layer and **one authoritative understanding of what is happening now**.

Each game owns its own entry, scoring, standings and progression. A competition season owns real football identity, calendar, fixtures and results. The Hub owns cross-competition navigation and action aggregation.

This document no longer owns navigation. The accepted route tree, onboarding sequence, global Hub shell and focused competition shell are in [`architecture/hub-information-architecture.md`](architecture/hub-information-architecture.md). In particular, the former `Home / Predict / Matches / League / More` plus `More → Games` future design is retired; it remains only as compatibility history for the existing Euro interface until migrated.

## 1. One competition truth, several interpretations

One canonical source exists for: stages/rounds, groups where applicable, teams, fixtures, kickoff times, venues, **official results**, real tables, real knockout progression, awards and completion. Games never keep conflicting copies. Match/Original Predictor, KO Predictor, Predictor Championship, LMS, Matches surfaces and private tables read the same confirmed result; **a correction is entered once and propagates to every affected game**, each recomputing independently.

**Layer laws:**
- Business rules live in `src/domain` and remain pure — no storage, network or ambient clock reads; time is an input.
- Database calls live in `src/services`; **components never import Supabase directly**.
- **One game never imports another game's scoring code.**
- Shared knockout predictions belong to a neutral predictions module, not to KO Predictor or Championship.
- **Competition timing logic exists in exactly one shared place**: the context engine (§3).
- Page-shaped aggregation uses the **read-model pattern**: each major surface gets a bounded purpose-built snapshot rather than assembling raw tables in components.

## 2. Live data vs official truth

A live-score feed supplies **display-only** data — score, minute, period, shootout status and scorers — into a separate provisional path. It never awards permanent points, eliminates an LMS entrant, settles a Championship tie, advances a bracket or confirms a winner.

Valid fixture metadata changes may update the canonical fixture model through the audited ingestion path described by ADR 0023. Official result confirmation/correction remains the protected scoring and progression gate.

## 3. Competition-context engine

The pure resolver lives in [`src/domain/competition/`](../src/domain/competition/) per [ADR 0011](adr/0011-multi-competition-platform.md). It is fake-clock testable and server-time fed. Competition shape is an input to one implementation; parallel tournament and season context engines are prohibited. No page computes phase, day-shape, lock state or urgency itself.

```ts
resolveCompetitionContext(competitionConfig, competitionData, liveData, userData, nowServer)
```

The implemented types and resolver output are authoritative at the code boundary:

- [`src/domain/competition/kinds.ts`](../src/domain/competition/kinds.ts) — competition shape;
- [`src/domain/competition/lockState.ts`](../src/domain/competition/lockState.ts) — scope-resolved locking;
- [`src/domain/competition/context.ts`](../src/domain/competition/context.ts) — phase, day, entry, match collections, game statuses and next action;
- [`src/domain/competition/matchState.ts`](../src/domain/competition/matchState.ts) — individual match states.

**Clock rule:** server time is authoritative for every state boundary; the client clock only renders countdown displays.  
**Dimension rule:** context resolves independent dimensions rather than one giant combined enum.

**Game-owned lock relationship:** the competition supplies identity, calendar and structure; the selected game supplies an explicit lock policy. Current decisions include:

- Match Predictor — round/matchweek lock at earliest assigned kickoff, zero buffer;
- Last Man Standing — round lock thirty minutes before earliest relevant kickoff;
- Euro Original Predictor — one entry lock at tournament start, zero buffer;
- every other game — an explicit compatible policy; no inherited default.

Every policy remains subject to ADR 0011's derived-lock, monotonicity, fail-closed and per-match kickoff guard. A fixture may be reassigned; a locked round never reopens.

**Day-state priority when conditions coexist:** competition complete → any match live → awaiting confirmation → between matches → before first match → day complete → stage transition → rest day → pre-start locked → pre-start open. One live match makes the day `matches_live`; the Today block may still section Live / Finished / Still to play inside it.

Every time-boxed behaviour keys off this engine, not its own clock.

## 4. Individual match-state contract

Every fixture resolves to exactly one:

| State | Meaning |
| --- | --- |
| `scheduled_editable` | Prediction open |
| `scheduled_locked` | Locked, not yet started |
| `in_play_feed` | Live, feed data available |
| `in_play_no_feed` | Kickoff passed, no feed; never invent a score |
| `suspended` | Temporarily stopped, feed-signalled |
| `full_time_unconfirmed` | Feed full-time, or kickoff plus **120 minutes** without a feed; provisional only |
| `confirmed` | Official result stored by authorised operation |
| `scored` | All required game calculations completed |
| `postponed` | Not played and rescheduled |
| `abandoned` | Started and not completed |
| `cancelled` | Provider-facing cancellation mapped to rule-layer **void** semantics |

Provider adapters map their vocabulary explicitly; labels are not assumed equivalent.

`confirmed` and `scored` normally happen in one transaction. Keeping both concepts exposes anomalies if calculation ever fails.

`full_time_unconfirmed` covers the confirmation gap: no permanent points, rank movement, progression or elimination occurs until confirmation.

## 5. Phase and day states

These canonical IDs remain useful for tournament-shaped surfaces:

- **T0** pre-tournament, entries open · **T1** entries locked, tournament not started
- **D0** rest day · **D1** matches today, none started · **D2** matches live · **D3** between matches · **D4** awaiting confirmation · **D5** day complete
- **S1** group stage in progress · **S2** groups complete, knockout fixtures unresolved · **S3** knockout fixtures confirmed, prediction windows open
- **F1** final day pre-kickoff · **F2** final live · **F3** final ended, confirming · **F4** tournament complete after confirmation and settlement

League seasons use the same context dimensions without pretending every season has tournament stages.

## 6. Action priority

Hub and competition pages receive actions from one central resolver rather than inventing urgency locally:

1. account/entry-blocking error;
2. prediction or selection locking inside the urgent window;
3. live match involving an active prediction/game;
4. Predictor Championship decider required;
5. LMS selection required;
6. shared knockout prediction required;
7. incomplete Match or Original Predictor entry;
8. match awaiting attention;
9. new confirmed result or recap;
10. next fixture;
11. invitation/sharing;
12. general browsing.

ADR 0023 controls how many actions each page presents; this list controls priority.

## 7. Competition windows are stored data

The real competition is fixtures and rounds; prediction games operate through **stored windows**, never hardcoded arrays: which fixtures belong, when entry opens, when each prediction locks, when a round can settle, what follows and whether a decider is required.

## 8. Game states and user overlays

Each independently joined game may report:

`not_open | registration_open | entered | registration_closed | waiting_for_draw | waiting_for_round | action_required | round_live | round_awaiting_confirmation | qualified | survived | eliminated | champion | complete`

Canonical precedence:

`complete` → `champion` → `eliminated` → non-entrant registration view → `action_required` → `round_live` → `round_awaiting_confirmation` → `waiting_for_draw` → `qualified` / `survived` → `waiting_for_round` → `entered`.

A window settles only after its boundary and official confirmation requirements. `full_time_unconfirmed` never settles, scores, eliminates or progresses anything.

**Separation law:** no auto-enrolment; one game's points never touch another; private Match/Original leagues never silently become LMS or Championship competitions; every screen names its active game; leaving or losing one game never affects another; corrections recompute independently.

## 9. Result confirmation — one protected operation

All official result mutations pass through one protected confirm/correct authority: validate capability → acquire lock → validate fixture/result → store confirmed score → derive winner/method → recompute affected games independently → update progression/history → append audit → return impact summary.

Nothing ever awards permanent points from a live-feed update.

## 10. Operational overlays

Overlays modify a state, never replace it:

- **Feed unavailable:** keep kickoff-derived state, drop score/minute, state that live updates are unavailable.
- **Confirmation delayed:** public sees awaiting confirmation; nothing permanent moves.
- **Fixture materially rescheduled before completion:** move the fixture to the round its new kickoff belongs to; audit old/new round and kickoff; the originating locked round stays locked and settles on its remaining fixture set; the moved prediction becomes editable under the destination round's lock, subject to the per-match guard. Completed fixtures and points never move.
- **Abandoned:** partial score does not stand; replay/official completion follows the game-specific settlement authority.
- **Void/cancelled:** awards no points and leaves the applicable denominator.
- **Corrected:** all affected games recompute; material changes receive a quiet correction note; audit remains.
- **Round anomaly:** keep unresolved and surface an admin blocker; never invent an outcome.

## 11. Testing contract

Deterministic fixtures under [`tests/domain/competition/`](../tests/domain/competition/) exercise competition shapes through one resolver path, including lock derivation, game-owned buffers, per-match guarding, monotonicity, fail-closed validation and fixture reassignment.

Minimum scenarios include: open incomplete · open submitted · locked before start · first match today · one/two simultaneous live · between matches · awaiting confirmation · day complete · rest day · stage transition · prediction window open · spectator · Championship eliminated/live tie · LMS action required · feed unavailable · postponed/rescheduled · corrected result · competition complete.

Surface migration also requires hostile-data states and a seeded clock driven through complete user journeys.

## 12. Relationship to programme and information architecture

- Product phases: [`architecture/programme-plan.md`](architecture/programme-plan.md)
- Engineering sequence: [`architecture/multi-competition-hub-build-plan.md`](architecture/multi-competition-hub-build-plan.md)
- Information architecture: [`architecture/hub-information-architecture.md`](architecture/hub-information-architecture.md)
- Current execution: [`roadmap.md`](roadmap.md)
- Current implementation/hosted truth: [`quality/current-status.md`](quality/current-status.md)

## 13. Final rule

No page asks *“what state do I think this competition is in?”* Every page asks *“what has the competition-context engine told me to display?”*
