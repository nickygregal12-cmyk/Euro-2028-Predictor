"""Applied probability calibration, fitted only on out-of-sample predictions.

The pipeline already MEASURED calibration — `metrics.calibration_error` has
been printed on every training report — and then did nothing about it. A model
whose 70% bucket comes in at 63% is not broken, it is miscalibrated, and the
distinction matters enormously at the point where a probability meets a price:
a 7-point overstatement turns a fair bet into a losing one and a losing bet
into a confident one.

The rule that makes this honest, and the one thing this module is careful
about: a calibrator must never see a probability produced by a model that
trained on the same match. Fit temperature scaling on in-sample predictions
and it learns that the model is under-confident (it is, on rows it memorised),
then makes every live probability MORE extreme — the exact opposite of the
correction the model actually needs. So the only input accepted here is
out-of-fold or out-of-time material, produced by `ensemble.out_of_fold`.

Two candidates, deliberately few:

  temperature  one parameter, fitted on the logit scale. Cannot reorder
               outcomes, cannot overfit a small sample, and fixes the failure
               that actually occurs (systematic over- or under-confidence).
  isotonic     non-parametric, per outcome, renormalised. Strictly more
               expressive and strictly hungrier: with a thousand rows it will
               happily model noise, which is why it carries a sample floor and
               has to WIN on held-out folds rather than merely be available.

`identity` is a first-class option rather than an absence, so an artefact can
say "calibration was evaluated and rejected here" instead of being silent.
"""
from __future__ import annotations

from dataclasses import dataclass, field

import numpy as np

import metrics

OUTCOMES = ("H", "D", "A")
_EPS = 1e-12

# Below this many out-of-fold rows, isotonic regression is fitting the sample
# rather than the model. Three outcomes, so ~700 rows per outcome at the floor.
ISOTONIC_MIN_ROWS = 2000


def _clean(probs) -> np.ndarray:
    p = np.asarray(probs, dtype=float).reshape(-1, 3)
    p = np.clip(p, _EPS, 1.0)
    return p / p.sum(axis=1, keepdims=True)


def _onehot(actual) -> np.ndarray:
    idx = {o: i for i, o in enumerate(OUTCOMES)}
    y = np.array([idx[a] for a in actual], dtype=int)
    out = np.zeros((len(y), 3), dtype=float)
    out[np.arange(len(y)), y] = 1.0
    return out


class IdentityCalibrator:
    """Does nothing, on purpose, and says so."""

    method = "identity"

    def fit(self, probs, actual) -> "IdentityCalibrator":
        return self

    def transform(self, probs) -> np.ndarray:
        return _clean(probs)

    def describe(self) -> dict:
        return {"method": self.method}


@dataclass
class TemperatureCalibrator:
    """p -> softmax(log p / T). One parameter, fitted by grid then bisection.

    T > 1 spreads probabilities toward uniform (the model was over-confident);
    T < 1 sharpens them. T == 1 is the identity, which is why a fitted value
    very close to 1 is itself a useful report: it says the model was already
    calibrated and the calibrator is not doing anything.
    """

    method: str = "temperature"
    temperature: float = 1.0
    n_fit: int = 0

    def fit(self, probs, actual) -> "TemperatureCalibrator":
        p = _clean(probs)
        y = _onehot(actual)
        logp = np.log(p)

        def loss(t: float) -> float:
            z = logp / max(t, 1e-3)
            z -= z.max(axis=1, keepdims=True)
            e = np.exp(z)
            q = e / e.sum(axis=1, keepdims=True)
            return float(-np.log(np.clip((q * y).sum(axis=1), _EPS, None)).mean())

        grid = np.linspace(0.5, 3.0, 51)
        best = float(min(grid, key=loss))
        # Refine around the grid winner. Golden-section would be tidier; a
        # short ternary search is enough for a one-dimensional convex-ish loss
        # and has no dependency.
        lo, hi = max(0.5, best - 0.05), min(3.0, best + 0.05)
        for _ in range(60):
            m1, m2 = lo + (hi - lo) / 3, hi - (hi - lo) / 3
            if loss(m1) < loss(m2):
                hi = m2
            else:
                lo = m1
        self.temperature = float((lo + hi) / 2)
        self.n_fit = int(len(p))
        return self

    def transform(self, probs) -> np.ndarray:
        p = _clean(probs)
        z = np.log(p) / max(self.temperature, 1e-3)
        z -= z.max(axis=1, keepdims=True)
        e = np.exp(z)
        return e / e.sum(axis=1, keepdims=True)

    def describe(self) -> dict:
        return {"method": self.method, "temperature": round(self.temperature, 4),
                "n_fit": self.n_fit}


