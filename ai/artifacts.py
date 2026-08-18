"""What a stored model is, and what it needs to be scored again.

The defect this module exists to remove: `train.py` stored
`{"model": model, "features": FEATURE_NAMES}` and `predict.py` then ignored
the stored list and sliced the live feature frame by the CURRENT source-code
`FEATURE_NAMES`. Those two agree only until somebody edits `DEFAULT_GROUPS`,
which is a thing this repository does deliberately and often — every ablation
that keeps a family changes it.

The failure is silent and total. Add a family and the promoted model, trained
without it, is handed a wider matrix: scikit-learn raises on the column count,
so that direction fails loudly and is not the dangerous one. REMOVE a family,
or reorder one, and the matrix still has plausible columns in the wrong
positions — a Poisson regression happily multiplies a corner count by a
coefficient fitted for shots on target and returns a number. Nothing raises.
The predictions are simply wrong, in a way no metric on the training report
can see, because the training report was computed before any of this.

So an artefact carries its own schema, and scoring goes through
`ModelBundle.matrix`, which reproduces the exact columns in the exact order or
refuses by name. A missing feature is never filled with a neutral value: a
neutral value is a claim about a team, and the honest response to "the code
that built this feature no longer exists" is to stop.
"""
from __future__ import annotations

from dataclasses import dataclass, field
from datetime import date
from typing import Any, Iterable

import numpy as np
import pandas as pd

# Bumped when the SHAPE of a stored artefact changes. Legacy payloads (schema
# 1, the two-key dict) are still loadable: they carry a feature list, which is
# the one thing that must never be guessed.
ARTIFACT_SCHEMA = 2


class MissingFeatureError(KeyError):
    """A stored model asked for a feature the current builder cannot produce."""


def _coverage_provenance(model: Any) -> dict[str, Any] | None:
    """Read the support decision back from a fitted model, including ensembles.

    This is deliberately derived from the fitted bytes rather than reconstructed
    from source defaults. A model trained in a sparse historical regime must be
    able to say which groups actually reached that fit even after DEFAULT_GROUPS
    changes again.
    """
    direct = getattr(model, "coverage_provenance", None)
    if isinstance(direct, dict):
        return dict(direct)

    components = getattr(model, "models", None)
    if isinstance(components, dict):
        per_family = {}
        for family, component in components.items():
            found = _coverage_provenance(component)
            if found is not None:
                per_family[str(family)] = found
        if per_family:
            return {"components": per_family}
    return None


