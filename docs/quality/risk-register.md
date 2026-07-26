# Euro 2028 Predictor — Current Risk Register

**Latest development reconciliation:** [`reconciliations/2026-07-26-contract-36-development-promotion.md`](reconciliations/2026-07-26-contract-36-development-promotion.md)  
**Last verified final-target reconciliation:** [`reconciliations/2026-07-25-contract-35-production-promotion.md`](reconciliations/2026-07-25-contract-35-production-promotion.md)  
**Recovery acceptance:** [`reconciliations/2026-07-25-final-recovery-acceptance.md`](reconciliations/2026-07-25-final-recovery-acceptance.md)

Current `main`, executable tests and verified hosted evidence override older classifications. Production is the controlled final target, not an active tournament.

## Contract-36 movement

| ID | Current position |
| --- | --- |
| `DATA-003` | **Repository and development hosted implementation verified.** Six relationship groups are guarded; final-target rollout is tracked under `OPS-006`. |
| `DATA-006` | **No concrete residual defect established.** Reopen only with an exact uncovered relationship. |
| `DOC-001` | **Resolved.** Current agent/status/risk/roadmap/migration authority is reconciled. |
| `OPS-006` | **Narrowed to final-target divergence.** Repository/development/previews are 36; final target remains compatible 35 and fail-closed. |
| `TEST-001` | **Reduced.** Hosted development migration and exact-head preview smoke are complete; other critical journeys remain. |

## Critical

| ID | Finding | Current status | Required closure |
| --- | --- | --- | --- |
| `OPS-006` | Final-target application/database contract remains 35 while repository/development are 36 | **Open; safely fail-closed** | Read-only final-target preparation, recoverable evidence, explicit owner approval, migration/verification, production declaration 36, exact-head deployment and smoke. |
| `DATA-001` | Predicted group positions can be forged or drift | **Resolved** | Reopen on regression. |
| `SECURITY-001` | Browser roles can write server-owned position inputs | **Resolved** | Reopen on regression. |
| `SECURITY-002` | Submission boundary can be bypassed | **Resolved** | Reopen on regression. |
| `DATA-002` | Knockout winner/method lacks database authority | **Resolved in database** | Frontend authoritative consumption remains separately open. |
| `OPS-001` | Environment rollback crosses database boundaries | **Resolved** | Preserve isolation. |

## High

| ID | Finding | Current status | Evidence / required closure |
| --- | --- | --- | --- |
| `DATA-003` | Same-tournament/reference constraints incomplete | **Resolved in repository and development** | Exact 36-history, six private guards, privilege revocations and rollback-only valid/invalid hosted tests passed. Final-target promotion is `OPS-006`. |
| `DATA-006` | Wider fixture/source relationships insufficiently constrained | **No proven residual defect** | Do not retain as a broad duplicate. |
| `FUNC-002` | Valid entries are not automatically submitted at lock | **Open** | Server scheduler and exact lock-boundary tests. |
| `DATA-004` | Actual tie resolution can use non-authoritative fallback | **Open** | Define authoritative workflow when official regulations/data are available. |
| `DATA-005` | Score clearing lacks complete final-target browser proof | **Backend implemented; final-target evidence pending** | Controlled clear/reload/conflict/lock verification. |
| `OPS-002` | No complete approved administrator model/control room | **Open; PR #102 is foundation only** | Authorized RPC boundaries, bootstrap/assignment evidence, audit history and Browser E2E. |
| `TEST-001` | Critical rules lack complete end-to-end evidence | **Partial** | Result admin, authoritative penalty-winner UI, final-target controlled mutations and manual screen-reader review remain. |
| `OPS-003` | Monitoring/recovery operations incomplete | **Partial** | Final-target delivery, ownership, retention and periodic rehearsal. |

## Medium

| ID | Finding | Current status |
| --- | --- | --- |
| `AUTH-001` | Turnstile/CAPTCHA contexts not fully verified | **Open** |
| `OPS-008` | Legacy public development site remains | **Open — separate workstream; never use as current preview** |
| `REL-007` | Stale device can delete a newer bracket pick | **Implementation present; final-target browser evidence pending** |
| `DB-001` | `public.enforce_joker_rules` has mutable search path | **Open advisor finding** |
| `DB-002` | Authenticated `SECURITY DEFINER` allowlist needs continued review | **Open assurance finding; many grants may be intentional** |
| `DB-003` | Several foreign keys lack supporting indexes | **Open pending representative query evidence** |
| `AUTH-002` | Leaked-password protection disabled | **Open decision** |
| `PERF-001` | League summaries may scale serially | **Open** |
| `PERF-002` | Scoring recomputes whole tournament | **Open pending measurement** |
| `TYPE-001` | Hand-written types/casts can hide schema drift | **Open** |
| `A11Y-001` | Assistive-technology review incomplete | **Partial** |
| `UX-001` | Trustworthy invite context before auth incomplete | **Partial** |
| `UX-002` | Unavailable and empty data can be conflated | **Partial** |
| `SEC-001` | Invite/aggregate disclosure needs abuse review | **Open** |
| `DATA-007` | Rate limiting is count-then-insert | **Open** |
| `DOC-001` | Documentation authority can drift | **Resolved; reopen on contradiction** |

## Low

| ID | Finding | Status |
| --- | --- | --- |
| `HYGIENE-002` | Some pure modules may be test/reference-only | **Open; verify before deletion** |
| `CODE-001` | Large orchestration files are hotspots | **Open** |
| `SEO-001` | SPA fallback produces soft 404s | **Open** |
| `SEO-002` | Metadata largely global | **Open** |
| `UX-003` | Other-player profile action incomplete | **Open** |
| `DATA-008` | Scores have no practical database maximum | **Open** |
| `DOC-002` | Package version remains `0.0.0` | **Open** |
| `DOC-003` | Component gallery large/partly historical | **Open; development-only** |
| `REPO-001` | Licence/changelog policy absent | **Partial** |

## Register rules

- Repository implementation, development-hosted verification and final-target verification are separate closure states.
- Do not call a final-target risk closed because the tournament is not live.
- Do not retain broad findings after the concrete defect is resolved.
- The retained 35/35 final-target evidence stays valid until a dated 36/36 promotion replaces it.
- A guard blocking incompatible deployment is a working safeguard, not a defect to bypass.
- Advisor warnings require context; do not remove indexes or revoke intended RPC access without evidence.
- Historical audits remain immutable.
