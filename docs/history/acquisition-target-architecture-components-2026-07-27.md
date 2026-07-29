# Acquisition target architecture — component decisions (27 July 2026)

> **Archived 29 July 2026** by the documentation consolidation. These are the per-component target-architecture sections extracted verbatim from `docs/architecture/acquisition-target-architecture.md`, which was reduced to its cross-cutting material.
>
> **Each section below is superseded by an ADR that owns the same decision and carries a maintained status line** — which is why the extraction happened: these sections state all seven decisions in the future tense, so a reader finding them first learns that shipped administrator authorisation and shipped auto-submission are still target direction.
>
> | Section below | Superseded by |
> | --- | --- |
> | Reference data | [ADR-0007 — Reference-data caching](../adr/0007-reference-data-caching.md) |
> | Standings | [ADR-0004 — Maintained entry standings](../adr/0004-maintained-entry-standings.md) |
> | Scoring | [ADR-0003 — Asynchronous incremental scoring](../adr/0003-asynchronous-incremental-scoring.md) |
> | Background jobs | [ADR-0005 — Background jobs](../adr/0005-background-jobs.md) |
> | Administrator platform | [ADR-0006 — Administrator authorisation and audit](../adr/0006-admin-authorisation-and-audit.md) |
> | Live updates | [ADR-0008 — Live result and standing updates](../adr/0008-live-updates.md) |
> | Analytics and communications | [ADR-0009 — Privacy-conscious product analytics](../adr/0009-product-analytics.md) |
>
> Read the ADR for the current position. Retained unchanged as dated 27 July 2026 derivation evidence; nothing here was deleted.

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
