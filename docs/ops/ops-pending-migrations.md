# Hosted migration status

> **Live index only.** The machine records are authoritative; this page exists so a human or AI can see the current rollout boundary without reading the historical contract chronology. The previous full narrative is preserved at [`docs/history/context-reset-2026-08-19/ops-pending-migrations.pre-reconciliation.txt`](../history/context-reset-2026-08-19/ops-pending-migrations.pre-reconciliation.txt).

## Current state — repository 213, Production 211, Development 213 (21 August 2026)

**Development has completed the 211→213 boundary and is independently verified at 213.** Production remains at **211**. Contracts 212 and 213 are therefore pending on Production only; the next sequence is the reviewed Production backup → disposable-copy rehearsal → guarded rollout → independent postflight. PR #969 remains held back until Production is also 213; its migration number is not part of the current repository contract yet.

> **Contract 213 is DESTRUCTIVE and therefore does not use the development fast
> lane.** `check-migration-additive.mjs` refuses it, correctly: it deletes seven
> rows from `predictor_internal.provider_status_kinds`. It goes through
> `development-migration-rollout.yml`, the guarded lane, which names the boundary
> by filename and requires the destructive batch to be acknowledged. Seven seeded
> reference rows is exactly the sort of loss a snapshot exists for.

> **Contract 212 repository candidate — the matchweek card publishes the lock it
> is enforced against (20 August 2026):**
> `20260820130000_matchweek_card_publishes_the_fixture_lock.sql` closes `ING-005`.
> Development is independently verified with this contract installed; Production has **not** been promoted yet.
>
> **What was wrong.** Contract 119 made ENFORCEMENT per fixture;
> `get_season_matchweek_card` still published only kickoffs, so every client
> derived ONE matchweek instant from the earliest of them. For an unmoved fixture
> the two agree exactly — which is why this sat unnoticed — and they diverge only
> for the fixture that MOVED, which is the only one anyone needed them to be
> right about. The surface was therefore STRICTER than the rule: nothing illegal
> was ever possible, but a player with a rescheduled or postponed fixture was
> told they could not predict it while the trigger would have taken the write.
>
> **What it changes:** two published fields per fixture, `lock_at` and `locked`,
> both derived from `predictor_internal.season_prediction_lock_at` rather than
> re-implemented, at the buffer the enforcement trigger itself reads through a
> new `predictor_internal.season_prediction_buffer_minutes`. Both fields, because
> two of the authority's answers have no printable instant — `-infinity` for a
> void fixture, `infinity` for a postponement with no announced date. A null
> derivation publishes `locked` TRUE, so the card fails closed rather than
> inviting an edit the trigger would refuse. Contract 119 is not reversed and no
> enforcement line moves.
>
> pgTAP suite **258** asserts the RELATIONSHIP — that the card publishes what the
> trigger would enforce, including for a fixture whose own lock diverges from its
> matchweek's — rather than a constant, because a suite of ordinary fixtures
> would have passed against the broken card.

> **Contract 213 repository candidate — the unmeasured SportMonks tokens fail
> closed (20 August 2026):** `20260820150000_drop_unmeasured_sportmonks_tokens.sql`
> closes the second half of `ING-002`. Development is independently verified with this contract installed; Production has **not** been promoted yet.
>
> **What it removes and why removal rather than a remap.** Contract 135 seeded
> SportMonks `14`–`21` from the provider's published documentation. Contract 209
> then MEASURED that this provider sends `10` for a postponement, while `14` — the
> token the documentation calls "postponed" — has never appeared in a payload. So
> two tokens mapped `postponed`, one observed and one documented, with nothing but
> a note between them. Contract 209 deliberately remapped none, because replacing
> one guess with another is not an improvement. Removal is: an unmapped token
> resolves to `unknown`, an `unknown` is recorded in `provider_status_observations`
> where it can be measured against a real payload, and nothing downstream acts on a
> fixture from a status the system has never seen.
>
> **The evidence check came first and could have stopped this.** Read-only against
> both hosted environments on 20 August 2026: Development holds 440 retained
> SportMonks responses (2026-08-05 to 2026-08-19) containing `state_id` values
> `1, 2, 3, 5, 10, 22`; Production holds 21 (2026-08-10 to 2026-08-19) containing
> `1, 5, 10`. **Not one of `14`–`21` appears on either.** Nothing was kept back.
>
> **One finding recorded rather than acted on:** token `4` ("break", mapped
> `in_play`) did not appear either. It is NOT dropped — the retained window is two
> weeks of pre-season, thin for a token that only occurs during a stoppage, and `4`
> sits between two observed tokens in a contiguous in-play run. It is written into
> the `ING-002` row as the next thing to measure.
>
> pgTAP suite **259** asserts the behaviour rather than the row count: a dropped
> token postpones nothing and records no transition, the measured token still
> postpones, and an unknown is OBSERVED rather than swallowed.

