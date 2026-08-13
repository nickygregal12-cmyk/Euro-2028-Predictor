"""The Over/Under 2.5 benchmark, held to the design it declared.

Every assertion here exists because the corresponding mistake is the standard
way a market benchmark flatters itself:

  * de-vigging a mean of several books' prices, or an aggregate, instead of
    one book's own pair;
  * treating `MAX` — a best-of across books, whose two sides routinely sum to
    less than 100% — as if it were a bookmaker;
  * calling a prematch archive closing-line value, which is a different and
    much stronger claim about a dataset that does not contain it.

The de-vig and the scoring are pure functions and are tested as such. The
study itself needs a database and is asserted at the source level, which is
the honest boundary: a test that mocked the archive would prove that the mock
was de-vigged correctly.
"""
from __future__ import annotations

import inspect
import re
from pathlib import Path

import numpy as np
import pytest

import experiments


SOURCE = Path(experiments.__file__).read_text()


# ---------------------------------------------------------------------------
# The de-vig
# ---------------------------------------------------------------------------

def test_devig_removes_the_overround_and_sums_to_one():
    p_over, overround = experiments._devig_two_way([2.00], [2.00])
    assert p_over[0] == pytest.approx(0.5)
    assert overround[0] == pytest.approx(1.0)


def test_devig_is_proportional_and_reports_the_margin():
    # 1.90 / 1.90 is the classic two-way price: 5.26% overround, evens after.
    p_over, overround = experiments._devig_two_way([1.90], [1.90])
    assert p_over[0] == pytest.approx(0.5)
    assert overround[0] == pytest.approx(1.0526, abs=1e-4)

    # An asymmetric pair keeps its shape: the shorter side stays the favourite.
    p_over, overround = experiments._devig_two_way([1.50], [2.50])
    assert p_over[0] == pytest.approx((1 / 1.5) / (1 / 1.5 + 1 / 2.5))
    assert p_over[0] > 0.5
    assert overround[0] > 1.0


def test_devig_of_a_pair_and_its_mirror_sum_to_one():
    over, under = [1.72], [2.15]
    p_over, _ = experiments._devig_two_way(over, under)
    p_under, _ = experiments._devig_two_way(under, over)
    assert p_over[0] + p_under[0] == pytest.approx(1.0)


def test_devigging_an_averaged_price_is_not_the_same_number():
    """The mistake the design forbids, shown to be a real difference.

    Two books, 1.60/2.40 and 2.00/1.80. De-vigged per book and averaged in
    probability space is one number; averaging the odds first and de-vigging
    the mean is another. If these agreed the rule would be cosmetic.
    """
    per_book = np.mean([
        experiments._devig_two_way([1.60], [2.40])[0][0],
        experiments._devig_two_way([2.00], [1.80])[0][0],
    ])
    averaged_first = experiments._devig_two_way(
        [(1.60 + 2.00) / 2], [(2.40 + 1.80) / 2])[0][0]
    assert per_book != pytest.approx(averaged_first, abs=1e-4)


# ---------------------------------------------------------------------------
# The scoring
# ---------------------------------------------------------------------------

def test_binary_scores_on_a_perfect_forecast():
    scores = experiments._binary_scores([1.0, 0.0, 1.0], [1, 0, 1])
    assert scores["log_loss"] == pytest.approx(0.0, abs=1e-8)
    assert scores["brier"] == pytest.approx(0.0, abs=1e-8)
    assert scores["ece"] == pytest.approx(0.0, abs=1e-8)
    assert scores["n"] == 3


def test_binary_scores_on_a_coin():
    scores = experiments._binary_scores([0.5] * 4, [1, 0, 1, 0])
    assert scores["log_loss"] == pytest.approx(np.log(2))
    assert scores["brier"] == pytest.approx(0.25)
    assert scores["ece"] == pytest.approx(0.0, abs=1e-8)


def test_calibration_error_sees_a_biased_forecast():
    """A forecast that says 90% and is right half the time is 40 points out."""
    scores = experiments._binary_scores([0.9] * 10, [1] * 5 + [0] * 5)
    assert scores["ece"] == pytest.approx(0.4, abs=1e-8)


