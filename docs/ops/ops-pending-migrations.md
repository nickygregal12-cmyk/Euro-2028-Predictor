# Hosted migration inventory and rollout status

This is the operational migration inventory. Machine-readable development hosted state is authoritative in [`../../config/development-hosted-contract.json`](../../config/development-hosted-contract.json); repository contract is authoritative in [`../../config/deployment-contract.json`](../../config/deployment-contract.json). Historical rollout reports are evidence only.

## Current state — 4 August 2026

| Environment | Contract | Evidence | Status |
| --- | ---: | --- | --- |
| Repository `main` | **78** | 78 canonical migrations through `20260804053000_cup_league_schedule.sql` | MERGED |
| Development Supabase `iouzoutneyjpugbbtdem` | **78** | Hosted migration ledger directly verified through `20260804053000_cup_league_schedule`; machine record matches repository contract | VERIFIED AND ALIGNED |
| Production Supabase | **63** | Hosted migration ledger directly verified through `20260729154931_prediction_consensus_minimum_cohort` | PAUSED AND UNCHANGED |
| Netlify `euro28predictor` non-production contexts | repository-controlled | Preview and branch builds use the single active site. Development contract lag is informational under ADR 0024 | ACTIVE SITE ONLY |
| Netlify `euro28predictor` production | **63 hosted declaration** | Production remains tied to the contract-63 Euro baseline and retains the fatal contract gate | BLOCKED BY DESIGN |

The historic Netlify project `euro28-predictor-dev` is out of scope and must not be inspected as current state, configured or deployed to.

## Contracts 64–78

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

All contracts 64–78 are applied to development. None is authorised for production merely to remove the intentional contract gap.

## Pending hosted work

1. Keep development and repository contract evidence aligned through `.github/workflows/development-hosted-status-followup.yml` after every successful fast-lane rollout.
2. Before the next development migration, verify the generated hosted-status PR merges and that this inventory still references the machine record rather than a copied historical rollout narrative.
3. Keep production Supabase and the production Netlify contract at 63 until a separately scoped, explicitly approved milestone release.
4. Do not use the historic `euro28-predictor-dev` Netlify project.

## Next implementation boundary

Provider-ingestion custody is the next durable cross-platform slice: strict decoders, archive-before-decode custody, server-only Edge Function execution and canonical identity mapping, rebuilt from current `main`. Stale PR #352/#416 migrations must not be reused.

## Related authority

- [`../quality/current-status.md`](../quality/current-status.md)
- [`../../AGENTS.md`](../../AGENTS.md)
- [`../../config/deployment-contract.json`](../../config/deployment-contract.json)
- [`../../config/development-hosted-contract.json`](../../config/development-hosted-contract.json)
- [`../adr/0024-development-environment-operating-model.md`](../adr/0024-development-environment-operating-model.md)
