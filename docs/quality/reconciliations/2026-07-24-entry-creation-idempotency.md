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

`REL-006` is resolved. Reopen it only if concurrent first-use requests can again create duplicates, surface a raw unique conflict or fail to converge on the shared entry.

## Validation

Functional head `c1ee4d727ad7235e350d5e6c7c79072857834e58` passed CI run `30130735751`, Browser E2E run `30130735710` and a ready Netlify deploy preview. Final head `41853b5716764e953160e161a8dd4356bde1499b` passed CI run `30131321194`, Browser E2E run `30131321198` and the ready deploy preview, then PR #65 squash-merged as `cd517f6f0fba48aaf54c16ee444671db29bd2741` and issue #64 closed. Closure-document commit `09c32f3e9a59256a1afd211acc3f8e5ba14c4d4e` passed the guarded build, lint, complete Vitest suite and production dependency audit in CI run `30131720921`. This documentation-only owner commit triggers standard validation on the final authority-document head.
