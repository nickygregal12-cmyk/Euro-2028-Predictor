"""Paired walk-forward studies, for the decisions that are not feature groups.

`ablate.py` answers one question — does this feature family earn its place —
and answers it well: same folds, same seasons, paired differences, a standard
error on the DIFFERENCE rather than on either mean. Everything here uses the
same machinery for the other decisions this lab has to take:

    half-life          how fast old matches should stop counting, per league
    elo-transition     how ratings move between seasons
    elo-margin         whether a red card should damp how far a rating moves
    regime-weighting   whether pre-change history should count for less
    ensemble           whether combining models beats the best single one
    calibration        whether applied calibration beats doing nothing

The rules are the same everywhere and they are what make the numbers worth
reading:

  * PAIRED. Every configuration sees exactly the same folds, so the standard
    error is on the difference — typically five to twenty times tighter than
    the error on either mean, which is the difference between measuring a real
    0.004 effect and reporting noise.

  * A POINT ESTIMATE IS NOT A RESULT. A configuration wins when the whole
    two-standard-error interval sits on the right side of zero. Everything
    else is a tie, and a tie goes to the simpler or more stable setting —
    which usually means: leave it alone.

  * REJECTIONS ARE RESULTS. `--record` writes every study to
    ai.feature_experiments, including the ones that found nothing. Running
    twenty studies and keeping the best is how a lab convinces itself of
    things that are not true; the log of the other nineteen is the antidote.

Nothing here trains a deployable model, writes an artefact or promotes
anything.
"""
from __future__ import annotations

import argparse
import json
import sys

import numpy as np
import pandas as pd

import metrics
from ablate import compare
from config import LEAGUES, REPORT_DIR
from ensemble import (evaluate_out_of_time, expanding_season_folds, out_of_fold)
from features import (DEFAULT_GROUPS, ELO_MARGIN_POLICIES, ELO_TRANSITIONS,
                      feature_names)
from fitting import DEFAULT_HALF_LIFE_DAYS, HALF_LIFE_GRID, fit_family, time_weights
from model_zoo import ENSEMBLE_BASE_FAMILIES
from train import build_dataset, column_map_for

STUDIES = ("half-life", "elo-transition", "elo-margin", "regime-weighting",
           "ensemble", "calibration")


# ---------------------------------------------------------------------------
# Shared fold scoring
# ---------------------------------------------------------------------------

def fold_log_loss(frame: pd.DataFrame, columns: list[str], family: str,
                  half_life_days: float, min_train_seasons: int,
                  weight_hook=None) -> dict[str, float]:
    """Log loss per season fold for one configuration.

    `weight_hook(train_frame, weights) -> weights` lets a study modify the
    training weights without touching the fold structure, which is what keeps
    a weighting study paired with its own baseline.
    """
    out: dict[str, float] = {}
    for fold in expanding_season_folds(frame, min_train_seasons):
        train = frame.iloc[fold.train_index]
        test = frame.iloc[fold.test_index]
        weights = time_weights(train["match_date"], half_life_days)
        if weight_hook is not None:
            weights = weight_hook(train, weights)
        model = fit_family(family, train, columns, half_life_days, weights=weights)
        probs = model.predict_proba(test[columns])
        out[fold.season] = metrics.summarise(probs, test["result"].values)["log_loss"]
    return out


def _verdict_line(name: str, mean: float, result: dict) -> str:
    label = ("BETTER" if result["beats_noise"]
             else "WORSE" if result["harmful"] else "tie")
    return (f"{name:<18}{mean:>10.4f}{result['mean_delta']:>+10.4f}"
            f"{result['se_delta']:>9.4f}{label:>10}")


# ---------------------------------------------------------------------------
# Studies
# ---------------------------------------------------------------------------

