"""Database access for the AI Lab jobs.

Uses a direct Postgres connection with the service role, which bypasses RLS.
That is correct here and nowhere else: these jobs run on a server, the
connection string never reaches a browser, and the `ai` schema is unreachable
from `anon`/`authenticated` by design.
"""
from __future__ import annotations

import json
import re
from contextlib import contextmanager
from datetime import date, datetime
from typing import Any, Iterable

import pandas as pd
import psycopg
from psycopg.rows import dict_row

from config import database_url, read_only


@contextmanager
def connect():
    # Under AI_READ_ONLY the session is opened read-only at the libpq level, so
    # the refusal comes from PostgreSQL on the first write rather than from a
    # convention about which flags the caller passed. See config.read_only.
    options = {"options": "-c default_transaction_read_only=on"} if read_only() else {}
    with psycopg.connect(database_url(), row_factory=dict_row, **options) as conn:
        yield conn


def query_df(sql: str, params: tuple | dict | None = None) -> pd.DataFrame:
    with connect() as conn:
        rows = conn.execute(sql, params).fetchall()
    return pd.DataFrame(rows)


# ---------------------------------------------------------------------------
# Job bookkeeping
# ---------------------------------------------------------------------------

@contextmanager
def job(name: str, league: str | None = None):
    """Records a row in ai.job_runs so the admin page can answer 'did it run?'.

    A failure is recorded and re-raised. A job that dies without writing a
    terminal status shows as 'running' forever, which is the correct and
    visible symptom of a killed process.
    """
    with connect() as conn:
        run = conn.execute(
            "insert into ai.job_runs (job, league) values (%s, %s) returning id",
            (name, league),
        ).fetchone()
        conn.commit()
        run_id = run["id"]

    state = {"rows": 0, "detail": {}}
    try:
        yield state
    except Exception as exc:
        with connect() as conn:
            conn.execute(
                "update ai.job_runs set finished_at=now(), status='failed', "
                "message=%s, detail=%s where id=%s",
                (f"{type(exc).__name__}: {exc}"[:2000], json.dumps(state["detail"], default=str), run_id),
            )
            conn.commit()
        raise
    else:
        with connect() as conn:
            conn.execute(
                "update ai.job_runs set finished_at=now(), status='succeeded', "
                "rows_written=%s, detail=%s where id=%s",
                (state["rows"], json.dumps(state["detail"], default=str), run_id),
            )
            conn.commit()


# ---------------------------------------------------------------------------
# Reads
# ---------------------------------------------------------------------------

def load_history(divisions: Iterable[str]) -> pd.DataFrame:
    df = query_df(
        """
        select id, division, season, match_date, home_canonical, away_canonical,
               home_goals, away_goals, result,
               -- Match statistics. The feature builder declares what it reads
               -- in features.SOURCE_COLUMNS and a test holds this projection
               -- to it, because a column missing here does not fail: it
               -- silently becomes a neutral value in every row.
               home_shots, away_shots,
               home_shots_ot, away_shots_ot,
               home_corners, away_corners,
               ht_home_goals, ht_away_goals,
               home_yellows, away_yellows,
               home_fouls, away_fouls, referee,
               home_reds, away_reds, red_card_distorted,
               mkt_home_prob, mkt_draw_prob, mkt_away_prob,
               odds_avg_h, odds_avg_d, odds_avg_a,
               odds_max_h, odds_max_d, odds_max_a,
               close_avg_h, close_avg_d, close_avg_a,
               close_max_h, close_max_d, close_max_a,
               close_ps_h, close_ps_d, close_ps_a
          from ai.raw_matches
         where division = any(%s)
         order by match_date, home_canonical
        """,
        ([list(divisions)]),
    )
    if not df.empty:
        df["match_date"] = pd.to_datetime(df["match_date"]).dt.date
    return df


def load_upcoming_fixtures(tournament_name: str, days_ahead: int = 10) -> pd.DataFrame:
    """Fixtures still to be played, with team names as this platform holds them."""
    return query_df(
        """
        select sf.id           as season_fixture_id,
               sf.kickoff_at,
               ht.name         as home_team_name,
               at.name         as away_team_name
          from public.season_fixtures sf
          join public.tournaments t  on t.id  = sf.tournament_id
          join public.teams ht       on ht.id = sf.home_team_id
          join public.teams at       on at.id = sf.away_team_id
         where t.name = %s
           and sf.home_score is null
           and sf.kickoff_at between now() and now() + make_interval(days => %s)
         order by sf.kickoff_at
        """,
        (tournament_name, days_ahead),
    )


