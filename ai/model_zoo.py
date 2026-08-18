"""The models themselves.

Three of them, in deliberate order of ambition. The baseline exists so that
"58% accuracy" can be read as either good or bad; without it the number means
nothing. Build the baseline first and keep it forever.
"""
from __future__ import annotations

from dataclasses import dataclass

import numpy as np
import pandas as pd
from scipy.stats import poisson
from sklearn.linear_model import LogisticRegression, PoissonRegressor
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import StandardScaler

OUTCOMES = ("H", "D", "A")
MAX_GOALS = 10


# ---------------------------------------------------------------------------
# v0.1 — base rates
# ---------------------------------------------------------------------------

class BaselineModel:
    """Predicts the training set's home/draw/away frequencies for every match.

    Beating this is the minimum bar. Roughly 45% home / 25% draw / 30% away in
    the Premier League, which already yields ~45% "accuracy" while containing
    no information about any specific fixture whatsoever.
    """

    family = "baseline"

    def __init__(self) -> None:
        self.rates_ = np.array([0.45, 0.25, 0.30])

    def fit(self, X: pd.DataFrame, y: pd.Series) -> "BaselineModel":
        counts = pd.Series(y).value_counts()
        self.rates_ = np.array([counts.get(o, 0) for o in OUTCOMES], dtype=float)
        self.rates_ /= self.rates_.sum()
        return self

    def predict_proba(self, X: pd.DataFrame) -> np.ndarray:
        return np.tile(self.rates_, (len(X), 1))

    def predict_goals(self, X: pd.DataFrame) -> tuple[np.ndarray, np.ndarray]:
        n = len(X)
        return np.full(n, 1.45), np.full(n, 1.20)


# ---------------------------------------------------------------------------
# v0.2 — multinomial logistic regression on the feature block
# ---------------------------------------------------------------------------

class LogisticModel:
    """Regularised multinomial logistic regression.

    C is deliberately small. With ~30 correlated features and a few thousand
    matches, an unregularised fit will happily learn that Elo and season points
    per game are two different things worth trusting separately, and then fall
    over in August.
    """

    family = "logistic"

    def __init__(self, C: float = 0.15) -> None:
        self.pipeline = Pipeline([
            ("scale", StandardScaler()),
            # lbfgs on a 3-class target is multinomial in every scikit-learn
            # version that matters; the explicit multi_class argument was
            # removed in 1.7, so it is deliberately not passed here.
            ("clf", LogisticRegression(C=C, max_iter=2000, solver="lbfgs")),
        ])
        self.classes_: list[str] = list(OUTCOMES)
        self.feature_names_: list[str] = []

    def fit(self, X: pd.DataFrame, y: pd.Series, sample_weight=None) -> "LogisticModel":
        self.feature_names_ = list(X.columns)
        fit_kwargs = {}
        if sample_weight is not None:
            fit_kwargs["clf__sample_weight"] = np.asarray(sample_weight, dtype=float)
        self.pipeline.fit(X.values, y.values, **fit_kwargs)
        self.classes_ = list(self.pipeline.named_steps["clf"].classes_)
        return self

    def predict_proba(self, X: pd.DataFrame) -> np.ndarray:
        raw = self.pipeline.predict_proba(X[self.feature_names_].values)
        order = [self.classes_.index(o) for o in OUTCOMES]
        return raw[:, order]

    def predict_goals(self, X: pd.DataFrame) -> tuple[np.ndarray, np.ndarray]:
        # This family does not model goals; the Poisson model does.
        n = len(X)
        return np.full(n, np.nan), np.full(n, np.nan)

    def coefficients(self) -> pd.DataFrame:
        clf = self.pipeline.named_steps["clf"]
        return pd.DataFrame(clf.coef_.T, index=self.feature_names_, columns=self.classes_)


# ---------------------------------------------------------------------------
# v0.3 — Poisson goal model with a Dixon-Coles low-score correction
# ---------------------------------------------------------------------------

