# Acquisition risk register

> **Archived 29 July 2026** by the documentation consolidation, moved from `docs/quality/acquisition-risk-register.md` after its contents were merged. Superseded by [`risk-register.md`](../risk-register.md), which is now the single live register: all 27 `ACQ-R` risks below were merged into a destination identifier, carried across keeping their own identifier, or recorded as already covered, and the per-risk disposition is in that file's *Acquisition merge accounting* section. `ACQ-R02`, `ACQ-R06` and `ACQ-R07` were each re-verified against `origin/main` and remain Open; the `FUNC-002` / `ACQ-R05` contradiction was resolved in favour of `FUNC-002` with evidence. **No risk was closed by the merge.**
>
> Retained unchanged as dated 27 July 2026 derivation evidence from [`2026-07-27-acquisition-technical-audit.md`](../../audits/2026-07-27-acquisition-technical-audit.md). Its status text is a snapshot of that date and is not current; its *Completed repository foundations* and *Status values* sections are preserved here because they were not merged as risk rows.

**Date opened:** 27 July 2026  
**Scope:** Risks derived from the acquisition technical audit and reconciled as forward platform work.  
**Status rule:** A risk closes only when implementation and verification evidence exist; planning text alone does not mitigate it.

## Status values

- **Open** — no sufficient mitigation implemented.
- **In progress** — implementation exists on an active branch or environment but is not fully accepted.
- **Mitigated** — controls are implemented and verified, with residual risk documented.
- **Accepted** — owner explicitly accepts the residual risk.
- **Closed** — risk no longer applies.

## Critical risks

| ID | Risk | Impact | Required mitigation | Status |
| --- | --- | --- | --- | --- |
| ACQ-R01 | Unbounded global leaderboard and client-side ranking can make the home/default route unusable at scale. | Loss of service and oversized disclosure payload. | Bounded paginated RPCs, one-row current-user standing and removal of browser use of the unbounded endpoint. | **Mitigated at the enforced cap** — server-ranked keyset pagination and independent current-user context shipped at contract 43; rollback-only 250-entry hosted evidence records single-digit-millisecond pages and bounded payloads. Re-open before increasing the operating cap materially. |
| ACQ-R02 | Browser standings reads aggregate the scoring table through a derived totals view. | Database saturation and timeouts as score events grow. | Maintained `entry_standings`, indexed reads and reconciliation against a derived oracle. | Open as a future scale direction — current 250-entry query-plan evidence is single-digit milliseconds with zero disk reads, so a maintained table is not justified at the enforced cap; review on cap increase or adverse dress-rehearsal evidence. |
| ACQ-R03 | A result write synchronously recomputes the whole tournament. | Long transactions, WAL/table bloat and peak-time operational failure. | Queue result scoring, process incrementally in bounded batches, retain full recomputation for repair/parity. | In progress through evidence — full recomputation at 250 entries with 12 results measured ~354 ms and is not currently justification for an incremental scorer (`DEC-009`); re-measure at full result volume during the dress rehearsal. |
| ACQ-R04 | Routine result operations lack a fully accepted least-privilege browser workflow on current `main`. | Human error or credential exposure during live operations. | Protected administrator interface, server-side capability checks, revision history and audit evidence. | **Mitigated** — complete mutation UI, review step, immutable revisions and authorised/unauthorised Browser E2E are merged; production contract 44 carries the workflow and one owner-controlled account has the narrow server-owned `results` capability. |

## High risks

| ID | Risk | Required mitigation | Status |
| --- | --- | --- | --- |
| ACQ-R05 | Complete entries may remain unsubmitted at lock and score zero. | Idempotent auto-submit job using authoritative completeness rules; user notification. | In progress — idempotent database-scheduled auto-submit with immutable outcomes is deployed through contract 41; user notification/email remains pending Auth/SMTP ownership. |
| ACQ-R06 | Prediction persistence uses many row-level requests and rate-limit events. | Batched transactional save RPC and action-level limiting. | Open |
| ACQ-R07 | Reference data is repeatedly fetched and one query is not explicitly tournament-scoped. | Client/edge cache, tournament filter and fail-closed lock data. | Open |
| ACQ-R08 | TypeScript strictness and schema-generated types are not enforced. | Enable strict mode; generate and freshness-check database types. | Open |
| ACQ-R09 | Password, breach screening and anti-bot controls are insufficiently fail-closed for launch. | Stronger floor, leaked-password protection and mandatory production Turnstile validation. | Open |
| ACQ-R10 | League invite generation/probing can support enumeration. | Cryptographic longer codes, preview throttling, reduced disclosure and code rotation. | Open |
| ACQ-R11 | No accepted background-job tier supports scoring, submission, reconciliation and lifecycle work. | Establish `pg_cron`/Edge Function responsibilities with idempotency and observability. | In progress — a `pg_cron` tier carries the idempotent submission job; scoring, reconciliation/lifecycle jobs and failure observability remain only where later evidence justifies them. |
| ACQ-R12 | No product analytics supports funnel or retention decisions. | Privacy-conscious event taxonomy, approved provider, CSP/DPIA and core dashboards. | Open |
| ACQ-R13 | Large-scale behaviour at lock and result peaks is not evidenced. | Representative seeded load tests, connection-pool budget and rehearsed thresholds. | In progress — separate rollback-only hosted tranches cover 250 submitted entries and a 250-member private league, including query plans, payload sizes, full cursor traversal and recomputation. Connection-pool/concurrent peak testing and full-result-volume evidence remain. |
| ACQ-R14 | Critical admin/result, penalty-winner and accessibility journeys lack complete end-to-end evidence. | Browser E2E, pgTAP privilege enumeration, axe automation and manual assistive-technology review. | In progress — admin/result, qualification, penalty-winner and private-league ownership journeys are browser-proven; axe automation and manual assistive-technology review remain. |

