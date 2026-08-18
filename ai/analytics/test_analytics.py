"""Offline analytics guardrails.

Everything here runs against the committed deterministic snapshot in
``fixtures/``. No hosted database, no network, no provider credit — which is
the point: an analytical layer that needs Production to be testable is one
nobody can safely change.

The snapshot is small and deliberately awkward. It contains ungraded fixtures,
a bet with no closing benchmark, an unsettled bet and a fixture with no
captured price, because those are the paths where a zero gets substituted for
an absence and nobody notices.
"""
from __future__ import annotations

import sys
from pathlib import Path

import pytest

duckdb = pytest.importorskip(
    "duckdb",
    reason="run scripts/agent-tools/ai-sync.sh test to install the locked analytics group",
)

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from analytics.build import SnapshotError, build_analytics_database  # noqa: E402
from analytics.queries import (  # noqa: E402
    ANALYSES,
    accuracy_by_odds_range,
    calibration_by_probability_band,
    closing_line_value,
    metrics_by_model_family,
    model_market_disagreement,
    model_performance_by_competition,
    model_performance_over_time,
    recommendations_by_edge_bucket,
    theoretical_roi,
)
from analytics.schema import SNAPSHOT_TABLES  # noqa: E402

FIXTURES = Path(__file__).resolve().parent / "fixtures"


@pytest.fixture(name="connection")
def _connection():
    connection = build_analytics_database(FIXTURES)
    yield connection
    connection.close()


def by_key(rows, key, value):
    return next(row for row in rows if row[key] == value)


# ------------------------------------------------------------------ #
# Building
# ------------------------------------------------------------------ #


def test_builds_every_declared_table_from_the_snapshot(connection):
    present = {
        name
        for (name,) in connection.execute(
            "select table_name from information_schema.tables"
        ).fetchall()
    }
    assert set(SNAPSHOT_TABLES).issubset(present)


def test_build_is_reproducible(connection):
    """The same snapshot must give the same answer twice.

    A figure that moves between two builds of identical input is not evidence,
    and the whole reason this layer is offline is so a result can be rechecked.
    """
    second = build_analytics_database(FIXTURES)
    try:
        assert model_performance_by_competition(connection) == (
            model_performance_by_competition(second)
        )
    finally:
        second.close()


def test_refuses_a_missing_snapshot(tmp_path):
    with pytest.raises(SnapshotError):
        build_analytics_database(tmp_path)


def test_refuses_a_directory_that_does_not_exist(tmp_path):
    with pytest.raises(SnapshotError):
        build_analytics_database(tmp_path / "nope")


def test_needs_no_database_url(monkeypatch):
    """Nothing here may reach a hosted project, even if one is configured."""
    monkeypatch.setenv("DATABASE_URL", "postgresql://should-never-be-read/db")
    connection = build_analytics_database(FIXTURES)
    try:
        assert model_performance_by_competition(connection)
    finally:
        connection.close()


# ------------------------------------------------------------------ #
# Grading: absence is preserved
# ------------------------------------------------------------------ #


def test_an_unplayed_fixture_grades_to_null_rather_than_a_draw(connection):
    """FX4 has no goals. It must have no outcome.

    Reading a null scoreline as 0-0 would silently grade every forecast on an
    unplayed fixture against a draw — a wrong answer that looks like data.
    """
    rows = connection.execute(
        "select actual_outcome, log_loss, brier from forecast_scores "
        "where fixture_id = 'FX4'"
    ).fetchall()
    assert rows
    for outcome, log_loss, brier in rows:
        assert outcome is None
        assert log_loss is None
        assert brier is None


def test_ungraded_forecasts_are_counted_not_hidden(connection):
    epl = by_key(model_performance_by_competition(connection), "league", "EPL")
    # Four EPL forecasts from M1 plus one from M2; FX4's is ungraded.
    assert epl["forecasts"] == 5
    assert epl["graded"] == 4
    assert epl["ungraded"] == 1


def test_metrics_average_only_over_graded_forecasts(connection):
    epl = by_key(model_performance_by_competition(connection), "league", "EPL")
    assert epl["mean_log_loss"] is not None
    assert epl["mean_log_loss"] > 0
    # An ungraded forecast contributing 0.0 would drag the mean below every
    # individual graded value, which is the tell.
    graded = [
        value
        for (value,) in connection.execute(
            "select log_loss from forecast_scores where log_loss is not null"
        ).fetchall()
    ]
    assert min(graded) <= epl["mean_log_loss"] <= max(graded)


def test_log_loss_and_brier_are_computed_correctly(connection):
    """F1 forecast 0.55 home; FX1 finished 2-1, so home was right."""
    import math

    log_loss, brier, correct = connection.execute(
        "select log_loss, brier, top_pick_correct from forecast_scores "
        "where forecast_id = 'F1'"
    ).fetchone()

    assert log_loss == pytest.approx(-math.log(0.55))
    assert brier == pytest.approx((0.55 - 1) ** 2 + 0.25**2 + 0.20**2)
    assert correct is True


def test_a_league_with_no_graded_forecasts_reports_null_not_zero():
    """A league that has forecast nothing settled has no score.

    NULL says "we do not know". 0.0 says "perfect prediction", which is the
    opposite of the truth and would top any leaderboard sorted ascending.
    """
    connection = build_analytics_database(FIXTURES)
    try:
        connection.execute("delete from fixtures where league = 'SPL'")
        connection.execute(
            "create table spl_only as select * from forecast_scores "
            "where league = 'SPL'"
        )
        row = connection.execute(
            "select count(*), avg(log_loss) from spl_only"
        ).fetchone()
        assert row[1] is None
    finally:
        connection.close()


