"""Train a challenger model and record how it did against the benchmarks.

    python train.py --league EPL --family poisson --version v0.3

Validation is chronological, never random. A random split lets the model be
trained on April and tested on the preceding September, which is a question
nobody will ever ask it. The question that matters is: if this model had
existed on the first day of the holdout season, how would it have done?

Nothing here promotes anything. The challenger is written with status
'challenger' and sits there until a human calls admin_ai_promote_model.
"""
from __future__ import annotations

import argparse
import hashlib
import json
import sys
from datetime import date

import joblib
import numpy as np
import pandas as pd

import metrics
from config import LEAGUES, MODEL_DIR, REPORT_DIR
from db import insert_model_with_artifact, job, load_history

from features import DEFAULT_GROUPS, FeatureBuilder, feature_names
from model_zoo import MODEL_FAMILIES

# Two and a half years. Dixon and Coles fitted a decay on half-seasons of one
# league; this archive is fifteen seasons across nine divisions, where squads
# turn over but a club's level is genuinely persistent. Too short throws away
# the sample size the lower divisions need, too long is what we had before.
# It is a parameter rather than a constant precisely so it can be argued with:
# `--half-life-days 0` restores the old equal-weight behaviour exactly.
DEFAULT_HALF_LIFE_DAYS = 900.0


def time_weights(match_dates, half_life_days: float):
    """Exponential recency weights, normalised to mean 1.

    Normalising keeps the regulariser's meaning stable: `alpha` is defined
    against the total weight, so an un-normalised decay would silently change
    how hard the model is penalised as well as which matches it listens to,
    and the two effects could not be told apart afterwards.
    """
    if not half_life_days or half_life_days <= 0:
        return None
    days = pd.to_datetime(pd.Series(list(match_dates)))
    age = (days.max() - days).dt.days.to_numpy(dtype=float)
    weights = np.power(0.5, age / float(half_life_days))
    mean = weights.mean()
    return weights / mean if mean > 0 else None


def build_dataset(league_key: str) -> pd.DataFrame:
    league = LEAGUES[league_key]
    history = load_history(league.divisions)
    if history.empty:
        raise SystemExit(f"No history for {league_key}. Run fetch_history.py first.")

    builder = FeatureBuilder(top_division=league.top_division)
    frame = builder.build_training_frame(history)

    # Attach the market benchmark by joining back on the natural key.
    keyed = history.set_index(
        ["match_date", "home_canonical", "away_canonical"]
    )[["mkt_home_prob", "mkt_draw_prob", "mkt_away_prob"]]
    frame = frame.join(
        keyed, on=["match_date", "home_canonical", "away_canonical"]
    )

    # Train and evaluate on the top flight only. The tier below is in the
    # history so that promoted clubs arrive with form; it is not the thing
    # being predicted, and its matches would otherwise dominate the fit.
    frame = frame[frame["division"] == league.top_division].reset_index(drop=True)

    # The first weeks of the earliest season have no prior form at all. Those
    # rows teach the model that "no information" means "average", which is a
    # real state it will meet every August, so a few are useful and a whole
    # season of them is not.
    frame = frame[frame["home_matches_known"] + frame["away_matches_known"] >= 6]
    return frame.reset_index(drop=True)


def chronological_split(frame: pd.DataFrame, holdout_seasons: int = 2):
    seasons = sorted(frame["season"].unique())
    if len(seasons) <= holdout_seasons:
        raise SystemExit(
            f"Only {len(seasons)} seasons available; need more than {holdout_seasons}."
        )
    val_seasons = seasons[-holdout_seasons:]
    train = frame[~frame["season"].isin(val_seasons)]
    val = frame[frame["season"].isin(val_seasons)]
    return train, val, val_seasons


