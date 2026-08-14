from __future__ import annotations

import hashlib
from datetime import date

import joblib
import numpy as np
import pandas as pd
import pytest

import train
import train_verified
from artifacts import ModelBundle
from reproducibility import (
    bundle_contract_fingerprint,
    training_data_fingerprint,
    verify_reference_gate,
)


class DeterministicModel:
    uses_market = False

    def predict_proba(self, frame: pd.DataFrame) -> np.ndarray:
        values = frame.to_numpy(dtype=float)
        home = 0.46 + (values[:, 0] - values[:, 1]) * 0.03
        draw = np.full(len(frame), 0.26)
        away = 1.0 - home - draw
        return np.column_stack([home, draw, away])


def _frame() -> pd.DataFrame:
    return pd.DataFrame({
        "match_date": pd.to_datetime([
            "2026-07-30", "2026-08-01", "2026-08-03", "2026-08-05",
        ]),
        "season": ["2627"] * 4,
        "division": ["E0"] * 4,
        "home_canonical": ["A", "B", "C", "D"],
        "away_canonical": ["B", "C", "D", "A"],
        "result": ["H", "D", "A", "H"],
        "elo_home": [1.2, 1.1, 0.9, 1.4],
        "elo_away": [0.8, 1.0, 1.2, 0.7],
    })


def _bundle() -> ModelBundle:
    return ModelBundle(
        model=DeterministicModel(),
        features=["elo_home", "elo_away"],
        features_version="f-test",
        feature_groups=("core",),
        family="poisson",
        league="EPL",
        version="verified-v1",
        half_life_days=900.0,
        elo_transition="division_prior",
        trained_through=date(2026, 8, 5),
    )


def _record() -> dict:
    return {
        "league": "EPL",
        "version": "verified-v1",
        "family": "poisson",
        "artifact_sha256": "pre-evidence-placeholder",
    }


def test_prepare_verified_artifact_embeds_fingerprints_and_reload_oracle(tmp_path):
    frame = _frame()
    artifact = tmp_path / "model.joblib"
    joblib.dump(_bundle().to_payload(), artifact)
    before = hashlib.sha256(artifact.read_bytes()).hexdigest()

    record = train_verified.prepare_verified_artifact(_record(), artifact, frame)

    after = hashlib.sha256(artifact.read_bytes()).hexdigest()
    assert after != before, "embedding reproducibility evidence must change the bytes"
    assert record["artifact_sha256"] == after

    reloaded = ModelBundle.from_payload(joblib.load(artifact))
    evidence = reloaded.metadata["reproducibility"]
    assert evidence["schema"] == train_verified.REPRODUCIBILITY_SCHEMA
    assert evidence["training_rows"] == len(frame)
    assert evidence["training_data_sha256"] == training_data_fingerprint(
        frame, list(reloaded.features))
    assert evidence["bundle_contract_sha256"] == bundle_contract_fingerprint(reloaded)
    verify_reference_gate(reloaded, evidence["reference_gate"])


def test_prepare_verified_artifact_refuses_record_artefact_identity_mismatch(tmp_path):
    artifact = tmp_path / "model.joblib"
    joblib.dump(_bundle().to_payload(), artifact)
    wrong = {**_record(), "league": "SPL"}

    with pytest.raises(train_verified.VerifiedTrainingError, match="league"):
        train_verified.prepare_verified_artifact(wrong, artifact, _frame())


def test_operational_entrypoint_verifies_before_delegating_to_atomic_insert(
        tmp_path, monkeypatch):
    frame = _frame()
    artifact = tmp_path / "model.joblib"
    joblib.dump(_bundle().to_payload(), artifact)
    inserted: dict = {}

    def fake_build_dataset(league_key, *args, **kwargs):
        assert league_key == "EPL"
        return frame

    def fake_atomic_insert(record, path):
        # If this callback fires, `train_verified` has already rewritten and
        # freshly reloaded the artefact.  Assert that evidence exists here — at
        # the exact boundary before the real database transaction would start.
        reloaded = ModelBundle.from_payload(joblib.load(path))
        evidence = reloaded.metadata["reproducibility"]
        verify_reference_gate(reloaded, evidence["reference_gate"])
        assert record["artifact_sha256"] == hashlib.sha256(
            artifact.read_bytes()).hexdigest()
        inserted.update(record)
        return "model-id"

    monkeypatch.setattr(train, "build_dataset", fake_build_dataset)
    monkeypatch.setattr(train, "insert_model_with_artifact", fake_atomic_insert)

    def fake_train_main():
        # These names are looked up on the train module at call time, exactly as
        # the real main function does, so the wrapper's interception is tested.
        train.build_dataset("EPL")
        return train.insert_model_with_artifact(_record(), artifact)

    monkeypatch.setattr(train, "main", fake_train_main)

    assert train_verified.main() == "model-id"
    assert inserted["league"] == "EPL"
    assert "reproducibility" in ModelBundle.from_payload(
        joblib.load(artifact)).metadata


def test_operational_entrypoint_refuses_insert_without_captured_training_frame(
        tmp_path, monkeypatch):
    artifact = tmp_path / "model.joblib"
    joblib.dump(_bundle().to_payload(), artifact)
    inserted = False

    monkeypatch.setattr(train, "build_dataset", lambda league, *a, **k: _frame())

    def fake_atomic_insert(record, path):
        nonlocal inserted
        inserted = True
        return "should-not-happen"

    monkeypatch.setattr(train, "insert_model_with_artifact", fake_atomic_insert)
    monkeypatch.setattr(
        train,
        "main",
        lambda: train.insert_model_with_artifact(
            {**_record(), "league": "SPL"}, artifact),
    )

    with pytest.raises(train_verified.VerifiedTrainingError, match="No captured"):
        train_verified.main()
    assert inserted is False
