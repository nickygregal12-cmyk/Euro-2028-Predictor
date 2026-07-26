# Agent operating rules

Read this file before changing the repository.

## Authority order

For current implementation and operations state, use evidence in this order:

1. current `main` code, migrations and executable tests;
2. verified hosted Netlify/Supabase evidence;
3. `docs/quality/current-status.md`;
4. the latest dated audit and workstream reconciliation notes;
5. older audits, roadmap and TODO documents for history or product intent only.

Never import features, scoring values or game rules from previous World Cup projects, old branches, chats, prototypes or similarly named modes.

## Current repository and hosted boundary

The repository is at contract `36`.

Repository-authoritative facts:

- migration `20260725010000_authoritative_reference_integrity.sql` is merged on `main` through PR #76;
- `config/deployment-contract.json` requires contract `36` and exactly 36 migrations;
- application CI, disposable Database parity and Browser E2E passed on the final PR #76 head;
- PR #101 merged the contract-36 repository reconciliation;
- issue #72 (`DATA-003`) is closed as repository implementation complete;
- disposable/local Supabase is verified through migration 36.

Hosted facts remain separate:

- development Supabase `iouzoutneyjpugbbtdem` is last verified at contract `35`;
- final-target Supabase `vkfnsqdyhvtwyqkisxhk` is last verified at contract `35`;
- the Netlify context historically named `production` is the intended final-target environment, not an active Euro 2028 tournament;
- the accepted contract-35 application/database evidence remains valid until superseded by dated contract-36 hosted evidence.

Do not describe migration 36 as draft, unmerged or outside repository authority. Do not describe either hosted database as contract 36 until its migration history and behaviour are verified.

Read `docs/quality/reconciliations/2026-07-26-contract-36-control-plane-repair.md` for the current authority reconciliation and `docs/quality/reconciliations/2026-07-25-contract-35-production-promotion.md` for the retained hosted contract-35 baseline.

## Immediate contract-alignment gate

Repository contract 36 is intentionally ahead of the hosted databases.

Required order:

1. inspect development Supabase read-only;
2. require a dry run showing only migration 36;
3. apply and verify migration 36 in development;
4. change only development preview/branch/dev contract declarations to 36;
5. restore exact-head deploy-preview smoke on the current `euro28predictor` Netlify project;
6. prepare the final-target upgrade separately and require explicit owner approval before any database write;
7. change the final-target Netlify declaration only after its database is verified at 36.

Never weaken `scripts/validate-deployment-contract.mjs`, change a hosted contract merely to make a build pass, or deploy contract-36 application code against a contract-35 database.

## Remaining launch boundary

Contract compatibility does not make the product tournament-launch-ready. Keep these separate from completed repository work:

- administrator authorization and browser result management;
- authoritative frontend consumption of knockout winner/method/extra-time/penalty data;
- actual Round-of-16 population and unresolved actual-tie workflow;
- automatic valid-entry submission and deadline reminders;
- monitoring ownership, retention/privacy decisions and incident response;
- Turnstile/non-production CAPTCHA verification and leaked-password protection decision;
- branch-protection verification;
- official Euro 2028 teams, fixtures, regulations and lock instant;
- full tournament dress rehearsal and manual assistive-technology review;
- periodic backup/restore and application-rollback rehearsal.

Prepared backup tooling is not recovery evidence. The accepted recovery artifact and clean restore proof are recorded, but periodic recovery rehearsal and final rollback readiness remain operational work. A Netlify rollback is not a database rollback.

## Netlify environment and deployment boundary

- The current repository deploys through the Netlify project named `euro28predictor`.
- The final-target Netlify context uses final-target Supabase only.
- `deploy-preview`, `branch-deploy` and `dev` contexts use development Supabase only.
- `scripts/validate-netlify-environment.mjs` runs before builds and must not be bypassed.
- `config/deployment-contract.json` is the reviewed application/database contract source.
- `scripts/validate-deployment-contract.mjs` verifies migration count and requires the exact hosted contract on Netlify.
- Exact-head preview smoke must target a deploy preview belonging to the current `euro28predictor` project.
- Preview release metadata must match the repository contract only after the development database and its Netlify declaration are verified at that contract.
- Never deploy application code requiring a database contract that has not already been migrated and verified.

