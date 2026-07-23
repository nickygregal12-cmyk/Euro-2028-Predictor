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
- The detailed reconciliation, remaining Batch 3 scope and **Finalise Group Standings** product decision are recorded in [`reconciliations/2026-07-23-group-order-contract.md`](reconciliations/2026-07-23-group-order-contract.md).
- These merges supersede any historical statement that the repository had no baseline CI or no canonical TypeScript group-order fixture contract. They do **not** close the database/RLS, SQL-parity, entry-boundary or production-assurance findings below.

## Current verdicts

| Verdict | Current value | Evidence/reference |
| --- | --- | --- |
| Development verdict | **Safe to continue development after containing the Critical integrity risks; pause unrelated feature expansion until the first repair batch lands.** Unchanged, and now supported by executed evidence: reproducible install, clean build, clean lint, 335 passing tests, zero dependency vulnerabilities, exact three-layer scoring parity. | [Repeat-audit verdict](audits/2026-07-23-repeat-verification-audit.md#9-verdict) |
| Production verdict | **Safe only after critical repairs; not production-ready for a real scored competition.** Unchanged and now more urgent: production infrastructure went live on 2026-07-22 while all four Critical findings were open. | [Repeat-audit verdict](audits/2026-07-23-repeat-verification-audit.md#9-verdict) |
| Environment-isolation verdict | **Partial assurance with a documented live hazard.** Separate development and production project references are documented, but the written rollback procedure would now breach isolation (`OPS-001`, escalation proposed), and `OPS-005` raises an unresolved production schema-drift question. | `OPS-001`; `OPS-005`; `docs/ops-prod-cutover.md` |
| Supabase assurance level | **Repository-level static assurance only.** Migrations, RLS, functions and triggers were reviewed across both audits; the production schema, policy behaviour and migration history have never been executed or queried. | [Repeat-audit limitations](audits/2026-07-23-repeat-verification-audit.md#8-unknowns-and-limitations) |
| Regression position | **No regression.** All 96 feature-baseline entries were compared; nothing has been silently removed, made unreachable or weakened since the baseline. | [Feature-baseline comparison](audits/2026-07-23-repeat-verification-audit.md#7-feature-baseline-comparison) |

## Current blockers

| Blocker group | Open findings / summary |
| --- | --- |
| Critical findings | `DATA-001`, `SECURITY-001`, `SECURITY-002`, `DATA-002`, `OPS-001` (escalated `2026-07-23R`, owner to confirm) |
| High findings | `DATA-003`, `FUNC-001`, `FUNC-002`, `REL-001`, `DATA-004`, `DATA-005`, `REL-002`, `REL-003`, `REL-004`, `DATA-006`, `OPS-002`, `OPS-005`, `TEST-001`, `OPS-003` |
| Launch blockers | Group-position persistence/lock; RPC-only submission; same-tournament validation; valid bracket replay; knockout winner/result-method model; transactional result/scoring flow; database integration tests; safe release/recovery controls |
| Security blockers | `SECURITY-001`, `SECURITY-002`, `DATA-003`, `OPS-001`, `OPS-002`, `OPS-005` |
| Data-integrity blockers | `DATA-001`, `DATA-002`, `DATA-003`, `DATA-004`, `DATA-005`, `FUNC-001`, `REL-001`, `REL-004` |
| Environment/operations blockers | `OPS-001`, `OPS-002`, `OPS-003`, `OPS-005`, `TEST-001` |

## Current regressions

Neither audit classified a previously verified production capability as a regression. The two safeguard failures recorded as baseline regressions both persist unchanged:

- `SAFE-007` — submission is not exclusively protected by the validated RPC (`SECURITY-002`);
- `SAFE-031` — the documented rollback procedure crosses production/development boundaries (`OPS-001`, escalation proposed).

Other findings remain recorded as current defects or incomplete implementation rather than assumed regressions.

## Compact baseline

| Measure | Current value | Evidence/reference |
| --- | --- | --- |
| Explicit production routes | 23 routes, plus the catch-all not-found route; one additional dev-only component-gallery route | `src/App.tsx`; route audit; re-counted `2026-07-23R` |
| Supabase migrations | 20 version-controlled migration files | Repository inventory; re-counted `2026-07-23R` |
| Test files/support files | 43 (42 test files plus `tests/setup.ts`) | Repository inventory; re-counted `2026-07-23R` |
| Unit/component test result | ✅ **Executed `2026-07-23R`: 42 files / 335 tests, all passing, 63.88s** (`npx vitest run`) | Repeat-audit check `C-5` |
| Build result | ✅ **Executed `2026-07-23R`: `npx vite build` succeeded in 1.80s;** `dist/` 1.5 MB, largest chunk 251.52 kB (80.53 kB gzip), no source maps emitted | Repeat-audit check `C-4` |
| Lint result | ✅ **Executed `2026-07-23R`: `npx oxlint` — 0 errors, 0 warnings** across 211 files, 95 rules | Repeat-audit check `C-3` |
| Type-check result | ✅ **Executed `2026-07-23R`: `npx tsc -b` — exit 0.** Weak evidence: `tsconfig.app.json` sets no `strict`-family flags, so this does not demonstrate null-safety (`TYPE-001`) | Repeat-audit check `C-2` and § 2.1 |
| Dependency install | ✅ **Executed `2026-07-23R`: `npm ci` reproducible from `package-lock.json`** — 136 packages, no resolution errors | Repeat-audit check `C-1` |
| Dependency vulnerabilities | ✅ **Executed `2026-07-23R`: `npm audit` — 0 vulnerabilities** across 181 resolved dependencies | Repeat-audit check `C-6` |
| Scoring parity | ✅ **Verified `2026-07-23R`: `docs/scoring-rules.md` §§1–4, `src/domain/tournament/scoringConfig.ts` and the SQL scorer agree on every value.** No scoring conflict found. | Repeat-audit § 5 |
| Integration tests | 0 database/RLS integration harness identified | `TEST-001` |
| End-to-end tests | 0 browser E2E framework/journeys identified | `TEST-001` |
| Feature/safeguard baseline | 96 entries across 10 current-status classifications; **0 regressions at `2026-07-23R`** | [`feature-baseline.md`](feature-baseline.md) |
| Open findings | **47: 5 Critical, 14 High, 14 Medium, 14 Low.** All 45 baseline findings retested and all 45 still reproduce; `OPS-005` and `REPO-002` added; `OPS-001` escalated. | [`risk-register.md`](risk-register.md) |

## Unresolved unknowns

Resolved by the repeat audit: build result, lint result, type-check result, unit/component test result, dependency vulnerability state.

Still unresolved:

- live production Supabase schema, policies and migration-history parity — **now a named finding, `OPS-005`**;
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

Two zero-risk documentation actions come **first**, because one removes a live operational hazard and the other settles an unknown that no amount of code work can resolve:

1. rewrite `docs/ops-prod-cutover.md` § 10 as an **application-only** rollback and prohibit pointing production environment variables at a development project (`OPS-001`);
2. query production for the `profiles` column list and record the result, settling `OPS-005`.

The first implementation batch is unchanged — implement and review **`DB-INTEGRITY-ENTRY-BOUNDARY-1`**:

1. deny direct client updates to `entries.submitted_at`;
2. add same-tournament validation;
3. lock and validate `predicted_group_positions`;
4. correct `submit_entry()` scoping and lock behaviour; and
5. add executable multi-user/multi-tournament RLS and RPC regression tests.

Do not combine this batch with UI redesign, future game modes, result-model expansion or general refactoring.
