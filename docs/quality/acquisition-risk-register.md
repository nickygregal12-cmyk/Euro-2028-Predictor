# Acquisition risk register

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
| ACQ-R02 | Browser standings reads aggregate the scoring table through a derived totals view. | Database saturation and timeouts as score events grow. | Maintained `entry_standings`, indexed reads and reconciliation against a derived oracle. | Open as a future scale direction — a maintained table remains unjustified at the enforced 250-entry cap, where a page measures ~35 ms. The cap-increase half of the review condition is now answered by dated local evidence ([30 July 2026](investigations/2026-07-30-acq-r02-leaderboard-scale.md)): cost is linear in **score events** (~0.0022 ms each, so ~100 ms per additional 45,000), page depth is free because every page re-aggregates the whole field, and the aggregation is the entire call cost. Track against `score_events` volume, not entry count. Land the mitigation **before** the cap rises materially. Dress-rehearsal and hosted-concurrency evidence still outstanding. |
| ACQ-R03 | A result write synchronously recomputes the whole tournament. | Long transactions, WAL/table bloat and peak-time operational failure. | Queue result scoring, process incrementally in bounded batches, retain full recomputation for repair/parity. | In progress through evidence, and the evidence now favours acting — dated local measurement across a full group stage ([30 July 2026](investigations/2026-07-30-acq-r03-result-write-cost.md)) shows per-write cost **compounds**: at 250 entries the 36th confirmation costs 26× the first (~884 ms), with ~12 s cumulative; at 1,000 entries it is ~4 s and ~48 s. WAL and bloat are quantified too: 87 MB of WAL to score one group stage at 250 entries, and score_events settles at 36 MB holding 1.9 MB of live rows — 19x, which plain VACUUM does not reclaim. The earlier ~354 ms figure was an early-tournament sample — 12 results is one matchday, roughly a quarter of the final per-write cost. `DEC-009`'s full-result-volume condition is satisfied for the group stage; a full tournament measures ~33 s and ~266 MB of WAL across 51 confirmations, with knockout results costing ~1.4 s each — more than the worst group result. Six concurrent readers degrade leaderboard reads 1.5x (mean 84 to 125 ms) without blocking or failing, so the risk is throughput rather than availability. Autovacuum at realistic spacing and a genuine peak load test remain unmeasured. |
| ACQ-R04 | Routine result operations lack a fully accepted least-privilege browser workflow on current `main`. | Human error or credential exposure during live operations. | Protected administrator interface, server-side capability checks, revision history and audit evidence. | **Mitigated** — complete mutation UI, review step, immutable revisions and authorised/unauthorised Browser E2E are merged; production contract 44 carries the workflow and one owner-controlled account has the narrow server-owned `results` capability. |

## High risks

