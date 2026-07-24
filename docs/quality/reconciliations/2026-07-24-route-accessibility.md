# Route accessibility reconciliation

**Date:** 24 July 2026  
**Finding:** `A11Y-001`  
**Scope:** Client-side route transitions and the persistent signed-in application shell.

## Implemented

- `RouteAccessibility` assigns a route-specific browser title for every current route, including dynamic group-prediction routes and unknown paths.
- A polite, atomic live region announces the loaded route.
- Client-side route changes move focus to the persistent `#main-content` region after navigation.
- Initial page load does not steal focus from the browser or authentication forms.
- `PageShell` provides a keyboard-visible “Skip to main content” link.
- The main region has a stable ID and programmatic focus target.

## Executable evidence

`tests/app/RouteAccessibility.test.tsx` verifies:

- static, dynamic and unknown route-title resolution;
- document-title updates;
- polite atomic announcements;
- focus transfer after client-side navigation.

`tests/design-system/PageShell.test.tsx` verifies:

- the skip link targets `#main-content`;
- the main landmark exposes the stable ID and `tabIndex=-1` focus target.

The implementation head passed:

- dependency installation;
- both Netlify prebuild guards;
- TypeScript/Vite production build;
- lint;
- the complete test suite;
- production dependency audit.

## Hosted verification

The first ready deploy preview retained:

- accessibility: 100;
- best practices: 100;
- SEO: 100.

Its single Lighthouse performance measurement was 88 against the production reference of 98. The route controller is a small eager module with no network request or render-loop work, but this variance is not treated as resolved by assumption. A fresh preview of the final documentation head is required before merge; persistent degradation must be investigated rather than dismissed as noise.

## Closure boundary

`A11Y-001` may be recorded as resolved when the exact final head remains CI-green and its ready preview preserves the accessibility contract without a repeatable performance regression. Authenticated multi-route browser journeys remain part of the wider `TEST-001` gap and are not claimed here.

## Safety boundary

No Supabase project, Auth setting, database schema, migration history, production data, Netlify environment variable, deployment contract or legacy World Cup environment changed.
