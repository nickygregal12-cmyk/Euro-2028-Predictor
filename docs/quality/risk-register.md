# Euro 2028 Predictor — Current Risk Register

**Current production reconciliation:** [`reconciliations/2026-07-25-contract-35-production-promotion.md`](reconciliations/2026-07-25-contract-35-production-promotion.md)  
**Latest formal pre-rollout audit:** [`audits/2026-07-25-repeat-verification-audit.md`](audits/2026-07-25-repeat-verification-audit.md) (`2026-07-25R`)  
**Recovery acceptance:** [`reconciliations/2026-07-25-final-recovery-acceptance.md`](reconciliations/2026-07-25-final-recovery-acceptance.md)

This register retains every original finding ID. Historical audits remain immutable. Current `main`, executable tests and verified hosted evidence override older classifications.

## Summary

| Severity | Total current findings | Closed/superseded | Open, partial, blocked or in progress |
| --- | ---: | ---: | ---: |
| Critical | 6 | 6 | 0 |
| High | 16 | 8 | 8 |
| Medium | 19 | 8 | 11 |
| Low | 16 | 7 | 9 |
| **Total** | **57** | **29** | **28** |

Resolved or superseded IDs now include `OPS-001`, `OPS-004`, `OPS-005`, `OPS-006`, `OPS-007`, `DATA-001`, `SECURITY-001`, `SECURITY-002`, `DATA-002`, `SECURITY-003`, `FUNC-001`, `REL-001`, `REL-002`, `REL-003`, `REL-004`, `REL-005`, `REL-006`, `A11Y-002`, `A11Y-003`, `SEC-002`, `UX-004`, `REPO-002`, `HYGIENE-001`, `DOC-001`, `DOC-004`, `DOC-005`, `TEST-002`, `TEST-003` and `DOC-006`.

## Movement after the contract-35 production promotion

| Change | Detail |
| --- | --- |
| Resolved | `OPS-006` — production application, Netlify declaration and database are aligned at contract 35 on the approved commit/deploy. |
| Resolved | `DATA-001`, `SECURITY-001`, `SECURITY-002` — server-derived positions and RPC-only submission boundaries are deployed and verified in production. |
| Resolved | `DATA-002`, `REL-001` — authoritative result lifecycle, revisions and serialized recomputation are deployed; rollback-only result smoke passed. |
| Resolved | `SECURITY-003` — exact production function allowlists, zero anonymous application execution and closed future defaults passed the 63-check verifier. |
| Resolved | `FUNC-001`, `REL-004` — full bracket replay and atomic complete-bracket replacement are deployed; rollback-only authenticated smoke passed. |
| Resolved | `REL-003` — pending-write settlement is deployed and the production submission-settlement smoke passed. |
| Improved | `DATA-005`, `REL-007`, `TEST-001` — compatible production backend is present and anonymous production smoke passed; controlled authenticated production browser evidence remains. |
| Improved | `OPS-003` — accepted recovery proof and controlled production execution are complete; monitoring, alert ownership, periodic rehearsal and final rollback readiness remain. |

## Critical

| ID | Finding | Current status | Current evidence / required closure |
| --- | --- | --- | --- |
| `OPS-006` | Production application and Supabase schema are incompatible | **Resolved by contract-35 promotion** | Production history is exactly 1–35, both client RPCs are present, Netlify declares 35 and the approved deploy passed live verification. Reopen on any app/schema divergence. |
| `DATA-001` | Predicted group positions are not safely derived/persisted | **Resolved** | Production created exactly 24 server-derived positions and denies the old client-owned boundary. |
| `SECURITY-001` | Group-position scoring inputs can be forged/changed | **Resolved** | Production verifier proves browser roles cannot directly write server-owned group positions. |
| `SECURITY-002` | Submission timestamp can be bypassed directly | **Resolved** | Production uses the protected submission RPC boundary and direct entry mutation is denied. |
| `DATA-002` | Knockout results lack an authoritative winner/method | **Resolved** | Production result state/method/winner/revision controls are present; service-role confirm/clear smoke passed with revision-table denial retained. |
| `OPS-001` | Rollback instruction crossed production/development boundaries | **Resolved** | Current runbooks prohibit production-to-development swaps; production Netlify points only at production Supabase. Reopen on regression. |

## High

