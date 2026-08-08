# Netlify deployment access and verification

This runbook defines the live Netlify project boundary for the Football Prediction Hub.

## Authoritative project

- Live Netlify project: `euro28predictor`.
- Production domain: `https://euro28predictor.com`.
- Historic project `euro28-predictor-dev` is retired and must not be configured, deployed or treated as current evidence.
- Netlify Team SSO currently protects **all deploy contexts**, including production.

## Contract declarations

Netlify's `EURO28_DEPLOYED_DB_CONTRACT` value describes the hosted database reached by a build in that deploy context. It is compatibility metadata for the build gate; it is **not** proof that an application bundle has been rebuilt or published.

| Context | Supabase target | Declared hosted contract |
| --- | --- | ---: |
| `dev` | Development | 132 |
| `branch-deploy` | Development | 132 |
| `deploy-preview` | Development | 132 |
| `production` | Production | 132 |

A direct Netlify project/environment read on 8 August 2026 confirmed all four values above. The three non-production contexts point to the Development Supabase project; production points to the Production Supabase project. A fifth `dev-server` context still carries an empty declaration and therefore fails closed under `scripts/validate-deployment-contract.mjs`.

The repository test does not hard-code these numbers. It requires the three non-production documentation values to match `config/development-hosted-contract.json` and the production documentation value to match `config/production-hosted-contract.json`. A hosted database rollout therefore has one machine-backed value to reconcile into Netlify configuration rather than another permanent magic number.

The declaration must never be raised ahead of the hosted database or used to manufacture a green build. After a separately authorised hosted rollout, update the matching Netlify context only from fresh target-specific evidence. An environment-variable update is configuration, not a deployment.

The blank `dev-server` override is a Netlify configuration debt. Remove it or set it deliberately before relying on Netlify Dev as hosted-contract evidence.

## Published production artifact

The currently published production deploy is still the 30 July 2026 build from commit `8244b7222b9d108e59380fd16351c02b578497ee` (deploy `6a6bac566b6e440008d44e5b`). It is a Contract-63-era application artifact even though the current production environment declaration now says 132 and the Production database is hosted at 132.

That distinction is intentional and mandatory in status reporting:

1. **repository application contract** — what current source requires;
2. **hosted database contract** — what Supabase has applied;
3. **Netlify environment declaration** — what a new build says it targets;
4. **published artifact** — the source/build users would actually receive.

Never call Production application-aligned or deployed merely because (2) and (3) match. A source-backed deploy of the exact tested application is still required.

## Build authority

The repository owns the deploy build settings in `netlify.toml`:

```toml
[build]
  command = "npm run build"
  publish = "dist"
```

The Netlify UI must not carry a conflicting command or publish directory. `npm run build` executes the environment and deployment-contract gates before Vite publishes the SPA.

## Protected preview verification

Netlify team-login protection is intentionally human-authenticated. It does not provide a supported non-interactive site session for GitHub Actions.

The `deploy-preview-smoke` job runs only for pull requests targeting `main`, because Netlify does not publish a deploy-preview status for stacked pull requests whose base is another feature branch. It verifies two facts without weakening protection:

1. Netlify reports a successful `netlify/euro28predictor/deploy-preview` commit status for the exact pull-request head SHA.
2. The preview's `/release.json` is not publicly readable as release metadata.

The job fails if Netlify reports failure/error, never certifies the exact head, exposes valid deploy-preview release metadata publicly, returns a missing/error response instead of a recognisable protection response, or points its status away from Netlify.

A pull-request base change or reopen is not deploy evidence by itself. After rebasing or retargeting, push a genuine head commit so Netlify receives a normal synchronize event and publishes a status for that exact SHA.

This is not a substitute for application browser testing. The same workflow runs the authenticated application journeys against a disposable local Supabase rebuilt from every committed migration. Public CDN HTTP and browser smoke remain release-specific gates; while Team SSO protects production, the private signed-in verification is the relevant outer-access posture.

Do not add a shared password, hard-coded credential, commit-derived password or secret-bearing `Basic-Auth` rule merely to make CI enter a protected preview.

## Pull requests and concurrent work

A Netlify access/configuration PR must:

- start from the latest relevant `main` or active dependency branch;
- avoid changing hosted database state;
- change a contract declaration only from fresh hosted evidence for that exact target;
- preserve the exact-head Netlify status gate;
- include tests that read the workflow and `netlify.toml`;
- be compared with current `main` immediately before merge;
- be merged only when required checks are green and no concurrent branch has introduced conflicting Netlify or hosted-status changes.

## Manual account actions

The following settings remain account/team controls rather than repository changes:

- enable MFA on the Netlify owner account;
- enforce team MFA when the plan supports it;
- replace the personal public support address with a dedicated working alias;
- remove the blank `dev-server` contract override.

No Netlify Function or Edge Function is required for the current static Vite SPA. Add one only for a distinct server-side responsibility that cannot remain in Supabase or the static build.

## Production protection

Team SSO is the current private-testing perimeter across all contexts. Production database promotion, Netlify declaration alignment and application deployment are still separate operations. Before publishing a new application artifact, require the ordinary Production backup/preflight/exact-range/postflight controls, exact source/contract alignment, the intended feature flags, release smoke and a recorded rollback deploy.

Every production release must record the exact source commit, deploy ID, application contract, Supabase project/contract, Netlify declaration, access-control posture, smoke evidence and rollback deploy ID.