def load_finished_fixtures_needing_grading(league_key: str) -> pd.DataFrame:
    """Ungraded forecasts of played fixtures, with the closing line beside them.

    `ai.raw_matches` is a LEFT join and supplies the BENCHMARK only. A forecast
    of a fixture with an authoritative result is graded whether or not
    Football-Data has published a closing line for it, exactly as a bet is
    settled without one: the market comparison columns stay null and say so.
    """
    return query_df(
        """
        select p.id as prediction_id, p.p_home, p.p_draw, p.p_away,
               p.predicted_result, p.predicted_score,
               p.mkt_home_at_prediction, p.mkt_draw_at_prediction,
               p.mkt_away_at_prediction,
               f.home_goals as home_score, f.away_goals as away_score,
               rm.close_avg_h, rm.close_avg_d, rm.close_avg_a,
               rm.close_ps_h,  rm.close_ps_d,  rm.close_ps_a
          from ai.valid_predictions p
          join ai.fixtures f             on f.id = p.fixture_id
     left join ai.raw_matches rm         on rm.id = f.raw_match_id
     left join ai.prediction_results r   on r.prediction_id = p.id
         where p.league = %s
           and f.status = 'played'
           and f.home_goals is not null
           and f.away_goals is not null
           and r.prediction_id is null
        """,
        (league_key,),
    )


def load_graded_rows_needing_market_comparison(league_key: str) -> pd.DataFrame:
    """Already-graded forecasts whose market comparison is still missing.

    `load_finished_fixtures_needing_grading` deliberately skips a prediction
    that already has a `ai.prediction_results` row, which is what keeps grading
    idempotent and stops a settled outcome being rewritten. The cost is that a
    row graded BEFORE anything populated the contract 185 columns can never
    acquire them from the ordinary loop, and Football-Data publishes its closing
    line on its own schedule — often after the fixture was graded.

    So the comparison gets a SECOND PASS, exactly as CLV does in settle_bets:
    outcome first and unconditionally, benchmark afterwards when it exists. Only
    rows still missing the comparison are returned, and only where a closing
    benchmark is actually present, so a fixture the feed never priced is never
    selected and never has a number invented for it.
    """
    return query_df(
        """
        select p.id as prediction_id, p.p_home, p.p_draw, p.p_away,
               p.mkt_home_at_prediction, p.mkt_draw_at_prediction,
               p.mkt_away_at_prediction,
               r.actual_result, r.log_loss,
               rm.close_avg_h, rm.close_avg_d, rm.close_avg_a,
               rm.close_ps_h,  rm.close_ps_d,  rm.close_ps_a
          from ai.prediction_results r
          join ai.valid_predictions p on p.id = r.prediction_id
          join ai.fixtures f          on f.id = p.fixture_id
          join ai.raw_matches rm      on rm.id = f.raw_match_id
         where p.league = %s
           and r.market_log_loss is null
           and r.actual_result is not null
           and (rm.close_ps_h is not null or rm.close_avg_h is not null)
        """,
        (league_key,),
    )


def update_prediction_market_comparison(rows: list[dict]) -> int:
    """Fill the six market-comparison columns on an already-graded row.

    `where market_log_loss is null` makes the pass idempotent and makes it
    incapable of revising a comparison already recorded. Nothing else on the row
    is touched: the outcome, the model's own scores and the diagnosis are what
    they were.
    """
    if not rows:
        return 0
    written = 0
    with connect() as conn:
        with conn.cursor() as cur:
            for r in rows:
                cur.execute(
                    "update ai.prediction_results"
                    "   set mkt_home_closing=%s, mkt_draw_closing=%s,"
                    "       mkt_away_closing=%s, market_log_loss=%s,"
                    "       log_loss_vs_market=%s, market_moved_toward_model=%s"
                    " where prediction_id=%s and market_log_loss is null",
                    (r["mkt_home_closing"], r["mkt_draw_closing"],
                     r["mkt_away_closing"], r["market_log_loss"],
                     r["log_loss_vs_market"], r["market_moved_toward_model"],
                     r["prediction_id"]),
                )
                written += cur.rowcount
        conn.commit()
    return written


