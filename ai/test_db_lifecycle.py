"""PostgreSQL integration proof for the two lifecycle variants that matter.

Run with TEST_DATABASE_URL pointing at a disposable PostgreSQL database. The
test applies every migration, then proves:

* parsed SC3 price -> fixture_id -> prediction -> paper bet -> result -> CLV;
* EPL platform result before provider close defers settlement, then finalises;
* lower-league grades/admin evidence remain visible;
* artefact and bet immutability are enforced by the database.
"""
from __future__ import annotations

import hashlib
import json
import os
import re
import sys
from datetime import date, datetime, timedelta, timezone
from pathlib import Path
from unittest import mock

import psycopg
import pytest

import db
import evaluate
import fetch_fixtures_odds
import find_value
import settle_bets


TEST_URL = os.environ.get("TEST_DATABASE_URL")
pytestmark = pytest.mark.skipif(not TEST_URL, reason="TEST_DATABASE_URL not set")


def _bootstrap() -> None:
    os.environ["DATABASE_URL"] = TEST_URL
    with psycopg.connect(TEST_URL, autocommit=True) as conn:
        conn.execute("drop schema if exists ai cascade")
        conn.execute("drop schema if exists predictor_internal cascade")
        conn.execute("drop table if exists public.season_fixtures cascade")
        conn.execute("drop table if exists public.teams cascade")
        conn.execute("drop table if exists public.tournaments cascade")
        conn.execute("""
          do $$ begin
            if not exists (select 1 from pg_roles where rolname='anon') then
              create role anon;
            end if;
            if not exists (select 1 from pg_roles where rolname='authenticated') then
              create role authenticated;
            end if;
            if not exists (select 1 from pg_roles where rolname='service_role') then
              create role service_role;
            end if;
          end $$
        """)
        # `if not exists` so a second run against the same disposable database
        # rebuilds rather than dying on "schema net already exists". CI gets a
        # fresh postgres service every time and never saw it; a local rerun
        # hits it immediately and reads like a broken migration.
        conn.execute("create schema if not exists predictor_internal")
        conn.execute("create schema if not exists net")
        conn.execute("create schema if not exists cron")
        conn.execute("""
          create or replace function predictor_internal.require_competition_admin()
          returns void language plpgsql as $$ begin return; end $$
        """)
        conn.execute("""
          create or replace function predictor_internal.provider_poll_endpoint(
            out endpoint_url text, out caller_key text)
          language sql stable as $$ select null::text, null::text $$
        """)
        conn.execute("""
          create or replace function net.http_post(
            url text, body jsonb default '{}'::jsonb,
            params jsonb default '{}'::jsonb,
            headers jsonb default '{"Content-Type":"application/json"}'::jsonb,
            timeout_milliseconds integer default 1000)
          returns bigint language sql as $$ select 1::bigint $$
        """)
        conn.execute("""
          create or replace function cron.schedule(job_name text, schedule text, command text)
          returns bigint language sql as $$ select 1::bigint $$
        """)
        conn.execute("""
          create table public.tournaments (
            id uuid primary key default gen_random_uuid(),
            name text not null unique,
            status text not null default 'active')
        """)
        conn.execute("""
          create table public.teams (
            id uuid primary key default gen_random_uuid(),
            tournament_id uuid references public.tournaments(id),
            name text not null)
        """)
        conn.execute("""
          create table public.season_fixtures (
            id uuid primary key default gen_random_uuid(),
            tournament_id uuid not null references public.tournaments(id),
            home_team_id uuid not null references public.teams(id),
            away_team_id uuid not null references public.teams(id),
            kickoff_at timestamptz not null,
            status text not null default 'scheduled',
            home_score smallint,
            away_score smallint)
        """)
        # Every AI Lab migration, in timestamp order, rather than one named
        # file. The named form is the same shape of defect the CI workflow's
        # path filter already carried: it pinned
        # `20260812060000_ai_lab_operational_loop.sql`, the file landed at
        # 20260812070000 after a rebase, and the suite silently guarded
        # nothing. A glob cannot go stale when the next contract lands.
        #
        # The glob is `*_ai_*`, not `*_ai_lab_*`. The narrower one matched two
        # of the five AI Lab contracts: 20260813215920_ai_quarantined_evidence_
        # reads, 20260814005000_ai_actionable_bet_evidence and
        # 20260818040000_ai_canonical_bet_evidence all name the subsystem
        # without the word "lab", so contracts 189, 190 and 199 — which are
        # precisely the three that decide what ai.valid_bets counts as evidence
        # — were applied to no test database at all. The suite went green on a
        # schema three contracts behind the one it claims to prove.
        migrations = sorted(
            (Path(__file__).parents[1] / "supabase" / "migrations")
            .glob("*_ai_*.sql"))
        assert migrations, "no AI Lab migrations found to apply"
        for migration in migrations:
            conn.execute(migration.read_text())


def _model(league: str) -> str:
    payload = f"verified-{league}".encode()
    sha = hashlib.sha256(payload).hexdigest()
    with db.connect() as conn:
        row = conn.execute(
            """insert into ai.models
                 (league,version,family,training_matches,artifact_sha256)
               values (%s,%s,'poisson',100,%s) returning id""",
            (league, "integration", sha),
        ).fetchone()
        conn.execute(
            "insert into ai.model_artifacts(model_id,payload,sha256) values(%s,%s,%s)",
            (row["id"], payload, sha),
        )
        conn.commit()
        return str(row["id"])


def _fixture(league: str, division: str, home: str, away: str,
             *, season_fixture_id=None,
             kickoff: datetime | None = None) -> tuple[str, datetime]:
    kickoff = kickoff or (datetime.now(timezone.utc) + timedelta(days=2))
    with db.connect() as conn:
        row = conn.execute(
            """insert into ai.fixtures
                 (division,season,league_key,match_date,kickoff_at,
                  home_canonical,away_canonical,season_fixture_id)
               values (%s,'2627',%s,%s,%s,%s,%s,%s) returning id""",
            (division, league, kickoff.date(), kickoff, home, away,
             season_fixture_id),
        ).fetchone()
        conn.commit()
    return str(row["id"]), kickoff


def _prediction(model_id: str, fixture_id: str, league: str,
                kickoff: datetime, home: str, away: str,
                season_fixture_id=None) -> str:
    # Shaped like a prediction `predict.py` would actually write, because the
    # value gate now reads the evidence columns and a fixture without them is
    # correctly refused. The old row said 75% on a 2.30 shot, which is a
    # thirty-point disagreement with the market — the exact shape
    # PASS_MARKET_DISCREPANCY exists to stop, so the lifecycle it was built to
    # prove could no longer happen.
    with db.connect() as conn:
        row = conn.execute(
            """insert into ai.predictions
                 (model_id,league,fixture_id,season_fixture_id,kickoff_at,
                  home_canonical,away_canonical,p_home,p_draw,p_away,
                  p_home_raw,p_draw_raw,p_away_raw,
                  predicted_result,features,horizon,hours_to_kickoff,
                  features_version,data_confidence,agreement,uncertainty,
                  model_views)
               values (%s,%s,%s,%s,%s,%s,%s,.50,.28,.22,.51,.27,.22,'H','{}',
                       'scheduled',48,'f2',
                       %s,%s,%s,%s) returning id""",
            (model_id, league, fixture_id, season_fixture_id, kickoff, home, away,
             json.dumps({"score": 0.78, "state": "high", "components": [],
                         "missing_inputs": []}),
             json.dumps({"measurable": True, "score": 0.82, "state": "strong",
                         "same_pick": True, "max_pairwise_tv": 0.04}),
             json.dumps({"interval": {"H": [0.46, 0.54], "D": [0.25, 0.31],
                                      "A": [0.19, 0.25]}, "max_width": 0.08,
                         "wide": False}),
             json.dumps({"poisson": [0.50, 0.28, 0.22], "elo": [0.48, 0.29, 0.23]})),
        ).fetchone()
        conn.commit()
        return str(row["id"])


def _run_main(monkeypatch, module, *args: str) -> int:
    monkeypatch.setattr(sys, "argv", [module.__file__, *args])
    return module.main()


def _response(csv: str):
    r = mock.Mock()
    r.status_code = 200
    r.content = csv.encode("latin-1")
    r.raise_for_status = lambda: None
    return r


def _raw_result(division: str, when: date, home: str, away: str,
                hg: int, ag: int) -> str:
    result = "H" if hg > ag else ("D" if hg == ag else "A")
    with db.connect() as conn:
        row = conn.execute(
            """insert into ai.raw_matches
                 (source,division,season,match_date,home_canonical,away_canonical,
                  home_goals,away_goals,result,close_ps_h,close_ps_d,close_ps_a)
               values ('football-data.co.uk',%s,'2627',%s,%s,%s,%s,%s,%s,1.80,3.80,5.00)
               returning id""",
            (division, when, home, away, hg, ag, result),
        ).fetchone()
        conn.commit()
        return str(row["id"])


