# Production observability and application rollback

**Status:** provider-neutral controls implemented; third-party final-target delivery disabled pending approval.  
**Repository/development contract:** 36.  
**Retained final-target contract:** 35.  
**Primary owner:** `nickygregal12-cmyk`.  
**Scope:** client failures, release identity, anonymous read-only smoke and static-application rollback. This runbook authorizes no database write.

## Current boundary

Implemented controls:

- one client-error boundary under `src/services/observability/`;
- React/startup/global error capture;
- route categories rather than full URLs;
- credential/email/query/local-path/database-error redaction;
- reporter failure isolation;
- generated non-secret `/release.json`;
- fail-closed HTTP and browser smoke;
- explicit expected contract per smoke target.

No final-target external reporter is enabled. Provider, terms, retention, access, alert destination and CSP/network changes require separate approval.

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

Defaults still require:

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

## Alert classes

After provider approval, alert only on actionable failures:

1. origin unavailable/unexpected status;
2. startup configuration failure;
3. route-affecting render failure;
4. repeated uncaught errors above threshold;
5. auth-route load failure;
6. wrong release/contract/Supabase identity;
7. failed final-target deployment.

Alerts never trigger automatic migration, repair, reset or environment switch.

## Privacy and retention

Allowed fields: generated event ID/time, controlled source/route category, safe release identity and redacted error/component stack.

Prohibited: tokens/passwords/cookies/authorization/private keys; email/profile data; raw prediction/bracket/league/result payloads; connection strings; detailed database errors; full URLs with query/fragment; backup/Auth records.

Provider enablement must record account owner, processing terms/location, retention, access list, alert recipients, deletion/export process, CSP/network changes and preview/final verification.

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

## Provider-enablement gate

Before final-target delivery:

1. approve provider/account owner;
2. approve fields/retention;
3. configure non-production first;
4. prove redaction and reporter-failure isolation;
5. review CSP/network changes;
6. verify synthetic safe alerts;
7. approve final-target configuration separately;
8. update current status, risk, feature baseline and reconciliation.

Until then monitoring remains partial: capture, redaction, identity and smoke exist; external final-target delivery/alerts do not.
