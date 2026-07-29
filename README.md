# Euro 2028 Predictor

A mobile-first Euro 2028 football predictor web app built with React 19, TypeScript, Vite, Supabase (Postgres, Auth, RLS and RPCs) and Netlify.

## Current position

Read [`docs/quality/current-status.md`](docs/quality/current-status.md) before starting work.

The repository, development Supabase, production Supabase and production application are aligned at **contract 60**:

- `config/deployment-contract.json` declares contract 60 and requires 60 canonical migrations;
- development Supabase `iouzoutneyjpugbbtdem` and production Supabase `vkfnsqdyhvtwyqkisxhk` both hold the canonical history through `20260729110000_predictor_cup_lint_safe_qualification.sql`;
- every Netlify context declares contract 60 while retaining the correct development/production Supabase boundary;
- production deploy `6a69b630f65752000822324e` is ready from release-alignment commit `31e06271f5f5b753c0bacf20353097055880988e`;
- the production deployment completed with no build error, no secret-scan findings, and Netlify Lighthouse scores of 95 performance, 100 accessibility, 100 best practices and 100 SEO;
- the contract-60 milestone includes the complete Bonus Games programme, private Account controls, race-safe entry clearing, Match Centre resilience, the Predict journey, secure Profile/H2H, automated accessibility scanning and the first tournament-information cut.

Normal work continues against development Supabase. Production remains milestone-only and re-locked between approved releases.

This does **not** mean the product is tournament-launch-ready. Post-lock consensus/My-entry states, final league tie-breaker activation, official Euro 2028 data, operational ownership, Auth/SMTP/CAPTCHA decisions, manual accessibility review and the full dress rehearsal remain.

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

The repository contract is authoritative for locks, submission, derived group positions, result lifecycle, scoring recomputation, winner propagation, bracket-tree validation, atomic complete-bracket replacement, race-safe clearing, function execution boundaries, authoritative reference integrity, administrator result/qualification control, automatic submission, bounded reads, operating caps, Account entry controls and Bonus Games lifecycle rules.

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

Browser E2E covers authenticated desktop/mobile journeys for prediction persistence and clearing, submission settlement/conflicts, bracket conflicts, post-lock rejection, private leagues, Auth recovery, Match Centre, Profile/H2H privacy, Account controls, Bonus Games and tournament-information states.

## Current implemented repository contract

Repository contract 60 supports:

- canonical group ordering, recursive head-to-head handling and explicit unresolved ties;
- RPC-only submission, automatic valid-entry submission and server-derived predicted positions;
- authoritative result confirmation/correction/clearing, immutable revisions and serialised scoring;
- actual qualification, best-third decisions, bracket replay and winner propagation;
- atomic predicted-bracket replacement and race-safe complete entry clearing;
- exact function privilege allowlists and closed browser access to integrity helpers;
- bounded overall/private-league standings, player profiles and H2H reads;
- operating-cap enforcement and anonymous-safe capacity preflight;
- private Account controls and privacy/contact-admin content;
- separate Bonus Games platform, KO Predictor, Last Man Standing and full Predictor Cup lifecycle;
- resilient Match Centre, Predict journey, Matches tournament-information views and automated axe coverage;
- environment/deployment-contract guards, verified backup/restore and production-aligned release controls.

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
| Platform architecture decisions | `docs/adr/` |
| Operations records and repeatable procedures | `docs/ops-*.md` |

Dated audits and reconciliations remain historical evidence. Roadmap and TODO documents describe future intent and sequencing, not proof that a feature or migration is live.