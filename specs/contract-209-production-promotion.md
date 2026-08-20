# Contract 209 Production promotion

## Exact boundary

Production is currently Contract 208. The intended single promotion is exactly one additive migration:

1. `20260819200000_provider_fixture_lifecycle.sql`

Development reached Contract 209 first and is independently recorded at it. Production remains read-only throughout the encrypted backup and disposable-restore rehearsal. The Production rollout may write only after both gates succeed.

## Why this promotion exists

At Contract 208 Production decodes a postponement and then discards it. Its SportMonks poll target fetches successfully, but token `10` is outside the status vocabulary, so the response is archived and recorded and no fixture status moves. Contract 209 is what turns that observation into something a player can see:

- it repairs both arms of season resolution, which is why nothing had been applied from a provider response since `2026-08-10T15:27Z`;
- it adds `10` to the vocabulary as `postponed`;
- it lets an unattended provider apply and reverse a postponement, and nothing else — cancel, abandon and void remain human decisions;
- it states what a postponed or voided fixture does to a prediction deadline, in both directions.

## Required evidence

The rehearsal must prove the encrypted Production backup run succeeded and still has its unexpired encrypted artifact, restore the current Contract-208 Production database into a disposable local Supabase, dry-run exactly the one file above, apply it only to that disposable copy, and pass these behavioural suites against restored Production data:

- `255_provider_fixture_lifecycle.sql` — the contract's own lifecycle suite, which drives postponement, reschedule and reinstatement from decoded payloads rather than from any named club.
- `171_ingestion_write_boundary.sql` — the positive assertion of which functions may write a `public` relation unattended. Contract 209 adds one, and this suite refuses any writer it does not name.

Before/after measurements must show no movement in the protected player-owned, AI, cron or publication-state counts.

**The fixture status histogram is compared whole, not by total.** A migration that invented a postponement would leave `season_fixtures` unchanged while moving a fixture between statuses, and a count comparison would not see it. Both the rehearsal and the rollout compare the full `status -> count` map and fail on any movement.

**The lifecycle machinery must arrive inert.** `season_fixture_lifecycle_transitions` must exist with row level security enabled and hold **zero** rows after the apply. A transition written during the migration would mean the applier ran at migration time, which it must never do — the applier runs only from a consumed provider response.

The installed reads must carry the `schedule` object on all three of `get_season_fixtures`, `get_season_fixture` and `get_my_football_calendar` — contract 197 pins the calendar to the same shape as the season reads, and leaving it behind is the exact defect CI caught while contract 209 was in review — and all must stay authenticated-only, never `anon`.

The rollout must require that successful backup and a successful rehearsal from the exact same repository head, independently confirm Production is still Contract 208, dry-run the same one-file set, apply it once, and verify the live ledger at Contract 209 with the same protected-state and inertness checks.

## What does not happen at rollout

Applying 209 does not make a postponement appear. It makes one *possible*. The status moves when a provider response is next consumed under the new contract, which is driven by the ordinary poll cadence and not by this promotion.

At the time of writing, Production's SportMonks target polls on a **1440-minute** cadence, so a postponement can be up to roughly a day stale — the risk recorded as `ING-006`, with `cadence_minutes` and `live_lead_minutes` as the two available levers. That is an owner decision and is deliberately **not** bundled into this promotion.

## Netlify boundary

Neither Production Netlify declaration may be raised ahead of the Production database. After an independent Production read-back proves Contract 209, set `EURO28_DEPLOYED_DB_CONTRACT=209` in the production context of both `predictorhub` and `euro28predictor`, then trigger and verify both Production deployments.

## Non-actions

This preparation does not mutate Production, does not alter `production-backup.yml`, does not add a push or schedule trigger to any Production workflow, and does not change a Netlify Production declaration. Both new workflows are `workflow_dispatch` only, each requires its own typed confirmation phrase, and each refuses any project ref that is not Production — the Development ref by name.
