# Netlify deployment access and verification

This runbook defines the live Netlify project boundary for the Football Prediction Hub.

## Authoritative project

- Live Netlify project: `euro28predictor`.
- Production domain: `https://euro28predictor.com`.
- Historic project `euro28-predictor-dev` is retired and must not be configured, deployed or treated as current evidence.
- The project is protected on **all deploy contexts**, including production. The protection *mechanism* changed on 10 August 2026 and needs an owner confirmation — see [Access-control posture](#access-control-posture).

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

The published production deploy is **`6a79b4d5a5e45e0008beec70`**, built from commit
`ff1fe15db680dd5f5f6698749a8371aba2584cec` and published at **11:24:44Z on
10 August 2026**. It is the first application artifact to move since 30 July, and
the first ever to target a Production database at contract 145.

| Field | Value |
| --- | --- |
| Source commit | `ff1fe15db680dd5f5f6698749a8371aba2584cec` (`main`) |
| Deploy ID | `6a79b4d5a5e45e0008beec70` |
| State / context / branch | `ready` / `production` / `main` |
| Published | 2026-08-10T11:24:44.813Z, build time 38s |
| Application contract | 145 |
| Supabase project / contract | `vkfnsqdyhvtwyqkisxhk` / 145 |
| Netlify declaration | `EURO28_DEPLOYED_DB_CONTRACT=145` (production context) |
| Access-control posture | Protected; anonymous requests answer 401 |
| Rollback deploy | `6a6bac566b6e440008d44e5b` (30 July, `8244b722…`) |
| Deploy summary | 38 files uploaded, 35 redirect rules, 1 header rule, no functions |
| Secret scan | 1651 files scanned, 0 matches |

It was produced by **Netlify's own repository build on the push to `main`**, not by
an upload — which is the stronger of the two evidence paths, because the deploy
record carries the exact `commit_ref` it was built from.

### The superseded artifact, for reference

The previous production deploy was `6a6bac566b6e440008d44e5b` from
`8244b7222b9d108e59380fd16351c02b578497ee`, published 30 July 2026 — a
Contract-63-era bundle. Its record reads `deploy_source: "api"` with
`has_source_zip: true` and `manual_deploy: false`: it was uploaded as a source zip
and built in Netlify's build system rather than pushed from a local `dist`. It is
the recorded rollback target for the release above.

### Why the artifact had not moved since 30 July

`npm run build` runs `scripts/validate-deployment-contract.mjs` in `prebuild`, and for the production context it demands an **exact** match between `EURO28_DEPLOYED_DB_CONTRACT` and the repository's `contractVersion`. A trailing declaration is waved through for non-production only. From 31 July until 10 August the production declaration sat at 132 while the repository moved to 133 and beyond, so any production build from `main` would have failed that gate before Vite ran. The stale artifact is the expected consequence of the guard doing its job, not a separate fault.

As of 10 August 2026 the declaration and the repository are both at 145, so the gate is satisfied and a production build from `main` can complete for the first time since 30 July.

### Publishing from an agent session

An agent session cannot currently upload the artifact itself. The Netlify MCP tools work, because they execute outside the session container, and they are sufficient to read the project, read and write environment variables and read a deploy. The zip-and-build upload is different: it runs `npx @netlify/mcp` **inside** the container, and on 10 August 2026 both `api.netlify.com` and `netlify-mcp.netlify.app` were refused by the session egress policy with `CONNECT tunnel failed, response 403`, with no proxy-side relay failure recorded. That is an organisation egress denial and must be reported rather than routed around.

The route that remains — and the one that produced the 10 August release — is Netlify's own repository build on a push to `main`. Record which of the two produced any future release, because they are not equivalent evidence: a repository build carries the exact `commit_ref` it was built from, and a zip upload does not have to.

## Access-control posture

**The perimeter holds, and the mechanism changed.** Two independent observations on 10 August 2026 confirm an anonymous visitor is refused: the deploy's own Lighthouse plugin could not load the site (`Status code: 401`), and `production-smoke.yml` run `31383883792` received 401 on all 120 attempts between 11:32 and 11:42.

The *mechanism* is what moved. A project read at 11:0x showed `requiresSSOTeamLogin: true` across all contexts with `requiresPassword: false`. A read at 11:26, minutes after the release, showed the reverse: `requiresPassword: true` with `whichProjectsRequirePassword: "all"`, and `requiresSSOTeamLogin: false`.

Nothing in the release changed it. The only Netlify write in the release was `EURO28_DEPLOYED_DB_CONTRACT` in the production context, and an environment variable cannot move an access control.

**The owner confirmed on 10 August 2026 that the switch was deliberate**: site password protection is easier to hold open while testing the real application than Team SSO, and the owner's position is that nothing private sits behind it. The perimeter is therefore **site password protection on all contexts**, by decision, and Team SSO is off.

Two things follow, and neither is softened by the confirmation.

The password is a **convenience perimeter, not a confidentiality control**. It keeps the site out of public view and out of search indexes; it is not a reason to place anything behind it that would matter if the password leaked. Real access control stays where it already is: Supabase row-level security, the bounded RPCs and the server-enforced reveal rules. Production holds one auth user and 36 match predictions today, and that data is protected by the database, not by Netlify.

The perimeter is **not** `AGE-001`. ADR 0026's 18+ restriction on the initial external cohort is accepted and unimplemented, and a shared password is not a substitute for it. This remains not a public launch.

### Sharing the password

The password must not be pasted into an agent session transcript. It has no use there — the session egress policy blocks `euro28predictor.com` outright, so an agent cannot reach the site with or without it.

Where it has a use is a GitHub Actions runner, which can reach the site. It therefore belongs in a repository secret and is referenced by name from a workflow, so that no transcript, log, pull request or file in this repository ever contains the value.

### The anonymous smoke cannot pass while the site is protected

`production-smoke.yml` fetches `https://euro28predictor.com/release.json` with plain `curl` and no credentials, then retries 120 times before failing. Against a protected site every attempt is a 401, so **the workflow fails by construction regardless of what was published** — it would have failed identically before this release. Its failure is therefore not evidence about the artifact, in either direction.

This is the same limitation already recorded for protected previews. The gap is that the release gate names a smoke the perimeter forbids.

**The password makes it closable**, which team login did not. The intended shape is two assertions rather than one, because an authenticated-only smoke would be weaker than today's evidence in one respect — it would stop proving that an anonymous visitor is refused:

1. **Anonymous** — request `/release.json` with no credential and require **401**. This asserts the perimeter holds, and it is the check that currently fails by accident rather than by design.
2. **Authenticated** — repeat the existing release-identity, security-header and browser assertions with the site credential supplied from a repository secret.

Two things must be settled before writing it, and neither should be guessed:

- **The mechanism.** Netlify's site password protection is a login form, not HTTP Basic auth; Basic-Auth-via-`_headers` is a different feature. The exact non-interactive exchange has to be established **empirically on a runner**, because the session egress policy blocks the site. A probe step that prints status codes only — never the credential, never a response body — is the way to establish it.
- **The secret.** The value is added to repository secrets by the owner and referenced by name. It is never echoed, never written to a log, never committed, and never placed in a workflow `run:` line where it could reach a diagnostic dump.

### A stale allowance the release has now unblocked

`scripts/production-smoke.mjs` accepts **either** brand in the application title:

```js
// Contract-65 bundles brand the global shell "Football Prediction Hub"
// (PR #357); production remains paused on a pre-rename bundle until its next
// intentional release, so both brands are valid until then. Retire the
// legacy form when production moves past contract 63.
```

Production has now moved past contract 63 — it is at 145 — so that allowance has met its own retirement condition and the legacy `Euro 2028 Predictor` form should be dropped, leaving `Football Prediction Hub` as the only accepted title.

It is **not** retired in the same change that records this, deliberately. The smoke cannot currently run, so tightening an assertion here would be tightening it blind against an artifact nobody has read. Retire it in the same change that makes the smoke runnable, where the first authenticated run proves the published title before the looser branch is deleted.

## Reporting distinctions

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
