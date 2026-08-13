"""Structured evidence for why a prediction says what it says.

Written for a reader that does not exist yet. When a conversational layer is
eventually put in front of this lab, the one thing it must not do is invent
reasons — and a language model handed a probability and a fixture name will
invent them fluently, because that is what it is for. The defence is to give
it facts it cannot improve on: contributions derived from the actual fitted
coefficients, the actual component probabilities, the actual missing columns.

Two rules hold everywhere in this module.

FROM THE MODEL, NOT ABOUT FOOTBALL. A contribution is a statement about a
fitted parameter multiplied by a standardised input. Where the model is linear
that is exact; where it is a tree ensemble it is an occlusion measurement and
says so in its own `method` field. Nothing here computes a plausible-sounding
football reason and attaches it to a number.

ASSOCIATION, NOT CAUSATION. Every factor is phrased as what it did to the
model's output. "Home Elo advantage of 180 points moved the home probability
up 9 points" is a true statement about a regression. "Arsenal are 180 points
better so they will win" is a claim about football that this package has no
evidence for, and the wording is deliberate rather than pedantic: the prose
layer will copy whatever register it is handed.
"""
from __future__ import annotations

import numpy as np
import pandas as pd

OUTCOMES = ("H", "D", "A")


# ---------------------------------------------------------------------------
# Contributions, per model family
# ---------------------------------------------------------------------------

def _linear_contributions(pipeline, feature_names: list[str], row: np.ndarray,
                          label: str) -> list[dict]:
    """coefficient x standardised feature, which is exact for these models."""
    scaler = pipeline.named_steps.get("scale")
    estimator = pipeline.named_steps.get("clf") or pipeline.named_steps.get("reg")
    if estimator is None:
        return []
    z = ((row - scaler.mean_) / np.where(scaler.scale_ == 0, 1.0, scaler.scale_)
         if scaler is not None else row)
    coef = np.atleast_2d(estimator.coef_)
    out = []
    for j, name in enumerate(feature_names):
        if j >= coef.shape[1]:
            break
        effect = float(np.dot(coef[:, j], np.ones(coef.shape[0])) * z[j] / coef.shape[0]) \
            if coef.shape[0] > 1 else float(coef[0, j] * z[j])
        out.append({
            "feature": name,
            "value": round(float(row[j]), 4),
            "standardised": round(float(z[j]), 4),
            "effect": round(effect, 5),
            "target": label,
            "method": "coefficient_x_standardised_feature",
        })
    return out


def poisson_contributions(model, X: pd.DataFrame, top_n: int = 8) -> dict:
    """What moved each side's expected goals, separately.

    Two regressions, so two answers. Collapsing them into one "importance"
    number would hide the thing a reader most wants: whether the model likes
    the home side because it expects them to score or because it expects them
    not to concede.
    """
    row = X[model.feature_names_].values.astype(float)[0]
    home = _linear_contributions(model.home, model.feature_names_, row, "home_goals")
    away = _linear_contributions(model.away, model.feature_names_, row, "away_goals")

    # Net effect on the home side's advantage: raising home goals and lowering
    # away goals both favour the home team.
    net = {}
    for h, a in zip(home, away):
        net[h["feature"]] = {
            "feature": h["feature"],
            "value": h["value"],
            "effect_home_goals": h["effect"],
            "effect_away_goals": a["effect"],
            "net_favours_home": round(h["effect"] - a["effect"], 5),
            "method": h["method"],
        }
    ordered = sorted(net.values(), key=lambda d: -abs(d["net_favours_home"]))
    return {
        "method": "coefficient_x_standardised_feature",
        "exact": True,
        "positive": [d for d in ordered if d["net_favours_home"] > 0][:top_n],
        "negative": [d for d in ordered if d["net_favours_home"] < 0][:top_n],
    }


def logistic_contributions(model, X: pd.DataFrame, top_n: int = 8) -> dict:
    row = X[model.feature_names_].values.astype(float)[0]
    scaler = model.pipeline.named_steps["scale"]
    clf = model.pipeline.named_steps["clf"]
    z = (row - scaler.mean_) / np.where(scaler.scale_ == 0, 1.0, scaler.scale_)
    classes = list(clf.classes_)
    out = []
    for j, name in enumerate(model.feature_names_):
        per_class = {c: round(float(clf.coef_[k, j] * z[j]), 5)
                     for k, c in enumerate(classes)}
        out.append({
            "feature": name,
            "value": round(float(row[j]), 4),
            "standardised": round(float(z[j]), 4),
            "effect_by_outcome": per_class,
            "net_favours_home": round(per_class.get("H", 0.0) - per_class.get("A", 0.0), 5),
            "method": "coefficient_x_standardised_feature",
        })
    ordered = sorted(out, key=lambda d: -abs(d["net_favours_home"]))
    return {
        "method": "coefficient_x_standardised_feature",
        "exact": True,
        "positive": [d for d in ordered if d["net_favours_home"] > 0][:top_n],
        "negative": [d for d in ordered if d["net_favours_home"] < 0][:top_n],
    }


