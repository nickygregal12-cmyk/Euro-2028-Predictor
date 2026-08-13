"""Test each feature family on its own, against the noise it has to beat.

    python ablate.py --league EPL
    python ablate.py --league SPL --groups conversion halftime

Why this exists. The first shot features were measured against a single
chronological holdout and moved validation log loss by −0.0011 on the Premier
League, which looks like an improvement and is not: the nine-fold standard
error on that league is 0.013. Adding families one at a time and reading a
single number would keep whichever happened to land the right side of the
noise, which is the mechanism by which a model slowly fills with features that
never helped.

So every family is trained against the same core baseline, over the same
expanding-window folds, and reported as a difference with its own standard
error. A family is worth keeping when the improvement is larger than the
error on the difference — not when the mean happens to be negative.

The folds are paired: each family sees exactly the seasons the baseline saw,
so the difference per fold is a like-for-like comparison and its standard
error is the error on the DIFFERENCE, which is much tighter than the error on
either mean. That is the whole reason this is worth running.

Nothing here writes a model. It answers one question — does this family earn
its place — and prints the answer.
"""
from __future__ import annotations

import argparse
import sys

import numpy as np
import pandas as pd

import metrics
from config import LEAGUES
from features import DEFAULT_GROUPS, FEATURE_GROUPS, feature_names
from model_zoo import MODEL_FAMILIES
from train import DEFAULT_HALF_LIFE_DAYS, build_dataset, time_weights


def fold_scores(frame: pd.DataFrame, columns: list[str], family: str,
                half_life_days: float, min_train_seasons: int) -> dict[str, float]:
    """Log loss per season fold, for one column selection."""
    seasons = sorted(frame["season"].unique())
    out: dict[str, float] = {}
    for i in range(min_train_seasons, len(seasons)):
        train = frame[frame["season"].isin(seasons[:i])]
        test = frame[frame["season"] == seasons[i]]
        if len(test) < 100:
            continue
        weights = time_weights(train["match_date"], half_life_days)
        model = MODEL_FAMILIES[family]()
        if family == "poisson":
            model.fit(train[columns], train["result"],
                      home_goals=train["home_goals"], away_goals=train["away_goals"],
                      sample_weight=weights)
        else:
            model.fit(train[columns], train["result"], sample_weight=weights)
        probs = model.predict_proba(test[columns])
        out[seasons[i]] = metrics.summarise(probs, test["result"].values)["log_loss"]
    return out


def compare(baseline: dict[str, float], candidate: dict[str, float]) -> dict:
    """Paired difference over the folds both selections scored."""
    shared = sorted(set(baseline) & set(candidate))
    diffs = np.array([candidate[s] - baseline[s] for s in shared], dtype=float)
    n = len(diffs)
    se = float(diffs.std(ddof=1) / np.sqrt(n)) if n > 1 else float("nan")
    mean = float(diffs.mean()) if n else float("nan")
    return {
        "folds": n,
        "mean_delta": mean,
        "se_delta": se,
        # Negative delta is better (log loss falls). "Beats noise" means the
        # whole two-standard-error interval sits below zero.
        "beats_noise": bool(n > 1 and mean + 2 * se < 0),
        "harmful": bool(n > 1 and mean - 2 * se > 0),
    }


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--league", choices=sorted(LEAGUES), required=True)
    ap.add_argument("--family", choices=sorted(MODEL_FAMILIES), default="poisson")
    ap.add_argument("--groups", nargs="*", default=None,
                    help="Families to test. Default: every group except core.")
    ap.add_argument("--half-life-days", type=float, default=DEFAULT_HALF_LIFE_DAYS)
    ap.add_argument("--min-train-seasons", type=int, default=5)
    ap.add_argument("--cumulative", action="store_true",
                    help="Add each family to the previous winner rather than "
                         "testing each against core alone.")
    args = ap.parse_args()

    candidates = args.groups or [g for g in FEATURE_GROUPS if g not in DEFAULT_GROUPS]
    unknown = [g for g in candidates if g not in FEATURE_GROUPS]
    if unknown:
        raise SystemExit(f"unknown groups: {unknown}")

    frame = build_dataset(args.league)
    base_cols = feature_names(DEFAULT_GROUPS)
    base = fold_scores(frame, base_cols, args.family,
                       args.half_life_days, args.min_train_seasons)
    if len(base) < 2:
        raise SystemExit(f"{args.league} has too few seasons to ablate.")

    base_mean = float(np.mean(list(base.values())))
    print(f"\n=== {args.league}: {args.family}, {len(base)} folds, "
          f"half-life {args.half_life_days:g}d ===")
    print(f"core only ({len(base_cols)} features): mean log loss {base_mean:.4f}\n")
    print(f"{'family':<16}{'features':>9}{'mean':>10}{'delta':>10}"
          f"{'se':>9}{'verdict':>14}")

    kept = list(DEFAULT_GROUPS)
    for group in candidates:
        selection = kept + [group] if args.cumulative else list(DEFAULT_GROUPS) + [group]
        cols = feature_names(tuple(selection))
        scores = fold_scores(frame, cols, args.family,
                             args.half_life_days, args.min_train_seasons)
        verdict = compare(base, scores)
        mean = float(np.mean(list(scores.values())))
        label = ("keeps" if verdict["beats_noise"]
                 else "HARMFUL" if verdict["harmful"] else "noise")
        print(f"{group:<16}{len(cols):>9}{mean:>10.4f}"
              f"{verdict['mean_delta']:>+10.4f}{verdict['se_delta']:>9.4f}"
              f"{label:>14}")
        if args.cumulative and verdict["beats_noise"]:
            kept.append(group)

    print("\n`keeps` means the whole two-standard-error interval is below zero.")
    print("`noise` means the fold-to-fold variation is larger than the change,")
    print("which is a reason not to carry the family — not a reason to retry")
    print("until it looks good.")
    if args.cumulative:
        print(f"\ncumulative selection: {kept}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
