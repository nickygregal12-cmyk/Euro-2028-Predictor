"""The bounded operations a conversational layer is allowed to call.

This is the boundary between "a language model explains what the lab computed"
and "a language model computes". The second is not acceptable here for reasons
that are specific rather than fashionable:

  * arithmetic. Expected value, combined odds, joint probabilities and Kelly
    fractions are exact quantities. A model that gets one 3% wrong produces a
    confident, well-written recommendation to lose money.

  * attribution. Asked why a match is rated highly, a language model will
    produce football reasons — form, injuries, a manager's record — whether or
    not any of them is in the model. The real answer is a list of fitted
    coefficients multiplied by standardised inputs, and it is frequently
    boring and occasionally embarrassing, which is exactly why it must not be
    replaced with something more satisfying.

  * missingness. "What are you missing?" answered by a language model becomes
    a plausible shopping list. Answered here, it is a count of null columns.

So every operation below returns machine-readable evidence, computed by the
same code paths that produced the stored predictions, and a prose layer's only
job is to say it in English. Each returns a dict with a `status`, and a status
of `no_data` or `INSUFFICIENT_DATA` is a legitimate answer — "no selections
currently pass the threshold" and "I do not have enough evidence to claim that
would help" have to be sayable.

Nothing here writes. Every operation is a read or a pure computation.
"""
from __future__ import annotations

from datetime import datetime, timezone

import numpy as np
import pandas as pd

import accumulator as accumulator_mod
import data_quality
import market_timing
import value_engine
from config import LEAGUES

TOOLS = (
    "get_match_prediction",
    "explain_prediction",
    "compare_models",
    "get_data_quality",
    "get_missing_data",
    "search_value_bets",
    "build_accumulator",
    "get_prediction_changes",
    "get_model_performance",
    "get_postmatch_diagnosis",
)


def _ok(payload: dict) -> dict:
    return {"status": "ok"} | payload


def _none(reason: str, **extra) -> dict:
    return {"status": "no_data", "reason": reason} | extra


def _frame(sql: str, params) -> pd.DataFrame:
    from db import query_df
    return query_df(sql, params)


# ---------------------------------------------------------------------------
# 1-2. One prediction, and why
# ---------------------------------------------------------------------------

_PREDICTION_COLUMNS = """
    p.id, p.league, p.home_canonical, p.away_canonical, p.kickoff_at,
    p.horizon, p.hours_to_kickoff, p.data_snapshot_at, p.features_version,
    p.uses_market, p.p_home, p.p_draw, p.p_away,
    p.p_home_raw, p.p_draw_raw, p.p_away_raw,
    p.predicted_result, p.predicted_score, p.exp_home_goals, p.exp_away_goals,
    p.model_views, p.agreement, p.data_confidence, p.uncertainty,
    p.explanation, p.market_probabilities, p.features,
    m.version as model_version, m.family as model_family
"""


def get_match_prediction(league: str, home: str | None = None,
                         away: str | None = None, fixture_id: str | None = None,
                         horizon: str | None = None) -> dict:
    """The most recent stored prediction for one fixture."""
    frame = _frame(
        f"""
        select {_PREDICTION_COLUMNS}
          from ai.valid_predictions p
          join ai.models m on m.id = p.model_id
         where p.league = %s
           and (%s is null or p.fixture_id = %s::uuid)
           and (%s is null or p.home_canonical = %s)
           and (%s is null or p.away_canonical = %s)
           and (%s is null or p.horizon = %s)
         order by p.created_at desc
         limit 1
        """,
        (league, fixture_id, fixture_id, home, home, away, away, horizon, horizon),
    )
    if frame.empty:
        return _none("no stored prediction matches that fixture",
                     league=league, home=home, away=away)
    row = frame.iloc[0].to_dict()
    return _ok({
        "prediction": {
            "match": f"{row['home_canonical']} v {row['away_canonical']}",
            "league": row["league"],
            "kickoff_at": row["kickoff_at"],
            "horizon": row["horizon"],
            "hours_to_kickoff": row["hours_to_kickoff"],
            "model": f"{row['model_version']} ({row['model_family']})",
            "uses_market": row["uses_market"],
            "probabilities": {"H": row["p_home"], "D": row["p_draw"], "A": row["p_away"]},
            "raw_probabilities": ({"H": row["p_home_raw"], "D": row["p_draw_raw"],
                                   "A": row["p_away_raw"]}
                                  if row["p_home_raw"] is not None else None),
            "predicted_result": row["predicted_result"],
            "predicted_score": row["predicted_score"],
            "expected_goals": {"home": row["exp_home_goals"],
                               "away": row["exp_away_goals"]},
            "derived_markets": row["market_probabilities"],
        },
        "model_views": row["model_views"],
        "agreement": row["agreement"],
        "data_confidence": row["data_confidence"],
        "uncertainty": row["uncertainty"],
        "reminder": ("`probabilities` is how often the outcome happens. "
                     "`data_confidence` is how well evidenced that is. They are "
                     "different numbers and must not be merged into one."),
    })


