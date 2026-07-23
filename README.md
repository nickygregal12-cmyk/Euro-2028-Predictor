# Euro 2028 Predictor

A mobile-first Euro 2028 football predictor web app. React 19 + TypeScript + Vite, Supabase (Postgres, Auth, RLS, RPCs) for data, and Netlify for hosting.

## Setup

```bash
npm ci            # install exactly from package-lock.json
npm run dev       # local dev server
npm run test      # unit + component tests (Vitest)
npm run lint      # Oxlint
npm run build     # tsc -b && vite build
```

Copy `.env.example` to `.env.local` and fill in the development Supabase values. Never point local or preview builds at the production Supabase project.

## Project structure

```text
src/
  app/            # app shell, routing, providers
  design-system/  # shared UI primitives and tokens-driven components
  dev/            # dev-only component gallery
  domain/
    tournament/   # pure tournament functions — data in, data out
  features/       # auth, predict, bracket, leagues, matches, home, profile, etc.
  services/
    supabase/     # Supabase client and all queries/RPCs
  styles/         # tokens, fonts, flags
tests/
  domain/         # domain unit tests
  database-parity/# TypeScript/PostgreSQL differential tests
  features/ services/ scripts/ app/
supabase/
  migrations/     # append-only timestamped migrations
  tests/          # local pgTAP behaviour and permission tests
  seed.sql        # fixture/bracket skeleton
  prod-baseline.sql
scripts/
  seed-dev/       # guarded development seeding
  og/             # Open Graph asset rendering
docs/
  quality/        # audits, risk register and current reconciliation
```

## Domain and database principles

Tournament rules are implemented first as pure functions in `src/domain/tournament/`. Components render domain results rather than inventing standings, scoring or bracket rules.

The predicted group-order contract is mirrored by a private PostgreSQL implementation in `predictor_internal`. A local-only workflow rebuilds disposable Supabase, runs database lint and pgTAP, and compares normalized TypeScript and PostgreSQL outputs fixture by fixture.

The database is authoritative for entry locks, submission, derived group positions, atomic bracket replacement, match results, corrections, scoring recomputation, winner propagation and final bracket validity. Private integrity helpers are not exposed as public client RPCs.

## Scoring

`docs/scoring-rules.md` is the single source of truth. Point values are transcribed into `src/domain/tournament/scoringConfig.ts` and mirrored in the SQL scorer. No scoring number should appear as an unexplained literal inside scoring logic.

## Current implementation status

The repository and disposable-local database now have executable coverage for:

- canonical predicted group ordering, including head-to-head recursion and unresolved ties;
- explicit manual same-group and best-third tie decisions;
- TypeScript/PostgreSQL group-order parity;
- RPC-only entry submission and server-derived predicted group positions;
- ownership, lock-time and same-tournament prediction boundaries;
- regulation, extra-time and penalty result confirmation/correction/clear operations;
- immutable result revision history and serialized score recomputation;
- confirmed knockout-winner propagation into later fixtures;
- full match-by-match validation of a predicted 15-match knockout tree; and
- version-checked replacement of a user's complete predicted bracket through one server transaction.

Baseline GitHub Actions CI runs reproducible install, build/type-check, lint, the full application test suite and a high-severity production dependency audit. The database workflow rebuilds every committed migration in disposable local Supabase, runs lint and all pgTAP suites, executes differential parity, and removes the local data afterwards.

**The project is still not ready for a real scored production competition.** The later migrations have not been applied or reconciled against hosted development or production Supabase. Browser E2E, hosted legacy-data preflights, backup/restore rehearsal, automatic real R16 population, pending-write submission flushing and wider immutable reference constraints remain open.

The next repository implementation stage is **automatic population of the real Round of 16 from confirmed group standings and the authoritative best-third table**.

Read [`docs/quality/current-status.md`](docs/quality/current-status.md) before starting work. It is the live implementation-status document. Dated audits and the risk register remain historical evidence. `docs/roadmap.md` and `docs/build-todo.md` contain valuable product and planning history, but their older implementation narratives may lag the current reconciliation and must not override `current-status.md`.

## Where the rules live

| Question | Document |
| --- | --- |
| Current implementation, blockers and next repository action | `docs/quality/current-status.md` |
| Agent instructions, architecture rules, Git and database discipline | `AGENTS.md`, `CLAUDE.md` |
| Scoring and entry validity | `docs/scoring-rules.md` |
| Tournament facts and structure | `docs/tournament-structure.md` |
| Architecture and tournament states | `docs/architecture-and-tournament-states.md` |
| Interface and design system | `docs/design-system.md` |
| Competition boundaries | `docs/competition-structure.md` |
| Product planning history | `docs/roadmap.md`, `docs/build-todo.md` |
| Operations runbooks | `docs/ops-*.md` |
| Audits, risks and post-audit reconciliation | `docs/quality/` |