def test_complete_database_lifecycles(monkeypatch) -> None:
    _bootstrap()

    # SC3: actual parser output must resolve to a canonical fixture id and be
    # visible to find_value, not merely exist as an orphan odds row.
    sl2_model = _model("SL2")
    sl2_fixture, sl2_ko = _fixture("SL2", "SC3", "Elgin", "Peterhead")
    _prediction(sl2_model, sl2_fixture, "SL2", sl2_ko, "Elgin", "Peterhead")
    day = sl2_ko.strftime("%d/%m/%Y")
    csv = (
        "Div,Date,Time,HomeTeam,AwayTeam,B365H,B365D,B365A,AvgH,AvgD,AvgA,"
        "B365>2.5,B365<2.5,AHh,B365AHH,B365AHA\n"
        f"SC3,{day},15:00,Elgin,Peterhead,2.30,3.30,3.10,2.20,3.20,3.00,"
        "1.90,1.95,-0.25,1.94,1.96\n"
    )
    with mock.patch.object(fetch_fixtures_odds.requests, "get",
                           return_value=_response(csv)):
        odds_rows, market_rows = fetch_fixtures_odds.fetch(include_markets=True)
    assert fetch_fixtures_odds.store(odds_rows) == 2
    assert fetch_fixtures_odds.store_market_prices(market_rows) == 4
    candidates = find_value.load_candidates("SL2", "B365")
    assert len(candidates) == 1 and str(candidates.iloc[0]["fixture_id"]) == sl2_fixture
    assert _run_main(monkeypatch, find_value, "--league", "SL2", "--book", "B365") == 0

    with db.connect() as conn:
        bet = conn.execute("select * from ai.bets where league='SL2'").fetchone()
        assert bet is not None and bet["is_paper"]
        # Market fields cannot be rewritten in the same statement that settles.
        with pytest.raises(psycopg.Error):
            conn.execute(
                "update ai.bets set status='settled', market='OU', line=2.5 where id=%s",
                (bet["id"],),
            )
        conn.rollback()

    _raw_result("SC3", sl2_ko.date(), "Elgin", "Peterhead", 2, 0)
    assert db.settle_fixtures_from_history() >= 1
    assert _run_main(monkeypatch, evaluate, "--league", "SL2") == 0
    assert _run_main(monkeypatch, settle_bets, "--league", "SL2") == 0

    with db.connect() as conn:
        result = conn.execute(
            """select r.clv,r.settlement_outcome from ai.bet_results r
                 join ai.bets b on b.id=r.bet_id where b.league='SL2'"""
        ).fetchone()
        assert result["clv"] is not None and result["settlement_outcome"] == "win"
        recent = conn.execute(
            "select public.admin_ai_recent_results('SL2',50) as body"
        ).fetchone()["body"]
        assert len(recent) == 1
        evidence = conn.execute(
            "select public.admin_ai_evidence_by_market() as body"
        ).fetchone()["body"]["1X2"]
        assert evidence["settled_bets"] == 1
        assert evidence["clv_observations"] == 1

        # The generic persistence layer accepts a non-1X2 selection.
        conn.execute(
            """insert into ai.bets
                 (prediction_id,model_id,league,fixture_id,selection,kickoff_at,
                  bookmaker,odds_taken,model_prob,edge,stake_fraction,stake_units,
                  market,line,selection_label)
               select p.id,p.model_id,p.league,p.fixture_id,'Over',p.kickoff_at,
                      'B365',1.95,.55,.0725,.01,1,'OU',2.5,'Over 2.5'
                 from ai.predictions p where p.league='SL2'"""
        )
        conn.commit()

    # EPL: the platform result arrives first. Settlement must wait for a close,
    # and the later raw match must attach even though the fixture is played.
    with db.connect() as conn:
        tournament = conn.execute(
            "insert into public.tournaments(name) values('Premier League 2026/27') returning id"
        ).fetchone()["id"]
        home_id = conn.execute(
            "insert into public.teams(tournament_id,name) values(%s,'Arsenal FC') returning id",
            (tournament,),
        ).fetchone()["id"]
        away_id = conn.execute(
            "insert into public.teams(tournament_id,name) values(%s,'Chelsea FC') returning id",
            (tournament,),
        ).fetchone()["id"]
        epl_ko = datetime.now(timezone.utc) + timedelta(days=3)
        sf = conn.execute(
            """insert into public.season_fixtures
                 (tournament_id,home_team_id,away_team_id,kickoff_at)
               values(%s,%s,%s,%s) returning id""",
            (tournament, home_id, away_id, epl_ko),
        ).fetchone()["id"]
        conn.commit()

    epl_model = _model("EPL")
    epl_fixture, _ = _fixture(
        "EPL", "E0", "Arsenal", "Chelsea", season_fixture_id=sf,
        kickoff=epl_ko)
    _prediction(epl_model, epl_fixture, "EPL", epl_ko,
                "Arsenal", "Chelsea", season_fixture_id=sf)
    rows = []
    captured = datetime.now(timezone.utc)
    for book, prices in (("B365", (2.2, 3.4, 3.3)), ("AVG", (2.1, 3.3, 3.2))):
        rows.append({
            "division": "E0", "match_date": epl_ko.date(),
            "home_canonical": "Arsenal", "away_canonical": "Chelsea",
            "bookmaker": book, "odds_h": prices[0], "odds_d": prices[1],
            "odds_a": prices[2], "captured_at": captured,
        })
    assert fetch_fixtures_odds.store(rows) == 2
    assert _run_main(monkeypatch, find_value, "--league", "EPL", "--book", "B365") == 0

    with db.connect() as conn:
        conn.execute(
            "update public.season_fixtures set status='played',home_score=1,away_score=0 where id=%s",
            (sf,),
        )
        conn.commit()
    db.settle_fixtures_from_history()
    assert _run_main(monkeypatch, settle_bets, "--league", "EPL") == 0
    with db.connect() as conn:
        # The result is authoritative, so the OUTCOME settles now. The closing
        # benchmark has not been published, so the CLV columns stay null rather
        # than holding the bet unsettled: an unavailable benchmark is a missing
        # measurement, not an unresolved bet.
        before = conn.execute(
            """select b.status, r.settlement_outcome, r.pnl_units, r.clv,
                      r.clv_benchmark, r.odds_closing
                 from ai.bets b join ai.bet_results r on r.bet_id = b.id
                where b.league='EPL'"""
        ).fetchone()
        assert before["status"] == "settled"
        assert before["settlement_outcome"] == "win"
        assert before["pnl_units"] is not None
        assert before["clv"] is None
        assert before["clv_benchmark"] is None
        assert before["odds_closing"] is None

    raw_id = _raw_result("E0", epl_ko.date(), "Arsenal", "Chelsea", 1, 0)
    db.settle_fixtures_from_history()
    with db.connect() as conn:
        attached = conn.execute(
            "select raw_match_id from ai.fixtures where id=%s", (epl_fixture,)
        ).fetchone()
        assert str(attached["raw_match_id"]) == raw_id
    assert _run_main(monkeypatch, settle_bets, "--league", "EPL") == 0
    with db.connect() as conn:
        # The benchmark has arrived, so the second pass fills the CLV columns
        # of a row that was already settled — WITHOUT touching the outcome or
        # the profit that were recorded when the result was known.
        filled = conn.execute(
            """select r.clv, r.clv_benchmark, r.odds_closing, r.beat_closing_price,
                      r.settlement_outcome, r.pnl_units
                 from ai.bet_results r join ai.bets b on b.id=r.bet_id
                where b.league='EPL'"""
        ).fetchone()
        assert filled["clv"] is not None
        assert filled["clv_benchmark"] in ("PS", "AVG")
        assert filled["odds_closing"] is not None
        assert filled["beat_closing_price"] is not None
        assert filled["settlement_outcome"] == "win"
        assert filled["pnl_units"] is not None

        # Stored artefact bytes cannot be replaced under the same model id.
        with pytest.raises(psycopg.Error):
            conn.execute(
                "update ai.model_artifacts set payload=%s where model_id=%s",
                (b"replacement", epl_model),
            )
        conn.rollback()


def test_contract_186_evidence_lifecycle(monkeypatch) -> None:
    """The evidence tables, proved against a real PostgreSQL rather than read.

    Five properties, each of which would otherwise be a comment:
      * one prediction per (model, fixture, horizon), so a rerun is a no-op
        and a 48-hour forecast and a post-team-sheet one can both exist;
      * `ai.observations_as_of` cannot return a fact learned after the instant
        asked about — the guarantee a backtest depends on;
      * a recommendation is append-only and cannot be recorded after kickoff;
      * a PASS must carry a reason;
      * the diagnosis vocabulary is enforced by the database, so a category
        added in Python without one here fails on insert rather than silently.
    """
    _bootstrap()
    model = _model("EPL")
    fixture, kickoff = _fixture("EPL", "E0", "Arsenal", "Chelsea")
    prediction = _prediction(model, fixture, "EPL", kickoff, "Arsenal", "Chelsea")

    with db.connect() as conn:
        # 1. Horizon idempotency. The same horizon twice is refused; a
        #    different horizon for the same fixture is a different forecast.
        with pytest.raises(psycopg.errors.UniqueViolation):
            conn.execute(
                """insert into ai.predictions
                     (model_id,league,fixture_id,kickoff_at,home_canonical,
                      away_canonical,p_home,p_draw,p_away,predicted_result,
                      features,horizon)
                   values (%s,'EPL',%s,%s,'Arsenal','Chelsea',.5,.28,.22,'H',
                           '{}','scheduled')""",
                (model, fixture, kickoff),
            )
        conn.rollback()
        conn.execute(
            """insert into ai.predictions
                 (model_id,league,fixture_id,kickoff_at,home_canonical,
                  away_canonical,p_home,p_draw,p_away,predicted_result,
                  features,horizon)
               values (%s,'EPL',%s,%s,'Arsenal','Chelsea',.55,.25,.20,'H',
                       '{}','t24')""",
            (model, fixture, kickoff),
        )
        conn.commit()
        assert conn.execute(
            "select count(*) as n from ai.predictions where fixture_id=%s",
            (fixture,)).fetchone()["n"] == 2

        # 2. observations_as_of: a fact recorded late is invisible early.
        learned_late = datetime.now(timezone.utc)
        conn.execute(
            """insert into ai.observations
                 (subject_type,subject_key,fact_type,applies_from,known_at,
                  value,source)
               values ('team','Arsenal','manager',%s,%s,
                       '{"manager":"Someone New"}','test')""",
            (learned_late - timedelta(days=1), learned_late),
        )
        conn.commit()
        before = conn.execute(
            "select count(*) as n from ai.observations_as_of(%s,'manager','team')",
            (learned_late - timedelta(hours=1),)).fetchone()["n"]
        after = conn.execute(
            "select count(*) as n from ai.observations_as_of(%s,'manager','team')",
            (learned_late + timedelta(hours=1),)).fetchone()["n"]
        assert before == 0, "a backtest could see a fact recorded after it"
        assert after == 1

        # 3-4. The decision log.
        conn.execute(
            """insert into ai.recommendations
                 (prediction_id,model_id,league,selection,kickoff_at,decision,
                  reason_codes,calibrated_prob,expected_value)
               values (%s,%s,'EPL','H',%s,'PASS','{PASS_STALE_PRICE}',.5,-.02)""",
            (prediction, model, kickoff),
        )
        conn.commit()
        with pytest.raises(psycopg.Error):
            conn.execute("update ai.recommendations set decision='BET'")
        conn.rollback()
        with pytest.raises(psycopg.Error):
            conn.execute(
                """insert into ai.recommendations
                     (prediction_id,model_id,league,selection,kickoff_at,
                      decision,reason_codes)
                   values (%s,%s,'EPL','H',%s,'PASS','{}')""",
                (prediction, model, kickoff),
            )
        conn.rollback()
        with pytest.raises(psycopg.Error):
            conn.execute(
                """insert into ai.recommendations
                     (prediction_id,model_id,league,selection,kickoff_at,
                      decision,reason_codes,decided_at)
                   values (%s,%s,'EPL','H',%s,'BET','{}',%s)""",
                (prediction, model, kickoff, kickoff + timedelta(hours=1)),
            )
        conn.rollback()

        # 5. The diagnosis vocabulary, and the admin read that surfaces it.
        conn.execute(
            """insert into ai.prediction_results
                 (prediction_id,actual_home_goals,actual_away_goals,actual_result,
                  result_correct,exact_score_correct,log_loss,brier,rps)
               values (%s,0,1,'A',false,false,1.6,.9,.4)""",
            (prediction,),
        )
        conn.commit()
        conn.execute(
            "update ai.prediction_results set diagnosis='NORMAL_VARIANCE' "
            " where prediction_id=%s", (prediction,))
        conn.commit()
        with pytest.raises(psycopg.Error):
            conn.execute(
                "update ai.prediction_results set diagnosis='PROBABLY_FINE' "
                " where prediction_id=%s", (prediction,))
        conn.rollback()

        log = conn.execute(
            "select public.admin_ai_recommendation_log('EPL',10) as body"
        ).fetchone()["body"]
        assert len(log["recommendations"]) == 1
        assert log["recommendations"][0]["decision"] == "PASS"
        assert log["reason_code_counts_90d"] == {"PASS_STALE_PRICE": 1}


