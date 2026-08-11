# Production application release — contract 145, behind Team SSO

> **Correction — 10 August 2026, recorded alongside rather than applied to the record below.**
>
> **The title and the "Owner decision it serves" row are wrong about the mechanism, and are deliberately left as written.** They say Team SSO. The perimeter is **site password protection on all contexts**, with Team SSO **off** — the switch happened minutes after this release, the owner confirmed it as deliberate the same day, and §"What changed about access" further down this document already records it. This document was drafted before the switch was confirmed, so its heading preserves what was believed at the moment of the release. It is dated evidence: rewriting the title would make the record look like it always knew, and destroy the only trace that the release and the perimeter change crossed.
>
> The live authority for the perimeter is [`netlify-deploy-access.md`](../netlify-deploy-access.md). Read it, not this heading.
>
> **The substance of the decision is unaffected.** The site stays private and this is still not a public launch — only the mechanism holding it private changed, and the password is a convenience perimeter rather than a confidentiality control. It gates the Netlify-served site alone; Supabase endpoints answer on their own hostname and are not behind it, so it mitigates neither `AUTH-002` nor `SEC-001`, and it is not `AGE-001`.

| Field | Value |
| --- | --- |
| Authority | Operational runbook |
| Status | **Executed 10 August 2026.** Deploy `6a79b4d5a5e45e0008beec70` published from `ff1fe15d…`. Anonymous release smoke could not run against a protected site. |
| Date | 10 August 2026 |
| Owner decision it serves | Publish a current application artifact to Netlify production and keep Team SSO on; do not expose the site publicly until `AGE-001` exists |
| Governs | The steps and evidence for one application release |
| Does not govern | Database promotion ([`ops-pending-migrations.md`](../ops-pending-migrations.md)); public exposure, which is explicitly out of scope here |
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

## Release smoke — closed, and green

**`production-smoke.yml` run `31397090845` passed in full on 10 August 2026**,
against published commit `be3efdff6ac9880e3385ae142d7f0485c5068649` at contract
145. Every step succeeded: the anonymous perimeter assertion, the authenticated
release-identity poll, the browser session, the HTTP smoke and the Playwright
browser smoke.

That took three attempts, and the two failures were both worth having.

**Attempt 1 — run `31383883792`.** The pre-rework smoke fetched `release.json`
with no credentials and retried 120 times; every attempt between 11:32 and 11:42
returned 401. Against a protected site it **failed by construction whatever was
published**, and would have failed identically before the release. That failure
was never evidence about the artifact in either direction — only that the
perimeter refuses an anonymous visitor.

**Attempt 2 — run `31394280878`.** The reworked smoke got through the perimeter
assertion, found the exact release and opened a browser session, then stopped:

```
STOP: https://euro28predictor.com/predict returned HTTP 404; expected 200.
```

A real finding, and the stale side was the smoke. `src/App.tsx` declares no
`/predict` route and `netlify.toml` deliberately sends it to the 404 catch-all
with the other retired Euro/tournament paths. Only the smoke's hand-written route
list still demanded 200 there, and nothing had caught it because the smoke had
not been able to run far enough to look. The list is now derived from
netlify.toml's own 200 rules, which also widened the sweep from eight hand-listed
routes to the thirty-three the configuration actually promises — every
parameterised competition, league, join, h2h and profile route among them, none
of which had ever been checked against production.

**Attempt 3 — run `31397090845`.** Green.

### What the passing run establishes

- An anonymous visitor is refused: `/release.json` without a credential answers
  401, asserted rather than merely observed.
- The published release identity is exact — environment, application contract,
  hosted contract, Supabase project and commit.
- Deployed security headers match the ones `netlify.toml` commits.
- All thirty-three routes the configuration promises serve the SPA shell, and an
  unknown path answers 404 rather than a soft 200.
- The signed-out browser journeys behave: login, signup, reset, the not-found
  page, and the signed-out gate on `/` and `/play`.
- No browser request reached the Development Supabase project.

## Access-control posture — changed, and confirmed

A project read at 11:0x showed `requiresSSOTeamLogin: true` on all contexts with
`requiresPassword: false`. A read at 11:26, minutes after the release, showed the
reverse: `requiresPassword: true`, `whichProjectsRequirePassword: "all"`,
`requiresSSOTeamLogin: false`.

Nothing in this release changed it — the only Netlify write was
`EURO28_DEPLOYED_DB_CONTRACT` in the production context, and an environment
variable cannot move an access control.

**The owner confirmed the same day that the switch was deliberate**: a site
password is easier to hold open while testing the real application than Team SSO,
and nothing private sits behind it. The perimeter is therefore site password
protection on all contexts, by decision.

That confirmation does not widen what the perimeter is for. It is a convenience
barrier, not a confidentiality control — real access control stays in Supabase
row-level security, the bounded RPCs and the server-enforced reveal rules. And it
is not `AGE-001`: a shared password is no substitute for the 18+ restriction
ADR 0026 places on the initial external cohort, which is still accepted and
unimplemented. This is still not a public launch.

## What still owes evidence

**A signed-in check of the released application.** Everything above is the
signed-out surface. Nothing here proves what a logged-in player sees, and the
honest expectation is that they would find the competitions empty: Production
holds zero season fixtures and `admin_open_season_competition` has never been run
there.

Two items that stood here are now closed and are recorded above rather than
deleted: the release smoke runs (run `31397090845`), and the legacy-brand
allowance in `scripts/production-smoke.mjs` is retired — the first authenticated
run proved the published title before the looser branch was dropped, which is
exactly why it waited.

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
