# Safe user-facing error reconciliation

**Date:** 25 July 2026  
**Finding:** `SEC-002`  
**Implementation:** PR #71, squash merge `1a52f6239083f5dfa6690cb638ac32183f53a1c7`

## Resolution

The application now routes identified user-visible database, RPC, authentication-adjacent and network failures through `src/shared/errors/userFacingError.ts` rather than rendering arbitrary exception messages.

The mapper provides stable copy for network failures, expired sessions, rate limits, permission failures and stale/conflicting writes. Unknown failures return only operation-specific static fallbacks. Raw PostgreSQL/PostgREST details, SQL fragments, table or constraint names, RLS policy text and arbitrary exception strings are not returned to users.

The migrated surfaces include prediction submission, tournament data loading, match-centre prediction loading, private-league create/join/transfer/detail actions, dashboard data, profiles, head-to-head and overall/private standings.

## Executable evidence

- focused mapper tests cover representative internal database and arbitrary-error payloads;
- a source-boundary regression prevents direct unknown `.message` rendering from returning to the migrated UI files;
- owner-authored PR head `c40d2a430abd5add7f61d1c80ed4617eefc74f22` passed CI run `30135618430`, including Git-less hygiene, guarded build, lint, the complete Vitest suite and production dependency audit;
- Browser E2E run `30135618409` passed authenticated journeys, signup/password recovery and disposable-data teardown;
- the Netlify deploy preview reached ready state.

## Scope boundary

No migration, schema, scoring, production data, hosted Supabase setting, Netlify configuration, deployment contract, Turnstile configuration or legacy World Cup environment was changed.

## Verdict

`SEC-002` is **resolved**. Reopen if any user-visible application path again renders arbitrary internal error text or bypasses the shared safe-message boundary.
