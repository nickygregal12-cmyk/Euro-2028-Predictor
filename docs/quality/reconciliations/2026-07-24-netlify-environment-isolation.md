# Netlify non-production environment isolation

**Workstream:** `OPS-007`  
**Date:** 24 July 2026  
**Netlify project:** `euro28predictor` / `c69da01a-4650-43db-a1d2-b78b7f8e198a`  
**Repository branch:** `ops/netlify-non-production-isolation`

## Verdict

`OPS-007` is resolved for the production Netlify project.

Deploy previews, branch deploys and Netlify development now use the development Supabase project. Production remains pinned to production Supabase. A repository prebuild guard rejects any future context/project crossing before Vite can produce a deploy.

This work does not resolve the separate automatic-`main` application/schema compatibility problem tracked under `OPS-006` and the release process.

## Prior state

Read-only Netlify inventory showed both browser variables had one `all`-context value:

- `VITE_SUPABASE_URL` pointed to production project `vkfnsqdyhvtwyqkisxhk`;
- `VITE_SUPABASE_ANON_KEY` used the matching production publishable key.

Therefore deploy previews, branch deploys and Netlify development inherited production database access.

No secret service-role credential was present. The affected values are browser publishable configuration, but the data-boundary risk was real because preview application writes could reach production.

## Hosted configuration change

The live Netlify context matrix now resolves as follows:

| Netlify context | Supabase project |
| --- | --- |
| `production` | `vkfnsqdyhvtwyqkisxhk` — production |
| `deploy-preview` | `iouzoutneyjpugbbtdem` — development |
| `branch-deploy` | `iouzoutneyjpugbbtdem` — development |
| `dev` | `iouzoutneyjpugbbtdem` — development |

Only non-production context overrides were changed. Production URL and publishable-key values were retained.

The Turnstile site key remains shared across contexts and requires its separate domain/context review before that checklist item closes.

## Durable repository guard

The repository now runs `scripts/validate-netlify-environment.mjs` through the `prebuild` lifecycle.

The guard:

- skips ordinary local/GitHub Actions builds without a Netlify context;
- requires both Supabase browser variables on Netlify;
- permits `production` only with the production project ref;
- permits `deploy-preview`, `branch-deploy` and `dev` only with the development project ref;
- rejects crossed production/development refs;
- rejects unknown Netlify contexts.

`tests/scripts/netlifyEnvironmentGuard.test.ts` covers all accepted contexts, crossed refs, missing configuration and unknown contexts.

## Hosted preview proof

PR #24 triggered deploy preview:

- preview URL: `https://deploy-preview-24--euro28predictor.netlify.app`;
- deploy ID: `6a630b79c2a23b0008baf1db`;
- source commit: `cdf818f94bee91850dd50bd8b21b47e8aa1cdd9f`;
- deploy state: ready;
- Lighthouse: 98 performance, 100 accessibility, 100 best practices, 100 SEO.

The preview completed with the new prebuild guard active. The guard and Vite consume the same build environment, so a ready deploy proves the preview received the development Supabase ref; a production ref or missing value would have failed the build before Vite ran.

Application CI also passed installation, build, lint, all tests and production dependency audit.

## Safety boundary

- No production Supabase schema, data or migration history changed.
- No development Supabase schema or data changed.
- No production Netlify Supabase value changed.
- No service-role key was introduced.
- No production application feature changed.
- The production application/schema mismatch remains open.

## Remaining deployment work

Still open:

- explicit app/schema compatibility decision before merging database-dependent client code that auto-deploys from `main`;
- Turnstile domain/context verification;
- confirmation of any separately maintained development Netlify site;
- production migration/recovery work under `OPS-006` and `OPS-003`.
