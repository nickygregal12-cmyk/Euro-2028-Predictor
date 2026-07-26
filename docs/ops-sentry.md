# Sentry React SDK enablement

**Status:** official React SDK integrated but disabled by default.  
**Provider:** Sentry cloud.  
**SDK:** `@sentry/react` pinned in `package.json`.  
**Application boundary:** provider-neutral events from `src/services/observability/clientObservability.ts`.  
**Initialization:** `src/instrument.ts`, imported before the application entrypoint.  
**Adapter:** `src/services/observability/sentryReporter.ts`.

## Implemented baseline

The repository uses Sentry's supported React SDK rather than a hand-built envelope sender.

The enabled baseline is deliberately narrower than Sentry's broadest defaults:

- error monitoring through the existing pre-sanitised reporter boundary;
- React 19 caught, uncaught and recoverable error hooks;
- browser page-load and navigation tracing;
- production trace sampling at 10%;
- full trace sampling in non-production for verification;
- release and environment identity from `/release.json` inputs.

The following remain disabled:

- Session Replay;
- logging capture;
- profiling;
- automatic user context;
- automatic breadcrumbs;
- fetch/XHR tracing and distributed trace headers;
- resource child spans;
- source-map upload.

Source-map upload is a separate later hardening step because it requires a Sentry administrative auth token in the build environment and a reviewed artifact-retention policy.

## Safety model

Application errors are normalised before the Sentry adapter receives them. Email addresses, credentials, URL queries/fragments, local paths and raw database details are removed by `clientObservability.ts`.

The SDK is configured with:

- `sendDefaultPii: false`;
- no default integrations;
- only the explicitly configured browser-tracing integration;
- `maxBreadcrumbs: 0`;
- no trace propagation targets;
- a `beforeSend` gate that drops any error not marked as a controlled Euro 2028 event;
- a transaction scrubber that replaces paths with a controlled route category and removes child spans, user, request and breadcrumb data.

Sentry must not receive:

- user identity, email address or IP address;
- full request URLs, query strings or fragments;
- cookies, authorization headers, access tokens or refresh tokens;
- prediction, bracket, league, result or Auth payloads;
- raw PostgreSQL or PostgREST error detail;
- DOM interaction history or Replay data.

Reporter failures remain isolated by the provider-neutral boundary and cannot stop application startup or normal use.

## Required Sentry project settings

Create or select a dedicated JavaScript/React project for Euro 2028 Predictor. Before sending any event:

1. restrict project access to the repository owner and named backup operator;
2. enable Sentry's default server-side data scrubbing;
3. enable IP-address scrubbing;
4. record the selected Sentry data region and applicable data-processing terms;
5. choose and record a retention duration;
6. leave Replay, profiling, logs and automatic user-context collection disabled;
7. disable public issue sharing;
8. record the deletion/export process and backup alert recipient.

Do not place a Sentry API auth token in the application, repository or Netlify browser environment. API tokens are administrative credentials. The browser SDK uses only the project's public browser DSN.

## Netlify variables

The browser DSN is visible in the compiled client bundle by design. Configure it through Netlify rather than committing it to source.

### Stage 1 — deploy previews only

Create these variables for the **deploy-preview** context only, using the Netlify **builds** scope:

```text
VITE_SENTRY_ENABLED=true
VITE_SENTRY_DSN=<the Sentry browser DSN>
VITE_SENTRY_VERIFICATION_EVENT=true
```

`VITE_SENTRY_VERIFICATION_EVENT` emits one non-sensitive controlled event during preview startup. It is ignored in production even if accidentally present.

Leave all three variables unset in production during preview verification.

The repository CSP permits only these Sentry cloud ingestion hosts:

- `*.ingest.sentry.io`;
- `*.ingest.us.sentry.io`;
- `*.ingest.de.sentry.io`.

A DSN using another host is rejected and requires a separately reviewed CSP and privacy change.

### Stage 2 — production

After preview verification, remove `VITE_SENTRY_VERIFICATION_EVENT` from deploy-preview and configure only these variables for **production**:

```text
VITE_SENTRY_ENABLED=true
VITE_SENTRY_DSN=<the approved production project browser DSN>
```

Production enablement requires separate owner approval after PR merge and post-merge production smoke evidence.

Never change Supabase values or the application/database contract as part of Sentry enablement.

## Synthetic preview verification

Use an approved deploy preview that reports:

- `environment: deploy-preview`;
- application and hosted contract 35;
- development Supabase `iouzoutneyjpugbbtdem`;
- the exact preview commit.

After the preview rebuilds with the three Stage 1 variables, confirm that one issue titled `Synthetic Sentry SDK verification event.` appears.

Verify the stored error event contains only:

- controlled source and route category;
- preview environment and exact release commit;
- application/hosted contract 35;
- development Supabase project reference;
- the already-redacted error name, message and stack;
- Sentry SDK metadata required to process the event.

Verify these fields are absent:

- user and request objects;
- email, IP address and cookies;
- query string or fragment;
- prediction or database payload;
- automatic breadcrumbs;
- Replay data.

Verify tracing separately:

- a page-load or navigation trace is present;
- its transaction name is only a controlled route category such as `home`, `auth` or `predictor`;
- it has no fetch/XHR or resource child spans;
- it contains no full URL, query string, user or request payload.

Also verify that an invalid, blocked or disabled DSN does not prevent the preview from loading.

## Production verification

After a separately reviewed production configuration change:

1. confirm `/release.json` identifies production, contract 35 and production Supabase `vkfnsqdyhvtwyqkisxhk`;
2. run `npm run smoke:production`;
3. run `npm run smoke:production:browser`;
4. confirm one controlled production synthetic event without user data;
5. inspect both error and trace fields against this runbook;
6. confirm the application continues normally if Sentry is blocked or rate-limited;
7. retain a dated non-secret evidence record.

## Alert ownership

Initial alert owner: repository owner `nickygregal12-cmyk`.

Before public launch, record:

- one backup recipient;
- escalation path and response window;
- incident severity definitions;
- alert thresholds that avoid noise.

Recommended actionable alerts are limited to startup failures, repeated route-affecting client errors and deployment failures. The GitHub production-smoke workflow remains the authority for wrong release identity, security headers, routes and Supabase isolation.

No alert may automatically repair data, apply a migration, reset Supabase or switch environments.
