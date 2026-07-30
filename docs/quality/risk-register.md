# Euro 2028 Predictor — Current Risk Register

**Status date:** 30 July 2026  
**Live status authority:** [`current-status.md`](current-status.md)  
**Current baseline:** repository, development Supabase, production Supabase and every Netlify context at contract 63  
**Current published application:** Netlify deploy `6a6a53af58a0a500096b7cb1`, ready from `ff633396e04eca77ed4456c5537ab361d9d259ee`  
**Recovery:** same-day encrypted production backup/restore evidence plus exact 60→63 preflight and preserved-data postflight.

Current code, executable tests and verified hosted evidence override older classifications. Production remains a controlled future-tournament target rather than an active Euro 2028 service.

## Correction record — 30 July 2026

`DOC-001` was reopened when direct review found stale contract, Bonus Games Browser E2E, fixed test-count and roadmap-authority claims across live planning documents. This documentation branch records the corrections rather than silently deleting the old assertions. Closure below is conditional on this correction branch landing with green markdown and CI evidence.

## Current contract movement

| ID | Current position |
| --- | --- |
| `OPS-006` | **Resolved.** Repository, both databases, all Netlify declarations and the published application are aligned at 63. |
| `POSTLOCK-001` | **Resolved and production-hosted.** Bounded post-lock consensus and the richer locked My Entry/Trends experience are published. |
| `LEAGUE-001` | **Resolved and production-hosted.** Final overall/private standings apply the approved five tie-breakers only after every result. |
| `PRIV-001` | **Resolved and production-hosted.** Tournament-wide consensus is suppressed below ten submitted entries; the caller counts and browser roles cannot execute the unsuppressed helper. |
| `REL-008` | **Reduced to historical evidence.** PRs #194/#195 showed inconsistent documentation-branch previews, but exact PR #193 contract-63 preview publication, HTTP smoke and Chromium smoke passed. |
| `MIG-001` | **Resolved.** Pull-request CI fetches `origin/main`, rejects stale/colliding added migrations, enforces strict ordering and passes when no migration is added. |
| `CI-001` | **Resolved by the domain-root filter.** Database parity previously watched only `src/domain/tournament/**`, so PR #201's new `src/domain/competition/**` engine silently skipped the control. The workflow now watches `src/domain/**`; closure requires the workflow to run successfully on the fixing pull request. |
| `DATA-003` | **Resolved and hosted.** Same-tournament/reference guards are present in both hosted environments. |
| `DOC-001` | **Reopened and corrected on this branch.** Live documents had restated stale evidence and conflicting sequence. The ADR, programme, engineering plan and roadmap now carry explicit corrections and authoritative links; close only when this branch's CI passes and the change lands. |
| `FUNC-003` | **Resolved in production.** Canonical Bonus Game cards and the repeatable catalogue prevent silent disappearance. |
| `TEST-GAP-01` | **Resolved by PR #187.** All three Bonus Games have authenticated desktop/phone browser lifecycle proof. Exact recorded evidence: CI `30442005168` and Browser E2E `30442002202`. |
| `TEST-GAP-02` | **Resolved by PR #189.** H2H rank-history capture has direct behavioural pgTAP. |
| `RESULT-AUDIT-01` | **Resolved by PR #191.** Confirm/correct/clear revision content is asserted exactly. |
| `TEST-001` | **Reduced.** Contract-63 consensus/privacy/final standings have unit, pgTAP, desktop/phone and axe coverage; manual accessibility and later full-volume/rollback rehearsals remain. |

## Critical

