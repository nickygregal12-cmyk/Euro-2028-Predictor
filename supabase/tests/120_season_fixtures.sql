-- Contract 68: the league-season fixture container.
--
-- The column constraints are checked by the schema itself. What needs proving
-- here is the part a CHECK cannot express — the cross-table invariants carried
-- by `predictor_internal.assert_season_fixture_shape` — and the season boundary
-- enforced by the composite foreign keys.

begin;
select plan(11);

select has_table('public', 'season_fixtures', 'season_fixtures exists');

select is(
  (select relrowsecurity from pg_class
    where relname = 'season_fixtures' and relnamespace = 'public'::regnamespace),
  true,
  'season_fixtures has row level security enabled'
);

-- No browser role may select it directly; reads arrive through a bounded RPC
-- when the season surfaces land.
select is(
  (select count(*)::integer
     from information_schema.role_table_grants
    where table_schema = 'public'
      and table_name = 'season_fixtures'
      and grantee in ('anon', 'authenticated')),
  0,
  'no browser role holds a direct grant on season_fixtures'
);

select is(
  (select count(*)::integer from public.season_fixtures),
  0,
  'the migration invents no fixtures'
);

-- ---------------------------------------------------------------------------
-- Fixtures for the assertions below: one league season, one tournament season.
-- ---------------------------------------------------------------------------

create temporary table season_fixture_probe as
select
  (select id from public.tournaments where kind = 'league_season' order by name limit 1) as season_id,
  (select id from public.tournaments where kind = 'tournament' order by name limit 1) as tournament_id;

insert into public.competition_rounds (tournament_id, round_key, ordinal, kind, label)
select season_id, 'MW1', 1, 'league_matchweek', 'Matchweek 1' from season_fixture_probe;

insert into public.teams (tournament_id, name)
select season_id, 'Probe Club A' from season_fixture_probe;
insert into public.teams (tournament_id, name)
select season_id, 'Probe Club B' from season_fixture_probe;
insert into public.teams (tournament_id, name)
select season_id, 'Probe Club C' from season_fixture_probe;

-- A legitimate fixture is accepted.
select lives_ok(
  $$
    insert into public.season_fixtures (tournament_id, competition_round_id, home_team_id, away_team_id)
    select p.season_id,
           (select id from public.competition_rounds where tournament_id = p.season_id and round_key = 'MW1'),
           (select id from public.teams where tournament_id = p.season_id and name = 'Probe Club A'),
           (select id from public.teams where tournament_id = p.season_id and name = 'Probe Club B')
      from season_fixture_probe p
  $$,
  'a well-formed league fixture is accepted'
);

-- A club plays at most once per matchweek. Without this, the Main Predictor
-- would score a club twice in one matchweek and the standings would disagree
-- with the league's own table.
select throws_ok(
  $$
    insert into public.season_fixtures (tournament_id, competition_round_id, home_team_id, away_team_id)
    select p.season_id,
           (select id from public.competition_rounds where tournament_id = p.season_id and round_key = 'MW1'),
           (select id from public.teams where tournament_id = p.season_id and name = 'Probe Club C'),
           (select id from public.teams where tournament_id = p.season_id and name = 'Probe Club A')
      from season_fixture_probe p
  $$,
  '23505',
  'A club plays at most once per matchweek',
  'a club cannot appear twice in one matchweek'
);

-- A tournament has no matchweeks, so it cannot hold a season fixture.
select throws_ok(
  $$
    insert into public.season_fixtures (tournament_id, competition_round_id, home_team_id, away_team_id)
    select p.tournament_id,
           (select id from public.competition_rounds where tournament_id = p.season_id and round_key = 'MW1'),
           (select id from public.teams where tournament_id = p.season_id and name = 'Probe Club A'),
           (select id from public.teams where tournament_id = p.season_id and name = 'Probe Club B')
      from season_fixture_probe p
  $$,
  'a tournament season cannot hold a league fixture'
);

-- A club from another season cannot be named: the composite foreign key makes
-- the season part of the key, so this is refused by the database rather than
-- by convention.
select throws_ok(
  $$
    insert into public.season_fixtures (tournament_id, competition_round_id, home_team_id, away_team_id)
    select p.season_id,
           (select id from public.competition_rounds where tournament_id = p.season_id and round_key = 'MW1'),
           (select id from public.teams where tournament_id = p.tournament_id order by name limit 1),
           (select id from public.teams where tournament_id = p.season_id and name = 'Probe Club C')
      from season_fixture_probe p
  $$,
  'a club from another season cannot be named in a fixture'
);

-- A scoreline exists exactly when the fixture was played: an abandoned
-- fixture's partial score never stands, so there is no state that can hold one.
select throws_ok(
  $$
    update public.season_fixtures
       set status = 'abandoned', home_score = 1, away_score = 0
     where id = (select id from public.season_fixtures limit 1)
  $$,
  '23514',
  null,
  'an abandoned fixture cannot carry a scoreline'
);

select lives_ok(
  $$
    update public.season_fixtures
       set status = 'played', home_score = 2, away_score = 1
     where id = (select id from public.season_fixtures limit 1)
  $$,
  'a played fixture carries its scoreline'
);

select throws_ok(
  $$
    update public.season_fixtures
       set status = 'played', home_score = null, away_score = null
     where id = (select id from public.season_fixtures limit 1)
  $$,
  '23514',
  null,
  'a played fixture cannot lack a scoreline'
);

select * from finish();
rollback;