| ID | Finding | Current status | Current evidence / required closure |
| --- | --- | --- | --- |
| `OPS-007` | Production previews/branch deploys inherit production Supabase | **Resolved** | Production uses production Supabase; deploy-preview, branch-deploy and dev use development Supabase with the fail-closed prebuild guard. |
| `SECURITY-003` | Hosted `SECURITY DEFINER` grants and mutable search paths are over-broad | **Resolved in production** | Exact authenticated/service allowlists, zero anonymous application execution and owner-only future defaults passed production verification. The trigger-only `enforce_joker_rules` warning remains a separate non-blocking hardening item. |
| `DATA-003` | Same-tournament/reference constraints are incomplete | **Open — in progress outside `main`** | Major guards exist. Draft PR #76 proposes migration 36 but remains draft/unmerged and was not applied. |
| `FUNC-001` | Bracket progression can be internally inconsistent | **Resolved** | Full predicted-tree replay/validation is deployed and production atomic-bracket smoke passed. |
| `FUNC-002` | Valid entries are not automatically submitted at lock | **Open** | Rule is documented; no scheduler/server implementation exists. |
| `REL-001` | Score recomputation/result writes can race | **Resolved** | Production contract 35 serializes result/scoring operations; result-lifecycle smoke passed. |
| `DATA-004` | Actual tie resolution can depend on non-authoritative fallback behavior | **Open** | Official unresolved-tie/admin workflow remains deferred pending authoritative regulations. |
| `DATA-005` | Clearing an incomplete score does not delete the stored prediction | **Production backend deployed; final browser evidence pending** | Client, RPC, trigger invalidation and disposable browser tests pass. Complete controlled production clear/reload/conflict/lock browser evidence under `TEST-001`. |
| `REL-002` | Independent late reads can overwrite newer state | **Resolved by PR #63** | Per-slice revisions, context resets and delayed response regressions passed CI and Browser E2E. |
| `REL-003` | Manual submit does not flush pending debounced writes | **Resolved** | Settlement logic passed disposable browser coverage and rollback-only production submission smoke. |
| `REL-004` | Compound bracket writes are non-atomic | **Resolved** | Atomic complete-snapshot RPC is deployed; rollback-only authenticated production smoke passed. |
| `DATA-006` | Fixture/source relationships are mutable or insufficiently constrained | **Open** | Wider reference immutability remains a launch blocker; draft PR #76 is not authority. |
| `OPS-002` | No version-controlled administrator model/control-room boundary | **Open** | No approved admin authorization model or browser result-admin page exists. |
| `TEST-001` | Critical database/browser rules lack executable integration assurance | **Partially resolved — production anonymous smoke added** | Disposable Playwright covers auth, predictions, saves, conflicts, locks, signup/recovery, private leagues and accessibility transitions. Production metadata/headers/routes/environment isolation passed anonymously. Browser result administration, manual screen-reader review and controlled authenticated production mutation journeys remain. |
| `OPS-003` | Release, monitoring and recovery controls are incomplete | **Recovery and production execution complete; monitoring/rollback work open** | Accepted backup/restore evidence and the controlled contract-35 rollout passed. Close only after monitoring, alert ownership, periodic rehearsal and final launch rollback readiness are proven. |
| `OPS-005` | Production may contain an untracked admin role column | **Superseded by `OPS-002`** | Read-only production inspection confirmed the column does not exist. |

## Medium

