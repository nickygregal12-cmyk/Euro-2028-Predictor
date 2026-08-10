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
| `dev` | Development | 145 |
| `branch-deploy` | Development | 145 |
| `deploy-preview` | Development | 145 |
| `production` | Production | 145 |

A direct Netlify project/environment read on 10 August 2026 confirmed all four values above. The three non-production contexts point to the Development Supabase project; production points to the Production Supabase project. A fifth `dev-server` context still carries an empty declaration and therefore fails closed under `scripts/validate-deployment-contract.mjs`.

Each of the four moved on 10 August 2026 and each moved **after** the database it names, never before. The three non-production contexts were raised to 145 once the guarded fast lane had applied contract 145 to Development; production was raised from 144 to 145 only after guarded rollout run `31379974246` had applied contract 145 to Production Supabase and an independent read-only query had confirmed the 145-row ledger. Production Supabase reached 144 and then 145 on the same day, which is why the production declaration was raised twice and why neither raise led its database.

The repository test does not hard-code these numbers. It requires the documentation records to agree about each declared Netlify value, and it proves that a declaration never leads the hosted database targeted by that context. Equality is valid and an intentional trailing declaration is valid; a leading declaration is refused. Hosted database movement therefore does not manufacture a Netlify configuration change merely to keep numbers equal.

The declaration must never be raised ahead of the hosted database or used to manufacture a green build. After a separately authorised hosted rollout, update the matching Netlify context only from fresh target-specific evidence. An environment-variable update is configuration, not a deployment.

The blank `dev-server` override is a Netlify configuration debt. Remove it or set it deliberately before relying on Netlify Dev as hosted-contract evidence.

## Published production artifact

The currently published production deploy is still the 30 July 2026 build from commit `8244b7222b9d108e59380fd16351c02b578497ee` (deploy `6a6bac566b6e440008d44e5b`, `state: ready`, `context: production`, `branch: main`). It is a Contract-63-era application artifact even though the current production environment declaration now says 145 and the Production database is hosted at 145.

That deploy record also names the mechanism that produced it: `deploy_source: "api"` with `has_source_zip: true` and `manual_deploy: false`. The published artifact was uploaded as a source zip and built in Netlify's build system, not pushed from a local `dist`. That matters for recovery, because it is the same path an agent session is offered and the path that is currently unavailable — see below.

### Why the artifact has not moved since 30 July

`npm run build` runs `scripts/validate-deployment-contract.mjs` in `prebuild`, and for the production context it demands an **exact** match between `EURO28_DEPLOYED_DB_CONTRACT` and the repository's `contractVersion`. A trailing declaration is waved through for non-production only. From 31 July until 10 August the production declaration sat at 132 while the repository moved to 133 and beyond, so any production build from `main` would have failed that gate before Vite ran. The stale artifact is the expected consequence of the guard doing its job, not a separate fault.

As of 10 August 2026 the declaration and the repository are both at 145, so the gate is satisfied and a production build from `main` can complete for the first time since 30 July.

### Publishing from an agent session

An agent session cannot currently upload the artifact itself. The Netlify MCP tools work, because they execute outside the session container, and they are sufficient to read the project, read and write environment variables and read a deploy. The zip-and-build upload is different: it runs `npx @netlify/mcp` **inside** the container, and on 10 August 2026 both `api.netlify.com` and `netlify-mcp.netlify.app` were refused by the session egress policy with `CONNECT tunnel failed, response 403`, with no proxy-side relay failure recorded. That is an organisation egress denial and must be reported rather than routed around.

The route that remains is Netlify's own repository build on a push to `main`. Record which of the two produced any future release, because they are not equivalent evidence: a repository build carries the exact `commit_ref` it was built from, and a zip upload does not have to.

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
