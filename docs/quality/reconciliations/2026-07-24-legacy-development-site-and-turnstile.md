# Legacy development site and Turnstile configuration reconciliation

**Date:** 24 July 2026  
**Workstreams:** `OPS-008`, `AUTH-001`  
**Mode:** hosted inspection only; no legacy-site, Cloudflare, Supabase Auth or database mutation

## Verdict

Two separate hosted configuration issues were confirmed after `OPS-007` environment isolation was completed:

1. a public Netlify site named `euro28-predictor-dev` is a legacy deployment from the `worldcup2026` repository and must not be treated as the current Euro 2028 development environment;
2. the current production Netlify project supplies one real Turnstile site key to all contexts, while non-production contexts now target the separate development Supabase project whose CAPTCHA configuration could not be verified.

Neither issue is part of the production migrations 21–35 window. Both require separate owner decisions.

## Current environment identities

The current Euro 2028 repository uses:

| Purpose | Identity |
| --- | --- |
| Current repository | `nickygregal12-cmyk/Euro-2028-Predictor` |
| Current production Netlify site | `euro28predictor`, site ID `c69da01a-4650-43db-a1d2-b78b7f8e198a` |
| Current development Supabase | `iouzoutneyjpugbbtdem` |
| Current production Supabase | `vkfnsqdyhvtwyqkisxhk` |

The separately maintained site is:

| Field | Verified value |
| --- | --- |
| Netlify site | `euro28-predictor-dev` |
| Site ID | `e729912b-7fd7-4bd4-b7c1-d1ad7401f6fd` |
| Public URL | `https://euro28-predictor-dev.netlify.app` |
| Source repository | `nickygregal12-cmyk/worldcup2026` |
| Source branch | `euro28-development` |
| Source commit | `b6b33fe744601326432439f7e4e75002d3d2d924` |
| Current deploy | `6a5b8d18cb065545ee13da67`, ready |
| Supabase project | `gcfdwobpnanjchcnvdco`, `Euro 2028 Predictor Staging` |
| Supabase status | inactive |
| Application marker | `VITE_APP_ENV=staging` |
| Time-travel marker | `VITE_ENABLE_TIME_TRAVEL=true` |
| Access control | public; no password or team-login requirement |

The deploy includes:

- `_observability`;
- `health`;
- `scheduled-heartbeat`;
- an hourly `scheduled-heartbeat` cron.

The deploy secret scan reported no matches. That does not make the site part of the current environment or remove the public legacy-attack-surface concern.

## `OPS-008` — legacy public development environment

The legacy site is not a valid current preview, staging or development target. It uses a different repository and a dormant Supabase project.

### Prohibitions

- Do not use it for current Euro 2028 testing.
- Do not repoint it at current development or production Supabase.
- Do not deploy the current repository to it without a separate approved adoption plan.
- Do not pause, delete or alter its source repository, functions, schedule or Supabase project from the current Euro 2028 workstream.
- Do not treat the inactive backend as proof the public frontend/functions have no operational risk.

### Owner decision

Issue #27 records the required decision:

1. retire and secure it;
2. retain it as protected, clearly obsolete evidence;
3. adopt it only through a separate reviewed ownership/migration plan.

Closure requires an explicit owner decision and post-action evidence for public access, functions, cron and backend state.

## `AUTH-001` — Turnstile production/non-production separation

The current production Netlify project has one real `VITE_TURNSTILE_SITE_KEY` value scoped to all contexts.

The Supabase variables are now context-separated:

| Netlify context | Supabase target |
| --- | --- |
| `production` | production |
| `deploy-preview` | development |
| `branch-deploy` | development |
| `dev` | development |

Repository `.env.example` documents the application contract:

- when the site key is set, auth forms render Turnstile and send `captchaToken` to Supabase Auth;
- Supabase CAPTCHA must be enabled with the matching secret;
- a site-key/secret or enabled/disabled mismatch causes auth errors;
- development may use Cloudflare's always-pass test key and matching test secret.

### Hosted evidence

Read-only production Auth logs for the preceding 24 hours showed successful production sign-ups from `euro28predictor.com` and no CAPTCHA-validation errors. No email addresses, IP addresses or raw Auth-event payloads are retained in this reconciliation.

Development Auth logs contained no recent requests. Therefore the development CAPTCHA toggle, provider and secret cannot be inferred from logs.

The connected tools do not expose:

- Cloudflare Turnstile widget hostname configuration;
- the development Supabase CAPTCHA toggle/provider/secret.

### Current platform requirements

Cloudflare's current Turnstile documentation states:

- hostname wildcards are not supported;
- adding a hostname authorises that hostname and its subdomains;
- Free widgets allow up to ten configured hostnames;
- separate widgets/configuration are recommended for production and development/testing;
- official test site keys and matching test secret keys are intended for automated and development flows.

References:

- `https://developers.cloudflare.com/turnstile/additional-configuration/hostname-management/`
- `https://developers.cloudflare.com/turnstile/troubleshooting/testing/`
- `https://developers.cloudflare.com/turnstile/get-started/`

Supabase's current CAPTCHA guide requires the CAPTCHA provider/secret to be enabled in Auth settings and the frontend token to be supplied with the auth request:

- `https://supabase.com/docs/guides/auth/auth-captcha`

### Risk

A successful static preview build does not prove auth works. The shared real site key may produce one of several unseen states:

- the preview hostname is not authorised by Cloudflare;
- a real token is rejected because development Supabase uses no secret, a different secret or a test secret;
- production Turnstile analytics/configuration are unintentionally shared with preview traffic;
- an overly broad hostname such as `netlify.app` was added to make dynamic previews work.

No evidence was found that the broad `netlify.app` hostname is configured, and it must not be added as a shortcut.

### Required decision

Issue #28 records three acceptable non-production models:

1. development CAPTCHA disabled and non-production site key empty/unset;
2. Cloudflare always-pass test site key plus the matching always-pass test secret in development Supabase;
3. a dedicated development widget and matching development Supabase secret.

Production retains a separate real key/secret and restricted production hostnames.

Closure requires:

- non-secret Cloudflare widget/hostname evidence;
- non-secret development Supabase CAPTCHA configuration evidence;
- a context-specific Netlify site-key matrix;
- preview login, sign-up and password-recovery tests;
- development Auth-log verification;
- production auth regression verification.

## Current operational position

- `OPS-007` remains resolved for Supabase project isolation on the current production Netlify project.
- `OPS-008` is open for the separate legacy site.
- `AUTH-001` is open for Turnstile/CAPTCHA environment separation.
- The legacy site is not an alternative rollback or staging target.
- Turnstile changes must not be mixed into the production migrations 21–35 window.
- No hosted configuration or data changed during this inspection.