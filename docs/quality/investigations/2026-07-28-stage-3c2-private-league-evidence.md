# Stage 3C2 evidence — private-league reads at the 250-member cap

**Date:** 28 July 2026  
**Environment:** development Supabase `iouzoutneyjpugbbtdem` at contract 46  
**Scope:** paginated private-league standings, caller context, ownership-candidate search and lightweight league summaries at the intended 250-member technical cap.

## Method

A temporary PL/pgSQL evidence function created a rollback-only subtransaction on hosted development:

- the existing 23 Auth users were combined with 227 synthetic users, producing exactly 250 league members;
- every synthetic member received a submitted entry and a deterministic score event;
- the caller was placed outside the first page to verify independent current-user context;
- all five 50-row pages were traversed using the opaque keyset cursor;
- owner-only transfer-candidate search and `get_my_leagues` were measured separately;
- `EXPLAIN (ANALYZE, BUFFERS, FORMAT JSON)` was captured for the first-page function call;
- an intentional caught exception rolled back the whole fixture before the function returned its evidence.

Baseline and post-run counts were identical: 23 Auth users, 23 profiles, 21 entries, 3 leagues, 37 league memberships and 252 score events. No synthetic data was retained.

Timings are server-side execution on the shared hosted development project; network and PostgREST overhead are excluded. They are indicative single-run measurements rather than percentile benchmarks.

## Results

| Operation | Rows | Duration | Response size |
| --- | ---: | ---: | ---: |
| Private-league page 1 | 50 | 48.937 ms | 14,103 B |
| Private-league page 2 | 50 | 24.345 ms | 14,124 B |
| Private-league page 3 | 50 | 23.331 ms | 14,222 B |
| Private-league page 4 | 50 | 22.682 ms | 14,222 B |
| Private-league page 5 | 50 | 22.725 ms | 13,934 B |
| Owner candidate search | 20 | 3.190 ms | 1,740 B |
| Lightweight league summary | 1 | 1.211 ms | 235 B |

Traversal returned **250 rows and 250 unique users** across five pages. The caller's independent position was **227**, proving that a member outside page one remains available without injection into the page rows.

## Query-plan evidence

The measured first-page function call completed in **7.129 ms** inside `EXPLAIN (ANALYZE, BUFFERS)`, with:

- 231 shared-buffer hits;
- zero shared-buffer reads;
- zero temporary reads or writes;
- zero local-buffer reads or writes.

The higher 48.937 ms first direct call includes the cold function/query setup observed before the measured plan and warm subsequent pages. Warm pages remained around 23–24 ms while returning approximately 14 kB each.

## Verdict

Contract 45's private-league read shape is bounded, deterministic and responsive at the full 250-member technical cap. Contract 46's summary preserves Home's league-activity selection with a 235-byte response rather than downloading standings. The owner-only transfer search is independently bounded and does not require member standings to be loaded.

This closes the private-league portion of Stage 3C2 representative read evidence. Remaining scale-stage work is product-surface verification for profile, H2H and comparison journeys, plus completion/loading/empty/error-state repairs exposed by those journeys. Full-tournament scoring recomputation remains scheduled for the later dress rehearsal.
