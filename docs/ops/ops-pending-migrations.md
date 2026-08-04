# Hosted migration inventory and rollout status

This is the operational migration inventory. Machine-readable development hosted state is authoritative in [`../../config/development-hosted-contract.json`](../../config/development-hosted-contract.json); repository contract is authoritative in [`../../config/deployment-contract.json`](../../config/deployment-contract.json). Historical rollout reports are evidence only.

## Current state — 4 August 2026

| Environment | Contract | Evidence | Status |
| --- | ---: | --- | --- |
| Repository `main` | **79** | 79 canonical migrations through `20260804063000_cup_store_competition_domains.sql` | MERGED |
| Development Supabase `iouzoutneyjpugbbtdem` | **79** | Hosted migration ledger directly verified through `20260804063000_cup_store_competition_domains`; machine record matches the hosted database | VERIFIED AND ALIGNED |
| Production Supabase | **63** | Hosted migration ledger directly verified through `20260729154931_prediction_consensus_minimum_cohort` | PAUSED AND UNCHANGED |
| Netlify `euro28predictor` non-production contexts | **79 declared / 79 Development** | `dev`, branch-deploy and deploy-preview point to the development Supabase project and declare `EURO28_DEPLOYED_DB_CONTRACT=79` | VERIFIED AND ALIGNED |
| Netlify `euro28predictor` production | **63 hosted declaration** | Production points to the production Supabase project and retains the fatal contract gate | BLOCKED BY DESIGN |

The historic Netlify project `euro28-predictor-dev` is out of scope and must not be inspected as current state, configured or deployed to.

## Contracts 64–79

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

All contracts 64–79 are applied to development. None is authorised for production merely to remove the intentional contract gap.

## Pending hosted work

1. Keep the Development machine record, Netlify non-production declarations and this inventory aligned after every later migration rollout.
2. Keep production Supabase and the production Netlify contract at 63 until a separately scoped, explicitly approved milestone release.
3. Do not use the historic `euro28-predictor-dev` Netlify project.

## Next implementation boundary

Provider-ingestion custody is the next durable cross-platform slice: strict decoders, archive-before-decode custody, server-only Edge Function execution and canonical identity mapping, rebuilt from current `main`. Stale PR #352/#416 migrations must not be reused.

## Related authority

- [`../quality/current-status.md`](../quality/current-status.md)
- [`../../AGENTS.md`](../../AGENTS.md)
- [`../../config/deployment-contract.json`](../../config/deployment-contract.json)
- [`../../config/development-hosted-contract.json`](../../config/development-hosted-contract.json)
- [`../adr/0024-development-environment-operating-model.md`](../adr/0024-development-environment-operating-model.md)