def supported_horizons() -> frozenset[str]:
    """The horizon vocabulary the TARGET DATABASE actually accepts.

    Contract 202 widens `predictions_horizon_check` to admit t72, t120 and t168.
    Between the moment that code merges and the moment the contract reaches a
    hosted environment, `predict.py` would compute a horizon the database refuses
    and every forecast in the window would fail on a check violation — a red job
    every morning until somebody promotes a migration, which is the shape of
    noise that gets a red tick ignored. The forecaster asks instead, and falls
    back to the bucket the database does have.

    Read from the installed constraint rather than from a version number,
    because the constraint is the thing that will refuse the insert.
    """
    with connect() as conn:
        row = conn.execute(
            """select pg_get_constraintdef(c.oid) as def
                 from pg_constraint c
                where c.conrelid = 'ai.predictions'::regclass
                  and c.conname = 'predictions_horizon_check'"""
        ).fetchone()
    if not row or not row["def"]:
        return frozenset()
    return frozenset(re.findall(r"'([a-z0-9]+)'::text", row["def"])
                     or re.findall(r"'([a-z0-9]+)'", row["def"]))


def current_model(league: str) -> dict[str, Any] | None:
    with connect() as conn:
        return conn.execute(
            "select * from ai.models where league=%s and status='current'", (league,)
        ).fetchone()


def team_id_map(tournament_name: str) -> dict[str, str]:
    df = query_df(
        """
        select tm.name, tm.id
          from public.teams tm
          join public.tournaments t on t.id = tm.tournament_id
         where t.name = %s
        """,
        (tournament_name,),
    )
    return {} if df.empty else dict(zip(df["name"], df["id"].astype(str)))


# ---------------------------------------------------------------------------
# Writes
# ---------------------------------------------------------------------------

BATCH_ROWS = 500


def _write_batched(cur, head: str, tail: str, width: int,
                   values: list[tuple], batch: int = BATCH_ROWS) -> None:
    """Send `values` as multi-row VALUES statements rather than one per row.

    `executemany`, and a Python loop around `execute`, each cost one network
    round trip per row. On a local socket that is invisible — the full import
    measured 2,900 rows a second there. Against the hosted pooler it is
    decisive: measured on Development on 12 August 2026, the historical
    backfill ran at about **7.5 rows a second**, which is roughly thirteen
    hours for nine divisions and certain to exceed the job's 180-minute
    timeout. The first hosted run was cancelled for exactly that reason.

    Batching changes no semantics: the same statement, the same `on conflict`
    clause, the same transaction. Only the number of round trips changes, by
    a factor of `batch`.
    """
    placeholder = "(" + ",".join(["%s"] * width) + ")"
    for start in range(0, len(values), batch):
        chunk = values[start:start + batch]
        sql = head + ",".join([placeholder] * len(chunk)) + tail
        cur.execute(sql, [field for row in chunk for field in row])


def upsert_raw_matches(rows: list[dict]) -> int:
    if not rows:
        return 0
    cols = [
        "source", "division", "season", "match_date", "home_canonical", "away_canonical",
        "home_goals", "away_goals", "result", "home_shots", "away_shots",
        "home_shots_ot", "away_shots_ot", "home_corners", "away_corners",
        "ht_home_goals", "ht_away_goals",
        "home_reds", "away_reds", "home_yellows", "away_yellows",
        "home_fouls", "away_fouls", "referee",
        "mkt_home_prob", "mkt_draw_prob", "mkt_away_prob",
        "odds_avg_h", "odds_avg_d", "odds_avg_a",
        "odds_max_h", "odds_max_d", "odds_max_a",
        "odds_ps_h", "odds_ps_d", "odds_ps_a",
        "odds_bfe_h", "odds_bfe_d", "odds_bfe_a",
        "close_avg_h", "close_avg_d", "close_avg_a",
        "close_max_h", "close_max_d", "close_max_a",
        "close_ps_h", "close_ps_d", "close_ps_a",
        "overround_avg", "overround_max",
    ]
    update_cols = [c for c in cols if c not in {
        "source", "division", "season", "match_date",
        "home_canonical", "away_canonical",
    }]
    head = f"insert into ai.raw_matches ({','.join(cols)}) values "
    tail = (
        " on conflict (source, division, season, match_date, home_canonical, away_canonical) "
        "do update set " + ",".join(f"{c}=excluded.{c}" for c in update_cols)
    )
    with connect() as conn:
        with conn.cursor() as cur:
            _write_batched(cur, head, tail, len(cols),
                           [tuple(r.get(c) for c in cols) for r in rows])
        conn.commit()
    return len(rows)