def test_the_provider_identity_chain_is_repaired_without_a_provider_call():
    """The 13 August 2026 Production defect, reproduced and then repaired.

    Reproduced faithfully: an event retained with the RAW provider spelling in
    `home_team`/`away_team` and the decoder's uncorrected value in the
    canonical columns, resolved to a fixture created under that wrong identity,
    with prices and a bridged odds row hanging off it and a prediction written
    against it. That is exactly the state fifty-two Production events were in.
    """
    _bootstrap()
    kickoff = datetime.now(timezone.utc) + timedelta(days=2)
    with db.connect() as conn:
        # Leicester's history, under the canonical name the history uses.
        for i in range(12):
            conn.execute(
                """insert into ai.raw_matches
                     (division,season,match_date,home_canonical,away_canonical,
                      home_goals,away_goals,result)
                   values ('E1','2526',%s,'Leicester','Blackburn',2,1,'H')""",
                (kickoff.date() - timedelta(days=30 + i * 7),))
        # And the wrong fixture, as the poisoned pipeline created it.
        wrong = conn.execute(
            """insert into ai.fixtures
                 (division,season,league_key,match_date,kickoff_at,
                  home_canonical,away_canonical)
               values ('E2','2627','EL1',%s,%s,'Notts County','Leicester City')
               returning id""",
            (kickoff.date(), kickoff)).fetchone()["id"]
        conn.execute(
            """insert into ai.odds_api_events
                 (event_id,sport_key,commence_time,home_team,away_team,
                  home_canonical,away_canonical,fixture_id,matched_by)
               values ('evt-1','soccer_england_league1',%s,
                       'Notts County','Leicester City',
                       'Notts County','Leicester City',%s,'alias')""",
            (kickoff, wrong))
        for selection, odds in (("H", 1.4), ("D", 4.5), ("A", 7.0)):
            conn.execute(
                """insert into ai.market_prices
                     (fixture_id,market,selection,bookmaker,odds,captured_at,source)
                   values (%s,'1X2',%s,'B365',%s,now(),'the-odds-api')""",
                (wrong, selection, odds))
        conn.execute(
            """insert into ai.fixture_odds
                 (fixture_id,division,match_date,home_canonical,away_canonical,
                  bookmaker,odds_h,odds_d,odds_a,captured_at,source)
               values (%s,'E2',%s,'Notts County','Leicester City',
                       'B365',1.4,4.5,7.0,now(),'the-odds-api')""",
            (wrong, kickoff.date()))
        model = conn.execute(
            """insert into ai.models (league,version,family,training_matches,
                                      artifact_sha256)
               values ('EL1','identity','poisson',10,%s) returning id""",
            (hashlib.sha256(b"identity").hexdigest(),)).fetchone()["id"]
        prediction = conn.execute(
            """insert into ai.predictions
                 (model_id,league,fixture_id,kickoff_at,home_canonical,
                  away_canonical,p_home,p_draw,p_away,predicted_result,
                  exp_home_goals,exp_away_goals,features,horizon,
                  hours_to_kickoff,features_version)
               values (%s,'EL1',%s,%s,'Notts County','Leicester City',
                       .99659,.00327,.00014,'H',6.0,.05,%s,'scheduled',48,'f2')
               returning id""",
            (model, wrong, kickoff,
             json.dumps({"home_matches_known": 10.0, "away_matches_known": 0.0,
                         "away_is_newcomer": 1.0}))).fetchone()["id"]
        conn.commit()

        # The authority already knows the answer. Nothing had ever asked it.
        assert conn.execute(
            "select canonical from ai.canonical_from_odds_api('Leicester City')"
        ).fetchone()["canonical"] == "Leicester"

        report = conn.execute(
            "select ai.repair_provider_identity() as r").fetchone()["r"]
        conn.commit()

    assert report["provider_requests_made"] == 0
    assert report["events_corrected"] == 1
    assert report["events_relinked"] == 1
    assert report["market_prices_repointed"] == 3
    assert report["fixture_odds_deleted"] == 1

    with db.connect() as conn:
        event = conn.execute(
            "select * from ai.odds_api_events where event_id='evt-1'").fetchone()
        assert event["away_canonical"] == "Leicester"
        assert event["home_team"] == "Notts County", "the raw name is evidence"
        assert str(event["fixture_id"]) != str(wrong), "a corrected identity relinks"

        fixed = conn.execute(
            "select * from ai.fixtures where id=%s", (event["fixture_id"],)
        ).fetchone()
        assert fixed["away_canonical"] == "Leicester"

        # Evidence follows identity; the derived projection is rebuilt.
        moved = conn.execute(
            "select count(*) as n from ai.market_prices where fixture_id=%s",
            (event["fixture_id"],)).fetchone()["n"]
        assert moved == 3
        assert conn.execute(
            "select count(*) as n from ai.fixture_odds where fixture_id=%s",
            (wrong,)).fetchone()["n"] == 0

        # The stale fixture is voided rather than deleted, so the prediction
        # that references it survives as a record and leaves every value path.
        assert conn.execute(
            "select status from ai.fixtures where id=%s", (wrong,)
        ).fetchone()["status"] == "void"

        # The ledger names what changed.
        repair = conn.execute(
            "select * from ai.provider_identity_repairs").fetchone()
        assert repair["old_away_canonical"] == "Leicester City"
        assert repair["new_away_canonical"] == "Leicester"
        with pytest.raises(psycopg.Error):
            conn.execute("update ai.provider_identity_repairs set raw_home='x'")
        conn.rollback()

        # Idempotent: a second run finds nothing left to do.
        again = conn.execute(
            "select ai.repair_provider_identity() as r").fetchone()["r"]
        conn.commit()
        assert again["events_corrected"] == 0

        # And the forecast built on the broken identity is quarantined rather
        # than edited or deleted.
        dry = conn.execute(
            "select ai.quarantine_identity_defective_predictions("
            "  'INVALID_TEAM_IDENTITY', true) as r").fetchone()["r"]
        assert dry["matched"] == 1
        assert conn.execute(
            "select count(*) as n from ai.prediction_invalidations"
        ).fetchone()["n"] == 0, "a dry run must write nothing"

        applied = conn.execute(
            "select ai.quarantine_identity_defective_predictions("
            "  'INVALID_TEAM_IDENTITY', false) as r").fetchone()["r"]
        conn.commit()
        assert applied["matched"] == 1

        assert conn.execute(
            "select count(*) as n from ai.predictions where id=%s",
            (prediction,)).fetchone()["n"] == 1, "the record is never deleted"
        assert conn.execute(
            "select count(*) as n from ai.valid_predictions where id=%s",
            (prediction,)).fetchone()["n"] == 0, "and never counted as evidence"

        with pytest.raises(psycopg.Error):
            conn.execute("delete from ai.prediction_invalidations")
        conn.rollback()


def test_an_invalidated_prediction_cannot_become_a_bet_builder_leg():
    """The structural half of the quarantine.

    Marking a prediction invalid has to remove it from every evidence path, not
    only from the report that reads the flag. The bounded Bet Builder read
    joins `ai.valid_predictions`, so a quarantined forecast disappears from it
    even though its `ai.recommendations` row still exists.
    """
    _bootstrap()
    kickoff = datetime.now(timezone.utc) + timedelta(days=2)
    with db.connect() as conn:
        fixture = conn.execute(
            """insert into ai.fixtures
                 (division,season,league_key,match_date,kickoff_at,
                  home_canonical,away_canonical)
               values ('E0','2627','EPL',%s,%s,'Arsenal','Leeds') returning id""",
            (kickoff.date(), kickoff)).fetchone()["id"]
        model = conn.execute(
            """insert into ai.models (league,version,family,training_matches,
                                      artifact_sha256)
               values ('EPL','bb','poisson',10,%s) returning id""",
            (hashlib.sha256(b"bb").hexdigest(),)).fetchone()["id"]
        prediction = conn.execute(
            """insert into ai.predictions
                 (model_id,league,fixture_id,kickoff_at,home_canonical,
                  away_canonical,p_home,p_draw,p_away,predicted_result,
                  features,horizon,hours_to_kickoff,features_version)
               values (%s,'EPL',%s,%s,'Arsenal','Leeds',.55,.25,.20,'H','{}',
                       'scheduled',48,'f2') returning id""",
            (model, fixture, kickoff)).fetchone()["id"]
        conn.execute(
            """insert into ai.recommendations
                 (prediction_id,model_id,league,selection,kickoff_at,decision,
                  reason_codes,bookmaker,odds_offered,odds_captured_at,
                  calibrated_prob,expected_value,data_confidence)
               values (%s,%s,'EPL','H',%s,'BET','{}','B365',2.1,now(),
                       .55,.155,.72)""",
            (prediction, model, kickoff))
        conn.commit()

        body = conn.execute(
            "select public.admin_ai_bet_builder_candidates('B365') as b"
        ).fetchone()["b"]
        assert body["leg_count"] == 1
        assert body["legs"][0]["selection"] == "H"
        assert body["bookmaker"]["is_real_price"] is True
        assert body["legs"][0]["price_age_limit_seconds"] == 43200

        # A PASS is never a leg.
        assert conn.execute(
            "select count(*) as n from ai.recommendations "
            " where decision='BET'").fetchone()["n"] == 1

        conn.execute(
            "insert into ai.prediction_invalidations (prediction_id,reason_code) "
            "values (%s,'INVALID_TEAM_IDENTITY')", (prediction,))
        conn.commit()

        after = conn.execute(
            "select public.admin_ai_bet_builder_candidates('B365') as b"
        ).fetchone()["b"]
        assert after["leg_count"] == 0, (
            "a quarantined prediction must leave the Bet Builder, not merely "
            "be flagged inside it")


def test_a_pass_is_never_offered_as_a_bet_builder_leg():
    _bootstrap()
    kickoff = datetime.now(timezone.utc) + timedelta(days=2)
    with db.connect() as conn:
        fixture = conn.execute(
            """insert into ai.fixtures
                 (division,season,league_key,match_date,kickoff_at,
                  home_canonical,away_canonical)
               values ('E0','2627','EPL',%s,%s,'Arsenal','Leeds') returning id""",
            (kickoff.date(), kickoff)).fetchone()["id"]
        model = conn.execute(
            """insert into ai.models (league,version,family,training_matches,
                                      artifact_sha256)
               values ('EPL','pass','poisson',10,%s) returning id""",
            (hashlib.sha256(b"pass").hexdigest(),)).fetchone()["id"]
        prediction = conn.execute(
            """insert into ai.predictions
                 (model_id,league,fixture_id,kickoff_at,home_canonical,
                  away_canonical,p_home,p_draw,p_away,predicted_result,
                  features,horizon,hours_to_kickoff,features_version)
               values (%s,'EPL',%s,%s,'Arsenal','Leeds',.55,.25,.20,'H','{}',
                       'scheduled',48,'f2') returning id""",
            (model, fixture, kickoff)).fetchone()["id"]
        conn.execute(
            """insert into ai.recommendations
                 (prediction_id,model_id,league,selection,kickoff_at,decision,
                  reason_codes,bookmaker,odds_offered,odds_captured_at,
                  calibrated_prob,expected_value,data_confidence)
               values (%s,%s,'EPL','H',%s,'PASS','{PASS_LOW_DATA}','B365',2.1,
                       now(),.55,.155,.30)""",
            (prediction, model, kickoff))
        conn.commit()
        body = conn.execute(
            "select public.admin_ai_bet_builder_candidates('B365') as b"
        ).fetchone()["b"]
        assert body["leg_count"] == 0


def test_the_sql_freshness_limits_match_the_python_policy():
    """`ai.price_age_limit_seconds` mirrors `value_engine.FreshnessPolicy`.

    Two implementations exist because two languages need one; this is what
    stops them drifting. The Python side of the same table is asserted in
    `test_identity_and_gates.py`.
    """
    _bootstrap()
    import value_engine

    with db.connect() as conn:
        for hours, aggregate in ((1.0, False), (2.0, False), (2.001, False),
                                 (8.0, False), (8.001, False), (48.0, False),
                                 (1.0, True), (8.0, True), (48.0, True)):
            sql = conn.execute(
                "select ai.price_age_limit_seconds(%s::double precision,%s) as s",
                (hours, aggregate)
            ).fetchone()["s"]
            python = value_engine.FreshnessPolicy().limit_for(hours, aggregate)
            assert sql == python.total_seconds(), (hours, aggregate)


def test_the_budget_allowance_is_measured_from_provider_headers():
    """Contract 188's quota reconciliation, and its refusal to guess.

    Installed at 500 monthly credits with a 450 soft cap while the provider's
    own headers reported an allowance of 20,000. The reconciliation reads the
    retained headers and makes no request.
    """
    _bootstrap()
    with db.connect() as conn:
        conn.execute(
            """insert into ai.api_usage
                 (provider,endpoint,http_status,estimated_cost,
                  reported_used,reported_remaining)
               values ('the-odds-api','odds',200,1,20,19980)""")
        conn.commit()

        report = conn.execute(
            "select ai.reconcile_api_budget('the-odds-api', false) as r"
        ).fetchone()["r"]
        conn.commit()
        assert report["observed_period_credits"] == 20000
        assert report["disagrees"] is True
        assert report["provider_requests_made"] == 0
        assert conn.execute(
            "select monthly_credits from ai.api_budget "
            " where provider='the-odds-api'").fetchone()["monthly_credits"] == 500, (
            "without --apply the configuration must not move")

        applied = conn.execute(
            "select ai.reconcile_api_budget('the-odds-api', true) as r"
        ).fetchone()["r"]
        conn.commit()
        assert applied["provider_requests_made"] == 0
        row = conn.execute(
            "select monthly_credits, soft_cap, soft_cap_fraction, reserve_note "
            "  from ai.api_budget where provider='the-odds-api'").fetchone()
        assert row["monthly_credits"] == 20000
        # A FRACTION, so a future plan change moves the cap with it rather than
        # leaving a hard-coded 450 behind again.
        assert row["soft_cap"] == 18000
        assert float(row["soft_cap_fraction"]) == 0.900
        assert "provider headers" in row["reserve_note"]

        again = conn.execute(
            "select ai.reconcile_api_budget('the-odds-api', false) as r"
        ).fetchone()["r"]
        assert again["disagrees"] is False