def study_half_life(args) -> dict:
    """Per-league recency tuning. 900 days is currently global and unmeasured.

    The trap this is written against: pick the lowest mean from nine noisy
    folds and you will choose a different half-life for every league, each
    time you run it. So the baseline is the incumbent, every candidate is
    paired against it, and a candidate only wins if the whole interval clears
    zero. Where several win, the LONGEST wins — more history is the more
    stable setting, and the lower divisions are sample-starved.
    """
    frame = build_dataset(args.league)
    columns = feature_names(tuple(args.feature_groups))
    baseline = fold_log_loss(frame, columns, args.family,
                             DEFAULT_HALF_LIFE_DAYS, args.min_train_seasons)
    if len(baseline) < 3:
        return {"error": f"{args.league} has too few folds to tune a half-life"}

    rows = []
    print(f"\n=== {args.league}: half-life, {len(baseline)} folds, "
          f"baseline {DEFAULT_HALF_LIFE_DAYS:g}d ===")
    print(f"{'half-life':<18}{'mean':>10}{'delta':>10}{'se':>9}{'verdict':>10}")
    for candidate in HALF_LIFE_GRID:
        scores = fold_log_loss(frame, columns, args.family, candidate,
                               args.min_train_seasons)
        result = compare(baseline, scores)
        mean = float(np.mean(list(scores.values())))
        rows.append({"half_life_days": candidate, "mean_log_loss": mean, **result})
        print(_verdict_line(f"{candidate:g}d", mean, result))

    winners = [r for r in rows if r["beats_noise"]]
    if winners:
        chosen = max(winners, key=lambda r: r["half_life_days"])
        recommendation = (
            f"{chosen['half_life_days']:g} days: it clears the noise, and where "
            f"several candidates do, the longest is preferred because more "
            f"history is the more stable setting.")
    else:
        chosen = None
        recommendation = (f"keep {DEFAULT_HALF_LIFE_DAYS:g} days: no candidate "
                          f"beat it by more than twice the standard error on "
                          f"the paired difference.")
    print(f"\nrecommendation: {recommendation}")
    return {"study": "half-life", "league": args.league, "rows": rows,
            "chosen": chosen, "recommendation": recommendation}


def study_elo_transition(args) -> dict:
    frames = {}
    for value in ELO_TRANSITIONS:
        frames[value] = build_dataset(args.league, elo_transition=value)
    columns = feature_names(tuple(args.feature_groups))

    baseline_name = "global_mean"          # what the package did before
    baseline = fold_log_loss(frames[baseline_name], columns, args.family,
                             args.half_life_days, args.min_train_seasons)
    rows = []
    print(f"\n=== {args.league}: Elo season transition, {len(baseline)} folds, "
          f"baseline {baseline_name} ===")
    print(f"{'transition':<18}{'mean':>10}{'delta':>10}{'se':>9}{'verdict':>10}")
    for value in ELO_TRANSITIONS:
        scores = fold_log_loss(frames[value], columns, args.family,
                               args.half_life_days, args.min_train_seasons)
        result = compare(baseline, scores)
        mean = float(np.mean(list(scores.values())))
        rows.append({"transition": value, "mean_log_loss": mean, **result})
        print(_verdict_line(value, mean, result))
    print("\nNote: `global_mean` is a defect rather than a candidate — it "
          "drifts every lower-division club toward the Premier League's anchor "
          "each summer. This study measures the size of the fix, and a tie "
          "here does not restore it.")
    return {"study": "elo-transition", "league": args.league, "rows": rows}


def study_elo_margin(args) -> dict:
    columns = feature_names(tuple(args.feature_groups))
    frames = {value: build_dataset(args.league, elo_margin_policy=value)
              for value in ELO_MARGIN_POLICIES}
    baseline = fold_log_loss(frames["plain"], columns, args.family,
                             args.half_life_days, args.min_train_seasons)
    rows = []
    print(f"\n=== {args.league}: red-card-aware rating updates, "
          f"{len(baseline)} folds ===")
    print(f"{'policy':<18}{'mean':>10}{'delta':>10}{'se':>9}{'verdict':>10}")
    for value in ELO_MARGIN_POLICIES:
        scores = fold_log_loss(frames[value], columns, args.family,
                               args.half_life_days, args.min_train_seasons)
        result = compare(baseline, scores)
        mean = float(np.mean(list(scores.values())))
        rows.append({"policy": value, "mean_log_loss": mean, **result})
        print(_verdict_line(value, mean, result))
    return {"study": "elo-margin", "league": args.league, "rows": rows}


