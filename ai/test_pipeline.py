"""Offline verification. No database, no network.

Generates synthetic leagues from known team strengths, then checks that:
  1. the feature builder never sees the match it is describing, or same-day ones
  2. the models beat the base-rate baseline on a chronological holdout
  3. recovered probabilities are calibrated against the generating process
  4. a shuffled target destroys the signal (i.e. the gains are not leakage)

Run:  python test_pipeline.py
"""
from __future__ import annotations

from datetime import date, timedelta

import numpy as np
import pandas as pd

import metrics
from config import season_date_bounds
from features import FEATURE_NAMES, FeatureBuilder
from model_zoo import MODEL_FAMILIES

RNG = np.random.default_rng(20280611)
CLUBS = [f"Club {chr(65 + i)}" for i in range(20)]
HOME_ADV = 0.30


def test_season_bounds_are_full_year_not_prediction_window() -> None:
    start, end = season_date_bounds("2627")
    assert start == date(2026, 7, 1) and end == date(2027, 6, 30)
    september = (date(2026, 9, 5) - start).days / (end - start).days
    assert 0.15 < september < 0.25


def simulate(seasons: list[str], start_year: int = 2015) -> pd.DataFrame:
    """A league where each club has a latent attack/defence strength that drifts
    slowly between seasons. Goals are Poisson. This is a generous world — real
    football has more noise — but if the pipeline cannot recover signal here,
    it certainly cannot recover it from real results."""
    attack = {c: RNG.normal(0, 0.32) for c in CLUBS}
    defence = {c: RNG.normal(0, 0.26) for c in CLUBS}
    rows = []
    for si, season in enumerate(seasons):
        for c in CLUBS:
            attack[c] += RNG.normal(0, 0.09)
            defence[c] += RNG.normal(0, 0.08)
        season_start = date(start_year + si, 8, 10)
        fixtures = [(h, a) for h in CLUBS for a in CLUBS if h != a]
        RNG.shuffle(fixtures)
        # 38 rounds of 10 matches, one round every 7 days, two matches per day
        for r, chunk in enumerate([fixtures[i:i + 10] for i in range(0, 380, 10)]):
            when = season_start + timedelta(days=7 * r)
            for j, (h, a) in enumerate(chunk):
                d = when + timedelta(days=j % 2)
                lh = np.exp(0.15 + HOME_ADV + attack[h] - defence[a])
                la = np.exp(0.15 + attack[a] - defence[h])
                hg, ag = RNG.poisson(lh), RNG.poisson(la)
                rows.append({
                    "match_date": d, "season": season, "division": "E0",
                    "home_canonical": h, "away_canonical": a,
                    "home_goals": int(hg), "away_goals": int(ag),
                    "result": "H" if hg > ag else ("D" if hg == ag else "A"),
                })
    return pd.DataFrame(rows).sort_values("match_date").reset_index(drop=True)


def check_no_self_or_sameday_leakage() -> None:
    """A club's very first match must show zero prior matches, and a club
    playing twice on one day must not see the first game in the second."""
    df = pd.DataFrame([
        # Two matches for Alpha on the same day, then one later.
        {"match_date": date(2026, 8, 1), "season": "2627", "division": "E0",
         "home_canonical": "Alpha", "away_canonical": "Beta",
         "home_goals": 5, "away_goals": 0, "result": "H"},
        {"match_date": date(2026, 8, 1), "season": "2627", "division": "E0",
         "home_canonical": "Alpha", "away_canonical": "Gamma",
         "home_goals": 4, "away_goals": 0, "result": "H"},
        {"match_date": date(2026, 8, 8), "season": "2627", "division": "E0",
         "home_canonical": "Alpha", "away_canonical": "Delta",
         "home_goals": 1, "away_goals": 1, "result": "D"},
    ])
    out = FeatureBuilder("E0").build_training_frame(df)

    first, second, third = out.iloc[0], out.iloc[1], out.iloc[2]
    assert first["home_matches_known"] == 0, "match 1 saw prior history that does not exist"
    assert second["home_matches_known"] == 0, "same-day match 2 saw match 1 — LEAKAGE"
    assert first["elo_home"] == second["elo_home"], "Elo updated within the same day — LEAKAGE"
    assert third["home_matches_known"] == 2, "later match did not see the two earlier ones"
    assert third["elo_home"] > first["elo_home"], "two 5-0 wins did not raise Elo"
    print("  [pass] no self-leakage; same-day matches are blind to each other")


