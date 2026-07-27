# ADR 0008 — Live result and standing updates

- **Status:** Accepted direction
- **Date:** 27 July 2026

## Context

A live tournament experience requires result and standing changes to appear without a manual page refresh. A broad realtime synchronisation layer would add unnecessary complexity and exposure.

## Decision

Use a narrow live-results channel to invalidate affected match, standings and leaderboard queries. While matches are live, a bounded polling fallback may refresh the caller's standing if realtime delivery is delayed or unavailable.

Realtime payloads must contain only fields already readable by the caller and must not become an alternative write path.

## Consequences

- Subscription lifecycle and reconnect behaviour require browser tests.
- Cache invalidation occurs after authoritative database changes, not optimistic score calculation in the browser.
- Polling frequency is phase-aware and stops when no match is live.
- The feature remains guarded until hosted operational evidence exists.

## Rejected alternatives

- Manual refresh only: rejected as inadequate for the core tournament engagement loop.
- Realtime subscription to broad user-owned or scoring tables: rejected due to privacy, complexity and fan-out risk.