def test_binary_scores_never_divides_by_a_certainty_that_was_wrong():
    scores = experiments._binary_scores([1.0], [0])
    assert np.isfinite(scores["log_loss"])


# ---------------------------------------------------------------------------
# The declared design, asserted against the source
# ---------------------------------------------------------------------------

def test_aggregates_are_named_and_excluded():
    assert set(experiments.AGGREGATE_PRICE_SOURCES) == {"AVG", "MAX"}
    body = inspect.getsource(experiments.study_market_ou)
    assert "AGGREGATE_PRICE_SOURCES" in body
    assert "~prices[\"bookmaker\"].isin(AGGREGATE_PRICE_SOURCES)" in body


def test_the_study_de_vigs_through_the_helper_rather_than_inline():
    """One de-vig, in one place. An inline second copy is how two parts of a
    study end up disagreeing about what a fair price is."""
    body = inspect.getsource(experiments.study_market_ou)
    assert "_devig_two_way(" in body
    # No second, hand-rolled reciprocal-sum anywhere in the study body.
    assert not re.search(r"1\.0\s*/\s*real\[", body)


def test_the_archive_is_not_called_clv():
    """`phase` is 'pre' for every retained row and no closing price exists for
    this market, so the stronger claim must not appear."""
    body = inspect.getsource(experiments.study_market_ou)
    assert "\"phase\": \"pre\"" in body
    assert "\"is_clv\": False" in body
    loader = inspect.getsource(experiments._load_ou_prices)
    assert "p.phase = 'pre'" in loader
    assert "close_" not in loader


def test_the_market_is_the_2_5_line_only():
    loader = inspect.getsource(experiments._load_ou_prices)
    assert "p.market = 'OU'" in loader
    assert "p.line = 2.5" in loader


def test_the_study_reads_and_never_writes():
    body = inspect.getsource(experiments.study_market_ou)
    for forbidden in ("insert", "update ", "delete", "commit"):
        assert forbidden not in body.lower(), forbidden


def test_the_model_probability_comes_off_the_shipped_grid():
    """Not a second goal model. The benchmark is only worth reading if it
    scores the same distribution the 1X2 forecast is read from."""
    body = inspect.getsource(experiments.study_market_ou)
    assert "scoreline_grid(" in body
    assert "fit_family(\"poisson\"" in body
    assert "totals >= 3" in body


def test_the_over_mask_is_built_from_the_grid_rather_than_a_constant():
    body = inspect.getsource(experiments.study_market_ou)
    assert "grid.shape[1]" in body
    # Comments stripped: the prose is allowed to explain why MAX_GOALS is not
    # read, and asserting against the prose would fail on its own explanation.
    code = "\n".join(line.split("#")[0] for line in body.splitlines())
    assert "MAX_GOALS" not in code


def test_the_disagreement_buckets_are_the_declared_four():
    body = inspect.getsource(experiments.study_market_ou)
    for label in ("\"<5pp\"", "\"5-10pp\"", "\"10-15pp\"", "\">15pp\""):
        assert label in body


def test_every_hypothesis_declares_the_column_that_would_support_it():
    assert len(experiments.MARKET_OU_HYPOTHESES) == 5
    for identifier, statement, column in experiments.MARKET_OU_HYPOTHESES:
        assert identifier and statement and column
        assert identifier[0] == "B"


def test_the_study_is_registered_and_dispatchable():
    assert "market-ou" in experiments.STUDIES
    assert experiments.STUDY_FUNCTIONS["market-ou"] is experiments.study_market_ou


def test_the_benchmark_recommends_no_promotion():
    body = inspect.getsource(experiments.study_market_ou)
    assert "promotes nothing" in body
    for forbidden in ("promote_model", "ENSEMBLE_BASE_FAMILIES",
                      "DEFAULT_HALF_LIFE_DAYS"):
        assert forbidden not in body


def test_the_ledger_entry_refuses_to_invent_a_paired_standard_error():
    """The two probabilities come from different generating processes. A
    standard error on their difference would read like a paired experiment."""
    entry = re.search(r'if study == "market-ou":(.*?)if study == "gbm-diagnostic"',
                      SOURCE, re.S)
    assert entry, "the market-ou ledger branch is missing"
    assert '"se_delta": None' in entry.group(1)
    assert '"beats_noise": False' in entry.group(1)
