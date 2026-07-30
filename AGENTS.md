# Agent operating rules

Read this file and [`docs/quality/current-status.md`](docs/quality/current-status.md) before changing the repository.

## Project framing

This repository is a **multi-competition football prediction platform**. Euro 2028 is the first completed competition baseline and is parked for a January 2028 return; it is not the assumption every new feature is allowed to make.

- Platform direction and competition boundaries are governed by [`docs/adr/0011-multi-competition-platform.md`](docs/adr/0011-multi-competition-platform.md) through [`docs/adr/0018-pre-launch-promotion-cadence.md`](docs/adr/0018-pre-launch-promotion-cadence.md).
- The detailed Stage A–L programme is [`docs/architecture/multi-competition-hub-build-plan.md`](docs/architecture/multi-competition-hub-build-plan.md).
- The recoverable tournament reference is `euro-2028-baseline`.
- Do not assume one tournament, one lock instant, one scoring model, one standings table or one competition lifecycle unless the governing authority for that competition says so.
- Do not import features, scoring values or game rules from previous World Cup projects, old branches, prototypes, chats or similarly named modes.

## Authority order

Use evidence in this order:

1. current `main` code, migrations and executable tests;
2. freshly verified hosted Netlify/Supabase evidence;
3. [`docs/quality/current-status.md`](docs/quality/current-status.md);
4. ADRs for decisions;
5. [`docs/roadmap.md`](docs/roadmap.md) for future sequence and [`MASTER-TODO.md`](MASTER-TODO.md) for the detailed active/parked inventory;
6. dated reconciliations and older audits for historical evidence only.

A planning document never overrides an ADR. Process, prepared tooling or a chat statement is not implementation evidence.

## Current baseline

The annotated `euro-2028-baseline` tag resolves to `1fb8ffd36ad113079181829a8bcc47175c43b6da`, preserving the contract-63 Euro 2028 baseline. Remaining tournament work is parked until January 2028.

The hosted values below are the last owner-verified repository record from 29 July 2026. They are not fresh inspection:

- development Supabase: `iouzoutneyjpugbbtdem`;
- production Supabase: `vkfnsqdyhvtwyqkisxhk`;
- repository/application/database contract recorded as 63;
- production promotion recorded as preserving one Auth user, one profile, one entry, one league, 51 matches and 36 saved predictions, with no synthetic Bonus Games player data.

**REQUIRES OWNER VERIFICATION before operational reliance:** run the target-specific applied-state, privilege, environment and release checks in [`docs/quality/current-status.md`](docs/quality/current-status.md). Never copy a stale hosted claim into a new document.

Stage B is complete on `main` through PR #226. Control, parity and inventory work from PRs #228, #229, #232, #233, #235 and #239 is also on `main`, currently `69f6e364132f6586d5de9ed8706b0802d14ec0fc`. Draft PR #236 is the active Stage C competition-season schema design; do not create the Stage C migration until that design and coverage manifest are reviewed. Draft PR #230 adds fresh hosted-evidence boundaries and corrects the live roadmap on top of the merged inventory. Do not duplicate either branch. Any hosted schema mutation still requires explicit owner approval and the applicable preflight.

## Development operating mode

The project remains in active pre-launch development. Use proportionate checks:

| Change | Required gate |
| --- | --- |
| Copy, documentation, styling or isolated UI | CI: build, lint, tests and production dependency audit. Add a preview/targeted UI test when appearance or interaction changes. |
| Application feature or development schema | CI plus relevant unit/integration tests. Run Database parity for migrations or database-backed domain rules and Browser E2E for critical journeys. |
| Production schema, auth, scoring, destructive work or milestone release | Fresh encrypted backup when data could be affected, dry-run/preflight, explicit owner approval, full verification and dated release evidence. |

Rules:

- production promotion is milestone-only;
- development may advance ahead of production, but the difference must be stated once in `docs/quality/current-status.md`;
- combine related schema work into coherent milestone migrations where practical;
- do not require a backup, reconciliation record or production smoke for ordinary UI, documentation or application-only changes;
- keep CI, Database parity and Browser E2E automated and path-scoped without silently excluding future domain siblings;
- reserve the full backup/promotion/recovery sequence for production-risk work;
- review this mode around six months before a public launch, or earlier when real users or valuable live data appear.

## Git discipline

- Work from current `main` or the explicitly named dependency branch on a dedicated branch.
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
- The database is authoritative for locks, submission, results, progression, scoring and profile reveal/access boundaries.
- Competition-season scoping must preserve or strengthen the existing same-reference safeguards.
- No development, rehearsal or simulation path may write to production.

## Architecture rules

- Shared competition rules live as pure functions under `src/domain/competition/`; follow [ADR 0011](docs/adr/0011-multi-competition-platform.md).
- Tournament-only rules remain under `src/domain/tournament/`.
- Season-only rules belong under the future `src/domain/season/` boundary when Stage C/E begins.
- `competition/` does not import from `tournament/` or `season/`; tournament and season code do not import one another.
- All domain layers remain pure: no storage, network or ambient clock reads; time is an input.
- Components render domain output; they do not invent standings, scoring, lock or bracket rules.
- All browser Supabase access goes through `src/services/supabase/`.
- Keep pure response parsing/models separate from configured network wrappers.
- Do not expose private integrity helpers as browser RPCs.
- Follow the separation authorities in [ADR 0011](docs/adr/0011-multi-competition-platform.md) and [ADR 0015](docs/adr/0015-commercial-and-social-model.md); never combine competition entries, points or standings.
- Predicted and real brackets never blend.
- Fail closed on unresolved ties, invalid references, stale/unknown official data and incompatible schemas.
- Knockout display/social views consume authoritative winner and result-method data.
- Other-player detail stays within the authenticated co-member boundary unless a later explicit privacy decision changes it.
- Profile/H2H headline points and ranks come from bounded authoritative server reads; browser logic may derive comparison/accuracy views only.
- Feeds remain provisional/display-only; official confirmation remains the scoring/progression gate.

## Scoring authority

[`docs/scoring-rules.md`](docs/scoring-rules.md) is authoritative for the existing Euro 2028 tournament configuration and must stay aligned with `src/domain/tournament/scoringConfig.ts`, SQL scoring logic and tests.

Season Predictor and Last Man Standing rules are governed by [ADR 0012](docs/adr/0012-season-predictor-rules.md) and [ADR 0013](docs/adr/0013-last-man-standing-season-rules.md). Do not copy tournament values into a season implementation or merge separate scoring authorities for convenience.

Automatic valid-entry submission at the tournament lock is implemented and must continue to reuse the authoritative validator. The recurring season cadence is separate future work, not evidence that the existing mechanism is absent.

## Verification commands

Normal application checks:

```bash
npm ci
npm run build
npm run lint
npm run test
npm audit --omit=dev --audit-level=high
```

Migration or database-backed domain changes also require the disposable workflow represented by `.github/workflows/database-parity.yml`. Browser-critical changes require relevant Playwright journeys. Hosted claims require target-specific hosted verification.

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
- `MASTER-TODO.md` is the only detailed active/parked inventory.
- `docs/build-todo.md` is a compatibility pointer, not a separate checklist.
- Update risk, scoring, architecture or operational runbooks only when their subject changes.
- Dated audits and reconciliations are immutable historical evidence.
- Archive superseded controls under the governed history directory; never delete one as cleanup.
- Do not create a new status, audit or reconciliation document for routine development work.
