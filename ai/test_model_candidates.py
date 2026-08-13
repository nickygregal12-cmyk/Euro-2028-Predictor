"""The GBM diagnosis, pinned as tests rather than left as a paragraph.

Three separate things are held here, because three separate things were found
and each can silently come back:

  1. The feature block contains NO missing values, on any league, so the
     native-missingness property `GradientBoostedModel` was chosen for is
     never exercised by default. This is the fact the docstring got wrong.

  2. `reconstruct_missing` is the opt-in that makes the claim testable, and it
     must blank a neutral prior WITHOUT destroying the coverage flag beside it
     or touching a partially covered window.

  3. The predeclared grid is predeclared: the incumbent is in it, every
     candidate states a hypothesis, and the names are unique. A grid that grew
     after the results were seen is the failure this whole module exists to
     prevent, and the cheap half of preventing it is refusing to let a
     candidate be added without a stated mechanism.
"""
from __future__ import annotations

import numpy as np
import pandas as pd
import pytest

import model_candidates
from features import (ALL_FEATURE_NAMES, DEFAULT_GROUPS, FeatureBuilder,
                      NEUTRAL_FILLED_BY_FLAG, NEUTRAL_FILLED_DIFFS,
                      feature_names,
                      reconstruct_missing)
from model_zoo import GradientBoostedModel
from test_models import synthetic_history


@pytest.fixture(scope="module")
def complete_frame() -> pd.DataFrame:
    return FeatureBuilder("E0").build_training_frame(synthetic_history(seasons=6))


@pytest.fixture(scope="module")
def statless_frame() -> pd.DataFrame:
    """A National-League-shaped file: no shots, no shots on target, no corners.

    `ai.raw_matches` really does look like this — measured on Production on
    13 August 2026, division EC carries 7,518 rows of which only 2,220 have a
    shot count. This is the case the GBM's missingness handling was for.
    """
    history = synthetic_history(seasons=6)
    for column in ("home_shots", "away_shots", "home_shots_ot", "away_shots_ot",
                   "home_corners", "away_corners"):
        history[column] = None
    return FeatureBuilder("E0").build_training_frame(history)


# ---------------------------------------------------------------------------
# 1. The claim that was not true
# ---------------------------------------------------------------------------

def test_feature_block_has_no_missing_values_even_without_source_stats(
        complete_frame, statless_frame):
    """The neutral priors are the ONLY representation, not a fallback.

    If this ever fails, someone has made the feature builder emit NaN — which
    would be a real improvement, and would change what EVERY model sees. It is
    a `FEATURES_VERSION` bump and a measurement, not a tidy-up, so the test
    fails loudly rather than quietly agreeing.
    """
    for frame in (complete_frame, statless_frame):
        block = frame[ALL_FEATURE_NAMES]
        missing = block.isna().sum()
        assert int(missing.sum()) == 0, (
            f"feature block now contains NaN in {list(missing[missing > 0].index)}; "
            "the GBM's native-missingness branch is no longer inert and every "
            "model's inputs have changed")


def test_absent_stats_become_a_neutral_prior_with_a_zero_coverage_flag(
        statless_frame):
    """The mechanism behind the previous test, stated directly."""
    assert (statless_frame["home_sot_known"] == 0.0).all()
    assert (statless_frame["home_corners_known"] == 0.0).all()
    # A single constant, not a spread of real measurements.
    assert statless_frame["home_form5_sot_f"].nunique() == 1
    assert statless_frame["home_corners_f"].nunique() == 1


# ---------------------------------------------------------------------------
# 2. The opt-in that makes it testable
# ---------------------------------------------------------------------------

def test_reconstruct_missing_blanks_neutral_priors_where_nothing_was_measured(
        statless_frame):
    rebuilt = reconstruct_missing(statless_frame)
    assert rebuilt["home_form5_sot_f"].isna().all()
    assert rebuilt["home_corners_f"].isna().all()
    assert rebuilt["home_goals_per_sot"].isna().all()
    # A difference column needs BOTH sides measured.
    assert rebuilt["corners_diff"].isna().all()


def test_reconstruct_missing_keeps_the_coverage_flags_themselves(statless_frame):
    """The flag is a real measurement about the data and must survive.

    Blanking it too would confound "the tree received NaN" with "the tree lost
    its coverage signal", and the candidate would then be measuring two
    changes at once.
    """
    rebuilt = reconstruct_missing(statless_frame)
    for flag in ("home_sot_known", "away_sot_known",
                 "home_corners_known", "away_corners_known"):
        assert rebuilt[flag].notna().all()
        assert (rebuilt[flag] == 0.0).all()


