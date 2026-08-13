"""Three different things that all get called "confidence", kept apart.

    outcome probability   Arsenal win 67%.
    model agreement       do the independent models say the same thing?
    data confidence       how much evidence is this built on?
    probability uncertainty   how far could 67% move on better evidence?

Conflating the first two is the standard error in this field and it is not
cosmetic: "67% confidence" reads as a statement about how sure the system is,
when it is a statement about how often Arsenal win. A model can be extremely
sure of 67% (deep history, four models agreeing, calibrated) or barely able to
justify it (a promoted club, no shot data, three models spread from 51 to 82),
and those two 67%s should not be presented, staked or explained identically.

Everything here is deterministic. No sampling, no seeds, no LLM judgement: the
same inputs give the same score for ever, which is what lets a number be
argued with. Where a component cannot be measured it is reported as missing
rather than defaulted, because a defaulted component is an invented
measurement.
"""
from __future__ import annotations

from dataclasses import dataclass, field

import numpy as np

OUTCOMES = ("H", "D", "A")

# Bands. Deliberately coarse: the difference between 0.62 and 0.64 is not
# meaningful, and presenting it as though it were invites false precision.
CONFIDENCE_STATES = ("high", "medium", "limited", "insufficient")
CONFIDENCE_THRESHOLDS = {"high": 0.75, "medium": 0.55, "limited": 0.35}

AGREEMENT_STATES = ("strong", "moderate", "weak", "conflicted")


def _clean(probs) -> np.ndarray:
    p = np.asarray(probs, dtype=float).reshape(-1, 3)
    p = np.clip(p, 1e-9, 1.0)
    return p / p.sum(axis=1, keepdims=True)


def _band(score: float, thresholds: dict[str, float], states: tuple[str, ...]) -> str:
    for state in states[:-1]:
        if score >= thresholds[state]:
            return state
    return states[-1]


# ---------------------------------------------------------------------------
# B. Model agreement
# ---------------------------------------------------------------------------

def model_agreement(base_probs: dict[str, object]) -> dict:
    """How much the independent base models actually disagree.

    67/66/68/65 and 82/51/73/62 can both average to 67 and they are not the
    same evidence. The first is four models saying one thing; the second is a
    disagreement whose midpoint happens to look like a consensus.

    Reported as three things rather than one, because they fail differently:

      max_pairwise_tv   the largest total-variation distance between any two
                        models. Total variation is the right metric here: it is
                        the largest probability difference the two models
                        assign to any event, so 0.15 means "somewhere there is
                        an event these two price 15 points apart".
      spread_top        the range of the probabilities assigned to the
                        consensus pick, which is the number a reader intuits.
      same_pick         whether they would even bet on the same outcome.
    """
    families = sorted(base_probs)
    if len(families) < 2:
        return {"measurable": False,
                "reason": "fewer than two independent models",
                "families": families}

    matrix = np.vstack([_clean(base_probs[f])[0] for f in families])
    picks = [OUTCOMES[int(i)] for i in matrix.argmax(axis=1)]
    consensus = int(matrix.mean(axis=0).argmax())

    tv = 0.0
    for i in range(len(families)):
        for j in range(i + 1, len(families)):
            tv = max(tv, float(0.5 * np.abs(matrix[i] - matrix[j]).sum()))

    spread = float(matrix[:, consensus].max() - matrix[:, consensus].min())
    same_pick = len(set(picks)) == 1

    # A total-variation distance of 0.20 between two models of the same match
    # is a serious disagreement; 0.05 is ordinary. The mapping is linear
    # between them and is a presentation choice, stated here rather than
    # buried: score 1 at tv <= 0.05, 0 at tv >= 0.30.
    score = float(np.clip((0.30 - tv) / 0.25, 0.0, 1.0))
    if not same_pick:
        # Models that would bet differently are not in moderate agreement,
        # whatever the distance says.
        score = min(score, 0.45)

    state = _band(score, {"strong": 0.75, "moderate": 0.55, "weak": 0.30},
                  AGREEMENT_STATES)
    return {
        "measurable": True,
        "families": families,
        "per_model": {f: [round(float(v), 4) for v in matrix[i]]
                      for i, f in enumerate(families)},
        "picks": dict(zip(families, picks)),
        "same_pick": same_pick,
        "consensus_outcome": OUTCOMES[consensus],
        "max_pairwise_tv": round(tv, 4),
        "spread_on_consensus": round(spread, 4),
        "score": round(score, 4),
        "state": state,
    }


