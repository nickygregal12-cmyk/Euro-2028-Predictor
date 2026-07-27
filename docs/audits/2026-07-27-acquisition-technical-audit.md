# Euro 2028 Predictor — acquisition technical audit

**Date:** 27 July 2026  
**Status:** Historical audit snapshot  
**Authority:** Informative only. Current code, migrations, tests, hosted evidence, `docs/quality/current-status.md`, and the current risk register override this audit where they differ.

## Purpose

This document records the incoming-platform-operator audit completed against the repository snapshot at database contract 36. It identified strong domain engineering and test discipline alongside material scalability, operational, security, and product-readiness gaps.

The full source audit is retained externally with the project records. This repository copy records the findings that now influence project architecture and planning without duplicating every line of the original report.

## Headline conclusion

Do not rewrite the product. Preserve the React, TypeScript, Vite, Supabase and Netlify architecture, especially the pure tournament domain layer, SQL parity model, security-definer RPC discipline, migration contract, and automated tests.

Before a large public launch, refactor the platform's hot paths and add the missing operations tier:

1. Paginate global leaderboard reads and provide a one-row `get_my_standing` path for the home screen.
2. Replace browser-facing aggregation over `entry_totals` with a maintained standings model.
3. Move normal scoring from synchronous whole-tournament recomputation to queued, incremental processing while retaining full recomputation as a repair and verification path.
4. Complete the protected administrator application and audit trail.
5. Add background jobs for scoring, auto-submission, reconciliation, reminders and maintenance.
6. Add reference-data caching, live result refresh, analytics and lifecycle communications.

## Snapshot caveat

The audit inspected a contract-36 snapshot before subsequent administrator work. Later repository changes must be classified from their own implementation evidence; this historical audit must not be used to mark newer capabilities absent or complete.

## Accepted target principles

- Evolve rather than replace.
- Precompute high-volume reads.
- Queue expensive writes.
- Cache globally identical reference data at the edge.
- Preserve two independently implemented definitions where parity verification provides valuable correctness evidence.
- Add the smallest practical server tier: Supabase database jobs and Edge Functions rather than a separate application platform.
- Treat operations, scalability and security as launch foundations, not post-launch polish.

## Audit-derived workstreams

### Critical

- Leaderboard pagination and caller-specific standing.
- Maintained standings storage and reconciliation.
- Asynchronous incremental scoring.
- Browser administrator operations with least-privilege authorisation and immutable audit evidence.

### High

- Batched prediction saves and action-level rate limiting.
- Client/reference-data caching and strict tournament scoping.
- TypeScript strict mode and generated database types.
- Authentication and anti-abuse hardening.
- Cryptographically generated, rate-limited league invite codes.
- Background-job capability and valid-entry auto-submission.
- Privacy-conscious product analytics.

### Medium and launch assurance

- Live result and standing updates.
- Materialised prediction distributions with small-sample protection.
- Connection-pool and lock-window load testing.
- Accessibility automation and manual WCAG 2.2 AA review.
- Dependency automation, CodeQL, secret scanning and repository governance.
- Coverage and bundle-size budgets.
- GDPR self-service, retention and processor documentation.
- PWA/offline support and improved public-route metadata where commercially justified.

## Documentation reconciliation

The audit findings are incorporated into:

- `docs/architecture/acquisition-target-architecture.md`
- `docs/roadmap/acquisition-readiness-roadmap.md`
- `docs/quality/acquisition-risk-register.md`
- `docs/adr/0003-asynchronous-incremental-scoring.md`
- `docs/adr/0004-maintained-entry-standings.md`
- `docs/adr/0005-background-jobs.md`
- `docs/adr/0006-admin-authorisation-and-audit.md`
- `docs/adr/0007-reference-data-caching.md`
- `docs/adr/0008-live-updates.md`
- `docs/adr/0009-product-analytics.md`

Implementation status must be updated in `docs/quality/current-status.md` and evidenced by migrations, source code and executable tests before any planned item is described as complete.
