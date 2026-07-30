# ACQ-R03 / DEC-009 — measured result-write cost across a full group stage

**Date:** 30 July 2026
**Risk:** `ACQ-R03` — a result write synchronously recomputes the whole tournament.
**Decision:** `DEC-009` — incremental versus full recomputation, deferred pending a *"full-result-volume benchmark"*.
**Outcome:** the risk is **confirmed and materially larger than the single existing data point suggested.** Per-write cost compounds across a tournament: at 250 entries the last group confirmation costs **26×** the first.

## Method

`public.confirm_match_result()` — the real administrator path, including the advisory lock, the revision row and the recompute trigger — was called for all 36 group results in fixture order, at three field sizes, each entry carrying a prediction for every group match. Each call was timed individually. Every scale began from an unscored tournament with revisions, score events and rank history cleared, so no scale inherited another's state.

**Environment: a local PostgreSQL 16 cluster with a hand-built Supabase shim, not the Supabase stack.** All 63 committed migrations and `supabase/seed.sql` applied cleanly against it. Absolute numbers do not transfer to hosted Postgres 17; the shape and the ratios do. The harness is `scripts/benchmarks/acq-r03-result-write.sql`.

## Results

| Field size | Result 1 | Result 12 | Result 24 | Result 36 | Mean | Worst | All 36 total |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 50 | 41.8 ms | 48.9 ms | 94.2 ms | 283.6 ms | 77.0 ms | 283.6 ms | **2.8 s** |
| 250 | 34.3 ms | 204.7 ms | 571.6 ms | 884.4 ms | 326.5 ms | 884.4 ms | **11.8 s** |
| 1,000 | 135.5 ms | 763.1 ms | 1,677.8 ms | 4,005.1 ms | 1,339.7 ms | 4,005.1 ms | **48.2 s** |

## Findings

### 1. Cost compounds within a tournament

| Field size | Result 1 → Result 36 |
| --- | --- |
| 50 | 6.8× |
| 250 | **25.8×** |
| 1,000 | **29.6×** |

`recompute_tournament_scores` deletes and rederives every score event for the tournament on every result write. So each confirmation pays for all entries **and every result already confirmed**. The first result of a tournament is cheap; the last is not.

This is the part the existing single data point could not show. A measurement taken at 12 results sees roughly a quarter of the final per-write cost.

### 2. Cost is linear in entries, linear in results-so-far

Per confirmation, per entry, per result already entered:

| Field size | Result 36 cost ÷ (entries × 36) |
| --- | --- |
| 250 | 0.098 ms |
| 1,000 | 0.111 ms |

A serviceable model is **≈ 0.1 ms × entries × results-so-far** per confirmation, which makes the total across a tournament grow roughly with the *square* of the result count:

> total ≈ 0.1 ms × entries × R² / 2

At 250 entries and R = 36 that predicts ~16 s against 11.8 s measured — the right order, slightly pessimistic.

### 3. The full tournament is worse than this measurement

Only the 36 group results were measured. Knockout scoring additionally derives the predicted bracket per entry, so the remaining 15 results each cost *more* than a group result at the same depth, on top of a larger accumulated base.

Extrapolating the group-stage model alone to R = 51 at 250 entries gives ~1.3 s for the final confirmation and ~32 s of cumulative recompute. **Treat that as a floor, not an estimate.**

### 4. Rank-history capture is not per-result

A single confirmation on an otherwise unscored tournament wrote 5 score events, 1 revision row and **0** rank-history rows. `capture_rank_history` snapshots at matchday completion, not on every result, so results 12, 24 and 36 carry work the others do not. The measurements at those indices therefore sit at the top of the local range, and the cost between them is not isolated here.

## Reconciliation with the existing register entry

The register records *"full recomputation at 250 entries with 12 results measured ~354 ms."* This run measures **204.7 ms** for the 12th confirmation at 250 entries — same order, on different hardware, and consistent.

The important point is not the discrepancy but the framing: 12 results is one group matchday, and at that depth the per-write cost is roughly a quarter of what it reaches by result 36. The existing figure is accurate and was read as representative when it was in fact an early-tournament sample.

## What this does not establish

- **Not the Supabase stack.** PostgreSQL 16 with a shimmed `auth` schema, versus hosted Postgres 17. Migrations applied cleanly, but the planner, hardware and extension set differ.
- **No concurrency.** A single session, nothing else running. Real confirmations happen while players are reading.
- **WAL and bloat were not measured.** The register names both. A 4-second transaction that deletes and reinserts 36,000 rows is a strong candidate for both, but this run did not quantify them.
- **Knockout results untested**, as above.
- **Synthetic predictions**, deterministic rather than realistic in distribution.

## Disposition

- `ACQ-R03` remains **In progress through evidence**, and the evidence is now stronger for acting than for deferring.
- At the enforced 250-entry cap the operational picture is: **~0.9 s for the final group confirmation and ~12 s of cumulative recompute across the group stage.** Tolerable, but no longer "not currently justification".
- At 1,000 entries it is **4 s per confirmation** at the end of the group stage and **48 s** cumulative. That is a long write transaction on a live scoring path, which is exactly the impact `ACQ-R03` describes.
- `DEC-009`'s deferral condition — a full-result-volume benchmark — is **satisfied for the group stage**. The outstanding pieces are knockout results, WAL/bloat measurement, and behaviour under concurrency.
- The compounding shape matters more than any single number: the cost is worst at precisely the moment the tournament is busiest.