@dataclass
class DixonColesParams:
    rho: float = -0.05


class PoissonModel:
    """Two Poisson regressions (home goals, away goals) -> a scoreline grid.

    Independent Poissons are known to under-predict 0-0 and 1-1 and
    over-predict 1-0 and 0-1. The Dixon-Coles tau correction adjusts those four
    cells; rho is fitted on the training set rather than assumed.

    The advantage over the logistic model is not usually accuracy. It is that
    this one produces a full scoreline distribution, which is what a "predicted
    score" and an exact-score leaderboard actually need.
    """

    family = "poisson"

    def __init__(self, alpha: float = 1.0) -> None:
        self.home = Pipeline([
            ("scale", StandardScaler()),
            ("reg", PoissonRegressor(alpha=alpha, max_iter=2000)),
        ])
        self.away = Pipeline([
            ("scale", StandardScaler()),
            ("reg", PoissonRegressor(alpha=alpha, max_iter=2000)),
        ])
        self.feature_names_: list[str] = []
        self.dc = DixonColesParams()

    def fit(self, X: pd.DataFrame, y: pd.Series, home_goals=None, away_goals=None,
            sample_weight=None) -> "PoissonModel":
        if home_goals is None or away_goals is None:
            raise ValueError("PoissonModel.fit needs home_goals and away_goals")
        self.feature_names_ = list(X.columns)
        # `sample_weight` is Dixon-Coles' other half. The tau correction below
        # is the one this codebase already had; the paper's phi(t) — recent
        # matches counting for more than old ones — was missing entirely, so a
        # match from 2013 carried exactly the weight of one from April.
        fit_kwargs = {}
        if sample_weight is not None:
            fit_kwargs["reg__sample_weight"] = np.asarray(sample_weight, dtype=float)
        self.home.fit(X.values, np.asarray(home_goals), **fit_kwargs)
        self.away.fit(X.values, np.asarray(away_goals), **fit_kwargs)
        self.dc.rho = self._fit_rho(X, np.asarray(home_goals), np.asarray(away_goals),
                                    sample_weight=sample_weight)
        return self

    # -- Dixon-Coles ---------------------------------------------------------

    @staticmethod
    def _tau(h: np.ndarray, a: np.ndarray, lh: np.ndarray, la: np.ndarray, rho: float) -> np.ndarray:
        t = np.ones_like(lh, dtype=float)
        m00 = (h == 0) & (a == 0)
        m01 = (h == 0) & (a == 1)
        m10 = (h == 1) & (a == 0)
        m11 = (h == 1) & (a == 1)
        t[m00] = 1.0 - lh[m00] * la[m00] * rho
        t[m01] = 1.0 + lh[m01] * rho
        t[m10] = 1.0 + la[m10] * rho
        t[m11] = 1.0 - rho
        return np.clip(t, 1e-9, None)

    def _fit_rho(self, X: pd.DataFrame, hg: np.ndarray, ag: np.ndarray,
                 sample_weight=None) -> float:
        """Maximise the tau likelihood, under the same weights the rates saw.

        The two rate regressions received `sample_weight` and this did not, so
        with decay enabled the model listened to 2013 a tenth as much as April
        for how many goals a team scores, and exactly as much for how often a
        match finishes 1-1. Rho is estimated from a handful of low-score cells,
        which is precisely where a stale decade of scoring conventions has room
        to move a number that nothing else corrects.
        """
        lh = self.home.predict(X.values)
        la = self.away.predict(X.values)
        w = (np.ones_like(lh, dtype=float) if sample_weight is None
             else np.asarray(sample_weight, dtype=float))
        if w.shape != lh.shape:
            raise ValueError(
                f"sample_weight has {w.shape} entries for {lh.shape} matches")
        best, best_ll = 0.0, -np.inf
        for rho in np.linspace(-0.20, 0.10, 31):
            tau = self._tau(hg, ag, lh, la, rho)
            ll = float((w * np.log(tau)).sum())
            if np.isfinite(ll) and ll > best_ll:
                best, best_ll = float(rho), ll
        return best

    # -- prediction ----------------------------------------------------------

    def scoreline_grid(self, X: pd.DataFrame) -> np.ndarray:
        """(n_matches, MAX_GOALS+1, MAX_GOALS+1) joint scoreline probabilities."""
        Xv = X[self.feature_names_].values
        lh = np.clip(self.home.predict(Xv), 0.05, 6.0)
        la = np.clip(self.away.predict(Xv), 0.05, 6.0)
        goals = np.arange(MAX_GOALS + 1)

        ph = poisson.pmf(goals[None, :], lh[:, None])   # (n, G+1)
        pa = poisson.pmf(goals[None, :], la[:, None])
        grid = ph[:, :, None] * pa[:, None, :]

        # Dixon-Coles correction on the four low-score cells.
        rho = self.dc.rho
        grid[:, 0, 0] *= (1.0 - lh * la * rho)
        grid[:, 0, 1] *= (1.0 + lh * rho)
        grid[:, 1, 0] *= (1.0 + la * rho)
        grid[:, 1, 1] *= (1.0 - rho)
        grid = np.clip(grid, 0.0, None)
        grid /= grid.sum(axis=(1, 2), keepdims=True)
        return grid

    def predict_proba(self, X: pd.DataFrame) -> np.ndarray:
        grid = self.scoreline_grid(X)
        home_win = np.triu(np.ones((MAX_GOALS + 1, MAX_GOALS + 1)), 1).T  # h > a
        draw = np.eye(MAX_GOALS + 1)
        away_win = np.triu(np.ones((MAX_GOALS + 1, MAX_GOALS + 1)), 1)    # a > h
        p_h = (grid * home_win).sum(axis=(1, 2))
        p_d = (grid * draw).sum(axis=(1, 2))
        p_a = (grid * away_win).sum(axis=(1, 2))
        out = np.stack([p_h, p_d, p_a], axis=1)
        return out / out.sum(axis=1, keepdims=True)

    def predict_goals(self, X: pd.DataFrame) -> tuple[np.ndarray, np.ndarray]:
        Xv = X[self.feature_names_].values
        return (np.clip(self.home.predict(Xv), 0.05, 6.0),
                np.clip(self.away.predict(Xv), 0.05, 6.0))

    def top_scorelines(self, X: pd.DataFrame, top_n: int = 8) -> list[dict[str, float]]:
        grid = self.scoreline_grid(X)
        out = []
        for m in grid:
            flat = m.flatten()
            order = np.argsort(flat)[::-1][:top_n]
            out.append({
                f"{i // (MAX_GOALS + 1)}-{i % (MAX_GOALS + 1)}": round(float(flat[i]), 4)
                for i in order
            })
        return out


