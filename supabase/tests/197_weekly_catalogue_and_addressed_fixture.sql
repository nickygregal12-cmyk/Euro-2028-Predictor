-- Contracts 147 and 148: the published weekly catalogue, and one addressed fixture.
--
-- Two properties carry real risk and are proved against data rather than against
-- the function text: the catalogue must never surface the Euro tournament on the
-- weekly platform (`EURO-001`), and an addressed fixture must agree with contract
-- 139's calendar entry field for field, so a provisional score cannot render as a
-- result on one surface and not the other.
--
-- Anonymous access is proved by the GRANT rather than by a runtime call: neither
-- function is granted to `anon`, which `080_function_privileges.sql` asserts for
-- the whole allowlist. Calling one as an unauthenticated role would only
-- exercise `auth.uid()` against absent JWT claims and prove nothing.

begin;

select plan(12);

-- ---------------------------------------------------------------------------
-- Setup: its own season and its own player, so nothing depends on seed content.
-- ---------------------------------------------------------------------------

insert into public.tournaments (name, year, competition_id, season_key, kind, display_timezone, status)
select 'C147 Catalogue Probe', 2035, t.competition_id, 'cat-probe', 'league_season',
       t.display_timezone, 'active'
  from public.tournaments t
 where t.kind = 'league_season'
 order by t.name
 limit 1;

select set_config('test.cat_season',
  (select id::text from public.tournaments where season_key = 'cat-probe'), true);

-- A draft season, which must NOT appear: a draft is set up and not open.
insert into public.tournaments (name, year, competition_id, season_key, kind, display_timezone, status)
select 'C147 Draft Probe', 2036, t.competition_id, 'cat-draft', 'league_season',
       t.display_timezone, 'draft'
  from public.tournaments t
 where t.kind = 'league_season'
 order by t.name
 limit 1;

insert into public.teams (tournament_id, name) values
  (current_setting('test.cat_season')::uuid, 'Chelsea FC'),
  (current_setting('test.cat_season')::uuid, 'Aston Villa FC');

insert into public.competition_rounds (tournament_id, round_key, ordinal, kind, label)
values (current_setting('test.cat_season')::uuid, 'cat-mw1', 1, 'league_matchweek', 'Matchweek 1');

insert into public.season_fixtures (
  tournament_id, competition_round_id, home_team_id, away_team_id, kickoff_at, status)
select current_setting('test.cat_season')::uuid,
       (select id from public.competition_rounds
         where tournament_id = current_setting('test.cat_season')::uuid and round_key = 'cat-mw1'),
       (select id from public.teams
         where tournament_id = current_setting('test.cat_season')::uuid and name = 'Chelsea FC'),
       (select id from public.teams
         where tournament_id = current_setting('test.cat_season')::uuid and name = 'Aston Villa FC'),
       now() + interval '2 days', 'scheduled';

select set_config('test.cat_fixture',
  (select id::text from public.season_fixtures
    where tournament_id = current_setting('test.cat_season')::uuid), true);

set local session_replication_role = replica;
insert into auth.users (
  id, email, aud, role, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
values (md5('cat-player')::uuid, 'cat-player@example.test', 'authenticated', 'authenticated',
        '{}'::jsonb, '{}'::jsonb, now(), now());
set local session_replication_role = origin;

select set_config('request.jwt.claims',
  json_build_object('sub', md5('cat-player')::uuid, 'role', 'authenticated',
                    'app_metadata', json_build_object())::text, true);
set local role authenticated;

-- ---------------------------------------------------------------------------
-- The catalogue.
-- ---------------------------------------------------------------------------

select is(
  (select count(*) from jsonb_array_elements(
     public.get_published_weekly_seasons() -> 'seasons') entry
    where entry->>'season_key' = 'cat-probe'),
  1::bigint,
  'a published league season appears in the catalogue');

select is(
  (select count(*) from jsonb_array_elements(
     public.get_published_weekly_seasons() -> 'seasons') entry
    where entry->>'season_key' = 'cat-draft'),
  0::bigint,
  'a draft season does not: a draft is set up and not open');

-- EURO-001, asserted against the rows rather than the source.
select is(
  (select count(*) from jsonb_array_elements(
     public.get_published_weekly_seasons() -> 'seasons') entry
    join public.tournaments season on season.id = (entry->>'season_id')::uuid
   where season.kind <> 'league_season'),
  0::bigint,
  'no catalogue entry is a tournament, so Euro 2028 cannot reach the weekly platform');

select ok(
  (select bool_and(entry ? 'competition_slug' and entry ? 'season_key')
     from jsonb_array_elements(public.get_published_weekly_seasons() -> 'seasons') entry),
  'every entry carries the route slug and the season key');

-- The pair actually resolves through contract 121, which is why they travel
-- together rather than as two reads.
select ok(
  (select public.get_season_play_context(
            entry->>'competition_slug', entry->>'season_key') is not null
     from jsonb_array_elements(public.get_published_weekly_seasons() -> 'seasons') entry
    where entry->>'season_key' = 'cat-probe'),
  'the slug and season key an entry returns resolve to a play context');

-- ---------------------------------------------------------------------------
-- The addressed fixture.
-- ---------------------------------------------------------------------------

select is(
  public.get_season_fixture(current_setting('test.cat_fixture')::uuid)
    -> 'fixture' ->> 'id',
  current_setting('test.cat_fixture'),
  'the addressed fixture is the one that was asked for');

select is(
  public.get_season_fixture(current_setting('test.cat_fixture')::uuid)
    -> 'fixture' -> 'round' ->> 'label',
  'Matchweek 1',
  'it carries its matchweek label');

select ok(
  (public.get_season_fixture(current_setting('test.cat_fixture')::uuid)
     -> 'fixture' -> 'result') is null,
  'a fixture that has not been played reports no result');

-- Contract 136/137's club identity is joined here too, not only in the list.
select is(
  public.get_season_fixture(current_setting('test.cat_fixture')::uuid)
    -> 'fixture' -> 'home' ->> 'name',
  'Chelsea FC',
  'the addressed fixture names its clubs');

select is(
  public.get_season_fixture(current_setting('test.cat_fixture')::uuid)
    -> 'competition' ->> 'season_key',
  'cat-probe',
  'the season header identifies the season');

select throws_ok(
  $$select public.get_season_fixture('00000000-0000-0000-0000-000000000009'::uuid)$$,
  '22023', null, 'an unknown fixture is refused rather than answered with null');

-- The two payloads agree, compared as key sets over the SAME fixture. This is
-- the check a later edit to one surface cannot quietly pass.
select is(
  (select array_agg(k order by k) from jsonb_object_keys(
     public.get_season_fixture(current_setting('test.cat_fixture')::uuid) -> 'fixture') k),
  (select array_agg(k order by k) from jsonb_array_elements(
     public.get_season_fixtures(
       current_setting('test.cat_season')::uuid,
       now() - interval '1 day', now() + interval '5 days') -> 'fixtures') entry,
     lateral jsonb_object_keys(entry) k
    where entry->>'id' = current_setting('test.cat_fixture')),
  'the addressed fixture and the calendar entry expose exactly the same fields');

select * from finish();

rollback;