def walk_forward(frame: pd.DataFrame, family: str, columns: list[str],
                 min_train_seasons: int = 5,
                 half_life_days: float = DEFAULT_HALF_LIFE_DAYS):
    """Expanding-window validation: train on everything up to season N, test on
    season N, step forward, repeat.

    This exists because of a number: with ~4,000 top-flight matches and a
    two-season holdout of ~760, the standard error on validation log loss is
    roughly 0.02. Most single-feature improvements are smaller than that. Test
    twenty features against one holdout and you will keep the luckiest one, not
    the best one. Several folds and a standard error is the cheapest available
    defence, and it is why `ai.feature_experiments` has a `std_error` column.
    """
    seasons = sorted(frame["season"].unique())
    if len(seasons) <= min_train_seasons:
        return None

    scores = []
    for i in range(min_train_seasons, len(seasons)):
        train = frame[frame["season"].isin(seasons[:i])]
        test = frame[frame["season"] == seasons[i]]
        if len(test) < 100:
            continue
        # The same weighting the shipped model gets. A fold validated under
        # different settings from the one that goes live is measuring a model
        # nobody will ever use.
        weights = time_weights(train["match_date"], half_life_days)
        model = MODEL_FAMILIES[family]()
        if family == "poisson":
            model.fit(train[columns], train["result"],
                      home_goals=train["home_goals"], away_goals=train["away_goals"],
                      sample_weight=weights)
        else:
            model.fit(train[columns], train["result"], sample_weight=weights)
        probs = model.predict_proba(test[columns])
        s = metrics.summarise(probs, test["result"].values)
        s["season"] = seasons[i]
        scores.append(s)

    if not scores:
        return None
    ll = np.array([s["log_loss"] for s in scores])
    rps = np.array([s["rps"] for s in scores])
    acc = np.array([s["accuracy"] for s in scores])
    return {
        "folds": scores,
        "mean_log_loss": float(ll.mean()),
        "se_log_loss": float(ll.std(ddof=1) / np.sqrt(len(ll))) if len(ll) > 1 else float("nan"),
        "mean_rps": float(rps.mean()),
        "se_rps": float(rps.std(ddof=1) / np.sqrt(len(rps))) if len(rps) > 1 else float("nan"),
        "mean_accuracy": float(acc.mean()),
    }


