"""Turning probabilities into prices, and prices into decisions.

The distinction this module exists to keep straight: a model that predicts
results well and a model that finds mispriced games are not the same thing. The
first is measured against the outcome. The second is measured against the price,
and the price is set by people who are, on average, better at this than you.

Nothing here places a bet or talks to a bookmaker. It computes numbers.
"""
from __future__ import annotations

from dataclasses import dataclass

import numpy as np

OUTCOMES = ("H", "D", "A")


# ---------------------------------------------------------------------------
# Removing the bookmaker's margin
# ---------------------------------------------------------------------------
#
# Raw implied probabilities from 1/odds sum to more than 1. The excess is the
# overround. Splitting it back out is not arithmetic — it is a modelling choice,
# and the choice changes which bets look like value.
#
# Multiplicative (just normalise) is what almost everyone does and it is
# measurably wrong: it assumes the margin is spread proportionally, which
# systematically over-states longshot probabilities and therefore manufactures
# fake value on away teams and draws in mismatched fixtures. Shin's method
# assumes some of the margin is protection against better-informed bettors and
# fits the football data better. Use Shin as the default; keep the others so
# you can show how much of a "value bet" is an artefact of the method.

def overround(odds: np.ndarray) -> np.ndarray:
    return (1.0 / np.asarray(odds, dtype=float)).sum(axis=-1)


def devig_multiplicative(odds) -> np.ndarray:
    raw = 1.0 / np.asarray(odds, dtype=float)
    return raw / raw.sum(axis=-1, keepdims=True)


def devig_additive(odds) -> np.ndarray:
    """Subtract the margin equally from each outcome. Over-corrects favourites."""
    raw = 1.0 / np.asarray(odds, dtype=float)
    n = raw.shape[-1]
    excess = raw.sum(axis=-1, keepdims=True) - 1.0
    out = raw - excess / n
    return np.clip(out, 1e-6, None) / np.clip(out, 1e-6, None).sum(axis=-1, keepdims=True)


def devig_power(odds, tol: float = 1e-10, max_iter: int = 200) -> np.ndarray:
    """Find k with sum(raw_i ** k) == 1. Bisection on k."""
    raw = np.atleast_2d(1.0 / np.asarray(odds, dtype=float))
    out = np.empty_like(raw)
    for i, row in enumerate(raw):
        lo, hi = 0.5, 3.0
        for _ in range(max_iter):
            mid = 0.5 * (lo + hi)
            s = (row ** mid).sum()
            if abs(s - 1.0) < tol:
                break
            if s > 1.0:
                lo = mid
            else:
                hi = mid
        out[i] = row ** mid
        out[i] /= out[i].sum()
    return out.reshape(np.asarray(odds).shape)


def devig_shin(odds, tol: float = 1e-10, max_iter: int = 200) -> np.ndarray:
    """Shin (1993): the margin partly compensates the book for informed money.

        p_i = [ sqrt(z^2 + 4(1-z) * raw_i^2 / B) - z ] / (2(1-z))

    where raw_i = 1/o_i and B = sum(raw). z is the implied proportion of
    informed money; solve it so the fair probabilities sum to 1.
    """
    arr = np.asarray(odds, dtype=float)
    raw2d = np.atleast_2d(1.0 / arr)
    out = np.empty_like(raw2d)

    for i, row in enumerate(raw2d):
        B = row.sum()
        if B <= 1.0:                      # no margin (or an arb) — nothing to remove
            out[i] = row / B
            continue

        def probs(z: float) -> np.ndarray:
            if z <= 1e-12:
                return row / B
            inner = z * z + 4.0 * (1.0 - z) * (row ** 2) / B
            return (np.sqrt(np.clip(inner, 0.0, None)) - z) / (2.0 * (1.0 - z))

        lo, hi = 0.0, 0.5
        for _ in range(max_iter):
            mid = 0.5 * (lo + hi)
            s = probs(mid).sum()
            if abs(s - 1.0) < tol:
                break
            if s > 1.0:
                lo = mid
            else:
                hi = mid
        p = probs(mid)
        out[i] = np.clip(p, 1e-6, None)
        out[i] /= out[i].sum()

    return out.reshape(arr.shape)


