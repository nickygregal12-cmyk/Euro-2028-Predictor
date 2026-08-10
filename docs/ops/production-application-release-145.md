# Production application release — contract 145, behind Team SSO

| Field | Value |
| --- | --- |
| Authority | Operational runbook |
| Status | **Executed 10 August 2026.** Deploy `6a79b4d5a5e45e0008beec70` published from `ff1fe15d…`. Anonymous release smoke could not run against a protected site. |
| Date | 10 August 2026 |
| Owner decision it serves | Publish a current application artifact to Netlify production and keep Team SSO on; do not expose the site publicly until `AGE-001` exists |
| Governs | The steps and evidence for one application release |
| Does not govern | Database promotion ([`ops-pending-migrations.md`](ops-pending-migrations.md)); public exposure, which is explicitly out of scope here |
| Supersedes | [`production-application-release-144.md`](production-application-release-144.md), prepared at contract 144 and never executed |

## Why this document exists

Production Supabase reached **contract 145** on 10 August 2026. The published
application did not move with it: the live artifact is still the 30 July build
from `8244b7222b9d108e59380fd16351c02b578497ee`, a **contract-63-era** bundle.
Database promotion and application release are separate operations and this is
the second one.

## The gate, and why it no longer blocks

`scripts/validate-deployment-contract.mjs` runs in `prebuild`. For the
**production** context it requires an exact match:

```
if (deployedContract !== contract.contractVersion) {
  const trailing = deployedContract < contract.contractVersion
  if (context !== PRODUCTION_CONTEXT && trailing) { …proceed… }
  throw new Error(`Netlify ${context} database contract is ${deployedContract}, but the
    application requires ${contract.contractVersion}. Do not deploy until the target
    database is verified and the context value is updated.`)
}
```

A trailing declaration is waved through for non-production only. Production is
never waved through — deliberately, and the surrounding comment says so.

This is also the measured explanation for the stale artifact. From 31 July until
10 August the production declaration read 132 while the repository moved to 133
and beyond, so every production build from `main` in that window failed here
before Vite ran. The bundle did not go stale by neglect; the guard refused to
publish an application against a database that had not caught up.

**The repository and Production Supabase are both at 145, and the production
declaration is now 145.** The gate is satisfied and current `main` is the
release candidate. That is the reverse of the position at contract 144, where
`d1a0dcd` was the only shippable commit.

## The release candidate

