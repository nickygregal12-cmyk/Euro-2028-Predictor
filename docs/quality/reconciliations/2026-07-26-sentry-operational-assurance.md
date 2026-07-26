# Sentry operational-assurance implementation

**Date:** 26 July 2026  
**Scope:** issue #91 continuation after merged PR #92.  
**Status:** repository implementation under review; provider delivery remains disabled.

## Purpose

Continue the contract-35 operational-assurance work without changing database schema, tournament rules or retained user data.

PR #92 established safe release identity, a provider-neutral client-error boundary, redaction, failure isolation and anonymous smoke commands. This change adds an opt-in Sentry transport and a durable post-merge production smoke workflow while preserving the original privacy and approval gates.

## Repository changes

- add a Sentry cloud envelope transport beneath the existing provider-neutral reporter interface;
- require explicit `VITE_SENTRY_ENABLED=true` and a valid browser DSN before registration;
- reject non-HTTPS, credential-bearing, non-numeric-project or non-approved ingest DSNs;
- transmit only the already-sanitised client event envelope;
- omit user, request and breadcrumb objects;
- keep Replay, tracing, profiling and automatic context collection absent;
- add focused DSN, payload-boundary and provider-failure tests;
- permit only approved Sentry cloud ingest hosts in CSP `connect-src`;
- add a `main`-push GitHub workflow that waits for the exact Netlify production commit and runs both anonymous production smoke commands;
- document staged deploy-preview verification and the separate production approval gate.

## Privacy boundary

The transport does not receive raw application errors. It receives the output of `normaliseClientError`, which redacts email addresses, credentials, URL queries/fragments, local paths and database details before provider code runs.

The outbound event contains only:

- controlled source and route category;
- safe release identity;
- redacted error name, message and stack;
- application and hosted contract identity;
- Supabase project reference.

It does not contain user identity, IP address, request URL, cookies, authorization data, predictions, brackets, leagues, results, Auth payloads or raw database errors.

## Deployment boundary

No Sentry DSN or API token is committed. No Netlify environment variable is changed by this repository branch. Production delivery remains disabled unless the owner separately configures production-scoped variables after non-production verification.

The Sentry browser DSN is an ingestion address intended for client use. Administrative Sentry API tokens remain prohibited from the client, repository and Netlify browser environment.

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
- review that no package, migration, SQL, scoring or stored-data change is present;
- review CSP host scope and the Sentry payload test evidence.

## Required hosted follow-up

1. create or select the dedicated Sentry project;
2. approve access, data region, processing terms and retention;
3. enable default data scrubbing and IP scrubbing;
4. configure the DSN for deploy previews only;
5. send one non-sensitive synthetic preview event and inspect every stored field;
6. verify blocked/rate-limited Sentry delivery cannot affect application use;
7. approve production configuration separately;
8. after merge, retain the automatic production-smoke run and production synthetic-event evidence;
9. update current status, risk register, feature baseline, build TODO and issue #91.

## Explicit exclusions

- no production provider delivery yet;
- no Sentry API auth token;
- no Replay, tracing, profiling or source-map upload;
- no production user or permanent test account;
- no production mutation;
- no migration 36 or PR #76 change;
- no database, RLS, function, scoring or tournament-rule change.
