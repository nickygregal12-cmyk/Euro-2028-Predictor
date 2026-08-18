# Offline analytics (DuckDB)

Analytical SQL over exported snapshots, for research and backtesting. It lives
in [`../../ai/analytics/`](../../ai/analytics/) and belongs to the AI Lab.

## What it is not

**It is not the application database.** Supabase/Postgres remains the
production authority for fixtures, results, scoring, standings, memberships and
every player-facing fact. Nothing in `ai/analytics` opens a Postgres
connection, and nothing the platform serves reads from DuckDB. If an answer
from here contradicts Supabase, Supabase is right and the snapshot is stale.

```text
provider/archive data
        v
Supabase / controlled exports
        v
CSV / Parquet analytical snapshots
        v
DuckDB
        v
AI Lab research / backtesting / analysis
```

## Layout

| File | Holds |
| --- | --- |
| `schema.py` | the six snapshot tables and their explicit column types |
| `build.py` | loading a snapshot directory and defining the derived views |
| `queries.py` | the nine starter analyses |
| `fixtures/` | a small deterministic snapshot the tests run against |
| `test_analytics.py` | the guardrails below |

Install with `bash scripts/agent-tools/ai-sync.sh test`; that profile includes
the locked `analytics` dependency group. The training and prediction pipeline
does not install that group, so DuckDB cannot make the hosted core environment
heavier while still being present for the tests that would otherwise skip it.

```python
from analytics import build_analytics_database
from analytics.queries import closing_line_value

connection = build_analytics_database("path/to/snapshot")
for row in closing_line_value(connection):
    print(row)
```

## The starter analyses

`model_performance_by_competition`, `metrics_by_model_family`,
`calibration_by_probability_band`, `accuracy_by_odds_range`,
`model_market_disagreement`, `recommendations_by_edge_bucket`,
`theoretical_roi`, `closing_line_value`, `model_performance_over_time`.

`ANALYSES` maps each name to its function, so the whole sweep can be run
without listing them again.

## Three rules, and why they are the point

**Absent is not zero.** Every aggregate reports how much evidence it had.
`mean_clv` sits beside `with_benchmark` and `without_benchmark`; a mean over no
rows is `NULL`, never `0.0`. A league that has graded nothing has no log loss —
and reporting `0.0` would make it top a leaderboard sorted ascending, which is
the exact opposite of the truth.

**Unsettled is not a loss.** Return and ROI are computed over settled bets
only, with the unsettled count reported separately. Folding an open position in
at zero profit is how a strategy is made to look flat.

**Nothing is invented.** A fixture with no goals has no outcome — it is not a
0-0 draw, and forecasts on it grade to `NULL` rather than being scored against
a scoreline that does not exist. No query fabricates a closing line, a result
or a price.

## Boundaries

- **Read-only.** `test_analyses_need_no_write_permission` reopens the database
  in DuckDB's read-only mode and requires every analysis to still answer.
- **No hosted database.** The suite runs entirely on `fixtures/`, and one test
  sets a bogus `DATABASE_URL` to prove nothing reads it.
- **No provider spend.** There is no network call anywhere in this layer, so it
  cannot consume a paid football or odds credit to populate a development
  chart.
- **Explicit schemas.** Column types are declared rather than inferred, because
  CSV inference is a moving answer that depends on which rows were sampled.
- **Reproducible.** The same snapshot rebuilds to the same figures, which is
  what makes a reported number checkable rather than merely plausible.

`ai/check_write_scope.py` reads this directory too. It globbed `ai/*.py` until
this subpackage existed; it now recurses, and `test_write_scope.py` plants a
violation inside a nested directory to prove the widened reach works.

## Snapshots

The committed `fixtures/` snapshot is a test rig, not data. Real snapshots are
exported deliberately and are not committed. Parquet is preferred and CSV is
the interchange format; `build.py` takes whichever it finds.

No DVC remote is created here. If snapshot versioning is wanted, it belongs
under the existing `dvc.yaml` stages rather than a second mechanism.
