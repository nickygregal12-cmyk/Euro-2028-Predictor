# Competition Structure — Original Predictor & Bonus Games

Source of truth for how competitions relate. The core law: **the Original Predictor and bonus games are fully separate competitions.** Shared user accounts, shared tournament data — nothing else shared.

---

## 1. The separation law (applies from v0.1 onward)

- The **Original Predictor** is the main game and the only one connected to the standard private-league system.
- Bonus games (**KO Predictor**, **Last Man Standing**, **Predictor Cup** — the Cup superseding Fan Duels, decided 2026-07-22) each require **separate, voluntary entry**. Joining an Original Predictor league never enrols anyone in a bonus game; entering one bonus game never enrols anyone in another.
- Bonus-game results never alter Original Predictor points, and bonus-game standings never appear as tabs inside Original Predictor league pages.
- Every competition a user views must clearly state which competition it is.
- Schema note (decided 2026-07-28, ADR-0010): bonus games use **dedicated platform tables** — `bonus_competitions`, `bonus_competition_windows`, `bonus_window_fixtures`, `bonus_competition_entrants`, `bonus_score_events`, `bonus_competition_audit` (contract 49). The previously planned `entries.entry_type` column is **abandoned**; `entries` belongs to the Original Predictor alone, and no bonus table references `entries`, `leagues`, `league_members`, `score_events` or `rank_history`. The Predictor Cup's game-specific structures (groups, head-to-head fixtures, penalty numbers, seeds, bracket) arrive as additional dedicated tables in its own build stage — never modelled as an extension of league_members.
- **Shared prediction store (decided 2026-07-22; implemented 2026-07-28, contract 51):** raw per-match KNOCKOUT scoreline predictions are collected ONCE in `bonus_knockout_predictions` — per-kickoff database locks, optimistic versions, one form at `/games/knockout` — and read by both the KO Predictor and the Predictor Cup, each scoring them under its own rules with its own score events. This makes the "never predict the same real match twice" principle a schema fact. Group-stage scorelines already exist once in the Original Predictor entry (locked at MD1); the Cup's group stage reads them the same way. Raw predictions shared; entries, scoring, and standings always separate.

## 2. Navigation (reconciled decision)

- **The shipped nav is the full 5-tab set:** Home / Predict / Matches / League / More (Matches joined when the Match Centre shipped, 2026-07-21 — tabs proved to be config; no rebuild).
- **League** = Original Predictor only, permanently.
- **Bonus Games hub lives at More → Games (/games)** — built 2026-07-28 (contract 50): per-game state from the single resolver, entry status, deadlines and voluntary registration/withdrawal. Per-game score/survival detail arrives with each game (B5–B7); no game itself exists yet.

## 3. Original Predictor private leagues (shipped)

League page includes: name, invite link + code, owner, members, rankings with rank movement, latest + total points, exact-score count, correct-result count, predicted champion, profile links, H2H actions. Compact, mobile-first, Original Predictor only. **Maximum remaining points** is computed in the domain (`maxRemainingPoints.ts`) and surfaced in H2H; its league-page placement remains open.

## 4. Bonus games (summary specs — build later, foreclose nothing now)

**KO Predictor** *(scoring + standings implemented 2026-07-28, contract 52)* — separate optional game opening once the real R16 line-up is known; separate registration, predictions, points, standings, deadlines, profile stats; per-match kickoff locks via the **shared prediction store** (§1). **Rules decided 2026-07-22:** per-match prediction = regulation-time scoreline + a "who goes through?" pick required ONLY when a draw is predicted (implied otherwise); scoring **Exact 5 · Result 3 · Through +2** (through stacks, and pays alone on a wrong scoreline with the right advancing team); **rolling entry** — join before any round, earlier rounds simply unbanked (the latecomer/spectator funnel); **global leaderboard only at launch** — invite-only KO competitions deferred (separate tables from day one; the invite-code layer bolts on later); **no jokers ever** (shared-store integrity). UI direction approved same day (design-system §6). Never merged with Original Predictor scores. Built first among bonus games (reuses match + scoring architecture).

