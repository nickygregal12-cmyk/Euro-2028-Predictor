# Acquisition target architecture

**Status:** Accepted direction; implementation remains evidence-driven.  
**Source:** 27 July 2026 acquisition technical audit.  
**Authority:** This document holds the **cross-cutting** target architecture only — objective, principles, preserved foundation, security constraints, performance acceptance direction and the implementation boundary. Each per-component decision is owned by an ADR under [`../adr/`](../adr/README.md); this file links to them and does not restate them. Current code, migrations, tests and hosted verification define what is implemented.

## Objective

Preserve the tested tournament domain and deployment model while removing the platform's large-audience scaling ceiling and adding the operational capabilities required for a live tournament.

## Principles

1. Evolve, do not rewrite.
2. Keep `src/domain/tournament/**` pure and independently testable.
3. Precompute hot reads rather than aggregating all scoring rows on demand.
4. Queue expensive work rather than blocking result-entry transactions.
5. Cache globally identical reference data outside Postgres where practical.
6. Keep browser privileges narrow and enforce administrator capability inside every privileged RPC.
7. Retain a full recomputation and reconciliation path as a correctness oracle.
8. Add infrastructure only where it closes a measured operational gap.

## Preserved foundation

- React 19, TypeScript and Vite SPA.
- Netlify static deployment, CSP and security headers.
- Supabase Auth, PostgREST, RLS and security-definer RPCs.
- Pure tournament rules and SQL/TypeScript parity verification.
- Optimistic concurrency and immutable result revisions.
- Deployment-contract and migration-count gates.

## Target components

### Client

- Feature screens remain under `src/features/**`.
- Pure rules remain under `src/domain/**`.
- Supabase access remains isolated under `src/services/supabase/**`.
- Add a client query cache for request deduplication, controlled freshness and foreground refresh.
- Add a code-split protected administrator area.

### Component decisions — owned by ADRs

Each target component decision has its own architecture decision record with a maintained status line. **Read the ADR, not a restatement:**

| Component | Decision record |
| --- | --- |
| Reference data and caching | [ADR-0007](../adr/0007-reference-data-caching.md) |
| Maintained standings model | [ADR-0004](../adr/0004-maintained-entry-standings.md) |
| Scoring: queue and incremental processing | [ADR-0003](../adr/0003-asynchronous-incremental-scoring.md) |
| Background jobs | [ADR-0005](../adr/0005-background-jobs.md) |
| Administrator platform, authorisation and audit | [ADR-0006](../adr/0006-admin-authorisation-and-audit.md) |
| Live result and standing updates | [ADR-0008](../adr/0008-live-updates.md) |
| Product analytics and communications | [ADR-0009](../adr/0009-product-analytics.md) |

The prose these rows replaced described all seven in the future tense, including two that have since shipped. It is archived verbatim at [`../history/acquisition-target-architecture-components-2026-07-27.md`](../history/acquisition-target-architecture-components-2026-07-27.md).

## Security constraints

- Browser RPC execution remains explicit allowlist only.
- Every `admin_*` function must deny an authenticated non-admin caller.
- Administrator grants are not client-writable.
- Invite-code generation uses a cryptographic source and preview probing is rate-limited.
- Production anti-bot configuration fails closed.
- Leaked-password protection and stronger password policy are launch gates.
- Security-definer search paths remain pinned and tested.

## Performance acceptance direction

Large-scale readiness must be demonstrated against representative seeded data, not inferred from small development fixtures.

Minimum target evidence:

- home standing read returns one row;
- leaderboard page is bounded server-side;
- private league reads do not aggregate all score events;
- result confirmation returns promptly while scoring completes asynchronously;
- incremental and full recomputation produce equivalent outputs;
- lock-window write concurrency and connection-pool behaviour are rehearsed.

## Implementation boundary

This document does not authorise direct production changes. Each schema or hosted change still follows migration, preview, backup, verification and explicit-approval controls in the current operations documentation.
