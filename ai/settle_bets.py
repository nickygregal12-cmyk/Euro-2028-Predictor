"""Settle advised bets and, more importantly, record closing-line value.

    python settle_bets.py --league EPL

Two things happen here and only one of them matters much.

Profit and loss is recorded because you need it, and because a track record
without it looks evasive. But at any realistic volume it is noise: a genuine
+3% ROI at odds of 3.0 takes roughly fourteen thousand bets to demonstrate at
80% power, which is over twenty years at ten selections a week.

Closing-line value is the real measurement. Every settled bet contributes a
comparison between the price you took and the market's final opinion, rather
than one coin flip, so a true +1% CLV becomes visible in about a hundred bets.
If CLV is negative over a few hundred bets, the model is not finding value and
no amount of waiting for the profit column to turn green will change that.
"""
from __future__ import annotations

import argparse
import sys

import numpy as np

import betting
from config import LEAGUES
from db import connect, job, query_df


def load_unsettled(league_key: str):
    return query_df(
        """
        -- Results arrive through ai.fixtures, which gets them from
        -- ai.raw_matches for every division and, where the platform also runs
        -- the competition, from an operator-confirmed season_fixtures row.
        -- Nothing here requires public.season_fixtures to exist.
        select b.id as bet_id, b.selection, b.odds_taken, b.bookmaker,
               b.stake_units,
               f.home_goals as home_score, f.away_goals as away_score,
               bk.exchange_commission,
               rm.close_avg_h, rm.close_avg_d, rm.close_avg_a,
               rm.close_ps_h,  rm.close_ps_d,  rm.close_ps_a
          from ai.bets b
          join ai.bookmakers bk on bk.code = b.bookmaker
          join ai.fixtures f on f.id = b.fixture_id
     left join ai.raw_matches rm on rm.id = f.raw_match_id
     left join ai.bet_results r on r.bet_id = b.id
         where b.league = %s
           and b.market = '1X2'
           and b.status = 'advised'
           and r.bet_id is null
           and f.status = 'played'
           and f.home_goals is not null
           -- A bet advised from a quarantined forecast is not betting
           -- evidence. Settling it would put its CLV and its profit into the
           -- lab's own record of how well it bets, which is the number the
           -- publication gate reads — and the selection was chosen by a model
           -- that had been told one of the clubs had never played a match.
           -- The bet row is kept; it is simply never graded.
           and not exists (select 1 from ai.prediction_invalidations i
                            where i.prediction_id = b.prediction_id)
        """,
        (league_key,),
    )


# Benchmark preference, sharpest first. MAX IS DELIBERATELY ABSENT.
#
# Max H, Max D and Max A are each the best price from whichever bookmaker
# happened to be top on that outcome, so the triple is a synthetic book that
# nobody offered. Its overround is frequently below 1 — it is an arbitrage —
# and de-vigging something whose implied probabilities already sum to less than
# one is not a meaningful operation. It flatters CLV, in the direction you
# would most like to be flattered. Max stays useful as "the best price
# available"; it is never the fair line.
BENCHMARKS = (("PS", "close_ps"), ("AVG", "close_avg"))


