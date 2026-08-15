"""Optional SHAP bridge for the GBM explanation path.

The core AI Lab deliberately does not depend on SHAP.  When the observability
extras are installed, this module asks TreeExplainer for a probability-space
attribution relative to the fitted model's training-median row.  If the
installed SHAP/sklearn combination cannot provide that exact contract, callers
receive ``None`` and retain the existing deterministic occlusion fallback.

That fail-closed behaviour matters: raw-margin SHAP values must not be labelled
as percentage-point probability movements just to say SHAP is enabled.
"""
from __future__ import annotations

from typing import Sequence

import numpy as np


def _normalise_multiclass(values, n_rows: int, n_features: int,
                          n_classes: int) -> np.ndarray | None:
    """Return SHAP values as (rows, features, classes), or ``None``."""
    if isinstance(values, list):
        if len(values) != n_classes:
            return None
        arrays = [np.asarray(v, dtype=float) for v in values]
        if any(a.shape != (n_rows, n_features) for a in arrays):
            return None
        return np.stack(arrays, axis=-1)

    arr = np.asarray(values, dtype=float)
    if arr.shape == (n_rows, n_features, n_classes):
        return arr
    if arr.shape == (n_classes, n_rows, n_features):
        return np.transpose(arr, (1, 2, 0))
    return None


def tree_shap_probability_contributions(
        clf,
        frame: np.ndarray,
        feature_names: Sequence[str],
        outcome_order: Sequence[str],
        background: np.ndarray,
        top_n: int = 8,
) -> list[list[dict]] | None:
    """Probability-space TreeSHAP contributions, relative to ``background``.

    ``None`` means the optional dependency is absent or the installed estimator
    cannot satisfy probability-space TreeSHAP.  The caller should fall back to
    its existing explanation rather than weakening the semantic contract.
    """
    try:
        import shap  # type: ignore
    except ImportError:
        return None

    frame = np.asarray(frame, dtype=float)
    background = np.asarray(background, dtype=float)
    if frame.ndim != 2 or background.ndim != 2:
        return None
    if frame.shape[1] != len(feature_names) or background.shape[1] != frame.shape[1]:
        return None

    classes = list(getattr(clf, "classes_", []))
    if not classes or any(outcome not in classes for outcome in outcome_order):
        return None

    try:
        explainer = shap.TreeExplainer(
            clf,
            data=background,
            feature_perturbation="interventional",
            model_output="probability",
        )
        values = explainer.shap_values(frame, check_additivity=False)
    except Exception:
        # Do not silently fall back to raw-margin SHAP values: explain.py treats
        # delta_home/draw/away as movements in the probability vector.
        return None

    shaped = _normalise_multiclass(
        values,
        n_rows=frame.shape[0],
        n_features=frame.shape[1],
        n_classes=len(classes),
    )
    if shaped is None:
        return None

    class_indices = [classes.index(outcome) for outcome in outcome_order]
    shaped = shaped[:, :, class_indices]

    output: list[list[dict]] = []
    for row_index, row in enumerate(frame):
        contributions: list[dict] = []
        for feature_index, name in enumerate(feature_names):
            effects = shaped[row_index, feature_index]
            if not np.isfinite(effects).all():
                continue
            contributions.append({
                "feature": name,
                "value": float(row[feature_index]),
                "delta_home": float(effects[0]),
                "delta_draw": float(effects[1]),
                "delta_away": float(effects[2]),
                "method": "tree_shap_probability_vs_training_median",
            })
        contributions.sort(
            key=lambda item: -max(
                abs(item["delta_home"]),
                abs(item["delta_draw"]),
                abs(item["delta_away"]),
            )
        )
        output.append(contributions[:top_n])
    return output