def test_reconstruct_missing_changes_only_rows_with_a_zero_coverage_flag(
        complete_frame):
    """In a fully measured league, reconstruction is not a no-op — and the
    reason is worth knowing before reading any ablation result.

    A league that records shots in every fixture still produces rows whose
    coverage flag is zero: a club's FIRST match has an empty form window, so
    `sot_known` is 0 because the window is empty, not because the league
    records nothing. `native_missing` therefore does two things at once — it
    marks a stat the competition never records, and it marks a club with no
    history yet — and only the first was the stated motivation.

    So the property held here is the exact one: a cell changes if and only if
    its own coverage flag is zero. Anything wider would mean reconstruction
    was destroying measurements.
    """
    rebuilt = reconstruct_missing(complete_frame)

    changed_any = False
    for flag, columns in NEUTRAL_FILLED_BY_FLAG.items():
        real_flag = flag.replace("_conversion", "")
        blank = complete_frame[real_flag] == 0.0
        for column in columns:
            # Every blanked cell is a zero-coverage cell...
            assert rebuilt.loc[~blank, column].notna().all(), (
                f"{column} was blanked where {real_flag} was non-zero; "
                "reconstruction is discarding real measurements")
            # ...and every zero-coverage cell is blanked.
            assert rebuilt.loc[blank, column].isna().all()
            changed_any = changed_any or bool(blank.any())

    assert changed_any, (
        "no zero-coverage rows at all in this fixture, so the test proved "
        "nothing; the synthetic history no longer contains a club's first match")


def test_reconstruct_missing_touches_nothing_outside_the_declared_columns(
        complete_frame):
    """Core Elo, form and rest columns are never neutral priors."""
    rebuilt = reconstruct_missing(complete_frame)
    declared = {c for columns in NEUTRAL_FILLED_BY_FLAG.values() for c in columns}
    declared |= set(NEUTRAL_FILLED_DIFFS)
    untouched = [c for c in ALL_FEATURE_NAMES if c not in declared]
    pd.testing.assert_frame_equal(rebuilt[untouched], complete_frame[untouched])


def test_reconstruct_missing_does_not_blank_a_partially_covered_window():
    """A half-covered window holds a real, noisy mean. Blanking it would throw
    away a measurement rather than mark an absence."""
    frame = pd.DataFrame({
        "home_sot_known": [0.0, 0.4, 1.0],
        "away_sot_known": [1.0, 1.0, 1.0],
        "home_form5_sot_f": [4.5, 3.9, 5.2],
        "away_form5_sot_f": [4.1, 4.2, 4.3],
        "sot_f_diff": [0.4, -0.3, 0.9],
    })
    rebuilt = reconstruct_missing(frame)
    assert np.isnan(rebuilt["home_form5_sot_f"][0])
    assert rebuilt["home_form5_sot_f"][1] == 3.9
    assert rebuilt["home_form5_sot_f"][2] == 5.2
    # The diff is blanked only on the row where a side is wholly unmeasured.
    assert np.isnan(rebuilt["sot_f_diff"][0])
    assert rebuilt["sot_f_diff"][1] == -0.3


def test_gbm_native_missing_actually_reaches_the_estimator(statless_frame):
    """The option must change what is fitted, not merely be accepted."""
    columns = feature_names(DEFAULT_GROUPS)
    frame = statless_frame[
        statless_frame["home_matches_known"] + statless_frame["away_matches_known"] >= 6]
    plain = GradientBoostedModel(max_iter=20, native_missing=False)
    native = GradientBoostedModel(max_iter=20, native_missing=True)
    prepared_plain = plain._prepare(frame[columns])
    prepared_native = native._prepare(frame[columns])
    assert not np.isnan(prepared_plain).any()
    assert np.isnan(prepared_native).any()


def test_gbm_native_missing_fits_and_predicts_a_valid_distribution(statless_frame):
    columns = feature_names(DEFAULT_GROUPS)
    frame = statless_frame[
        statless_frame["home_matches_known"] + statless_frame["away_matches_known"] >= 6]
    model = GradientBoostedModel(max_iter=30, native_missing=True)
    model.fit(frame[columns], frame["result"])
    probs = model.predict_proba(frame[columns])
    assert probs.shape == (len(frame), 3)
    assert np.allclose(probs.sum(axis=1), 1.0)
    assert (probs > 0).all()


