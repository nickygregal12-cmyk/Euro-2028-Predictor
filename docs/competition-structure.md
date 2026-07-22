# Competition Structure — Original Predictor & Bonus Games

Source of truth for how competitions relate. The core law: **the Original Predictor and bonus games are fully separate competitions.** Shared user accounts, shared tournament data — nothing else shared.

---

## 1. The separation law (applies from v0.1 onward)

- The **Original Predictor** is the main game and the only one connected to the standard private-league system.
- Bonus games (**KO Predictor**, **Last Man Standing**, **Predictor Cup** — the Cup superseding Fan Duels, decided 2026-07-22) each require **separate, voluntary entry**. Joining an Original Predictor league never enrols anyone in a bonus game; entering one bonus game never enrols anyone in another.
- Bonus-game results never alter Original Predictor points, and bonus-game standings never appear as tabs inside Original Predictor league pages.
- Every competition a user views must clearly state which competition it is.
- Schema note: `entries.entry_type` is the **planned** mechanism (the column is deferred — see build-todo's deferred list; correction 2026-07-22, it does not exist yet) — every competition's entries, predictions, and score events stay typed and separate. The Predictor Cup gets its own dedicated tables when built (cup competitions, entrants, groups, head-to-head fixtures, rounds/windows, penalty numbers, seeds, bracket, cup score events, audit) — never modelled as an extension of league_members.
- **Shared prediction store (decided 2026-07-22):** raw per-match KNOCKOUT scoreline predictions are collected ONCE — per-kickoff locks — and read by both the KO Predictor and the Predictor Cup, each scoring them under its own rules with its own score events. This makes the "never predict the same real match twice" principle a schema fact. Group-stage scorelines already exist once in the Original Predictor entry (locked at MD1); the Cup's group stage reads them the same way. Raw predictions shared; entries, scoring, and standings always separate.

## 2. Navigation (reconciled decision)

- **v0.1 ships the signed-off 4-tab nav:** Home / Predict / League / More.
- **League** = Original Predictor only, permanently (overall standings v0.1, private leagues v0.5).
- **Bonus Games hub lives at More → Games (/games)** when built — entry status, deadlines, current round, score/survival per game.
- **Matches joins as a 5th tab** when the Match Centre ships (Phase 3 below), completing the original 5-tab vision. Tabs are config; no rebuild.

## 3. Original Predictor private leagues (v0.5 target)

League page includes: name, invite link + code, owner, members, rankings with rank movement, latest + total points, exact-score count, correct-result count, predicted champion, **maximum remaining points**, profile links, H2H actions. Compact, mobile-first, Original Predictor only.

## 4. Bonus games (summary specs — build later, foreclose nothing now)

**KO Predictor** — separate optional game opening once the real R16 line-up is known; separate registration, predictions, points, standings, deadlines, profile stats; per-match kickoff locks via the **shared prediction store** (§1). **Rules decided 2026-07-22:** per-match prediction = regulation-time scoreline + a "who goes through?" pick required ONLY when a draw is predicted (implied otherwise); scoring **Exact 5 · Result 3 · Through +2** (through stacks, and pays alone on a wrong scoreline with the right advancing team); **rolling entry** — join before any round, earlier rounds simply unbanked (the latecomer/spectator funnel); **global leaderboard only at launch** — invite-only KO competitions deferred (separate tables from day one; the invite-code layer bolts on later); **no jokers ever** (shared-store integrity). UI direction approved same day (design-system §6). Never merged with Original Predictor scores. Built first among bonus games (reuses match + scoring architecture).

**Last Man Standing** — separate entry and player pool; round deadlines; survival/elimination states; previous-selection history; dedicated competitions created/joined via the Games hub.

**Predictor Cup** (supersedes Fan Duels — decided 2026-07-22; full rules in `docs/predictor-cup-rules.md`) — a parallel head-to-head tournament that converts users' existing predictions into football-style fixtures: transparent random draw into groups of 4 (3s only as remainder requires, any field ≥6), three group matchdays scored head-to-head (win 3 / draw 1 / loss 0 on prediction-point totals), ~two-thirds qualify (automatic + points-per-game wildcards), seeded playoff reduces to a power-of-two knockout, and tied knockout scores resolve via Extra-Time Accuracy (lowest scoreline error) then the guaranteed **Penalty Number** decider (opposite-parity total-goals guesses — cannot draw). Walkover/void/inactivity rules defined; audit-trail draw and bracket per the Fan Duels integrity requirements (inherited). **Key laws:** jokers NEVER apply to Cup scoring (raw 5/3/0); entry requires a submitted Original Predictor entry (the Cup group stage reads its scorelines); knockout scorelines come from the shared prediction store (above). **Open before final:** the window plan (field size → bracket depth → real-fixture bundles — the calendar only offers ~4 natural post-group windows, deep brackets need split bundles). **Parked, never launch-blocking:** Shield/Plate secondary cups; Fan Duels' direct-challenge mode.

## 5. Build order (supersedes earlier orderings where they conflict)

- **Phase 1 — Original Predictor foundation** (= current Tier 2 / v0.1): accounts (minimal auth), tournament data, group predictions + tables, third-place, bracket, jokers, awards/bonus questions, autosave, locking, scoring, minimal admin, deploy.
- **Phase 2 — Original Predictor leagues** (= v0.5): league creation, invites, joining, rankings, player profiles, H2H links, reveal-after-lock policy. No bonus-game content on league pages.
- **Phase 3 — Core tournament experience** (= Tier 4): Match Centre (Matches tab joins nav), results UX, full profiles, H2H pages, rank history, bracket comparisons.
- **Phase 4 — Bonus Games platform**: the shared hub + optional-entry framework (registration, deadlines, independent pools, status, history, admin).
- **Phase 5 — KO Predictor.**
- **Phase 6 — Last Man Standing.**
- **Phase 7 — Predictor Cup** (supersedes Fan Duels — 2026-07-22; staged: entry → group draw → group matchdays → wildcard/qualification → seeded playoff → knockout with AET/Penalty-Number resolution → champion + Golden Predictor award).

## 6. Guardrails for current work

1. Nothing in Phases 1–3 may assume leagues and competitions are the same thing.
2. Scoring, entries, and score events always carry their competition type.
3. The reveal policy (others' predictions visible only post-lock) is designed once at Phase 2 and reused by every later competition's reveal rules.
4. League tables need "maximum remaining points" — the domain layer should expose a points-still-available calculation when leagues are built.
