# Current quality status

> This is the live repository implementation-status document. It is derived from the dated 23 July 2026 audits plus later repository evidence. The dated audits and risk register remain historical snapshots and are not rewritten. Older implementation narratives in `docs/roadmap.md`, `docs/build-todo.md` and `CLAUDE.md` must not override this file.

## Audit identity

| Field | Current value |
| --- | --- |
| Last formal audit date | 2026-07-23 (`2026-07-23R`, repeat verification) |
| Baseline audit | [`2026-07-23-full-audit.md`](audits/2026-07-23-full-audit.md) at `b68c4858a179adce433e01db439cabb93c6a0c01` |
| Latest formal audit | [`2026-07-23-repeat-verification-audit.md`](audits/2026-07-23-repeat-verification-audit.md) |
| Repository | `nickygregal12-cmyk/Euro-2028-Predictor` |
| Repeat-audit environment | Isolated source archive; no deployed site, database, Netlify or GitHub access |
| Production domains identified | `euro28predictor.com`; `euro28predictor.netlify.app` |
| Development Supabase reference | `iouzoutneyjpugbbtdem` |
| Production Supabase reference | `vkfnsqdyhvtwyqkisxhk` — live since 2026-07-22 with the 20 migrations then present; later repository migrations remain unapplied and unverified |

Project references identify environments. No credentials or private keys are stored here.

## Post-audit repository evidence

The formal audits and historical risk register remain unchanged. Later implementation is recorded through repository PRs and reconciliation notes:

- PR #1 — baseline GitHub Actions CI.
- PRs #3 and #4 — canonical TypeScript predicted-group-order contract.
- PR #5 — documentation reconciliation for the group-order workstream.
- PR #6 — manual same-group and best-third resolution flows.
- PR #7 — private PostgreSQL group-order resolver, pgTAP permissions and TypeScript/PostgreSQL differential parity; merge `a188ecfb048608813e887b7b02b97c67d6555b97`.
- PR #8 — completion-status documentation reconciliation.
- PR #9 — RPC-only submission, server-derived predicted group positions, same-tournament guards and adversarial RLS/RPC coverage; merge `773ffdc983663ba8c4c8a504d621a343717f5396`.
- PR #10 — application-only production rollback instructions; merge `3875bb62647b22ad3b73b9a5c265446d00b31c0c`.
- PR #11 — authoritative regulation/extra-time/penalty result lifecycle, revision history, derived winner and serialized scoring recomputation; merge `f3aeebaf1e6b16fcb9909728ea670b0a8a37703c`.
- PR #12 — full predicted knockout-tree replay and winner-fed QF/SF/final propagation; merge `0112bfa6283c089048534c5e75678dbeefd14b4e`.
- PR #13 — live-document authority reconciliation; merge `02e9fe21cd862c57e3ba028409d648f3d4a559eb`.
- PR #14 — complete version-checked predicted-bracket replacement through one owner-checked server transaction in this repository state; hosted verification remains outstanding.

Current reconciliation notes:

- [`2026-07-23-group-order-contract.md`](reconciliations/2026-07-23-group-order-contract.md)
- [`2026-07-23-database-parity-foundation.md`](reconciliations/2026-07-23-database-parity-foundation.md)
- [`2026-07-23-entry-boundary-integrity.md`](reconciliations/2026-07-23-entry-boundary-integrity.md)
- [`2026-07-23-production-rollback-boundary.md`](reconciliations/2026-07-23-production-rollback-boundary.md)
- [`2026-07-23-knockout-result-lifecycle.md`](reconciliations/2026-07-23-knockout-result-lifecycle.md)
- [`2026-07-23-knockout-bracket-tree-integrity.md`](reconciliations/2026-07-23-knockout-bracket-tree-integrity.md)
- [`2026-07-23-post-func-001-docs-reconciliation.md`](reconciliations/2026-07-23-post-func-001-docs-reconciliation.md)
- [`2026-07-23-atomic-bracket-persistence.md`](reconciliations/2026-07-23-atomic-bracket-persistence.md)

