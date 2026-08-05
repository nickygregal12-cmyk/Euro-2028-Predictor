# Euro 2028 Predictor — Current Risk Register

**Status date:** 30 July 2026  
**Live status authority:** [`current-status.md`](current-status.md)  
**Current baseline:** stated in [`current-status.md`](current-status.md), not here — repository contract, hosted contracts and the deploy-gate position all live there. Production deploys are intentionally paused by the contract gate. This line used to restate those numbers and drifted ten contracts behind while doing it  
**Current published application:** last good Netlify production deploy recorded in [`current-status.md`](current-status.md)  
**Recovery:** same-day encrypted production backup/restore evidence plus exact 60→63 preflight and preserved-data postflight.

Current code, executable tests and verified hosted evidence override older classifications. Production remains a controlled future-tournament target rather than an active Euro 2028 service.

## Correction record — 30 July 2026

`DOC-001` was reopened when direct review found stale contract, PR-state and roadmap claims across live planning documents. The current-status, roadmap and this register now record the contract-64/63 split, the complete seven-contract Stage C inventory and the owner-approved C1/C2 governance boundary. Closure is conditional on the governance PR landing with green documentation and CI evidence.

## Current contract movement

| ID | Current position |
| --- | --- |
| `OPS-006` | **Controlled, not resolved by alignment.** Repository/development are 64 while production remains 63. The production contract gate correctly pauses new deploys and keeps the last good application live. Reopen as Critical only if the guard is bypassed or the split becomes unrecorded. |
| `POSTLOCK-001` | **Resolved and production-hosted.** Bounded post-lock consensus and the richer locked My Entry/Trends experience are published. |
| `LEAGUE-001` | **Resolved and production-hosted.** Final overall/private standings apply the approved five tie-breakers only after every result. |
| `PRIV-001` | **Resolved and production-hosted.** Tournament-wide consensus is suppressed below ten submitted entries. |
| `REL-008` | **Reduced to historical evidence.** Exact contract-63 preview publication, HTTP smoke and Chromium smoke passed. |
| `MIG-001` | **Resolved.** Pull-request CI rejects stale/colliding added migrations and enforces strict ordering. |
| `CI-001` | **Resolved.** Database parity watches `src/domain/**` and runs the complete parity directory. |
| `DATA-003` | **Resolved and hosted.** Same-tournament/reference guards are present in both hosted environments. |
| `DOC-001` | **Correction pending merge.** Live authorities have been reconciled on the Stage C governance branch; close when CI passes and it lands. |
| `FUNC-003` | **Resolved in production.** Canonical Bonus Game cards and the repeatable catalogue prevent silent disappearance. |
| `TEST-GAP-01` | **Resolved by PR #187.** All three Bonus Games have authenticated desktop/phone browser lifecycle proof. |
| `TEST-GAP-02` | **Resolved by PR #189.** H2H rank-history capture has direct behavioural pgTAP. |
| `RESULT-AUDIT-01` | **Resolved by PR #191.** Confirm/correct/clear revision content is asserted exactly. |
| `TEST-001` | **Reduced.** Manual accessibility and later full-volume/rollback rehearsals remain. |

## Critical

| ID | Finding | Current status | Required closure |
| --- | --- | --- | --- |
| `OPS-006` | Uncontrolled production contract divergence | **Controlled by fail-closed deployment gate** | Keep production at 63 and paused until an intentional migration/release milestone; never bypass the guard merely to align numbers. |
| `DATA-001` | Predicted group positions can be forged or drift | **Resolved** | Reopen on regression. |
| `SECURITY-001` | Browser roles can write server-owned position inputs | **Resolved** | Reopen on regression. |
| `SECURITY-002` | Submission boundary can be bypassed | **Resolved** | Reopen on regression. |
| `DATA-002` | Knockout winner/method lacks database authority | **Resolved** | Reopen on regression. |
| `OPS-001` | Environment rollback crosses database boundaries | **Resolved** | Preserve environment isolation and contract guards. |

## High

