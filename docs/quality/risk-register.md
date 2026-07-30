# Euro 2028 Predictor — Current Risk Register

**Status date:** 29 July 2026  
**Live status authority:** [`current-status.md`](current-status.md)  
**Repository baseline:** tag `euro-2028-baseline` at `1fb8ffd36ad113079181829a8bcc47175c43b6da`, contract 63  
**Hosted baseline:** `REQUIRES OWNER VERIFICATION`

Current code, executable tests and repository history override older classifications. Hosted database and Netlify claims require dated owner evidence.

## Current contract movement

| ID | Current position |
| --- | --- |
| `OPS-006` | **Repository resolved; hosted state requires verification.** Tagged source is internally aligned at contract 63. |
| `POSTLOCK-001` | **Resolved in tagged source.** Bounded post-lock consensus and the richer locked My Entry/Trends experience are present. |
| `LEAGUE-001` | **Resolved in tagged source.** Final overall/private standings apply the approved five tie-breakers only after every result. |
| `PRIV-001` | **Resolved in tagged source for minimum cohort.** Contract 63 suppresses tournament-wide consensus below ten submitted entries; caller counts and browser roles cannot execute the unsuppressed helper. |
| `SEC-001` | **Open — Medium.** Eligible aggregate output remains tournament-wide rather than private-league scoped; explicit privacy-rule authority and abuse review remain required. |
| `REL-008` | **Historical/reduced.** Earlier documentation-branch preview inconsistency remains recorded; current hosted status requires owner verification. |
| `MIG-001` | **Resolved in repository source.** Pull-request CI rejects stale/colliding migration timestamps. |
| `DOC-001` | **Resolved by reconciliation.** The contract-60 assessment and later contract-63 tag are distinguished rather than silently conflated. |

## Critical

| ID | Finding | Current status | Required closure |
| --- | --- | --- | --- |
| `OPS-006` | Uncontrolled production contract divergence | **Repository aligned; hosted state unverified here** | Owner verifies development, production and Netlify contracts and records date/evidence. |
| `DATA-001` | Predicted group positions can be forged or drift | **Resolved** | Reopen on regression. |
| `SECURITY-001` | Browser roles can write server-owned position inputs | **Resolved in source** | Hosted privileges require owner verification. |
| `SECURITY-002` | Submission boundary can be bypassed | **Resolved in source** | Hosted privileges require owner verification. |
| `DATA-002` | Knockout winner/method lacks database authority | **Resolved** | Reopen on regression. |
| `OPS-001` | Environment rollback crosses database boundaries | **Resolved in controls** | Preserve environment isolation and contract guards. |

## High

| ID | Finding | Current status | Evidence / required closure |
| --- | --- | --- | --- |
| `DATA-003` | Same-tournament/reference constraints incomplete | **Resolved in source** | Hosted verification remains owner-only. |
| `DATA-006` | Wider fixture/source relationships insufficiently constrained | **No proven residual defect** | Reopen only with an exact uncovered relationship. |
| `FUNC-002` | Valid entries are not automatically submitted at lock | **Resolved in source** | Hosted schedule/status requires owner verification. |
| `DATA-004` | Actual tie resolution can use non-authoritative fallback | **Reduced** | Official regulations/data verification remains a launch item. |
| `DATA-005` | Score/entry clearing lacks race-safe authority | **Resolved in source** | Reopen on regression. |
| `OPS-002` | Administrator control room incomplete | **Resolved in source** | Hosted access remains owner verification. |
| `POSTLOCK-001` | Locked entries lacked a crowd/trends experience | **Resolved in tagged source** | Contract 61 supplies aggregate output and contract 63 gates cohorts below ten. |
| `LEAGUE-001` | Final standings did not apply the documented tie-break order | **Resolved in tagged source** | Contract 62 activates after all results and preserves live points-only ranks. |
| `TEST-001` | Critical rules lack complete end-to-end evidence | **Reduced** | Remaining: manual assistive-technology review, full-volume dress rehearsal and rollback rehearsal. |
| `OPS-003` | Production observability operations incomplete | **Partial** | Name monitoring/backup/Cron owners, retention/escalation and incident procedure. |

## Medium

| ID | Finding | Current status |
| --- | --- | --- |
| `AUTH-001` | Turnstile/CAPTCHA contexts not fully verified | **Open** |
| `AUTH-002` | Leaked-password protection disabled | **Open decision** |
| `OPS-008` | Legacy public development site remains | **Open — separate workstream** |
| `REL-007` | Stale device can delete a newer bracket pick | **Implementation present; final controlled browser evidence pending** |
| `REL-008` | Netlify deploy-preview policy was inconsistent across documentation branches | **Reduced; hosted current state requires owner verification.** |
| `MIG-001` | Concurrent branches can add stale/colliding migration timestamps | **Resolved by committed guard and focused tests.** |
| `PRIV-001` | Tournament-wide prediction consensus had no minimum cohort | **Resolved in tagged source by [`20260729154931_prediction_consensus_minimum_cohort.sql`](../../supabase/migrations/20260729154931_prediction_consensus_minimum_cohort.sql): threshold ten, caller included, successful suppression below ten. Hosted deployment requires owner verification.** |
| `SEC-001` | Aggregate disclosure lacks explicit scope authority | **Open — Medium. The public RPC accepts only a tournament ID and aggregates every submitted tournament entry. No private-league ID, join or membership check exists. Threshold ten reduces subtraction risk but does not license stranger-level tournament-wide disclosure. Decide whether tournament-wide aggregation is intended or narrow the scope before predictions open.** |
| `DB-001` | `public.enforce_joker_rules` has mutable search path | **Open advisor finding** |
| `DB-002` | Authenticated `SECURITY DEFINER` allowlist needs continued review | **Open assurance finding** |
| `DB-003` | Several foreign keys lack supporting indexes | **Open pending representative query evidence** |
| `PERF-001` | League summaries may scale serially | **Open** |
| `PERF-002` | Scoring recomputes whole tournament | **Open pending complete-volume measurement** |
| `TYPE-001` | Hand-written types/casts can hide schema drift | **Open** |
| `A11Y-001` | Assistive-technology review incomplete | **Partial; manual review remains** |
| `UX-001` | Trustworthy invite context before auth incomplete | **Partial** |
| `UX-002` | Unavailable and empty data can be conflated | **Reduced; secondary surfaces remain** |
| `FUNC-003` | Bonus Games rendered as absent when reference data was empty | **Resolved in source** |
| `DATA-007` | Rate limiting is count-then-insert | **Open** |
| `DOC-001` | Documentation authority can drift | **Resolved by tagged reconciliation; reopen on contradiction** |

## Low

| ID | Finding | Status |
| --- | --- | --- |
| `HYGIENE-002` | Some pure modules may be test/reference-only | **Open; verify before deletion** |
| `CODE-001` | Large orchestration files are hotspots | **Open** |
| `SEO-001` | SPA fallback produces soft 404s | **Open** |
| `SEO-002` | Metadata largely global | **Open** |
| `UX-003` | Other-player profile action incomplete | **Resolved in source** |
| `DATA-008` | Scores have no practical database maximum | **Open** |
| `DOC-002` | Package version remains `0.0.0` | **Open** |
| `DOC-003` | Component gallery large/partly historical | **Open; development-only** |
| `REPO-001` | Licence/changelog policy absent | **Partial** |

## Register rules

- Repository implementation, hosted deployment and application publication are separate closure states.
- Do not describe hosted state as verified without dated owner evidence.
- Closing a minimum-cohort defect does not silently close a separate scope-authority concern.
- Historical audits and reconciliations remain immutable; corrections sit alongside them.
