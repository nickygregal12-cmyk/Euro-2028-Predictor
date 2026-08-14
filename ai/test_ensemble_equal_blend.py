"""Regression for equal_blend being both benchmark and selected meta-model."""
from __future__ import annotations

import numpy as np

import ensemble


def test_equal_blend_selected_meta_is_scored_once_per_fold():
    """When meta == equal_blend, do not append the same candidate twice.

    The Development materialisation run for EPL/ECH exposed this as a
    `(12,) - (6,)` broadcast failure: `evaluate_out_of_time` iterated over
    `("equal_blend", meta)` twice when `meta` was itself equal_blend.
    """
    seasons = np.asarray(
        [f"s{i}" for i in range(9) for _ in range(3)], dtype=object)
    actual = np.asarray(["H", "D", "A"] * 9, dtype=object)

    poisson = np.tile([[0.52, 0.28, 0.20],
                       [0.30, 0.40, 0.30],
                       [0.25, 0.27, 0.48]], (9, 1))
    elo = np.tile([[0.50, 0.30, 0.20],
                   [0.31, 0.38, 0.31],
                   [0.24, 0.29, 0.47]], (9, 1))

    oof = ensemble.OutOfFold(
        families=("poisson", "elo"),
        probs={"poisson": poisson, "elo": elo},
        actual=actual,
        fold_labels=seasons,
        row_index=np.arange(len(actual)),
    )

    result = ensemble.evaluate_out_of_time(
        oof, meta="equal_blend", min_fit_folds=3)

    expected_folds = 9 - 3
    assert result["equal_blend"]["folds"] == expected_folds
    assert len(result["equal_blend"]["per_fold"]) == expected_folds
    assert result["equal_blend"]["vs_best_base"]["base"] in {"poisson", "elo"}
