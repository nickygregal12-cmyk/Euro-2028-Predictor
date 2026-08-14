-- A playable league season for the disposable local Supabase stack.
--
-- ---------------------------------------------------------------------------
-- WHY THIS EXISTS
-- ---------------------------------------------------------------------------
--
-- The browser suite runs against `supabase db reset --local`, which applies the
-- committed migrations. The C1b catalogue migration creates both league-season
-- rows — `Premier League 2026/27` and `Scottish Premiership 2026/27` — and
-- nothing else: no clubs, no matchweeks, no fixtures. Measured against contract
-- 121, that means `get_season_play_context` raises 22023 "This competition has
-- no league matchweeks" for both, so every season surface built over the last
-- several batches renders its unavailable state and nothing else.
--
-- The consequence was a standing gap in the evidence: Overview's fixtures card,
-- the Matches section, the Match Centre, club form and the head-to-head all had
-- component coverage and had never been opened in a browser against real rows.
--
-- ---------------------------------------------------------------------------
-- WHY NOT THE DEVELOPMENT SEED
-- ---------------------------------------------------------------------------
--
-- `scripts/seed-dev/seed-league-seasons.ts` builds a full synthetic season and
-- would be the obvious thing to reuse. It cannot be: `seedPolicy` refuses any
-- `SUPABASE_URL` that does not contain the hosted development project ref, as a
-- second guard independent of `SEED_DEV` and `SUPABASE_PROD_URL`, and its whole
-- purpose is to stop a seed reaching production. Pointing it at a local stack
-- means weakening that guard for test convenience, which is not a trade worth
-- making. This file uses the mechanism the browser suite already has —
-- `psql` inside the disposable container, exactly like
-- `e2e/bonus-games-fixture.sql` — and can reach nothing else by construction.
--
-- ---------------------------------------------------------------------------
-- WHAT IT MAKES TRUE, AND WHAT IT DELIBERATELY DOES NOT
-- ---------------------------------------------------------------------------
--
-- Six clubs, seven matchweeks and twenty-one fixtures, in the SCOTTISH season
-- only. The first three preserve the original season-surface fixture;
-- matchweeks 4–7 extend the future calendar so the private-Championship browser
-- journey can satisfy the REAL minimum for a four-player field: two meetings
-- of a three-round round robin = six future matchweeks. The test does not ask
-- the server to relax or bypass `select_season_cup_format`.
--
-- The Premier League season is left empty on purpose: `weekly-navigation.spec.ts`
-- already asserts its empty competition shell.
--
-- Kickoffs are relative to `now()` rather than fixed instants. Matchweeks 2 and
-- 3 remain inside the fixture list's default window so the existing season UI
-- evidence is unchanged. Matchweeks 4–7 are further out: they are calendar
-- capacity for lifecycle tests, not fixtures the default list has to render.
--
-- Matchweek 1 is played WITH scores, so a settled result, club form and the
-- season head-to-head all have something real behind them. Matchweeks 2–7 are
-- scheduled, supplying the six future matchweeks the private Cup format needs.
--
-- NO ENTRY, NO PREDICTION, NO MEMBERSHIP. This is football, not a player: the
-- Match Centre's card read then correctly answers "you are not playing the
-- Match Predictor in this competition", which is the honest state for a browser
-- user who has joined nothing and is itself worth asserting. The private-play
-- lifecycle spec creates its own isolated memberships later.
--
-- Club names are real Scottish clubs so contract 136's identity reference
-- resolves them; a browser check of `ClubIdentity` against the neutral fallback
-- is the defect contract 137 was written for.

begin;

-- ---------------------------------------------------------------------------
-- Refuse anything but the empty local season this is written for.
-- ---------------------------------------------------------------------------
do $$
declare
  v_season uuid;
  v_kind text;
begin
  select season.id, season.kind into v_season, v_kind
    from public.tournaments season
   where season.name = 'Scottish Premiership 2026/27';

  if v_season is null then
    raise exception 'Browser E2E requires the seeded Scottish Premiership 2026/27 season row';
  end if;

  if v_kind is distinct from 'league_season' then
    raise exception 'Scottish Premiership 2026/27 is a % competition, not a league season', v_kind;
  end if;

  if exists (select 1 from public.season_fixtures where tournament_id = v_season) then
    raise exception 'Scottish Premiership 2026/27 already holds fixtures; refusing to seed over them';
  end if;
end;
$$;

-- ---------------------------------------------------------------------------
-- The season, its clubs and its matchweeks.
-- ---------------------------------------------------------------------------
update public.tournaments
   set status = 'active'
 where name = 'Scottish Premiership 2026/27';

insert into public.teams (tournament_id, name)
select season.id, club.name
  from public.tournaments season
 cross join (values
   ('Celtic'),
   ('Hibernian'),
   ('Aberdeen'),
   ('Hearts'),
   ('Dundee'),
   ('Kilmarnock')
 ) as club(name)
 where season.name = 'Scottish Premiership 2026/27'
 on conflict (tournament_id, name) do nothing;

