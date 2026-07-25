# Production observability and application rollback

**Status:** provider-neutral controls implemented; third-party delivery disabled pending approval.  
**Production application/database contract:** 35.  
**Primary operational owner:** repository owner `nickygregal12-cmyk`.  
**Scope:** application failures, release identity, anonymous live smoke and static-application rollback. This runbook does not authorize a database write or production mutation.

## Current boundary

The application now provides:

- a single client-error reporting boundary under `src/services/observability/`;
- React render-failure capture;
- global `error` and `unhandledrejection` capture;
- startup-configuration failure capture;
- controlled route categories rather than full URLs;
- credential, email, URL-query, local-path and database-error redaction;
- failure isolation so a reporting failure cannot prevent application use;
- generated non-secret release identity at `/release.json`;
- fail-closed anonymous HTTP and browser smoke commands.

No external reporter is configured in production by this repository change. Captured events are discarded when no reporter adapter is registered. In development they are written to the console for diagnosis. This is intentional: enabling delivery requires an approved provider, data-processing terms, retention period, alert destination and CSP/network configuration.

## Release identity

Every built deployment emits `/release.json` containing only:

- Netlify context;
- source commit;
- deploy identifier;
- application contract;
- hosted contract;
- Supabase project reference.

It must never contain keys, tokens, email addresses, database URLs or user data.

A production release must report:

- `environment: production`;
- `applicationContract: 35`;
- `hostedContract: 35`;
- `supabaseProjectRef: vkfnsqdyhvtwyqkisxhk`;
- non-local commit and deploy identities.

A preview must report its actual context and the development Supabase project. Do not edit release metadata by hand; it is generated from build and reviewed deployment inputs.

## Anonymous live smoke

The HTTP smoke is read-only and submits no form:

```bash
npm run smoke:production
```

It verifies:

- production origin identity;
- HTTP 200 application shell;
- security headers and CSP;
- `/release.json` contract and environment identity;
- SPA fallbacks for auth, invite, predictor, league, matches, More and unknown routes;
- initial JavaScript and CSS assets;
- the complete production Supabase endpoint;
- absence of the complete development Supabase endpoint;
- absence of any unexpected hosted Supabase endpoint.

The browser smoke is also anonymous and read-only:

```bash
npm run smoke:production:browser
```

It verifies:

- login, signup and reset route titles;
- signed-out redirects for protected routes;
- the unknown-route recovery page;
- no page error;
- no request to development or another unexpected Supabase host.

The browser smoke clicks navigation only. It must not submit authentication forms, create an account or mutate a prediction.

### Intentional preview check

A non-production origin is rejected unless explicitly allowed. For an approved deploy preview:

```bash
EURO28_SMOKE_ORIGIN="https://deploy-preview-<PR>--euro28predictor.netlify.app" \
EURO28_SMOKE_ALLOW_NON_PRODUCTION=true \
EURO28_SMOKE_EXPECTED_CONTEXT=deploy-preview \
EURO28_SMOKE_EXPECTED_SUPABASE_REF=iouzoutneyjpugbbtdem \
npm run smoke:production
```

Use the same environment variables with `npm run smoke:production:browser`. Never use the production Supabase reference for a preview.

## Alert classes

When a delivery provider is approved, alerts must be actionable and limited to:

1. production origin unavailable or returning an unexpected status;
2. JavaScript startup/configuration failure;
3. React render failure affecting a route category;
4. repeated uncaught client error above an agreed threshold;
5. auth-route load failure;
6. wrong release, contract or Supabase environment identity;
7. failed production deployment.

The first alert recipient is the repository owner. Before public launch, record a backup recipient and escalation route. No alert may trigger an automatic database repair, migration, reset or environment switch.

## Privacy and retention boundary

Allowed report fields:

- generated event ID and timestamp;
- controlled source type;
- controlled route category;
- safe release identity;
- redacted error name/message/stack;
- redacted React component stack.

Prohibited fields:

- access or refresh tokens;
- passwords, cookies, authorization headers or private keys;
- email addresses or profile data;
- raw prediction, bracket, league or result payloads;
- database connection strings;
- raw PostgreSQL/PostgREST errors containing object or row detail;
- full URLs containing query strings or fragments;
- archive, backup or Auth records.

Provider enablement must record:

- provider and account owner;
- data-processing location and terms;
- retention duration;
- project access list;
- alert recipients;
- deletion/export process;
- CSP and network changes;
- preview and production verification.

## Application rollback decision tree

A Netlify rollback changes static application files only. It does not roll back Supabase schema or data.

### 1. Identify the incident

- **Static client regression with production database still at contract 35:** application rollback may be appropriate.
- **Database, RLS, function, migration-history or data incident:** stop. Use the database recovery/change process; do not substitute a Netlify rollback.
- **Wrong Supabase environment or contract identity:** stop new traffic/deployments and investigate configuration. Never point production at development.
- **Auth-provider/CAPTCHA incident:** use the separate Auth/Turnstile decision path; do not change database contract.

### 2. Select a compatible executable release

The accepted contract-35 promotion baseline is:

- source commit `902a37aa6c50c967f8080d751147a5733b251fe3`;
- production deploy `6a652c3d3416d26d595ae2ef`;
- application/database contract 35.

Later releases may replace this baseline only after their `/release.json`, CI and production smoke evidence are retained. A documentation-only commit is not by itself a distinct executable rollback target.

Never roll back to an application requiring contract 20 or direct-table fallbacks. Production history is canonical through migration 35 and must not be rewritten to suit an old client.

### 3. Pre-rollback checks

Record without secrets:

- incident and decision owner;
- current production deploy and `/release.json`;
- candidate rollback deploy and `/release.json`;
- confirmation both require contract 35;
- confirmation candidate uses production Supabase;
- current production data/write freeze decision;
- recovery decision owner.

### 4. Perform rollback

Use Netlify's reviewed production-deploy restore/promote mechanism for the exact selected deploy. Do not upload an unreviewed local directory, alter Supabase variables, change domains or disable deployment guards.

### 5. Verify after rollback

Require:

```bash
npm run smoke:production
npm run smoke:production:browser
```

Also confirm:

- production pointer identifies the intended deploy;
- `/release.json` identifies production, contract 35 and production Supabase;
- security headers remain present;
- login/signup/reset render;
- signed-out protected routes gate correctly;
- no development Supabase request occurs;
- production database remains exactly migrations 1–35 unless a separately approved database change exists.

Authenticated mutation checks require separate explicit approval, a named test identity, before/after evidence, exact restoration and no embedded credential. Do not create a permanent production test account through this runbook.

## Provider-enablement gate

Before registering a production reporter adapter:

1. approve the provider and account owner;
2. approve data fields and retention;
3. configure a non-production project first;
4. prove redaction and reporter-failure isolation;
5. review CSP/network changes;
6. verify alerts with synthetic non-sensitive events;
7. approve production configuration separately;
8. update current status, risk register, feature baseline and a dated reconciliation.

Until that gate passes, monitoring remains **partially implemented**: capture, redaction, identity and smoke controls exist, but external production delivery and alerting do not.