This later evidence supersedes historical statements that the repository had no baseline CI, no canonical group-order contract, no executable SQL parity, no RPC-only submission boundary, no authoritative knockout result model, no match-by-match bracket validation or no atomic compound bracket write boundary. It does not prove hosted migration parity, production legacy-data compatibility, browser E2E behaviour or operational recovery readiness.

## Current verdicts

| Verdict | Current value | Evidence/reference |
| --- | --- | --- |
| Development | **Safe to continue controlled repository development.** The principal entry, result and bracket-integrity defects now have executable disposable-local containment, including atomic bracket persistence. | PRs #7, #9, #11, #12 and #14 |
| Production | **Not ready for a real scored competition.** Later migrations have not been applied or reconciled against hosted data; browser journeys and recovery controls remain incomplete. | Hosted evidence boundary; `OPS-003`; `OPS-005`; `TEST-001` |
| Environment isolation | **Repository instructions preserve the production/development boundary; operational assurance remains partial.** | PR #10; rollback reconciliation |
| Database assurance | **Strong disposable-local assurance; repository/static assurance only for hosted projects.** | Database parity workflow; PRs #7, #9, #11, #12 and #14 |
| Regression position | **No intentional product-scope regression identified.** Later work adds enforcement, tests and safer operations boundaries. | Feature baseline; repository PR scope |

## Implemented repository/local integrity boundaries

Disposable local Supabase now executes and tests:

- recursive predicted group ordering and exact manual resolution handling;
- client denial of private integrity functions;
- multi-user ownership and RLS behaviour;
- RPC-only entry submission and lock-time rejection;
- server-derived predicted group positions and invalidation/refresh;
- same-tournament prediction references;
- regulation, extra-time and penalty result confirmation/correction/clear operations;
- immutable result revision history;
- serialized tournament score recomputation;
- penalty-decided champion scoring and final rank-history capture;
- confirmed knockout-winner propagation;
- downstream-result protection during upstream correction;
- complete predicted R16 derivation and 15-match bracket-tree replay;
- client denial of direct predicted-progression DML;
- complete expected-version conflict detection for bracket snapshots; and
- atomic delete/update/insert replacement of the whole predicted progression set.

## Current blockers

| Blocker group | Open findings / summary |
| --- | --- |
| Critical findings | `DATA-001`, `DATA-002`, `SECURITY-001` and `SECURITY-002` have repository/local implementation evidence but still require targeted finding review and hosted migration verification. The unsafe `OPS-001` instruction is removed; wider recovery readiness remains open under `OPS-003`. |
| High findings | `FUNC-001` and `REL-004` have repository/local implementation evidence. `DATA-003` remains partial; `FUNC-002`, `DATA-004`, `DATA-005`, `REL-002`, `REL-003`, `DATA-006`, `OPS-002`, `OPS-005`, the browser/hosted portions of `TEST-001` and wider `OPS-003` remain open. `REL-001` is materially narrowed by transactional tournament scoring locks. |
| Launch blockers | Approved hosted migration and legacy-data reconciliation; automatic real R16 population; pending-write submission flushing; browser result administration and E2E; verified backup/restore and incident recovery. |
| Security blockers | Hosted verification of current RLS/functions; remaining reference-data constraints; `OPS-002`; `OPS-005`; verification of current hosted configuration. |
| Data-integrity blockers | Remaining `DATA-003`; `DATA-004`; `DATA-005`; `REL-003`; automatic real R16 population; hosted verification of PRs #9, #11, #12 and #14. |
| Environment/operations blockers | `OPS-002`, `OPS-003`, `OPS-005`, hosted rollout/reconciliation and hosted/browser portions of `TEST-001`. |

## Current regressions

Neither dated audit classified a previously verified production capability as a regression. The two recorded safeguard failures are contained in the repository layer:

- `SAFE-007` — direct submission bypass — contained locally through PR #9, pending hosted rollout and targeted status review;
- `SAFE-031` — rollback crossed production/development boundaries — removed from the current runbook through PR #10, pending targeted status review.

