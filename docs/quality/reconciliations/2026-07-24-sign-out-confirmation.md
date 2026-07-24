# Sign-out confirmation reconciliation

**Date:** 24 July 2026  
**Finding:** `UX-004`  
**Scope:** More-page sign-out action.

## Previous behavior

Selecting Sign out immediately called the Auth provider and cleared the session, making an accidental tap disruptive.

## Implemented

- the initial Sign out action opens the existing accessible destructive confirmation dialog;
- Cancel closes the dialog without calling sign-out;
- explicit confirmation calls the existing asynchronous sign-out function once;
- the confirm action exposes loading state and prevents repeated activation;
- the underlying Auth/session clearing behavior is unchanged.

## Executable evidence

`tests/features/more/MorePage.test.tsx` verifies:

- cancelling performs no sign-out and closes the dialog;
- confirming calls sign-out exactly once and closes after completion.

The implementation head passed dependency installation, both Netlify prebuild guards, production build, lint, the complete test suite and production dependency audit.

## Hosted evidence

Deploy preview `6a633b6b6dd92200083792d1` reached ready state with:

- performance: 98;
- accessibility: 100;
- best practices: 100;
- SEO: 100.

## Status

`UX-004` is resolved. Reopen if sign-out again clears the session without explicit confirmation, or if cancellation/duplicate-submit protection regresses.

## Safety boundary

No Supabase project, Auth configuration, database schema, migration history, production data, Netlify environment variable, deployment contract or legacy World Cup environment changed.
