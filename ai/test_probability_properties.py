"""Property checks for probability boundaries shared by training and scoring."""
from __future__ import annotations

import numpy as np
from hypothesis import given, settings, strategies as st

import calibration
import confidence


probability_vectors = st.lists(
    st.floats(min_value=0.0, max_value=1.0, allow_nan=False, allow_infinity=False),
    min_size=3,
    max_size=3,
)


@settings(max_examples=150, deadline=None)
@given(probability_vectors)
def test_probability_cleaning_always_returns_a_finite_simplex(values):
    cleaned = calibration._clean(values)

    assert cleaned.shape == (1, 3)
    assert np.isfinite(cleaned).all()
    assert (cleaned > 0).all()
    np.testing.assert_allclose(cleaned.sum(axis=1), [1.0], rtol=0, atol=1e-12)


@settings(max_examples=120, deadline=None)
@given(probability_vectors)
def test_cleaning_is_idempotent(values):
    once = calibration._clean(values)
    twice = calibration._clean(once)

    np.testing.assert_allclose(twice, once, rtol=0, atol=1e-12)


@settings(max_examples=120, deadline=None)
@given(probability_vectors)
def test_uncertainty_intervals_are_bounded_and_contain_the_point(values):
    result = confidence.probability_uncertainty(values, fold_error=0.03, n_calibration=200)

    for outcome in confidence.OUTCOMES:
        point = result["point"][outcome]
        lower, upper = result["interval"][outcome]
        assert 0.0 <= lower <= point <= upper <= 1.0
