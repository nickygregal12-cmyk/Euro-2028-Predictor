-- Contracts 147 and 148: the published weekly catalogue, and one addressed fixture.
--
-- Two properties carry real risk and are proved against data rather than against
-- the function text: the catalogue must never surface the Euro tournament on the
-- weekly platform (`EURO-001`), and an addressed fixture must agree with contract
-- 139's calendar entry so a provisional score cannot render as a result on one
-- surface and not the other.

begin;

select plan(14);

select set_config('test.cat_season',
  (select t.id::text from public.tournaments t where t.name = 'Scottish Premiership 2026/27'), true);

-- An ordinary signed-in player. Neither read is admin-shaped.
select set_config('test.cat_user',
  (select id::text from auth.users order by created_at limit 1), true);

-- ---------------------------------------------------------------------------
-- Both reads refuse an anonymous caller.
-- ---------------------------------------------------------------------------

select throws_ok(
  $$select public.get_published_weekly_seasons()$$,
  '42501', null, 'the catalogue refuses an anonymous caller');

select throws_ok(
  $$select public.get_season_fixture('00000000-0000-0000-0000-000000000001'::uuid)$$,
  '42501', null, 'the addressed fixture read refuses an anonymous caller');

set local role authenticated;
select set_config('request.jwt.claims',
  json_build_object('sub', current_setting('test.cat_user'), 'role', 'authenticated')::text, true);

-- ---------------------------------------------------------------------------
-- The catalogue.
-- ---------------------------------------------------------------------------

select ok(
  (public.get_published_weekly_seasons() -> 'seasons') is not null,
  'the catalogue answers with a seasons array');

-- EURO-001. The property this migration exists to keep, asserted against the
-- rows rather than the source: no entry may be the tournament.
select is(
  (select count(*) from jsonb_array_elements(
     public.get_published_weekly_seasons() -> 'seasons') entry
    where entry->>'season_name' ilike '%Euro%'),
  0::bigint,
  'Euro 2028 never appears in the weekly catalogue');

select is(
  (select count(*) from jsonb_array_elements(
     public.get_published_weekly_seasons() -> 'seasons') entry
    join public.tournaments season on season.id = (entry->>'season_id')::uuid
   where season.kind <> 'league_season'),
  0::bigint,
  'every catalogue entry is a league season');

-- Both halves of the address, in the order get_season_play_context wants them.
select ok(
  (select bool_and(entry ? 'competition_slug' and entry ? 'season_key')
     from jsonb_array_elements(public.get_published_weekly_seasons() -> 'seasons') entry),
  'every entry carries the route slug and the season key');

-- And the pair actually resolves through contract 121, which is the whole point
-- of returning them together.
select ok(
  (select public.get_season_play_context(
            entry->>'competition_slug', entry->>'season_key') is not null
     from jsonb_array_elements(public.get_published_weekly_seasons() -> 'seasons') entry
    limit 1),
  'the slug and season key a catalogue entry returns resolve to a play context');

-- ---------------------------------------------------------------------------
-- The addressed fixture.
-- ---------------------------------------------------------------------------

reset role;

insert into public.teams (tournament_id, name) values
  (current_setting('test.cat_season')::uuid, 'Address Rovers'),
  (current_setting('test.cat_season')::uuid, 'Address Athletic');

insert into public.competition_rounds (tournament_id, round_key, ordinal, kind, label)
values (current_setting('test.cat_season')::uuid, 'cat-mw1', 1, 'league_matchweek', 'Matchweek 1');

insert into public.season_fixtures (
  tournament_id, competition_round_id, home_team_id, away_team_id, kickoff_at, status
) values (
  current_setting('test.cat_season')::uuid,
  (select id from public.competition_rounds
    where tournament_id = current_setting('test.cat_season')::uuid and round_key = 'cat-mw1'),
  (select id from public.teams where name = 'Address Rovers'),
  (select id from public.teams where name = 'Address Athletic'),
  now() + interval '2 days',
  'scheduled'
);

select set_config('test.cat_fixture',
  (select f.id::text from public.season_fixtures f
    join public.teams h on h.id = f.home_team_id
   where h.name = 'Address Rovers'), true);

set local role authenticated;
select set_config('request.jwt.claims',
  json_build_object('sub', current_setting('test.cat_user'), 'role', 'authenticated')::text, true);

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

-- A scheduled fixture has no result, whatever else it has.
select ok(
  (public.get_season_fixture(current_setting('test.cat_fixture')::uuid)
     -> 'fixture' -> 'result') is null,
  'a fixture that has not been played reports no result');

select is(
  public.get_season_fixture(current_setting('test.cat_fixture')::uuid)
    -> 'competition' ->> 'slug',
  'scottish-premiership',
  'the season header names the route slug');

select throws_ok(
  $$select public.get_season_fixture('00000000-0000-0000-0000-000000000009'::uuid)$$,
  '22023', null, 'an unknown fixture is refused rather than answered with null');

-- The two payloads agree. Compared as key sets over the SAME fixture, which is
-- the check that a later edit to one surface cannot quietly pass.
reset role;
set local role authenticated;
select set_config('request.jwt.claims',
  json_build_object('sub', current_setting('test.cat_user'), 'role', 'authenticated')::text, true);

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
