"""Why a prediction scored as it did — which is usually "because it is a probability".

The failure this exists to prevent is the one every forecasting project makes:
treating each loss as a defect. A model that says 74% and loses is behaving
exactly as instructed roughly a quarter of the time, and a lab that responds by
adjusting something has just fitted itself to noise, permanently, using one
match as evidence.

The opposite failure is available too. A model that keeps losing at 74% WHILE
the underlying play also contradicts it is not unlucky, it is wrong, and
"variance" is then a comfortable thing to say for a very long time.

Telling those apart needs a second measurement, and this package already has
one: shots, shots on target and corners say who created what, independently of
who scored. So the diagnosis reads the result AND the underlying performance:

    model 74% home, home lose 0-1, shots 21-4, SOT 8-2
        -> UNDERLYING_PERFORMANCE_SUPPORTED_MODEL. The model described the
           match correctly and the ball did not go in. Nothing to fix.

    model 74% home, home lose 0-1, shots 4-21, SOT 2-8
        -> UNDERLYING_PERFORMANCE_CONTRADICTED_MODEL. The model was wrong
           about the match, not merely about the scoreline. One of these is
           still noise; forty of them in a season is a research problem.

ONE MATCH NEVER CHANGES A MODEL. Nothing in this module writes to ai.models,
promotes, retires, or alters a feature set. It writes a label beside a grade,
and `aggregate_patterns` turns REPEATED labels into a candidate row for
ai.feature_experiments — which a human then runs, reads and decides on.
"""
from __future__ import annotations

from dataclasses import dataclass

import numpy as np

OUTCOMES = ("H", "D", "A")

CATEGORIES = (
    "NORMAL_VARIANCE",
    "DATA_GAP",
    "UNDERLYING_PERFORMANCE_SUPPORTED_MODEL",
    "UNDERLYING_PERFORMANCE_CONTRADICTED_MODEL",
    "REGIME_CHANGE_CANDIDATE",
    "CALIBRATION_WARNING",
    "MARKET_WARNING",
    "FEATURE_FAILURE_CANDIDATE",
)

# A prediction is only "confident" above this. Below it, the model did not
# claim much and there is nothing to diagnose beyond the ordinary.
CONFIDENT = 0.60
# Shot-on-target dominance that counts as the underlying play agreeing.
DOMINANCE = 1.5


@dataclass
class Diagnosis:
    prediction_id: str
    category: str
    evidence: dict

    def to_row(self) -> dict:
        return {"prediction_id": self.prediction_id,
                "diagnosis": self.category, "evidence": self.evidence}


def _favoured(row) -> tuple[str, float]:
    probs = {"H": float(row["p_home"]), "D": float(row["p_draw"]),
             "A": float(row["p_away"])}
    pick = max(probs, key=probs.get)
    return pick, probs[pick]


def _shot_ratio(row) -> float | None:
    """Home shots on target as a share of the match's total. None if unknown."""
    for f, a in (("home_shots_ot", "away_shots_ot"), ("home_shots", "away_shots")):
        hv, av = row.get(f), row.get(a)
        if hv is None or av is None:
            continue
        try:
            hv, av = float(hv), float(av)
        except (TypeError, ValueError):
            continue
        if np.isnan(hv) or np.isnan(av) or (hv + av) <= 0:
            continue
        return hv / (hv + av)
    return None


