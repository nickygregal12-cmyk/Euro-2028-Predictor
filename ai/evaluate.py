"""Grade finished fixtures against the predictions that were made before them.

    python evaluate.py --league EPL

Writes to ai.prediction_results, never to ai.predictions. The prediction is
what the model said; the grade is what happened. Keeping them in separate rows
is what makes the track record on the admin page worth reading.
"""
from __future__ import annotations

import argparse
import sys

import numpy as np

import betting
import diagnose as diagnose_mod
import metrics
from config import LEAGUES
from db import (insert_prediction_results, job,
                load_finished_fixtures_needing_grading,
                load_graded_rows_needing_market_comparison,
                load_predictions_needing_diagnosis,
                update_prediction_diagnosis,
                update_prediction_market_comparison)


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--league", choices=sorted(LEAGUES), required=True)
    ap.add_argument("--no-diagnosis", action="store_true",
                    help="Grade only; skip the post-match diagnosis pass.")
    ap.add_argument("--devig", default="shin", choices=sorted(betting.DEVIG),
                    help="How the closing benchmark is de-vigged for the market "
                         "comparison. Matches settle_bets so the two records are "
                         "comparable.")
    args = ap.parse_args()
    with job("evaluate", args.league) as state:
        pending = load_finished_fixtures_needing_grading(args.league)
        if pending.empty:
            print("Nothing to grade.")
            # The backfill still runs. A quiet grading pass is the ORDINARY
            # state on the days that matter here: the fixtures were graded when
            # they finished, and Football-Data published their closing line
            # afterwards.
            backfilled = _backfill_market_comparison(args)
            state["detail"] = ({"graded": 0} | backfilled | _diagnose(args))
            return 0

        probs = pending[["p_home", "p_draw", "p_away"]].astype(float).values
        hg = pending["home_score"].astype(int).values
        ag = pending["away_score"].astype(int).values
        actual = np.where(hg > ag, "H", np.where(hg == ag, "D", "A"))

        ll = metrics.log_loss_per_match(probs, actual)
        br = metrics.brier_per_match(probs, actual)
        rp = metrics.rps_per_match(probs, actual)

        records = pending.to_dict("records")
        rows = []
        for i, rec in enumerate(pending.itertuples(index=False)):
            scoreline = f"{hg[i]}-{ag[i]}"
            row = {
                "prediction_id": rec.prediction_id,
                "actual_home_goals": int(hg[i]),
                "actual_away_goals": int(ag[i]),
                "actual_result": str(actual[i]),
                "result_correct": bool(rec.predicted_result == actual[i]),
                "exact_score_correct": bool(rec.predicted_score == scoreline),
                "log_loss": round(float(ll[i]), 5),
                "brier": round(float(br[i]), 5),
                "rps": round(float(rp[i]), 5),
            }
            row.update(_market_comparison(records[i], probs[i], str(actual[i]),
                                          float(ll[i]), args.devig))
            rows.append(row)

        written = insert_prediction_results(rows)
        summary = metrics.summarise(probs, actual)
        backfilled = _backfill_market_comparison(args)
        state["rows"] = written
        state["detail"] = summary | backfilled | _diagnose(args)
        print(f"graded {written} predictions")
        print(f"  accuracy  {summary['accuracy']:.3f}")
        print(f"  log loss  {summary['log_loss']:.4f}")
        print(f"  rps       {summary['rps']:.4f}")
    return 0


