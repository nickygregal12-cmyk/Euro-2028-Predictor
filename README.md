# Euro 2028 Predictor

A mobile-first Euro 2028 football predictor web app built with React 19, TypeScript, Vite, Supabase (Postgres, Auth, RLS and RPCs) and Netlify.

## Current position

Read [`docs/quality/current-status.md`](docs/quality/current-status.md) before starting work.

The repository and development environment are now at **contract 38**:

- `config/deployment-contract.json` declares contract 38 and requires 38 canonical migrations;
- development Supabase has the exact canonical history through `20260727080159`;
- non-production Netlify contexts declare contract 38;
- the administrator foundation and browser-authorised result RPC boundaries are merged.

Production Supabase `vkfnsqdyhvtwyqkisxhk` is intentionally retained at **contract 36**, with exactly migrations `20260727075922` and `20260727080159` pending until a controlled promotion. Development Supabase is `iouzoutneyjpugbbtdem` and has nothing pending.

The Netlify/Supabase context historically named `production` is the intended final-target environment. It is not supporting a live Euro 2028 tournament. It must still remain isolated and controlled because it preserves the intended final configuration and retained verification data.

The administrator migration reconciliation is recorded in [`2026-07-27-admin-migration-version-reconciliation.md`](docs/quality/reconciliations/2026-07-27-admin-migration-version-reconciliation.md). The production 36→38 procedure is [`docs/ops-production-promotion-contract-38.md`](docs/ops-production-promotion-contract-38.md).

This does **not** mean the product is tournament-launch-ready. Official Euro 2028 data, administrator journeys, monitoring ownership, Auth/CAPTCHA configuration, accessibility review and a full dress rehearsal remain.

## Setup

```bash
npm ci
npm run dev
npm run test
npm run lint
npm run build
```

Copy `.env.example` to `.env.local` and use development Supabase values only. Never point local development, deploy previews or branch deploys at the final-target Supabase project.

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

The predicted group-order contract is mirrored by a private PostgreSQL implementation in `predictor_internal`. Database parity rebuilds disposable local Supabase, runs database lint and pgTAP, and compares normalized TypeScript/PostgreSQL outputs fixture by fixture.

Repository contract 38 is authoritative for locks, submission, derived group positions, result lifecycle, scoring recomputation, winner propagation, bracket-tree validation, atomic complete-bracket replacement, version-safe score clearing, function execution boundaries, authoritative same-tournament reference integrity and administrator result authorization/revision projection.

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
- full migration rebuild through contract 38;
- database lint;
- all pgTAP suites, including function privilege allowlists;
- TypeScript/PostgreSQL differential parity;
- clean teardown.

Browser E2E covers disposable authenticated desktop/mobile journeys for score persistence and protected clearing, submission settlement and conflicts, atomic bracket conflicts, post-lock rejection, private-league invitation/join, signup confirmation, password recovery and Match Centre lifecycle/navigation.

## Current implemented repository contract

Repository contract 38 supports:

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
- authoritative reference integrity for group-team, match, player, result revision, Golden Boot and score-event relationships.
- browser-authorised administrator result confirmation, correction, clearing and revision access with capability enforcement.

## Documentation authority

| Question | Source |
| --- | --- |
| Current implementation, hosted status, blockers and next action | `docs/quality/current-status.md` |
| Contract-38 administrator reconciliation | `docs/quality/reconciliations/2026-07-27-admin-migration-version-reconciliation.md` |
| Production 36→38 promotion procedure | `docs/ops-production-promotion-contract-38.md` |
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
