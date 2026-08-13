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
        self.dc.rho = self._fit_rho(X, np.asarray(home_goals), np.asarray(away_goals))
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

    def _fit_rho(self, X: pd.DataFrame, hg: np.ndarray, ag: np.ndarray) -> float:
        lh = self.home.predict(X.values)
        la = self.away.predict(X.values)
        best, best_ll = 0.0, -np.inf
        for rho in np.linspace(-0.20, 0.10, 31):
            tau = self._tau(hg, ag, lh, la, rho)
            ll = float(np.log(tau).sum())
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
        idx = np.arange(MAX_GOALS + 1)
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


MODEL_FAMILIES = {
    "baseline": BaselineModel,
    "logistic": LogisticModel,
    "poisson": PoissonModel,
}
