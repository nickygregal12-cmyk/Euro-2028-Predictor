# Current quality status

> Concise operational summary derived from the [23 July 2026 full audit](audits/2026-07-23-full-audit.md) and the [23 July 2026 repeat verification audit](audits/2026-07-23-repeat-verification-audit.md) (`2026-07-23R`). Use the dated reports and risk register for historical evidence; later repository work is recorded as a separate reconciliation layer.

## Audit identity

| Field | Current value |
| --- | --- |
| Last audit date | 2026-07-23 (`2026-07-23R`, repeat verification) |
| Baseline audit | [`2026-07-23-full-audit.md`](audits/2026-07-23-full-audit.md) at commit `b68c4858a179adce433e01db439cabb93c6a0c01` |
| Latest audit report | [`2026-07-23-repeat-verification-audit.md`](audits/2026-07-23-repeat-verification-audit.md) |
| Audited repository | `nickygregal12-cmyk/Euro-2028-Predictor` |
| Audited branch | Baseline `main`; repeat audit branch not determinable from the supplied archive |
| Audited application commit | Baseline `b68c4858a179adce433e01db439cabb93c6a0c01`; repeat-audit SHA not determinable |
| Repeat-audit environment | Isolated source archive; no deployed site, database, Netlify or GitHub access |
| Deployed domains identified | `euro28predictor.com`; `euro28predictor.netlify.app` |
| Development Supabase reference | `iouzoutneyjpugbbtdem` |
| Production Supabase reference | `vkfnsqdyhvtwyqkisxhk` — live since 2026-07-22 with the 20 migrations then present; later repository migrations remain unapplied and unverified |

Project references identify environments. No credentials or private keys are stored here.

## Post-audit reconciliation

The dated audits and risk register remain unchanged. Later implementation evidence is recorded here and in the reconciliation notes.

- Baseline GitHub Actions CI merged through PR #1.
- TypeScript predicted-group-order Batches 1 and 2 merged through PRs #3 and #4.
- Manual same-group and best-third resolution flows merged through PR #6.
- Private PostgreSQL group-order parity, pgTAP permissions and TypeScript/PostgreSQL differential coverage merged through PR #7 at `a188ecfb048608813e887b7b02b97c67d6555b97`.
- Entry-boundary integrity, RPC-only submission, server-derived group positions and adversarial RLS/RPC coverage merged through PR #9 at `773ffdc983663ba8c4c8a504d621a343717f5396`.
- The production rollback runbook was repaired through PR #10 at `3875bb62647b22ad3b73b9a5c265446d00b31c0c`; production-to-development rollback is now prohibited.
- The authoritative regulation/extra-time/penalty result lifecycle, derived winners, correction history and serialised scoring recomputation merged through PR #11 at `f3aeebaf1e6b16fcb9909728ea670b0a8a37703c`.
- Full predicted knockout-tree replay and winner-fed QF/SF/final propagation are implemented through PR #12, pending merge and hosted verification.

Current overlays:

- [`2026-07-23-group-order-contract.md`](reconciliations/2026-07-23-group-order-contract.md)
- [`2026-07-23-database-parity-foundation.md`](reconciliations/2026-07-23-database-parity-foundation.md)
- [`2026-07-23-entry-boundary-integrity.md`](reconciliations/2026-07-23-entry-boundary-integrity.md)
- [`2026-07-23-production-rollback-boundary.md`](reconciliations/2026-07-23-production-rollback-boundary.md)
- [`2026-07-23-knockout-result-lifecycle.md`](reconciliations/2026-07-23-knockout-result-lifecycle.md)
- [`2026-07-23-knockout-bracket-tree-integrity.md`](reconciliations/2026-07-23-knockout-bracket-tree-integrity.md)

These changes supersede historical statements that the repository had no baseline CI, no canonical group-order contract, no executable SQL parity, no RPC-only submission boundary, no authoritative knockout result model or no match-by-match bracket validation. They do not prove hosted migration parity, production legacy-data compatibility, browser E2E behaviour or operational recovery readiness.

## Current verdicts

| Verdict | Current value | Evidence/reference |
| --- | --- | --- |
| Development | **Safe to continue controlled development.** The principal repository-level entry, result and bracket-integrity defects now have executable local containment. | PRs #7, #9, #11 and #12; reconciliation notes |
| Production | **Not ready for a real scored competition.** Later migrations have not been applied or reconciled against hosted data, browser journeys remain unproved and recovery controls are incomplete. | Hosted evidence boundary; `OPS-003`; `OPS-005`; `TEST-001` |
| Environment isolation | **Repository instructions preserve the production/development boundary; operational assurance remains partial.** | PR #10; rollback reconciliation |
| Database assurance | **Strong disposable-local assurance; static repository assurance only for hosted projects.** The local workflow rebuilds all migrations, lints PostgreSQL, runs pgTAP and executes TypeScript/PostgreSQL group-order parity. | Database parity workflow; PRs #7, #9, #11 and #12 |
| Regression position | **No intentional product-scope regression identified.** Later work adds enforcement, tests and safer operations boundaries. | Feature baseline; later PR scope |

