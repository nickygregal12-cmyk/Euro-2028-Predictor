# Sign-out confirmation reconciliation

**Date:** 24 July 2026  
**Finding:** `UX-004`  
**Scope:** More-page sign-out action.

## Previous behaviour

Selecting Sign out immediately called the Auth provider and cleared the session. An accidental tap could therefore end an authenticated session without a reversible confirmation step.

## Implemented

- the initial Sign out action opens the existing accessible destructive confirmation dialog;
- Cancel, Escape and backdrop dismissal leave the session untouched;
- explicit confirmation calls the existing asynchronous sign-out function once;
- the confirm action exposes loading state and blocks cancellation or duplicate activation while pending;
- successful sign-out closes the dialog;
- failed sign-out keeps the dialog open and displays a stable retry message without exposing provider details;
- established two-device Browser E2E login helpers explicitly confirm the same visible dialog;
- the underlying Auth/session boundary is unchanged.

## Executable evidence

`tests/features/more/MorePage.test.tsx` verifies:

1. cancellation performs no sign-out;
2. explicit confirmation calls sign-out exactly once while pending;
3. success closes the dialog;
4. failure retains the dialog, hides raw provider details and permits a successful retry.

The existing bracket-conflict and locked-state browser journeys now pass through the confirmation dialog when changing authenticated users, so the full suite exercises the production interaction rather than bypassing it.

## Safety boundary

This is client interaction, regression coverage and quality documentation only. It changes no Supabase project, Auth configuration, database schema, migration history, production data, Netlify environment value, deployment contract or legacy World Cup environment.

## Closure boundary

Mark `UX-004` resolved only after the refreshed pull-request head passes the guarded build, lint, full test suite, production dependency audit, Browser E2E and a ready Netlify preview, then merges to `main`.

## Validation

CI run `30130136684` passed the guarded build, lint, complete Vitest suite and production dependency audit on the corrected implementation and browser-helper tree. This documentation-only follow-up commit triggers the standard CI, Browser E2E and Netlify checks on the final review head.
