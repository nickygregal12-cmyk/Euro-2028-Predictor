"""Join today's model probabilities to today's prices and record selections.

    python find_value.py --league EPL --dry-run

Writes ai.bets rows, all flagged is_paper=true until you deliberately say
otherwise. Every selection carries its edge decomposed into the part that is
your model disagreeing with the consensus and the part that is simply taking
the best price on offer. Those two numbers mean completely different things and
the second one is not evidence of anything about your model.
"""
from __future__ import annotations

import argparse
import sys
from datetime import datetime, timezone

import numpy as np
import pandas as pd

import betting
from config import LEAGUES, OUTCOMES
from db import connect, job, query_df

# Which book to record the bet against. AVG and MAX are aggregates: the
# database will only accept them on paper bets, which is the point.
DEFAULT_BOOK = "MAX"


def load_candidates(league_key: str, book: str) -> pd.DataFrame:
    """Predictions for upcoming fixtures, joined to the latest captured price."""
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
               b.odds_h as best_h, b.odds_d as best_d, b.odds_a as best_a,
               a.odds_h as avg_h,  a.odds_d as avg_d,  a.odds_a as avg_a
          from ai.predictions p
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


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--league", choices=sorted(LEAGUES), required=True)
    ap.add_argument("--book", default=DEFAULT_BOOK)
    ap.add_argument("--min-edge", type=float, default=0.03)
    ap.add_argument("--devig", default="shin", choices=sorted(betting.DEVIG))
    ap.add_argument("--real-money", action="store_true",
                    help="Record as a real bet rather than paper. Requires a "
                         "bettable book; aggregates are rejected by the database.")
    ap.add_argument("--dry-run", action="store_true")
    args = ap.parse_args()

    rule = betting.SelectionRule(min_edge=args.min_edge)

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

        mask = rule.select(probs, best)
        ev = np.where(mask, betting.expected_value(probs, best), -np.inf)
        leg = ev.argmax(axis=1)
        picked = np.isfinite(ev.max(axis=1)) & (ev.max(axis=1) > -np.inf)

        # Market's own view, de-vigged from the average book where available.
        fair = np.full_like(probs, np.nan)
        if has_avg.any():
            fair[has_avg] = betting.fair_probabilities(avg[has_avg], args.devig)

        now = datetime.now(timezone.utc)
        rows = []
        for i in np.flatnonzero(picked):
            j = int(leg[i])
            o_best = float(best[i, j])
            o_avg = float(avg[i, j]) if has_avg[i] else None
            p = float(probs[i, j])
            ko = pd.to_datetime(df["kickoff_at"].iloc[i]).to_pydatetime()
            edge = betting.expected_value(p, o_best)
            stake_f = float(betting.fractional_kelly(
                p, o_best, rule.kelly_fraction, rule.max_stake_fraction))
            rows.append({
                "prediction_id": df["prediction_id"].iloc[i],
                "model_id": df["model_id"].iloc[i],
                "league": args.league,
                "fixture_id": df["fixture_id"].iloc[i],
                "season_fixture_id": df["season_fixture_id"].iloc[i],
                "selection": OUTCOMES[j],
                "kickoff_at": ko,
                "hours_to_kickoff": round((ko - now).total_seconds() / 3600, 2),
                "bookmaker": args.book,
                "odds_taken": round(o_best, 3),
                "odds_average_at_advice": round(o_avg, 3) if o_avg else None,
                "odds_best_at_advice": round(o_best, 3),
                "model_prob": round(p, 5),
                "market_fair_prob": (round(float(fair[i, j]), 5)
                                     if has_avg[i] else None),
                "devig_method": args.devig,
                "edge": round(float(edge), 5),
                "edge_vs_average": (round(float(betting.expected_value(p, o_avg)), 5)
                                    if o_avg else None),
                "edge_line_shopping": (round(o_best / o_avg - 1.0, 5) if o_avg else None),
                "staking_rule": "quarter_kelly_cap2",
                "stake_fraction": round(stake_f, 5),
                "stake_units": round(stake_f * 100, 4),   # units per 100 of bankroll
                "is_paper": not args.real_money,
            })

        print(f"{len(rows)} selections from {len(df)} priced fixtures "
              f"({len(rows)/len(df):.0%})\n")
        for idx, r in zip(np.flatnonzero(picked), rows):
            shop = r["edge_line_shopping"]
            home = df["home_canonical"].iloc[idx]
            away = df["away_canonical"].iloc[idx]
            print(f"  {r['kickoff_at']:%a %d %b %H:%M}  {home:>18} v {away:<18} "
                  f"{r['selection']} @ {r['odds_taken']:>5.2f}  "
                  f"model {r['model_prob']:.0%}  edge {r['edge']:+.1%}"
                  + (f"  (model {r['edge_vs_average']:+.1%} + shop {shop:+.1%})"
                     if shop is not None else "  (no average price to compare)"))

        if rows:
            model_part = np.mean([r["edge_vs_average"] for r in rows
                                  if r["edge_vs_average"] is not None] or [np.nan])
            shop_part = np.mean([r["edge_line_shopping"] for r in rows
                                 if r["edge_line_shopping"] is not None] or [np.nan])
            print(f"\n  mean edge attributable to the MODEL:        {model_part:+.2%}")
            print(f"  mean edge attributable to LINE SHOPPING:    {shop_part:+.2%}")
            if np.isfinite(shop_part) and np.isfinite(model_part) and shop_part > model_part:
                print("  -> most of today's 'value' is price shopping, not the model.")

        if args.dry_run:
            print("\n--dry-run: nothing written")
            return 0

        cols = ["prediction_id", "model_id", "league", "fixture_id",
                "season_fixture_id", "selection",
                "kickoff_at", "hours_to_kickoff", "bookmaker", "odds_taken",
                "odds_average_at_advice", "odds_best_at_advice", "model_prob",
                "market_fair_prob", "devig_method", "edge", "edge_vs_average",
                "edge_line_shopping", "staking_rule", "stake_fraction", "stake_units",
                "is_paper"]
        sql = (f"insert into ai.bets ({','.join(cols)}) "
               f"values ({','.join(['%s'] * len(cols))}) on conflict do nothing")
        with connect() as conn:
            with conn.cursor() as cur:
                cur.executemany(sql, [tuple(r[c] for c in cols) for r in rows])
            conn.commit()
        state["rows"] = len(rows)
        print(f"\nrecorded {len(rows)} {'real' if args.real_money else 'paper'} bets")
    return 0


if __name__ == "__main__":
    sys.exit(main())
