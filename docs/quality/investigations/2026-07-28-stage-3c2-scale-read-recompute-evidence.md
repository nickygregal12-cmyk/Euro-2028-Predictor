# Stage 3C2 evidence — non-league reads and recomputation at the 250-entry cap

**Date:** 28 July 2026
**Environment:** development Supabase `iouzoutneyjpugbbtdem` at contract 44 (44 canonical migrations)
**Scope:** overall standings, rival-entry, match-pick distribution, submission-status reads and score recomputation / rank-history capture at 250 submitted entries. League reads are deliberately excluded — they are being reworked and evidenced by draft PR #138 (contracts 45–46).

## Method

A single rollback-only transaction on hosted development seeded representative volume and measured inside it, so no data persisted:

- transaction-local `session_replication_role = replica` seeding, mirroring the committed pgTAP excess-data fixture patterns (`supabase/tests/098_bounded_read_models.sql`, `099_paginated_overall_leaderboard.sql`);
- 234 synthetic users/profiles/entries added to the 16 existing submitted entries → exactly **250 submitted entries**;
- each seeded entry carries a full 36-match prediction set (score-varied copies of a complete real entry), 5 jokers, complete predicted group positions and bracket progression → 9,180 match predictions, 6,120 positions, 2,040 progression rows in total;
- one 234-member league seeded to satisfy the rival-read co-membership gate;
- reads executed as an ordinary `authenticated` JWT (not service role), after one warm-up call per function; recomputation executed through the same `public.recompute_tournament_scores` path the result triggers use;
- final `rollback`; post-run verification confirmed development back at its exact baseline (21 entries, 756 predictions, 252 score events, 16 rank-history rows, 3 leagues, 0 synthetic auth users, lock instant unchanged).

Timings are server-side function execution (network and PostgREST overhead excluded). Single-run figures on the shared hosted instance — indicative, not percentile benchmarks.

## Results — recomputation (roadmap Stage 3C2 item 3)

| Operation | Volume | Duration | Output |
| --- | --- | ---: | --- |
| `recompute_tournament_scores` | 250 submitted entries × 36 predictions, 12 confirmed group results | **354 ms** | 3,060 score events rederived |
| `capture_rank_history` | 250 submitted entries | **4 ms** | 250 rank-history rows |

The full delete-and-rederive recompute at the operating cap costs ~0.35 s with a third of the group stage resulted. Cost scales with confirmed results; even at ~3× (all 36 group results) the synchronous in-transaction recompute remains comfortably within interactive bounds. This is direct evidence for deferred decision `DEC-009` (incremental vs full recomputation): **no incremental scorer is justified at the current caps.**

## Results — reads (roadmap Stage 3C2 item 2)

| Read (as `authenticated`) | Duration | Response size | Notes |
| --- | ---: | ---: | --- |
| `get_leaderboard` page 1, limit 50 | 8 ms | 6,091 B | 50 rows; truthful `totalCount` 250; correct independent `you` row (position 92, tied) |
| `get_leaderboard` page 2 via cursor | 8 ms | 6,087 B | keyset cursor traversal, no drift |
| `get_leaderboard` page 1, limit 100 | 8 ms | 11,768 B | maximum page |
| `get_rival_entry` | 3 ms | 4,384 B | fixed 36 group predictions + 8 progression rows |
| `get_match_prediction_distribution` | 5 ms | 1,072 B | 250 picks on one fixture |
| `get_entry_submission_status` | 1 ms | — | owner-only status row |

Every payload stays in single-digit kilobytes and single-digit milliseconds at the cap; page size — not entry volume — dominates response size, which is the intended property of the contract-43 bounded/paginated read models.

## Query plans

**Leaderboard base aggregate (top 50 of 250)** — `EXPLAIN (ANALYZE, BUFFERS)`: HashAggregate over a hash right join (score_events → entries → profiles), top-N heapsort. Execution 4.1 ms, 76 shared-buffer hits, zero disk reads, 145 kB peak aggregate memory. The sequential scans are over 250/257/3,060-row tables — at the enforced caps these tables cannot grow materially beyond this, so no additional index is warranted by this evidence.

**Per-entry score events (points breakdown read)** — index scan on `score_events_entry_idx`, 0.03 ms, 14 buffer hits. The profile/breakdown read path is index-backed and flat.

## Boundaries of this evidence

- League standings, league lists, member/pick payloads: excluded here; PR #138 carries their rework and evidence.
- Knockout-stage result volume (15 further results incl. extra-time/penalty events) was not present; recompute cost at full-tournament result volume should be re-measured at the dress-rehearsal stage.
- Single-run hosted timings; the operating-cap write-boundary behaviour under concurrency is separately proven by the contract-44 pgTAP lifecycle (`100_operating_cap_enforcement.sql`).
- No hosted data was created, modified or retained; the run was transaction-local and verified rolled back.
