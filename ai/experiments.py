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


TIME_WEIGHTING_CANDIDATES = (
    ("uniform", 0.0, "no recency weighting; every training match counts once"),
    ("900d", 900.0, "the shipped incumbent, and the baseline every delta is against"),
    ("1200d", 1200.0, "moderate-long decay; the longest half-life the grid ever offered"),
    ("1800d", 1800.0, "long decay; nearly uniform over a ten-season window, and the bridge between 1200d and uniform"),
)


def study_time_weighting(args) -> dict:
    frame = build_dataset(args.league)
    columns = feature_names(tuple(args.feature_groups))
    baseline = fold_log_loss(frame, columns, args.family,
                             DEFAULT_HALF_LIFE_DAYS, args.min_train_seasons)
    if len(baseline) < 3:
        return {"error": f"{args.league} has too few folds to weight time"}
    rows = []
    print(f"\n=== {args.league}: time weighting, {len(baseline)} folds, baseline {DEFAULT_HALF_LIFE_DAYS:g}d ===")
    print(f"{'candidate':<18}{'mean':>10}{'delta':>10}{'se':>9}{'verdict':>10}")
    for name, half_life, rationale in TIME_WEIGHTING_CANDIDATES:
        scores = fold_log_loss(frame, columns, args.family, half_life,
                               args.min_train_seasons)
        result = compare(baseline, scores)
        mean = float(np.mean(list(scores.values())))
        rows.append({"candidate": name, "half_life_days": half_life,
                     "rationale": rationale, "mean_log_loss": mean, **result})
        print(_verdict_line(name, mean, result))
    matches = int(len(frame))
    winners = [r for r in rows if r["beats_noise"]]
    if winners:
        chosen = min(winners, key=lambda r: r["mean_delta"])
        recommendation = f"{chosen['candidate']} beats the incumbent by more than twice the standard error on the paired difference."
    else:
        chosen = None
        recommendation = f"keep {DEFAULT_HALF_LIFE_DAYS:g} days: no candidate beat it beyond noise."
    return {"study": "time-weighting", "league": args.league, "rows": rows,
            "matches": matches, "chosen": chosen, "recommendation": recommendation}


LEAGUE_DIAGNOSTIC_HYPOTHESES = (
    ("H1 sample size", "Fewer matches per season than comparison leagues.", "matches"),
    ("H2 division churn", "Promotion and relegation change club population.", "clubs_changed"),
    ("H3 identity break", "Clubs arriving with no matched history.", "clubs_without_history"),
    ("H4 class balance", "H/D/A distribution differs materially.", "home_rate/draw_rate/away_rate"),
    ("H5 scoring regime", "Goals per match moves between seasons.", "goals_per_match"),
    ("H6 coverage break", "Match-statistic coverage collapses in some seasons.", "stat_coverage"),
    ("H7 market coverage", "Bookmaker price coverage differs.", "odds_coverage"),
    ("H8 season structure", "Truncated or restructured seasons alter counts.", "matches"),
    ("H9 promoted-club transfer", "Ratings transfer across divisions.", "clubs_promoted/clubs_relegated"),
    ("H10 calibration drift", "Calibration error concentrates by season.", "ece"),
)


