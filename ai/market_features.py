"""The market block: what the prices already knew, before they closed.

Two separate jobs, and the second one is the important one.

The first is to turn a row of stored odds into features a model can use:
de-vigged consensus probabilities, the overround that was removed, and the
disagreement between the best price available and the average one, which is
the cheapest proxy this data carries for bookmaker dispersion.

The second is to make it structurally impossible for a closing price to become
a feature. `ai.raw_matches` stores `close_avg_h`, `close_max_h`, `close_ps_h`
and their siblings alongside the pre-match ones, and `load_history` selects all
of them, because the closing line is the benchmark every model here is scored
against. Which means the columns are sitting in the same DataFrame as the
features, one careless `df.columns` away from being trained on.

A model trained on closing prices is not slightly optimistic. It is the single
most flattering error available in this field: closing lines are the most
accurate forecast anyone publishes, so a model given them will beat every
benchmark, look like a breakthrough, and be unbettable — because at the moment
a bet must be placed, the number it depends on does not exist yet.

So `assert_no_closing_features` refuses any column whose name matches a closing
family, `MarketInformedModel.fit` calls it on every fit, and a test proves the
refusal fires. It is a name-based check on purpose: the names are stable, they
are declared in one place, and a check that reads the data instead would pass
happily on a season where the closing columns happen to be null.
"""
from __future__ import annotations

import re

import numpy as np
import pandas as pd

import betting

# Anything matching these is a price that did not exist before kickoff.
CLOSING_PATTERNS = (
    re.compile(r"^close_", re.I),
    re.compile(r"closing", re.I),
    re.compile(r"^mkt_.*_closing$", re.I),
)

# The pre-match price columns `load_history` supplies. Declared rather than
# discovered so that a new column in ai.raw_matches cannot join the feature
# block by accident.
PRE_MATCH_PRICE_COLUMNS = (
    "odds_avg_h", "odds_avg_d", "odds_avg_a",
    "odds_max_h", "odds_max_d", "odds_max_a",
    "mkt_home_prob", "mkt_draw_prob", "mkt_away_prob",
)

MARKET_FEATURE_NAMES = (
    "mkt_p_home", "mkt_p_draw", "mkt_p_away",
    "mkt_overround",
    "mkt_favourite_prob",
    "mkt_home_minus_away",
    "mkt_dispersion",          # best price vs average price, mean over outcomes
    "mkt_dispersion_home",
    "mkt_known",               # 1 when the row carried a usable price
)


class ClosingPriceLeak(ValueError):
    """A closing-line column reached something that trains on it."""


def assert_no_closing_features(names) -> None:
    offending = [n for n in names
                 if any(p.search(str(n)) for p in CLOSING_PATTERNS)]
    if offending:
        raise ClosingPriceLeak(
            f"Closing-price columns cannot be model features: {offending}. "
            "The closing line is what this lab is measured AGAINST. A model "
            "trained on it beats every benchmark and can never be bet, "
            "because at the moment a bet is placed the number does not exist.")


def assert_pure(names) -> None:
    """A pure-football model may not see ANY price, closing or otherwise."""
    market = [n for n in names if str(n).startswith(("mkt_", "odds_", "close_"))]
    if market:
        raise ClosingPriceLeak(
            f"The pure football model may not see market data: {market}. "
            "`ai.predictions.uses_market` exists so the two can be told apart; "
            "mixing them makes 'does my football model add information?' "
            "unanswerable.")


def build_market_block(frame: pd.DataFrame, devig: str = "shin") -> pd.DataFrame:
    """Market features for every row, with a `mkt_known` flag beside them.

    A row with no usable price gets the neutral market view — the base rates a
    league-agnostic bookmaker would post — paired with `mkt_known = 0`. That is
    the same pattern `sot_known` established: an unmeasured thing must be
    distinguishable from an average one, or the model learns that "no price"
    means "even game".
    """
    assert_no_closing_features(frame.columns)

    n = len(frame)
    out = {name: np.zeros(n, dtype=float) for name in MARKET_FEATURE_NAMES}
    # Neutral prior: roughly the long-run H/D/A split across these divisions.
    out["mkt_p_home"][:] = 0.44
    out["mkt_p_draw"][:] = 0.26
    out["mkt_p_away"][:] = 0.30
    out["mkt_favourite_prob"][:] = 0.44
    out["mkt_home_minus_away"][:] = 0.14
    out["mkt_overround"][:] = 0.0

    cols = ("odds_avg_h", "odds_avg_d", "odds_avg_a")
    if not all(c in frame.columns for c in cols):
        return pd.DataFrame(out, index=frame.index)

    avg = frame[list(cols)].astype(float).to_numpy()
    usable = np.isfinite(avg).all(axis=1) & (avg > 1.0).all(axis=1)
    if usable.any():
        fair = betting.fair_probabilities(avg[usable], devig)
        out["mkt_p_home"][usable] = fair[:, 0]
        out["mkt_p_draw"][usable] = fair[:, 1]
        out["mkt_p_away"][usable] = fair[:, 2]
        out["mkt_overround"][usable] = betting.overround(avg[usable]) - 1.0
        out["mkt_favourite_prob"][usable] = fair.max(axis=1)
        out["mkt_home_minus_away"][usable] = fair[:, 0] - fair[:, 2]
        out["mkt_known"][usable] = 1.0

    max_cols = ("odds_max_h", "odds_max_d", "odds_max_a")
    if all(c in frame.columns for c in max_cols):
        best = frame[list(max_cols)].astype(float).to_numpy()
        both = usable & np.isfinite(best).all(axis=1) & (best > 1.0).all(axis=1)
        if both.any():
            # How far the best price sits above the average one. Wider means
            # the books disagree, which is information about how settled the
            # market's opinion is rather than about the teams.
            ratio = best[both] / avg[both] - 1.0
            out["mkt_dispersion"][both] = ratio.mean(axis=1)
            out["mkt_dispersion_home"][both] = ratio[:, 0]

    return pd.DataFrame(out, index=frame.index)


def market_probabilities_at(frame: pd.DataFrame, devig: str = "shin") -> np.ndarray:
    """The de-vigged consensus, as a plain (n, 3) array, for benchmarking."""
    block = build_market_block(frame, devig)
    return block[["mkt_p_home", "mkt_p_draw", "mkt_p_away"]].to_numpy()
