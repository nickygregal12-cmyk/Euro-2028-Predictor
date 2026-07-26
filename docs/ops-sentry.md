# Sentry provider enablement

**Status:** transport implemented but disabled by default.  
**Provider:** Sentry cloud.  
**Application boundary:** provider-neutral events from `src/services/observability/clientObservability.ts`.  
**Transport:** `src/services/observability/sentryReporter.ts`.

## Safety model

Sentry receives only the already-sanitised client event envelope. The transport does not enable or send:

- user identity, email address or IP address;
- request URLs, query strings or fragments;
- cookies, authorization headers, access tokens or refresh tokens;
- prediction, bracket, league, result or Auth payloads;
- raw PostgreSQL or PostgREST error detail;
- automatic breadcrumbs;
- session replay;
- performance tracing;
- profiling or user feedback attachments.

Reporter failures are isolated by the existing observability boundary and cannot stop application startup or normal use.

## Required Sentry project settings

Create or select a dedicated JavaScript/React project for Euro 2028 Predictor. Before sending any event:

1. restrict project access to the repository owner and named backup operator;
2. enable Sentry's default server-side data scrubbing;
3. enable IP-address scrubbing;
4. record the selected Sentry data region and applicable data-processing terms;
5. choose and record a retention duration;
6. leave Replay, tracing, profiling and automatic user-context collection disabled;
7. disable public issue sharing;
8. record the deletion/export process and backup alert recipient.

Do not place a Sentry API auth token in the application, repository or Netlify browser environment. API tokens are administrative credentials. The browser transport uses only the project's public browser DSN.

## Netlify variables

The browser DSN is expected to be visible in the compiled client bundle. It is an ingestion address, not an administrative API token, but it must still be configured through Netlify rather than committed to source.

### Stage 1 — deploy previews only

Create these variables for the **deploy-preview** context only:

```text
VITE_SENTRY_ENABLED=true
VITE_SENTRY_DSN=<the Sentry browser DSN>
```

Use the Netlify **builds** scope. Leave both variables unset in production during preview verification.

The repository CSP permits only Sentry cloud ingestion hosts:

- `*.ingest.sentry.io`;
- `*.ingest.us.sentry.io`;
- `*.ingest.de.sentry.io`.

A DSN using another host is rejected by the client transport and requires a separately reviewed CSP and privacy change.

### Stage 2 — production

Set the same two variables in the **production** context only after all preview checks below pass and the owner explicitly approves production delivery.

Never reuse development Supabase values in production and never change the application/database contract as part of Sentry enablement.

## Synthetic preview verification

Use an approved deploy preview that reports:

- `environment: deploy-preview`;
- application and hosted contract 35;
- development Supabase `iouzoutneyjpugbbtdem`;
- the exact preview commit.

Open the preview's browser console and dispatch one non-sensitive synthetic error:

```js
window.dispatchEvent(
  new ErrorEvent('error', {
    error: new Error('EURO28 synthetic Sentry verification'),
  }),
)
```

Verify in Sentry that exactly the controlled fields are present:

- source `window-error`;
- controlled route category;
- preview environment and exact release commit;
- application/hosted contract 35;
- development Supabase project reference;
- redacted error name, message and stack only.

Verify these fields are absent:

- user and request objects;
- email, IP address and cookies;
- query string or fragment;
- prediction or database payload;
- automatic breadcrumbs;
- Replay or trace data.

Also verify that an invalid or disabled DSN does not prevent the preview from loading.

## Production verification

After a separately reviewed production configuration change:

1. confirm `/release.json` identifies production, contract 35 and production Supabase `vkfnsqdyhvtwyqkisxhk`;
2. run `npm run smoke:production`;
3. run `npm run smoke:production:browser`;
4. dispatch one production synthetic event containing no user data;
5. confirm Sentry receives production release identity and no prohibited fields;
6. confirm the application continues normally if the Sentry endpoint is blocked or rate-limited;
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
