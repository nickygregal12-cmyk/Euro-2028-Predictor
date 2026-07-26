# Euro 2028 Predictor

A mobile-first Euro 2028 football predictor web app built with React 19, TypeScript, Vite, Supabase (Postgres, Auth, RLS and RPCs) and Netlify.

## Current environment position

Read [`docs/quality/current-status.md`](docs/quality/current-status.md) before starting work.

The repository now targets **contract 36** after migration `20260725010000_authoritative_reference_integrity.sql` merged through PR #76.

The two hosted databases remain deliberately separate from repository authority until they are individually verified and upgraded:

- development Supabase currently remains at the last verified contract-35 baseline;
- the final-target Supabase environment, historically labelled `production`, currently remains at the last verified contract-35 baseline;
- the final-target environment is not serving a live tournament and is approximately two years ahead of Euro 2028;
- neither hosted database should be described as contract 36 until its migration history and schema effects are verified;
- repository contract 36 must not be downgraded merely because a hosted environment has not yet been upgraded.

The completed contract-35 final-target rollout is recorded in [`2026-07-25-contract-35-production-promotion.md`](docs/quality/reconciliations/2026-07-25-contract-35-production-promotion.md). That document remains historical evidence for the verified contract-35 baseline.

This does **not** mean the product is tournament-launch-ready. Monitoring ownership, administrator journeys, Turnstile/Auth configuration, official Euro 2028 data, dress rehearsal and other open controls remain.

## Setup

```bash
npm ci
npm run dev
npm run test
npm run lint
npm run build
```

Copy `.env.example` to `.env.local` and use development Supabase values only. Never point local development, deploy previews or branch deploys at the final-target Supabase environment.

## Project structure

```text
src/
  app/            # app shell, routing, providers
  design-system/  # shared UI primitives and token-driven components
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
  tests/          # local pgTAP behaviour and permission tests
  seed.sql
  prod-baseline.sql
scripts/
  seed-dev/
  database-parity/
  database-rollout/
docs/
  quality/        # audits, risk register, reconciliations and live status
```

## Domain and database principles

Tournament rules are implemented first as pure functions under `src/domain/tournament/`. Components render domain results rather than inventing standings, scoring or bracket behaviour.

The predicted group-order contract is mirrored by a private PostgreSQL implementation in `predictor_internal`. The database-parity workflow rebuilds disposable local Supabase, runs database lint and pgTAP, and compares normalized TypeScript/PostgreSQL outputs fixture by fixture.

Repository contract 36 is authoritative for locks, submission, derived group positions, result lifecycle, scoring recomputation, winner propagation, bracket-tree validation, atomic complete-bracket replacement, version-safe score clearing, exact function execution boundaries and the additional authoritative-reference integrity constraints introduced by migration 36.

Hosted environments become authoritative for contract 36 only after their own migration history, schema effects and verification evidence are recorded.

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
- full migration rebuild through repository contract 36;
- database lint;
- all pgTAP suites, including function privilege allowlists;
- TypeScript/PostgreSQL differential parity;
- clean teardown.

Browser E2E covers disposable authenticated desktop/mobile journeys for score persistence and protected clearing, submission settlement and conflicts, atomic bracket conflicts, post-lock rejection, private-league invitation/join, signup confirmation and password recovery. Match Centre lifecycle coverage includes scheduled, provisional, live, full-time, stale and unavailable-data states. Anonymous hosted-environment smoke covers auth routes, protected-route gates, not-found recovery, metadata, headers and environment isolation. Browser result administration remains open.

## Current implemented repository contract

Repository contract 36 supports:

- canonical predicted group ordering, including recursive head-to-head handling and unresolved ties;
- exact manual same-group and best-third decisions;
- TypeScript/PostgreSQL group-order parity;
- RPC-only submission and server-derived predicted group positions;
- ownership, lock-time and same-tournament prediction boundaries;
- regulation, extra-time and penalty result confirmation/correction/clear operations;
- immutable result revisions and serialized scoring recomputation;
- confirmed knockout-winner propagation;
- full match-by-match predicted bracket replay;
- expected-version, one-transaction complete-bracket replacement;
- pending-write settlement before manual submission;
- version-safe persisted score clearing with derived-position invalidation;
- zero anonymous public-function execution;
- exact authenticated/service function allowlists and owner-only future defaults;
- authoritative same-tournament reference checks introduced by migration 36.

The development and final-target hosted environments remain on their last verified contract-35 baseline until separately reconciled.

## Documentation authority

| Question | Source |
| --- | --- |
| Current implementation, hosted status, blockers and next action | `docs/quality/current-status.md` |
| Contract-36 reconciliation work | `docs/quality/reconciliations/2026-07-26-contract-36-repository-reconciliation.md` |
| Completed final-target contract-35 release evidence | `docs/quality/reconciliations/2026-07-25-contract-35-production-promotion.md` |
| Latest formal audit before contract-35 rollout | `docs/quality/audits/2026-07-25-repeat-verification-audit.md` |
| Agent, Git and database discipline | `AGENTS.md`; `CLAUDE.md` |
| Current risks | `docs/quality/risk-register.md` |
| Migration inventory and hosted applied state | `docs/ops-pending-migrations.md` |
| Scoring and entry validity | `docs/scoring-rules.md` |
| Tournament facts and structure | `docs/tournament-structure.md` |
| Architecture and tournament states | `docs/architecture-and-tournament-states.md` |
| Interface and design system | `docs/design-system.md` |
| Competition boundaries | `docs/competition-structure.md` |
| Future product sequence | `docs/roadmap.md`; `docs/build-todo.md` |
| Operations records and repeatable procedures | `docs/ops-*.md` |

Dated audits and reconciliations remain historical evidence. Roadmap and TODO documents describe future intent and sequencing, not proof that a feature or migration is live.