DEVIG = {
    "multiplicative": devig_multiplicative,
    "additive": devig_additive,
    "power": devig_power,
    "shin": devig_shin,
}


def fair_probabilities(odds, method: str = "shin") -> np.ndarray:
    return DEVIG[method](odds)


# ---------------------------------------------------------------------------
# Value, staking and closing-line value
# ---------------------------------------------------------------------------

def expected_value(model_prob, decimal_odds) -> np.ndarray:
    """EV per unit staked. 0.05 means a 5% edge IF the model probability is right.

    That conditional is doing enormous work. A 5% edge computed from a model
    whose probabilities are 3% miscalibrated is noise wearing a suit.
    """
    p = np.asarray(model_prob, dtype=float)
    o = np.asarray(decimal_odds, dtype=float)
    return p * o - 1.0


def kelly_fraction(model_prob, decimal_odds, cap: float = 1.0) -> np.ndarray:
    """Full-Kelly stake as a fraction of bankroll: (bp - q) / b.

    Full Kelly is the growth-optimal stake only if your probabilities are
    exactly right. They are not. Kelly is famously unforgiving of over-estimated
    edges — an edge overstated by 2x turns growth-optimal into ruinous. Use a
    fraction (see fractional_kelly) and cap it.
    """
    p = np.asarray(model_prob, dtype=float)
    o = np.asarray(decimal_odds, dtype=float)
    b = o - 1.0
    f = np.where(b > 0, (p * o - 1.0) / b, 0.0)
    return np.clip(f, 0.0, cap)


def fractional_kelly(model_prob, decimal_odds, fraction: float = 0.25,
                     cap: float = 0.02) -> np.ndarray:
    """Quarter Kelly, capped at 2% of bankroll per bet.

    The cap matters more than the fraction. It is what survives the week your
    model is quietly broken because a data feed changed a club's name.
    """
    return np.clip(kelly_fraction(model_prob, decimal_odds) * fraction, 0.0, cap)


# Benchmark preference for a closing line, sharpest first. MAX IS DELIBERATELY
# ABSENT.
#
# Max H, Max D and Max A are each the best price from whichever bookmaker
# happened to be top on that outcome, so the triple is a synthetic book that
# nobody offered. Its overround is frequently below 1 — it is an arbitrage — and
# de-vigging something whose implied probabilities already sum to less than one
# is not a meaningful operation. It flatters every comparison in the direction
# you would most like to be flattered. Max stays useful as "the best price
# available"; it is never the fair line.
#
# This lives here rather than in settle_bets because two jobs now need it and
# they must not be able to disagree: settlement measures a bet against the close
# and evaluation measures the FORECAST against it, and a benchmark that differed
# between them would make the two records incomparable.
CLOSING_BENCHMARKS = (("PS", "close_ps"), ("AVG", "close_avg"))


def closing_triple(row):
    """The closing (H, D, A) odds, the book they came from, and its overround.

    `row` is any mapping carrying `close_ps_h`-style keys. Returns
    `(None, None, None)` when no benchmark is complete: a missing closing line
    is a missing measurement, never a substituted one.
    """
    for code, prefix in CLOSING_BENCHMARKS:
        triple = [row.get(f"{prefix}_{leg}") for leg in ("h", "d", "a")]
        if all(v is not None and np.isfinite(float(v)) for v in triple):
            arr = np.array([float(v) for v in triple])
            return arr, code, float((1.0 / arr).sum())
    return None, None, None


def closing_line_value(odds_taken, closing_fair_prob) -> np.ndarray:
    """EV of the price you took, measured at the closing fair probability.

    +0.02 means the price you took was 2% better than what the market
    eventually decided was fair. This is THE metric. Profit takes thousands of
    bets to become statistically meaningful; CLV takes about a hundred, because
    every bet contributes a measurement rather than a coin flip.
    """
    o = np.asarray(odds_taken, dtype=float)
    q = np.asarray(closing_fair_prob, dtype=float)
    return o * q - 1.0


