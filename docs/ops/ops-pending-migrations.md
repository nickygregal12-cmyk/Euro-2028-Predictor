# Hosted migration inventory and rollout status

This is the operational migration inventory. Machine-readable development hosted state is authoritative in [`../../config/development-hosted-contract.json`](../../config/development-hosted-contract.json); repository contract is authoritative in [`../../config/deployment-contract.json`](../../config/deployment-contract.json). Historical rollout reports are evidence only.

## Current state — 4 August 2026

| Environment | Contract | Evidence | Status |
| --- | ---: | --- | --- |
| Repository candidate | **81** | 81 canonical migrations through `20260804080000_provider_ingestion_custody.sql`; contract 81 adds server-only provider response custody and decoder evidence | EXACT GATES REQUIRED BEFORE MERGE |
| Development Supabase `iouzoutneyjpugbbtdem` | **80** | Fast-lane run 30889736356 applied `20260804073000_season_card_lock_resolution.sql` and postflight reported `Development is at contract 80.`; the hosted ledger was independently re-read on 4 August 2026 | VERIFIED; CONTRACT 81 NOT APPLIED |
| Production Supabase | **63** | Hosted migration ledger directly verified through `20260729154931_prediction_consensus_minimum_cohort` | PAUSED AND UNCHANGED |
| Netlify `euro28predictor` non-production contexts | **79 declared / 80 Development** | `dev`, branch-deploy and deploy-preview point to the Development project but still declare `EURO28_DEPLOYED_DB_CONTRACT=79` | DECLARATION TRAILS DEVELOPMENT BY ONE |
| Netlify `euro28predictor` production | **63 hosted declaration** | Production points to the production Supabase project and retains the fatal contract gate | BLOCKED BY DESIGN |

The historic Netlify project `euro28-predictor-dev` is out of scope and must not be inspected as current state, configured or deployed to.

## Contracts 64–81

- **64:** Cup winner deletion semantics.
- **65:** Stage C1 competition-season foundation.
- **66:** C1b game catalogue and memberships.
- **67:** Matchweek lock scope.
- **68:** Season fixtures.
- **69:** Season predictions.
- **70:** Season scoring SQL parity.
- **71:** LMS pick resolution.
- **72:** LMS persistence.
- **73:** LMS round conclusion and season exhaustion.
- **74:** Season Cup rules.
- **75:** Neutral Cup points source.
- **76:** Neutral Cup settlement source.
- **77:** Season Cup sources.
- **78:** Circle-method season Cup league schedule.
- **79:** Shared Cup-store competition domains.
- **80:** Season matchweek card lock resolution.
- **81:** Server-only provider-ingestion custody and strict decoder evidence.

Contracts 64–80 are applied to Development. Contract 81 is a repository candidate and is not applied or deployed. None is authorised for production merely to remove the intentional contract gap.

## Pending hosted work

1. Merge contract 81 only after exact CI, Database parity, Browser E2E, hosted-inventory and Netlify preview gates pass, review threads are clear and no later contract claimant has taken the next migration count.
2. Apply contract 81 to Development through `.github/workflows/development-fast-lane-rollout.yml` with project ref `iouzoutneyjpugbbtdem` and the exact ADR-0024 confirmation phrase. The workflow must prove the pending migration additive, take its lightweight snapshot, push only the pending migration and report `Development is at contract 81.`
3. After the hosted ledger is verified at 81, update `config/development-hosted-contract.json` from the fast-lane run evidence and align Netlify `dev`, `branch-deploy` and `deploy-preview` declarations to 81. Keep production at 63.
4. Deploy `provider-poll` to Development only after the migration is present. Do not configure or call a provider until the named caller key and a bounded non-production provider credential are separately available.
5. Do not use the historic `euro28-predictor-dev` Netlify project.

## Next implementation boundary

Contract 81 supplies custody and strict decoding only. The first provider rehearsal is one bounded non-production request whose raw response and processing evidence are verified without writing any official fixture, result, lock, score or standing. If authentication material is unavailable, stop after deployment rather than weakening the boundary.

## Related authority

- [`../quality/current-status.md`](../quality/current-status.md)
- [`../../AGENTS.md`](../../AGENTS.md)
- [`../../config/deployment-contract.json`](../../config/deployment-contract.json)
- [`../../config/development-hosted-contract.json`](../../config/development-hosted-contract.json)
- [`../adr/0024-development-environment-operating-model.md`](../adr/0024-development-environment-operating-model.md)
