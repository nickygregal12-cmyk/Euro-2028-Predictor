"""Predeclared model candidates. Declared BEFORE they are run.

This module exists to make one specific failure impossible: choosing a
configuration after looking at how every configuration scored. A grid of two
hundred trials contains, with near certainty, several settings that beat the
incumbent on any particular set of folds by chance alone, and the one you
report is the one you looked hardest for. The antidote is not a bigger grid or
a cleverer search. It is a SHORT list, written down first, with a stated
hypothesis per entry, run once on identical folds.

So the rules here are:

  * EVERY candidate carries a `hypothesis`: the specific mechanism it is
    testing. A candidate that cannot say what it would prove does not belong.

  * THE INCUMBENT IS IN THE GRID. `gbm_shipped` is the baseline every other
    GBM candidate is paired against. Without it the numbers are unanchored.

  * THE GRID DOES NOT GROW after results are seen. Adding a candidate because
    the winner "was nearly" something else is how a search launders itself
    into a declaration. Add it to a NEW study with its own name.

  * ONE AXIS AT A TIME where possible, so a win is attributable. The three
    `capacity_*` rows move learning rate, iterations, leaf count, leaf size
    and L2 together on purpose — they are a single "how much capacity" axis —
    and `iter_only` and `depth_only` separate it afterwards.

  * REJECTIONS ARE RESULTS. `experiments.py --record` writes every row,
    including the ones that found nothing.

Nothing in this module trains a deployable model, writes an artefact, changes a
default or promotes anything. It is a list of things to measure.
"""
from __future__ import annotations

from dataclasses import dataclass, field


@dataclass(frozen=True)
class Candidate:
    """One predeclared configuration and the reason it is being tried."""

    name: str
    hypothesis: str
    #: Keyword arguments handed to the model family's constructor.
    model_kwargs: dict = field(default_factory=dict)
    #: Overrides the study's feature groups when set.
    feature_groups: tuple[str, ...] | None = None
    #: Overrides the study's half-life when set. 0.0 means no time weighting.
    half_life_days: float | None = None
    #: Whether the fold's probabilities are calibrated before scoring.
    calibrate: bool = False

    def describe(self) -> dict:
        return {"name": self.name, "hypothesis": self.hypothesis,
                "model_kwargs": dict(self.model_kwargs),
                "feature_groups": list(self.feature_groups) if self.feature_groups else None,
                "half_life_days": self.half_life_days,
                "calibrate": self.calibrate}


# ---------------------------------------------------------------------------
# The GBM diagnostic
# ---------------------------------------------------------------------------
#
# The measurement that prompted this, over six chronological folds on hosted
# Development on 13 August 2026: gbm scored 1.13503 (EPL), 1.22041 (SPL) and
# 1.18890 (EL2) against a poisson/elo pair sitting near 0.987, 0.953 and 1.060.
# A GBM losing to a Poisson regression is ordinary. A GBM losing to a
# BASE-RATE BASELINE — roughly 1.06 in these leagues — is not a tuning
# question, it is a broken configuration.
#
# The mechanism was then measured directly, on the repository's own fold
# harness over synthetic seasons, reporting TRAIN and TEST loss together:
#
#   family / config                        train    test     gap
#   poisson                               1.0061  0.9960  -0.0101
#   elo                                   1.0123  0.9927  -0.0196
#   logistic                              0.9846  1.0291  +0.0445
#   gbm SHIPPED lr.05/it400/lf15/msl40    0.0930  1.3462  +1.2532
#   gbm lr.05/it150/lf7/msl150            0.7396  1.0724  +0.3328
#   gbm lr.03/it120/lf4/msl250/l2=5       0.9441  1.0185  +0.0744
#   gbm lr.02/it80/lf3/msl300/l2=10       0.9929  1.0070  +0.0141
#
# A training log loss of 0.0930 on a three-class outcome whose irreducible
# loss is around 0.99 is not learning, it is memorisation: 400 iterations at a
# 0.05 learning rate build 1200 trees of up to 15 leaves over a few thousand
# rows of very low signal. Poisson and Elo show a NEGATIVE gap — they score
# the held-out season slightly better than the training seasons, which is what
# time weighting plus a genuinely recent test fold should do.
#
# The shipped comment said `early_stopping=False` was safe because
# "chronological folds do the stopping". A fold scores a model; it does not
# limit its boosting. Nothing bounded the iteration count at all.
#
# So the primary hypothesis is CAPACITY, and the grid is built to give it
# every chance to be wrong: the alternatives include early stopping (repairing
# the stated belief in place), feature count, time weighting, calibration and
# missingness, each of which has been proposed at some point as the reason a
# boosted model underperforms here.

GBM_BASELINE = "gbm_shipped"

