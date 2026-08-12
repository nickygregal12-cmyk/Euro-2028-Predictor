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
import os
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
        migration = (
            Path(__file__).parents[1]
            / "supabase"
            / "migrations"
            / "20260812070000_ai_lab_operational_loop.sql"
        )
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
    with db.connect() as conn:
        row = conn.execute(
            """insert into ai.predictions
                 (model_id,league,fixture_id,season_fixture_id,kickoff_at,
                  home_canonical,away_canonical,p_home,p_draw,p_away,
                  predicted_result,features)
               values (%s,%s,%s,%s,%s,%s,%s,.75,.15,.10,'H','{}') returning id""",
            (model_id, league, fixture_id, season_fixture_id, kickoff, home, away),
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
        before = conn.execute("select status from ai.bets where league='EPL'").fetchone()
        assert before["status"] == "advised"

    raw_id = _raw_result("E0", epl_ko.date(), "Arsenal", "Chelsea", 1, 0)
    db.settle_fixtures_from_history()
    with db.connect() as conn:
        attached = conn.execute(
            "select raw_match_id from ai.fixtures where id=%s", (epl_fixture,)
        ).fetchone()
        assert str(attached["raw_match_id"]) == raw_id
    assert _run_main(monkeypatch, settle_bets, "--league", "EPL") == 0
    with db.connect() as conn:
        assert conn.execute(
            """select r.clv from ai.bet_results r join ai.bets b on b.id=r.bet_id
                 where b.league='EPL'"""
        ).fetchone()["clv"] is not None

        # Stored artefact bytes cannot be replaced under the same model id.
        with pytest.raises(psycopg.Error):
            conn.execute(
                "update ai.model_artifacts set payload=%s where model_id=%s",
                (b"replacement", epl_model),
            )
        conn.rollback()