def explain_prediction(league: str, home: str | None = None,
                       away: str | None = None, fixture_id: str | None = None,
                       horizon: str | None = None) -> dict:
    """The stored explanation document — factors, caveats, failure modes."""
    result = get_match_prediction(league, home, away, fixture_id, horizon)
    if result["status"] != "ok":
        return result
    frame = _frame(
        """
        select p.explanation, p.features
          from ai.valid_predictions p
         where p.league = %s
           and (%s is null or p.home_canonical = %s)
           and (%s is null or p.away_canonical = %s)
         order by p.created_at desc limit 1
        """,
        (league, home, home, away, away),
    )
    explanation = None if frame.empty else frame.iloc[0]["explanation"]
    if not explanation:
        return _none("this prediction was written before explanations were "
                     "stored; it cannot be reconstructed from a later model "
                     "without describing a different forecast",
                     prediction=result["prediction"])
    return _ok({"prediction": result["prediction"], "explanation": explanation})


def compare_models(league: str, home: str | None = None,
                   away: str | None = None) -> dict:
    """What each independent base model said, and how far apart they are."""
    result = get_match_prediction(league, home, away)
    if result["status"] != "ok":
        return result
    views = result.get("model_views")
    if not views:
        return _none("this prediction came from a single model, so there is "
                     "nothing to compare; model agreement needs models that "
                     "can disagree",
                     prediction=result["prediction"])
    return _ok({
        "match": result["prediction"]["match"],
        "per_model": views,
        "ensemble": result["prediction"]["probabilities"],
        "agreement": result["agreement"],
    })


# ---------------------------------------------------------------------------
# 3-4. Data quality and missing inputs
# ---------------------------------------------------------------------------

def get_data_quality(league: str) -> dict:
    """Counted coverage for a league, plus the ranked improvement list."""
    from db import load_history, query_df

    if league not in LEAGUES:
        return _none(f"unknown league {league!r}")
    history = load_history(LEAGUES[league].divisions)
    if history.empty:
        return _none("no history imported for this league", league=league)

    coverage = data_quality.league_coverage(history, league)
    experiments = query_df(
        "select hypothesis, verdict, delta_log_loss, std_error, folds "
        "  from ai.feature_experiments where league = %s order by ran_at desc",
        (league,),
    )
    observations = query_df(
        "select fact_type, count(*) as n from ai.observations group by 1", None)
    capabilities = {
        "observation_counts": ({} if observations.empty
                               else dict(zip(observations["fact_type"],
                                             observations["n"].astype(int)))),
        "proven_endpoints": [],
    }
    opportunities = data_quality.improvement_opportunities(
        coverage,
        [] if experiments.empty else experiments.to_dict("records"),
        capabilities)
    return _ok({"coverage": coverage, "opportunities": opportunities,
                "recorded_experiments": (0 if experiments.empty else len(experiments))})


def get_missing_data(league: str, home: str | None = None,
                     away: str | None = None) -> dict:
    """What one fixture is missing, from its own stored feature row."""
    result = get_match_prediction(league, home, away)
    if result["status"] != "ok":
        return result
    frame = _frame(
        "select features, data_confidence from ai.valid_predictions "
        " where league = %s and (%s is null or home_canonical = %s) "
        " order by created_at desc limit 1",
        (league, home, home),
    )
    features = {} if frame.empty else (frame.iloc[0]["features"] or {})
    gaps = data_quality.match_data_gaps(features)
    return _ok({"match": result["prediction"]["match"], **gaps,
                "data_confidence": result.get("data_confidence")})


