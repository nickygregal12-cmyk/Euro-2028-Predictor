"""Independent base models, and a meta-model that never sees their homework.

A stacker is the easiest place in a forecasting pipeline to leak, and the leak
is invisible in every metric you would normally look at. Fit three base models
on 2013-2024, ask them for probabilities on 2013-2024, and fit a meta-model on
those: the base models have memorised parts of that period, so their in-sample
probabilities are better than anything they will ever produce live. The meta
learns to trust whichever model memorised hardest, reports a magnificent
training score, and is worse than any single component on Saturday.

So the only material the meta-model is ever shown is out-of-fold: for each
season, the base models are fitted on the seasons BEFORE it and predict it
once. Those predictions are the only thing the stacker sees, and they are the
same kind of prediction it will meet in production — made by a model that has
never seen the match.

The same rule covers calibration (`calibration.select_calibrator` is fed from
here) and the evaluation of the stacker itself: comparing a stacker to its
components on the rows it was fitted on would flatter it in exactly the way
this module exists to prevent, so `evaluate_out_of_time` refits the meta-model
on earlier folds only and scores it on a later one.
"""
from __future__ import annotations

from dataclasses import dataclass, field

import numpy as np
import pandas as pd

import metrics
from fitting import DEFAULT_HALF_LIFE_DAYS, fit_family, time_weights
from model_zoo import ENSEMBLE_BASE_FAMILIES, MODEL_FAMILIES

OUTCOMES = ("H", "D", "A")
_EPS = 1e-9


# ---------------------------------------------------------------------------
# Folds
# ---------------------------------------------------------------------------

@dataclass(frozen=True)
class Fold:
    season: str
    train_index: np.ndarray
    test_index: np.ndarray


def expanding_season_folds(frame: pd.DataFrame, min_train_seasons: int = 5,
                           min_test_rows: int = 100) -> list[Fold]:
    """Train on every season before N, test on season N, step forward.

    Chronological and expanding rather than k-fold, because the question is
    never "how would this model have done on a random subset" — it is "if this
    model had existed in August, how would the season have gone".
    """
    seasons = sorted(frame["season"].unique())
    folds: list[Fold] = []
    for i in range(min_train_seasons, len(seasons)):
        train_mask = frame["season"].isin(seasons[:i]).to_numpy()
        test_mask = (frame["season"] == seasons[i]).to_numpy()
        if test_mask.sum() < min_test_rows:
            continue
        folds.append(Fold(seasons[i], np.flatnonzero(train_mask),
                          np.flatnonzero(test_mask)))
    return folds


# ---------------------------------------------------------------------------
# Out-of-fold base predictions
# ---------------------------------------------------------------------------

@dataclass
class OutOfFold:
    """Base-model probabilities for rows no base model had seen."""

    families: tuple[str, ...]
    probs: dict[str, np.ndarray]          # family -> (n_oof, 3)
    actual: np.ndarray                    # (n_oof,) of 'H'/'D'/'A'
    fold_labels: np.ndarray               # (n_oof,) season code per row
    row_index: np.ndarray                 # positions in the source frame

    def __len__(self) -> int:
        return len(self.actual)

    def stack(self) -> np.ndarray:
        """(n_oof, n_families * 3), the meta-model's design matrix."""
        return np.column_stack([self.probs[f] for f in self.families])

    def summary(self) -> dict[str, dict]:
        return {f: metrics.summarise(self.probs[f], self.actual)
                for f in self.families}


