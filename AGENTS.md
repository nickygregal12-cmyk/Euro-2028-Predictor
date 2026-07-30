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

Stage B is complete on `main` through PR #226. Control, parity, inventory and Stage C foundation work through PRs #228, #229, #232, #233, #235, #239, #245, #246, #250, #252, #255, #258, #261, #264 and #265 is also on `main`. Do not look for a current `main` SHA here — this paragraph pinned `ce17a7fd` through roughly twenty-five subsequent merges before anyone noticed. Read the commit from git; read the contract from `config/deployment-contract.json`.

PR #252 lands the competition/viewer timezone seam but intentionally keeps the viewer fallback until Stage C supplies `tournaments.display_timezone`; do not claim viewer-dependent grouping is fixed. PRs #255, #258 and #261 make committed TypeScript/TSX compiler-project coverage exhaustive and state strictness explicitly. PR #264 type-checks the three JavaScript deploy gates and keeps the remaining JavaScript backlog measured and explicit. PR #265 pins the complete direct Data API relation/view exposure surface. PR #266 adds disposable-local ACQ-R02 scale evidence only; the risk remains open and no materialised standings migration exists. PRs #269, #276 and #284 measure ACQ-R03 across a full group stage, WAL, bloat, the knockout cascade and a concurrency probe. PR #279 freshness-checks the enum surface against the schema. PR #285 makes domain coverage thresholds and compressed bundle budgets CI gates. PR #287 makes `npm run lint` fail on any warning.

**PR #236 is merged**, so the Stage C competition-season design is the approved baseline rather than a proposal. It authorises pre-migration contract-test planning only. Five of the seven pre-migration suites have landed; hostile cross-season relationship failures and lock monotonicity / late-write rejection remain. **Do not create a Stage C migration** — that additionally needs the data-protection review named in PR #236.

The repository is at **contract 64** — `20260730180000_cup_winner_deletion_semantics.sql`, landed by PR #271. That is **not** a Stage C migration; it declares an omitted `on delete` action and is behaviour-preserving. Development Supabase is at contract 64, applied and owner-verified. Production Supabase remains at contract 63, so production Netlify deploys are paused at the contract gate by design and with owner acceptance. Any hosted schema mutation still requires explicit owner approval and the applicable preflight.

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
- Every new public table must keep RLS enabled, and every security-definer function must pin `search_path`; ordinary CI guards both properties through PR #250.
- Every public view and direct browser relation grant must remain in the reviewed exposure allowlist landed through PR #265; a view has no independent RLS protection.

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
- UTC instants decide locks and match state. Competition timezone decides competition-day and matchweek grouping. Viewer/device timezone may change displayed clock time only.
- Account deletion must erase personal identity without rewriting settled competition history. The current cascade/restrict/no-action matrix is characterisation evidence, not the target design.

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

`tsc -b` now strict-checks application code, TypeScript tests, Playwright/e2e fixtures, production-smoke TypeScript, TypeScript scripts, Playwright configs and the three JavaScript deploy gates through referenced projects landed in PRs #255, #258, #261 and #264. PR #261 also fails ordinary CI if any committed `.ts`/`.tsx` file falls outside that project graph. The remaining JavaScript files under `scripts/` are measured in the explicit deferred allowlist; do not describe them as type-checked or remove them from the inventory without evidence.

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