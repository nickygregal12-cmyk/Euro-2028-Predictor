"""One place that knows how to fit a family and how old a match is.

`train.walk_forward` and `ablate.fold_scores` each carried their own copy of
"build the weights, branch on whether the family is Poisson, call fit". Two
copies is how a fold ends up validating a model nobody will ever run: the
weighting is part of the model, so a validation loop that weights differently
from the shipped fit is measuring something else. Three copies were about to
exist. Now there is one.
"""
from __future__ import annotations

import os

import numpy as np
import pandas as pd

from features import FEATURE_GROUPS, COVERAGE_SUPPORT_FLOOR, feature_names, groups_with_support
from model_zoo import MODEL_FAMILIES

# Two and a half years. Dixon and Coles fitted a decay on half-seasons of one
# league; this archive is fifteen seasons across nine divisions, where squads
# turn over but a club's level is genuinely persistent. It is a parameter
# rather than a constant precisely so it can be argued with:
# `--half-life-days 0` restores equal weighting exactly.
DEFAULT_HALF_LIFE_DAYS = 900.0

# The half-lives `experiments.py --study half-life` compares per league. 0 is
# in the list because "no decay at all" has to be allowed to win: the lower
# divisions are sample-starved, and throwing away 2014 to be fashionable about
# recency is a real way to make a model worse.
HALF_LIFE_GRID = (0.0, 180.0, 365.0, 540.0, 730.0, 900.0, 1200.0)


def time_weights(match_dates, half_life_days: float):
    """Exponential recency weights, normalised to mean 1.

    Normalising keeps the regulariser's meaning stable: `alpha` is defined
    against the total weight, so an un-normalised decay would silently change
    how hard the model is penalised as well as which matches it listens to,
    and the two effects could not be told apart afterwards.
    """
    if not half_life_days or half_life_days <= 0:
        return None
    days = pd.to_datetime(pd.Series(list(match_dates)))
    age = (days.max() - days).dt.days.to_numpy(dtype=float)
    weights = np.power(0.5, age / float(half_life_days))
    mean = weights.mean()
    return weights / mean if mean > 0 else None


def _env_truthy(name: str) -> bool | None:
    raw = os.getenv(name)
    if raw is None:
        return None
    value = raw.strip().lower()
    if value in {"1", "true", "yes", "on"}:
        return True
    if value in {"0", "false", "no", "off"}:
        return False
    raise ValueError(f"{name} must be true/false when set, got {raw!r}")


def coverage_guard_enabled(explicit: bool | None = None) -> bool:
    """Whether normal model fitting applies the adopted coverage guard.

    Deployable training is guarded by default. The hosted research plane is
    deliberately exempt unless it explicitly opts in: `coverage-guard` needs
    an unguarded control arm to remain a falsifiable experiment rather than a
    comparison of the guard with itself. A final, corrected research study can
    pass `coverage_guard=True` explicitly while remaining read-only.
    """
    if explicit is not None:
        return bool(explicit)
    configured = _env_truthy("AI_COVERAGE_GUARD")
    if configured is not None:
        return configured
    return _env_truthy("AI_READ_ONLY") is not True


def _coverage_groups_for(columns: list[str]) -> tuple[str, ...]:
    """Feature groups represented by `columns`, in repository declaration order."""
    selected = set(columns)
    return tuple(group for group, names in FEATURE_GROUPS.items()
                 if selected.intersection(names))


def _effective_columns(frame: pd.DataFrame, columns: list[str]):
    """Resolve the adopted support rule without changing the caller's schema."""
    requested_groups = _coverage_groups_for(columns)
    kept, dropped = groups_with_support(frame, requested_groups,
                                        COVERAGE_SUPPORT_FLOOR)

    managed = {name for group in requested_groups for name in FEATURE_GROUPS[group]}
    kept_features = set(feature_names(kept)) if kept else set()
    effective = [name for name in columns
                 if name not in managed or name in kept_features]
    return effective, requested_groups, kept, dropped


