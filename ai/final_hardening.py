"""Close the AI hardening study with one guarded per-league model decision.

This script implements, and does not reinterpret, the predeclaration in
`docs/quality/investigations/2026-08-14-final-model-selection-predeclaration.md`.
It is read-only: it loads retained history, fits models in memory and writes a
JSON report to the runner filesystem. It never inserts a model or promotes one.

Typical hosted use:

    AI_READ_ONLY=1 python final_hardening.py --all
    AI_READ_ONLY=1 python final_hardening.py --league SCH
"""
from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

import numpy as np

import metrics
from ablate import compare
from config import LEAGUES, REPORT_DIR
from ensemble import expanding_season_folds
from features import DEFAULT_GROUPS, NEWCOMER_TRANSFER_DEFAULT, feature_names
from fitting import CoverageGuardedModel, fit_family
from train import build_dataset

HALF_LIVES = (900.0, 1800.0)
FAMILIES = ("poisson", "elo")
CONFIGS = tuple(
    [f"{family}-{int(half_life)}" for half_life in HALF_LIVES for family in FAMILIES]
    + [f"blend-{int(half_life)}" for half_life in HALF_LIVES]
)


def _summary(folds: dict[str, dict]) -> dict:
    values = np.asarray([row["log_loss"] for row in folds.values()], dtype=float)
    rps = np.asarray([row["rps"] for row in folds.values()], dtype=float)
    brier = np.asarray([row["brier"] for row in folds.values()], dtype=float)
    n = len(values)
    return {
        "folds": n,
        "mean_log_loss": float(values.mean()),
        "se_log_loss": float(values.std(ddof=1) / np.sqrt(n)) if n > 1 else float("nan"),
        "mean_rps": float(rps.mean()),
        "mean_brier": float(brier.mean()),
    }


def _scores(folds: dict[str, dict]) -> dict[str, float]:
    return {season: float(row["log_loss"]) for season, row in folds.items()}


def _paired(a: dict[str, dict], b: dict[str, dict]) -> dict:
    """Candidate B against baseline A, using the repository's fixed 2-SE rule."""
    return compare(_scores(a), _scores(b))


def _provenance(model) -> dict:
    if isinstance(model, CoverageGuardedModel):
        return dict(model.coverage_provenance)
    direct = getattr(model, "coverage_provenance", None)
    return dict(direct) if isinstance(direct, dict) else {
        "enabled": False,
        "requested_groups": list(DEFAULT_GROUPS),
        "effective_groups": list(DEFAULT_GROUPS),
        "dropped_groups": [],
    }


def _fit_single(family, train, columns, half_life):
    return fit_family(
        family, train, columns, half_life,
        coverage_guard=True,
    )


