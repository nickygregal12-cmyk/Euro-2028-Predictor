# Hosted migration inventory and rollout status

This is the operational migration inventory. Machine-readable development hosted state is authoritative in [`../../config/development-hosted-contract.json`](../../config/development-hosted-contract.json); repository contract is authoritative in [`../../config/deployment-contract.json`](../../config/deployment-contract.json). Historical rollout reports are evidence only.

## Current state — 4 August 2026

| Environment | Contract | Evidence | Status |
| --- | ---: | --- | --- |
| Repository candidate | **86** | 86 canonical migrations through `20260804143000_provider_ingestion_custody.sql`; contract 86 adds server-only provider response custody and decoder evidence | EXACT GATES REQUIRED BEFORE MERGE |
| Development Supabase `iouzoutneyjpugbbtdem` | **84** | Applied 4 August 2026 by fast-lane run 30899305992, whose postflight reported `Development is at contract 84.` | VERIFIED; CONTRACTS 85–86 PENDING |
| Production Supabase | **63** | Hosted migration ledger directly verified through `20260729154931_prediction_consensus_minimum_cohort` | PAUSED AND UNCHANGED |
| Netlify `euro28predictor` non-production contexts | **trails Development** | Non-production declarations are aligned only after a verified Development rollout | ALIGN AFTER CONTRACT 86 POSTFLIGHT |
| Netlify `euro28predictor` production | **63 hosted declaration** | Production points to production Supabase and retains the fatal contract gate | BLOCKED BY DESIGN |

The historic Netlify project `euro28-predictor-dev` is out of scope and must not be inspected as current state, configured or deployed to.

## Contracts 64–86

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
- **81:** Season matchweek card status and submission-outcome storage.
- **82:** The matchweek card is not pre-filled.
- **83:** Recurring season matchweek scheduler.
- **84:** LMS eligibility and auto-assignment parity.
- **85:** LMS result-to-outcome rule and season replay.
- **86:** Server-only provider-ingestion custody and strict decoder evidence.

Contracts 64–84 are applied to Development. Contracts 85 and 86 are additive pending migrations and may be applied together by the ADR-0024 fast lane after contract 86 merges. None is authorised for production merely to remove the intentional contract gap.

## Pending hosted work

1. Merge contract 86 only after exact CI, Database parity, Browser E2E, hosted-inventory and Netlify preview gates pass, review threads are clear and no later contract claimant exists.
2. Apply contracts 85 and 86 to Development through `.github/workflows/development-fast-lane-rollout.yml` with project ref `iouzoutneyjpugbbtdem` and confirmation `APPLY-DEVELOPMENT-FAST-LANE`.
3. Require the fast lane to identify both pending migrations, prove both additive, take its lightweight snapshot, push them and report `Development is at contract 86.`
4. Align the machine-readable Development contract and Netlify non-production declarations only after hosted verification. Keep production at 63.
5. Deploy `provider-poll` to Development only after the migration is present. Do not configure or call a provider until the named caller key and a bounded non-production credential are separately available.

## Next implementation boundary

The first provider rehearsal is one bounded non-production request whose raw response and processing evidence are verified without writing any official fixture, result, lock, score or standing. If authentication material is unavailable, stop after deployment rather than weakening the boundary.

## Related authority

- [`../quality/current-status.md`](../quality/current-status.md)
- [`../../AGENTS.md`](../../AGENTS.md)
- [`../../config/deployment-contract.json`](../../config/deployment-contract.json)
- [`../../config/development-hosted-contract.json`](../../config/development-hosted-contract.json)
- [`../adr/0024-development-environment-operating-model.md`](../adr/0024-development-environment-operating-model.md)
