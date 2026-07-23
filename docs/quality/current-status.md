# Current quality status

> Concise operational summary derived from the [23 July 2026 full audit](audits/2026-07-23-full-audit.md) and the [23 July 2026 repeat verification audit](audits/2026-07-23-repeat-verification-audit.md) (`2026-07-23R`). Use the dated reports and risk register for evidence; do not turn this file into a second backlog.

## Audit identity

| Field | Current value |
| --- | --- |
| Last audit date | 2026-07-23 (`2026-07-23R`, repeat verification) |
| Baseline audit | [`2026-07-23-full-audit.md`](audits/2026-07-23-full-audit.md) at commit `b68c4858a179adce433e01db439cabb93c6a0c01` |
| Latest audit report | [`2026-07-23-repeat-verification-audit.md`](audits/2026-07-23-repeat-verification-audit.md) |
| Audited repository | `nickygregal12-cmyk/Euro-2028-Predictor` |
| Audited branch | Baseline `main`; repeat audit **branch not determinable** (source archive carried no version-control metadata) |
| Audited application commit SHA | Baseline `b68c4858a179adce433e01db439cabb93c6a0c01`; repeat audit **SHA not determinable** — correspondence inferred from exact structural counters, not proven |
| Repeat-audit artefact | Repository source archive extracted to an isolated container; no deployed site, database, Netlify or GitHub access |
| Deployment evidence | Baseline only: Netlify production deployment metadata at the audited commit. The repeat audit exercised **no** deployed environment. |
| Deployed domains identified | `euro28predictor.com`; `euro28predictor.netlify.app` |
| Development Supabase project reference | `iouzoutneyjpugbbtdem` |
| Production Supabase project reference | `vkfnsqdyhvtwyqkisxhk` — **live since 2026-07-22**, all 20 migrations then present applied, baseline data loaded, real accounts created (`docs/ops-prod-cutover.md`) |

Project references identify environments; no credentials or browser keys are stored here.

## Post-audit reconciliation

The dated audits above remain unchanged. Later repository changes are recorded separately so historical evidence is not rewritten.

- Baseline GitHub Actions CI merged through PR #1.
- TypeScript predicted-group-order contract Batch 1 merged through PR #3 at `3c0b5cd77490666e706cf3a7855e11417d94c824`.
- TypeScript predicted-group-order contract Batch 2 merged through PR #4 at `cba741da488d58d1da5bb96986f4633e316d7497`.
- Documentation reconciliation merged through PR #5 at `308f1e226510b0263fb59d6b8fadde9b6385e1e3`.
- Manual-resolution contract and **Finalise Group Standings** flow merged through PR #6 at `96abbe79501101e8212009007da6f6da5605e32d`.
- Private PostgreSQL group-order parity, local pgTAP, permission tests and TypeScript/PostgreSQL differential coverage merged through PR #7 at `a188ecfb048608813e887b7b02b97c67d6555b97`.
- Entry-boundary integrity, RPC-only submission, server-derived group-position snapshots, same-tournament prediction guards and local adversarial RLS/RPC coverage merged through PR #9 at `773ffdc983663ba8c4c8a504d621a343717f5396`.
- The production rollback runbook now prohibits connecting production domains or deploys to development Supabase and defines application-only rollback plus production-only configuration restoration.
- The current overlays are recorded in [`reconciliations/2026-07-23-group-order-contract.md`](reconciliations/2026-07-23-group-order-contract.md), [`reconciliations/2026-07-23-database-parity-foundation.md`](reconciliations/2026-07-23-database-parity-foundation.md), [`reconciliations/2026-07-23-entry-boundary-integrity.md`](reconciliations/2026-07-23-entry-boundary-integrity.md) and [`reconciliations/2026-07-23-production-rollback-boundary.md`](reconciliations/2026-07-23-production-rollback-boundary.md).
- These changes supersede historical statements that the repository had no baseline CI, no canonical group-order contract, no local SQL parity harness, no executable entry/RLS tests, no group-position persistence path, no RPC-only submission boundary or no safe repository rollback boundary.
- They do **not** prove hosted production migration parity, current hosted environment-variable correctness, full reference-data constraints, valid bracket-tree replay, knockout-result modelling, verified backup/restore capability or browser E2E behaviour.

## Current verdicts