## Medium risks

| ID | Risk | Required mitigation | Status |
| --- | --- | --- | --- |
| ACQ-R15 | Users must refresh for result and standing changes. | Narrow Realtime invalidation plus bounded live polling fallback. | Open |
| ACQ-R16 | Prediction distribution reads are live aggregates and can expose small samples. | Materialise distributions and suppress buckets below an approved threshold. | Open |
| ACQ-R17 | Security-definer and foreign-key/index assurance has known residual findings. | Pin all search paths, extend enumeration tests and add evidence-based indexes. | In progress — contracts 42–46 use exact execution allowlists and empty search paths on touched browser RPCs; broader enumeration/index review remains. |
| ACQ-R18 | Accessibility linting and automated WCAG checks are incomplete. | Enable curated accessibility rules, fix interaction findings and add axe/manual review. | Open |
| ACQ-R19 | Dependency, SAST, secret-scanning and repository governance automation are incomplete. | Renovate/Dependabot, CodeQL, push protection, `CODEOWNERS`, PR template and `SECURITY.md`. | Open |
| ACQ-R20 | Coverage and bundle budgets are not enforced. | Domain/overall coverage thresholds and compressed bundle budgets in CI. | Open |
| ACQ-R21 | GDPR self-service, retention and processor records are incomplete. | Export, deletion, retention schedule, processor register and DPIA. | Open |
| ACQ-R22 | Share-route metadata, offline support and public-route 404 semantics are limited. | Prioritise according to commercial value after launch foundations. | Open |
| ACQ-R23 | Legacy development hosting may remain reachable. | Decommission or explicitly control and document. | Open |

## Low risks

| ID | Risk | Required mitigation | Status |
| --- | --- | --- | --- |
| ACQ-R24 | Score values lack a practical upper bound. | Constrain scores to 0–99 and test. | Open |
| ACQ-R25 | Development/orchestration files are oversized. | Split only when related functional work changes them. | Open |
| ACQ-R26 | Residual console/lint warnings and asset inefficiencies can regress quality. | Route logs through observability, fail CI on agreed warnings and optimise flags. | Open |
| ACQ-R27 | Repository metadata lacks formal versioning and contributor/security policies. | Semantic versioning, changelog, licence decision, contributing and disclosure policy. | Open |

## Acceptance rule

Critical and high risks are hard launch gates unless the owner records an explicit, dated acceptance with scope, expiry/review date and rollback or contingency position. A merged pull request without hosted or load evidence may move a risk to **In progress**, not **Mitigated**.

## Completed repository foundations

- Manual encrypted, restore-rehearsed production-backup workflow merged and first-run verified (green run `30264080847`, disposable restore passed, off-GitHub encrypted custody — `reconciliations/2026-07-27-production-backup-workflow.md`).
- Protected administrator routes with complete result and qualification mutation workflows, revision history, Browser E2E and a narrow production results capability.
- Contracts 39–44 are production-hosted: actual Round-of-16 population, third-place boundary resolution, automatic valid-entry submission, bounded reads, paginated overall standings and operating-cap enforcement.
- Contracts 45–46 are development-hosted in draft PR #138: paginated private-league standings, independent caller context, owner-only transfer search and lightweight activity summaries.
- Rollback-only hosted evidence covers both 250-entry non-league reads/recomputation and complete 250-member private-league traversal without retained synthetic data.

No separate `ACQ` row covers operating-cap enforcement; its residual peak/concurrency evidence remains tracked under `ACQ-R13`.

## Reconciliation references

- `docs/audits/2026-07-27-acquisition-technical-audit.md`
- `docs/architecture/acquisition-target-architecture.md`
- `docs/history/acquisition-readiness-roadmap-2026-07-27.md`
- `docs/quality/current-status.md`
- `docs/quality/investigations/2026-07-28-stage-3c2-scale-read-recompute-evidence.md`
- `docs/quality/investigations/2026-07-28-stage-3c2-private-league-evidence.md`
