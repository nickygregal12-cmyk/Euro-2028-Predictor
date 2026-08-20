# Hosted migration status

> **Live index only.** The machine records are authoritative; this page exists so a human or AI can see the current rollout boundary without reading the historical contract chronology. The previous full narrative is preserved at [`docs/history/context-reset-2026-08-19/ops-pending-migrations.pre-reconciliation.txt`](../history/context-reset-2026-08-19/ops-pending-migrations.pre-reconciliation.txt).

## Current state — repository 209, Development 209, Production 208 (20 August 2026)

Repository contract **209** is the head of the committed migration chain.
| Environment | Recorded contract | Authority |
| --- | ---: | --- |
| Development Supabase `iouzoutneyjpugbbtdem` | **209** | [`config/development-hosted-contract.json`](../../config/development-hosted-contract.json) |
| Production Supabase `vkfnsqdyhvtwyqkisxhk` | **208** | [`config/production-hosted-contract.json`](../../config/production-hosted-contract.json) |

> **Contract 209 — the provider fixture lifecycle — is on Development and not on Production
> (20 August 2026):** `20260819200000_provider_fixture_lifecycle.sql` merged as
> [#935](https://github.com/nickygregal12-cmyk/Euro-2028-Predictor/pull/935), commit `b9dd24f`.
> It repairs season resolution in the ingestion driver, seeds the SportMonks postponed token,
> applies and reverses a provider postponement on `season_fixtures.status`, lets a postponed
> fixture take its replacement date, and states what a postponed or voided fixture does to a
> prediction deadline. Development took it through the fast lane; **Production has not, and
> will not without its own authority and gates.**
>
> **CITE RUN `32322676610`, NOT `32335240998`.** Two fast-lane runs exist for this contract and
> only the first applied anything. Run
> [32322676610](https://github.com/nickygregal12-cmyk/Euro-2028-Predictor/actions/runs/32322676610)
> from exact `main` `b9dd24f` proved the migration additive, snapshotted, applied and confirmed
> between `01:54:00Z` and `02:02:04Z`. Run
> [32335240998](https://github.com/nickygregal12-cmyk/Euro-2028-Predictor/actions/runs/32335240998)
> from `06ab135` was dispatched afterwards, found nothing pending, and has its snapshot, apply
> and confirm steps recorded **skipped**. It succeeded without doing anything, which is easy to
> misread as a rollout.
>
> **The machinery is installed and inert, and inert is the correct reading.**
> `predictor_internal.season_fixture_lifecycle_transitions` exists with row level security on and
> holds **0** rows; `provider_calendar_change_proposals` holds **0**; SportMonks token `10` now
> resolves to kind `postponed` rather than `unknown`. No response has been consumed under 209
> yet, because the SportMonks target polls on a **1440-minute** cadence and was last dispatched
> `2026-08-19T15:40:00Z` — so **the first consumption under this contract falls due
> `2026-08-20T15:40:00Z`**. That wait is the risk already recorded as `ING-006`; applying 209
> did not change it, and it is still an owner decision.
>
> **Both season-resolution faults are measurably repaired on hosted Development**, checked
> read-only against the real archived response of `2026-08-19T15:40:03Z`:
> `resolve_provider_season('sportmonks','28275')` now returns tournament
> `6a64a59b-b721-443e-a864-0fd52db1edbd` where it previously matched nothing, the mapping being
> held under the composite key `501/28275`; and `provider_poll_path_pattern` turns the stored
> path's `{{date:+N}}` placeholders into a pattern the actually dispatched URL matches. Before
> 209 neither arm could resolve, which is why every response since `2026-08-10T15:27Z` was
> consumed `unresolved_season`.
>
> **Production is one contract behind on exactly this.** Its poll target was enabled on
> 19 August under the owner's explicit instruction and fetches successfully, but token `10` is
> outside the vocabulary at contract 208, so a postponement is decoded, recorded against the
> response, and goes no further.

**Development is level with the repository at Contract 209; Production is one behind at 208.** Contracts 206 through 208 reached Development through fast-lane run [32312618799](https://github.com/nickygregal12-cmyk/Euro-2028-Predictor/actions/runs/32312618799) from exact `main` `0c48962` and Production second — the order the workflows refuse to invert — through coordinator [32317678763](https://github.com/nickygregal12-cmyk/Euro-2028-Predictor/actions/runs/32317678763), rehearsal [32317690357](https://github.com/nickygregal12-cmyk/Euro-2028-Predictor/actions/runs/32317690357) and rollout [32318082186](https://github.com/nickygregal12-cmyk/Euro-2028-Predictor/actions/runs/32318082186) from exact `main` `f2c244b`, gated on encrypted backup [32312404053](https://github.com/nickygregal12-cmyk/Euro-2028-Predictor/actions/runs/32312404053). Contract 209 then followed the same order: Development on 20 August, Production not yet.

Development and Production were level at Contract 205 before these three landed. Contracts 199 to 205 reached Development first and Production second, in that order, which the Production workflows refuse to invert. Production was moved by guarded rollout [32253892640](https://github.com/nickygregal12-cmyk/Euro-2028-Predictor/actions/runs/32253892640) from exact `main` `8971245`, gated on encrypted backup [32229916242](https://github.com/nickygregal12-cmyk/Euro-2028-Predictor/actions/runs/32229916242) and exact-head rehearsal [32252751621](https://github.com/nickygregal12-cmyk/Euro-2028-Predictor/actions/runs/32252751621). **That run is recorded FAILED and it is not a contradiction:** the apply succeeded and the run then exited on its own postflight measurement, so Production is correctly migrated and the workflow's own verification never ran. The measured read-back is in the machine record, which is the authority; this page states only that the boundary was crossed and where to read the evidence.

## Netlify deployed-contract declarations

These rows deliberately mirror the current declaration table in [`netlify-deploy-access.md`](netlify-deploy-access.md). A declaration may trail its hosted database; it must never lead it.

| Surface | Declared contract |
| --- | ---: |
| Netlify `euro28predictor` non-production contexts | **178 hosted declaration** |
| Netlify `euro28predictor` production | **178 hosted declaration** |

- Development has no pending repository migration. Production has exactly **1**: contract 209, `20260819200000_provider_fixture_lifecycle.sql`, which needs its own authority, backup and rehearsal like every Production boundary before it.
- Production sits one behind Development by design, which is the normal resting state between a Development rollout and the Production promotion that follows it. A gap that closed once is not standing permission to close the next one.
- Repository, Development and Production remain separate closure states. Never infer hosted state from the repository count.
- The historic Netlify project `euro28-predictor-dev` is out of scope for the current Development/Production migration lane.

## How to use this page

1. Read the three machine records before any rollout.
2. If Development trails the repository, use the guarded Development lane required by the governing ADR/workflow.
3. Production moves only under explicit authority for the exact boundary and with its own backup/rehearsal gates.
4. For why a historical contract existed, use the archived narrative or the migration/PR itself — do not reconstruct history from this live index.

The old “Repository candidate … applied to no hosted environment by this record” blocks are **historical contract records**, not a current pending queue; that wording is intentionally kept only in the archive.
