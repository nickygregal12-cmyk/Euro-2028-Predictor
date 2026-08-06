# Football Prediction Hub

A mobile-first, multi-competition football prediction platform built with React 19, TypeScript, Vite, Supabase (Postgres, Auth, RLS and RPCs) and Netlify.

Euro 2028 is the preserved first tournament baseline. The platform now targets reusable domestic league seasons and tournament competitions through separately joined games including Match/Original Predictor, Last Man Standing, Predictor Championship and KO Predictor.

## Current position

Read [`docs/quality/current-status.md`](docs/quality/current-status.md) before starting work. It is the only live authority for:

- current repository and hosted contracts;
- merged implementation;
- open blockers and risks;
- the next executable action;
- production/development release posture.

Do not copy contract numbers or hosted claims from this README into operational work. Normal development uses the development environment; production promotion is an explicit milestone with its own guarded process.

## Setup

```bash
npm ci
npm run dev
npm run test
npm run lint
npm run build
```

Copy `.env.example` to `.env.local` and use development Supabase values only. Never point local development, deploy previews or branch deploys at the final-target production project.

## Product hierarchy

```text
Football Prediction Hub
└── Competition season
    ├── competition dashboard and real football information
    ├── Match or Original Predictor
    ├── Last Man Standing
    ├── Predictor Championship
    ├── KO Predictor where supported
    └── game-scoped private leagues/competitions
```

Following a competition and joining a game are separate actions. Every game owns its own entry, rules, scoring/state and standings.

## Two sites, one account

An accepted direction, **not yet built**: this repository will produce **two frontend deployments over one shared backend** — the weekly platform on the eventual umbrella-brand domain, and Euro 2028 on the purchased tournament domain. One account and one profile work on both; signing up joins no competition, game or private container; and Euro 2028 stays completely hidden from the weekly platform until an owner-approved publication state.

Decision and rejected alternatives: [`docs/adr/0026-public-site-separation-shared-accounts-and-euro-2028-acquisition.md`](docs/adr/0026-public-site-separation-shared-accounts-and-euro-2028-acquisition.md). What remains unimplemented, with a stable identifier each: [`docs/quality/accepted-requirements.md`](docs/quality/accepted-requirements.md).

## Project structure

```text
src/
  app/            # shell, routing and providers
  design-system/  # shared token-driven UI primitives
  dev/            # dev-only component gallery
  domain/
    competition/  # shared pure context, timing and neutral competition rules
    tournament/   # tournament-only rules
    season/       # season-only rules
  features/       # hub, auth, predictions, matches, games, leagues, profiles, admin
  services/
    supabase/     # browser database queries and RPC wrappers
  styles/         # tokens, fonts and identity assets

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
  adr/            # architecture/product decisions
  architecture/   # programme, engineering and information architecture
  quality/        # live status, risks and evidence
  ops/            # repeatable operational procedures
```

## Domain and database principles

- Domain rules are pure: no storage, network or ambient clock reads; time is an input.
- Shared competition rules live under `src/domain/competition/`.
- Tournament and season implementations do not import one another.
- One game's scoring code never imports another's.
- Components render domain/read-model output and never call Supabase directly.
- Browser data access goes through `src/services/supabase/`.
- The database is authoritative for locks, submissions, official results, progression, scoring and server-enforced reveal/access.
- Live feeds are provisional. Protected confirmation/correction remains the permanent scoring/progression gate.
- Competition/game separation must be visible in the interface as well as true in storage.

## Scoring

Scoring is game-specific.

[`docs/scoring-rules.md`](docs/scoring-rules.md) is authoritative for the preserved Euro Original Predictor configuration and stays aligned with TypeScript, SQL and tests. Domestic Match Predictor, season LMS and Predictor Championship rules are governed by their ADRs and dedicated authorities; tournament values are not platform defaults.

## Verification

Application CI includes reproducible install, build/type-check, zero-warning lint, application tests and high-severity production dependency audit.

Database-backed changes additionally use disposable local Supabase for full migration rebuild, database lint, pgTAP, permission/contract checks and TypeScript/PostgreSQL parity.

Browser-critical journeys use authenticated desktop/phone Playwright coverage. Exact deploy-preview/production smoke is contract-gated. Hosted claims require target-specific evidence.

## Documentation authority

| Question | Source |
| --- | --- |
| Current implementation, hosted status, blockers and next action | `docs/quality/current-status.md` |
| Agent, Git and database discipline | `AGENTS.md`; `CLAUDE.md` |
| Current risks | `docs/quality/risk-register.md` |
| Migration inventory and hosted applied state | `docs/ops/ops-pending-migrations.md` |
| Platform/product decisions | `docs/adr/README.md` |
| Accepted requirements that are not yet implemented | `docs/quality/accepted-requirements.md` |
| Hub routes, navigation, onboarding and page ownership | `docs/architecture/hub-information-architecture.md` |
| Competition context, locks and match/game states | `docs/architecture-and-tournament-states.md` |
| Interface and visual design system | `docs/design-system.md` |
| Competition/game separation and private-container structure | `docs/competition-structure.md` |
| Euro tournament facts and structure | `docs/tournament-structure.md` |
| Future product sequence | `docs/roadmap.md` |
| Detailed active/parked inventory | `MASTER-TODO.md` |
| Operations records and procedures | `docs/ops/` |

Dated audits and reconciliations are historical evidence. Planning documents describe target intent and sequencing; code/tests and verified hosted evidence decide implementation truth.
