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
from config import (FIRST_SEASON, SEASONS, current_season, season_date_bounds,
                    seasons_from)
from features import (FEATURE_NAMES, NEUTRAL_SOT, SOURCE_COLUMNS,
                      FeatureBuilder)
from model_zoo import MODEL_FAMILIES

RNG = np.random.default_rng(20280611)
CLUBS = [f"Club {chr(65 + i)}" for i in range(20)]
HOME_ADV = 0.30


def test_season_bounds_are_full_year_not_prediction_window() -> None:
    start, end = season_date_bounds("2627")
    assert start == date(2026, 7, 1) and end == date(2027, 6, 30)
    september = (date(2026, 9, 5) - start).days / (end - start).days
    assert 0.15 < september < 0.25


def test_current_season_turns_over_on_the_first_of_july() -> None:
    """The season the daily import asks for must follow the calendar.

    The import is the only thing that brings a new result into the lab, and a
    frozen season code fails silently: the finished season's file still
    answers 200, the row count still looks healthy and the job still records
    success, while nothing is ever graded or settled again. 1 July is the same
    boundary `season_date_bounds` uses, so both agree about which season a
    date belongs to.
    """
    assert current_season(date(2027, 6, 30)) == "2627"
    assert current_season(date(2027, 7, 1)) == "2728"
    assert current_season(date(2027, 12, 31)) == "2728"
    assert current_season(date(2028, 1, 1)) == "2728"

    for day in (date(2026, 8, 12), date(2027, 7, 1), date(2030, 3, 4)):
        start, end = season_date_bounds(current_season(day))
        assert start <= day <= end


def test_season_list_reaches_the_current_season() -> None:
    """The list is derived, and still starts where the evidence starts."""
    assert SEASONS[0] == FIRST_SEASON
    assert SEASONS[-1] == current_season()
    assert len(set(SEASONS)) == len(SEASONS)
    assert seasons_from("2526", date(2028, 9, 1)) == ("2526", "2627", "2728", "2829")


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


def test_shot_features_are_leak_safe_and_honest_about_gaps() -> None:
    """Shots on target must obey the same walls as everything else.

    Two failure modes are being pinned. A match must not see its own shots —
    the same wall the goal features already have. And a missing shot count
    must read as `unmeasured`, never as `created nothing`: the National League
    carries shots for 29.5% of its matches, so a zero-fill would tell the
    model that two thirds of that division never troubled a keeper.
    """
    rows = [
        {"match_date": date(2026, 8, 1), "season": "2627", "division": "E0",
         "home_canonical": "Alpha", "away_canonical": "Beta",
         "home_goals": 1, "away_goals": 0, "result": "H",
         "home_shots_ot": 9, "away_shots_ot": 2},
        {"match_date": date(2026, 8, 8), "season": "2627", "division": "E0",
         "home_canonical": "Alpha", "away_canonical": "Gamma",
         "home_goals": 0, "away_goals": 0, "result": "D",
         "home_shots_ot": None, "away_shots_ot": None},
        {"match_date": date(2026, 8, 15), "season": "2627", "division": "E0",
         "home_canonical": "Alpha", "away_canonical": "Delta",
         "home_goals": 2, "away_goals": 1, "result": "H",
         "home_shots_ot": 7, "away_shots_ot": 3},
    ]
    out = FeatureBuilder("E0").build_training_frame(pd.DataFrame(rows))
    first, second, third = out.iloc[0], out.iloc[1], out.iloc[2]

    assert first["home_sot_known"] == 0.0, "a club's first match saw shot history"
    assert first["home_form5_sot_f"] == NEUTRAL_SOT, (
        "an unmeasured window must fall back to the neutral prior, not zero")

    # After one measured match: 9 for, 2 against, and it is fully measured.
    assert second["home_form5_sot_f"] == 9.0 and second["home_form5_sot_a"] == 2.0
    assert second["home_sot_known"] == 1.0
    assert second["home_sot_ratio"] > 0.8, "9-2 on target is not a balanced game"

    # The second match had no shot data. Two matches played, one measured.
    assert third["home_sot_known"] == 0.5, (
        "a match with no shot data must lower `known`, not the shot average")
    assert third["home_form5_sot_f"] == 9.0, (
        "an unmeasured match dragged the average down — it was counted as zero")
    print("  [pass] shots are leak-safe, and a gap reads as unmeasured not zero")