def market_benchmark(val: pd.DataFrame) -> dict | None:
    cols = ["mkt_home_prob", "mkt_draw_prob", "mkt_away_prob"]
    have = val.dropna(subset=cols)
    if len(have) < 50:
        return None
    return metrics.summarise(have[cols].values, have["result"].values) | {
        "coverage": round(len(have) / len(val), 3)
    }


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--league", choices=sorted(LEAGUES), required=True)
    ap.add_argument("--family", choices=sorted(MODEL_FAMILIES), default="poisson")
    ap.add_argument("--version", required=True)
    ap.add_argument("--holdout-seasons", type=int, default=2)
    ap.add_argument("--feature-groups", nargs="*", default=list(DEFAULT_GROUPS),
                    help="Feature families to train on. Only families proven "
                         "by ablate.py should be added here.")
    ap.add_argument("--half-life-days", type=float, default=DEFAULT_HALF_LIFE_DAYS,
                    help="Dixon-Coles time weighting: a match this old counts "
                         "half as much as one played today. 0 disables it and "
                         "weights every match in the archive equally.")
    ap.add_argument("--walk-forward", action="store_true",
                    help="Expanding-window validation across every season, with a "
                         "standard error. Use this to decide whether a feature helped.")
    ap.add_argument("--dry-run", action="store_true",
                    help="Print the report; write nothing to the database.")
    args = ap.parse_args()

    with job("train", args.league) as state:
        frame = build_dataset(args.league)
        FEATURE_NAMES = feature_names(tuple(args.feature_groups))
        train, val, val_seasons = chronological_split(frame, args.holdout_seasons)
        X_train, y_train = train[FEATURE_NAMES], train["result"]
        X_val, y_val = val[FEATURE_NAMES], val["result"]

        weights = time_weights(train["match_date"], args.half_life_days)

        model = MODEL_FAMILIES[args.family]()
        if args.family == "poisson":
            model.fit(X_train, y_train,
                      home_goals=train["home_goals"], away_goals=train["away_goals"],
                      sample_weight=weights)
        else:
            model.fit(X_train, y_train, sample_weight=weights)

        val_probs = model.predict_proba(X_val)
        result = metrics.summarise(val_probs, y_val.values)
        calib = metrics.calibration_table(val_probs, y_val.values)
        ece = metrics.calibration_error(val_probs, y_val.values)

        # Baseline: training-set base rates. This is the floor.
        base = MODEL_FAMILIES["baseline"]().fit(X_train, y_train)
        base_result = metrics.summarise(base.predict_proba(X_val), y_val.values)

        market = market_benchmark(val)

        print(f"\n=== {args.league} {args.version} ({args.family}) ===")
        print(f"train {len(train):>6} matches  ({train['season'].min()}..{train['season'].max()})")
        print(f"val   {len(val):>6} matches  ({', '.join(val_seasons)})")
        print(f"\n{'':14}{'acc':>8}{'log loss':>11}{'rps':>9}{'brier':>9}")
        print(f"{'baseline':14}{base_result['accuracy']:>8.3f}{base_result['log_loss']:>11.4f}"
              f"{base_result['rps']:>9.4f}{base_result['brier']:>9.4f}")
        print(f"{'model':14}{result['accuracy']:>8.3f}{result['log_loss']:>11.4f}"
              f"{result['rps']:>9.4f}{result['brier']:>9.4f}")
        if market:
            print(f"{'market':14}{market['accuracy']:>8.3f}{market['log_loss']:>11.4f}"
                  f"{market['rps']:>9.4f}{market['brier']:>9.4f}"
                  f"   (coverage {market['coverage']})")
        print(f"\nexpected calibration error: {ece:.4f}")
        print(f"{'confidence':>22}{'n':>7}{'predicted':>12}{'actual':>9}{'gap':>8}")
        for row in calib:
            print(f"{row['min_conf']:>12.2f}-{row['max_conf']:<9.2f}{row['n']:>7}"
                  f"{row['mean_predicted']:>12.3f}{row['actual_rate']:>9.3f}{row['gap']:>8.3f}")

        beats_baseline = result["log_loss"] < base_result["log_loss"]
        print(f"\nbeats baseline on log loss: {'YES' if beats_baseline else 'NO'}")
        if market:
            print(f"gap to market (log loss):   {result['log_loss'] - market['log_loss']:+.4f}"
                  "   (negative would mean beating the closing line)")

        wf = None
        if args.walk_forward:
            wf = walk_forward(frame, args.family, FEATURE_NAMES,
                              half_life_days=args.half_life_days)
            if wf:
                print("\nwalk-forward (expanding window, one fold per season)")
                print(f"{'season':>10}{'n':>7}{'acc':>8}{'log loss':>11}{'rps':>9}")
                for f in wf["folds"]:
                    print(f"{f['season']:>10}{f['n']:>7}{f['accuracy']:>8.3f}"
                          f"{f['log_loss']:>11.4f}{f['rps']:>9.4f}")
                print(f"{'mean':>10}{'':>7}{wf['mean_accuracy']:>8.3f}"
                      f"{wf['mean_log_loss']:>11.4f}{wf['mean_rps']:>9.4f}")
                print(f"{'std error':>10}{'':>7}{'':>8}{wf['se_log_loss']:>11.4f}"
                      f"{wf['se_rps']:>9.4f}")
                print("A change smaller than roughly twice the standard error is noise, "
                      "not an improvement.")

        report = {
            "league": args.league, "version": args.version, "family": args.family,
            "walk_forward": wf,
            "train_matches": len(train), "val_matches": len(val),
            "val_seasons": val_seasons, "model": result, "baseline": base_result,
            "market": market, "calibration": calib, "ece": ece,
        }
        (REPORT_DIR / f"{args.league.lower()}-{args.version}.json").write_text(
            json.dumps(report, indent=2, default=str))

        if args.dry_run:
            print("\n--dry-run: nothing written to the database")
            state["detail"] = report
            return 0

        artifact = MODEL_DIR / f"{args.league.lower()}-{args.version}.joblib"
        joblib.dump({"model": model, "features": FEATURE_NAMES}, artifact)
        sha = hashlib.sha256(artifact.read_bytes()).hexdigest()

        model_id = insert_model_with_artifact({
            "league": args.league,
            "version": args.version,
            "family": args.family,
            "training_matches": len(train),
            "features_used": FEATURE_NAMES,
            "val_accuracy": round(result["accuracy"], 5),
            "val_log_loss": round(result["log_loss"], 5),
            "val_rps": round(result["rps"], 5),
            "val_brier": round(result["brier"], 5),
            "baseline_log_loss": round(base_result["log_loss"], 5),
            "market_log_loss": round(market["log_loss"], 5) if market else None,
            "status": "challenger",
            "artifact_path": str(artifact.relative_to(MODEL_DIR.parent)),
            "artifact_sha256": sha,
            "notes": f"holdout seasons: {', '.join(val_seasons)}; ECE {ece:.4f}",
        }, artifact)

        state["rows"] = 1
        state["detail"] = report
        print(f"\nwrote challenger {model_id} (artefact stored, {sha[:12]}…)")
        print("It is NOT live. Promote with admin_ai_promote_model when you are ready.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
