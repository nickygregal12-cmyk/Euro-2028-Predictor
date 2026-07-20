# Ops note — Entering & correcting results (Phase 2 interim)

There is no admin result-entry page yet — it's deferred to Phase 3 (built once against the final feature set, and it must exist before the dress rehearsal). For Phase 2, results are entered and corrected **directly in the Supabase SQL editor**. Scoring re-derives automatically: a trigger on `matches` recomputes `score_events` whenever a score changes.

Written against the live schema in `supabase/migrations/20260720130000_add_scoring.sql` (+ the initial `matches` table in `20260719120000_init_v0_1.sql`).

## How scoring reacts (why this is safe)

- `matches.home_score` / `matches.away_score` hold the real result. A check constraint requires **both set or both null** (`matches_score_pair`).
- Trigger **`recompute_scores_on_result`** fires `AFTER INSERT OR UPDATE OF home_score, away_score` and calls **`recompute_tournament_scores(tournament_id)`** (it skips if neither score actually changed).
- `recompute_tournament_scores()` **deletes and re-derives** every `score_events` row for that tournament's entries from source data (predictions + results + jokers). So a correction never double-counts — the old events are gone before the new ones are written.
- `entry_totals` (a view) sums `score_events` per entry; `get_leaderboard()` reads it. Nothing else to update.

## Enter a result

`match_ref` values: group `GA-1`…`GF-6`, knockout `R16-1`…`R16-8`, `QF-1`…`QF-4`, `SF-1`, `SF-2`, `FINAL`.

```sql
update matches
set home_score = 2, away_score = 1
where tournament_id = (select id from tournaments order by year limit 1)
  and match_ref = 'GA-1';
```

The trigger recomputes automatically — no further step.

## Correct a result

Just run the update again with the corrected scores. Delete-and-rederive means no double-counting.

```sql
update matches
set home_score = 3, away_score = 1
where tournament_id = (select id from tournaments order by year limit 1)
  and match_ref = 'GA-1';
```

## Clear a result (postponement / entered by mistake)

Both columns must go null together (the check constraint):

```sql
update matches
set home_score = null, away_score = null
where tournament_id = (select id from tournaments order by year limit 1)
  and match_ref = 'GA-1';
```

The trigger recomputes and that match stops scoring.

## Manual recompute (backfill)

The trigger only fires on **future** score changes. If results were entered **before** the scoring migration was applied (e.g. the dev seed, or a fresh production import), backfill once:

```sql
-- Every tournament:
select recompute_all_scores();

-- Or a single tournament:
select recompute_tournament_scores((select id from tournaments order by year limit 1));
```

These run as a privileged role in the SQL editor; they're intentionally not client-callable.

## Verify

After entering or correcting a result, confirm it landed:

```sql
-- Who scored on this specific result, and how:
select p.display_name, se.points, se.joker, se.explanation
from score_events se
join entries e on e.id = se.entry_id
join profiles p on p.id = e.user_id
where se.match_id = (
  select id from matches
  where match_ref = 'GA-1'
    and tournament_id = (select id from tournaments order by year limit 1)
)
order by se.points desc, p.display_name;

-- Overall standings (what the League tab shows — submitted entries only):
select p.display_name, t.total_points
from entry_totals t
join entries e on e.id = t.entry_id
join profiles p on p.id = e.user_id
where e.tournament_id = (select id from tournaments order by year limit 1)
  and e.submitted_at is not null
order by t.total_points desc, p.display_name;
```

## Scope note

Only **§1 group-match points** are derived today. Group positions (§2), knockout progression (§3), and awards (§4) score 0 until the **"Scoring engine completion"** item lands — so entering knockout results won't yet produce `score_events`. See `build-todo.md`.

## Related

- Scoring engine: `supabase/migrations/20260720130000_add_scoring.sql`
- Reference / acceptance test: `tests/scripts/scoreEntries.test.ts`
- The admin result-entry **page** that replaces this manual process: **Phase 3**, must exist before the dress rehearsal.
