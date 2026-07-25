# Match Centre league-scope availability reconciliation

**Date:** 25 July 2026  
**Finding:** `UX-002`  
**Pull request:** #85  
**Scope:** Match Centre private-league scope discovery and retry

## Problem

Match Centre requested the user's private leagues to build its prediction-scope selector, but converted every failure into an empty array. That made an unavailable league source indistinguishable from a successful no-leagues account. A `?league=` deep link could also fall back to overall predictions without explaining why the requested scope was missing.

## Implemented boundary

- league-scope discovery now has explicit `loading`, `ready` and `unavailable` states;
- the selector appears only after a successful response containing leagues;
- a successful empty response remains a genuine no-selector state;
- an unavailable response displays a safe warning while preserving overall prediction distribution, the user's own pick and the rest of Match Centre;
- an unverified league selection falls back to overall rather than remaining as a stale hidden scope;
- retry refetches only the private-league source;
- a valid `?league=` request is restored after successful retry.

## Executable evidence

Focused page and presentational tests prove:

- successful empty scope data renders no selector and no unavailable warning;
- failed scope data renders a warning while overall predictions remain visible;
- the selector appears only after successful league data;
- retry invokes the league source independently and restores the requested league scope;
- league-specific prediction loading resumes after the scope is restored.

Final-head CI, Browser E2E and Netlify preview evidence are retained on PR #85 before promotion.

## Safety boundary

No migration, schema, RLS policy, RPC, scoring rule, stored prediction, production data, Supabase configuration, Netlify environment or deployment-contract value changed.

## Finding movement

`UX-002` remains **open but materially improved**. Home, League hub, own Profile and Match Centre league-scope discovery now distinguish unavailable sources from genuine zero or empty results. Remaining consumers still require review before closure.