# ---------------------------------------------------------------------------
# v0.4 — Elo as a forecast in its own right
# ---------------------------------------------------------------------------

class EloOrderedLogitModel:
    """An ordered logit on the Elo rating difference. Nothing else.

    Elo has been in this package since the beginning and has never been a
    forecast: it was a COLUMN, one of thirty-odd fed to a Poisson regression.
    That matters for the ensemble, because two models that disagree are only
    informative if they can disagree — and a "second opinion" built by feeding
    the same features through the same regression is not a second opinion, it
    is the first one with different rounding.

    So this model sees exactly one number, `elo_diff`, and maps it to H/D/A
    through a functional form the Poisson model does not have: a latent
    home-superiority scale cut into three ordered pieces. The draw is the
    middle band rather than a category, which is the one structural claim about
    football results that neither the multinomial logistic nor the independent
    Poissons make. It will lose to the Poisson model on log loss. It is here
    because of WHERE it loses, which is not the same place.

        P(A) = sigma(c1 - b*x)
        P(D) = sigma(c2 - b*x) - sigma(c1 - b*x)
        P(H) = 1 - sigma(c2 - b*x)

    with c2 > c1 enforced by construction, and b, c1, c2 fitted by weighted
    maximum likelihood so the same time decay the other families receive
    applies here too.
    """

    family = "elo"
    uses_market = False
    REQUIRED = ("elo_diff",)

    def __init__(self, scale: float = 400.0) -> None:
        self.scale = scale
        self.beta_ = 1.0
        self.cut_lo_ = -0.5
        self.cut_hi_ = 0.5
        self.feature_names_: list[str] = list(self.REQUIRED)

    @staticmethod
    def _sigmoid(z: np.ndarray) -> np.ndarray:
        return 1.0 / (1.0 + np.exp(-np.clip(z, -35.0, 35.0)))

    def _x(self, X: pd.DataFrame) -> np.ndarray:
        missing = [c for c in self.REQUIRED if c not in X.columns]
        if missing:
            raise KeyError(f"{self.family} model needs {missing}")
        return np.asarray(X["elo_diff"], dtype=float) / self.scale

    def _probs(self, x: np.ndarray, beta: float, c_lo: float, c_hi: float) -> np.ndarray:
        lo = self._sigmoid(c_lo - beta * x)
        hi = self._sigmoid(c_hi - beta * x)
        p_a = lo
        p_d = np.clip(hi - lo, 1e-9, None)
        p_h = np.clip(1.0 - hi, 1e-9, None)
        out = np.stack([p_h, p_d, p_a], axis=1)
        return out / out.sum(axis=1, keepdims=True)

    def fit(self, X: pd.DataFrame, y: pd.Series, sample_weight=None,
            **_ignored) -> "EloOrderedLogitModel":
        from scipy.optimize import minimize

        x = self._x(X)
        idx = {o: i for i, o in enumerate(OUTCOMES)}
        target = np.array([idx[v] for v in np.asarray(y)], dtype=int)
        w = (np.ones_like(x) if sample_weight is None
             else np.asarray(sample_weight, dtype=float))

        def nll(theta):
            beta, c_lo, gap = theta
            probs = self._probs(x, beta, c_lo, c_lo + np.exp(gap))
            return float(-(w * np.log(probs[np.arange(len(target)), target])).sum())

        best = minimize(nll, x0=np.array([2.0, -0.6, np.log(1.2)]),
                        method="Nelder-Mead",
                        options={"maxiter": 2000, "xatol": 1e-6, "fatol": 1e-6})
        beta, c_lo, gap = best.x
        self.beta_, self.cut_lo_ = float(beta), float(c_lo)
        self.cut_hi_ = float(c_lo + np.exp(gap))
        return self

    def predict_proba(self, X: pd.DataFrame) -> np.ndarray:
        return self._probs(self._x(X), self.beta_, self.cut_lo_, self.cut_hi_)

    def predict_goals(self, X: pd.DataFrame) -> tuple[np.ndarray, np.ndarray]:
        n = len(X)
        return np.full(n, np.nan), np.full(n, np.nan)

    def describe(self) -> dict:
        return {"family": self.family, "beta": round(self.beta_, 4),
                "cut_lo": round(self.cut_lo_, 4), "cut_hi": round(self.cut_hi_, 4),
                "scale": self.scale}


