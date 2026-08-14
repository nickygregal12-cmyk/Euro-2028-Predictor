"""Deterministic provenance and reload gates for trained AI Lab artefacts.

The artefact SHA-256 proves that stored bytes did not change.  It does not, by
itself, answer two other questions that matter when a challenger is promoted:

* were those bytes fitted from the same ordered evidence we think they were?;
* can those bytes be reloaded and reproduce a small, recorded scoring oracle?

This module answers both without adding a database contract.  Training records a
fingerprint of the exact ordered fit matrix plus result labels, a semantic
fingerprint of the bundle contract, and a tiny self-contained reference gate.
The gate is verified from a freshly reloaded joblib payload before the challenger
row is inserted.

The reference rows are a reproducibility oracle, not an accuracy test.  They may
therefore come from the fitted dataset: their job is to prove that serialisation,
feature order, calibration and scoring semantics survived the round trip.
"""
from __future__ import annotations

import hashlib
import json
from datetime import date, datetime
from typing import Any, Iterable

import numpy as np
import pandas as pd

from artifacts import ModelBundle

REFERENCE_GATE_SCHEMA = 1
REFERENCE_GATE_ROWS = 8
REFERENCE_ATOL = 1e-12


class ReferenceGateError(ValueError):
    """A stored model cannot reproduce the oracle recorded beside its bytes."""


def _canonical_scalar(value: Any) -> Any:
    """Convert dataframe/numpy scalars into stable JSON values."""
    if value is None:
        return None
    if isinstance(value, (pd.Timestamp, datetime, date)):
        return value.isoformat()
    if isinstance(value, np.generic):
        value = value.item()
    try:
        missing = bool(pd.isna(value))
    except (TypeError, ValueError):
        missing = False
    if missing:
        return None
    if isinstance(value, (bool, int, float, str)):
        return value
    return str(value)


def _digest_json_lines(header: dict[str, Any], rows: Iterable[Iterable[Any]]) -> str:
    digest = hashlib.sha256()
    digest.update(json.dumps(header, sort_keys=True, separators=(",", ":")).encode())
    digest.update(b"\n")
    for row in rows:
        payload = [_canonical_scalar(value) for value in row]
        digest.update(json.dumps(payload, ensure_ascii=True,
                                 separators=(",", ":"), allow_nan=False).encode())
        digest.update(b"\n")
    return digest.hexdigest()


def training_data_fingerprint(frame: pd.DataFrame, features: list[str]) -> str:
    """Hash the exact ordered evidence consumed by the final fit.

    Row order is deliberately significant.  A training run that sees the same
    matches in a different order is not assumed to be the same fit.  Natural-key
    and result columns are included when present so two feature matrices that
    happen to be numerically identical cannot conceal different football
    evidence.
    """
    context = [name for name in (
        "match_date", "season", "division", "home_canonical", "away_canonical",
        "result",
    ) if name in frame.columns]
    columns = context + [name for name in features if name not in context]
    missing = [name for name in features if name not in frame.columns]
    if missing:
        raise ValueError(f"Cannot fingerprint training data; missing features: {missing}")
    return _digest_json_lines(
        {"schema": 1, "columns": columns, "rows": len(frame)},
        frame.loc[:, columns].itertuples(index=False, name=None),
    )


def bundle_contract_fingerprint(bundle: ModelBundle) -> str:
    """Hash the semantic contract needed to interpret an artefact.

    Model coefficients are intentionally excluded because the byte-level
    artefact SHA already owns that question.  This fingerprint catches changes
    in feature order, feature meaning version, calibration shape or model
    identity even when a caller is looking only at metadata.
    """
    payload = {
        "schema": int(bundle.schema),
        "family": bundle.family,
        "league": bundle.league,
        "version": bundle.version,
        "features": list(bundle.features),
        "features_version": bundle.features_version,
        "feature_groups": list(bundle.feature_groups),
        "half_life_days": bundle.half_life_days,
        "elo_transition": bundle.elo_transition,
        "trained_through": _canonical_scalar(bundle.trained_through),
        "calibrator": (type(bundle.calibrator).__qualname__
                       if bundle.calibrator is not None else None),
        "components": bundle.components,
    }
    encoded = json.dumps(payload, sort_keys=True, separators=(",", ":"),
                         default=str).encode()
    return hashlib.sha256(encoded).hexdigest()


