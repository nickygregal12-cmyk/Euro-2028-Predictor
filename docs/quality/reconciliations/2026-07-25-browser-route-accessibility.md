# Browser route-accessibility reconciliation

**Date:** 25 July 2026  
**Findings:** `A11Y-001`, `TEST-001`  
**Scope:** Repository and disposable browser evidence only

## Purpose

Retain the existing route-transition accessibility contract in the authenticated Playwright launch gate rather than relying only on component tests and Lighthouse output.

## Browser journey

`e2e/route-accessibility.spec.ts` runs in the existing desktop Chromium and Pixel 7 viewport projects against disposable local Supabase. It verifies that:

- the signed-in shell exposes `Skip to main content` as the first keyboard tab stop;
- Enter activates the skip link and focuses `#main-content`;
- the semantic Predict navigation link is keyboard-activatable;
- client-side navigation updates the document title;
- focus moves to the main region after navigation;
- the polite atomic live region announces the new route;
- the Groups control is keyboard-activatable;
- the dynamic Group A title and announcement are correct.

## Safety boundary

The journey uses the existing loopback-only Playwright and local Supabase guards. It does not change application runtime behaviour, production data, migrations, scoring, Netlify configuration or deployment contracts.

## Closure boundary

This provides retained keyboard and screen-reader-oriented DOM evidence in Browser E2E. It does not emulate a real assistive-technology speech experience. `A11Y-001` therefore remains partially resolved until a manual screen-reader journey confirms that announcements are useful, timely and non-duplicative.

Final CI, Browser E2E, preview and merge evidence will be recorded on PR #78 before promotion.
