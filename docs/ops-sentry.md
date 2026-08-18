# Sentry React SDK operations

**Status:** official React SDK enabled for deploy previews and production; privacy-safe production trace delivery verified.  
**Provider:** Sentry cloud.  
**SDK:** `@sentry/react` pinned in `package.json`.  
**Application boundary:** provider-neutral events from `src/services/observability/clientObservability.ts`.  
**Initialization:** `src/instrument.ts`.  
**Adapter:** `src/services/observability/sentryReporter.ts`.

## Implemented baseline

The application uses Sentry's supported React SDK behind the existing sanitising reporter boundary.

Enabled:

- controlled error monitoring;
- React 19 caught, uncaught and recoverable error hooks;
- browser page-load/navigation tracing;
- production trace sampling at 10%;
- full non-production trace sampling for verification;
- safe release/environment identity.

Disabled:

- Session Replay;
- logging capture;
- profiling;
- automatic user context;
- automatic breadcrumbs;
- fetch/XHR tracing and distributed trace headers;
- resource child spans;
- source-map upload in ordinary builds.

The repository now has an optional trusted-build source-map uploader. It is
disabled in current hosted configuration until the build-only custody below is
deliberately configured and verified; ordinary builds do not generate or upload
source maps.

## Safety model

Application errors are normalised before the Sentry adapter receives them. The SDK uses:

- `sendDefaultPii: false`;
- no default integrations;
- only controlled browser tracing;
- `maxBreadcrumbs: 0`;
- no trace propagation targets;
- a `beforeSend` gate that drops any error not marked as a controlled Euro 2028 event;
- a transaction scrubber that replaces paths with controlled route categories and removes child spans, user, request and breadcrumb data.

Sentry must not receive:

- user identity, email address or IP address;
- full request URLs, query strings or fragments;
- cookies, authorization headers, access/refresh tokens;
- prediction, bracket, league, result or Auth payloads;
- raw PostgreSQL/PostgREST detail;
- DOM interaction history or Replay data.

Reporter failures remain isolated and cannot stop application startup or normal use.

## Current Netlify variables

The public browser DSN is visible in the compiled client bundle by design. No Sentry API/auth token belongs in browser variables or the repository.

### Deploy preview

Build-scoped:

```text
VITE_SENTRY_ENABLED=true
VITE_SENTRY_DSN=<approved public browser DSN>
VITE_SENTRY_VERIFICATION_EVENT=false
```

The one-time synthetic preview event was already received and inspected. The verification flag remains false to prevent repeated startup events.

Current preview release identity:

- environment `deploy-preview`;
- application/hosted contract = the repository contract at the PR head (44 today; see `config/deployment-contract.json`);
- development Supabase `iouzoutneyjpugbbtdem`;
- exact PR commit.

### Production

Build-scoped:

```text
VITE_SENTRY_ENABLED=true
VITE_SENTRY_DSN=<approved public browser DSN>
```

`VITE_SENTRY_VERIFICATION_EVENT` is not configured for production and is ignored there by application code even if accidentally supplied.

Current production release identity remains:

- environment `production`;
- application/hosted contract 38;
- final-target Supabase `vkfnsqdyhvtwyqkisxhk`.

Sentry operations do not alter Supabase variables or the database contract.

## Trusted source-map build

The official `@sentry/vite-plugin` runs only during a production build with the
explicit opt-in and all three upload values present:

```text
SENTRY_SOURCEMAPS_ENABLED=true
SENTRY_AUTH_TOKEN=<build-only project-release token>
SENTRY_ORG=<organisation slug>
SENTRY_PROJECT=<project slug>
```

These variables are not browser variables, must never use a `VITE_` prefix and
must be scoped to the trusted production deploy context. An auth token being in
scope by itself does nothing. If the explicit switch is true but one value is
missing, the build fails instead of publishing a release whose stacks cannot be
resolved.

The plugin and browser reporter share the exact release identity
`euro28@<commit>`. Trusted builds create hidden source maps, upload them, then
delete `dist/**/*.map` before the deployment artifact is published. Preview,
pull-request, local and ordinary production builds continue to generate no maps
when the switch is absent.

## Verified hosted evidence

Deploy preview:

- controlled synthetic issue received from the exact-head preview;
- stored event inspected with no User, Request or Breadcrumbs data;
- no repeat synthetic issue after the verification flag was set false;
- HTTP/browser smoke passed.

Production:

- explicit owner-approved activation was recorded;
- production deploy and release identity were verified;
- a production `pageload` trace with controlled `auth` route category was inspected;
- no full URL, fetch/XHR/resource child spans, User, Request, Breadcrumbs, email, IP or query-string data were visible;
- application/database contract remained 36 and production Supabase remained isolated.

Authority: `docs/quality/reconciliations/2026-07-26-sentry-operational-assurance.md`.

## Production verification

For the contract-38 production milestone:

```bash
EURO28_SMOKE_EXPECTED_CONTRACT=38 \
EURO28_SMOKE_EXPECTED_COMMIT="<approved-main-sha>" \
npm run smoke:production
EURO28_SMOKE_EXPECTED_CONTRACT=38 \
EURO28_SMOKE_EXPECTED_COMMIT="<approved-main-sha>" \
npm run smoke:production:browser
```

Confirm:

1. `/release.json` reports production, contract 38, the approved commit and production Supabase;
2. security headers, routes and assets pass;
3. no development Supabase request occurs;
4. production Sentry remains enabled without a synthetic verification event;
5. blocking/rate-limiting Sentry does not prevent application use.

## Remaining operating-policy work

The remaining gap is not provider delivery. Record:

1. actual Sentry retention duration;
2. confirmation of server-side default data scrubbing;
3. confirmation of IP-address scrubbing;
4. one named backup alert recipient;
5. escalation path and response windows;
6. durable milestone Production Smoke evidence where accessible;
7. owner-approved Netlify rollback promotion rehearsal.

Recommended severity model:

- severity 1: site unavailable, startup failure or widespread auth failure — investigate immediately;
- severity 2: repeated route-affecting client error — investigate within one working day;
- severity 3: isolated non-blocking error — routine maintenance review.

No alert may automatically repair data, apply a migration, reset Supabase or switch environments.

## Hard boundaries

- No Sentry API token in a browser variable, committed file or untrusted build.
- No source-map upload without the explicit trusted-build switch and complete
  build-only credentials.
- No Replay, logs, profiling, automatic breadcrumbs or automatic user context.
- No fetch/XHR spans or distributed trace headers.
- No production synthetic verification flag.
- No user/permanent test account created for Sentry verification.
- No database, RLS, function, scoring or tournament-rule change through observability work.