# ---------------------------------------------------------------------------
# 5-6. Selections and combinations
# ---------------------------------------------------------------------------

def search_value_bets(league: str | None = None, days_ahead: int = 7,
                      min_edge: float = 0.03,
                      min_data_confidence: float = 0.55,
                      book: str = "MAX") -> dict:
    """Run the gate over everything priced, and return decisions with reasons.

    Returns PASSES as well as BETS. A caller that only ever sees selections
    cannot tell "nothing qualified" from "the job did not run", and the reason
    codes are the most useful thing this lab produces on a quiet week.
    """
    frame = _frame(
        """
        with latest as (
          select distinct on (fo.fixture_id, fo.bookmaker) fo.*
            from ai.fixture_odds fo
           where fo.bookmaker = any(%s) and fo.fixture_id is not null
           order by fo.fixture_id, fo.bookmaker, fo.captured_at desc
        )
        select p.id as prediction_id, p.league, p.fixture_id,
               p.home_canonical, p.away_canonical, p.kickoff_at,
               p.p_home, p.p_draw, p.p_away,
               p.data_confidence, p.agreement, p.uncertainty,
               b.odds_h, b.odds_d, b.odds_a, b.captured_at,
               a.odds_h as avg_h, a.odds_d as avg_d, a.odds_a as avg_a
          from ai.valid_predictions p
          join ai.fixtures f on f.id = p.fixture_id
          left join latest b on b.fixture_id = p.fixture_id and b.bookmaker = %s
          left join latest a on a.fixture_id = p.fixture_id and a.bookmaker = 'AVG'
         where (%s is null or p.league = %s)
           and f.status = 'scheduled'
           and p.kickoff_at between now() and now() + make_interval(days => %s)
           and b.odds_h is not null
         order by p.kickoff_at
        """,
        ([book, "AVG"], book, league, league, days_ahead),
    )
    if frame.empty:
        return _none("no priced upcoming fixtures carry a prediction",
                     league=league, days_ahead=days_ahead)

    import betting

    gate = value_engine.ValueGate(value_engine.ValueThresholds(
        min_edge=min_edge, min_data_confidence=min_data_confidence))
    now = datetime.now(timezone.utc)
    bets, passes = [], []

    for row in frame.to_dict("records"):
        ko = pd.to_datetime(row["kickoff_at"]).to_pydatetime()
        if ko.tzinfo is None:
            ko = ko.replace(tzinfo=timezone.utc)
        hours = (ko - now).total_seconds() / 3600.0
        avg = [row.get("avg_h"), row.get("avg_d"), row.get("avg_a")]
        fair = (betting.fair_probabilities(np.array([[float(v) for v in avg]]))[0]
                if all(v is not None and not pd.isna(v) for v in avg) else None)
        for j, (outcome, prob_key, odds_key) in enumerate(
                (("H", "p_home", "odds_h"), ("D", "p_draw", "odds_d"),
                 ("A", "p_away", "odds_a"))):
            candidate = value_engine.Candidate(
                selection=outcome,
                calibrated_prob=float(row[prob_key]),
                odds=float(row[odds_key]),
                bookmaker=book,
                hours_to_kickoff=hours,
                captured_at=(pd.to_datetime(row["captured_at"]).to_pydatetime()
                             if row["captured_at"] is not None else None),
                market_fair_prob=(float(fair[j]) if fair is not None else None),
                data_confidence=row.get("data_confidence") or {},
                agreement=row.get("agreement") or {},
                uncertainty=row.get("uncertainty") or {},
                missing_inputs=list(
                    (row.get("data_confidence") or {}).get("missing_inputs") or []),
            )
            rec = gate.assess(candidate, now)
            entry = {
                "fixture_id": str(row["fixture_id"]),
                "league": row["league"],
                "match": f"{row['home_canonical']} v {row['away_canonical']}",
                "kickoff_at": row["kickoff_at"],
                "selection": outcome,
                "odds": candidate.odds,
                "calibrated_probability": round(candidate.calibrated_prob, 5),
                "expected_value": round(rec.expected_value, 5),
                "decision": rec.decision,
                "reason_codes": rec.reason_codes,
                "evidence": rec.evidence,
                "stake_fraction": round(rec.stake_fraction, 5),
            }
            (bets if rec.is_bet else passes).append(entry)

    bets.sort(key=lambda e: -e["expected_value"])
    counts: dict[str, int] = {}
    for entry in bets + passes:
        for code in entry["reason_codes"] or ["BET"]:
            counts[code] = counts.get(code, 0) + 1

    return _ok({
        "bets": bets,
        "passes": passes[:50],
        "counted": {"assessed": len(bets) + len(passes), "bets": len(bets)},
        "reason_code_counts": counts,
        "answer_when_empty": ("No selections currently pass the threshold."
                              if not bets else None),
    })


