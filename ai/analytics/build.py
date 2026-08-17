"""Build the offline analytical database from a snapshot directory.

Read-only by construction and by intent:

  * it opens DuckDB, never Postgres, so it cannot reach hosted data at all;
  * it reads local Parquet or CSV files somebody exported deliberately;
  * it makes no network request, so it can never spend a paid provider credit.

The database it produces is disposable. Rebuilding it from the same snapshot
gives the same answers, which is the property that makes a reported figure
checkable rather than merely plausible.
"""
from __future__ import annotations

from pathlib import Path
from typing import TYPE_CHECKING

from .schema import SNAPSHOT_TABLES, columns_clause

if TYPE_CHECKING:  # pragma: no cover - typing only
    import duckdb


class SnapshotError(RuntimeError):
    """A snapshot is missing a table, or holds one this schema cannot read."""


def _source_for(snapshot_dir: Path, table: str) -> tuple[Path, str]:
    """Locate one table's file. Parquet is preferred; CSV is the interchange."""
    parquet = snapshot_dir / f"{table}.parquet"
    if parquet.is_file():
        return parquet, "parquet"
    csv = snapshot_dir / f"{table}.csv"
    if csv.is_file():
        return csv, "csv"
    raise SnapshotError(
        f"snapshot is missing `{table}`: expected {table}.parquet or "
        f"{table}.csv in {snapshot_dir}"
    )


# The derived layer. Kept as views rather than materialised tables so there is
# exactly one definition of each derived fact and no copy able to drift.
#
# `actual_outcome` is NULL for anything not completed. That is deliberate and
# load-bearing: a fixture without a result has no outcome, and treating it as
# one would silently grade forecasts against a scoreline that does not exist.
DERIVED_VIEWS: dict[str, str] = {
    "graded_forecasts": """
        select
            f.forecast_id,
            f.fixture_id,
            f.model_id,
            m.league,
            m.family,
            m.version,
            fx.season,
            fx.kickoff_utc,
            f.prob_home,
            f.prob_draw,
            f.prob_away,
            case
                when fx.home_goals is null or fx.away_goals is null then null
                when fx.status <> 'completed' then null
                when fx.home_goals > fx.away_goals then 'home'
                when fx.home_goals < fx.away_goals then 'away'
                else 'draw'
            end as actual_outcome,
            case
                when fx.home_goals is null or fx.away_goals is null then null
                when fx.status <> 'completed' then null
                when fx.home_goals > fx.away_goals then f.prob_home
                when fx.home_goals < fx.away_goals then f.prob_away
                else f.prob_draw
            end as prob_actual
        from forecasts f
        join models m on m.model_id = f.model_id
        join fixtures fx on fx.fixture_id = f.fixture_id
    """,
    # Log loss and Brier per graded forecast. Both are NULL where the fixture
    # is not graded, so every aggregate below inherits honest nulls instead of
    # averaging in a zero.
    "forecast_scores": """
        select
            g.*,
            case
                when g.prob_actual is null then null
                -- Clamped away from 0 so a confident miss is a large finite
                -- penalty rather than an infinity that poisons every average
                -- it touches.
                else -ln(greatest(g.prob_actual, 1e-15))
            end as log_loss,
            case
                when g.actual_outcome is null then null
                else
                    pow(g.prob_home - (case when g.actual_outcome = 'home' then 1 else 0 end), 2)
                  + pow(g.prob_draw - (case when g.actual_outcome = 'draw' then 1 else 0 end), 2)
                  + pow(g.prob_away - (case when g.actual_outcome = 'away' then 1 else 0 end), 2)
            end as brier,
            case
                when g.actual_outcome is null then null
                when greatest(g.prob_home, g.prob_draw, g.prob_away) = g.prob_home
                    then g.actual_outcome = 'home'
                when greatest(g.prob_home, g.prob_draw, g.prob_away) = g.prob_away
                    then g.actual_outcome = 'away'
                else g.actual_outcome = 'draw'
            end as top_pick_correct
        from graded_forecasts g
    """,
    # Best available prematch price per fixture and selection.
    "best_prematch_price": """
        select
            fixture_id,
            selection,
            max(price) as price
        from market_prices
        where phase = 'prematch'
        group by fixture_id, selection
    """,
    # A recommendation joined to its forecast and settlement. The settlement
    # join is LEFT: an advised bet that has not settled stays visible with NULL
    # figures rather than disappearing from the population.
    "advised_bets": """
        select
            r.recommendation_id,
            r.decision,
            r.reason_code,
            r.selection,
            r.edge,
            r.price,
            r.stake_units,
            g.league,
            g.family,
            g.kickoff_utc,
            s.outcome,
            s.profit_units,
            s.closing_price,
            s.clv
        from recommendations r
        join graded_forecasts g on g.forecast_id = r.forecast_id
        left join bet_settlements s
            on s.recommendation_id = r.recommendation_id
    """,
}


def build_analytics_database(
    snapshot_dir: Path | str,
    database: str = ":memory:",
) -> "duckdb.DuckDBPyConnection":
    """Load a snapshot directory into a fresh DuckDB and define the views.

    `database` defaults to an in-memory instance, which is what tests and most
    ad-hoc analysis want. Pass a path to keep one on disk for repeated queries.
    """
    import duckdb

    directory = Path(snapshot_dir)
    if not directory.is_dir():
        raise SnapshotError(f"no snapshot directory at {directory}")

    connection = duckdb.connect(database)

    for table in SNAPSHOT_TABLES:
        source, kind = _source_for(directory, table)
        if kind == "parquet":
            reader = "read_parquet(?)"
        else:
            # `columns=` is built from SNAPSHOT_TABLES, a constant in this
            # package, so no caller input is interpolated. The filename stays a
            # bound parameter.
            reader = (
                f"read_csv(?, header = true, columns = {columns_clause(table)})"
            )
        # CREATE TABLE ... AS SELECT rather than an INSERT: one statement, no
        # partially-populated intermediate state, and nothing that reads like a
        # write against a Postgres relation.
        connection.execute(
            f'create table "{table}" as select * from {reader}', [str(source)]
        )

    for name, definition in DERIVED_VIEWS.items():
        connection.execute(f'create view "{name}" as {definition}')

    return connection