def study_regime_weighting(args) -> dict:
    """Should history from before a detected regime change count for less?

    Approximation, stated plainly: regime detection runs once per fold at the
    end of that fold's TRAINING data, and the resulting weights are applied to
    the training rows. That keeps every input inside the training period — no
    test-season information reaches the weights — but it is coarser than
    detecting a change at each match date, so a real effect could be
    understated here. It cannot be overstated, which is the direction that
    matters for a decision to adopt.
    """
    import regime

    frame = build_dataset(args.league)
    columns = feature_names(tuple(args.feature_groups))
    baseline = fold_log_loss(frame, columns, args.family, args.half_life_days,
                             args.min_train_seasons)

    def hook(train: pd.DataFrame, weights):
        cutoff = train["match_date"].max()
        multipliers = np.ones(len(train), dtype=float)
        teams = pd.unique(pd.concat([train["home_canonical"], train["away_canonical"]]))
        changed: dict[str, object] = {}
        for team in teams:
            verdict = regime.detect_for_team(
                regime.team_match_frame(train, team), team, cutoff)
            if verdict.changed and verdict.since:
                changed[team] = verdict.since
        if changed:
            dates = pd.to_datetime(train["match_date"]).to_numpy()
            for team, since in changed.items():
                involved = ((train["home_canonical"] == team)
                            | (train["away_canonical"] == team)).to_numpy()
                before = dates < np.datetime64(pd.Timestamp(since))
                multipliers[involved & before] *= args.pre_change_weight
        base = np.ones(len(train)) if weights is None else np.asarray(weights, dtype=float)
        out = base * multipliers
        mean = out.mean()
        return out / mean if mean > 0 else out

    scores = fold_log_loss(frame, columns, args.family, args.half_life_days,
                           args.min_train_seasons, weight_hook=hook)
    result = compare(baseline, scores)
    print(f"\n=== {args.league}: regime weighting "
          f"(pre-change weight {args.pre_change_weight}) ===")
    print(f"{'configuration':<18}{'mean':>10}{'delta':>10}{'se':>9}{'verdict':>10}")
    print(_verdict_line("baseline", float(np.mean(list(baseline.values()))),
                        compare(baseline, baseline)))
    print(_verdict_line("regime-weighted", float(np.mean(list(scores.values()))), result))
    return {"study": "regime-weighting", "league": args.league,
            "pre_change_weight": args.pre_change_weight, **result}


def study_ensemble(args) -> dict:
    """Does combining independent models beat the best single one?

    Compared against the BEST base model rather than the average of them,
    because "the ensemble beat the worst component" is not a reason to deploy
    an ensemble. The meta-model is refitted on earlier folds and scored on a
    later one, so its number is out-of-time in the same sense as the
    components' numbers.
    """
    frame = build_dataset(args.league)
    columns = feature_names(tuple(args.feature_groups))
    families = tuple(args.base_families)
    column_map = column_map_for(families, columns)

    oof = out_of_fold(frame, column_map, families, args.half_life_days,
                      args.min_train_seasons)
    comparison = evaluate_out_of_time(oof, args.meta)

    print(f"\n=== {args.league}: ensemble vs components, "
          f"{len(oof)} out-of-fold rows ===")
    print(f"{'model':<18}{'folds':>7}{'log loss':>11}{'se':>9}")
    for name, row in comparison.items():
        if name.startswith("_") or "mean_log_loss" not in row:
            continue
        print(f"{name:<18}{row['folds']:>7}{row['mean_log_loss']:>11.4f}"
              f"{row['se_log_loss']:>9.4f}")
    for name in ("equal_blend", args.meta):
        vs = comparison.get(name, {}).get("vs_best_base")
        if vs:
            print(f"\n{name} vs best base ({vs['base']}): "
                  f"{vs['mean_delta']:+.4f} ±{vs['se_delta']:.4f} — "
                  f"{'beats noise' if vs['beats_noise'] else 'within noise'}")
    return {"study": "ensemble", "league": args.league,
            "out_of_fold_rows": len(oof),
            "base_summary": {k: v for k, v in oof.summary().items()},
            "comparison": comparison}


def study_calibration(args) -> dict:
    """Does applied calibration beat leaving the probabilities alone?"""
    import calibration

    frame = build_dataset(args.league)
    columns = feature_names(tuple(args.feature_groups))
    families = (args.family,)
    column_map = column_map_for(families, columns)
    oof = out_of_fold(frame, column_map, families, args.half_life_days,
                      args.min_train_seasons)
    probs, actual = oof.probs[args.family], oof.actual

    chosen, choice = calibration.select_calibrator(probs, actual, oof.fold_labels)
    before = calibration.calibration_report(probs, actual)
    after = calibration.calibration_report(chosen.transform(probs), actual)

    print(f"\n=== {args.league}: calibration, {len(oof)} out-of-fold rows ===")
    print(f"  chosen: {choice['chosen']}")
    print(f"  held-out log loss by candidate: {choice.get('scores')}")
    print(f"  ECE       {before['ece']:.4f} -> {after['ece']:.4f}")
    print(f"  log loss  {before['log_loss']:.4f} -> {after['log_loss']:.4f}")
    if choice["chosen"] == "identity":
        print("  no calibrator adopted: none beat doing nothing on held-out folds.")
    return {"study": "calibration", "league": args.league, "choice": choice,
            "before": before, "after": after}


