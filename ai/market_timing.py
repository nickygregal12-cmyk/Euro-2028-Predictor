"""Does the market move toward this model, and does it move before kickoff?

The interesting question is not whether a model beats the closing line on a
graded result — that takes hundreds of settled bets to answer. It is whether
the market, over the hours between a forecast and kickoff, moves toward the
model's disagreement. That is measurable in dozens of fixtures rather than
hundreds, because every fixture contributes a measurement rather than a coin
flip.

It is also entirely unmeasurable without timestamped price history, and this
is the module's first job: to count what exists before fitting anything to it.
`ai.market_snapshots` has existed since contract 185 and may be empty. A
movement model fitted on two snapshots per fixture is a model of a rounding
error, and it would look exactly like a model.

So the order is: measure the sample, report `INSUFFICIENT_DATA` if it is not
there, and fit nothing. That is the whole discipline — the failure mode being
avoided is a trained-looking artefact with no evidence underneath it.

The closing line is never a feature. It is the outcome variable here, exactly
as it is the benchmark elsewhere: "did the price move toward us by close" is a
question ABOUT the closing line, and a model given the closing line to answer
it would score perfectly and mean nothing.
"""
from __future__ import annotations

from dataclasses import dataclass

import numpy as np
import pandas as pd

import betting

# Below this many fixtures with at least two snapshots, there is nothing to
# study. Deliberately modest: the point is to distinguish "nothing" from
# "something small", not to promise significance.
MIN_FIXTURES = 60
MIN_SNAPSHOTS_PER_FIXTURE = 2

INSUFFICIENT = "INSUFFICIENT_DATA"


@dataclass
class SampleVerdict:
    sufficient: bool
    fixtures: int
    fixtures_with_movement: int
    snapshots: int
    detail: str

    def to_dict(self) -> dict:
        return {
            "sufficient": self.sufficient,
            "status": "OK" if self.sufficient else INSUFFICIENT,
            "fixtures": self.fixtures,
            "fixtures_with_multiple_snapshots": self.fixtures_with_movement,
            "snapshots": self.snapshots,
            "detail": self.detail,
        }


def assess_sample(inventory: pd.DataFrame) -> SampleVerdict:
    """Is there enough timestamped price history to study movement at all?

    `inventory` is `db.market_snapshot_inventory` output: one row per
    (fixture, bookmaker) with a snapshot count and a first/last instant.
    """
    if inventory is None or inventory.empty:
        return SampleVerdict(
            False, 0, 0, 0,
            "ai.market_snapshots is empty. Movement cannot be studied, and no "
            "model is fitted. Collection is the prerequisite, not analysis.")

    per_fixture = inventory.groupby(
        inventory["season_fixture_id"].astype(str)
        + "|" + inventory["raw_match_id"].astype(str)
    )["snapshots"].sum()
    with_movement = int((per_fixture >= MIN_SNAPSHOTS_PER_FIXTURE).sum())
    total_snapshots = int(inventory["snapshots"].sum())
    fixtures = int(len(per_fixture))
    sufficient = with_movement >= MIN_FIXTURES

    return SampleVerdict(
        sufficient, fixtures, with_movement, total_snapshots,
        (f"{with_movement} fixtures carry at least "
         f"{MIN_SNAPSHOTS_PER_FIXTURE} snapshots"
         + ("" if sufficient else
            f", which is below the {MIN_FIXTURES} needed to say anything. "
            "Reporting INSUFFICIENT_DATA rather than fitting a model.")))


