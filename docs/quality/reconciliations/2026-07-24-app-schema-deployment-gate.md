# Application/database deployment compatibility gate

**Workstream:** production release compatibility / `OPS-006`  
**Date:** 24 July 2026  
**Repository implementation:** PR #25  
**Merge commit:** `2424a7bffc5390f55cb34ddffc3cc7c56d48bcdc`

## Verdict

A fail-closed application/database contract gate is now present in `main`.

Deploy previews, branch deploys and Netlify development can build against verified development contract 35. Production remains declared at database contract 20, so new production builds cannot publish application contract 35 until the complete migrations 21–35 rollout and production verification have actually completed.

The public site remains on the previous verified ready production deploy. This is an intentional release freeze, not an outage.

## Contract definition

`config/deployment-contract.json` currently defines:

- application/database contract version `35`;
- required repository migration count `35`;
- required RPC signatures:
  - `public.replace_predicted_progression(uuid,jsonb,jsonb)`;
  - `public.delete_match_prediction(uuid,uuid,integer)`.

The version is deliberately explicit. Adding a repository migration without reviewing and updating the contract causes builds to fail rather than silently changing the compatibility boundary.

## Netlify declared hosted contracts

| Context | Declared deployed database contract |
| --- | ---: |
| `production` | 20 |
| `deploy-preview` | 35 |
| `branch-deploy` | 35 |
| `dev` | 35 |

These are build-only values. They are not exposed to the browser as `VITE_` variables.

The production value must remain 20 until migrations 21–35 have executed on production and the exact post-rollout verifier, advisors and required application smoke tests have passed.

## Build guard

`scripts/validate-deployment-contract.mjs` runs in the `prebuild` lifecycle after the Netlify environment-isolation guard.

It:

1. loads the reviewed deployment contract;
2. counts repository SQL migration files;
3. fails when the migration count and contract disagree;
4. permits ordinary non-Netlify CI/local builds after the repository check;
5. requires a numeric `EURO28_DEPLOYED_DB_CONTRACT` for Netlify builds;
6. fails whenever the declared hosted contract differs from the application requirement.

The error directs the operator not to deploy until the target database is verified and its context value is updated.

## Executable evidence

PR #25 deploy preview:

- deploy ID: `6a630fa09d8dc400083a983a`;
- source commit: `416f7542b0c267f0e26efcc9006a92e3744e78bb`;
- context: `deploy-preview`;
- state: ready;
- declared database contract: 35.

Application CI passed:

- dependency installation;
- build and both prebuild guards;
- lint;
- all tests, including deployment-contract regression tests;
- production dependency audit.

`tests/scripts/deploymentContractGuard.test.ts` proves:

- local/CI repository validation succeeds;
- every recognised Netlify context succeeds with contract 35;
- every recognised context fails with contract 20;
- missing and non-numeric values fail.

## Post-merge production evidence

PR #25 was squash-merged as `2424a7bffc5390f55cb34ddffc3cc7c56d48bcdc`.

After merge, Netlify's current production pointer remained:

- deploy ID `6a630e4de510f100077bc120`;
- source commit `a6d3f1c97a93d48789435457769fd627c305ff27`;
- state `ready`.

The merged application contract is 35 while the production build context declares deployed database contract 20. The new release therefore does not replace the current ready site. The existing production application/database mismatch remains live, but it can no longer be broadened by another incompatible automatic production deployment.

## Procedure for lifting the gate

Only after the approved production migration procedure has completed:

1. require migrations 21–35 to be present on production;
2. run `scripts/database-rollout/post-rollout-verification.sql` and require every result true;
3. run security advisors and retain the accepted output;
4. complete the authenticated production smoke checklist;
5. update production Netlify build variable `EURO28_DEPLOYED_DB_CONTRACT` from `20` to `35`;
6. retry the approved production deploy;
7. verify the new deploy is ready and the current pointer advances;
8. record the exact release/application/database contract pair.

Never update the production value early merely to make a build pass.

## Safety boundary

- Production Supabase schema, data and migration history were unchanged.
- Development Supabase was unchanged.
- Production Supabase browser variables were unchanged.
- The current ready production deploy remained available.
- The gate does not prove migrations are installed; it consumes separately verified hosted-contract evidence.
- Recovery evidence and explicit migration approval remain separate mandatory gates.