# The market comparison, which is the only comparison that means anything at
# this sample size.
#
# Accuracy over fifty-seven fixtures is dominated by variance and log loss alone
# says nothing about whether the model is adding information. Log loss against
# the de-vigged CLOSING line does: the closing line is the sharpest widely
# available forecast of the same match, so beating it is the claim the lab is
# actually making. Contract 185 added these columns and nothing was writing
# them, so every one of Production's 107 graded rows on 18 August 2026 carried a
# null market_log_loss while the closing prices sat in ai.raw_matches beside it.
#
# CLOSING PRICES REMAIN A BENCHMARK AND NEVER A FEATURE. They are read here,
# after the match, into the results table — never into ai.predictions, never
# into a training frame. `market_features.assert_no_closing_features` is the
# guard on the other side of that line and is untouched.
def _market_comparison(record: dict, probs, actual: str, model_log_loss: float,
                       devig: str) -> dict:
    """Six nullable columns, or six nulls when no closing benchmark exists."""
    empty = {"mkt_home_closing": None, "mkt_draw_closing": None,
             "mkt_away_closing": None, "market_log_loss": None,
             "log_loss_vs_market": None, "market_moved_toward_model": None}
    close, _benchmark, _overround = betting.closing_triple(record)
    if close is None:
        return empty

    fair = betting.fair_probabilities(close.reshape(1, 3), devig)[0]
    leg = betting.OUTCOMES.index(actual)
    market_ll = float(-np.log(max(float(fair[leg]), 1e-12)))

    # Did the market move the way the model already had? Only answerable when a
    # market price was captured AT prediction time, which is a different thing
    # from the closing price and is stored separately for exactly this reason.
    moved = None
    at_prediction = [record.get(f"mkt_{leg_name}_at_prediction")
                     for leg_name in ("home", "draw", "away")]
    if all(value is not None and np.isfinite(float(value)) for value in at_prediction):
        opening = betting.fair_probabilities(
            np.asarray([[float(v) for v in at_prediction]]), devig)[0]
        model_minus_opening = float(probs[leg]) - float(opening[leg])
        close_minus_opening = float(fair[leg]) - float(opening[leg])
        # Same direction, and the model was not merely agreeing with the price
        # it was shown.
        moved = bool(model_minus_opening * close_minus_opening > 0)

    return {
        "mkt_home_closing": round(float(close[0]), 3),
        "mkt_draw_closing": round(float(close[1]), 3),
        "mkt_away_closing": round(float(close[2]), 3),
        "market_log_loss": round(market_ll, 5),
        # NEGATIVE IS THE MODEL WINNING: it is the model's loss minus the
        # market's, and lower loss is better.
        "log_loss_vs_market": round(model_log_loss - market_ll, 5),
        "market_moved_toward_model": moved,
    }


def _backfill_market_comparison(args) -> dict:
    """Second pass: give an already-graded row the benchmark it was missing.

    THE OUTCOME IS GRADED WITHOUT THE MARKET AND THE MARKET IS ADDED LATER,
    which is the same separation settle_bets makes between settling a bet and
    recording its CLV. The reason is the same too: the two facts arrive at
    different times from different sources, and making one wait for the other
    means the lab has neither.

    This pass cannot revise a comparison. It writes only where
    `market_log_loss` is still null, and it selects only rows where a closing
    price exists, so a fixture the feed never priced keeps six honest nulls
    rather than a number nobody published.
    """
    pending = load_graded_rows_needing_market_comparison(args.league)
    if pending.empty:
        return {"market_comparison_backfilled": 0,
                "awaiting_closing_benchmark": _awaiting_benchmark(args)}

    probs = pending[["p_home", "p_draw", "p_away"]].astype(float).values
    records = pending.to_dict("records")
    rows = []
    for i, record in enumerate(records):
        comparison = _market_comparison(record, probs[i],
                                        str(record["actual_result"]),
                                        float(record["log_loss"]), args.devig)
        if comparison["market_log_loss"] is None:
            continue
        rows.append({"prediction_id": record["prediction_id"]} | comparison)

    written = update_prediction_market_comparison(rows)
    if written:
        print(f"backfilled market comparison on {written} graded predictions")
    return {"market_comparison_backfilled": written,
            "awaiting_closing_benchmark": _awaiting_benchmark(args)}


def _awaiting_benchmark(args) -> int:
    """Graded rows still without a comparison AFTER the backfill ran.

    Reported rather than inferred from silence: a non-zero count here means the
    closing line has not been published for those fixtures yet, which is a
    normal state and a different one from the columns never being written.
    """
    return int(len(load_graded_rows_needing_market_comparison(args.league)))


def _diagnose(args) -> dict:
    """Label each freshly graded prediction, then look for repetition.

    Separate from grading on purpose. A grade is arithmetic and is never in
    doubt; a diagnosis is an opinion about WHY, it can be wrong, and it is
    written to its own columns so that re-diagnosing later can never disturb
    the score a prediction was given.
    """
    if args.no_diagnosis:
        return {}
    pending = load_predictions_needing_diagnosis(args.league)
    if pending.empty:
        return {"diagnosed": 0}

    diagnoses = diagnose_mod.diagnose_frame(pending)
    written = update_prediction_diagnosis([d.to_row() for d in diagnoses])
    patterns = diagnose_mod.aggregate_patterns(diagnoses)

    print(f"\ndiagnosed {written} graded predictions")
    for category, n in sorted(patterns["counts"].items(), key=lambda kv: -kv[1]):
        print(f"  {category:<45}{n:>5}")
    if patterns["candidate_experiments"]:
        print("\n  recurring patterns worth an experiment "
              "(nothing is changed by this):")
        for candidate in patterns["candidate_experiments"]:
            print(f"    - {candidate['hypothesis']}")
            print(f"      run: {candidate['suggested_study']} "
                  f"({candidate['occurrences']} occurrences)")
    else:
        print("  no pattern occurs often enough to be worth an experiment yet")
    return {"diagnosed": written, "diagnosis_patterns": patterns}


if __name__ == "__main__":
    sys.exit(main())