def _closing_triple(row):
    for code, prefix in BENCHMARKS:
        triple = [row.get(f"{prefix}_{leg}") for leg in ("h", "d", "a")]
        if all(v is not None and np.isfinite(float(v)) for v in triple):
            arr = np.array([float(v) for v in triple])
            return arr, code, float((1.0 / arr).sum())
    return None, None, None


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--league", choices=sorted(LEAGUES), required=True)
    ap.add_argument("--devig", default="shin", choices=sorted(betting.DEVIG))
    args = ap.parse_args()

    with job("settle_bets", args.league) as state:
        df = load_unsettled(args.league)
        if df.empty:
            print("Nothing to settle.")
            state["detail"] = {"settled": 0}
            return 0

        rows, clvs, settled_stakes = [], [], []
        deferred = 0
        for rec in df.to_dict("records"):
            hg, ag = int(rec["home_score"]), int(rec["away_score"])
            actual = "H" if hg > ag else ("D" if hg == ag else "A")
            won = rec["selection"] == actual
            comm = float(rec["exchange_commission"] or 0.0)
            odds = float(rec["odds_taken"])
            ret = (odds - 1.0) * (1.0 - comm) if won else -1.0

            close, benchmark, book_overround = _closing_triple(rec)
            if close is None:
                # The result may arrive before Football-Data's closing line.
                # Keep the bet advised and revisit it on the next run; settling
                # now would make the primary metric permanently NULL.
                deferred += 1
                continue
            fair_probs = betting.fair_probabilities(close.reshape(1, 3), args.devig)[0]
            leg = betting.OUTCOMES.index(rec["selection"])
            fair = float(fair_probs[leg])
            clv = float(betting.closing_line_value(odds, fair))
            beat = bool(odds > close[leg])
            clvs.append(clv)
            settled_stakes.append(float(rec["stake_units"]))

            rows.append({
                "bet_id": rec["bet_id"],
                "actual_result": actual,
                "won": won,
                "settlement_outcome": "win" if won else "loss",
                "commission_rate": comm,
                "pnl_units": round(ret * float(rec["stake_units"]), 4),
                "return_per_unit": round(ret, 5),
                "odds_closing": round(float(close[betting.OUTCOMES.index(rec["selection"])]), 3),
                "fair_prob_closing": round(fair, 5),
                "clv": round(clv, 5),
                "beat_closing_price": beat,
                "clv_benchmark": benchmark,
                "benchmark_overround": round(book_overround, 4)
                                        if book_overround is not None else None,
            })

        if not rows:
            print(f"deferred {deferred} played bets until a closing benchmark arrives")
            state["detail"] = {"settled": 0, "deferred_for_clv": deferred}
            return 0

        cols = list(rows[0].keys())
        with connect() as conn:
            with conn.cursor() as cur:
                cur.executemany(
                    f"insert into ai.bet_results ({','.join(cols)}) "
                    f"values ({','.join(['%s'] * len(cols))}) "
                    "on conflict (bet_id) do nothing",
                    [tuple(r[c] for c in cols) for r in rows])
                cur.executemany(
                    "update ai.bets set status='settled' where id=%s",
                    [(r["bet_id"],) for r in rows])
            conn.commit()

        ret = np.array([r["return_per_unit"] for r in rows])
        stakes = np.array(settled_stakes)
        pnl = np.array([float(r["pnl_units"]) for r in rows])
        print(f"settled {len(rows)} bets; deferred {deferred} awaiting a closing line")
        print(f"  hit rate      {np.mean([r['won'] for r in rows]):.1%}")
        print(f"  flat-unit ROI {ret.mean():+.2%}   (sample far too small to mean anything)")
        if stakes.sum() > 0:
            print(f"  stake-weighted ROI {pnl.sum() / stakes.sum():+.2%}")
        if clvs:
            c = np.array(clvs)
            se = c.std(ddof=1) / np.sqrt(len(c)) if len(c) > 1 else float("nan")
            print(f"  mean CLV      {c.mean():+.4f}  n={len(c)}"
                  + (f"  95% CI [{c.mean()-1.96*se:+.4f}, {c.mean()+1.96*se:+.4f}]"
                     if len(c) > 1 else ""))
            n_needed = None
            if len(c) > 1 and c.mean() > 0:
                import backtest as _bt
                n_needed = _bt.bets_for_clv_power(float(c.mean()), float(c.std(ddof=1)))
            print(f"  CLV SD        {c.std(ddof=1):.4f}" if len(c) > 1 else "")
            if n_needed:
                print(f"  at this mean and spread, 80% power needs ~{n_needed:,} bets")
            print("  CLV is the number to watch. Positive and stable is the only real "
                  "evidence available to you at this volume.")
        state["rows"] = len(rows)
        state["detail"] = {"settled": len(rows), "deferred_for_clv": deferred,
                           "mean_clv": float(np.mean(clvs)) if clvs else None}
    return 0


if __name__ == "__main__":
    sys.exit(main())