def movement_features(snapshots: pd.DataFrame, devig: str = "shin") -> pd.DataFrame:
    """Per-fixture movement, computed from snapshots only.

    Every column here is derived from prices captured at or before the instant
    it describes. `closing_*` columns are produced separately by
    `closing_outcomes` and are never joined into this frame, so a caller cannot
    accidentally train on them.
    """
    if snapshots is None or snapshots.empty:
        return pd.DataFrame()

    rows = []
    ordered = snapshots.sort_values("captured_at")
    for key, group in ordered.groupby(
            ordered["season_fixture_id"].astype(str)
            + "|" + ordered["raw_match_id"].astype(str)):
        pre = group[~group["is_closing"].astype(bool)]
        if len(pre) < MIN_SNAPSHOTS_PER_FIXTURE:
            continue
        first = pre.iloc[0]
        last = pre.iloc[-1]
        opening = betting.fair_probabilities(
            np.array([[float(first["odds_home"]), float(first["odds_draw"]),
                       float(first["odds_away"])]]), devig)[0]
        current = betting.fair_probabilities(
            np.array([[float(last["odds_home"]), float(last["odds_draw"]),
                       float(last["odds_away"])]]), devig)[0]
        rows.append({
            "fixture_key": key,
            "season_fixture_id": first["season_fixture_id"],
            "raw_match_id": first["raw_match_id"],
            "snapshots": int(len(pre)),
            "hours_covered": round(
                (pd.to_datetime(last["captured_at"])
                 - pd.to_datetime(first["captured_at"])).total_seconds() / 3600, 2),
            "open_p_home": opening[0], "open_p_draw": opening[1], "open_p_away": opening[2],
            "now_p_home": current[0], "now_p_draw": current[1], "now_p_away": current[2],
            "move_home": current[0] - opening[0],
            "move_draw": current[1] - opening[1],
            "move_away": current[2] - opening[2],
            "overround_now": float(betting.overround(
                np.array([float(last["odds_home"]), float(last["odds_draw"]),
                          float(last["odds_away"])])) - 1.0),
            "dispersion_books": int(group["bookmaker"].nunique()),
        })
    return pd.DataFrame(rows)


def closing_outcomes(snapshots: pd.DataFrame, devig: str = "shin") -> pd.DataFrame:
    """The closing view, as an OUTCOME. Never merged into the feature frame."""
    if snapshots is None or snapshots.empty:
        return pd.DataFrame()
    closing = snapshots[snapshots["is_closing"].astype(bool)]
    if closing.empty:
        return pd.DataFrame()
    rows = []
    for key, group in closing.groupby(
            closing["season_fixture_id"].astype(str)
            + "|" + closing["raw_match_id"].astype(str)):
        last = group.sort_values("captured_at").iloc[-1]
        fair = betting.fair_probabilities(
            np.array([[float(last["odds_home"]), float(last["odds_draw"]),
                       float(last["odds_away"])]]), devig)[0]
        rows.append({"fixture_key": key, "close_p_home": fair[0],
                     "close_p_draw": fair[1], "close_p_away": fair[2]})
    return pd.DataFrame(rows)


def study_movement(inventory: pd.DataFrame, snapshots: pd.DataFrame | None = None,
                   model_probabilities: pd.DataFrame | None = None) -> dict:
    """The whole analysis, refusing to run when the sample is not there.

    When there IS enough, the question asked is narrow and answerable: on the
    fixtures where this model disagreed with the opening price, did the market
    subsequently move toward the model more often than away from it? That is a
    sign test on a paired quantity, not a trained model, and it needs no
    parameters to be believed.
    """
    verdict = assess_sample(inventory)
    out = {"sample": verdict.to_dict()}
    if not verdict.sufficient:
        out["status"] = INSUFFICIENT
        out["fitted_model"] = None
        out["next_step"] = (
            "Collect snapshots: the analysis path is implemented and will run "
            "as soon as ai.market_snapshots carries enough history. No model "
            "has been fitted, and none should be until it does.")
        return out

    features = movement_features(snapshots) if snapshots is not None else pd.DataFrame()
    if features.empty:
        out["status"] = INSUFFICIENT
        out["detail"] = "inventory suggested a sample but no usable snapshot pairs were found"
        return out

    out["status"] = "OK"
    out["movement_summary"] = {
        "fixtures": int(len(features)),
        "mean_absolute_home_move": round(float(features["move_home"].abs().mean()), 5),
        "mean_hours_covered": round(float(features["hours_covered"].mean()), 2),
        "mean_overround": round(float(features["overround_now"].mean()), 5),
    }

    if model_probabilities is not None and not model_probabilities.empty:
        merged = features.merge(model_probabilities, on="fixture_key", how="inner")
        if len(merged) >= MIN_FIXTURES:
            disagreement = merged["p_home"] - merged["open_p_home"]
            moved_toward = np.sign(disagreement) == np.sign(merged["move_home"])
            material = disagreement.abs() >= 0.02
            n = int(material.sum())
            out["market_moved_toward_model"] = {
                "fixtures": n,
                "share": (round(float(moved_toward[material].mean()), 4) if n else None),
                "interpretation": (
                    "Above 0.5 means the market tended to move toward this "
                    "model's disagreement before kickoff, which is evidence "
                    "of information rather than of profit."),
            }
        else:
            out["market_moved_toward_model"] = {
                "status": INSUFFICIENT,
                "fixtures": int(len(merged)),
            }
    return out
