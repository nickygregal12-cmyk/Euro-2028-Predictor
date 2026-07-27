# ADR 0007 — Reference-data caching

- **Status:** Accepted direction
- **Date:** 27 July 2026

## Context

Tournament reference data is largely identical for all users and changes infrequently, yet repeated provider mounts and foreground returns can refetch it from Supabase. This creates avoidable load and weakens multi-tournament isolation where filters are implicit.

## Decision

Adopt controlled client caching and a versioned edge/CDN representation for suitable reference data. Every database query remains explicitly tournament-scoped. Lock and contract-critical fields are read fail-closed; errors must not be converted into an unlocked state.

Freshness may vary by tournament phase, with shorter live-match cache periods and longer pre-tournament periods.

## Consequences

- Administrative result or fixture changes must invalidate or version the reference artefact.
- Cached payloads contain public reference data only.
- Client query keys include tournament and contract/version identity.
- Warm returning sessions should avoid unnecessary database reads.

## Rejected alternatives

- Refetch all reference rows on every mount/focus: rejected as avoidable database load.
- Cache without explicit version/invalidation: rejected because stale results are operationally harmful.