STUDY_FUNCTIONS = {
    "half-life": study_half_life,
    "elo-transition": study_elo_transition,
    "elo-margin": study_elo_margin,
    "regime-weighting": study_regime_weighting,
    "ensemble": study_ensemble,
    "calibration": study_calibration,
}


# ---------------------------------------------------------------------------
# The ledger
#
# `record_experiment` used to read `mean_delta`, `se_delta`, `folds`,
# `beats_noise` and `harmful` off the TOP LEVEL of every study's result. Only
# `regime-weighting` returns that shape. Half-life returns candidate rows and a
# chosen setting; elo-transition and elo-margin return rows; ensemble returns a
# nested comparison; calibration returns a choice with a before and an after.
# Every one of those recorded `folds = 0`, a null delta, a null standard error
# and the verdict `undecided` — while the report beside it held the whole
# measurement. A ledger row that contains none of the measurement is not a
# record of an experiment, it is a record that one was run.
#
# Each study now says, explicitly, which comparison its row is about.
# ---------------------------------------------------------------------------

def _from_rows(result: dict, key: str, baseline_label: str) -> dict:
    """A candidate grid: the ledger row is about the BEST candidate.

    `rows` already carries a paired comparison per candidate, because every
    candidate was compared against the same baseline over the same folds.
    """
    rows = result.get("rows") or []
    if not rows:
        return {}
    scored = [r for r in rows if r.get("mean_delta") is not None]
    if not scored:
        return {}
    winners = [r for r in scored if r.get("beats_noise")]
    best = (min(winners, key=lambda r: r["mean_delta"]) if winners
            else min(scored, key=lambda r: r["mean_delta"]))
    return {
        "baseline": baseline_label,
        "candidate": str(best.get(key)),
        "folds": best.get("folds", 0),
        "mean_delta": best.get("mean_delta"),
        "se_delta": best.get("se_delta"),
        "beats_noise": bool(best.get("beats_noise")),
        "harmful": bool(best.get("harmful")),
        "chosen": (str((result.get("chosen") or {}).get(key))
                   if result.get("chosen") else None),
        "candidates_tested": len(scored),
    }