def out_of_fold(frame: pd.DataFrame,
                column_map: dict[str, list[str]],
                families: tuple[str, ...] = ENSEMBLE_BASE_FAMILIES,
                half_life_days: float = DEFAULT_HALF_LIFE_DAYS,
                min_train_seasons: int = 5) -> OutOfFold:
    """Every base family's honest prediction for every scoreable season.

    `column_map` gives each family its own columns, which is how the
    market-informed family gets prices and the pure families provably do not.
    """
    folds = expanding_season_folds(frame, min_train_seasons)
    if not folds:
        raise ValueError(
            f"{len(sorted(frame['season'].unique()))} seasons is too few for "
            f"{min_train_seasons} training seasons plus a test season.")

    probs = {f: [] for f in families}
    actual, labels, index = [], [], []

    for fold in folds:
        train = frame.iloc[fold.train_index]
        test = frame.iloc[fold.test_index]
        weights = time_weights(train["match_date"], half_life_days)
        for family in families:
            cols = column_map[family]
            model = fit_family(family, train, cols, half_life_days, weights=weights)
            probs[family].append(np.asarray(model.predict_proba(test[cols]), dtype=float))
        actual.append(test["result"].to_numpy())
        labels.append(np.full(len(test), fold.season, dtype=object))
        index.append(fold.test_index)

    return OutOfFold(
        families=tuple(families),
        probs={f: np.vstack(probs[f]) for f in families},
        actual=np.concatenate(actual),
        fold_labels=np.concatenate(labels),
        row_index=np.concatenate(index),
    )


# ---------------------------------------------------------------------------
# Meta-models
# ---------------------------------------------------------------------------

class EqualBlend:
    """The average of the base probabilities. No parameters, no fitting.

    Present because it is the benchmark a learned stacker has to beat.
    Averaging independent forecasts is remarkably hard to improve on, and a
    stacker that cannot beat it is a stacker that has learned fold noise.
    """

    method = "equal_blend"

    def __init__(self, families: tuple[str, ...]) -> None:
        self.families = tuple(families)

    def fit(self, oof: OutOfFold) -> "EqualBlend":
        return self

    def combine(self, base: dict[str, np.ndarray]) -> np.ndarray:
        stacked = np.stack([np.asarray(base[f], dtype=float) for f in self.families])
        out = stacked.mean(axis=0)
        return out / out.sum(axis=1, keepdims=True)

    def describe(self) -> dict:
        return {"method": self.method, "families": list(self.families)}


class LogisticStacker:
    """Multinomial logistic regression on the base models' log-probabilities.

    Log-probabilities rather than probabilities: a logistic regression on log p
    with a single coefficient per model is exactly a weighted geometric pool,
    which is the standard way to combine probabilistic forecasts and degenerates
    gracefully to "trust one model" when that is what the data says.

    Strongly regularised. With three base models and three outcomes there are
    27 coefficients and perhaps eight folds of genuinely independent evidence;
    an unregularised fit will discover that the boosted model was excellent in
    2019 and weight it accordingly for ever.
    """

    method = "logistic_stack"

    def __init__(self, families: tuple[str, ...], C: float = 0.5) -> None:
        from sklearn.linear_model import LogisticRegression

        self.families = tuple(families)
        self.clf = LogisticRegression(C=C, max_iter=3000, solver="lbfgs")
        self.classes_: list[str] = list(OUTCOMES)
        self.n_fit = 0

    @staticmethod
    def _design(base: dict[str, np.ndarray], families: tuple[str, ...]) -> np.ndarray:
        return np.column_stack([
            np.log(np.clip(np.asarray(base[f], dtype=float), _EPS, None))
            for f in families
        ])

    def fit(self, oof: OutOfFold) -> "LogisticStacker":
        X = self._design(oof.probs, self.families)
        self.clf.fit(X, oof.actual)
        self.classes_ = list(self.clf.classes_)
        self.n_fit = len(oof)
        return self

    def combine(self, base: dict[str, np.ndarray]) -> np.ndarray:
        X = self._design(base, self.families)
        raw = self.clf.predict_proba(X)
        order = [self.classes_.index(o) for o in OUTCOMES]
        return raw[:, order]

    def describe(self) -> dict:
        return {"method": self.method, "families": list(self.families),
                "n_fit": self.n_fit}


META_MODELS = {"equal_blend": EqualBlend, "logistic_stack": LogisticStacker}


# ---------------------------------------------------------------------------
# The deployable ensemble
# ---------------------------------------------------------------------------