@dataclass
class IsotonicCalibrator:
    """One isotonic regression per outcome, renormalised to sum to 1.

    Renormalisation is the awkward part and it is not optional: three
    independently calibrated marginals do not sum to one, and a probability
    vector that sums to 1.04 is not a probability vector. The order of any
    single outcome's probabilities is preserved by isotonic regression itself;
    renormalisation can still reorder ACROSS outcomes, which is why this needs
    to earn its place on held-out folds rather than be assumed better.
    """

    method: str = "isotonic"
    models: list = field(default_factory=list)
    n_fit: int = 0

    def fit(self, probs, actual) -> "IsotonicCalibrator":
        from sklearn.isotonic import IsotonicRegression

        p = _clean(probs)
        y = _onehot(actual)
        if len(p) < ISOTONIC_MIN_ROWS:
            raise ValueError(
                f"isotonic calibration needs at least {ISOTONIC_MIN_ROWS} "
                f"out-of-fold rows; {len(p)} were supplied. Use temperature "
                f"scaling, which has one parameter rather than a curve.")
        self.models = []
        for j in range(3):
            iso = IsotonicRegression(y_min=0.0, y_max=1.0, out_of_bounds="clip")
            iso.fit(p[:, j], y[:, j])
            self.models.append(iso)
        self.n_fit = int(len(p))
        return self

    def transform(self, probs) -> np.ndarray:
        p = _clean(probs)
        if not self.models:
            return p
        out = np.column_stack([m.predict(p[:, j]) for j, m in enumerate(self.models)])
        out = np.clip(out, _EPS, None)
        return out / out.sum(axis=1, keepdims=True)

    def describe(self) -> dict:
        return {"method": self.method, "n_fit": self.n_fit}


CALIBRATORS = {
    "identity": IdentityCalibrator,
    "temperature": TemperatureCalibrator,
    "isotonic": IsotonicCalibrator,
}


def select_calibrator(oof_probs, oof_actual, folds=None,
                      candidates: tuple[str, ...] = ("identity", "temperature", "isotonic")):
    """Choose a calibrator by held-out log loss, not by in-sample improvement.

    Every candidate improves the sample it was fitted on — isotonic can drive
    in-sample calibration error to nearly zero and still be worse live. So the
    comparison is itself cross-validated: `folds` splits the out-of-fold
    material chronologically, each candidate is fitted on the earlier part and
    scored on the later part, and the winner must beat `identity` by more than
    a rounding error to be adopted.

    `folds` is a sequence of fold labels (season codes, typically) aligned with
    the rows. Without it, a single chronological 70/30 split is used.
    """
    p = _clean(oof_probs)
    actual = np.asarray(oof_actual)
    if len(p) < 200:
        return IdentityCalibrator(), {
            "chosen": "identity",
            "reason": f"only {len(p)} out-of-fold rows; too few to calibrate",
            "scores": {},
        }

    if folds is not None:
        labels = np.asarray(folds)
        unique = sorted(set(labels.tolist()))
        splits = [(labels != unique[-1], labels == unique[-1])] if len(unique) > 1 else []
        if len(unique) > 2:
            splits = [(np.isin(labels, unique[:i]), labels == unique[i])
                      for i in range(max(1, len(unique) // 2), len(unique))]
    else:
        cut = int(len(p) * 0.7)
        mask = np.zeros(len(p), dtype=bool)
        mask[:cut] = True
        splits = [(mask, ~mask)]

    if not splits:
        cut = int(len(p) * 0.7)
        mask = np.zeros(len(p), dtype=bool)
        mask[:cut] = True
        splits = [(mask, ~mask)]

    scores: dict[str, float] = {}
    for name in candidates:
        losses = []
        for fit_mask, test_mask in splits:
            if fit_mask.sum() < 100 or test_mask.sum() < 50:
                continue
            try:
                cal = CALIBRATORS[name]().fit(p[fit_mask], actual[fit_mask])
            except ValueError:
                losses = []
                break
            out = cal.transform(p[test_mask])
            losses.append(metrics.summarise(out, actual[test_mask])["log_loss"])
        if losses:
            scores[name] = float(np.mean(losses))

    if "identity" not in scores:
        return IdentityCalibrator(), {"chosen": "identity",
                                      "reason": "no usable held-out split",
                                      "scores": scores}

    best = min(scores, key=scores.get)
    # A calibrator has to be worth having. 0.0005 of log loss is smaller than
    # any fold standard error this lab has ever measured, so anything inside
    # it is a tie and the tie goes to doing nothing.
    if best != "identity" and scores["identity"] - scores[best] < 0.0005:
        best = "identity"

    chosen = CALIBRATORS[best]()
    if best != "identity":
        chosen.fit(p, actual)
    return chosen, {
        "chosen": best,
        "scores": {k: round(v, 5) for k, v in scores.items()},
        "held_out_gain_vs_identity": round(scores["identity"] - scores[best], 5),
        "describe": chosen.describe(),
    }


def calibration_report(probs, actual) -> dict:
    """Before/after evidence in one shape, for the training report."""
    return {
        "ece": round(float(metrics.calibration_error(probs, actual)), 5),
        "log_loss": round(float(metrics.summarise(probs, actual)["log_loss"]), 5),
        "table": metrics.calibration_table(probs, actual),
    }
