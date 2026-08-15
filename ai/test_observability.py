from __future__ import annotations

from pathlib import Path

import numpy as np
import pandas as pd
import pytest

from model_zoo import GradientBoostedModel, OUTCOMES
from observability import _select_columns, build_drift_report


def test_observability_column_selection_is_explicit_and_symmetric():
    reference = pd.DataFrame({"elo_diff": [1.0], "form": [2.0], "reference_only": [3.0]})
    current = pd.DataFrame({"elo_diff": [4.0], "form": [5.0], "current_only": [6.0]})
    ref, cur = _select_columns(reference, current, None)
    assert list(ref.columns) == ["elo_diff", "form"]
    assert list(cur.columns) == ["elo_diff", "form"]


def test_evidently_writes_local_html_and_json(tmp_path: Path):
    pytest.importorskip("evidently")
    rng = np.random.default_rng(20280815)
    reference = pd.DataFrame({
        "elo_diff": rng.normal(0, 100, 120),
        "home_form": rng.normal(1.4, 0.3, 120),
    })
    current = pd.DataFrame({
        "elo_diff": rng.normal(35, 115, 80),
        "home_form": rng.normal(1.5, 0.35, 80),
    })
    output = tmp_path / "drift.html"
    payload = build_drift_report(reference, current, output)
    assert output.exists()
    assert output.with_suffix(".json").exists()
    assert isinstance(payload, dict)


def test_gbm_uses_probability_shap_when_optional_extra_is_installed():
    pytest.importorskip("shap")
    rng = np.random.default_rng(20280815)
    X = pd.DataFrame({
        "elo_diff": rng.normal(0, 120, 180),
        "form_diff": rng.normal(0, 0.7, 180),
        "rest_diff": rng.normal(0, 2.0, 180),
    })
    latent = X["elo_diff"] / 180 + X["form_diff"] * 0.7 - X["rest_diff"] * 0.03
    y = pd.Series(np.where(latent > 0.45, "H", np.where(latent < -0.45, "A", "D")))

    model = GradientBoostedModel(max_iter=40, min_samples_leaf=8).fit(X, y)
    rows = model.contributions(X.head(2), top_n=3)
    assert len(rows) == 2
    assert all(rows)

    allowed = {
        "tree_shap_probability_vs_training_median",
        "permutation_shap_probability_vs_training_median",
    }
    for row in rows:
        assert all(item["method"] in allowed for item in row)
        assert all(np.isfinite(item["delta_home"]) for item in row)
        assert all(np.isfinite(item["delta_draw"]) for item in row)
        assert all(np.isfinite(item["delta_away"]) for item in row)

    # With all three features retained by top_n, the SHAP contributions must
    # add back to the model's H/D/A probability movement from the same training
    # median background. This is the semantic contract the raw-margin TreeSHAP
    # fallback in the first runner could not satisfy.
    class_order = [list(model.clf.classes_).index(outcome) for outcome in OUTCOMES]
    background = model.clf.predict_proba(model.medians_.reshape(1, -1))[0][class_order]
    predicted = model.predict_proba(X.head(2))
    for row_index, row in enumerate(rows):
        attributed = np.array([
            sum(item["delta_home"] for item in row),
            sum(item["delta_draw"] for item in row),
            sum(item["delta_away"] for item in row),
        ])
        np.testing.assert_allclose(attributed, predicted[row_index] - background, atol=1e-4)
