-- Contract 160: the competition's own league table.
--
-- THE ASSERTIONS THIS FILE EXISTS FOR are the three that cannot be checked by
-- reading the migration, and that a table looking plausible would hide.
--
-- First: the tie-break order is APPLIED, and applied in the order the
-- competition configured. The fixture set below puts three clubs on identical
-- points, goal difference, goals for AND goals against, and arranges the
-- head-to-head mini-league so that it orders them CHARLIE, BRAVO, ALPHA — the
-- exact reverse of the alphabetical fallback. A table that quietly fell back
-- would read Alpha, Bravo, Charlie, so the two outcomes cannot be confused.
-- Every earlier draft of this suite used clubs whose head-to-head order matched
-- their names, and would have passed against a deriver that ignored the rule
-- entirely.
--
-- Second: an AWARDED outcome moves the table and leaves `season_fixtures`
-- exactly as it was. That is the whole design — predictions were settled
-- against the fixture, so an award that wrote the fixture would silently
-- rescore a settled matchweek months later.
--
-- Third: a deduction announced for next season does not move THIS season's
-- table. `effective_from` is not decoration.

begin;

select plan(21);

-- ---------------------------------------------------------------------------
-- One season, five clubs, ten matchweeks.
--
-- One fixture per matchweek, because `assert_season_fixture_shape` refuses a
-- club appearing twice in the same round — which is correct, and which the
-- first draft of this suite tripped over by putting the whole mini-league in
-- Matchweek 1.
-- ---------------------------------------------------------------------------

insert into public.tournaments (name, year, competition_id, season_key, kind, display_timezone, status)
select 'C160 Table Verify', 2046, t.competition_id, 'table-verify', 'league_season',
       'Europe/London', 'active'
  from public.tournaments t where t.kind = 'league_season' order by t.name limit 1;

select set_config('test.tv_season',
  (select id::text from public.tournaments where season_key = 'table-verify'), true);

insert into public.teams (id, tournament_id, name) values
  (md5('tv-alpha')::uuid,   current_setting('test.tv_season')::uuid, 'Alpha'),
  (md5('tv-bravo')::uuid,   current_setting('test.tv_season')::uuid, 'Bravo'),
  (md5('tv-charlie')::uuid, current_setting('test.tv_season')::uuid, 'Charlie'),
  (md5('tv-delta')::uuid,   current_setting('test.tv_season')::uuid, 'Delta'),
  (md5('tv-echo')::uuid,    current_setting('test.tv_season')::uuid, 'Echo');

insert into public.competition_rounds (id, tournament_id, round_key, ordinal, kind, label)
select md5('tv-mw' || n)::uuid, current_setting('test.tv_season')::uuid,
       'tv-mw' || n, n, 'league_matchweek', 'Matchweek ' || n
  from generate_series(1, 10) as n;

-- The mini-league among Alpha, Bravo and Charlie: C beats B, C beats A, B beats
-- A. Outside it, Charlie loses both, Bravo wins one, Alpha wins both — so all
-- three finish on 6 points, goal difference 0, 2 for and 2 against.
insert into public.season_fixtures
  (tournament_id, competition_round_id, home_team_id, away_team_id, kickoff_at, status, home_score, away_score)
values
  (current_setting('test.tv_season')::uuid, md5('tv-mw1')::uuid,
   md5('tv-charlie')::uuid, md5('tv-bravo')::uuid, now() - interval '9 days', 'played', 1, 0),
  (current_setting('test.tv_season')::uuid, md5('tv-mw2')::uuid,
   md5('tv-charlie')::uuid, md5('tv-alpha')::uuid, now() - interval '8 days', 'played', 1, 0),
  (current_setting('test.tv_season')::uuid, md5('tv-mw3')::uuid,
   md5('tv-bravo')::uuid, md5('tv-alpha')::uuid, now() - interval '7 days', 'played', 1, 0),
  (current_setting('test.tv_season')::uuid, md5('tv-mw4')::uuid,
   md5('tv-delta')::uuid, md5('tv-charlie')::uuid, now() - interval '6 days', 'played', 1, 0),
  (current_setting('test.tv_season')::uuid, md5('tv-mw5')::uuid,
   md5('tv-echo')::uuid, md5('tv-charlie')::uuid, now() - interval '5 days', 'played', 1, 0),
  (current_setting('test.tv_season')::uuid, md5('tv-mw6')::uuid,
   md5('tv-bravo')::uuid, md5('tv-delta')::uuid, now() - interval '4 days', 'played', 1, 0),
  (current_setting('test.tv_season')::uuid, md5('tv-mw7')::uuid,
   md5('tv-echo')::uuid, md5('tv-bravo')::uuid, now() - interval '3 days', 'played', 1, 0),
  (current_setting('test.tv_season')::uuid, md5('tv-mw8')::uuid,
   md5('tv-alpha')::uuid, md5('tv-delta')::uuid, now() - interval '2 days', 'played', 1, 0),
  (current_setting('test.tv_season')::uuid, md5('tv-mw9')::uuid,
   md5('tv-alpha')::uuid, md5('tv-echo')::uuid, now() - interval '1 day', 'played', 1, 0),
  -- Contributes nothing until it is awarded.
  (current_setting('test.tv_season')::uuid, md5('tv-mw10')::uuid,
   md5('tv-delta')::uuid, md5('tv-echo')::uuid, now() - interval '1 day', 'postponed', null, null);

