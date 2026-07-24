# Entry creation idempotency reconciliation

**Date:** 24 July 2026  
**Finding:** `REL-006`  
**Issue:** #64  
**Scope:** first-use entry creation for one authenticated user and tournament.

## Previous behaviour

`getOrCreateEntry` performed a read followed by an insert. Two tabs could both observe no entry and race into the unique `(user_id, tournament_id)` boundary. One request created the entry while the other surfaced a raw unique conflict instead of loading the row that now existed.

## Implemented

- first use now sends an upsert with `onConflict: 'user_id,tournament_id'` and `ignoreDuplicates: true`;
- the request that wins the insert returns the created entry directly;
- a concurrent request that receives a zero-row conflict result performs a normal authenticated read and returns the shared committed entry;
- RLS, authentication and the existing one-entry-per-user/tournament unique invariant remain authoritative;
- no schema or migration change is required.

## Executable evidence

`tests/services/predictionsEntryCreation.test.ts` verifies:

1. two concurrent callers resolve to the same public entry shape;
2. both use the idempotent conflict target;
3. the insert winner avoids an unnecessary fallback read;
4. real insert/RLS errors still surface without being disguised as concurrency.

`e2e/entry-creation.spec.ts` coordinates two independent browser contexts for one new disposable user. Both entry POST requests are held until they are simultaneously in flight, then released. The test requires both authenticated pages to reach Home successfully and service-role verification to find exactly one entry row.

## Safety boundary

This is a service-boundary, regression-test and quality-documentation change. It changes no scoring rule, database schema, migration history, hosted Supabase setting, production data, Netlify configuration, deployment-contract value, Turnstile configuration or legacy World Cup environment.

## Closure boundary

Keep `REL-006` open until the final pull-request head passes the guarded build, lint, complete Vitest suite, production dependency audit, Browser E2E and a ready Netlify preview, then merges to `main`.

## Validation

Functional head `c1ee4d727ad7235e350d5e6c7c79072857834e58` passed CI run `30130735751`, Browser E2E run `30130735710` and a ready Netlify deploy preview. The browser run rebuilt all committed migrations and seed data, released two coordinated first-use entry writes simultaneously, completed all established authenticated and recovery journeys, and cleaned up disposable data. This documentation-only follow-up triggers the standard gates on the final review head.
