"""Score upcoming fixtures with the current model and store the predictions.

    python predict.py --league EPL
    python predict.py --league EPL --horizon t24

Rebuilds team state from the full history every run. That is a few seconds of
work and it removes an entire class of bug: there is no incrementally-updated
cache to drift, and the features a fixture is scored on are produced by the
same code path that produced the training rows.

The feature schema comes from the ARTEFACT, never from this file's imports.
The previous version sliced the live feature frame by the current source-code
`FEATURE_NAMES` while the artefact carried its own list and was ignored; the
two agree only until somebody changes `DEFAULT_GROUPS`, which is what happens
every time an ablation keeps a family. Removing or reordering a family would
then have fed a promoted model plausible numbers in the wrong columns, and
nothing would have raised.
"""
from __future__ import annotations

import argparse
import sys
from datetime import date, datetime, timezone

import numpy as np
import pandas as pd

import confidence as confidence_mod
import explain as explain_mod
import identity as identity_mod
import market_features
import markets
from aliases import LIVE_CLUBS
from artifacts import MissingFeatureError, ModelBundle
from config import LEAGUES, season_date_bounds
from db import (current_model, insert_predictions, job, league_grading_evidence,
                load_history, load_market_snapshot, load_model_artifact,
                load_upcoming_ai_fixtures)
from db import supported_horizons as db_supported_horizons
from features import FEATURES_VERSION, FeatureBuilder

OUTCOMES = ("H", "D", "A")

# Platform team name -> canonical. Built from the same table fetch_history uses,
# so a club renamed in one place cannot silently stop matching in the other.
PLATFORM_TO_CANONICAL = {platform: canon for platform, canon, _, _ in LIVE_CLUBS}

# How far from kickoff a run is, expressed as the horizon `ai.predictions`
# stores. A 48-hour forecast and a post-team-sheet forecast are different
# predictions of the same match, and the unique index is on
# (model_id, fixture, horizon) precisely so both can exist.
#
# THE BUCKETS REACH PAST 48 HOURS BECAUSE THE UNIQUENESS KEY USES THEM. With
# `scheduled` covering everything beyond two days, a fixture eight days out was
# forecast once and every later run on better data collided with that row and was
# discarded by `on conflict do nothing`. Measured on Production on 18 August
# 2026: fifty-seven results imported at 05:55, this job ran at 09:23 with team
# state rebuilt from the full history, scored 52 fixtures across five leagues and
# wrote NOTHING — `{"written": 0, "fixtures": 12}` in every league — so this
# weekend's stored forecasts were still the ones made on the 17th, before last
# weekend had been played. ai/README.md says last Saturday reaches next
# Saturday's forecast; it did not.
#
# Six buckets across a week means roughly six forecasts of a fixture, each on
# strictly more completed football than the last, each an immutable row. It
# cannot produce a second paper bet — contract 199's advice guard keys on the
# fixture — and it cannot make a match count twice in a review, because contract
# 201's ai.canonical_fixture_predictions reduces a fixture to its newest
# forecast. It is also what finally gives contract 185's per-horizon performance
# report more than one horizon to report on.
HORIZON_BOUNDS = (("t6", 6.0), ("t24", 24.0), ("t48", 48.0),
                  ("t72", 72.0), ("t120", 120.0), ("t168", 168.0))


def horizon_for(hours_to_kickoff: float,
                supported: frozenset[str] | None = None) -> str:
    """The horizon bucket for this distance, narrowed to what the database has.

    `supported` is the installed vocabulary. A database below contract 202 does
    not accept t72, t120 or t168, and computing one for it would fail every
    insert on a check violation for as long as the promotion took — a red job
    every morning until somebody applies a migration, which is the shape of noise
    that gets a red tick ignored. The bucket then widens to the next one the
    database does hold, which reproduces the pre-202 behaviour exactly: one
    forecast per fixture until the clock reaches forty-eight hours.
    """
    for name, bound in HORIZON_BOUNDS:
        if hours_to_kickoff <= bound:
            if supported is None or name in supported:
                return name
    return "scheduled"