@dataclass
class EnsembleModel:
    """Fitted base models plus a meta-model, behaving like one model.

    Packaged as a single object so that `ai.models` keeps its guarantee of one
    `current` row per league: the components are INSIDE the current model
    rather than beside it, and the database constraint that stops two models
    writing predictions for the same fixture is untouched.
    """

    family: str = "ensemble"
    uses_market: bool = False
    models: dict[str, object] = field(default_factory=dict)
    column_map: dict[str, list[str]] = field(default_factory=dict)
    meta: object | None = None
    # Which component owns the scoreline distribution. The ensemble combines
    # 1X2 opinions; nothing in a blended H/D/A vector says how often it is 2-1,
    # so score-derived markets keep coming from the component that models goals.
    scoreline_family: str = "poisson"

    def base_probabilities(self, X: pd.DataFrame) -> dict[str, np.ndarray]:
        return {f: np.asarray(m.predict_proba(X[self.column_map[f]]), dtype=float)
                for f, m in self.models.items()}

    def predict_proba(self, X: pd.DataFrame) -> np.ndarray:
        base = self.base_probabilities(X)
        out = self.meta.combine(base)
        return out / out.sum(axis=1, keepdims=True)

    # -- score-derived markets ------------------------------------------------

    def _scoreline_model(self):
        model = self.models.get(self.scoreline_family)
        if model is None or not hasattr(model, "scoreline_grid"):
            raise AttributeError(
                f"this ensemble has no {self.scoreline_family} component, so it "
                "cannot produce a scoreline distribution")
        return model

    def scoreline_grid(self, X: pd.DataFrame) -> np.ndarray:
        """The Poisson component's own grid, unaltered.

        Deliberately NOT reweighted to agree with the ensemble's 1X2 vector.
        Reweighting is tempting and would make the headline pick and the top
        scoreline always agree, but it would also push the 1X2 calibration into
        every over/under and both-teams-to-score price derived from this grid —
        markets for which no calibration evidence has been gathered. A
        calibrator earns its scope; it does not inherit it.
        """
        return self._scoreline_model().scoreline_grid(X[self.column_map[self.scoreline_family]])

    def top_scorelines(self, X: pd.DataFrame, top_n: int = 8):
        return self._scoreline_model().top_scorelines(
            X[self.column_map[self.scoreline_family]], top_n)

    def predict_goals(self, X: pd.DataFrame):
        try:
            model = self._scoreline_model()
        except AttributeError:
            n = len(X)
            return np.full(n, np.nan), np.full(n, np.nan)
        return model.predict_goals(X[self.column_map[self.scoreline_family]])

    def describe(self) -> dict:
        return {
            "family": self.family,
            "components": sorted(self.models),
            "meta": self.meta.describe() if self.meta else None,
            "scoreline_family": self.scoreline_family,
            "uses_market": self.uses_market,
        }


def fit_ensemble(frame: pd.DataFrame, column_map: dict[str, list[str]],
                 families: tuple[str, ...] = ENSEMBLE_BASE_FAMILIES,
                 meta: str = "logistic_stack",
                 half_life_days: float = DEFAULT_HALF_LIFE_DAYS,
                 min_train_seasons: int = 5,
                 oof: OutOfFold | None = None) -> tuple[EnsembleModel, OutOfFold]:
    """Fit the meta-model out-of-fold, then refit the bases on everything.

    The order is the point. The meta-model is fitted on out-of-fold material
    only; the base models it will actually call are then refitted on the whole
    frame, because a deployable model should know about last weekend. The
    weights the meta learned describe how these FAMILIES relate to one another,
    which is a stable enough thing to carry over to models fitted on more data.
    """
    oof = oof or out_of_fold(frame, column_map, families, half_life_days,
                             min_train_seasons)
    meta_model = META_MODELS[meta](families).fit(oof)

    weights = time_weights(frame["match_date"], half_life_days)
    models = {f: fit_family(f, frame, column_map[f], half_life_days, weights=weights)
              for f in families}
    ensemble = EnsembleModel(
        models=models,
        column_map={f: list(column_map[f]) for f in families},
        meta=meta_model,
        uses_market=any(getattr(MODEL_FAMILIES[f], "uses_market", False) for f in families),
    )
    return ensemble, oof