**Last Man Standing** *(implemented 2026-07-28, contract 53 — rules decided the same day, owner-approved)* — the TOURNAMENT format (Euro 2024 / World Cup 2026 style), not the weekly EPL format: rounds are the platform's admin-scheduled windows with one round deadline each (no per-kickoff locks); one pick per surviving entrant per round from that round's fixtures, changeable until the deadline; group picks must WIN (a draw eliminates), knockout picks must ADVANCE (authoritative winner — extra time/penalties count); each team usable once per competition; no pick by the deadline = eliminated at settle; rounds settle only on officially confirmed results; whole-round wipeout voids the round so a winner always exists; survivors through the final round are champions (co-champions possible); elimination permanent. Separate entry and player pool via the Games hub; selection history at `/games/lms`; survival re-derived inside the single result operation.

**Predictor Cup** (supersedes Fan Duels — decided 2026-07-22; full rules in `docs/predictor-cup-rules.md`) — a parallel head-to-head tournament that converts users' existing predictions into football-style fixtures: transparent random draw into groups of 4 (3s only as remainder requires, any field ≥6), three group matchdays scored head-to-head (win 3 / draw 1 / loss 0 on prediction-point totals), ~two-thirds qualify (automatic + points-per-game wildcards), seeded playoff reduces to a power-of-two knockout, and tied knockout scores resolve via Extra-Time Accuracy (lowest scoreline error) then the guaranteed **Penalty Number** decider (opposite-parity total-goals guesses — cannot draw). Walkover/void/inactivity rules defined; audit-trail draw and bracket per the Fan Duels integrity requirements (inherited). **Key laws:** jokers NEVER apply to Cup scoring (raw 5/3/0); entry requires a submitted Original Predictor entry (the Cup group stage reads its scorelines); knockout scorelines come from the shared prediction store (above). **Open before final:** the window plan (field size → bracket depth → real-fixture bundles — the calendar only offers ~4 natural post-group windows, deep brackets need split bundles). **Parked, never launch-blocking:** Shield/Plate secondary cups; Fan Duels' direct-challenge mode.

## 5. Build order (sequencing authority is now `docs/roadmap.md`; this phase list maps onto its stages)

`docs/roadmap.md` is the only live execution sequence. The phases below are retained for the competition relationships they encode; Phases 1–3 are substantially delivered (roadmap Stages 0–3), and the bonus-game phases correspond to roadmap Stage 5.

- **Phase 1 — Original Predictor foundation** *(delivered)*: accounts, tournament data, group predictions + tables, third-place, bracket, jokers, awards/bonus questions, autosave, locking, scoring, admin, deploy.
- **Phase 2 — Original Predictor leagues** *(delivered)*: league creation, invites, joining, rankings, player profiles, H2H links, reveal-after-lock policy. No bonus-game content on league pages.
- **Phase 3 — Core tournament experience** *(largely delivered)*: Match Centre (Matches tab joined the nav), results UX, profiles, H2H pages, rank history; bracket comparisons and richer profiles remain (roadmap Stage 4).
- **Phase 4 — Bonus Games platform** *(future — roadmap Stage 5 precondition)*: the shared hub + optional-entry framework (registration, deadlines, independent pools, status, history, admin).
- **Phase 5 — KO Predictor** *(future — roadmap Stage 5 item 1)*.
- **Phase 6 — Last Man Standing** *(future — roadmap Stage 5 item 2)*.
- **Phase 7 — Predictor Cup** *(future — roadmap Stage 5 item 3; supersedes Fan Duels — 2026-07-22; staged: entry → group draw → group matchdays → wildcard/qualification → seeded playoff → knockout with AET/Penalty-Number resolution → champion + Golden Predictor award)*.

## 6. Guardrails for current work

1. Nothing in Phases 1–3 may assume leagues and competitions are the same thing.
2. Scoring, entries, and score events always carry their competition type.
3. The reveal policy (others' predictions visible only post-lock) is designed once at Phase 2 and reused by every later competition's reveal rules.
4. League tables need "maximum remaining points" — the domain layer exposes it (`src/domain/tournament/maxRemainingPoints.ts`); wiring it onto the league page remains open.
