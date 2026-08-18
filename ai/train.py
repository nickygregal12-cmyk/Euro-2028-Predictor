"""Train a challenger model and record how it did against the benchmarks.

    python train.py --league EPL --family poisson --version v0.3
    python train.py --league EPL --family ensemble --version v0.7 --walk-forward

Two stages, and keeping them apart is the whole design.

EVALUATION answers "how good is this configuration?" and must never be
computed by a model that has seen the rows it is scored on. Every number in
the report — the holdout metrics, the walk-forward folds, the calibrator's
gain, the ensemble-versus-components comparison — comes from a model fitted
strictly before the matches it is measured on.

The FINAL FIT answers a different question: "what should be deployed?" A model
that will forecast next Saturday should know about last Saturday, and until
now it did not. The old code fitted on the training subset, evaluated against
the held-out seasons, and then serialised THAT model — so the artefact promoted
into production had never seen the two most recent seasons in the archive, and
`training_matches` described a fit that was thrown away rather than the bytes
that were stored. For a weekly-learning lab that is the wrong artefact: adding
Saturday's results to the database changed nothing about the model that would
predict the following Saturday.

So evaluation finishes first, completely, and only then is a fresh model fitted
on every eligible completed match and serialised. The metadata records both, so
"which rows is this artefact made of" and "which rows was it judged on" are
separately answerable months later.

Nothing here promotes anything. The challenger is written with status
'challenger' and sits there until a human calls admin_ai_promote_model.
"""
from __future__ import annotations

import argparse
import hashlib
import json
import sys

import joblib
import numpy as np
import pandas as pd

import calibration
import ensemble as ensemble_mod
import metrics
from artifacts import ARTIFACT_SCHEMA, ModelBundle
from config import LEAGUES, MODEL_DIR, REPORT_DIR
from db import insert_model_with_artifact, job, load_history
from features import (DEFAULT_GROUPS, ELO_MARGIN_POLICY_DEFAULT,
                      ELO_TRANSITION_DEFAULT, FEATURES_VERSION,
                      NEWCOMER_TRANSFER_DEFAULT, FeatureBuilder, feature_names)
from fitting import DEFAULT_HALF_LIFE_DAYS, fit_family, time_weights
from market_features import (MARKET_FEATURE_NAMES, assert_pure,
                             build_market_block)
from model_zoo import ENSEMBLE_BASE_FAMILIES, MODEL_FAMILIES, uses_market

# Re-exported: `ablate.py`, `experiments.py` and the tests import these from
# here, and moving them to `fitting.py` should not break a caller.
__all__ = ["DEFAULT_HALF_LIFE_DAYS", "time_weights", "build_dataset",
           "chronological_split", "walk_forward", "column_map_for"]


def build_dataset(league_key: str, elo_transition: str = ELO_TRANSITION_DEFAULT,
                  elo_margin_policy: str = ELO_MARGIN_POLICY_DEFAULT,
                  schedule_context=None,
                  newcomer_transfer: str = NEWCOMER_TRANSFER_DEFAULT
                  ) -> pd.DataFrame:
    league = LEAGUES[league_key]
    history = load_history(league.divisions)
    if history.empty:
        raise SystemExit(f"No history for {league_key}. Run fetch_history.py first.")

    builder = FeatureBuilder(top_division=league.top_division,
                             elo_transition=elo_transition,
                             elo_margin_policy=elo_margin_policy,
                             schedule_context=schedule_context,
                             newcomer_transfer=newcomer_transfer)
    frame = builder.build_training_frame(history)

    # Attach the market benchmark and the pre-match price block by joining back
    # on the natural key. Closing prices are deliberately NOT joined: they are
    # the benchmark, and `market_features.assert_no_closing_features` refuses
    # them if they ever arrive here by another route.
    keyed = history.set_index(
        ["match_date", "home_canonical", "away_canonical"]
    )[["mkt_home_prob", "mkt_draw_prob", "mkt_away_prob",
       "odds_avg_h", "odds_avg_d", "odds_avg_a",
       "odds_max_h", "odds_max_d", "odds_max_a"]]
    frame = frame.join(
        keyed, on=["match_date", "home_canonical", "away_canonical"]
    )
    frame = pd.concat([frame, build_market_block(frame)], axis=1)

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


