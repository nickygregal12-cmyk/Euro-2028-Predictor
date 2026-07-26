# Sentry operational-assurance implementation

**Date:** 26 July 2026  
**Scope:** issue #91 continuation after merged PR #92.  
**Status:** repository implementation validated; deploy-preview Sentry verification configured; production delivery remains disabled.

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

No Sentry DSN or API token is committed. On 26 July 2026, the public browser DSN, SDK enable flag and synthetic verification flag were configured in Netlify for the `deploy-preview` context and `builds` scope only. Production-scoped Sentry variables remain unset.

The Sentry browser DSN is an ingestion address intended for client use. Administrative Sentry API tokens remain prohibited from the client and repository. A future source-map upload step would require a separately scoped build secret and approval.

## Production-smoke boundary

The new workflow runs only after a push to `main` or an explicit manual dispatch. It:

1. waits until `https://euro28predictor.com/release.json` reports the exact GitHub commit;
2. requires production context, contract 35 and production Supabase;
3. runs the committed HTTP smoke;
4. runs the anonymous Chromium smoke;
5. retains failure diagnostics for 14 days.

It performs no login, form submission, account creation or prediction mutation.

## Validation completed

- CI run 462 passed build/type-check, Oxlint, the complete Vitest suite and production dependency audit;
- Browser E2E run 176 passed the disposable 35-migration rebuild, authenticated journeys, signup and password recovery;
- exact-head Netlify deploy-preview HTTP and browser smoke passed;
- no migration, SQL, scoring or stored-data change is present;
- CSP host scope, SDK defaults and privacy-boundary tests passed repository review.

## Remaining hosted verification

1. allow the new exact-head deploy preview to build with the deploy-preview-only Sentry variables;
2. confirm the controlled synthetic error appears in Sentry;
3. confirm one controlled page-load/navigation trace appears;
4. inspect the event and trace field by field for prohibited data;
5. verify blocked or invalid Sentry delivery cannot affect application use;
6. remove `VITE_SENTRY_VERIFICATION_EVENT` from deploy previews after evidence is retained;
7. approve production configuration separately;
8. after merge, retain the automatic production-smoke run and controlled production-event evidence;
9. update current status, risk register, feature baseline, build TODO and issue #91.

## Explicit exclusions

- no production provider delivery yet;
- no Sentry API auth token or source-map upload;
- no Replay, logging or profiling;
- no fetch/XHR spans or distributed trace headers;
- no production user or permanent test account;
- no production mutation;
- no migration 36 or PR #76 change;
- no database, RLS, function, scoring or tournament-rule change.
