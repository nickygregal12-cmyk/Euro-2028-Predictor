# Euro 2028 Predictor — Current Risk Register

**Status date:** 29 July 2026  
**Live status authority:** [`current-status.md`](current-status.md)  
**Latest production application baseline:** contract 60, verified Bonus Games release deploy `6a69c4178767280008845b27` from `0fe61a84bc43a7894b0de5b4bc923e188f043c14`  
**Development candidate:** PR #193, contract 62, development Supabase and non-production Netlify aligned.  
**Recovery:** fresh encrypted production backup, disposable restore and contract-60 backup verifier passed.

Current code, executable tests and verified hosted evidence override older classifications. Production is the controlled final target, not an active tournament service. The development-62/production-60 split is intentional and must remain recorded until promotion.

## Current contract movement

| ID | Current position |
| --- | --- |
| `OPS-006` | **Controlled split, not accidental divergence.** Development and non-production contexts are at 62 for PR #193; production remains aligned and locked at 60. |
| `POSTLOCK-001` | **Resolved in development by PR #193.** Bounded post-lock consensus and the richer locked My Entry state are implemented; production promotion remains pending approval. |
| `LEAGUE-001` | **Resolved in development by PR #193.** Final overall/private standings apply the approved five tie-breakers only after every result; production promotion remains pending approval. |
| `PRIV-001` | **Open on PR #193.** Contract 61 is tournament-wide and returns substantive raw-count aggregates from one submitted entry. Owner threshold decision is recorded on PR #193; no threshold implementation exists. |
| `REL-008` | **Open — reproduced.** PRs #194 and #195 both failed Netlify deploy-preview checks, while the preceding ten merged PRs passed. Exact Netlify logs are required to isolate the cause. |
| `MIG-001` | **Resolved by PR #196.** The pull-request guard fetches `origin/main`, checks every added migration against main's highest timestamp, enforces strict internal ordering and passes when no migrations are added. Exact-head CI `30464238649` passed the live guard, four focused tests, build, lint, full Vitest suite and dependency audit. |
| `DATA-003` | **Resolved and hosted.** Same-tournament/reference guards are present in both hosted environments. |
| `DOC-001` | **Resolved and actively maintained.** The contract-62 development split is recorded here and in `current-status.md`. |
| `FUNC-003` | **Resolved in production.** Canonical Bonus Game cards and the repeatable catalogue prevent silent disappearance. |
| `TEST-GAP-01` | **Resolved by PR #187.** All three Bonus Games have authenticated desktop/phone browser lifecycle proof. |
| `TEST-GAP-02` | **Resolved by PR #189.** H2H rank-history capture has direct behavioural pgTAP. |
| `RESULT-AUDIT-01` | **Resolved by PR #191.** Confirm/correct/clear revision content is asserted exactly. |
| `TEST-001` | **Reduced.** Candidate-62 consensus/final standings now have unit, pgTAP, desktop/phone and axe coverage; manual accessibility and later full-volume/rollback rehearsals remain. |

## Critical

| ID | Finding | Current status | Required closure |
| --- | --- | --- | --- |
| `OPS-006` | Uncontrolled production contract divergence | **Resolved for production; controlled development split active** | Do not promote or deploy contract 62 to production without backup, approval and exact verification. |
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
| `FUNC-002` | Valid entries are not automatically submitted at lock | **Resolved and production-hosted** | Scheduled submission with immutable owner outcomes is aligned at contract 60. |
| `DATA-004` | Actual tie resolution can use non-authoritative fallback | **Reduced** | Authorised exact-set resolution exists; official regulations/data verification remains a launch item. |
| `DATA-005` | Score/entry clearing lacks race-safe authority | **Resolved and production-hosted** | Contract 58 prevents stale autosave resurrection. |
| `OPS-002` | Administrator control room incomplete | **Resolved** | Result and qualification controls are browser-proven. |
| `POSTLOCK-001` | Locked entries lacked a crowd/trends experience | **Resolved in development** | Contract 61 exposes bounded submitted-entry aggregates and caller-only uniqueness; production promotion remains. |
| `LEAGUE-001` | Final standings did not apply the documented tie-break order | **Resolved in development** | Contract 62 activates the five-step order after all results and preserves live points-only ranks. |
| `TEST-001` | Critical rules lack complete end-to-end evidence | **Reduced** | Core, Bonus Games, H2H, result revisions, consensus and final standings are automated. Remaining: manual assistive-technology review, full-volume dress rehearsal and rollback rehearsal. |
| `OPS-003` | Production observability operations incomplete | **Partial** | Name monitoring/backup/Cron owners, retention/escalation and incident procedure. |