def _season_code(when: date) -> str:
    """August-to-May seasons: 2026-08-21 -> '2627'."""
    start = when.year if when.month >= 7 else when.year - 1
    return f"{start % 100:02d}{(start + 1) % 100:02d}"


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--league", choices=sorted(LEAGUES), required=True)
    ap.add_argument("--days-ahead", type=int, default=10)
    ap.add_argument("--horizon", default=None,
                    choices=["scheduled", "t168", "t120", "t72", "t48", "t24", "t6",
                             "lineup"],
                    help="Override the horizon derived from time to kickoff.")
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
        bundle = ModelBundle.from_payload(load_model_artifact(model_row["id"]))
        warning = bundle.features_version_warning(FEATURES_VERSION)
        if warning:
            print(f"WARNING - {warning}")

        history = load_history(league.divisions)
        builder = FeatureBuilder(top_division=league.top_division,
                                 elo_transition=bundle.elo_transition)
        builder.build_training_frame(history)   # replays state up to today

        # ai.fixtures, not public.season_fixtures. Seven of the nine leagues
        # have no competition on this platform and never will; the lab keeps
        # its own fixture list so all nine work identically.
        fixtures = load_upcoming_ai_fixtures(args.league, args.days_ahead)
        if fixtures.empty:
            print("No upcoming fixtures in window.")
            state["detail"] = {"fixtures": 0}
            return 0

        known = set(history["home_canonical"]) | set(history["away_canonical"])

        # Asked once per run, not once per fixture.
        supported_horizons = db_supported_horizons() or None
        if supported_horizons and not {"t72", "t120", "t168"} <= supported_horizons:
            print("NOTE - this database is below contract 202, so a forecast more "
                  "than 48 hours out uses the single `scheduled` bucket and a "
                  "fixture is forecast once until the clock reaches t48.")

        snapshot_at = datetime.now(timezone.utc)
        rows, feature_rows = [], []
        for rec in fixtures.itertuples(index=False):
            ko = pd.to_datetime(rec.kickoff_at)
            home, away = rec.home_canonical, rec.away_canonical
            season = str(rec.season)
            season_start, season_end = season_date_bounds(season)
            feats = builder.features_for_fixture(
                home, away, ko.date(), season, season_start, season_end)
            feature_rows.append(feats)
            hours = (ko.to_pydatetime().replace(tzinfo=timezone.utc)
                     - snapshot_at).total_seconds() / 3600.0
            rows.append({
                "fixture_id": str(rec.fixture_id),
                "season_fixture_id": (str(rec.season_fixture_id)
                                      if rec.season_fixture_id else None),
                "kickoff_at": ko.to_pydatetime(),
                "home_canonical": home,
                "away_canonical": away,
                "hours_to_kickoff": round(hours, 2),
                "horizon": args.horizon or horizon_for(hours, supported_horizons),
            })

        # --------------------------------------------------------------
        # The identity gate, before anything is scored.
        #
        # The previous version printed "WARNING - clubs with no history"
        # and wrote the prediction anyway, and that is precisely how
        # Production produced Notts County 99.659% with expected goals
        # 6.00 - 0.05 against a Leicester whose complete Championship
        # season was sitting in the history under the canonical name.
        # An identity failure is not a confidence problem to be discounted
        # downstream; it is an absence of the thing being forecast.
        #
        # A refused fixture gets NO prediction row — not a neutral one,
        # not a low-confidence one — which is what makes the value engine
        # and the accumulator structurally incapable of using it. A 99%
        # probability cannot override a data-integrity failure if the
        # probability was never written.
        # --------------------------------------------------------------
        scoreable, refused = identity_mod.partition(
            [(i, r["home_canonical"], r["away_canonical"], feature_rows[i])
             for i, r in enumerate(rows)],
            known)

        legitimate_gaps = sorted({
            n for i, _, _, feats, _ in scoreable
            for n in (rows[i]["home_canonical"], rows[i]["away_canonical"])
            if n not in known})
        if legitimate_gaps:
            # Still worth saying, and still a normal state: a promoted club, a
            # genuinely new club or a league whose history is thin. These get a
            # forecast with low data confidence, which the gate then reads.
            print("clubs with no history in this league's window — forecast "
                  "with low data confidence, not refused:\n  "
                  + "\n  ".join(legitimate_gaps))

        if refused:
            print("\nREFUSED - identity/data-integrity failure. No prediction "
                  "is written for these fixtures:")
            for i, home, away, _feats, verdict in refused:
                print(f"  {home} v {away}  {','.join(verdict.reason_codes)}")
                for side, club in verdict.to_dict()["clubs"].items():
                    if club["reason"]:
                        print(f"    {side}: '{club['name']}' is not in the "
                              f"history; it resolves to '{club['resolves_to']}'"
                              f"{' which IS in the history' if club['alias_history_available'] else ''}")
            state["detail"] = {"refused_fixtures": [
                {"home": h, "away": a, **v.to_dict()} for _i, h, a, _f, v in refused]}

        if not scoreable:
            print("\nNo fixture in the window has an intact club identity. "
                  "Run the identity repair before predicting again.")
            state["rows"] = 0
            return 1 if refused else 0

        keep = [i for i, *_ in scoreable]
        rows = [rows[i] for i in keep]
        feature_rows = [feature_rows[i] for i in keep]

        frame = pd.DataFrame(feature_rows)

        # A market-informed model needs its market block reconstructed AS OF
        # this run's snapshot instant. Without it `bundle.matrix` raises
        # MissingFeatureError and a promoted market family could be trained but
        # never scored — which is exactly the state this branch shipped in.
        market_evidence: list[dict] = [{} for _ in rows]
        if getattr(bundle.model, "uses_market", False):
            snapshot = load_market_snapshot([r["fixture_id"] for r in rows],
                                            snapshot_at)
            by_fixture = ({} if snapshot.empty
                          else snapshot.set_index("fixture_id").to_dict("index"))
            for col in market_features.PRE_MATCH_PRICE_COLUMNS:
                if col.startswith("odds_"):
                    frame[col] = [
                        by_fixture.get(r["fixture_id"], {}).get(col, np.nan)
                        for r in rows]
            market_evidence = [
                {"price_age_minutes": (
                    None if r["fixture_id"] not in by_fixture
                    else round((snapshot_at - pd.to_datetime(
                        by_fixture[r["fixture_id"]]["captured_at"]).to_pydatetime()
                        .replace(tzinfo=timezone.utc)).total_seconds() / 60.0, 1)),
                 "book_count": by_fixture.get(r["fixture_id"], {}).get("book_count"),
                 "captured_at": by_fixture.get(r["fixture_id"], {}).get("captured_at")}
                for r in rows]
            block = market_features.build_market_block(frame)
            for col in block.columns:
                frame[col] = block[col].to_numpy()
            missing_price = [i for i, e in enumerate(market_evidence)
                             if not e.get("book_count")]
            if missing_price:
                # Fail closed. A market model scoring a fixture with no price
                # would be scoring the neutral prior and calling it a
                # market-informed forecast.
                print(f"\nREFUSED - the promoted model for {args.league} is "
                      f"market-informed and {len(missing_price)} fixture(s) "
                      "carry no price at the snapshot instant. Collect prices "
                      "or promote the pure football model.")
                keep2 = [i for i in range(len(rows)) if i not in set(missing_price)]
                rows = [rows[i] for i in keep2]
                feature_rows = [feature_rows[i] for i in keep2]
                market_evidence = [market_evidence[i] for i in keep2]
                frame = frame.iloc[keep2].reset_index(drop=True)
                if not rows:
                    state["rows"] = 0
                    return 1

        try:
            X = bundle.matrix(frame)
        except MissingFeatureError as exc:
            # Loud, and fatal. A neutral substitute here would be a claim about
            # a team that nothing measured.
            raise SystemExit(str(exc)) from exc

        raw_probs, probs = bundle.predict_both(frame)
        eh, ea = bundle.model.predict_goals(X)
        grids = (bundle.model.top_scorelines(X)
                 if hasattr(bundle.model, "top_scorelines") else [None] * len(X))

        # Independent component views, when the promoted model is an ensemble.
        # Agreement is only meaningful between models that can disagree.
        base_views = (bundle.model.base_probabilities(frame)
                      if hasattr(bundle.model, "base_probabilities") else {})
        league_evidence = league_grading_evidence(args.league)
        league_evidence["calibration_rows"] = (
            (bundle.metadata.get("calibration") or {}).get("describe", {}) or {}
        ).get("n_fit")

        payload = []
        for i, base in enumerate(rows):
            p = probs[i]
            pick = OUTCOMES[int(np.argmax(p))]
            grid = grids[i]
            per_model = {f: v[i] for f, v in base_views.items()}
            agreement = confidence_mod.model_agreement(
                {f: [v] for f, v in per_model.items()})
            uncertainty = confidence_mod.probability_uncertainty(
                [p], {f: [v] for f, v in per_model.items()},
                fold_error=bundle.metadata.get("fold_probability_se"),
                n_calibration=league_evidence.get("calibration_rows"))
            data_conf = confidence_mod.data_confidence(
                features=feature_rows[i],
                league_evidence=league_evidence,
                market_evidence=market_evidence[i] or None,
                agreement=agreement,
                # Deterministic, and never speculative: a required input is one
                # the PROMOTED model actually needs. Optional or unproven data
                # is not "pending", it is absent, and calling it pending would
                # turn every ordinary forecast into a refusal.
                missing_inputs=confidence_mod.required_inputs_missing(
                    features=feature_rows[i],
                    market_evidence=market_evidence[i],
                    uses_market=bool(getattr(bundle.model, "uses_market", False))))
            payload.append({
                **base,
                "model_id": model_row["id"],
                "league": args.league,
                "raw_match_id": None,
                "p_home": round(float(p[0]), 5),
                "p_draw": round(float(p[1]), 5),
                "p_away": round(float(p[2]), 5),
                "p_home_raw": round(float(raw_probs[i][0]), 5),
                "p_draw_raw": round(float(raw_probs[i][1]), 5),
                "p_away_raw": round(float(raw_probs[i][2]), 5),
                "exp_home_goals": None if np.isnan(eh[i]) else round(float(eh[i]), 3),
                "exp_away_goals": None if np.isnan(ea[i]) else round(float(ea[i]), 3),
                "predicted_result": pick,
                "predicted_score": max(grid, key=grid.get) if grid else None,
                "scoreline_grid": grid,
                "features": feature_rows[i],
                "features_version": FEATURES_VERSION,
                "data_snapshot_at": snapshot_at,
                "uses_market": bool(getattr(bundle.model, "uses_market", False)),
                # Every scoreline-derived market in one document. Stored
                # together because they share one source of error.
                "market_probabilities": (
                    markets.price_all(bundle.model.scoreline_grid(X.iloc[[i]]))[0]
                    if hasattr(bundle.model, "scoreline_grid") else None),
                "model_views": {f: [round(float(v), 5) for v in vals]
                                for f, vals in per_model.items()} or None,
                "agreement": agreement,
                "data_confidence": data_conf,
                "uncertainty": uncertainty,
                "explanation": explain_mod.explain_prediction(
                    bundle, frame.iloc[[i]], feature_rows[i],
                    probs=p, raw_probs=raw_probs[i], base_views=per_model,
                    agreement=agreement, data_confidence=data_conf,
                    uncertainty=uncertainty),
            })

        for r in payload:
            print(f"{r['kickoff_at']:%a %d %b %H:%M}  {r['home_canonical']:>18} v "
                  f"{r['away_canonical']:<18}  {r['p_home']:.0%} / {r['p_draw']:.0%} / "
                  f"{r['p_away']:.0%}   {r['predicted_score'] or ''}"
                  f"   [{r['data_confidence']['state']}"
                  f", {r['agreement'].get('state', 'single model')}]")

        if args.dry_run:
            print("\n--dry-run: nothing written")
            return 0

        written = insert_predictions(payload)
        state["rows"] = written
        state["detail"] = {"fixtures": len(payload), "written": written,
                           "model_version": model_row["version"],
                           "features_version": FEATURES_VERSION}
        print(f"\nwrote {written} new predictions "
              f"({len(payload) - written} already existed)")
    return 0


if __name__ == "__main__":
    sys.exit(main())
