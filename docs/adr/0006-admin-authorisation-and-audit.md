# ADR 0006 — Administrator authorisation and audit

- **Status:** Accepted direction
- **Date:** 27 July 2026

## Context

Routine tournament operations require a browser interface that does not expose unrestricted database credentials. Result lifecycle functions already provide an authoritative implementation and immutable revisions; the missing requirement is least-privilege browser authorisation and complete operational evidence.

## Decision

Administrator access will be represented in server-controlled identity metadata or an equivalent non-client-writable role model. Browser-facing `admin_*` RPCs may be granted to `authenticated` only when each function enforces the required role or capability internally before delegating to authoritative implementation functions.

Every privileged mutation records the actor, action, reason and appropriate before/after evidence. Protected routes are code-split and gated in the SPA, but the server-side check remains authoritative.

## Consequences

- Normal authenticated users can possess SQL `EXECUTE` on wrappers without gaining administrator authority.
- Tests must enumerate all `admin_*` RPCs and prove denial for non-admin callers.
- Direct service-role or database-owner access is reserved for bootstrap, recovery and exceptional engineering work.
- Role bootstrap and removal require a controlled runbook.

## Rejected alternatives

- Client-only route protection: rejected because it provides no database security boundary.
- Embedding a service-role key in the browser: prohibited.
- Reimplementing result lifecycle rules in the UI: rejected because authoritative database logic already exists.
