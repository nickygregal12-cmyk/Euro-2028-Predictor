# Euro 2028 Predictor

A mobile-first Euro 2028 football predictor web app built with React 19, TypeScript, Vite, Supabase (Postgres, Auth, RLS and RPCs) and Netlify.

## Current warning

Read [`docs/quality/current-status.md`](docs/quality/current-status.md) before starting work.

The `2026-07-23L` live audit confirmed that production Netlify serves the post-PR #14 application while both hosted Supabase projects still have the original 20-migration schema. Production does not contain the atomic bracket replacement RPC used by the deployed client. Treat application/database compatibility as the first recovery priority; do not apply hosted migrations or change production configuration without a reviewed plan and explicit approval.

## Setup

```bash
npm ci
npm run dev
npm run test
npm run lint
npm run build
```

Copy `.env.example` to `.env.local` and use development Supabase values only. Never point local development, deploy previews or branch deploys at production Supabase.

## Project structure

```text
src/
  app/            # app shell, routing, providers
  design-system/  # shared UI primitives and tokens-driven components
  dev/            # dev-only component gallery
  domain/
    tournament/   # pure tournament rules and calculations
  features/       # auth, predict, bracket, leagues, matches, home, profile, etc.
  services/
    supabase/     # browser database queries and RPC wrappers
  styles/         # tokens, fonts, flags
tests/
  domain/
  database-parity/
  features/ services/ scripts/ app/
supabase/
  migrations/     # append-only repository migration chain
  tests/          # local pgTAP behavior and permission tests
  seed.sql
  prod-baseline.sql
scripts/
  seed-dev/
  database-parity/
  og/
docs/
  quality/        # audits, risk register and live status
```

## Domain and database principles

Tournament rules are implemented first as pure functions under `src/domain/tournament/`. Components render domain results rather than inventing standings, scoring or bracket behavior.

The predicted group-order contract is mirrored by a private PostgreSQL implementation in `predictor_internal`. The database-parity workflow rebuilds disposable local Supabase, runs database lint and pgTAP, and compares normalized TypeScript/PostgreSQL outputs fixture by fixture.

In the latest repository migration chain, the database is authoritative for locks, submission, derived group positions, result lifecycle, scoring recomputation, winner propagation, bracket-tree validation and atomic complete-bracket replacement. Those controls are not considered deployed until the target hosted schema is inspected, migrated and verified.

## Scoring

`docs/scoring-rules.md` is the source of truth. Values are transcribed into `src/domain/tournament/scoringConfig.ts` and mirrored in SQL. No scoring value should appear as an unexplained literal in scoring logic.

## Verification

Application CI runs:

- reproducible install;
- build/type-check;
- lint;
- application tests;
- high-severity production dependency audit.

Database parity CI runs:

- disposable local Supabase start;
- full migration rebuild;
- database lint;
- all pgTAP suites;
- TypeScript/PostgreSQL differential parity;
- clean teardown.

PR #14's application CI run #71 and database parity run #40 passed. Browser E2E remains absent and is still a launch blocker.

## Repository/local implementation

The repository and disposable-local database have executable coverage for:

- canonical predicted group ordering, including recursive head-to-head handling and unresolved ties;
- exact manual same-group and best-third decisions;
- TypeScript/PostgreSQL group-order parity;
- RPC-only submission and server-derived predicted group positions;
- ownership, lock-time and same-tournament prediction boundaries;
- regulation, extra-time and penalty result confirmation/correction/clear operations;
- immutable result revisions and serialized scoring recomputation;
- confirmed knockout-winner propagation;
- full match-by-match predicted bracket replay;
- expected-version, one-transaction complete-bracket replacement.

The 13 migrations implementing the later database controls are not applied to either hosted Supabase project as of the live audit.

## Documentation authority

| Question | Source |
| --- | --- |
| Current implementation, hosted status, blockers and next action | `docs/quality/current-status.md` |
| Latest formal evidence | `docs/quality/audits/2026-07-23-live-environment-audit.md` |
| Agent, Git and database discipline | `AGENTS.md`; `CLAUDE.md` |
| Current risks | `docs/quality/risk-register.md` |
| Migration inventory and hosted applied state | `docs/ops-pending-migrations.md` |
| Scoring and entry validity | `docs/scoring-rules.md` |
| Tournament facts and structure | `docs/tournament-structure.md` |
| Architecture and tournament states | `docs/architecture-and-tournament-states.md` |
| Interface and design system | `docs/design-system.md` |
| Competition boundaries | `docs/competition-structure.md` |
| Future product sequence | `docs/roadmap.md`; `docs/build-todo.md` |
| Operations runbooks | `docs/ops-*.md` |

Dated audits are retained as historical evidence. Roadmap and TODO documents describe intent and sequencing, not proof that a feature or migration is live.