| ID | Risk | Required mitigation | Status |
| --- | --- | --- | --- |
| ACQ-R05 | Complete entries may remain unsubmitted at lock and score zero. | Idempotent auto-submit job using authoritative completeness rules; user notification. | In progress — idempotent database-scheduled auto-submit with immutable outcomes is deployed through contract 41; user notification/email remains pending Auth/SMTP ownership. |
| ACQ-R06 | Prediction persistence uses many row-level requests and rate-limit events. | Batched transactional save RPC and action-level limiting. | Open |
| ACQ-R07 | Reference data is repeatedly fetched and one query is not explicitly tournament-scoped. | Client/edge cache, tournament filter and fail-closed lock data. | Open |
| ACQ-R08 | TypeScript strictness and schema-generated types are not enforced. | Enable strict mode; generate and freshness-check database types. | In progress — strictness is enforced and guarded: `strict` is declared in the app and node projects rather than inherited from the TypeScript 6 default, every committed `.ts`/`.tsx` file now belongs to a compiler project (`tests/`, `e2e/`, `scripts/**/*.ts`, `production-smoke/` were all outside `tsc -b` until 30 July 2026), and `tests/scripts/typescriptProjectCoverage.test.ts` fails when a new source escapes coverage or a project stops extending the strict base. Generated database types remain absent — the service layer still hand-writes every row type — but the enum surface, where drift changes behaviour rather than only types, is freshness-checked by `tests/database-parity/enumUnionParity.test.ts`. |
| ACQ-R09 | Password, breach screening and anti-bot controls are insufficiently fail-closed for launch. | Stronger floor, leaked-password protection and mandatory production Turnstile validation. | Open |
| ACQ-R10 | League invite generation/probing can support enumeration. | Cryptographic longer codes, preview throttling, reduced disclosure and code rotation. | **Open, and now characterised** ([30 July 2026](investigations/2026-07-30-acq-r10-invite-enumeration.md)). All four named mitigations are absent, and the before-state is pinned by `tests/database-parity/inviteCodeEnumeration.test.ts` so any of them must arrive as a visible edit. The keyspace is 31⁶ ≈ 887M, but the relevant figure is the chance a guess hits an existing league, which scales with league count: expected first hit falls from ~25 hours at 1,000 leagues to ~15 minutes at 10,000, at 100 probes/second. **The unbounded half is the priority**: rate limiting is trigger-based on writes, so joining is capped at five per window while `get_league_preview` — a `stable` read — has no limit at all. A hit returns league name, member count and owner display name, identifying a private group rather than merely confirming a code. `pgcrypto` is already installed, so the `random()` → `gen_random_bytes()` swap needs no new dependency. Code rotation has no implementation, so a leaked code is permanent. Should not become a second unapplied migration while production sits at contract 63. |
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
| ACQ-R20 | Coverage and bundle budgets are not enforced. | Domain/overall coverage thresholds and compressed bundle budgets in CI. | In progress — both are now enforced in CI, with one deliberate limit. Compressed budgets (`npm run check:bundle-budget`) gate the largest JS chunk at 75 KB gzip, all JS at 300 KB and all CSS at 45 KB, measured 30 July 2026 at 63.5/253.3/34.8 KB. Domain coverage (`npm run test:coverage:domain`) gates `src/domain/**` at 90% statements, 83% branches, 95% functions and 92% lines, against 92.2/85.7/96.6/94.7 measured. **Overall coverage is measured but not gated** — 58.4% statements, 60.3% lines — because CI runs the suite one file per process for memory isolation, where a threshold is evaluated per file and fails on every one. Gating it needs a single full-suite run whose memory cost has not been established. |
| ACQ-R21 | GDPR self-service, retention and processor records are incomplete. | Export, deletion, retention schedule, processor register and DPIA. | Open |
| ACQ-R22 | Share-route metadata, offline support and public-route 404 semantics are limited. | Prioritise according to commercial value after launch foundations. | Open |
| ACQ-R23 | Legacy development hosting may remain reachable. | Decommission or explicitly control and document. | Open |

## Low risks

| ID | Risk | Required mitigation | Status |
| --- | --- | --- | --- |
| ACQ-R24 | Score values lack a practical upper bound. | Constrain scores to 0–99 and test. | Open |
| ACQ-R25 | Development/orchestration files are oversized. | Split only when related functional work changes them. | Open |
| ACQ-R26 | Residual console/lint warnings and asset inefficiencies can regress quality. | Route logs through observability, fail CI on agreed warnings and optimise flags. | In progress — `npm run lint` is now `oxlint --deny-warnings`, so CI fails on any warning. The five that existed were fixed rather than suppressed, and three were real defects: `throw` inside a `finally` in one Playwright spec and two league fixtures, which replaces the in-flight failure so a cleanup problem is reported instead of the assertion that actually failed. One of the three sits inside a `catch` that rethrows, so an error is always in flight and cleanup can only report; the other two run after a body that may have succeeded, where a silent cleanup failure would leave a filled league cap or an unlocked tournament for the next spec. Those two now capture the body's outcome, always complete every cleanup step, and report the original error when there is one and the cleanup error otherwise — so neither failure can hide the other. Compressed asset budgets are enforced separately under `ACQ-R20`. The eight remaining `console.*` calls in `src/` were audited individually and none is an unrouted log: three are the client-observability fallback itself (the observability path, not a bypass), one is a Sentry warning already gated on `import.meta.env.DEV`, three are development-only shims (dev auto-login, the components preview page), and the last is the startup failure handler in `main.tsx`, which calls `reportClientError(error, 'startup')` first and logs only as a second local surface. The remaining piece for this risk is therefore the asset/optimisation half of the mitigation, not log routing. |
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
- `docs/roadmap/acquisition-readiness-roadmap.md`
- `docs/quality/current-status.md`
- `docs/quality/investigations/2026-07-28-stage-3c2-scale-read-recompute-evidence.md`
- `docs/quality/investigations/2026-07-28-stage-3c2-private-league-evidence.md`
