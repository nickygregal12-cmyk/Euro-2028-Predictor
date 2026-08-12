"""Cards and corners: the two markets that are genuinely separate models.

Everything in markets.py comes out of the goal grid, so those markets share
their errors. Cards and corners do not — different data, different drivers,
independent mistakes. That makes them the only real diversification available,
and it is why they are worth building despite the problem in the next
paragraph.

The problem: there is no free or cheap historical odds source for either
market, for any of the nine divisions, and neither runs on the Betfair
Exchange. You can build and validate the MODEL for free — Football-Data has
given you HY/AY/HR/AR and HC/AC for decades — but you cannot backtest a
BETTING strategy, because there are no historical prices to bet into. Start
collecting live prices now and you will own that dataset in a year. Nobody
will sell it to you.

Booking points note: UK books score 10 per yellow and 25 per red. A second
yellow is usually 10 + 25 = 35. Football-Data's HR counts red cards and it is
not always clear whether a second-yellow dismissal is also counted in HY, so
`booking_points` computes both conventions and the difference is reported. Get
this wrong and every line you price is off by a systematic amount.
"""
from __future__ import annotations

from collections import defaultdict, deque
from dataclasses import dataclass, field

import numpy as np
import pandas as pd
from scipy.stats import nbinom, poisson
from sklearn.linear_model import PoissonRegressor
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import StandardScaler

YELLOW_POINTS = 10
RED_POINTS = 25


def booking_points(yellows, reds, second_yellow_counted_in_yellows: bool = True):
    """Points under both plausible conventions.

    If a second-yellow red is already inside the yellow count, a red adds 25;
    if it is not, it adds 35. The gap is 10 points per dismissal, which is
    roughly a quarter of a typical line, so it is not a detail.
    """
    y = np.asarray(yellows, dtype=float)
    r = np.asarray(reds, dtype=float)
    if second_yellow_counted_in_yellows:
        return y * YELLOW_POINTS + r * RED_POINTS
    return y * YELLOW_POINTS + r * (RED_POINTS + YELLOW_POINTS)


# ---------------------------------------------------------------------------
# Leakage-safe rolling rates, including the referee
# ---------------------------------------------------------------------------

@dataclass
class _Roll:
    window: int
    prior: float
    values: deque = field(default_factory=deque)

    def rate(self) -> float:
        if not self.values:
            return self.prior
        # Shrink toward the prior while the sample is small. A referee with two
        # matches on record is not evidence of anything, and letting the model
        # treat him as a 90-point official is how a cards model produces its
        # most confident and most wrong prices.
        n = len(self.values)
        w = n / (n + 6.0)
        return w * float(np.mean(self.values)) + (1 - w) * self.prior

    def add(self, v: float) -> None:
        self.values.append(v)
        while len(self.values) > self.window:
            self.values.popleft()


class CountFeatureBuilder:
    """Chronological builder for cards or corners.

    Same guarantee as features.py: state advances only when the date does, so a
    match can see neither itself nor anything else played that day.
    """

    def __init__(self, target: str, prior: float, window: int = 20,
                 ref_window: int = 30) -> None:
        assert target in ("cards", "corners")
        self.target = target
        self.prior = prior
        self.window = window
        self.ref_window = ref_window
        self.team_for: dict[str, _Roll] = defaultdict(lambda: _Roll(window, prior / 2))
        self.team_against: dict[str, _Roll] = defaultdict(lambda: _Roll(window, prior / 2))
        self.referee: dict[str, _Roll] = defaultdict(lambda: _Roll(ref_window, prior))
        self.league: dict[str, _Roll] = defaultdict(lambda: _Roll(200, prior))
        self._pending: list[tuple] = []
        self._date = None

    def _flush(self) -> None:
        for home, away, ref, div, h_val, a_val in self._pending:
            self.team_for[home].add(h_val)
            self.team_for[away].add(a_val)
            self.team_against[home].add(a_val)
            self.team_against[away].add(h_val)
            self.league[div].add(h_val + a_val)
            if ref:
                self.referee[ref].add(h_val + a_val)
        self._pending.clear()

    def build(self, matches: pd.DataFrame) -> pd.DataFrame:
        df = matches.sort_values(["match_date", "home_canonical"]).reset_index(drop=True)
        rows = []
        for rec in df.itertuples(index=False):
            when = rec.match_date
            if self._date is not None and when > self._date:
                self._flush()
            self._date = when

            home, away = rec.home_canonical, rec.away_canonical
            ref = getattr(rec, "referee", None)
            div = rec.division
            h_val, a_val = float(rec.home_value), float(rec.away_value)

            feats = {
                "home_for": self.team_for[home].rate(),
                "away_for": self.team_for[away].rate(),
                "home_against": self.team_against[home].rate(),
                "away_against": self.team_against[away].rate(),
                "league_rate": self.league[div].rate(),
                # For cards this is the single strongest feature there is, and
                # it is the one place the referee genuinely earns its keep --
                # referee effects on match RESULTS are negligible, on cards
                # they are large.
                "referee_rate": self.referee[ref].rate() if ref else self.league[div].rate(),
                "referee_matches": float(len(self.referee[ref].values)) if ref else 0.0,
                "expected_combined": (self.team_for[home].rate() + self.team_against[away].rate()
                                      + self.team_for[away].rate() + self.team_against[home].rate()) / 2,
            }
            rows.append({
                "match_date": when, "season": rec.season, "division": div,
                "home_canonical": home, "away_canonical": away,
                "total": h_val + a_val, "home_value": h_val, "away_value": a_val,
                **feats,
            })
            self._pending.append((home, away, ref, div, h_val, a_val))
        self._flush()
        return pd.DataFrame(rows)