def build_accumulator(league: str | None = None, legs: int = 3,
                      objective: str = "value", days_ahead: int = 7,
                      min_combined_odds: float | None = None,
                      max_combined_odds: float | None = None,
                      min_leg_odds: float | None = None,
                      max_leg_odds: float | None = None,
                      min_data_confidence: float | None = None,
                      min_leg_probability: float | None = None,
                      exclude_leagues: tuple[str, ...] = (),
                      exclude_teams: tuple[str, ...] = (),
                      results: int = 5, book: str | None = None,
                      stake: float = 0.0,
                      target_total_return: float | None = None,
                      target_profit: float | None = None,
                      include_reference_ceiling: bool = False) -> dict:
    """Deterministic combination search over the selections that qualified.

    Legs are drawn from BETS only — combinations of refused selections would
    be a way of laundering a PASS into a treble.

    Two defects this call used to carry, both of which made a low-quality
    selection reachable through the accumulator that `search_value_bets` would
    have refused on its own:

      * `min_data_confidence=(min_data_confidence or 0.0)` replaced the normal
        0.55 default with 0.0 whenever the caller did not name a number, so
        NOT asking for a data-confidence floor DISABLED it. Unspecified now
        means "the ValueThresholds default", which is what unspecified has
        always meant everywhere else.

      * `book="MAX"` searched combinations across the best price at any book.
        Those best prices sit at different books, so the combined return was
        available at no venue. The default is now every REAL bookmaker,
        searched one at a time.
    """
    thresholds = value_engine.ValueThresholds()
    effective_confidence = (thresholds.min_data_confidence
                            if min_data_confidence is None
                            else float(min_data_confidence))

    # Target arithmetic, with the two meanings kept apart. Total return
    # INCLUDES the stake; profit does not.
    required_odds = min_combined_odds
    target_kind = None
    if target_total_return is not None:
        required_odds = max(
            required_odds or 0.0,
            accumulator_mod.required_odds_for_total_return(stake, target_total_return))
        target_kind = "total_return"
    if target_profit is not None:
        required_odds = max(
            required_odds or 0.0,
            accumulator_mod.required_odds_for_profit(stake, target_profit))
        target_kind = "profit" if target_kind is None else "total_return+profit"

    books = [book] if book else _actionable_books()
    pool: list = []
    per_book: dict[str, int] = {}
    for code in books:
        found = search_value_bets(league, days_ahead, book=code,
                                  min_data_confidence=effective_confidence)
        if found["status"] != "ok":
            per_book[code] = 0
            continue
        per_book[code] = len(found["bets"])
        for entry in found["bets"]:
            home, away = entry["match"].split(" v ", 1)
            conf = (entry["evidence"] or {})
            pool.append(accumulator_mod.Leg(
                fixture_id=entry["fixture_id"],
                league=entry["league"],
                home=home, away=away,
                kickoff_at=entry["kickoff_at"],
                selection=entry["selection"],
                odds=entry["odds"],
                probability=entry["calibrated_probability"],
                bookmaker=code,
                data_confidence=conf.get("data_confidence"),
                data_confidence_state=conf.get("data_confidence_state"),
                agreement=conf.get("agreement_score"),
                uncertainty_width=conf.get("uncertainty_width"),
                captured_at=conf.get("price_captured_at"),
                price_age_seconds=conf.get("price_age_seconds"),
            ))

    if not pool:
        return _none("no selection at any bookmaker currently passes the gate",
                     league=league, days_ahead=days_ahead,
                     bookmakers_searched=books,
                     min_data_confidence=effective_confidence)

    request = accumulator_mod.AccumulatorRequest(
        legs=legs, objective=objective,
        min_combined_odds=required_odds, max_combined_odds=max_combined_odds,
        min_leg_odds=min_leg_odds, max_leg_odds=max_leg_odds,
        # The gate has already applied this; restating it here means a leg
        # cannot arrive through some future caller that forgot.
        min_data_confidence=effective_confidence,
        min_leg_probability=min_leg_probability,
        exclude_leagues=tuple(exclude_leagues), exclude_teams=tuple(exclude_teams),
        results=results, stake=stake,
        bookmaker=book,
        bookmaker_registry=value_engine.bookmaker_registry(),
        include_reference_ceiling=include_reference_ceiling)
    built = accumulator_mod.build_accumulators(pool, request)
    actionable = [a for a in built["accumulators"] if a["actionable"]]
    return _ok(built | {
        "source": "selections that passed the value gate, at one bookmaker each",
        "bookmakers_searched": books,
        "gate_passed_legs_per_bookmaker": per_book,
        "effective_min_data_confidence": effective_confidence,
        "target": ({"kind": target_kind, "stake": stake,
                    "target_total_return": target_total_return,
                    "target_profit": target_profit,
                    "required_combined_odds": round(required_odds, 4)}
                   if target_kind else None),
        # A first-class successful answer, not an error and not a prompt to
        # relax anything.
        "answer_when_empty": (
            "No combination meets those constraints." if not actionable else None),
    })


