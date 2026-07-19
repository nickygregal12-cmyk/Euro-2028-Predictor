# Euro 2028 Predictor

A mobile-first Euro 2028 football predictor web app.

## Setup

```
npm install
npm run dev       # local dev server
npm run test      # run unit tests (Vitest)
```

## Project structure

```
src/
  app/            # app shell, routing
  features/       # UI features (auth, predictor, groups, bracket, matches, leagues, scoring, admin)
  domain/
    tournament/   # pure domain functions — no UI, no database, data in/data out
  services/
    supabase/     # Supabase client + queries
  styles/         # design system styles
tests/
  domain/         # unit tests for domain functions
  setup.ts        # Vitest + jest-dom setup
```

## Domain-first principle

Tournament logic (group tables, tie-breaks, bracket progression, scoring) lives entirely in `src/domain/tournament/` as pure functions: they take data in, return data out, and never touch React or the database directly. Build and test these in isolation before wiring up any screen.

## Status

- [x] Project scaffolded (Vite + React + TypeScript)
- [x] Vitest wired up and confirmed working
- [x] `calculateGroupTable()` built and tested
- [ ] `resolveGroupTies()` — next up
- [ ] `rankThirdPlacedTeams()`
- [ ] `resolveRoundOf16()`
- [ ] `advanceBracket()`
- [ ] `calculateScore()`
- [ ] `calculateLeagueRank()`
