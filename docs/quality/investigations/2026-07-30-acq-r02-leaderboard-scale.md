# ACQ-R02 — measured leaderboard cost above the enforced cap

**Date:** 30 July 2026
**Risk:** `ACQ-R02` — browser standings reads aggregate the scoring table through a derived totals view.
**Trigger:** the register's own condition, *"review on cap increase or adverse dress-rehearsal evidence."* This supplies the cap-increase half.
**Outcome:** the risk is **confirmed as a mechanism and quantified**. The register's disposition at the current cap remains correct and is unchanged. What is new is the curve above the cap and the correct variable to track it against.

## Method

`public.get_leaderboard()` was exercised on a disposable local Supabase stack rebuilt from committed migrations, against a scratch tournament so no seeded Euro row took part. At each field size the harness:

1. seeded N entries with 60 `score_events` each, under `session_replication_role = replica` so foreign-key checks did not distort seed time;
2. reset to `origin` and `ANALYZE`d, so nothing was measured under altered semantics or stale statistics;
3. captured `EXPLAIN (ANALYZE, BUFFERS, FORMAT JSON)` of the `base` → `summary` → `ranked` aggregation;
4. walked ten pages at page size 20, chaining the function's own `nextCursor`, timing each call.

Everything ran inside a transaction that was rolled back.

## Results

| Field size | Score events | Aggregation exec (ms) | Page 1 (ms) | Page 5 (ms) | Page 10 (ms) | Mean page (ms) | `score_events` access |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 50 | 3,000 | 5.8 | 46.4 | — | — | 22.0 | seq scan |
| 250 | 15,000 | 22.4 | 36.4 | 37.4 | 31.5 | 35.0 | seq scan |
| 1,000 | 60,000 | 152.4 | 148.1 | 138.3 | 129.4 | 137.0 | index |
| 5,000 | 300,000 | 685.1 | 689.3 | 630.4 | 632.6 | 651.9 | index |

The 50-entry row is first-call noise — its 46.4 ms page 1 against a 5.8 ms aggregation is plan compilation and cold cache, not work. Only three pages exist at that size. It is excluded from the curve below.

## Findings

### 1. Page depth is free, which confirms the mechanism

At every size, page 10 costs the same as page 1 — and is consistently *slightly cheaper*, being warm. At 5,000 entries: 689.3 ms for page 1, 632.6 ms for page 10.

This is the decisive observation. If pagination bounded the work, deep pages would cost more, not the same. Every page pays to aggregate and rank the entire field, and the page limit is applied afterwards. **Pagination here is presentational.** That is precisely the mechanism ACQ-R02 describes, now demonstrated rather than inferred from the SQL.

### 2. Cost is linear in score events, not in entries

| Field size | Mean page ms per entry | Mean page ms per score event |
| --- | --- | --- |
| 250 | 0.140 | 0.00233 |
| 1,000 | 0.137 | 0.00228 |
| 5,000 | 0.130 | 0.00217 |

Per-event cost is effectively constant across a twenty-fold range. Scaling is linear and very slightly sub-linear at the top end.

**The tracking variable should be `score_events` volume, not entry count.** Entry count is a proxy that holds only while events per entry are constant, and events per entry are a property of the competition format — an entry that predicts more matches carries more events. A season competition with many matchweeks will generate a different ratio from the Euro tournament.

### 3. The aggregation is essentially the entire call

At 1,000 entries the aggregation measures 152.4 ms against a 148.1 ms whole-call page 1; at 5,000, 685.1 ms against 689.3 ms. Ranking, window functions, cursor handling and JSON assembly are not measurable next to the `base` CTE.

Any mitigation therefore has to remove the aggregation. Optimising around it has nothing to work with.

### 4. The index does not rescue it

`score_events` access switches from sequential scan to `score_events_entry_idx` between 250 and 1,000 entries, and cost continues to scale linearly regardless. This is expected: the query has no selective predicate on `score_events` — it must read every event belonging to every submitted entry. An index changes the constant factor, not the shape.

## Reconciliation with the existing register entry

The register records *"current 250-entry query-plan evidence is single-digit milliseconds with zero disk reads."* This run measures 22.4 ms of aggregation at 250 entries.

**This is not presented as a contradiction.** The most likely explanation is events per entry: this harness seeds 60 per entry (15,000 events at 250 entries), and at the measured ~0.0022 ms per event, a lighter fixture of ~15 events per entry would produce roughly 8 ms — single digit, exactly as recorded. The two figures are consistent under finding 2.

It does mean the earlier figure should be read as *"single-digit milliseconds at that event volume"* rather than *"at 250 entries."* That is the same correction finding 2 asks for.

## Threshold arithmetic for the cap decision

At the measured ~0.135 ms per entry at 60 events each — equivalently ~0.0022 ms per score event:

| Mean page cost | Approximate field size | Approximate score events |
| --- | --- | --- |
| 100 ms | ~740 | ~44,000 |
| 250 ms | ~1,850 | ~111,000 |
| 500 ms | ~3,700 | ~222,000 |
| 1,000 ms | ~7,400 | ~444,000 |

Roughly **every 45,000 score events adds 100 ms to every leaderboard page view.**

## What this does not establish

- **Absolute numbers do not transfer.** This is local hardware, a single connection, a warm cache and no concurrency. Hosted figures will differ, and concurrency is the untested dimension that matters most: this cost is paid per viewer, independently, with no shared cache between them.
- **The event distribution is synthetic.** Points are spread deterministically to produce ties and distinct totals; real distributions may plan differently, though the aggregation is unavoidable either way.
- **60 events per entry is an assumption**, chosen as plausible for a complete Euro entry across group matches, positions, knockout and awards. It was not derived from production data.

A hosted measurement under concurrency remains the outstanding piece, and needs the applicable approval.

## Disposition

- `ACQ-R02` stays **Open as a future scale direction**. The judgement that a maintained table is not justified at the enforced 250-entry cap is **supported** by this evidence: ~35 ms per page is not a problem.
- The register's review condition is now half-satisfied. The cap-increase half has data; the dress-rehearsal half does not.
- **The mitigation should land before the operating cap is raised materially, not after.** At the cap the risk is invisible; the first field size at which it is user-visible is already past the point where the fix is a schema change to a live scoring path.
- `ACQ-R01` carries the same *"re-open before increasing the operating cap materially"* condition and reads on the same query. This evidence is relevant to that review too, and is not treated here as discharging it.
