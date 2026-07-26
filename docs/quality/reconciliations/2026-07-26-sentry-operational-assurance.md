# Sentry operational-assurance implementation

**Date:** 26 July 2026  
**Scope:** issue #91 continuation after merged PR #92.  
**Status:** repository and deploy-preview delivery verified; production Sentry configuration approved and enabled; fresh production verification in progress.

## Purpose

Continue the contract-35 operational-assurance work without changing database schema, tournament rules or retained user data.

PR #92 established safe release identity, a provider-neutral client-error boundary, redaction, failure isolation and anonymous smoke commands. PR #93 added the official Sentry React SDK behind that boundary and a durable post-merge production smoke workflow while preserving the original privacy and approval gates.

## Repository changes

- install and pin `@sentry/react`;
- initialise Sentry from `src/instrument.ts` before application startup;
- use React 19 root error hooks while preserving the existing recovery screen;
- retain the provider-neutral reporter as the only error-delivery entrypoint;
- require explicit `VITE_SENTRY_ENABLED=true` and a valid browser DSN before SDK initialisation;
- reject non-HTTPS, credential-bearing, non-numeric-project or non-approved ingest DSNs;
- enable browser page-load/navigation tracing with production sampling at 10%;
- disable default integrations, automatic breadcrumbs, fetch/XHR tracing, trace propagation, resource spans, Replay, logs and profiling;
- drop any SDK error event that did not originate from the controlled pre-sanitised reporter;
- reduce traces to controlled route categories without child spans or request/user data;
- add focused DSN, SDK-adapter, event-boundary and tracing-boundary tests;
- permit only approved Sentry cloud ingest hosts in CSP `connect-src`;
- add a `main`-push GitHub workflow that waits for the exact Netlify production commit and runs both anonymous production smoke commands;
- document staged deploy-preview verification and the separate production approval gate.

## Privacy boundary

The SDK adapter does not receive raw application errors. It receives the output of `normaliseClientError`, which redacts email addresses, credentials, URL queries/fragments, local paths and database details before provider code runs.

Controlled error events contain only:

- controlled source and route category;
- safe release identity;
- redacted error name, message and stack;
- application and hosted contract identity;
- Supabase project reference;
- minimum Sentry SDK metadata required for ingestion and grouping.

Browser tracing is limited to page-load/navigation timing. Transaction names are replaced with controlled route categories, child spans are removed and fetch/XHR instrumentation plus trace propagation are disabled.

The SDK is configured with `sendDefaultPii: false`, no automatic breadcrumbs and no default integrations. It must not send user identity, IP address, request URL, cookies, authorization data, predictions, brackets, leagues, results, Auth payloads or raw database errors.

## Deployment boundary

No Sentry DSN or API token is committed. On 26 July 2026, the public browser DSN and SDK enable flag were first configured in Netlify for the `deploy-preview` context and `builds` scope only. The one-time preview synthetic verification flag was enabled for evidence collection, then set back to `false` immediately after receipt was confirmed.

After explicit owner approval, Netlify production build variables were configured with only:

- `VITE_SENTRY_ENABLED=true`;
- the approved public browser DSN.

`VITE_SENTRY_VERIFICATION_EVENT` remains disabled and is not enabled for production. Replay, logging, profiling, automatic breadcrumbs, fetch/XHR tracing, trace propagation and source-map upload remain disabled.

The Sentry browser DSN is an ingestion address intended for client use. Administrative Sentry API tokens remain prohibited from the client and repository. A future source-map upload step would require a separately scoped build secret and approval.

## Production-smoke boundary

The workflow runs only after a push to `main` or an explicit manual dispatch. It:

1. waits until `https://euro28predictor.com/release.json` reports the exact GitHub commit;
2. requires production context, contract 35 and production Supabase;
3. runs the committed HTTP smoke;
4. runs the anonymous Chromium smoke;
5. retains failure diagnostics for 14 days.

It performs no login, form submission, account creation or prediction mutation.

## Validation completed

- CI run 464 passed build/type-check, Oxlint, the complete Vitest suite and production dependency audit;
- Browser E2E run 178 passed the disposable 35-migration rebuild, authenticated journeys, signup and password recovery;
- exact-head Netlify deploy-preview HTTP and browser smoke passed;
- the controlled Sentry issue `Synthetic Sentry SDK verification event.` was received from the exact-head deploy preview;
- the stored preview event was confirmed to contain no User, Request or Breadcrumbs data;
- the one-time verification flag was disabled and the subsequent preview passed again;
- PR #93 was squash-merged as `da83fff5805a11164eed14c339e56fe2e3c08446`;
- the immediate production deployment for that merge was ready and matched the exact commit;
- no migration, SQL, scoring or stored-data change is present;
- CSP host scope, SDK defaults and privacy-boundary tests passed repository review.

## Remaining hosted verification

1. allow the fresh production deployment to complete with the approved production-only Sentry variables;
2. retain the automatic exact-commit production HTTP and browser smoke result;
3. confirm controlled production page-load/navigation traces appear in Sentry;
4. inspect production trace fields for prohibited data and confirm route-category naming;
5. confirm one naturally occurring or separately controlled production error is delivered through the sanitised reporter boundary without user/request/breadcrumb data;
6. confirm application use remains unaffected if Sentry delivery is blocked or rate-limited;
7. record Sentry retention, server-side scrubbing, backup alert recipient and escalation policy;
8. rehearse and retain application rollback evidence;
9. update current status, risk register, feature baseline, build TODO and issue #91.

## Explicit exclusions

- no production synthetic verification event flag;
- no Sentry API auth token or source-map upload;
- no Replay, logging or profiling;
- no fetch/XHR spans or distributed trace headers;
- no production user or permanent test account;
- no production mutation;
- no migration 36 or PR #76 change;
- no database, RLS, function, scoring or tournament-rule change.