def column_map_for(families, football_columns: list[str]) -> dict[str, list[str]]:
    """Which columns each family is allowed to see.

    The market family gets the market block appended; every other family gets
    the football columns and is checked, by `assert_pure`, to be receiving no
    price at all. That check is the difference between "the pure model happens
    to have no odds in it today" and "the pure model cannot have odds in it".
    """
    assert_pure(football_columns)
    out: dict[str, list[str]] = {}
    for family in families:
        if uses_market(family):
            out[family] = list(football_columns) + list(MARKET_FEATURE_NAMES)
        else:
            out[family] = list(football_columns)
    return out


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
    folds = ensemble_mod.expanding_season_folds(frame, min_train_seasons)
    if not folds:
        return None

    scores = []
    for fold in folds:
        train = frame.iloc[fold.train_index]
        test = frame.iloc[fold.test_index]
        # The same weighting the shipped model gets. A fold validated under
        # different settings from the one that goes live is measuring a model
        # nobody will ever use.
        model = fit_family(family, train, columns, half_life_days)
        probs = model.predict_proba(test[columns])
        s = metrics.summarise(probs, test["result"].values)
        s["season"] = fold.season
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


# ---------------------------------------------------------------------------
# Stage A: evaluation
# ---------------------------------------------------------------------------

def evaluate_configuration(frame: pd.DataFrame, family: str,
                           column_map: dict[str, list[str]],
                           half_life_days: float, holdout_seasons: int,
                           want_walk_forward: bool,
                           base_families: tuple[str, ...],
                           meta: str,
                           min_train_seasons: int = 5) -> dict:
    """Every number that will be reported, computed out-of-time.

    Returns the report AND the out-of-fold material, because the calibrator is
    fitted from it and must never be fitted from anything else.
    """
    train, val, val_seasons = chronological_split(frame, holdout_seasons)
    columns = column_map[family] if family != "ensemble" else column_map[base_families[0]]

    if family == "ensemble":
        # The ensemble's holdout evaluation refits its bases on the training
        # seasons only, and its meta-model on out-of-fold material drawn from
        # inside those training seasons. The holdout stays untouched by every
        # component, which is the property that makes the comparison honest.
        inner, oof_inner = ensemble_mod.fit_ensemble(
            train, column_map, base_families, meta, half_life_days,
            min_train_seasons)
        val_probs = inner.predict_proba(val)
        base_val = inner.base_probabilities(val)
    else:
        model = fit_family(family, train, columns, half_life_days)
        val_probs = model.predict_proba(val[columns])
        base_val = {family: val_probs}

    result = metrics.summarise(val_probs, val["result"].values)
    calib = metrics.calibration_table(val_probs, val["result"].values)
    ece = metrics.calibration_error(val_probs, val["result"].values)

    base = MODEL_FAMILIES["baseline"]().fit(train[columns], train["result"])
    base_result = metrics.summarise(base.predict_proba(val[columns]), val["result"].values)

    report = {
        "eval_train_matches": len(train),
        "eval_train_seasons": [str(train["season"].min()), str(train["season"].max())],
        "eval_train_through": str(train["match_date"].max()),
        "val_matches": len(val),
        "val_seasons": val_seasons,
        "model": result,
        "baseline": base_result,
        "market": market_benchmark(val),
        "calibration": calib,
        "ece": ece,
        "holdout_base_probabilities": {k: v for k, v in base_val.items()},
    }

    if want_walk_forward and family != "ensemble":
        report["walk_forward"] = walk_forward(frame, family, columns,
                                              min_train_seasons, half_life_days)
    return report


# ---------------------------------------------------------------------------
# Stage B: the final challenger fit
# ---------------------------------------------------------------------------

