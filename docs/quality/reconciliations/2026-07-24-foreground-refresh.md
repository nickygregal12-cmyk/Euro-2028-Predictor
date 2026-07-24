# Foreground refresh reconciliation

**Date:** 24 July 2026  
**Finding:** `REL-005`  
**Issue:** #67  
**Scope:** authenticated pages returning from a genuine hidden/background state.

## Previous behaviour

Tournament reference data and the current user's persisted entry were loaded when their provider context changed. A page left open while another tab/device or an administrator changed data could remain convincingly stale until a manual reload or navigation reconstructed the provider.

## Implemented contract

- a shared hook records a genuine hidden/background transition and runs once when the document becomes visible/focused again;
- visibility and focus events for the same return are deduplicated;
- tournament reference data refreshes in the background without replacing ready content with a loading screen;
- a failed tournament refresh preserves the last valid ready snapshot;
- prediction refresh first flushes debounced work and waits for every save-controller key to settle;
- any error or conflict keeps local state untouched and skips the persisted-entry refresh;
- successful settlement refreshes entry submission state, match predictions, tie decisions, bracket progression and Golden Boot;
- per-slice `REL-002` revisions prevent a response from replacing an edit made while the refresh is in flight;
- concurrent foreground events share one in-flight refresh;
- no polling, realtime subscription or hosted configuration change is introduced.

## Executable evidence

- `tests/app/useReturnToForeground.test.tsx` verifies genuine-transition detection, event deduplication and latest-callback use;
- `tests/app/TournamentDataProvider.refresh.test.tsx` verifies no loading flash and fail-soft retention;
- `tests/app/PredictionsProvider.foregroundRefresh.test.tsx` verifies persisted change adoption, pending-save settlement and in-flight local-edit protection;
- `e2e/foreground-refresh.spec.ts` uses two pages for one disposable authenticated user, changes a score in the foreground page and requires the previously hidden page to display it after returning without a reload.

## Safety boundary

This is provider lifecycle, regression coverage and quality documentation only. It changes no schema, migration history, scoring rule, hosted Supabase setting, production data, Netlify configuration, deployment contract, Turnstile configuration or legacy World Cup environment.

## Closure boundary

`REL-005` is resolved. Reopen it only if a genuine foreground return can again leave valid tournament or persisted-entry data convincingly stale, overwrite unsettled/conflicted local work or introduce duplicate refreshes.

## Validation

Implementation head `8dac43c92b1757d12877e30603695d530b444fce` passed the guarded build, lint, complete Vitest suite and production dependency audit in CI run `30132387283`. Final head `1660fe42a9cb3a5111bb21eb809879c9586665f3` passed CI run `30133656106`, Browser E2E run `30133656077` and the ready Netlify preview. The browser suite proved a hidden page adopted a second page's persisted score after returning, completed all established authenticated and recovery journeys, and cleaned up disposable data. PR #68 then squash-merged as `4b1c4d4ae4f944687a28f431b60698c110b83586` and issue #67 closed.
