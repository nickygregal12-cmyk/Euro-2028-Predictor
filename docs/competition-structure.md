# Competition Structure — Original Predictor & Bonus Games

Source of truth for how competitions relate. The core law: **the Original Predictor and bonus games are fully separate competitions.** Shared user accounts, shared tournament data — nothing else shared.

---

## 1. The separation law (applies from v0.1 onward)

- The **Original Predictor** is the main game and the only one connected to the standard private-league system.
- Bonus games (**KO Predictor**, **Last Man Standing**, **Fan Duels**) each require **separate, voluntary entry**. Joining an Original Predictor league never enrols anyone in a bonus game; entering one bonus game never enrols anyone in another.
- Bonus-game results never alter Original Predictor points, and bonus-game standings never appear as tabs inside Original Predictor league pages.
- Every competition a user views must clearly state which competition it is.
- Schema note: `entries.entry_type` is the existing mechanism — every competition's entries, predictions, and score events stay typed and separate. Fan Duels gets its own dedicated tables when built (competitions, entrants, rounds, pairings, submissions, duel score events, byes, draws) — never modelled as an extension of league_members.

## 2. Navigation (reconciled decision)

- **v0.1 ships the signed-off 4-tab nav:** Home / Predict / League / More.
- **League** = Original Predictor only, permanently (overall standings v0.1, private leagues v0.5).
- **Bonus Games hub lives at More → Games (/games)** when built — entry status, deadlines, current round, score/survival per game.
- **Matches joins as a 5th tab** when the Match Centre ships (Phase 3 below), completing the original 5-tab vision. Tabs are config; no rebuild.

## 3. Original Predictor private leagues (v0.5 target)

League page includes: name, invite link + code, owner, members, rankings with rank movement, latest + total points, exact-score count, correct-result count, predicted champion, **maximum remaining points**, profile links, H2H actions. Compact, mobile-first, Original Predictor only.

## 4. Bonus games (summary specs — build later, foreclose nothing now)

**KO Predictor** — separate optional game entered once real knockout fixtures are known; separate registration, predictions, points, standings, deadlines, profile stats; per-match kickoff locks; global standings plus optional invite-only KO competitions. Never merged with Original Predictor scores. Built first among bonus games (reuses match + scoring architecture).

**Last Man Standing** — separate entry and player pool; round deadlines; survival/elimination states; previous-selection history; dedicated competitions created/joined via the Games hub.

**Fan Duels** — primarily a **drawn knockout tournament between players**: enter before registration closes → random draw (byes defined pre-draw if bracket doesn't fill: 4/8/16/32/64) → head-to-head prediction sets per duel round (rounds aligned to EURO match periods, configurable) → hidden until lock, revealed after → most duel points advances, loser eliminated → through to a Fan Duels champion. Requires per-round definitions (which matches count, question set, deadlines, scoring, tie-breaks, reveal time). Duel tie-breaks defined before competition starts (exact scores → correct outcomes → closest total goals → designated question → pre-submitted numeric → random draw as last resort; never invented after the fact). Transparent draw with audit trail; published brackets locked except documented exceptional admin intervention. Mobile bracket = round-by-round. A secondary **direct-challenge mode** (challenge a friend over a match/matchday) may come later and never affects organised brackets. Dedicated data structures throughout.

## 5. Build order (supersedes earlier orderings where they conflict)

- **Phase 1 — Original Predictor foundation** (= current Tier 2 / v0.1): accounts (minimal auth), tournament data, group predictions + tables, third-place, bracket, jokers, awards/bonus questions, autosave, locking, scoring, minimal admin, deploy.
- **Phase 2 — Original Predictor leagues** (= v0.5): league creation, invites, joining, rankings, player profiles, H2H links, reveal-after-lock policy. No bonus-game content on league pages.
- **Phase 3 — Core tournament experience** (= Tier 4): Match Centre (Matches tab joins nav), results UX, full profiles, H2H pages, rank history, bracket comparisons.
- **Phase 4 — Bonus Games platform**: the shared hub + optional-entry framework (registration, deadlines, independent pools, status, history, admin).
- **Phase 5 — KO Predictor.**
- **Phase 6 — Last Man Standing.**
- **Phase 7 — Fan Duels** (staged: entry → draw → bracket → round prediction sets → scoring → advancement → tie-breaks → champion → mobile bracket → direct challenges).

## 6. Guardrails for current work

1. Nothing in Phases 1–3 may assume leagues and competitions are the same thing.
2. Scoring, entries, and score events always carry their competition type.
3. The reveal policy (others' predictions visible only post-lock) is designed once at Phase 2 and reused by every later competition's reveal rules.
4. League tables need "maximum remaining points" — the domain layer should expose a points-still-available calculation when leagues are built.
