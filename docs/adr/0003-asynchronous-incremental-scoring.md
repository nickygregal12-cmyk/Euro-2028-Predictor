# ADR 0003 — Asynchronous incremental scoring

- **Status:** Accepted direction — not currently justified at the operating caps. Later ACQ-R03 evidence measured the synchronous full recompute at roughly 884 ms by group result 36 for 250 entries and roughly 4 seconds for 1,000, with WAL/bloat, knockout-cascade and concurrency probes also recorded. `DEC-009` remains deferred to the full dress rehearsal rather than being decided from the original 12-result sample.
- **Date:** 27 July 2026

## Context

The current normal scoring path can recompute the complete tournament synchronously when a result changes. That is correct and convenient at small scale but creates an unacceptable transaction and write-amplification ceiling for a large public launch.

## Decision

Normal result handling will enqueue scoring work and return promptly. A bounded worker will score the affected match and dependent group or award state incrementally, update maintained standings and capture rank history at defined checkpoints.

The full tournament recomputation remains available as a restricted repair and verification operation.

## Consequences

- Result entry is separated from expensive scoring work.
- Jobs must be idempotent, retry-safe and observable.
- Incremental output must be parity-tested against full recomputation.
- Corrections and clears must reverse or replace only affected scoring state without rewriting unrelated rows.
- Production rollout requires representative load and bloat evidence.

## Rejected alternatives

- Full rewrite of the scoring domain: rejected because the existing domain and SQL parity asset should be preserved.
- Continue synchronous full recomputation: rejected for large-audience launch.
- Introduce a separate general application server immediately: rejected as unnecessary before Supabase jobs and Edge Functions are proven insufficient.
