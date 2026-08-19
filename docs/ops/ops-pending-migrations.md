# Hosted migration status

> **Live index only.** The machine records are authoritative; this page exists so a human or AI can see the current rollout boundary without reading the historical contract chronology. The previous full narrative is preserved at [`docs/history/context-reset-2026-08-19/ops-pending-migrations.pre-reconciliation.txt`](../history/context-reset-2026-08-19/ops-pending-migrations.pre-reconciliation.txt).

## Current state — repository 207, Production 205, Development 205 (19 August 2026)

Repository contract **207** is the head of the committed migration chain.

| Environment | Recorded contract | Authority |
| --- | ---: | --- |
| Development Supabase `iouzoutneyjpugbbtdem` | **205** | [`config/development-hosted-contract.json`](../../config/development-hosted-contract.json) |
| Production Supabase | **205** | [`config/production-hosted-contract.json`](../../config/production-hosted-contract.json) |

> **Contract 206 repository candidate — same-season player profile visibility (19 August 2026):**
> `20260819110000_same_season_player_profile.sql`. Its rollout is carried by the one-shot
> workflow `contract-206-development-one-shot.yml`, which is hard-pinned to
> `20260819110000` being the newest migration in the chain — so it must fire **before**
> contract 207 merges, or be amended.
>
> **Contract 207 repository candidate — the provider fixture lifecycle (19 August 2026):**
> `20260819200000_provider_fixture_lifecycle.sql` repairs season resolution in the ingestion
> driver, seeds the SportMonks postponed token, applies and reverses a provider postponement
> on `season_fixtures.status`, lets a postponed fixture take its replacement date, and states
> what a postponed or voided fixture does to a prediction deadline. It claims **no**
> Development or Production rollout. **Development is measurably behind the provider feed
> until it is applied:** every decoded response since `2026-08-10T15:27Z` was consumed with
> outcome `unresolved_season`, so no kickoff revision, result, live projection or calendar
> proposal has been recorded there for nine days.

**Contracts 206 and 207 are both pending in both hosted environments: Development and Production remain at Contract 205.** Development must move first through its guarded lane; Production remains a separate unauthorised future promotion. Contracts 199 to 205 reached Development first and Production second, in that order, which the Production workflows refuse to invert. Production was moved by guarded rollout [32253892640](https://github.com/nickygregal12-cmyk/Euro-2028-Predictor/actions/runs/32253892640) from exact `main` `8971245`, gated on encrypted backup [32229916242](https://github.com/nickygregal12-cmyk/Euro-2028-Predictor/actions/runs/32229916242) and exact-head rehearsal [32252751621](https://github.com/nickygregal12-cmyk/Euro-2028-Predictor/actions/runs/32252751621). **That run is recorded FAILED and it is not a contradiction:** the apply succeeded and the run then exited on its own postflight measurement, so Production is correctly migrated and the workflow's own verification never ran. The measured read-back is in the machine record, which is the authority; this page states only that the boundary was crossed and where to read the evidence.
## Netlify deployed-contract declarations

These rows deliberately mirror the current declaration table in [`netlify-deploy-access.md`](netlify-deploy-access.md). A declaration may trail its hosted database; it must never lead it.

| Surface | Declared contract |
| --- | ---: |
| Netlify `euro28predictor` non-production contexts | **178 hosted declaration** |
| Netlify `euro28predictor` production | **178 hosted declaration** |

- Development and Production each have **2** repository migrations still to apply. Development is the next authorised rollout lane; this does not authorise Production.- Production promotion is **not authorised**, and that flag stayed fail-closed through the 198-to-205 rollout rather than being left open behind it. Production is level with Development here, not lower; when it is lower, that is a controlled state and not permission to apply anything.
- Repository, Development and Production remain separate closure states. Never infer hosted state from the repository count.
- The historic Netlify project `euro28-predictor-dev` is out of scope for the current Development/Production migration lane.

## How to use this page

1. Read the three machine records before any rollout.
2. If Development trails the repository, use the guarded Development lane required by the governing ADR/workflow.
3. Production moves only under explicit authority for the exact boundary and with its own backup/rehearsal gates.
4. For why a historical contract existed, use the archived narrative or the migration/PR itself — do not reconstruct history from this live index.

The old “Repository candidate … applied to no hosted environment by this record” blocks are **historical contract records**, not a current pending queue; that wording is intentionally kept only in the archive.
