# ADR 0004 — Maintained entry standings

- **Status:** Accepted direction
- **Date:** 27 July 2026

## Context

Leaderboard and league reads should not aggregate all score events on every request. The home screen also needs only the caller's rank, points and entry count rather than the complete global board.

## Decision

Add a maintained, tournament-scoped standings table containing total points, rank and last-scored time per entry. Browser-reachable leaderboard and league functions will read it through bounded indexed queries.

Retain a derived totals query or view as a restricted reconciliation oracle, not as a browser read path.

## Consequences

- Scoring work becomes responsible for maintaining standings.
- A scheduled reconciliation must detect drift and alert.
- Global standings require server-side pagination with a hard limit.
- The home screen uses a one-row current-user standing endpoint.
- Rank semantics must remain equivalent to the existing TypeScript ranking rules.

## Rejected alternatives

- Continue aggregating score events at read time: rejected for scale.
- Cache the current unbounded response only: rejected because it preserves excessive payload and privacy exposure.