# ---------------------------------------------------------------------------
# v0.5 — gradient-boosted trees
# ---------------------------------------------------------------------------

class GradientBoostedModel:
    """Histogram gradient boosting over the same pre-match feature block.

    scikit-learn's `HistGradientBoostingClassifier` rather than CatBoost or
    LightGBM, and that is a deliberate choice rather than a convenience. It is
    already installed — `pyproject.toml` declares scikit-learn and `uv.lock`
    pins the exact resolved build used by CI — so the lab gains a nonlinear learner without
    gaining a compiled dependency that has to be present on every runner, in
    every rehearsal and in whatever environment a future rollout uses. It also
    gives the one property that actually matters for this data:

      * NATIVE missingness. `sot_known` and its siblings exist because a
        missing shot count must not read as zero. A tree that can send NaN down
        its own branch expresses that directly.

    That second reason is worth stating carefully, because as shipped it was
    NOT true of the data this model receives. `FeatureBuilder` substitutes a
    NEUTRAL_* constant for every unrecorded stat before any model sees it, so
    the frame contains no NaN on any league — including the National League,
    where shots, corners and half-time goals are absent from every row. The
    neutral columns are therefore the ONLY representation and the tree's NaN
    branch is never taken. `test_models.py` pins that as a fact rather than
    leaving it as a belief.

    `native_missing=True` opts in to `features.reconstruct_missing`, which
    turns a neutral prior back into NaN wherever its coverage flag is exactly
    zero. It is off by default: it changes what the model sees, so it is a
    candidate to be measured on paired folds, not a correction to apply.

    It is registered, and it is in no default configuration of any kind: not
    in training, and — since 13 August 2026 — not in `ENSEMBLE_BASE_FAMILIES`
    either, so the blend and the stacker no longer carry it. See the register
    there for the measurement that removed it.

    A boosted model will beat a Poisson regression on the training set every
    time and that is not evidence of anything; it enters an ensemble only by
    winning paired walk-forward folds, which is what `experiments.py` measures.
    It was asked nine leagues of that question and won none of them. It is
    kept — implemented, registered and reachable by `--family gbm` and by
    `--base-families` — because a rejected family with its evidence attached
    is worth more than an absence somebody re-derives from scratch in a year.
    """

    family = "gbm"
    uses_market = False

    def __init__(self, learning_rate: float = 0.05, max_iter: int = 400,
                 max_leaf_nodes: int = 15, min_samples_leaf: int = 40,
                 l2_regularization: float = 1.0, random_state: int = 20280611,
                 early_stopping: bool = False, validation_fraction: float = 0.1,
                 n_iter_no_change: int = 20,
                 native_missing: bool = False) -> None:
        from sklearn.ensemble import HistGradientBoostingClassifier

        # `early_stopping=False` was commented "chronological folds do the
        # stopping". They do not: a fold SCORES a model, it does not limit its
        # boosting. Nothing bounded 400 iterations at a 0.05 learning rate, and
        # measured, that reaches a training log loss of ~0.09 on a three-class
        # outcome whose irreducible loss is ~0.99 — total memorisation. The
        # default is unchanged here because changing it is a model-authority
        # decision; `model_candidates.py` carries the alternatives.
        self.clf = HistGradientBoostingClassifier(
            loss="log_loss",
            learning_rate=learning_rate,
            max_iter=max_iter,
            max_leaf_nodes=max_leaf_nodes,
            min_samples_leaf=min_samples_leaf,
            l2_regularization=l2_regularization,
            early_stopping=early_stopping,
            validation_fraction=validation_fraction if early_stopping else None,
            n_iter_no_change=n_iter_no_change,
            random_state=random_state,
        )
        self.native_missing = bool(native_missing)
        self.feature_names_: list[str] = []
        self.classes_: list[str] = list(OUTCOMES)
        self.medians_: np.ndarray | None = None
        self.dropped_all_missing_: list[str] = []

    def _prepare(self, X: pd.DataFrame) -> np.ndarray:
        """The frame as the estimator should see it, missingness included."""
        if self.native_missing:
            from features import reconstruct_missing
            X = reconstruct_missing(X)
        return X.values.astype(float)

    def fit(self, X: pd.DataFrame, y: pd.Series, sample_weight=None,
            **_ignored) -> "GradientBoostedModel":
        self.feature_names_ = list(X.columns)
        values = self._prepare(X)

        # A column that is missing in EVERY training row carries no
        # information, and `HistGradientBoostingClassifier` cannot bin it — it
        # dies inside the binner with "window shape cannot be larger than
        # input array shape", which names nothing and points nowhere. This is
        # not hypothetical: it is exactly the National League under
        # `native_missing`, where shots, shots on target and corners are
        # absent from all 7,518 rows, so reconstruction blanks those columns
        # whole. They are dropped by NAME and the name is kept, so predict
        # applies the identical subset and the drop is inspectable rather than
        # implicit.
        if self.native_missing:
            usable = ~np.isnan(values).all(axis=0)
            if not usable.all():
                self.dropped_all_missing_ = [
                    name for name, keep in zip(self.feature_names_, usable) if not keep]
                self.feature_names_ = [
                    name for name, keep in zip(self.feature_names_, usable) if keep]
                values = values[:, usable]

        self.medians_ = np.nanmedian(values, axis=0)
        kwargs = {}
        if sample_weight is not None:
            kwargs["sample_weight"] = np.asarray(sample_weight, dtype=float)
        self.clf.fit(values, np.asarray(y), **kwargs)
        self.classes_ = list(self.clf.classes_)
        return self

    def predict_proba(self, X: pd.DataFrame) -> np.ndarray:
        raw = self.clf.predict_proba(self._prepare(X[self.feature_names_]))
        order = [self.classes_.index(o) for o in OUTCOMES]
        return raw[:, order]

    def predict_goals(self, X: pd.DataFrame) -> tuple[np.ndarray, np.ndarray]:
        n = len(X)
        return np.full(n, np.nan), np.full(n, np.nan)

    def contributions(self, X: pd.DataFrame, top_n: int = 8) -> list[list[dict]]:
        """Per-row feature contributions, preferring probability-space SHAP.

        Stated plainly because the difference matters: each feature is replaced
        in turn by its TRAINING median and the change in the model's own
        probability vector is recorded. That is a real, deterministic,
        model-derived attribution and it is not a Shapley value — it does not
        average over coalitions, so correlated features share credit rather
        than splitting it, and the parts do not sum to the whole.

        TreeSHAP would be exact for this model class and needs `shap`, which is
        a compiled dependency this package has not taken. When it does, this
        method is the thing to replace, and the explanation layer reads the
        `method` key rather than assuming.
        """
        if self.medians_ is None:
            raise ValueError("contributions() needs a fitted model")
        # Prepared ONCE, and the swapped rows are scored through the estimator
        # directly. Going back through `predict_proba` would re-run the
        # missingness reconstruction over an already-reconstructed row, and
        # under `native_missing` a NaN cell swapped to its median would then be
        # blanked again — attributing zero to every feature that was missing.
        frame = self._prepare(X[self.feature_names_])
        try:
            from shap_explain import shap_probability_contributions
            shap_rows = shap_probability_contributions(
                self.clf,
                frame,
                self.feature_names_,
                OUTCOMES,
                background=self.medians_.reshape(1, -1),
                top_n=top_n,
            )
        except Exception:
            shap_rows = None
        if shap_rows is not None:
            return shap_rows
        order = [self.classes_.index(o) for o in OUTCOMES]
        base = self.clf.predict_proba(frame)[:, order]
        out: list[list[dict]] = []
        for i in range(len(frame)):
            row = frame[i]
            deltas = []
            for j, name in enumerate(self.feature_names_):
                if np.isclose(row[j], self.medians_[j], equal_nan=True):
                    continue
                swapped = row.copy()
                swapped[j] = self.medians_[j]
                alt = self.clf.predict_proba(swapped.reshape(1, -1))[0][order]
                deltas.append({
                    "feature": name,
                    "value": float(row[j]),
                    "delta_home": float(base[i][0] - alt[0]),
                    "delta_draw": float(base[i][1] - alt[1]),
                    "delta_away": float(base[i][2] - alt[2]),
                    "method": "occlusion_vs_training_median",
                })
            deltas.sort(key=lambda d: -max(abs(d["delta_home"]), abs(d["delta_away"])))
            out.append(deltas[:top_n])
        return out

    def describe(self) -> dict:
        return {"family": self.family,
                "estimator": type(self.clf).__name__,
                "n_features": len(self.feature_names_)}