| Environment | Recorded contract | Authority |
| --- | ---: | --- |
| Development Supabase `iouzoutneyjpugbbtdem` | **213** | [`config/development-hosted-contract.json`](../../config/development-hosted-contract.json) |
| Production Supabase `vkfnsqdyhvtwyqkisxhk` | **211** | [`config/production-hosted-contract.json`](../../config/production-hosted-contract.json) |

> **Contract 210 — the live poll window covers the deadline — reached both
> environments on 20 August 2026.** `20260820070000_provider_live_window_covers_the_deadline.sql`
> closed the half contract 209 left open: applying a postponement is useless if the chain does
> not **look** in time to find one. Development took it through fast-lane run
> [32347550098](https://github.com/nickygregal12-cmyk/Euro-2028-Predictor/actions/runs/32347550098)
> from exact `main` `46671e2`. Production took it as part of the combined 209-to-211 boundary
> described below. **Its rule survives; its instrument did not, and contract 211 replaced it
> within the hour — read the two together or the numbers below will look contradictory.**
>
> **The gap it closes, stated exactly.** An ordinary fixture locks at `season_matchweek_lock_at`,
> which resolves to the **earliest kickoff of the round** minus a buffer, and every caller in the
> schema passes a buffer of **0** — so the deadline *is* the matchweek's first kickoff. The live
> poll window opened only `live_lead_minutes` before a kickoff, seeded at **15**. A postponement
> announced after the last daily idle poll and more than fifteen minutes before that first
> kickoff therefore went unseen **until after predictions had locked**: up to a day of blindness
> ending fifteen minutes before the one instant it mattered. That is `ING-006`.
>
> **What it changed:** `live_lead_minutes` to **720**, the maximum
> `provider_poll_targets_live_window_bounded` allows, on every enabled target and as the column
> default.
>
> **What it deliberately did not change: `cadence_minutes`.** The obvious fix — 1440 → 360 —
> was refused, and the earlier `ING-006` note proposing it was wrong. It would spend four times
> the provider credit every day of the year, including weeks with no fixture near, to shrink a
> gap that only exists in the hours before a lock, and would *still* leave up to six hours of
> silence immediately before that lock. Coverage where it counts beats frequency everywhere.
> pgTAP suite **256** asserts the relationship rather than the number, deriving the lock instant from
> `season_prediction_lock_at` and contrasting both leads at the same moment.

> **Contract 211 — a deadline watch cheap enough to leave on — reached both environments on
> 20 August 2026.** `20260820090000_provider_deadline_watch_tier.sql` keeps contract 210's rule
> and abandons its instrument. Development took it through fast-lane run
> [32353837721](https://github.com/nickygregal12-cmyk/Euro-2028-Predictor/actions/runs/32353837721)
> from exact `main` `71dbb9a`, the merge commit of
> [#952](https://github.com/nickygregal12-cmyk/Euro-2028-Predictor/pull/952), reaching 211 at
> `09:54Z`. Production followed at `10:32Z` — see the combined boundary below.
>
> **What contract 210 cost, measured rather than estimated.** Covering the deadline by widening
> `live_lead_minutes` to 720 while `live_cadence_minutes` stayed at 10 means twelve hours of
> ten-minute polling before every kickoff — and because `provider_target_is_live` is
> **tournament-level**, any unresolved fixture inside its window holds it open for the whole
> target. A Premier League matchweek spans about 72 hours, so those windows chain into one block.
> On the real 11–13 September fixture shape: **42 hours open, 252 polls**, against contract 146's
> published budget of about **58 requests on a matchday**.
>
> **What contract 211 does:** it splits the question in two. `deadline_cadence_minutes` (**60**) applies
> inside a deadline watch that opens `deadline_lead_minutes` (**720**) before an unresolved kickoff
> and closes **at** that kickoff — "is this match still happening", which needs long reach and coarse
> resolution. `live_lead_minutes` returns to **15**, the value contract 145 chose for the question it
> answers. `cadence_minutes` stays at 1440. It adds
> `predictor_internal.provider_target_awaits_deadline(...)`, and sets the `deadline_lead_minutes`
> column default to 720 so a target created later inherits the watch rather than the gap.
>
> **The watch costs 36 polls and stands open 36 hours**, so the matchweek falls from **252 polls to
> 77** while covering *more* of it. A postponement announced in the twelve hours before a deadline is
> seen within the hour, with hours of margin before the lock. Suite **257** asserts the cost, not just
> the correctness, because a fix that has to be watched for cost is one that eventually gets
> turned off.

> **Production crossed contract 210 and contract 211 as ONE boundary on 20 August 2026.**
> Guarded rollout
> [32359164255](https://github.com/nickygregal12-cmyk/Euro-2028-Predictor/actions/runs/32359164255)
> from exact `main` `1b1be12`, gated on encrypted backup
> [32353845022](https://github.com/nickygregal12-cmyk/Euro-2028-Predictor/actions/runs/32353845022)
> and on exact-head rehearsal
> [32358542321](https://github.com/nickygregal12-cmyk/Euro-2028-Predictor/actions/runs/32358542321),
> which dumped Production, restored it into a disposable local Supabase and applied the boundary to
> **that copy only**. The measured read-back is in
> [`config/production-hosted-contract.json`](../../config/production-hosted-contract.json), which is
> the authority; this page states only that the boundary was crossed and where to read the evidence.
>
> **The record was written by hand, and that is the rule rather than an exception.** The follow-up
> automation opens a record pull request authored by `github-actions[bot]`, which does not trigger
> this repository's own CI workflows, so its required merge gate never runs and it cannot merge.
> A *superseded* automation record is worse than a stuck one: it drags the committed number
> backwards while the database sits ahead, and **the Production promotion gate reads the record,
> not the database**, so an under-reported record silently refuses a promotion that is actually
> safe. That is exactly how the first 209-to-211 rehearsal attempt failed, at the step named
> "Refuse to make Production the first hosted environment to see Contract 211".
>
> **The independent read-only measurement, taken separately from the rollout's own output**, found
> the ledger at **211** rows naming `20260820090000 provider_deadline_watch_tier`, and **both**
> enabled targets — `sportmonks` and `football-data` — reading `cadence_minutes` 1440,
> `deadline_cadence_minutes` 60, `deadline_lead_minutes` 720, `live_cadence_minutes` 10 and
> `live_lead_minutes` 15. **Contract 209 survives underneath:**
> `season_fixture_lifecycle_transitions` still holds **0** rows and SportMonks token `10` still
> resolves to `postponed`. **Not one player-owned row moved**, and the fixture status histogram was
> compared **whole rather than by total** — `played 12, scheduled 566` before and after — because a
> migration that invented a postponement would leave `season_fixtures` unchanged at 578 while moving
> a fixture between statuses. Both publication gates remain **false**; Euro publication remains
> hidden. **The promotion spent no provider credit.**

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
> moves when a provider response is next consumed under the new contract, and at the time of
> this contract-209 record both environments polled SportMonks on a **1440-minute** cadence with
> no deadline tier at all. That wait was the risk recorded as `ING-006` and it was unchanged by
> either 209 rollout. **It is closed now, by contract 210 and contract 211 above** — read those
> blocks for the current polling shape, not this one.

**Earlier boundaries, for ordering evidence rather than for current state.** Contracts 206 through 208 reached Development through fast-lane run [32312618799](https://github.com/nickygregal12-cmyk/Euro-2028-Predictor/actions/runs/32312618799) from exact `main` `0c48962` and Production second — the order the workflows refuse to invert — through coordinator [32317678763](https://github.com/nickygregal12-cmyk/Euro-2028-Predictor/actions/runs/32317678763), rehearsal [32317690357](https://github.com/nickygregal12-cmyk/Euro-2028-Predictor/actions/runs/32317690357) and rollout [32318082186](https://github.com/nickygregal12-cmyk/Euro-2028-Predictor/actions/runs/32318082186) from exact `main` `f2c244b`, gated on encrypted backup [32312404053](https://github.com/nickygregal12-cmyk/Euro-2028-Predictor/actions/runs/32312404053). Contract 209 followed the same order on 20 August: Development first at `02:02Z`, Production second at `06:53Z` from exact `main` `be5a1fb`, gated on encrypted backup [32339828989](https://github.com/nickygregal12-cmyk/Euro-2028-Predictor/actions/runs/32339828989) and its own exact-head rehearsal.

Development and Production were level at Contract 205 before these three landed. Contracts 199 to 205 reached Development first and Production second, in that order, which the Production workflows refuse to invert. Production was moved by guarded rollout [32253892640](https://github.com/nickygregal12-cmyk/Euro-2028-Predictor/actions/runs/32253892640) from exact `main` `8971245`, gated on encrypted backup [32229916242](https://github.com/nickygregal12-cmyk/Euro-2028-Predictor/actions/runs/32229916242) and exact-head rehearsal [32252751621](https://github.com/nickygregal12-cmyk/Euro-2028-Predictor/actions/runs/32252751621). **That run is recorded FAILED and it is not a contradiction:** the apply succeeded and the run then exited on its own postflight measurement, so Production is correctly migrated and the workflow's own verification never ran. The measured read-back is in the machine record, which is the authority; this page states only that the boundary was crossed and where to read the evidence.

## Netlify deployed-contract declarations

These rows deliberately mirror the current declaration table in [`netlify-deploy-access.md`](netlify-deploy-access.md). A declaration may trail its hosted database; it must never lead it.

| Surface | Declared contract |
| --- | ---: |
| Netlify `euro28predictor` non-production contexts | **178 hosted declaration** |
| Netlify `euro28predictor` production | **178 hosted declaration** |

- Development has no pending repository migration at Contract **213**. Production remains at **211** and has Contracts **212–213** pending through the reviewed Production promotion lane.
- Production is intentionally behind Development during this promotion window. It must reach **213** through its own authority, fresh encrypted backup and exact-head disposable-copy rehearsal before the next migration PR is allowed to proceed.
- **A level migration chain is not the same as a fresh feed, but the shape of the staleness has changed and the old sentence here was wrong after contract 211.** Both environments still poll SportMonks on a **1440-minute idle cadence**, so a fixture with no deadline near it can be up to roughly a day stale. What is no longer true is that the staleness spans a prediction lock: the deadline watch opens **720 minutes** before an unresolved kickoff and polls every **60**, closing at the kickoff, so the hours before a lock are covered hourly rather than not at all. `ING-006` is closed on both environments by this boundary; the residual idle staleness away from a deadline is deliberate, is what keeps the matchweek at 77 polls rather than 252, and lives in `provider_poll_targets` rather than in the migration chain.
- Repository, Development and Production remain separate closure states. Never infer hosted state from the repository count.
- The historic Netlify project `euro28-predictor-dev` is out of scope for the current Development/Production migration lane.

## How to use this page

1. Read the three machine records before any rollout.
2. If Development trails the repository, use the guarded Development lane required by the governing ADR/workflow.
3. Production moves only under explicit authority for the exact boundary and with its own backup/rehearsal gates.
4. For why a historical contract existed, use the archived narrative or the migration/PR itself — do not reconstruct history from this live index.

The old “Repository candidate … applied to no hosted environment by this record” blocks are **historical contract records**, not a current pending queue; that wording is intentionally kept only in the archive.
