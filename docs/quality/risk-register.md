# Euro 2028 Predictor — Current Risk Register

**Latest development reconciliation:** [`reconciliations/2026-07-27-admin-migration-version-reconciliation.md`](reconciliations/2026-07-27-admin-migration-version-reconciliation.md)
**Last verified final-target reconciliation:** [`reconciliations/2026-07-27-contract-38-final-target-promotion.md`](reconciliations/2026-07-27-contract-38-final-target-promotion.md)
**Sentry assurance:** [`reconciliations/2026-07-26-sentry-operational-assurance.md`](reconciliations/2026-07-26-sentry-operational-assurance.md)  
**Recovery acceptance:** [`reconciliations/2026-07-25-final-recovery-acceptance.md`](reconciliations/2026-07-25-final-recovery-acceptance.md)  
**Recovery exception:** closed by green backup run `30264080847`, disposable restore verification and private off-GitHub encrypted custody ([`reconciliations/2026-07-27-production-backup-workflow.md`](reconciliations/2026-07-27-production-backup-workflow.md)).

Current `main`, executable tests and verified hosted evidence override older classifications. Production is the controlled final target, not an active tournament.

## Current contract movement

| ID | Current position |
| --- | --- |
| `DATA-003` | **Resolved and hosted.** Six relationship groups are guarded in development and production. |
| `DATA-006` | **No concrete residual defect established.** Reopen only with an exact uncovered relationship. |
| `DOC-001` | **Resolved.** Current agent/status/risk/roadmap/migration authority is reconciled. |
| `OPS-006` | **Resolved.** Contract declarations are validated per context: repository, development and non-production Netlify at 44; production deliberately locked at 38 (controlled, documented divergence). |
| `TEST-001` | **Reduced.** Hosted development migration and exact-head preview smoke are complete; other critical journeys remain. |

## Critical

| ID | Finding | Current status | Required closure |
| --- | --- | --- | --- |
| `OPS-006` | Production contract divergence | **Resolved** | Contract 38 promotion, exact-release smoke and locked milestone deploy are recorded in [`2026-07-27-contract-38-final-target-promotion.md`](reconciliations/2026-07-27-contract-38-final-target-promotion.md). |
| `DATA-001` | Predicted group positions can be forged or drift | **Resolved** | Reopen on regression. |
| `SECURITY-001` | Browser roles can write server-owned position inputs | **Resolved** | Reopen on regression. |
| `SECURITY-002` | Submission boundary can be bypassed | **Resolved** | Reopen on regression. |
| `DATA-002` | Knockout winner/method lacks database authority | **Resolved** | Database authority plus frontend authoritative consumption across Match Centre, fixtures and H2H shipped (PR #124). Reopen on regression. |
| `OPS-001` | Environment rollback crosses database boundaries | **Resolved** | Preserve isolation. |

## High

| ID | Finding | Current status | Evidence / required closure |
| --- | --- | --- | --- |
| `DATA-003` | Same-tournament/reference constraints incomplete | **Resolved and hosted** | Six private guards, privilege revocations and valid/invalid hosted verification passed in both hosted environments. |
| `DATA-006` | Wider fixture/source relationships insufficiently constrained | **No proven residual defect** | Do not retain as a broad duplicate. |
| `FUNC-002` | Valid entries are not automatically submitted at lock | **Resolved in development** | Database-scheduled automatic submission with immutable outcomes shipped (PR #128, contract 41) with lock-boundary pgTAP and browser journeys. Reopen on regression; production carries it only at a later milestone. |
| `DATA-004` | Actual tie resolution can use non-authoritative fallback | **Reduced** | Authorised exact-set third-place boundary resolution with required reasons, immutable revisions and fingerprint invalidation shipped (PR #126). Verifying decisions against official regulations/data remains a launch item. |
| `DATA-005` | Score clearing lacks complete final-target browser proof | **Backend implemented; final-target evidence pending** | Controlled clear/reload/conflict/lock verification. |
| `OPS-002` | Administrator control room is not yet complete | **Resolved in development** | Result confirm/correct/clear forms, review step, revision history and authorised/unauthorised desktop/mobile Browser E2E shipped (PR #120); qualification-boundary controls followed (PR #126). Reopen on regression. |
| `TEST-001` | Critical rules lack complete end-to-end evidence | **Reduced** | Admin result/qualification journeys, authoritative knockout consumption and automatic-submission outcomes are browser-proven (PRs #120–#128). Final-target controlled mutations, representative scale journeys and manual screen-reader review remain. |
| `OPS-003` | Production observability operations incomplete | **Partial; delivery verified** | Record actual retention, server-side/IP scrubbing, backup alert recipient/escalation, durable milestone-smoke evidence and rollback promotion rehearsal. |

## Medium

| ID | Finding | Current status |
| --- | --- | --- |
| `AUTH-001` | Turnstile/CAPTCHA contexts not fully verified | **Open** |
| `OPS-008` | Legacy public development site remains | **Open — separate workstream; never use as current preview** |
| `REL-007` | Stale device can delete a newer bracket pick | **Implementation present; final-target browser evidence pending** |
| `DB-001` | `public.enforce_joker_rules` has mutable search path | **Open advisor finding** |
| `DB-002` | Authenticated `SECURITY DEFINER` allowlist needs continued review | **Open assurance finding; many grants are intentional application RPCs** |
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
- The verified contract-38 application/database pair is the production baseline; development runs ahead under the controlled divergence recorded in `current-status.md`.
- A guard blocking incompatible deployment is a working safeguard, not a defect to bypass.
- Sentry delivery is already active; do not describe it as disabled merely because policy/ownership items remain.
- Advisor warnings require context; do not remove indexes or revoke intended RPC access without evidence.
- Historical audits remain immutable.