def ledger_entry(study: str, result: dict) -> dict:
    """What this study measured, in the shape the ledger column set needs."""
    if result.get("error"):
        return {"baseline": None, "candidate": None, "folds": 0,
                "mean_delta": None, "se_delta": None, "beats_noise": False,
                "harmful": False, "error": result["error"]}

    if study == "half-life":
        return _from_rows(result, "half_life_days",
                          f"incumbent {DEFAULT_HALF_LIFE_DAYS:g} days")
    if study == "elo-transition":
        return _from_rows(result, "transition", "global_mean (the defect)")
    if study == "elo-margin":
        return _from_rows(result, "policy", "plain (no red-card adjustment)")
    if study == "regime-weighting":
        # The one study that already returned the flat shape.
        return {
            "baseline": "unweighted history",
            "candidate": f"pre-change weight {result.get('pre_change_weight')}",
            "folds": result.get("folds", 0),
            "mean_delta": result.get("mean_delta"),
            "se_delta": result.get("se_delta"),
            "beats_noise": bool(result.get("beats_noise")),
            "harmful": bool(result.get("harmful")),
        }
    if study == "ensemble":
        comparison = result.get("comparison") or {}
        best_base = comparison.get("_best_base")
        candidates = [(name, comparison[name]["vs_best_base"])
                      for name in comparison
                      if isinstance(comparison.get(name), dict)
                      and comparison[name].get("vs_best_base")]
        if not candidates:
            return {"baseline": best_base, "candidate": None, "folds": 0,
                    "mean_delta": None, "se_delta": None,
                    "beats_noise": False, "harmful": False,
                    "error": comparison.get("error", "no meta-model compared")}
        name, vs = min(candidates, key=lambda pair: pair[1]["mean_delta"])
        return {
            "baseline": f"best single base model ({best_base})",
            "candidate": name,
            "folds": comparison[name].get("folds", 0),
            "mean_delta": vs["mean_delta"],
            "se_delta": vs["se_delta"],
            "beats_noise": bool(vs["beats_noise"]),
            "harmful": bool(vs["mean_delta"] > 0
                            and vs["mean_delta"] - 2 * (vs["se_delta"] or 0) > 0),
            "chosen": name if vs["beats_noise"] else best_base,
            "candidates_tested": len(candidates),
        }
    if study == "calibration":
        choice = result.get("choice") or {}
        before = (result.get("before") or {}).get("log_loss")
        after = (result.get("after") or {}).get("log_loss")
        delta = (None if before is None or after is None
                 else float(after) - float(before))
        return {
            "baseline": "uncalibrated out-of-fold probabilities",
            "candidate": choice.get("chosen"),
            # Calibrator selection is itself scored on held-out folds; the
            # count comes from there rather than being invented.
            "folds": len(choice.get("scores") or {}) or choice.get("folds", 0),
            "mean_delta": delta,
            # Calibrator selection reports a per-candidate score rather than a
            # paired standard error, so this is honestly null rather than a
            # number that looks like one.
            "se_delta": None,
            "beats_noise": bool(choice.get("chosen")
                                and choice.get("chosen") != "identity"),
            "harmful": bool(delta is not None and delta > 0),
            "chosen": choice.get("chosen"),
            "ece_before": (result.get("before") or {}).get("ece"),
            "ece_after": (result.get("after") or {}).get("ece"),
        }
    return {}


def record_experiment(league: str, study: str, result: dict) -> None:
    """Write the study to ai.feature_experiments — including a null result."""
    from db import connect

    entry = ledger_entry(study, result)
    delta = entry.get("mean_delta")
    se = entry.get("se_delta")
    verdict = "undecided"
    if entry.get("beats_noise"):
        verdict = "kept"
    elif entry.get("harmful"):
        verdict = "rejected"
    elif delta is not None:
        verdict = "inconclusive"

    hypothesis = (
        f"{study}: {entry.get('candidate')} vs {entry.get('baseline')}"
        if entry.get("candidate") else f"{study}: {result.get('error', 'no comparison')}")

    with connect() as conn:
        conn.execute(
            "insert into ai.feature_experiments "
            "(league, hypothesis, folds, delta_log_loss, delta_rps, std_error, "
            " verdict, notes) values (%s,%s,%s,%s,%s,%s,%s,%s)",
            (league, hypothesis[:500], entry.get("folds", 0) or 0, delta, None, se,
             verdict,
             # Both halves: the extracted decision, and the full report it came
             # from, so the decision is reproducible rather than merely stated.
             json.dumps({"decision": entry,
                         "recommendation": result.get("recommendation"),
                         "report": result}, default=str)[:4000]),
        )
        conn.commit()


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--league", choices=sorted(LEAGUES), required=True)
    ap.add_argument("--study", choices=STUDIES, required=True)
    ap.add_argument("--family", default="poisson")
    ap.add_argument("--feature-groups", nargs="*", default=list(DEFAULT_GROUPS))
    ap.add_argument("--half-life-days", type=float, default=DEFAULT_HALF_LIFE_DAYS)
    ap.add_argument("--min-train-seasons", type=int, default=5)
    ap.add_argument("--base-families", nargs="*", default=list(ENSEMBLE_BASE_FAMILIES))
    ap.add_argument("--meta", default="logistic_stack")
    ap.add_argument("--pre-change-weight", type=float, default=0.5)
    ap.add_argument("--record", action="store_true",
                    help="Write the result to ai.feature_experiments, including "
                         "a null result. Rejections are results.")
    args = ap.parse_args()

    result = STUDY_FUNCTIONS[args.study](args)
    path = REPORT_DIR / f"study-{args.study}-{args.league.lower()}.json"
    path.write_text(json.dumps(result, indent=2, default=str))
    print(f"\nwritten to {path}")

    if args.record:
        record_experiment(args.league, args.study, result)
        print("recorded in ai.feature_experiments")
    return 0


if __name__ == "__main__":
    sys.exit(main())