def upsert_historical_market_prices(rows: list[dict]) -> int:
    """Persist free O/U and AH prices parsed alongside historical results."""
    price_rows = []
    for match in rows:
        for price in match.get("_market_prices", []):
            price_rows.append((match, price))
    if not price_rows:
        return 0

    # One statement per price row is the single slowest thing in the import:
    # prices outnumber matches by roughly eight to one, and each cost its own
    # network round trip. The batched form joins a VALUES list to the raw
    # matches instead, so a batch of 500 costs one.
    head = """
      insert into ai.historical_market_prices
        (raw_match_id,market,line,selection,bookmaker,odds,phase,source)
      select rm.id, v.market::text, v.line::numeric, v.selection::text,
             v.bookmaker::text, v.odds::numeric, 'pre', 'football-data.co.uk'
        from (values """
    tail = """
             ) as v(market,line,selection,bookmaker,odds,source,division,
                    season,match_date,home_canonical,away_canonical)
        join ai.raw_matches rm
          on rm.source = v.source::text
         and rm.division = v.division::text
         and rm.season = v.season::text
         and rm.match_date = v.match_date::date
         and rm.home_canonical = v.home_canonical::text
         and rm.away_canonical = v.away_canonical::text
      on conflict (raw_match_id,market,line,selection,bookmaker,phase)
      do update set odds=excluded.odds
    """
    # The per-row statement is kept for diagnosis. A short batch means some
    # price did not resolve to a raw match, and ADR 0029 requires that to
    # abort rather than become an invisible orphan — but the batch cannot say
    # WHICH, so the offending batch is replayed one row at a time to name it.
    one = """
      insert into ai.historical_market_prices
        (raw_match_id,market,line,selection,bookmaker,odds,phase,source)
      select rm.id,%s,%s,%s,%s,%s,'pre','football-data.co.uk'
        from ai.raw_matches rm
       where rm.source=%s and rm.division=%s and rm.season=%s
         and rm.match_date=%s and rm.home_canonical=%s and rm.away_canonical=%s
      on conflict (raw_match_id,market,line,selection,bookmaker,phase)
      do update set odds=excluded.odds
    """

    def _fields(match: dict, price: dict) -> tuple:
        return (price["market"], price["line"], price["selection"],
                price["bookmaker"], price["odds"], match["source"],
                match["division"], match["season"], match["match_date"],
                match["home_canonical"], match["away_canonical"])

    written = 0
    placeholder = "(" + ",".join(["%s"] * 11) + ")"
    with connect() as conn:
        with conn.cursor() as cur:
            for start in range(0, len(price_rows), BATCH_ROWS):
                chunk = price_rows[start:start + BATCH_ROWS]
                sql = head + ",".join([placeholder] * len(chunk)) + tail
                cur.execute(sql, [f for match, price in chunk
                                  for f in _fields(match, price)])
                if cur.rowcount == len(chunk):
                    written += cur.rowcount
                    continue
                for match, price in chunk:
                    cur.execute(one, _fields(match, price))
                    if cur.rowcount != 1:
                        raise RuntimeError(
                            "Historical market price could not resolve its raw match: "
                            f"{match['division']} {match['match_date']} "
                            f"{match['home_canonical']} v {match['away_canonical']}"
                        )
                written += len(chunk)
        conn.commit()
    return written


def insert_model(record: dict) -> str:
    cols = list(record.keys())
    sql = (
        f"insert into ai.models ({','.join(cols)}) "
        f"values ({','.join(['%s'] * len(cols))}) returning id"
    )
    with connect() as conn:
        row = conn.execute(sql, tuple(record[c] for c in cols)).fetchone()
        conn.commit()
    return str(row["id"])


def insert_predictions(rows: list[dict]) -> int:
    """Skips fixtures already predicted by this model, and refuses anything
    that has already kicked off — the database enforces both, this just keeps
    the job from failing on a rerun."""
    if not rows:
        return 0
    cols = [
        "model_id", "league", "fixture_id", "season_fixture_id", "raw_match_id",
        "kickoff_at", "home_canonical", "away_canonical", "p_home", "p_draw", "p_away",
        "exp_home_goals", "exp_away_goals", "predicted_result", "predicted_score",
        "scoreline_grid", "features", "market_probabilities",
        # Contract 185's timing columns, which nothing was populating: every
        # prediction landed on the 'scheduled' default, so the per-horizon
        # performance report contract 185 shipped had exactly one horizon to
        # report on and could never answer the question it exists for.
        "horizon", "hours_to_kickoff", "data_snapshot_at", "features_version",
        "uses_market",
        # Contract 186's evidence columns.
        "p_home_raw", "p_draw_raw", "p_away_raw",
        "model_views", "agreement", "data_confidence", "uncertainty",
        "explanation",
    ]
    json_cols = {"scoreline_grid", "features", "market_probabilities",
                 "model_views", "agreement", "data_confidence", "uncertainty",
                 "explanation"}
    sql = (
        f"insert into ai.predictions ({','.join(cols)}) "
        f"values ({','.join(['%s'] * len(cols))}) "
        "on conflict do nothing"
    )
    written = 0
    with connect() as conn:
        with conn.cursor() as cur:
            for r in rows:
                values = []
                for c in cols:
                    v = r.get(c)
                    if c in json_cols and v is not None:
                        v = json.dumps(v)
                    values.append(v)
                cur.execute(sql, tuple(values))
                written += cur.rowcount
        conn.commit()
    return written


