"""Scoring rules.

Accuracy is on the dashboard because it is the number that feels like it means
something. It is not the number that decides anything. A model that always
says "home win" gets ~46% in the Premier League and is worthless; a model that
never picks a draw can beat one that does while being strictly less
informative. Log loss and RPS punish a confident wrong answer, which accuracy
does not, and they are what the promotion gate reads.
"""
from __future__ import annotations

import numpy as np

OUTCOMES = ("H", "D", "A")
_IDX = {o: i for i, o in enumerate(OUTCOMES)}
_EPS = 1e-15


def _as_matrix(probs) -> np.ndarray:
    p = np.asarray(probs, dtype=float).reshape(-1, 3)
    p = np.clip(p, _EPS, 1.0)
    return p / p.sum(axis=1, keepdims=True)


def _as_index(actual) -> np.ndarray:
    return np.array([_IDX[a] for a in actual], dtype=int)


def log_loss_per_match(probs, actual) -> np.ndarray:
    p = _as_matrix(probs)
    y = _as_index(actual)
    return -np.log(p[np.arange(len(y)), y])


def brier_per_match(probs, actual) -> np.ndarray:
    """Multiclass Brier: mean squared error over the three outcomes."""
    p = _as_matrix(probs)
    y = _as_index(actual)
    onehot = np.zeros_like(p)
    onehot[np.arange(len(y)), y] = 1.0
    return ((p - onehot) ** 2).sum(axis=1)


def rps_per_match(probs, actual) -> np.ndarray:
    """Ranked probability score over the ordered outcomes H < D < A.

    Football results are ordinal, not merely categorical: predicting a home win
    when the game is drawn is a smaller error than predicting a home win when
    the away side wins. RPS is the standard measure in the football forecasting
    literature for exactly that reason, and it is the primary metric here.
    """
    p = _as_matrix(probs)
    y = _as_index(actual)
    onehot = np.zeros_like(p)
    onehot[np.arange(len(y)), y] = 1.0
    cum_p = np.cumsum(p, axis=1)[:, :-1]
    cum_o = np.cumsum(onehot, axis=1)[:, :-1]
    return ((cum_p - cum_o) ** 2).sum(axis=1) / (p.shape[1] - 1)


def accuracy(probs, actual) -> float:
    p = _as_matrix(probs)
    picks = p.argmax(axis=1)
    return float((picks == _as_index(actual)).mean())


def summarise(probs, actual) -> dict[str, float]:
    return {
        "n": int(len(actual)),
        "accuracy": accuracy(probs, actual),
        "log_loss": float(log_loss_per_match(probs, actual).mean()),
        "rps": float(rps_per_match(probs, actual).mean()),
        "brier": float(brier_per_match(probs, actual).mean()),
    }


def calibration_table(probs, actual, bins: int = 8) -> list[dict]:
    """Confidence in the model's own pick vs how often that pick was right.

    A well-calibrated model has mean_predicted ~= actual_rate in every row with
    a meaningful `n`. This is the table that tells you whether a stated 70% is
    a real 70%.
    """
    p = _as_matrix(probs)
    y = _as_index(actual)
    conf = p.max(axis=1)
    picks = p.argmax(axis=1)
    correct = (picks == y).astype(float)

    edges = np.linspace(1.0 / 3.0, 1.0, bins + 1)
    out = []
    for lo, hi in zip(edges[:-1], edges[1:]):
        mask = (conf >= lo) & (conf < hi if hi < 1.0 else conf <= hi)
        if not mask.any():
            continue
        out.append({
            "min_conf": round(float(lo), 3),
            "max_conf": round(float(hi), 3),
            "n": int(mask.sum()),
            "mean_predicted": round(float(conf[mask].mean()), 4),
            "actual_rate": round(float(correct[mask].mean()), 4),
            "gap": round(float(conf[mask].mean() - correct[mask].mean()), 4),
        })
    return out


def calibration_error(probs, actual, bins: int = 8) -> float:
    """Expected calibration error, weighted by bin size."""
    table = calibration_table(probs, actual, bins)
    if not table:
        return float("nan")
    total = sum(r["n"] for r in table)
    return float(sum(r["n"] * abs(r["gap"]) for r in table) / total)
