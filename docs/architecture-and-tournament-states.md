# Architecture & tournament-state contract

**Status: adopted 2026-07-22** (adapted from an external architecture proposal — its state engine and contracts accepted; its nav rewrite and `src/` restructure rejected in favour of decided facts). This document is authoritative for *how the app understands the tournament*. Visual/interaction specs stay in `design-system.md`; sequencing stays in `roadmap.md`; competition rules stay in `competition-structure.md` + `predictor-cup-rules.md`. Where those docs describe phase- or day-dependent behaviour, they are describing states named HERE.

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
- **Tournament timing logic exists in exactly one place** (the context engine, §3).
- Page-shaped aggregation uses the **read-model pattern** the repo already practises (`get_league_page` is one): each major surface gets a purpose-built snapshot (RPC-shaped or client-assembled) rather than assembling raw tables per page. New surfaces get snapshots from day one; existing ones migrate opportunistically, never as a big-bang refactor.

## 2. Live data vs tournament truth

Restating the decided law (`design-system.md` → Live data & refresh) in architecture terms: a live-score feed supplies **display-only** data (score, minute, period, shootout status, scorers) into a separate live store. It never writes official results, never triggers scoring, never eliminates an LMS player, never advances a Cup tie, never confirms a real knockout winner. The admin confirms results (feed pre-fills); confirmation is the only gate into scoring.

## 3. The tournament-context engine (the core addition)

A pure resolver in `src/domain/tournament/` — **fake-clock testable, server-time fed** — that every signed-in page consumes. No page computes phase, day-shape, or urgency itself.

```
resolveTournamentContext(nowServer, tournamentData, liveData, userData) → TournamentContext
```

Shape (illustrative, not binding field-for-field):

- `tournamentPhase`: `pre_tournament | group_stage | stage_transition | knockout_stage | final_complete | post_tournament`
- `dayState`: `no_matches_today | before_first_match | matches_live | between_matches | awaiting_confirmation | day_complete`
- `originalEntryState`: `not_started | incomplete | valid_unsubmitted | submitted | auto_submitted | locked | no_valid_entry (spectator)`
- `liveMatches / completedToday / awaitingConfirmation / upcomingToday / nextMatch`
- `nextUserAction` (from the priority queue, §6)
- `competitions.{original, knockout, lastManStanding, predictorCup}: CompetitionStatus` (§8)

**Clock rule:** server time is authoritative for every state boundary (locks, windows, teasers, recaps); the client clock only renders countdown displays. **Dimension rule:** the context resolves *several independent dimensions* (phase × day × entry × per-competition × overlays), never one giant combined enum.

**Day-state priority when conditions coexist:** tournament complete → any match live → awaiting confirmation → between matches (some confirmed today, later still to play) → before first match → day complete → stage transition → rest day → pre-tournament locked → pre-tournament open. (One live match makes the day `matches_live`; the Today card still sections Live / Finished / Still to play inside it.)

**Every time-boxed behaviour already specced keys off this engine**, not its own clock: the 48-hour picks-are-in teaser, the matchday recap card window, match-window polling, the My-entry morph at lock, spectator states, D-day Home layouts.

## 4. Individual match-state contract

Every fixture resolves to exactly one:

| State | Meaning |
| --- | --- |
| `scheduled_editable` | Prediction open |
| `scheduled_locked` | Locked (kickoff or per-match lock reached), not yet started |
| `in_play_feed` | Live, feed data available (score + minute) |
| `in_play_no_feed` | Kickoff passed, no feed — display "In play", never an invented score |
| `suspended` | Temporarily stopped (feed-signalled) |
| `full_time_unconfirmed` | Ended (feed FT, or **kickoff + ~2h heuristic when feed-less**) — provisional display, no scoring |
| `confirmed` | Official result stored by admin |
| `scored` | All competition calculations completed |
| `postponed` / `abandoned` / `cancelled` | Admin-resolved exceptional states |

`confirmed` and `scored` normally happen in one transaction (the existing synchronous recompute); keeping both concepts lets anomalies be detected if scoring ever fails.

**`full_time_unconfirmed` (D4) is the state the original design missed.** With manual entry, a match can sit "finished but unconfirmed" for hours. The app must show **"Full time — awaiting confirmation"** (display-only score where a feed exists; the kickoff heuristic alone where not): no permanent points, no rank movement, no progression, no LMS elimination, everything labelled provisional/"if confirmed". Admin-side, an unconfirmed-overdue result is the top operational alert.

## 5. Phase and day states (the named set)

The full narrative behaviour of every surface in every state lives in `design-system.md`; these are the canonical IDs those specs bind to.

