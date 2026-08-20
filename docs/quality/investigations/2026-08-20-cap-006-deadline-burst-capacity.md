# CAP-006 — the deadline burst at 250 players, measured

**Date:** 20 August 2026
**Requirement:** `CAP-006` — raising the public-user cap to 250 is the next recommended controlled test stage.
**Trigger:** the register's own statement of what is still owed: *"one `service_role` call and the load evidence, executed as a hosted operations action."* This supplies the load evidence. It does **not** supply the other half, and nothing here was applied to any hosted environment.
**Outcome:** at 250 players and 40 concurrent clients, the deadline burst completes with **no lost write, no duplicate write and no silent success**. The failures that did occur were version conflicts, correctly refused and correctly reported. The most expensive operation is the private-league standings read, and it degrades under write contention rather than by its own shape.

## What was run

`scripts/benchmarks/cap-deadline-burst.sh`, added with this record. It seeds 250 accounts, one entry each, ten fixtures kicking off **ten minutes from now** — so writes are inside the window the burst is about rather than refused by the lock — and three private leagues, because `league_member_limit` caps a private league at 100 and 250 players do not fit in one.

Every operation calls the RPC the browser calls: `get_season_matchweek_card`, `save_season_prediction`, `confirm_season_matchweek_card`, `get_season_league_standings`, `get_my_actions`. Nothing is reimplemented in the benchmark's own SQL, because a benchmark against hand-written queries measures the benchmark.

**How failure is counted, which is the point.** pgbench aborts a client on an SQL error, so a run in which every write was refused would report a tidy early finish rather than a refusal rate. Each operation is wrapped in plpgsql that catches the exception and records it with its SQLSTATE, so the success rates below are counted from a ledger rather than from the runner's survival.

## What the numbers describe, and what they do not

A local PostgreSQL 16.13 cluster with `fsync=off`, loaded from the committed migrations through `local-postgres-shim.sql`. Following the standing caution in `scripts/benchmarks/README.md`: **these describe shape, not absolutes.** Postgres version, planner, extension set, storage and the absence of PostgREST, connection pooling and network round-trips all differ from hosted Supabase. Read them as ratios between operations and as the presence or absence of a failure mode, never as a hosted latency budget.

Two measurement errors were made and corrected before these were taken, both worth recording because both produced confident wrong answers:

- **An unanalysed database.** The first run against a freshly migrated cluster reported the standings read at a p50 of 149 ms; the identical code against a cluster that had been used reported 23 ms. The planner had no statistics. The seed now `ANALYZE`s, and a benchmark that does not is measuring the planner's ignorance.
- **A read across a permission boundary.** The first harness asked every player for league 1's standings and reported a 40% success rate, which looked like an outage and was `get_season_league_standings` correctly refusing a non-member with `42501`. It now reads the player's own league.

## Deadline burst — 250 players, 40 clients, 30 seconds

67,566 transactions, **2,251 tps**, peak 41 backends of 200.

| Operation | Attempts | Success | p50 ms | p95 ms | p99 ms | max ms |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| `prediction.save` | 33,509 | **99.76%** | 1.0 | 17.8 | 55.0 | 353.0 |
| `league.standings` | 13,568 | 100% | 22.8 | 48.3 | 91.4 | 349.8 |
| `card.read` | 10,258 | 100% | 1.0 | 18.5 | 48.4 | 401.1 |
| `actions.feed` | 6,872 | 100% | 0.2 | 0.6 | 13.2 | 125.3 |
| `card.confirm` | 3,359 | 100% | 0.6 | 6.0 | 29.2 | 172.9 |

**Every one of the 80 failures was `PT409`** — the version conflict `save_season_prediction` raises when the client echoes a version the server has already moved past. That is the harness driving two concurrent clients as the same player, which is not what a deadline looks like for a real player with one device; and it is the honest outcome either way, because a conflict is refused and reported rather than silently overwriting somebody.

**Duplicate prediction rows after the burst: 0.** No `(entry_id, season_fixture_id)` pair acquired a second row, so the burst created nothing the scoring authority would later have to choose between.

**Rate-limit events: 0.** None of these RPCs passes through `rate_limit_events`. That is a finding rather than a reassurance — it means the deadline burst is bounded by the database and the connection pool, and by nothing else.

Completion was total: 2,484 of 2,500 possible predictions written and 246 of 250 cards confirmed, the remainder being players the random mix simply did not reach in thirty seconds.

## Quiet period — 250 players, 10 clients, 20 seconds

42,371 transactions, 2,118 tps, **100% success on every operation**.

