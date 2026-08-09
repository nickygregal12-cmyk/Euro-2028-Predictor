-- Contract 139: a season's fixtures, ordered by kickoff and labelled by round.
--
-- THE ASSERTION THIS FILE EXISTS FOR is the one sentence the MASTER-TODO item
-- is written in: a match postponed out of matchweek 5 into November sorts into
-- November while still saying "Matchweek 5". Everything else here -- the gate,
-- the window bounds, the club identity -- is worth checking and is not the
-- point.
--
-- The case is built deliberately: a matchweek 6 fixture kicks off BEFORE a
-- postponed matchweek 5 one. A by-round implementation returns them in the
-- wrong order and passes every other assertion in this file.

begin;

select plan(9);

-- ---------------------------------------------------------------------------
-- Setup.
-- ---------------------------------------------------------------------------

insert into public.tournaments (name, year, competition_id, season_key, kind, display_timezone, status)
select 'C139 Fixtures Probe', 2034, t.competition_id, 'sfx-probe', 'league_season',
       t.display_timezone, 'active'
  from public.tournaments t
 where t.kind = 'league_season'
 order by t.name
 limit 1;

select set_config('test.sfx_season',
  (select id::text from public.tournaments where season_key = 'sfx-probe'), true);

-- Real club names, so the contract 136/137 identity join is exercised rather
-- than assumed. Chelsea in particular is the club contract 137 repaired.
insert into public.teams (tournament_id, name) values
  (current_setting('test.sfx_season')::uuid, 'Chelsea FC'),
  (current_setting('test.sfx_season')::uuid, 'Aston Villa FC');

insert into public.competition_rounds (tournament_id, round_key, ordinal, kind, label)
values (current_setting('test.sfx_season')::uuid, 'sfx-mw5', 5, 'league_matchweek', 'Matchweek 5'),
       (current_setting('test.sfx_season')::uuid, 'sfx-mw6', 6, 'league_matchweek', 'Matchweek 6');

-- Matchweek 5, postponed to ten days out. It keeps its round: the owner's
-- 5 August amendment, and the reason this test exists.
insert into public.season_fixtures
  (tournament_id, competition_round_id, home_team_id, away_team_id, kickoff_at, status)
select current_setting('test.sfx_season')::uuid,
       (select id from public.competition_rounds
         where tournament_id = current_setting('test.sfx_season')::uuid and round_key = 'sfx-mw5'),
       (select id from public.teams
         where tournament_id = current_setting('test.sfx_season')::uuid and name = 'Chelsea FC'),
       (select id from public.teams
         where tournament_id = current_setting('test.sfx_season')::uuid and name = 'Aston Villa FC'),
       now() + interval '10 days', 'scheduled';

-- Matchweek 6, played in two days -- BEFORE the postponed matchweek 5 fixture.
insert into public.season_fixtures
  (tournament_id, competition_round_id, home_team_id, away_team_id, kickoff_at, status)
select current_setting('test.sfx_season')::uuid,
       (select id from public.competition_rounds
         where tournament_id = current_setting('test.sfx_season')::uuid and round_key = 'sfx-mw6'),
       (select id from public.teams
         where tournament_id = current_setting('test.sfx_season')::uuid and name = 'Aston Villa FC'),
       (select id from public.teams
         where tournament_id = current_setting('test.sfx_season')::uuid and name = 'Chelsea FC'),
       now() + interval '2 days', 'scheduled';

set local session_replication_role = replica;
insert into auth.users (
  id, email, aud, role, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
values (md5('sfx-player')::uuid, 'sfx-player@example.test', 'authenticated', 'authenticated',
        '{}'::jsonb, '{}'::jsonb, now(), now());
set local session_replication_role = origin;

select set_config('request.jwt.claims',
  json_build_object('sub', md5('sfx-player')::uuid, 'role', 'authenticated',
                    'app_metadata', json_build_object())::text, true);
set local role authenticated;

-- ---------------------------------------------------------------------------
-- The assertion this file exists for.
-- ---------------------------------------------------------------------------

select is(
  ((select public.get_season_fixtures(current_setting('test.sfx_season')::uuid))
    -> 'fixtures' -> 0 -> 'round' ->> 'label'),
  'Matchweek 6',
  'the fixture played first comes first, even though it belongs to a later '
  'matchweek than the postponed one');

select is(
  ((select public.get_season_fixtures(current_setting('test.sfx_season')::uuid))
    -> 'fixtures' -> 1 -> 'round' ->> 'label'),
  'Matchweek 5',
  'and the postponed fixture still says Matchweek 5 -- the round is a label, '
  'not a position');

select is(
  ((select public.get_season_fixtures(current_setting('test.sfx_season')::uuid))
    -> 'fixtures' -> 1 -> 'home' ->> 'name'),
  'Chelsea FC',
  'with the fixture it belongs to intact');

-- ---------------------------------------------------------------------------
-- Club identity travels with the fixture (contracts 136 and 137).
-- ---------------------------------------------------------------------------

select is(
  ((select public.get_season_fixtures(current_setting('test.sfx_season')::uuid))
    -> 'fixtures' -> 1 -> 'home' ->> 'short_code'),
  'CHE',
  'Chelsea resolves to its code rather than the neutral fallback');

select is(
  ((select public.get_season_fixtures(current_setting('test.sfx_season')::uuid))
    -> 'fixtures' -> 1 -> 'away' ->> 'club_colours'),
  'Claret / Sky Blue',
  'and Aston Villa to its colours');

-- ---------------------------------------------------------------------------
-- It is football, not entry.
-- ---------------------------------------------------------------------------

select is(
  ((select public.get_season_fixtures(current_setting('test.sfx_season')::uuid))
    -> 'fixtures' -> 0 -> 'result'),
  'null'::jsonb,
  'an unplayed fixture carries no result');

select is(
  ((select public.get_season_fixtures(current_setting('test.sfx_season')::uuid))
    -> 'fixtures' -> 0 -> 'live'),
  'null'::jsonb,
  'and no live block until a provider has said something about it');

-- ---------------------------------------------------------------------------
-- Bounds.
-- ---------------------------------------------------------------------------

select throws_ok(
  format('select public.get_season_fixtures(%L::uuid, now(), now() - interval ''1 day'')',
         current_setting('test.sfx_season')),
  '22023',
  null,
  'a window that ends before it starts is refused');

select throws_ok(
  format('select public.get_season_fixtures(%L::uuid, now(), now() + interval ''200 days'')',
         current_setting('test.sfx_season')),
  '22023',
  null,
  'and one longer than 120 days is refused rather than silently truncated');

reset role;

select finish();
rollback;
