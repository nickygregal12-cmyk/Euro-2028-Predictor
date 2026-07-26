# Sentry operational-assurance implementation

**Date:** 26 July 2026  
**Scope:** issue #91 continuation after merged PRs #92 and #93.  
**Status:** production Sentry delivery and privacy-safe tracing verified; alert/retention ownership and actual rollback promotion rehearsal remain open.

## Purpose

Complete privacy-safe client observability for the contract-35 production application without changing database schema, tournament rules or retained user data.

PR #92 established safe release identity, a provider-neutral client-error boundary, redaction, failure isolation and anonymous smoke commands. PR #93 added the official Sentry React SDK behind that boundary and a durable post-merge production smoke workflow.

## Implemented boundary

- `@sentry/react` is pinned and initialised before application startup;
- React 19 caught, uncaught and recoverable errors pass through the provider-neutral reporter;
- Sentry requires explicit enablement and a valid approved cloud browser DSN;
- application errors are normalised before provider code receives them;
- browser tracing is limited to page-load and navigation timing;
- transaction names are reduced to controlled route categories;
- default integrations, automatic breadcrumbs, fetch/XHR tracing, trace propagation, resource child spans, Replay, logs and profiling are disabled;
- SDK error events not marked as controlled pre-sanitised Euro 2028 events are dropped;
- reporter failures cannot prevent startup or normal application use;
- CSP permits only approved Sentry cloud ingestion hosts.

## Privacy boundary

The SDK adapter receives only the output of `normaliseClientError`, which removes email addresses, credentials, URL queries/fragments, local paths and raw database details before provider delivery.

Controlled error events may contain only:

- controlled source and route category;
- safe release identity;
- redacted error name, message and stack;
- application and hosted contract identity;
- Supabase project reference;
- minimum Sentry SDK metadata needed for processing and grouping.

Sentry must not receive:

- user identity, email address or IP address;
- full request URLs, query strings or fragments;
- cookies, authorization headers, access tokens or refresh tokens;
- predictions, brackets, leagues, results or Auth payloads;
- raw PostgreSQL or PostgREST detail;
- DOM interaction history or Replay data.

## Netlify configuration

No Sentry API token is committed or exposed to browser code.

Deploy previews use build-scoped:

- `VITE_SENTRY_ENABLED=true`;
- the approved public browser DSN;
- `VITE_SENTRY_VERIFICATION_EVENT=false` after the one-time verification event was received.

After explicit owner approval, production uses build-scoped:

- `VITE_SENTRY_ENABLED=true`;
- the approved public browser DSN.

`VITE_SENTRY_VERIFICATION_EVENT` is not configured for production. Replay, logging, profiling, automatic breadcrumbs, fetch/XHR tracing, trace propagation and source-map upload remain disabled.

Production Supabase remains `vkfnsqdyhvtwyqkisxhk`; non-production contexts remain on development Supabase `iouzoutneyjpugbbtdem`. No Supabase variable or database contract changed as part of Sentry enablement.

## Hosted evidence

### Deploy-preview verification

- the controlled issue `Synthetic Sentry SDK verification event.` was received from the exact-head deploy preview;
- the stored preview event was manually inspected and confirmed to contain no User, Request or Breadcrumbs data;
- the one-time verification flag was disabled;
- the subsequent preview emitted no repeat synthetic issue and passed HTTP/browser smoke;
- Lighthouse recovered to performance 96, accessibility 100, best practices 100 and SEO 100.

### Production activation

- PR #93 was squash-merged as `da83fff5805a11164eed14c339e56fe2e3c08446`;
- production Sentry activation was recorded by documentation-only commit `87a09056f8392d6b3d58604726e97e07cfc7a555`;
- Netlify production deploy `6a65ca6f00d3210008154d07` is ready and serves that exact commit;
- deploy context is production on branch `main`;
- plugin processing succeeded;
- secret scanning found no matches across 527 files;
- Lighthouse reported performance 96, accessibility 100, best practices 100 and SEO 100;
- production remains application/database contract 35.

### Production Sentry trace

Manual provider inspection confirmed a production trace with:

- environment `production`;
- release `87a09056f839…`;
- trace root category `auth`;
- operation `pageload`;
- exactly one span;
- root duration approximately 284 ms;
- no full URL as the transaction name;
- no fetch/XHR or resource child spans;
- no visible User, Request or Breadcrumbs data;
- no visible email, IP address or query-string data.

This is accepted evidence that controlled production page-load tracing is working within the approved privacy boundary.

## Validation completed

- CI run 464 passed build/type-check, Oxlint, the complete Vitest suite and production dependency audit;
- Browser E2E run 178 passed the disposable 35-migration rebuild, authenticated journeys, signup and password recovery;
- exact-head deploy-preview HTTP and browser smoke passed;
- production deployment identity and environment isolation were verified;
- controlled preview error delivery and production trace delivery were manually inspected;
- no migration, SQL, RLS, function, scoring, tournament-rule or retained-data change occurred.

## Operational policy pending owner completion

Recommended initial policy:

- primary alert owner: repository owner `nickygregal12-cmyk`;
- backup alert recipient: **not yet named — owner input required**;
- Sentry event retention: use the shortest practical project/account retention offered, target 30 days where configurable;
- server-side default data scrubbing and IP-address scrubbing must remain enabled;
- public issue sharing must remain disabled;
- severity 1: site unavailable, startup failure or widespread auth failure — investigate immediately;
- severity 2: repeated route-affecting client error — investigate within one working day;
- severity 3: isolated non-blocking error — review during routine maintenance;
- no alert may automatically modify data, apply migrations, reset Supabase or switch environments.

The exact retained duration and named backup recipient must be recorded from the Sentry account settings before issue #91 can be fully closed.

## Rollback position

The rollback decision tree and compatible previous production deploy evidence exist. A real promotion rehearsal has **not** been performed because the available automation cannot republish an older Netlify deploy and restore the current deploy safely as one controlled transaction.

A future owner-approved rehearsal must:

1. identify a known compatible contract-35 deploy;
2. confirm its immutable deploy URL, release identity and production Supabase reference;
3. publish that deploy without changing any Supabase variable;
4. run release-identity, security-header, SPA-route and anonymous browser smoke;
5. republish the current approved deploy;
6. rerun the same smoke checks;
7. retain deploy IDs, timestamps and results.

Application rollback must never point production at development Supabase and must not alter database migrations or retained data.

## Remaining closure items for issue #91

1. record the actual Sentry retention setting and confirm server-side/IP scrubbing;
2. name one backup alert recipient and record the escalation route;
3. retain the push-triggered Production Smoke conclusion where accessible;
4. perform the owner-approved Netlify rollback promotion rehearsal;
5. reconcile `current-status.md`, `risk-register.md`, `feature-baseline.md` and `build-todo.md` after those final controls are evidenced.

## Explicit exclusions preserved

- no Sentry API auth token or source-map upload;
- no Session Replay, logging or profiling;
- no automatic breadcrumbs;
- no fetch/XHR spans or distributed trace headers;
- no production synthetic verification flag;
- no production user or permanent test account;
- no production mutation;
- no migration 36 or PR #76 change;
- no database, RLS, function, scoring or tournament-rule change.