def league_grading_evidence(league: str) -> dict[str, Any]:
    """What this league's own track record says, for the data-confidence score.

    A model that has been graded four hundred times in a league is better
    evidenced than the same model in a league where nothing has been graded
    yet, and that is a fact about DATA rather than about any fixture. Returns
    zeros rather than raising on an empty lab: a league with no history is a
    normal state on day one, and it should read as low confidence rather than
    as a failure.
    """
    with connect() as conn:
        row = conn.execute(
            """
            select count(*)                       as graded_predictions,
                   avg(r.log_loss)                as mean_log_loss,
                   avg(case when r.result_correct then 1 else 0 end) as accuracy
              from ai.prediction_results r
              join ai.valid_predictions p on p.id = r.prediction_id
             where p.league = %s
            """,
            (league,),
        ).fetchone()
        # Binned reliability, which is what "calibration error" means. The
        # previous query computed `mean(|max(p) - correct|)`, which is not a
        # calibration measure at all: a PERFECTLY calibrated set of 70%
        # forecasts is wrong 30% of the time, so that expression returns
        # roughly 0.42 on flawless output. `data_confidence` then treated
        # anything above 0.10 as poor calibration, so a well-calibrated league
        # was penalised almost as hard as a broken one — the score was
        # measuring average confidence, not reliability.
        bins = conn.execute(
            """
            select width_bucket(greatest(p.p_home, p.p_draw, p.p_away),
                                0.0, 1.0, 10)                as bucket,
                   count(*)                                  as n,
                   avg(greatest(p.p_home, p.p_draw, p.p_away)) as mean_predicted,
                   avg(case when r.result_correct then 1 else 0 end) as observed
              from ai.prediction_results r
              join ai.valid_predictions p on p.id = r.prediction_id
             where p.league = %s
             group by 1
            """,
            (league,),
        ).fetchall()
    if not row or not row["graded_predictions"]:
        return {"graded_predictions": 0, "mean_log_loss": None,
                "accuracy": None, "calibration_error": None,
                "calibration_bins": []}
    total = float(sum(int(b["n"]) for b in bins)) or 1.0
    # Expected calibration error: the sample-weighted mean gap between the
    # probability claimed in a bin and the frequency observed in it.
    ece = sum(
        (int(b["n"]) / total) * abs(float(b["mean_predicted"]) - float(b["observed"]))
        for b in bins
    )
    return {
        "graded_predictions": int(row["graded_predictions"]),
        "mean_log_loss": float(row["mean_log_loss"]) if row["mean_log_loss"] is not None else None,
        "accuracy": float(row["accuracy"]) if row["accuracy"] is not None else None,
        "calibration_error": round(float(ece), 5),
        "calibration_bins": [
            {"bucket": int(b["bucket"]), "n": int(b["n"]),
             "mean_predicted": round(float(b["mean_predicted"]), 4),
             "observed_frequency": round(float(b["observed"]), 4)}
            for b in sorted(bins, key=lambda x: x["bucket"])
        ],
    }


def load_market_snapshot(fixture_ids, as_of) -> pd.DataFrame:
    """Average and best 1X2 prices per fixture, AS THEY STOOD at `as_of`.

    This is the read that makes a market-informed model live-scorable, and the
    `captured_at <= as_of` bound is the whole point of it. Training saw
    pre-match prices; scoring must see prices that existed at the prediction's
    own `data_snapshot_at` and nothing later. A closing price cannot enter
    because `market_prices` holds capture times and this filters on them, and
    `market_features.assert_no_closing_features` refuses the closing columns by
    name in any case — two independent controls, because this is the one leak
    that makes a model look brilliant and be unbettable.
    """
    if not len(fixture_ids):
        return pd.DataFrame(columns=["fixture_id", "odds_avg_h", "odds_avg_d",
                                     "odds_avg_a", "odds_max_h", "odds_max_d",
                                     "odds_max_a", "captured_at", "book_count"])
    return query_df(
        """
        with latest as (
          select distinct on (mp.fixture_id, mp.bookmaker, mp.selection)
                 mp.fixture_id, mp.bookmaker, mp.selection, mp.odds, mp.captured_at
            from ai.market_prices mp
           where mp.fixture_id = any(%s::uuid[])
             and mp.market = '1X2'
             and mp.captured_at <= %s
           order by mp.fixture_id, mp.bookmaker, mp.selection, mp.captured_at desc
        ), per_book as (
          select fixture_id, bookmaker,
                 max(odds) filter (where selection = 'H') as h,
                 max(odds) filter (where selection = 'D') as d,
                 max(odds) filter (where selection = 'A') as a,
                 max(captured_at) as captured_at
            from latest
           where bookmaker not in ('AVG', 'MAX')
           group by fixture_id, bookmaker
          having count(*) filter (where selection in ('H','D','A')) = 3
        )
        select fixture_id::text as fixture_id,
               avg(h) as odds_avg_h, avg(d) as odds_avg_d, avg(a) as odds_avg_a,
               max(h) as odds_max_h, max(d) as odds_max_d, max(a) as odds_max_a,
               max(captured_at) as captured_at,
               count(*) as book_count
          from per_book
         group by fixture_id
        """,
        ([str(f) for f in fixture_ids], as_of),
    )


