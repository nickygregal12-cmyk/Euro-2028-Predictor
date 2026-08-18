"""The two training stages, and mutation tests for the guards that matter.

A guard nobody has broken on purpose is a guard nobody knows the shape of. The
tests at the bottom of this file deliberately reintroduce a defect — fit a
calibrator on in-sample predictions, restore the old rating transition, feed a
model a neutral value in place of a feature it was trained on — and assert that
the consequence is visible. If a future change makes one of those mutations
harmless, the corresponding guard has stopped doing anything and this file
should fail rather than the lab quietly getting worse.
"""
from __future__ import annotations

import re
from datetime import date
from pathlib import Path

import numpy as np
import pandas as pd
import pytest

import calibration
import ensemble
import metrics
import train
from features import FeatureBuilder, TeamState, division_prior, feature_names
from fitting import fit_family
from test_models import synthetic_history

COLUMNS = feature_names(("core",))


# One archive, generated once. Every dataset below is a PREFIX of it, which is
# what makes "adding later seasons" a real nesting rather than two unrelated
# random draws — a comparison of two independent samples would fail the
# no-future-leakage test for reasons that have nothing to do with leakage.
_HISTORY = synthetic_history(seasons=9, start_year=2016)
_SEASONS = sorted(_HISTORY["season"].unique())


def _frame(seasons: int = 8) -> pd.DataFrame:
    """Feature rows built from the first `seasons` seasons of the archive."""
    history = _HISTORY[_HISTORY["season"].isin(_SEASONS[:seasons])]
    built = FeatureBuilder("E0").build_training_frame(history)
    built = built[built["home_matches_known"] + built["away_matches_known"] >= 6]
    return built.reset_index(drop=True)


# ---------------------------------------------------------------------------
# Stage separation
# ---------------------------------------------------------------------------

def test_the_final_fit_sees_matches_the_evaluation_fit_never_saw():
    """The defect: the artefact promoted to production was the evaluation fit.

    It had been kept away from the newest two seasons on purpose — that is
    what made its metrics honest — and was then serialised and deployed, so
    the model forecasting next Saturday had never seen the last two seasons in
    the archive.
    """
    frame = _frame()
    train_part, val_part, val_seasons = train.chronological_split(frame, 2)

    assert len(frame) > len(train_part), "the split is not holding anything back"
    assert set(val_part["season"]) == set(val_seasons)
    assert train_part["match_date"].max() < val_part["match_date"].min()

    column_map = {"poisson": COLUMNS}
    final, _ = train.fit_final_challenger(
        frame, "poisson", column_map, 0.0, ("poisson",), "equal_blend", 4)
    evaluation = fit_family("poisson", train_part, COLUMNS, 0.0)

    probe = frame.tail(40)
    assert not np.allclose(final.predict_proba(probe[COLUMNS]),
                           evaluation.predict_proba(probe[COLUMNS])), (
        "the final artefact is indistinguishable from the evaluation fit, so "
        "the newest seasons never reached the model that ships")


def test_the_newest_completed_match_changes_the_artefact():
    """Weekly learning, stated as a property: last Saturday must matter."""
    base = _frame()
    column_map = {"poisson": COLUMNS}
    before, _ = train.fit_final_challenger(
        base, "poisson", column_map, 0.0, ("poisson",), "equal_blend", 4)

    extended = _frame(seasons=9)
    after, _ = train.fit_final_challenger(
        extended, "poisson", column_map, 0.0, ("poisson",), "equal_blend", 4)

    probe = base.tail(40)
    assert not np.allclose(before.predict_proba(probe[COLUMNS]),
                           after.predict_proba(probe[COLUMNS])), (
        "adding a season of completed matches did not change the artefact")


def test_a_later_season_cannot_change_an_earlier_validation_fold():
    """The other half: newer data reaches the artefact and NOT the history.

    Fold scores for seasons present in both datasets must be identical to the
    last decimal. If they are not, a fold is seeing something that came after
    it, and every metric in the training report is worth nothing.
    """
    short = _frame(seasons=7)
    long = _frame(seasons=9)

    def fold_scores(frame: pd.DataFrame) -> dict[str, float]:
        out = {}
        for fold in ensemble.expanding_season_folds(frame, min_train_seasons=4):
            tr, te = frame.iloc[fold.train_index], frame.iloc[fold.test_index]
            model = fit_family("poisson", tr, COLUMNS, 0.0)
            out[fold.season] = metrics.summarise(
                model.predict_proba(te[COLUMNS]), te["result"].values)["log_loss"]
        return out

    a, b = fold_scores(short), fold_scores(long)
    shared = set(a) & set(b)
    assert shared, "the two datasets share no fold, so nothing is being compared"
    for season in shared:
        assert abs(a[season] - b[season]) < 1e-12, (
            f"fold {season} moved when later seasons were added — it saw the future")


