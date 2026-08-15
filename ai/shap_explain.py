"""Optional SHAP bridge for the GBM explanation path.

The core AI Lab deliberately does not depend on SHAP. When the observability
extras are installed, this module first asks TreeExplainer for probability-space
attributions relative to the fitted model's training-median row. SHAP 0.52 does
not provide that contract for every sklearn multiclass tree estimator, so the
second path uses SHAP's permutation explainer directly over ``predict_proba``.

Both paths therefore describe movements in the actual H/D/A probability vector.
If neither can satisfy that semantic contract, callers receive ``None`` and keep
the existing deterministic occlusion fallback. Raw-margin SHAP values are never
mislabelled as percentage-point probability movements.
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


def _tree_probability_values(shap, clf, frame: np.ndarray,
                             background: np.ndarray) -> np.ndarray | None:
    try:
        explainer = shap.TreeExplainer(
            clf,
            data=background,
            feature_perturbation="interventional",
            model_output="probability",
        )
        return explainer.shap_values(frame, check_additivity=False)
    except Exception:
        return None


def _permutation_probability_values(shap, clf, frame: np.ndarray,
                                    background: np.ndarray) -> np.ndarray | None:
    """Model-agnostic SHAP on predict_proba when TreeSHAP cannot expose it."""
    try:
        explainer = shap.Explainer(
            clf.predict_proba,
            background,
            algorithm="permutation",
        )
        explanation = explainer(
            frame,
            max_evals=max(2 * frame.shape[1] + 1, 3),
            silent=True,
        )
        return np.asarray(explanation.values, dtype=float)
    except Exception:
        return None


def shap_probability_contributions(
        clf,
        frame: np.ndarray,
        feature_names: Sequence[str],
        outcome_order: Sequence[str],
        background: np.ndarray,
        top_n: int = 8,
) -> list[list[dict]] | None:
    """Probability-space SHAP contributions relative to ``background``.

    TreeSHAP is preferred because it uses the fitted tree structure. For
    sklearn multiclass estimators where SHAP cannot emit probability-space tree
    values, permutation SHAP over ``predict_proba`` is used instead. That path
    is model-agnostic and approximate, but its units remain probabilities.
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

    method = "tree_shap_probability_vs_training_median"
    values = _tree_probability_values(shap, clf, frame, background)
    shaped = None
    if values is not None:
        shaped = _normalise_multiclass(
            values,
            n_rows=frame.shape[0],
            n_features=frame.shape[1],
            n_classes=len(classes),
        )

    if shaped is None:
        method = "permutation_shap_probability_vs_training_median"
        values = _permutation_probability_values(shap, clf, frame, background)
        if values is None:
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
                "method": method,
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
