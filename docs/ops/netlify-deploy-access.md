# Netlify deployment access and verification

This runbook defines the live Netlify project boundary for the Football Prediction Hub.

## Authoritative project

- Live Netlify project: `euro28predictor`.
- Production domain: `https://euro28predictor.com`.
- Historic project `euro28-predictor-dev` is retired and must not be configured, deployed or treated as current evidence.
- Production remains a public site.
- Deploy Previews and branch deploys require Netlify team login.

## Contract declarations

Netlify's `EURO28_DEPLOYED_DB_CONTRACT` value describes the hosted database reached by each deploy context. It is not the repository contract.

| Context | Supabase target | Declared hosted contract |
| --- | --- | ---: |
| `dev` | Development | 86 |
| `branch-deploy` | Development | 86 |
| `deploy-preview` | Development | 86 |
| `production` | Production | 63 |

The development declaration must be updated after a verified development rollout. The production declaration must remain at 63 until a separately approved production database promotion. Never raise the production declaration merely to make an application build pass.

The blank `dev-server` override is a Netlify configuration debt. Remove it or set it deliberately through Netlify UI/CLI before relying on Netlify Dev as hosted-contract evidence.

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

This is not a substitute for application browser testing. The same workflow runs the authenticated application journeys against a disposable local Supabase rebuilt from every committed migration. Public CDN HTTP and browser smoke remain a manual, release-specific production gate.

Do not add a shared password, hard-coded credential, commit-derived password or secret-bearing `Basic-Auth` rule merely to make CI enter a protected preview.

## Pull requests and concurrent work

A Netlify access/configuration PR must:

- start from the latest relevant `main` or active dependency branch;
- avoid changing migrations, hosted database state or production contract declarations;
- preserve the exact-head Netlify status gate;
- include tests that read the workflow and `netlify.toml`;
- be compared with current `main` immediately before merge;
- be merged only when required checks are green and no concurrent branch has introduced conflicting Netlify or hosted-status changes.

## Manual account actions

The following settings are account/team controls and are not repository changes:

- enable MFA on the Netlify owner account;
- enforce team MFA when the plan supports it;
- replace the personal public support address with a dedicated working alias;
- narrow public `VITE_*` environment-variable scopes to build scope after preserving every context value;
- remove the blank `dev-server` contract override.

No Netlify Function or Edge Function is required for the current static Vite SPA. Add one only for a distinct server-side responsibility that cannot remain in Supabase or the static build.

## Production protection

Production remains pinned to contract 63 and must not be redeployed from current `main` until a deliberate milestone promotion aligns the application, production Supabase and production Netlify declaration. Every production release must record the exact commit, deploy ID, contract, Supabase project reference, smoke evidence and rollback deploy ID.