@dataclass
class ModelBundle:
    """A model plus everything needed to feed it the inputs it was fitted on."""

    model: Any
    features: list[str]
    features_version: str = "f1"
    feature_groups: tuple[str, ...] = ()
    family: str = "unknown"
    league: str | None = None
    version: str | None = None
    half_life_days: float | None = None
    elo_transition: str = "global_mean"
    # Applied probability calibration, fitted out-of-fold. None means the raw
    # model output is the final answer, which is a statement worth being able
    # to read off the artefact rather than infer from its absence.
    calibrator: Any | None = None
    # Independent base models and their meta-model, for an ensemble artefact.
    # Packaged INSIDE the one current model rather than as sibling rows, so the
    # one-current-model-per-league guarantee in ai.models is untouched.
    components: dict[str, Any] = field(default_factory=dict)
    trained_through: date | None = None
    schema: int = ARTIFACT_SCHEMA
    metadata: dict[str, Any] = field(default_factory=dict)

    # -- serialisation -------------------------------------------------------

    def to_payload(self) -> dict[str, Any]:
        """What `joblib.dump` is given. `model` and `features` keep their
        original names and positions so an older reader still works."""
        metadata = dict(self.metadata)
        coverage = _coverage_provenance(self.model)
        if coverage is not None:
            # The caller may add other training metadata, but the effective
            # groups are a property of the fitted bytes and are therefore
            # always sourced from the model rather than trusted from a report.
            metadata["coverage_guard"] = coverage
        return {
            "model": self.model,
            "features": list(self.features),
            "features_version": self.features_version,
            "feature_groups": list(self.feature_groups),
            "family": self.family,
            "league": self.league,
            "version": self.version,
            "half_life_days": self.half_life_days,
            "elo_transition": self.elo_transition,
            "calibrator": self.calibrator,
            "components": self.components,
            "trained_through": self.trained_through,
            "schema": self.schema,
            "metadata": metadata,
        }

    @classmethod
    def from_payload(cls, payload: Any) -> "ModelBundle":
        if isinstance(payload, cls):
            return payload
        if not isinstance(payload, dict) or "model" not in payload:
            raise ValueError(
                "Model artefact is not a bundle. It must be a dict carrying at "
                "least `model` and `features`; a bare estimator cannot state "
                "which columns it was fitted on.")
        features = payload.get("features")
        if not features:
            raise ValueError(
                "Model artefact carries no feature list. Refusing to guess it "
                "from the current source: the feature groups this package "
                "trains on change whenever an ablation keeps a family, and a "
                "guess would silently score the model on the wrong columns.")
        return cls(
            model=payload["model"],
            features=list(features),
            features_version=payload.get("features_version", "f1"),
            feature_groups=tuple(payload.get("feature_groups", ()) or ()),
            family=payload.get("family") or getattr(payload["model"], "family", "unknown"),
            league=payload.get("league"),
            version=payload.get("version"),
            half_life_days=payload.get("half_life_days"),
            elo_transition=payload.get("elo_transition", "global_mean"),
            calibrator=payload.get("calibrator"),
            components=payload.get("components") or {},
            trained_through=payload.get("trained_through"),
            schema=int(payload.get("schema", 1)),
            metadata=payload.get("metadata") or {},
        )

    # -- the guarantee -------------------------------------------------------

    def matrix(self, rows: "pd.DataFrame | Iterable[dict]") -> pd.DataFrame:
        """The exact columns this model was fitted on, in the fitted order.

        Extra columns are dropped, which is what makes a NEW feature family
        harmless to an OLD artefact. Missing columns raise, which is what stops
        a REMOVED feature family from being silently replaced by whatever
        happened to be in that position.
        """
        frame = rows if isinstance(rows, pd.DataFrame) else pd.DataFrame(list(rows))
        missing = [name for name in self.features if name not in frame.columns]
        if missing:
            raise MissingFeatureError(
                f"Model {self.label()} was trained on {len(self.features)} "
                f"features and the current feature builder cannot produce "
                f"{len(missing)} of them: {missing}. This artefact was built "
                f"from feature groups {list(self.feature_groups) or 'unrecorded'} "
                f"at features_version {self.features_version!r}. Retrain it, or "
                f"restore the code that produced those columns — they are not "
                f"substituted with neutral values, because a neutral value is "
                f"a claim about a team rather than a missing measurement.")
        return frame.loc[:, self.features]

    def features_version_warning(self, current_version: str) -> str | None:
        """A name-for-name match under a changed builder is not a match.

        Names are checked by `matrix` and refused hard. A version change is
        different: every column is still produced, but its MEANING may have
        moved — the division-aware Elo transition changes `elo_home` without
        changing its name. That is a reason to retrain, not a reason to refuse
        to score, because refusing would stop the lab silently on a Monday.
        """
        if self.features_version == current_version:
            return None
        return (f"Model {self.label()} was trained at features_version "
                f"{self.features_version!r}; this package now builds "
                f"{current_version!r}. Column names still match, so scoring "
                f"proceeds, but a feature's meaning may have changed since. "
                f"Retrain and re-promote when convenient.")

    def label(self) -> str:
        return " ".join(str(p) for p in (self.league, self.version, self.family) if p)

    # -- scoring -------------------------------------------------------------

    def predict_proba(self, rows, calibrated: bool = True) -> np.ndarray:
        """H/D/A probabilities. Calibrated when a calibrator was stored."""
        X = self.matrix(rows)
        raw = np.asarray(self.model.predict_proba(X), dtype=float)
        if calibrated and self.calibrator is not None:
            return np.asarray(self.calibrator.transform(raw), dtype=float)
        return raw

    def predict_both(self, rows) -> tuple[np.ndarray, np.ndarray]:
        """(raw, calibrated). Both are stored with a prediction: the raw one is
        what the model said, the calibrated one is what was acted on, and a
        diagnosis six weeks later needs to be able to tell them apart."""
        X = self.matrix(rows)
        raw = np.asarray(self.model.predict_proba(X), dtype=float)
        if self.calibrator is None:
            return raw, raw
        return raw, np.asarray(self.calibrator.transform(raw), dtype=float)


def bundle_from_artifact(payload: Any) -> ModelBundle:
    """Convenience for `db.load_model_artifact` output."""
    return ModelBundle.from_payload(payload)
