# Acquisition readiness roadmap

> **Archived 29 July 2026** by the documentation consolidation, moved unchanged from `docs/roadmap/acquisition-readiness-roadmap.md`. It was a second full sequence (Phases 1–6) over the same programme as [`roadmap.md`](../roadmap.md) (Stages 0–8), which is now the single sequencing authority. Retained as dated 27 July 2026 planning derived from [`2026-07-27-acquisition-technical-audit.md`](../audits/2026-07-27-acquisition-technical-audit.md).
>
> **Two parts have no home yet and were deliberately not lifted out of this file:** its *audit-derived backlog map* (the only traceability from audit items C-1/C-2/H-6 to planned work) and its *per-phase exit gates*. Both remain readable here until an authorised content change folds them into the live register and roadmap. Its status lines were already stale when archived — Phase 3 marks merged work "in flight", and Phase 6 lists delivered features as future candidates.

**Status:** Planning authority for audit-derived platform work.  
**Implementation authority:** Current code, migrations, tests and hosted evidence.

## Roadmap order

The platform should progress in this order:

1. Administrator operations
2. Background operations
3. Scalability foundations
4. Tournament readiness
5. Launch assurance
6. Product polish and expansion

Feature work may continue only where it does not bypass a hard gate or deepen a known critical hot path.

## Phase 1 — administrator operations: complete in development

**Current evidence:** the full mutation UI, review step, revision history and authorised/unauthorised desktop/mobile Browser E2E are merged (PRs #120, #126); pgTAP enumerates the `admin_*` functions and proves denial for ordinary users; the operations runbooks reflect the browser workflow. Production carries the workflow only at a later milestone.

### Outcomes

- Protected administrator routes and server-side capability enforcement.
- Browser result confirmation, correction and clearing.
- Mandatory correction reason.
- Immutable result-revision history.
- Audit evidence for every privileged mutation.
- No routine dependence on Supabase Studio or service-role credentials.

### Exit gates

- Browser E2E covers authorised and unauthorised result workflows.
- pgTAP enumerates every `admin_*` function and proves denial for a normal authenticated user.
- Operations runbook reflects the browser workflow.

## Phase 2 — background operations: partially complete

**Current evidence:** the `pg_cron` job tier is established and complete valid entries auto-submit at lock with immutable, idempotent outcomes (contract 41, PR #128). Scoring/reconciliation jobs and the email items remain.

### Outcomes

- Job/scheduler capability established *(delivered)*.
- Complete valid entries auto-submit at lock *(delivered)*.
- Scoring jobs can be queued and retried safely.
- Reconciliation and maintenance jobs exist.
- Email-provider decision, processor record and initial lifecycle messages completed.

### Exit gates

- Jobs are idempotent and observable.
- Auto-submission excludes incomplete entries and is proven by tests.
- Retry does not duplicate points, submissions or messages.

## Phase 3 — scalability foundations

### Outcomes

- Maintained `entry_standings` model.
- Paginated global leaderboard *(delivered — contract 43, PR #134)*.
- One-row current-user standing for the home screen *(delivered — contract 43)*.
- League reads avoid global score aggregation *(in flight — draft PR #138, contracts 45–46)*.
- Incremental asynchronous scoring.
- Batched prediction persistence and action-level rate limiting.
- Reference-data cache and strict tournament scoping.

### Exit gates

- Representative six-figure seed tests pass agreed p95 targets.
- Incremental scoring equals full recomputation over parity fixtures.
- Result confirmation is not blocked by whole-tournament scoring.
- Browser endpoints are bounded server-side.

## Phase 4 — tournament readiness

### Outcomes

- Official teams, fixtures, players and authoritative regulations loaded.
- Actual knockout winner/method/extra-time/penalty consumption complete *(delivered — PR #124)*.
- Actual tie-resolution workflow complete *(delivered for the third-place qualification boundary — PR #126; fully unresolved group ties stay deferred under `DEC-001`)*.
- Live result and standing refresh available.
- Match-centre prediction distributions are materialised and small-sample safe.
- Named operations ownership, escalation and rollback procedures complete.

### Exit gates

- Full tournament time-travel rehearsal passes.
- Result correction and rollback rehearsal passes.
- Peak matchday and lock-window load tests pass.
- Official-data provenance and change control are documented.

## Phase 5 — launch assurance

**Current evidence:** the manual encrypted production-backup workflow (T024-equivalent) is merged and first-run verified — green run `30264080847`, disposable restore passed, off-GitHub encrypted custody (`docs/quality/reconciliations/2026-07-27-production-backup-workflow.md`).

### Outcomes

- TypeScript strict mode and generated database types.
- Mandatory production Turnstile, stronger password floor and leaked-password protection.
- Cryptographic league codes and rate-limited preview.
- Accessibility linting, automated axe checks and manual WCAG 2.2 AA review.
- Coverage and bundle budgets.
- Dependency automation, SAST, secret scanning, `CODEOWNERS`, PR template and `SECURITY.md`.
- GDPR export, deletion, retention and processor documentation.
- Backup custody and disposable restore rehearsal complete.

### Exit gates

- Production environment passes exact-head smoke against the matching contract.
- No critical or high launch blocker remains open without explicit owner acceptance.
- Incident, rollback and recovery exercises have retained evidence.

## Phase 6 — product polish and expansion

Candidates after the foundations above are stable:

- richer H2H and other-player profiles;
- post-lock trends;
- bonus games;
- PWA/offline support;
- shareable route metadata and league cards;
- broader competition portability.

These do not override operational, scalability or launch-assurance gates.

## Audit-derived backlog map

| Audit item | Roadmap phase |
| --- | --- |
| C-4 admin application | Phase 1 — delivered |
| H-6 background jobs / auto-submit | Phase 2 — delivered |
| C-1 bounded leaderboard | Phase 3 — delivered (load evidence remains) |
| C-2 maintained standings | Phase 3 |
| C-3 asynchronous incremental scoring | Phase 3 |
| H-1 batched prediction saves | Phase 3 |
| H-2 caching and tournament scoping | Phase 3 |
| M-1 live updates | Phase 4 |
| M-2 materialised distributions | Phase 4 |
| M-3 connection and lock-window testing | Phase 4 |
| H-3 strict typing and generated types | Phase 5 |
| H-4 authentication hardening | Phase 5 |
| H-5 invite-code hardening | Phase 5 |
| H-7 analytics | Phase 5 |
| M-4 to M-16 assurance improvements | Phase 5 or 6 according to risk |

## Change control

Every completed item requires:

- source or migration evidence;
- executable tests appropriate to the risk;
- current-status update;
- risk-register status update;
- deployment-contract update where the browser/database contract changes;
- hosted verification before any hosted environment is described as complete.