def test_the_snapshot_consumer_ignores_a_stale_decoder_alias_table():
    """The Edge Function's twelve-entry alias table is no longer authoritative.

    `record_ai_odds_snapshot` re-derives identity from
    `ai.canonical_from_odds_api` and reports how often the decoder disagreed,
    so a decoder that has never heard of Leicester City cannot poison a row.
    """
    _bootstrap()
    kickoff = datetime.now(timezone.utc) + timedelta(days=3)
    payload = [{
        "event_id": "evt-decoder", "sport_key": "soccer_england_league1",
        "commence_time": kickoff.isoformat(),
        "home_team": "Notts County", "away_team": "Leicester City",
        # What the Edge Function's own table produces: unchanged.
        "home_canonical": "Notts County", "away_canonical": "Leicester City",
        "market": "1X2", "selection": "H", "bookmaker": "B365",
        "odds": 1.4, "captured_at": datetime.now(timezone.utc).isoformat(),
    }]
    with db.connect() as conn:
        conn.execute(
            """insert into ai.fixtures
                 (division,season,league_key,match_date,kickoff_at,
                  home_canonical,away_canonical)
               values ('E2','2627','EL1',%s,%s,'Notts County','Leicester')""",
            (kickoff.date(), kickoff))
        conn.commit()
        report = conn.execute(
            "select public.record_ai_odds_snapshot("
            "  'https://api.the-odds-api.com/v4/sports/soccer_england_league1/odds',200,'{}'::jsonb,'[]',"
            "  %s::jsonb,1,1,19979,21,'test') as r",
            (json.dumps(payload),)).fetchone()["r"]
        conn.commit()

        assert report["decoder_identity_corrected"] == 1
        event = conn.execute(
            "select * from ai.odds_api_events where event_id='evt-decoder'"
        ).fetchone()
        assert event["away_canonical"] == "Leicester"
        assert event["fixture_id"] is not None
        assert event["matched_by"] == "alias"
        assert report["prices_written"] == 1


def test_a_price_captured_after_the_snapshot_cannot_reach_a_market_model():
    """The leakage test, executed rather than asserted from the query text.

    A market-informed model must see the prices that existed when the forecast
    was made and nothing later. The closing line is the benchmark this lab is
    measured against; a model given it beats every benchmark and can never be
    bet, because at the moment a bet is placed the number does not exist.
    """
    _bootstrap()
    kickoff = datetime.now(timezone.utc) + timedelta(days=2)
    snapshot = datetime.now(timezone.utc)
    with db.connect() as conn:
        fixture = conn.execute(
            """insert into ai.fixtures
                 (division,season,league_key,match_date,kickoff_at,
                  home_canonical,away_canonical)
               values ('E0','2627','EPL',%s,%s,'Arsenal','Leeds') returning id""",
            (kickoff.date(), kickoff)).fetchone()["id"]
        # Before the snapshot: the prices a forecast made then could have seen.
        for selection, odds in (("H", 2.10), ("D", 3.40), ("A", 3.60)):
            conn.execute(
                """insert into ai.market_prices
                     (fixture_id,market,selection,bookmaker,odds,captured_at,source)
                   values (%s,'1X2',%s,'B365',%s,%s,'the-odds-api')""",
                (fixture, selection, odds, snapshot - timedelta(hours=6)))
        # After it: the closing line, which must be invisible.
        for selection, odds in (("H", 1.40), ("D", 5.00), ("A", 9.00)):
            conn.execute(
                """insert into ai.market_prices
                     (fixture_id,market,selection,bookmaker,odds,captured_at,source)
                   values (%s,'1X2',%s,'B365',%s,%s,'the-odds-api')""",
                (fixture, selection, odds, snapshot + timedelta(hours=1)))
        conn.commit()

    at_snapshot = db.load_market_snapshot([fixture], snapshot)
    assert len(at_snapshot) == 1
    row = at_snapshot.iloc[0]
    assert float(row["odds_avg_h"]) == 2.10, "the closing price leaked in"
    assert float(row["odds_avg_a"]) == 3.60
    assert int(row["book_count"]) == 1

    # And the later view does see it, so the bound is doing the work rather
    # than the row simply being absent.
    later = db.load_market_snapshot([fixture], snapshot + timedelta(hours=2))
    assert float(later.iloc[0]["odds_avg_h"]) == 1.40

    # Aggregates are excluded from the model's own market block: AVG and MAX
    # are derived from the very books being averaged, so including them would
    # count the same evidence twice.
    with db.connect() as conn:
        for selection, odds in (("H", 2.50), ("D", 3.50), ("A", 3.50)):
            conn.execute(
                """insert into ai.market_prices
                     (fixture_id,market,selection,bookmaker,odds,captured_at,source)
                   values (%s,'1X2',%s,'MAX',%s,%s,'the-odds-api')""",
                (fixture, selection, odds, snapshot - timedelta(hours=6)))
        conn.commit()
    assert int(db.load_market_snapshot([fixture], snapshot).iloc[0]["book_count"]) == 1


def test_a_model_row_and_its_artefact_agree_after_a_round_trip():
    """Contract 188's provenance columns, written and read back.

    Both are written in ONE transaction, so a disagreement between them is
    undetectable afterwards: the row says `uses_market = false`, the bytes hold
    a market-informed model, and every later question is answered from the row.
    """
    _bootstrap()
    import joblib
    import pandas as pd

    import train
    from artifacts import ARTIFACT_SCHEMA, ModelBundle
    from fitting import fit_family
    from features import FeatureBuilder, feature_names
    from market_features import MARKET_FEATURE_NAMES, build_market_block
    from test_models import synthetic_history

    history = synthetic_history(seasons=8, start_year=2016)
    frame = FeatureBuilder("E0").build_training_frame(history)
    frame = frame[frame["home_matches_known"] + frame["away_matches_known"] >= 6]
    frame = frame.reset_index(drop=True)
    rng = __import__("numpy").random.default_rng(9)
    frame["odds_avg_h"] = rng.uniform(1.6, 4.0, len(frame))
    frame["odds_avg_d"] = rng.uniform(3.0, 4.5, len(frame))
    frame["odds_avg_a"] = rng.uniform(1.8, 6.0, len(frame))
    frame = pd.concat([frame, build_market_block(frame)], axis=1)
    columns = list(feature_names(("core",))) + list(MARKET_FEATURE_NAMES)

    model = fit_family("market", frame, columns, 900.0)
    bundle = ModelBundle(
        model=model, features=columns, features_version="f2",
        feature_groups=("core", "market"), family="market", league="EPL",
        version="roundtrip", half_life_days=900.0,
        elo_transition="division_mean", calibrator=None, components={},
        trained_through=pd.to_datetime(frame["match_date"].max()).date(),
        schema=ARTIFACT_SCHEMA, metadata={})

    path = Path("/tmp/roundtrip.joblib")
    joblib.dump(bundle.to_payload(), path)
    record = {
        "league": "EPL", "version": "roundtrip", "family": "market",
        "training_matches": len(frame),
        "eval_training_matches": len(frame) - 200,
        "final_trained_through": bundle.trained_through,
        "features_used": columns, "features_version": "f2",
        "feature_groups": ["core", "market"], "half_life_days": 900.0,
        "elo_transition": "division_mean", "calibration_method": "identity",
        "component_families": None, "meta_model": None,
        "uses_market": True, "status": "challenger",
    }
    train.assert_provenance_agrees(record, bundle)
    model_id = db.insert_model_with_artifact(record, path)

    with db.connect() as conn:
        row = conn.execute("select * from ai.models where id=%s", (model_id,)).fetchone()
    stored = ModelBundle.from_payload(db.load_model_artifact(model_id))

    assert row["uses_market"] is True
    assert bool(getattr(stored.model, "uses_market", False)) is True
    assert row["family"] == stored.family == "market"
    assert list(row["features_used"]) == list(stored.features)
    assert row["features_version"] == stored.features_version
    assert list(row["feature_groups"]) == list(stored.feature_groups)
    assert float(row["half_life_days"]) == float(stored.half_life_days)
    assert row["elo_transition"] == stored.elo_transition
    assert row["final_trained_through"] == stored.trained_through
    assert row["training_matches"] == len(frame)
    # The two fits are two different numbers and now have two columns.
    assert row["eval_training_matches"] < row["training_matches"]


def test_a_bet_from_a_quarantined_forecast_never_becomes_betting_evidence():
    """Section 4's other half: the paper record must not carry the bad bets.

    Twenty-two of Production's forty-nine paper selections were advised from a
    prediction whose club identity was broken. Settling them would put their
    CLV and profit into the lab's own betting record — which is the number the
    publication gate reads — for selections chosen by a model that had been
    told one of the clubs had never played a match.
    """
    _bootstrap()
    # Scheduled first, then played. `ai.predictions` refuses a row created
    # after kickoff and `ai.fixtures` refuses a future fixture with a score, so
    # the only way to build a settleable bet is in the order it really happens.
    kickoff = datetime.now(timezone.utc) + timedelta(days=2)
    played = datetime.now(timezone.utc) - timedelta(days=1)
    with db.connect() as conn:
        model = conn.execute(
            """insert into ai.models (league,version,family,training_matches,
                                      artifact_sha256)
               values ('EPL','settle','poisson',10,%s) returning id""",
            (hashlib.sha256(b"settle").hexdigest(),)).fetchone()["id"]

        predictions, fixtures = [], []
        for index in range(2):
            fixture = conn.execute(
                """insert into ai.fixtures
                     (division,season,league_key,match_date,kickoff_at,
                      home_canonical,away_canonical)
                   values ('E0','2627','EPL',%s,%s,%s,%s) returning id""",
                (kickoff.date(), kickoff, f"Arsenal {index}", f"Leeds {index}")
            ).fetchone()["id"]
            fixtures.append(fixture)
            row = conn.execute(
                """insert into ai.predictions
                     (model_id,league,fixture_id,kickoff_at,home_canonical,
                      away_canonical,p_home,p_draw,p_away,predicted_result,
                      features,horizon,hours_to_kickoff,features_version)
                   values (%s,'EPL',%s,%s,%s,%s,.55,.25,.20,'H','{}',
                           'scheduled',48,'f2') returning id""",
                (model, fixture, kickoff, f"Arsenal {index}", f"Leeds {index}")
            ).fetchone()
            predictions.append(row["id"])
            conn.execute(
                """insert into ai.bets
                     (prediction_id,model_id,league,fixture_id,selection,
                      kickoff_at,bookmaker,odds_taken,model_prob,edge,
                      stake_fraction,stake_units,is_paper,status,market)
                   values (%s,%s,'EPL',%s,'H',%s,'B365',2.1,.55,.155,.01,1,
                           true,'advised','1X2')""",
                (row["id"], model, fixture, kickoff))

        # One of the two is quarantined, and then both matches are played.
        conn.execute(
            "insert into ai.prediction_invalidations (prediction_id, reason_code) "
            "values (%s,'HISTORY_ALIAS_MISMATCH')", (predictions[0],))
        for fixture in fixtures:
            conn.execute(
                """update ai.fixtures
                      set status='played', home_goals=2, away_goals=1, result='H',
                          kickoff_at=%s, match_date=%s
                    where id=%s""",
                (played, played.date(), fixture))
        conn.commit()

    candidates = settle_bets.load_unsettled("EPL")
    assert len(candidates) == 1, (
        "the quarantined forecast's bet is still settleable, so its CLV and "
        "profit would enter the lab's betting record")

    with db.connect() as conn:
        # The bet row itself survives: the record of what the broken pipeline
        # advised is evidence about the pipeline, and deleting it is how the
        # same defect gets rediscovered.
        assert conn.execute(
            "select count(*) as n from ai.bets").fetchone()["n"] == 2


