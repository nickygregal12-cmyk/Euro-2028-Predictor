# Agent operating rules

Read this file and [`docs/quality/current-status.md`](docs/quality/current-status.md) before changing the repository.

## Authority order

Use evidence in this order:

1. current `main` code, migrations and executable tests;
2. dated, attributed hosted Netlify/Supabase evidence;
3. `docs/quality/current-status.md`;
4. `docs/roadmap.md` for future sequence;
5. dated reconciliations and older audits for historical evidence only.

Never import features, scoring values or game rules from previous World Cup projects, old branches, prototypes, chats or similarly named modes.

## Current baseline

The assessed repository baseline is contract `60` on `main` at `7555db4625f8e1c4d9a0cb72185c40391cf90f3f`:

- exactly 60 canonical migrations through `20260729110000_predictor_cup_lint_safe_qualification.sql`;
- `config/deployment-contract.json` declares contract 60 and requires 60 migrations;
- contracts 49–56 contain the Bonus Games programme, 57 adds private Account controls, 58 makes clear-entry non-resurrecting, and 59–60 remove Predictor Cup temporary-table dependencies without changing rules or privileges.

PR #193 is open, draft and unmerged. Its contracts 61–62 are deliberately excluded from the contract-60 baseline. Exact head `901a2bb92b74979283491e5c85d71b01657193a9` passed CI `30456665007`, Database parity `30456665266` and Browser E2E `30456664993`, but hosted alignment remains **REQUIRES OWNER VERIFICATION**.

Do not state development Supabase, production Supabase or any Netlify context as current fact without a verifier/date and the exact check. Use the commands in [`docs/quality/investigations/2026-07-29-euro-2028-baseline-readiness.md`](docs/quality/investigations/2026-07-29-euro-2028-baseline-readiness.md).

## Deferred decisions fixed by the contract-62 candidate

- `DEC-003`: final tie-break ordering activates automatically only after every tournament match is confirmed/corrected; live standings remain points/shared-rank based.
- `DEC-004`: the consensus function has no minimum cohort threshold; one submitted entry can produce output. `PRIV-001` must be resolved or explicitly accepted before PR #193 merges.

These are candidate decisions, not contract-60 baseline behaviour.

## Development operating mode

The project remains in active development. Use proportionate checks:

| Change | Required gate |
| --- | --- |
| Copy, documentation, styling or isolated UI | CI: build, lint, tests and production dependency audit. Add preview/targeted UI verification when appearance or interaction changes. |
| Application feature or development schema | CI plus relevant unit/integration tests. Run Database parity for migrations/tournament database rules and Browser E2E for critical journeys. |
| Production schema, auth, scoring, destructive work or milestone release | Recovery evidence when stored data is at risk, dry-run/preflight, explicit owner approval, full hosted verification and dated release evidence. |

Rules:

- production promotion is milestone-only;
- a development/production split may be stated only after owner verification identifies both actual contracts;
- combine related schema work into coherent milestone migrations where practical;
- do not require production backup, production smoke or a new reconciliation for ordinary UI/docs/application-only work;
- keep CI, Database parity and Browser E2E automated and path-scoped;
- reserve the full backup/promotion/recovery sequence for production-risk work.

## Git discipline

- Work from current `main` on a dedicated branch.
- Keep one coherent concern per PR where practical.
- Do not push directly to `main`.
- Run the checks required by the change class above.
- Netlify build success is not database or authenticated-journey evidence.
- Record current facts in `docs/quality/current-status.md`, not across multiple live status documents.
- Migration timestamps must be unique and strictly above current `main`; no current CI guard proves this automatically, so check it explicitly until one exists.

## Database discipline

- Migrations are append-only after hosted application.
- Use disposable local Supabase for rebuilds, database lint, pgTAP and parity.
- Hosted inspection defaults to read-only.
- Never run a remote reset, destructive repair, unreviewed SQL or production mutation without explicit approval.
- Browser roles receive minimum privileges; internal trigger and maintenance helpers default to no Data API execution.
- The database is authoritative for locks, submission, results, progression, scoring and profile reveal/access boundaries.

## Architecture rules

- Put tournament rules in pure functions under `src/domain/tournament/` before UI wiring.
- Components render domain output; they do not invent standings, scoring or bracket rules.
- All browser Supabase access goes through `src/services/supabase/`.
- Keep pure response parsing/models separate from configured network wrappers.
- Do not expose private integrity helpers as browser RPCs.
- Original Predictor and bonus competitions remain separate competitions and score systems.
- Predicted and real brackets never blend.
- Fail closed on unresolved ties, invalid references, unknown official data and incompatible schemas.
- Knockout display/social views consume authoritative winner and result-method data.
- Other-player detail stays within the authenticated co-member boundary unless a later explicit privacy decision changes it.
- Profile/H2H headline points and ranks come from bounded authoritative server reads.

## Scoring authority

[`docs/scoring-rules.md`](docs/scoring-rules.md) is authoritative and must stay aligned with TypeScript, SQL scoring logic and tests. Automatic valid-entry submission at lock must continue to reuse the authoritative validator.

## Verification commands

```bash
npm ci
npm run build
npm run lint
npm run test
npm audit --omit=dev --audit-level=high
```

Migration/tournament database changes also require `.github/workflows/database-parity.yml`. Browser-critical changes require relevant Playwright journeys. Hosted claims require target-specific owner verification.

## Production milestones

For a production database or release milestone:

1. confirm exact repository head, target project and current contract;
2. create fresh recovery evidence when stored data could be affected;
3. prove intended scope with dry-run or equivalent preflight;
4. obtain explicit owner approval before the production write;
5. apply only the approved scope;
6. verify history, permissions, application contract and environment isolation;
7. publish the exact approved build and run exact-head production smoke;
8. lock production again when complete;
9. add one concise dated reconciliation naming the verifier.

Never weaken an environment or deployment-contract guard merely to make a build pass.

## Documentation maintenance

- `docs/quality/current-status.md` is the only live status authority.
- `docs/roadmap.md` is the only live execution sequence.
- `docs/quality/deferred-decisions.md` records fixed/deferred product decisions.
- `docs/quality/risk-register.md` records current defects and assurance gaps.
- `docs/build-todo.md` is a compatibility pointer, not a separate checklist.
- Dated audits and reconciliations are immutable historical evidence.
- Do not delete a control document as cleanup; archive per `docs/quality/README.md` and fix links.