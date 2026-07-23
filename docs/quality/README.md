# Euro 2028 Predictor

A mobile-first Euro 2028 football predictor web app. React 19 + TypeScript + Vite, Supabase (Postgres, Auth, RLS, RPCs) for data, Netlify for hosting.

## Setup

```
npm ci            # install exactly from package-lock.json
npm run dev       # local dev server
npm run test      # unit + component tests (Vitest)
npm run lint      # Oxlint
npm run build     # tsc -b && vite build
```

Copy `.env.example` to `.env.local` and fill in the development Supabase values. Never point local or preview builds at the production Supabase project.

## Project structure

```
src/
  app/            # app shell, routing, providers (theme, tournament data, predictions)
  design-system/  # shared UI primitives + tokens-driven components
  dev/            # dev-only component gallery (route gated out of production)
  domain/
    tournament/   # pure domain functions — no UI, no database, data in/data out
  features/       # UI features: auth, welcome, predict, bracket, leagues, league,
                  # matches, h2h, home, profile, scoring, share, more, notfound
  services/
    supabase/     # Supabase client + all queries/RPCs (the only network boundary)
  styles/         # tokens, fonts, flags
tests/
  domain/         # unit tests for domain functions
  features/ services/ scripts/ app/
  setup.ts        # Vitest + jest-dom setup
supabase/
  migrations/     # append-only, timestamp-ordered SQL migrations
  seed.sql        # fixture/bracket skeleton (single source of truth)
  prod-baseline.sql
scripts/
  seed-dev/       # guarded development seeding
  og/             # Open Graph asset rendering
docs/             # authoritative product, architecture, scoring and ops documents
  quality/        # quality governance: audits, risk register, feature baseline
```

## Domain-first principle

Tournament logic (group tables, tie-breaks, bracket progression, scoring) lives entirely in `src/domain/tournament/` as pure functions: they take data in, return data out, and never touch React or the database directly. Build and test these in isolation before wiring up any screen.

## Scoring

`docs/scoring-rules.md` is the single source of truth. Point values are transcribed into `src/domain/tournament/scoringConfig.ts` and mirrored in the SQL scorer (`supabase/migrations/20260721120000_scoring_positions_knockout_awards.sql`). **No scoring number may ever appear as a literal inside logic.** All three layers were verified identical in the 23 July 2026 repeat audit.

## Status

The domain layer is complete and tested:

- [x] Project scaffolded (Vite + React + TypeScript)
- [x] Vitest wired up and confirmed working
- [x] `calculateGroupTable()`
- [x] `resolveGroupTies()`
- [x] `rankThirdPlacedTeams()`
- [x] `resolveRoundOf16()`
- [x] `advanceBracket()`
- [x] `calculateScore()`
- [x] `calculateLeagueRank()`

Phase 1 application surfaces (auth, predictions, bracket, jokers, awards, review/submit, leagues, leaderboard, H2H, matches, match centre, home, profile, share) are built and reachable. 42 test files / 335 tests pass; the build, lint and type-check are clean; `npm audit` reports zero vulnerabilities.

**The app is not production-ready for a real scored competition.** Open Critical and High findings — including group-position persistence, submission-state protection, the knockout result model and the absence of any database/RLS/browser test layer — are recorded in `docs/quality/`. Read `docs/quality/current-status.md` before starting work.

## Where the rules live

| Question | Document |
| --- | --- |
| Agent instructions, architecture rules, Git and database discipline | `CLAUDE.md` |
| Scoring and entry validity | `docs/scoring-rules.md` |
| Tournament facts and structure | `docs/tournament-structure.md` |
| Architecture and tournament states | `docs/architecture-and-tournament-states.md` |
| Interface and design system | `docs/design-system.md` |
| Current competition scope vs future competitions | `docs/competition-structure.md` |
| Product sequence | `docs/roadmap.md`, `docs/build-todo.md` |
| Operations runbooks | `docs/ops-*.md` |
| Quality position, risks and audits | `docs/quality/` |
