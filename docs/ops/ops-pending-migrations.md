# Hosted migration inventory and rollout status

This is the operational migration inventory. Machine-readable development hosted state is authoritative in [`../../config/development-hosted-contract.json`](../../config/development-hosted-contract.json); repository contract is authoritative in [`../../config/deployment-contract.json`](../../config/deployment-contract.json). Historical rollout reports are evidence only.

## Current state — 4 August 2026

The repository is at **contract 92**; development is at 91 until the next rollout.

| Environment | Contract | Evidence | Status |
| --- | ---: | --- | --- |
| Repository `main` | **92** | Contract 92 makes `carried_to_replay` reachable from stored data, through `20260804203000_season_fixture_replay_link.sql` | MERGED; DEVELOPMENT NOT YET APPLIED |
| Development Supabase `iouzoutneyjpugbbtdem` | **91** | Applied 4 August 2026 by fast-lane run 30916033941 on `a0af06d`, whose postflight step reported `Development is at contract 91.`; evidence artifact `development-fast-lane-evidence` (ID 8895146221) retained. Corroborated read-only against the database, structurally and behaviourally: `season_matchweek_scores` carries its 4 CHECK constraints and its shape trigger; both settlement functions exist in `predictor_internal` with no `EXECUTE` for `anon`, `authenticated` or `public`; `is_settlement_score('{}')` returns false rather than null, a scoreless `completed` fixture refuses `completed_without_result`, and a card of completed + void + carried-to-replay reports a matches-played denominator of 1 | VERIFIED AND ALIGNED |
| Production Supabase | **63** | Hosted migration ledger directly verified through `20260729154931_prediction_consensus_minimum_cohort` | PAUSED AND UNCHANGED |
| Netlify `euro28predictor` non-production contexts | **86 hosted declaration** | `dev`, branch-deploy and deploy-preview point to Development, declare `EURO28_DEPLOYED_DB_CONTRACT=86`, and require Netlify team login | VERIFIED AND ALIGNED WITH DEVELOPMENT |
| Netlify `euro28predictor` production | **63 hosted declaration** | Production points to Production Supabase, remains publicly accessible and retains the fatal contract gate | BLOCKED BY DESIGN |

The historic Netlify project `euro28-predictor-dev` is out of scope and must not be inspected as current state, configured or deployed to.

## Contracts 64–92

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
- **82:** The matchweek card is not pre-filled (ADR 0012 amendment).
- **83:** Recurring season matchweek scheduler.
- **84:** LMS eligibility and auto-assignment parity.
- **85:** LMS result-to-outcome rule and season replay.
- **86:** Season LMS selection made possible (participation check accepts either fixture link).
- **87:** The mandatory used-list reset made storable (club uniqueness scoped to a used cycle).
- **88:** Lock-time auto-assignment for a missed season LMS pick, behind a narrowed server-only lock exception.
- **89:** The season LMS settlement job — replay from results, the entrant-state projection, and an hourly cron tick.
- **90:** The season Main Predictor score store, at matchweek granularity.
- **91:** Matchweek settlement parity — what each fixture on a card means for scoring, and whether the matchweek may settle.
- **92:** The replay link — which fixture an abandoned match handed its slot to, making `carried_to_replay` reachable from stored data.

Contracts 64–91 are applied to development; contract 92 is merged and not yet applied. None is authorised for production merely to remove the intentional contract gap.

## Pending hosted work

1. Re-read `main`, the development machine record and open migration PRs before every hosted change; never infer current state from an older report.
2. Apply every later contract to development only through the guarded rollout workflow and update the development machine record from fresh postflight evidence. Contracts 87 and 88 were applied by fast-lane run 30906915108, contract 89 by run 30911943023, and contracts 90 and 91 by run 30916033941, all on 4 August 2026.
3. Update the Netlify `dev`, branch-deploy and deploy-preview declarations to 91 now that the development rollout is verified.
4. Keep production Supabase and the production Netlify declaration at 63 until a separately scoped, explicitly approved milestone release.
5. Keep non-production Netlify deploys protected by team login and use the repository's protected-preview verification gate.
6. Do not use the historic `euro28-predictor-dev` Netlify project.

## Next implementation boundary

The current implementation boundary is controlled by the roadmap and the active PR queue. This inventory records hosted state; it does not authorise the next migration, a provider poll, a function deployment or a production release.

## Related authority

- [`netlify-deploy-access.md`](netlify-deploy-access.md)
- [`../quality/current-status.md`](../quality/current-status.md)
- [`../../AGENTS.md`](../../AGENTS.md)
- [`../../config/deployment-contract.json`](../../config/deployment-contract.json)
- [`../../config/development-hosted-contract.json`](../../config/development-hosted-contract.json)
- [`../adr/0024-development-environment-operating-model.md`](../adr/0024-development-environment-operating-model.md)
