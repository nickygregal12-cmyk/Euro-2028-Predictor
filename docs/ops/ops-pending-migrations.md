# Hosted migration status

> **Live index only.** The machine records are authoritative; this page exists so a human or AI can see the current rollout boundary without reading the historical contract chronology. The previous full narrative is preserved at [`docs/history/context-reset-2026-08-19/ops-pending-migrations.pre-reconciliation.txt`](../history/context-reset-2026-08-19/ops-pending-migrations.pre-reconciliation.txt).

## Current state — repository 209, Production 209, Development 209 (20 August 2026)

Repository contract **209** is the head of the committed migration chain, and both hosted environments are level with it. **There are no pending hosted migrations: repository, Development and Production are level at Contract 209.**
| Environment | Recorded contract | Authority |
| --- | ---: | --- |
| Development Supabase `iouzoutneyjpugbbtdem` | **209** | [`config/development-hosted-contract.json`](../../config/development-hosted-contract.json) |
| Production Supabase `vkfnsqdyhvtwyqkisxhk` | **209** | [`config/production-hosted-contract.json`](../../config/production-hosted-contract.json) |

> **Contract 209 — the provider fixture lifecycle — reached both environments on 20 August 2026.**
> `20260819200000_provider_fixture_lifecycle.sql` merged as
> [#935](https://github.com/nickygregal12-cmyk/Euro-2028-Predictor/pull/935), commit `b9dd24f`.
> It repairs season resolution in the ingestion driver, seeds the SportMonks postponed token,
> applies and reverses a provider postponement on `season_fixtures.status`, lets a postponed
> fixture take its replacement date, and states what a postponed or voided fixture does to a
> prediction deadline. Development took it through the fast lane at `02:02Z`; Production
> followed through its own backup, rehearsal and rollout at `06:53Z`.
>
> **CITE DEVELOPMENT RUN `32322676610`, NOT `32335240998`.** Two fast-lane runs exist for this
> contract and only the first applied anything. Run
> [32322676610](https://github.com/nickygregal12-cmyk/Euro-2028-Predictor/actions/runs/32322676610)
> from exact `main` `b9dd24f` proved the migration additive, snapshotted, applied and confirmed
> between `01:54:00Z` and `02:02:04Z`. Run
> [32335240998](https://github.com/nickygregal12-cmyk/Euro-2028-Predictor/actions/runs/32335240998)
> from `06ab135` was dispatched afterwards, found nothing pending, and has its snapshot, apply
> and confirm steps recorded **skipped**. It succeeded without doing anything, which is easy to
> misread as a rollout.
>
> **On Production the rehearsal is the part worth reading.**
> [32340787619](https://github.com/nickygregal12-cmyk/Euro-2028-Predictor/actions/runs/32340787619)
> dumped Production at 208, restored it into a disposable local Supabase, applied 209 to that
> copy only, and ran suite `255_provider_fixture_lifecycle` and `171_ingestion_write_boundary`
> against **real Production data**. Production was never written until rollout
> [32341454128](https://github.com/nickygregal12-cmyk/Euro-2028-Predictor/actions/runs/32341454128),
> which re-proved the boundary and re-confirmed 208 before applying once.
>
> **The machinery arrived inert on both, and inert is the required outcome.**
> `predictor_internal.season_fixture_lifecycle_transitions` exists with row level security on and
> holds **0** rows; SportMonks token `10` now resolves to kind `postponed` rather than `unknown`.
> A transition written during the apply would have meant the applier ran at migration time,
> which it must never do — it runs only from a consumed provider response. **The fixture status
> histogram was compared whole rather than by total**, because a migration that invented a
> postponement would leave `season_fixtures` unchanged while moving a fixture between statuses.
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
> **WHAT 209 DOES NOT DO IS MAKE A POSTPONEMENT APPEAR — it makes one possible.** The status
> moves when a provider response is next consumed under the new contract, and both environments
> still poll SportMonks on a **1440-minute** cadence. That wait is the risk recorded as
> `ING-006` and is unchanged by either rollout; closing it is a separate change to
> `provider_poll_targets`, not to the migration chain.

**Repository, Development and Production are level at Contract 209.** Contracts 206 through 208 reached Development through fast-lane run [32312618799](https://github.com/nickygregal12-cmyk/Euro-2028-Predictor/actions/runs/32312618799) from exact `main` `0c48962` and Production second — the order the workflows refuse to invert — through coordinator [32317678763](https://github.com/nickygregal12-cmyk/Euro-2028-Predictor/actions/runs/32317678763), rehearsal [32317690357](https://github.com/nickygregal12-cmyk/Euro-2028-Predictor/actions/runs/32317690357) and rollout [32318082186](https://github.com/nickygregal12-cmyk/Euro-2028-Predictor/actions/runs/32318082186) from exact `main` `f2c244b`, gated on encrypted backup [32312404053](https://github.com/nickygregal12-cmyk/Euro-2028-Predictor/actions/runs/32312404053). Contract 209 followed the same order on 20 August: Development first at `02:02Z`, Production second at `06:53Z` from exact `main` `be5a1fb`, gated on encrypted backup [32339828989](https://github.com/nickygregal12-cmyk/Euro-2028-Predictor/actions/runs/32339828989) and its own exact-head rehearsal.

Development and Production were level at Contract 205 before these three landed. Contracts 199 to 205 reached Development first and Production second, in that order, which the Production workflows refuse to invert. Production was moved by guarded rollout [32253892640](https://github.com/nickygregal12-cmyk/Euro-2028-Predictor/actions/runs/32253892640) from exact `main` `8971245`, gated on encrypted backup [32229916242](https://github.com/nickygregal12-cmyk/Euro-2028-Predictor/actions/runs/32229916242) and exact-head rehearsal [32252751621](https://github.com/nickygregal12-cmyk/Euro-2028-Predictor/actions/runs/32252751621). **That run is recorded FAILED and it is not a contradiction:** the apply succeeded and the run then exited on its own postflight measurement, so Production is correctly migrated and the workflow's own verification never ran. The measured read-back is in the machine record, which is the authority; this page states only that the boundary was crossed and where to read the evidence.

## Netlify deployed-contract declarations

These rows deliberately mirror the current declaration table in [`netlify-deploy-access.md`](netlify-deploy-access.md). A declaration may trail its hosted database; it must never lead it.

| Surface | Declared contract |
| --- | ---: |
| Netlify `euro28predictor` non-production contexts | **178 hosted declaration** |
| Netlify `euro28predictor` production | **178 hosted declaration** |

- Neither environment has a pending repository migration. The next contract will open a new boundary from **209** on both.
- Production is level with Development rather than behind it, which is the resting state between promotions, not a standing permission. The next Production boundary needs its own authority, fresh encrypted backup and exact-head rehearsal, exactly as 209 did.
- **A level migration chain is not the same as a fresh feed.** Both environments poll SportMonks on a 1440-minute cadence, so a fixture status can be up to roughly a day stale regardless of contract. That is `ING-006`, it lives in `provider_poll_targets` rather than in the migration chain, and it is not closed by anything on this page.
- Repository, Development and Production remain separate closure states. Never infer hosted state from the repository count.
- The historic Netlify project `euro28-predictor-dev` is out of scope for the current Development/Production migration lane.

## How to use this page

1. Read the three machine records before any rollout.
2. If Development trails the repository, use the guarded Development lane required by the governing ADR/workflow.
3. Production moves only under explicit authority for the exact boundary and with its own backup/rehearsal gates.
4. For why a historical contract existed, use the archived narrative or the migration/PR itself — do not reconstruct history from this live index.

The old “Repository candidate … applied to no hosted environment by this record” blocks are **historical contract records**, not a current pending queue; that wording is intentionally kept only in the archive.
