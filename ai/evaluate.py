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

import diagnose as diagnose_mod
import metrics
from config import LEAGUES
from db import (insert_prediction_results, job,
                load_finished_fixtures_needing_grading,
                load_predictions_needing_diagnosis, update_prediction_diagnosis)


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--league", choices=sorted(LEAGUES), required=True)
    ap.add_argument("--no-diagnosis", action="store_true",
                    help="Grade only; skip the post-match diagnosis pass.")
    args = ap.parse_args()
    with job("evaluate", args.league) as state:
        pending = load_finished_fixtures_needing_grading(args.league)
        if pending.empty:
            print("Nothing to grade.")
            state["detail"] = {"graded": 0} | _diagnose(args)
            return 0

        probs = pending[["p_home", "p_draw", "p_away"]].astype(float).values
        hg = pending["home_score"].astype(int).values
        ag = pending["away_score"].astype(int).values
        actual = np.where(hg > ag, "H", np.where(hg == ag, "D", "A"))

        ll = metrics.log_loss_per_match(probs, actual)
        br = metrics.brier_per_match(probs, actual)
        rp = metrics.rps_per_match(probs, actual)

        rows = []
        for i, rec in enumerate(pending.itertuples(index=False)):
            scoreline = f"{hg[i]}-{ag[i]}"
            rows.append({
                "prediction_id": rec.prediction_id,
                "actual_home_goals": int(hg[i]),
                "actual_away_goals": int(ag[i]),
                "actual_result": str(actual[i]),
                "result_correct": bool(rec.predicted_result == actual[i]),
                "exact_score_correct": bool(rec.predicted_score == scoreline),
                "log_loss": round(float(ll[i]), 5),
                "brier": round(float(br[i]), 5),
                "rps": round(float(rp[i]), 5),
            })

        written = insert_prediction_results(rows)
        summary = metrics.summarise(probs, actual)
        state["rows"] = written
        state["detail"] = summary | _diagnose(args)
        print(f"graded {written} predictions")
        print(f"  accuracy  {summary['accuracy']:.3f}")
        print(f"  log loss  {summary['log_loss']:.4f}")
        print(f"  rps       {summary['rps']:.4f}")
    return 0


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
