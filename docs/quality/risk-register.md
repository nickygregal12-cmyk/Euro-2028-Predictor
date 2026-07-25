# Euro 2028 Predictor — Current Risk Register

**Current audit:** `2026-07-25R`  
**Evidence:** [`audits/2026-07-25-repeat-verification-audit.md`](audits/2026-07-25-repeat-verification-audit.md)  
**Recovery/audit reconciliation:** [`reconciliations/2026-07-25-production-backup-and-repeat-audit.md`](reconciliations/2026-07-25-production-backup-and-repeat-audit.md)  
**Private league browser evidence:** [`reconciliations/2026-07-25-private-league-invite-browser.md`](reconciliations/2026-07-25-private-league-invite-browser.md)  
**Pending invite boundary:** [`reconciliations/2026-07-25-pending-invite-render-boundary.md`](reconciliations/2026-07-25-pending-invite-render-boundary.md)  
**Home availability:** [`reconciliations/2026-07-25-home-data-availability.md`](reconciliations/2026-07-25-home-data-availability.md)  
**League hub availability:** [`reconciliations/2026-07-25-league-hub-data-availability.md`](reconciliations/2026-07-25-league-hub-data-availability.md)  
**Profile availability:** [`reconciliations/2026-07-25-profile-data-availability.md`](reconciliations/2026-07-25-profile-data-availability.md)  
**Match Centre league-scope availability:** [`reconciliations/2026-07-25-match-centre-league-scope-availability.md`](reconciliations/2026-07-25-match-centre-league-scope-availability.md)  
**Preceding audit:** [`audits/2026-07-24-repeat-verification-audit.md`](audits/2026-07-24-repeat-verification-audit.md) (`2026-07-24R`)  
**Production release:** [`reconciliations/2026-07-24-post-merge-production-release-state.md`](reconciliations/2026-07-24-post-merge-production-release-state.md)  
**Deployment gate:** [`reconciliations/2026-07-24-app-schema-deployment-gate.md`](reconciliations/2026-07-24-app-schema-deployment-gate.md)

This register retains every original finding ID. Historical audits remain immutable. Repository/development implementation does not close a production risk, and an encrypted backup does not prove recovery until a disposable restore succeeds.

## Summary

| Severity | Total current findings | Closed/superseded | Open, partial, blocked or in progress |
| --- | ---: | ---: | ---: |
| Critical | 6 | 1 | 5 |
| High | 16 | 3 | 13 |
| Medium | 19 | 8 | 11 |
| Low | 16 | 7 | 9 |
| **Total** | **57** | **19** | **38** |

Resolved or superseded IDs currently include `OPS-001`, `OPS-004`, `OPS-005`, `OPS-007`, `A11Y-002`, `A11Y-003`, `SEC-002`, `UX-004`, `REL-002`, `REL-005`, `REL-006`, `REPO-002`, `HYGIENE-001`, `DOC-001`, `DOC-004`, `DOC-005`, `TEST-002`, `TEST-003` and `DOC-006`.

`DOC-001` was resolved by PR #77 after the `2026-07-25R` reconciliation passed CI, Markdown/identifier controls and a ready Netlify preview, then merged into `main`.

## Movement at and after `2026-07-25R`