def test_the_column_map_gives_prices_only_to_the_market_family():
    columns = feature_names(("core",))
    mapping = train.column_map_for({"poisson", "elo", "gbm", "market"}, columns)
    for family in ("poisson", "elo", "gbm"):
        assert mapping[family] == columns
        assert not any(c.startswith(("mkt_", "odds_", "close_")) for c in mapping[family])
    assert any(c.startswith("mkt_") for c in mapping["market"]), (
        "the market-informed family was given no market data at all")


def test_walk_forward_reports_a_standard_error_per_league_configuration():
    frame = _frame()
    result = train.walk_forward(frame, "poisson", COLUMNS, min_train_seasons=4,
                                half_life_days=0.0)
    assert result and result["folds"]
    assert np.isfinite(result["se_log_loss"]), (
        "a mean without a standard error is how a lab keeps the luckiest "
        "feature rather than the best one")
    assert all(f["n"] > 0 for f in result["folds"])


# ---------------------------------------------------------------------------
# Source assertions: properties a unit test cannot observe from outside
# ---------------------------------------------------------------------------

def _source(name: str) -> str:
    return (Path(__file__).with_name(name)).read_text()


def test_the_calibrator_is_only_ever_fitted_from_out_of_fold_material():
    """A calibrator fitted on in-sample predictions makes a model WORSE.

    Not observable from outside: the wrong version produces a plausible
    calibrator and a good-looking report. So the property is asserted against
    the source — every `select_calibrator` / `.fit(` call in the training path
    must be handed something derived from `oof`.
    """
    source = _source("train.py")
    for call in re.finditer(r"(select_calibrator|CALIBRATORS\[[^\]]+\]\(\)\.fit)\(\s*([^,\)]+)",
                            source):
        argument = call.group(2).strip()
        assert "oof" in argument, (
            f"a calibrator is being fitted from {argument!r}, which is not "
            "out-of-fold material")
    assert "oof_probs" in source and "oof.actual" in source


def test_the_final_fit_happens_after_every_reported_number():
    """Ordering is the guarantee; a reordering would silently restore the bug."""
    source = _source("train.py")
    evaluate_at = source.index("report = evaluate_configuration(")
    final_at = source.index("final_model, oof = fit_final_challenger(")
    assert evaluate_at < final_at, (
        "the final fit runs before evaluation, so a reported metric could come "
        "from a model that has seen the rows it is scored on")


def test_predict_uses_the_artefacts_feature_list_and_not_the_current_default():
    source = _source("predict.py")
    assert "bundle.matrix(frame)" in source
    assert "from features import" in source
    assert not re.search(r"\[FEATURE_NAMES\]", source), (
        "predict.py is slicing by the source-code feature list again")


# ---------------------------------------------------------------------------
# Mutation tests: break the guard, prove the consequence is visible
# ---------------------------------------------------------------------------

def test_mutation_restoring_the_old_rating_transition_reintroduces_the_drift():
    """Break it on purpose: shrink toward 1500 and watch a League Two club climb."""
    start = division_prior("E3")

    def after(transition: str, seasons: int = 3) -> float:
        state = TeamState(elo=start, division="E3", season="1213")
        for i in range(seasons):
            state.roll_season(f"{13 + i}{14 + i}", transition)
        return state.elo

    mutated = after("global_mean")
    correct = after("division_prior")
    assert mutated - start > 200, (
        "the mutation did not reproduce the defect, so the test proves nothing")
    assert abs(correct - start) < 1e-9
    assert mutated > correct + 200


def test_mutation_substituting_a_neutral_value_for_a_missing_feature_changes_the_answer():
    """Why `matrix` refuses instead of filling in.

    A neutral substitute is not a small error: it is a confident claim that a
    club is exactly average at the thing nobody measured.
    """
    frame = _frame()
    model = fit_family("poisson", frame, COLUMNS, 0.0)
    probe = frame.tail(50).copy()
    honest = model.predict_proba(probe[COLUMNS])

    mutated = probe.copy()
    mutated["elo_diff"] = 0.0            # "neutral": the two clubs are level
    substituted = model.predict_proba(mutated[COLUMNS])
    assert not np.allclose(honest, substituted, atol=0.01), (
        "silently substituting a neutral Elo difference did not change the "
        "prediction, which would make the refusal in ModelBundle.matrix "
        "pointless")


