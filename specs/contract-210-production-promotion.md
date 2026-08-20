# Contract 210 Production promotion

## Exact boundary

Production is currently Contract 209. The intended single promotion is exactly one additive migration:

1. `20260820070000_provider_live_window_covers_the_deadline.sql`

Development takes it first and must be independently recorded at 209 or later before the Production gates will run. Production remains read-only throughout the encrypted backup and disposable-restore rehearsal. The Production rollout may write only after both gates succeed.

## Why this promotion exists

Contract 209 taught the ingestion chain to **apply** a postponement. It did not change how often the chain **looks**, and looking is the half that decides whether a player ever sees one in time.

An ordinary fixture does not lock at its own kickoff. `season_prediction_lock_at` sends it to `season_matchweek_lock_at`, which resolves to the **earliest kickoff of the round** minus a buffer, and every caller in this schema passes `0` — so the deadline is the matchweek's first kickoff. The live poll window opened only `live_lead_minutes` before a kickoff, seeded at **15**, and everything earlier was a single idle poll a day.

A postponement announced after that daily poll and more than fifteen minutes before the first kickoff was therefore applied **only after predictions had locked**. Contract 210 raises `live_lead_minutes` to `720`, the maximum the bounding constraint allows, on every enabled target and as the column default.

## Required evidence

The rehearsal must prove the encrypted Production backup run succeeded and still has its unexpired encrypted artifact, restore the current Contract-209 Production database into a disposable local Supabase, dry-run exactly the one file above, apply it only to that disposable copy, and pass these behavioural suites against restored Production data:

- `256_provider_live_window_covers_the_deadline.sql` — the contract's own suite. It derives the lock instant from `season_prediction_lock_at` rather than restating it, and contrasts the old 15-minute lead against the new one **at the same instant**.
- `255_provider_fixture_lifecycle.sql` — contract 209's suite, re-run so a cadence change cannot quietly break the lifecycle it exists to serve.

Before/after measurements must show no movement in the protected player-owned, AI, cron or publication-state counts, and the **fixture status histogram is compared whole rather than by total**, exactly as the 208-to-209 promotion did.

### The three checks specific to this contract

**Every enabled target must end below no deadline.** `targets_below_720` must be `0`, and the `live_lead_minutes` column default must start `720` so a target created afterwards inherits the safe value rather than the one that caused `ING-006`.

**The window must actually be open at the instant that matters.** The postflight runs the *installed* `provider_target_is_live` predicate against the first unresolved kickoff of each enabled target's own tournament — the instant a zero-buffer matchweek lock resolves to — and refuses any target that is not live there.

**The other two dials must not have moved.** `cadence_minutes`, `live_cadence_minutes` and `live_tail_minutes` are fingerprinted **per target** before and after and compared as a whole. Contract 210 buys coverage, not frequency; a rollout that quietly raised `cadence_minutes` would spend provider credit nobody authorised, and comparing per target rather than in aggregate means a compensating pair cannot hide.

Contract 209's machinery must also survive: the lifecycle transitions table, the applier and the `postponed` mapping for SportMonks token `10` are all re-asserted.

## What does not happen at rollout

Applying 210 does not make a postponement appear, and it does not change any deadline. It changes **how early the feed is read** before a deadline that stays exactly where contracts 83 and 119 put it. The next scheduled poll is still what moves a status.

## Netlify boundary

Neither Production Netlify declaration may be raised ahead of the Production database. After an independent Production read-back proves Contract 210, set `EURO28_DEPLOYED_DB_CONTRACT=210` in the production context of both `predictorhub` and `euro28predictor`, then trigger and verify both Production deployments.

## Non-actions

This preparation does not mutate Production, does not alter `production-backup.yml`, does not add a push or schedule trigger to any Production workflow, and does not change a Netlify Production declaration. Both new workflows are `workflow_dispatch` only, each requires its own typed confirmation phrase, and each refuses any project ref that is not Production — the Development ref by name.