def insert_prediction_invalidations(rows: list[dict]) -> int:
    """Quarantine forecasts. Never edits or deletes the forecast itself."""
    if not rows:
        return 0
    cols = ["prediction_id", "reason_code", "evidence", "note"]
    with connect() as conn:
        with conn.cursor() as cur:
            _write_batched(
                cur,
                f"insert into ai.prediction_invalidations ({','.join(cols)}) values ",
                " on conflict (prediction_id, reason_code) do nothing",
                len(cols),
                [tuple(json.dumps(r.get(c) or {}, default=str) if c == "evidence"
                       else r.get(c) for c in cols)
                 for r in rows])
        conn.commit()
    return len(rows)


def insert_recommendations(rows: list[dict]) -> int:
    """Record every decision, including the ones that decided not to bet.

    `ai.bets` records bets. A gate that answers "nothing qualifies today"
    wrote nothing at all, which is indistinguishable from the job not having
    run — and "no selections currently pass the threshold" is a legitimate and
    important answer that has to leave evidence.
    """
    if not rows:
        return 0
    cols = ["prediction_id", "model_id", "league",
            "market", "selection", "kickoff_at",
            "hours_to_kickoff", "decision", "reason_codes", "bookmaker",
            "odds_offered", "odds_captured_at", "odds_age_seconds",
            "calibrated_prob", "fair_odds", "expected_value", "data_confidence",
            "data_confidence_state", "agreement_score", "uncertainty_width",
            "evidence"]
    sql = (f"insert into ai.recommendations ({','.join(cols)}) "
           f"values ({','.join(['%s'] * len(cols))})")
    written = 0
    with connect() as conn:
        with conn.cursor() as cur:
            for r in rows:
                values = []
                for c in cols:
                    v = r.get(c)
                    if c == "evidence" and v is not None:
                        v = json.dumps(v, default=str)
                    values.append(v)
                cur.execute(sql, tuple(values))
                written += cur.rowcount
        conn.commit()
    return written


def update_prediction_diagnosis(rows: list[dict]) -> int:
    """Attach a post-match diagnosis to an already-graded prediction.

    Writes to ai.prediction_results, never to ai.predictions: the prediction is
    what the model said and is immutable; the diagnosis is an opinion formed
    afterwards and belongs beside the grade.
    """
    if not rows:
        return 0
    written = 0
    with connect() as conn:
        with conn.cursor() as cur:
            for r in rows:
                cur.execute(
                    "update ai.prediction_results "
                    "   set diagnosis=%s, diagnosis_evidence=%s, diagnosed_at=now() "
                    " where prediction_id=%s",
                    (r["diagnosis"], json.dumps(r.get("evidence", {}), default=str),
                     r["prediction_id"]),
                )
                written += cur.rowcount
        conn.commit()
    return written


def load_predictions_needing_diagnosis(league: str, limit: int = 500) -> pd.DataFrame:
    """Graded predictions with no diagnosis, and the evidence to judge them by."""
    return query_df(
        """
        select r.prediction_id, p.league, p.home_canonical, p.away_canonical,
               p.kickoff_at, p.horizon, p.p_home, p.p_draw, p.p_away,
               p.predicted_result, p.features, p.data_confidence, p.agreement,
               p.uncertainty, p.model_views,
               r.actual_result, r.actual_home_goals, r.actual_away_goals,
               r.log_loss, r.rps, r.brier,
               rm.home_shots, rm.away_shots, rm.home_shots_ot, rm.away_shots_ot,
               rm.home_corners, rm.away_corners, rm.red_card_distorted,
               rm.mkt_home_prob, rm.mkt_draw_prob, rm.mkt_away_prob
          from ai.prediction_results r
          join ai.valid_predictions p on p.id = r.prediction_id
     left join ai.fixtures f     on f.id = p.fixture_id
     left join ai.raw_matches rm on rm.id = coalesce(p.raw_match_id, f.raw_match_id)
         where p.league = %s
           and r.diagnosis is null
         order by p.kickoff_at desc
         limit %s
        """,
        (league, limit),
    )