| Change | Detail |
| --- | --- |
| Resolved after audit | `DOC-001` — PR #77 reconciled stale rollout fingerprints, development-history, recovery and implementation classifications and merged after current documentation controls passed. |
| Resolved | `A11Y-002` — league options now use disclosure semantics with native buttons, `aria-expanded`, Escape close and focus restoration. |
| Resolved | `SEC-002` — centralized safe error mapping prevents raw database, RPC and network details reaching users. |
| Resolved | `HYGIENE-001` — the unused Vite scaffold asset was removed; final implementation head passed CI and Browser E2E. |
| Improved by PR #78 | `A11Y-001` — authenticated Browser E2E retains keyboard skip-link, semantic navigation, route-title, main-focus and live-region evidence; manual screen-reader review remains open. |
| Improved by PR #79 | `TEST-001` — a disposable two-account browser journey proves private league creation, invite preview, join, refreshed membership and cleanup. |
| Improved by PR #80 | `UX-001` / `TEST-001` — pending invite storage moved out of render; signup confirmation, one-time Welcome, authenticated preview and join continuation are browser-proven. Anonymous pre-auth league context remains open. |
| Improved by PRs #81, #82, #83 and #85 | `UX-002` — Home, the League hub, own Profile and Match Centre league-scope discovery now preserve loading/error/unavailable distinctions instead of inventing zero points, no leagues, an empty points history or a missing scope. Remaining consumers still require review. |
| Improved | `OPS-003` — a fresh checksum-verified encrypted off-device production artifact exists; retrieval and disposable restore proof remain absent. |
| Corrected | Development migration history is exactly 35 canonical rows, not partial/tool-generated. |
| Reverified | Production migration 1–20 baseline and exact source fingerprints passed read-only checks on 25 July. |

## Critical

| ID | Finding | Current status | Current evidence / required closure |
| --- | --- | --- | --- |
| `OPS-006` | Production application and Supabase schema are incompatible | **Open — live mismatch contained by deployment gate** | The deployed client calls `replace_predicted_progression` and `delete_match_prediction`; production lacks both. Production contract remains 20 while repository contract is 35. Close only after migrations 21–35, post-verification and authenticated production smoke evidence. |
| `DATA-001` | Predicted group positions are not safely derived/persisted | **Open production; implemented repository/development** | Migration 26 derives/protects positions and passes development verification. Production retains the old writable table/policies. |
| `SECURITY-001` | Group-position scoring inputs can be forged/changed | **Open production; implemented repository/development** | Development denies direct group-position writes. Production retains old authenticated privileges and owner policy. |
| `SECURITY-002` | Submission timestamp can be bypassed directly | **Open production; implemented repository/development** | Development uses an RPC boundary and denies direct entry update/delete. Production retains the old authenticated entry-update privilege. |
| `DATA-002` | Knockout results lack an authoritative winner/method | **Open production; implemented repository/development** | Development verifies result state, method, checkpoints, winner and revisions. Production lacks those controls. |
| `OPS-001` | Rollback instruction crossed production/development boundaries | **Resolved** | Current runbooks prohibit production-to-development swaps; production Netlify points only at production Supabase. Reopen on any regression. |

## High

