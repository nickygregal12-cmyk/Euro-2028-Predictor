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

Implementation head `3f788e692de29ad0387afd96dff7285628ce62ed` passed install, guarded build, lint, the full test suite and production dependency audit.

## Hosted evidence

Two ready deploy previews of the same executable implementation were inspected:

| Deploy | Performance | Accessibility | Best practices | SEO |
| --- | ---: | ---: | ---: | ---: |
| `6a6336491e3ff80008295ea5` | 88 | 100 | 100 | 100 |
| `6a6337448ec0ba00089f2cd4` | 98 | 100 | 100 | 100 |

The repeat build reused the same executable assets and returned the recent 98 performance baseline, so the isolated 88 result is treated as run variance rather than evidence of a repeatable regression. Secret scanning found no matches; neither preview deployed functions or edge functions.

## Remaining closure boundary

`A11Y-001` is **partially resolved**. Repository implementation and automated preview evidence are present, but full closure still requires:

1. a real keyboard journey verifying the skip link and focus order across primary routes;
2. a screen-reader journey verifying route announcements are useful and non-duplicative;
3. retention of these behaviours in authenticated browser E2E.

The authenticated browser journey remains part of the wider `TEST-001` gap. No production database, Auth, Netlify environment or release-contract change is included.
