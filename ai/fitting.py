"""One place that knows how to fit a family and how old a match is.

`train.walk_forward` and `ablate.fold_scores` each carried their own copy of
"build the weights, branch on whether the family is Poisson, call fit". Two
copies is how a fold ends up validating a model nobody will ever run: the
weighting is part of the model, so a validation loop that weights differently
from the shipped fit is measuring something else. Three copies were about to
exist. Now there is one.
"""
from __future__ import annotations

import numpy as np
import pandas as pd

from model_zoo import MODEL_FAMILIES

# Two and a half years. Dixon and Coles fitted a decay on half-seasons of one
# league; this archive is fifteen seasons across nine divisions, where squads
# turn over but a club's level is genuinely persistent. It is a parameter
# rather than a constant precisely so it can be argued with:
# `--half-life-days 0` restores equal weighting exactly.
DEFAULT_HALF_LIFE_DAYS = 900.0

# The half-lives `experiments.py --study half-life` compares per league. 0 is
# in the list because "no decay at all" has to be allowed to win: the lower
# divisions are sample-starved, and throwing away 2014 to be fashionable about
# recency is a real way to make a model worse.
HALF_LIFE_GRID = (0.0, 180.0, 365.0, 540.0, 730.0, 900.0, 1200.0)


def time_weights(match_dates, half_life_days: float):
    """Exponential recency weights, normalised to mean 1.

    Normalising keeps the regulariser's meaning stable: `alpha` is defined
    against the total weight, so an un-normalised decay would silently change
    how hard the model is penalised as well as which matches it listens to,
    and the two effects could not be told apart afterwards.
    """
    if not half_life_days or half_life_days <= 0:
        return None
    days = pd.to_datetime(pd.Series(list(match_dates)))
    age = (days.max() - days).dt.days.to_numpy(dtype=float)
    weights = np.power(0.5, age / float(half_life_days))
    mean = weights.mean()
    return weights / mean if mean > 0 else None


def fit_family(family: str, frame: pd.DataFrame, columns: list[str],
               half_life_days: float = DEFAULT_HALF_LIFE_DAYS,
               weights=None, **kwargs):
    """Fit `family` on `frame[columns]` under the shipped weighting.

    `weights` is computed from the frame when not supplied, which is the
    normal path; passing it in exists so a caller that already built the
    weights for a paired comparison does not build them twice and risk
    building them differently.
    """
    if family not in MODEL_FAMILIES:
        raise ValueError(f"unknown model family: {family!r}; "
                         f"known: {sorted(MODEL_FAMILIES)}")
    if weights is None:
        weights = time_weights(frame["match_date"], half_life_days)

    model = MODEL_FAMILIES[family](**kwargs)
    X, y = frame[columns], frame["result"]
    if family == "poisson":
        model.fit(X, y, home_goals=frame["home_goals"],
                  away_goals=frame["away_goals"], sample_weight=weights)
    elif family == "baseline":
        model.fit(X, y)
    else:
        model.fit(X, y, sample_weight=weights)
    return model
