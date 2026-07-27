# Acquisition readiness roadmap

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

## Phase 1 — administrator operations

**Current evidence:** the admin migration versions are reconciled and the protected-route/capability/RPC foundation is merged on `main`. Mutation UI acceptance and authorised/unauthorised Browser E2E remain open.

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

## Phase 2 — background operations

### Outcomes

- Job/scheduler capability established.
- Complete valid entries auto-submit at lock.
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
- Paginated global leaderboard.
- One-row current-user standing for the home screen.
- League reads avoid global score aggregation.
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
- Actual knockout winner/method/extra-time/penalty consumption complete.
- Actual tie-resolution workflow complete.
- Live result and standing refresh available.
- Match-centre prediction distributions are materialised and small-sample safe.
- Named operations ownership, escalation and rollback procedures complete.

### Exit gates

- Full tournament time-travel rehearsal passes.
- Result correction and rollback rehearsal passes.
- Peak matchday and lock-window load tests pass.
- Official-data provenance and change control are documented.

## Phase 5 — launch assurance

**Current evidence:** the manual encrypted production-backup workflow (T024-equivalent) is merged. Its first-run reconciliation record remains incomplete and must not be claimed from repository evidence alone.

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
| C-4 admin application | Phase 1 |
| H-6 background jobs / auto-submit | Phase 2 |
| C-1 bounded leaderboard | Phase 3 |
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
