# ADR 0005 — Background jobs

- **Status:** Accepted direction
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
