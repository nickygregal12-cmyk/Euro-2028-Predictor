# Euro 2028 Predictor — Current Risk Register

**Current audit:** `2026-07-23L`  
**Evidence:** [`audits/2026-07-23-live-environment-audit.md`](audits/2026-07-23-live-environment-audit.md)  
**Latest security reconciliation:** [`reconciliations/2026-07-24-function-privilege-hardening.md`](reconciliations/2026-07-24-function-privilege-hardening.md)  
**Latest reliability reconciliation:** [`reconciliations/2026-07-24-submit-save-barrier.md`](reconciliations/2026-07-24-submit-save-barrier.md)  
**Latest data reconciliation:** [`reconciliations/2026-07-24-score-clearing.md`](reconciliations/2026-07-24-score-clearing.md)

This register retains every original finding ID and adds findings discovered by the live hosted audit. Older audit reports remain immutable evidence. “Repository/local implemented” does **not** mean deployed.

## Summary

| Severity | Total current findings | Closed/superseded | Open or partially resolved |
| --- | ---: | ---: | ---: |
| Critical | 6 | 1 | 5 |
| High | 16 | 1 | 15 |
| Medium | 14 | 1 | 13 |
| Low | 14 | 0 | 14 |
| **Total** | **50** | **3** | **47** |

`OPS-001` is resolved. `OPS-005` is superseded by `OPS-002`. `DOC-001` is resolved by the live-audit documentation reconciliation. Several other findings are implemented locally or on hosted development but remain open because production has not received or browser-verified the fixes.

## Critical

| ID | Finding | Current status | Current evidence / required closure |
| --- | --- | --- | --- |
| `OPS-006` | Production application and Supabase schema are incompatible | **Open — confirmed live** | Netlify serves post-PR #14 code calling `replace_predicted_progression`; production lacks the RPC. Restore a compatible app/schema pair and verify bracket save/reload. |
| `DATA-001` | Predicted group positions are not safely derived/persisted | **Open production; implemented repository/development** | Migration 26 derives and protects positions and passes hosted development verification. Production retains the old writable table/policies. |
| `SECURITY-001` | Group-position scoring inputs can be forged/changed | **Open production; implemented repository/development** | Development denies direct group-position writes through the later chain. Production authenticated role still has insert/update privileges and the broad owner policy. |
| `SECURITY-002` | Submission timestamp can be bypassed directly | **Open production; implemented repository/development** | Development uses the RPC boundary and denies direct entry update/delete. Production authenticated role still has `entries` update privilege. |
| `DATA-002` | Knockout results lack an authoritative winner/method | **Open production; implemented repository/development** | Development has verified result state/method/checkpoints/winner/revisions. Production lacks those controls. |
| `OPS-001` | Rollback instruction crossed production/development boundaries | **Resolved** | Current runbook prohibits production-to-development swaps; production Netlify currently references production Supabase. Reopen on any regression. |

## High

| ID | Finding | Current status | Current evidence / required closure |
| --- | --- | --- | --- |
| `OPS-007` | Production deploy previews/branch deploys inherit production Supabase values | **Open — confirmed configuration** | Production Netlify env values are scoped to `all` contexts. Scope previews away from production or disable/protect them. |
| `SECURITY-003` | Hosted `SECURITY DEFINER` grants and mutable search paths are over-broad | **Open production; implemented repository/development** | Migration 34 removes anonymous/internal execution, applies exact authenticated/service allowlists, closes future defaults and fixes mutable helper paths. Migration 35 extends the exact allowlists with the protected prediction-delete RPC. Hosted development verification passed. Production retains the old broad grants until migrations 21–35 roll out. |
| `DATA-003` | Same-tournament/reference constraints are incomplete | **Open — partially implemented** | PRs #9/#12 add major guards; wider immutable/composite reference constraints remain. Production controls are absent. |
| `FUNC-001` | Bracket progression can be internally inconsistent | **Open production; implemented repository/development** | Full predicted-tree replay and validation pass on hosted development. Production validator/propagation is absent. |
| `FUNC-002` | Valid entries are not automatically submitted at lock | **Open** | Rule exists in `docs/scoring-rules.md`; no scheduler/server implementation. |
| `REL-001` | Score recomputation/result writes can race | **Open production; materially addressed repository/development** | Development serializes recomputation. Production old recompute path remains. |
| `DATA-004` | Actual tie resolution can depend on non-authoritative fallback behavior | **Open** | No fresh evidence of complete resolution. |
| `DATA-005` | Clearing an incomplete score does not delete the stored prediction | **Partially resolved — repository/development implemented and verified** | Migration 35 makes deletion owner-, scope-, lock- and expected-version-safe through `delete_match_prediction`; the client queues deletion on the same serialized match key; provider tests, hosted-development proof and pgTAP cover clearing, conflicts, idempotency and derived-position invalidation. Close only after migrations 21–35 reach production and authenticated clear/reload/conflict/lock browser journeys pass. |
| `REL-002` | Independent late reads can overwrite newer state | **Open** | Prediction/tie/bracket/bonus loading remains independently best-effort. |
| `REL-003` | Manual submit does not flush pending debounced writes | **Partially resolved — repository implemented and tested** | The provider now flushes score/bracket debounces, waits for all match/tie/bracket/bonus controller writes, and blocks on errors/conflicts. Controller and provider regression tests pass. Close after compatible production rollout plus authenticated browser verification of immediate final-edit submission and failure/conflict blocking. |
| `REL-004` | Compound bracket writes are non-atomic | **Open production; implemented repository/development** | Atomic complete-snapshot RPC and stale-version rollback pass on development. Production RPC is absent and deployed client remains incompatible. |
| `DATA-006` | Fixture/source relationships are mutable or insufficiently constrained | **Open** | Wider reference immutability remains a launch blocker. |
| `OPS-002` | No version-controlled administrator model/control room boundary | **Open** | No `profiles.role` column exists in repository or hosted schema; no browser result admin page. |
| `TEST-001` | Critical database/browser rules lack executable integration assurance | **Partially resolved** | Disposable database CI, pgTAP and provider-level submission/score-clearing tests exist; authenticated production-like browser E2E remains absent. |
| `OPS-003` | Release, monitoring and recovery controls are incomplete | **Partially resolved** | CI, read-only preflights and safer rollback exist; production compatibility, monitoring, backup verification and restore rehearsal remain open. |
| `OPS-005` | Production may contain an untracked admin role column | **Superseded by `OPS-002`** | Read-only production inspection confirmed the column does not exist. The historical bootstrap statement was inaccurate rather than evidence of schema drift. |

