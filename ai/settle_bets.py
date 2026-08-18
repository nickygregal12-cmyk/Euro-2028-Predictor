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

SETTLEMENT AND CLV ARE TWO SEPARATE QUESTIONS and this job used to answer only
the second. A played bet whose closing benchmark had not arrived was `continue`d
— deferred, run after run, and left `advised` for as long as the benchmark was
missing. That is the wrong trade. Whether a bet won is decided by the score and
is not in doubt once the fixture is played. Whether it beat the close depends on
a third party publishing a price, which may arrive days later or never. Coupling
the first to the second means an operator reading the paper record cannot tell
"no closing line yet" from "settlement is broken", and both look identical: a
bet that never resolved.

The outcome is therefore settled as soon as the result is known, with the CLV
columns left NULL and reported as unavailable, and a second pass fills those
columns in later if a benchmark appears. The columns are nullable in the schema
precisely so that is expressible. Nothing invents a closing price to fill a
hole: an absent benchmark stays absent, and `clv_benchmark is null` is the
honest statement that it is.

Both passes are idempotent. The insert is `on conflict (bet_id) do nothing` and
the backfill only ever touches rows whose `clv` is still null, so rerunning
settles nothing twice and never disturbs a PnL that has already been recorded.
"""
from __future__ import annotations

import argparse
import sys

import numpy as np

import betting
from config import LEAGUES
from db import connect, job, query_df

# The closing-line columns every read here needs, in the order the benchmark
# helper expects them.
_CLOSING_COLUMNS = """
               rm.close_avg_h, rm.close_avg_d, rm.close_avg_a,
               rm.close_ps_h,  rm.close_ps_d,  rm.close_ps_a
"""


def load_unsettled(league_key: str):
    return query_df(
        """
        -- Results arrive through ai.fixtures, which gets them from
        -- ai.raw_matches for every division and, where the platform also runs
        -- the competition, from an operator-confirmed season_fixtures row.
        -- Nothing here requires public.season_fixtures to exist.
        --
        -- ai.raw_matches is joined for the CLOSING BENCHMARK ONLY and is a LEFT
        -- join on purpose: a fixture with an authoritative played result settles
        -- whether or not Football-Data has published its closing line.
        select b.id as bet_id, b.selection, b.odds_taken, b.bookmaker,
               b.stake_units,
               f.home_goals as home_score, f.away_goals as away_score,
               bk.exchange_commission,
        """
        + _CLOSING_COLUMNS
        + """
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
           and f.away_goals is not null
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


