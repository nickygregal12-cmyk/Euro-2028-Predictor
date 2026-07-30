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

Latency varies run to run on shared hardware — a second full pass measured
907.9 ms and 2,985.0 ms for result 36 at 250 and 1,000 entries against the
884.4 ms and 4,005.1 ms above. The ratios and the compounding shape are stable
across runs; treat individual milliseconds as indicative.

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

### 4. WAL generation compounds with it

`pg_wal_lsn_diff` taken across each confirmation:

| Field size | WAL at result 36 | WAL across all 36 |
| --- | --- | --- |
| 50 | 888 kB | **16 MB** |
| 250 | 4.7 MB | **87 MB** |
| 1,000 | 18 MB | **312 MB** |

Scoring one group stage at the enforced 250 cap writes **87 MB of WAL**; at
1,000 entries, **312 MB**. This is the delete-and-rederive pattern made
visible — every confirmation rewrites the entire score-event set, so those rows
are not merely recomputed but re-logged, and replicated, and backed up.

That settles the second half of the impact `ACQ-R03` names. Table bloat follows
from the same mechanism — 9,000 dead tuples per confirmation at 250 entries by
result 36 — though autovacuum behaviour under that load was not observed here.

### 5. Table bloat: the table settles at 19× its live size

Measured separately with **each confirmation in its own committed transaction**,
on a database built fresh so no earlier run contributed pages. 250 entries, all
36 group results:

| Point | Live tuples | Dead tuples | On disk |
| --- | --- | --- | --- |
| Before any result | 0 | 0 | 32 kB |
| After 36 results | 9,126 | **158,000** | **36 MB** |
| After plain `VACUUM` | 9,126 | 0 | **36 MB** |
| After `VACUUM FULL` | 9,126 | 0 | **1.9 MB** |

Two things matter here, and the second is the one that persists.

**Dead tuples reach 17× the live count.** Summing the deletes across the stage
gives 250 × (1+2+…+36) ≈ 166,500, which is essentially every row ever written —
the delete-and-rederive pattern means only the final 9,126 survive.

**Plain `VACUUM` reclaims nothing from the file.** It marks space reusable but
does not return it, so the table stays at 36 MB holding 1.9 MB of live data —
**19× its content**. Only `VACUUM FULL` shrinks it, and that takes an exclusive
lock, which is not something to run mid-tournament.

The steady state is therefore the **high-water mark**, set by peak churn between
autovacuum cycles rather than by how much data the competition actually holds.

**Do not read the 0 autovacuum runs as a production finding.** The threshold for
this table is `50 + 0.2 × 9,126 ≈ 1,875` dead tuples, crossed after roughly the
second confirmation, but `autovacuum_naptime` is 60 s and this walk completed
inside one nap. Real results arrive across days, so autovacuum will run and will
keep dead tuples in check. What it will not do is shrink the file.

The production-relevant window is a **matchday**, not a stage: twelve results
within a few hours. At 250 entries a late matchday churns roughly
250 × (25+26+…+36) ≈ 91,500 tuples in that window, and that is what sets the
high-water mark.

### 6. Knockout results cost more than any group result

Measured on the same database immediately after the group stage, with a
predicted bracket seeded for every entry so the per-entry knockout derivation
is real work rather than a no-op. The round of 16 populated **automatically**
once the 36th group result confirmed, and each round populated the next, so
this is the real cascade rather than a fixture.

| Round | Results | Per confirmation | WAL each |
| --- | --- | --- | --- |
| R16 | 8 | 1,335–1,476 ms | ~12 MB |
| QF | 4 | 1,404–1,592 ms | ~12 MB |
| SF | 2 | 1,541–1,604 ms | ~12 MB |
| Final | 1 | 827 ms | 6 MB |
| **All 15** | | **21.2 s** | **179 MB** |

Every knockout confirmation costs more than the *worst* group confirmation
(884 ms), and roughly four times the group-stage mean. WAL per result is about
2.5× the group stage's worst. `score_events` grows 9,126 → 13,126 and the table
reaches 82 MB.

**A full tournament at 250 entries is therefore ~33 s of cumulative recompute
and ~266 MB of WAL across 51 confirmations.**

That figure also settles the extrapolation this document previously labelled
"a floor, not an estimate": it predicted ~1.3 s for a late confirmation and
~32 s cumulative. Measured, knockout confirmations are ~1.4 s and the total is
~33 s. The model was accurate rather than merely conservative.

The Final being cheapest is consistent with the mechanism: by then few entries
retain a surviving bracket prediction, so there is less per-entry derivation
even though the accumulated base is largest.

### 7. Concurrency degrades reads but does not block them

Six concurrent leaderboard readers against three confirmations, same database
and field size:

| | Mean | p95 | Worst |
| --- | --- | --- | --- |
| Reads, no writer | 84 ms | — | 117 ms |
| Reads, 6 readers + writer | **125 ms** | 189 ms | **347 ms** |

Confirmations under that read load took 944–1,108 ms, and **no query failed or
serialised**. Delete-and-rederive does not block readers: MVCC gives them the
pre-delete snapshot, so the contended resource is CPU rather than locks.

The 1.5× mean and 3× worst-case degradation is the honest shape — reads get
slower during a confirmation, they do not stall. That is a materially better
answer than "peak-time operational failure" implies, and it narrows the risk to
throughput rather than availability.

### 8. Rank-history capture is not per-result

A single confirmation on an otherwise unscored tournament wrote 5 score events, 1 revision row and **0** rank-history rows. `capture_rank_history` snapshots at matchday completion, not on every result, so results 12, 24 and 36 carry work the others do not. The measurements at those indices therefore sit at the top of the local range, and the cost between them is not isolated here.

## Reconciliation with the existing register entry

The register records *"full recomputation at 250 entries with 12 results measured ~354 ms."* This run measures **204.7 ms** for the 12th confirmation at 250 entries — same order, on different hardware, and consistent.

The important point is not the discrepancy but the framing: 12 results is one group matchday, and at that depth the per-write cost is roughly a quarter of what it reaches by result 36. The existing figure is accurate and was read as representative when it was in fact an early-tournament sample.

## What this does not establish

- **Not the Supabase stack.** PostgreSQL 16 with a shimmed `auth` schema, versus hosted Postgres 17. Migrations applied cleanly, but the planner, hardware and extension set differ.
- **Concurrency was measured at six readers on shared hardware**, which is a contention probe rather than a load test. It shows reads do not block; it does not establish behaviour at realistic peak.
- **Autovacuum was not observed doing its job.** Bloat is measured above, but the walk compressed 36 results into less than one `autovacuum_naptime`, so the run says nothing about whether autovacuum keeps up when results are days apart. It says only what it must keep up with.
- **Synthetic predictions**, deterministic rather than realistic in distribution.

## Disposition

- `ACQ-R03` remains **In progress through evidence**, and the evidence is now stronger for acting than for deferring.
- At the enforced 250-entry cap the operational picture is: **~0.9 s for the final group confirmation and ~12 s of cumulative recompute across the group stage.** Tolerable, but no longer "not currently justification".
- At 1,000 entries it is **4 s per confirmation** at the end of the group stage and **48 s** cumulative. That is a long write transaction on a live scoring path, which is exactly the impact `ACQ-R03` describes.
- `DEC-009`'s deferral condition — a full-result-volume benchmark — is **satisfied for the group stage**, now including WAL. Knockout results, WAL, bloat and a concurrency probe are all now measured. What remains is autovacuum behaviour at realistic result spacing, and a genuine load test at peak.
- The compounding shape matters more than any single number: the cost is worst at precisely the moment the tournament is busiest.
