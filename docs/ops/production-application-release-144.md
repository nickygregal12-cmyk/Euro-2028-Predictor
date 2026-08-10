# Production application release — contract 144, behind Team SSO

> **Superseded on 10 August 2026, and never executed.** Production Supabase reached
> contract **145** later the same day through rollout run `31379974246`, which removed
> this runbook's central constraint. Its release candidate `d1a0dcd` was the last
> commit whose declaration read 144; with the database at 145 that commit is now the
> one that *cannot* ship, and current `main` is the candidate. The successor is
> [`production-application-release-145.md`](production-application-release-145.md).
> This document is retained as the record of the decision as it stood at contract 144
> and must not be followed.

| Field | Value |
| --- | --- |
| Authority | Superseded operational runbook |
| Status | Superseded, never executed |
| Date | 10 August 2026 |
| Owner decision it serves | Publish a current application artifact to Netlify production and keep Team SSO on; do not expose the site publicly until `AGE-001` exists |
| Governs | The steps and evidence for one application release |
| Does not govern | Database promotion ([`ops-pending-migrations.md`](ops-pending-migrations.md)); public exposure, which is explicitly out of scope here |

## Why this document exists

Production Supabase reached **contract 144** on 10 August 2026. The published
application did not move with it: the live artifact is still the 30 July build
from `8244b7222b9d108e59380fd16351c02b578497ee`, a **contract-63-era** bundle.
Database promotion and application release are separate operations and this is
the second one.

`netlify-deploy-access.md` requires that before publishing an artifact we have
exact source/contract alignment, the intended feature flags, release smoke and a
recorded rollback deploy. This runbook supplies the first two and names the
other two as steps.

## The blocker that decides which commit ships

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

**Current `main` therefore cannot be published.** The repository is at contract
**145** (`20260810010000_rate_limit_atomicity`) and Production Supabase is at
**144**. Publishing `main` would require declaring 145, which would make the
declaration LEAD its database — the one direction
[`ops-pending-migrations.md`](ops-pending-migrations.md) forbids.

## The release candidate

**`d1a0dcd43714da83e00f23f4de261a48483274bc`** — "Docs: record 2026-08-10 03:00
progress handover (#630)". The last commit on `main` whose
`deployment-contract.json` reads **144**, so it matches Production exactly.

It contains every UI Alpha batch through **J**, and the whole 133–144 backend set
now live in Production. Verified: `npm run build` succeeds and stays within the
bundle budgets.

What it does **not** contain, relative to current `main`: the **admin** Euro
publication page from #633, plus the workflow and record-keeping changes from
#639 and #640. The admin page is a `super_admin` surface, not a player one, and
its underlying RPCs (contract 143) are already in Production — so nothing a
player can reach is missing from this candidate.

The alternative is to promote contract 145 to Production first and then publish
current `main`. That is a larger decision, not a step: contract 145 redefines
`enforce_rate_limit` to take an advisory lock and is deliberately outside the
authorised Production set.

## Feature flags — a decision, not a default

`netlify.toml` sets the UI flags for **deploy-preview only**:

```toml
[context.deploy-preview.environment]
  VITE_UI_PUBLIC_LANDING = "true"
  VITE_UI_SEASON_MATCH_PREDICTOR = "true"
```

There is no production block. `src/app/routeFlags.ts` fails closed: anything not
exactly `'true'` selects the **legacy** journey, and `VITE_*` values are
build-time, so a flag cannot be flipped on a live bundle afterwards.

**Published as-is, production would serve the legacy landing and the legacy
season Match Predictor** — the UI Alpha work would be invisible. Failing closed
is correct behaviour, and it means the flags have to be set deliberately in the
Netlify production context before the build, or consciously left off.

## Steps

Every step below needs Netlify access. They are written to be executed by
someone who has it.

1. **Record the rollback target.** Note the current published production deploy
   ID for `8244b722…` before anything changes. A release without a recorded
   rollback deploy does not meet the gate.
2. **Set the production context declaration** `EURO28_DEPLOYED_DB_CONTRACT=144`.
   It reads **132** as of the 8 August project read, so this is a change, not a
   confirmation. 144 matches Production Supabase exactly and satisfies the
   prebuild guard.
3. **Decide the feature flags** and set them in the production context. To ship
   the UI Alpha journeys, set `VITE_UI_PUBLIC_LANDING=true` and
   `VITE_UI_SEASON_MATCH_PREDICTOR=true`. To ship the legacy journeys, set
   nothing and record that it was deliberate.
4. **Publish `d1a0dcd`** to the production context.
5. **Confirm Team SSO is still on** for production. This release is explicitly
   not a public launch.
6. **Run release smoke**: dispatch `production-smoke.yml` with
   `expected_commit=d1a0dcd43714da83e00f23f4de261a48483274bc` and
   `expected_contract=144`.
7. **Record the release** — source commit, deploy ID, application contract,
   Supabase project and contract, Netlify declaration, access-control posture,
   smoke evidence and rollback deploy ID — as `netlify-deploy-access.md`
   requires.

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