class CoverageGuardedModel:
    """A fitted family whose public input schema stays stable while weakly
    supported feature groups are absent from the estimator underneath it.

    Keeping the public schema is important for old callers and for
    `ModelBundle.matrix`: callers may hand the model every requested feature,
    but the wrapper reproduces the estimator's own fitted-column contract. The
    effective groups are carried on the model so an artefact can explain not
    only what was requested, but what actually reached the fit.
    """

    def __init__(self, model, requested_columns: list[str], effective_columns: list[str],
                 requested_groups: tuple[str, ...], effective_groups: tuple[str, ...],
                 dropped_groups: tuple[str, ...]) -> None:
        self.model = model
        self.requested_columns = list(requested_columns)
        self.effective_columns = list(effective_columns)
        self.coverage_provenance = {
            "enabled": True,
            "support_floor": COVERAGE_SUPPORT_FLOOR,
            "requested_groups": list(requested_groups),
            "effective_groups": list(effective_groups),
            "dropped_groups": list(dropped_groups),
            "requested_columns": list(requested_columns),
            "effective_columns": list(effective_columns),
        }
        self.family = getattr(model, "family", "unknown")
        self.uses_market = bool(getattr(model, "uses_market", False))

    def __getattr__(self, name):
        # During pickle/joblib reconstruction `__getattr__` can be asked about
        # special methods before `model` has been restored. Looking up
        # `self.model` in that state recursively calls this method forever, so
        # reach into __dict__ and fail normally until the wrapped estimator is
        # present.
        model = self.__dict__.get("model")
        if model is None:
            raise AttributeError(name)
        return getattr(model, name)

    def _matrix(self, rows):
        if not isinstance(rows, pd.DataFrame):
            return rows

        # Preserve each estimator's prediction contract. Most families record
        # the columns they were actually fitted on; Elo deliberately records
        # only `elo_diff` because it supports diagnostic one-column probes even
        # though training is handed the full guarded frame. The wrapper must
        # not turn that valid narrow probe into a requirement for every core
        # feature. When a family exposes no fitted-column list (e.g. baseline),
        # pass the frame through unchanged.
        fitted_columns = getattr(self.model, "feature_names_", None)
        if fitted_columns:
            fitted_columns = list(fitted_columns)
            missing = [c for c in fitted_columns if c not in rows.columns]
            if missing:
                raise KeyError(f"coverage-guarded model is missing fitted columns: {missing}")
            return rows.loc[:, fitted_columns]
        return rows

    def predict_proba(self, rows):
        return self.model.predict_proba(self._matrix(rows))

    def scoreline_grid(self, rows):
        return self.model.scoreline_grid(self._matrix(rows))

    def top_scorelines(self, rows, top_n: int = 8):
        return self.model.top_scorelines(self._matrix(rows), top_n)

    def predict_goals(self, rows):
        return self.model.predict_goals(self._matrix(rows))

    def describe(self) -> dict:
        inner = self.model.describe() if hasattr(self.model, "describe") else {
            "family": self.family
        }
        return {**inner, "coverage_guard": dict(self.coverage_provenance)}


def fit_family(family: str, frame: pd.DataFrame, columns: list[str],
               half_life_days: float = DEFAULT_HALF_LIFE_DAYS,
               weights=None, coverage_guard: bool | None = None, **kwargs):
    """Fit `family` on `frame[columns]` under the shipped weighting.

    `weights` is computed from the frame when not supplied, which is the
    normal path; passing it in exists so a caller that already built the
    weights for a paired comparison does not build them twice and risk
    building them differently.

    The coverage guard is part of deployable fitting after its nine-league
    falsification on 13 August 2026. It is resolved on the training rows of
    EACH fit, so a historical walk-forward fold cannot borrow later coverage.
    The read-only research plane remains unguarded by default so the dedicated
    guard study keeps a genuine control arm; corrected studies opt in explicitly.
    """
    if family not in MODEL_FAMILIES:
        raise ValueError(f"unknown model family: {family!r}; "
                         f"known: {sorted(MODEL_FAMILIES)}")
    if weights is None:
        weights = time_weights(frame["match_date"], half_life_days)

    requested_columns = list(columns)
    effective_columns = requested_columns
    requested_groups: tuple[str, ...] = ()
    effective_groups: tuple[str, ...] = ()
    dropped_groups: tuple[str, ...] = ()
    guarded = coverage_guard_enabled(coverage_guard)
    if guarded:
        (effective_columns, requested_groups, effective_groups,
         dropped_groups) = _effective_columns(frame, requested_columns)
        if not effective_columns:
            raise ValueError("coverage guard removed every model input column")

    model = MODEL_FAMILIES[family](**kwargs)
    X, y = frame[effective_columns], frame["result"]
    if family == "poisson":
        model.fit(X, y, home_goals=frame["home_goals"],
                  away_goals=frame["away_goals"], sample_weight=weights)
    elif family == "baseline":
        model.fit(X, y)
    else:
        model.fit(X, y, sample_weight=weights)

    if not guarded:
        return model
    return CoverageGuardedModel(
        model, requested_columns, effective_columns, requested_groups,
        effective_groups, dropped_groups)