## Medium

| ID | Finding | Current status |
| --- | --- | --- |
| `AUTH-001` | Turnstile/CAPTCHA contexts not fully verified | **Open** |
| `AUTH-002` | Leaked-password protection disabled | **Open decision** |
| `OPS-008` | Legacy public development site remains | **Open — separate workstream; never use as current preview** |
| `REL-007` | Stale device can delete a newer bracket pick | **Implementation present; final controlled browser evidence pending** |
| `REL-008` | Netlify deploy-preview policy is inconsistent across documentation branches | **Open — reproduced on `chore/*` PRs #194/#195; six recent `agent/*` documentation PRs passed. Review the exact logs linked in [`REL-008 investigation`](investigations/2026-07-29-rel-008-deploy-preview-reliability.md).** |
| `MIG-001` | Concurrent branches can add stale/colliding migration timestamps | **Resolved by [PR #196](https://github.com/nickygregal12-cmyk/Euro-2028-Predictor/pull/196). Implementation: [`check-migration-timestamps.mjs`](../../scripts/check-migration-timestamps.mjs), including fresh `origin/main` fetch and strict per-file/order checks. Validation: [`migrationTimestampGuard.test.ts`](../../tests/scripts/migrationTimestampGuard.test.ts) proves no-addition, collision, multiple-valid and duplicate-order cases; exact-head CI [30464238649](https://github.com/nickygregal12-cmyk/Euro-2028-Predictor/actions/runs/30464238649) passed.** |
| `PRIV-001` | Tournament-wide prediction consensus has no minimum cohort | **Open on PR #193. One submitted entry can produce aggregate output; threshold options and hosted migration state are recorded in [`PRIV-001 options`](investigations/2026-07-29-priv-001-options.md).** |
| `DB-001` | `public.enforce_joker_rules` has mutable search path | **Open advisor finding** |
| `DB-002` | Authenticated `SECURITY DEFINER` allowlist needs continued review | **Open assurance finding; intended RPCs remain explicitly granted** |
| `DB-003` | Several foreign keys lack supporting indexes | **Open pending representative query evidence** |
| `PERF-001` | League summaries may scale serially | **Open** |
| `PERF-002` | Scoring recomputes whole tournament | **Open pending complete-volume measurement** |
| `TYPE-001` | Hand-written types/casts can hide schema drift | **Open** |
| `A11Y-001` | Assistive-technology review incomplete | **Partial; Trends added to automated axe and phone overflow coverage, manual review remains** |
| `UX-001` | Trustworthy invite context before auth incomplete | **Partial; proposed next batch** |
| `UX-002` | Unavailable and empty data can be conflated | **Reduced; Trends has locked/loading/error/empty states, secondary comparison/transfer/invite surfaces remain** |
| `FUNC-003` | Bonus Games rendered as absent when reference data was empty | **Resolved in production** |
| `TEST-GAP-02` | H2H rank-history capture lacked behavioural coverage | **Resolved by PR #189** |
| `RESULT-AUDIT-01` | Result revision content lacked direct assertions | **Resolved by PR #191** |
| `SEC-001` | Invite/aggregate disclosure needs abuse review | **Open; pair with pre-auth invite work** |
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

- Repository implementation, development-hosted verification and production verification are separate closure states.
- A recorded development/production split is allowed; an unrecorded or incompatible production deploy is not.
- Do not call the whole product launch-ready because a candidate batch is green.
- Do not retain broad findings after the concrete defect is resolved.
- Contract 60 remains the current production baseline until explicit promotion.
- A guard blocking incompatible deployment is a safeguard, not a defect to bypass.
- Advisor warnings require context; do not remove indexes or revoke intended RPC access without evidence.
- Historical audits and reconciliations remain immutable.
