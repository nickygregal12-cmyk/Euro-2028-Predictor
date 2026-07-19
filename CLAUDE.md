# CLAUDE.md — Euro 2028 Predictor

Project conventions for Claude Code sessions. Read this before making changes.

## What this project is

A mobile-first Euro 2028 football predictor web app. Users predict every group match, build a knockout bracket, pick a champion, and compete in private leagues. Free-tier hosting (Netlify + Supabase).

**Source-of-truth documents (in repo root):**
- `euro2028-scoring-rules.md` — the complete scoring and tie-break specification. All scoring logic implements exactly this. Never invent or change a rule without updating this doc first.
- `euro2028-tournament-structure.md` — tournament facts, fixture skeleton, third-place ranking rules, and the round-of-16 allocation table. Bracket/structure logic implements exactly this. Never invent or change a rule (especially the R16 allocation table) without updating this doc first.
- `euro2028-build-todo.md` — the tiered build plan. Work top-to-bottom within the current tier. Tick items off when done. New ideas go in the parking lot, not the current tier.

## Stack

- React + TypeScript + Vite
- Custom design system with CSS modules (no Tailwind)
- Supabase (Postgres, Auth, RLS) — not wired up yet
- Vitest (+ React Testing Library) for tests; Playwright later
- Netlify hosting — not wired up yet

## Architecture rules (non-negotiable)

1. **Domain-first.** All tournament logic lives in `src/domain/tournament/` as pure functions: data in, data out. No React imports, no database access, no side effects. Follow the pattern in `calculateGroupTable.ts`.
2. **No business logic in components.** Pages and components call domain functions and render results. If a component is computing standings, scores, or bracket progression inline, that's wrong — extract it.
3. **Every domain function ships with unit tests in the same commit.** A domain function without tests is not done. Tests live in `tests/domain/`.
4. **The server is the authority on deadlines and locks.** Browser countdowns are cosmetic. Lock enforcement happens in Postgres functions / RLS, never client-side alone.
5. **Scoring must be deterministic and recalculable.** Given the same predictions and results, scoring always produces the same output, and the system can fully recalculate all points from source data. Corrections must never double-count.
6. **One source of truth for rules.** If code and `euro2028-scoring-rules.md` disagree, the doc wins — fix the code, or consciously update the doc first.

## Folder structure

```
src/
  app/            # app shell, routing
  features/       # UI features (auth, predictor, groups, bracket, matches, leagues, scoring, admin)
  domain/
    tournament/   # pure domain functions ONLY
  services/
    supabase/     # Supabase client + query wrappers (nothing else talks to Supabase)
  styles/         # design system
tests/
  domain/         # unit tests mirroring src/domain/
```

## Git discipline

- Stage specific files — never `git add .`
- One logical change per commit (e.g. "add resolveGroupTies + tests"), not batches of unrelated work
- Run `npx vitest run` before committing; don't commit red tests
- Push to GitHub after each completed piece of work
- Never commit `.env` files (already gitignored)

## Current status

Tier 0 nearly complete (scaffold, Vitest, seed data done; Supabase/Netlify accounts pending).
Tier 1 domain logic **complete** — all functions done and tested: `calculateGroupTable()`, `resolveGroupTies()`, `rankThirdPlacedTeams()`, `resolveRoundOf16()` (R16 allocation table in `roundOf16Allocation.ts`), `advanceBracket()` (post-R16 feed-through in `knockoutBracket.ts`), `calculateScore()` and `calculateLeagueRank()` (point values in `scoringConfig.ts`). Full suite green (`npx vitest run`).

**Next up:** Tier 2 (v0.1) — design system basics and the first UI/Supabase wiring. See `euro2028-build-todo.md`; nothing in the domain tier remains.

## Things NOT to do

- Don't add features from later tiers while the current tier is incomplete
- Don't install libraries beyond the stack above without discussion (especially no Tailwind, no state-management libs yet)
- Don't touch Supabase production data or keys once they exist (dev project only until explicitly told otherwise)
- Don't mark a to-do item complete unless code works, tests pass, and the doc is updated
- Don't put team names, fixtures, or scoring values as hardcoded literals inside logic — they come from seed data / config