set local session_replication_role = replica;
insert into auth.users (id, email, aud, role, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
values (md5('tv-admin')::uuid, 'tv-admin@example.test', 'authenticated', 'authenticated',
        '{}'::jsonb, '{}'::jsonb, now(), now()),
       (md5('tv-player')::uuid, 'tv-player@example.test', 'authenticated', 'authenticated',
        '{}'::jsonb, '{}'::jsonb, now(), now());
set local session_replication_role = origin;

insert into public.profiles (id, display_name, welcomed_at) values
  (md5('tv-admin')::uuid, 'Table Admin', now()),
  (md5('tv-player')::uuid, 'Table Player', now());

-- ---------------------------------------------------------------------------
-- A PLAIN PLAYER READS THE TABLE
-- ---------------------------------------------------------------------------

select set_config('request.jwt.claims',
  json_build_object('sub', md5('tv-player')::uuid, 'role', 'authenticated',
                    'app_metadata', json_build_object())::text, true);
set local role authenticated;

select set_config('test.tv_table',
  public.get_competition_table(current_setting('test.tv_season')::uuid)::text, true);

-- The three tied clubs really are tied, which is what makes every tie-break
-- assertion below meaningful rather than accidental.
select is(
  (select count(distinct (entry ->> 'points') || '/' || (entry ->> 'goal_difference')
                          || '/' || (entry ->> 'goals_for') || '/' || (entry ->> 'goals_against'))::integer
     from jsonb_array_elements(current_setting('test.tv_table')::jsonb -> 'rows') entry
    where entry ->> 'team_name' in ('Alpha', 'Bravo', 'Charlie')),
  1,
  'Alpha, Bravo and Charlie are level on points, goal difference, goals for and goals against');

-- THE ASSERTION THIS FILE EXISTS FOR.
select is(
  (select string_agg(entry ->> 'team_name', ' > ' order by (entry ->> 'position')::integer)
     from jsonb_array_elements(current_setting('test.tv_table')::jsonb -> 'rows') entry
    where entry ->> 'team_name' in ('Alpha', 'Bravo', 'Charlie')),
  'Charlie > Bravo > Alpha',
  'the head-to-head mini-league orders the tied clubs, and orders them against the alphabet');

select is(
  (select (entry ->> 'played')::integer
     from jsonb_array_elements(current_setting('test.tv_table')::jsonb -> 'rows') entry
    where entry ->> 'team_name' = 'Charlie'),
  4,
  'a postponed fixture is not played');

select is(
  (select (entry ->> 'points')::integer
     from jsonb_array_elements(current_setting('test.tv_table')::jsonb -> 'rows') entry
    where entry ->> 'team_name' = 'Delta'),
  3,
  'and it contributes no points to either club');

select is(
  (select count(*)::integer
     from jsonb_array_elements(current_setting('test.tv_table')::jsonb -> 'rows') entry),
  5,
  'every club in the season appears, including one that has not won');

select is(
  current_setting('test.tv_table')::jsonb -> 'rules' ->> 'configured', 'false',
  'a season with no rules row is answered on the defaults, and says so');

select is(
  current_setting('test.tv_table')::jsonb -> 'provenance' ->> 'fixtures_counted', '9',
  'provenance counts the fixtures the table was built from');

select is(
  current_setting('test.tv_table')::jsonb -> 'provenance' ->> 'fixtures_outstanding', '1',
  'and the ones still to come');

-- ---------------------------------------------------------------------------
-- ORDERING IS TOTAL AND REPEATABLE. Two calls that disagree would make a
-- rendered table jump and a paginated one drop or duplicate a club.
-- ---------------------------------------------------------------------------

select is(
  (select string_agg(entry ->> 'team_name', ',' order by (entry ->> 'position')::integer)
     from jsonb_array_elements(
       public.get_competition_table(current_setting('test.tv_season')::uuid) -> 'rows') entry),
  (select string_agg(entry ->> 'team_name', ',' order by (entry ->> 'position')::integer)
     from jsonb_array_elements(
       public.get_competition_table(current_setting('test.tv_season')::uuid) -> 'rows') entry),
  'two calls return the same total order');

-- ---------------------------------------------------------------------------
-- REFUSALS A PLAYER MUST MEET
-- ---------------------------------------------------------------------------

select throws_ok(
  format('select public.get_competition_table(%L::uuid)',
         (select id from public.tournaments where kind = 'tournament' limit 1)),
  '22023', null,
  'a tournament has no league table, which is what keeps this off Euro 2028');

select throws_ok(
  $$select public.get_competition_table('00000000-0000-0000-0000-0000000000ff'::uuid)$$,
  '22023', null,
  'an unknown season is refused rather than answered empty');

-- An ordinary player may not set the competition's rules, deduct points or
-- award a fixture. Three separate gates, three separate assertions.
select throws_ok(
  format($$select public.admin_set_competition_table_rules(%L::uuid, 3::smallint, 1::smallint,
            0::smallint, array['goal_difference'], 0::smallint, 0::smallint, 0::smallint)$$,
         current_setting('test.tv_season')),
  '42501', null,
  'an ordinary player cannot set a competition''s table rules');

select throws_ok(
  format($$select public.admin_record_table_adjustment(%L::uuid, %L::uuid, -9, 'not mine to give')$$,
         current_setting('test.tv_season'), md5('tv-alpha')::uuid),
  '42501', null,
  'an ordinary player cannot deduct points');

select throws_ok(
  format($$select public.admin_award_fixture_outcome(%L::uuid, 3::smallint, 0::smallint, 'not mine to give')$$,
         (select id from public.season_fixtures
           where tournament_id = current_setting('test.tv_season')::uuid
             and status = 'postponed')),
  '42501', null,
  'an ordinary player cannot award a fixture');

-- ---------------------------------------------------------------------------
-- AN ADMINISTRATOR CONFIGURES THE COMPETITION
-- ---------------------------------------------------------------------------

reset role;
select set_config('request.jwt.claims',
  json_build_object('sub', md5('tv-admin')::uuid, 'role', 'authenticated',
                    'app_metadata', json_build_object('admin_role', 'super_admin'))::text, true);
set local role authenticated;

select lives_ok(
  format($$select public.admin_set_competition_table_rules(%L::uuid, 3::smallint, 1::smallint,
            0::smallint, array['goal_difference','goals_for','head_to_head_points'],
            1::smallint, 2::smallint, 1::smallint)$$, current_setting('test.tv_season')),
  'an administrator sets the competition''s points, tie-break order and boundaries');

select is(
  (select entry ->> 'boundary'
     from jsonb_array_elements(
       public.get_competition_table(current_setting('test.tv_season')::uuid) -> 'rows') entry
    where (entry ->> 'position')::integer = 1),
  'promotion',
  'the promotion boundary is applied from the top');

select is(
  (select entry ->> 'boundary'
     from jsonb_array_elements(
       public.get_competition_table(current_setting('test.tv_season')::uuid) -> 'rows') entry
    where (entry ->> 'position')::integer = 5),
  'relegation',
  'and the relegation boundary from the bottom, counted against the real field size');

-- ---------------------------------------------------------------------------
-- A DEDUCTION IN FORCE MOVES THE TABLE. ONE ANNOUNCED FOR NEXT SEASON DOES NOT.
-- ---------------------------------------------------------------------------

select public.admin_record_table_adjustment(
  current_setting('test.tv_season')::uuid, md5('tv-charlie')::uuid,
  -9, 'pgTAP: in force from yesterday', now() - interval '1 day');

select public.admin_record_table_adjustment(
  current_setting('test.tv_season')::uuid, md5('tv-delta')::uuid,
  -6, 'pgTAP: announced for next season', now() + interval '365 days');

select is(
  (select (entry ->> 'points')::integer
     from jsonb_array_elements(
       public.get_competition_table(current_setting('test.tv_season')::uuid) -> 'rows') entry
    where entry ->> 'team_name' = 'Charlie'),
  -3,
  'a deduction already in force is applied: six points become minus three');

select is(
  (select (entry ->> 'points')::integer
     from jsonb_array_elements(
       public.get_competition_table(current_setting('test.tv_season')::uuid) -> 'rows') entry
    where entry ->> 'team_name' = 'Delta'),
  3,
  'a deduction announced for next season does not move this season''s table');

-- ---------------------------------------------------------------------------
-- THE AWARD, AND THE FIXTURE IT MUST NOT TOUCH
-- ---------------------------------------------------------------------------

select public.admin_award_fixture_outcome(
  (select id from public.season_fixtures
    where tournament_id = current_setting('test.tv_season')::uuid and status = 'postponed'),
  3::smallint, 0::smallint, 'pgTAP: awarded after a postponement');

select is(
  (select (entry ->> 'points')::integer
     from jsonb_array_elements(
       public.get_competition_table(current_setting('test.tv_season')::uuid) -> 'rows') entry
    where entry ->> 'team_name' = 'Delta'),
  6,
  'an awarded outcome counts towards the table');

-- THE OTHER HALF OF THE SAME DECISION, and the reason the award is not a status.
select is(
  (select status || '/' || coalesce(home_score::text, 'null')
     from public.season_fixtures
    where tournament_id = current_setting('test.tv_season')::uuid
      and competition_round_id = md5('tv-mw10')::uuid),
  'postponed/null',
  'and the fixture keeps the result predictions were settled against, unwritten');

reset role;

select * from finish();

rollback;
