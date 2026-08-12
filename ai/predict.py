"""Score upcoming fixtures with the current model and store the predictions.

    python predict.py --league EPL

Rebuilds team state from the full history every run. That is a few seconds of
work and it removes an entire class of bug: there is no incrementally-updated
cache to drift, and the features a fixture is scored on are produced by the
same code path that produced the training rows.
"""
from __future__ import annotations

import argparse
import sys
from datetime import date, datetime, timezone

import numpy as np
import pandas as pd

from config import LEAGUES, season_date_bounds
from db import (current_model, insert_predictions, job, load_history,
                load_model_artifact, load_upcoming_ai_fixtures)
import markets
from features import FEATURE_NAMES, FeatureBuilder

OUTCOMES = ("H", "D", "A")

# Platform team name -> canonical. Built from the same table fetch_history uses,
# so a club renamed in one place cannot silently stop matching in the other.
from aliases import LIVE_CLUBS
PLATFORM_TO_CANONICAL = {platform: canon for platform, canon, _, _ in LIVE_CLUBS}


def _season_code(when: date) -> str:
    """August-to-May seasons: 2026-08-21 -> '2627'."""
    start = when.year if when.month >= 7 else when.year - 1
    return f"{start % 100:02d}{(start + 1) % 100:02d}"


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--league", choices=sorted(LEAGUES), required=True)
    ap.add_argument("--days-ahead", type=int, default=10)
    ap.add_argument("--dry-run", action="store_true")
    args = ap.parse_args()

    league = LEAGUES[args.league]

    with job("predict", args.league) as state:
        model_row = current_model(args.league)
        if not model_row:
            print(f"No current model for {args.league}. Train one and promote it.")
            state["detail"] = {"skipped": "no current model"}
            return 0

        # From the database, not from disk: a GitHub Actions runner is fresh
        # every time and the file written by last Monday's training job is gone.
        bundle = load_model_artifact(model_row["id"])
        model = bundle["model"]

        history = load_history(league.divisions)
        builder = FeatureBuilder(top_division=league.top_division)
        builder.build_training_frame(history)   # replays state up to today

        # ai.fixtures, not public.season_fixtures. Seven of the nine leagues
        # have no competition on this platform and never will; the lab keeps
        # its own fixture list so all nine work identically.
        fixtures = load_upcoming_ai_fixtures(args.league, args.days_ahead)
        if fixtures.empty:
            print("No upcoming fixtures in window.")
            state["detail"] = {"fixtures": 0}
            return 0

        # Names in ai.fixtures are already canonical, having come from the same
        # provider as the history. A club with no prior matches is still worth
        # shouting about: an empty history looks exactly like a mid-table team.
        known = set(history["home_canonical"]) | set(history["away_canonical"])
        seen_in_fixtures = pd.concat(
            [fixtures["home_canonical"], fixtures["away_canonical"]])
        unseen = sorted({n for n in seen_in_fixtures if n not in known})
        if unseen:
            print("WARNING - clubs with no history; predictions for these are "
                  "little better than a coin flip:\n  " + "\n  ".join(unseen))

        rows, feature_rows = [], []
        for rec in fixtures.itertuples(index=False):
            ko = pd.to_datetime(rec.kickoff_at)
            home, away = rec.home_canonical, rec.away_canonical
            season = str(rec.season)
            season_start, season_end = season_date_bounds(season)
            feats = builder.features_for_fixture(
                home, away, ko.date(), season, season_start, season_end)
            feature_rows.append(feats)
            rows.append({
                "fixture_id": str(rec.fixture_id),
                "season_fixture_id": (str(rec.season_fixture_id)
                                      if rec.season_fixture_id else None),
                "kickoff_at": ko.to_pydatetime(),
                "home_canonical": home,
                "away_canonical": away,
            })

        X = pd.DataFrame(feature_rows)[FEATURE_NAMES]
        probs = model.predict_proba(X)
        eh, ea = model.predict_goals(X)
        grids = model.top_scorelines(X) if hasattr(model, "top_scorelines") else [None] * len(X)

        payload = []
        for i, base in enumerate(rows):
            p = probs[i]
            pick = OUTCOMES[int(np.argmax(p))]
            grid = grids[i]
            payload.append({
                **base,
                "model_id": model_row["id"],
                "league": args.league,
                "raw_match_id": None,
                "p_home": round(float(p[0]), 5),
                "p_draw": round(float(p[1]), 5),
                "p_away": round(float(p[2]), 5),
                "exp_home_goals": None if np.isnan(eh[i]) else round(float(eh[i]), 3),
                "exp_away_goals": None if np.isnan(ea[i]) else round(float(ea[i]), 3),
                "predicted_result": pick,
                "predicted_score": max(grid, key=grid.get) if grid else None,
                "scoreline_grid": grid,
                "features": feature_rows[i],
                # Every scoreline-derived market in one document. Stored
                # together because they share one source of error.
                "market_probabilities": (
                    markets.price_all(model.scoreline_grid(X.iloc[[i]]))[0]
                    if hasattr(model, "scoreline_grid") else None),
            })

        for r in payload:
            print(f"{r['kickoff_at']:%a %d %b %H:%M}  {r['home_canonical']:>18} v "
                  f"{r['away_canonical']:<18}  {r['p_home']:.0%} / {r['p_draw']:.0%} / "
                  f"{r['p_away']:.0%}   {r['predicted_score'] or ''}")

        if args.dry_run:
            print("\n--dry-run: nothing written")
            return 0

        written = insert_predictions(payload)
        state["rows"] = written
        state["detail"] = {"fixtures": len(payload), "written": written,
                           "model_version": model_row["version"]}
        print(f"\nwrote {written} new predictions "
              f"({len(payload) - written} already existed)")
    return 0


if __name__ == "__main__":
    sys.exit(main())