def check_features_are_finite(frame: pd.DataFrame) -> None:
    X = frame[FEATURE_NAMES]
    assert not X.isna().any().any(), f"NaN features: {X.columns[X.isna().any()].tolist()}"
    assert np.isfinite(X.values).all(), "non-finite feature values"
    print(f"  [pass] {len(FEATURE_NAMES)} features, all finite, {len(frame)} rows")


def evaluate_models(frame: pd.DataFrame, shuffle_target: bool = False) -> dict:
    seasons = sorted(frame["season"].unique())
    val_seasons = seasons[-2:]
    train = frame[~frame["season"].isin(val_seasons)]
    val = frame[frame["season"].isin(val_seasons)]

    y_train = train["result"].copy()
    if shuffle_target:
        y_train = pd.Series(RNG.permutation(y_train.values), index=y_train.index)

    out = {}
    for name in ("baseline", "logistic", "poisson"):
        m = MODEL_FAMILIES[name]()
        if name == "poisson":
            hg, ag = train["home_goals"], train["away_goals"]
            if shuffle_target:
                perm = RNG.permutation(len(train))
                hg, ag = hg.values[perm], ag.values[perm]
            m.fit(train[FEATURE_NAMES], y_train, home_goals=hg, away_goals=ag)
        else:
            m.fit(train[FEATURE_NAMES], y_train)
        probs = m.predict_proba(val[FEATURE_NAMES])
        out[name] = metrics.summarise(probs, val["result"].values) | {
            "ece": metrics.calibration_error(probs, val["result"].values),
            "probs": probs,
        }
    out["_val"] = val
    return out


def main() -> None:
    print("1. leakage guards")
    check_no_self_or_sameday_leakage()

    print("\n2. building features from 10 synthetic seasons")
    seasons = [f"{y % 100:02d}{(y + 1) % 100:02d}" for y in range(2015, 2025)]
    raw = simulate(seasons)
    frame = FeatureBuilder("E0").build_training_frame(raw)
    frame = frame[frame["home_matches_known"] + frame["away_matches_known"] >= 6]
    check_features_are_finite(frame)

    print("\n3. chronological holdout (last 2 seasons)")
    res = evaluate_models(frame)
    print(f"  {'':10}{'acc':>8}{'log loss':>11}{'rps':>9}{'ece':>9}")
    for name in ("baseline", "logistic", "poisson"):
        r = res[name]
        print(f"  {name:10}{r['accuracy']:>8.3f}{r['log_loss']:>11.4f}"
              f"{r['rps']:>9.4f}{r['ece']:>9.4f}")

    base_ll = res["baseline"]["log_loss"]
    for name in ("logistic", "poisson"):
        assert res[name]["log_loss"] < base_ll, f"{name} did not beat the baseline"
    print("  [pass] both models beat the base-rate baseline on log loss")

    for name in ("logistic", "poisson"):
        assert res[name]["ece"] < 0.05, f"{name} is poorly calibrated (ECE {res[name]['ece']:.3f})"
    print("  [pass] both models are calibrated within 5 percentage points")

    print("\n4. calibration of the Poisson model")
    val = res["_val"]
    for row in metrics.calibration_table(res["poisson"]["probs"], val["result"].values):
        print(f"  {row['min_conf']:.2f}-{row['max_conf']:.2f}  n={row['n']:>4}  "
              f"predicted {row['mean_predicted']:.3f}  actual {row['actual_rate']:.3f}  "
              f"gap {row['gap']:+.3f}")

    print("\n5. negative control: shuffled training target")
    shuffled = evaluate_models(frame, shuffle_target=True)
    print(f"  logistic log loss on shuffled labels: {shuffled['logistic']['log_loss']:.4f} "
          f"(baseline {base_ll:.4f})")
    assert shuffled["logistic"]["log_loss"] > res["logistic"]["log_loss"] + 0.02, (
        "shuffling the target barely hurt — the gains were not coming from the features")
    print("  [pass] signal disappears when the target is shuffled, so it was real")

    print("\nALL CHECKS PASSED")


if __name__ == "__main__":
    main()