| ID | Finding | Current status | Closure evidence required |
| --- | --- | --- | --- |
| `OPS-008` | Public legacy “development” site is sourced from the World Cup repository and dormant backend | **Open — separate owner action pending** | Retire/protect through the legacy workstream. Do not repoint it to either current Euro project. |
| `AUTH-001` | Production Turnstile key is inherited by non-production contexts while development CAPTCHA configuration is unverified | **Open — dashboard work pending** | Configure a matching non-production model across Netlify, Cloudflare and development Supabase; prove preview login/signup/recovery and production regression. |
| `REL-005` | Open pages can remain convincingly stale | **Resolved by PR #68** | Foreground refresh settles writes, preserves conflicts/errors and uses revision guards. |
| `REL-006` | Concurrent first-use requests can hit entry unique conflicts | **Resolved by PR #65** | Insert-on-conflict/fallback-read boundary and two-context browser proof converge on one entry. |
| `REL-007` | Stale device can delete a newer bracket pick | **Production implementation present; final browser evidence pending** | Snapshot versions are deployed. Complete a controlled multi-device production browser journey without risking retained user data. |
| `PERF-001` | League summary requests scale linearly/serially | **Open** | Remove/contain serial per-league requests and profile representative load. |
| `UX-001` | Invite context is hidden behind generic signup | **Partially improved** | Pending invite continuation is browser-proven. Close only after a privacy/abuse-approved anonymous preview exposes trustworthy context. |
| `A11Y-001` | SPA navigation lacks complete assistive-technology transitions | **Partially resolved** | Route titles, live region, main focus, skip navigation and browser keyboard evidence exist. Manual screen-reader review remains. |
| `A11Y-002` | League options menu semantics do not match behaviour | **Resolved by PR #41** | Disclosure semantics, native buttons, Escape close/focus restoration and tests are present. |
| `TYPE-001` | Hand-written casts and non-strict TypeScript can hide schema drift | **Open** | Generate DB types, validate critical RPC payloads and enable strictness incrementally. |
| `DOC-001` | Documentation is not consistently authoritative | **Resolved; reopened documentation drift corrected by this reconciliation** | The production-promotion reconciliation updates every active authority source. Reopen on future verified drift. |
| `SEC-001` | Invite/aggregate disclosure needs abuse review | **Open** | Threat-model enumeration and minimum-cohort/rate-limit behaviour. |
| `SEC-002` | Raw internal errors can reach users | **Resolved by PR #71** | Central safe mapper prevents infrastructure text reaching current UI surfaces. |
| `DATA-007` | Rate limiting is count-then-insert | **Open** | Serialize per user/action or use an atomic database primitive. |
| `UX-002` | Unavailable data is conflated with empty data | **Partially resolved — four primary surfaces corrected** | Audit remaining remote-read consumers and remove or rule out false-empty states. |
| `PERF-002` | Scoring recomputes the whole tournament | **Open / accepted pending measurement** | Profile target-capacity cost before deciding whether to optimize. |
| `DOC-004` | Quality governance charter is absent | **Resolved** | `docs/quality/README.md` defines authority, workflow, evidence, status and prohibited-content rules. |
| `DOC-005` | Live feature baseline lost stable identifiers | **Resolved by PR #50** | Current rows retain stable primary IDs and archived dispositions. |
| `TEST-002` | Database-parity CI gate filters the wrong paths | **Resolved** | Workflow covers rollout SQL, contract, Supabase and parity paths. |

## Low

| ID | Finding | Status |
| --- | --- | --- |
| `HYGIENE-001` | Unused Vite scaffold asset remains | **Resolved by PR #74** |
| `HYGIENE-002` | Some pure modules appear test/reference-only | **Open; verify before deletion** |
| `CODE-001` | Large orchestration files are coordination hotspots | **Open** |
| `OPS-004` | Runtime pinning is incomplete | **Resolved** — Node `22.22.2` is aligned across repository and hosted build surfaces. |
| `SEO-001` | SPA fallback produces soft 404s | **Open** — client renders recovery, but Netlify fallback responds HTTP 200. |
| `SEO-002` | Metadata is largely global | **Open** |
| `A11Y-003` | Bottom navigation is imperative rather than link-semantic | **Resolved** |
| `UX-003` | Other-player profile action remains incomplete | **Open** |
| `UX-004` | Sign-out is immediate | **Resolved by PR #43** |
| `DATA-008` | Score values have no practical database maximum | **Open** |
| `DOC-002` | Package version remains `0.0.0` | **Open** |
| `DOC-003` | Component gallery is large and partly historical | **Open; correctly development-only** |
| `REPO-001` | Licence, changelog and editor baseline are absent | **Partially resolved** — editor baseline exists; licence/changelog policy remain. |
| `REPO-002` | `.gitignore` misses environment variants | **Resolved** |
| `TEST-003` | Test hard-fails outside a Git work tree | **Resolved by PR #47** |
| `DOC-006` | Archived evidence has broken relative links | **Resolved by PR #47** |

## Register rules

- Keep original IDs when the same defect regresses or broadens.
- Repository/development fixes remain open when the actual production risk remains.
- A production schema capability may be closed from exact hosted verification and smoke evidence even when broader browser assurance remains under `TEST-001`.
- Prepared tooling or an encrypted artifact alone does not prove recovery; accepted clean restore, verification and custody evidence are required.
- Historical audits are evidence of their date. Update current classification through a new reconciliation, not by rewriting the audit.