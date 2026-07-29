# Euro 2028 Predictor — Current Risk Register

**Status date:** 29 July 2026  
**Live status authority:** [`current-status.md`](current-status.md)  
**Repository baseline:** contract 60 at `7555db4625f8e1c4d9a0cb72185c40391cf90f3f`  
**Hosted state:** **REQUIRES OWNER VERIFICATION** using the checks in [`investigations/2026-07-29-euro-2028-baseline-readiness.md`](investigations/2026-07-29-euro-2028-baseline-readiness.md).

Current `main` code, migrations and executable tests override older classifications. Historical hosted claims are retained only when dated and attributed; otherwise they are owner-verification items. PR #193 is open, draft and unmerged, so contracts 61–62 are not part of this contract-60 baseline.

## Evidence-backed closed or reduced findings

| ID | Finding | Current status | Implementation and validation evidence |
| --- | --- | --- | --- |
| `DATA-001` | Predicted group positions can be forged or drift | **Resolved in repository** | Server-derived positions and parity were delivered across PRs [#122–#145](https://github.com/nickygregal12-cmyk/Euro-2028-Predictor/pulls?q=is%3Apr+is%3Amerged+122..145); current contract-60 tests remain authoritative. |
| `SECURITY-001` | Browser roles can write server-owned position inputs | **Resolved in repository** | Exact function/role boundaries are covered by contract-60 privilege tests; foundational delivery is recorded across PRs #122–#145. |
| `SECURITY-002` | Submission boundary can be bypassed | **Resolved in repository** | RPC-only submission and lock rejection are implemented and tested in the contract-60 chain; see PRs #122–#145. |
| `DATA-002` | Knockout winner/method lacks database authority | **Resolved in repository** | Authoritative result method/winner and replay were delivered before contract 60 and remain browser/database tested. |
| `OPS-001` | Environment rollback crosses database boundaries | **Resolved as repository safeguard; hosted alignment requires owner verification** | Deployment-contract/environment guards are implemented; historical release controls were reconciled by PR [#182](https://github.com/nickygregal12-cmyk/Euro-2028-Predictor/pull/182). |
| `DATA-003` | Same-tournament/reference constraints incomplete | **Resolved in repository; hosted state requires owner verification** | Relationship guards and privilege coverage are present in the canonical chain; prior validation is recorded in PRs #122–#145. |
| `FUNC-002` | Valid entries are not automatically submitted at lock | **Resolved in repository** | Contract 41 automatic submission and immutable status evidence are exercised by database tests. |
| `DATA-005` | Score/entry clearing lacks race-safe authority | **Resolved in repository** | Contract 58 and PR [#174](https://github.com/nickygregal12-cmyk/Euro-2028-Predictor/pull/174) prevent stale autosaves resurrecting a cleared entry. |
| `OPS-002` | Administrator control room incomplete | **Resolved in repository** | Result/qualification controls and protected browser journeys were delivered in the lifecycle PR sequence and remain tested. |
| `FUNC-003` | Bonus Games disappear when hosted catalogue rows are absent | **Resolved in repository** | Fallback cards and repeatable publication were delivered by PR [#184](https://github.com/nickygregal12-cmyk/Euro-2028-Predictor/pull/184); browser lifecycle proof was added by PR [#187](https://github.com/nickygregal12-cmyk/Euro-2028-Predictor/pull/187). Hosted catalogue state requires owner verification. |
| `TEST-GAP-01` | Bonus Games lacked end-to-end browser proof | **Resolved** | PR [#187](https://github.com/nickygregal12-cmyk/Euro-2028-Predictor/pull/187), CI `30442005168` and Browser E2E `30442002202`. |
| `TEST-GAP-02` | H2H rank-history capture lacked behavioural pgTAP | **Resolved** | PR [#189](https://github.com/nickygregal12-cmyk/Euro-2028-Predictor/pull/189), Database parity `30444229090`, CI `30444229102`, Browser E2E `30444229106`. |
| `RESULT-AUDIT-01` | Revision log lacked exact before/after assertions | **Resolved** | PR [#191](https://github.com/nickygregal12-cmyk/Euro-2028-Predictor/pull/191), Database parity `30445747235`, CI `30445747255`, Browser E2E `30445747236`. |
| `DOC-001` | Documentation authority can drift | **Regressed and being repaired in PR #195** | Current authority documents contained undated hosted assertions and stale Stage 6 wording. This reconciliation reopens the finding until PR #195 is complete and green. |
| `TEST-001` | Critical rules lack complete end-to-end evidence | **Reduced, still reproduces as an assurance gap** | Core, Bonus Games, rank-history and revision-content automation are present; manual assistive-technology review, complete-volume dress rehearsal and controlled rollback rehearsal remain. |

## High

| ID | Finding | Repository-only reproduction on 29 July 2026 | Required closure |
| --- | --- | --- | --- |
| `DATA-004` | Actual tie resolution can use non-authoritative fallback | **Still partially reproduces.** Exact third-place boundary resolution exists, but fully unresolved within-group treatment still depends on official regulations. | Confirm official Euro 2028 regulations and extend authority only if required. |
| `OPS-003` | Production observability operations incomplete | **Still reproduces as an operational gap.** Repository docs do not name final monitoring, backup and Cron alert owners or escalation. | Named owners, retention/escalation and incident procedure; hosted delivery checks require owner verification. |

## Medium

| ID | Finding | Repository-only reproduction on 29 July 2026 | Required closure |
| --- | --- | --- | --- |
| `PRIV-001` | Contract-61 prediction consensus has no minimum cohort threshold | **Open prospective merge risk.** PR #193 migration `20260729122100_prediction_consensus.sql` returns aggregates for all submitted entries without a `count`/threshold gate. The smallest result-producing cohort is one. In a one- or two-entry tournament cohort, aggregate values combined with the caller's own picks can substantially reveal another person's predictions. | Before PR #193 merges, either add and test an approved suppression threshold, or record explicit owner privacy acceptance and user-facing policy. Evidence: PR [#193](https://github.com/nickygregal12-cmyk/Euro-2028-Predictor/pull/193), exact head `901a2bb92b74979283491e5c85d71b01657193a9`; repository gates are green, hosted state requires owner verification. |
| `REL-008` | Netlify deploy-preview control is inconsistent across equivalent repository work | **Open control reliability finding.** PR #194's docs-only head `0aa233f30158381f669a0769424009c990697b1a` has overall `netlify/euro28predictor/deploy-preview` failure and reported Redirect rules, Header rules and Pages changed failures. The five immediately preceding merged PRs #188–#192 each show overall deploy-preview success. This is not repo-wide failure, but it is inconsistent and makes the proportionate docs-preview control unreliable. | Owner investigates the failed Netlify deploy/check output, records root cause and proves a later docs-only PR passes the same checks. Do not weaken or retrigger configuration in this documentation task. |
| `MIG-001` | No CI guard enforces migration timestamps strictly above current `main` | **Open control gap.** The canonical 60-file chain has unique timestamps, and PR #193's candidate timestamps are safely above `20260729110000`. However, CI only rebuilds committed migrations; it does not compare a new filename against the highest timestamp on `main`. The branch inventory found seven dead collision branches in ten days. | Add a future pull-request guard that rejects duplicate timestamps and any newly added timestamp less than or equal to the highest canonical timestamp on the PR base. Do not build it in PR #195. |
| `AUTH-001` | Turnstile/CAPTCHA contexts not fully verified | **Cannot be closed from repository.** Configuration intent exists; hosted context state is unknown. | **REQUIRES OWNER VERIFICATION:** inspect each Netlify context and Supabase Auth setting, record verifier/date. |
| `AUTH-002` | Leaked-password protection disabled | **Cannot be closed from repository.** This is a hosted Auth setting/owner decision. | **REQUIRES OWNER VERIFICATION:** inspect Supabase Auth password settings and record decision/date. |
| `OPS-008` | Legacy public development site remains | **Cannot be closed from repository.** External site state is unknown. | **REQUIRES OWNER VERIFICATION:** identify or remove the legacy site and record owner/date. |
| `REL-007` | Stale device can delete a newer bracket pick | **Evidence gap still reproduces.** Implementation exists, but final controlled browser proof is not linked in current `main`. | Add or cite a deterministic multi-device browser journey before closure. |
| `DB-001` | `public.enforce_joker_rules` has mutable search path | **Still reproduces in the canonical contract unless a later migration proves otherwise.** | Append-only hardening migration plus pgTAP/privilege evidence. |
| `DB-002` | Authenticated `SECURITY DEFINER` allowlist needs continued review | **Still applies as an assurance finding.** Many grants are intentional; exact allowlists require ongoing review. | Keep privilege tests exhaustive and review each new RPC. |
| `DB-003` | Several foreign keys lack supporting indexes | **Still reproduces as an unclosed performance finding.** | Representative query evidence before adding indexes. |
| `PERF-001` | League summaries may scale serially | **Still reproduces as an unmeasured scale risk.** | Representative large-league profiling and bounded-query evidence. |
| `PERF-002` | Scoring recomputes the whole tournament | **Still reproduces by design.** Existing partial benchmark is not the complete tournament volume. | Re-measure at full result volume in the dress rehearsal. |
| `TYPE-001` | Hand-written types/casts can hide schema drift | **Still reproduces.** | Generated or checked schema types, or equivalent drift guard. |
| `A11Y-001` | Assistive-technology review incomplete | **Still reproduces.** Automated axe exists, but manual keyboard/screen-reader/contrast review is outstanding. | Complete and record manual review. |
| `UX-001` | Trustworthy invite context before auth incomplete | **Still reproduces.** | Complete pre-auth league identity/trust treatment and browser evidence. |
| `UX-002` | Unavailable and empty data can be conflated | **Reduced but still reproduces on secondary surfaces.** | Complete explicit loading/empty/error treatment per route. |
| `SEC-001` | Invite/aggregate disclosure needs abuse review | **Still reproduces.** `PRIV-001` is the concrete new consensus instance; invite enumeration/abuse remains broader. | Threat-model rate limits, enumeration and small-cohort disclosure. |
| `DATA-007` | Rate limiting is count-then-insert | **Still reproduces.** | Atomic enforcement or accepted capacity/race evidence. |

## Low

| ID | Finding | Repository-only reproduction on 29 July 2026 | Required closure |
| --- | --- | --- | --- |
| `HYGIENE-002` | Some pure modules may be test/reference-only | **Still open; deletion is prohibited without proof.** | Usage analysis before any archival/removal. |
| `CODE-001` | Large orchestration files are hotspots | **Still reproduces as maintainability risk.** | Refactor only with behaviour-preserving tests. |
| `SEO-001` | SPA fallback produces soft 404s | **Still reproduces.** | Owner decision on public crawlability/route handling. |
| `SEO-002` | Metadata largely global | **Still reproduces.** | Route metadata only if public SEO is approved. |
| `DATA-008` | Scores have no practical database maximum | **Still reproduces.** | Add justified bounds or document accepted risk. |
| `DOC-002` | Package version remains `0.0.0` | **Still reproduces.** | Set versioning/release policy before baseline publication if required. |
| `DOC-003` | Component gallery large/partly historical | **Still reproduces; do not delete as cleanup.** | Archive/reconcile only with link preservation and usage proof. |
| `REPO-001` | Licence/changelog policy absent | **Still partial.** | Owner policy decision. |

## Register rules

- Repository implementation, repository validation and hosted verification are separate closure states.
- Do not call hosted state verified without a dated verifier and exact check.
- Do not mark a finding Resolved without implementation evidence, validation evidence and a linked commit or PR.
- Do not call the whole product launch-ready because repository contracts are green.
- Do not retain broad findings after a concrete defect is resolved; use the original ID when the same root cause regresses.
- Contract 60 is the assessed baseline. PR #193 contracts 61–62 remain excluded until merged.
- A guard blocking incompatible deployment is a safeguard, not a defect to bypass.
- Historical audits and reconciliations remain immutable.