def tree_contributions(model, X: pd.DataFrame, top_n: int = 8) -> dict:
    rows = model.contributions(X, top_n=top_n * 2)[0]
    for r in rows:
        r["net_favours_home"] = round(r["delta_home"] - r["delta_away"], 5)
    ordered = sorted(rows, key=lambda d: -abs(d["net_favours_home"]))
    return {
        # Named honestly: this is not SHAP, the parts do not sum to the whole,
        # and correlated features share credit rather than splitting it.
        "method": "occlusion_vs_training_median",
        "exact": False,
        "caveat": ("Each feature was replaced by its training median and the "
                   "change in output recorded. Contributions do not sum to the "
                   "prediction and correlated features double-count."),
        "positive": [d for d in ordered if d["net_favours_home"] > 0][:top_n],
        "negative": [d for d in ordered if d["net_favours_home"] < 0][:top_n],
    }


def elo_contributions(model, X: pd.DataFrame, top_n: int = 8) -> dict:
    diff = float(X["elo_diff"].values[0])
    return {
        "method": "single_parameter_model",
        "exact": True,
        "positive": ([{"feature": "elo_diff", "value": round(diff, 2),
                       "net_favours_home": round(model.beta_ * diff / model.scale, 5),
                       "method": "single_parameter_model"}] if diff > 0 else []),
        "negative": ([{"feature": "elo_diff", "value": round(diff, 2),
                       "net_favours_home": round(model.beta_ * diff / model.scale, 5),
                       "method": "single_parameter_model"}] if diff < 0 else []),
    }


def contributions_for(model, X: pd.DataFrame, top_n: int = 8) -> dict:
    """Dispatch on what the model actually is.

    An ensemble deliberately does NOT get one blended explanation. A stacker
    combines opinions; it has no causal story of its own, and manufacturing one
    would be the exact failure this module exists to prevent. It gets its
    components' explanations, labelled by component, plus the weights.
    """
    family = getattr(model, "family", "unknown")
    try:
        if family == "poisson":
            return poisson_contributions(model, X, top_n)
        if family in ("logistic", "market"):
            return logistic_contributions(model, X, top_n)
        if family == "gbm":
            return tree_contributions(model, X, top_n)
        if family == "elo":
            return elo_contributions(model, X, top_n)
        if family == "ensemble":
            per = {}
            for name, component in model.models.items():
                cols = model.column_map[name]
                per[name] = contributions_for(component, X[cols], top_n)
            return {
                "method": "per_component",
                "exact": False,
                "caveat": ("This is an ensemble. Each component's own "
                           "contributions are given; the meta-model combines "
                           "opinions and has no separate causal account."),
                "components": per,
                "meta": model.meta.describe() if model.meta else None,
            }
    except Exception as exc:                      # pragma: no cover - defensive
        return {"method": "unavailable", "error": f"{type(exc).__name__}: {exc}"}
    return {"method": "unavailable",
            "reason": f"no contribution method for family {family!r}"}


# ---------------------------------------------------------------------------
# Why this could be wrong
# ---------------------------------------------------------------------------

