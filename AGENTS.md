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

## Current critical boundary

Application-code baseline `a403b0796853453cb4115aea55729aced192a6ca` is live through the current Netlify release lineage while production Supabase remains on the original 20-migration schema with no tracked migration-history table.

The executable client depends on two production RPCs that are absent:

- `replace_predicted_progression(...)` for atomic bracket persistence;
- `delete_match_prediction(...)` for version-safe persisted score clearing.

Expected live effects are bracket-save failure and score-clear save failure with the old row able to reappear on reload. Never add an old direct-table fallback.

Before any normal feature work or production promotion:

- read `docs/quality/current-status.md`;
- read `docs/ops-production-backup-restore.md` and `docs/ops-hosted-migration-rollout.md`;
- confirm the application and target database are compatible;
- do not apply hosted migrations until a fresh production logical bundle has been encrypted, retained off the working machine, retrieved, checksum-verified and successfully restored to a disposable target;
- require a reviewed preflight, exact migration-history repair, 21–35-only dry run, named operator/recovery owner and explicit owner approval;
- never point production at development Supabase as a rollback.

Prepared backup tooling is not recovery evidence. A Netlify rollback is not a database rollback.

## Netlify environment boundary

- Production Netlify context uses production Supabase only.
- `deploy-preview`, `branch-deploy` and `dev` contexts use development Supabase only.
- `scripts/validate-netlify-environment.mjs` runs before builds and must not be bypassed.
- A crossed, missing or unknown context is a build failure, not a reason to weaken the guard.
- Database-dependent client changes still require an explicit app/schema compatibility decision before merging to auto-deploying `main`.

## Git discipline

- Work from current `main` on a dedicated branch.
- Keep one concern per PR where practical.
- Do not push directly to `main`.
- Run the relevant application and database workflows before merge.
- Do not treat a Netlify build as proof of database compatibility.
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

Browser-critical journeys still require a future E2E layer; do not claim E2E assurance from component tests.

## Documentation maintenance

Every merged implementation batch must update, when affected:

- `docs/quality/current-status.md`;
- `docs/quality/risk-register.md`;
- `docs/ops-pending-migrations.md` for migration changes;
- `docs/ops-production-backup-restore.md` for backup/recovery facts;
- a dated reconciliation note for material integrity/operations work;
- roadmap/TODO only for future sequencing, never as proof of implementation.

Historical audits remain immutable. Correct current state through a new audit or reconciliation note rather than rewriting old evidence.