def _actionable_books() -> list[str]:
    """Every venue whose price somebody could actually take, from the registry."""
    registry = value_engine.bookmaker_registry()
    return sorted(code for code, entry in registry.items()
                  if entry.get("is_real_price"))


# ---------------------------------------------------------------------------
# 7-10. Change, performance, diagnosis
# ---------------------------------------------------------------------------

def get_prediction_changes(league: str, hours: int = 48) -> dict:
    """What moved between horizons for the same fixture.

    Two rows for one fixture at different horizons are two forecasts of the
    same match made with different information, which is exactly what contract
    185's horizon column was added to express.
    """
    frame = _frame(
        """
        select p.fixture_id, p.home_canonical, p.away_canonical, p.kickoff_at,
               p.horizon, p.hours_to_kickoff, p.created_at,
               p.p_home, p.p_draw, p.p_away
          from ai.valid_predictions p
         where p.league = %s
           and p.kickoff_at > now()
           and p.created_at > now() - make_interval(hours => %s)
         order by p.fixture_id, p.created_at
        """,
        (league, hours),
    )
    if frame.empty:
        return _none("no predictions were written in that window", league=league)

    changes = []
    for fixture_id, group in frame.groupby("fixture_id"):
        if len(group) < 2:
            continue
        first, last = group.iloc[0], group.iloc[-1]
        delta = {
            "H": round(float(last["p_home"]) - float(first["p_home"]), 4),
            "D": round(float(last["p_draw"]) - float(first["p_draw"]), 4),
            "A": round(float(last["p_away"]) - float(first["p_away"]), 4),
        }
        biggest = max(delta, key=lambda k: abs(delta[k]))
        changes.append({
            "fixture_id": str(fixture_id),
            "match": f"{last['home_canonical']} v {last['away_canonical']}",
            "from_horizon": first["horizon"], "to_horizon": last["horizon"],
            "delta": delta,
            "largest_move": biggest,
            "largest_move_pp": round(delta[biggest] * 100, 1),
            "material": abs(delta[biggest]) >= 0.03,
        })
    changes.sort(key=lambda c: -abs(c["largest_move_pp"]))
    if not changes:
        return _none("every fixture has only one forecast so far, so nothing "
                     "has changed between horizons", league=league)
    return _ok({"changes": changes})


