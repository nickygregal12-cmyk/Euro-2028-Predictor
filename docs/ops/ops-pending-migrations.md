# Hosted migration status

> **Live index only.** The machine records are authoritative; this page exists so a human or AI can see the current rollout boundary without reading the historical contract chronology. The previous full narrative is preserved at [`docs/history/context-reset-2026-08-19/ops-pending-migrations.pre-reconciliation.txt`](../history/context-reset-2026-08-19/ops-pending-migrations.pre-reconciliation.txt).

## Current state — repository 211, Production 209, Development 209 (20 August 2026)

Repository contract **211** is the head of the committed migration chain. Both hosted environments are level with each other at **209**, two behind.
| Environment | Recorded contract | Authority |
| --- | ---: | --- |
| Development Supabase `iouzoutneyjpugbbtdem` | **209** | [`config/development-hosted-contract.json`](../../config/development-hosted-contract.json) |
| Production Supabase `vkfnsqdyhvtwyqkisxhk` | **209** | [`config/production-hosted-contract.json`](../../config/production-hosted-contract.json) |

> **Contract 210 repository candidate — the live poll window covers the deadline
> (20 August 2026):** `20260820070000_provider_live_window_covers_the_deadline.sql`
> closes the half contract 209 left open. Applying a postponement is useless if the chain does
> not **look** in time to find one. It claims **no** Development or Production rollout yet.
>
> **The gap it closes, stated exactly.** An ordinary fixture locks at `season_matchweek_lock_at`,
> which resolves to the **earliest kickoff of the round** minus a buffer, and every caller in the
> schema passes a buffer of **0** — so the deadline *is* the matchweek's first kickoff. The live
> poll window opened only `live_lead_minutes` before a kickoff, seeded at **15**. A postponement
> announced after the last daily idle poll and more than fifteen minutes before that first
> kickoff therefore went unseen **until after predictions had locked**: up to a day of blindness
> ending fifteen minutes before the one instant it mattered. That is `ING-006`.
>
> **What it changes:** `live_lead_minutes` to **720**, the maximum
> `provider_poll_targets_live_window_bounded` allows, on every enabled target and as the column
> default. From twelve hours before a matchweek's first kickoff the feed is read every ten
> minutes, so the deadline falls **inside** a polling window rather than behind a day of silence.
>
> **What it deliberately does not change: `cadence_minutes`.** The obvious fix — 1440 → 360 —
> is refused, and the earlier `ING-006` note proposing it was wrong. It would spend four times
> the provider credit every day of the year, including weeks with no fixture near, to shrink a
> gap that only exists in the hours before a lock, and would *still* leave up to six hours of
> silence immediately before that lock. Coverage where it counts beats frequency everywhere.
> pgTAP suite **256** asserts the relationship rather than the number, deriving the lock instant from
> `season_prediction_lock_at` and contrasting both leads at the same moment.

> **Contract 211 repository candidate — a deadline watch cheap enough to leave on
> (20 August 2026):** `20260820090000_provider_deadline_watch_tier.sql` keeps contract 210's rule
> and abandons its instrument. It claims **no** Development or Production rollout yet.
>
> **What 210 cost, measured rather than estimated.** Covering the deadline by widening
> `live_lead_minutes` to 720 while `live_cadence_minutes` stayed at 10 means twelve hours of
> ten-minute polling before every kickoff — and because `provider_target_is_live` is
> **tournament-level**, any unresolved fixture inside its window holds it open for the whole
> target. A Premier League matchweek spans about 72 hours, so those windows chain into one block.
> On the real 11–13 September fixture shape: **42 hours open, 252 polls**, against contract 146's
> published budget of about **58 requests on a matchday**.
>
> **What 211 does:** it splits the question in two. `deadline_cadence_minutes` (**60**) applies
> inside a deadline watch that opens `deadline_lead_minutes` (**720**) before an unresolved kickoff
> and closes **at** that kickoff — "is this match still happening", which needs long reach and coarse
> resolution. `live_lead_minutes` returns to **15**, the value contract 145 chose for the question it
> answers. `cadence_minutes` stays at 1440.
>
> **The watch costs 36 polls and stands open 36 hours**, so the matchweek falls from **252 polls to
> 77** while covering *more* of it. A postponement announced in the twelve hours before a deadline is
> seen within the hour, with hours of margin before the lock. Suite **257** asserts the cost, not just
> the correctness, because a fix that has to be watched for cost is one that eventually gets
> turned off.

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