def test_gbm_native_missing_drops_columns_that_are_missing_in_every_row(
        statless_frame):
    """The National League case, by name.

    Without this the estimator dies inside its own binner with a message that
    names no column and no league. The dropped names are recorded so a
    surprising ablation result can be explained rather than guessed at.
    """
    columns = feature_names(DEFAULT_GROUPS)
    frame = statless_frame[
        statless_frame["home_matches_known"] + statless_frame["away_matches_known"] >= 6]
    model = GradientBoostedModel(max_iter=20, native_missing=True)
    model.fit(frame[columns], frame["result"])

    assert "home_form5_sot_f" in model.dropped_all_missing_
    assert "home_corners_f" in model.dropped_all_missing_
    # The coverage flags survive: they are constant here, but they are real.
    assert "home_sot_known" in model.feature_names_
    assert not set(model.dropped_all_missing_) & set(model.feature_names_)


def test_gbm_without_native_missing_drops_nothing(complete_frame):
    columns = feature_names(DEFAULT_GROUPS)
    frame = complete_frame[
        complete_frame["home_matches_known"] + complete_frame["away_matches_known"] >= 6]
    model = GradientBoostedModel(max_iter=20).fit(frame[columns], frame["result"])
    assert model.dropped_all_missing_ == []
    assert model.feature_names_ == list(columns)


def test_gbm_contributions_do_not_double_apply_the_missingness_transform(
        statless_frame):
    """Re-entering `predict_proba` would blank a swapped-in median again."""
    columns = feature_names(("core",))
    frame = statless_frame[
        statless_frame["home_matches_known"] + statless_frame["away_matches_known"] >= 6]
    model = GradientBoostedModel(max_iter=20, native_missing=True)
    model.fit(frame[columns], frame["result"])
    rows = model.contributions(frame[columns].head(2), top_n=3)
    assert len(rows) == 2
    for row in rows:
        for entry in row:
            assert np.isfinite(entry["delta_home"])
            assert entry["method"] == "occlusion_vs_training_median"


# ---------------------------------------------------------------------------
# 3. The grid is predeclared
# ---------------------------------------------------------------------------

def test_the_shipped_configuration_is_the_declared_baseline():
    """Without the incumbent in the grid the deltas are unanchored."""
    names = [c.name for c in model_candidates.GBM_CANDIDATES]
    assert model_candidates.GBM_BASELINE in names
    shipped = model_candidates.candidate_by_name(model_candidates.GBM_BASELINE)
    # Pinned against the real constructor defaults, so the "baseline" cannot
    # drift away from what is actually shipped without this failing.
    import inspect
    defaults = {
        name: parameter.default
        for name, parameter in inspect.signature(
            GradientBoostedModel.__init__).parameters.items()
        if parameter.default is not inspect.Parameter.empty
    }
    for key, value in shipped.model_kwargs.items():
        assert defaults[key] == value, (
            f"declared baseline {key}={value} no longer matches the shipped "
            f"default {defaults[key]}")


def test_every_candidate_states_a_hypothesis_and_has_a_unique_name():
    names = [c.name for c in model_candidates.GBM_CANDIDATES]
    assert len(names) == len(set(names))
    for candidate in model_candidates.GBM_CANDIDATES:
        assert len(candidate.hypothesis) > 40, (
            f"{candidate.name} has no stated mechanism; a candidate that "
            "cannot say what it would prove does not belong in the grid")


def test_the_grid_stays_small():
    """A bounded diagnostic, not a hyperparameter search.

    The number is deliberately a hard ceiling rather than a guideline: the
    request that produced this module said "do NOT launch a giant
    hyperparameter search" and "do NOT select a configuration after looking
    across hundreds of trials", and a limit in prose is not a limit.
    """
    assert len(model_candidates.GBM_CANDIDATES) <= 12


def test_candidate_kwargs_are_accepted_by_the_model_they_configure():
    """A typo in a declared candidate should fail here, not in a six-hour run."""
    import inspect
    allowed = set(inspect.signature(GradientBoostedModel.__init__).parameters)
    for candidate in model_candidates.GBM_CANDIDATES:
        unknown = set(candidate.model_kwargs) - allowed
        assert not unknown, f"{candidate.name} passes unknown kwargs {unknown}"


def test_logistic_is_a_declared_base_model_competitor():
    """It is excluded from the ensemble on an argument, never on a measurement."""
    assert "logistic" in model_candidates.BASE_MODEL_FAMILIES
    from model_zoo import ENSEMBLE_BASE_FAMILIES
    assert "logistic" not in ENSEMBLE_BASE_FAMILIES
