# Agent operating rules

Read this file and `docs/quality/current-status.md` before changing the repository.

## Authority order

Use evidence in this order:

1. current `main` code, migrations and executable tests;
2. verified hosted Netlify/Supabase evidence;
3. `docs/quality/current-status.md`;
4. `docs/roadmap.md` for future sequence;
5. dated reconciliations and older audits for historical evidence only.

Never import features, scoring values or game rules from previous World Cup projects, old branches, prototypes, chats or similarly named modes.

## Current baseline

Repository, development and production are aligned at contract `38`.

- canonical migration history contains exactly 38 versions through `20260727080159`;
- development Supabase is `iouzoutneyjpugbbtdem`;
- production Supabase is `vkfnsqdyhvtwyqkisxhk`;
- every Netlify context declares contract 38 and keeps its assigned Supabase project;
- production deploy `6a67560deb88202a74108c37` passed exact-release HTTP smoke on 27 July 2026;
- production is locked after that milestone release, so normal development must not publish automatically;
- encrypted backup run `30264080847` passed disposable restore verification and its artifact was preserved off GitHub.

Contract compatibility does not make the product tournament-ready. The next product batch is administrator result-management completion followed by a full tournament lifecycle simulation.

## Development operating mode

The project is two years from the tournament and remains in active development. Use proportionate checks:

| Change | Required gate |
| --- | --- |
| Copy, documentation, styling or isolated UI | CI: build, lint, tests and production dependency audit. Add a preview/targeted UI test when appearance or interaction changes. |
| Application feature or development schema | CI plus relevant unit/integration tests. Run Database parity for migrations/tournament database rules and Browser E2E for critical journeys. |
| Production schema, auth, scoring, destructive work or milestone release | Fresh encrypted backup when data could be affected, dry-run/preflight, explicit owner approval, full verification and dated release evidence. |

Rules:

- production promotion is milestone-only;
- development may advance ahead of production, but the difference must be stated once in `docs/quality/current-status.md`;
- combine related schema work into coherent milestone migrations where practical;
- do not require a backup, reconciliation record or production smoke for ordinary UI, documentation or application-only changes;
- keep CI, Database parity and Browser E2E automated and path-scoped;
- reserve the full backup/promotion/recovery sequence for production-risk work;
- review this mode around six months before the tournament, or earlier when real users or valuable live data appear.

## Git discipline

- Work from current `main` on a dedicated branch.
- Keep one coherent concern per PR where practical.
- Do not push directly to `main`.
- Run the checks required by the change class above.
- Netlify build success is not database or authenticated-journey evidence.
- Record current facts in `docs/quality/current-status.md`, not across multiple live status documents.

## Database discipline

- Migrations are append-only after hosted application.
- Use disposable local Supabase for rebuilds, database lint, pgTAP and parity.
- Hosted inspection defaults to read-only.
- Never run a remote reset, destructive repair, unreviewed SQL or production mutation without explicit approval.
- Browser roles receive minimum privileges; internal trigger and maintenance helpers default to no Data API execution.
- The database is authoritative for locks, submission, results, progression and scoring integrity.

## Architecture rules

- Put tournament rules in pure functions under `src/domain/tournament/` before UI wiring.
- Components render domain output; they do not invent standings, scoring or bracket rules.
- All browser Supabase access goes through `src/services/supabase/`.
- Do not expose private integrity helpers as browser RPCs.
- Original Predictor and bonus competitions remain separate competitions and score systems.
- Predicted and real brackets never blend.
- Fail closed on unresolved ties, invalid references, unknown official data and incompatible schemas.
- Knockout display/social views consume authoritative winner and result-method data.

## Scoring authority

`docs/scoring-rules.md` is authoritative and must stay aligned with `src/domain/tournament/scoringConfig.ts`, SQL scoring logic and tests. Automatic deadline submission is planned, not implemented.

## Verification commands

Normal application checks:

```bash
npm ci
npm run build
npm run lint
npm run test
npm audit --omit=dev --audit-level=high
```

Migration/tournament database changes also require the disposable workflow represented by `.github/workflows/database-parity.yml`. Browser-critical changes require relevant Playwright journeys. Hosted claims require target-specific hosted verification.

## Production milestones

For a production database or release milestone:

1. confirm the exact repository head, target project and current contract;
2. create a fresh encrypted backup when the operation could affect stored data;
3. prove the intended migration/release scope with dry-run or equivalent preflight;
4. obtain explicit owner approval before the production write;
5. apply only the approved scope;
6. verify history, permissions, application contract and environment isolation;
7. publish the exact approved build and run exact-head production smoke;
8. lock production again when the milestone is complete;
9. add one concise dated reconciliation.

Never weaken an environment or deployment-contract guard merely to make a build pass.

## Documentation maintenance

- `docs/quality/current-status.md` is the only live status authority.
- `docs/roadmap.md` is the only live execution sequence.
- `docs/build-todo.md` is a compatibility pointer, not a separate checklist.
- Update risk, scoring, architecture or operational runbooks only when their subject changes.
- Dated audits and reconciliations are immutable historical evidence.
- Do not create a new status, audit or reconciliation document for routine development work.
