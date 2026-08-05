# ADR 0005 — Background jobs

- **Status:** Accepted direction — partially implemented. Database scheduling now drives Original auto-submission (contract 41), recurring season Match Predictor lock processing (contract 83) and season LMS settlement/replay (contract 89); rate-limit pruning remains transaction-local. The provider Edge Function has a server-only custody/strict-decode boundary (contract 97) but no approved live rehearsal. Incremental scoring drain, maintained-standings reconciliation, reminders and general failed/delayed-job reporting remain unbuilt.
- **Date:** 27 July 2026

## Context

The product needs scheduled and asynchronous work for scoring, valid-entry auto-submission, reconciliation, maintenance and lifecycle messaging. Browser requests and manual operator actions are not sufficient execution mechanisms.

## Decision

Use Supabase database scheduling for database-resident work and Supabase Edge Functions for work requiring outbound HTTP or provider integration.

Initial responsibilities:

- drain scoring jobs;
- auto-submit complete entries at lock;
- reconcile maintained standings;
- prune rate-limit records;
- trigger reminders and confirmations;
- report failed or delayed jobs.

## Consequences

Every job requires an idempotency strategy, bounded batch size, retry policy, observable state and an operator repair path. Schedule and provider configuration become controlled deployment inputs.

## Rejected alternatives

- Depend on a browser being open: rejected as unreliable.
- Keep all work synchronous in result or user-write transactions: rejected for latency and lock risk.
- Introduce a separate queue platform before measuring Supabase capabilities: rejected as premature.
