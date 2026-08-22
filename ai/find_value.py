"""Join today's model probabilities to today's prices and record decisions.

    python find_value.py --league EPL --dry-run

Writes ai.bets rows for the selections that survive the gate, all flagged
is_paper=true until you deliberately say otherwise — and writes an
ai.recommendations row for EVERY current candidate, including the ones it
refused.

Recommendations are deliberately re-evaluated whenever fresher prices arrive,
even after a paper bet has already been recorded for that fixture/market. The
original ai.bets advice remains immutable: a later run may publish a fresh
BET/PASS recommendation for Bet Builder, but it never creates a second advised
bet for the same fixture/market merely because the best venue or outcome moved.

THE ADVICE IDENTITY IS THE FIXTURE, NOT THE PREDICTION ROW. It was the
prediction row, and that is not the same thing: ai.predictions is unique on
(model_id, fixture, horizon), so every retrain mints a NEW prediction for a
fixture already advised, the guard saw no existing bet for that new id, and the
lab recorded a second paper bet on the same match. Production carried 226 bets
over 125 fixture/market pairs by 18 August 2026 — 38 fixtures held two bets on
the same selection at the same bookmaker — and every one of those repeats
inflated the bet count, the exposure, the win rate, the ROI and the CLV sample
by counting one opinion about one match more than once. One fixture, one market,
one advised paper bet.

THE FORECAST CURRENCY IS ALSO THE FIXTURE. A fixture deliberately accumulates
immutable t168/t120/t72/t48/t24/t6 forecasts as better evidence arrives. The
candidate read retains those historical rows because they are useful audit
history and existing lifecycle tests deliberately inspect them. It also marks
the one row selected by `ai.canonical_fixture_predictions`. The decision loop
assesses ONLY that canonical row, so an older horizon can never create today's
BET/PASS while the Lab is showing a newer probability.

The refusals are the point. "Edge exceeds 3%, therefore selection" fires on a
four-day-old price, on a club with four matches of history, and on a fixture
where three independent models are spread from 51% to 82%. None of those is a
bet, and until now none of them left any trace: a run that found nothing wrote
nothing and looked exactly like a run that failed.

Aggregate `AVG` / `MAX` prices remain market REFERENCE evidence. An actionable
selection is different: it must name one registry-backed real bookmaker or
exchange whose actual captured price passed the normal freshness/confidence/
value gates. Paper mode simulates a bet a user could have placed; it never turns
a synthetic aggregate into a venue.
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

# None means "consider every real registry venue and choose the best candidate
# that survives the gate". A named --book narrows that action search to one
# REAL venue; AVG/MAX remain references and therefore produce no action rows.
DEFAULT_BOOK: str | None = None


def load_candidates(league_key: str, book: str | None = DEFAULT_BOOK) -> pd.DataFrame:
    """Upcoming forecast history plus latest REAL prices and references.

    Historical forecast horizons remain in this read for audit/debugging. Each
    row carries `is_canonical`; callers that make a CURRENT betting decision
    must assess only rows where that flag is true. This keeps evidence history
    inspectable without allowing it to compete with the forecast the Lab shows.

    One prediction can appear once per actionable bookmaker/exchange. The
    common `ValueGate` decides freshness and actionability again in Python; the
    registry join here is an earlier fail-closed boundary and avoids ever
    presenting AVG/MAX as candidate venues in the first place.

    `AVG` and `MAX` are retained beside each row as REFERENCE prices: AVG
    supplies the de-vigged market probability and MAX is a diagnostic cross-book
    ceiling. Neither is written to `ai.bets.bookmaker`.

    Existing paper/advised bets do NOT remove a prediction from this read. A
    fresh price must be allowed to produce a fresh recommendation so Bet Builder
    never has to rely on yesterday's BET decision. `has_existing_bet` travels
    with every horizon and is used only to suppress a second ai.bets insert; it
    asks about the FIXTURE rather than about this prediction row.
    """
    return query_df(
        """
        with latest as (
          select distinct on (fo.fixture_id, fo.bookmaker) fo.*
            from ai.fixture_odds fo
           where fo.fixture_id is not null
           order by fo.fixture_id, fo.bookmaker, fo.captured_at desc
        ),
        actionable as (
          select l.*
            from latest l
            join ai.bookmakers bk on bk.code = l.bookmaker
           where bk.is_real_price = true
             and bk.kind <> 'aggregate'
             and (%s::text is null or l.bookmaker = %s::text)
        ),
        reference as (
          select fixture_id,
                 max(odds_h) filter (where bookmaker='AVG') as avg_h,
                 max(odds_d) filter (where bookmaker='AVG') as avg_d,
                 max(odds_a) filter (where bookmaker='AVG') as avg_a,
                 max(captured_at) filter (where bookmaker='AVG') as avg_captured_at,
                 max(odds_h) filter (where bookmaker='MAX') as max_h,
                 max(odds_d) filter (where bookmaker='MAX') as max_d,
                 max(odds_a) filter (where bookmaker='MAX') as max_a,
                 max(captured_at) filter (where bookmaker='MAX') as max_captured_at
            from latest
           group by fixture_id
        )
        select p.id as prediction_id, p.model_id, p.league,
               p.fixture_id, p.season_fixture_id,
               p.kickoff_at, p.home_canonical, p.away_canonical,
               p.p_home, p.p_draw, p.p_away,
               p.data_confidence, p.agreement, p.uncertainty,
               (p.id = cp.id) as is_canonical,
               -- Keyed on the FIXTURE, not on p.id. A retrain produces a new
               -- prediction row for a match that has already been advised, and
               -- keying this on the prediction id let that new row record a
               -- second paper bet on the same match.
               exists (select 1 from ai.bets x
                        where x.fixture_id = p.fixture_id and x.market = '1X2')
                 as has_existing_bet,
               a.bookmaker as action_book,
               a.odds_h as action_h, a.odds_d as action_d, a.odds_a as action_a,
               a.captured_at as action_captured_at,
               r.avg_h, r.avg_d, r.avg_a, r.avg_captured_at,
               r.max_h, r.max_d, r.max_a, r.max_captured_at
          from ai.valid_predictions p
          join ai.canonical_fixture_predictions cp on cp.fixture_id = p.fixture_id
          join ai.fixtures f on f.id = p.fixture_id
          join actionable a on a.fixture_id = p.fixture_id
     left join reference r on r.fixture_id = p.fixture_id
         where p.league = %s
           and f.status = 'scheduled'
           and p.kickoff_at > now()
           and num_nonnulls(a.odds_h, a.odds_d, a.odds_a) > 0
         order by p.kickoff_at, p.id, a.bookmaker
        """,
        (book, book, league_key),
    )


def _as_dict(value) -> dict:
    """jsonb comes back as a dict; a missing column comes back as None."""
    if isinstance(value, dict):
        return value
    return {}


def _float_or_none(value) -> float | None:
    if value is None or pd.isna(value):
        return None
    return float(value)


def _should_record_new_bet(is_bet: bool, has_existing_bet: bool) -> bool:
    """A fresh recommendation may change; the original advised bet may not.

    `has_existing_bet` is true when THIS FIXTURE already carries advice on this
    market, from any prediction row and any model version.
    """
    return bool(is_bet and not has_existing_bet)


def _assess_fixture(group: pd.DataFrame, gate: value_engine.ValueGate,
                    now: datetime, devig: str, is_paper: bool):
    """Choose one outcome at one REAL venue, or the closest explicit PASS.

    Every real venue/outcome pair is assessed independently, so a stale price
    at the numerically highest book cannot hide a slightly lower fresh price at
    another venue. The winner is the highest-EV candidate that actually passes
    the gate. If none passes, the highest-EV refusal is retained as the single
    auditable decision for the fixture/market.
    """
    first = group.iloc[0]
    probs = np.array([float(first["p_home"]), float(first["p_draw"]),
                      float(first["p_away"])], dtype=float)

    avg_values = [_float_or_none(first[f"avg_{leg}"]) for leg in ("h", "d", "a")]
    has_avg = all(v is not None for v in avg_values)
    fair = (betting.fair_probabilities(
        np.asarray([avg_values], dtype=float), devig)[0] if has_avg else
        np.array([np.nan, np.nan, np.nan], dtype=float))

    ko = pd.to_datetime(first["kickoff_at"]).to_pydatetime()
    if ko.tzinfo is None:
        ko = ko.replace(tzinfo=timezone.utc)
    hours = (ko - now).total_seconds() / 3600.0

    assessed = []
    action_columns = ("action_h", "action_d", "action_a")
    reference_max = [_float_or_none(first[f"max_{leg}"]) for leg in ("h", "d", "a")]

    for _, venue in group.iterrows():
        captured = venue["action_captured_at"]
        captured = (pd.to_datetime(captured).to_pydatetime()
                    if captured is not None and not pd.isna(captured) else None)
        bookmaker = str(venue["action_book"])
        for j, outcome in enumerate(OUTCOMES):
            odds = _float_or_none(venue[action_columns[j]])
            if odds is None:
                continue
            candidate = value_engine.Candidate(
                selection=outcome,
                calibrated_prob=float(probs[j]),
                odds=odds,
                bookmaker=bookmaker,
                hours_to_kickoff=hours,
                captured_at=captured,
                market_fair_prob=(float(fair[j]) if has_avg else None),
                data_confidence=_as_dict(first["data_confidence"]),
                agreement=_as_dict(first["agreement"]),
                uncertainty=_as_dict(first["uncertainty"]),
                missing_inputs=list(
                    _as_dict(first["data_confidence"]).get("missing_inputs") or []),
                is_paper=is_paper,
            )
            rec = gate.assess(candidate, now)
            rec.evidence["market_avg_reference_odds"] = avg_values[j]
            rec.evidence["market_max_reference_odds"] = reference_max[j]
            rec.evidence["reference_prices_actionable"] = False
            assessed.append((j, rec))

    if not assessed:
        return None
    bets = [(j, rec) for j, rec in assessed if rec.is_bet]
    if bets:
        j, rec = max(bets, key=lambda pair: pair[1].expected_value)
    else:
        j, rec = max(assessed, key=lambda pair: pair[1].expected_value or -np.inf)

    best_real = max(
        (_float_or_none(v) for v in group[action_columns[j]].tolist()),
        default=None,
        key=lambda value: -np.inf if value is None else value,
    )
    return first, j, rec, (avg_values[j] if has_avg else None), best_real


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--league", choices=sorted(LEAGUES), required=True)
    ap.add_argument(
        "--book", default=DEFAULT_BOOK,
        help=("Optional REAL bookmaker/exchange code. By default every real "
              "registry venue is considered and the best surviving price is used. "
              "AVG/MAX are reference prices and cannot be action venues."))
    ap.add_argument("--min-edge", type=float, default=0.03)
    ap.add_argument("--min-data-confidence", type=float, default=0.55)
    ap.add_argument("--devig", default="shin", choices=sorted(betting.DEVIG))
    ap.add_argument("--real-money", action="store_true",
                    help="Record as a real rather than paper bet. The same real-venue "
                         "actionability requirement applies in either mode.")
    ap.add_argument("--dry-run", action="store_true")
    args = ap.parse_args()
    if args.book:
        args.book = str(args.book).upper()

    gate = value_engine.ValueGate(value_engine.ValueThresholds(
        min_edge=args.min_edge, min_data_confidence=args.min_data_confidence))

    with job("find_value", args.league) as state:
        df = load_candidates(args.league, args.book)
        if df.empty:
            print("No upcoming prediction has a price at a real actionable venue.")
            state["detail"] = {"candidates": 0}
            return 0

        # Historical horizons remain in `df` for auditability. Only the one
        # canonical prediction per fixture is allowed to produce the current
        # recommendation or immutable paper advice.
        current = df.loc[df["is_canonical"].fillna(False)].copy()
        if current.empty:
            print("No priced fixture has a canonical current prediction.")
            state["detail"] = {"candidates": 0}
            return 0

        now = datetime.now(timezone.utc)
        assessed = []
        for _, group in current.groupby("prediction_id", sort=False):
            result = _assess_fixture(
                group, gate, now, args.devig, is_paper=not args.real_money)
            if result is not None:
                assessed.append(result)

        if not assessed:
            print("No real venue/outcome candidates were assessable.")
            state["detail"] = {"candidates": 0}
            return 0

        counts = value_engine.summarise_reasons([rec for _, _, rec, _, _ in assessed])
        bet_rows, rec_rows = [], []
        for row, j, rec, o_avg, o_best_real in assessed:
            ko = pd.to_datetime(row["kickoff_at"]).to_pydatetime()
            if ko.tzinfo is None:
                ko = ko.replace(tzinfo=timezone.utc)
            hours = round((ko - now).total_seconds() / 3600, 2)
            conf = _as_dict(row["data_confidence"])
            agree = _as_dict(row["agreement"])
            action_book = rec.candidate.bookmaker
            action_odds = float(rec.candidate.odds)
            has_existing_bet = bool(row["has_existing_bet"])
            rec.evidence["existing_bet_recorded"] = has_existing_bet

            rec_rows.append({
                "prediction_id": row["prediction_id"],
                "model_id": row["model_id"],
                "league": args.league,
                "market": "1X2",
                "selection": OUTCOMES[j],
                "kickoff_at": ko,
                "hours_to_kickoff": hours,
                "decision": rec.decision,
                "reason_codes": rec.reason_codes,
                "bookmaker": action_book,
                "odds_offered": round(action_odds, 3),
                "odds_captured_at": rec.evidence.get("price_captured_at"),
                "odds_age_seconds": rec.evidence.get("price_age_seconds"),
                "calibrated_prob": round(float(rec.candidate.calibrated_prob), 5),
                "fair_odds": (round(rec.fair_odds, 3) if rec.fair_odds else None),
                "expected_value": round(float(rec.expected_value), 5),
                "data_confidence": conf.get("score"),
                "data_confidence_state": conf.get("state"),
                "agreement_score": agree.get("score"),
                "uncertainty_width": rec.evidence.get("uncertainty_width"),
                "evidence": rec.evidence,
            })

            if not _should_record_new_bet(rec.is_bet, has_existing_bet):
                continue

            p = float(rec.candidate.calibrated_prob)
            bet_rows.append({
                "prediction_id": row["prediction_id"],
                "model_id": row["model_id"],
                "league": args.league,
                "fixture_id": row["fixture_id"],
                "season_fixture_id": row["season_fixture_id"],
                "selection": OUTCOMES[j],
                "kickoff_at": ko,
                "hours_to_kickoff": hours,
                "bookmaker": action_book,
                "odds_taken": round(action_odds, 3),
                "odds_average_at_advice": round(o_avg, 3) if o_avg else None,
                "odds_best_at_advice": (round(o_best_real, 3)
                                        if o_best_real is not None else round(action_odds, 3)),
                "model_prob": round(p, 5),
                "market_fair_prob": rec.evidence.get("market_fair_prob"),
                "devig_method": args.devig,
                "edge": round(float(rec.expected_value), 5),
                "edge_vs_average": (round(float(betting.expected_value(p, o_avg)), 5)
                                    if o_avg else None),
                "edge_line_shopping": (round(action_odds / o_avg - 1.0, 5)
                                        if o_avg else None),
                "staking_rule": "quarter_kelly_cap2",
                "stake_fraction": round(rec.stake_fraction, 5),
                "stake_units": round(rec.stake_fraction * 100, 4),
                "is_paper": not args.real_money,
            })

        fixture_count = len(assessed)
        bet_decision_count = sum(1 for _, _, rec, _, _ in assessed if rec.is_bet)
        print(f"{bet_decision_count} current BET decisions from {fixture_count} priced fixtures "
              f"({bet_decision_count/fixture_count:.0%}); {len(bet_rows)} are new advice rows\n")
        for row, j, rec, _, _ in assessed:
            head = (f"  {pd.to_datetime(row['kickoff_at']):%a %d %b %H:%M}  "
                    f"{row['home_canonical']:>18} v {row['away_canonical']:<18} "
                    f"{OUTCOMES[j]} @ {rec.candidate.odds:>5.2f} "
                    f"{rec.candidate.bookmaker:<5}  "
                    f"model {rec.candidate.calibrated_prob:.0%}  "
                    f"edge {rec.expected_value:+.1%}")
            if rec.is_bet:
                print(head + "   BET")
            else:
                print(head + "   PASS " + ", ".join(rec.reason_codes))

        if not bet_decision_count:
            print("\nNo selections currently pass the threshold. That is an "
                  "answer, not a failure.")
        print("\ngate summary: " + ", ".join(f"{k}={v}" for k, v in sorted(counts.items())))

        if bet_rows:
            model_part = np.mean([r["edge_vs_average"] for r in bet_rows
                                  if r["edge_vs_average"] is not None] or [np.nan])
            shop_part = np.mean([r["edge_line_shopping"] for r in bet_rows
                                 if r["edge_line_shopping"] is not None] or [np.nan])
            print(f"\n  mean edge attributable to the MODEL on new advice:     {model_part:+.2%}")
            print(f"  mean edge attributable to LINE SHOPPING on new advice: {shop_part:+.2%}")
            if np.isfinite(shop_part) and np.isfinite(model_part) and shop_part > model_part:
                print("  -> most of today's new 'value' is price shopping, not the model.")

        if args.dry_run:
            print("\n--dry-run: nothing written")
            state["detail"] = {"candidates": fixture_count,
                               "bet_decisions": bet_decision_count,
                               "new_bets": len(bet_rows),
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
        state["detail"] = {"candidates": fixture_count,
                           "bet_decisions": bet_decision_count,
                           "new_bets": len(bet_rows),
                           "recommendations": recorded,
                           "reason_codes": counts}
        print(f"\nrecorded {len(bet_rows)} new {'real' if args.real_money else 'paper'} "
              f"bets and {recorded} fresh decisions")
    return 0


if __name__ == "__main__":
    sys.exit(main())