def test_mutation_a_calibrator_fitted_in_sample_pushes_the_wrong_way():
    """The leak, demonstrated rather than described.

    In-sample predictions look under-confident to a calibrator, because the
    model was fitted to those very rows and gets them right more often than it
    will get anything right again. Temperature scaling responds by SHARPENING
    — making every live probability more extreme, which is the opposite of the
    correction the model actually needs.
    """
    # A boosted model, because the size of this leak is proportional to how
    # much the base model can memorise. A regularised Poisson regression barely
    # can, which is why the same demonstration on that family shows almost
    # nothing and would make a weak test.
    frame = _frame()
    model = fit_family("gbm", frame, COLUMNS, 0.0)

    in_sample = model.predict_proba(frame[COLUMNS])
    leaked = calibration.TemperatureCalibrator().fit(in_sample, frame["result"].values)

    oof = ensemble.out_of_fold(frame, {"gbm": COLUMNS}, ("gbm",), 0.0, 4)
    honest = calibration.TemperatureCalibrator().fit(oof.probs["gbm"], oof.actual)

    assert leaked.temperature < honest.temperature, (
        "fitting on in-sample predictions produced the same or a cooler "
        "temperature than fitting out-of-fold; the leak has stopped being "
        "detectable and this mutation test no longer proves anything")

    # And the consequence: the leaked calibrator, applied to honest
    # out-of-fold probabilities, scores worse than doing nothing.
    baseline = metrics.summarise(oof.probs["gbm"], oof.actual)["log_loss"]
    leaked_ll = metrics.summarise(leaked.transform(oof.probs["gbm"]),
                                  oof.actual)["log_loss"]
    assert leaked_ll >= baseline - 1e-6, (
        "a calibrator fitted on in-sample material improved out-of-fold log "
        "loss, which should not be possible")


def test_mutation_an_unpaired_comparison_hides_a_real_effect():
    """Why `ablate.compare` pairs its folds.

    The same differences, measured unpaired, carry a standard error several
    times wider — which is how a real improvement gets reported as noise, and
    is exactly what happened to the shot features the first time they were
    measured.
    """
    from ablate import compare

    seasons = [f"s{i}" for i in range(9)]
    rng = np.random.default_rng(11)
    level = rng.normal(1.00, 0.03, len(seasons))       # season-to-season noise
    baseline = {s: float(level[i]) for i, s in enumerate(seasons)}
    candidate = {s: float(level[i] - 0.004) for i, s in enumerate(seasons)}

    paired = compare(baseline, candidate)
    unpaired_se = float(np.std(list(candidate.values()), ddof=1)
                        / np.sqrt(len(seasons)))

    assert paired["beats_noise"], "the paired test could not see a real 0.004 effect"
    assert unpaired_se > 5 * paired["se_delta"], (
        "pairing is no longer tightening the error bar")


# ---------------------------------------------------------------------------
# Model provenance: the row and the bytes must describe the same model
# ---------------------------------------------------------------------------

def _bundle(family: str = "poisson", uses_market: bool = False):
    """A real fitted bundle, so provenance is read off the artefact."""
    from artifacts import ARTIFACT_SCHEMA, ModelBundle
    from market_features import MARKET_FEATURE_NAMES, build_market_block

    frame = _frame(8)
    columns = list(COLUMNS)
    if uses_market:
        # A price that existed before the match, and nothing that did not.
        rng = np.random.default_rng(4)
        frame = frame.copy()
        frame["odds_avg_h"] = rng.uniform(1.6, 4.0, len(frame))
        frame["odds_avg_d"] = rng.uniform(3.0, 4.5, len(frame))
        frame["odds_avg_a"] = rng.uniform(1.8, 6.0, len(frame))
        frame = pd.concat([frame, build_market_block(frame)], axis=1)
        columns = columns + list(MARKET_FEATURE_NAMES)
    model = fit_family(family, frame, columns, 900.0)
    return ModelBundle(
        model=model, features=columns, features_version="test",
        feature_groups=("core",) if not uses_market else ("core", "market"),
        family=family, league="EPL", version="prov",
        half_life_days=900.0, elo_transition="division_mean", calibrator=None,
        components={}, trained_through=pd.to_datetime(frame["match_date"].max()).date(),
        schema=ARTIFACT_SCHEMA, metadata={}), frame, columns


def _record_for(bundle, frame, columns, uses_market: bool) -> dict:
    return {
        "league": "EPL", "version": "prov", "family": bundle.family,
        "training_matches": len(frame),
        "eval_training_matches": len(frame) - 100,
        "final_trained_through": bundle.trained_through,
        "features_used": columns,
        "features_version": bundle.features_version,
        "feature_groups": list(bundle.feature_groups),
        "half_life_days": round(float(bundle.half_life_days), 2),
        "elo_transition": bundle.elo_transition,
        "calibration_method": "identity",
        "component_families": None,
        "meta_model": None,
        "uses_market": uses_market,
        "status": "challenger",
    }