## Legacy environment and CAPTCHA boundary

- `euro28-predictor-dev.netlify.app` is **not** a current environment. It is sourced from `nickygregal12-cmyk/worldcup2026`, branch `euro28-development`, and points at inactive Supabase project `gcfdwobpnanjchcnvdco`.
- Do not use it as a deploy-preview target or current test environment.
- Do not repoint, redeploy, pause, delete or otherwise alter that site, its functions, schedule, source repository or Supabase project from this repository workstream. Issue #27 owns the separate decision.
- The current Netlify project supplies a real Turnstile site key to multiple contexts, but development Supabase CAPTCHA configuration remains unverified. Issue #28 owns the decision.
- Do not add broad `netlify.app` Turnstile hostname access to cover dynamic previews.
- Do not use a Cloudflare test site key without the matching test secret/configuration in development Supabase.
- Do not claim preview auth works from a successful static build. Verify login, signup and recovery after the environment-specific CAPTCHA model is approved.

## Git discipline

- Work from current `main` on a dedicated branch.
- Keep one concern per PR where practical.
- Do not push directly to `main`.
- Run the relevant application and database workflows before merge.
- Do not treat a Netlify build alone as proof of database compatibility or authenticated journey health.
- Record material architecture, rule and operations decisions in repository documents rather than chat memory.

## Database discipline

- Migrations are append-only after hosted application.
- Repository migration count and hosted applied state are separate facts.
- Use disposable local Supabase for migration rebuilds, pgTAP and parity tests.
- Hosted inspection defaults to read-only.
- Never run remote reset, destructive repair, unreviewed SQL or final-target data mutation without explicit approval.
- Final-target and development projects must remain isolated.
- Browser roles receive the minimum table/function privileges required; revoke by default for internal, trigger and maintenance helpers.
- The database is authoritative for locks, submission, derived scoring inputs, results, progression and scoring integrity.
- Hosted history is canonical through migration 35 until migration 36 is deliberately applied and verified. Do not repair migration history without a separately proven metadata defect.

## Architecture rules

- Tournament rules belong in pure functions under `src/domain/tournament/` before UI wiring.
- Components render domain output; they do not invent standings, scoring or bracket rules.
- All Supabase browser access goes through `src/services/supabase/`.
- Do not expose private integrity helpers as public browser RPCs.
- Original Predictor and any bonus competitions remain separate competitions and scoring systems.
- Predicted and real brackets must never be blended.
- Fail closed on unresolved ties, invalid tournament references, unknown official data and incompatible hosted schemas.
- Knockout display and social views must consume the authoritative winner and result method; do not infer a penalty winner from a tied public score.

## Scoring authority

`docs/scoring-rules.md` is the scoring source of truth. Values must stay aligned with:

- `src/domain/tournament/scoringConfig.ts`;
- the SQL scorer;
- scoring tests.

No unexplained scoring literal should appear in scoring logic. Approved target rules such as automatic submission must not be described as implemented until server code and exact-boundary tests exist.

## Required checks

For normal application changes:

```bash
npm ci
npm run build
npm run lint
npm run test
npm audit --omit=dev --audit-level=high
```

For migration or tournament-database changes, also run the disposable local database workflow represented by `.github/workflows/database-parity.yml`:

- rebuild all migrations;
- database lint;
- all pgTAP suites;
- TypeScript/PostgreSQL differential parity;
- clean teardown.

Browser-critical changes require the relevant Playwright journeys. Hosted claims require hosted verification appropriate to the change.

## Documentation maintenance

Every merged implementation or hosted-operations batch must update, when affected:

- `docs/quality/current-status.md`;
- `docs/quality/risk-register.md`;
- `docs/quality/feature-baseline.md` when classifications change;
- `docs/ops-pending-migrations.md` for migration changes;
- `docs/ops-production-backup-restore.md` for backup/recovery facts;
- `config/deployment-contract.json` for any migration/API contract change;
- a dated reconciliation note for material integrity/operations work;
- roadmap/TODO only for future sequencing, never as proof of implementation.

Historical audits remain immutable. Correct current state through a new audit or reconciliation note rather than rewriting old evidence.