def diagnose_one(row) -> Diagnosis:
    """One graded prediction, one label, with the numbers behind it."""
    pick, confidence = _favoured(row)
    actual = str(row["actual_result"])
    correct = pick == actual
    evidence: dict = {
        "favoured": pick,
        "favoured_probability": round(confidence, 4),
        "actual": actual,
        "correct": correct,
        "log_loss": (round(float(row["log_loss"]), 4)
                     if row.get("log_loss") is not None else None),
    }

    # 1. Missing inputs first. A prediction made without the data it wanted is
    #    not evidence about the model; it is evidence about the feed.
    conf = row.get("data_confidence") or {}
    if isinstance(conf, dict):
        if conf.get("missing_inputs"):
            evidence["missing_inputs"] = conf["missing_inputs"]
            return Diagnosis(row["prediction_id"], "DATA_GAP", evidence)
        if conf.get("state") in ("limited", "insufficient"):
            evidence["data_confidence_state"] = conf.get("state")
            if not correct:
                return Diagnosis(row["prediction_id"], "DATA_GAP", evidence)

    share = _shot_ratio(row)
    evidence["home_sot_share"] = None if share is None else round(share, 4)
    if bool(row.get("red_card_distorted")):
        evidence["red_card_distorted"] = True

    # 2. A correct call needs no explanation beyond itself unless the
    #    underlying play flatly disagreed, which is worth knowing: a model can
    #    be right for the wrong reason and that is not a repeatable edge.
    if correct:
        if share is not None and confidence >= CONFIDENT:
            supported = ((pick == "H" and share >= 0.5) or
                         (pick == "A" and share <= 0.5) or pick == "D")
            if not supported:
                evidence["note"] = ("the favoured side won while being "
                                    "out-created; a right answer from a wrong "
                                    "description of the match")
                return Diagnosis(row["prediction_id"],
                                 "UNDERLYING_PERFORMANCE_CONTRADICTED_MODEL",
                                 evidence)
        return Diagnosis(row["prediction_id"], "NORMAL_VARIANCE", evidence)

    # 3. A wrong call. Not confident, so nothing was really claimed.
    if confidence < CONFIDENT:
        return Diagnosis(row["prediction_id"], "NORMAL_VARIANCE", evidence)

    # 4. A confident wrong call, judged against the underlying play.
    if share is not None:
        dominant_home = share >= DOMINANCE / (1 + DOMINANCE)     # >= 0.6
        dominant_away = share <= 1 / (1 + DOMINANCE)             # <= 0.4
        if (pick == "H" and dominant_home) or (pick == "A" and dominant_away):
            evidence["note"] = ("the side the model favoured dominated the "
                                "underlying play and lost the result; this is "
                                "what a probabilistic forecast losing looks "
                                "like, not a defect")
            return Diagnosis(row["prediction_id"],
                             "UNDERLYING_PERFORMANCE_SUPPORTED_MODEL", evidence)
        if (pick == "H" and dominant_away) or (pick == "A" and dominant_home):
            evidence["note"] = ("the model was wrong about the match, not just "
                                "about the scoreline")
            return Diagnosis(row["prediction_id"],
                             "UNDERLYING_PERFORMANCE_CONTRADICTED_MODEL", evidence)

    # 5. The market's view, when the model disagreed with it and lost. One such
    #    match means nothing; the count is what the aggregate reads.
    mkt = {k: row.get(f"mkt_{k}_prob") for k in ("home", "draw", "away")}
    key = {"H": "home", "D": "draw", "A": "away"}[pick]
    if mkt.get(key) is not None and not np.isnan(float(mkt[key] or np.nan)):
        gap = confidence - float(mkt[key])
        evidence["model_minus_market"] = round(gap, 4)
        if gap >= 0.15:
            evidence["note"] = ("the model was far more confident than the "
                                "market on the outcome that did not happen")
            return Diagnosis(row["prediction_id"], "MARKET_WARNING", evidence)

    # 6. A regime the model may not have seen. Only when the prediction itself
    #    recorded the club as new to the division: this is a stored fact rather
    #    than a fresh inference from the result that just happened.
    features = row.get("features") or {}
    if isinstance(features, dict) and (
            float(features.get("home_is_newcomer", 0) or 0) >= 1
            or float(features.get("away_is_newcomer", 0) or 0) >= 1):
        evidence["note"] = "one of these clubs is new to this division"
        return Diagnosis(row["prediction_id"], "REGIME_CHANGE_CANDIDATE", evidence)

    return Diagnosis(row["prediction_id"], "NORMAL_VARIANCE", evidence)


def diagnose_frame(frame) -> list[Diagnosis]:
    return [diagnose_one(row) for row in frame.to_dict("records")]


def aggregate_patterns(diagnoses, min_occurrences: int = 8) -> dict:
    """Turn repeated labels into candidate experiments, never into changes.

    The threshold is the whole point. One UNDERLYING_PERFORMANCE_CONTRADICTED
    match is a Saturday. Eight of them, out of a graded set this small, is a
    pattern worth spending a paired walk-forward experiment on — and an
    experiment is what this returns: a hypothesis for `ai.feature_experiments`,
    for a human to run and read.
    """
    counts: dict[str, int] = {}
    for d in diagnoses:
        counts[d.category] = counts.get(d.category, 0) + 1

    total = sum(counts.values())
    candidates = []
    if counts.get("UNDERLYING_PERFORMANCE_CONTRADICTED_MODEL", 0) >= min_occurrences:
        candidates.append({
            "hypothesis": "the model is repeatedly wrong about the underlying "
                          "play, not merely about scorelines; test whether the "
                          "`performance` feature family improves this league",
            "suggested_study": "ablate --groups performance",
            "occurrences": counts["UNDERLYING_PERFORMANCE_CONTRADICTED_MODEL"],
        })
    if counts.get("DATA_GAP", 0) >= min_occurrences:
        candidates.append({
            "hypothesis": "confident losses cluster where inputs were missing; "
                          "the binding constraint is coverage rather than the model",
            "suggested_study": "data_quality --league <L>",
            "occurrences": counts["DATA_GAP"],
        })
    if counts.get("MARKET_WARNING", 0) >= min_occurrences:
        candidates.append({
            "hypothesis": "large disagreements with the market are losing "
                          "systematically; test a tighter market-discrepancy "
                          "gate, or a market-informed component",
            "suggested_study": "train --family ensemble --base-families poisson elo market",
            "occurrences": counts["MARKET_WARNING"],
        })
    if counts.get("REGIME_CHANGE_CANDIDATE", 0) >= min_occurrences:
        candidates.append({
            "hypothesis": "promoted and newly-arrived clubs are mispriced; test "
                          "regime weighting of pre-transition history",
            "suggested_study": "experiments --study regime-weighting",
            "occurrences": counts["REGIME_CHANGE_CANDIDATE"],
        })

    return {
        "graded": total,
        "counts": counts,
        "share": {k: round(v / total, 4) for k, v in counts.items()} if total else {},
        "candidate_experiments": candidates,
        "note": ("A single match may never modify or promote a model. These are "
                 "hypotheses for paired walk-forward experiments, not changes."),
    }
