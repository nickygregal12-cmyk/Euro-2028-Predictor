"""Guardrails for the multi-model lab. Offline: no database, no network.

Each test here pins a property that, if it broke, would produce a model that
still trains, still prints metrics and is quietly wrong. That is the class of
failure this package keeps meeting — inert shot features, an ignored feature
list, a rating drifting upward every summer — and the only defence is a test
that fails when the guard is removed rather than a comment saying it matters.

The tests are grouped by what they protect:

    1. leakage           chronology, out-of-fold material, market prices
    2. rating transition division-aware Elo across promotions and relegations
    3. artefacts         a stored model gets the schema it was trained on
    4. calibration       fitted out-of-fold, bounded, and allowed to decline
    5. evidence          agreement, confidence and uncertainty are three things
    6. decisions         the value gate, its reason codes, the accumulator
    7. diagnosis         a loss is not automatically a failure
    8. package           every write still names schema `ai`
"""
from __future__ import annotations

from datetime import date, datetime, timedelta, timezone

import numpy as np
import pandas as pd
import pytest

import accumulator as accumulator_mod
import calibration
import confidence
import diagnose
import ensemble
import market_features
import metrics
import value_engine
from artifacts import ARTIFACT_SCHEMA, MissingFeatureError, ModelBundle
from features import (DEFAULT_GROUPS, ELO_START, FEATURE_GROUPS,
                      FEATURES_VERSION, FeatureBuilder, TeamState,
                      division_prior, feature_names)
from fitting import fit_family, time_weights
from model_zoo import (ENSEMBLE_ADMISSION, ENSEMBLE_BASE_FAMILIES,
                       MARKET_FAMILIES, MODEL_FAMILIES, PURE_FOOTBALL_FAMILIES,
                       PoissonModel)

RNG = np.random.default_rng(20280813)
OUTCOMES = ("H", "D", "A")


# ---------------------------------------------------------------------------
# Fixtures: a small synthetic league, enough seasons to fold over
# ---------------------------------------------------------------------------