| ID | Finding | Current status | Current evidence / required closure |
| --- | --- | --- | --- |
| `OPS-007` | Production previews/branch deploys inherit production Supabase | **Resolved** | Production uses production Supabase; deploy-preview, branch-deploy and dev use development Supabase with a fail-closed prebuild guard. |
| `SECURITY-003` | Hosted `SECURITY DEFINER` grants and mutable search paths are over-broad | **Open production; implemented repository/development** | Migrations 34–35 establish exact allowlists, closed defaults and fixed helper paths on development. Production retains old broad grants until the complete rollout. |
| `DATA-003` | Same-tournament/reference constraints are incomplete | **Open — in progress outside `main`** | Major guards exist. Draft PR #76 proposes migration 36 and passes CI/database/browser gates, but remains draft/unmerged and is not production scope. |
| `FUNC-001` | Bracket progression can be internally inconsistent | **Open production; implemented repository/development** | Full predicted-tree replay/validation passes on development. Production validator/propagation is absent. |
| `FUNC-002` | Valid entries are not automatically submitted at lock | **Open** | Rule is documented; no scheduler/server implementation exists. |
| `REL-001` | Score recomputation/result writes can race | **Open production; materially addressed repository/development** | Development serializes recomputation. Production old recompute path remains. |
| `DATA-004` | Actual tie resolution can depend on non-authoritative fallback behavior | **Open** | Official unresolved-tie/admin workflow remains deferred pending authoritative regulations. |
| `DATA-005` | Clearing an incomplete score does not delete the stored prediction | **Partially resolved — client deployed, production backend absent** | Repository/development RPC and browser tests pass. Production lacks `delete_match_prediction`; close after migrations 21–35 and production clear/reload/conflict/lock evidence. |
| `REL-002` | Independent late reads can overwrite newer state | **Resolved by PR #63** | Per-slice revisions, context resets and delayed response regressions passed CI and Browser E2E. |
| `REL-003` | Manual submit does not flush pending debounced writes | **Partially resolved — repository implemented/tested** | Settlement logic and disposable browser journeys pass. Close after compatible-production immediate-final-edit/failure/conflict evidence. |
| `REL-004` | Compound bracket writes are non-atomic | **Open production; client deployed/backend absent** | Atomic snapshot RPC and stale-version rollback pass on development. Production lacks the RPC. |
| `DATA-006` | Fixture/source relationships are mutable or insufficiently constrained | **Open** | Wider reference immutability remains a launch blocker; draft PR #76 is not yet authority. |
| `OPS-002` | No version-controlled administrator model/control-room boundary | **Open** | No approved admin authorization model or browser result-admin page exists. |
| `TEST-001` | Critical database/browser rules lack executable integration assurance | **Partially resolved — substantial disposable coverage** | Playwright covers auth, routes, score save/clear, submission barriers, conflicts, atomic bracket, lock rejection, signup/recovery, keyboard/live-region transitions, private league create/invite/join and signed-out confirmation/Welcome invite continuation. Result administration, manual screen-reader review and compatible-production smoke remain open. |
| `OPS-003` | Release, monitoring and recovery controls are incomplete | **Partially resolved — encrypted off-device artifact exists; restore proof absent** | Fresh roles/schema/data bundle, critical-table checks, plaintext checksums, encryption/decryption and encrypted checksum passed; off-device copy owner-confirmed. Close only after retrieval, checksum verification, disposable restore, Auth trigger/data verification, recovery acceptance and monitoring/rollback controls appropriate to launch. |
| `OPS-005` | Production may contain an untracked admin role column | **Superseded by `OPS-002`** | Read-only production inspection confirmed the column does not exist. |

## Medium

| ID | Finding | Current status | Closure evidence required |
| --- | --- | --- | --- |
| `OPS-008` | Public legacy “development” site is sourced from the World Cup repository and dormant backend | **Open — separate owner action pending** | Retire/protect through the legacy workstream, then verify public access, functions, cron and backend. Do not repoint it to either current Euro project. |
| `AUTH-001` | Production Turnstile key is inherited by non-production contexts while development CAPTCHA configuration is unverified | **Open — dashboard work pending** | Configure a matching non-production model across Netlify, Cloudflare and development Supabase; prove preview login/signup/recovery and production regression. |
| `REL-005` | Open pages can remain convincingly stale | **Resolved by PR #68** | Foreground refresh settles writes, preserves conflicts/errors and uses revision guards; focused and two-page browser tests passed. |
| `REL-006` | Concurrent first-use requests can hit entry unique conflicts | **Resolved by PR #65** | Insert-on-conflict/fallback-read boundary and two-context browser proof converge on one entry. |
| `REL-007` | Stale device can delete a newer bracket pick | **Open production; implemented repository/development** | Snapshot versions contain the risk on development; production rollout and multi-device browser verification remain. |
| `PERF-001` | League summary requests scale linearly/serially | **Open** | Remove/contain serial per-league requests and profile representative load. |
| `UX-001` | Invite context is hidden behind generic signup | **Partially improved — render mutation resolved; anonymous context open** | Pending invite persistence now runs after commit and survives confirmation/Welcome through authenticated join. Close only after a privacy/abuse-approved anonymous preview exposes trustworthy pre-auth league context with executable tests. |
| `A11Y-001` | SPA navigation lacks complete assistive-technology transitions | **Partially resolved — authenticated browser proof present; manual screen-reader review open** | Route titles, polite live region, main-content focus, skip navigation and retained desktop/mobile keyboard journeys are present. Close only after a manual screen-reader journey confirms useful, timely and non-duplicative announcements. |
| `A11Y-002` | League options menu semantics do not match behavior | **Resolved by PR #41** | Simpler disclosure semantics, native buttons, Escape close/focus restoration and focused tests are present. Reopen on semantic regression. |
| `TYPE-001` | Hand-written casts and non-strict TypeScript can hide schema drift | **Open** | Generate DB types, validate critical RPC payloads and enable strictness incrementally. |
| `DOC-001` | Documentation is not consistently authoritative | **Resolved by PR #77** | `2026-07-25R` corrected stale fingerprints, migration history, recovery and finding classifications; CI, documentation controls and preview passed before merge. Reopen on future verified authority drift. |
| `SEC-001` | Invite/aggregate disclosure needs abuse review | **Open** | Threat-model enumeration and minimum-cohort/rate-limit behavior at intended scale. |
| `SEC-002` | Raw internal errors can reach users | **Resolved by PR #71** | Central safe mapper returns stable network/session/permission/conflict/rate-limit/generic copy and current call surfaces/tests use it. Reopen if raw infrastructure text returns. |
| `DATA-007` | Rate limiting is count-then-insert | **Open** | Serialize per user/action or use an atomic database primitive. |
| `UX-002` | Unavailable data is conflated with empty data | **Partially resolved — four primary surfaces corrected** | PRs #81, #82, #83 and #85 preserve source availability across Home, League hub, own Profile and Match Centre league-scope discovery, with focused tests and passing CI/Browser E2E. Close only after remaining remote-read consumers are audited and equivalent false-empty states are removed or explicitly ruled out. |
| `PERF-002` | Scoring recomputes the whole tournament | **Open / accepted pending measurement** | Profile target-capacity cost before deciding whether to optimize. |
| `DOC-004` | Quality governance charter is absent | **Resolved** | `docs/quality/README.md` is present and defines authority, workflow, evidence, status and prohibited-content rules. |
| `DOC-005` | Live feature baseline lost stable identifiers | **Resolved by PR #50** | Current rows carry stable primary IDs and all archived IDs have explicit dispositions. |
| `TEST-002` | Database-parity CI gate filters the wrong paths | **Resolved** | Workflow covers rollout SQL, contract, Supabase and parity paths; rebuild/lint/pgTAP/parity execute. |

