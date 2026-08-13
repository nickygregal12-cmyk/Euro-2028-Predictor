"""Paired walk-forward studies, for the decisions that are not feature groups.

`ablate.py` answers one question — does this feature family earn its place —
and answers it well: same folds, same seasons, paired differences, a standard
error on the DIFFERENCE rather than on either mean. Everything here uses the
same machinery for the other decisions this lab has to take:

    half-life          how fast old matches should stop counting, per league
    time-weighting     whether old matches should stop counting at all
    elo-transition     how ratings move between seasons
    elo-margin         whether a red card should damp how far a rating moves
    regime-weighting   whether pre-change history should count for less
    ensemble           whether combining models beats the best single one
    calibration        whether applied calibration beats doing nothing
    market-ou          how the Poisson goal distribution scores against the
                       retained prematch Over/Under 2.5 book

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
from config import LEAGUES, REPORT_DIR, read_only
from ensemble import (evaluate_out_of_time, expanding_season_folds, out_of_fold)
from features import (DEFAULT_GROUPS, ELO_MARGIN_POLICIES, ELO_TRANSITIONS,
                      feature_names)
from fitting import DEFAULT_HALF_LIFE_DAYS, HALF_LIFE_GRID, fit_family, time_weights
from model_zoo import ENSEMBLE_BASE_FAMILIES
from train import build_dataset, column_map_for

STUDIES = ("half-life", "time-weighting", "elo-transition", "elo-margin",
           "regime-weighting", "ensemble", "calibration", "gbm-diagnostic",
           "base-model", "league-diagnostic", "market-ou",
           "newcomer-transfer", "coverage-guard")


# ---------------------------------------------------------------------------
# Shared fold scoring
# ---------------------------------------------------------------------------

def fold_log_loss(frame: pd.DataFrame, columns: list[str], family: str,
                  half_life_days: float, min_train_seasons: int,
                  weight_hook=None, model_kwargs: dict | None = None,
                  calibrate: bool = False) -> dict[str, float]:
    """Log loss per season fold for one configuration.

    `weight_hook(train_frame, weights) -> weights` lets a study modify the
    training weights without touching the fold structure, which is what keeps
    a weighting study paired with its own baseline.

    `model_kwargs` reaches the family's constructor, which is what lets a
    hyperparameter candidate be measured on exactly the folds every other
    configuration sees. `fit_family` has always forwarded them; nothing here
    ever passed any, so a GBM setting could not be compared without writing a
    second fold loop — and a second fold loop is how two studies end up
    measuring different things.

    `calibrate` fits a temperature on a held-out TAIL of the training fold —
    never on the training fit itself and never on the test fold. Both
    alternatives look reasonable and are useless: an overfitted model's
    in-sample probabilities are already near-perfect, so a temperature fitted
    on them is ~1 and does nothing, and one fitted on the test fold is
    leakage. The tail is the last season of the training window, which is also
    the closest thing in time to the fold being scored.
    """
    kwargs = dict(model_kwargs or {})
    out: dict[str, float] = {}
    for fold in expanding_season_folds(frame, min_train_seasons):
        train = frame.iloc[fold.train_index]
        test = frame.iloc[fold.test_index]

        holdout = None
        if calibrate:
            seasons = sorted(train["season"].unique())
            if len(seasons) >= 2:
                mask = train["season"] == seasons[-1]
                holdout, train = train[mask], train[~mask]

        weights = time_weights(train["match_date"], half_life_days)
        if weight_hook is not None:
            weights = weight_hook(train, weights)
        model = fit_family(family, train, columns, half_life_days,
                           weights=weights, **kwargs)
        probs = model.predict_proba(test[columns])

        if holdout is not None and len(holdout):
            import calibration as calibration_mod
            calibrator = calibration_mod.TemperatureCalibrator().fit(
                model.predict_proba(holdout[columns]), holdout["result"].values)
            probs = calibrator.transform(probs)

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


# The candidates, and the mechanism, DECLARED BEFORE THE RUN.
#
# `study_half_life` asked whether the shipped 900-day half-life should be
# tuned per league and answered no. It also produced an observation nobody
# asked it for: the `0` row was negative in eight of nine leagues and had the
# best raw mean in five. That observation is POST HOC — it is the best of
# seven rows chosen after seeing them — so it cannot be promoted out of the
# study that produced it, and the half-life study is deliberately NOT being
# reinterpreted to make `0` its winner. This is a new question with its own
# declared candidates.
#
# What `0` actually means, named accurately because the label is misleading:
# `fitting.time_weights` returns None for any half-life <= 0, and a None
# weight vector is UNIFORM weighting — every match in the training window
# counts the same. Read literally, a zero-day half-life would mean infinitely
# fast decay, i.e. only the newest match counts, which is the exact opposite.
# So the candidate is called `uniform` here and never `0d`.
#
# MECHANISM, declared so the result can disagree with it. Recency weighting
# pays for itself only if what is being estimated moves. What these folds
# estimate is not team strength — Elo, form and rest already carry that, and
# they are recomputed per fixture — but the LEAGUE-LEVEL mapping from those
# features onto outcomes: home advantage, how an Elo gap becomes a win
# probability, the draw rate. Those are stable over decades. If that is right,
# down-weighting old matches removes no bias and only shrinks the effective
# sample, so uniform should win, and it should win MOST where the sample is
# smallest. That gives the study a side-prediction it can fail: if uniform's
# advantage does not shrink as league sample grows, the mechanism is wrong
# even where the headline result holds.
TIME_WEIGHTING_CANDIDATES = (
    ("uniform", 0.0, "no recency weighting; every training match counts once"),
    ("900d", 900.0, "the shipped incumbent, and the baseline every delta is against"),
    ("1200d", 1200.0, "moderate-long decay; the longest half-life the grid ever offered"),
    ("1800d", 1800.0, "long decay; nearly uniform over a ten-season window, and the "
                      "bridge between 1200d and uniform"),
)


def study_time_weighting(args) -> dict:
    """Does the outcome model want recency weighting at all?

    Baseline is the incumbent 900 days, so a delta of zero means "no reason to
    change" and a negative delta means the candidate is better. The incumbent
    is included as a candidate as well as being the baseline: its row must
    come back at exactly zero, which is a live check that the pairing is
    against what it claims to be against rather than a re-fit.
    """
    frame = build_dataset(args.league)
    columns = feature_names(tuple(args.feature_groups))
    baseline = fold_log_loss(frame, columns, args.family,
                             DEFAULT_HALF_LIFE_DAYS, args.min_train_seasons)
    if len(baseline) < 3:
        return {"error": f"{args.league} has too few folds to weight time"}

    rows = []
    print(f"\n=== {args.league}: time weighting, {len(baseline)} folds, "
          f"baseline {DEFAULT_HALF_LIFE_DAYS:g}d ===")
    print(f"{'candidate':<18}{'mean':>10}{'delta':>10}{'se':>9}{'verdict':>10}")
    for name, half_life, rationale in TIME_WEIGHTING_CANDIDATES:
        scores = fold_log_loss(frame, columns, args.family, half_life,
                               args.min_train_seasons)
        result = compare(baseline, scores)
        mean = float(np.mean(list(scores.values())))
        rows.append({"candidate": name, "half_life_days": half_life,
                     "rationale": rationale, "mean_log_loss": mean, **result})
        print(_verdict_line(name, mean, result))

    # Sample size is reported beside the verdict because the declared
    # mechanism predicts the effect shrinks as it grows. Without it the
    # side-prediction cannot be checked from the artefact alone.
    matches = int(len(frame))
    winners = [r for r in rows if r["beats_noise"]]
    if winners:
        chosen = min(winners, key=lambda r: r["mean_delta"])
        recommendation = (
            f"{chosen['candidate']} beats the incumbent by more than twice the "
            f"standard error on the paired difference. This is a MODEL "
            f"AUTHORITY change and is a recommendation only; nothing is "
            f"promoted by this study.")
    else:
        chosen = None
        recommendation = (f"keep {DEFAULT_HALF_LIFE_DAYS:g} days: no candidate "
                          f"beat it beyond noise.")
    print(f"\nmatches: {matches}")
    print(f"recommendation: {recommendation}")
    return {"study": "time-weighting", "league": args.league, "rows": rows,
            "matches": matches, "chosen": chosen,
            "recommendation": recommendation,
            "declared_mechanism": (
                "League-level feature-to-outcome mapping is stable, so recency "
                "weighting shrinks the effective sample without removing bias; "
                "predicts uniform wins, and wins most in the smallest leagues.")}


# The hypotheses for the league diagnostic, FINITE AND DECLARED BEFORE THE
# RUN, because the temptation this study exists to resist is tuning a league
# until it looks good and calling that an explanation.
#
# SCH — the Scottish Championship — has surfaced independently in five
# measurements now: the Poisson family lost to a class base rate there, the
# logistic fit became unstable, regime weighting did its largest harm
# (+0.0035), the discipline family did its largest harm (+0.0164), and it
# carries the worst calibration error of the nine (ECE ~0.0546) with no
# calibrator repairing it. Five independent tests pointing at one league is
# either a property of that league's data or a property of our handling of it,
# and those need telling apart BEFORE anybody writes SCH-specific code.
#
# Each hypothesis names the column in the per-season table that would support
# it, so the table is readable as evidence rather than as a data dump.
LEAGUE_DIAGNOSTIC_HYPOTHESES = (
    ("H1 sample size", "Fewer matches per season than the leagues it is "
                       "compared against, so every estimate is noisier.",
     "matches"),
    ("H2 division churn", "Promotion and relegation move a large fraction of "
                          "the clubs each summer, so last season's ratings "
                          "describe a different population.", "clubs_changed"),
    ("H3 identity break", "Clubs arriving with no matched history at all, "
                          "which is an alias/canonicalisation defect rather "
                          "than a football fact.", "clubs_without_history"),
    ("H4 class balance", "A home/draw/away distribution far enough from the "
                         "other leagues that a shared prior is wrong.",
     "home_rate/draw_rate/away_rate"),
    ("H5 scoring regime", "Goals per match moving between seasons, which "
                          "moves the Poisson means the grid is built from.",
     "goals_per_match"),
    ("H6 coverage break", "Match-statistic coverage (shots, corners, cards) "
                          "collapsing in some seasons, so the model sees "
                          "neutral priors instead of evidence.", "stat_coverage"),
    ("H7 market coverage", "Bookmaker price coverage differing, which biases "
                           "any market-benchmarked comparison.", "odds_coverage"),
    ("H8 season structure", "Truncated or restructured seasons — the Covid "
                            "years are the obvious case — changing the match "
                            "count without changing the league.", "matches"),
    ("H9 promoted-club transfer", "Clubs whose rating was earned in another "
                                  "division carrying it across, which is what "
                                  "ELO_DIVISION_OFFSET exists to handle.",
     "clubs_promoted/clubs_relegated"),
    ("H10 calibration drift", "Calibration error concentrated in particular "
                              "seasons rather than spread evenly, which points "
                              "at a data break rather than a model mismatch.",
     "ece"),
)


def study_league_diagnostic(args) -> dict:
    """Per-season description of one league, against the declared hypotheses.

    This measures NOTHING against a baseline and recommends no change: it is
    the step that has to happen before anybody is allowed to write
    league-specific handling. Run over `--league all` it produces the same
    table for every league, which is what makes SCH comparable with SPL, SL1
    and the similarly-sized English divisions rather than merely described.

    Every figure is a fact about the stored data or about an out-of-fold
    probability. No configuration is tuned here and no verdict is issued.
    """
    frame = build_dataset(args.league)
    columns = feature_names(tuple(args.feature_groups))

    # Out-of-fold probabilities for the two families that actually contest the
    # league, so per-season log loss is comparable with §13's headline numbers.
    families = ("poisson", "elo")
    column_map = column_map_for(families, columns)
    oof = out_of_fold(frame, column_map, families, args.half_life_days,
                      args.min_train_seasons)
    scored_seasons = {str(s) for s in oof.fold_labels}

    stat_columns = [c for c in ("home_shots_known", "home_corners_known",
                                "home_cards_known") if c in frame.columns]
    odds_columns = [c for c in ("mkt_known",) if c in frame.columns]

    rows = []
    previous_clubs: set[str] = set()
    seen_clubs: set[str] = set()
    for season in sorted(frame["season"].unique()):
        block = frame[frame["season"] == season]
        clubs = set(block["home_canonical"]) | set(block["away_canonical"])
        results = block["result"].value_counts(normalize=True)
        goals = float((block["home_goals"] + block["away_goals"]).mean())

        row = {
            "season": str(season),
            "matches": int(len(block)),
            "clubs": len(clubs),
            "home_rate": float(results.get("H", 0.0)),
            "draw_rate": float(results.get("D", 0.0)),
            "away_rate": float(results.get("A", 0.0)),
            "goals_per_match": goals,
            # Churn is measured against the season before, so the first season
            # reports null rather than pretending every club is new.
            "clubs_changed": (len(clubs ^ previous_clubs) if previous_clubs
                              else None),
            "clubs_without_history": len(clubs - seen_clubs) if seen_clubs else None,
            "stat_coverage": (float(block[stat_columns].mean().mean())
                              if stat_columns else None),
            "odds_coverage": (float(block[odds_columns].mean().mean())
                              if odds_columns else None),
        }

        # Out-of-fold seasons only. A season the folds never scored gets nulls
        # rather than a number computed some other way, because a per-season
        # log loss that quietly changed definition mid-table is worse than a
        # gap in the table.
        mask = np.asarray([str(s) == str(season) for s in oof.fold_labels])
        if str(season) in scored_seasons and mask.any():
            actual = oof.actual[mask]
            # The class base rate is THIS season's own outcome distribution,
            # which is the number the Poisson family failed to beat in SCH. It
            # is deliberately the in-season rate: a model that cannot beat the
            # distribution it is scored against is the finding, and computing
            # it from the training window instead would soften that.
            base = block["result"].value_counts(normalize=True)
            prior = np.tile([[base.get("H", 1e-9), base.get("D", 1e-9),
                              base.get("A", 1e-9)]], (len(actual), 1))
            row["baseline_log_loss"] = metrics.summarise(prior, actual)["log_loss"]
            for family in families:
                probs = oof.probs[family][mask]
                summary = metrics.summarise(probs, actual)
                row[f"{family}_log_loss"] = summary["log_loss"]
                row[f"{family}_brier"] = summary["brier"]
                row[f"{family}_ece"] = float(
                    metrics.calibration_error(probs, actual))
                row[f"{family}_beats_base"] = bool(
                    summary["log_loss"] < row["baseline_log_loss"])
        rows.append(row)
        previous_clubs = clubs
        seen_clubs |= clubs

    print(f"\n=== {args.league}: per-season diagnostic, {len(rows)} seasons ===")
    print(f"{'season':<10}{'matches':>8}{'clubs':>7}{'home':>7}{'draw':>7}"
          f"{'goals':>7}{'churn':>7}{'newhist':>8}{'stat':>7}{'odds':>7}"
          f"{'base':>8}{'pois':>8}{'elo':>8}{'ece':>7}")
    for row in rows:
        def fmt(key, spec=">7.3f"):
            value = row.get(key)
            return format(value, spec) if isinstance(value, float) else f"{'-':>7}"
        print(f"{row['season']:<10}{row['matches']:>8}{row['clubs']:>7}"
              f"{fmt('home_rate')}{fmt('draw_rate')}{fmt('goals_per_match')}"
              f"{str(row['clubs_changed'] if row['clubs_changed'] is not None else '-'):>7}"
              f"{str(row['clubs_without_history'] if row['clubs_without_history'] is not None else '-'):>8}"
              f"{fmt('stat_coverage')}{fmt('odds_coverage')}"
              f"{fmt('baseline_log_loss', '>8.4f')}{fmt('poisson_log_loss', '>8.4f')}"
              f"{fmt('elo_log_loss', '>8.4f')}{fmt('poisson_ece')}")

    return {"study": "league-diagnostic", "league": args.league, "rows": rows,
            "hypotheses": [{"id": h, "statement": s, "column": c}
                           for h, s, c in LEAGUE_DIAGNOSTIC_HYPOTHESES],
            "recommendation": (
                "Diagnostic only. It identifies which declared hypothesis the "
                "data supports; it tunes nothing and justifies no "
                "league-specific model by itself.")}


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


def study_gbm_diagnostic(args) -> dict:
    """Why is the boosted model losing to a base-rate baseline?

    Runs `model_candidates.GBM_CANDIDATES` — declared in that module before
    any of this was run — on identical folds, paired against the shipped
    configuration. It is a DIAGNOSTIC and not a search: eleven rows, each with
    a stated mechanism, and the grid does not grow once the numbers are in.

    Train loss is reported beside test loss on purpose. A candidate that
    scores 1.05 on held-out folds while scoring 0.09 on its own training data
    has not learned a weak signal, it has memorised, and the two cases need
    opposite responses. A test column alone cannot tell them apart.
    """
    from model_candidates import GBM_BASELINE, GBM_CANDIDATES, declared_grid

    frame = build_dataset(args.league)
    default_columns = feature_names(tuple(args.feature_groups))

    def columns_for(candidate):
        if candidate.feature_groups is None:
            return default_columns
        return feature_names(tuple(candidate.feature_groups))

    def half_life_for(candidate):
        return (args.half_life_days if candidate.half_life_days is None
                else candidate.half_life_days)

    # `study_half_life` has always refused here and these two must too. Without
    # it a run with no usable folds prints eleven rows of `nan`, a verdict of
    # "tie" on every one and the recommendation "no candidate beat the shipped
    # configuration" — which is indistinguishable from a real null result and
    # is how an empty measurement gets recorded as evidence.
    probe = list(expanding_season_folds(frame, args.min_train_seasons))
    if len(probe) < 3:
        return {"error": f"{args.league} has {len(probe)} usable folds; "
                         f"a paired comparison needs at least 3"}

    scores: dict[str, dict[str, float]] = {}
    train_scores: dict[str, float] = {}
    for candidate in GBM_CANDIDATES:
        columns = columns_for(candidate)
        scores[candidate.name] = fold_log_loss(
            frame, columns, "gbm", half_life_for(candidate),
            args.min_train_seasons, model_kwargs=candidate.model_kwargs,
            calibrate=candidate.calibrate)
        # In-sample loss on the largest fold, purely as an overfitting
        # witness. It is never compared across candidates as a quality
        # measure; it exists so "memorised" is distinguishable from "weak".
        folds = list(expanding_season_folds(frame, args.min_train_seasons))
        if folds:
            train = frame.iloc[folds[-1].train_index]
            weights = time_weights(train["match_date"], half_life_for(candidate))
            model = fit_family("gbm", train, columns, half_life_for(candidate),
                               weights=weights, **candidate.model_kwargs)
            train_scores[candidate.name] = metrics.summarise(
                model.predict_proba(train[columns]), train["result"].values)["log_loss"]

    baseline = scores[GBM_BASELINE]
    rows = []
    print(f"\n=== {args.league}: GBM diagnostic, {len(baseline)} folds, "
          f"baseline {GBM_BASELINE} ===")
    print(f"{'candidate':<18}{'train':>9}{'test':>10}{'delta':>10}{'se':>9}{'verdict':>10}")
    for candidate in GBM_CANDIDATES:
        result = compare(baseline, scores[candidate.name])
        mean = float(np.mean(list(scores[candidate.name].values())))
        rows.append({"candidate": candidate.name,
                     "hypothesis": candidate.hypothesis,
                     "mean_log_loss": mean,
                     "train_log_loss": train_scores.get(candidate.name),
                     **result})
        train_value = train_scores.get(candidate.name)
        print(f"{candidate.name:<18}"
              f"{(f'{train_value:.4f}' if train_value is not None else '-'):>9}"
              f"{mean:>10.4f}{result['mean_delta']:>+10.4f}"
              f"{result['se_delta']:>9.4f}"
              f"{('BETTER' if result['beats_noise'] else 'WORSE' if result['harmful'] else 'tie'):>10}")

    winners = [r for r in rows if r["beats_noise"]]
    if winners:
        chosen = min(winners, key=lambda r: r["mean_log_loss"])
        recommendation = (
            f"{chosen['candidate']}: beats the shipped configuration by "
            f"{-chosen['mean_delta']:.5f} ±{chosen['se_delta']:.5f}. This is a "
            f"CANDIDATE, not a promotion: changing the shipped defaults is a "
            f"model-authority decision with its own approval.")
    else:
        chosen = None
        recommendation = ("no candidate beat the shipped configuration by more "
                          "than twice the standard error on the paired difference.")
    print(f"\nrecommendation: {recommendation}")
    return {"study": "gbm-diagnostic", "league": args.league, "rows": rows,
            "chosen": chosen, "recommendation": recommendation,
            "declared_grid": declared_grid()}


def study_base_model(args) -> dict:
    """Every base family on identical folds, including the logistic one.

    `LogisticModel` is excluded from `ENSEMBLE_BASE_FAMILIES` on the stated
    grounds that the Poisson family "already occupies the smooth-linear corner
    of the space". That has never been measured. It is a real independent
    competitor here — paired against the best of the others, so the question
    is whether it earns a seat rather than whether it beats the worst.
    """
    from model_candidates import BASE_MODEL_FAMILIES

    frame = build_dataset(args.league)
    columns = feature_names(tuple(args.feature_groups))
    families = tuple(args.base_families) if args.base_families else BASE_MODEL_FAMILIES
    column_map = column_map_for(families, columns)

    probe = list(expanding_season_folds(frame, args.min_train_seasons))
    if len(probe) < 3:
        return {"error": f"{args.league} has {len(probe)} usable folds; "
                         f"a paired comparison needs at least 3"}

    scores = {f: fold_log_loss(frame, column_map[f], f, args.half_life_days,
                               args.min_train_seasons)
              for f in families}
    means = {f: float(np.mean(list(s.values()))) for f, s in scores.items()}
    ranked = sorted((f for f in families if f != "baseline"),
                    key=lambda f: means[f])
    best = ranked[0]

    print(f"\n=== {args.league}: base models, "
          f"{len(next(iter(scores.values())))} folds, best = {best} ===")
    print(f"{'family':<18}{'mean':>10}{'vs best':>10}{'se':>9}{'verdict':>10}")
    rows = []
    for family in families:
        result = compare(scores[best], scores[family])
        rows.append({"family": family, "mean_log_loss": means[family], **result})
        print(_verdict_line(family, means[family], result))

    return {"study": "base-model", "league": args.league, "rows": rows,
            "best": best, "means": means,
            "recommendation": (
                f"{best} is the strongest single family on these folds. A family "
                f"that ties it may still earn an ensemble seat by being wrong in "
                f"different places, which the ensemble study measures next.")}


# ---------------------------------------------------------------------------
# The prematch Over/Under 2.5 benchmark
#
# DECLARED BEFORE THE FIRST RESULT WAS SEEN, and reproduced here so the design
# cannot be edited to fit the output:
#
#   * The archive is PREMATCH. Every retained row is `phase = 'pre'`, so this
#     is a benchmark against the price a book was offering before kick-off. It
#     is NOT closing-line value and must never be reported as CLV: no closing
#     price is stored for this market, so the quantity CLV measures does not
#     exist in this data.
#   * REAL BOOKMAKERS ONLY. `AVG` and `MAX` are aggregates across books — a
#     mean and a best-of. An aggregate has no overround of its own to remove
#     (MAX's is frequently below 100%, which would de-vig to probabilities
#     that sum to less than one and flatter every comparison), and neither is
#     a price anybody was ever offered as a pair.
#   * DE-VIG PER BOOKMAKER, TWO-WAY, BEFORE ANY AVERAGING. p_over =
#     (1/o_over) / (1/o_over + 1/o_under), computed inside one book's own pair
#     of prices. Averaging raw odds across books first and de-vigging the mean
#     is the standard way to manufacture a fake edge.
#   * The model probability is P(home + away >= 3) read off the SAME Poisson
#     scoreline grid the 1X2 forecast is read from, on the SAME expanding
#     walk-forward folds every other study uses. No model is refitted for this
#     market and no goal-total model is introduced.
#   * The question is DIAGNOSIS, not profit. Disagreement is bucketed at
#     <5pp, 5-10pp, 10-15pp and >15pp, and within each bucket both sides are
#     scored, so "when we disagree strongly, who is right" is answerable.
#     Nothing here sizes a stake or emits a selection.
# ---------------------------------------------------------------------------

# Aggregates, not books. Named here rather than inline so the exclusion is one
# fact in one place and the test can assert it.
AGGREGATE_PRICE_SOURCES = ("AVG", "MAX")

MARKET_OU_HYPOTHESES = (
    ("B1 goal level",
     "The Poisson mean total is systematically above or below the realised "
     "total, so P(Over 2.5) is biased in one direction league-wide.",
     "mean_model_over - actual_over_rate"),
    ("B2 early season",
     "Bias is concentrated in the opening fifth of a season, where the rate "
     "features are shortest.",
     "early_season block"),
    ("B3 promoted clubs",
     "Bias is concentrated in fixtures involving a club new to the division, "
     "where the division offset carries the rating rather than form.",
     "newcomer block"),
    ("B4 disagreement",
     "Where the model and the book disagree by more than 10 percentage "
     "points, the book is better calibrated.",
     "bucket log loss and Brier"),
    ("B5 dispersion",
     "The model's P(Over 2.5) is more dispersed than the book's, which is "
     "overconfidence rather than information.",
     "sd of each side's probability"),
)


def _devig_two_way(odds_a, odds_b):
    """Fair probability of side A, and the overround it was taken out of.

    Two-way proportional de-vig, INSIDE one bookmaker's own pair of prices.
    The pairing is the whole point: an overround belongs to a book, so the
    only place it can be removed is between two prices that book offered at
    the same moment on the same market. Removing it from a mean of several
    books' prices, or from an aggregate like MAX, removes a number that was
    never there.
    """
    inv_a = 1.0 / np.asarray(odds_a, dtype=float)
    inv_b = 1.0 / np.asarray(odds_b, dtype=float)
    overround = inv_a + inv_b
    return inv_a / overround, overround


def _binary_scores(prob, outcome) -> dict[str, float]:
    """Log loss, Brier and 10-bin expected calibration error for one side.

    A separate implementation from `metrics.summarise` on purpose: that one
    takes a three-column H/D/A matrix, and quietly reshaping a two-outcome
    market into it is how a benchmark ends up measuring something other than
    what it says.
    """
    prob = np.clip(np.asarray(prob, dtype=float), 1e-9, 1 - 1e-9)
    outcome = np.asarray(outcome, dtype=float)
    log_loss = float(-np.mean(outcome * np.log(prob)
                              + (1 - outcome) * np.log(1 - prob)))
    brier = float(np.mean((prob - outcome) ** 2))

    edges = np.linspace(0.0, 1.0, 11)
    index = np.clip(np.digitize(prob, edges[1:-1]), 0, 9)
    ece = 0.0
    for b in range(10):
        mask = index == b
        if not mask.any():
            continue
        ece += (mask.sum() / len(prob)) * abs(prob[mask].mean()
                                              - outcome[mask].mean())
    return {"log_loss": log_loss, "brier": brier, "ece": float(ece),
            "mean_prob": float(prob.mean()), "sd_prob": float(prob.std()),
            "n": int(len(prob))}


def _load_ou_prices(divisions: list[str]) -> pd.DataFrame:
    """Every retained Over/Under 2.5 pair for these divisions, per bookmaker.

    Returned unaggregated and un-de-vigged: the caller drops the aggregates
    and does the arithmetic, because the de-vig is the part of this study most
    worth being able to read in one place.
    """
    from db import query_df
    return query_df(
        """
        select r.match_date, r.home_canonical, r.away_canonical,
               p.bookmaker,
               max(p.odds) filter (where p.selection = 'Over')  as odds_over,
               max(p.odds) filter (where p.selection = 'Under') as odds_under
          from ai.historical_market_prices p
          join ai.raw_matches r on r.id = p.raw_match_id
         where r.division = any(%s)
           and p.market = 'OU'
           and p.line = 2.5
           and p.phase = 'pre'
         group by 1, 2, 3, 4
        """,
        (list(divisions),),
    )


def study_market_ou(args) -> dict:
    """Score the Poisson goal distribution against the prematch book.

    It compares no configuration of ours against another, so it issues no
    verdict and recommends no change. What it can establish is whether the
    scoreline grid the 1X2 forecast is built from describes goals at all — a
    question the 1X2 log loss cannot answer, because a grid with the wrong
    total can still order home/draw/away correctly.
    """
    from config import LEAGUES
    league = LEAGUES[args.league]
    frame = build_dataset(args.league)
    columns = feature_names(tuple(args.feature_groups))

    prices = _load_ou_prices(list(league.divisions))
    books_seen = (sorted(prices["bookmaker"].unique().tolist())
                  if len(prices) else [])
    real = prices[~prices["bookmaker"].isin(AGGREGATE_PRICE_SOURCES)] \
        if len(prices) else prices
    real = (real.dropna(subset=["odds_over", "odds_under"])
            if len(real) else real)

    # The de-vig, per book, on that book's own pair. Anything at or below
    # evens on both sides of a two-way market is not a price pair; it is a
    # storage error, and it would de-vig to a probability without complaining.
    if len(real):
        real = real[(real["odds_over"] > 1.0) & (real["odds_under"] > 1.0)].copy()
        real["p_market_over"], real["overround"] = _devig_two_way(
            real["odds_over"], real["odds_under"])

    rows: list[dict] = []
    for fold in expanding_season_folds(frame, args.min_train_seasons):
        train = frame.iloc[fold.train_index]
        test = frame.iloc[fold.test_index]
        weights = time_weights(train["match_date"], args.half_life_days)
        model = fit_family("poisson", train, columns, args.half_life_days,
                           weights=weights)
        grid = model.scoreline_grid(test[columns])

        # P(total >= 3) off the same grid predict_proba reads. Built from the
        # grid's own axes rather than a hard-coded size, so a change to
        # MAX_GOALS cannot silently truncate the tail this market lives in.
        size = grid.shape[1]
        totals = np.add.outer(np.arange(size), np.arange(size))
        over_mask = (totals >= 3).astype(float)
        p_model_over = (grid * over_mask).sum(axis=(1, 2))
        exp_home, exp_away = model.predict_goals(test[columns])

        block = pd.DataFrame({
            "season": str(fold.season),
            "match_date": test["match_date"].values,
            "home_canonical": test["home_canonical"].values,
            "away_canonical": test["away_canonical"].values,
            "total_goals": (test["home_goals"] + test["away_goals"]).values,
            "p_model_over": p_model_over,
            "exp_total": exp_home + exp_away,
            "newcomer": ((test.get("home_is_newcomer", 0.0) >= 1.0)
                         | (test.get("away_is_newcomer", 0.0) >= 1.0)).values,
        })
        rows.append(block)

    if not rows:
        return {"study": "market-ou", "league": args.league,
                "error": "no scored folds", "books_seen": books_seen}

    scored = pd.concat(rows, ignore_index=True)
    scored["actual_over"] = (scored["total_goals"] >= 3).astype(float)
    # Season stage, for B2. Ranked within the season by date so a league with
    # a different fixture count still splits at its own opening fifth.
    scored["stage"] = scored.groupby("season")["match_date"].rank(pct=True)

    matched = scored
    per_book: list[dict] = []
    if len(real):
        # One row per fixture per real book, then averaged across books IN
        # PROBABILITY SPACE — never in odds space, and only after each book's
        # own overround has gone.
        joined = real.merge(
            scored, on=["match_date", "home_canonical", "away_canonical"],
            how="inner")
        for book, block in joined.groupby("bookmaker"):
            summary = _binary_scores(block["p_market_over"], block["actual_over"])
            summary.update({"bookmaker": book,
                            "mean_overround": float(block["overround"].mean())})
            per_book.append(summary)
        consensus = (joined.groupby(
            ["match_date", "home_canonical", "away_canonical"], as_index=False)
            ["p_market_over"].mean())
        matched = scored.merge(
            consensus, on=["match_date", "home_canonical", "away_canonical"],
            how="inner")
    else:
        matched = scored.iloc[0:0].copy()
        matched["p_market_over"] = []

    n_scored, n_matched = int(len(scored)), int(len(matched))
    out: dict = {
        "study": "market-ou",
        "league": args.league,
        "design": {
            "phase": "pre",
            "is_clv": False,
            "note": ("Prematch benchmark. No closing price is retained for "
                     "this market, so closing-line value is not computable "
                     "and is not claimed."),
            "aggregates_excluded": list(AGGREGATE_PRICE_SOURCES),
            "price_sources_present": books_seen,
            "real_bookmakers_used": sorted(
                {r["bookmaker"] for r in per_book}),
        },
        "hypotheses": [{"id": h, "statement": s, "column": c}
                       for h, s, c in MARKET_OU_HYPOTHESES],
        "coverage": {
            "scored_fixtures": n_scored,
            "matched_fixtures": n_matched,
            "match_rate": (n_matched / n_scored) if n_scored else None,
            "per_book": per_book,
            "by_season": [
                {"season": s,
                 "scored": int((scored["season"] == s).sum()),
                 "matched": int((matched["season"] == s).sum()) if n_matched else 0}
                for s in sorted(scored["season"].unique())],
        },
        "per_book": per_book,
    }

    if not n_matched:
        out["overall"] = {"matched": 0}
        out["recommendation"] = (
            "No usable real-bookmaker Over/Under 2.5 evidence for this league "
            "over the scored folds. Nothing is concluded and nothing changes.")
        print(f"\n=== {args.league}: Over/Under 2.5 benchmark ===")
        print(f"price sources present: {books_seen or 'none'}")
        print(f"scored fixtures {n_scored}, matched 0 — no comparison possible")
        return out

    model = _binary_scores(matched["p_model_over"], matched["actual_over"])
    market = _binary_scores(matched["p_market_over"], matched["actual_over"])
    actual_rate = float(matched["actual_over"].mean())

    out["overall"] = {
        "matched": n_matched,
        "actual_over_rate": actual_rate,
        "model": model,
        "market": market,
        "model_minus_market_log_loss": model["log_loss"] - market["log_loss"],
        "model_minus_market_brier": model["brier"] - market["brier"],
        "model_bias": model["mean_prob"] - actual_rate,
        "market_bias": market["mean_prob"] - actual_rate,
        "mean_expected_total": float(matched["exp_total"].mean()),
        "mean_actual_total": float(matched["total_goals"].mean()),
        "mean_abs_gap": float(
            (matched["p_model_over"] - matched["p_market_over"]).abs().mean()),
        "mean_signed_gap": float(
            (matched["p_model_over"] - matched["p_market_over"]).mean()),
    }

    gap = (matched["p_model_over"] - matched["p_market_over"]).abs() * 100.0
    buckets = [("<5pp", gap < 5), ("5-10pp", (gap >= 5) & (gap < 10)),
               ("10-15pp", (gap >= 10) & (gap < 15)), (">15pp", gap >= 15)]
    out["disagreement"] = []
    for label, mask in buckets:
        block = matched[mask.values]
        if not len(block):
            out["disagreement"].append({"bucket": label, "n": 0})
            continue
        m = _binary_scores(block["p_model_over"], block["actual_over"])
        k = _binary_scores(block["p_market_over"], block["actual_over"])
        out["disagreement"].append({
            "bucket": label, "n": int(len(block)),
            "share": float(len(block) / n_matched),
            "actual_over_rate": float(block["actual_over"].mean()),
            "model_log_loss": m["log_loss"], "market_log_loss": k["log_loss"],
            "model_brier": m["brier"], "market_brier": k["brier"],
            "model_ece": m["ece"], "market_ece": k["ece"],
            "model_mean_prob": m["mean_prob"], "market_mean_prob": k["mean_prob"],
            "better_calibrated": ("market" if k["ece"] < m["ece"] else "model"),
            "lower_log_loss": ("market" if k["log_loss"] < m["log_loss"]
                               else "model"),
        })

    # B2 and B3: the same two numbers on the blocks where the declared
    # mechanism says the bias should live, beside the block where it should
    # not, so "concentrated" is a comparison rather than an assertion.
    out["bias_blocks"] = []
    for label, mask in (("early_season (first fifth)", matched["stage"] <= 0.2),
                        ("rest_of_season", matched["stage"] > 0.2),
                        ("newcomer_fixture", matched["newcomer"]),
                        ("established_only", ~matched["newcomer"])):
        block = matched[mask.values]
        if not len(block):
            out["bias_blocks"].append({"block": label, "n": 0})
            continue
        m = _binary_scores(block["p_model_over"], block["actual_over"])
        k = _binary_scores(block["p_market_over"], block["actual_over"])
        rate = float(block["actual_over"].mean())
        out["bias_blocks"].append({
            "block": label, "n": int(len(block)), "actual_over_rate": rate,
            "model_bias": m["mean_prob"] - rate,
            "market_bias": k["mean_prob"] - rate,
            "model_log_loss": m["log_loss"], "market_log_loss": k["log_loss"],
            "mean_expected_total": float(block["exp_total"].mean()),
            "mean_actual_total": float(block["total_goals"].mean()),
        })

    out["by_season"] = []
    for season in sorted(matched["season"].unique()):
        block = matched[matched["season"] == season]
        m = _binary_scores(block["p_model_over"], block["actual_over"])
        k = _binary_scores(block["p_market_over"], block["actual_over"])
        out["by_season"].append({
            "season": season, "n": int(len(block)),
            "actual_over_rate": float(block["actual_over"].mean()),
            "model_log_loss": m["log_loss"], "market_log_loss": k["log_loss"],
            "model_bias": m["mean_prob"] - float(block["actual_over"].mean()),
            "market_bias": k["mean_prob"] - float(block["actual_over"].mean()),
        })

    out["recommendation"] = (
        "Benchmark only. It measures whether the Poisson goal distribution "
        "describes totals against a real prematch price; it fits nothing, "
        "promotes nothing and emits no selection. A market-informed model is "
        "a separate decision that this cannot authorise on its own.")

    print(f"\n=== {args.league}: prematch Over/Under 2.5 benchmark ===")
    print(f"price sources present {books_seen}, "
          f"real books used {out['design']['real_bookmakers_used']}")
    print(f"scored {n_scored}, matched {n_matched} "
          f"({100.0 * n_matched / n_scored:.1f}%), "
          f"actual over rate {actual_rate:.4f}")
    print(f"{'side':<10}{'log loss':>10}{'brier':>9}{'ece':>8}"
          f"{'mean p':>9}{'sd p':>8}")
    for name, s in (("model", model), ("market", market)):
        print(f"{name:<10}{s['log_loss']:>10.4f}{s['brier']:>9.4f}"
              f"{s['ece']:>8.4f}{s['mean_prob']:>9.4f}{s['sd_prob']:>8.4f}")
    print(f"model - market: log loss {model['log_loss'] - market['log_loss']:+.4f}, "
          f"brier {model['brier'] - market['brier']:+.4f}")
    print(f"expected total {out['overall']['mean_expected_total']:.3f} vs "
          f"actual {out['overall']['mean_actual_total']:.3f}")
    print(f"\n{'bucket':<10}{'n':>7}{'share':>8}{'over':>8}"
          f"{'modelLL':>9}{'mktLL':>9}{'modelECE':>10}{'mktECE':>9}{'better':>9}")
    for b in out["disagreement"]:
        if not b["n"]:
            print(f"{b['bucket']:<10}{0:>7}")
            continue
        print(f"{b['bucket']:<10}{b['n']:>7}{b['share']:>8.3f}"
              f"{b['actual_over_rate']:>8.3f}{b['model_log_loss']:>9.4f}"
              f"{b['market_log_loss']:>9.4f}{b['model_ece']:>10.4f}"
              f"{b['market_ece']:>9.4f}{b['better_calibrated']:>9}")
    return out


# ---------------------------------------------------------------------------
# Newcomer goal-state transfer
#
# PREDECLARED in docs/quality/investigations/
# 2026-08-13-newcomer-goal-transfer-predeclaration.md. The four candidates, the
# strata, the metrics and the adoption rule are fixed there and are reproduced
# in code here so the study cannot be quietly re-scoped after a result.
#
# This study writes its own fold loop rather than calling `fold_log_loss`,
# and the reason is the whole point of the study: `fold_log_loss` returns one
# number per season, and every question worth asking here is about a SUBSET of
# a season — the promoted clubs, the relegated ones, their first five matches.
# A per-season mean cannot be decomposed after the fact.
# ---------------------------------------------------------------------------

NEWCOMER_STRATA = (
    ("overall", "every fixture in the fold"),
    ("newcomer", "at least one club changed division this season"),
    ("established", "neither club changed division — the no-op check"),
    ("promoted", "at least one club came up"),
    ("relegated", "at least one club came down"),
    ("newcomer_first5", "a moved club inside its first 5 in the new division"),
    ("newcomer_first10", "a moved club inside its first 10"),
    ("newcomer_later", "a moved club after its first 10"),
)


def _newcomer_masks(test: pd.DataFrame) -> dict[str, np.ndarray]:
    """The predeclared strata, as row masks over one test fold."""
    home_move = test["home_division_move"].to_numpy()
    away_move = test["away_division_move"].to_numpy()
    moved = (home_move != 0) | (away_move != 0)

    # How far into the new division the MOVED club is. Where both clubs moved,
    # the earlier of the two: the stratum is meant to capture "somebody here
    # has barely played in this division", and the least-established club is
    # what makes that true.
    played = np.where(
        home_move != 0,
        test["home_played_in_division"].to_numpy(), np.inf)
    played = np.minimum(played, np.where(
        away_move != 0,
        test["away_played_in_division"].to_numpy(), np.inf))

    return {
        "overall": np.ones(len(test), dtype=bool),
        "newcomer": moved,
        "established": ~moved,
        "promoted": (home_move > 0) | (away_move > 0),
        "relegated": (home_move < 0) | (away_move < 0),
        "newcomer_first5": moved & (played < 5),
        "newcomer_first10": moved & (played < 10),
        "newcomer_later": moved & (played >= 10),
    }


def _newcomer_fold_scores(frame, columns, family, half_life_days,
                          min_train_seasons) -> dict[str, dict[str, float]]:
    """Log loss per stratum per fold, for one transfer policy."""
    out: dict[str, dict[str, float]] = {name: {} for name, _ in NEWCOMER_STRATA}
    for fold in expanding_season_folds(frame, min_train_seasons):
        train = frame.iloc[fold.train_index]
        test = frame.iloc[fold.test_index]
        weights = time_weights(train["match_date"], half_life_days)
        model = fit_family(family, train, columns, half_life_days,
                           weights=weights)
        probs = model.predict_proba(test[columns])
        actual = test["result"].values

        for name, mask in _newcomer_masks(test).items():
            # A stratum too thin to score is absent rather than zero. Scoring
            # eleven fixtures and reporting the number beside a stratum of
            # nine thousand invites exactly the wrong comparison.
            if mask.sum() < 30:
                continue
            out[name][fold.season] = metrics.summarise(
                probs[mask], actual[mask])["log_loss"]
    return out


def study_newcomer_transfer(args) -> dict:
    """How should a club's expected-goal state transfer across a division change?

    The control is the shipped behaviour, so a null result is a real outcome
    and is reported as one.
    """
    from features import NEWCOMER_TRANSFER_DEFAULT, NEWCOMER_TRANSFER_POLICIES

    columns = feature_names(tuple(args.feature_groups))
    family = args.family

    scores: dict[str, dict[str, dict[str, float]]] = {}
    counts: dict[str, int] = {}
    for policy in NEWCOMER_TRANSFER_POLICIES:
        frame = build_dataset(args.league, newcomer_transfer=policy)
        if policy == NEWCOMER_TRANSFER_DEFAULT:
            probe = list(expanding_season_folds(frame, args.min_train_seasons))
            if len(probe) < 3:
                return {"error": f"{args.league} has {len(probe)} usable folds; "
                                 f"a paired comparison needs at least 3"}
            for name, mask in _newcomer_masks(frame).items():
                counts[name] = int(mask.sum())
        scores[policy] = _newcomer_fold_scores(
            frame, columns, family, args.half_life_days, args.min_train_seasons)

    control = scores[NEWCOMER_TRANSFER_DEFAULT]
    print(f"\n=== {args.league}: newcomer goal transfer, family = {family} ===")
    print(f"{'policy / stratum':<28}{'rows':>8}{'mean':>10}{'vs control':>12}"
          f"{'se':>9}{'verdict':>10}")

    rows = []
    for policy in NEWCOMER_TRANSFER_POLICIES:
        if policy == NEWCOMER_TRANSFER_DEFAULT:
            continue
        for name, _ in NEWCOMER_STRATA:
            paired_control = control.get(name, {})
            paired_policy = scores[policy].get(name, {})
            shared = sorted(set(paired_control) & set(paired_policy))
            if len(shared) < 3:
                continue
            # `compare` is the same paired-fold test every other study uses,
            # and it is oriented control-first so a NEGATIVE delta is an
            # improvement, exactly as elsewhere in this module.
            result = compare({s: paired_control[s] for s in shared},
                             {s: paired_policy[s] for s in shared})
            mean = float(np.mean([paired_policy[s] for s in shared]))
            rows.append({"policy": policy, "stratum": name,
                         "rows": counts.get(name), "mean_log_loss": mean,
                         **result})
            label = ("BETTER" if result["beats_noise"]
                     else "WORSE" if result["harmful"] else "tie")
            print(f"{policy + '/' + name:<28}{counts.get(name, 0):>8}"
                  f"{mean:>10.4f}{result['mean_delta']:>+12.4f}"
                  f"{result['se_delta']:>9.4f}{label:>10}")

    # The adoption rule, applied rather than described. Fixed in the
    # predeclaration before any of these numbers existed.
    verdicts = {}
    for policy in NEWCOMER_TRANSFER_POLICIES:
        if policy == NEWCOMER_TRANSFER_DEFAULT:
            continue
        newcomer = next((r for r in rows if r["policy"] == policy
                         and r["stratum"] == "newcomer"), None)
        established = next((r for r in rows if r["policy"] == policy
                            and r["stratum"] == "established"), None)
        if newcomer is None or established is None:
            verdicts[policy] = "not measurable on these folds"
            continue
        helps = newcomer["beats_noise"]
        harms = established["harmful"]
        verdicts[policy] = ("adopt" if helps and not harms else
                            "reject: degrades established fixtures" if harms else
                            "no change: newcomer gain within noise")

    return {"study": "newcomer-transfer", "league": args.league,
            "family": family, "rows": rows, "counts": counts,
            "verdicts": verdicts,
            "predeclared": "docs/quality/investigations/"
                           "2026-08-13-newcomer-goal-transfer-predeclaration.md",
            "recommendation": (
                "A candidate is adopted only if it improves the newcomer "
                "stratum beyond noise AND is not worse beyond noise on "
                "established fixtures. The established stratum is also the "
                "implementation check: a policy touches only clubs that moved, "
                "so a non-zero established delta is a defect, not football.")}


# ---------------------------------------------------------------------------
# The coverage-regime guard, and its falsification test
#
# The guard is only acceptable if it removes SCH 1718's catastrophic fold AND
# is a no-op in the other eight leagues. This study reports BOTH, and reports
# the per-fold deltas rather than only a mean, because a guard that fires in
# one fold and nowhere else is invisible in an average over nine.
# ---------------------------------------------------------------------------

def study_coverage_guard(args) -> dict:
    """Does dropping a barely-supported feature family help, and where?

    The guard is applied per FOLD, because training support is a property of
    the training window rather than of the league — which is also why this
    cannot reuse `fold_log_loss`, whose column list is fixed for every fold.
    """
    from features import (COVERAGE_SUPPORT_FLOOR, groups_with_support,
                          known_indicators)

    frame = build_dataset(args.league)
    groups = tuple(args.feature_groups)
    folds = list(expanding_season_folds(frame, args.min_train_seasons))
    if len(folds) < 3:
        return {"error": f"{args.league} has {len(folds)} usable folds; "
                         f"a paired comparison needs at least 3"}

    control, guarded, fired = {}, {}, []
    for fold in folds:
        train, test = frame.iloc[fold.train_index], frame.iloc[fold.test_index]
        kept, dropped = groups_with_support(train, groups, COVERAGE_SUPPORT_FLOOR)

        support = {}
        for group in groups:
            present = [c for c in known_indicators(group) if c in train.columns]
            if present:
                support[group] = float(train[present].to_numpy().mean())

        for label, use in (("control", groups), ("guarded", kept)):
            columns = feature_names(use)
            weights = time_weights(train["match_date"], args.half_life_days)
            model = fit_family(args.family, train, columns, args.half_life_days,
                               weights=weights)
            score = metrics.summarise(model.predict_proba(test[columns]),
                                      test["result"].values)["log_loss"]
            (control if label == "control" else guarded)[fold.season] = score

        if dropped:
            fired.append({"season": fold.season, "dropped": list(dropped),
                          "train_support": {g: round(support.get(g, -1.0), 4)
                                            for g in dropped},
                          # The test-side coverage is what makes the regime
                          # BREAK visible rather than merely the sparsity.
                          "test_support": {
                              g: round(float(test[[c for c in known_indicators(g)
                                                   if c in test.columns]]
                                             .to_numpy().mean()), 4)
                              for g in dropped},
                          "control_log_loss": control[fold.season],
                          "guarded_log_loss": guarded[fold.season]})

    result = compare(control, guarded)
    print(f"\n=== {args.league}: coverage-regime guard, "
          f"floor = {COVERAGE_SUPPORT_FLOOR} ===")
    print(f"{'folds':<18}{len(folds):>10}")
    print(f"{'guard fired in':<18}{len(fired):>10}  "
          f"{[f['season'] for f in fired]}")
    print(f"{'control mean':<18}{np.mean(list(control.values())):>10.4f}")
    print(f"{'guarded mean':<18}{np.mean(list(guarded.values())):>10.4f}")
    print(_verdict_line("guard", float(np.mean(list(guarded.values()))), result))
    for row in fired:
        print(f"  {row['season']}: dropped {row['dropped']} "
              f"train {row['train_support']} -> test {row['test_support']} | "
              f"{row['control_log_loss']:.4f} -> {row['guarded_log_loss']:.4f}")

    return {"study": "coverage-guard", "league": args.league,
            "floor": COVERAGE_SUPPORT_FLOOR, "folds": len(folds),
            "fired": fired, "control": control, "guarded": guarded, **result,
            "predeclared": "docs/quality/investigations/"
                           "2026-08-13-newcomer-goal-transfer-predeclaration.md",
            "recommendation": (
                "Adopt only if the guard removes the catastrophic fold in the "
                "league that motivated it AND is within noise in the other "
                "eight. A guard that improves one league and moves the rest is "
                "not a general rule, whatever its mean says.")}


STUDY_FUNCTIONS = {
    "newcomer-transfer": study_newcomer_transfer,
    "coverage-guard": study_coverage_guard,
    "half-life": study_half_life,
    "time-weighting": study_time_weighting,
    "elo-transition": study_elo_transition,
    "elo-margin": study_elo_margin,
    "regime-weighting": study_regime_weighting,
    "ensemble": study_ensemble,
    "calibration": study_calibration,
    "gbm-diagnostic": study_gbm_diagnostic,
    "base-model": study_base_model,
    "league-diagnostic": study_league_diagnostic,
    "market-ou": study_market_ou,
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
    if study == "time-weighting":
        return _from_rows(result, "candidate",
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
    if study == "league-diagnostic":
        # It compares no configuration against any other, so every comparison
        # column is honestly null. A ledger row still exists because the run
        # happened and the seasons it described are evidence.
        return {"baseline": None, "candidate": None,
                "folds": len(result.get("rows") or []),
                "mean_delta": None, "se_delta": None,
                "beats_noise": False, "harmful": False,
                "chosen": None,
                "error": "diagnostic only: no configuration was compared"}
    if study == "market-ou":
        # The comparison is against a BOOK, not against another configuration
        # of ours, so `mean_delta` is the model's log loss minus the market's:
        # negative means our goal distribution scored better than the price.
        # There is no paired standard error because the two probabilities come
        # from different generating processes rather than from paired folds,
        # and inventing one would make a benchmark look like an experiment.
        overall = (result.get("overall") or {})
        return {"baseline": "prematch book (de-vigged, per bookmaker)",
                "candidate": "poisson P(Over 2.5)",
                "folds": int(overall.get("matched") or 0),
                "mean_delta": overall.get("model_minus_market_log_loss"),
                "se_delta": None,
                "beats_noise": False, "harmful": False,
                "chosen": None,
                "error": "benchmark only: no configuration was compared"}
    if study == "gbm-diagnostic":
        # The baseline is the SHIPPED configuration, so a ledger row here says
        # "this candidate beat what we run today" rather than "this candidate
        # was the best of eleven" — which would be true of something whatever
        # the numbers were.
        return _from_rows(result, "candidate", "shipped gbm configuration")
    if study == "base-model":
        rows = result.get("rows") or []
        best = result.get("best")
        others = [r for r in rows if r["family"] not in (best, "baseline")]
        if not others:
            return {"baseline": best, "candidate": None, "folds": 0,
                    "mean_delta": None, "se_delta": None,
                    "beats_noise": False, "harmful": False,
                    "error": "no competing family to compare"}
        closest = min(others, key=lambda r: r["mean_delta"])
        return {
            "baseline": f"best single family ({best})",
            "candidate": closest["family"],
            "folds": closest.get("folds", 0),
            "mean_delta": closest.get("mean_delta"),
            "se_delta": closest.get("se_delta"),
            "beats_noise": bool(closest.get("beats_noise")),
            "harmful": bool(closest.get("harmful")),
            "chosen": best,
            "families_tested": len(rows),
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
    # Left unset so each study can resolve its OWN default. Defaulting this to
    # ENSEMBLE_BASE_FAMILIES for every study would have quietly excluded
    # `logistic` from the base-model comparison — which is the one family that
    # comparison exists to measure.
    ap.add_argument("--base-families", nargs="*", default=None)
    ap.add_argument("--meta", default="logistic_stack")
    ap.add_argument("--pre-change-weight", type=float, default=0.5)
    ap.add_argument("--record", action="store_true",
                    help="Write the result to ai.feature_experiments, including "
                         "a null result. Rejections are results.")
    args = ap.parse_args()

    # Say so here rather than letting the study run for twenty minutes and then
    # die on the insert. The read-only session would refuse the write either
    # way; this refuses the contradictory REQUEST.
    if args.record and read_only():
        raise SystemExit(
            "--record was asked for while AI_READ_ONLY is set. A research run "
            "reads; it does not write ai.feature_experiments. Drop --record, or "
            "unset AI_READ_ONLY if a recorded experiment is what you meant.")

    if args.base_families is None:
        from model_candidates import BASE_MODEL_FAMILIES
        args.base_families = list(
            BASE_MODEL_FAMILIES if args.study == "base-model"
            else ENSEMBLE_BASE_FAMILIES)

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
