# Netlify deployment access and verification

This runbook defines the live Netlify project boundary for the Football Prediction Hub.

## Authoritative projects

**Two, not one.** This section said "Live Netlify project: `euro28predictor`"
until 12 August 2026, which was true before ADR 0026 and had been false since
the site split shipped. It is corrected rather than deleted, because a reader
who only skims the first heading would otherwise conclude the Hub is not a
production deployment.

| Project | Variant | Production URL | Perimeter |
| --- | --- | --- | --- |
| `predictorhub` | `VITE_SITE_VARIANT=hub` | `https://predictorhub.netlify.app` | Site password, all contexts (Team SSO until 12 August 2026) |
| `euro28predictor` | `VITE_SITE_VARIANT=euro` | `https://euro28predictor.com` | Site password, all contexts |

- The Hub has **no permanent brand domain**; its Netlify address is the production
  URL until `SITE-003` is decided, which ADR 0028 defers to the pre-public-beta
  brand decision.
- Historic project `euro28-predictor-dev` is retired and must not be configured, deployed or treated as current evidence.
- Both projects are protected on **all deploy contexts**, including production, and they are protected by **different mechanisms** — see [Access-control posture](#access-control-posture). The Euro project's mechanism changed on 10 August 2026 and the owner confirmed it.

## Contract declarations

Netlify's `EURO28_DEPLOYED_DB_CONTRACT` value describes the hosted database reached by a build in that deploy context. It is compatibility metadata for the build gate; it is **not** proof that an application bundle has been rebuilt or published.

**There are now TWO production Netlify projects, not one**, and they carry the
same four declarations: `predictorhub` (`VITE_SITE_VARIANT=hub`) and
`euro28predictor` (`VITE_SITE_VARIANT=euro`), which is ADR 0026's two-deployment
model. One table serves both because the values are identical; a future
divergence needs a second table rather than a footnote.

| Context | Supabase target | Declared hosted contract |
| --- | --- | ---: |
| `dev` | Development | 208 |
| `branch-deploy` | Development | 208 |
| `deploy-preview` | Development | 208 |
| `production` | Production | 208 |

A direct Netlify environment read on **20 August 2026** confirmed all four active build-context declarations at **208 on both projects**. Development, branch-deploy and deploy-preview moved only after Development Supabase was verified at 208. Production remained at 205 until guarded Production rollout run `32318082186` and an independent read-only Production query both confirmed Contract 208; only then were the two Production declarations raised to 208 and read back. This environment-variable change is configuration evidence, not proof that a new application bundle has been published.

A direct Netlify environment read and write on **12 August 2026** set all four
values on both projects, and each moved **after** the database it names, never
before. Production Supabase reached 178 through guarded rollout run
`31565613954`, confirmed by a postflight that NAMED the four new ledger rows;
Development reached 178 through fast-lane run `31561781188`. The production
declaration had stood at **174** and the three non-production ones at **171**,
so every production build from `main` failed
`scripts/validate-deployment-contract.mjs` — which demands an exact match — from
the moment contract 178 merged. **That is the guard doing its job**, and the
remedy is the one its own error message names: verify the target database, then
update the context value.

A direct Netlify project/environment read on 10 August 2026 confirmed the
earlier values of 151. The three non-production contexts point to the Development Supabase project; production points to the Production Supabase project. A fifth `dev-server` context still carries an empty declaration and therefore fails closed under `scripts/validate-deployment-contract.mjs`.

Each of the four moved on 10 August 2026 and each moved **after** the database it names, never before. The three non-production contexts were raised to 145 once the guarded fast lane had applied contract 145 to Development; production was raised from 144 to 145 only after guarded rollout run `31379974246` had applied contract 145 to Production Supabase and an independent read-only query had confirmed the 145-row ledger. Production Supabase reached 144 and then 145 on the same day, which is why the production declaration was raised twice and why neither raise led its database.

The repository test does not hard-code these numbers. It requires the documentation records to agree about each declared Netlify value, and it proves that a declaration never leads the hosted database targeted by that context. Equality is valid and an intentional trailing declaration is valid; a leading declaration is refused. Hosted database movement therefore does not manufacture a Netlify configuration change merely to keep numbers equal.

The declaration must never be raised ahead of the hosted database or used to manufacture a green build. After a separately authorised hosted rollout, update the matching Netlify context only from fresh target-specific evidence. An environment-variable update is configuration, not a deployment.

The blank `dev-server` override is a Netlify configuration debt. Remove it or set it deliberately before relying on Netlify Dev as hosted-contract evidence.

## Last fully smoke-verified published production artifact (12 August 2026)

> **Historical release evidence, not current deploy identity.** This table is retained because both artifacts were fully smoke-verified at the same commit. Current deploy identity must be read directly from Netlify; the live compatibility declarations are the table above.

**There are two of them**, and from 12 August 2026 they are the pair below. Both
were built by Netlify's own repository build on the push to `main`, both carry
the exact `commit_ref` they were built from, both are `ready` and published in
the `production` context, and — for the first time — **both are verified by a
smoke run at the same commit**.

| Field | `predictorhub` (hub) | `euro28predictor` (euro) |
| --- | --- | --- |
| Source commit | `d2fdd355e1baea94c67774322147d7c04f120980` | `d2fdd355e1baea94c67774322147d7c04f120980` |
| Deploy ID | `6a7c41e719ee920008fadfdb` | `6a7c41e7693a740008621202` |
| Primary URL | `https://predictorhub.netlify.app` | `https://euro28predictor.com` |
| Published | 2026-08-12T09:51:19.699Z, 47s | 2026-08-12T09:51:25.265Z, 51s |
| Application contract | 178 | 178 |
| Supabase project / contract | `vkfnsqdyhvtwyqkisxhk` / 178 | `vkfnsqdyhvtwyqkisxhk` / 178 |
| Netlify declaration | `EURO28_DEPLOYED_DB_CONTRACT=178` | `EURO28_DEPLOYED_DB_CONTRACT=178` |
| Perimeter | Site password, all contexts | Site password, all contexts |
| Deploy summary | 49 files, 40 redirect rules, 1 header rule, no functions | 49 files, 40 redirect rules, 1 header rule, no functions |
| Secret scan | 2070 files, 0 matches | 2072 files, 0 matches |
| Smoke run | [31584941688](https://github.com/nickygregal12-cmyk/Euro-2028-Predictor/actions/runs/31584941688) | [31585089127](https://github.com/nickygregal12-cmyk/Euro-2028-Predictor/actions/runs/31585089127) |

Each run asserted the same things against its own origin: an anonymous
`/release.json` refused with 401, the release identity matching on commit **and**
contract, every `netlify.toml` 200 rule serving the SPA shell, an unknown path
answering 404, Supabase endpoint isolation, and the anonymous browser journeys.
See [Closed on 12 August 2026, and the Hub is
smoked](#closed-on-12-august-2026-and-the-hub-is-smoked) for how the Hub became
reachable by the workflow, and for the evidence that its run really was against
the Hub.

**The earlier pair the same day** was `6a7c2ec4d5182500084a64cb` and
`6a7c2ec4d7558300084ea83e`, from `33f425b70e4618add59d94307ba03621db06eb06`,
published at 08:30Z. Only the Euro half of that pair could be smoked — run
[31579449516](https://github.com/nickygregal12-cmyk/Euro-2028-Predictor/actions/runs/31579449516),
green — because the Hub was still behind Team SSO.

**The first attempt failed and it is worth knowing why**, because the next
person to see it red should not go hunting. Run 31578733898, against the same
published artifact, passed the entire HTTP smoke and then failed one browser
assertion: after clicking through from the login page the URL was already
`/auth/signup` while the document title still read `Log in | Euro 2028
Predictor`, polled fourteen times over five seconds. `/auth/signup` is the one
route behind a lazily-imported gate — `EuroSignupGate`, the `EURO-003` control —
and React holds the previously committed UI, title included, while a route
transition suspends on a chunk. A cold CDN edge therefore looks exactly like
that. Driven locally against a real Euro build the title changed within 250ms,
and the passing run's browser step took four seconds where the failing one took
6.9. The expectation timeout in `playwright.production.config.ts` is now fifteen
seconds; no assertion was relaxed.

### The superseded single-site artifact, for reference

The previous published production deploy was **`6a7a2d87b532990008e72ca8`**, from
commit `9ab0ad5c042b14e41f41c1d73ba97f92573bca27`, published 2026-08-10T20:00:13.167Z
at application contract 151 — 54 files, 37 redirect rules, 1 header rule, secret
scan 1763 files and 0 matches, rollback target `6a79e0d575a053000855286b`. It is
the last artifact from before ADR 0026 split one deployment into two, which is
why the table above has two columns and this paragraph has one.

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

The perimeter is **not** an age control, and after 11 August 2026 there is no age control to be absent: `AGE-001` was **rejected by owner decision** — a free football predictor is not a betting product, so no 18+ rule, age gate or date-of-birth field applies. The sentence that stood here said the restriction was accepted and unimplemented and that a shared password was no substitute for it; it is corrected rather than deleted, because the reasoning it supported (the password is a convenience control) is unchanged. **This remains not a public launch.**

### The two production projects do not share a perimeter — recorded 12 August 2026

A project read on 12 August 2026 shows the two production sites protected by
**different mechanisms**:

| Project | Variant | Primary URL | Perimeter |
| --- | --- | --- | --- |
| `euro28predictor` | `euro` | `https://euro28predictor.com` | Site password, all contexts |
| `predictorhub` | `hub` | `https://predictorhub.netlify.app` | Site password, all contexts |

**They now share one mechanism, and until 12 August 2026 they did not.** The Hub
was on Netlify **Team SSO** — the mechanism the Euro site moved off on 10 August
— and that had one consequence worth recording rather than rediscovering during
an incident: `production-smoke.yml` could not run against the Hub at all. Its
anonymous half demands exactly 401, which is the site-password refusal and not
what Team SSO returns, and its authenticated half opens a session by posting to
the site-password form, which Team SSO does not have. Pointing the workflow at
the Hub would have failed on the perimeter step and told nobody anything about
the artifact — the same "fails by construction" shape recorded further down for
the pre-password era.

#### Closed on 12 August 2026, and the Hub is smoked

The owner chose the site password over leaving Team SSO in place, and set it on
`predictorhub` with SSO cleared **in the same save** — which is the ordering that
matters, because clearing SSO first would leave the Hub publicly reachable while
it still serves the Euro tournament's player routes (`EURO-001`), publishing Euro
2028 by accident. A project read confirms `requiresPassword: true`,
`whichProjectsRequirePassword: "all"` and `requiresSSOTeamLogin: false`.

`production-smoke.yml` takes a `site` input of `euro` or `hub` and resolves the
origin from it before the perimeter check. Everything after that is unchanged:
the two deployments share one Supabase project and one release identity, and
`scripts/production-smoke.mjs`, `production-smoke/anonymous.spec.ts` and
`playwright.production.config.ts` each derive the PRODUCT from the origin, so
nothing has to be told which brand to expect. `productionSmokePerimeter` asserts
that every origin the workflow can dispatch is one the script accepts, so an
option added without its origin fails CI rather than dying mid-run on "refusing
to smoke-test non-production origin".

**Both sites are now verified at the same commit**, which is the first time that
has been possible:

| | `predictorhub` (hub) | `euro28predictor` (euro) |
| --- | --- | --- |
| Smoke run | [31584941688](https://github.com/nickygregal12-cmyk/Euro-2028-Predictor/actions/runs/31584941688) | [31585089127](https://github.com/nickygregal12-cmyk/Euro-2028-Predictor/actions/runs/31585089127) |
| Commit | `d2fdd355e1baea94c67774322147d7c04f120980` | `d2fdd355e1baea94c67774322147d7c04f120980` |
| Deploy ID | `6a7c41e719ee920008fadfdb` | `6a7c41e7693a740008621202` |
| Published | 2026-08-12T09:51:19.699Z, 47s | 2026-08-12T09:51:25.265Z, 51s |
| Secret scan | 2070 files, 0 matches | 2072 files, 0 matches |

**That the Hub's session opened at all is the proof the passwords match.** The
workflow holds one `PRODUCTION_SITE_PASSWORD` secret and
`scripts/production-site-session.mjs` throws when a login sets no cookie, so a
different password on the Hub would have failed the run rather than passing it
quietly. The run is measurably against the Hub and not accidentally against the
Euro site twice: its log records
`EURO28_SMOKE_ORIGIN: https://predictorhub.netlify.app`, and the asset hashes it
fetched (`index-C-G1Tc7O.js`, `style-Cui5Tot0.css`) are not the Euro build's
(`index-D6lEbOIc.js`, `style-CdBTx5Rc.css`).

**A release means running it twice, once per site.** Concurrency is keyed per
site so the two do not queue behind each other, and a green run against one says
nothing about the other: they share a backend and a release identity but not a
bundle.

**On the deploy IDs in this runbook going stale.** Recording a deploy is itself a
commit, which produces a newer deploy — so the pair named above is the pair that
was *smoked*, and any deploy built from the commit that recorded them differs
only by documentation. That is a property of the smoke being dispatched by hand
after the fact. The way to end it is to run the smoke automatically on a
successful production deploy rather than on demand; until then, read these tables
as "the artifact that carried this evidence" rather than "the bytes currently
being served".

### Sharing the password

The password must not be pasted into an agent session transcript. It has no use there — the session egress policy blocks `euro28predictor.com` outright, so an agent cannot reach the site with or without it.

Where it has a use is a GitHub Actions runner, which can reach the site. It therefore belongs in a repository secret and is referenced by name from a workflow, so that no transcript, log, pull request or file in this repository ever contains the value.

### The release smoke now runs — closed 10 August 2026

`production-smoke.yml` run **`31397090845`** passed in full against published commit `be3efdff6ac9880e3385ae142d7f0485c5068649` at contract 145. The section below describes the gap as it stood before that run and is kept because it explains why the design is two assertions rather than one; the measured exchange behind the authenticated half is recorded in the header of `scripts/production-site-session.mjs`.

The passing run also produced a finding of its own. Its route sweep failed first on `/predict`, a retired tournament path that `netlify.toml` deliberately 404s and the smoke's hand-written list still demanded 200 for. That list is now derived from netlify.toml's own 200 rules, which widened the sweep from eight routes to thirty-three.

### The anonymous smoke could not pass while the site was protected

`production-smoke.yml` fetches `https://euro28predictor.com/release.json` with plain `curl` and no credentials, then retries 120 times before failing. Against a protected site every attempt is a 401, so **the workflow fails by construction regardless of what was published** — it would have failed identically before this release. Its failure is therefore not evidence about the artifact, in either direction.

This is the same limitation already recorded for protected previews. The gap is that the release gate names a smoke the perimeter forbids.

**The password makes it closable**, which team login did not. The intended shape is two assertions rather than one, because an authenticated-only smoke would be weaker than today's evidence in one respect — it would stop proving that an anonymous visitor is refused:

1. **Anonymous** — request `/release.json` with no credential and require **401**. This asserts the perimeter holds, and it is the check that currently fails by accident rather than by design.
2. **Authenticated** — repeat the existing release-identity, security-header and browser assertions with the site credential supplied from a repository secret.

Two things must be settled before writing it, and neither should be guessed:

- **The mechanism.** Netlify's site password protection is a login form, not HTTP Basic auth; Basic-Auth-via-`_headers` is a different feature. The exact non-interactive exchange has to be established **empirically on a runner**, because the session egress policy blocks the site. A probe step that prints status codes only — never the credential, never a response body — is the way to establish it.
- **The secret.** The value is added to repository secrets by the owner and referenced by name. It is never echoed, never written to a log, never committed, and never placed in a workflow `run:` line where it could reach a diagnostic dump.

### A stale allowance the release unblocked — retired 10 August 2026

`scripts/production-smoke.mjs` used to accept **either** brand in the application title, with its own comment saying to retire the legacy `Euro 2028 Predictor` form once production moved past contract 63. Production reached 145, so the condition it set itself was met.

It was retired in the change that made the smoke runnable rather than in the change that noticed it, deliberately: tightening an assertion against an artifact nobody had read would have been tightening it blind. Run `31397090845` proved the published title first, and only the current brand is accepted now.

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

This is not a substitute for application browser testing. The same workflow runs the authenticated application journeys against a disposable local Supabase rebuilt from every committed migration. Public CDN HTTP and browser smoke remain release-specific gates; while the site perimeter (site password protection since 10 August 2026, Team SSO before it) protects production, the private signed-in verification is the relevant outer-access posture.

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

**Site password protection** is the current private-testing perimeter across all contexts, by the owner decision of 10 August 2026 recorded above; Team SSO is **off**. This paragraph said "Team SSO" until 10 August 2026 and was left behind by that switch — the same document recorded the change forty lines higher while still asserting the old mechanism here, which is the drift `DOC-001` describes and the reason a live runbook states a fact in one place only.

The perimeter is a **convenience control, not a confidentiality control**, and it protects the Netlify-served site alone. Supabase endpoints are reachable on their own hostname and are not behind it, so the password mitigates neither `AUTH-002` nor `SEC-001` and must not be used to defer either. It is also not `AGE-001`.

Production database promotion, Netlify declaration alignment and application deployment are still separate operations. Before publishing a new application artifact, require the ordinary Production backup/preflight/exact-range/postflight controls, exact source/contract alignment, the intended feature flags, release smoke and a recorded rollback deploy.

Every production release must record the exact source commit, deploy ID, application contract, Supabase project/contract, Netlify declaration, access-control posture, smoke evidence and rollback deploy ID.
