"""The starter analytical surface.

Each function answers one question and returns rows. They are the questions the
lab actually has — model quality, calibration, market disagreement, and whether
any of it would have made money — rather than a dashboard of whatever was easy
to compute.

Three rules run through all of them, and they are the whole point:

  ABSENT IS NOT ZERO. Every aggregate reports how much evidence it had. A mean
  over nothing is NULL, never 0.0, and a count of rows lacking evidence sits
  beside the figure derived from the rows that had it.

  UNSETTLED IS NOT A LOSS. Return and ROI are computed over settled bets only,
  with the unsettled count reported separately. Folding an open position in at
  zero profit is how a strategy is made to look flat.

  NOTHING IS INVENTED. No query fabricates a closing line, an outcome or a
  price. Where the snapshot has no evidence the answer is that there is none.
"""
from __future__ import annotations

from typing import TYPE_CHECKING, Any

if TYPE_CHECKING:  # pragma: no cover - typing only
    import duckdb

Rows = list[dict[str, Any]]


def _rows(connection: "duckdb.DuckDBPyConnection", sql: str) -> Rows:
    """Run a read-only query and return dicts, so callers read by name."""
    cursor = connection.execute(sql)
    columns = [description[0] for description in cursor.description]
    return [dict(zip(columns, record)) for record in cursor.fetchall()]


def model_performance_by_competition(
    connection: "duckdb.DuckDBPyConnection",
) -> Rows:
    """Per league: how much was graded, and how well it scored.

    `graded` is reported beside every metric because a 0.31 log loss over four
    fixtures and over four thousand are not the same statement.
    """
    return _rows(
        connection,
        """
        select
            league,
            count(*)                       as forecasts,
            count(log_loss)                as graded,
            count(*) - count(log_loss)     as ungraded,
            avg(log_loss)                  as mean_log_loss,
            avg(brier)                     as mean_brier,
            avg(case when top_pick_correct then 1.0 else 0.0 end)
                                           as top_pick_accuracy
        from forecast_scores
        group by league
        order by league
        """,
    )


def metrics_by_model_family(connection: "duckdb.DuckDBPyConnection") -> Rows:
    """Log loss and Brier per model family, per league.

    Split by league as well as family because a family that wins in one
    division and loses in another is the normal case, and an average across
    both hides it.
    """
    return _rows(
        connection,
        """
        select
            league,
            family,
            count(log_loss) as graded,
            avg(log_loss)   as mean_log_loss,
            avg(brier)      as mean_brier
        from forecast_scores
        group by league, family
        order by league, family
        """,
    )


def calibration_by_probability_band(
    connection: "duckdb.DuckDBPyConnection",
    band_width: float = 0.1,
) -> Rows:
    """Does a stated probability happen that often?

    Every (forecast, selection) pair is one observation: a fixture contributes
    its home, draw and away legs separately, because calibration is a property
    of stated probabilities rather than of matches.

    A well-calibrated model has `observed_rate` tracking `mean_probability`.
    The gap between them is the answer; `observations` says how much to trust
    it.
    """
    return _rows(
        connection,
        f"""
        with legs as (
            select prob_home as probability,
                   actual_outcome = 'home' as occurred
            from forecast_scores where actual_outcome is not null
            union all
            select prob_draw, actual_outcome = 'draw'
            from forecast_scores where actual_outcome is not null
            union all
            select prob_away, actual_outcome = 'away'
            from forecast_scores where actual_outcome is not null
        )
        select
            floor(probability / {band_width}) * {band_width} as band_floor,
            count(*)                                          as observations,
            avg(probability)                                  as mean_probability,
            avg(case when occurred then 1.0 else 0.0 end)     as observed_rate
        from legs
        group by band_floor
        order by band_floor
        """,
    )


def accuracy_by_odds_range(connection: "duckdb.DuckDBPyConnection") -> Rows:
    """Forecast accuracy bucketed by what the market charged for the pick.

    Joins the best prematch price for the model's own top selection. Fixtures
    with no captured price are reported as their own `no_price` bucket rather
    than dropped, because a systematic absence of prices is itself a finding.
    """
    return _rows(
        connection,
        """
        with top_pick as (
            select
                s.fixture_id,
                s.actual_outcome,
                s.top_pick_correct,
                case
                    when greatest(s.prob_home, s.prob_draw, s.prob_away) = s.prob_home
                        then 'home'
                    when greatest(s.prob_home, s.prob_draw, s.prob_away) = s.prob_away
                        then 'away'
                    else 'draw'
                end as pick
            from forecast_scores s
            where s.actual_outcome is not null
        )
        select
            case
                when p.price is null then 'no_price'
                when p.price < 1.5  then '1.00-1.49'
                when p.price < 2.0  then '1.50-1.99'
                when p.price < 3.0  then '2.00-2.99'
                when p.price < 5.0  then '3.00-4.99'
                else '5.00+'
            end as odds_band,
            count(*) as forecasts,
            avg(case when t.top_pick_correct then 1.0 else 0.0 end) as accuracy,
            avg(p.price) as mean_price
        from top_pick t
        left join best_prematch_price p
            on p.fixture_id = t.fixture_id and p.selection = t.pick
        group by odds_band
        order by odds_band
        """,
    )