# ---------------------------------------------------------------------------
# D. Probability uncertainty
# ---------------------------------------------------------------------------

def probability_uncertainty(point_probs, base_probs: dict[str, object] | None = None,
                            fold_error: float | None = None,
                            n_calibration: int | None = None) -> dict:
    """An interval around each outcome probability, from measured dispersion.

    Not +/- an invented constant. Three sources, each of which is a real
    measurement of how far this number could reasonably be:

      disagreement   the standard deviation of the independent base models'
                     probabilities for that outcome. When the models are
                     identical this is zero and contributes nothing.
      fold_error     the model's own season-to-season standard error, carried
                     on the artefact from walk-forward evaluation. This is the
                     "how much does this model move when the training data
                     moves" term, and it is the one that never goes to zero.
      sampling       binomial sampling error at the calibration sample size,
                     which is what stops a model calibrated on 300 matches
                     claiming a tight interval.

    Combined in quadrature as independent sources, then clipped to [0, 1] and
    the three intervals are NOT renormalised: an interval that summed to one
    would be a distribution, not an interval, and reporting 62-71% for the home
    win means exactly that and nothing about the other two.
    """
    p = _clean(point_probs)[0]
    parts: dict[str, float] = {}

    spread = np.zeros(3)
    if base_probs and len(base_probs) >= 2:
        matrix = np.vstack([_clean(v)[0] for v in base_probs.values()])
        spread = matrix.std(axis=0, ddof=1 if len(matrix) > 1 else 0)
    parts["model_disagreement"] = round(float(spread.mean()), 4)

    fold = float(fold_error) if fold_error is not None else 0.0
    parts["fold_error"] = round(fold, 4)

    sampling = np.zeros(3)
    if n_calibration and n_calibration > 0:
        sampling = np.sqrt(p * (1 - p) / float(n_calibration))
    parts["sampling"] = round(float(sampling.mean()), 4)

    sigma = np.sqrt(spread ** 2 + fold ** 2 + sampling ** 2)
    lo = np.clip(p - 1.96 * sigma, 0.0, 1.0)
    hi = np.clip(p + 1.96 * sigma, 0.0, 1.0)

    width = float((hi - lo).max())
    return {
        "point": {o: round(float(p[i]), 4) for i, o in enumerate(OUTCOMES)},
        "interval": {o: [round(float(lo[i]), 4), round(float(hi[i]), 4)]
                     for i, o in enumerate(OUTCOMES)},
        "sigma": {o: round(float(sigma[i]), 4) for i, o in enumerate(OUTCOMES)},
        "components": parts,
        "max_width": round(width, 4),
        # A 95% interval wider than 20 points on the outcome being bet is not
        # a forecast anyone should stake on, and the value gate reads this.
        "wide": bool(width > 0.20),
    }


# ---------------------------------------------------------------------------
# C. Data confidence
# ---------------------------------------------------------------------------

@dataclass(frozen=True)
class ConfidenceComponent:
    key: str
    score: float | None          # None = could not be measured
    weight: float
    detail: str
    evidence: dict = field(default_factory=dict)


def _ratio(value: float, full: float) -> float:
    return float(np.clip(value / full, 0.0, 1.0)) if full > 0 else 0.0


# ---------------------------------------------------------------------------
# The deterministic missing-input authority
#
# `ValueGate.PASS_INPUT_PENDING` and `Candidate.missing_inputs` existed from
# the start and nothing ever populated them, which made the first gate in the
# sequence permanently inert. This is what fills them, and the rule it applies
# is narrow on purpose:
#
#   A required input is one the PROMOTED model actually needs to produce a
#   number at all. Optional, unproven or nice-to-have data is not "pending" —
#   it is absent, it is already priced into `data_confidence`, and treating it
#   as pending would turn every ordinary forecast into a refusal and make the
#   code meaningless in the other direction.
#
# No language model decides any of this. Each entry is a fact about a feature
# row or about a market snapshot.
# ---------------------------------------------------------------------------

REQUIRED_INPUT_CODES = (
    "identity_unresolved",          # the fixture's clubs are not who we think
    "feature_row_empty",            # the builder produced nothing
    "market_price_unavailable",     # a market model with no price at snapshot
    "market_price_incomplete",      # a price that is not a full 1X2 set
)


