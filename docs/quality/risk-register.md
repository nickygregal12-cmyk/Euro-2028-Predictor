# Euro 2028 Predictor — Current Risk Register

**Status date:** 29 July 2026  
**Live status authority:** [`current-status.md`](current-status.md)  
**Current database baseline:** contract 63 in repository candidate, development Supabase and production Supabase  
**Current published application:** contract-60 Bonus Games release until PR #193 is merged and the exact contract-63 production deployment is verified  
**Recovery:** same-day encrypted production backup/restore evidence plus exact 60→63 preflight and preserved-data postflight.

Current code, executable tests and verified hosted evidence override older classifications. Production remains a controlled future-tournament target rather than an active Euro 2028 service.

## Current contract movement

| ID | Current position |
| --- | --- |
| `OPS-006` | **Database and environment contracts aligned at 63.** Development and production Supabase each contain 63 canonical migrations; all Netlify contexts declare 63 with environment-specific Supabase URLs preserved. Exact application release remains pending. |
| `POSTLOCK-001` | **Resolved and database-hosted.** Bounded post-lock consensus and the richer locked My Entry state are implemented; exact production application publication remains. |
| `LEAGUE-001` | **Resolved and database-hosted.** Final overall/private standings apply the approved five tie-breakers only after every result; exact production application publication remains. |
| `PRIV-001` | **Resolved and production-hosted by contract 63.** Tournament-wide consensus is suppressed below ten submitted entries; the caller counts, suppression is an explicit success state and browser roles cannot execute the unsuppressed helper. |
| `REL-008` | **Reduced.** The earlier documentation-branch preview inconsistency remains historical evidence, while PR #193 now has a correctly aligned contract-63 preview context. Final exact preview smoke remains the closure gate. |
| `MIG-001` | **Resolved.** Pull-request CI fetches `origin/main`, rejects stale/colliding added migrations, enforces strict ordering and passes when no migration is added. |
| `DATA-003` | **Resolved and hosted.** Same-tournament/reference guards are present in both hosted environments. |
| `DOC-001` | **Resolved and actively maintained.** Contract-63 alignment and the remaining application-release gap are recorded here and in `current-status.md`. |
| `FUNC-003` | **Resolved in production.** Canonical Bonus Game cards and the repeatable catalogue prevent silent disappearance. |
| `TEST-GAP-01` | **Resolved by PR #187.** All three Bonus Games have authenticated desktop/phone browser lifecycle proof. |
| `TEST-GAP-02` | **Resolved by PR #189.** H2H rank-history capture has direct behavioural pgTAP. |
| `RESULT-AUDIT-01` | **Resolved by PR #191.** Confirm/correct/clear revision content is asserted exactly. |
| `TEST-001` | **Reduced.** Contract-63 consensus/privacy/final standings have unit, pgTAP, desktop/phone and axe coverage; manual accessibility and later full-volume/rollback rehearsals remain. |

## Critical

| ID | Finding | Current status | Required closure |
| --- | --- | --- | --- |
| `OPS-006` | Uncontrolled production contract divergence | **Resolved; exact application release pending** | Keep every context at 63, verify exact preview, merge PR #193 and verify the production deploy before tagging. |
| `DATA-001` | Predicted group positions can be forged or drift | **Resolved** | Reopen on regression. |
| `SECURITY-001` | Browser roles can write server-owned position inputs | **Resolved** | Reopen on regression. |
| `SECURITY-002` | Submission boundary can be bypassed | **Resolved** | Reopen on regression. |
| `DATA-002` | Knockout winner/method lacks database authority | **Resolved** | Reopen on regression. |
| `OPS-001` | Environment rollback crosses database boundaries | **Resolved** | Preserve environment isolation and contract guards. |

## High

| ID | Finding | Current status | Evidence / required closure |
| --- | --- | --- | --- |
| `DATA-003` | Same-tournament/reference constraints incomplete | **Resolved and hosted** | Private guards, privileges and valid/invalid hosted verification passed. |
| `DATA-006` | Wider fixture/source relationships insufficiently constrained | **No proven residual defect** | Reopen only with an exact uncovered relationship. |
| `FUNC-002` | Valid entries are not automatically submitted at lock | **Resolved and production-hosted** | Scheduled submission with immutable owner outcomes remains aligned. |
| `DATA-004` | Actual tie resolution can use non-authoritative fallback | **Reduced** | Authorised exact-set resolution exists; official regulations/data verification remains a launch item. |
| `DATA-005` | Score/entry clearing lacks race-safe authority | **Resolved and production-hosted** | Contract 58 prevents stale autosave resurrection. |
| `OPS-002` | Administrator control room incomplete | **Resolved** | Result and qualification controls are browser-proven. |
| `POSTLOCK-001` | Locked entries lacked a crowd/trends experience | **Resolved and production database-hosted** | Contract 61 exposes bounded aggregates and contract 63 suppresses output below ten entries; verify exact production application release. |
| `LEAGUE-001` | Final standings did not apply the documented tie-break order | **Resolved and production database-hosted** | Contract 62 activates the five-step order after all results and preserves live points-only ranks; verify exact production application release. |
| `TEST-001` | Critical rules lack complete end-to-end evidence | **Reduced** | Core, Bonus Games, H2H, result revisions, consensus privacy and final standings are automated. Remaining: manual assistive-technology review, full-volume dress rehearsal and rollback rehearsal. |
| `OPS-003` | Production observability operations incomplete | **Partial** | Name monitoring/backup/Cron owners, retention/escalation and incident procedure. |