def build_reference_gate(bundle: ModelBundle, frame: pd.DataFrame,
                         rows: int = REFERENCE_GATE_ROWS) -> dict[str, Any]:
    """Record a tiny self-contained scoring oracle for a fitted bundle."""
    if rows < 1:
        raise ValueError("Reference gate needs at least one row")
    matrix = bundle.matrix(frame).tail(min(rows, len(frame))).copy()
    if matrix.empty:
        raise ValueError("Reference gate cannot be built from an empty frame")

    raw, calibrated = bundle.predict_both(matrix)
    inputs = [[_canonical_scalar(value) for value in row]
              for row in matrix.itertuples(index=False, name=None)]
    gate = {
        "schema": REFERENCE_GATE_SCHEMA,
        "bundle_contract_sha256": bundle_contract_fingerprint(bundle),
        "features": list(bundle.features),
        "inputs": inputs,
        "raw_probabilities": np.asarray(raw, dtype=float).tolist(),
        "calibrated_probabilities": np.asarray(calibrated, dtype=float).tolist(),
        "atol": REFERENCE_ATOL,
    }
    manifest = json.dumps(gate, sort_keys=True, separators=(",", ":"),
                          allow_nan=False).encode()
    gate["manifest_sha256"] = hashlib.sha256(manifest).hexdigest()
    return gate


def verify_reference_gate(bundle: ModelBundle, gate: dict[str, Any]) -> None:
    """Fail closed unless a reloaded bundle reproduces its recorded oracle."""
    if int(gate.get("schema", -1)) != REFERENCE_GATE_SCHEMA:
        raise ReferenceGateError(
            f"Unsupported reference-gate schema {gate.get('schema')!r}")

    expected_contract = gate.get("bundle_contract_sha256")
    actual_contract = bundle_contract_fingerprint(bundle)
    if expected_contract != actual_contract:
        raise ReferenceGateError(
            "Bundle semantic contract changed: "
            f"expected {expected_contract}, got {actual_contract}")

    features = gate.get("features")
    if features != list(bundle.features):
        raise ReferenceGateError(
            "Reference-gate feature order does not match the stored artefact")

    inputs = gate.get("inputs") or []
    if not inputs:
        raise ReferenceGateError("Reference gate contains no input rows")
    frame = pd.DataFrame(inputs, columns=features)
    raw, calibrated = bundle.predict_both(frame)
    atol = float(gate.get("atol", REFERENCE_ATOL))

    expected_raw = np.asarray(gate.get("raw_probabilities"), dtype=float)
    expected_calibrated = np.asarray(gate.get("calibrated_probabilities"), dtype=float)
    actual_raw = np.asarray(raw, dtype=float)
    actual_calibrated = np.asarray(calibrated, dtype=float)

    if expected_raw.shape != actual_raw.shape or not np.allclose(
            expected_raw, actual_raw, rtol=0.0, atol=atol):
        delta = (float(np.max(np.abs(expected_raw - actual_raw)))
                 if expected_raw.shape == actual_raw.shape else float("inf"))
        raise ReferenceGateError(
            f"Reloaded raw probabilities do not match the oracle; max delta {delta}")
    if expected_calibrated.shape != actual_calibrated.shape or not np.allclose(
            expected_calibrated, actual_calibrated, rtol=0.0, atol=atol):
        delta = (float(np.max(np.abs(expected_calibrated - actual_calibrated)))
                 if expected_calibrated.shape == actual_calibrated.shape else float("inf"))
        raise ReferenceGateError(
            "Reloaded calibrated probabilities do not match the oracle; "
            f"max delta {delta}")

    manifest_copy = dict(gate)
    recorded_manifest = manifest_copy.pop("manifest_sha256", None)
    encoded = json.dumps(manifest_copy, sort_keys=True, separators=(",", ":"),
                         allow_nan=False).encode()
    actual_manifest = hashlib.sha256(encoded).hexdigest()
    if recorded_manifest != actual_manifest:
        raise ReferenceGateError(
            "Reference-gate manifest was modified after it was recorded")