def required_inputs_missing(features: dict | None = None,
                            market_evidence: dict | None = None,
                            uses_market: bool = False,
                            identity: dict | None = None) -> list[str]:
    """Which REQUIRED inputs this forecast did not get. Usually none."""
    missing: list[str] = []

    if identity is not None and identity.get("blocked"):
        missing.append("identity_unresolved")

    if not features:
        missing.append("feature_row_empty")

    # Only a market-informed model requires a price. A pure football forecast
    # is not less complete for having no odds beside it, and saying so would
    # make the pure model unbettable for a reason that has nothing to do with
    # the pure model.
    if uses_market:
        evidence = market_evidence or {}
        books = evidence.get("book_count")
        if not books:
            missing.append("market_price_unavailable")
        elif evidence.get("incomplete_1x2"):
            missing.append("market_price_incomplete")

    return missing


def data_confidence(features: dict | None = None,
                    league_evidence: dict | None = None,
                    market_evidence: dict | None = None,
                    agreement: dict | None = None,
                    regime: dict | None = None,
                    missing_inputs: list[str] | None = None) -> dict:
    """An explainable score, with the components that produced it.

    Every component is derived from something this system actually measured.
    Nothing here asks a language model what it thinks, and nothing here is
    tuned to make the number look reassuring: the weights are stated, the
    components are returned, and a caller that disagrees with the weighting can
    recompute from the breakdown.
    """
    features = features or {}
    league_evidence = league_evidence or {}
    market_evidence = market_evidence or {}
    missing_inputs = list(missing_inputs or [])

    components: list[ConfidenceComponent] = []

    # 1. How much football has been seen for these two clubs. `matches_known`
    #    saturates at 10 in the feature builder, which is also where a rolling
    #    form window stops learning.
    known = [features.get("home_matches_known"), features.get("away_matches_known")]
    if all(v is not None for v in known):
        components.append(ConfidenceComponent(
            "recent_form_sample",
            float(np.mean([_ratio(float(v), 10.0) for v in known])),
            0.20,
            "matches in each club's rolling window",
            {"home": known[0], "away": known[1]}))
    else:
        components.append(ConfidenceComponent(
            "recent_form_sample", None, 0.20, "feature row did not carry it"))

    # 2. Underlying-performance coverage: shots, shots on target, corners.
    #    A league with no shot data is a league where the model is working from
    #    scorelines alone, which is a materially weaker basis.
    coverage_keys = ("home_sot_known", "away_sot_known",
                     "home_shots_known", "away_shots_known",
                     "home_corners_known", "away_corners_known")
    present = [float(features[k]) for k in coverage_keys if features.get(k) is not None]
    components.append(ConfidenceComponent(
        "underlying_stat_coverage",
        float(np.mean(present)) if present else None,
        0.15,
        "share of each form window carrying shots/SOT/corners",
        {"measured_keys": len(present)}))

    # 3. Newcomers. A promoted club has a rating and a form window built in a
    #    different division; the model says so through `is_newcomer`.
    newcomers = [features.get("home_is_newcomer"), features.get("away_is_newcomer")]
    if all(v is not None for v in newcomers):
        components.append(ConfidenceComponent(
            "established_in_division",
            # Each newcomer costs 35% of this component; two cost 70%. A
            # promoted club is not unpredictable, it is less evidenced.
            float(1.0 - 0.35 * np.mean([float(v) for v in newcomers])),
            0.10,
            "neither club is new to this division",
            {"home_newcomer": newcomers[0], "away_newcomer": newcomers[1]}))

    # 4. The league's own track record. A model that has been well calibrated
    #    in this league for five seasons is better evidence than the same model
    #    in a league it has never been graded in.
    #    `calibration_error` is an EXPECTED CALIBRATION ERROR — the
    #    sample-weighted mean gap between the probability claimed in a
    #    reliability bin and the frequency observed in it. It used to be
    #    `mean(|max(p) - correct|)`, which is not a calibration measure: a
    #    perfectly calibrated set of 70% forecasts is wrong 30% of the time, so
    #    that expression returned about 0.42 on flawless output and this
    #    component then scored it 0 against the 0.10 scale below. A genuinely
    #    calibrated league was penalised as hard as a broken one. Accuracy,
    #    Brier/log loss and calibration are three different measurements and
    #    are kept three different fields.
    graded = league_evidence.get("graded_predictions")
    ece = league_evidence.get("calibration_error")
    if graded is not None:
        # 0.10 is a real threshold for an ECE: ten percentage points of
        # average reliability gap is a badly calibrated model.
        cal_score = 1.0 if ece is None else float(np.clip(1.0 - float(ece) / 0.10, 0.0, 1.0))
        components.append(ConfidenceComponent(
            "league_track_record",
            float(np.sqrt(_ratio(float(graded), 500.0) * max(cal_score, 0.05))),
            0.15,
            "graded predictions in this league, and how calibrated they were",
            {"graded": graded, "calibration_error": ece}))
    else:
        components.append(ConfidenceComponent(
            "league_track_record", None, 0.15,
            "no graded predictions recorded for this league yet"))

    # 5. Calibration sample behind the probability itself.
    n_cal = league_evidence.get("calibration_rows")
    components.append(ConfidenceComponent(
        "calibration_sample",
        _ratio(float(n_cal), 3000.0) if n_cal else None,
        0.10,
        "out-of-fold rows the calibrator was fitted on",
        {"rows": n_cal}))

    # 6. Market inputs. Only relevant when a price is part of the answer; a
    #    pure football forecast is not less confident for having no odds, so
    #    this component is absent rather than zero.
    if market_evidence:
        age = market_evidence.get("price_age_minutes")
        books = market_evidence.get("book_count")
        pieces = []
        if age is not None:
            pieces.append(float(np.clip(1.0 - float(age) / 720.0, 0.0, 1.0)))
        if books is not None:
            pieces.append(_ratio(float(books), 6.0))
        components.append(ConfidenceComponent(
            "market_inputs",
            float(np.mean(pieces)) if pieces else None,
            0.10,
            "how fresh the prices are and how many books stand behind them",
            {"price_age_minutes": age, "book_count": books}))

    # 7. Regime. A club the detector believes has changed is a club whose
    #    history is less representative, which is a data statement.
    if regime is not None:
        changed = bool(regime.get("home_regime_change")) or bool(regime.get("away_regime_change"))
        components.append(ConfidenceComponent(
            "stable_regime", 0.45 if changed else 1.0, 0.10,
            "neither club shows a detected regime change",
            {k: regime.get(k) for k in ("home_regime_change", "away_regime_change")}))

    # 8. Independent models agreeing is evidence about the EVIDENCE, not about
    #    the outcome, which is why it belongs here and not in the probability.
    if agreement and agreement.get("measurable"):
        components.append(ConfidenceComponent(
            "model_agreement", float(agreement["score"]), 0.10,
            "independent base models point the same way",
            {"state": agreement["state"], "max_pairwise_tv": agreement["max_pairwise_tv"]}))

    # 9. Anything the prediction wanted and did not get.
    if missing_inputs:
        components.append(ConfidenceComponent(
            "required_inputs_present", 0.0, 0.20,
            "inputs the model expected are missing",
            {"missing": missing_inputs}))

    measured = [c for c in components if c.score is not None]
    unmeasured = [c.key for c in components if c.score is None]
    if not measured:
        overall = 0.0
    else:
        total_w = sum(c.weight for c in measured)
        overall = float(sum(c.score * c.weight for c in measured) / total_w)

    # An unmeasurable component is not a free pass. Each one shaves the score,
    # because "we could not check" is a weaker position than "we checked".
    penalty = 0.05 * len(unmeasured)
    overall = float(np.clip(overall - penalty, 0.0, 1.0))
    state = _band(overall, CONFIDENCE_THRESHOLDS, CONFIDENCE_STATES)
    if missing_inputs:
        state = "insufficient"

    return {
        "score": round(overall, 4),
        "state": state,
        "components": [
            {"key": c.key,
             "score": None if c.score is None else round(float(c.score), 4),
             "weight": c.weight, "detail": c.detail, "evidence": c.evidence}
            for c in components
        ],
        "unmeasured": unmeasured,
        "missing_inputs": missing_inputs,
        "note": ("Data confidence is not the outcome probability. A 70% "
                 "favourite can carry limited data confidence, and a 40% "
                 "outcome can carry high data confidence."),
    }
