# Route-transition accessibility reconciliation

**Date:** 24 July 2026  
**Finding:** `A11Y-001`  
**Scope:** Repository and deploy-preview implementation only

## Implemented

- the persistent signed-in shell exposes a keyboard-visible `Skip to main content` link;
- the main content region has a stable `main-content` target and programmatic focus boundary;
- client-side routes receive route-specific document titles;
- route changes are announced through a polite, atomic live region;
- focus moves to the signed-in main region after client-side navigation;
- initial page load does not steal focus from the browser or an authentication form;
- dynamic group routes and unknown routes receive meaningful names.

## Executable evidence

The branch test suite covers:

- static, dynamic and unknown route-title resolution;
- document-title updates;
- polite live-region output;
- focus movement after client-side navigation;
- the skip-link destination and focusable main target.

Head `3f788e692de29ad0387afd96dff7285628ce62ed` passed install, guarded build, lint, the full test suite and production dependency audit.

## Hosted evidence

Deploy preview `6a6336491e3ff80008295ea5` reached `ready` with accessibility, best-practices and SEO scores of 100. Its first Lighthouse performance sample was 88 versus the recent 98 baseline. The implementation adds only a small eager route controller and CSS, so the variance requires a second final-head sample before merge rather than being dismissed or attributed to the accessibility change without evidence.

## Remaining closure boundary

`A11Y-001` remains **partially resolved** until:

1. the final PR head passes all repository checks and a ready preview;
2. a real keyboard journey verifies skip-link and focus behavior across primary routes;
3. a screen-reader journey verifies route announcements are useful and non-duplicative.

The authenticated browser journey remains part of the wider `TEST-001` gap. No production database, Auth, Netlify environment or release-contract change is included.