def failure_modes(features: dict, agreement: dict | None,
                  data_confidence: dict | None, uncertainty: dict | None,
                  market_view: dict | None = None) -> list[dict]:
    """Deterministic caveats, each tied to a measured input.

    Not a hedge and not a disclaimer: every entry here is generated by a
    condition that was actually observed in this prediction's own inputs, so a
    prediction with none of these conditions produces an empty list rather than
    a reassuring sentence.
    """
    out: list[dict] = []

    for side in ("home", "away"):
        if float(features.get(f"{side}_is_newcomer", 0.0)) >= 1.0:
            out.append({
                "code": "NEWCOMER",
                "detail": f"the {side} side has fewer than ten matches in this "
                          "division, so its rating and form come mostly from a "
                          "different standard of opposition",
            })
        known = float(features.get(f"{side}_matches_known", 10.0))
        if known < 5:
            out.append({
                "code": "THIN_FORM_WINDOW",
                "detail": f"only {known:.0f} prior matches inform the {side} "
                          "side's form; the rolling windows are mostly priors",
            })
        if float(features.get(f"{side}_sot_known", 1.0)) < 0.5:
            out.append({
                "code": "NO_UNDERLYING_STATS",
                "detail": f"over half the {side} side's recent matches carry no "
                          "shot data, so chance creation is a neutral prior "
                          "rather than a measurement",
            })
        if float(features.get(f"{side}_form5_distorted", 0.0)) >= 0.4:
            out.append({
                "code": "RED_CARD_DISTORTED_FORM",
                "detail": f"a large share of the {side} side's recent matches "
                          "involved a sending-off, so the form window describes "
                          "ten-man football",
            })

    if agreement and agreement.get("measurable") and not agreement.get("same_pick", True):
        out.append({
            "code": "MODELS_DISAGREE_ON_PICK",
            "detail": f"the independent models do not agree on the outcome: "
                      f"{agreement.get('picks')}",
        })
    if uncertainty and uncertainty.get("wide"):
        out.append({
            "code": "WIDE_UNCERTAINTY",
            "detail": f"the 95% interval spans {uncertainty['max_width']:.0%} "
                      "of probability, which is wide enough that the point "
                      "estimate should not be read precisely",
        })
    if data_confidence and data_confidence.get("state") in ("limited", "insufficient"):
        weakest = sorted(
            [c for c in data_confidence.get("components", []) if c["score"] is not None],
            key=lambda c: c["score"])[:2]
        out.append({
            "code": "LOW_DATA_CONFIDENCE",
            "detail": f"data confidence is {data_confidence['state']}; weakest "
                      f"components: {[c['key'] for c in weakest]}",
        })
    if market_view and market_view.get("disagreement_pp", 0) >= 10:
        out.append({
            "code": "LARGE_MARKET_DISAGREEMENT",
            "detail": f"the model differs from the de-vigged market by "
                      f"{market_view['disagreement_pp']:.0f} points on the "
                      "outcome it favours, which is more often a model error "
                      "than a market error",
        })
    return out


# ---------------------------------------------------------------------------
# The document stored with the prediction
# ---------------------------------------------------------------------------

def explain_prediction(bundle, X: pd.DataFrame, features: dict,
                       probs, raw_probs=None, base_views: dict | None = None,
                       agreement: dict | None = None,
                       data_confidence: dict | None = None,
                       uncertainty: dict | None = None,
                       market_view: dict | None = None,
                       previous: dict | None = None,
                       top_n: int = 6) -> dict:
    """Everything needed to answer "why did you predict this?" months later.

    Stored with the immutable prediction rather than recomputed on demand, for
    the reason the prediction itself is immutable: the model that produced it
    may have been retired, retrained or superseded by then, and an explanation
    regenerated from a later model is an explanation of a different forecast.
    """
    probs = np.asarray(probs, dtype=float).reshape(-1)[:3]
    contributions = contributions_for(bundle.model, X, top_n)

    change = None
    if previous:
        prev = np.asarray([previous.get("p_home"), previous.get("p_draw"),
                           previous.get("p_away")], dtype=float)
        if np.isfinite(prev).all():
            delta = probs - prev
            biggest = int(np.argmax(np.abs(delta)))
            change = {
                "previous_horizon": previous.get("horizon"),
                "delta": {o: round(float(delta[i]), 4) for i, o in enumerate(OUTCOMES)},
                "largest_move": OUTCOMES[biggest],
                "largest_move_pp": round(float(delta[biggest]) * 100, 1),
                "material": bool(abs(delta[biggest]) >= 0.03),
            }

    return {
        "schema": 1,
        "model": {
            "label": bundle.label(),
            "family": bundle.family,
            "features_version": bundle.features_version,
            "feature_groups": list(bundle.feature_groups),
            "calibrator": (bundle.calibrator.describe()
                           if bundle.calibrator is not None else None),
        },
        "probabilities": {
            "final": {o: round(float(probs[i]), 4) for i, o in enumerate(OUTCOMES)},
            "raw": ({o: round(float(np.asarray(raw_probs).reshape(-1)[i]), 4)
                     for i, o in enumerate(OUTCOMES)} if raw_probs is not None else None),
        },
        "expected_goals": {
            "home": features.get("_exp_home_goals"),
            "away": features.get("_exp_away_goals"),
        },
        "per_model": ({f: [round(float(x), 4) for x in np.asarray(v).reshape(-1)[:3]]
                       for f, v in (base_views or {}).items()} or None),
        "agreement": agreement,
        "data_confidence": data_confidence,
        "uncertainty": uncertainty,
        "market_comparison": market_view,
        "top_factors": {
            "positive": contributions.get("positive"),
            "negative": contributions.get("negative"),
            "method": contributions.get("method"),
            "exact": contributions.get("exact"),
            "caveat": contributions.get("caveat"),
            "components": contributions.get("components"),
        },
        "missing_inputs": (data_confidence or {}).get("missing_inputs", []),
        "change_since_previous_horizon": change,
        "why_this_could_be_wrong": failure_modes(
            features, agreement, data_confidence, uncertainty, market_view),
        "wording_note": ("Factors describe what an input did to this model's "
                         "output. They are statistical associations inside a "
                         "fitted model, not established causes of football "
                         "results."),
    }
