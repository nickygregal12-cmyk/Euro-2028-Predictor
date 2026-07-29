# Euro 2028 Predictor — Current Risk Register

**Status date:** 29 July 2026  
**Live status authority:** [`current-status.md`](current-status.md)  
**Latest production baseline:** contract 60, production deploy `6a69b630f65752000822324e` from `31e06271f5f5b753c0bacf20353097055880988e`  
**Recovery:** fresh encrypted backup, disposable restore and contract-60 backup verifier passed.

Current `main`, executable tests and verified hosted evidence override older classifications. Production is the controlled final target, not an active tournament service. Historical reconciliations remain immutable evidence and are not live status.

## Current contract movement

| ID | Current position |
| --- | --- |
| `DATA-003` | **Resolved and hosted.** Same-tournament/reference guards are present in both hosted environments. |
| `DATA-006` | **No concrete residual defect established.** Reopen only with an exact uncovered relationship. |
| `DOC-001` | **Resolved by contract-60 documentation audit.** README, live status, migration inventory, risk register and deployment notes are reconciled. |
| `OPS-006` | **Resolved and published.** Repository, both hosted databases, every Netlify context and production deploy are aligned at contract 60. |
| `TEST-001` | **Reduced.** Critical lifecycle, privacy, Account, Bonus Games and accessibility automation are covered; manual accessibility and later complete-volume rehearsal remain. |

## Critical

| ID | Finding | Current status | Required closure |
| --- | --- | --- | --- |
| `OPS-006` | Production contract divergence | **Resolved** | Reopen only if repository, hosted database or deployed contract diverges. |
| `DATA-001` | Predicted group positions can be forged or drift | **Resolved** | Reopen on regression. |
| `SECURITY-001` | Browser roles can write server-owned position inputs | **Resolved** | Reopen on regression. |
| `SECURITY-002` | Submission boundary can be bypassed | **Resolved** | Reopen on regression. |
| `DATA-002` | Knockout winner/method lacks database authority | **Resolved** | Reopen on regression. |
| `OPS-001` | Environment rollback crosses database boundaries | **Resolved** | Preserve environment isolation and contract guards. |

## High

| ID | Finding | Current status | Evidence / required closure |
| --- | --- | --- | --- |
| `DATA-003` | Same-tournament/reference constraints incomplete | **Resolved and hosted** | Private guards, privilege revocations and valid/invalid hosted verification passed. |
| `DATA-006` | Wider fixture/source relationships insufficiently constrained | **No proven residual defect** | Do not retain as a broad duplicate. |
| `FUNC-002` | Valid entries are not automatically submitted at lock | **Resolved and hosted** | Database-scheduled automatic submission with immutable owner outcomes is production-aligned. |
| `DATA-004` | Actual tie resolution can use non-authoritative fallback | **Reduced** | Authorised exact-set resolution is implemented; official regulations/data verification remains a launch item. |
| `DATA-005` | Score/entry clearing lacks race-safe authority | **Resolved and hosted** | Contract 58 retires cleared entry identity so stale autosaves cannot resurrect predictions. |
| `OPS-002` | Administrator control room incomplete | **Resolved** | Result and qualification controls are implemented and browser-proven. |
| `TEST-001` | Critical rules lack complete end-to-end evidence | **Reduced** | Core lifecycle is proven. Remaining closure: manual assistive-technology review, complete-volume dress rehearsal and controlled rollback rehearsal. |
| `OPS-003` | Production observability operations incomplete | **Partial** | Name monitoring/backup/Cron alert owners, retention/escalation and incident procedure. |

## Medium

| ID | Finding | Current status |
| --- | --- | --- |
| `AUTH-001` | Turnstile/CAPTCHA contexts not fully verified | **Open** |
| `AUTH-002` | Leaked-password protection disabled | **Open decision** |
| `OPS-008` | Legacy public development site remains | **Open — separate workstream; never use as current preview** |
| `REL-007` | Stale device can delete a newer bracket pick | **Implementation present; final controlled browser evidence pending** |
| `DB-001` | `public.enforce_joker_rules` has mutable search path | **Open advisor finding** |
| `DB-002` | Authenticated `SECURITY DEFINER` allowlist needs continued review | **Open assurance finding; many grants are intentional RPCs** |
| `DB-003` | Several foreign keys lack supporting indexes | **Open pending representative query evidence** |
| `PERF-001` | League summaries may scale serially | **Open** |
| `PERF-002` | Scoring recomputes whole tournament | **Open pending complete-volume measurement** |
| `TYPE-001` | Hand-written types/casts can hide schema drift | **Open** |
| `A11Y-001` | Assistive-technology review incomplete | **Partial; automated axe and production Lighthouse accessibility are green** |
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

- Repository implementation, development-hosted verification and production verification are separate closure states.
- Do not call the whole product launch-ready because the contract and production release are aligned.
- Do not retain broad findings after the concrete defect is resolved.
- Contract 60 is the current production baseline; any future development/production split must be recorded once in `current-status.md`.
- A guard blocking incompatible deployment is a safeguard, not a defect to bypass.
- Advisor warnings require context; do not remove indexes or revoke intended RPC access without evidence.
- Historical audits and reconciliations remain immutable.