def test_the_sql_alias_authority_answers_exactly_as_the_python_one():
    """One identity authority, two implementations, held together by a test.

    The whole defect this contract exists to close was two alias tables that
    disagreed — `ai/aliases.py` knew Leicester City and the Edge Function's own
    twelve-entry literal did not. Replacing that with a SQL authority and a
    Python authority that can drift apart would be the same mistake with better
    handwriting, so every name either one knows is asked of both.

    The SQL side additionally falls back to the retained history, which the
    Python side has no cheap equivalent for, so the comparison is one-way where
    Python answers and exact-agreement where both do.
    """
    _bootstrap()
    import aliases

    names = sorted(aliases.ODDS_API_TO_CANONICAL)
    with db.connect() as conn:
        for name in names:
            expected, how = aliases.canonical_from_odds_api(name)
            row = conn.execute(
                "select canonical, matched_by from ai.canonical_from_odds_api(%s)",
                (name,)).fetchone()
            assert row["canonical"] == expected, (
                f"{name!r}: SQL says {row['canonical']!r}, Python says {expected!r}")
            assert row["matched_by"] == how

        # The clubs whose identity broke Production, end to end through SQL.
        for provider, canonical in (
                ("Leicester City", "Leicester"),
                ("Norwich City", "Norwich"),
                ("West Bromwich Albion", "West Brom"),
                ("Blackburn Rovers", "Blackburn"),
                ("Sheffield Wednesday", "Sheffield Weds"),
                ("Queens Park Rangers", "QPR"),
                ("Huddersfield Town", "Huddersfield"),
                ("Wimbledon", "AFC Wimbledon"),
                ("Bristol Rovers", "Bristol Rvs"),
                ("Bristol City", "Bristol City"),
                # Football-Data abbreviates this one too, and both the Python
                # map and the SQL seed originally carried 'Raith Rovers' — so
                # the parity assertion above passed while both disagreed with
                # the 489 rows of history Production actually holds.
                ("Raith Rovers", "Raith Rvs")):
            assert conn.execute(
                "select canonical from ai.canonical_from_odds_api(%s)",
                (provider,)).fetchone()["canonical"] == canonical

        # A name nothing recognises is refused rather than guessed at. There is
        # no edit-distance fallback on either side, deliberately: 'Bristol
        # City' and 'Bristol Rovers' are two characters apart and are different
        # clubs in different divisions.
        assert conn.execute(
            "select canonical, matched_by from ai.canonical_from_odds_api(%s)",
            ("Qwerty Rovers XI",)).fetchone()["matched_by"] == "unmatched"

        # And the history is the last-resort tier: a club with matches under a
        # name no alias mentions still resolves.
        conn.execute(
            """insert into ai.raw_matches
                 (division,season,match_date,home_canonical,away_canonical,
                  home_goals,away_goals,result)
               values ('E3','2526','2026-01-01','Obscure Town','Barnet',1,0,'H')""")
        conn.commit()
        assert conn.execute(
            "select canonical from ai.canonical_from_odds_api(%s)",
            ("Obscure Town",)).fetchone()["canonical"] == "Obscure Town"


def test_one_fixture_and_market_yields_one_piece_of_betting_evidence():
    """Contract 199. A retrain must not advise the same match a second time.

    `find_value` asked whether the PREDICTION already carried a bet, and
    `ai.predictions` is unique on (model_id, fixture, horizon), so the Monday
    retrain produced a fresh prediction row for a fixture that had already been
    advised, the guard found nothing against the new id, and a second paper bet
    was recorded on the same match. Production held 226 ai.bets rows over 125
    fixture/market pairs when this was measured.

    Both halves are asserted here: the historical rows survive in ai.bets, and
    exactly one of them is evidence.
    """
    _bootstrap()
    kickoff = datetime.now(timezone.utc) + timedelta(days=2)
    with db.connect() as conn:
        models = [
            conn.execute(
                """insert into ai.models (league,version,family,training_matches,
                                          artifact_sha256)
                   values ('EPL',%s,'poisson',10,%s) returning id""",
                (f"v{index}", hashlib.sha256(f"v{index}".encode()).hexdigest()),
            ).fetchone()["id"]
            for index in range(2)
        ]
        fixture = conn.execute(
            """insert into ai.fixtures
                 (division,season,league_key,match_date,kickoff_at,
                  home_canonical,away_canonical)
               values ('E0','2627','EPL',%s,%s,'Arsenal','Leeds') returning id""",
            (kickoff.date(), kickoff)).fetchone()["id"]

        # Two model versions, two forecasts of the same match, two pieces of
        # advice — recorded a day apart so "earliest" is unambiguous.
        for index, model in enumerate(models):
            prediction = conn.execute(
                """insert into ai.predictions
                     (model_id,league,fixture_id,kickoff_at,home_canonical,
                      away_canonical,p_home,p_draw,p_away,predicted_result,
                      features,horizon,hours_to_kickoff,features_version)
                   values (%s,'EPL',%s,%s,'Arsenal','Leeds',.55,.25,.20,'H','{}',
                           'scheduled',48,'f2') returning id""",
                (model, fixture, kickoff)).fetchone()["id"]
            conn.execute(
                """insert into ai.bets
                     (prediction_id,model_id,league,fixture_id,selection,
                      kickoff_at,bookmaker,odds_taken,model_prob,edge,
                      stake_fraction,stake_units,is_paper,status,market,
                      advised_at)
                   values (%s,%s,'EPL',%s,'H',%s,'B365',%s,.55,.155,.01,1,
                           true,'advised','1X2',%s)""",
                (prediction, model, fixture, kickoff, 2.1 + index,
                 datetime.now(timezone.utc) - timedelta(days=2 - index)))
        conn.commit()

    with db.connect() as conn:
        assert conn.execute(
            "select count(*) as n from ai.bets").fetchone()["n"] == 2, \
            "the immutable record of what the lab advised must survive"

        evidence = conn.execute(
            "select id, odds_taken from ai.valid_bets").fetchall()
        assert len(evidence) == 1, (
            "two bets on one fixture and market are two counts of one opinion "
            "in the bet count, the exposure, the hit rate, the ROI and the CLV "
            "sample")
        # EARLIEST, not best. The later repeat carries the friendlier price and
        # is exactly the row a "keep the best" rule would have chosen.
        assert float(evidence[0]["odds_taken"]) == 2.1

        identity = conn.execute(
            """select bet_id, advice_rank, is_canonical, canonical_bet_id,
                      advice_rows
                 from ai.bet_advice_identity order by advice_rank"""
        ).fetchall()
        assert [row["advice_rank"] for row in identity] == [1, 2]
        assert [row["is_canonical"] for row in identity] == [True, False]
        assert identity[1]["canonical_bet_id"] == identity[0]["bet_id"], \
            "an excluded row must name the row that superseded it"
        assert identity[0]["advice_rows"] == 2

    # And the guard that stops a THIRD one being written. A price at a real
    # venue makes this fixture a live candidate again; the read must report
    # that the FIXTURE is already advised, whichever prediction row is asked.
    with db.connect() as conn:
        conn.execute(
            "insert into ai.fixture_odds "
            "(fixture_id,division,match_date,home_canonical,away_canonical,"
            " bookmaker,odds_h,odds_d,odds_a,captured_at) "
            "values (%s,'E0',%s,'Arsenal','Leeds','B365',2.4,3.4,3.0,now())",
            (fixture, kickoff.date()))
        conn.commit()

    candidates = find_value.load_candidates("EPL", "B365")
    assert len(candidates) == 2, "both forecasts of the fixture are still priced"
    assert candidates["has_existing_bet"].all(), (
        "a retrain's fresh prediction row must not look like an unadvised "
        "fixture to the advice guard")
    assert not find_value._should_record_new_bet(True, True)


def test_a_played_bet_settles_before_its_closing_benchmark_arrives():
    """Section 7 of #854: CLV availability must not gate outcome settlement.

    Whether a bet won is decided by the score. Whether it beat the close depends
    on a third party publishing a price, which may never happen. The old job
    `continue`d past a played bet with no benchmark, so it stayed `advised`
    forever and an operator could not tell a missing closing line from a broken
    settler.
    """
    _bootstrap()
    kickoff = datetime.now(timezone.utc) + timedelta(days=2)
    played = datetime.now(timezone.utc) - timedelta(days=1)
    with db.connect() as conn:
        model = conn.execute(
            """insert into ai.models (league,version,family,training_matches,
                                      artifact_sha256)
               values ('EPL','clv','poisson',10,%s) returning id""",
            (hashlib.sha256(b"clv").hexdigest(),)).fetchone()["id"]
        fixture = conn.execute(
            """insert into ai.fixtures
                 (division,season,league_key,match_date,kickoff_at,
                  home_canonical,away_canonical)
               values ('E0','2627','EPL',%s,%s,'Arsenal','Leeds') returning id""",
            (kickoff.date(), kickoff)).fetchone()["id"]
        prediction = conn.execute(
            """insert into ai.predictions
                 (model_id,league,fixture_id,kickoff_at,home_canonical,
                  away_canonical,p_home,p_draw,p_away,predicted_result,
                  features,horizon,hours_to_kickoff,features_version)
               values (%s,'EPL',%s,%s,'Arsenal','Leeds',.55,.25,.20,'H','{}',
                       'scheduled',48,'f2') returning id""",
            (model, fixture, kickoff)).fetchone()["id"]
        conn.execute(
            """insert into ai.bets
                 (prediction_id,model_id,league,fixture_id,selection,
                  kickoff_at,bookmaker,odds_taken,model_prob,edge,
                  stake_fraction,stake_units,is_paper,status,market)
               values (%s,%s,'EPL',%s,'H',%s,'B365',2.5,.55,.375,.01,1,
                       true,'advised','1X2')""",
            (prediction, model, fixture, kickoff))
        conn.execute(
            """update ai.fixtures
                  set status='played', home_goals=2, away_goals=1, result='H',
                      kickoff_at=%s, match_date=%s
                where id=%s""", (played, played.date(), fixture))
        conn.commit()

    # No ai.raw_matches row exists, so there is no closing benchmark at all.
    assert len(settle_bets.load_unsettled("EPL")) == 1
    assert settle_bets.main.__module__ == "settle_bets"
    sys.argv = ["settle_bets.py", "--league", "EPL"]
    assert settle_bets.main() == 0

    with db.connect() as conn:
        row = conn.execute(
            """select b.status, r.settlement_outcome, r.won, r.pnl_units,
                      r.return_per_unit, r.clv, r.clv_benchmark, r.odds_closing,
                      r.beat_closing_price
                 from ai.bets b join ai.bet_results r on r.bet_id = b.id"""
        ).fetchone()
        assert row["status"] == "settled"
        assert row["settlement_outcome"] == "win" and row["won"] is True
        assert float(row["return_per_unit"]) == 1.5
        # UNAVAILABLE, not zero. A CLV of 0.0 would say the price matched the
        # close, which is a measurement nobody made.
        assert row["clv"] is None
        assert row["clv_benchmark"] is None
        assert row["odds_closing"] is None
        assert row["beat_closing_price"] is None

    # Rerunning settles nothing twice.
    sys.argv = ["settle_bets.py", "--league", "EPL"]
    assert settle_bets.main() == 0
    with db.connect() as conn:
        assert conn.execute(
            "select count(*) as n from ai.bet_results").fetchone()["n"] == 1

    # The benchmark is published later. The second pass fills the CLV columns
    # and leaves the outcome and the profit exactly as they were.
    with db.connect() as conn:
        conn.execute(
            """insert into ai.raw_matches
                 (source,division,season,match_date,home_canonical,away_canonical,
                  home_goals,away_goals,result,close_avg_h,close_avg_d,close_avg_a)
               values ('football-data','E0','2627',%s,'Arsenal','Leeds',2,1,'H',
                       2.2,3.4,3.3) returning id""", (played.date(),))
        conn.commit()
    assert db.settle_fixtures_from_history() >= 0
    sys.argv = ["settle_bets.py", "--league", "EPL"]
    assert settle_bets.main() == 0

    with db.connect() as conn:
        row = conn.execute(
            """select r.clv, r.clv_benchmark, r.odds_closing,
                      r.beat_closing_price, r.settlement_outcome, r.pnl_units
                 from ai.bet_results r"""
        ).fetchone()
        assert row["clv"] is not None
        assert row["clv_benchmark"] == "AVG"
        assert float(row["odds_closing"]) == 2.2
        assert row["beat_closing_price"] is True
        assert row["settlement_outcome"] == "win"
        assert float(row["pnl_units"]) == 1.5


