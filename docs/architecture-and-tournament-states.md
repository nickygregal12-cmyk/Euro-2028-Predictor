# Architecture & tournament-state contract

**Status: adopted 2026-07-22 as target design** (adapted from an external architecture proposal — its state engine and contracts accepted; its nav rewrite and `src/` restructure rejected in favour of decided facts).

**Implementation status (synced 2026-07-29):** the layer laws (§1), result-confirmation authority (§9), pure competition-context foundation (§3), individual match-state resolver (§4) and deterministic fake-clock fixtures (§11) are implemented on the Stage B foundation branch. The foundation is deliberately not wired to a rendered surface. The phase/day IDs (§5), Home action queue (§6), competition windows (§7) and competition states (§8) remain target contracts until their consumers migrate. `MatchTemporalState = 'before' | 'during' | 'after'` remains in use in `src/domain/tournament/matchCentre.ts` during that migration.

The multi-competition context and lock generalisation is governed by [ADR 0011](adr/0011-multi-competition-platform.md); season Predictor locks and postponement behaviour by [ADR 0012](adr/0012-season-predictor-rules.md); the season Last Man Standing deadline buffer by [ADR 0013](adr/0013-last-man-standing-season-rules.md); client-distribution constraints by [ADR 0016](adr/0016-client-and-distribution.md). Where this document and an ADR differ, the ADR wins.

## 0. The platform framing

The app is not "an Original Predictor with features attached." It is **a tournament platform**: one real football tournament at the centre; several prediction competitions (Original Predictor, KO Predictor, Last Man Standing, Predictor Cup) each owning its own entry, scoring, standings and progression; one shared identity/social layer; and **one authoritative understanding of what is happening now**.

