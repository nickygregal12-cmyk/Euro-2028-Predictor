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

## Current production boundary

Production application and database are aligned at contract `35`.

Verified production pair:

- repository/deployed source commit `902a37aa6c50c967f8080d751147a5733b251fe3`;
- Netlify deploy `6a652c3d3416d26d595ae2ef`;
- production Supabase `vkfnsqdyhvtwyqkisxhk`;
- exactly 35 canonical migration-history rows through `20260724003000`;
- `replace_predicted_progression(uuid,jsonb,jsonb)` present;
- `delete_match_prediction(uuid,uuid,integer)` present;
- production and Netlify declared contract `35`;
- 63/63 production database checks passed;
- live metadata, security headers, SPA routes, assets and anonymous browser smoke passed;
- production browser requests used no development Supabase endpoint.

Read `docs/quality/reconciliations/2026-07-25-contract-35-production-promotion.md` for the executed rollout evidence.

The former contract-20 mismatch is resolved. Do not reintroduce language that production is awaiting migrations 21–35 or that either client RPC is absent.

Migration 36 remains draft-only in PR #76. It is not repository, development or production authority until separately reviewed and merged.

## Remaining launch boundary

Contract compatibility does not make the product tournament-launch-ready. Keep these separate from the completed rollout:

- monitoring, alert ownership and incident response;
- administrator authorization and browser result management;
- Turnstile/non-production CAPTCHA verification and leaked-password protection decision;
- branch-protection verification;
- official Euro 2028 teams, fixtures, regulations and lock instant;
- full tournament dress rehearsal and manual assistive-technology review;
- wider reference integrity work, including any future migration 36 rollout.

Prepared backup tooling is not recovery evidence. The accepted recovery artifact and clean restore proof are recorded, but periodic recovery rehearsal and final rollback readiness remain operational work. A Netlify rollback is not a database rollback.

## Netlify environment and deployment boundary

- Production Netlify context uses production Supabase only.
- `deploy-preview`, `branch-deploy` and `dev` contexts use development Supabase only.
- `scripts/validate-netlify-environment.mjs` runs before builds and must not be bypassed.
- `config/deployment-contract.json` is the reviewed application/database contract source.
- `scripts/validate-deployment-contract.mjs` verifies migration count and requires the exact hosted contract on Netlify.
- All current contexts declare contract `35`; their Supabase projects remain intentionally different by context.
- Adding a migration requires an explicit review of `deployment-contract.json` and the target hosted database state.
- Never change a hosted contract merely to make a build pass.
- Never deploy application code requiring a database contract that has not already been migrated and verified.

## Legacy environment and CAPTCHA boundary

- `euro28-predictor-dev.netlify.app` is **not** a current environment. It is sourced from `nickygregal12-cmyk/worldcup2026`, branch `euro28-development`, and points at inactive Supabase project `gcfdwobpnanjchcnvdco`.
- Do not use, repoint, redeploy, pause, delete or otherwise alter that site, its functions, schedule, source repository or Supabase project from this repository workstream. Issue #27 owns the separate decision.
- The current production Netlify project supplies a real Turnstile site key to all contexts, but development Supabase CAPTCHA configuration remains unverified. Issue #28 owns the decision.
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
- Never run remote reset, destructive repair, unreviewed SQL or production data mutation without explicit approval.
- Production and development projects must remain isolated.
- Browser roles receive the minimum table/function privileges required; revoke by default for internal, trigger and maintenance helpers.
- The database is authoritative for locks, submission, derived scoring inputs, results, progression and scoring integrity.
- Production history is now canonical through migration 35. Do not repair it again without a separately proven metadata defect.

## Architecture rules

- Tournament rules belong in pure functions under `src/domain/tournament/` before UI wiring.
- Components render domain output; they do not invent standings, scoring or bracket rules.
- All Supabase browser access goes through `src/services/supabase/`.
- Do not expose private integrity helpers as public browser RPCs.
- Original Predictor and any bonus competitions remain separate competitions and scoring systems.
- Predicted and real brackets must never be blended.
- Fail closed on unresolved ties, invalid tournament references, unknown official data and incompatible hosted schemas.

## Scoring authority

`docs/scoring-rules.md` is the scoring source of truth. Values must stay aligned with:

- `src/domain/tournament/scoringConfig.ts`;
- the SQL scorer;
- scoring tests.

No unexplained scoring literal should appear in scoring logic.

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

Browser-critical changes require the relevant Playwright journeys. Production claims require hosted verification appropriate to the change.

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