- **T0** pre-tournament, entries open · **T1** entries locked, tournament not started (picks-are-in window)
- **D0** rest day (must feel intentional: recap of last matchday, next-fixture countdown, next user action, tables) · **D1** matches today, none started · **D2** matches live (overrides all) · **D3** between matches (earlier confirmed + later upcoming — a real, distinct state) · **D4** awaiting confirmation (§4) · **D5** day complete (recap card: full Matchday Recap when an official matchday completes; smaller Daily Recap when only a calendar day inside one)
- **S1** group stage in progress · **S2** groups complete, knockout fixtures not fully resolved ("being confirmed" — no guesswork in unresolved slots) · **S3** knockout fixtures confirmed, shared prediction windows open (My entry shows "Your original bracket" and "Your match predictions" as explicitly separate sections)
- **F1** final day pre-kickoff · **F2** final live (standard live state, stronger presentation; **gold is NOT used just because it's the final** — colour law holds) · **F3** final ended, confirming ("Full time — confirming the final standings"; no champion declared) · **F4** tournament complete (triggered only after: final confirmed + all competitions settled + final tie-breaks applied + tournament marked complete)

## 6. Home action priority queue

Home computes **one primary action** from a central queue (in the engine, not in Home's component):

1. Account/entry-blocking error · 2. Any prediction or selection locking within the urgent window · 3. Live match involving the user's active prediction/competition · 4. Cup tie-break / Penalty Number required · 5. LMS selection required · 6. Shared knockout prediction required · 7. Original entry incomplete · 8. Match awaiting attention · 9. New confirmed result / recap · 10. Next fixture · 11. League invite/sharing · 12. General browsing.

This is the rule that prevents "Invite friends" rendering while an LMS pick locks in 20 minutes.

## 7. Competition windows are stored data

The real tournament is fixtures; competitions are **windows** — stored rows, never hardcoded arrays: which real fixtures belong to a round, when entry opens, when each prediction locks, when the round can settle, what stage follows, whether a tie-break input (Penalty Number) is required. This is the general mechanism that closes the Predictor Cup's open **window plan** item (`predictor-cup-rules.md` status block): the plan becomes admin-adjustable data, published per §13.1 of the rules.

## 8. Competition states and user overlays

Each competition independently reports one of: `not_open | registration_open | entered | registration_closed | waiting_for_draw | waiting_for_round | action_required | round_live | round_awaiting_confirmation | qualified | survived | eliminated | champion | complete`. These render as Games-hub cards and Home action cards. Original-entry states include the **spectator** (`no_valid_entry` post-lock): browse everything, join leagues as no-entry member, view public post-lock entries, enter bonus games with open registration; never in Original standings (per the decided spectator state).

**Separation law (restated, unchanged):** no auto-enrolment into bonus games; bonus points never touch Original points; Original leagues never silently become bonus-game leagues (KO competitions: separate tables, deferred past launch — decided); every screen names its active competition; leaving/losing a bonus game never affects the Original entry; corrections recompute each competition independently.

## 9. Result confirmation — one operation

All official result mutations pass through one admin-only `confirm_match_result` operation: validate admin → **acquire the per-tournament advisory lock** (audit follow-up item 5) → validate fixture + result (+ ET/pens data where relevant) → store confirmed score → derive real winner → recompute Original → recompute KO Predictor → resolve affected Cup fixtures → resolve affected LMS selections → update rank history → update real tables + bracket progression → append audit entry → return a scoring-impact summary. Corrections use the same operation with old/new recorded. **Nothing ever awards points from a live-feed update.** (This is the Phase 4 platform-generalisation of the existing result-entry + recompute pipeline; it composes with, and depends on, write-integrity items already sequenced in `build-todo.md`.)

## 10. Operational overlays

Overlays modify a state, never replace it:
- **Feed unavailable:** keep kickoff-derived status, drop score/minute, say "Live updates unavailable", never invent a score, refetch-on-focus continues.
- **Confirmation delayed:** public sees D4; admin sees an overdue alert; nothing permanent moves.
- **Postponed:** lock removed per published rules, submitted prediction preserved, rescheduled deadline shown when known, every time change audited.
- **Corrected:** all affected competitions recompute; a quiet correction note appears where standings materially changed; audit trail preserved.
- **Round anomaly** (Cup tie without a valid Penalty Number; LMS with no eligible selection; a knockout prediction stranded by a fixture change): the round stays **unresolved** and the admin overview shows a blocking anomaly — the system never silently invents an outcome.

## 11. Testing contract

Every named state gets a deterministic fake-clock fixture. Minimum 20 scenarios: entries-open incomplete · entries-open submitted · locked with opening match tomorrow · first match today not started · one live match · two simultaneous live · between matches · awaiting confirmation · day complete · rest day · stage transition · knockout window open · spectator post-lock · Cup-eliminated user · Cup live knockout tie · LMS action required · feed unavailable · postponed match · corrected result · final complete. Each renders under the hostile-data matrix (360px + desktop, both themes, long names, large league, partial data). **The dress rehearsal drives one seeded tournament clock through every state in order** — never a pile of unrelated mock pages (this redefines the rehearsal method in `roadmap.md`).

## 12. Reconciliation with the decided build sequence

The proposal's stages map onto the decided order (`roadmap.md` → Launch scope & build sequence) as follows — no resequencing of decided items, one insertion:
1. Write integrity (audit items, incl. phase 2) — unchanged, first.
2. Friction test — unchanged.
3. **NEW foundation item: the tournament-context engine** (resolver + match-state resolver + action queue + fake-clock fixtures) — built **before** the state-heavy re-cuts (Home phases, Matches expansion, My entry, spectator states) so they're built once, on the engine.
4. Bonus Games platform (Phase 4) — now explicitly including: shared knockout-prediction store (per-kickoff locks + version guards, one prediction form), competition instances/entries/**windows (§7)**, registration + deadlines, Games hub read model, admin controls, audit logging, `confirm_match_result` (§9).
5. The three games (Phases 5–7) — unchanged.
6. Core-experience re-cuts (Phase 3 items) — consuming the engine.
7. Dress rehearsal (§11 method) → Tournament Readiness → launch.

## 13. The final rule

No page asks *"what state do I think the tournament is in?"* Every page asks *"what has the tournament-context engine told me to display?"* That single discipline is what makes the app one professionally designed tournament product rather than several individually good pages reacting differently to the same event.