# ---------------------------------------------------------------------------
# Second-level cross-fitting
#
# The base predictions in `OutOfFold` are out-of-fold FOR THE BASE MODELS and
# for nothing else. Calibration used to do this:
#
#     oof   = out_of_fold(...)                    # base models honest
#     meta  = LogisticStacker(...).fit(oof)       # meta fitted on ALL of it
#     probs = meta.combine(oof.probs)             # scored on the SAME rows
#     calibrator = select_calibrator(probs, ...)  # calibrated on those
#
# Every row the calibrator saw was a row the stacker had been fitted on. A
# stacker is a fitted model like any other: on its own training rows it is
# systematically better-behaved than it will be in production, so the residual
# miscalibration the calibrator is supposed to correct is measured too small.
# The result is a calibrator fitted to an over-optimistic picture, and — worse
# for a lab — a `calibration_after` ECE that flatters both of them and gets
# reported as evidence.
#
# `stacked_out_of_time` produces meta predictions that are out-of-sample for
# the meta-model as well: for fold k the stacker is fitted on folds 0..k-1 and
# predicts fold k, exactly as `evaluate_out_of_time` already does for scoring.
# The production stacker may then be fitted on all the OOF material — it is
# not being measured — and the final calibrator is fitted to these clean
# cross-fitted predictions.
# ---------------------------------------------------------------------------

@dataclass
class StackedOutOfTime:
    """Meta predictions for rows the meta-model had not been fitted on."""

    probs: np.ndarray                     # (n, 3)
    actual: np.ndarray
    fold_labels: np.ndarray
    meta: str
    folds_used: int
    rows_dropped: int
    detail: dict

    def __len__(self) -> int:
        return len(self.actual)


class SecondLevelLeakage(ValueError):
    """Meta predictions were produced by a model fitted on the same rows."""


def stacked_out_of_time(oof: OutOfFold, meta: str = "logistic_stack",
                        min_fit_folds: int = 3) -> StackedOutOfTime:
    """Cross-fitted meta predictions, chronologically.

    The first `min_fit_folds` seasons have no earlier folds to fit a stacker
    on, so they produce no cross-fitted prediction and are DROPPED rather than
    filled in with a leaky one. The count is returned: losing three seasons of
    calibration material is a real cost and the caller has to be able to see it.
    """
    seasons = sorted(set(oof.fold_labels.tolist()))
    if len(seasons) <= min_fit_folds:
        raise SecondLevelLeakage(
            f"cross-fitting the meta-model needs more than {min_fit_folds} "
            f"folds; this OOF set has {len(seasons)}. Calibrating an ensemble "
            "on meta predictions fitted to their own rows is not an acceptable "
            "fallback — train with more seasons, or calibrate a single family.")

    probs, actual, labels = [], [], []
    for k in range(min_fit_folds, len(seasons)):
        fit_mask = np.isin(oof.fold_labels, seasons[:k])
        test_mask = oof.fold_labels == seasons[k]
        fit_slice = OutOfFold(
            families=oof.families,
            probs={f: oof.probs[f][fit_mask] for f in oof.families},
            actual=oof.actual[fit_mask],
            fold_labels=oof.fold_labels[fit_mask],
            row_index=oof.row_index[fit_mask],
        )
        model = META_MODELS[meta](oof.families).fit(fit_slice)
        probs.append(model.combine({f: oof.probs[f][test_mask] for f in oof.families}))
        actual.append(oof.actual[test_mask])
        labels.append(oof.fold_labels[test_mask])

    kept = int(sum(len(a) for a in actual))
    return StackedOutOfTime(
        probs=np.vstack(probs),
        actual=np.concatenate(actual),
        fold_labels=np.concatenate(labels),
        meta=meta,
        folds_used=len(seasons) - min_fit_folds,
        rows_dropped=len(oof) - kept,
        detail={
            "seasons_available": [str(s) for s in seasons],
            "seasons_cross_fitted": [str(s) for s in seasons[min_fit_folds:]],
            "seasons_reserved_for_first_meta_fit": [str(s) for s in seasons[:min_fit_folds]],
            "note": ("Each row's meta prediction came from a stacker fitted "
                     "only on strictly earlier seasons. The base predictions "
                     "under it were already out-of-fold."),
        },
    )