GBM_CANDIDATES: tuple[Candidate, ...] = (
    Candidate(
        "gbm_shipped",
        "The incumbent, and the baseline every other row is paired against: "
        "400 iterations at 0.05 with 15-leaf trees and no early stopping.",
        {"learning_rate": 0.05, "max_iter": 400, "max_leaf_nodes": 15,
         "min_samples_leaf": 40, "l2_regularization": 1.0},
    ),
    Candidate(
        "capacity_low",
        "Capacity is the whole problem and the fix is drastic: shallow stumps, "
        "few iterations, large leaves and heavy L2.",
        {"learning_rate": 0.02, "max_iter": 80, "max_leaf_nodes": 3,
         "min_samples_leaf": 300, "l2_regularization": 10.0},
    ),
    Candidate(
        "capacity_mid",
        "Capacity is the problem and a conventional low-signal tabular setting "
        "fixes it. The primary declared candidate.",
        {"learning_rate": 0.03, "max_iter": 120, "max_leaf_nodes": 4,
         "min_samples_leaf": 250, "l2_regularization": 5.0},
    ),
    Candidate(
        "capacity_high",
        "Capacity is the problem but the shipped setting merely overshot; a "
        "moderate reduction is enough.",
        {"learning_rate": 0.05, "max_iter": 150, "max_leaf_nodes": 7,
         "min_samples_leaf": 150, "l2_regularization": 1.0},
    ),
    Candidate(
        "early_stopping",
        "The shipped belief can be repaired in place: keep the shipped "
        "capacity and let the estimator stop itself on an internal validation "
        "split. Tests whether unbounded ITERATIONS alone explain the failure.",
        {"learning_rate": 0.05, "max_iter": 400, "max_leaf_nodes": 15,
         "min_samples_leaf": 40, "l2_regularization": 1.0,
         "early_stopping": True, "validation_fraction": 0.15,
         "n_iter_no_change": 20},
    ),
    Candidate(
        "iter_only",
        "Isolates the iteration count: shipped tree shape and learning rate, "
        "100 iterations instead of 400.",
        {"learning_rate": 0.05, "max_iter": 100, "max_leaf_nodes": 15,
         "min_samples_leaf": 40, "l2_regularization": 1.0},
    ),
    Candidate(
        "depth_only",
        "Isolates tree shape: shipped learning rate and iteration count, but "
        "stumps with large leaves. If this alone recovers the loss, the "
        "iteration count was never the binding constraint.",
        {"learning_rate": 0.05, "max_iter": 400, "max_leaf_nodes": 3,
         "min_samples_leaf": 300, "l2_regularization": 1.0},
    ),
    Candidate(
        "native_missing",
        "The docstring's own claim, finally tested: reconstruct genuine NaN "
        "from the zero coverage flags so the tree's missingness branch is "
        "actually exercised. Measured, the frame it receives today contains no "
        "NaN at all, so the property it was chosen for is inert.",
        {"learning_rate": 0.03, "max_iter": 120, "max_leaf_nodes": 4,
         "min_samples_leaf": 250, "l2_regularization": 5.0,
         "native_missing": True},
    ),
    Candidate(
        "core_only",
        "The feature count is the problem rather than the tree size: 65 "
        "correlated columns give a boosted learner too many ways to memorise. "
        "Same capacity as capacity_mid, core features only.",
        {"learning_rate": 0.03, "max_iter": 120, "max_leaf_nodes": 4,
         "min_samples_leaf": 250, "l2_regularization": 5.0},
        feature_groups=("core",),
    ),
    Candidate(
        "no_time_weight",
        "Time weighting is hurting this family specifically: exponential "
        "weights concentrate effective sample size, and a tree splitting on "
        "weighted counts has fewer effective rows per leaf than it appears to.",
        {"learning_rate": 0.03, "max_iter": 120, "max_leaf_nodes": 4,
         "min_samples_leaf": 250, "l2_regularization": 5.0},
        half_life_days=0.0,
    ),
    Candidate(
        "calibrated",
        "The ranking is fine and only the probabilities are wrong: a boosted "
        "classifier's overconfidence is a calibration problem, and log loss "
        "punishes exactly that. Fitted per fold on the training half only.",
        {"learning_rate": 0.03, "max_iter": 120, "max_leaf_nodes": 4,
         "min_samples_leaf": 250, "l2_regularization": 5.0},
        calibrate=True,
    ),
)


# ---------------------------------------------------------------------------
# The base-model comparison
# ---------------------------------------------------------------------------
#
# `LogisticModel` is registered, is excluded from `ENSEMBLE_BASE_FAMILIES` on
# the stated grounds that "the Poisson model already occupies the
# smooth-linear corner of the space", and has never been measured against it
# on these folds. That is an assumption wearing a reason. The two are not the
# same model: the Poisson family predicts a SCORELINE GRID and derives H/D/A
# from it, so its draw probability is a consequence of two goal rates, while
# the logistic family estimates the three outcomes directly and can price a
# draw that no pair of Poisson means would produce.
#
# Whether that difference is worth anything is an empirical question, and it
# has two separable answers: whether logistic is COMPETITIVE alone, and
# whether it is DIVERSE enough to help an ensemble even if it is not. A model
# can earn an ensemble seat by being wrong in different places, which is why
# the ensemble comparison runs after this one rather than instead of it.

BASE_MODEL_FAMILIES: tuple[str, ...] = ("baseline", "poisson", "elo",
                                        "logistic", "gbm")


def candidate_by_name(name: str) -> Candidate:
    for candidate in GBM_CANDIDATES:
        if candidate.name == name:
            return candidate
    raise KeyError(f"no predeclared candidate named {name!r}; "
                   f"known: {[c.name for c in GBM_CANDIDATES]}")


def declared_grid() -> list[dict]:
    """The grid as a recordable object, for the ledger and for the report."""
    return [c.describe() for c in GBM_CANDIDATES]
