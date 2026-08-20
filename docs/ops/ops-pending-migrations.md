# Hosted migration status

> **Live index only.** The machine records are authoritative; this page exists so a human or AI can see the current rollout boundary without reading the historical contract chronology. The previous full narrative is preserved at [`docs/history/context-reset-2026-08-19/ops-pending-migrations.pre-reconciliation.txt`](../history/context-reset-2026-08-19/ops-pending-migrations.pre-reconciliation.txt).

## Current state — repository 209, Production 205, Development 208 (20 August 2026)

Repository contract **209** is the head of the committed migration chain.
| Environment | Recorded contract | Authority |
| --- | ---: | --- |
| Development Supabase `iouzoutneyjpugbbtdem` | **208** | [`config/development-hosted-contract.json`](../../config/development-hosted-contract.json) |
| Production Supabase | **205** | [`config/production-hosted-contract.json`](../../config/production-hosted-contract.json) |

> **Contract 209 repository candidate — the provider fixture lifecycle (19 August 2026):**
> `20260819200000_provider_fixture_lifecycle.sql` repairs season resolution in the ingestion
> driver, seeds the SportMonks postponed token, applies and reverses a provider postponement
> on `season_fixtures.status`, lets a postponed fixture take its replacement date, and states
> what a postponed or voided fixture does to a prediction deadline. It claims **no**
> Development or Production rollout.
>
> **IT MUST NOT MERGE BEFORE THE PRODUCTION 205-TO-208 PROMOTION COMPLETES.**
> `contract-208-production-coordinator-one-shot.yml` refuses unless
> `deployment-contract.json` reads exactly `208` and the committed Production record reads
> exactly `205`. Merging contract 209 makes the repository 209 and that coordinator can
> never run again without being amended, which would strand the promotion it exists to
> drive. The ordering is: promote Production to 208, record it, then merge 209.
>
> **Development is measurably behind the provider feed until 209 is applied:** every decoded
> response since `2026-08-10T15:27Z` was consumed with outcome `unresolved_season`, so no
> kickoff revision, result, live projection or calendar proposal has been recorded there.
> Applying 206 to 208 did not change that — the fault is in season resolution, which 209
> repairs.

**Development is level with the repository at Contract 208; Production remains at Contract 205 with exactly three migrations pending.** Contracts 206 through 208 reached Development through guarded fast-lane run `32312618799` from exact `main` `0c489629d299c2e57bd0981d0b2b2b4f6b56c287`, and an independent read-only Supabase query then named all 208 ledger rows and the newest migration before this record was written. Production remains a separately gated promotion: encrypted backup, disposable-restore rehearsal and the exact 205-to-208 rollout are required before it can move.

Development and Production were level at Contract 205 before these three landed. Contracts 199 to 205 reached Development first and Production second, in that order, which the Production workflows refuse to invert. Production was moved by guarded rollout [32253892640](https://github.com/nickygregal12-cmyk/Euro-2028-Predictor/actions/runs/32253892640) from exact `main` `8971245`, gated on encrypted backup [32229916242](https://github.com/nickygregal12-cmyk/Euro-2028-Predictor/actions/runs/32229916242) and exact-head rehearsal [32252751621](https://github.com/nickygregal12-cmyk/Euro-2028-Predictor/actions/runs/32252751621). **That run is recorded FAILED and it is not a contradiction:** the apply succeeded and the run then exited on its own postflight measurement, so Production is correctly migrated and the workflow's own verification never ran. The measured read-back is in the machine record, which is the authority; this page states only that the boundary was crossed and where to read the evidence.

## Netlify deployed-contract declarations

These rows deliberately mirror the current declaration table in [`netlify-deploy-access.md`](netlify-deploy-access.md). A declaration may trail its hosted database; it must never lead it.

| Surface | Declared contract |
| --- | ---: |
| Netlify `euro28predictor` non-production contexts | **178 hosted declaration** |
| Netlify `euro28predictor` production | **178 hosted declaration** |

- Development has no pending repository migration. Production has exactly **3** repository migrations still to apply, forming the controlled 205-to-208 promotion boundary.
- Production remains below Development by design while the fresh backup, exact-head rehearsal and guarded rollout gates are completed; the gap is not itself permission to apply anything.
- Repository, Development and Production remain separate closure states. Never infer hosted state from the repository count.
- The historic Netlify project `euro28-predictor-dev` is out of scope for the current Development/Production migration lane.

## How to use this page

1. Read the three machine records before any rollout.
2. If Development trails the repository, use the guarded Development lane required by the governing ADR/workflow.
3. Production moves only under explicit authority for the exact boundary and with its own backup/rehearsal gates.
4. For why a historical contract existed, use the archived narrative or the migration/PR itself — do not reconstruct history from this live index.

The old “Repository candidate … applied to no hosted environment by this record” blocks are **historical contract records**, not a current pending queue; that wording is intentionally kept only in the archive.