| Operation | Attempts | p50 ms | p95 ms | p99 ms |
| --- | ---: | ---: | ---: | ---: |
| `actions.feed` | 14,758 | 0.2 | 0.3 | 1.5 |
| `league.standings` | 14,492 | 7.1 | 13.2 | 16.6 |
| `card.read` | 10,586 | 0.9 | 2.8 | 5.2 |
| `prediction.save` | 2,108 | 1.0 | 2.8 | 6.0 |
| `card.confirm` | 427 | 0.6 | 1.6 | 4.2 |

## The one operation worth watching

`get_season_league_standings` is between seven and twenty times the cost of every other read, and it is the read a player performs *because* they just wrote — so it lands exactly on top of the burst.

Measured against league size in isolation, it is **not** dominated by the field: 50 members averaged 2.84 ms and 100 members 3.75 ms across ten runs each, which is far short of linear. The p50 rising from 7.1 ms quiet to 22.8 ms under burst is therefore **contention with the write load**, not the query's own shape. That distinction matters for what to do about it: an index or a rewrite addresses the shape and would buy little, whereas the standings read being cheap to *repeat* — a cache with an honest staleness label, or a read that does not re-aggregate — addresses the contention.

Recorded here rather than acted on. `ACQ-R02` already owns the equivalent finding for the global leaderboard and reached the same conclusion by a different route.

## Findings the harness produced by being refused

Three product controls stopped the seed before they were noticed in any document, which is the strongest evidence they work:

1. **`predictor_internal.operating_limits` is real and it is 50.** Seeding 250 players was refused until the local copy was raised. `public_user_limit` also carries `check (… between 1 and 250)`, confirming the register's claim that 250 needs no migration.
2. **A private league holds at most 100.** `league_member_limit` is capped at 100 by its own constraint, and `enforce_league_member_limit` refused member 101. 250 players therefore means at least three leagues — which is what the seed now builds.
3. **`game_membership_events` is append-only.** `block_game_membership_event_mutation` refuses a delete outright, so even a namespaced teardown has to disable triggers explicitly to remove its own rows.

## Scale patterns, audited rather than measured

`F4` names the shapes that hurt well before a longer-term target. Swept across
the vNext integration layer and the season services:

**Client-side recomputation of server-owned order: none.** Two sorts exist in
the season models and neither recomputes a rank — `championshipStandingModel`
re-orders by the server's own `groupRank`, and `periodStandingsModel` orders
periods by month. The standings and the leaderboard are the server's answer
everywhere they are shown.

**One per-item read is bounded, one is not.** `useVNextHomeSource` reads a table
and a movement per league, concurrently, over a list it first slices to
`LEAGUE_LIMIT` — and its own comment names the N+1 it is avoiding.
`useVNextMatchCentreSource` reads league predictions per league with no slice
at all. It is concurrent rather than serial, so it is not a waterfall, but it
is one round trip per league on every Match Centre open. **Today it is bounded
only by `operating_limits.total_league_limit`, which is 20** — an accidental
bound rather than a designed one, and one that `CAP-007` proposes to raise to
1,000. Worth a slice before that happens, not before then.

**Repeated catalogue fetches:** `get_competition_games` and
`get_published_weekly_seasons` are each reached through one service module
rather than called ad hoc from components, which is the shape that makes a
cache possible later rather than necessary now.

Nothing here was changed. These are recorded because `F4` asks for the obvious
bottlenecks to be identified before they matter, and the honest finding is that
the two that exist are small and one of them is already commented.

## What remains for CAP-006

The load evidence is now on record and it does not argue against 250. What is still owed is unchanged and is not a repository change:

```sql
-- Against a NAMED hosted environment, with explicit authority for that
-- environment, as a service_role call. Not authorised by this document.
select public.set_operating_limits(250, <current total_league_limit>);
```

`predictor_internal.operating_limits.public_user_limit` stands at **50** on hosted Development. Nothing in this investigation changed it, and the benchmark prints that fact at the end of every run.

**What this evidence does not cover**, stated so nobody reads it as more than it is:

- **Hosted latency.** A local cluster with `fsync=off` and no PostgREST, pooler or network is not Supabase. Ratios transfer; milliseconds do not.
- **Connection pool exhaustion.** Peak backends reached 41 of a locally configured 200. Supabase's pooler has its own limits and its own failure mode, and that is where a real 250-player burst would first show strain.
- **The browser half.** Whether a request that times out at the network can ever read as saved is a client property, answered by `useSeasonMatchPredictor`'s save states and, since 20 August 2026, reported by `reportOperationFailure`. Nothing in this database measurement speaks to it.
