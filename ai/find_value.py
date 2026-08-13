"""Join today's model probabilities to today's prices and record the decisions.

    python find_value.py --league EPL --dry-run

Writes ai.bets rows for the selections that survive the gate, all flagged
is_paper=true until you deliberately say otherwise — and writes an
ai.recommendations row for EVERY candidate, including the ones it refused.

The refusals are the point. "Edge exceeds 3%, therefore selection" fires on a
four-day-old price, on a club with four matches of history, and on a fixture
where three independent models are spread from 51% to 82%. None of those is a
bet, and until now none of them left any trace: a run that found nothing wrote
nothing and looked exactly like a run that failed.

Every selection still carries its edge decomposed into the part that is your
model disagreeing with the consensus and the part that is simply taking the
best price on offer. Those two numbers mean completely different things and the
second one is not evidence of anything about your model.
"""
from __future__ import annotations

import argparse
import sys
from datetime import datetime, timezone

import numpy as np
import pandas as pd

import betting
import value_engine
from config import LEAGUES, OUTCOMES
from db import connect, insert_recommendations, job, query_df

# Which book to record the bet against. AVG and MAX are aggregates: the
# database will only accept them on paper bets, which is the point.
DEFAULT_BOOK = "MAX"


def load_candidates(league_key: str, book: str) -> pd.DataFrame:
    """Predictions for upcoming fixtures, joined to the latest captured price.

    `captured_at` travels with the price. It was selected away before — the
    query took the newest row per bookmaker and then dropped the timestamp that
    said how new "newest" actually was — so a price captured on Tuesday and a
    price captured ninety seconds ago arrived here indistinguishable.
    """
    return query_df(
        """
        with latest as (
          -- Joined on fixture_id, not on a reconstructed (date, home, away) key.
          -- The old date join used `kickoff_at at time zone 'UTC'`, which put a
          -- 20:00 BST kick-off on the wrong date and quietly dropped the price.
          select distinct on (fo.fixture_id, fo.bookmaker) fo.*
            from ai.fixture_odds fo
           where fo.bookmaker = any(%s) and fo.fixture_id is not null
           order by fo.fixture_id, fo.bookmaker, fo.captured_at desc
        )
        select p.id as prediction_id, p.model_id, p.league,
               p.fixture_id, p.season_fixture_id,
               p.kickoff_at, p.home_canonical, p.away_canonical,
               p.p_home, p.p_draw, p.p_away,
               p.data_confidence, p.agreement, p.uncertainty,
               b.odds_h as best_h, b.odds_d as best_d, b.odds_a as best_a,
               b.captured_at as best_captured_at,
               a.odds_h as avg_h,  a.odds_d as avg_d,  a.odds_a as avg_a,
               a.captured_at as avg_captured_at
          from ai.valid_predictions p
          join ai.fixtures f on f.id = p.fixture_id
          left join latest b on b.fixture_id = p.fixture_id and b.bookmaker = %s
          left join latest a on a.fixture_id = p.fixture_id and a.bookmaker = 'AVG'
         where p.league = %s
           and f.status = 'scheduled'
           and p.kickoff_at > now()
           and b.odds_h is not null
           and not exists (select 1 from ai.bets x
                            where x.prediction_id = p.id and x.market = '1X2')
         order by p.kickoff_at
        """,
        ([book, "AVG"], book, league_key),
    )