def load_settled_without_clv(league_key: str):
    """Already-settled bets whose CLV columns are still empty.

    This is the other half of separating outcome from benchmark. A bet settled
    before its closing line was published keeps a permanent NULL unless somebody
    comes back for it, and CLV is the primary metric, so somebody does: every
    run. The outcome, PnL and commission recorded at settlement are never
    touched here.
    """
    return query_df(
        """
        select b.id as bet_id, b.selection, b.odds_taken,
        """
        + _CLOSING_COLUMNS
        + """
          from ai.bets b
          join ai.bet_results r on r.bet_id = b.id
          join ai.fixtures f on f.id = b.fixture_id
     left join ai.raw_matches rm on rm.id = f.raw_match_id
         where b.league = %s
           and b.market = '1X2'
           and r.clv is null
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


def clv_columns(rec, devig: str) -> dict | None:
    """The five CLV columns for one bet, or None when no benchmark exists.

    Returning None rather than zeroes is the whole point: a missing closing
    price is not a CLV of zero, it is an unanswered question, and the columns
    stay null so every report can say so.
    """
    close, benchmark, book_overround = _closing_triple(rec)
    if close is None:
        return None
    leg = betting.OUTCOMES.index(rec["selection"])
    fair_probs = betting.fair_probabilities(close.reshape(1, 3), devig)[0]
    fair = float(fair_probs[leg])
    odds = float(rec["odds_taken"])
    return {
        "odds_closing": round(float(close[leg]), 3),
        "fair_prob_closing": round(fair, 5),
        "clv": round(float(betting.closing_line_value(odds, fair)), 5),
        "beat_closing_price": bool(odds > close[leg]),
        "clv_benchmark": benchmark,
        "benchmark_overround": (round(book_overround, 4)
                                if book_overround is not None else None),
    }


CLV_COLUMNS = ("odds_closing", "fair_prob_closing", "clv", "beat_closing_price",
               "clv_benchmark", "benchmark_overround")


def settlement_row(rec, devig: str) -> dict:
    """One ai.bet_results row. The outcome half never depends on the CLV half."""
    hg, ag = int(rec["home_score"]), int(rec["away_score"])
    actual = "H" if hg > ag else ("D" if hg == ag else "A")
    won = rec["selection"] == actual
    comm = float(rec["exchange_commission"] or 0.0)
    odds = float(rec["odds_taken"])
    ret = (odds - 1.0) * (1.0 - comm) if won else -1.0

    row = {
        "bet_id": rec["bet_id"],
        "actual_result": actual,
        "won": won,
        "settlement_outcome": "win" if won else "loss",
        "commission_rate": comm,
        "pnl_units": round(ret * float(rec["stake_units"]), 4),
        "return_per_unit": round(ret, 5),
    }
    row.update({column: None for column in CLV_COLUMNS})
    clv = clv_columns(rec, devig)
    if clv is not None:
        row.update(clv)
    return row


def _write_settlements(rows: list[dict]) -> None:
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


def _backfill_clv(league_key: str, devig: str) -> tuple[int, list[float]]:
    """Fill the CLV columns of bets settled before their close was published."""
    pending = load_settled_without_clv(league_key)
    if pending.empty:
        return 0, []
    updates, clvs = [], []
    for rec in pending.to_dict("records"):
        clv = clv_columns(rec, devig)
        if clv is None:
            continue
        updates.append((clv["odds_closing"], clv["fair_prob_closing"], clv["clv"],
                        clv["beat_closing_price"], clv["clv_benchmark"],
                        clv["benchmark_overround"], rec["bet_id"]))
        clvs.append(float(clv["clv"]))
    if not updates:
        return 0, []
    with connect() as conn:
        with conn.cursor() as cur:
            cur.executemany(
                "update ai.bet_results set odds_closing=%s, fair_prob_closing=%s, "
                "clv=%s, beat_closing_price=%s, clv_benchmark=%s, "
                "benchmark_overround=%s where bet_id=%s and clv is null",
                updates)
        conn.commit()
    return len(updates), clvs


def _report(rows: list[dict], clvs: list[float], settled_stakes: list[float],
            awaiting_close: int, backfilled: int) -> None:
    if rows:
        ret = np.array([r["return_per_unit"] for r in rows])
        stakes = np.array(settled_stakes)
        pnl = np.array([float(r["pnl_units"]) for r in rows])
        print(f"settled {len(rows)} bets")
        print(f"  hit rate      {np.mean([r['won'] for r in rows]):.1%}")
        print(f"  flat-unit ROI {ret.mean():+.2%}   (sample far too small to mean anything)")
        if stakes.sum() > 0:
            print(f"  stake-weighted ROI {pnl.sum() / stakes.sum():+.2%}")
    if backfilled:
        print(f"  filled a closing benchmark for {backfilled} previously "
              "settled bets")
    if awaiting_close:
        print(f"  {awaiting_close} settled bets still have no closing benchmark; "
              "their CLV is UNAVAILABLE, not zero")
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
        if len(c) > 1:
            print(f"  CLV SD        {c.std(ddof=1):.4f}")
        if n_needed:
            print(f"  at this mean and spread, 80% power needs ~{n_needed:,} bets")
        print("  CLV is the number to watch. Positive and stable is the only real "
              "evidence available to you at this volume.")


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--league", choices=sorted(LEAGUES), required=True)
    ap.add_argument("--devig", default="shin", choices=sorted(betting.DEVIG))
    args = ap.parse_args()

    with job("settle_bets", args.league) as state:
        df = load_unsettled(args.league)
        rows, clvs, settled_stakes = [], [], []
        without_close = 0
        for rec in df.to_dict("records"):
            row = settlement_row(rec, args.devig)
            rows.append(row)
            settled_stakes.append(float(rec["stake_units"]))
            if row["clv"] is None:
                without_close += 1
            else:
                clvs.append(float(row["clv"]))

        if rows:
            _write_settlements(rows)

        # Always run, including on a pass that settled nothing: this is how a
        # bet settled last week gets the closing line published since.
        backfilled, backfilled_clvs = _backfill_clv(args.league, args.devig)
        clvs.extend(backfilled_clvs)

        awaiting = int(query_df(
            """select count(*) as n
                 from ai.bet_results r
                 join ai.bets b on b.id = r.bet_id
                where b.league = %s and r.clv is null""",
            (args.league,)).iloc[0]["n"])

        if not rows and not backfilled:
            print("Nothing to settle." if awaiting == 0 else
                  f"Nothing to settle; {awaiting} settled bets still await a "
                  "closing benchmark.")
        else:
            _report(rows, clvs, settled_stakes, awaiting, backfilled)

        state["rows"] = len(rows)
        state["detail"] = {
            "settled": len(rows),
            "settled_without_closing_benchmark": without_close,
            "clv_backfilled": backfilled,
            "awaiting_closing_benchmark": awaiting,
            "mean_clv": float(np.mean(clvs)) if clvs else None,
        }
    return 0


if __name__ == "__main__":
    sys.exit(main())