def assert_meta_out_of_sample(stacked: StackedOutOfTime, oof: OutOfFold) -> None:
    """Refuse a calibration input that a meta-model saw during its own fit.

    A guard rather than a comment. The failure it catches is invisible in every
    number the pipeline reports — the leaky version produces a BETTER-looking
    ECE, which is exactly why nothing else would have found it.
    """
    seasons = sorted(set(oof.fold_labels.tolist()))
    reserved = set(seasons[:len(seasons) - stacked.folds_used])
    leaked = sorted(reserved & set(stacked.fold_labels.tolist()))
    if leaked:
        raise SecondLevelLeakage(
            f"meta predictions for season(s) {leaked} were produced by a "
            "stacker that had been fitted on them. Calibrating on those rows "
            "measures the stacker's training-set behaviour, not its "
            "production behaviour.")
    if len(stacked) != len(stacked.probs):
        raise SecondLevelLeakage("stacked predictions and outcomes disagree in length")


# ---------------------------------------------------------------------------
# Honest comparison
# ---------------------------------------------------------------------------

def evaluate_out_of_time(oof: OutOfFold, meta: str = "logistic_stack",
                         min_fit_folds: int = 3) -> dict:
    """Score every candidate on folds none of them were fitted on.

    For fold k the meta-model is fitted on folds 0..k-1 and scored on k. Base
    models are already out-of-fold by construction, so their numbers here are
    directly comparable — and comparability is the whole exercise, because the
    decision this feeds is "is the ensemble better than the best single model",
    which is exactly the comparison a stacker fitted on its own test rows would
    win by default.
    """
    seasons = sorted(set(oof.fold_labels.tolist()))
    if len(seasons) <= min_fit_folds:
        return {"error": f"need more than {min_fit_folds} folds; have {len(seasons)}"}

    per_fold: dict[str, list[float]] = {}
    for k in range(min_fit_folds, len(seasons)):
        fit_mask = np.isin(oof.fold_labels, seasons[:k])
        test_mask = oof.fold_labels == seasons[k]
        fit_slice = OutOfFold(
            families=oof.families,
            probs={f: oof.probs[f][fit_mask] for f in oof.families},
            actual=oof.actual[fit_mask],
            fold_labels=oof.fold_labels[fit_mask],
            row_index=oof.row_index[fit_mask],
        )
        base_test = {f: oof.probs[f][test_mask] for f in oof.families}
        actual_test = oof.actual[test_mask]

        for family in oof.families:
            per_fold.setdefault(family, []).append(
                metrics.summarise(base_test[family], actual_test)["log_loss"])
        for name in ("equal_blend", meta):
            model = META_MODELS[name](oof.families).fit(fit_slice)
            combined = model.combine(base_test)
            per_fold.setdefault(name, []).append(
                metrics.summarise(combined, actual_test)["log_loss"])

    out: dict[str, dict] = {}
    for name, values in per_fold.items():
        arr = np.array(values, dtype=float)
        out[name] = {
            "folds": len(arr),
            "mean_log_loss": float(arr.mean()),
            "se_log_loss": (float(arr.std(ddof=1) / np.sqrt(len(arr)))
                            if len(arr) > 1 else float("nan")),
            "per_fold": [round(float(v), 5) for v in arr],
        }

    # Paired against the best single base model, because "the ensemble beat the
    # WORST component" is not a reason to ship an ensemble.
    bases = {f: out[f]["mean_log_loss"] for f in oof.families}
    best_base = min(bases, key=bases.get)
    for name in ("equal_blend", meta):
        diffs = np.array(per_fold[name]) - np.array(per_fold[best_base])
        out[name]["vs_best_base"] = {
            "base": best_base,
            "mean_delta": float(diffs.mean()),
            "se_delta": (float(diffs.std(ddof=1) / np.sqrt(len(diffs)))
                         if len(diffs) > 1 else float("nan")),
            "beats_noise": bool(len(diffs) > 1 and
                                diffs.mean() + 2 * diffs.std(ddof=1) / np.sqrt(len(diffs)) < 0),
        }
    out["_best_base"] = best_base
    return out