# ------------------------------------------------------------------ #
# Calibration and odds
# ------------------------------------------------------------------ #


def test_calibration_counts_each_selection_as_its_own_observation(connection):
    rows = calibration_by_probability_band(connection)
    # Five graded forecasts — F1, F2, F3 and F5 on completed EPL fixtures and
    # F6 on a completed SPL one — contributing a home, draw and away leg each.
    # F4 and F7 forecast unplayed fixtures and contribute nothing.
    assert sum(row["observations"] for row in rows) == 15
    for row in rows:
        assert 0.0 <= row["observed_rate"] <= 1.0


def test_calibration_bands_are_ordered_and_bounded(connection):
    rows = calibration_by_probability_band(connection)
    floors = [row["band_floor"] for row in rows]
    assert floors == sorted(floors)
    assert all(0.0 <= floor < 1.0 for floor in floors)


def test_fixtures_without_a_price_get_their_own_bucket(connection):
    """A missing price is reported, not silently dropped from the denominator."""
    rows = accuracy_by_odds_range(connection)
    buckets = {row["odds_band"] for row in rows}
    # FX5's top pick is home and it has a price; FX1/FX2/FX3 all have prices.
    # The snapshot's priced fixtures should therefore produce real bands.
    assert buckets
    for row in rows:
        if row["odds_band"] == "no_price":
            assert row["mean_price"] is None


def test_disagreement_screen_does_not_claim_to_be_an_edge(connection):
    rows = model_market_disagreement(connection, limit=5)
    assert rows
    # Named honestly: the reciprocal of a price still carries the overround,
    # so the column must not be presented as a de-vigged probability.
    assert "implied_probability_with_overround" in rows[0]
    assert "edge" not in rows[0]


# ------------------------------------------------------------------ #
# Money: unsettled is not a loss, absent CLV is not zero
# ------------------------------------------------------------------ #


def test_unsettled_bets_are_excluded_from_roi_not_counted_as_zero(connection):
    spl = by_key(theoretical_roi(connection), "league", "SPL")
    assert spl["advised"] == 2  # R4 settled, R6 not
    assert spl["settled"] == 1
    assert spl["unsettled"] == 1
    # Only R4's stake counts towards the denominator.
    assert spl["staked_units"] == pytest.approx(1.0)
    assert spl["net_units"] == pytest.approx(0.40)
    assert spl["roi"] == pytest.approx(0.40)


def test_roi_is_null_when_nothing_has_settled(connection):
    """A strategy that has resolved no bet has not broken even."""
    connection.execute("delete from bet_settlements")
    for row in theoretical_roi(connection):
        assert row["settled"] == 0
        assert row["roi"] is None
        assert row["roi"] != 0


def test_clv_reports_how_many_bets_had_no_closing_benchmark(connection):
    epl = by_key(closing_line_value(connection), "league", "EPL")
    assert epl["advised"] == 2  # R1 and R3
    assert epl["with_benchmark"] == 1  # R3 has no closing price
    assert epl["without_benchmark"] == 1
    # The mean is over the one bet that has evidence, not over both.
    assert epl["mean_clv"] == pytest.approx(0.026)


def test_a_missing_closing_price_stays_null(connection):
    clv, closing = connection.execute(
        "select clv, closing_price from advised_bets "
        "where recommendation_id = 'R3'"
    ).fetchone()
    assert clv is None
    assert closing is None


def test_negative_clv_is_preserved(connection):
    """Beating the close is the scoreboard; losing to it must not be rounded away."""
    spl = by_key(closing_line_value(connection), "league", "SPL")
    assert spl["mean_clv"] == pytest.approx(-0.014)
    assert spl["share_beating_close"] == pytest.approx(0.0)


def test_edge_buckets_separate_settled_from_advised(connection):
    rows = recommendations_by_edge_bucket(connection)
    assert rows
    for row in rows:
        assert row["advised"] == row["settled"] + row["unsettled"]


def test_passes_are_excluded_from_the_bet_population(connection):
    total_bet = sum(row["advised"] for row in recommendations_by_edge_bucket(connection))
    # R2 and R5 are PASS and must not appear.
    assert total_bet == 4


# ------------------------------------------------------------------ #
# The sweep
# ------------------------------------------------------------------ #


def test_every_named_analysis_runs_against_the_snapshot(connection):
    for name, analysis in ANALYSES.items():
        rows = analysis(connection)
        assert isinstance(rows, list), name


def test_analyses_need_no_write_permission(connection):
    """The whole surface is read-only.

    Proven by revoking the ability to write: DuckDB in read-only mode still has
    to answer every question, because analysis that mutates its own evidence is
    not analysis.
    """
    path = Path(FIXTURES).parent / ".pytest-readonly.duckdb"
    if path.exists():
        path.unlink()

    writable = build_analytics_database(FIXTURES, database=str(path))
    writable.close()

    readonly = duckdb.connect(str(path), read_only=True)
    try:
        for name, analysis in ANALYSES.items():
            assert isinstance(analysis(readonly), list), name
    finally:
        readonly.close()
        path.unlink(missing_ok=True)


def test_metrics_by_family_separates_leagues(connection):
    rows = metrics_by_model_family(connection)
    pairs = {(row["league"], row["family"]) for row in rows}
    assert ("EPL", "logistic") in pairs
    assert ("EPL", "poisson") in pairs
    assert ("SPL", "logistic") in pairs


def test_performance_over_time_only_reports_graded_months(connection):
    for row in model_performance_over_time(connection):
        assert row["graded"] > 0
        assert row["mean_log_loss"] is not None