| Verdict | Current value | Evidence/reference |
| --- | --- | --- |
| Development verdict | **Safe to continue controlled development.** The three Critical entry-boundary defects now have executable repository/local containment, and the cross-environment rollback instruction has been removed. Unrelated expansion should still respect the remaining Critical and High integrity work. | PR #9; post-audit reconciliations |
| Production verdict | **Safe only after remaining critical repairs and an explicitly approved hosted rollout; not production-ready for a real scored competition.** Local execution does not prove that production has applied later migrations, that its legacy data passes fail-closed preflights or that restore capability exists. | Repeat-audit verdict; PR #9 evidence boundary; rollback reconciliation |
| Environment-isolation verdict | **Repository instructions now preserve the production/development boundary. Operational assurance remains partial.** The unsafe rollback instruction no longer reproduces in the current runbook, but current hosted configuration is unverified, `OPS-005` remains open and backup/restore recovery has not been rehearsed. | `docs/ops-prod-cutover.md`; rollback reconciliation; `OPS-003`; `OPS-005` |
| Supabase assurance level | **Local executable assurance for private group-order parity and the current entry boundary. Repository-level static assurance only for hosted production.** Disposable Supabase proves migrations, lint, grants, RLS, triggers, multi-user/multi-tournament attacks, submission RPC behaviour and differential parity without accessing a hosted project. | PRs #7 and #9; reconciliation notes |
| Regression position | **No application regression identified.** Later work adds database enforcement, tests and safer operations documentation without intentionally removing current product scope. | Feature baseline; PRs #3–#9; rollback reconciliation |

## Current blockers

| Blocker group | Open findings / summary |
| --- | --- |
| Critical findings | `DATA-002` remains wholly open. `DATA-001`, `SECURITY-001` and `SECURITY-002` have repository/local implementation evidence but remain pending targeted status review and hosted migration verification. The `OPS-001` unsafe instruction no longer reproduces in current documentation, pending targeted finding-status review; wider recovery readiness remains open under `OPS-003`. |
| High findings | `DATA-003` is partially addressed for current prediction writes; `FUNC-001`, `FUNC-002`, `REL-001`, `DATA-004`, `DATA-005`, `REL-002`, `REL-003`, `REL-004`, `DATA-006`, `OPS-002`, `OPS-005`, the remaining portions of `TEST-001`, and `OPS-003` remain open. |
| Launch blockers | Approved hosted application/reconciliation of the entry-boundary migrations; valid bracket replay; authoritative knockout winner/result-method model; transactional result/scoring flow; browser E2E; verified backup/restore and incident-recovery controls. |
| Security blockers | Hosted verification of `SECURITY-001`/`SECURITY-002`; remaining `DATA-003` reference-data scope; `OPS-002`; `OPS-005`; verification of current hosted configuration. |
| Data-integrity blockers | `DATA-002`; remaining `DATA-003`; `DATA-004`; `DATA-005`; `FUNC-001`; `REL-001`; `REL-004`; hosted verification of the PR #9 boundary. |
| Environment/operations blockers | Targeted `OPS-001` status review; `OPS-002`, `OPS-003`, `OPS-005`, hosted rollout/reconciliation and the hosted/browser portions of `TEST-001`. |

## Current regressions

Neither dated audit classified a previously verified production capability as a regression. Of the two safeguard failures recorded as baseline regressions:

- `SAFE-007` — direct submission bypass — is contained in repository/local execution by PR #9, pending hosted rollout and targeted finding-status review;
- `SAFE-031` — the rollback procedure crossed production/development boundaries — is contained in current repository documentation by the application-only rollback repair, pending targeted finding-status review.

Other findings remain recorded as current defects or incomplete implementation rather than assumed regressions.

## Compact baseline

