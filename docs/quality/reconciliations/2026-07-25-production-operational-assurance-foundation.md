# Production operational-assurance foundation

**Date:** 25 July 2026  
**Issue:** #91  
**Pull request:** #92  
**Final implementation evidence head before this reconciliation:** `29468cbd6c978a54a761739c076137e14ad68256`  
**Scope:** Repository and deploy-preview operational-assurance foundation.  
**Production impact:** None. No production deployment, Netlify configuration change, Supabase write or database change was performed by this workstream.

## Purpose

The contract-35 production application/database pair was technically compatible and verified, but its application assurance remained mostly point-in-time. This workstream adds repeatable release identity, privacy-safe client-failure capture, deploy-preview smoke automation and an executable application-rollback procedure before any further database expansion.

It does not enable a third-party monitoring provider and does not claim production monitoring or alert delivery is complete.

## Implemented repository controls

### Release identity

Vite now emits `/release.json` and defines a typed in-app release object containing only:

- application identity;
- Netlify context;
- source commit;
- deploy identifier;
- application contract;
- hosted database contract;
- Supabase project reference.

No key, token, database URL, email address or user record is included.

### Client-error boundary

The application now has one provider-neutral error-reporting boundary covering:

- React render failures;
- startup/configuration failures;
- uncaught browser errors;
- unhandled promise rejections.

The controlled event envelope uses route categories instead of complete URLs. It redacts:

- email addresses;
- Bearer tokens and JWT-shaped values;
- URL queries/fragments;
- local machine paths;
- raw database/PostgREST details.

When a message is identified as a database-detail error, the raw stack is discarded. Reporter exceptions and rejected reporter promises are isolated and cannot prevent application startup or normal use.

No reporter adapter is registered by default. In production, events are discarded until a later approved provider configuration is added.

### User-facing recovery

A React application error boundary renders a generic recovery surface and reports through the safe boundary. It does not expose infrastructure detail and does not claim that a failed render changed account or prediction data.

### HTTP and browser smoke

Two isolated read-only commands were added:

```bash
npm run smoke:production
npm run smoke:production:browser
```

They verify the expected origin, release identity, contract, Supabase environment, security headers, SPA shell, initial assets, auth routes, signed-out route gates and unknown-route recovery.

Non-production origins are rejected unless an explicit allow flag and expected context/Supabase reference are supplied. The smoke can require an exact expected commit.

### Deploy-preview CI gate

The Browser E2E workflow now contains two separate jobs:

1. the existing authenticated browser suite against disposable local Supabase;
2. a deploy-preview smoke job against the deterministic Netlify PR alias.

The preview job waits until `/release.json` identifies the exact pull-request head before it runs. It requires:

- `environment: deploy-preview`;
- the exact PR head SHA;
- application contract 35;
- hosted contract 35;
- development Supabase `iouzoutneyjpugbbtdem`.

It then runs both the HTTP and Playwright smoke suites. The existing authenticated and Auth-recovery test harnesses continue to forbid every hosted Supabase project reference and use only disposable loopback services.

### CI diagnostics

The CI workflow now retains the Vitest output as a seven-day artifact only when the test step fails. This allowed a stale over-broad workflow assertion to be diagnosed without skipping or weakening tests.

### Rollback procedure

`docs/ops-production-observability.md` now distinguishes:

- static Netlify application rollback;
- database recovery/change management;
- Auth/CAPTCHA incidents;
- wrong-environment/configuration incidents.

It records the accepted contract-35 executable baseline and requires release identity, headers, routes and environment-isolation smoke after a rollback. It prohibits production-to-development fallback and does not authorize a database write.

## Verification evidence

### Application CI

CI run 444 passed on `29468cbd6c978a54a761739c076137e14ad68256`:

- Git-less hygiene verification;
- guarded build and TypeScript compilation;
- Oxlint;
- all Vitest suites: 89 test files, 577 tests, with the repository's intentional skips retained;
- production dependency audit.

The failure-only diagnostic artifact step was skipped on the successful run.

### Browser E2E

Browser E2E run 159 passed on the same head.

The authenticated disposable job passed:

- local Supabase startup;
- rebuild through all 35 committed migrations;
- authenticated prediction/submission/conflict/lock journeys;
- signup, email confirmation, pending invite, password recovery and old-password rejection;
- cleanup without a retained local database backup.

The deploy-preview smoke job passed:

- exact PR-head release identity wait;
- HTTP smoke;
- real Chromium browser smoke;
- diagnostic artifact upload.

### Netlify deploy preview

The final preview used for this evidence was:

- deploy ID `6a6543355101b900080ace26`;
- alias `https://deploy-preview-92--euro28predictor.netlify.app`;
- source head `29468cbd6c978a54a761739c076137e14ad68256`;
- context `deploy-preview`;
- contract 35;
- development Supabase;
- Lighthouse 98 performance, 100 accessibility, 100 best practices and 100 SEO.

The exact-head automated smoke proves the preview served the intended release identity rather than a stale preceding deploy.

## Corrected validation assumptions

Two existing regression tests originally scanned the entire Browser E2E workflow for hosted Supabase references. That assumption became stale when a deliberately hosted deploy-preview job was added.

The tests were corrected without weakening the protected boundary:

- the authenticated browser and Auth-recovery jobs still forbid production, development and legacy hosted references;
- the preview job separately and explicitly requires only the approved development reference;
- the preview bundle and browser requests fail on any unexpected Supabase host.

## Current classification

This evidence supports:

- `FEAT-042`: **partial repository capability** — capture, redaction, release identity and smoke exist, but external reporting and alerts do not;
- `SAFE-027`: durable anonymous deploy-preview smoke added alongside existing disposable authenticated Browser E2E;
- `SAFE-031`: executable rollback procedure implemented; hosted production rollback rehearsal remains open;
- `TEST-001`: improved, not closed;
- `OPS-003`: improved, not closed.

## Remaining gates

Issue #91 remains open. Closure still requires:

1. owner approval of a monitoring provider;
2. approved data location, retention and access policy;
3. named primary and backup alert recipients;
4. non-production provider delivery and redaction verification;
5. reviewed CSP/network changes where required;
6. production deployment of the merged foundation;
7. both anonymous smoke commands passing against that production deployment;
8. a compatible Netlify application rollback rehearsal with production Supabase unchanged;
9. periodic backup/restore cadence and final launch rollback ownership.

A separate approval is required before enabling any external reporter or changing production configuration.

## Safety confirmation

This workstream changed no:

- Supabase schema, migration, data, RLS policy or function;
- Netlify environment variable, domain or production deployment;
- scoring or tournament rule;
- Auth identity or production prediction;
- migration 36 or draft PR #76 content.
