# Production observability and application rollback

**Status:** privacy-safe Sentry production delivery verified; operating policy and rollback rehearsal remain incomplete.  
**Repository/development contract:** 36.  
**Retained final-target contract:** 35.  
**Primary owner:** `nickygregal12-cmyk`.  
**Scope:** client failures, release identity, anonymous read-only smoke and static-application rollback. This runbook authorizes no database write.

## Current boundary

Implemented controls:

- provider-neutral client-error boundary under `src/services/observability/`;
- React/startup/global error capture;
- route categories rather than full URLs;
- credential/email/query/local-path/database-error redaction;
- reporter failure isolation;
- official `@sentry/react` adapter;
- generated non-secret `/release.json`;
- fail-closed HTTP/browser smoke;
- explicit expected contract per smoke target.

Production Netlify currently provides a build-scoped public Sentry DSN and `VITE_SENTRY_ENABLED=true`. Production page-load tracing was manually verified through the approved privacy boundary. The synthetic verification-event flag is not configured for production.

Replay, logging, profiling, automatic user context, automatic breadcrumbs, fetch/XHR tracing, distributed trace propagation, resource child spans and source-map upload remain disabled.

## Release identity

`/release.json` contains only:

- Netlify context;
- source commit;
- deploy ID;
- application contract;
- hosted contract;
- Supabase project reference.

It must never contain credentials, database URLs or user data.

Current target identities:

| Target | Environment | App/hosted contract | Supabase |
| --- | --- | ---: | --- |
| Development preview | `deploy-preview` | 36/36 | `iouzoutneyjpugbbtdem` |
| Retained final target | `production` | 35/35 | `vkfnsqdyhvtwyqkisxhk` |

Preview requires the exact PR head. Production currently verifies the retained compatible release rather than the current `main` commit, because the deployment guard intentionally blocks contract-36 code from a contract-35 final-target database. Restore exact-head production verification during final-target promotion.

## Required smoke contract

Both smoke implementations require:

```bash
EURO28_SMOKE_EXPECTED_CONTRACT=<positive-integer>
```

The command fails closed if this value is missing or invalid. Do not add a shared hardcoded contract: preview and final target intentionally differ until final-target promotion.

## Anonymous final-target smoke

Read-only HTTP smoke:

```bash
EURO28_SMOKE_EXPECTED_CONTRACT=35 \
npm run smoke:production
```

Read-only browser smoke:

```bash
EURO28_SMOKE_EXPECTED_CONTRACT=35 \
npm run smoke:production:browser
```

Defaults require:

- origin `https://euro28predictor.com`;
- environment `production`;
- final-target Supabase `vkfnsqdyhvtwyqkisxhk`;
- non-local commit/deploy IDs.

The HTTP smoke verifies shell, headers/CSP, release identity, SPA routes, assets and Supabase endpoint isolation. Browser smoke verifies auth-route rendering/titles, signed-out gates, not-found recovery, no page error and no unexpected Supabase host. Neither submits a form or mutates data.

## Intentional preview smoke

```bash
EURO28_SMOKE_ORIGIN="https://deploy-preview-<PR>--euro28predictor.netlify.app" \
EURO28_SMOKE_ALLOW_NON_PRODUCTION=true \
EURO28_SMOKE_EXPECTED_CONTEXT=deploy-preview \
EURO28_SMOKE_EXPECTED_SUPABASE_REF=iouzoutneyjpugbbtdem \
EURO28_SMOKE_EXPECTED_COMMIT="<exact-pr-head-sha>" \
EURO28_SMOKE_EXPECTED_CONTRACT=36 \
npm run smoke:production
```

Use the same variables with `npm run smoke:production:browser`. Never use final-target Supabase for a preview. Never use the legacy `euro28-predictor-dev` site.

## Automated workflows

### Deploy preview

`.github/workflows/browser-e2e.yml` requires:

- exact PR head;
- `deploy-preview` environment;
- contract 36/36;
- development Supabase;
- HTTP smoke;
- anonymous browser smoke;
- disposable authenticated and auth-recovery browser suites.

### Retained final target

`.github/workflows/production-smoke.yml` currently requires:

- production environment;
- contract 35/35;
- final-target Supabase;
- non-local release IDs;
- HTTP/browser smoke.

It deliberately does not require `github.sha` while production cannot accept contract-36 `main`. During final-target promotion, change the workflow to contract 36 and restore exact-head commit enforcement in the same reviewed batch.

## Sentry privacy boundary

Allowed event fields are limited to controlled source/route category, safe release identity, redacted error details and minimum Sentry processing metadata.

Sentry must not receive:

- user identity, email address or IP address;
- full request URLs, query strings or fragments;
- cookies, authorization headers, access/refresh tokens;
- prediction, bracket, league, result or Auth payloads;
- raw PostgreSQL/PostgREST detail;
- DOM interaction history or Replay data.

`beforeSend` drops errors not marked as controlled Euro 2028 events. Transaction scrubbing removes user/request/breadcrumb data, replaces paths with route categories and removes child spans.

## Remaining observability policy

Production delivery is not the remaining gap. Complete these controls:

1. record the actual Sentry retention setting;
2. confirm server-side default data scrubbing and IP-address scrubbing remain enabled;
3. name one backup alert recipient;
4. record escalation path and response windows;
5. retain push-triggered production-smoke conclusions where accessible;
6. perform the owner-approved Netlify rollback promotion rehearsal.

Alerts remain limited to actionable startup, availability, route-affecting error and deployment failures. No alert may automatically modify data, apply a migration, reset Supabase or switch environments.

## Application rollback decision tree

A Netlify rollback changes static files only, not Supabase schema/data.

- **Static client regression while final-target database remains contract 35:** a compatible contract-35 application rollback may be appropriate.
- **Database/RLS/function/history/data incident:** stop and use database recovery/change control.
- **Wrong Supabase or contract identity:** stop deployment/traffic and investigate; never point production at development.
- **Auth/CAPTCHA incident:** use the separate Auth/Turnstile process.

The accepted contract-35 executable baseline remains documented in `docs/quality/reconciliations/2026-07-25-contract-35-production-promotion.md`. A later baseline replaces it only after release identity, CI and final-target smoke evidence are retained.

### Pre-rollback

Record incident/owner, current and candidate release identities, contract compatibility, final-target Supabase confirmation, traffic/write-freeze decision and recovery owner.

### Rollback

Use Netlify’s reviewed deploy restore/promote mechanism for the exact compatible deploy. Do not upload an unreviewed directory, alter Supabase variables/domains or disable guards.

### Post-rollback

Run both final-target smoke commands with `EURO28_SMOKE_EXPECTED_CONTRACT=35` unless a separately approved final-target contract change has occurred. Confirm intended deploy, headers, auth routes, signed-out gates, no development request and unchanged database history.

Authenticated mutation checks require separate approval, a named test identity, before/after evidence and exact restoration.

## Evidence

- Sentry implementation and hosted production trace: `docs/quality/reconciliations/2026-07-26-sentry-operational-assurance.md`.
- Contract-35 production baseline: `docs/quality/reconciliations/2026-07-25-contract-35-production-promotion.md`.
- Contract-36 development/preview promotion: `docs/quality/reconciliations/2026-07-26-contract-36-development-promotion.md`.