def _as_dict(value) -> dict:
    """jsonb comes back as a dict; a missing column comes back as None."""
    if isinstance(value, dict):
        return value
    return {}


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--league", choices=sorted(LEAGUES), required=True)
    ap.add_argument("--book", default=DEFAULT_BOOK)
    ap.add_argument("--min-edge", type=float, default=0.03)
    ap.add_argument("--min-data-confidence", type=float, default=0.55)
    ap.add_argument("--devig", default="shin", choices=sorted(betting.DEVIG))
    ap.add_argument("--real-money", action="store_true",
                    help="Record as a real bet rather than paper. Requires a "
                         "bettable book; aggregates are rejected by the database.")
    ap.add_argument("--dry-run", action="store_true")
    args = ap.parse_args()

    gate = value_engine.ValueGate(value_engine.ValueThresholds(
        min_edge=args.min_edge, min_data_confidence=args.min_data_confidence))

    with job("find_value", args.league) as state:
        df = load_candidates(args.league, args.book)
        if df.empty:
            print("No priced fixtures with an unbet prediction.")
            state["detail"] = {"candidates": 0}
            return 0

        probs = df[["p_home", "p_draw", "p_away"]].astype(float).values
        best = df[["best_h", "best_d", "best_a"]].astype(float).values
        has_avg = df[["avg_h", "avg_d", "avg_a"]].notna().all(axis=1).values
        avg = df[["avg_h", "avg_d", "avg_a"]].astype(float).values

        # Market's own view, de-vigged from the average book where available.
        fair = np.full_like(probs, np.nan)
        if has_avg.any():
            fair[has_avg] = betting.fair_probabilities(avg[has_avg], args.devig)

        now = datetime.now(timezone.utc)
        assessed: list[tuple[int, int, value_engine.Recommendation]] = []

        for i in range(len(df)):
            ko = pd.to_datetime(df["kickoff_at"].iloc[i]).to_pydatetime()
            if ko.tzinfo is None:
                ko = ko.replace(tzinfo=timezone.utc)
            hours = (ko - now).total_seconds() / 3600.0
            captured = df["best_captured_at"].iloc[i]
            captured = (pd.to_datetime(captured).to_pydatetime()
                        if captured is not None and not pd.isna(captured) else None)

            # Every outcome is assessed, and the best surviving one is taken.
            # Assessing only the argmax would hide the reason the others were
            # refused, and the reasons are the output.
            per_outcome = []
            for j, outcome in enumerate(OUTCOMES):
                candidate = value_engine.Candidate(
                    selection=outcome,
                    calibrated_prob=float(probs[i, j]),
                    odds=float(best[i, j]),
                    bookmaker=args.book,
                    hours_to_kickoff=hours,
                    captured_at=captured,
                    market_fair_prob=(float(fair[i, j]) if has_avg[i] else None),
                    data_confidence=_as_dict(df["data_confidence"].iloc[i]),
                    agreement=_as_dict(df["agreement"].iloc[i]),
                    uncertainty=_as_dict(df["uncertainty"].iloc[i]),
                    # The deterministic missing-input authority, recorded with
                    # the prediction by `confidence.required_inputs_missing`
                    # and carried here rather than re-derived. `Candidate.
                    # missing_inputs` and `PASS_INPUT_PENDING` existed from the
                    # start and nothing had ever populated them, so the first
                    # gate in the sequence was permanently inert.
                    missing_inputs=list(
                        _as_dict(df["data_confidence"].iloc[i]).get(
                            "missing_inputs") or []),
                    is_paper=not args.real_money,
                )
                per_outcome.append((j, gate.assess(candidate, now)))

            bets = [(j, r) for j, r in per_outcome if r.is_bet]
            if bets:
                j, rec = max(bets, key=lambda pair: pair[1].expected_value)
            else:
                # Record the closest miss rather than three refusals per
                # fixture: one decision per (fixture, market) keeps the log
                # readable, and the codes on it are the ones that stopped the
                # best available candidate.
                j, rec = max(per_outcome,
                             key=lambda pair: (pair[1].expected_value or -np.inf))
            assessed.append((i, j, rec))

        counts = value_engine.summarise_reasons([r for _, _, r in assessed])
        bet_rows, rec_rows = [], []
        for i, j, rec in assessed:
            ko = pd.to_datetime(df["kickoff_at"].iloc[i]).to_pydatetime()
            if ko.tzinfo is None:
                ko = ko.replace(tzinfo=timezone.utc)
            hours = round((ko - now).total_seconds() / 3600, 2)
            conf = _as_dict(df["data_confidence"].iloc[i])
            agree = _as_dict(df["agreement"].iloc[i])

            rec_rows.append({
                "prediction_id": df["prediction_id"].iloc[i],
                "model_id": df["model_id"].iloc[i],
                "league": args.league,
                "market": "1X2",
                "selection": OUTCOMES[j],
                "kickoff_at": ko,
                "hours_to_kickoff": hours,
                "decision": rec.decision,
                "reason_codes": rec.reason_codes,
                "bookmaker": args.book,
                "odds_offered": round(float(best[i, j]), 3),
                "odds_captured_at": rec.evidence.get("price_captured_at"),
                "odds_age_seconds": rec.evidence.get("price_age_seconds"),
                "calibrated_prob": round(float(probs[i, j]), 5),
                "fair_odds": (round(rec.fair_odds, 3) if rec.fair_odds else None),
                "expected_value": round(float(rec.expected_value), 5),
                "data_confidence": conf.get("score"),
                "data_confidence_state": conf.get("state"),
                "agreement_score": agree.get("score"),
                "uncertainty_width": rec.evidence.get("uncertainty_width"),
                "evidence": rec.evidence,
            })

            if not rec.is_bet:
                continue

            o_best = float(best[i, j])
            o_avg = float(avg[i, j]) if has_avg[i] else None
            p = float(probs[i, j])
            bet_rows.append({
                "prediction_id": df["prediction_id"].iloc[i],
                "model_id": df["model_id"].iloc[i],
                "league": args.league,
                "fixture_id": df["fixture_id"].iloc[i],
                "season_fixture_id": df["season_fixture_id"].iloc[i],
                "selection": OUTCOMES[j],
                "kickoff_at": ko,
                "hours_to_kickoff": hours,
                "bookmaker": args.book,
                "odds_taken": round(o_best, 3),
                "odds_average_at_advice": round(o_avg, 3) if o_avg else None,
                "odds_best_at_advice": round(o_best, 3),
                "model_prob": round(p, 5),
                "market_fair_prob": (round(float(fair[i, j]), 5)
                                     if has_avg[i] else None),
                "devig_method": args.devig,
                "edge": round(float(rec.expected_value), 5),
                "edge_vs_average": (round(float(betting.expected_value(p, o_avg)), 5)
                                    if o_avg else None),
                "edge_line_shopping": (round(o_best / o_avg - 1.0, 5) if o_avg else None),
                "staking_rule": "quarter_kelly_cap2",
                "stake_fraction": round(rec.stake_fraction, 5),
                "stake_units": round(rec.stake_fraction * 100, 4),
                "is_paper": not args.real_money,
            })

        print(f"{len(bet_rows)} selections from {len(df)} priced fixtures "
              f"({len(bet_rows)/len(df):.0%})\n")
        for row, (i, j, rec) in zip(rec_rows, assessed):
            home = df["home_canonical"].iloc[i]
            away = df["away_canonical"].iloc[i]
            head = (f"  {row['kickoff_at']:%a %d %b %H:%M}  {home:>18} v {away:<18} "
                    f"{row['selection']} @ {row['odds_offered']:>5.2f}  "
                    f"model {row['calibrated_prob']:.0%}  "
                    f"edge {row['expected_value']:+.1%}")
            if rec.is_bet:
                print(head + "   BET")
            else:
                print(head + "   PASS " + ", ".join(rec.reason_codes))

        if not bet_rows:
            print("\nNo selections currently pass the threshold. That is an "
                  "answer, not a failure.")
        print("\ngate summary: " + ", ".join(f"{k}={v}" for k, v in sorted(counts.items())))

        if bet_rows:
            model_part = np.mean([r["edge_vs_average"] for r in bet_rows
                                  if r["edge_vs_average"] is not None] or [np.nan])
            shop_part = np.mean([r["edge_line_shopping"] for r in bet_rows
                                 if r["edge_line_shopping"] is not None] or [np.nan])
            print(f"\n  mean edge attributable to the MODEL:        {model_part:+.2%}")
            print(f"  mean edge attributable to LINE SHOPPING:    {shop_part:+.2%}")
            if np.isfinite(shop_part) and np.isfinite(model_part) and shop_part > model_part:
                print("  -> most of today's 'value' is price shopping, not the model.")

        if args.dry_run:
            print("\n--dry-run: nothing written")
            state["detail"] = {"candidates": len(df), "bets": len(bet_rows),
                               "reason_codes": counts}
            return 0

        recorded = insert_recommendations(rec_rows)

        if bet_rows:
            cols = ["prediction_id", "model_id", "league", "fixture_id",
                    "season_fixture_id", "selection",
                    "kickoff_at", "hours_to_kickoff", "bookmaker", "odds_taken",
                    "odds_average_at_advice", "odds_best_at_advice", "model_prob",
                    "market_fair_prob", "devig_method", "edge", "edge_vs_average",
                    "edge_line_shopping", "staking_rule", "stake_fraction",
                    "stake_units", "is_paper"]
            sql = (f"insert into ai.bets ({','.join(cols)}) "
                   f"values ({','.join(['%s'] * len(cols))}) on conflict do nothing")
            with connect() as conn:
                with conn.cursor() as cur:
                    cur.executemany(sql, [tuple(r[c] for c in cols) for r in bet_rows])
                conn.commit()

        state["rows"] = len(bet_rows)
        state["detail"] = {"candidates": len(df), "bets": len(bet_rows),
                           "recommendations": recorded, "reason_codes": counts}
        print(f"\nrecorded {len(bet_rows)} {'real' if args.real_money else 'paper'} "
              f"bets and {recorded} decisions")
    return 0


if __name__ == "__main__":
    sys.exit(main())
