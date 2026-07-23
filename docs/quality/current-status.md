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
| Production Supabase project reference | `vkfnsqdyhvtwyqkisxhk` — **live since 2026-07-22**, all 20 migrations applied, baseline data loaded, real accounts created (`docs/ops-prod-cutover.md`) |

Project references identify environments; no credentials or browser keys are stored here.

## Post-audit reconciliation

The dated audits above remain unchanged. Later repository changes are recorded separately so historical evidence is not rewritten.

- Baseline GitHub Actions CI merged through PR #1.
- TypeScript predicted-group-order contract Batch 1 merged through PR #3 at `3c0b5cd77490666e706cf3a7855e11417d94c824`.
- TypeScript predicted-group-order contract Batch 2 merged through PR #4 at `cba741da488d58d1da5bb96986f4633e316d7497`.
- Documentation reconciliation merged through PR #5 at `308f1e226510b0263fb59d6b8fadde9b6385e1e3`.
- Manual-resolution contract and **Finalise Group Standings** flow merged through PR #6 at `96abbe79501101e8212009007da6f6da5605e32d`.
- Private PostgreSQL group-order parity, local pgTAP, permission tests and TypeScript/PostgreSQL differential coverage merged through PR #7 at `a188ecfb048608813e887b7b02b97c67d6555b97`.
- The completed group-order and database-parity position is recorded in [`reconciliations/2026-07-23-group-order-contract.md`](reconciliations/2026-07-23-group-order-contract.md) and [`reconciliations/2026-07-23-database-parity-foundation.md`](reconciliations/2026-07-23-database-parity-foundation.md).
- These merges supersede historical statements that the repository had no baseline CI, no canonical TypeScript group-order contract, no manual-resolution coverage, or no local SQL parity harness.
- They do **not** close hosted production-schema assurance, entry-boundary/RLS, submission-state protection, knockout-result modelling, release/recovery or browser-E2E findings.

## Current verdicts