## Medium

| ID | Finding | Current status | Closure evidence required |
| --- | --- | --- | --- |
| `REL-005` | Open pages can remain convincingly stale | Open | Add and test a deliberate realtime, polling or focus-refetch strategy. |
| `REL-006` | Concurrent first-use requests can hit entry unique conflicts | Open | Replace/select-insert race with an idempotent server boundary and test two-tab creation. |
| `REL-007` | Stale device can delete a newer bracket pick | **Open production; implemented repository/development** | Complete-snapshot versions contain this on development; verify production rollout and multi-device browser behavior. |
| `PERF-001` | League summary requests scale linearly/serially | Open | Remove serial per-league request pattern and profile representative load. |
| `UX-001` | Invite context is hidden behind generic signup | Open | Show trustworthy invite preview before auth and remove render-time storage mutation. |
| `A11Y-001` | SPA navigation lacks complete assistive-technology transitions | Open | Add skip link, route title/focus/live-region behavior and browser accessibility tests. |
| `A11Y-002` | League options menu semantics do not match behavior | Open | Implement full menu-button keyboard model or use simpler disclosure semantics. |
| `TYPE-001` | Hand-written casts and non-strict TypeScript can hide schema drift | Open | Generate DB types, enable strictness incrementally and validate critical RPC payloads. |
| `DOC-001` | Documentation is not consistently authoritative | **Resolved by current reconciliation** | Live audit, current status, migration inventory, risk register and agent rules now share one authority hierarchy. Reopen on contradiction. |
| `SEC-001` | Invite/aggregate disclosure needs abuse review | Open | Threat-model enumeration and rate limits at intended competition size. |
| `SEC-002` | Raw internal errors can reach users | Open | Map database/network failures to stable safe messages. |
| `DATA-007` | Rate limiting is count-then-insert | Open | Serialize per user/action or use an atomic database primitive. |
| `UX-002` | Unavailable data is conflated with empty data | Open | Preserve loading/error/unavailable states through home and related reads. |
| `PERF-002` | Scoring recomputes the whole tournament | Open / accepted pending measurement | Profile target-capacity cost before deciding whether to optimize. |

## Low

| ID | Finding | Status |
| --- | --- | --- |
| `HYGIENE-001` | Unused Vite scaffold asset remains | Open |
| `HYGIENE-002` | Some pure modules appear test/reference-only | Open; verify before deletion |
| `CODE-001` | Large orchestration files are coordination hotspots | Open |
| `OPS-004` | Runtime pinning is incomplete | Partially resolved: CI pins Node 22.22.2; Netlify runtime pin remains unverified |
| `SEO-001` | SPA fallback produces soft 404s | Open |
| `SEO-002` | Metadata is largely global | Open |
| `A11Y-003` | Bottom navigation is imperative rather than link-semantic | Open |
| `UX-003` | Other-player profile action remains incomplete | Open |
| `UX-004` | Sign-out is immediate | Open |
| `DATA-008` | Score values have no practical database maximum | Open |
| `DOC-002` | Package version remains `0.0.0` | Open |
| `DOC-003` | Component gallery is large and partly historical | Open; correctly dev-only |
| `REPO-001` | Licence, changelog and editor baseline are absent | Open |
| `REPO-002` | `.gitignore` misses `.env.production` and `.env.development` | Open; no such file currently committed |

## Register rules

- Keep original IDs when the same defect regresses.
- A repository/development fix remains open when the actual risk is still present or unverified in production.
- `Resolved` requires implementation, validation and current-environment evidence appropriate to the finding.
- `Superseded` must name the active replacement finding.
- Do not silently remove uncertain or accepted risks.
- Use GitHub Issues/PRs for implementation work; this file records risk state rather than duplicating a task tracker.
- Update this register with each material integrity, security, deployment or operations workstream.