def market_snapshot_inventory(league: str | None = None) -> pd.DataFrame:
    """How much timestamped price history actually exists, per fixture.

    Read before any market-timing model is fitted. `ai.market_snapshots` has
    existed since contract 185 and may hold nothing at all; a movement model
    trained on two snapshots per fixture is a model of a rounding error.
    """
    return query_df(
        """
        select ms.season_fixture_id, ms.raw_match_id, ms.bookmaker,
               count(*)                      as snapshots,
               min(ms.captured_at)           as first_seen,
               max(ms.captured_at)           as last_seen,
               bool_or(ms.is_closing)        as has_closing
          from ai.market_snapshots ms
     left join ai.valid_predictions p
            on p.season_fixture_id = ms.season_fixture_id
           and (%s is null or p.league = %s)
         group by 1, 2, 3
        """,
        (league, league),
    )


def insert_prediction_results(rows: list[dict]) -> int:
    if not rows:
        return 0
    cols = [
        "prediction_id", "actual_home_goals", "actual_away_goals", "actual_result",
        "result_correct", "exact_score_correct", "log_loss", "brier", "rps",
        # Contract 185's market comparison columns, which nothing was populating.
        # Every one of Production's 107 graded rows on 18 August 2026 carried a
        # null market_log_loss, so "is the model better than the market" — the
        # only comparison at this sample size that means anything at all — could
        # not be answered from the lab's own record while the closing prices sat
        # in ai.raw_matches beside it. They are null only when no benchmark
        # exists, never because nobody wrote them.
        "mkt_home_closing", "mkt_draw_closing", "mkt_away_closing",
        "market_log_loss", "log_loss_vs_market", "market_moved_toward_model",
    ]
    head = f"insert into ai.prediction_results ({','.join(cols)}) values "
    tail = " on conflict (prediction_id) do nothing"
    with connect() as conn:
        with conn.cursor() as cur:
            _write_batched(cur, head, tail, len(cols),
                           [tuple(r[c] for c in cols) for r in rows])
        conn.commit()
    return len(rows)


# ---------------------------------------------------------------------------
# Model artefacts
#
# A code review found that training wrote a .joblib to the runner's disk,
# .gitignore excluded it, and the workflow uploaded it as a run artefact --
# so a later prediction run on a fresh runner had a database saying "model X
# is current" and no file to load. Artefacts now live in Postgres beside the
# model row: one store, atomic with the metadata, SHA verified on read.
# ---------------------------------------------------------------------------

def store_model_artifact(model_id: str, path) -> str:
    import hashlib
    from pathlib import Path

    payload = Path(path).read_bytes()
    sha = hashlib.sha256(payload).hexdigest()
    with connect() as conn:
        inserted = conn.execute(
            "insert into ai.model_artifacts (model_id, payload, sha256) "
            "values (%s, %s, %s) "
            "on conflict (model_id) do nothing",
            (model_id, payload, sha),
        ).rowcount
        if not inserted:
            existing = conn.execute(
                "select sha256 from ai.model_artifacts where model_id=%s",
                (model_id,),
            ).fetchone()
            if existing is None or existing["sha256"] != sha:
                raise ValueError(
                    f"Model {model_id} already has a different immutable artefact."
                )
        conn.commit()
    return sha


def insert_model_with_artifact(record: dict, path) -> str:
    """Insert model metadata and immutable bytes in one transaction."""
    import hashlib
    from pathlib import Path

    payload = Path(path).read_bytes()
    sha = hashlib.sha256(payload).hexdigest()
    supplied = record.get("artifact_sha256")
    if supplied is not None and supplied != sha:
        raise ValueError("Model metadata SHA does not match the artefact bytes.")
    record = {**record, "artifact_sha256": sha}
    cols = list(record.keys())
    with connect() as conn:
        row = conn.execute(
            f"insert into ai.models ({','.join(cols)}) "
            f"values ({','.join(['%s'] * len(cols))}) returning id",
            tuple(record[c] for c in cols),
        ).fetchone()
        model_id = str(row["id"])
        conn.execute(
            "insert into ai.model_artifacts (model_id, payload, sha256) "
            "values (%s, %s, %s)",
            (model_id, payload, sha),
        )
        conn.commit()
    return model_id