insert into public.competition_rounds (tournament_id, round_key, ordinal, kind, label)
select season.id, round.key, round.ordinal, 'league_matchweek', round.label
  from public.tournaments season
 cross join (values
   ('mw-1', 1, 'Matchweek 1'),
   ('mw-2', 2, 'Matchweek 2'),
   ('mw-3', 3, 'Matchweek 3'),
   ('mw-4', 4, 'Matchweek 4'),
   ('mw-5', 5, 'Matchweek 5'),
   ('mw-6', 6, 'Matchweek 6'),
   ('mw-7', 7, 'Matchweek 7')
 ) as round(key, ordinal, label)
 where season.name = 'Scottish Premiership 2026/27'
 on conflict (tournament_id, round_key) do nothing;

-- ---------------------------------------------------------------------------
-- Twenty-one fixtures. Every club appears exactly once in each matchweek, which
-- is what `assert_season_fixture_shape` enforces.
-- ---------------------------------------------------------------------------
insert into public.season_fixtures (
  tournament_id,
  competition_round_id,
  home_team_id,
  away_team_id,
  kickoff_at,
  status,
  home_score,
  away_score
)
select
  season.id,
  round.id,
  home.id,
  away.id,
  now() + fixture.offset_days * interval '1 day' + fixture.offset_hours * interval '1 hour',
  fixture.status,
  fixture.home_score,
  fixture.away_score
from public.tournaments season
join (values
  ('mw-1', 'Celtic',     'Hibernian',  -4, 0, 'played',    3,    1),
  ('mw-1', 'Aberdeen',   'Hearts',     -4, 2, 'played',    0,    0),
  ('mw-1', 'Dundee',     'Kilmarnock', -3, 0, 'played',    1,    2),
  ('mw-2', 'Hibernian',  'Aberdeen',    2, 0, 'scheduled', null, null),
  ('mw-2', 'Hearts',     'Dundee',      2, 2, 'scheduled', null, null),
  ('mw-2', 'Kilmarnock', 'Celtic',      3, 0, 'scheduled', null, null),
  ('mw-3', 'Aberdeen',   'Celtic',      9, 0, 'scheduled', null, null),
  ('mw-3', 'Kilmarnock', 'Hibernian',   9, 2, 'scheduled', null, null),
  ('mw-3', 'Dundee',     'Hearts',     10, 0, 'scheduled', null, null),
  ('mw-4', 'Celtic',     'Hearts',     16, 0, 'scheduled', null, null),
  ('mw-4', 'Aberdeen',   'Kilmarnock', 16, 2, 'scheduled', null, null),
  ('mw-4', 'Hibernian',  'Dundee',     17, 0, 'scheduled', null, null),
  ('mw-5', 'Celtic',     'Dundee',     23, 0, 'scheduled', null, null),
  ('mw-5', 'Hearts',     'Kilmarnock', 23, 2, 'scheduled', null, null),
  ('mw-5', 'Hibernian',  'Aberdeen',   24, 0, 'scheduled', null, null),
  ('mw-6', 'Celtic',     'Aberdeen',   30, 0, 'scheduled', null, null),
  ('mw-6', 'Dundee',     'Hibernian',  30, 2, 'scheduled', null, null),
  ('mw-6', 'Kilmarnock', 'Hearts',     31, 0, 'scheduled', null, null),
  ('mw-7', 'Hearts',     'Celtic',     37, 0, 'scheduled', null, null),
  ('mw-7', 'Kilmarnock', 'Dundee',     37, 2, 'scheduled', null, null),
  ('mw-7', 'Aberdeen',   'Hibernian',  38, 0, 'scheduled', null, null)
) as fixture(round_key, home_name, away_name, offset_days, offset_hours, status, home_score, away_score)
  on true
join public.competition_rounds round
  on round.tournament_id = season.id and round.round_key = fixture.round_key
join public.teams home
  on home.tournament_id = season.id and home.name = fixture.home_name
join public.teams away
  on away.tournament_id = season.id and away.name = fixture.away_name
where season.name = 'Scottish Premiership 2026/27';

-- ---------------------------------------------------------------------------
-- Prove what was written, in the same transaction.
-- ---------------------------------------------------------------------------
do $$
declare
  v_season uuid;
  v_fixtures integer;
  v_played integer;
  v_upcoming integer;
begin
  select season.id into v_season
    from public.tournaments season
   where season.name = 'Scottish Premiership 2026/27';

  select count(*),
         count(*) filter (where status = 'played'),
         count(*) filter (where kickoff_at > now())
    into v_fixtures, v_played, v_upcoming
    from public.season_fixtures
   where tournament_id = v_season;

  if v_fixtures <> 21 then
    raise exception 'expected 21 season fixtures, wrote %', v_fixtures;
  end if;
  if v_played <> 3 then
    raise exception 'expected 3 settled fixtures, wrote %', v_played;
  end if;
  if v_upcoming <> 18 then
    raise exception 'expected 18 upcoming fixtures, wrote %', v_upcoming;
  end if;
  if (select count(*) from public.teams where tournament_id = v_season) <> 6 then
    raise exception 'expected 6 clubs in the Scottish season';
  end if;
end;
$$;

commit;