def test_the_provenance_check_accepts_a_row_that_matches_its_artefact():
    bundle, frame, columns = _bundle()
    train.assert_provenance_agrees(_record_for(bundle, frame, columns, False), bundle)


def test_a_market_model_stored_as_pure_football_is_refused():
    """The specific failure the ten new columns were added to prevent.

    `uses_market` has a `not null default false`, so a caller that simply does
    not mention it stores a market-informed model as a pure football one — and
    every later question, "is my football model adding information over the
    market?" chief among them, is answered from the row.
    """
    bundle, frame, columns = _bundle("market", uses_market=True)
    assert bundle.model.uses_market is True
    record = _record_for(bundle, frame, columns, uses_market=False)
    with pytest.raises(train.ProvenanceMismatch, match="uses_market"):
        train.assert_provenance_agrees(record, bundle)


@pytest.mark.parametrize("field,wrong", [
    ("family", "elo"),
    ("features_version", "something-else"),
    ("feature_groups", ["core", "invented"]),
    ("half_life_days", 123.45),
    ("elo_transition", "global_mean"),
    ("final_trained_through", date(1999, 1, 1)),
])
def test_every_provenance_field_is_actually_compared(field, wrong):
    bundle, frame, columns = _bundle()
    record = _record_for(bundle, frame, columns, False)
    record[field] = wrong
    with pytest.raises(train.ProvenanceMismatch, match=field):
        train.assert_provenance_agrees(record, bundle)


# ---------------------------------------------------------------------------
# The market-informed model, scored live
# ---------------------------------------------------------------------------

def test_a_market_model_scores_a_live_frame_once_its_block_is_rebuilt():
    """Train market family -> store bundle -> recreate an as-of fixture -> score.

    Before this, `predict.py` built only the football feature frame and called
    `bundle.matrix(frame)`, so promoting a market family raised
    MissingFeatureError rather than producing a market-aware forecast. The
    family was trainable and not live-scorable.
    """
    from artifacts import MissingFeatureError, ModelBundle
    from market_features import build_market_block

    bundle, _frame_used, columns = _bundle("market", uses_market=True)
    payload = ModelBundle.from_payload(bundle.to_payload())

    live = _frame(8).iloc[[0]].copy().reset_index(drop=True)
    with pytest.raises(MissingFeatureError):
        payload.matrix(live)          # the state this branch shipped in

    live["odds_avg_h"] = 2.10
    live["odds_avg_d"] = 3.40
    live["odds_avg_a"] = 3.60
    block = build_market_block(live)
    for column in block.columns:
        live[column] = block[column].to_numpy()

    matrix = payload.matrix(live)
    probabilities = payload.model.predict_proba(matrix)
    assert probabilities.shape == (1, 3)
    assert probabilities.sum() == pytest.approx(1.0, abs=1e-6)
    assert float(block["mkt_known"].iloc[0]) == 1.0


def test_a_fixture_with_no_price_is_flagged_rather_than_given_a_neutral_one():
    """`mkt_known` is what stops "no price" being learned as "even game"."""
    from market_features import build_market_block

    live = _frame(8).iloc[[0]].copy().reset_index(drop=True)
    live["odds_avg_h"] = np.nan
    live["odds_avg_d"] = np.nan
    live["odds_avg_a"] = np.nan
    block = build_market_block(live)
    assert float(block["mkt_known"].iloc[0]) == 0.0
    assert float(block["mkt_p_home"].iloc[0]) == 0.44


def test_predict_refuses_a_market_model_with_no_price_at_the_snapshot():
    """Read the caller: the property lives in how predict.py wires it."""
    import inspect

    import predict

    source = inspect.getsource(predict.main)
    assert "load_market_snapshot" in source
    assert "uses_market" in source
    # Fails closed rather than scoring the neutral prior and calling it a
    # market-informed forecast.
    assert "carry no price at the snapshot instant" in source


def test_the_closing_line_can_never_become_a_market_feature():
    import market_features

    with pytest.raises(market_features.ClosingPriceLeak):
        market_features.build_market_block(
            pd.DataFrame({"close_avg_h": [2.0], "close_avg_d": [3.0],
                          "close_avg_a": [4.0]}))


def test_the_as_of_bound_is_in_the_query_rather_than_in_a_comment():
    """A price captured after `data_snapshot_at` cannot be selected at all."""
    import inspect

    import db

    source = inspect.getsource(db.load_market_snapshot)
    assert "mp.captured_at <= %s" in source
    # And the caller passes the snapshot instant rather than `now()`.
    import predict
    assert "load_market_snapshot([r[\"fixture_id\"] for r in rows],\n" in inspect.getsource(predict.main)
    assert "snapshot_at)" in inspect.getsource(predict.main)