def load_model_artifact(model_id: str):
    """Returns the deserialised bundle, or raises with a useful message.

    Verifies the SHA on the way out. A silently corrupted artefact would
    produce a model that loads and predicts nonsense, which is worse than one
    that fails to load.
    """
    import hashlib
    import io

    import joblib

    with connect() as conn:
        row = conn.execute(
            "select a.payload, a.sha256, m.artifact_sha256 as expected_sha256 "
            "from ai.model_artifacts a join ai.models m on m.id=a.model_id "
            "where a.model_id = %s",
            (model_id,),
        ).fetchone()
    if row is None:
        raise SystemExit(
            f"Model {model_id} is marked current but has no stored artefact. "
            "Re-run train.py; the database trigger should have prevented this."
        )
    actual = hashlib.sha256(row["payload"]).hexdigest()
    if actual != row["sha256"] or actual != row["expected_sha256"]:
        raise SystemExit(f"Artefact for model {model_id} failed its checksum.")
    return joblib.load(io.BytesIO(row["payload"]))


# ---------------------------------------------------------------------------
# ai.fixtures — the lab's own fixture lifecycle
# ---------------------------------------------------------------------------

def upsert_fixtures(rows: list[dict]) -> int:
    if not rows:
        return 0
    cols = ["division", "season", "league_key", "match_date", "kickoff_at",
            "home_canonical", "away_canonical", "season_fixture_id"]
    head = f"insert into ai.fixtures ({','.join(cols)}) values "
    tail = (
        " on conflict (division, match_date, home_canonical, away_canonical) "
        "do update set kickoff_at = coalesce(excluded.kickoff_at, ai.fixtures.kickoff_at), "
        "season_fixture_id = coalesce(excluded.season_fixture_id, "
        "                             ai.fixtures.season_fixture_id)"
    )
    with connect() as conn:
        with conn.cursor() as cur:
            _write_batched(cur, head, tail, len(cols),
                           [tuple(r.get(c) for c in cols) for r in rows])
        conn.commit()
    return len(rows)


def settle_fixtures_from_history() -> int:
    """Attach provider identity and results, regardless of arrival order.

    This is the join that makes the seven leagues without a competition on this
    platform work end to end: Football-Data supplies both the fixture and,
    later, the result, so nothing needs public.season_fixtures at any point.
    """
    changed: set[str] = set()
    with connect() as conn:
        # Identity attachment is independent of status.  A platform result can
        # mark EPL/SPL played before Football-Data publishes its closing line;
        # the later raw row must still attach or CLV is lost forever.
        rows = conn.execute(
            """
            update ai.fixtures f
               set raw_match_id = rm.id
              from ai.raw_matches rm
             where rm.division       = f.division
               and rm.match_date     = f.match_date
               and rm.home_canonical = f.home_canonical
               and rm.away_canonical = f.away_canonical
               and f.raw_match_id is distinct from rm.id
             returning f.id
            """
        ).fetchall()
        changed.update(str(r["id"]) for r in rows)

        rows = conn.execute(
            """
            update ai.fixtures f
               set home_goals = rm.home_goals,
                   away_goals = rm.away_goals,
                   status = 'played'
              from ai.raw_matches rm
             where f.raw_match_id = rm.id
               and f.status = 'scheduled'
             returning f.id
            """
        ).fetchall()
        changed.update(str(r["id"]) for r in rows)
        # Where this platform also runs the competition, take the result from
        # there too: it is confirmed by an operator rather than a provider.
        rows = conn.execute(
            """
            update ai.fixtures f
               set home_goals = sf.home_score,
                   away_goals = sf.away_score,
                   status     = 'played'
              from public.season_fixtures sf
             where f.season_fixture_id = sf.id
               and sf.home_score is not null
               and sf.away_score is not null
               and (f.status <> 'played'
                    or f.home_goals is distinct from sf.home_score
                    or f.away_goals is distinct from sf.away_score)
             returning f.id
            """
        ).fetchall()
        changed.update(str(r["id"]) for r in rows)
        conn.commit()
    return len(changed)


def load_upcoming_ai_fixtures(league_key: str, days_ahead: int = 10):
    return query_df(
        """
        select f.id as fixture_id, f.division, f.season, f.match_date,
               coalesce(f.kickoff_at, f.match_date::timestamptz + interval '15 hours')
                 as kickoff_at,
               f.home_canonical, f.away_canonical, f.season_fixture_id
          from ai.fixtures f
         where f.league_key = %s
           and f.status = 'scheduled'
           and f.match_date between current_date and current_date + %s
         order by 5
        """,
        (league_key, days_ahead),
    )