| Measure | Current value | Evidence/reference |
| --- | --- | --- |
| Explicit production routes | 23 routes, plus the catch-all not-found route; one additional dev-only component-gallery route | `src/App.tsx`; route audit; re-counted `2026-07-23R` |
| Supabase migrations | Audit baseline: 20. Later private resolver and entry-boundary migrations were added by PRs #7 and #9; use the repository rather than the dated audit counter. | Repository inventory; PRs #7 and #9 |
| Test files/support files | Audit baseline: 43. Later TypeScript, pgTAP and differential suites were added by PRs #3–#9. | Repository inventory; PRs #3–#9 |
| Unit/component test result | ✅ **Executed `2026-07-23R`: 42 files / 335 tests, all passing, 63.88s.** Application CI also passes on the PR #9 head. | Repeat-audit check `C-5`; PR #9 CI |
| Build result | ✅ **Executed `2026-07-23R`: `npx vite build` succeeded in 1.80s.** Application build/type-check also passes on the PR #9 head. | Repeat-audit check `C-4`; PR #9 CI |
| Lint result | ✅ **Executed `2026-07-23R`: `npx oxlint` — 0 errors, 0 warnings.** Application and disposable-database lint also pass on the PR #9 head. | Repeat-audit check `C-3`; PR #9 workflows |
| Type-check result | ✅ **Executed `2026-07-23R`: `npx tsc -b` — exit 0.** Weak evidence: strict-family flags remain absent (`TYPE-001`). | Repeat-audit check `C-2`; PR #9 CI |
| Dependency install | ✅ `npm ci` remains reproducible in current CI. | Repeat-audit check `C-1`; PR #9 CI |
| Dependency vulnerabilities | ✅ Audit baseline found 0 vulnerabilities; the high-severity production dependency audit also passes on the PR #9 head. | Repeat-audit check `C-6`; PR #9 CI |
| Scoring parity | ✅ Current documented, TypeScript and SQL point values remain aligned; PR #9 changes no scoring value. | Repeat-audit § 5; PR #9 scope |
| Database integration tests | ✅ Disposable Supabase now covers private resolver parity plus entry grants/RLS, RPC-only submission, derived snapshots, manual tie refresh, lock behaviour and multi-user/multi-tournament attacks. ❌ Hosted production remains unproven. | PRs #7 and #9; `TEST-001` remains partially open |
| End-to-end tests | 0 browser E2E framework/journeys identified | `TEST-001` |
| Feature/safeguard baseline | 96 dated baseline entries across 10 classifications; no intentional scope removal in later work | [`feature-baseline.md`](feature-baseline.md); PRs #3–#9 |
| Open findings | Audit baseline: **47: 5 Critical, 14 High, 14 Medium, 14 Low.** Later reconciliations provide targeted evidence for entry integrity and the rollback boundary; the risk register remains historical until explicitly reviewed. | [`risk-register.md`](risk-register.md); reconciliation notes |

## Unresolved unknowns

Resolved or materially narrowed after the repeat audit:

- build, lint, type-check, unit/component and dependency-vulnerability state;
- existence and behaviour of the private PostgreSQL predicted-group-order resolver;
- exact TypeScript/PostgreSQL parity for the committed group-order fixture corpus;
- public/client denial of private resolver and integrity helpers in disposable Supabase;
- local multi-user/multi-tournament entry RLS and submission-RPC behaviour;
- local direct-`submitted_at` denial and owner/non-owner submission behaviour;
- local server-derived group-position creation, invalidation, manual-tie refresh and post-lock protection;
- repository rollback instructions now prohibit a production-to-development environment swap and define application-only recovery.

Still unresolved:

- live production Supabase schema, policies, migration history and legacy-data preflight result — `OPS-005` and the hosted boundary of PR #9;
- current Netlify production environment-variable values and whether every deploy context is isolated correctly;
- broader same-tournament constraints across mutable reference data;
- Supabase Auth and email-confirmation settings;
- Cloudflare Turnstile dashboard configuration;
- GitHub branch-protection and required-check settings;
- production logs, monitoring, user data and real scoring output;
- backup schedules, backup verification and rehearsed restore capability;
- authenticated browser behaviour across every production route;
- runtime parity between the audit container and Netlify (`OPS-004`);
- final official Euro 2028 regulations, teams, fixtures and exact lock instant.

## Immediate next action

The repository-only `OPS-001` rollback-documentation repair is complete in the current reconciliation. Two separate tracks now remain:

1. **Next Critical implementation target — `DATA-002`:** introduce an authoritative knockout result lifecycle covering regulation, extra time, penalties, winner identity, confirmation and correction. `FUNC-001` full bracket-tree replay and the remaining `DATA-003` reference-data constraints should follow as linked integrity work.
2. **Explicitly approved hosted verification — `OPS-005`:** query the production `profiles` column list and migration state through a reviewed read-only process, then record the real output. Do not perform this as part of ordinary repository work.

A separate recovery workstream must eventually verify backups and rehearse restore/incident procedures before the project claims full operational recovery readiness.

Do not apply or test the PR #9 database migrations against either hosted Supabase project without explicit approval and a reviewed rollout/remediation plan.