FEATURES = ["home_for", "away_for", "home_against", "away_against",
            "league_rate", "referee_rate", "referee_matches", "expected_combined"]


# ---------------------------------------------------------------------------
# The count model
# ---------------------------------------------------------------------------

class CountModel:
    """Poisson mean with a fitted negative-binomial dispersion.

    Total cards and total corners are both over-dispersed relative to Poisson —
    a bad-tempered derby produces far more variance than a Poisson with the same
    mean allows. Pricing an over/under line off a Poisson tail therefore
    understates both tails, which systematically makes the outer lines look like
    value when they are not. Fitting the dispersion is what stops that.
    """

    def __init__(self, alpha: float = 1.0) -> None:
        self.pipeline = Pipeline([("scale", StandardScaler()),
                                  ("reg", PoissonRegressor(alpha=alpha, max_iter=2000))])
        self.dispersion_: float = 1.0
        self.features_: list[str] = []

    def fit(self, X: pd.DataFrame, y) -> "CountModel":
        self.features_ = list(X.columns)
        y = np.asarray(y, dtype=float)
        self.pipeline.fit(X.values, y)
        mu = np.clip(self.pipeline.predict(X.values), 1e-6, None)
        # Method-of-moments dispersion: var = mu + mu^2 / r
        resid_var = float(np.mean((y - mu) ** 2))
        mean_mu = float(np.mean(mu))
        excess = max(resid_var - mean_mu, 1e-9)
        self.dispersion_ = float(np.mean(mu ** 2) / excess)
        return self

    def predict_mean(self, X: pd.DataFrame) -> np.ndarray:
        return np.clip(self.pipeline.predict(X[self.features_].values), 1e-6, None)

    def distribution(self, X: pd.DataFrame, max_count: int = 120) -> np.ndarray:
        """(n, max_count+1) pmf over the total."""
        mu = self.predict_mean(X)
        r = self.dispersion_
        k = np.arange(max_count + 1)
        if not np.isfinite(r) or r <= 0 or r > 1e6:
            return poisson.pmf(k[None, :], mu[:, None])
        p = r / (r + mu)
        return nbinom.pmf(k[None, :], r, p[:, None])

    def over_under(self, X: pd.DataFrame, line: float, max_count: int = 120):
        pmf = self.distribution(X, max_count)
        k = np.arange(max_count + 1)
        over = pmf[:, k > line].sum(axis=1)
        total = pmf.sum(axis=1)
        over = over / total
        return {"Over": over, "Under": 1.0 - over}

    def overdispersion_ratio(self, X: pd.DataFrame, y) -> float:
        """Var/mean on the training data. 1.0 is Poisson; football is not 1.0."""
        mu = self.predict_mean(X)
        return float(np.mean((np.asarray(y, dtype=float) - mu) ** 2) / np.mean(mu))