## Current blockers

| Blocker group | Open findings / summary |
| --- | --- |
| Critical findings | `DATA-001`, `DATA-002`, `SECURITY-001` and `SECURITY-002` now have repository/local implementation evidence but still require targeted finding review and hosted migration verification. The unsafe `OPS-001` instruction is removed; wider recovery readiness remains open under `OPS-003`. |
| High findings | `FUNC-001` has repository/local implementation evidence through PR #12. `DATA-003` remains partial; `FUNC-002`, `DATA-004`, `DATA-005`, `REL-002`, `REL-003`, `REL-004`, `DATA-006`, `OPS-002`, `OPS-005`, the browser/hosted portions of `TEST-001` and wider `OPS-003` remain open. `REL-001` is materially narrowed by transactional tournament scoring locks. |
| Launch blockers | Approved hosted migration and legacy-data reconciliation; automatic real R16 population from group standings; atomic compound bracket persistence; browser result administration and E2E; verified backup/restore and incident recovery. |
| Security blockers | Hosted verification of current RLS/functions; remaining reference-data constraints; `OPS-002`; `OPS-005`; verification of current hosted configuration. |
| Data-integrity blockers | Remaining `DATA-003`; `DATA-004`; `DATA-005`; `REL-004`; automatic real R16 population; hosted verification of PRs #9, #11 and #12. |
| Environment/operations blockers | `OPS-002`, `OPS-003`, `OPS-005`, hosted rollout/reconciliation and hosted/browser portions of `TEST-001`. |

## Current regressions

Neither dated audit classified a previously verified production capability as a regression. The two recorded safeguard failures are now contained in the repository layer:

- `SAFE-007` — direct submission bypass — contained locally through PR #9, pending hosted rollout and targeted status review;
- `SAFE-031` — rollback crossed production/development boundaries — removed from the current runbook through PR #10, pending targeted status review.

## Compact baseline

| Measure | Current value | Evidence/reference |
| --- | --- | --- |
| Explicit production routes | 23 routes plus catch-all; one dev-only component-gallery route | `src/App.tsx`; repeat audit |
| Supabase migrations | Audit baseline 20; later resolver, entry, result and bracket migrations added through PRs #7, #9, #11 and #12 | Repository migration inventory |
| Application tests | Repeat audit: 42 files / 335 tests passed; current application CI remains green on PR #12 | Repeat audit; PR #12 CI |
| Build/type-check/lint | Green in current application CI | PR #12 CI |
| Dependency audit | High-severity production audit green | PR #12 CI |
| Scoring values | No scoring value changed by PRs #9, #11 or #12 | Scoring docs and migration scope |
| Database integration | Disposable Supabase covers group-order parity, entry/RLS attacks, submission, derived positions, authoritative results, revisions, scoring locks, winner propagation and full predicted-tree replay | PRs #7, #9, #11 and #12 |
| Browser E2E | No browser E2E framework or complete critical journeys identified | `TEST-001` |
| Hosted production | Later migrations and real legacy data unverified | `OPS-005`; hosted rollout boundary |
| Historical findings | Audit baseline: 47 findings — 5 Critical, 14 High, 14 Medium, 14 Low | [`risk-register.md`](risk-register.md) |

## Resolved or materially narrowed unknowns

- canonical TypeScript and private PostgreSQL group ordering;
- exact differential parity for the committed group-order fixture corpus;
- local permissions, RLS, submission ownership and tournament isolation;
- server-derived predicted group positions and post-lock protection;
- authoritative regulation, extra-time and penalty result representation;
- protected confirmation, correction and clear operations with revision history;
- serialised score recomputation and penalty-decided champion scoring;
- real winner propagation from R16 through QF, SF and final;
- full predicted Round of 16 derivation and 15-match bracket replay;
- rejection of stage-count-correct but structurally impossible brackets;
- repository rollback instructions preserving environment isolation.

## Still unresolved

- hosted production schema, policies, migration history and every fail-closed legacy-data preflight;
- current Netlify production values and deploy-context isolation;
- automatic real R16 population from confirmed group standings and best-third ranking;
- atomic server replacement of a user's complete predicted bracket (`REL-004`);
- wider same-tournament/reference constraints (`DATA-003`);
- result-entry administration UI and authenticated browser journeys;
- Supabase Auth/email settings and Cloudflare Turnstile dashboard configuration;
- GitHub branch-protection and required-check settings;
- production logs, monitoring and real scoring output;
- verified backups and rehearsed restore capability;
- runtime parity between the audit container and Netlify (`OPS-004`);
- final official Euro 2028 regulations, teams, fixtures and exact lock instant.

## Immediate next action

After PR #12 is merged, the next repository implementation batch should create an **atomic bracket persistence boundary (`REL-004`)** so a complete winner tree is replaced transactionally rather than through separate per-team client writes. The following linked batch should populate the real R16 participants from confirmed group standings and the authoritative best-third table.

Hosted verification remains a separate explicitly approved workstream. Do not apply PR #9, #11 or #12 migrations to either hosted Supabase project without a reviewed rollout, read-only preflight evidence and a remediation/backup plan.