def study_league_diagnostic(args) -> dict:
    frame = build_dataset(args.league)
    columns = feature_names(tuple(args.feature_groups))
    families = ("poisson", "elo")
    column_map = column_map_for(families, columns)
    oof = out_of_fold(frame, column_map, families, args.half_life_days,
                      args.min_train_seasons)
    scored_seasons = {str(s) for s in oof.fold_labels}
    stat_columns = [c for c in ("home_shots_known", "home_corners_known", "home_cards_known") if c in frame.columns]
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
            "season": str(season), "matches": int(len(block)), "clubs": len(clubs),
            "home_rate": float(results.get("H", 0.0)), "draw_rate": float(results.get("D", 0.0)),
            "away_rate": float(results.get("A", 0.0)), "goals_per_match": goals,
            "clubs_changed": (len(clubs ^ previous_clubs) if previous_clubs else None),
            "clubs_without_history": len(clubs - seen_clubs) if seen_clubs else None,
            "stat_coverage": (float(block[stat_columns].mean().mean()) if stat_columns else None),
            "odds_coverage": (float(block[odds_columns].mean().mean()) if odds_columns else None),
        }
        mask = np.asarray([str(s) == str(season) for s in oof.fold_labels])
        if str(season) in scored_seasons and mask.any():
            actual = oof.actual[mask]
            base = block["result"].value_counts(normalize=True)
            prior = np.tile([[base.get("H", 1e-9), base.get("D", 1e-9), base.get("A", 1e-9)]], (len(actual), 1))
            row["baseline_log_loss"] = metrics.summarise(prior, actual)["log_loss"]
            for family in families:
                probs = oof.probs[family][mask]
                summary = metrics.summarise(probs, actual)
                row[f"{family}_log_loss"] = summary["log_loss"]
                row[f"{family}_brier"] = summary["brier"]
                row[f"{family}_ece"] = float(metrics.calibration_error(probs, actual))
                row[f"{family}_beats_base"] = bool(summary["log_loss"] < row["baseline_log_loss"])
        rows.append(row)
        previous_clubs = clubs
        seen_clubs |= clubs
    return {"study": "league-diagnostic", "league": args.league, "rows": rows,
            "hypotheses": [{"id": h, "statement": s, "column": c} for h, s, c in LEAGUE_DIAGNOSTIC_HYPOTHESES],
            "recommendation": "Diagnostic only. It tunes nothing and justifies no league-specific model by itself."}


def study_elo_transition(args) -> dict:
    frames = {value: build_dataset(args.league, elo_transition=value) for value in ELO_TRANSITIONS}
    columns = feature_names(tuple(args.feature_groups))
    baseline_name = "global_mean"
    baseline = fold_log_loss(frames[baseline_name], columns, args.family, args.half_life_days, args.min_train_seasons)
    rows = []
    for value in ELO_TRANSITIONS:
        scores = fold_log_loss(frames[value], columns, args.family, args.half_life_days, args.min_train_seasons)
        result = compare(baseline, scores)
        rows.append({"transition": value, "mean_log_loss": float(np.mean(list(scores.values()))), **result})
    return {"study": "elo-transition", "league": args.league, "rows": rows}


def study_elo_margin(args) -> dict:
    columns = feature_names(tuple(args.feature_groups))
    frames = {value: build_dataset(args.league, elo_margin_policy=value) for value in ELO_MARGIN_POLICIES}
    baseline = fold_log_loss(frames["plain"], columns, args.family, args.half_life_days, args.min_train_seasons)
    rows = []
    for value in ELO_MARGIN_POLICIES:
        scores = fold_log_loss(frames[value], columns, args.family, args.half_life_days, args.min_train_seasons)
        result = compare(baseline, scores)
        rows.append({"policy": value, "mean_log_loss": float(np.mean(list(scores.values()))), **result})
    return {"study": "elo-margin", "league": args.league, "rows": rows}


def study_regime_weighting(args) -> dict:
    import regime
    frame = build_dataset(args.league)
    columns = feature_names(tuple(args.feature_groups))
    baseline = fold_log_loss(frame, columns, args.family, args.half_life_days, args.min_train_seasons)
    def hook(train: pd.DataFrame, weights):
        cutoff = train["match_date"].max()
        multipliers = np.ones(len(train), dtype=float)
        teams = pd.unique(pd.concat([train["home_canonical"], train["away_canonical"]]))
        changed = {}
        for team in teams:
            verdict = regime.detect_for_team(regime.team_match_frame(train, team), team, cutoff)
            if verdict.changed and verdict.since:
                changed[team] = verdict.since
        if changed:
            dates = pd.to_datetime(train["match_date"]).to_numpy()
            for team, since in changed.items():
                involved = ((train["home_canonical"] == team) | (train["away_canonical"] == team)).to_numpy()
                before = dates < np.datetime64(pd.Timestamp(since))
                multipliers[involved & before] *= args.pre_change_weight
        base = np.ones(len(train)) if weights is None else np.asarray(weights, dtype=float)
        out = base * multipliers
        mean = out.mean()
        return out / mean if mean > 0 else out
    scores = fold_log_loss(frame, columns, args.family, args.half_life_days, args.min_train_seasons, weight_hook=hook)
    return {"study": "regime-weighting", "league": args.league, "pre_change_weight": args.pre_change_weight, **compare(baseline, scores)}