| ID | Finding | Current status | Evidence / required closure |
| --- | --- | --- | --- |
| `PRIV-002` | Former-player retention, erasure and pseudonymisation boundary is not independently approved | **Open; Stage C2 blocked by issue #272** | No profile ownership, account-erasure, pseudonymisation or related RLS implementation until the recorded independent review approves the boundary and required safeguards. Stage C1 must preserve current auth ownership. |
| `DATA-003` | Same-tournament/reference constraints incomplete | **Resolved and hosted** | Private guards, privileges and valid/invalid hosted verification passed. |
| `DATA-006` | Wider fixture/source relationships insufficiently constrained | **No proven residual defect** | Reopen only with an exact uncovered relationship. |
| `FUNC-002` | Valid entries are not automatically submitted at lock | **Resolved and production-hosted** | Preserve scheduled submission and immutable outcomes. |
| `DATA-004` | Actual tie resolution can use non-authoritative fallback | **Reduced** | Official regulations/data verification remains a launch item. |
| `DATA-005` | Score/entry clearing lacks race-safe authority | **Resolved and production-hosted** | Contract 58 prevents stale autosave resurrection. |
| `OPS-002` | Administrator control room incomplete | **Resolved** | Result and qualification controls are browser-proven. |
| `POSTLOCK-001` | Locked entries lacked a crowd/trends experience | **Resolved and production-hosted** | Contracts 61 and 63 provide bounded aggregates with cohort suppression. |
| `LEAGUE-001` | Final standings did not apply the documented tie-break order | **Resolved and production-hosted** | Contract 62 activates the five-step order after all results. |
| `CI-001` | Database parity excluded new domain siblings | **Resolved** | Preserve the root `src/domain/**` trigger and complete parity directory. |
| `TEST-001` | Critical rules lack complete end-to-end evidence | **Reduced** | Remaining: manual assistive-technology review, full-volume dress rehearsal and rollback rehearsal. |
| `OPS-003` | Production observability operations incomplete | **Partial** | Name monitoring/backup/Cron owners, retention/escalation and incident procedure. |

## Medium

| ID | Finding | Current status |
| --- | --- | --- |
| `AUTH-001` | Turnstile/CAPTCHA contexts not fully verified | **Partial.** Netlify non-production contexts use the Cloudflare always-pass test site key and production retains its real key. Matching development Supabase secret/toggle and preview sign-up/login/recovery evidence remain open in issue #28. |
| `AUTH-002` | Leaked-password protection disabled | **Open decision** |
| `OPS-008` | Legacy public development site remains | **Reduced.** Anonymous public access was removed and Netlify team SSO is required. The hourly legacy function and missing/inaccessible Supabase ref remain open in issue #27. |
| `REL-007` | Stale device can delete a newer bracket pick | **Implementation present; final controlled browser evidence pending** |
| `REL-008` | Netlify deploy-preview policy was inconsistent across documentation branches | **Reduced; final contract-63 preview passed.** |
| `MIG-001` | Concurrent branches can add stale/colliding migration timestamps | **Resolved by the committed guard and focused tests.** |
| `PRIV-001` | Tournament-wide prediction consensus had no minimum cohort | **Resolved and production-hosted.** |
| `DB-001` | `public.enforce_joker_rules` has mutable search path | **Open advisor finding** |
| `DB-002` | Authenticated `SECURITY DEFINER` allowlist needs continued review | **Open assurance finding; intended RPCs remain explicitly granted** |
| `DB-003` | Several foreign keys lack supporting indexes | **Open pending representative query evidence** |
| `PERF-001` | League summaries may scale serially | **Open** |
| `PERF-002` | Scoring recomputes whole tournament | **Open pending complete-volume measurement** |
| `TYPE-001` | Hand-written types/casts can hide schema drift | **Open** |
| `A11Y-001` | Assistive-technology review incomplete | **Partial; automated coverage exists, manual review remains** |
| `UX-001` | Trustworthy invite context before auth incomplete | **Partial** |
| `UX-002` | Unavailable and empty data can be conflated | **Reduced; secondary surfaces remain** |
| `FUNC-003` | Bonus Games rendered as absent when reference data was empty | **Resolved in production** |
| `SEC-001` | Invite/aggregate disclosure needs abuse review | **Open; aggregate minimum cohort is implemented, broader invite/abuse review remains** |
| `DATA-007` | Rate limiting is count-then-insert | **Open** |
| `DATA-009` | Contract 104 gated the tournament-path Bonus Games recompute functions (`recompute_ko_predictor_for_match`, `recompute_lms_for_tournament`) on `completed_at is null`, so a post-completion correction silently no-opped instead of rederiving — the opposite of what the season LMS settlement job deliberately does for the identical problem | **Resolved at contract 106.** Both functions now resolve through `predictor_internal.current_public_competition_id`, which falls back to the most recently completed public instance, so a corrected result rederives after a competition ends. Proven behaviourally rather than structurally by `supabase/tests/157_terminal_aware_bonus_rederive.sql`: a completed KO Predictor competition has its result corrected and both entrants' stored scores must move to zero. Verified on development — neither function retains a `live_competition_id` call. The risk was recorded as latent and unreachable when found; contract 107 would have made it reachable, which is why it was closed first. See `docs/quality/investigations/2026-08-05-tournament-bonus-recompute-completion-gate.md` for the original trace. |
| `DOC-001` | Documentation authority can drift | **Correction pending governance PR merge.** |

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
- Current contract truth is repository/development 64 and production/application 63; the recorded, fail-closed split is a controlled state.
- A guard blocking incompatible deployment is a safeguard, not a defect to bypass.
- Historical audits and reconciliations remain immutable; corrections are recorded alongside them rather than rewriting history.
