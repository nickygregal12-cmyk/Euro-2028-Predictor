# Sentry operational-assurance implementation

**Date:** 26 July 2026  
**Scope:** issue #91 continuation after merged PR #92.  
**Status:** repository implementation under review; provider delivery remains disabled.

## Purpose

Continue the contract-35 operational-assurance work without changing database schema, tournament rules or retained user data.

PR #92 established safe release identity, a provider-neutral client-error boundary, redaction, failure isolation and anonymous smoke commands. PR #93 adds the official Sentry React SDK behind that boundary and a durable post-merge production smoke workflow while preserving the original privacy and approval gates.

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

No Sentry DSN or API token is committed. No Netlify environment variable is changed by this repository branch. Production delivery remains disabled unless the owner separately configures production-scoped variables after non-production verification.

The Sentry browser DSN is an ingestion address intended for client use. Administrative Sentry API tokens remain prohibited from the client and repository. A future source-map upload step would require a separately scoped build secret and approval.

## Production-smoke boundary

The new workflow runs only after a push to `main` or an explicit manual dispatch. It:

1. waits until `https://euro28predictor.com/release.json` reports the exact GitHub commit;
2. requires production context, contract 35 and production Supabase;
3. runs the committed HTTP smoke;
4. runs the anonymous Chromium smoke;
5. retains failure diagnostics for 14 days.

It performs no login, form submission, account creation or prediction mutation.

## Validation required before merge

- CI build/type-check, Oxlint, complete Vitest suite and dependency audit;
- Browser E2E disposable 35-migration rebuild and authenticated journeys;
- exact-head Netlify deploy-preview HTTP and browser smoke;
- review that no migration, SQL, scoring or stored-data change is present;
- review CSP host scope, SDK defaults and privacy-boundary tests;
- one Sentry deploy-preview event plus one trace inspected in the Sentry project.

## Required hosted follow-up

1. create or select the dedicated Sentry React project;
2. approve access, data region, processing terms and retention;
3. enable default data scrubbing and IP scrubbing;
4. configure the DSN, enable flag and synthetic-event flag for deploy previews only;
5. inspect the controlled error event and page-load/navigation trace field by field;
6. verify blocked or invalid Sentry delivery cannot affect application use;
7. remove the preview synthetic-event flag;
8. approve production configuration separately;
9. after merge, retain the automatic production-smoke run and controlled production-event evidence;
10. update current status, risk register, feature baseline, build TODO and issue #91.

## Explicit exclusions

- no production provider delivery yet;
- no Sentry API auth token or source-map upload;
- no Replay, logging or profiling;
- no fetch/XHR spans or distributed trace headers;
- no production user or permanent test account;
- no production mutation;
- no migration 36 or PR #76 change;
- no database, RLS, function, scoring or tournament-rule change.