| Verdict | Current value | Evidence/reference |
| --- | --- | --- |
| Development verdict | **Safe to continue development after containing the Critical integrity risks; pause unrelated feature expansion until the first repair batch lands.** The group-order contract and local SQL parity are now materially stronger, but the entry-boundary Critical findings remain open. | [Repeat-audit verdict](audits/2026-07-23-repeat-verification-audit.md#9-verdict); post-audit reconciliations |
| Production verdict | **Safe only after critical repairs; not production-ready for a real scored competition.** Unchanged: local parity does not validate hosted production schema, RLS or real submission behaviour. | [Repeat-audit verdict](audits/2026-07-23-repeat-verification-audit.md#9-verdict) |
| Environment-isolation verdict | **Partial assurance with a documented live hazard.** Separate development and production project references are documented, but the written rollback procedure would now breach isolation (`OPS-001`, escalation proposed), and `OPS-005` raises an unresolved production schema-drift question. | `OPS-001`; `OPS-005`; `docs/ops-prod-cutover.md` |
| Supabase assurance level | **Local executable assurance for the private predicted-group-order resolver; repository-level static assurance for hosted entry/RLS/production behaviour.** PR #7 proves disposable migration rebuild, lint, pgTAP and TypeScript/PostgreSQL differential parity without accessing hosted projects. | PR #7; [repeat-audit limitations](audits/2026-07-23-repeat-verification-audit.md#8-unknowns-and-limitations) |
| Regression position | **No regression.** All 96 feature-baseline entries were compared in the repeat audit; later group-order work added coverage without intentionally removing current scope. | [Feature-baseline comparison](audits/2026-07-23-repeat-verification-audit.md#7-feature-baseline-comparison); PRs #3–#7 |

## Current blockers

| Blocker group | Open findings / summary |
| --- | --- |
| Critical findings | `DATA-001`, `SECURITY-001`, `SECURITY-002`, `DATA-002`, `OPS-001` (escalated `2026-07-23R`, owner to confirm) |
| High findings | `DATA-003`, `FUNC-001`, `FUNC-002`, `REL-001`, `DATA-004`, `DATA-005`, `REL-002`, `REL-003`, `REL-004`, `DATA-006`, `OPS-002`, `OPS-005`, `TEST-001`, `OPS-003` |
| Launch blockers | Group-position persistence/lock; RPC-only submission; same-tournament validation; valid bracket replay; knockout winner/result-method model; transactional result/scoring flow; entry/RLS integration tests; safe release/recovery controls |
| Security blockers | `SECURITY-001`, `SECURITY-002`, `DATA-003`, `OPS-001`, `OPS-002`, `OPS-005` |
| Data-integrity blockers | `DATA-001`, `DATA-002`, `DATA-003`, `DATA-004`, `DATA-005`, `FUNC-001`, `REL-001`, `REL-004` |
| Environment/operations blockers | `OPS-001`, `OPS-002`, `OPS-003`, `OPS-005`, hosted portion of `TEST-001` |

## Current regressions

Neither audit classified a previously verified production capability as a regression. The two safeguard failures recorded as baseline regressions both persist unchanged:

- `SAFE-007` — submission is not exclusively protected by the validated RPC (`SECURITY-002`);
- `SAFE-031` — the documented rollback procedure crosses production/development boundaries (`OPS-001`, escalation proposed).

Other findings remain recorded as current defects or incomplete implementation rather than assumed regressions.

## Compact baseline

| Measure | Current value | Evidence/reference |
| --- | --- | --- |
| Explicit production routes | 23 routes, plus the catch-all not-found route; one additional dev-only component-gallery route | `src/App.tsx`; route audit; re-counted `2026-07-23R` |
| Supabase migrations | Audit baseline: 20 version-controlled migration files. Later private group-order migrations were added by PR #7; use the repository rather than this dated audit counter for the live count. | Repository inventory; repeat-audit baseline; PR #7 |
| Test files/support files | Audit baseline: 43 (42 test files plus `tests/setup.ts`). Later TypeScript, pgTAP and differential tests were added by PRs #3–#7. | Repository inventory; repeat-audit baseline; PRs #3–#7 |
| Unit/component test result | ✅ **Executed `2026-07-23R`: 42 files / 335 tests, all passing, 63.88s** (`npx vitest run`). Later CI also passed after PR #7. | Repeat-audit check `C-5`; PR #7 CI |
| Build result | ✅ **Executed `2026-07-23R`: `npx vite build` succeeded in 1.80s;** `dist/` 1.5 MB, largest chunk 251.52 kB (80.53 kB gzip), no source maps emitted. Later CI also passed after PR #7. | Repeat-audit check `C-4`; PR #7 CI |
| Lint result | ✅ **Executed `2026-07-23R`: `npx oxlint` — 0 errors, 0 warnings** across 211 files, 95 rules. Later application and database lint gates passed after PR #7. | Repeat-audit check `C-3`; PR #7 workflows |
| Type-check result | ✅ **Executed `2026-07-23R`: `npx tsc -b` — exit 0.** Weak evidence: `tsconfig.app.json` sets no `strict`-family flags, so this does not demonstrate null-safety (`TYPE-001`). | Repeat-audit check `C-2` and § 2.1 |
| Dependency install | ✅ **Executed `2026-07-23R`: `npm ci` reproducible from `package-lock.json`** — 136 packages, no resolution errors. Later CI remained green. | Repeat-audit check `C-1`; PR #7 CI |
| Dependency vulnerabilities | ✅ **Executed `2026-07-23R`: `npm audit` — 0 vulnerabilities** across 181 resolved dependencies. Later high-severity production audit remained green. | Repeat-audit check `C-6`; PR #7 CI |
| Scoring parity | ✅ **Verified `2026-07-23R`: `docs/scoring-rules.md` §§1–4, `src/domain/tournament/scoringConfig.ts` and the SQL scorer agree on every value.** No scoring conflict found. | Repeat-audit § 5 |
| Database integration tests | ✅ Local disposable Supabase harness now covers private group-order migrations, lint, pgTAP permissions/behaviour and exact TypeScript/PostgreSQL fixture parity. ❌ Entry tables, RLS, submission RPCs and hosted production remain unproven. | PR #7; `TEST-001` remains partially open |
| End-to-end tests | 0 browser E2E framework/journeys identified | `TEST-001` |
| Feature/safeguard baseline | 96 entries across 10 current-status classifications; **0 regressions at `2026-07-23R`** | [`feature-baseline.md`](feature-baseline.md) |
| Open findings | Audit baseline: **47: 5 Critical, 14 High, 14 Medium, 14 Low.** Do not silently close findings without a targeted verification pass; PR #7 narrows SQL-parity/testing gaps but does not by itself prove all associated findings closed. | [`risk-register.md`](risk-register.md); post-audit reconciliations |

## Unresolved unknowns

Resolved or narrowed after the repeat audit:

- build, lint, type-check, unit/component and dependency-vulnerability state;
- existence and behaviour of the private local PostgreSQL predicted-group-order resolver;
- exact parity between that resolver and production TypeScript for the committed fixture corpus;
- public/client denial of the private resolver in disposable local Supabase.

Still unresolved:

- live production Supabase schema, policies and migration-history parity — `OPS-005`;
- entry-table, submission-RPC and multi-user/multi-tournament RLS behaviour;
- Supabase Auth and email-confirmation settings;
- Cloudflare Turnstile dashboard configuration;
- actual Netlify environment-variable values, build settings and preview isolation — note `netlify.toml` contains **no `[build]` section**, so build command, publish directory and Node version are not version-controlled;
- GitHub branch-protection and required-check settings;
- production logs, monitoring, user data and real scoring output;
- backup schedules and restore capability;
- authenticated browser behaviour across every production route;
- runtime parity between the audit container (Node v22.22.2) and the Netlify build image (`OPS-004`);
- version-control identity of the audited snapshot — the next audit must run against a git clone, not a source archive;
- final official Euro 2028 regulations, teams, fixtures and exact lock instant.

## Immediate next action

Two zero-risk documentation/operations actions remain important because one removes a live operational hazard and the other settles an unknown that local code cannot resolve:

1. rewrite `docs/ops-prod-cutover.md` § 10 as an **application-only** rollback and prohibit pointing production environment variables at a development project (`OPS-001`);
2. only through an explicitly approved hosted-production verification process, query the production `profiles` column list and record the result to settle `OPS-005`.

The next implementation batch is **`DB-INTEGRITY-ENTRY-BOUNDARY-1`**:

1. deny direct client updates to `entries.submitted_at`;
2. add same-tournament validation;
3. lock and validate `predicted_group_positions`;
4. correct `submit_entry()` scoping and lock behaviour; and
5. add executable local multi-user/multi-tournament RLS and RPC regression tests.

Do not combine this batch with UI redesign, future game modes, result-model expansion or general refactoring.