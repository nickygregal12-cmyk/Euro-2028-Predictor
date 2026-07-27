# Euro 2028 Predictor

A mobile-first Euro 2028 football predictor web app built with React 19, TypeScript, Vite, Supabase (Postgres, Auth, RLS and RPCs) and Netlify.

## Current position

Read [`docs/quality/current-status.md`](docs/quality/current-status.md) before starting work.

The repository and development environments are at **contract 44**; production is deliberately locked at **contract 38**:

- `config/deployment-contract.json` declares contract 44 and requires 44 canonical migrations;
- development Supabase has the canonical history through `20260727191942_operating_cap_enforcement`;
- non-production Netlify contexts declare contract 44; production declares 38, retaining development/production isolation;
- administrator result control, the full tournament lifecycle, automatic valid-entry submission, bounded/paginated reads and operating-cap enforcement are merged (PRs #120–#136).

Production deploy `6a67560deb88202a74108c37` passed exact-release HTTP smoke and is locked after the milestone. Normal work continues against development Supabase `iouzoutneyjpugbbtdem`; production Supabase `vkfnsqdyhvtwyqkisxhk` is promoted only at deliberate milestones.

The project now uses proportionate Development Mode gates: ordinary UI/docs use CI and targeted previews, feature/schema work adds relevant parity/E2E, and the full backup/approval/promotion sequence is reserved for production-risk work.

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

The repository contract (declared in `config/deployment-contract.json`) is authoritative for locks, submission, derived group positions, result lifecycle, scoring recomputation, winner propagation, bracket-tree validation, atomic complete-bracket replacement, version-safe score clearing, function execution boundaries, authoritative same-tournament reference integrity, administrator result and qualification authorization, automatic valid-entry submission and bounded/paginated read models.

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
- full migration rebuild through the current repository contract;
- database lint;
- all pgTAP suites, including function privilege allowlists;
- TypeScript/PostgreSQL differential parity;
- clean teardown.

Browser E2E covers disposable authenticated desktop/mobile journeys for score persistence and protected clearing, submission settlement and conflicts, atomic bracket conflicts, post-lock rejection, private-league invitation/join, signup confirmation, password recovery and Match Centre lifecycle/navigation.

## Current implemented repository contract

Repository contract 44 supports:

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
- authoritative reference integrity for group-team, match, player, result revision, Golden Boot and score-event relationships;
- browser-authorised administrator result confirmation, correction, clearing and revision access with capability enforcement;
- server-owned actual Round-of-16 population and authorised third-place qualification-boundary resolution with immutable revisions;
- database-scheduled automatic submission of complete valid entries at lock with owner-visible outcomes;
- bounded league, member, pick-comparison and rival-entry reads;
- server-ranked keyset pagination for overall standings with current-user position context;
- transaction-serialised public-user and total-league operating limits with anonymous-safe capacity preflight.

## Documentation authority

| Question | Source |
| --- | --- |
| Current implementation, hosted status, blockers and next action | `docs/quality/current-status.md` |
| Agent, Git and database discipline | `AGENTS.md`; `CLAUDE.md` |
| Current risks | `docs/quality/risk-register.md` |
| Migration inventory and hosted applied state | `docs/ops-pending-migrations.md` |
| Scoring and entry validity | `docs/scoring-rules.md` |
| Tournament facts and structure | `docs/tournament-structure.md` |
| Architecture and tournament states | `docs/architecture-and-tournament-states.md` |
| Interface and design system | `docs/design-system.md` |
| Competition boundaries | `docs/competition-structure.md` |
| Future product sequence | `docs/roadmap.md` |
| Operations records and repeatable procedures | `docs/ops-*.md` |

Dated audits and reconciliations remain historical evidence. Roadmap and TODO documents describe future intent and sequencing, not proof that a feature or migration is live.