## Compact baseline

| Measure | Current value | Evidence/reference |
| --- | --- | --- |
| Explicit production routes | 23 routes plus catch-all; one dev-only component-gallery route | `src/App.tsx`; repeat audit |
| Supabase migrations | Audit baseline 20; later resolver, entry, result, bracket-tree and atomic-persistence migrations added through PRs #7, #9, #11, #12 and #14 | Repository migration inventory |
| Application tests | Repeat audit: 42 files / 335 tests passed; later service and feature tests run in current application CI | Repeat audit; current CI |
| Build/type-check/lint | Green in current application CI after the atomic RPC response was explicitly typed | Current CI |
| Dependency audit | High-severity production audit green | Current CI |
| Scoring values | No scoring value changed by PRs #9, #11, #12 or #14 | Scoring documents and migration scope |
| Database integration | Disposable Supabase covers group-order parity, entry/RLS attacks, submission, derived positions, authoritative results, revisions, scoring locks, winner propagation, full predicted-tree replay and atomic complete-bracket replacement | PRs #7, #9, #11, #12 and #14 |
| Browser E2E | No browser E2E framework or complete critical journeys identified | `TEST-001` |
| Hosted production | Later migrations and real legacy data unverified | `OPS-005`; hosted rollout boundary |
| Historical findings | Audit baseline: 47 findings — 5 Critical, 14 High, 14 Medium, 14 Low | [`risk-register.md`](risk-register.md) |

## Resolved or materially narrowed unknowns

- canonical TypeScript and private PostgreSQL group ordering;
- exact differential parity for the committed group-order fixtures;
- local permissions, RLS, submission ownership and tournament isolation;
- server-derived predicted group positions and post-lock protection;
- authoritative regulation, extra-time and penalty result representation;
- protected confirmation, correction and clear operations with revision history;
- serialized score recomputation and penalty-decided champion scoring;
- real winner propagation from R16 through QF, SF and final;
- full predicted Round of 16 derivation and 15-match bracket replay;
- rejection of stage-count-correct but structurally impossible brackets;
- one-transaction, version-checked replacement of complete predicted brackets;
- repository rollback instructions preserving environment isolation.

## Still unresolved

- hosted production schema, policies, migration history and fail-closed legacy-data preflights;
- current Netlify production values and deploy-context isolation;
- automatic real R16 population from confirmed group standings and best-third ranking;
- explicit flushing/waiting for every pending debounced prediction write before submit (`REL-003`);
- wider same-tournament/reference constraints (`DATA-003`);
- result-entry administration UI and authenticated browser journeys;
- Supabase Auth/email and Cloudflare Turnstile dashboard configuration verification;
- GitHub branch protection and required checks;
- production logs, monitoring and real scoring output;
- verified backups and rehearsed restore capability;
- runtime parity between the audit container and Netlify (`OPS-004`);
- final official Euro 2028 regulations, teams, fixtures and exact lock instant.

## Documentation authority

- Use this file for current implementation, blockers and next repository work.
- Use dated audits and `risk-register.md` for historical findings and audit evidence.
- Use reconciliation notes for the exact boundary of later repository work.
- Use `roadmap.md` and `build-todo.md` for product planning history and future scope, but verify implementation claims against this file and current code.
- Do not claim a repository/local fix is deployed until the hosted rollout is explicitly approved, applied and verified.

## Immediate next action

The next repository implementation batch should populate the **real Round of 16 participants from confirmed group standings and the authoritative best-third ranking**. It must use the same group-order and third-place rules already proven for predicted brackets, fail closed on unresolved real ties, and populate all eight R16 fixtures transactionally without overwriting confirmed downstream results.

The following linked reliability batch should close `REL-003` by flushing or awaiting every pending debounced prediction write before manual submission.

Hosted verification remains a separate explicitly approved workstream. Do not apply PR #9, #11, #12 or #14 migrations to either hosted Supabase project without a reviewed rollout, read-only preflight evidence and a remediation/backup plan.