def test_a_void_settlement_needs_no_scoreline():
    """Contract 199's other half. A returned stake is an outcome, not a gap."""
    _bootstrap()
    kickoff = datetime.now(timezone.utc) + timedelta(days=2)
    with db.connect() as conn:
        model = conn.execute(
            """insert into ai.models (league,version,family,training_matches,
                                      artifact_sha256)
               values ('EPL','void','poisson',10,%s) returning id""",
            (hashlib.sha256(b"void").hexdigest(),)).fetchone()["id"]
        fixture = conn.execute(
            """insert into ai.fixtures
                 (division,season,league_key,match_date,kickoff_at,
                  home_canonical,away_canonical)
               values ('E0','2627','EPL',%s,%s,'Arsenal','Leeds') returning id""",
            (kickoff.date(), kickoff)).fetchone()["id"]
        prediction = conn.execute(
            """insert into ai.predictions
                 (model_id,league,fixture_id,kickoff_at,home_canonical,
                  away_canonical,p_home,p_draw,p_away,predicted_result,
                  features,horizon,hours_to_kickoff,features_version)
               values (%s,'EPL',%s,%s,'Arsenal','Leeds',.55,.25,.20,'H','{}',
                       'scheduled',48,'f2') returning id""",
            (model, fixture, kickoff)).fetchone()["id"]
        bet = conn.execute(
            """insert into ai.bets
                 (prediction_id,model_id,league,fixture_id,selection,
                  kickoff_at,bookmaker,odds_taken,model_prob,edge,
                  stake_fraction,stake_units,is_paper,status,market)
               values (%s,%s,'EPL',%s,'H',%s,'B365',2.5,.55,.375,.01,1,
                       true,'advised','1X2') returning id""",
            (prediction, model, fixture, kickoff)).fetchone()["id"]
        conn.execute(
            """insert into ai.bet_results
                 (bet_id,actual_result,settlement_outcome,commission_rate,
                  pnl_units,return_per_unit)
               values (%s,null,'void',0,0,0)""", (bet,))
        conn.commit()

    with db.connect() as conn:
        assert conn.execute(
            "select settlement_outcome from ai.bet_results"
        ).fetchone()["settlement_outcome"] == "void"
        # Every other outcome still has to name a result.
        with pytest.raises(psycopg.Error):
            conn.execute(
                "update ai.bet_results set settlement_outcome='loss' "
                "where bet_id=%s", (bet,))
        conn.rollback()


def test_the_odds_cadence_is_always_inside_the_price_freshness_limit():
    """Contract 200. Collecting slower than the gate allows guarantees staleness.

    The heartbeat used to ask for a paid-covered fixture inside twenty-four
    hours and do nothing when there was none, while the lab forecasts ten days
    ahead. Production on 18 August 2026 had 52 scheduled fixtures, its nearest
    kickoff fifty-seven hours away, no dispatch for fifteen hours and all 120
    current recommendations PASS with PASS_STALE_PRICE dominating — from the
    same gate that had produced BET decisions on fresh prices the day before.

    The invariant is not "poll often". It is that the maximum gap between polls
    at a given distance from kickoff is strictly smaller than the price age the
    value gate will accept at that same distance. Anything else means prices are
    stale for part of every cycle whatever the gate says.
    """
    _bootstrap()
    import value_engine

    boundaries = (0.25, 1.0, 2.0, 2.001, 4.0, 8.0, 8.001, 12.0, 24.0,
                  24.001, 96.0, 180.0)
    with db.connect() as conn:
        for hours in boundaries:
            gap = conn.execute(
                "select ai.odds_poll_max_gap_seconds(%s::double precision) as s",
                (hours,)).fetchone()["s"]
            limit = value_engine.FreshnessPolicy().limit_for(hours).total_seconds()
            assert gap is not None, f"no cadence tier covers {hours}h to kickoff"
            assert gap < limit, (
                f"at {hours}h the collector may wait {gap}s but the gate only "
                f"accepts a price {limit}s old")

        # Beyond seven and a half days, and with no upcoming fixture at all,
        # the answer is "do not spend a credit" rather than a long interval.
        for absent in (180.001, 1000.0, None):
            assert conn.execute(
                "select ai.odds_poll_max_gap_seconds(%s::double precision) as s",
                (absent,)).fetchone()["s"] is None


def test_the_hosted_heartbeat_inlines_exactly_the_cadence_function():
    """One cadence, two places it is written, held together here.

    The cron command inlines the seconds instead of calling
    `ai.odds_poll_max_gap_seconds`, deliberately: the hosted reconciliation runs
    daily and must not depend on a migration having reached that database first.
    The cost of inlining is drift, and this is what pays it.
    """
    _bootstrap()
    reconcile = (Path(__file__).parents[1] / "scripts" / "database-rollout"
                 / "ai-odds-scheduler-reconcile.sql").read_text()

    window = re.search(r"kickoff_at <= now\(\) \+ interval '(\d+) hours'", reconcile)
    assert window, "the heartbeat must state its fixture window"
    window_hours = float(window.group(1))

    tiers = re.findall(r"when nearest_hours <= ([\d.]+)\s+then (\d+)", reconcile)
    assert tiers, "the heartbeat must state its cadence tiers"
    assert float(tiers[-1][0]) == window_hours, (
        "the last cadence tier and the fixture window must be the same "
        "distance, or the heartbeat selects fixtures it has no cadence for")

    with db.connect() as conn:
        for hours_text, seconds_text in tiers:
            hours = float(hours_text)
            assert conn.execute(
                "select ai.odds_poll_max_gap_seconds(%s::double precision) as s",
                (hours,)).fetchone()["s"] == int(seconds_text), (
                    f"the cron command polls every {seconds_text}s at {hours}h "
                    "and the tested function disagrees")


def _coverage_world():
    """Two fixtures in one league: one priced and decided, one with nothing.

    Deliberately built with THREE forecasts of the priced fixture, from three
    model versions, because that is what Production looks like and it is the
    shape every fixture-level read has to collapse.
    """
    _bootstrap()
    kickoff = datetime.now(timezone.utc) + timedelta(days=2)
    with db.connect() as conn:
        models = []
        for index in range(3):
            payload = f"cov-{index}".encode()
            sha = hashlib.sha256(payload).hexdigest()
            # The artefact goes in first: ai.require_artifact_before_current
            # refuses to make a model current without verified stored bytes, and
            # that gate is exactly what this suite must not work around.
            model = conn.execute(
                """insert into ai.models (league,version,family,training_matches,
                                          artifact_sha256,final_trained_through)
                   values ('EPL',%s,'poisson',100,%s,%s) returning id""",
                (f"cov-{index}", sha, date(2026, 8, 8))).fetchone()["id"]
            conn.execute(
                "insert into ai.model_artifacts(model_id,payload,sha256) values(%s,%s,%s)",
                (model, payload, sha))
            conn.execute("update ai.models set status=%s where id=%s",
                         ('current' if index == 2 else 'retired', model))
            models.append(model)
        priced = conn.execute(
            """insert into ai.fixtures
                 (division,season,league_key,match_date,kickoff_at,
                  home_canonical,away_canonical)
               values ('E0','2627','EPL',%s,%s,'Arsenal','Leeds') returning id""",
            (kickoff.date(), kickoff)).fetchone()["id"]
        bare = conn.execute(
            """insert into ai.fixtures
                 (division,season,league_key,match_date,kickoff_at,
                  home_canonical,away_canonical)
               values ('E0','2627','EPL',%s,%s,'Everton','Fulham') returning id""",
            (kickoff.date(), kickoff + timedelta(hours=2))).fetchone()["id"]

        predictions = []
        for model in models:
            predictions.append(conn.execute(
                """insert into ai.predictions
                     (model_id,league,fixture_id,kickoff_at,home_canonical,
                      away_canonical,p_home,p_draw,p_away,predicted_result,
                      predicted_score,features,horizon,hours_to_kickoff,
                      features_version,data_confidence,agreement,uncertainty)
                   values (%s,'EPL',%s,%s,'Arsenal','Leeds',.55,.25,.20,'H','1-0','{}',
                           'scheduled',48,'f2',
                           '{"score":0.82,"state":"sufficient","missing_inputs":[]}',
                           '{"score":0.91}','{"width":0.11}') returning id""",
                (model, priced, kickoff)).fetchone()["id"])

        # A price at a real venue and an aggregate reference beside it.
        for book, prices in (("B365", (2.1, 3.4, 3.6)), ("AVG", (2.0, 3.3, 3.5))):
            conn.execute(
                "insert into ai.fixture_odds "
                "(fixture_id,division,match_date,home_canonical,away_canonical,"
                " bookmaker,odds_h,odds_d,odds_a,captured_at) "
                "values (%s,'E0',%s,'Arsenal','Leeds',%s,%s,%s,%s,now())",
                (priced, kickoff.date(), book, *prices))

        # An older BET on the first forecast, then a newer PASS on the third.
        conn.execute(
            """insert into ai.recommendations
                 (prediction_id,model_id,league,market,selection,decision,
                  reason_codes,bookmaker,odds_offered,calibrated_prob,fair_odds,
                  expected_value,kickoff_at,hours_to_kickoff,decided_at,
                  odds_captured_at,odds_age_seconds,evidence)
               values (%s,%s,'EPL','1X2','H','BET',array[]::text[],'B365',2.1,.55,
                       1.82,.155,%s,48,now() - interval '2 days',
                       now() - interval '2 days',120,'{}')""",
            (predictions[0], models[0], kickoff))
        conn.execute(
            """insert into ai.recommendations
                 (prediction_id,model_id,league,market,selection,decision,
                  reason_codes,bookmaker,odds_offered,calibrated_prob,fair_odds,
                  expected_value,kickoff_at,hours_to_kickoff,decided_at,
                  odds_captured_at,odds_age_seconds,evidence)
               values (%s,%s,'EPL','1X2','H','PASS',
                       array['PASS_STALE_PRICE','PASS_LOW_EDGE'],'B365',2.1,.55,
                       1.82,.005,%s,48,now(),now() - interval '3 days',259200,
                       '{"market_fair_prob":0.52}')""",
            (predictions[2], models[2], kickoff))
        conn.commit()
    return priced, bare, predictions