def study_ensemble(args) -> dict:
    frame = build_dataset(args.league)
    columns = feature_names(tuple(args.feature_groups))
    families = tuple(args.base_families)
    column_map = column_map_for(families, columns)
    oof = out_of_fold(frame, column_map, families, args.half_life_days, args.min_train_seasons)
    comparison = evaluate_out_of_time(oof, args.meta)
    return {"study": "ensemble", "league": args.league, "out_of_fold_rows": len(oof),
            "base_summary": {k: v for k, v in oof.summary().items()}, "comparison": comparison}


def study_calibration(args) -> dict:
    import calibration
    frame = build_dataset(args.league)
    columns = feature_names(tuple(args.feature_groups))
    families = (args.family,)
    column_map = column_map_for(families, columns)
    oof = out_of_fold(frame, column_map, families, args.half_life_days, args.min_train_seasons)
    probs, actual = oof.probs[args.family], oof.actual
    chosen, choice = calibration.select_calibrator(probs, actual, oof.fold_labels)
    before = calibration.calibration_report(probs, actual)
    after = calibration.calibration_report(chosen.transform(probs), actual)
    return {"study": "calibration", "league": args.league, "choice": choice, "before": before, "after": after}


def study_gbm_diagnostic(args) -> dict:
    from model_candidates import GBM_BASELINE, GBM_CANDIDATES, declared_grid
    frame = build_dataset(args.league)
    default_columns = feature_names(tuple(args.feature_groups))
    def columns_for(candidate):
        return default_columns if candidate.feature_groups is None else feature_names(tuple(candidate.feature_groups))
    def half_life_for(candidate):
        return args.half_life_days if candidate.half_life_days is None else candidate.half_life_days
    probe = list(expanding_season_folds(frame, args.min_train_seasons))
    if len(probe) < 3:
        return {"error": f"{args.league} has {len(probe)} usable folds; a paired comparison needs at least 3"}
    scores = {}
    train_scores = {}
    for candidate in GBM_CANDIDATES:
        columns = columns_for(candidate)
        scores[candidate.name] = fold_log_loss(frame, columns, "gbm", half_life_for(candidate), args.min_train_seasons, model_kwargs=candidate.model_kwargs, calibrate=candidate.calibrate)
        folds = list(expanding_season_folds(frame, args.min_train_seasons))
        if folds:
            train = frame.iloc[folds[-1].train_index]
            weights = time_weights(train["match_date"], half_life_for(candidate))
            model = fit_family("gbm", train, columns, half_life_for(candidate), weights=weights, **candidate.model_kwargs)
            train_scores[candidate.name] = metrics.summarise(model.predict_proba(train[columns]), train["result"].values)["log_loss"]
    baseline = scores[GBM_BASELINE]
    rows = []
    for candidate in GBM_CANDIDATES:
        result = compare(baseline, scores[candidate.name])
        rows.append({"candidate": candidate.name, "hypothesis": candidate.hypothesis,
                     "mean_log_loss": float(np.mean(list(scores[candidate.name].values())) ,
                     "train_log_loss": train_scores.get(candidate.name), **result})
    winners = [r for r in rows if r["beats_noise"]]
    chosen = min(winners, key=lambda r: r["mean_log_loss"]) if winners else None
    return {"study": "gbm-diagnostic", "league": args.league, "rows": rows,
            "chosen": chosen, "recommendation": "diagnostic only", "declared_grid": declared_grid()}


def study_base_model(args) -> dict:
    from model_candidates import BASE_MODEL_FAMILIES
    frame = build_dataset(args.league)
    columns = feature_names(tuple(args.feature_groups))
    families = tuple(args.base_families) if args.base_families else BASE_MODEL_FAMILIES
    column_map = column_map_for(families, columns)
    probe = list(expanding_season_folds(frame, args.min_train_seasons))
    if len(probe) < 3:
        return {"error": f"{args.league} has {len(probe)} usable folds; a paired comparison needs at least 3"}
    scores = {f: fold_log_loss(frame, column_map[f], f, args.half_life_days, args.min_train_seasons) for f in families}
    means = {f: float(np.mean(list(s.values()))) for f, s in scores.items()}
    ranked = sorted((f for f in families if f != "baseline"), key=lambda f: means[f])
    best = ranked[0]
    rows = []
    for family in families:
        result = compare(scores[best], scores[family])
        rows.append({"family": family, "mean_log_loss": means[family], **result})
    return {"study": "base-model", "league": args.league, "rows": rows, "best": best, "means": means,
            "recommendation": f"{best} is the strongest single family on these folds."}


AGGREGATE_PRICE_SOURCES = ("AVG", "MAX")
MARKET_OU_HYPOTHESES = (
    ("B1 goal level", "The Poisson mean total is systematically biased.", "mean_model_over - actual_over_rate"),
    ("B2 early season", "Bias is concentrated early in the season.", "early_season block"),
    ("B3 promoted clubs", "Bias is concentrated in newcomer fixtures.", "newcomer block"),
    ("B4 disagreement", "At >10pp disagreement the book is better calibrated.", "bucket log loss and Brier"),
    ("B5 dispersion", "The model is more dispersed than the book.", "sd of each side's probability"),
)


def _devig_two_way(odds_a, odds_b):
    inv_a = 1.0 / np.asarray(odds_a, dtype=float)
    inv_b = 1.0 / np.asarray(odds_b, dtype=float)
    overround = inv_a + inv_b
    return inv_a / overround, overround


def _binary_scores(prob, outcome) -> dict[str, float]:
    prob = np.clip(np.asarray(prob, dtype=float), 1e-9, 1 - 1e-9)
    outcome = np.asarray(outcome, dtype=float)
    log_loss = float(-np.mean(outcome * np.log(prob) + (1 - outcome) * np.log(1 - prob)))
    brier = float(np.mean((prob - outcome) ** 2))
    edges = np.linspace(0.0, 1.0, 11)
    index = np.clip(np.digitize(prob, edges[1:-1]), 0, 9)
    ece = 0.0
    for b in range(10):
        mask = index == b
        if mask.any():
            ece += (mask.sum() / len(prob)) * abs(prob[mask].mean() - outcome[mask].mean())
    return {"log_loss": log_loss, "brier": brier, "ece": float(ece),
            "mean_prob": float(prob.mean()), "sd_prob": float(prob.std()), "n": int(len(prob))}


def _load_ou_prices(divisions: list[str]) -> pd.DataFrame:
    from db import query_df
    return query_df(
        """
        select r.match_date, r.home_canonical, r.away_canonical, p.bookmaker,
               max(p.odds) filter (where p.selection = 'Over') as odds_over,
               max(p.odds) filter (where p.selection = 'Under') as odds_under
          from ai.historical_market_prices p
          join ai.raw_matches r on r.id = p.raw_match_id
         where r.division = any(%s) and p.market = 'OU' and p.line = 2.5 and p.phase = 'pre'
         group by 1,2,3,4
        """, (list(divisions),))


def study_market_ou(args) -> dict:
    from config import LEAGUES
    league = LEAGUES[args.league]
    frame = build_dataset(args.league)
    columns = feature_names(tuple(args.feature_groups))
    prices = _load_ou_prices(list(league.divisions))
    books_seen = sorted(prices["bookmaker"].unique().tolist()) if len(prices) else []
    real = prices[~prices["bookmaker"].isin(AGGREGATE_PRICE_SOURCES)] if len(prices) else prices
    real = real.dropna(subset=["odds_over", "odds_under"]) if len(real) else real
    if len(real):
        real = real[(real["odds_over"] > 1.0) & (real["odds_under"] > 1.0)].copy()
        real["p_market_over"], real["overround"] = _devig_two_way(real["odds_over"], real["odds_under"])
    rows = []
    for fold in expanding_season_folds(frame, args.min_train_seasons):
        train = frame.iloc[fold.train_index]
        test = frame.iloc[fold.test_index]
        weights = time_weights(train["match_date"], args.half_life_days)
        model = fit_family("poisson", train, columns, args.half_life_days, weights=weights)
        grid = model.scoreline_grid(test[columns])
        size = grid.shape[1]
        totals = np.add.outer(np.arange(size), np.arange(size))
        p_model_over = (grid * (totals >= 3).astype(float)).sum(axis=(1, 2))
        exp_home, exp_away = model.predict_goals(test[columns])
        rows.append(pd.DataFrame({
            "season": str(fold.season), "match_date": test["match_date"].values,
            "home_canonical": test["home_canonical"].values, "away_canonical": test["away_canonical"].values,
            "total_goals": (test["home_goals"] + test["away_goals"]).values,
            "p_model_over": p_model_over, "exp_total": exp_home + exp_away,
            "newcomer": ((test.get("home_is_newcomer", 0.0) >= 1.0) | (test.get("away_is_newcomer", 0.0) >= 1.0)).values,
        }))
    if not rows:
        return {"study": "market-ou", "league": args.league, "error": "no scored folds", "books_seen": books_seen}
    scored = pd.concat(rows, ignore_index=True)
    scored["actual_over"] = (scored["total_goals"] >= 3).astype(float)
    scored["stage"] = scored.groupby("season")["match_date"].rank(pct=True)
    matched = scored
    per_book = []
    if len(real):
        joined = real.merge(scored, on=["match_date", "home_canonical", "away_canonical"], how="inner")
        for book, block in joined.groupby("bookmaker"):
            summary = _binary_scores(block["p_market_over"], block["actual_over"])
            summary.update({"bookmaker": book, "mean_overround": float(block["overround"].mean())})
            per_book.append(summary)
        consensus = joined.groupby(["match_date", "home_canonical", "away_canonical"], as_index=False)["p_market_over"].mean()
        matched = scored.merge(consensus, on=["match_date", "home_canonical", "away_canonical"], how="inner")
    else:
        matched = scored.iloc[0:0].copy()
        matched["p_market_over"] = []
    n_scored, n_matched = int(len(scored)), int(len(matched))
    out = {"study": "market-ou", "league": args.league,
           "design": {"phase": "pre", "is_clv": False, "aggregates_excluded": list(AGGREGATE_PRICE_SOURCES),
                      "price_sources_present": books_seen, "real_bookmakers_used": sorted({r["bookmaker"] for r in per_book})},
           "hypotheses": [{"id": h, "statement": s, "column": c} for h,s,c in MARKET_OU_HYPOTHESES],
           "coverage": {"scored_fixtures": n_scored, "matched_fixtures": n_matched,
                        "match_rate": (n_matched/n_scored) if n_scored else None, "per_book": per_book},
           "per_book": per_book}
    if not n_matched:
        out["overall"] = {"matched": 0}
        out["recommendation"] = "No usable real-bookmaker Over/Under 2.5 evidence. Nothing changes."
        return out
    model = _binary_scores(matched["p_model_over"], matched["actual_over"])
    market = _binary_scores(matched["p_market_over"], matched["actual_over"])
    actual_rate = float(matched["actual_over"].mean())
    out["overall"] = {"matched": n_matched, "actual_over_rate": actual_rate, "model": model, "market": market,
                      "model_minus_market_log_loss": model["log_loss"]-market["log_loss"],
                      "model_minus_market_brier": model["brier"]-market["brier"]}
    out["recommendation"] = "Benchmark only. It fits nothing and emits no selection."
    return out


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
    home_move = test["home_division_move"].to_numpy()
    away_move = test["away_division_move"].to_numpy()
    moved = (home_move != 0) | (away_move != 0)
    played = np.where(home_move != 0, test["home_played_in_division"].to_numpy(), np.inf)
    played = np.minimum(played, np.where(away_move != 0, test["away_played_in_division"].to_numpy(), np.inf))
    return {"overall": np.ones(len(test), dtype=bool), "newcomer": moved, "established": ~moved,
            "promoted": (home_move > 0) | (away_move > 0), "relegated": (home_move < 0) | (away_move < 0),
            "newcomer_first5": moved & (played < 5), "newcomer_first10": moved & (played < 10),
            "newcomer_later": moved & (played >= 10)}


def _newcomer_fold_scores(frame, columns, family, half_life_days, min_train_seasons):
    out = {name: {} for name, _ in NEWCOMER_STRATA}
    for fold in expanding_season_folds(frame, min_train_seasons):
        train, test = frame.iloc[fold.train_index], frame.iloc[fold.test_index]
        weights = time_weights(train["match_date"], half_life_days)
        model = fit_family(family, train, columns, half_life_days, weights=weights)
        probs = model.predict_proba(test[columns])
        actual = test["result"].values
        for name, mask in _newcomer_masks(test).items():
            if mask.sum() >= 30:
                out[name][fold.season] = metrics.summarise(probs[mask], actual[mask])["log_loss"]
    return out


def study_newcomer_transfer(args) -> dict:
    from features import NEWCOMER_TRANSFER_DEFAULT, NEWCOMER_TRANSFER_POLICIES
    columns = feature_names(tuple(args.feature_groups))
    scores, counts = {}, {}
    for policy in NEWCOMER_TRANSFER_POLICIES:
        frame = build_dataset(args.league, newcomer_transfer=policy)
        if policy == NEWCOMER_TRANSFER_DEFAULT:
            probe = list(expanding_season_folds(frame, args.min_train_seasons))
            if len(probe) < 3:
                return {"error": f"{args.league} has {len(probe)} usable folds; a paired comparison needs at least 3"}
            for name, mask in _newcomer_masks(frame).items(): counts[name] = int(mask.sum())
        scores[policy] = _newcomer_fold_scores(frame, columns, args.family, args.half_life_days, args.min_train_seasons)
    control = scores[NEWCOMER_TRANSFER_DEFAULT]
    rows = []
    for policy in NEWCOMER_TRANSFER_POLICIES:
        if policy == NEWCOMER_TRANSFER_DEFAULT: continue
        for name, _ in NEWCOMER_STRATA:
            shared = sorted(set(control.get(name, {})) & set(scores[policy].get(name, {})))
            if len(shared) < 3: continue
            result = compare({s: control[name][s] for s in shared}, {s: scores[policy][name][s] for s in shared})
            rows.append({"policy": policy, "stratum": name, "rows": counts.get(name),
                         "mean_log_loss": float(np.mean([scores[policy][name][s] for s in shared])), **result})
    verdicts = {}
    for policy in NEWCOMER_TRANSFER_POLICIES:
        if policy == NEWCOMER_TRANSFER_DEFAULT: continue
        newcomer = next((r for r in rows if r["policy"] == policy and r["stratum"] == "newcomer"), None)
        established = next((r for r in rows if r["policy"] == policy and r["stratum"] == "established"), None)
        if newcomer is None or established is None: verdicts[policy] = "not measurable on these folds"
        elif newcomer["beats_noise"] and not established["harmful"]: verdicts[policy] = "adopt"
        elif established["harmful"]: verdicts[policy] = "reject: degrades established fixtures"
        else: verdicts[policy] = "no change: newcomer gain within noise"
    return {"study": "newcomer-transfer", "league": args.league, "family": args.family,
            "rows": rows, "counts": counts, "verdicts": verdicts}


def study_coverage_guard(args) -> dict:
    """Does dropping a barely-supported feature family help, and where?

    The two arms are explicit even though the guard is now the normal model
    definition: control reproduces the pre-adoption full configured feature set,
    while guarded applies the adopted support rule. That keeps this historical
    falsification meaningful after adoption.
    """
    from features import COVERAGE_SUPPORT_FLOOR, groups_with_support, known_indicators
    frame = build_dataset(args.league)
    groups = tuple(args.feature_groups)
    folds = list(expanding_season_folds(frame, args.min_train_seasons))
    if len(folds) < 3:
        return {"error": f"{args.league} has {len(folds)} usable folds; a paired comparison needs at least 3"}
    control, guarded, fired = {}, {}, []
    for fold in folds:
        train, test = frame.iloc[fold.train_index], frame.iloc[fold.test_index]
        kept, dropped = groups_with_support(train, groups, COVERAGE_SUPPORT_FLOOR)
        support = {}
        for group in groups:
            present = [c for c in known_indicators(group) if c in train.columns]
            if present:
                support[group] = float(train[present].to_numpy().mean())
        for label, use, coverage_guard in (
            ("control", groups, False),
            ("guarded", kept, True),
        ):
            columns = feature_names(use)
            weights = time_weights(train["match_date"], args.half_life_days)
            model = fit_family(args.family, train, columns, args.half_life_days,
                               weights=weights, coverage_guard=coverage_guard)
            score = metrics.summarise(model.predict_proba(test[columns]), test["result"].values)["log_loss"]
            (control if label == "control" else guarded)[fold.season] = score
        if dropped:
            fired.append({"season": fold.season, "dropped": list(dropped),
                          "train_support": {g: round(support.get(g, -1.0), 4) for g in dropped},
                          "test_support": {g: round(float(test[[c for c in known_indicators(g) if c in test.columns]].to_numpy().mean()), 4) for g in dropped},
                          "control_log_loss": control[fold.season], "guarded_log_loss": guarded[fold.season]})
    result = compare(control, guarded)
    return {"study": "coverage-guard", "league": args.league, "floor": COVERAGE_SUPPORT_FLOOR,
            "folds": len(folds), "fired": fired, "control": control, "guarded": guarded, **result,
            "recommendation": "Adopt only if the guard removes the catastrophic fold and is within noise elsewhere."}


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


def _from_rows(result: dict, key: str, baseline_label: str) -> dict:
    rows = result.get("rows") or []
    if not rows: return {}
    scored = [r for r in rows if r.get("mean_delta") is not None]
    if not scored: return {}
    winners = [r for r in scored if r.get("beats_noise")]
    best = min(winners, key=lambda r: r["mean_delta"]) if winners else min(scored, key=lambda r: r["mean_delta"])
    return {"baseline": baseline_label, "candidate": str(best.get(key)), "folds": best.get("folds", 0),
            "mean_delta": best.get("mean_delta"), "se_delta": best.get("se_delta"),
            "beats_noise": bool(best.get("beats_noise")), "harmful": bool(best.get("harmful")),
            "chosen": (str((result.get("chosen") or {}).get(key)) if result.get("chosen") else None),
            "candidates_tested": len(scored)}


def ledger_entry(study: str, result: dict) -> dict:
    if result.get("error"):
        return {"baseline": None, "candidate": None, "folds": 0, "mean_delta": None,
                "se_delta": None, "beats_noise": False, "harmful": False, "error": result["error"]}
    if study == "half-life": return _from_rows(result, "half_life_days", f"incumbent {DEFAULT_HALF_LIFE_DAYS:g} days")
    if study == "time-weighting": return _from_rows(result, "candidate", f"incumbent {DEFAULT_HALF_LIFE_DAYS:g} days")
    if study == "elo-transition": return _from_rows(result, "transition", "global_mean (the defect)")
    if study == "elo-margin": return _from_rows(result, "policy", "plain (no red-card adjustment)")
    if study == "regime-weighting":
        return {"baseline": "unweighted history", "candidate": f"pre-change weight {result.get('pre_change_weight')}",
                "folds": result.get("folds", 0), "mean_delta": result.get("mean_delta"), "se_delta": result.get("se_delta"),
                "beats_noise": bool(result.get("beats_noise")), "harmful": bool(result.get("harmful"))}
    if study == "ensemble":
        comparison = result.get("comparison") or {}
        best_base = comparison.get("_best_base")
        candidates = [(name, comparison[name]["vs_best_base"]) for name in comparison
                      if isinstance(comparison.get(name), dict) and comparison[name].get("vs_best_base")]
        if not candidates:
            return {"baseline": best_base, "candidate": None, "folds": 0, "mean_delta": None,
                    "se_delta": None, "beats_noise": False, "harmful": False, "error": comparison.get("error", "no meta-model compared")}
        name, vs = min(candidates, key=lambda pair: pair[1]["mean_delta"])
        return {"baseline": f"best single base model ({best_base})", "candidate": name,
                "folds": comparison[name].get("folds", 0), "mean_delta": vs["mean_delta"], "se_delta": vs["se_delta"],
                "beats_noise": bool(vs["beats_noise"]), "harmful": bool(vs["mean_delta"] > 0 and vs["mean_delta"] - 2*(vs["se_delta"] or 0) > 0),
                "chosen": name if vs["beats_noise"] else best_base, "candidates_tested": len(candidates)}
    if study in ("league-diagnostic", "market-ou"):
        return {"baseline": None, "candidate": None, "folds": len(result.get("rows") or []),
                "mean_delta": None, "se_delta": None, "beats_noise": False, "harmful": False,
                "chosen": None, "error": "diagnostic only: no configuration was compared"}
    if study == "gbm-diagnostic": return _from_rows(result, "candidate", "shipped gbm configuration")
    if study == "base-model":
        rows, best = result.get("rows") or [], result.get("best")
        others = [r for r in rows if r["family"] not in (best, "baseline")]
        if not others: return {"baseline": best, "candidate": None, "folds": 0, "mean_delta": None, "se_delta": None, "beats_noise": False, "harmful": False}
        closest = min(others, key=lambda r: r["mean_delta"])
        return {"baseline": f"best single family ({best})", "candidate": closest["family"], "folds": closest.get("folds",0),
                "mean_delta": closest.get("mean_delta"), "se_delta": closest.get("se_delta"),
                "beats_noise": bool(closest.get("beats_noise")), "harmful": bool(closest.get("harmful")), "chosen": best}
    if study == "calibration":
        choice = result.get("choice") or {}; before=(result.get("before") or {}).get("log_loss"); after=(result.get("after") or {}).get("log_loss")
        delta = None if before is None or after is None else float(after)-float(before)
        return {"baseline":"uncalibrated out-of-fold probabilities", "candidate":choice.get("chosen"), "folds":choice.get("folds",0),
                "mean_delta":delta, "se_delta":None, "beats_noise":bool(choice.get("chosen") and choice.get("chosen")!="identity"),
                "harmful":bool(delta is not None and delta>0), "chosen":choice.get("chosen")}
    return {}


def record_experiment(league: str, study: str, result: dict) -> None:
    from db import connect
    entry = ledger_entry(study, result)
    delta, se = entry.get("mean_delta"), entry.get("se_delta")
    verdict = "kept" if entry.get("beats_noise") else "rejected" if entry.get("harmful") else "inconclusive" if delta is not None else "undecided"
    hypothesis = f"{study}: {entry.get('candidate')} vs {entry.get('baseline')}" if entry.get("candidate") else f"{study}: {result.get('error','no comparison')}"
    with connect() as conn:
        conn.execute("insert into ai.feature_experiments (league,hypothesis,folds,delta_log_loss,delta_rps,std_error,verdict,notes) values (%s,%s,%s,%s,%s,%s,%s,%s)",
                     (league,hypothesis[:500],entry.get("folds",0) or 0,delta,None,se,verdict,json.dumps({"decision":entry,"recommendation":result.get("recommendation"),"report":result},default=str)[:4000]))
        conn.commit()


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--league", choices=sorted(LEAGUES), required=True)
    ap.add_argument("--study", choices=STUDIES, required=True)
    ap.add_argument("--family", default="poisson")
    ap.add_argument("--feature-groups", nargs="*", default=list(DEFAULT_GROUPS))
    ap.add_argument("--half-life-days", type=float, default=DEFAULT_HALF_LIFE_DAYS)
    ap.add_argument("--min-train-seasons", type=int, default=5)
    ap.add_argument("--base-families", nargs="*", default=None)
    ap.add_argument("--meta", default="logistic_stack")
    ap.add_argument("--pre-change-weight", type=float, default=0.5)
    ap.add_argument("--record", action="store_true")
    args = ap.parse_args()
    if args.record and read_only():
        raise SystemExit("--record was asked for while AI_READ_ONLY is set")
    if args.base_families is None:
        from model_candidates import BASE_MODEL_FAMILIES
        args.base_families = list(BASE_MODEL_FAMILIES if args.study == "base-model" else ENSEMBLE_BASE_FAMILIES)
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