def evaluate_league(league: str, min_train_seasons: int = 5) -> dict:
    frame = build_dataset(league, newcomer_transfer=NEWCOMER_TRANSFER_DEFAULT)
    columns = feature_names(DEFAULT_GROUPS)
    folds = list(expanding_season_folds(frame, min_train_seasons))
    if len(folds) < 3:
        raise RuntimeError(
            f"{league} has {len(folds)} usable folds; final selection needs at least 3")

    results: dict[str, dict[str, dict]] = {name: {} for name in CONFIGS}
    coverage: dict[str, dict[str, dict]] = {name: {} for name in CONFIGS}

    for fold in folds:
        train = frame.iloc[fold.train_index]
        test = frame.iloc[fold.test_index]
        actual = test["result"].to_numpy()

        for half_life in HALF_LIVES:
            base_probs = {}
            base_provenance = {}
            for family in FAMILIES:
                name = f"{family}-{int(half_life)}"
                model = _fit_single(family, train, columns, half_life)
                probs = np.asarray(model.predict_proba(test[columns]), dtype=float)
                results[name][fold.season] = metrics.summarise(probs, actual)
                coverage[name][fold.season] = _provenance(model)
                base_probs[family] = probs
                base_provenance[family] = _provenance(model)

            name = f"blend-{int(half_life)}"
            probs = (base_probs["poisson"] + base_probs["elo"]) / 2.0
            probs = probs / probs.sum(axis=1, keepdims=True)
            results[name][fold.season] = metrics.summarise(probs, actual)
            coverage[name][fold.season] = {
                "enabled": True,
                "components": base_provenance,
            }

    summaries = {name: _summary(rows) for name, rows in results.items()}
    comparisons: dict[str, dict] = {}

    # Stage 1: the longer window has to beat the same family at 900d.
    admitted_window: dict[str, int] = {}
    for family in FAMILIES:
        short = f"{family}-900"
        long = f"{family}-1800"
        verdict = _paired(results[short], results[long])
        comparisons[f"{long}_vs_{short}"] = verdict
        admitted_window[family] = 1800 if verdict["beats_noise"] else 900

    # Stage 2: a family replaces the other only on paired evidence. A tie stays
    # with the simpler scheduled incumbent, Poisson.
    poisson_name = f"poisson-{admitted_window['poisson']}"
    elo_name = f"elo-{admitted_window['elo']}"
    elo_vs_poisson = _paired(results[poisson_name], results[elo_name])
    poisson_vs_elo = _paired(results[elo_name], results[poisson_name])
    comparisons[f"{elo_name}_vs_{poisson_name}"] = elo_vs_poisson
    comparisons[f"{poisson_name}_vs_{elo_name}"] = poisson_vs_elo
    if elo_vs_poisson["beats_noise"]:
        selected_single = elo_name
    else:
        selected_single = poisson_name

    # Stage 3: a blend first has to beat its better component at the SAME
    # half-life; only admitted blends may challenge the selected single.
    admitted_blends = []
    for half_life in (900, 1800):
        p = f"poisson-{half_life}"
        e = f"elo-{half_life}"
        blend = f"blend-{half_life}"
        better_base = min((p, e), key=lambda name: summaries[name]["mean_log_loss"])
        verdict = _paired(results[better_base], results[blend])
        comparisons[f"{blend}_vs_{better_base}"] = verdict
        if verdict["beats_noise"]:
            admitted_blends.append(blend)

    selected = selected_single
    selected_reason = (
        "selected single family under the predeclared paired-window/family rule")
    if admitted_blends:
        best_blend = min(admitted_blends,
                         key=lambda name: summaries[name]["mean_log_loss"])
        verdict = _paired(results[selected_single], results[best_blend])
        comparisons[f"{best_blend}_vs_{selected_single}"] = verdict
        if verdict["beats_noise"]:
            selected = best_blend
            selected_reason = (
                "equal blend cleared its component gate and then beat the "
                "selected single family beyond two standard errors")

    family, half = selected.split("-")
    half_life = float(half)

    # Final in-memory fit is not scored. It exists only to record the effective
    # groups the eventual challenger would carry when trained on all retained
    # completed matches.
    if family == "blend":
        final_provenance = {
            component: _provenance(_fit_single(component, frame, columns, half_life))
            for component in FAMILIES
        }
        train_command = (
            f"python train.py --league {league} --family ensemble "
            f"--base-families poisson elo --meta equal_blend "
            f"--half-life-days {int(half_life)} --version <version> --walk-forward")
        selected_family = "ensemble"
    else:
        final_provenance = _provenance(
            _fit_single(family, frame, columns, half_life))
        train_command = (
            f"python train.py --league {league} --family {family} "
            f"--half-life-days {int(half_life)} --version <version> --walk-forward")
        selected_family = family

    any_dropped = False
    selected_coverage = coverage[selected]
    for row in selected_coverage.values():
        if row.get("dropped_groups"):
            any_dropped = True
        for component in (row.get("components") or {}).values():
            if component.get("dropped_groups"):
                any_dropped = True

    return {
        "league": league,
        "rows": len(frame),
        "folds": [fold.season for fold in folds],
        "requested_groups": list(DEFAULT_GROUPS),
        "newcomer_transfer": NEWCOMER_TRANSFER_DEFAULT,
        "coverage_guard": {"enabled": True, "per_training_window": True},
        "summaries": summaries,
        "comparisons": comparisons,
        "selection": {
            "configuration": selected,
            "family": selected_family,
            "half_life_days": half_life,
            "reason": selected_reason,
            "admitted_window": admitted_window,
            "admitted_blends": admitted_blends,
            "coverage_dropped_in_any_selected_fold": any_dropped,
            "effective_groups_final_fit": final_provenance,
            "reproduce_challenger": train_command,
        },
        "fold_metrics": results,
        "fold_coverage": coverage,
    }


def main() -> int:
    ap = argparse.ArgumentParser()
    target = ap.add_mutually_exclusive_group(required=True)
    target.add_argument("--league", choices=sorted(LEAGUES))
    target.add_argument("--all", action="store_true")
    ap.add_argument("--min-train-seasons", type=int, default=5)
    ap.add_argument("--output", type=Path, default=None)
    args = ap.parse_args()

    leagues = list(LEAGUES) if args.all else [args.league]
    report = {
        "study": "final-guarded-model-selection",
        "predeclaration": (
            "docs/quality/investigations/"
            "2026-08-14-final-model-selection-predeclaration.md"),
        "leagues": {},
    }
    for league in leagues:
        result = evaluate_league(league, args.min_train_seasons)
        report["leagues"][league] = result
        pick = result["selection"]
        print(
            f"{league}: {pick['configuration']}  "
            f"({result['summaries'][pick['configuration']]['mean_log_loss']:.5f})")

    output = args.output or (REPORT_DIR / "final-guarded-model-selection.json")
    output.parent.mkdir(parents=True, exist_ok=True)
    output.write_text(json.dumps(report, indent=2, default=str))
    print(f"wrote {output}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