**`main`** at or above `41ddb05bb8d1e13aea5bd475ef475e51cb0cb1a4` — "Reconcile
the hosted records: Production is at contract 145 (#644)". Its
`deployment-contract.json` reads **145**, matching Production Supabase exactly.

Unlike the contract-144 candidate it needs no carve-out: it contains the admin
Euro publication page, every UI Alpha batch and the whole 133–145 backend set
now live in Production.

## Feature flags — decided, and deliberately unchanged

`netlify.toml` sets the UI flags for **deploy-preview only**:

```toml
[context.deploy-preview.environment]
  VITE_UI_PUBLIC_LANDING = "true"
  VITE_UI_SEASON_MATCH_PREDICTOR = "true"
```

The Netlify production context carries `VITE_UI_SEASON_MATCH_PREDICTOR=true`,
set by the owner on 8 August 2026. `VITE_UI_PUBLIC_LANDING` is **not** set for
production in either place.

`src/app/routeFlags.ts` fails closed: anything not exactly `'true'` selects the
**legacy** journey, and `VITE_*` values are build-time, so a flag cannot be
flipped on a live bundle afterwards.

**A production build therefore serves the UI Alpha season Match Predictor and
the legacy landing.** That is the owner's existing configuration, and this
release changes neither flag. Changing the landing is a separate decision that
should be taken on its own evidence, not folded into a contract alignment.

## How it was published

1. **Rollback target recorded.** Published production deploy
   `6a6bac566b6e440008d44e5b`, `state: ready`, `context: production`,
   `branch: main`, `commit_ref: 8244b722…`, published 30 July 2026. Its record
   reads `deploy_source: "api"`, `has_source_zip: true`, `manual_deploy: false`
   — the live bundle was itself a source-zip build in Netlify's build system,
   not a local `dist` push.
2. **Production declaration raised to 145.** Direct Netlify write, after the
   database reached 145 and was independently verified — never before. A
   follow-up read confirmed production reads `145` and that the `dev`,
   `branch-deploy`, `deploy-preview` and `dev-server` values were untouched.
3. **Publish attempted and refused.** The zip-and-build upload runs
   `npx @netlify/mcp` inside the agent session container. Both
   `api.netlify.com` and `netlify-mcp.netlify.app` were refused by the session
   egress policy with `CONNECT tunnel failed, response 403`, on two separate
   attempts with a freshly minted token each time, and with no proxy-side relay
   failure recorded. Per the proxy documentation an egress denial is reported,
   not routed around.

   The Netlify MCP tools themselves work, because they execute outside the
   container. They can read the project, read and write environment variables
   and read a deploy. They cannot upload an artifact.
4. **Published by repository build.** The documentation changes recording steps
   1–3 were merged to `main` as #645. Netlify built that push and published it
   at 11:24:44Z. The upload denial therefore delayed the release by one merge
   and did not block it.

## The route that worked

Netlify's own repository build on the push to `main`. The site is repository
linked and the gate that had failed every such build since 31 July was now
satisfied, so merging #645 produced a production build without any further
action. A repository build is also the better evidence of the two, because it
carries the exact `commit_ref` it was built from and a zip upload need not.

## The release, as published

| Field | Value |
| --- | --- |
| Source commit | `ff1fe15db680dd5f5f6698749a8371aba2584cec` (`main`, merge of #645) |
| Deploy ID | `6a79b4d5a5e45e0008beec70` |
| State / context / branch | `ready` / `production` / `main` |
| Published | 2026-08-10T11:24:44.813Z, build time 38s |
| Application contract | 145 |
| Supabase project / contract | `vkfnsqdyhvtwyqkisxhk` / 145 |
| Netlify declaration | `EURO28_DEPLOYED_DB_CONTRACT=145`, production context |
| Access-control posture | Protected; anonymous requests answer 401 |
| Rollback deploy | `6a6bac566b6e440008d44e5b` (30 July, `8244b722…`) |
| Deploy summary | 38 files uploaded, 35 redirect rules, 1 header rule, no functions |
| Secret scan | 1651 files scanned, 0 matches |

The published commit is the one intended: `ff1fe15d…` is the exact `main` head at
merge time, and the deploy's `commit_ref` matches it character for character.

## Release smoke — could not run, and why that is not a verdict

`production-smoke.yml` run **`31383883792`** failed. It fetches
`https://euro28predictor.com/release.json` with plain `curl` and no credentials
and retries 120 times; every attempt between 11:32 and 11:42 returned **401**.

Against a protected site this workflow **fails by construction, whatever was
published** — it would have failed identically before this release. Its failure
is therefore not evidence about the artifact in either direction, and it must not
be reported as a failed release. It does confirm one thing: the perimeter refuses
an anonymous visitor.

The release gate in [`netlify-deploy-access.md`](netlify-deploy-access.md) names a
smoke the perimeter forbids. Closing that gap needs either a deliberately
unprotected release-identity endpoint or an authenticated smoke path. Both are
decisions about the perimeter, not fixes to apply in passing, so the gap is
recorded rather than closed here.

## Access-control posture — changed, and needs owner confirmation

A project read at 11:0x showed `requiresSSOTeamLogin: true` on all contexts with
`requiresPassword: false`. A read at 11:26, minutes after the release, showed the
reverse: `requiresPassword: true`, `whichProjectsRequirePassword: "all"`,
`requiresSSOTeamLogin: false`.

Nothing in this release changed it — the only Netlify write was
`EURO28_DEPLOYED_DB_CONTRACT` in the production context, and an environment
variable cannot move an access control. **An owner should confirm the switch from
Team SSO to password protection was deliberate.** The site is protected either
way, and this is not a public launch.

## What still owes evidence

1. **Owner confirmation of the access-control change** described above.
2. **A release smoke that can actually run** against a protected site, or an
   explicit decision that the 401 observations are the accepted substitute.
3. **A signed-in check of the released application** — nothing here proves what a
   logged-in player sees, only what was built and published.

## What this release is not

- **Not a public launch.** Team SSO stays on. `AGE-001` — the 18+ restriction
  ADR 0026 places on the initial external cohort — is accepted and
  unimplemented, and the owner's decision of 10 August 2026 is that the site
  stays behind SSO until it exists.
- **Not a Euro 2028 publication.** The server publication state is `hidden` in
  Production with empty history, and only an owner transition moves it.
- **Not a content launch.** Production holds **zero season fixtures** and no
  season competition has been opened for play there — contract 127's
  `admin_open_season_competition` has never been run against Production. A
  signed-in visitor would find the competitions empty. Publishing the artifact
  does not change that, and should not be mistaken for making the product
  playable.