## Medium

| ID | Finding | Current status |
| --- | --- | --- |
| `AUTH-001` | Turnstile/CAPTCHA contexts not fully verified | **Open** |
| `AUTH-002` | Leaked-password protection disabled | **Open decision** |
| `OPS-008` | Legacy public development site remains | **Open — separate workstream; never use as current preview** |
| `REL-007` | Stale device can delete a newer bracket pick | **Implementation present; final controlled browser evidence pending** |
| `REL-008` | Netlify deploy-preview policy was inconsistent across documentation branches | **Reduced; previous #194/#195 failures remain documented in the [`REL-008 investigation`](investigations/2026-07-29-rel-008-deploy-preview-reliability.md). Close after exact PR #193 preview smoke passes at contract 63.** |
| `MIG-001` | Concurrent branches can add stale/colliding migration timestamps | **Resolved by [PR #196](https://github.com/nickygregal12-cmyk/Euro-2028-Predictor/pull/196). Implementation: [`check-migration-timestamps.mjs`](../../scripts/check-migration-timestamps.mjs); focused tests prove no-addition, collision, multiple-valid and duplicate-order cases.** |
| `PRIV-001` | Tournament-wide prediction consensus had no minimum cohort | **Resolved and production-hosted by [`20260729154931_prediction_consensus_minimum_cohort.sql`](../../supabase/migrations/20260729154931_prediction_consensus_minimum_cohort.sql). Threshold ten includes the caller; suppression is a successful state; both hosted databases and privileges are verified.** |
| `DB-001` | `public.enforce_joker_rules` has mutable search path | **Open advisor finding** |
| `DB-002` | Authenticated `SECURITY DEFINER` allowlist needs continued review | **Open assurance finding; intended RPCs remain explicitly granted** |
| `DB-003` | Several foreign keys lack supporting indexes | **Open pending representative query evidence** |
| `PERF-001` | League summaries may scale serially | **Open** |
| `PERF-002` | Scoring recomputes whole tournament | **Open pending complete-volume measurement** |
| `TYPE-001` | Hand-written types/casts can hide schema drift | **Open** |
| `A11Y-001` | Assistive-technology review incomplete | **Partial; Trends has automated axe and phone overflow coverage, manual review remains** |
| `UX-001` | Trustworthy invite context before auth incomplete | **Partial; proposed next batch** |
| `UX-002` | Unavailable and empty data can be conflated | **Reduced; Trends has locked/loading/error/suppressed/populated states, secondary comparison/transfer/invite surfaces remain** |
| `FUNC-003` | Bonus Games rendered as absent when reference data was empty | **Resolved in production** |
| `TEST-GAP-02` | H2H rank-history capture lacked behavioural coverage | **Resolved by PR #189** |
| `RESULT-AUDIT-01` | Result revision content lacked direct assertions | **Resolved by PR #191** |
| `SEC-001` | Invite/aggregate disclosure needs abuse review | **Open; aggregate minimum cohort is implemented, broader invite/abuse review remains** |
| `DATA-007` | Rate limiting is count-then-insert | **Open** |
| `DOC-001` | Documentation authority can drift | **Resolved; reopen on contradiction** |

## Low

| ID | Finding | Status |
| --- | --- | --- |
| `HYGIENE-002` | Some pure modules may be test/reference-only | **Open; verify before deletion** |
| `CODE-001` | Large orchestration files are hotspots | **Open** |
| `SEO-001` | SPA fallback produces soft 404s | **Open** |
| `SEO-002` | Metadata largely global | **Open** |
| `UX-003` | Other-player profile action incomplete | **Resolved; secure co-member profile and H2H navigation are production-hosted** |
| `DATA-008` | Scores have no practical database maximum | **Open** |
| `DOC-002` | Package version remains `0.0.0` | **Open** |
| `DOC-003` | Component gallery large/partly historical | **Open; development-only** |
| `REPO-001` | Licence/changelog policy absent | **Partial** |

## Register rules

- Repository implementation, database promotion and application publication are separate closure states.
- Do not call the baseline tag-ready until the exact production application deploy is verified.
- Do not call the whole product launch-ready because a candidate batch is green.
- Do not retain broad findings after the concrete defect is resolved.
- Contract 63 is the current database and environment baseline.
- A guard blocking incompatible deployment is a safeguard, not a defect to bypass.
- Advisor warnings require context; do not remove indexes or revoke intended RPC access without evidence.
- Historical audits and reconciliations remain immutable.