def synthetic_history(seasons: int = 9, clubs: int = 14,
                      start_year: int = 2016, division: str = "E0") -> pd.DataFrame:
    names = [f"Club {chr(65 + i)}" for i in range(clubs)]
    attack = {c: RNG.normal(0, 0.30) for c in names}
    defence = {c: RNG.normal(0, 0.25) for c in names}
    rows = []
    for s in range(seasons):
        season = f"{(start_year + s) % 100:02d}{(start_year + s + 1) % 100:02d}"
        for c in names:
            attack[c] += RNG.normal(0, 0.08)
            defence[c] += RNG.normal(0, 0.07)
        kickoff = date(start_year + s, 8, 8)
        fixtures = [(h, a) for h in names for a in names if h != a]
        for r, (h, a) in enumerate(fixtures):
            when = kickoff + timedelta(days=3 * (r // 5))
            lh = np.exp(0.2 + 0.28 + attack[h] - defence[a])
            la = np.exp(0.2 + attack[a] - defence[h])
            hg, ag = int(RNG.poisson(lh)), int(RNG.poisson(la))
            rows.append({
                "match_date": when, "season": season, "division": division,
                "home_canonical": h, "away_canonical": a,
                "home_goals": hg, "away_goals": ag,
                "result": "H" if hg > ag else ("D" if hg == ag else "A"),
                "home_shots_ot": max(0, int(RNG.poisson(4 + 2 * lh))),
                "away_shots_ot": max(0, int(RNG.poisson(4 + 2 * la))),
                "home_shots": max(0, int(RNG.poisson(11 + 3 * lh))),
                "away_shots": max(0, int(RNG.poisson(11 + 3 * la))),
                "home_corners": max(0, int(RNG.poisson(5))),
                "away_corners": max(0, int(RNG.poisson(5))),
                "red_card_distorted": False,
            })
    return pd.DataFrame(rows).sort_values("match_date").reset_index(drop=True)


@pytest.fixture(scope="module")
def frame() -> pd.DataFrame:
    built = FeatureBuilder("E0").build_training_frame(synthetic_history())
    built = built[built["home_matches_known"] + built["away_matches_known"] >= 6]
    return built.reset_index(drop=True)


@pytest.fixture(scope="module")
def columns() -> list[str]:
    return feature_names(("core",))


# ---------------------------------------------------------------------------
# 1. Leakage
# ---------------------------------------------------------------------------

def test_folds_never_train_on_the_season_they_score(frame):
    """The foundation. Every other guarantee is built on this one."""
    for fold in ensemble.expanding_season_folds(frame, min_train_seasons=4):
        train_seasons = set(frame.iloc[fold.train_index]["season"])
        test_seasons = set(frame.iloc[fold.test_index]["season"])
        assert not (train_seasons & test_seasons)
        latest_train = frame.iloc[fold.train_index]["match_date"].max()
        earliest_test = frame.iloc[fold.test_index]["match_date"].min()
        assert latest_train < earliest_test, "a fold trained on a later match"


def test_out_of_fold_rows_are_never_scored_by_a_model_that_saw_them(frame, columns):
    """The stacker's entire honesty rests on this.

    Proved by construction AND by consequence: the out-of-fold probabilities
    must be materially worse than in-sample ones. A stacker fitted on
    in-sample base predictions learns which model memorised hardest, which is
    the failure this whole module exists to prevent.
    """
    column_map = {"poisson": columns, "elo": columns}
    oof = ensemble.out_of_fold(frame, column_map, ("poisson", "elo"),
                               half_life_days=0.0, min_train_seasons=4)
    assert len(oof) > 200
    assert set(oof.fold_labels) <= set(frame["season"])

    in_sample = fit_family("poisson", frame, columns, 0.0)
    rows = frame.iloc[oof.row_index]
    in_sample_ll = metrics.summarise(
        in_sample.predict_proba(rows[columns]), rows["result"].values)["log_loss"]
    oof_ll = metrics.summarise(oof.probs["poisson"], oof.actual)["log_loss"]
    assert oof_ll > in_sample_ll, (
        "out-of-fold predictions were no worse than in-sample ones, which "
        "means the fold boundary is not doing anything")


def test_same_day_matches_stay_blind_to_each_other():
    """Mutation guard: a builder that flushed per match rather than per date."""
    rows = [
        {"match_date": date(2026, 8, 1), "season": "2627", "division": "E0",
         "home_canonical": "Alpha", "away_canonical": "Beta",
         "home_goals": 5, "away_goals": 0, "result": "H"},
        {"match_date": date(2026, 8, 1), "season": "2627", "division": "E0",
         "home_canonical": "Alpha", "away_canonical": "Gamma",
         "home_goals": 4, "away_goals": 0, "result": "H"},
    ]
    out = FeatureBuilder("E0").build_training_frame(pd.DataFrame(rows))
    assert out.iloc[0]["elo_home"] == out.iloc[1]["elo_home"]
    assert out.iloc[1]["home_matches_known"] == 0


def test_the_market_block_refuses_closing_prices():
    """A model trained on closing lines beats every benchmark and cannot be bet."""
    frame = pd.DataFrame([{"odds_avg_h": 2.0, "odds_avg_d": 3.4, "odds_avg_a": 4.0,
                           "close_avg_h": 1.9}])
    with pytest.raises(market_features.ClosingPriceLeak):
        market_features.build_market_block(frame)
    with pytest.raises(market_features.ClosingPriceLeak):
        market_features.assert_no_closing_features(["mkt_home_closing"])


def test_the_pure_football_model_may_not_see_any_price():
    market_features.assert_pure(feature_names(DEFAULT_GROUPS))
    with pytest.raises(market_features.ClosingPriceLeak):
        market_features.assert_pure(["elo_diff", "mkt_p_home"])
    assert "market" in MARKET_FAMILIES
    assert MARKET_FAMILIES.isdisjoint(PURE_FOOTBALL_FAMILIES)
    for family in PURE_FOOTBALL_FAMILIES:
        assert not getattr(MODEL_FAMILIES[family], "uses_market", False)


def test_the_default_ensemble_is_the_earned_families_not_the_implemented_ones():
    """The default component set is a MEASUREMENT, not a census of the zoo.

    This is the defect the register was added to prevent. `gbm` sat in the
    default blend and the default stacker for its whole life without ever
    winning a paired fold, on the strength of a comment about structural
    diversity, while its own docstring said it entered an ensemble only by
    winning them. Nothing failed, because nothing checked: the tuple was hand
    written, so "registered" and "default" were one edit apart.
    """
    assert ENSEMBLE_BASE_FAMILIES == tuple(
        family for family, verdict in ENSEMBLE_ADMISSION.items() if verdict.earned
    )
    # The measured position of 13 August 2026. Changing it means changing the
    # register above it, which means writing down what beat what.
    assert ENSEMBLE_BASE_FAMILIES == ("poisson", "elo")
    for family in ENSEMBLE_BASE_FAMILIES:
        assert ENSEMBLE_ADMISSION[family].earned
        assert family in MODEL_FAMILIES


def test_every_registered_family_is_ruled_on_exactly_once():
    """Implementing a family must not be a way of joining the default set.

    A new family with no register entry fails here rather than being silently
    absent from the ensemble, and a register entry naming a family that no
    longer exists fails here rather than being silently ignored.
    """
    assert set(ENSEMBLE_ADMISSION) == set(MODEL_FAMILIES)
    for family, verdict in ENSEMBLE_ADMISSION.items():
        assert verdict.evidence.strip(), f"{family} has a verdict and no evidence"


def test_a_rejected_family_stays_implemented_and_reachable():
    """Rejection is a verdict on a default, never a deletion of the model.

    `gbm` and `logistic` lost the ensemble question and are kept: the evidence
    that rejected them is only re-checkable while the models still run.
    """
    for family in ("gbm", "logistic"):
        assert not ENSEMBLE_ADMISSION[family].earned
        assert family in MODEL_FAMILIES
        assert family in PURE_FOOTBALL_FAMILIES
        assert MODEL_FAMILIES[family] is not None


def test_the_default_ensemble_carries_no_market_family():
    """A default blend that saw a price would make every default market-informed."""
    assert MARKET_FAMILIES.isdisjoint(ENSEMBLE_BASE_FAMILIES)
    for family in MARKET_FAMILIES:
        assert not ENSEMBLE_ADMISSION[family].earned


def test_market_features_are_devigged_and_flag_their_own_absence():
    priced = pd.DataFrame([{"odds_avg_h": 2.0, "odds_avg_d": 3.5, "odds_avg_a": 4.2,
                            "odds_max_h": 2.1, "odds_max_d": 3.6, "odds_max_a": 4.4}])
    block = market_features.build_market_block(priced)
    total = float(block[["mkt_p_home", "mkt_p_draw", "mkt_p_away"]].sum(axis=1).iloc[0])
    assert abs(total - 1.0) < 1e-6, "de-vigged probabilities must sum to one"
    assert block["mkt_overround"].iloc[0] > 0
    assert block["mkt_known"].iloc[0] == 1.0
    assert block["mkt_dispersion"].iloc[0] > 0

    unpriced = market_features.build_market_block(
        pd.DataFrame([{"odds_avg_h": None, "odds_avg_d": None, "odds_avg_a": None}]))
    assert unpriced["mkt_known"].iloc[0] == 0.0


# ---------------------------------------------------------------------------
# 2. Division-aware Elo
# ---------------------------------------------------------------------------

def _roll(elo: float, division: str, seasons: int, transition: str) -> float:
    state = TeamState(elo=elo, division=division, season="1213")
    for i in range(seasons):
        state.roll_season(f"{13 + i}{14 + i}", transition)
    return state.elo


def test_a_settled_lower_division_club_does_not_drift_toward_the_top_flight():
    """The defect, pinned. Three summers used to be worth +230 rating points."""
    start = division_prior("E3")
    old = _roll(start, "E3", 3, "global_mean")
    new = _roll(start, "E3", 3, "division_prior")
    assert old > start + 200, "the old behaviour is not being reproduced"
    assert abs(new - start) < 1e-9, (
        "a club that stayed in its division moved anyway")


def test_promotion_does_not_hand_a_club_rating_points():
    """A change of division code is not a football result."""
    state = TeamState(elo=1400.0, division="E1", season="2526")
    state.roll_season("2627", "division_prior")
    assert state.elo < 1400.0, "promotion must not raise a rating"
    assert state.elo > division_prior("E1"), "it must not erase earned strength"
    assert state.previous_division == "E1"


def test_relegation_preserves_earned_strength():
    state = TeamState(elo=1420.0, division="E0", season="2526")
    state.roll_season("2627", "division_prior")
    assert state.elo > 1420.0, "a relegated club's earned rating was destroyed"
    assert state.elo < ELO_START


def test_a_first_seen_club_is_seeded_at_its_own_division_including_the_national_league():
    def first(division: str) -> float:
        df = pd.DataFrame([{
            "match_date": date(2026, 8, 1), "season": "2627", "division": division,
            "home_canonical": "New", "away_canonical": "Other",
            "home_goals": 1, "away_goals": 1, "result": "D"}])
        return FeatureBuilder(division).build_training_frame(df).iloc[0]["elo_home"]

    assert first("E0") == ELO_START
    assert first("E3") == ELO_START - 430.0
    # `EC` had no entry at all, so a National League club was seeded at the
    # Premier League's own anchor. EL2 trains on ("E3","E2","EC").
    assert first("EC") == ELO_START - 520.0
    assert first("SC3") == ELO_START - 400.0


def test_promotion_and_relegation_are_told_apart_across_both_pyramids():
    english = TeamState(division="E0", previous_division="E1")
    scottish = TeamState(division="SC0", previous_division="SC1")
    down = TeamState(division="E2", previous_division="E1")
    assert english.division_move() == 1
    assert scottish.division_move() == 1
    assert down.division_move() == -1
    assert TeamState(division="E1", previous_division="E1").division_move() == 0


def test_an_unknown_transition_is_refused_rather_than_ignored():
    with pytest.raises(ValueError):
        TeamState(division="E0").roll_season("2627", "regress_to_taste")
    with pytest.raises(ValueError):
        FeatureBuilder("E0", elo_transition="whatever")


# ---------------------------------------------------------------------------
# 3. Dixon-Coles weighting
# ---------------------------------------------------------------------------

def test_dixon_coles_rho_listens_to_the_decay():
    """Old low-scoring matches must count for less when decay is on.

    Built so the two eras disagree: the distant past is full of 0-0s and 1-1s,
    the recent past is not. An unweighted rho fit sees one archive and returns
    one number; a weighted one has to move toward the recent era.
    """
    rows = []
    for i in range(400):
        rows.append({"match_date": date(2015, 3, 1) + timedelta(days=i % 300),
                     "home_goals": 0 if i % 2 else 1, "away_goals": 0 if i % 3 else 1})
    for i in range(400):
        rows.append({"match_date": date(2026, 3, 1) + timedelta(days=i % 300),
                     "home_goals": 2 + i % 3, "away_goals": 1 + i % 2})
    df = pd.DataFrame(rows)
    X = pd.DataFrame({"const": np.linspace(-1, 1, len(df))})

    unweighted = PoissonModel().fit(X, pd.Series(["H"] * len(df)),
                                    home_goals=df["home_goals"],
                                    away_goals=df["away_goals"])
    weights = time_weights(df["match_date"], 365.0)
    weighted = PoissonModel().fit(X, pd.Series(["H"] * len(df)),
                                  home_goals=df["home_goals"],
                                  away_goals=df["away_goals"],
                                  sample_weight=weights)
    assert weighted.dc.rho != unweighted.dc.rho, (
        "rho was identical with and without decay, so the weights never "
        "reached the rho likelihood")

    equal = PoissonModel().fit(X, pd.Series(["H"] * len(df)),
                               home_goals=df["home_goals"],
                               away_goals=df["away_goals"],
                               sample_weight=np.ones(len(df)))
    assert equal.dc.rho == unweighted.dc.rho, (
        "uniform weights changed the fit, so the weighting is not neutral at "
        "half-life zero")


# ---------------------------------------------------------------------------
# 4. Artefacts
# ---------------------------------------------------------------------------

def _bundle(model, features) -> ModelBundle:
    return ModelBundle(model=model, features=list(features),
                       features_version=FEATURES_VERSION,
                       feature_groups=("core",), family="poisson",
                       league="TEST", version="v-test")


def test_an_artefact_scores_on_its_own_columns_after_the_defaults_change(frame, columns):
    """The defect: DEFAULT_GROUPS moves, the promoted model is fed new columns."""
    model = fit_family("poisson", frame, columns, 0.0)
    bundle = _bundle(model, columns)

    widened = frame.copy()
    widened["a_brand_new_feature"] = 1.234       # a later contract adds a family
    scored_before = bundle.predict_proba(frame)
    scored_after = bundle.predict_proba(widened)
    assert np.allclose(scored_before, scored_after), (
        "adding a feature the artefact never saw changed its predictions")

    matrix = bundle.matrix(widened)
    assert list(matrix.columns) == list(columns), "column order was not preserved"


def test_a_missing_feature_fails_loudly_and_is_never_substituted(frame, columns):
    model = fit_family("poisson", frame, columns, 0.0)
    bundle = _bundle(model, columns)
    narrowed = frame.drop(columns=[columns[0], columns[1]])
    with pytest.raises(MissingFeatureError) as exc:
        bundle.matrix(narrowed)
    message = str(exc.value)
    assert columns[0] in message and columns[1] in message, (
        "the failure must name the missing columns")
    assert "neutral" in message, (
        "the failure must say why a neutral substitute is refused")


def test_reordered_columns_are_restored_rather_than_trusted(frame, columns):
    model = fit_family("poisson", frame, columns, 0.0)
    bundle = _bundle(model, columns)
    shuffled = frame[list(reversed(columns))]
    assert np.allclose(bundle.predict_proba(frame), bundle.predict_proba(shuffled))


def test_a_bundle_without_a_feature_list_is_refused():
    with pytest.raises(ValueError):
        ModelBundle.from_payload({"model": object()})
    with pytest.raises(ValueError):
        ModelBundle.from_payload(object())


def test_a_legacy_two_key_bundle_still_loads(frame, columns):
    model = fit_family("poisson", frame, columns, 0.0)
    legacy = ModelBundle.from_payload({"model": model, "features": list(columns)})
    assert legacy.schema == 1 and legacy.features_version == "f1"
    assert legacy.predict_proba(frame).shape == (len(frame), 3)


def test_a_features_version_change_warns_without_refusing(frame, columns):
    bundle = _bundle(fit_family("poisson", frame, columns, 0.0), columns)
    assert bundle.features_version_warning(FEATURES_VERSION) is None
    warning = bundle.features_version_warning("f99")
    assert warning and "Retrain" in warning


def test_the_bundle_round_trips_through_its_payload(frame, columns):
    bundle = _bundle(fit_family("poisson", frame, columns, 0.0), columns)
    restored = ModelBundle.from_payload(bundle.to_payload())
    assert restored.features == bundle.features
    assert restored.schema == ARTIFACT_SCHEMA
    assert np.allclose(restored.predict_proba(frame), bundle.predict_proba(frame))


# ---------------------------------------------------------------------------
# 5. Independent models and the ensemble
# ---------------------------------------------------------------------------

def test_every_registered_family_produces_valid_probabilities(frame, columns):
    for family in ("baseline", "logistic", "poisson", "elo", "gbm"):
        model = fit_family(family, frame, columns, 0.0)
        probs = model.predict_proba(frame[columns])
        assert probs.shape == (len(frame), 3)
        assert np.all(probs >= 0) and np.all(probs <= 1)
        assert np.allclose(probs.sum(axis=1), 1.0, atol=1e-6), family


def test_the_elo_model_is_ordered_and_monotone(frame, columns):
    model = fit_family("elo", frame, columns, 0.0)
    grid = pd.DataFrame({"elo_diff": [-400.0, -100.0, 0.0, 100.0, 400.0]})
    probs = model.predict_proba(grid)
    assert np.all(np.diff(probs[:, 0]) > 0), "home probability must rise with Elo"
    assert np.all(np.diff(probs[:, 2]) < 0), "away probability must fall with Elo"
    assert probs[2, 1] > probs[0, 1] and probs[2, 1] > probs[4, 1], (
        "the draw must be likeliest in the middle; that is what an ordered "
        "model claims and what the Poisson model does not")


def test_the_elo_model_is_not_a_transformation_of_the_poisson_model(frame, columns):
    """Disagreement is only informative between models that can disagree."""
    poisson = fit_family("poisson", frame, columns, 0.0).predict_proba(frame[columns])
    elo = fit_family("elo", frame, columns, 0.0).predict_proba(frame[columns])
    correlation = float(np.corrcoef(poisson[:, 0], elo[:, 0])[0, 1])
    assert correlation < 0.995, "the two views are effectively the same model"
    assert np.abs(poisson - elo).max() > 0.05


def test_the_stacker_beats_nothing_it_has_seen_and_is_scored_out_of_time(frame, columns):
    column_map = {"poisson": columns, "elo": columns}
    oof = ensemble.out_of_fold(frame, column_map, ("poisson", "elo"), 0.0, 4)
    comparison = ensemble.evaluate_out_of_time(oof, "logistic_stack", min_fit_folds=2)
    assert "logistic_stack" in comparison and "equal_blend" in comparison
    for name in ("poisson", "elo", "equal_blend", "logistic_stack"):
        assert comparison[name]["folds"] >= 1
        assert np.isfinite(comparison[name]["mean_log_loss"])
    assert comparison["logistic_stack"]["vs_best_base"]["base"] in ("poisson", "elo")


def test_the_ensemble_keeps_the_scoreline_authority_with_the_goals_model(frame, columns):
    column_map = {"poisson": columns, "elo": columns}
    model, _ = ensemble.fit_ensemble(frame, column_map, ("poisson", "elo"),
                                     "equal_blend", 0.0, 4)
    grid = model.scoreline_grid(frame.head(3))
    assert grid.shape[0] == 3
    assert np.allclose(grid.sum(axis=(1, 2)), 1.0, atol=1e-6)

    poisson_only = model.models["poisson"].scoreline_grid(frame.head(3)[columns])
    assert np.allclose(grid, poisson_only), (
        "the grid must be the goals model's own, not reweighted to the "
        "ensemble's 1X2 — that would push 1X2 calibration into markets no "
        "calibrator has evidence for")


def test_the_ensemble_probabilities_are_valid_and_use_every_component(frame, columns):
    column_map = {"poisson": columns, "elo": columns}
    model, _ = ensemble.fit_ensemble(frame, column_map, ("poisson", "elo"),
                                     "logistic_stack", 0.0, 4)
    probs = model.predict_proba(frame.head(50))
    assert np.allclose(probs.sum(axis=1), 1.0, atol=1e-6)
    views = model.base_probabilities(frame.head(50))
    assert set(views) == {"poisson", "elo"}


# ---------------------------------------------------------------------------
# 6. Calibration
# ---------------------------------------------------------------------------

def test_temperature_calibration_corrects_overconfidence_and_is_bounded():
    """A model that says 90% and is right 70% of the time must be cooled."""
    n = 4000
    true_p = RNG.uniform(0.2, 0.8, n)
    actual = np.where(RNG.uniform(size=n) < true_p, "H", "A")
    # Over-confident: an exponent above one pushes probabilities away from the
    # truth, which is the direction a model that memorised its training set
    # fails in and the one temperature scaling has to undo.
    sharp = np.clip(true_p ** 2.5 / (true_p ** 2.5 + (1 - true_p) ** 2.5), 0.02, 0.98)
    probs = np.column_stack([sharp, np.full(n, 0.0) + 1e-6, 1 - sharp - 1e-6])

    cal = calibration.TemperatureCalibrator().fit(probs, actual)
    out = cal.transform(probs)
    assert cal.temperature > 1.0, "an over-confident model must be cooled"
    assert np.allclose(out.sum(axis=1), 1.0, atol=1e-9)
    assert np.all(out >= 0) and np.all(out <= 1)
    before = metrics.calibration_error(probs, actual)
    after = metrics.calibration_error(out, actual)
    assert after < before, "calibration made the calibration worse"


def test_the_calibrator_is_allowed_to_choose_to_do_nothing():
    """An already-calibrated model must not be 'improved'."""
    n = 3000
    p = RNG.uniform(0.25, 0.7, n)
    actual = np.where(RNG.uniform(size=n) < p, "H", "A")
    probs = np.column_stack([p, np.full(n, 1e-6), 1 - p - 1e-6])
    folds = np.array([f"s{i % 6}" for i in range(n)])
    chosen, choice = calibration.select_calibrator(probs, actual, folds)
    assert choice["chosen"] in ("identity", "temperature")
    if choice["chosen"] == "temperature":
        assert abs(chosen.temperature - 1.0) < 0.25


def test_a_calibrator_refuses_too_small_a_sample():
    probs = np.tile([0.5, 0.2, 0.3], (50, 1))
    actual = np.array(["H"] * 50)
    chosen, choice = calibration.select_calibrator(probs, actual)
    assert isinstance(chosen, calibration.IdentityCalibrator)
    assert "too few" in choice["reason"]
    with pytest.raises(ValueError):
        calibration.IsotonicCalibrator().fit(probs, actual)


def test_calibrated_probabilities_stay_probabilities():
    for calibrator in (calibration.IdentityCalibrator(),
                       calibration.TemperatureCalibrator(temperature=2.5),
                       calibration.TemperatureCalibrator(temperature=0.4)):
        out = calibrator.transform([[0.9, 0.05, 0.05], [0.2, 0.3, 0.5]])
        assert np.allclose(out.sum(axis=1), 1.0, atol=1e-9)
        assert np.all(out > 0)


# ---------------------------------------------------------------------------
# 7. Agreement, confidence, uncertainty — three different things
# ---------------------------------------------------------------------------

def test_model_agreement_separates_a_consensus_from_an_average():
    tight = confidence.model_agreement({
        "a": [[0.67, 0.20, 0.13]], "b": [[0.66, 0.21, 0.13]],
        "c": [[0.68, 0.19, 0.13]], "d": [[0.65, 0.22, 0.13]]})
    spread = confidence.model_agreement({
        "a": [[0.82, 0.10, 0.08]], "b": [[0.51, 0.25, 0.24]],
        "c": [[0.73, 0.15, 0.12]], "d": [[0.62, 0.21, 0.17]]})
    assert abs(np.mean([0.67, 0.66, 0.68, 0.65]) - np.mean([0.82, 0.51, 0.73, 0.62])) < 0.02
    assert tight["score"] > spread["score"], (
        "two sets with the same mean produced the same agreement")
    assert tight["state"] == "strong"
    assert spread["max_pairwise_tv"] > tight["max_pairwise_tv"]


def test_model_agreement_is_deterministic_and_needs_two_models():
    views = {"a": [[0.5, 0.3, 0.2]], "b": [[0.4, 0.35, 0.25]]}
    assert confidence.model_agreement(views) == confidence.model_agreement(views)
    single = confidence.model_agreement({"a": [[0.5, 0.3, 0.2]]})
    assert single["measurable"] is False


def test_disagreeing_on_the_pick_caps_the_agreement_score():
    conflicted = confidence.model_agreement({
        "a": [[0.40, 0.30, 0.30]], "b": [[0.30, 0.31, 0.39]]})
    assert conflicted["same_pick"] is False
    assert conflicted["score"] <= 0.45


def test_data_confidence_is_deterministic_and_separate_from_probability():
    strong = {"home_matches_known": 10, "away_matches_known": 10,
              "home_sot_known": 1.0, "away_sot_known": 1.0,
              "home_shots_known": 1.0, "away_shots_known": 1.0,
              "home_corners_known": 1.0, "away_corners_known": 1.0,
              "home_is_newcomer": 0.0, "away_is_newcomer": 0.0}
    weak = {"home_matches_known": 1, "away_matches_known": 2,
            "home_sot_known": 0.0, "away_sot_known": 0.0,
            "home_shots_known": 0.0, "away_shots_known": 0.0,
            "home_corners_known": 0.0, "away_corners_known": 0.0,
            "home_is_newcomer": 1.0, "away_is_newcomer": 1.0}
    evidence = {"graded_predictions": 600, "calibration_error": 0.01,
                "calibration_rows": 4000}

    high = confidence.data_confidence(strong, evidence)
    low = confidence.data_confidence(weak, {"graded_predictions": 0})
    assert high == confidence.data_confidence(strong, evidence), "not deterministic"
    assert high["score"] > low["score"]
    assert high["state"] in ("high", "medium")
    assert low["state"] in ("limited", "insufficient")
    assert {c["key"] for c in high["components"]} >= {
        "recent_form_sample", "underlying_stat_coverage", "league_track_record"}


def test_a_missing_required_input_forces_insufficient_data_confidence():
    result = confidence.data_confidence(
        {"home_matches_known": 10, "away_matches_known": 10},
        {"graded_predictions": 500, "calibration_error": 0.01},
        missing_inputs=["elo_diff"])
    assert result["state"] == "insufficient"
    assert result["missing_inputs"] == ["elo_diff"]


def test_uncertainty_widens_with_disagreement_and_narrows_with_evidence():
    agreed = confidence.probability_uncertainty(
        [[0.67, 0.20, 0.13]],
        {"a": [[0.67, 0.20, 0.13]], "b": [[0.66, 0.21, 0.13]]},
        fold_error=0.01, n_calibration=5000)
    split = confidence.probability_uncertainty(
        [[0.67, 0.20, 0.13]],
        {"a": [[0.82, 0.10, 0.08]], "b": [[0.51, 0.25, 0.24]]},
        fold_error=0.01, n_calibration=5000)
    assert split["max_width"] > agreed["max_width"]
    for band in agreed["interval"].values():
        assert 0.0 <= band[0] <= band[1] <= 1.0
    point = agreed["point"]["H"]
    lo, hi = agreed["interval"]["H"]
    assert lo <= point <= hi, "the interval must contain its own point estimate"


def test_a_wide_interval_is_flagged_for_the_value_gate():
    wide = confidence.probability_uncertainty(
        [[0.50, 0.25, 0.25]],
        {"a": [[0.80, 0.10, 0.10]], "b": [[0.20, 0.40, 0.40]]},
        fold_error=0.05, n_calibration=100)
    assert wide["wide"] is True


# ---------------------------------------------------------------------------
# 8. The value gate
# ---------------------------------------------------------------------------

def _candidate(**overrides) -> value_engine.Candidate:
    now = datetime.now(timezone.utc)
    base = dict(
        selection="H", calibrated_prob=0.55, odds=2.10, bookmaker="B365",
        hours_to_kickoff=30.0, captured_at=now - timedelta(minutes=20),
        market_fair_prob=0.50,
        data_confidence={"score": 0.8, "state": "high"},
        agreement={"measurable": True, "score": 0.8, "state": "strong"},
        uncertainty={"interval": {"H": [0.52, 0.58]}, "max_width": 0.06},
    )
    base.update(overrides)
    return value_engine.Candidate(**base)


@pytest.fixture
def value_test_bookmakers():
    """Value-gate examples declare their venue authority without a live DB."""
    value_engine.set_bookmaker_registry({
        "B365": {
            "code": "B365",
            "kind": "bookmaker",
            "is_real_price": True,
            "exchange_commission": None,
        },
        "MAX": {
            "code": "MAX",
            "kind": "aggregate",
            "is_real_price": False,
            "exchange_commission": None,
        },
    })
    yield
    value_engine.set_bookmaker_registry(None)


def test_a_good_candidate_becomes_a_bet_with_a_capped_stake(value_test_bookmakers):
    rec = value_engine.ValueGate().assess(_candidate())
    assert rec.decision == "BET" and rec.reason_codes == []
    assert 0 < rec.stake_fraction <= 0.02
    assert rec.evidence["expected_value"] > 0


@pytest.mark.parametrize("overrides, expected", [
    ({"odds": 1.60}, "PASS_LOW_EDGE"),
    ({"captured_at": datetime.now(timezone.utc) - timedelta(days=3)}, "PASS_STALE_PRICE"),
    ({"captured_at": None}, "PASS_STALE_PRICE"),
    ({"data_confidence": {"score": 0.3, "state": "limited"}}, "PASS_LOW_DATA"),
    ({"data_confidence": None}, "PASS_LOW_DATA"),
    ({"agreement": {"measurable": True, "score": 0.2, "state": "conflicted"}},
     "PASS_HIGH_MODEL_DISAGREEMENT"),
    ({"uncertainty": {"interval": {"H": [0.30, 0.80]}, "max_width": 0.50}},
     "PASS_WIDE_UNCERTAINTY"),
    ({"calibrated_prob": 0.80, "market_fair_prob": 0.40}, "PASS_MARKET_DISCREPANCY"),
    ({"market_fair_prob": None}, "PASS_NO_MARKET_REFERENCE"),
    ({"missing_inputs": ["elo_diff"]}, "PASS_INPUT_PENDING"),
    ({"calibrated_prob": 0.05, "odds": 7.0}, "PASS_LONGSHOT"),
    ({"odds": 12.0, "calibrated_prob": 0.2}, "PASS_ODDS_OUT_OF_RANGE"),
    ({"bookmaker": "MAX", "is_paper": False}, "PASS_UNBETTABLE_BOOK"),
])
def test_every_pass_reason_code_can_actually_fire(value_test_bookmakers, overrides, expected):
    rec = value_engine.ValueGate().assess(_candidate(**overrides))
    assert rec.decision == "PASS"
    assert expected in rec.reason_codes, rec.reason_codes
    assert expected in value_engine.REASON_CODES
    assert rec.stake_fraction == 0.0


def test_price_freshness_tightens_as_kickoff_approaches():
    policy = value_engine.FreshnessPolicy()
    now = datetime.now(timezone.utc)
    two_hours_old = now - timedelta(hours=2)

    far = value_engine.assess_freshness(two_hours_old, now, 72.0, "B365", policy)
    near = value_engine.assess_freshness(two_hours_old, now, 1.0, "B365", policy)
    assert far.fresh is True, "a two-hour-old price four days out is normal"
    assert near.fresh is False, "a two-hour-old price an hour before kickoff is not"

    aggregate = value_engine.assess_freshness(
        now - timedelta(hours=8), now, 72.0, "AVG", policy)
    bookmaker = value_engine.assess_freshness(
        now - timedelta(hours=8), now, 72.0, "B365", policy)
    assert bookmaker.fresh and not aggregate.fresh, (
        "aggregates are the market reference and are held to a tighter limit")


def test_a_price_stamped_in_the_future_is_refused():
    now = datetime.now(timezone.utc)
    verdict = value_engine.assess_freshness(now + timedelta(hours=1), now, 24.0, "B365")
    assert verdict.fresh is False and "clock" in verdict.detail


def test_a_pass_always_carries_a_reason_and_a_bet_never_does(value_test_bookmakers):
    gate = value_engine.ValueGate()
    recs = gate.assess_all([_candidate(), _candidate(odds=1.20),
                            _candidate(data_confidence={"score": 0.1, "state": "insufficient"})])
    for rec in recs:
        assert (rec.decision == "BET") == (not rec.reason_codes)
    counts = value_engine.summarise_reasons(recs)
    assert counts.get("BET") == 1


# ---------------------------------------------------------------------------
# 9. The accumulator
# ---------------------------------------------------------------------------

# `Leg.bookmaker` lost its "MAX" default in contract 188: a leg has to say
# where its price is, because multiplying best-available prices from different
# books produces a return available at no venue. These tests are about the
# combination rules rather than about venues, so every leg is at one real book.
_TEST_REGISTRY = {
    "B365": {"code": "B365", "kind": "bookmaker", "is_real_price": True,
             "exchange_commission": None},
    "MAX": {"code": "MAX", "kind": "aggregate", "is_real_price": False,
            "exchange_commission": None},
}


def _leg(fixture: str, home: str, away: str, selection: str = "H",
         odds: float = 2.0, prob: float = 0.55, league: str = "EPL",
         confidence_score: float = 0.8,
         bookmaker: str = "B365") -> accumulator_mod.Leg:
    return accumulator_mod.Leg(
        fixture_id=fixture, league=league, home=home, away=away,
        kickoff_at=datetime(2026, 8, 15, 15, 0, tzinfo=timezone.utc),
        selection=selection, odds=odds, probability=prob,
        bookmaker=bookmaker,
        data_confidence=confidence_score, data_confidence_state="high",
        agreement=0.8, uncertainty_width=0.06)


def test_two_selections_on_one_fixture_are_never_combined():
    legs = [_leg("f1", "A", "B", "H"), _leg("f1", "A", "B", "D", odds=3.5, prob=0.3),
            _leg("f2", "C", "D"), _leg("f3", "E", "F")]
    built = accumulator_mod.build_accumulators(
        legs, accumulator_mod.AccumulatorRequest(legs=2, results=20, bookmaker_registry=_TEST_REGISTRY))
    for acc in built["accumulators"]:
        ids = [leg["fixture_id"] for leg in acc["legs"]]
        assert len(set(ids)) == len(ids), "two legs from one fixture were combined"


def test_the_same_club_is_never_priced_twice_in_one_accumulator():
    legs = [_leg("f1", "Arsenal", "Chelsea"), _leg("f2", "Arsenal", "Spurs"),
            _leg("f3", "Everton", "Leeds")]
    built = accumulator_mod.build_accumulators(
        legs, accumulator_mod.AccumulatorRequest(legs=2, results=20, bookmaker_registry=_TEST_REGISTRY))
    for acc in built["accumulators"]:
        clubs = [c for leg in acc["legs"] for c in leg["match"].split(" v ")]
        assert len(set(clubs)) == len(clubs)


def test_accumulator_arithmetic_is_exact_and_labelled_as_an_approximation():
    legs = [_leg("f1", "A", "B", odds=2.0, prob=0.55),
            _leg("f2", "C", "D", odds=3.0, prob=0.40),
            _leg("f3", "E", "F", odds=1.5, prob=0.70)]
    built = accumulator_mod.build_accumulators(
        legs, accumulator_mod.AccumulatorRequest(legs=3, bookmaker_registry=_TEST_REGISTRY))
    acc = built["accumulators"][0]
    assert abs(acc["combined_odds"] - 9.0) < 1e-6
    assert abs(acc["estimated_joint_probability"] - 0.154) < 1e-6
    assert abs(acc["expected_value"] - (0.154 * 9.0 - 1)) < 1e-6
    assert abs(acc["fair_combined_odds"] - 1 / 0.154) < 1e-3
    assert "independent" in acc["correlation_treatment"]


def test_accumulator_constraints_and_truncation_are_reported_not_silent():
    legs = [_leg(f"f{i}", f"H{i}", f"A{i}", odds=1.2 + i * 0.4,
                 prob=0.5, confidence_score=0.4 + i * 0.05)
            for i in range(12)]
    built = accumulator_mod.build_accumulators(legs, accumulator_mod.AccumulatorRequest(
        legs=2, min_combined_odds=4.0, min_data_confidence=0.6, pool_cap=5, bookmaker_registry=_TEST_REGISTRY))
    assert built["candidates_dropped_by_pool_cap"] >= 0
    assert built["rejection_reasons"], "filtered legs must be explained"
    for acc in built["accumulators"]:
        assert acc["combined_odds"] >= 4.0
        assert acc["min_data_confidence"] >= 0.6


def test_an_impossible_request_returns_nothing_rather_than_something():
    legs = [_leg("f1", "A", "B", odds=1.5, prob=0.6), _leg("f2", "C", "D", odds=1.5, prob=0.6)]
    built = accumulator_mod.build_accumulators(legs, accumulator_mod.AccumulatorRequest(
        legs=2, min_combined_odds=50.0, bookmaker_registry=_TEST_REGISTRY))
    assert built["accumulators"] == []


def test_a_single_league_accumulator_warns_about_its_correlation():
    legs = [_leg("f1", "A", "B"), _leg("f2", "C", "D"), _leg("f3", "E", "F")]
    built = accumulator_mod.build_accumulators(legs, accumulator_mod.AccumulatorRequest(legs=3, bookmaker_registry=_TEST_REGISTRY))
    assert any("league" in w for w in built["accumulators"][0]["warnings"])


def test_accumulator_search_is_deterministic():
    legs = [_leg(f"f{i}", f"H{i}", f"A{i}", odds=1.8 + 0.1 * i, prob=0.55)
            for i in range(8)]
    request = accumulator_mod.AccumulatorRequest(legs=3, results=4, bookmaker_registry=_TEST_REGISTRY)
    first = accumulator_mod.build_accumulators(legs, request)
    second = accumulator_mod.build_accumulators(legs, request)
    assert first == second


# ---------------------------------------------------------------------------
# 10. Post-match diagnosis
# ---------------------------------------------------------------------------

def _graded(**overrides) -> dict:
    row = {"prediction_id": "p1", "p_home": 0.74, "p_draw": 0.16, "p_away": 0.10,
           "actual_result": "A", "log_loss": 2.3, "features": {},
           "data_confidence": {"score": 0.8, "state": "high", "missing_inputs": []},
           "home_shots": 21, "away_shots": 4, "home_shots_ot": 8, "away_shots_ot": 2}
    row.update(overrides)
    return row


def test_a_confident_loss_with_the_play_on_your_side_is_not_a_model_failure():
    result = diagnose.diagnose_one(_graded())
    assert result.category == "UNDERLYING_PERFORMANCE_SUPPORTED_MODEL"
    assert "not a defect" in result.evidence["note"]


def test_a_confident_loss_against_the_play_is_flagged_as_a_real_miss():
    result = diagnose.diagnose_one(_graded(home_shots_ot=2, away_shots_ot=9,
                                           home_shots=4, away_shots=22))
    assert result.category == "UNDERLYING_PERFORMANCE_CONTRADICTED_MODEL"


def test_an_unconfident_loss_is_ordinary_variance():
    result = diagnose.diagnose_one(_graded(p_home=0.42, p_draw=0.30, p_away=0.28))
    assert result.category == "NORMAL_VARIANCE"


def test_a_loss_with_missing_inputs_is_a_data_gap_not_a_model_failure():
    result = diagnose.diagnose_one(_graded(
        data_confidence={"score": 0.2, "state": "insufficient",
                         "missing_inputs": ["home_shots_ot"]}))
    assert result.category == "DATA_GAP"


def test_one_match_never_becomes_a_research_finding():
    one = diagnose.aggregate_patterns(
        [diagnose.diagnose_one(_graded(home_shots_ot=2, away_shots_ot=9))])
    assert one["candidate_experiments"] == [], (
        "a single match produced a research conclusion")

    many = diagnose.aggregate_patterns([
        diagnose.diagnose_one(_graded(prediction_id=f"p{i}", home_shots_ot=2,
                                      away_shots_ot=9, home_shots=4, away_shots=22))
        for i in range(10)])
    assert many["candidate_experiments"], "ten of the same pattern is a pattern"
    assert "never modify or promote" in many["note"]


def test_the_diagnosis_vocabulary_matches_the_database_constraint():
    """The check constraint in contract 186 lists these; a new category here
    without one there is an insert that fails at 3am."""
    from pathlib import Path

    migration = (Path(__file__).parents[1] / "supabase" / "migrations"
                 / "20260813100000_ai_lab_multi_model_evidence.sql").read_text()
    for category in diagnose.CATEGORIES:
        assert f"'{category}'" in migration, (
            f"{category} is not in the database's diagnosis vocabulary")


# ---------------------------------------------------------------------------
# 11. Package-level guards
# ---------------------------------------------------------------------------

def test_no_write_in_the_package_escapes_schema_ai():
    import check_write_scope

    assert check_write_scope.violations() == []


def test_default_groups_still_hold_only_the_families_that_were_proven():
    """Half-time and congestion measured as noise; performance is untested."""
    assert DEFAULT_GROUPS == ("core", "shots_volume", "corners", "conversion")
    for candidate in ("halftime", "congestion", "performance"):
        assert candidate in FEATURE_GROUPS
        assert candidate not in DEFAULT_GROUPS, (
            f"{candidate} entered the default set without a paired ablation")


def test_the_performance_family_measures_result_against_underlying_play():
    """A 1-0 win while being out-shot 3-12 is not the same evidence as a 1-0
    win while dominating, and the feature has to be able to say so."""
    def window(sot_for: int, sot_against: int) -> float:
        rows = [
            {"match_date": date(2026, 8, 1), "season": "2627", "division": "E0",
             "home_canonical": "A", "away_canonical": "B",
             "home_goals": 1, "away_goals": 0, "result": "H",
             "home_shots_ot": sot_for, "away_shots_ot": sot_against},
            {"match_date": date(2026, 8, 8), "season": "2627", "division": "E0",
             "home_canonical": "A", "away_canonical": "C",
             "home_goals": 0, "away_goals": 0, "result": "D",
             "home_shots_ot": 5, "away_shots_ot": 5},
        ]
        built = FeatureBuilder("E0").build_training_frame(pd.DataFrame(rows))
        return float(built.iloc[1]["home_overperformance"])

    lucky = window(3, 12)
    deserved = window(12, 3)
    assert lucky > deserved, (
        "winning while out-created must read as over-performance")
    assert lucky > 0 and deserved < lucky


def test_red_card_damping_is_partial_so_an_upset_still_counts():
    rows = [{"match_date": date(2026, 8, 1), "season": "2627", "division": "E0",
             "home_canonical": "A", "away_canonical": "B",
             "home_goals": 4, "away_goals": 0, "result": "H",
             "red_card_distorted": True},
            {"match_date": date(2026, 8, 8), "season": "2627", "division": "E0",
             "home_canonical": "A", "away_canonical": "C",
             "home_goals": 0, "away_goals": 0, "result": "D"}]
    df = pd.DataFrame(rows)
    plain = FeatureBuilder("E0").build_training_frame(df).iloc[1]["elo_home"]
    aware = FeatureBuilder("E0", elo_margin_policy="red_card_aware") \
        .build_training_frame(df).iloc[1]["elo_home"]
    assert aware < plain, "the damping did nothing"
    assert aware > ELO_START, (
        "the win stopped counting entirely; the rule must damp the margin, "
        "not delete the result")
