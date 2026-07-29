# ADR 0010 — Bonus Games platform: one platform, three games

- **Status:** Implemented for the Euro 2028 Bonus Games platform (contracts 49–60); multi-competition generalisation is governed by ADR 0011
- **Date:** 28 July 2026

## Context

Three bonus competitions are specified and rules-decided: the KO Predictor (`docs/competition-structure.md` §4), Last Man Standing (§4) and the Predictor Cup (`docs/predictor-cup-rules.md`). None exists in the repository: as of `main` @ `6d3f02e` there is no route, table, service or scaffolding for any of them, and no code incorrectly assumes one exists.

`docs/roadmap.md` Stage 5 sequences bonus competitions **after** the Original Predictor core experience is proven. `docs/architecture-and-tournament-states.md` §12 sequences the Bonus Games **platform** as item 4, after the tournament-context engine and before the individual games. These are compatible: the platform is foundation, the games are product.

The temptation is to build the KO Predictor first and generalise later. That produces three parallel implementations of registration, deadlines, windows, states, standings and audit — and the third one silently diverges from the separation law. The Predictor Cup and the KO Predictor also read the **same** raw knockout scoreline predictions (`competition-structure.md` §1, decided 2026-07-22), so a game-first build would have to retrofit the shared store afterwards, against locked user data.

## Decision

Build a **competition platform** first, then each game as a thin ruleset on top.

**1. Competitions, windows and entrants are stored data, never code.**
Per `architecture-and-tournament-states.md` §7: a competition instance holds its registration and completion instants; a window holds which real fixtures belong to a round, when it opens, locks and may settle, what follows, and whether a tie-break input is required. Admin-adjustable data, so the Predictor Cup's open window-plan item becomes configuration rather than a release.

**2. One state resolver, one state set.**
`resolveCompetitionStatus` (pure, `src/domain/competitions/`) reports exactly one of the fourteen §8 states per competition per user. The Games hub, Home action queue and every game screen consume it. No surface computes a competition state for itself, so no two surfaces can disagree about what the user should do next.

**3. Separation is structural, not conventional.**
Bonus competitions get their own tables — entrants, predictions, score events, standings, audit. They never reference `entries`, `league_members`, `score_events` or `rank_history`. Nothing under `src/domain/competitions/` imports Original Predictor scoring. The separation law becomes a schema fact and a lint-visible import boundary rather than a rule people remember.

**4. The knockout prediction store is shared; scoring never is.**
Raw per-match knockout scorelines are collected once, locked per kickoff, and read by both the KO Predictor and the Predictor Cup, each scoring them under its own rules into its own score-event table. Users never predict the same real match twice; standings stay separate.

**5. Results fan out through the existing single operation.**
`admin_confirm_match_result` / `_correct_` / `_clear_` already hold the per-tournament advisory lock and own recompute and revisions for the Original Predictor. Bonus recompute is added **inside** that operation (§9), not alongside it. One result, one lock, one audit entry, independent per-competition recompute. Nothing is ever scored from a live feed or from a `full_time_unconfirmed` fixture.

**6. A settled window requires confirmed results.**
No elimination, qualification, progression or scoring may occur from a provisional result, even after the scheduled settle instant has passed.

## Build sequence

| Stage | Scope | Risk |
| --- | --- | --- |
| B1 | Platform domain: model, state resolver, unit tests. Pure, no schema, no UI. | None — no production surface |
| B2 | Platform schema: competitions, windows, window fixtures, entrants, competition score events, audit. Deny-all RLS, RPC-only mutation, empty security-definer search paths, pgTAP. Development only. | Development schema |
| B3 | Games hub at More → Games (`/games`) reading B1/B2: per-game entry status, deadlines, current round. Registration and withdrawal RPCs. | Feature |
| B4 | Shared knockout prediction store: one prediction form, per-kickoff locks, version guards, pgTAP. | Feature + schema |
| B5 | KO Predictor: scoring (Exact 5 / Result 3 / Through +2), standings, recompute fan-out inside `confirm_match_result`. | Scoring |
| B6 | Last Man Standing. |  |
| B7 | Predictor Cup: draw, groups, head-to-head fixtures, Penalty Number decider. |  |

B1–B4 are shared by all three games. Nothing in B5–B7 may add a second registration, deadline, window or audit mechanism.

## Decisions required before B2 — all confirmed 28 July 2026

1. **Entrant mechanism — decided.** Dedicated `bonus_competition_entrants` rows serve all three games; the previously planned `entries.entry_type` column is **abandoned**, leaving `entries` as the Original Predictor's alone. `competition-structure.md` §1 records this.
2. **Sequencing — decided.** The platform foundation (B1–B2) lands now, ahead of the remaining Stage 4 product work; the games themselves (B3+ surfaces onward) still follow the Stage 5 gate. `roadmap.md` Stage 5 records the single order.
3. **State precedence — decided.** The precedence implemented in `resolveCompetitionStatus` (mirroring the §6 Home action queue) is canonical and is recorded in `architecture-and-tournament-states.md` §8; the doc, not the code, is the authority.

## Consequences

- Three games cost one platform plus three rulesets, and a fourth game (the sweepstake) costs only a ruleset.
- Every bonus surface has resilient provisional, live, locked, settled and corrected states because the platform resolves them once.
- A dress rehearsal can run all three games against seeded data through the same windows mechanism.
- Cost: the KO Predictor lands later than it would have under a game-first build, and B2 adds schema before any user-visible bonus feature exists.

## Rejected alternatives

- **KO Predictor first, generalise later:** rejected. The shared prediction store would have to be retrofitted under locked user predictions, and registration/windows/audit would exist three times.
- **Extend `entries` and `league_members` with a competition type:** rejected. It puts Original and bonus rows in the same tables and makes the separation law a matter of every future query remembering a filter.
- **Bonus recompute as a separate admin operation:** rejected. Two write paths for one result reintroduce the ordering and audit problems that the single advisory-locked operation exists to prevent.