**Navigation (decided 2026-07-22 — this supersedes the proposal's nav):** the five tabs stay **Home / Predict (→ My entry at lock) / Matches / League / More**, with the top-nav avatar → own Profile and theme toggle. **The Games hub lives under More** (More → Games), alongside Account, How to play, scoring, and legal. Games are surfaced contextually everywhere they matter — Home action cards, the spectator state's pitch, deadline nudges — so the hub is the directory, not the front door.

## 1. One tournament truth, several interpretations

One canonical source exists for: stages, groups, teams, fixtures, kickoff times, venues, **official results**, real tables, real knockout progression, awards, and completion. Competitions never keep conflicting copies. The Original Predictor, KO Predictor, Predictor Cup, LMS, Matches surfaces and league tables all read the same confirmed result; **a correction is entered once and propagates to every competition** (each recomputing independently, per the separation law).

**Layer laws (adopted in place of the proposed `src/` restructure — the current structure stays; these are import rules, enforced in review):**
- Business rules live in `src/domain` (pure — no storage, no clock reads; time is an input).
- Database calls live in `src/services`; **components never import Supabase directly**.
- **Competition code never imports another competition's scoring code.**
- Shared knockout predictions belong to a neutral predictions module — not to KO Predictor or the Cup.
- **Competition timing logic exists in exactly one shared place** (the context engine, §3).
- Page-shaped aggregation uses the **read-model pattern** the repo already practises (`get_league_page` is one): each major surface gets a purpose-built snapshot (RPC-shaped or client-assembled) rather than assembling raw tables per page. New surfaces get snapshots from day one; existing ones migrate opportunistically, never as a big-bang refactor.

## 2. Live data vs tournament truth

Restating the decided law (`design-system.md` → Live data & refresh) in architecture terms: a live-score feed supplies **display-only** data (score, minute, period, shootout status, scorers) into a separate live store. It never writes official results, never triggers scoring, never eliminates an LMS player, never advances a Cup tie, never confirms a real knockout winner. The admin confirms results (feed pre-fills); confirmation is the only gate into scoring.

## 3. The competition-context engine (the core addition)

The pure resolver lives in [`src/domain/competition/`](../src/domain/competition/) per [ADR 0011](adr/0011-multi-competition-platform.md). It is fake-clock testable and server-time fed. Competition shape is an input to one implementation; parallel tournament and season engines are prohibited. No page computes phase, day-shape, lock state or urgency itself.

```ts
resolveCompetitionContext(competitionConfig, competitionData, liveData, userData, nowServer)
```

The implemented types and resolver output are authoritative at the code boundary:

- [`src/domain/competition/kinds.ts`](../src/domain/competition/kinds.ts) — competition shape;
- [`src/domain/competition/lockState.ts`](../src/domain/competition/lockState.ts) — scope-resolved locking;
- [`src/domain/competition/context.ts`](../src/domain/competition/context.ts) — phase, day, entry, match collections, competition statuses and next action;
- [`src/domain/competition/matchState.ts`](../src/domain/competition/matchState.ts) — individual match states.

**Clock rule:** server time is authoritative for every state boundary; the client clock only renders countdown displays. **Dimension rule:** context resolves independent dimensions rather than one giant combined enum.

**Lock relationship:** [ADR 0012](adr/0012-season-predictor-rules.md) defines the season round's base lock as its earliest assigned fixture kickoff. [ADR 0013](adr/0013-last-man-standing-season-rules.md) applies a thirty-minute buffer before that derived instant for season scopes. Both statements are true: the buffer modifies the derived season deadline; it does not replace derivation, monotonicity, fail-closed validation or the per-match kickoff guard required by [ADR 0011](adr/0011-multi-competition-platform.md). Tournament single-entry scopes retain their configured unbuffered behaviour.

**Day-state priority when conditions coexist:** tournament complete → any match live → awaiting confirmation → between matches (some confirmed today, later still to play) → before first match → day complete → stage transition → rest day → pre-tournament locked → pre-tournament open. One live match makes the day `matches_live`; the Today card still sections Live / Finished / Still to play inside it.

**Every time-boxed behaviour already specced keys off this engine**, not its own clock: the 48-hour picks-are-in teaser, matchday recap window, match-window polling, My-entry morph at lock, spectator states and D-day Home layouts.

## 4. Individual match-state contract

The contract contains **eleven states**, not twelve. The previous “twelve-state” wording was a counting error; no synthetic state is added to preserve the old number.

The implemented resolver is [`src/domain/competition/matchState.ts`](../src/domain/competition/matchState.ts), governed by [ADR 0011](adr/0011-multi-competition-platform.md) and the season exception semantics in [ADR 0012](adr/0012-season-predictor-rules.md). Every fixture resolves to exactly one:

| State | Meaning |
| --- | --- |
| `scheduled_editable` | Prediction open |
| `scheduled_locked` | Locked, not yet started |
| `in_play_feed` | Live, feed data available |
| `in_play_no_feed` | Kickoff passed, no feed; never invent a score |
| `suspended` | Temporarily stopped, feed-signalled |
| `full_time_unconfirmed` | Feed full-time, or kickoff plus **120 minutes** without a feed; provisional only |
| `confirmed` | Official result stored by admin |
| `scored` | All required competition calculations completed |
| `postponed` | Not played and rescheduled; governed by ADR 0012 |
| `abandoned` | Started and not completed; governed by ADR 0012 |
| `cancelled` | Provider-facing cancellation vocabulary mapped to ADR 0012 **void** semantics |

The internal/public state remains `cancelled` because football-data.org documents `CANCELLED` as a provider match status. At the competition-rule boundary it means ADR 0012's void case: the fixture will not be played, awards no points and leaves the relevant denominator. Provider adapters must map their own state vocabulary explicitly; they must not infer equivalence from labels.

`confirmed` and `scored` normally happen in one transaction. Keeping both concepts lets anomalies be detected if scoring ever fails.

**`full_time_unconfirmed` (D4)** covers the manual-confirmation gap: the public state remains provisional, with no permanent points, rank movement, progression or elimination until confirmation. The deterministic feed-less threshold is exactly **120 minutes after kickoff**.

## 5. Phase and day states (the named set)

The full narrative behaviour of every surface in every state lives in `design-system.md`; these are the canonical IDs those specs bind to.

- **T0** pre-tournament, entries open · **T1** entries locked, tournament not started (picks-are-in window)
- **D0** rest day · **D1** matches today, none started · **D2** matches live (overrides all) · **D3** between matches · **D4** awaiting confirmation (§4) · **D5** day complete
- **S1** group stage in progress · **S2** groups complete, knockout fixtures not fully resolved · **S3** knockout fixtures confirmed, shared prediction windows open
- **F1** final day pre-kickoff · **F2** final live · **F3** final ended, confirming · **F4** tournament complete only after final confirmation, competition settlement, tie-breaks and explicit completion

## 6. Home action priority queue

Home computes **one primary action** from a central queue in the engine, not in the component:

1. Account/entry-blocking error · 2. Any prediction or selection locking within the urgent window · 3. Live match involving the user's active prediction/competition · 4. Cup tie-break / Penalty Number required · 5. LMS selection required · 6. Shared knockout prediction required · 7. Original entry incomplete · 8. Match awaiting attention · 9. New confirmed result / recap · 10. Next fixture · 11. League invite/sharing · 12. General browsing.

## 7. Competition windows are stored data

The real tournament is fixtures; competitions are **windows** — stored rows, never hardcoded arrays: which real fixtures belong to a round, when entry opens, when each prediction locks, when the round can settle, what stage follows, whether a tie-break input is required. This is the general mechanism that closes the Predictor Cup window-plan item.

## 8. Competition states and user overlays

Each competition independently reports one of: `not_open | registration_open | entered | registration_closed | waiting_for_draw | waiting_for_round | action_required | round_live | round_awaiting_confirmation | qualified | survived | eliminated | champion | complete`.

**Precedence (canonical — ADR-0010 decision 3, 28 July 2026):** `complete` → `champion` → `eliminated` → the non-entrant registration view → `action_required` → `round_live` → `round_awaiting_confirmation` → `waiting_for_draw` → `qualified` / `survived` → `waiting_for_round` → `entered`. A window settles only after its settle boundary and official confirmation requirements; `full_time_unconfirmed` never settles, scores, eliminates or progresses anything.

**Separation law:** no auto-enrolment into bonus games; bonus points never touch Original points; Original leagues never silently become bonus-game leagues; every screen names its active competition; leaving or losing one competition never affects another; corrections recompute each competition independently.

## 9. Result confirmation — one operation

All official result mutations pass through one admin-only `confirm_match_result` operation: validate admin → acquire the advisory lock → validate fixture and result → store confirmed score → derive real winner → recompute each affected competition independently → update histories/progression → append audit entry → return an impact summary. Corrections use the same operation with old/new recorded. **Nothing ever awards points from a live-feed update.**

The Original Predictor slice is shipped through the protected confirm/correct/clear lifecycle with serialized recompute and immutable revisions. Wider platform fan-out remains migration work where not yet implemented.

## 10. Operational overlays

Overlays modify a state, never replace it:

- **Feed unavailable:** keep kickoff-derived status, drop score/minute, say “Live updates unavailable”, never invent a score.
- **Confirmation delayed:** public sees D4; admin sees an overdue alert; nothing permanent moves.
- **Postponed:** a locked round **never reopens**. Preserve the submitted prediction and score it whenever the fixture is eventually played, per [ADR 0011](adr/0011-multi-competition-platform.md) and [ADR 0012](adr/0012-season-predictor-rules.md). If the fixture moved before lock, it belongs to the scope assigned by current fixture data and contributes to that scope's derived lock.
- **Corrected:** all affected competitions recompute; material changes receive a quiet correction note; audit history remains.
- **Round anomaly:** keep the round unresolved and surface a blocking admin anomaly; never invent an outcome.

**Recorded specification change — 29 July 2026:** the previous version said a postponement removed the lock. That tournament-era rule is superseded. Across a league season postponements are routine, and reopening a committed round would allow changes after other results are known. The ADR-required monotonic lock and preserved prediction therefore replace the earlier behaviour.

## 11. Testing contract

The implemented deterministic fixtures live under [`tests/domain/competition/`](../tests/domain/competition/) and exercise both competition kinds through one resolver path, per [ADR 0011](adr/0011-multi-competition-platform.md). They include every named scenario in this contract plus lock derivation, per-match guarding, monotonicity, fail-closed validation and the season buffer relationship.

Minimum named scenarios remain: entries-open incomplete · entries-open submitted · locked with opening match tomorrow · first match today not started · one live match · two simultaneous live · between matches · awaiting confirmation · day complete · rest day · stage transition · knockout window open · spectator post-lock · Cup-eliminated user · Cup live knockout tie · LMS action required · feed unavailable · postponed match · corrected result · final complete.

Surface migration still requires the hostile-data matrix and one seeded clock driven through the full state sequence; isolated resolver fixtures do not replace the later dress rehearsal.

## 12. Reconciliation with the decided build sequence

The current Stage A–L programme is owned by [`docs/architecture/multi-competition-hub-build-plan.md`](architecture/multi-competition-hub-build-plan.md) and [`docs/roadmap.md`](roadmap.md). The context foundation precedes the state-heavy surface migrations so those surfaces are built once against the shared contract.

## 13. The final rule

No page asks *“what state do I think the tournament is in?”* Every page asks *“what has the competition-context engine told me to display?”* That discipline prevents individually good pages from reacting differently to the same event.