def fit_final_challenger(frame: pd.DataFrame, family: str,
                         column_map: dict[str, list[str]],
                         half_life_days: float,
                         base_families: tuple[str, ...],
                         meta: str,
                         min_train_seasons: int,
                         oof: "ensemble_mod.OutOfFold | None" = None):
    """A fresh model fitted on EVERY eligible completed match.

    Called only after evaluation has finished. Nothing computed here is ever
    reported as a validation metric: this model has seen the validation
    seasons, so any number it produces about them is meaningless.
    """
    if family == "ensemble":
        model, oof = ensemble_mod.fit_ensemble(
            frame, column_map, base_families, meta, half_life_days,
            min_train_seasons, oof=oof)
        return model, oof

    columns = column_map[family]
    model = fit_family(family, frame, columns, half_life_days)
    return model, oof


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--league", choices=sorted(LEAGUES), required=True)
    ap.add_argument("--family", choices=sorted(MODEL_FAMILIES) + ["ensemble"],
                    default="poisson")
    ap.add_argument("--version", required=True)
    ap.add_argument("--holdout-seasons", type=int, default=2)
    ap.add_argument("--feature-groups", nargs="*", default=list(DEFAULT_GROUPS),
                    help="Feature families to train on. Only families proven "
                         "by ablate.py should be added here.")
    ap.add_argument("--half-life-days", type=float, default=DEFAULT_HALF_LIFE_DAYS,
                    help="Dixon-Coles time weighting: a match this old counts "
                         "half as much as one played today. 0 disables it and "
                         "weights every match in the archive equally.")
    ap.add_argument("--elo-transition", default=ELO_TRANSITION_DEFAULT,
                    help="How ratings move between seasons. See features.py.")
    ap.add_argument("--base-families", nargs="*", default=list(ENSEMBLE_BASE_FAMILIES),
                    help="Component families when --family ensemble.")
    ap.add_argument("--meta", default="logistic_stack",
                    choices=sorted(ensemble_mod.META_MODELS),
                    help="How the ensemble combines its components.")
    ap.add_argument("--calibrate", default="auto",
                    choices=["auto", "off"] + sorted(calibration.CALIBRATORS),
                    help="Applied probability calibration, fitted out-of-fold "
                         "only. 'auto' picks by held-out log loss and may "
                         "choose to do nothing.")
    ap.add_argument("--min-train-seasons", type=int, default=5)
    ap.add_argument("--min-meta-folds", type=int, default=3,
                    help="Folds reserved to fit the first stacker when "
                         "cross-fitting ensemble calibration material. Those "
                         "seasons produce no calibration row, because the only "
                         "meta prediction available for them would be one the "
                         "stacker had been fitted on.")
    ap.add_argument("--walk-forward", action="store_true",
                    help="Expanding-window validation across every season, with a "
                         "standard error. Use this to decide whether a feature helped.")
    ap.add_argument("--dry-run", action="store_true",
                    help="Print the report; write nothing to the database.")
    args = ap.parse_args()

    base_families = tuple(args.base_families)

    with job("train", args.league) as state:
        frame = build_dataset(args.league, args.elo_transition)
        football_columns = feature_names(tuple(args.feature_groups))
        wanted = (set(base_families) if args.family == "ensemble"
                  else {args.family})
        column_map = column_map_for(wanted, football_columns)
        columns = (column_map[base_families[0]] if args.family == "ensemble"
                   else column_map[args.family])

        # ---------------- stage A: evaluation ------------------------------
        report = evaluate_configuration(
            frame, args.family, column_map, args.half_life_days,
            args.holdout_seasons, args.walk_forward, base_families, args.meta,
            args.min_train_seasons)
        report.pop("holdout_base_probabilities")
        result = report["model"]
        base_result = report["baseline"]
        market = report["market"]
        val_seasons = report["val_seasons"]

        print(f"\n=== {args.league} {args.version} ({args.family}) ===")
        print(f"eval train {report['eval_train_matches']:>6} matches  "
              f"({report['eval_train_seasons'][0]}..{report['eval_train_seasons'][1]})")
        print(f"validation {report['val_matches']:>6} matches  ({', '.join(val_seasons)})")
        print(f"\n{'':14}{'acc':>8}{'log loss':>11}{'rps':>9}{'brier':>9}")
        print(f"{'baseline':14}{base_result['accuracy']:>8.3f}{base_result['log_loss']:>11.4f}"
              f"{base_result['rps']:>9.4f}{base_result['brier']:>9.4f}")
        print(f"{'model':14}{result['accuracy']:>8.3f}{result['log_loss']:>11.4f}"
              f"{result['rps']:>9.4f}{result['brier']:>9.4f}")
        if market:
            print(f"{'market':14}{market['accuracy']:>8.3f}{market['log_loss']:>11.4f}"
                  f"{market['rps']:>9.4f}{market['brier']:>9.4f}"
                  f"   (coverage {market['coverage']})")
        print(f"\nexpected calibration error: {report['ece']:.4f}")
        print(f"{'confidence':>22}{'n':>7}{'predicted':>12}{'actual':>9}{'gap':>8}")
        for row in report["calibration"]:
            print(f"{row['min_conf']:>12.2f}-{row['max_conf']:<9.2f}{row['n']:>7}"
                  f"{row['mean_predicted']:>12.3f}{row['actual_rate']:>9.3f}{row['gap']:>8.3f}")

        beats_baseline = result["log_loss"] < base_result["log_loss"]
        print(f"\nbeats baseline on log loss: {'YES' if beats_baseline else 'NO'}")
        if market:
            print(f"gap to market (log loss):   {result['log_loss'] - market['log_loss']:+.4f}"
                  "   (negative would mean beating the closing line)")

        wf = report.get("walk_forward")
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

        # ---------------- stage B: the artefact that ships -------------------
        # Only now. Everything above is measured; everything below is deployed.
        final_model, oof = fit_final_challenger(
            frame, args.family, column_map, args.half_life_days, base_families,
            args.meta, args.min_train_seasons)

        # ---------------- calibration, from out-of-fold material only --------
        calibrator, calib_choice = None, {"chosen": "off"}
        if args.calibrate != "off":
            if oof is None:
                oof = ensemble_mod.out_of_fold(
                    frame, column_map,
                    (args.family,) if args.family != "ensemble" else base_families,
                    args.half_life_days, args.min_train_seasons)
            if args.family == "ensemble":
                # SECOND-LEVEL cross-fitting. The base predictions are
                # out-of-fold for the BASE models and are not out-of-sample for
                # the meta-model; fitting the stacker on all of them and then
                # calibrating its predictions of those same rows measures the
                # stacker's training-set behaviour. Every row below comes from
                # a stacker fitted only on strictly earlier seasons.
                stacked = ensemble_mod.stacked_out_of_time(
                    oof, args.meta, args.min_meta_folds)
                ensemble_mod.assert_meta_out_of_sample(stacked, oof)
                oof_probs = stacked.probs
                calib_actual = stacked.actual
                calib_folds = stacked.fold_labels
                report["ensemble_calibration_material"] = {
                    "meta": stacked.meta,
                    "rows_used": len(stacked),
                    "rows_dropped_to_cross_fit": stacked.rows_dropped,
                    "folds_used": stacked.folds_used,
                    **stacked.detail,
                }
                print(f"\nensemble calibration material: {len(stacked)} rows "
                      f"cross-fitted over {stacked.folds_used} folds "
                      f"({stacked.rows_dropped} rows reserved for the first "
                      "meta fit and not calibrated on)")
            else:
                oof_probs = oof.probs[args.family]
                calib_actual = oof.actual
                calib_folds = oof.fold_labels
            if args.calibrate == "auto":
                calibrator, calib_choice = calibration.select_calibrator(
                    oof_probs, calib_actual, calib_folds)
            else:
                calibrator = calibration.CALIBRATORS[args.calibrate]().fit(
                    oof_probs, calib_actual)
                calib_choice = {"chosen": args.calibrate, "forced": True,
                                "describe": calibrator.describe()}
            report["calibration_choice"] = calib_choice
            report["calibration_before"] = calibration.calibration_report(
                oof_probs, calib_actual)
            report["calibration_after"] = calibration.calibration_report(
                calibrator.transform(oof_probs), calib_actual)
            print(f"\ncalibration: {calib_choice['chosen']}"
                  f"   ECE {report['calibration_before']['ece']:.4f}"
                  f" -> {report['calibration_after']['ece']:.4f}"
                  f"   ({'cross-fitted meta' if args.family == 'ensemble' else 'out-of-fold'}"
                  f", {len(calib_actual)} rows)")
            if isinstance(calibrator, calibration.IdentityCalibrator):
                print("  no calibrator adopted: none beat doing nothing on held-out folds")

        if args.family == "ensemble" and oof is not None:
            report["ensemble_comparison"] = ensemble_mod.evaluate_out_of_time(
                oof, args.meta)
            comp = report["ensemble_comparison"]
            print("\nensemble vs components (out-of-time, meta refitted per fold)")
            print(f"{'model':>16}{'folds':>7}{'log loss':>11}{'se':>9}")
            for name, row in comp.items():
                if name.startswith("_") or "mean_log_loss" not in row:
                    continue
                print(f"{name:>16}{row['folds']:>7}{row['mean_log_loss']:>11.4f}"
                      f"{row['se_log_loss']:>9.4f}")
            for name in ("equal_blend", args.meta):
                vs = comp.get(name, {}).get("vs_best_base")
                if vs:
                    print(f"  {name} vs best base ({vs['base']}): "
                          f"{vs['mean_delta']:+.4f} ±{vs['se_delta']:.4f}"
                          f"  {'beats noise' if vs['beats_noise'] else 'within noise'}")

        # The final fit's own footprint, which is what the artefact IS.
        report.update({
            "league": args.league, "version": args.version, "family": args.family,
            "features_version": FEATURES_VERSION,
            "feature_groups": list(args.feature_groups),
            "half_life_days": args.half_life_days,
            "elo_transition": args.elo_transition,
            "final_fit_matches": len(frame),
            "final_trained_through": str(frame["match_date"].max()),
            "final_fit_seasons": [str(frame["season"].min()), str(frame["season"].max())],
            "base_families": list(base_families) if args.family == "ensemble" else None,
            "meta": args.meta if args.family == "ensemble" else None,
        })
        print(f"\nfinal challenger fitted on {report['final_fit_matches']} matches "
              f"through {report['final_trained_through']} "
              f"({report['final_fit_matches'] - report['eval_train_matches']} more "
              f"than the evaluation fit saw)")

        (REPORT_DIR / f"{args.league.lower()}-{args.version}.json").write_text(
            json.dumps(report, indent=2, default=str))

        if args.dry_run:
            print("\n--dry-run: nothing written to the database")
            state["detail"] = report
            return 0

        bundle = ModelBundle(
            model=final_model,
            features=columns,
            features_version=FEATURES_VERSION,
            feature_groups=tuple(args.feature_groups),
            family=args.family,
            league=args.league,
            version=args.version,
            half_life_days=args.half_life_days,
            elo_transition=args.elo_transition,
            calibrator=calibrator,
            components={"base_families": list(base_families),
                        "meta": args.meta} if args.family == "ensemble" else {},
            trained_through=pd.to_datetime(frame["match_date"].max()).date(),
            schema=ARTIFACT_SCHEMA,
            metadata={
                "column_map": {k: list(v) for k, v in column_map.items()},
                "calibration": calib_choice,
                "eval_train_matches": report["eval_train_matches"],
                "val_seasons": val_seasons,
                # Carried so `confidence.probability_uncertainty` has a real
                # fold error to work from rather than an invented constant.
                "walk_forward_se": (wf or {}).get("se_log_loss"),
                "fold_probability_se": _fold_probability_se(wf),
            },
        )

        artifact = MODEL_DIR / f"{args.league.lower()}-{args.version}.joblib"
        joblib.dump(bundle.to_payload(), artifact)
        sha = hashlib.sha256(artifact.read_bytes()).hexdigest()

        # Every provenance column contract 188 added, populated from the
        # bundle and the report rather than left at its default. A column with
        # no writer is this repository's most-repeated defect and these were
        # about to be the next instance: the migration added ten of them and
        # this record inserted the same nine fields it always had, so a
        # market-informed model would have been stored with `uses_market` false
        # because nothing overwrote the default. `test_training.py` reads the
        # row and the artefact back and requires them to agree.
        record = {
            "league": args.league,
            "version": args.version,
            "family": args.family,
            # The artefact's own row count, not the evaluation fit's. This
            # column described a model that was thrown away.
            "training_matches": len(frame),
            "eval_training_matches": report["eval_train_matches"],
            "final_trained_through": pd.to_datetime(
                report["final_trained_through"]).date(),
            "features_used": columns,
            "features_version": FEATURES_VERSION,
            "feature_groups": list(args.feature_groups),
            "half_life_days": round(float(args.half_life_days), 2),
            "elo_transition": args.elo_transition,
            "calibration_method": calib_choice.get("chosen"),
            "component_families": (list(base_families)
                                   if args.family == "ensemble" else None),
            "meta_model": args.meta if args.family == "ensemble" else None,
            # Derived from what the model IS, never from an argument. A market
            # family inside an ensemble makes the ensemble market-informed.
            "uses_market": bool(getattr(final_model, "uses_market", False)),
            "val_accuracy": round(result["accuracy"], 5),
            "val_log_loss": round(result["log_loss"], 5),
            "val_rps": round(result["rps"], 5),
            "val_brier": round(result["brier"], 5),
            "baseline_log_loss": round(base_result["log_loss"], 5),
            "market_log_loss": round(market["log_loss"], 5) if market else None,
            "status": "challenger",
            "artifact_path": str(artifact.relative_to(MODEL_DIR.parent)),
            "artifact_sha256": sha,
            "notes": (f"holdout seasons: {', '.join(val_seasons)}; "
                      f"ECE {report['ece']:.4f}; "
                      f"eval fit {report['eval_train_matches']} rows, "
                      f"final fit {len(frame)} rows through "
                      f"{report['final_trained_through']}; "
                      f"calibration {calib_choice.get('chosen')}"),
        }
        assert_provenance_agrees(record, bundle)
        model_id = insert_model_with_artifact(record, artifact)

        state["rows"] = 1
        state["detail"] = report
        print(f"\nwrote challenger {model_id} (artefact stored, {sha[:12]}…)")
        print("It is NOT live. Promote with admin_ai_promote_model when you are ready.")
    return 0


