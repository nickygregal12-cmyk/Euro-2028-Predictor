from __future__ import annotations

from datetime import date

import joblib
import numpy as np
import pandas as pd
import pytest

from artifacts import ModelBundle
from reproducibility import (
    ReferenceGateError,
    build_reference_gate,
    bundle_contract_fingerprint,
    training_data_fingerprint,
    verify_reference_gate,
)


class DeterministicModel:
    uses_market = False

    def __init__(self, scale: float = 1.0):
        self.scale = scale

    def predict_proba(self, frame: pd.DataFrame) -> np.ndarray:
        values = frame.to_numpy(dtype=float)
        home = 0.45 + (values[:, 0] - values[:, 1]) * 0.04 * self.scale
        draw = np.full(len(frame), 0.27)
        away = 1.0 - home - draw
        probs = np.column_stack([home, draw, away])
        return probs / probs.sum(axis=1, keepdims=True)


def _frame() -> pd.DataFrame:
    return pd.DataFrame({
        "match_date": pd.to_datetime([
            "2026-08-01", "2026-08-02", "2026-08-03", "2026-08-04",
        ]),
        "season": ["2627"] * 4,
        "division": ["E0"] * 4,
        "home_canonical": ["A", "B", "C", "D"],
        "away_canonical": ["B", "C", "D", "A"],
        "result": ["H", "D", "A", "H"],
        "elo_home": [1.0, 1.2, 0.9, 1.4],
        "elo_away": [0.8, 1.0, 1.1, 0.7],
    })


def _bundle() -> ModelBundle:
    return ModelBundle(
        model=DeterministicModel(),
        features=["elo_home", "elo_away"],
        features_version="f-test",
        feature_groups=("core",),
        family="poisson",
        league="EPL",
        version="test-v1",
        half_life_days=730.0,
        elo_transition="division_prior",
        trained_through=date(2026, 8, 4),
    )


def test_training_data_fingerprint_changes_with_evidence_and_order():
    frame = _frame()
    original = training_data_fingerprint(frame, ["elo_home", "elo_away"])

    changed = frame.copy()
    changed.loc[2, "elo_home"] += 0.01
    assert training_data_fingerprint(changed, ["elo_home", "elo_away"]) != original

    reordered = frame.iloc[::-1].reset_index(drop=True)
    assert training_data_fingerprint(reordered, ["elo_home", "elo_away"]) != original


def test_bundle_contract_fingerprint_catches_feature_order_change():
    bundle = _bundle()
    original = bundle_contract_fingerprint(bundle)
    bundle.features = list(reversed(bundle.features))
    assert bundle_contract_fingerprint(bundle) != original


def test_reference_gate_survives_joblib_round_trip(tmp_path):
    bundle = _bundle()
    gate = build_reference_gate(bundle, _frame())
    bundle.metadata["reference_gate"] = gate

    artifact = tmp_path / "model.joblib"
    joblib.dump(bundle.to_payload(), artifact)
    reloaded = ModelBundle.from_payload(joblib.load(artifact))

    verify_reference_gate(reloaded, reloaded.metadata["reference_gate"])


def test_reference_gate_rejects_changed_model_behavior():
    bundle = _bundle()
    gate = build_reference_gate(bundle, _frame())
    bundle.model.scale = 2.0

    with pytest.raises(ReferenceGateError, match="raw probabilities"):
        verify_reference_gate(bundle, gate)


def test_reference_gate_rejects_manifest_tampering():
    bundle = _bundle()
    gate = build_reference_gate(bundle, _frame())
    gate["calibrated_probabilities"][0][0] += 1e-6

    with pytest.raises(ReferenceGateError):
        verify_reference_gate(bundle, gate)