def get_model_performance(league: str | None = None, days: int = 14) -> dict:
    """Graded results over a window, split by the things that hide in an average."""
    frame = _frame(
        """
        select p.league, p.horizon, p.kickoff_at,
               greatest(p.p_home, p.p_draw, p.p_away) as confidence,
               r.result_correct, r.log_loss, r.rps, r.brier, r.diagnosis
          from ai.prediction_results r
          join ai.valid_predictions p on p.id = r.prediction_id
         where (%s is null or p.league = %s)
           and p.kickoff_at > now() - make_interval(days => %s)
        """,
        (league, league, days),
    )
    if frame.empty:
        return _none("nothing has been graded in that window",
                     league=league, days=days)

    def block(group: pd.DataFrame) -> dict:
        return {
            "graded": int(len(group)),
            "accuracy": round(float(group["result_correct"].mean()), 4),
            "log_loss": round(float(group["log_loss"].mean()), 4),
            "rps": round(float(group["rps"].mean()), 4),
        }

    bands = pd.cut(frame["confidence"].astype(float),
                   [0.0, 0.4, 0.5, 0.6, 0.7, 1.0], include_lowest=True)
    return _ok({
        "window_days": days,
        "overall": block(frame),
        "by_league": {k: block(g) for k, g in frame.groupby("league")},
        "by_horizon": {k: block(g) for k, g in frame.groupby("horizon")},
        "by_probability_band": {str(k): block(g) for k, g in frame.groupby(bands, observed=True)},
        "diagnoses": (frame["diagnosis"].value_counts().to_dict()
                      if frame["diagnosis"].notna().any() else {}),
        "reminder": ("Accuracy is the number that feels meaningful and decides "
                     "nothing. Log loss and RPS are what a promotion reads."),
    })


def get_postmatch_diagnosis(league: str, days: int = 14) -> dict:
    """Why recent predictions scored as they did, and whether it is a pattern."""
    frame = _frame(
        """
        select p.home_canonical, p.away_canonical, p.kickoff_at,
               p.p_home, p.p_draw, p.p_away,
               r.actual_result, r.actual_home_goals, r.actual_away_goals,
               r.log_loss, r.diagnosis, r.diagnosis_evidence
          from ai.prediction_results r
          join ai.valid_predictions p on p.id = r.prediction_id
         where p.league = %s
           and p.kickoff_at > now() - make_interval(days => %s)
         order by r.log_loss desc
        """,
        (league, days),
    )
    if frame.empty:
        return _none("nothing has been graded in that window", league=league)

    diagnosed = frame[frame["diagnosis"].notna()]
    counts = (diagnosed["diagnosis"].value_counts().to_dict()
              if not diagnosed.empty else {})
    worst = frame.head(5).to_dict("records")
    return _ok({
        "graded": int(len(frame)),
        "diagnosed": int(len(diagnosed)),
        "counts": counts,
        "worst_predictions": [
            {"match": f"{r['home_canonical']} v {r['away_canonical']}",
             "kickoff_at": r["kickoff_at"],
             "probabilities": {"H": r["p_home"], "D": r["p_draw"], "A": r["p_away"]},
             "actual": r["actual_result"],
             "score": f"{r['actual_home_goals']}-{r['actual_away_goals']}",
             "log_loss": r["log_loss"],
             "diagnosis": r["diagnosis"],
             "evidence": r["diagnosis_evidence"]}
            for r in worst
        ],
        "reminder": ("The lower-probability outcome occurring is not a model "
                     "failure. A repeated pattern of confident losses where the "
                     "underlying play also contradicted the model is."),
    })


def get_market_timing(league: str | None = None) -> dict:
    """Whether there is enough price history to study movement at all."""
    from db import market_snapshot_inventory

    inventory = market_snapshot_inventory(league)
    return _ok(market_timing.study_movement(inventory))


DISPATCH = {
    "get_match_prediction": get_match_prediction,
    "explain_prediction": explain_prediction,
    "compare_models": compare_models,
    "get_data_quality": get_data_quality,
    "get_missing_data": get_missing_data,
    "search_value_bets": search_value_bets,
    "build_accumulator": build_accumulator,
    "get_prediction_changes": get_prediction_changes,
    "get_model_performance": get_model_performance,
    "get_postmatch_diagnosis": get_postmatch_diagnosis,
    "get_market_timing": get_market_timing,
}


def call(name: str, **kwargs) -> dict:
    """One entry point, so a caller cannot reach anything not on the list."""
    if name not in DISPATCH:
        return {"status": "error",
                "reason": f"unknown tool {name!r}",
                "available": sorted(DISPATCH)}
    return DISPATCH[name](**kwargs)
