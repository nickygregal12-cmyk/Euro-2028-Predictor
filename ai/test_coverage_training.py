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


def test_read_only_research_uses_the_same_guarded_model_as_deployable_training(monkeypatch):
    """Read-only is a database boundary, never a hidden model switch.

    Mutation guard: if `coverage_guard_enabled()` ever starts keying off
    AI_READ_ONLY again, the first assertion fails immediately. The historical
    falsification study can still request its pre-adoption control explicitly.
    """
    frame = _coverage_frame(0.01)
    columns = feature_names(("core", "shots_volume"))
    monkeypatch.setenv("AI_READ_ONLY", "1")
    monkeypatch.delenv("AI_COVERAGE_GUARD", raising=False)

    research = fit_family("poisson", frame, columns, 0.0)
    historical_control = fit_family(
        "poisson", frame, columns, 0.0, coverage_guard=False)
    explicit_guard = fit_family(
        "poisson", frame, columns, 0.0, coverage_guard=True)

    assert isinstance(research, CoverageGuardedModel), (
        "AI_READ_ONLY changed model semantics; ordinary research must measure "
        "the same adopted coverage guard that deployable training uses")
    assert research.coverage_provenance["dropped_groups"] == ["shots_volume"]
    assert not isinstance(historical_control, CoverageGuardedModel), (
        "the falsification control must remain explicitly reachable")
    assert isinstance(explicit_guard, CoverageGuardedModel)


def test_normal_training_enables_the_guard_without_a_special_cli_flag(monkeypatch):
    frame = _coverage_frame(0.01)
    columns = feature_names(("core", "shots_volume"))
    monkeypatch.delenv("AI_READ_ONLY", raising=False)
    monkeypatch.delenv("AI_COVERAGE_GUARD", raising=False)

    model = fit_family("poisson", frame, columns, 0.0)
    assert isinstance(model, CoverageGuardedModel)
    assert model.coverage_provenance["dropped_groups"] == ["shots_volume"]


def test_scheduled_monday_training_reaches_selected_policy_then_verified_guarded_fit():
    """Protect schedule -> selected policy -> verification -> train -> guarded fit.

    Mutation guard: restoring the old one-size-fits-all Poisson command, routing
    the policy around `train_verified.py`, or disconnecting the wrapper from the
    mature `train.py` implementation each breaks a separate assertion here.
    """
    root = Path(__file__).resolve().parent.parent
    workflow = (root / ".github" / "workflows" / "ai-lab.yml").read_text()
    runner = (root / "ai" / "train_selected_challengers.py").read_text()
    policy = (root / "ai" / "challenger_policy.py").read_text()
    verified = (root / "ai" / "train_verified.py").read_text()
    training = (root / "ai" / "train.py").read_text()

    assert "cron: '0 7 * * 1'" in workflow
    assert "python train_selected_challengers.py" in workflow
    assert './run_leagues.sh train.py --family poisson' not in workflow
    assert "ordered_policy" in runner
    assert '"train_verified.py"' in policy
    assert "prepare_verified_artifact" in verified
    assert "return train.main()" in verified
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