def test_coverage_answers_why_every_fixture_is_or_is_not_actionable():
    """Contract 201. The read an operator needed a database console for.

    An empty Bet Builder looks identical whether the model found no value or the
    pipeline is broken, and telling them apart needed five queries against a
    schema no browser role can read.
    """
    priced, bare, _ = _coverage_world()

    with db.connect() as conn:
        body = conn.execute(
            "select public.admin_ai_fixture_coverage(now(), now() + interval '7 days') as b"
        ).fetchone()["b"]

    totals = body["totals"]
    assert totals["fixtures"] == 2, "every scheduled fixture in the window is listed"
    assert totals["with_forecast"] == 1 and totals["without_forecast"] == 1
    assert totals["with_real_bookmaker_price"] == 1
    assert totals["actionable_bets"] == 0
    assert totals["passed"] == 1
    assert body["pass_reason_counts"] == {"PASS_STALE_PRICE": 1, "PASS_LOW_EDGE": 1}

    by_fixture = {row["fixture_id"]: row for row in body["fixtures"]}
    assert set(by_fixture) == {str(priced), str(bare)}

    # THE NEWER PASS SUPERSEDES THE OLDER BET, and the fixture is reported once
    # rather than three times because three model versions forecast it.
    decided = by_fixture[str(priced)]
    assert decided["decision"]["decision"] == "PASS"
    assert decided["prediction"]["forecasts_collapsed"] == 3
    assert decided["prediction"]["model_version"] == "cov-2", (
        "the three forecasts share a created_at to the microsecond, so the "
        "canonical one must be decided by the current model status rather than "
        "by whichever UUID sorted highest")
    assert decided["market"]["real_book_count"] == 1
    assert decided["market"]["aggregate_reference_available"] is True
    assert decided["market"]["best_real_price"]["bookmaker"] == "B365"
    assert decided["quality"]["data_confidence_state"] == "sufficient"

    # Every refusal carries its own sentence, from one authority.
    codes = [reason["code"] for reason in decided["decision"]["reasons"]]
    assert codes == ["PASS_STALE_PRICE", "PASS_LOW_EDGE"]
    for reason in decided["decision"]["reasons"]:
        assert len(reason["explanation"]) > 20
        assert "No explanation is recorded" not in reason["explanation"]

    # The price age is reported beside the limit it is being judged against,
    # which is the whole content of PASS_STALE_PRICE.
    assert decided["decision"]["price_age_seconds"] == 259200
    assert decided["decision"]["price_age_limit_seconds"] == 43200

    # A fixture nothing has touched is present and honest about it, rather than
    # being absent and looking like it does not exist.
    missing = by_fixture[str(bare)]
    assert missing["prediction"] is None
    assert missing["decision"] is None
    assert missing["market"]["real_book_count"] == 0


def test_coverage_never_re_evaluates_a_gate():
    """It reports what find_value decided. It does not decide."""
    _coverage_world()
    with db.connect() as conn:
        definition = conn.execute(
            """select pg_get_functiondef(p.oid) as d
                 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
                where n.nspname = 'public'
                  and p.proname = 'admin_ai_fixture_coverage'"""
        ).fetchone()["d"]
    # The decision fields are read from ai.recommendations. Nothing in the read
    # compares an edge to a threshold or writes the word BET as a conclusion.
    assert "ai.current_fixture_recommendations" in definition
    assert "min_edge" not in definition
    assert "expected_value >" not in definition
    assert "expected_value >=" not in definition


def test_the_results_review_is_one_row_per_fixture():
    """Contract 201. Five forecasts of one match are one match.

    A read-only audit reported ECH 17 August as "5 graded, 0 result correct"
    for what was one fixture forecast five times, and the pair
    result_correct=false with exact_score_correct=true was read as a grading
    defect. It is not one: predicted_result is the argmax OUTCOME and
    predicted_score is the modal SCORELINE, and a fixture whose most likely
    scoreline is a draw can still have a home win as its most likely outcome.
    """
    _bootstrap()
    kickoff = datetime.now(timezone.utc) + timedelta(days=2)
    played = datetime.now(timezone.utc) - timedelta(days=1)
    with db.connect() as conn:
        fixture = conn.execute(
            """insert into ai.fixtures
                 (division,season,league_key,match_date,kickoff_at,
                  home_canonical,away_canonical)
               values ('E1','2627','ECH',%s,%s,'Cardiff','Wrexham') returning id""",
            (kickoff.date(), kickoff)).fetchone()["id"]
        for index in range(5):
            model = conn.execute(
                """insert into ai.models (league,version,family,training_matches,
                                          artifact_sha256)
                   values ('ECH',%s,'poisson',100,%s) returning id""",
                (f"rev-{index}", hashlib.sha256(f"rev-{index}".encode()).hexdigest()),
            ).fetchone()["id"]
            prediction = conn.execute(
                """insert into ai.predictions
                     (model_id,league,fixture_id,kickoff_at,home_canonical,
                      away_canonical,p_home,p_draw,p_away,predicted_result,
                      predicted_score,features,horizon,hours_to_kickoff,
                      features_version,data_confidence)
                   values (%s,'ECH',%s,%s,'Cardiff','Wrexham',.403,.272,.325,'H',
                           '1-1','{}','scheduled',48,'f2',
                           '{"score":0.7,"state":"sufficient"}') returning id""",
                (model, fixture, kickoff)).fetchone()["id"]
            conn.execute(
                """insert into ai.prediction_results
                     (prediction_id,actual_home_goals,actual_away_goals,actual_result,
                      result_correct,exact_score_correct,log_loss,brier,rps)
                   values (%s,1,1,'D',false,true,1.3186,0.8115,0.1376)""",
                (prediction,))
        conn.execute(
            """update ai.fixtures
                  set status='played', home_goals=1, away_goals=1, result='D',
                      kickoff_at=%s, match_date=%s
                where id=%s""", (played, played.date(), fixture))
        conn.commit()

    with db.connect() as conn:
        body = conn.execute(
            """select public.admin_ai_results_review(
                        now() - interval '7 days', now()) as b"""
        ).fetchone()["b"]

    assert body["totals"]["graded_fixtures"] == 1, (
        "five forecasts of one match are one match, not a five-match sample")
    assert body["totals"]["result_correct"] == 0
    assert body["totals"]["exact_scores"] == 1
    assert body["duplicate_graded_rows_excluded"] == 4, (
        "how many rows were collapsed must be visible, not silently dropped")
    assert body["sample_sufficiency"] == "EARLY_SAMPLE"
    assert "variance" in body["sample_note"]

    fixture_row = body["fixtures"][0]
    assert fixture_row["result_correct"] is False
    assert fixture_row["exact_score_correct"] is True
    assert fixture_row["modal_scoreline_beat_modal_outcome"] is True, (
        "the surface must say the two grades disagree on purpose rather than "
        "leave a reader to report it as corruption")
    assert fixture_row["forecasts_collapsed"] == 5


def test_operational_health_separates_a_quiet_pipeline_from_a_broken_one():
    """Contract 201. Every stage says when it last ran and what it holds."""
    _coverage_world()
    with db.connect() as conn:
        body = conn.execute("select public.admin_ai_operational_health() as b").fetchone()["b"]

    assert body["fixtures"]["upcoming_7d"] == 2
    assert body["predictions"]["upcoming_fixtures"] == 2
    assert body["predictions"]["with_current_forecast"] == 1
    assert body["predictions"]["without_forecast"] == 1
    assert body["value_loop"]["current_bets"] == 0
    assert body["value_loop"]["current_passes"] == 1
    assert body["models"]["expected"] == 9
    assert body["models"]["current"] == 1
    assert body["odds_api"]["collection_enabled"] in (True, False)
    assert "credits_used_this_month" in body["odds_api"]
    assert body["settlement"]["played_and_unsettled"] == 0
    assert body["prices"]["last_real_capture_at"] is not None


def test_the_ai_lab_reads_stay_behind_the_competition_admin_gate():
    """Three new reads, three definer functions, no browser role near schema ai."""
    _coverage_world()
    with db.connect() as conn:
        for name, args in (
            ('admin_ai_fixture_coverage', 'timestamptz,timestamptz,text[]'),
            ('admin_ai_operational_health', ''),
            ('admin_ai_results_review', 'timestamptz,timestamptz,text[]'),
        ):
            row = conn.execute(
                """select p.prosecdef, p.provolatile,
                          has_function_privilege('authenticated', p.oid, 'execute') as auth,
                          has_function_privilege('anon', p.oid, 'execute') as anon
                     from pg_proc p join pg_namespace n on n.oid = p.pronamespace
                    where n.nspname = 'public' and p.proname = %s""",
                (name,)).fetchone()
            assert row["prosecdef"] is True, f"{name} must be SECURITY DEFINER"
            assert row["provolatile"] == 's', f"{name} must be STABLE, and must not write"
            assert row["auth"] is True, f"{name} must be callable by authenticated"
            assert row["anon"] is False, f"{name} must not be callable by anon"
            assert args is not None

        for view in ('canonical_fixture_predictions', 'current_fixture_recommendations'):
            for role in ('anon', 'authenticated'):
                assert conn.execute(
                    "select has_table_privilege(%s, %s, 'select') as ok",
                    (role, f"ai.{view}")).fetchone()["ok"] is False, (
                        f"ai.{view} must not be readable by {role}")


def test_a_fixture_is_re_forecast_as_new_results_arrive():
    """Contract 202. ai/README.md's invariant, executed rather than asserted.

    "the artefact that ships is then fitted fresh on every eligible completed
    match, so last Saturday reaches next Saturday's forecast." Production on
    18 August 2026 imported fifty-seven results at 05:55, ran predict at 09:23
    with team state rebuilt from the full history, scored 52 fixtures across
    five leagues and wrote NOTHING — `{"written": 0, "fixtures": 12}` in every
    one — because `scheduled` covered everything beyond forty-eight hours, so
    the row made on the 17th owned the fixture and every better forecast
    collided with it.
    """
    import predict

    # The clock buckets have to reach as far as the lab forecasts, or the far
    # bucket becomes a single slot that the first run of the week claims.
    assert predict.horizon_for(200.0) == "scheduled"
    assert predict.horizon_for(168.0) == "t168"
    assert predict.horizon_for(150.0) == "t168"
    assert predict.horizon_for(120.0) == "t120"
    assert predict.horizon_for(90.0) == "t120"
    assert predict.horizon_for(72.0) == "t72"
    assert predict.horizon_for(55.0) == "t72"
    assert predict.horizon_for(48.0) == "t48"
    assert predict.horizon_for(24.0) == "t24"
    assert predict.horizon_for(6.0) == "t6"

    # And the compatibility shim that stops this being a red job for as long as
    # a Production promotion takes. A database below contract 202 refuses t72,
    # so the forecaster must widen to the bucket that database does hold rather
    # than fail every insert on a check violation.
    pre_202 = frozenset({"scheduled", "t48", "t24", "t6", "lineup", "backtest"})
    assert predict.horizon_for(150.0, pre_202) == "scheduled"
    assert predict.horizon_for(55.0, pre_202) == "scheduled"
    assert predict.horizon_for(30.0, pre_202) == "t48", (
        "the buckets the old vocabulary DOES hold are unaffected")

    _bootstrap()
    assert {"t72", "t120", "t168"} <= db.supported_horizons(), (
        "the vocabulary is read from the installed constraint, which is the "
        "thing that would refuse the insert")
    kickoff = datetime.now(timezone.utc) + timedelta(days=6)
    with db.connect() as conn:
        payload = b"horizons"
        sha = hashlib.sha256(payload).hexdigest()
        model = conn.execute(
            """insert into ai.models (league,version,family,training_matches,
                                      artifact_sha256)
               values ('EPL','horizons','poisson',100,%s) returning id""",
            (sha,)).fetchone()["id"]
        conn.execute(
            "insert into ai.model_artifacts(model_id,payload,sha256) values(%s,%s,%s)",
            (model, payload, sha))
        fixture = conn.execute(
            """insert into ai.fixtures
                 (division,season,league_key,match_date,kickoff_at,
                  home_canonical,away_canonical)
               values ('E0','2627','EPL',%s,%s,'Arsenal','Leeds') returning id""",
            (kickoff.date(), kickoff)).fetchone()["id"]
        conn.commit()

    def forecast(horizon: str, p_home: float) -> int:
        return db.insert_predictions([{
            "model_id": model, "league": "EPL", "fixture_id": fixture,
            "season_fixture_id": None, "raw_match_id": None,
            "kickoff_at": kickoff, "home_canonical": "Arsenal",
            "away_canonical": "Leeds",
            "p_home": p_home, "p_draw": round(1 - p_home - 0.2, 5), "p_away": 0.2,
            "exp_home_goals": 1.6, "exp_away_goals": 1.1,
            "predicted_result": "H", "predicted_score": "2-1",
            "scoreline_grid": {}, "features": {}, "market_probabilities": None,
            "horizon": horizon, "hours_to_kickoff": 100.0,
            "data_snapshot_at": datetime.now(timezone.utc),
            "features_version": "f2", "uses_market": False,
            "p_home_raw": None, "p_draw_raw": None, "p_away_raw": None,
            "model_views": None, "agreement": None,
            "data_confidence": {"score": 0.8, "state": "sufficient"},
            "uncertainty": None, "explanation": None,
        }])

    # The same horizon twice is still one forecast: immutability is untouched.
    assert forecast("t168", 0.55) == 1
    assert forecast("t168", 0.61) == 0, (
        "a prediction is immutable; a second run at the same horizon must not "
        "overwrite or duplicate it")

    # A later run, closer to kickoff and on more completed football, is a new
    # forecast rather than a silently discarded one.
    assert forecast("t120", 0.61) == 1
    assert forecast("t72", 0.64) == 1

    with db.connect() as conn:
        rows = conn.execute(
            "select horizon, p_home from ai.predictions order by p_home").fetchall()
        assert [row["horizon"] for row in rows] == ["t168", "t120", "t72"]

        # And contract 201 still reports the fixture ONCE, as its newest.
        canonical = conn.execute(
            """select horizon, forecasts_for_fixture
                 from ai.canonical_fixture_predictions where fixture_id = %s""",
            (fixture,)).fetchall()
        assert len(canonical) == 1
        assert canonical[0]["horizon"] == "t72"
        assert canonical[0]["forecasts_for_fixture"] == 3