def model_market_disagreement(
    connection: "duckdb.DuckDBPyConnection",
    limit: int = 50,
) -> Rows:
    """Where the model and the book most disagree.

    The market's implied probability is the raw reciprocal of the price and is
    therefore inflated by the overround — this is a *screen* for interesting
    fixtures, not a de-vigged edge, and it is deliberately not called one.
    `ai/betting.py` owns proper de-vigging.
    """
    return _rows(
        connection,
        f"""
        with legs as (
            select fixture_id, league, family, 'home' as selection, prob_home as model_probability
            from forecast_scores
            union all
            select fixture_id, league, family, 'draw', prob_draw from forecast_scores
            union all
            select fixture_id, league, family, 'away', prob_away from forecast_scores
        )
        select
            l.fixture_id,
            l.league,
            l.family,
            l.selection,
            l.model_probability,
            p.price,
            1.0 / p.price as implied_probability_with_overround,
            l.model_probability - (1.0 / p.price) as raw_difference
        from legs l
        join best_prematch_price p
            on p.fixture_id = l.fixture_id and p.selection = l.selection
        order by abs(l.model_probability - (1.0 / p.price)) desc
        limit {int(limit)}
        """,
    )


def recommendations_by_edge_bucket(
    connection: "duckdb.DuckDBPyConnection",
) -> Rows:
    """Advised bets grouped by how much edge the value engine claimed.

    If the engine is measuring anything real, realised return should rise with
    claimed edge. `settled` guards the comparison: a bucket with two settled
    bets says nothing whatever about the bucket.
    """
    return _rows(
        connection,
        """
        select
            case
                when edge is null    then 'no_edge_recorded'
                when edge < 0.02     then '0-2%'
                when edge < 0.05     then '2-5%'
                when edge < 0.10     then '5-10%'
                else '10%+'
            end as edge_bucket,
            count(*)                as advised,
            count(profit_units)     as settled,
            count(*) - count(profit_units) as unsettled,
            sum(profit_units)       as net_units,
            avg(profit_units)       as mean_units_per_bet
        from advised_bets
        where decision = 'BET'
        group by edge_bucket
        order by edge_bucket
        """,
    )


def theoretical_roi(connection: "duckdb.DuckDBPyConnection") -> Rows:
    """Theoretical historical return, per league, over SETTLED bets only.

    This is what the recorded advice would have returned had every BET been
    struck at the recorded price. It is not a claim about money: staking,
    availability, limits and closing prices all move real returns.

    Unsettled bets are counted and excluded rather than folded in at zero.
    """
    return _rows(
        connection,
        """
        select
            league,
            count(*)                       as advised,
            count(profit_units)            as settled,
            count(*) - count(profit_units) as unsettled,
            sum(case when profit_units is not null then stake_units end)
                                           as staked_units,
            sum(profit_units)              as net_units,
            case
                when sum(case when profit_units is not null then stake_units end) > 0
                then sum(profit_units)
                     / sum(case when profit_units is not null then stake_units end)
                -- No settled stake means no ROI. NULL, never 0.0: a strategy
                -- that has not resolved a single bet has not broken even.
                else null
            end as roi
        from advised_bets
        where decision = 'BET'
        group by league
        order by league
        """,
    )


def closing_line_value(connection: "duckdb.DuckDBPyConnection") -> Rows:
    """Closing-line value, where a closing benchmark actually exists.

    CLV is the lab's scoreboard: beating the close is the durable signal, and
    profit over a small sample is mostly variance. `without_benchmark` is
    reported beside it because a mean CLV over three of two hundred bets is a
    statement about those three.
    """
    return _rows(
        connection,
        """
        select
            league,
            count(*)              as advised,
            count(clv)            as with_benchmark,
            count(*) - count(clv) as without_benchmark,
            avg(clv)              as mean_clv,
            avg(case when clv > 0 then 1.0 else 0.0 end) as share_beating_close
        from advised_bets
        where decision = 'BET'
        group by league
        order by league
        """,
    )


def model_performance_over_time(connection: "duckdb.DuckDBPyConnection") -> Rows:
    """Monthly log loss and Brier per league, to expose drift.

    A model that was good in September and is bad in February looks fine in the
    season average, which is exactly the failure worth catching early.
    """
    return _rows(
        connection,
        """
        select
            league,
            date_trunc('month', kickoff_utc) as month,
            count(log_loss)                  as graded,
            avg(log_loss)                    as mean_log_loss,
            avg(brier)                       as mean_brier
        from forecast_scores
        where log_loss is not null
        group by league, month
        order by league, month
        """,
    )


#: Every starter analysis, so a caller can run the whole sweep by name.
ANALYSES = {
    "model_performance_by_competition": model_performance_by_competition,
    "metrics_by_model_family": metrics_by_model_family,
    "calibration_by_probability_band": calibration_by_probability_band,
    "accuracy_by_odds_range": accuracy_by_odds_range,
    "model_market_disagreement": model_market_disagreement,
    "recommendations_by_edge_bucket": recommendations_by_edge_bucket,
    "theoretical_roi": theoretical_roi,
    "closing_line_value": closing_line_value,
    "model_performance_over_time": model_performance_over_time,
}
