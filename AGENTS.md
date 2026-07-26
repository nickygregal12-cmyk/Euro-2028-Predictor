# Agent operating rules

Read this file before changing the repository.

## Authority order

Use evidence in this order:

1. current `main` code, migrations and executable tests;
2. verified hosted Netlify/Supabase evidence;
3. `docs/quality/current-status.md`;
4. the latest dated reconciliation or audit;
5. older roadmap/TODO/audit documents for history or intent only.

Never import features, scoring values or game rules from previous World Cup projects, old branches, prototypes, chats or similarly named modes.

## Current repository and hosted boundary

The repository, development Supabase and all current non-production Netlify contexts are verified at contract `36`.

Repository/development facts:

- migration `20260725010000_authoritative_reference_integrity.sql` is merged through PR #76;
- `config/deployment-contract.json` requires contract 36 and exactly 36 migrations;
- disposable CI, Database parity and Browser E2E verify the complete migration chain;
- development Supabase `iouzoutneyjpugbbtdem` has exactly 36 canonical migration versions through `20260725010000`;
- migration-36 preflight, function/trigger/privilege checks and rollback-only valid/invalid relationship tests passed in development;
- Netlify `dev`, `branch-deploy` and `deploy-preview` contexts declare contract 36 and use development Supabase only;
- PR #105 proved an exact-head 36/36 deploy preview on the current `euro28predictor` project with HTTP and anonymous browser smoke.

Final-target facts remain separate:

- final-target Supabase `vkfnsqdyhvtwyqkisxhk` is last verified at contract 35;
- the Netlify `production` context remains declared at contract 35;
- the environment historically named production is the intended final target, not an active Euro 2028 tournament;
- its accepted contract-35 application/database evidence remains valid until a separately approved contract-36 promotion replaces it.

Read `docs/quality/reconciliations/2026-07-26-contract-36-development-promotion.md` for current hosted-development evidence and `docs/quality/reconciliations/2026-07-25-contract-35-production-promotion.md` for the retained final-target baseline.

## Immediate contract-alignment gate

Development alignment and preview restoration are complete. The next database stage is final-target preparation:

1. inspect final-target migration history and relevant rows read-only;
2. preserve recoverable pre-change evidence;
3. establish that migration 36 is the only canonical pending migration;
4. run the six fail-closed preflight checks;
5. prepare exact application, verification and rollback-safe smoke commands;
6. obtain explicit owner approval before any final-target database write;
7. apply and verify migration 36 only after approval;
8. change the `production` Netlify declaration to 36 only after database verification;
9. require exact-head production release identity plus HTTP/browser smoke;
10. record a dated final-target reconciliation.

Never weaken either prebuild guard, alter a contract merely to make a build pass, or deploy application code against an incompatible database.

## Split smoke-target boundary

Until the final target is promoted:

- preview smoke explicitly requires contract 36 and the development Supabase project;
- production smoke explicitly requires the retained contract-35 final-target release;
- both smoke implementations require `EURO28_SMOKE_EXPECTED_CONTRACT` and fail closed when it is missing or invalid;
- production smoke does not require the current `main` commit while the contract guard intentionally blocks that commit from production;
- exact-head production verification must be restored during final-target promotion.

## Remaining launch boundary

Contract compatibility does not make the product tournament-launch-ready. Keep these separate:

- administrator authorization and browser result management;
- authoritative frontend consumption of knockout winner/method/extra-time/penalty data;
- actual Round-of-16 population and unresolved actual-tie workflow;
- automatic valid-entry submission and deadline reminders;
- monitoring ownership, retention/privacy and incident response;
- Turnstile/non-production CAPTCHA verification and leaked-password protection decision;
- branch-protection verification;
- official Euro 2028 teams, fixtures, regulations and lock instant;
- full tournament dress rehearsal and manual assistive-technology review;
- periodic backup/restore and application-rollback rehearsal.

Prepared backup tooling is not recovery evidence. A Netlify rollback is not a database rollback.

## Netlify and legacy environment boundary

- The current repository deploys through Netlify project `euro28predictor`.
- `production` uses final-target Supabase only.
- `deploy-preview`, `branch-deploy` and `dev` use development Supabase only.
- `scripts/validate-netlify-environment.mjs` and `scripts/validate-deployment-contract.mjs` must not be bypassed.
- Exact-head preview smoke targets the current `euro28predictor` project.
- `euro28-predictor-dev.netlify.app` is a legacy deployment sourced from `worldcup2026/euro28-development` and inactive Supabase project `gcfdwobpnanjchcnvdco`.
- Never use or modify that legacy site from this workstream. Issue #27 owns the separate decision.
- Development CAPTCHA/Turnstile configuration remains unverified under issue #28. Do not broaden `netlify.app` hostname access or mix unmatched keys/secrets.

## Git discipline

- Work from current `main` on a dedicated branch.
- Keep one coherent concern per PR where practical.
- Do not push directly to `main`.
- Run relevant application, database and browser workflows before merge.
- A Netlify build alone is not proof of database compatibility or authenticated journey health.
- Record material decisions in repository documents rather than chat memory.

## Database discipline

- Migrations are append-only after hosted application.
- Repository, development and final-target migration states are separate facts.
- Use disposable local Supabase for rebuilds, database lint, pgTAP and parity.
- Hosted inspection defaults to read-only.
- Never run a remote reset, destructive repair, unreviewed SQL or final-target mutation without explicit approval.
- Development history is canonical through migration 36; final-target history is canonical through migration 35 until deliberately promoted.
- Browser roles receive minimum privileges; internal trigger and maintenance helpers default to no Data API execution.
- The database is authoritative for locks, submission, derived scoring inputs, results, progression and scoring integrity.

## Architecture rules

- Put tournament rules in pure functions under `src/domain/tournament/` before UI wiring.
- Components render domain output; they do not invent standings, scoring or bracket rules.
- All browser Supabase access goes through `src/services/supabase/`.
- Do not expose private integrity helpers as browser RPCs.
- Original Predictor and bonus competitions remain separate competitions and score systems.
- Predicted and real brackets never blend.
- Fail closed on unresolved ties, invalid references, unknown official data and incompatible schemas.
- Knockout display/social views consume authoritative winner and result-method data; never infer a penalty winner from a tied public score.

## Scoring authority

`docs/scoring-rules.md` is authoritative and must stay aligned with `src/domain/tournament/scoringConfig.ts`, the SQL scorer and tests. Automatic deadline submission is an approved target rule, not an implemented capability.

## Required checks

For normal application changes:

```bash
npm ci
npm run build
npm run lint
npm run test
npm audit --omit=dev --audit-level=high
```

For migration/tournament database changes also run the disposable workflow represented by `.github/workflows/database-parity.yml`: full rebuild, database lint, all pgTAP suites, TypeScript/PostgreSQL parity and clean teardown.

Browser-critical changes require relevant Playwright journeys. Hosted claims require target-specific hosted verification.

## Documentation maintenance

Update affected current-status, risk, feature-baseline, migration inventory, operational runbook and dated reconciliation files whenever material implementation or hosted facts change. Historical audits remain immutable.