def test_grading_records_the_market_comparison_where_a_close_exists():
    """The only comparison that means anything at this sample size.

    Contract 185 added the market columns and nothing wrote them: all 107 of
    Production's graded rows on 18 August 2026 carried a null market_log_loss
    while the closing prices sat in ai.raw_matches beside them. Accuracy over
    fifty-seven fixtures is variance; log loss against the de-vigged CLOSING
    line is the claim the lab is actually making.
    """
    import evaluate

    _bootstrap()
    kickoff = datetime.now(timezone.utc) + timedelta(days=2)
    played = datetime.now(timezone.utc) - timedelta(days=1)
    with db.connect() as conn:
        model = conn.execute(
            """insert into ai.models (league,version,family,training_matches,
                                      artifact_sha256)
               values ('EPL','market','poisson',100,%s) returning id""",
            (hashlib.sha256(b"market").hexdigest(),)).fetchone()["id"]
        graded, ungraded = [], []
        for index, home in enumerate(("Arsenal", "Everton")):
            fixture = conn.execute(
                """insert into ai.fixtures
                     (division,season,league_key,match_date,kickoff_at,
                      home_canonical,away_canonical)
                   values ('E0','2627','EPL',%s,%s,%s,'Leeds') returning id""",
                (kickoff.date(), kickoff + timedelta(minutes=index), home)
            ).fetchone()["id"]
            conn.execute(
                """insert into ai.predictions
                     (model_id,league,fixture_id,kickoff_at,home_canonical,
                      away_canonical,p_home,p_draw,p_away,predicted_result,
                      predicted_score,features,horizon,hours_to_kickoff,
                      features_version,mkt_home_at_prediction,
                      mkt_draw_at_prediction,mkt_away_at_prediction)
                   values (%s,'EPL',%s,%s,%s,'Leeds',.55,.25,.20,'H','2-1','{}',
                           'scheduled',48,'f2',2.30,3.40,3.30)""",
                (model, fixture, kickoff + timedelta(minutes=index), home))
            (graded if index == 0 else ungraded).append(fixture)

        # Only the first fixture gets a raw match, and therefore a closing line.
        raw = conn.execute(
            """insert into ai.raw_matches
                 (source,division,season,match_date,home_canonical,away_canonical,
                  home_goals,away_goals,result,close_avg_h,close_avg_d,close_avg_a)
               values ('football-data','E0','2627',%s,'Arsenal','Leeds',2,1,'H',
                       1.95,3.60,4.00) returning id""", (played.date(),)).fetchone()["id"]
        conn.execute("update ai.fixtures set raw_match_id=%s where id=%s",
                     (raw, graded[0]))
        for fixture in graded + ungraded:
            conn.execute(
                """update ai.fixtures
                      set status='played', home_goals=2, away_goals=1, result='H',
                          kickoff_at=%s, match_date=%s
                    where id=%s""", (played, played.date(), fixture))
        conn.commit()

    sys.argv = ["evaluate.py", "--league", "EPL", "--no-diagnosis"]
    assert evaluate.main() == 0

    with db.connect() as conn:
        rows = {
            row["home_canonical"]: row
            for row in conn.execute(
                """select p.home_canonical, r.market_log_loss, r.log_loss,
                          r.log_loss_vs_market, r.mkt_home_closing,
                          r.market_moved_toward_model
                     from ai.prediction_results r
                     join ai.predictions p on p.id = r.prediction_id""").fetchall()
        }

    assert set(rows) == {"Arsenal", "Everton"}, "both fixtures are graded"

    with_close = rows["Arsenal"]
    assert with_close["market_log_loss"] is not None
    assert float(with_close["mkt_home_closing"]) == 1.95
    # NEGATIVE IS THE MODEL WINNING: model loss minus market loss.
    assert float(with_close["log_loss_vs_market"]) == pytest.approx(
        float(with_close["log_loss"]) - float(with_close["market_log_loss"]), abs=1e-4)
    # The market shortened the home price from 2.30 to 1.95, which is the same
    # direction the model was already leaning.
    assert with_close["market_moved_toward_model"] is True

    # No closing line, so no comparison — and the forecast is still graded
    # rather than held back, exactly as a bet is settled without one.
    without_close = rows["Everton"]
    assert without_close["log_loss"] is not None
    assert without_close["market_log_loss"] is None
    assert without_close["log_loss_vs_market"] is None
    assert without_close["mkt_home_closing"] is None


def test_a_closing_price_still_cannot_become_a_feature():
    """The market comparison reads a closing line AFTER the match, into the
    results table, and the guard on the other side of that line is untouched."""
    import market_features

    with pytest.raises(market_features.ClosingPriceLeak):
        market_features.assert_no_closing_features(
            ["close_avg_h", "mkt_home_prob", "home_elo"])
    # A price known BEFORE kickoff is a legitimate feature and stays one.
    market_features.assert_no_closing_features(["mkt_home_prob", "home_elo"])


def test_bet_builder_takes_the_current_decision_from_the_database():
    """Contract 203. The currency rule stops being two rules.

    `admin_ai_bet_builder_candidates` filtered `where decision = 'BET'` BEFORE
    its `distinct on (prediction_id)`, so it returned the newest BET for a
    prediction rather than the newest DECISION, and a fixture whose price had
    gone stale still offered its two-day-old BET as a leg. The browser knew: it
    fetched `admin_ai_recommendation_log` for all nine leagues, 500 rows each,
    and intersected. Nine round trips to re-derive what the database could
    answer in one, and a second definition of "current" living in TypeScript.

    Contract 201 gave that rule one home. This proves the read uses it.
    """
    priced, bare, predictions = _coverage_world()

    with db.connect() as conn:
        conn.execute(
            "insert into ai.bookmakers (code,name,kind,is_real_price) "
            "values ('T249','Test book 249','bookmaker',true) on conflict (code) do nothing")
        conn.commit()
        body = conn.execute(
            """select public.admin_ai_bet_builder_candidates(
                        'T249', null, now(), now() + interval '7 days', 200) as b"""
        ).fetchone()["b"]

    # The older BET is superseded by the newer PASS, at the database, with both
    # audit rows still readable.
    assert body["leg_count"] == 0, (
        "a superseded BET must not survive as an actionable leg")
    assert body["legs"] == []

    with db.connect() as conn:
        assert conn.execute(
            "select count(*) as n from ai.recommendations where decision='BET'"
        ).fetchone()["n"] == 1, "and the BET it refused is still in the audit log"

    # The same read explains its own emptiness, so a zero-leg builder is not a
    # blank screen.
    coverage = body["coverage"]
    assert coverage["fixtures_in_window"] == 2
    assert coverage["with_current_decision"] == 1
    assert coverage["actionable_anywhere"] == 0
    assert coverage["passed"] == 1
    assert coverage["pass_reason_counts"] == {
        "PASS_STALE_PRICE": 1, "PASS_LOW_EDGE": 1}

    # The venue picker's count is the number of legs selecting it returns,
    # rather than a historical total that promises more than it delivers.
    with db.connect() as conn:
        books = conn.execute(
            "select public.admin_ai_bet_builder_books() as b").fetchone()["b"]
    entry = next(row for row in books["bookmakers"] if row["code"] == "T249")
    assert entry["legs"] == 0
    assert all(row["is_real_price"] and row["kind"] != "aggregate"
               for row in books["bookmakers"]), "AVG and MAX are never venues"

    assert str(priced) and str(bare) and predictions


def test_a_current_bet_still_reaches_the_bet_builder():
    """The other direction, because a filter that refuses everything also passes
    the test above."""
    _bootstrap()
    kickoff = datetime.now(timezone.utc) + timedelta(days=2)
    with db.connect() as conn:
        conn.execute(
            "insert into ai.bookmakers (code,name,kind,is_real_price) "
            "values ('T203','Test book 203','bookmaker',true) on conflict (code) do nothing")
        payload = b"c203"
        sha = hashlib.sha256(payload).hexdigest()
        model = conn.execute(
            """insert into ai.models (league,version,family,training_matches,artifact_sha256)
               values ('EPL','c203','poisson',10,%s) returning id""", (sha,)).fetchone()["id"]
        fixture = conn.execute(
            """insert into ai.fixtures
                 (division,season,league_key,match_date,kickoff_at,home_canonical,away_canonical)
               values ('E0','2627','EPL',%s,%s,'Arsenal','Leeds') returning id""",
            (kickoff.date(), kickoff)).fetchone()["id"]
        prediction = conn.execute(
            """insert into ai.predictions
                 (model_id,league,fixture_id,kickoff_at,home_canonical,away_canonical,
                  p_home,p_draw,p_away,predicted_result,features,horizon,
                  hours_to_kickoff,features_version)
               values (%s,'EPL',%s,%s,'Arsenal','Leeds',.55,.25,.20,'H','{}','t48',48,'f2')
               returning id""", (model, fixture, kickoff)).fetchone()["id"]
        conn.execute(
            """insert into ai.recommendations
                 (prediction_id,model_id,league,market,selection,decision,reason_codes,
                  bookmaker,odds_offered,calibrated_prob,fair_odds,expected_value,
                  kickoff_at,hours_to_kickoff,decided_at,odds_captured_at,
                  odds_age_seconds,evidence)
               values (%s,%s,'EPL','1X2','H','BET',array[]::text[],'T203',2.4,.55,1.82,
                       .32,%s,48,now(),now() - interval '5 minutes',300,'{}')""",
            (prediction, model, kickoff))
        conn.commit()
        body = conn.execute(
            """select public.admin_ai_bet_builder_candidates(
                        'T203', null, now(), now() + interval '7 days', 200) as b"""
        ).fetchone()["b"]

    assert body["leg_count"] == 1
    leg = body["legs"][0]
    assert leg["bookmaker"] == "T203" and leg["selection"] == "H"
    assert leg["price_age_seconds"] <= leg["price_age_limit_seconds"], (
        "the age and the limit travel together so the browser never has to "
        "guess which one applies")
    assert body["coverage"]["actionable_at_this_book"] == 1

    with db.connect() as conn:
        books = conn.execute(
            "select public.admin_ai_bet_builder_books() as b").fetchone()["b"]
    assert next(row for row in books["bookmakers"] if row["code"] == "T203")["legs"] == 1
