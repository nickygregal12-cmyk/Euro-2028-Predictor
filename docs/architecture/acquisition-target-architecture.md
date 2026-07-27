# Acquisition target architecture

**Status:** Accepted direction; implementation remains evidence-driven.  
**Source:** 27 July 2026 acquisition technical audit.  
**Authority:** This document defines target architecture only. Current code, migrations, tests and hosted verification define what is implemented.

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

### Reference data

Tournament, team, group, venue and fixture reference data should be tournament-scoped and cacheable. The target is a versioned CDN artefact or equivalent edge-cached endpoint with short live-match freshness and longer pre-tournament freshness.

A reference-data failure must not silently convert the tournament into an unlocked or incomplete state.

### Standings

Introduce a maintained standings model with at least:

- `entry_id`
- `tournament_id`
- `total_points`
- `rank`
- `last_scored_at`

Browser-reachable leaderboard paths read this maintained model. A derived aggregate remains available only for reconciliation and repair verification.

Required read contracts:

- paginated global leaderboard;
- one-row current-user standing for the home screen;
- optional window around the current user;
- league standings that do not aggregate the global score-event table.

### Scoring

Normal result handling becomes:

1. validate and record the result;
2. append a result revision;
3. enqueue a scoring job;
4. return control to the administrator;
5. score the affected match and dependent group/award state in bounded batches;
6. update maintained standings and ranks;
7. record rank history at the defined checkpoint.

The existing full-tournament recomputation remains restricted as:

- a repair operation;
- a parity oracle;
- a rehearsal and reconciliation tool.

### Background jobs

Use database scheduling for database-resident work and Edge Functions for outbound services.

Initial jobs:

- scoring-queue drain;
- complete-entry auto-submission at lock;
- standings reconciliation;
- rate-limit-event pruning;
- reminder and lifecycle email dispatch;
- operational health checks.

Every job must be idempotent, retry-safe, observable and bounded.

### Administrator platform

The administrator area must provide least-privilege capabilities for:

- result confirmation, correction and clearing;
- immutable result-revision review;
- user and display-name moderation;
- league moderation;
- feature/configuration controls where expressly designed.

Every mutation must enforce server-side role or capability checks and write actor, action, reason and before/after evidence to the appropriate audit record.

Routine operations must not require Supabase Studio, database-owner credentials or a browser-held service-role key.

### Live updates

Use a narrow live-results channel rather than general client synchronisation. Result changes may invalidate cached match, standings and leaderboard queries. A bounded poll remains acceptable as a fallback while matches are live.

### Analytics and communications

Add privacy-conscious event analytics with a deliberately small taxonomy. Error telemetry remains separate from product analytics.

Add transactional email for lock reminders, auto-submission confirmation and selected operational messages. Provider use requires a processor record, retention position and CSP/configuration review.

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