def beat_closing_line(odds_taken, odds_closing) -> np.ndarray:
    """Simple price comparison, ignoring margin. Useful as a cross-check."""
    return np.asarray(odds_taken, dtype=float) / np.asarray(odds_closing, dtype=float) - 1.0


# ---------------------------------------------------------------------------
# Selection
# ---------------------------------------------------------------------------

@dataclass
class SelectionRule:
    """When to call something a bet.

    min_edge exists because a threshold of zero turns every rounding error into
    a selection. min_prob exists because a 4% edge on a 6% shot is almost always
    the model being wrong about a longshot rather than the market being wrong.
    max_odds is the same guard from the other side.
    """
    min_edge: float = 0.03
    min_prob: float = 0.10
    max_odds: float = 8.0
    min_odds: float = 1.30
    kelly_fraction: float = 0.25
    max_stake_fraction: float = 0.02

    def select(self, model_probs: np.ndarray, odds: np.ndarray) -> np.ndarray:
        """Boolean mask, same shape as the inputs, of qualifying selections."""
        p = np.asarray(model_probs, dtype=float)
        o = np.asarray(odds, dtype=float)
        ev = expected_value(p, o)
        return (
            (ev >= self.min_edge)
            & (p >= self.min_prob)
            & (o <= self.max_odds)
            & (o >= self.min_odds)
            & np.isfinite(o)
        )


# ---------------------------------------------------------------------------
# Decomposition: is the edge yours, or is it line shopping?
# ---------------------------------------------------------------------------

def decompose_edge(model_prob, best_odds, average_odds, devig_method: str = "shin"):
    """Split an apparent edge into two very different things.

    `vs_market` is your model disagreeing with the consensus — real skill if it
    holds up. `vs_average` is you taking the best price in a market where the
    average is worse — that is line shopping, it is worth money, and it is not
    evidence your model knows anything.

    Reporting only the combined number is the most common way a value-betting
    dashboard flatters itself.
    """
    p = np.asarray(model_prob, dtype=float)
    best = np.asarray(best_odds, dtype=float)
    avg = np.asarray(average_odds, dtype=float)
    return {
        "total_edge": expected_value(p, best),
        "model_edge_vs_average": expected_value(p, avg),
        "line_shopping_edge": best / avg - 1.0,
    }


# ---------------------------------------------------------------------------
# Correlated selections
# ---------------------------------------------------------------------------

def cap_correlated_exposure(stake_fractions, match_ids, max_per_match: float = 0.03):
    """Scale down stakes so total exposure to any one match stays bounded.

    Kelly assumes each bet is an independent opportunity. Once you price more
    than one market, that assumption breaks badly: home win, over 2.5 and both
    teams to score on the same fixture are largely the SAME bet expressed three
    ways, all derived from the same scoreline grid. Staking each at full
    quarter-Kelly puts three times the intended risk on one ninety-minute
    outcome, and they lose together.

    This is a blunt instrument — a proper treatment would use the joint
    distribution to compute the covariance — but a hard cap per fixture removes
    the failure mode that actually ruins bankrolls, which is not being slightly
    mis-sized but being accidentally three-times-sized on a correlated cluster.
    """
    import numpy as np

    f = np.asarray(stake_fractions, dtype=float).copy()
    ids = np.asarray(match_ids)
    for key in np.unique(ids):
        m = ids == key
        total = f[m].sum()
        if total > max_per_match:
            f[m] *= max_per_match / total
    return f


def effective_independent_bets(match_ids) -> float:
    """How many genuinely independent bets a set of selections amounts to.

    Six selections across two fixtures is closer to two pieces of evidence than
    six. Reporting the raw count next to a CLV mean overstates the sample, and
    overstating the sample is how a promising-looking record turns out to be
    forty correlated observations wearing a hat.
    """
    import numpy as np

    ids = np.asarray(match_ids)
    return float(len(np.unique(ids)))