| ID | Finding | Current status | Required closure |
| --- | --- | --- | --- |
| `OPS-006` | Uncontrolled production contract divergence | **Resolved** | Reopen on any unrecorded repository/database/application contract split. |
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
| `POSTLOCK-001` | Locked entries lacked a crowd/trends experience | **Resolved and production-hosted** | Contracts 61 and 63 provide bounded post-lock aggregates with cohort suppression. |
| `LEAGUE-001` | Final standings did not apply the documented tie-break order | **Resolved and production-hosted** | Contract 62 activates the five-step order after all results and preserves live points-only ranks. |
| `CI-001` | Database parity path filtering excluded new domain siblings while appearing to cover domain changes | **Resolved in workflow configuration; run evidence required** | Root cause was a hard-coded `src/domain/tournament/**` filter. The fix is `src/domain/**`, which also covers future `competition/` and `season/` modules. Verify the parity job runs and passes on this PR. |
| `TEST-001` | Critical rules lack complete end-to-end evidence | **Reduced** | Remaining: manual assistive-technology review, full-volume dress rehearsal and rollback rehearsal. Existing Bonus Games desktop/phone lifecycle proof must not be relisted as absent. |
| `OPS-003` | Production observability operations incomplete | **Partial** | Name monitoring/backup/Cron owners, retention/escalation and incident procedure. |

## Medium

| ID | Finding | Current status |
| --- | --- | --- |
| `AUTH-001` | Turnstile/CAPTCHA contexts not fully verified | **Open** |
| `AUTH-002` | Leaked-password protection disabled | **Open decision** |
| `OPS-008` | Legacy public development site remains | **Open — separate workstream; never use as current preview** |
| `REL-007` | Stale device can delete a newer bracket pick | **Implementation present; final controlled browser evidence pending** |
| `REL-008` | Netlify deploy-preview policy was inconsistent across documentation branches | **Reduced; final contract-63 preview passed in Browser E2E `30473546011`. Historical #194/#195 evidence remains in the [`REL-008 investigation`](investigations/2026-07-29-rel-008-deploy-preview-reliability.md).** |
| `MIG-001` | Concurrent branches can add stale/colliding migration timestamps | **Resolved by the committed guard and focused tests.** |
| `PRIV-001` | Tournament-wide prediction consensus had no minimum cohort | **Resolved and production-hosted by [`20260729154931_prediction_consensus_minimum_cohort.sql`](../../supabase/migrations/20260729154931_prediction_consensus_minimum_cohort.sql).** |
| `DB-001` | `public.enforce_joker_rules` has mutable search path | **Open advisor finding** |
| `DB-002` | Authenticated `SECURITY DEFINER` allowlist needs continued review | **Open assurance finding; intended RPCs remain explicitly granted** |
| `DB-003` | Several foreign keys lack supporting indexes | **Open pending representative query evidence** |
| `PERF-001` | League summaries may scale serially | **Open** |
| `PERF-002` | Scoring recomputes whole tournament | **Open pending complete-volume measurement** |
| `TYPE-001` | Hand-written types/casts can hide schema drift | **Open** |
| `A11Y-001` | Assistive-technology review incomplete | **Partial; Trends has automated axe and phone overflow coverage, manual review remains** |
| `UX-001` | Trustworthy invite context before auth incomplete | **Partial; proposed next batch** |
| `UX-002` | Unavailable and empty data can be conflated | **Reduced; Trends has locked/loading/error/suppressed/populated states, secondary surfaces remain** |
| `FUNC-003` | Bonus Games rendered as absent when reference data was empty | **Resolved in production** |
| `SEC-001` | Invite/aggregate disclosure needs abuse review | **Open; aggregate minimum cohort is implemented, broader invite/abuse review remains** |
| `DATA-007` | Rate limiting is count-then-insert | **Open** |
| `DOC-001` | Documentation authority can drift | **Correction in progress on this branch. Reopen condition was met; close only after explicit corrections and link/CI evidence land.** |

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
- Do not call the whole product launch-ready because the baseline is tag-ready.
- Do not retain broad findings after the concrete defect is resolved.
- Contract 63 is the current repository, database, environment and application baseline.
- A guard blocking incompatible deployment is a safeguard, not a defect to bypass.
- Historical audits and reconciliations remain immutable; corrections are recorded alongside them rather than rewriting history.
