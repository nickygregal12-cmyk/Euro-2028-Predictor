"""Reconcile already-retained paid odds evidence into the AI Lab lifecycle.

This script makes no provider request.  It consumes rows already retained in
``ai.odds_api_events`` / ``ai.market_prices`` and does three idempotent things:

1. creates/refreshes canonical ``ai.fixtures`` for the five competitions the
   paid Odds API covers;
2. links retained provider events to those fixtures; and
3. projects the latest paid 1X2 evidence into ``ai.fixture_odds`` so the
   existing value engine can consume it without inventing a second selector.

Run it after a paid poll and before prediction/value selection.
"""
from __future__ import annotations

import sys

from db import connect, job


UPSERT_FIXTURES = r"""
with sport_map(sport_key, division, league_key) as (
  values
    ('soccer_epl',             'E0',  'EPL'),
    ('soccer_efl_champ',       'E1',  'ECH'),
    ('soccer_england_league1', 'E2',  'EL1'),
    ('soccer_england_league2', 'E3',  'EL2'),
    ('soccer_spl',             'SC0', 'SPL')
), mapped as (
  select e.event_id,
         m.division,
         m.league_key,
         e.commence_time,
         (e.commence_time at time zone 'Europe/London')::date as match_date,
         e.home_canonical,
         e.away_canonical
    from ai.odds_api_events e
    join sport_map m on m.sport_key = e.sport_key
   where e.commence_time > now() - interval '2 days'
     and e.home_canonical is not null
     and e.away_canonical is not null
), prepared as (
  select *,
         case when extract(month from match_date) >= 7
              then extract(year from match_date)::int
              else extract(year from match_date)::int - 1 end as season_start
    from mapped
), changed as (
  insert into ai.fixtures
    (division, season, league_key, match_date, kickoff_at,
     home_canonical, away_canonical, status)
  select division,
         lpad((season_start % 100)::text, 2, '0') ||
         lpad(((season_start + 1) % 100)::text, 2, '0'),
         league_key, match_date, commence_time,
         home_canonical, away_canonical, 'scheduled'
    from prepared
  on conflict (division, match_date, home_canonical, away_canonical)
  do update set kickoff_at = excluded.kickoff_at,
                league_key = excluded.league_key,
                season = excluded.season,
                status = case when ai.fixtures.status = 'played'
                              then ai.fixtures.status else 'scheduled' end,
                updated_at = now()
  returning id
)
select count(*)::int as rows from changed
"""

LINK_EVENTS = r"""
with sport_map(sport_key, division) as (
  values
    ('soccer_epl',             'E0'),
    ('soccer_efl_champ',       'E1'),
    ('soccer_england_league1', 'E2'),
    ('soccer_england_league2', 'E3'),
    ('soccer_spl',             'SC0')
), changed as (
  update ai.odds_api_events e
     set fixture_id = f.id,
         matched_by = 'alias'
    from sport_map m,
         ai.fixtures f
   where e.sport_key = m.sport_key
     and f.division = m.division
     and e.home_canonical = f.home_canonical
     and e.away_canonical = f.away_canonical
     and f.match_date = (e.commence_time at time zone 'Europe/London')::date
     and e.commence_time > now() - interval '2 days'
     and (e.fixture_id is distinct from f.id or e.matched_by = 'unmatched')
  returning e.event_id
)
select count(*)::int as rows from changed
"""

BRIDGE_1X2 = r"""
with latest as (
  select distinct on (mp.fixture_id, mp.bookmaker, mp.selection)
         mp.fixture_id, mp.bookmaker, mp.selection, mp.odds, mp.captured_at
    from ai.market_prices mp
   where mp.source = 'the-odds-api'
     and mp.market = '1X2'
     and mp.fixture_id is not null
   order by mp.fixture_id, mp.bookmaker, mp.selection, mp.captured_at desc
), book_rows as (
  select fixture_id,
         bookmaker,
         max(odds) filter (where selection = 'H') as odds_h,
         max(odds) filter (where selection = 'D') as odds_d,
         max(odds) filter (where selection = 'A') as odds_a,
         max(captured_at) as captured_at
    from latest
   group by fixture_id, bookmaker
  having count(*) filter (where selection in ('H','D','A')) = 3
), aggregate_rows as (
  select fixture_id,
         'AVG'::text as bookmaker,
         round(avg(odds_h), 3) as odds_h,
         round(avg(odds_d), 3) as odds_d,
         round(avg(odds_a), 3) as odds_a,
         max(captured_at) as captured_at
    from book_rows
   group by fixture_id
  union all
  select fixture_id,
         'MAX'::text,
         max(odds_h), max(odds_d), max(odds_a), max(captured_at)
    from book_rows
   group by fixture_id
), all_rows as (
  select * from book_rows
  union all
  select * from aggregate_rows
), changed as (
  insert into ai.fixture_odds
    (fixture_id, season_fixture_id, division, match_date,
     home_canonical, away_canonical, bookmaker,
     odds_h, odds_d, odds_a, captured_at, source)
  select f.id, f.season_fixture_id, f.division, f.match_date,
         f.home_canonical, f.away_canonical, r.bookmaker,
         r.odds_h, r.odds_d, r.odds_a, r.captured_at, 'the-odds-api'
    from all_rows r
    join ai.fixtures f on f.id = r.fixture_id
   where r.odds_h is not null
     and r.odds_d is not null
     and r.odds_a is not null
  on conflict do nothing
  returning id
)
select count(*)::int as rows from changed
"""


def _count(conn, sql: str) -> int:
    row = conn.execute(sql).fetchone()
    return int(row["rows"]) if row else 0


def main() -> int:
    with job("reconcile_paid_fixture_evidence") as state:
        with connect() as conn:
            fixtures = _count(conn, UPSERT_FIXTURES)
            linked = _count(conn, LINK_EVENTS)
            prices = _count(conn, BRIDGE_1X2)
            conn.commit()

        state["rows"] = fixtures + linked + prices
        state["detail"] = {
            "fixtures_upserted": fixtures,
            "events_linked": linked,
            "fixture_odds_written": prices,
        }
        print(
            f"reconciled paid evidence: {fixtures} fixtures, "
            f"{linked} event links, {prices} 1X2 price rows"
        )
    return 0


if __name__ == "__main__":
    sys.exit(main())
