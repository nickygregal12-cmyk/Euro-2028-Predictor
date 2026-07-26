# Euro 2028 Predictor — Current Risk Register

**Current repository reconciliation:** [`reconciliations/2026-07-26-contract-36-repository-reconciliation.md`](reconciliations/2026-07-26-contract-36-repository-reconciliation.md)  
**Last verified final-target reconciliation:** [`reconciliations/2026-07-25-contract-35-production-promotion.md`](reconciliations/2026-07-25-contract-35-production-promotion.md)  
**Recovery acceptance:** [`reconciliations/2026-07-25-final-recovery-acceptance.md`](reconciliations/2026-07-25-final-recovery-acceptance.md)

This register retains existing finding IDs. Current `main`, executable tests and verified hosted evidence override older classifications. The environment historically named production is the final-target environment and is not supporting a live tournament.

## Contract-36 movement

| ID | Previous position | Current position |
| --- | --- | --- |
| `DATA-003` | Migration 36 described as draft/outside authority | **Implemented in repository; hosted development verification and acceptance reconciliation pending** |
| `DATA-006` | Generic wider fixture/source immutability gap | **Requires precise residual-scope review against migration 36; no longer valid as an unqualified statement** |
| `DOC-001` | Documentation authority aligned at contract 35 | **Temporarily reopened by contract drift; being corrected in PR #101** |
| `OPS-006` | Final-target application/database aligned at 35 | **Remains resolved for the last verified contract-35 pair; repository is now ahead at 36 until hosted upgrades occur** |

## Critical

| ID | Finding | Current status | Required closure |
| --- | --- | --- | --- |
| `OPS-006` | Application/database contract divergence | **Resolved for the accepted final-target contract-35 pair; alignment work required before a contract-36 deploy** | Upgrade development first, then final target, and change declarations only after hosted verification. |
| `DATA-001` | Predicted group positions can be forged or drift | **Resolved** | Reopen on regression. |
| `SECURITY-001` | Server-owned group-position inputs can be written by browser roles | **Resolved** | Reopen on regression. |
| `SECURITY-002` | Submission boundary can be bypassed | **Resolved** | Reopen on regression. |
| `DATA-002` | Knockout result winner/method lacks authority | **Resolved** | Reopen on regression. |
| `OPS-001` | Environment rollback crosses database boundaries | **Resolved** | Preserve environment isolation. |

## High

| ID | Finding | Current status | Evidence / required closure |
| --- | --- | --- | --- |
| `DATA-003` | Same-tournament/reference constraints are incomplete | **Repository implementation complete; verification pending** | Migration 36 adds fail-closed guards for group-team, match, player, result revision, Golden Boot and score-event references. Confirm CI/parity, development dry run/application and hosted behaviour before closing. |
| `DATA-006` | Fixture/source relationships are mutable or insufficiently constrained | **Under precise reassessment** | Identify any relationship not covered by migration 36. Retain only concrete residual gaps with table/column evidence. |
| `FUNC-002` | Valid entries are not automatically submitted at lock | **Open** | Implement server-side scheduling and exact lock-boundary tests. |
| `DATA-004` | Actual tie resolution can depend on non-authoritative fallback behaviour | **Open** | Define authoritative actual-tie workflow when regulations/data are available. |
| `DATA-005` | Clearing incomplete scores lacks complete final-target browser proof | **Backend implemented; browser evidence pending** | Complete controlled clear/reload/conflict/lock verification. |
| `OPS-002` | No approved administrator model/control room | **Open** | Add version-controlled authorization, RPC boundaries and browser E2E. |
| `TEST-001` | Critical browser/database rules lack complete end-to-end evidence | **Partial** | Migration-36 hosted evidence, result administration, controlled authenticated mutation smoke and manual screen-reader review remain. |
| `OPS-003` | Monitoring/recovery operations are incomplete | **Partial** | Sentry integration exists, but final-target delivery, alert ownership, retention and periodic rehearsal remain. |

## Medium

| ID | Finding | Current status |
| --- | --- | --- |
| `AUTH-001` | Turnstile/CAPTCHA contexts are not fully verified | **Open** |
| `OPS-008` | Legacy public development site remains | **Open — separate workstream** |
| `REL-007` | Stale device can delete a newer bracket pick | **Implementation present; final controlled browser evidence pending** |
| `PERF-001` | League summary requests may scale serially | **Open** |
| `PERF-002` | Scoring recomputes the whole tournament | **Open pending measurement** |
| `TYPE-001` | Hand-written types/casts can hide schema drift | **Open** |
| `A11Y-001` | Assistive-technology review is incomplete | **Partial** |
| `UX-001` | Trustworthy invite context before auth is incomplete | **Partial** |
| `UX-002` | Unavailable and empty data can be conflated | **Partial** |
| `SEC-001` | Invite/aggregate disclosure needs abuse review | **Open** |
| `DATA-007` | Rate limiting is count-then-insert | **Open** |
| `DOC-001` | Documentation authority can drift | **Reopened for contract-36 reconciliation** |

## Low

| ID | Finding | Status |
| --- | --- | --- |
| `HYGIENE-002` | Some pure modules may be test/reference-only | **Open; verify before deletion** |
| `CODE-001` | Large orchestration files are coordination hotspots | **Open** |
| `SEO-001` | SPA fallback produces soft 404s | **Open** |
| `SEO-002` | Metadata is largely global | **Open** |
| `UX-003` | Other-player profile action remains incomplete | **Open** |
| `DATA-008` | Score values have no practical database maximum | **Open** |
| `DOC-002` | Package version remains `0.0.0` | **Open** |
| `DOC-003` | Component gallery is large and partly historical | **Open; development-only** |
| `REPO-001` | Licence and changelog policy are absent | **Partial** |

## Register rules

- A repository migration is implemented when merged into `main`; hosted closure requires hosted evidence.
- Do not call a final-target risk closed merely because the database is not live. Preserve controls for the intended final environment.
- Do not retain broad findings when the concrete defect has been implemented; rewrite residual scope precisely.
- Current hosted contract-35 evidence remains valid until superseded by a dated contract-36 reconciliation.
- Historical audits remain immutable.