# ---------------------------------------------------------------------------
# v0.6 — the market-informed variant
# ---------------------------------------------------------------------------

class MarketInformedModel:
    """Football features PLUS what the pre-match market already believes.

    `ai.predictions.uses_market` exists for exactly this and its comment says
    why: once betting prices are a feature, "does my football model add
    information?" stops being answerable. So this is a separate family, marked
    separately, and it must never be confused with the pure model — which is
    enforced rather than remembered, by `market_features.assert_pure`.

    Two rules it keeps:

      * only prices that existed at `data_snapshot_at`. Closing lines are the
        benchmark this lab is measured against; feeding them to a model that
        claims to have forecast on Thursday is the single most flattering
        mistake available in this field, and it produces a model that looks
        superhuman and cannot be traded.

      * the market block is de-vigged before it is a feature. Raw implied
        probabilities carry the bookmaker's margin, which is a property of the
        bookmaker rather than of the match.
    """

    family = "market"
    uses_market = True

    def __init__(self, C: float = 0.5) -> None:
        self.pipeline = Pipeline([
            ("scale", StandardScaler()),
            ("clf", LogisticRegression(C=C, max_iter=3000, solver="lbfgs")),
        ])
        self.feature_names_: list[str] = []
        self.classes_: list[str] = list(OUTCOMES)

    def fit(self, X: pd.DataFrame, y: pd.Series, sample_weight=None,
            **_ignored) -> "MarketInformedModel":
        from market_features import assert_no_closing_features

        assert_no_closing_features(list(X.columns))
        self.feature_names_ = list(X.columns)
        kwargs = {}
        if sample_weight is not None:
            kwargs["clf__sample_weight"] = np.asarray(sample_weight, dtype=float)
        self.pipeline.fit(X.values.astype(float), np.asarray(y), **kwargs)
        self.classes_ = list(self.pipeline.named_steps["clf"].classes_)
        return self

    def predict_proba(self, X: pd.DataFrame) -> np.ndarray:
        raw = self.pipeline.predict_proba(X[self.feature_names_].values.astype(float))
        order = [self.classes_.index(o) for o in OUTCOMES]
        return raw[:, order]

    def predict_goals(self, X: pd.DataFrame) -> tuple[np.ndarray, np.ndarray]:
        n = len(X)
        return np.full(n, np.nan), np.full(n, np.nan)

    def coefficients(self) -> pd.DataFrame:
        clf = self.pipeline.named_steps["clf"]
        return pd.DataFrame(clf.coef_.T, index=self.feature_names_, columns=self.classes_)

    def describe(self) -> dict:
        return {"family": self.family, "n_features": len(self.feature_names_)}