## Low

| ID | Finding | Status |
| --- | --- | --- |
| `HYGIENE-001` | Unused Vite scaffold asset remains | **Resolved by PR #74** — `src/assets/vite.svg` was removed after usage verification; final head passed CI and Browser E2E. |
| `HYGIENE-002` | Some pure modules appear test/reference-only | **Open; verify before deletion** |
| `CODE-001` | Large orchestration files are coordination hotspots | **Open** |
| `OPS-004` | Runtime pinning is incomplete | **Resolved** — Node `22.22.2` is aligned across repository and hosted build surfaces. |
| `SEO-001` | SPA fallback produces soft 404s | **Open** — client renders a recovery page, but Netlify SPA fallback still responds HTTP 200. |
| `SEO-002` | Metadata is largely global | **Open** |
| `A11Y-003` | Bottom navigation is imperative rather than link-semantic | **Resolved** — all primary destinations are semantic router links with current-page state. |
| `UX-003` | Other-player profile action remains incomplete | **Open** |
| `UX-004` | Sign-out is immediate | **Resolved by PR #43** — accessible confirmation and failure-safe retry are covered. |
| `DATA-008` | Score values have no practical database maximum | **Open** |
| `DOC-002` | Package version remains `0.0.0` | **Open** |
| `DOC-003` | Component gallery is large and partly historical | **Open; correctly development-only** |
| `REPO-001` | Licence, changelog and editor baseline are absent | **Partially resolved** — editor baseline exists; licence and changelog policy remain open. |
| `REPO-002` | `.gitignore` misses environment variants | **Resolved** — sensitive `.env*` variants are ignored and tested while `.env.example` remains committable. |
| `TEST-003` | Test hard-fails outside a Git work tree | **Resolved by PR #47** |
| `DOC-006` | Archived evidence has broken relative links | **Resolved by PR #47** |

## Register rules

- Keep original IDs when the same defect regresses or broadens.
- Repository/development fixes remain open when the actual production risk remains.
- Prepared tooling, an encrypted artifact or an approved method does not prove recovery without restore evidence.
