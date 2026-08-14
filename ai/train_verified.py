"""Verified entrypoint for operational challenger materialisation.

`train.py` remains the model-training implementation.  This wrapper changes one
thing about the operational path used by `train_selected_challengers.py`: the
final fit frame is captured and the artefact is refused before its database row
is inserted unless freshly reloaded bytes reproduce a recorded scoring oracle.

Why a wrapper rather than duplicating training logic?  The mature evaluation,
calibration and final-fit separation stays in one place.  The wrapper only owns
the extra boundary between "joblib was written" and "challenger may become
durable database evidence".
"""
from __future__ import annotations

import hashlib
from pathlib import Path
from typing import Any

import joblib
import pandas as pd

import train
from artifacts import ModelBundle
from reproducibility import (
    build_reference_gate,
    bundle_contract_fingerprint,
    training_data_fingerprint,
    verify_reference_gate,
)

REPRODUCIBILITY_SCHEMA = 1


class VerifiedTrainingError(ValueError):
    """The candidate artefact failed the pre-insert reproducibility boundary."""


def prepare_verified_artifact(record: dict[str, Any], path: str | Path,
                              frame: pd.DataFrame) -> dict[str, Any]:
    """Embed and verify reproducibility evidence, returning corrected metadata.

    The caller has not inserted anything yet.  We load the bytes that training
    just wrote, derive fingerprints from the exact final-fit frame, record a
    small self-contained probability oracle inside the bundle metadata, write
    the augmented bundle back, reload those exact bytes and verify the oracle.

    The artefact byte SHA necessarily changes when the evidence is embedded, so
    the returned record contains the SHA of the *verified* bytes that will be
    handed to the existing atomic model+artefact insert.
    """
    artifact = Path(path)
    bundle = ModelBundle.from_payload(joblib.load(artifact))

    league = str(record.get("league") or "")
    version = str(record.get("version") or "")
    if not league or bundle.league != league:
        raise VerifiedTrainingError(
            f"Training record league {league!r} does not match artefact league "
            f"{bundle.league!r}.")
    if version and bundle.version != version:
        raise VerifiedTrainingError(
            f"Training record version {version!r} does not match artefact version "
            f"{bundle.version!r}.")

    data_sha = training_data_fingerprint(frame, list(bundle.features))
    contract_sha = bundle_contract_fingerprint(bundle)
    gate = build_reference_gate(bundle, frame)

    metadata = dict(bundle.metadata)
    metadata["reproducibility"] = {
        "schema": REPRODUCIBILITY_SCHEMA,
        "training_data_sha256": data_sha,
        "bundle_contract_sha256": contract_sha,
        "training_rows": int(len(frame)),
        "reference_gate": gate,
    }
    bundle.metadata = metadata
    joblib.dump(bundle.to_payload(), artifact)

    # Verification is against a fresh deserialisation of the exact augmented
    # bytes, not against the live estimator still in memory.
    reloaded = ModelBundle.from_payload(joblib.load(artifact))
    evidence = reloaded.metadata.get("reproducibility") or {}
    if evidence.get("schema") != REPRODUCIBILITY_SCHEMA:
        raise VerifiedTrainingError("Reloaded artefact lost reproducibility metadata.")
    if evidence.get("training_data_sha256") != training_data_fingerprint(
            frame, list(reloaded.features)):
        raise VerifiedTrainingError(
            "Reloaded artefact no longer matches the captured final-fit evidence.")
    if evidence.get("bundle_contract_sha256") != bundle_contract_fingerprint(reloaded):
        raise VerifiedTrainingError(
            "Reloaded artefact semantic contract no longer matches its fingerprint.")
    verify_reference_gate(reloaded, evidence.get("reference_gate") or {})

    sha = hashlib.sha256(artifact.read_bytes()).hexdigest()
    return {**record, "artifact_sha256": sha}


def main() -> int:
    """Run `train.main` with a fail-closed pre-insert verification boundary."""
    original_build_dataset = train.build_dataset
    original_insert = train.insert_model_with_artifact
    captured: dict[str, pd.DataFrame] = {}

    def capture_build_dataset(league_key: str, *args, **kwargs) -> pd.DataFrame:
        frame = original_build_dataset(league_key, *args, **kwargs)
        captured[league_key] = frame
        return frame

    def verified_insert(record: dict[str, Any], path: str | Path) -> str:
        league = str(record.get("league") or "")
        frame = captured.get(league)
        if frame is None:
            raise VerifiedTrainingError(
                f"No captured final-fit frame exists for league {league!r}; "
                "refusing an unverified challenger insert.")
        verified_record = prepare_verified_artifact(record, path, frame)
        return original_insert(verified_record, path)

    train.build_dataset = capture_build_dataset
    train.insert_model_with_artifact = verified_insert
    try:
        return train.main()
    finally:
        # Keep importers/tests deterministic if they invoke this entrypoint in
        # process rather than through the normal subprocess runner.
        train.build_dataset = original_build_dataset
        train.insert_model_with_artifact = original_insert


if __name__ == "__main__":
    raise SystemExit(main())