MODEL_FAMILIES = {
    "baseline": BaselineModel,
    "logistic": LogisticModel,
    "poisson": PoissonModel,
    "elo": EloOrderedLogitModel,
    "gbm": GradientBoostedModel,
    "market": MarketInformedModel,
}

# Which families are allowed to see a price. Read by the training entry point
# and by the tests, so "the pure model stayed pure" is a property of the
# registry rather than of whoever last edited a command line.
MARKET_FAMILIES = frozenset({"market"})
PURE_FOOTBALL_FAMILIES = frozenset(set(MODEL_FAMILIES) - MARKET_FAMILIES)


@dataclass(frozen=True)
class Admission:
    """Whether a registered family sits in the default ensemble, and why.

    `earned` is the decision; `evidence` is what it was taken on. A family
    being implemented is not a reason, and neither is a family being absent —
    both directions need a sentence here, because the failure this register
    exists to prevent is a default component set that drifted to whatever
    happened to be registered on the day.
    """

    earned: bool
    evidence: str


# Every registered family, with its ensemble verdict. `test_model_zoo.py`
# requires this to name each of MODEL_FAMILIES exactly once, so implementing a
# family without ruling on it fails the suite rather than silently changing
# the model authority.
#
# Order is the order of the default tuple below, so it is also the order the
# blend and the stacker see their components in.
ENSEMBLE_ADMISSION: dict[str, Admission] = {
    "poisson": Admission(
        True,
        "Best single family in five of the nine leagues (ECH, EL1, EL2, SPL, "
        "SL2) over nine chronological folds, run 31729652899.",
    ),
    "elo": Admission(
        True,
        "Best single family in four of the nine leagues (EPL, ENL, SCH, SL1) "
        "over the same folds, run 31729652899.",
    ),
    "gbm": Admission(
        False,
        "Won no league; worse than the best family in 9/9 and worse than a "
        "class base rate in 8/9 (run 31729652899). Its ten repaired "
        "configurations all beat the incumbent and none was competitive (run "
        "31729251308). Removing it inverted the sign of the ensemble's "
        "benefit in 7/9 (runs 31738869955 against 31739455060). Retained as "
        "an implemented, measurable, rejected family.",
    ),
    "logistic": Admission(
        False,
        "Won no league; worse beyond noise in 8/9 with one unstable "
        "non-result (run 31729652899). Available for research; not promoted "
        "into the seat the GBM vacated, because keeping three components is "
        "not a reason.",
    ),
    "baseline": Admission(
        False,
        "Carries no information about a fixture. It is the control the other "
        "families are measured against, not a component.",
    ),
    "market": Admission(
        False,
        "Sees a price, so it cannot sit in the pure-football default without "
        "making every default blend market-informed. Registered and not in "
        "any live ensemble; see MARKET_FAMILIES.",
    ),
}

