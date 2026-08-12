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

import metrics
from config import LEAGUES
from db import (insert_prediction_results, job,
                load_finished_fixtures_needing_grading)


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--league", choices=sorted(LEAGUES), required=True)
    args = ap.parse_args()
    with job("evaluate", args.league) as state:
        pending = load_finished_fixtures_needing_grading(args.league)
        if pending.empty:
            print("Nothing to grade.")
            state["detail"] = {"graded": 0}
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
        state["detail"] = summary
        print(f"graded {written} predictions")
        print(f"  accuracy  {summary['accuracy']:.3f}")
        print(f"  log loss  {summary['log_loss']:.4f}")
        print(f"  rps       {summary['rps']:.4f}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