class ProvenanceMismatch(ValueError):
    """The database row and the stored bytes disagree about what this model is."""


def assert_provenance_agrees(record: dict, bundle: ModelBundle) -> None:
    """The `ai.models` row must describe the artefact it is stored beside.

    Checked at write time rather than in a test alone, because the two are
    written in one transaction and a disagreement between them is undetectable
    afterwards: the row says `uses_market = false`, the bytes contain a
    market-informed model, and every question anyone asks later — "is the
    football model adding information over the market?" chief among them — is
    answered from the row.
    """
    expected = {
        "family": bundle.family,
        "features_used": list(bundle.features),
        "features_version": bundle.features_version,
        "feature_groups": list(bundle.feature_groups),
        "half_life_days": round(float(bundle.half_life_days), 2),
        "elo_transition": bundle.elo_transition,
        "final_trained_through": bundle.trained_through,
        "uses_market": bool(getattr(bundle.model, "uses_market", False)),
        "component_families": (list(bundle.components.get("base_families"))
                               if bundle.components.get("base_families") else None),
        "meta_model": bundle.components.get("meta"),
    }
    wrong = {k: (record.get(k), v) for k, v in expected.items()
             if record.get(k) != v}
    if wrong:
        raise ProvenanceMismatch(
            "ai.models row and the stored artefact disagree: "
            + "; ".join(f"{k}: row={row!r} artefact={art!r}"
                        for k, (row, art) in sorted(wrong.items())))


def _fold_probability_se(wf: dict | None) -> float | None:
    """Season-to-season movement of the model's own probabilities, roughly.

    Derived from the fold accuracy spread rather than from log loss, because
    the uncertainty band is expressed in probability points and log loss is
    not. Approximate on purpose, and labelled as such wherever it surfaces.
    """
    if not wf or not wf.get("folds"):
        return None
    acc = np.array([f["accuracy"] for f in wf["folds"]], dtype=float)
    if len(acc) < 2:
        return None
    return round(float(acc.std(ddof=1)), 5)


if __name__ == "__main__":
    sys.exit(main())