# The families that make a useful ensemble: structurally different learners
# over the same evidence, EACH OF WHICH HAS EARNED THE SEAT ON PAIRED FOLDS.
#
# This tuple is the default for `--base-families` in both `experiments.py` and
# `train.py`, so whatever stands here is in every default blend and every
# default stacker. It is therefore a model authority, and it is derived from
# `ENSEMBLE_ADMISSION` above rather than written out by hand: the register
# carries a verdict and its evidence for EVERY registered family, so
# a family cannot arrive in the default set by being implemented, and cannot
# leave it without its rejection being written down.
#
# `gbm` was removed on 13 August 2026. It sat here for the whole of its life
# on the stated ground that structural diversity is worth something, and
# `GradientBoostedModel`'s own docstring said it "enters an ensemble only by
# winning paired walk-forward folds" while it had never won any. Measured over
# nine leagues of real football on hosted Development, it lost to the best
# single family in nine of nine and to a class base rate in eight of nine; and
# the result that settles it is the pair of ensemble runs, identical folds and
# identical data, one component removed:
#
#   (poisson, elo, gbm)  blend worse than its best component in 9/9, beyond
#                        noise in 7  (run 31738869955)
#   (poisson, elo)       blend delta negative in 7/9  (runs 31739455060,
#                        31739795274, 31740065451)
#
# So its PRESENCE was what made the ensemble lose, which is a stronger claim
# than "it is a weak model". `logistic` did not take the vacated seat: it won
# no league, was worse beyond noise in eight of nine, and replacing one losing
# component with another to keep three families would be arithmetic rather
# than evidence. Both remain registered and measurable — see the register.
ENSEMBLE_BASE_FAMILIES = tuple(
    family for family, verdict in ENSEMBLE_ADMISSION.items()
    if verdict.earned
)


def uses_market(family: str) -> bool:
    return family in MARKET_FAMILIES
