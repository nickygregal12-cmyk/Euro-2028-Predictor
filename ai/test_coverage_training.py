"""The coverage-regime guard as a property of the model that actually ships.

The research study proved the rule on nine leagues. These tests close the gap
that study deliberately left open: scheduled/deployable training must use the
same rule per fit, sparse groups must disappear from the estimator without
breaking the public artefact schema, and the stored bytes must say what was
actually used.
"""
from __future__ import annotations

from pathlib import Path

import joblib
import numpy as np

from artifacts import ARTIFACT_SCHEMA, ModelBundle
from features import feature_names, known_indicators
from fitting import CoverageGuardedModel, fit_family
from test_training import _frame


def _coverage_frame(support: float):
    frame = _frame().copy()
    for column in known_indicators("shots_volume"):
        assert column in frame.columns
        frame[column] = support
    return frame


def test_deployable_fit_drops_a_near_unsupported_family_per_training_window():
    frame = _coverage_frame(0.01)
    columns = feature_names(("core", "shots_volume"))

    model = fit_family("poisson", frame, columns, 0.0, coverage_guard=True)

    assert isinstance(model, CoverageGuardedModel)
    assert model.coverage_provenance["requested_groups"] == ["core", "shots_volume"]
    assert model.coverage_provenance["effective_groups"] == ["core"]
    assert model.coverage_provenance["dropped_groups"] == ["shots_volume"]
    assert model.effective_columns == feature_names(("core",))

    # The caller keeps handing over the requested schema. The wrapper is the
    # fitted model, and it is responsible for reproducing its effective slice.
    probs = model.predict_proba(frame[columns].tail(20))
    assert probs.shape == (20, 3)
    assert np.allclose(probs.sum(axis=1), 1.0)


def test_guard_is_an_exact_no_op_when_every_requested_group_has_support():
    frame = _coverage_frame(1.0)
    columns = feature_names(("core", "shots_volume"))

    guarded = fit_family("poisson", frame, columns, 0.0, coverage_guard=True)
    control = fit_family("poisson", frame, columns, 0.0, coverage_guard=False)

    assert guarded.coverage_provenance["dropped_groups"] == []
    assert guarded.effective_columns == columns
    probe = frame[columns].tail(80)
    assert np.allclose(guarded.predict_proba(probe), control.predict_proba(probe),
                       rtol=0.0, atol=1e-12), (
        "the adopted guard changed a fully-supported fit; it is not the no-op "
        "that the nine-league falsification measured")


def test_read_only_research_keeps_an_unguarded_control_unless_it_opts_in(monkeypatch):
    frame = _coverage_frame(0.01)
    columns = feature_names(("core", "shots_volume"))
    monkeypatch.setenv("AI_READ_ONLY", "1")
    monkeypatch.delenv("AI_COVERAGE_GUARD", raising=False)

    control = fit_family("poisson", frame, columns, 0.0)
    corrected = fit_family("poisson", frame, columns, 0.0, coverage_guard=True)

    assert not isinstance(control, CoverageGuardedModel), (
        "the dedicated coverage-guard research study has lost its unguarded "
        "control arm")
    assert isinstance(corrected, CoverageGuardedModel), (
        "a corrected read-only final study cannot explicitly opt into the "
        "shipped guard")


def test_normal_training_enables_the_guard_without_a_special_cli_flag(monkeypatch):
    frame = _coverage_frame(0.01)
    columns = feature_names(("core", "shots_volume"))
    monkeypatch.delenv("AI_READ_ONLY", raising=False)
    monkeypatch.delenv("AI_COVERAGE_GUARD", raising=False)

    model = fit_family("poisson", frame, columns, 0.0)
    assert isinstance(model, CoverageGuardedModel)
    assert model.coverage_provenance["dropped_groups"] == ["shots_volume"]


def test_scheduled_monday_training_reaches_the_guarded_fit_path():
    root = Path(__file__).resolve().parent.parent
    workflow = (root / ".github" / "workflows" / "ai-lab.yml").read_text()
    training = (root / "ai" / "train.py").read_text()

    assert "cron: '0 7 * * 1'" in workflow
    assert './run_leagues.sh train.py --family poisson' in workflow
    assert "fit_family(" in training
    assert "from fitting import DEFAULT_HALF_LIFE_DAYS, fit_family, time_weights" in training


def test_artefact_carries_the_effective_groups_and_survives_serialisation(tmp_path):
    frame = _coverage_frame(0.01)
    columns = feature_names(("core", "shots_volume"))
    model = fit_family("poisson", frame, columns, 0.0, coverage_guard=True)
    bundle = ModelBundle(
        model=model,
        features=columns,
        features_version="test",
        feature_groups=("core", "shots_volume"),
        family="poisson",
        league="SCH",
        version="coverage-test",
        half_life_days=0.0,
        elo_transition="division_prior",
        trained_through=frame["match_date"].max(),
        schema=ARTIFACT_SCHEMA,
        metadata={"purpose": "mutation-proof provenance"},
    )

    payload = bundle.to_payload()
    provenance = payload["metadata"]["coverage_guard"]
    assert provenance["requested_groups"] == ["core", "shots_volume"]
    assert provenance["effective_groups"] == ["core"]
    assert provenance["dropped_groups"] == ["shots_volume"]

    path = tmp_path / "guarded.joblib"
    joblib.dump(payload, path)
    loaded = ModelBundle.from_payload(joblib.load(path))
    assert loaded.metadata["coverage_guard"] == provenance
    assert np.allclose(
        loaded.predict_proba(frame[columns].tail(20)),
        bundle.predict_proba(frame[columns].tail(20)),
        rtol=0.0,
        atol=1e-12,
    )