def test_the_loader_supplies_every_column_the_builder_reads() -> None:
    """The bug that made the shot features inert, caught structurally.

    `load_history` selected goals, reds, odds and market probabilities and no
    shot columns, so `home_shots_ot` was absent from every row and every
    window fell back to the neutral prior. Nothing raised. The models trained
    and the metrics printed; the only symptom was a change that should have
    moved log loss not moving it, which is indistinguishable from the feature
    being useless.

    Reading the loader's own SQL is deliberate. A test that asked the database
    would need one, and would then pass on any environment where the columns
    happened to exist while the shipped query still omitted them.
    """
    import re
    from pathlib import Path

    source = Path(__file__).with_name("db.py").read_text()
    match = re.search(r"def load_history.*?\"\"\"(.*?)\"\"\"", source, re.S)
    assert match, "load_history no longer contains a single SQL literal"
    projection = match.group(1).split(" from ")[0]

    selected = set(re.findall(r"[a-z_][a-z0-9_]*", projection))
    missing = sorted(c for c in SOURCE_COLUMNS if c not in selected)
    assert not missing, (
        f"features.py reads {missing} but load_history does not select them. "
        "They would silently arrive as missing values in every row.")


def test_a_club_is_seeded_at_the_level_it_first_appears() -> None:
    """`ELO_DIVISION_OFFSET` was defined and never read.

    The constant appeared exactly once in features.py — at its own definition
    — so every club entered the pool at 1500 no matter which division it
    entered from, and a League Two side was rated identically to a Premier
    League side on arrival. By the table's own numbers that is a 430-point
    error.
    """
    def first_row(division: str):
        df = pd.DataFrame([{
            "match_date": date(2026, 8, 1), "season": "2627", "division": division,
            "home_canonical": "New Home", "away_canonical": "New Away",
            "home_goals": 1, "away_goals": 1, "result": "D",
        }])
        return FeatureBuilder(division).build_training_frame(df).iloc[0]

    top = first_row("E0")
    bottom = first_row("E3")

    assert top["elo_home"] == 1500.0, "a top-flight newcomer should start at the mean"
    assert bottom["elo_home"] == 1500.0 - 430.0, (
        "a League Two newcomer was seeded as if it were a Premier League club")
    assert bottom["elo_home"] < top["elo_home"] - 400
    print("  [pass] a first-seen club is seeded at its own division's level")


def test_time_weights_halve_over_the_half_life() -> None:
    """The decay must be the thing it claims to be, and switchable off."""
    import train as trainer

    dates = pd.Series([date(2024, 2, 26), date(2026, 8, 13)])   # ~900 days apart
    w = trainer.time_weights(dates, 900.0)
    assert abs(float(w[0] / w[1]) - 0.5) < 0.02, "a half-life did not halve the weight"
    assert abs(float(np.mean(w)) - 1.0) < 1e-9, (
        "weights are not mean-normalised, so alpha's meaning would drift")
    assert trainer.time_weights(dates, 0) is None, "0 must restore equal weighting"
    print("  [pass] time decay halves over its half-life and can be disabled")


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
    test_shot_features_are_leak_safe_and_honest_about_gaps()
    test_the_loader_supplies_every_column_the_builder_reads()
    test_a_club_is_seeded_at_the_level_it_first_appears()
    test_time_weights_halve_over_the_half_life()

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


def test_modelling_guards() -> None:
    """Run every check above under pytest, which is what CI collects.

    Without this entry point the leakage guard, the beats-baseline assertion,
    the calibration bound and the shuffled-target negative control ran only
    when a human remembered to type `python test_pipeline.py`. They are the
    guards that decide whether a model is allowed to be believed, so CI has to
    be the thing that runs them.
    """
    main()


if __name__ == "__main__":
    main()
