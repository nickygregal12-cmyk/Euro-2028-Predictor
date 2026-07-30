# Euro 2028 Predictor

A mobile-first Euro 2028 football predictor web app built with React 19, TypeScript, Vite, Supabase (Postgres, Auth, RLS and RPCs) and Netlify.

## Current position

Read [`docs/quality/current-status.md`](docs/quality/current-status.md) before starting work.

A controlled environment split is active for PR #193:

- the repository candidate and development Supabase are at **contract 62** through `20260729122200_final_standings_tiebreaks.sql`;
- Netlify `dev`, `branch-deploy` and `deploy-preview` declare 62 and use development Supabase;
- production Supabase and Netlify production remain aligned and re-locked at **contract 60**;
- no contract-61/62 production migration or application deploy has been authorised;
- the verified production release remains the PR #184 Bonus Games application.

Contract 61 adds bounded authenticated post-lock prediction consensus. Contract 62 activates the approved final standings tie-break order after every tournament result while preserving points-only live ranks.

Normal work continues against development Supabase. Production remains milestone-only and requires a fresh backup/preflight, explicit approval and exact release verification.

This does **not** mean the product is tournament-launch-ready. Official Euro 2028 data, operational ownership, Auth/SMTP decisions, manual accessibility review and the full tournament/rollback dress rehearsal remain.

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
  features/       # auth, predict, trends, leagues, matches, games, profile, etc.
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

The repository contract is authoritative for locks, submission, derived group positions, result lifecycle, scoring recomputation, winner propagation, bracket validation, race-safe clearing, function execution boundaries, reference integrity, administrator control, automatic submission, bounded reads, operating caps, Account controls, Bonus Games, post-lock consensus and final standings.

## Scoring and final ranking

`docs/scoring-rules.md` is the scoring source of truth. Values are transcribed into `src/domain/tournament/scoringConfig.ts` and mirrored in SQL.

During the tournament, standings are ranked by points. Once every result is confirmed, equal points are separated by:

1. exact group-stage scores;
2. correct group-stage outcomes;
3. correct knockout teams;
4. correct champion;
5. closest predicted group-stage goals total.

Players still equal after all five share the position.

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
- all pgTAP suites, including privilege allowlists, consensus and final standings;
- TypeScript/PostgreSQL differential parity;
- clean teardown.

Browser E2E covers authenticated desktop/mobile prediction, submission, clearing, bracket conflicts, post-lock rejection, private leagues, Auth recovery, Match Centre, Profile/H2H privacy, Account, Bonus Games, tournament-information states and Prediction Trends. Exact deploy-preview smoke is contract-gated.

## Current contract-62 development candidate

The candidate supports everything in production contract 60 plus:

- a richer locked My Entry state with champion, review, Trends, joker, profile and standings actions;
- bounded post-lock consensus covering champion race, predicted final, awards, agreement/division, trusted team, goals spread and caller-only unique picks;
- final overall/private standings using the approved five-step tie-break order;
- explicit final-standings explanation UI;
- desktop/phone Trends Browser E2E, mobile overflow proof and axe coverage.

Production remains contract 60 until separate approval.

## Documentation authority

| Question | Source |
| --- | --- |
| Current implementation, hosted status, blockers and next action | `docs/quality/current-status.md` |
| Agent, Git and database discipline | `AGENTS.md`; `CLAUDE.md` |
| Current risks | `docs/quality/risk-register.md` |
| Migration inventory and hosted applied state | `docs/ops/ops-pending-migrations.md` |
| Scoring and entry validity | `docs/scoring-rules.md` |
| Tournament facts and structure | `docs/tournament-structure.md` |
| Architecture and tournament states | `docs/architecture-and-tournament-states.md` |
| Interface and design system | `docs/design-system.md` |
| Competition boundaries | `docs/competition-structure.md` |
| Future product sequence | `docs/roadmap.md` |
| Platform architecture decisions | `docs/adr/` |
| Operations records and repeatable procedures | `docs/ops/` |

Dated audits and reconciliations remain historical evidence. Roadmap and TODO documents describe future intent and sequencing, not proof that a feature or migration is live.
