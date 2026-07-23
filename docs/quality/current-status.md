# Current quality status

> Concise operational summary derived from the [23 July 2026 full audit](audits/2026-07-23-full-audit.md). Use the dated report and risk register for evidence; do not turn this file into a second backlog.

## Audit identity

| Field | Current value |
| --- | --- |
| Last audit date | 2026-07-23 |
| Audited repository | `nickygregal12-cmyk/Euro-2028-Predictor` |
| Audited branch | `main` |
| Audited application commit SHA | `b68c4858a179adce433e01db439cabb93c6a0c01` |
| Latest audit report | [`docs/quality/audits/2026-07-23-full-audit.md`](audits/2026-07-23-full-audit.md) |
| Deployment evidence | Netlify production deployment metadata at the audited application commit; authenticated routes were not manually exercised |
| Deployed domains identified | `euro28predictor.com`; `euro28predictor.netlify.app` |
| Development Supabase project reference | `iouzoutneyjpugbbtdem` |
| Production Supabase project reference | `vkfnsqdyhvtwyqkisxhk` |

Project references identify environments; no credentials or browser keys are stored here.

## Current verdicts

| Verdict | Current value | Evidence/reference |
| --- | --- | --- |
| Development verdict | **Safe to continue development after containing the Critical integrity risks; pause unrelated feature expansion until the first repair batch lands.** | [Executive summary](audits/2026-07-23-full-audit.md#1-executive-summary) |
| Production verdict | **Safe only after critical repairs; not production-ready for a real scored competition.** | [Final verdict](audits/2026-07-23-full-audit.md#final-verdict) |
| Environment-isolation verdict | **Partial assurance.** Separate development and production project references are documented, but live environment values, auth settings and database parity were not directly inspected. | Audit limitations and `CLAUDE.md` |
| Supabase assurance level | **Repository-level static assurance only.** Migrations, RLS, functions and triggers were reviewed; the production schema, policy behaviour and migration history were not executed or queried. | [Unknowns and limitations](audits/2026-07-23-full-audit.md#14-unknowns-and-limitations) |

## Current blockers

| Blocker group | Open findings / summary |
| --- | --- |
| Critical findings | `DATA-001`, `SECURITY-001`, `SECURITY-002`, `DATA-002` |
| High findings | `DATA-003`, `FUNC-001`, `FUNC-002`, `REL-001`, `DATA-004`, `DATA-005`, `REL-002`, `REL-003`, `REL-004`, `DATA-006`, `OPS-001`, `OPS-002`, `TEST-001`, `OPS-003` |
| Launch blockers | Group-position persistence/lock; RPC-only submission; same-tournament validation; valid bracket replay; knockout winner/result-method model; transactional result/scoring flow; database integration tests; safe release/recovery controls |
| Security blockers | `SECURITY-001`, `SECURITY-002`, `DATA-003`, `OPS-002` |
| Data-integrity blockers | `DATA-001`, `DATA-002`, `DATA-003`, `DATA-004`, `DATA-005`, `FUNC-001`, `REL-001`, `REL-004` |
| Environment/operations blockers | `OPS-001`, `OPS-002`, `OPS-003`, `TEST-001` |

## Current regressions

The audit did **not** formally classify a previously verified production capability as a regression. It did confirm two safeguard failures recorded as baseline regressions:

- `SAFE-007` — submission is not exclusively protected by the validated RPC (`SECURITY-002`);
- `SAFE-031` — the documented rollback procedure crosses production/development boundaries (`OPS-001`).

Other findings are recorded as current defects or incomplete implementation rather than assumed regressions.

## Compact baseline

| Measure | Current value | Evidence/reference |
| --- | --- | --- |
| Explicit production routes | 23 routes, plus the catch-all not-found route; one additional dev-only component-gallery route | `src/App.tsx`; route audit |
| Supabase migrations | 20 version-controlled migration files | Repository inventory |
| Test files/support files | 43 | Repository inventory |
| Unit/component test total | Approximately 326 `it()`/`test()` cases by static count; the audited commit message reports 335 green tests | Audit orientation and commit metadata |
| Unit/component test result | Not independently executed because dependencies were absent; audited production commit reports green | Audit command limitations |
| Build result | Local build not independently completed; Netlify production deployment at the audited commit was `ready` | Netlify deployment metadata |
| Lint result | Not independently executed; audited commit reports Oxlint clean | Audit command limitations |
| Type-check result | Not independently executed; audited commit reports TypeScript clean | Audit command limitations |
| Integration tests | 0 database/RLS integration harness identified | `TEST-001` |
| End-to-end tests | 0 browser E2E framework/journeys identified | `TEST-001` |
| Feature/safeguard baseline | 96 entries across 10 current-status classifications | [`feature-baseline.md`](feature-baseline.md) |
| Open findings | 45: 4 Critical, 14 High, 14 Medium, 13 Low | [`risk-register.md`](risk-register.md) |

## Unresolved unknowns

- live production Supabase schema, policies and migration-history parity;
- Supabase Auth and email-confirmation settings;
- Cloudflare Turnstile dashboard configuration;
- actual Netlify environment-variable values and preview isolation;
- GitHub branch-protection and required-check settings;
- production logs, monitoring, user data and real scoring output;
- backup schedules and restore capability;
- authenticated browser behaviour across every production route;
- dependency vulnerability state;
- final official Euro 2028 regulations, teams, fixtures and exact lock instant.

## Immediate next action

Implement and review **`DB-INTEGRITY-ENTRY-BOUNDARY-1`** from the audit:

1. deny direct client updates to `entries.submitted_at`;
2. add same-tournament validation;
3. lock and validate `predicted_group_positions`;
4. correct `submit_entry()` scoping and lock behaviour; and
5. add executable multi-user/multi-tournament RLS and RPC regression tests.

Do not combine this batch with UI redesign, future game modes, result-model expansion or general refactoring.
