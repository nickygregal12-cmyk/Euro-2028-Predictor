-- Contract 130: what everybody else predicted, for one season matchweek.
--
-- THE ASSERTION THIS FILE EXISTS FOR is that the cohort is counted PER
-- MATCHWEEK. One season holds twelve entrants; twelve predicted matchweek 1 and
-- six predicted matchweek 2. A season-wide count would report both as safe.
-- Here matchweek 1 answers and matchweek 2 is suppressed, from the same season
-- in the same transaction.
--
-- THE SECOND ASSERTION is the reveal boundary, which is the matchweek's own
-- lock rather than one instant for the whole competition.
--
-- Self-contained: its own season, clubs, rounds, fixtures, entries and users.

begin;

select plan(16);

select is(
  (select count(*)::integer from pg_proc proc
     join pg_namespace ns on ns.oid = proc.pronamespace
    where ns.nspname = 'public'
      and proc.proname = 'get_season_prediction_consensus'
      and proc.prosecdef and proc.proconfig @> array['search_path=""']),
  1,
  'the read exists, security definer, search path pinned');

select is(
  (select count(*)::integer from information_schema.routine_privileges
    where routine_name = 'get_season_prediction_consensus'
      and grantee in ('anon', 'service_role')),
  0,
  'and reaches neither anon nor service_role');

-- ---------------------------------------------------------------------------
-- Setup: two locked matchweeks, twelve entrants, unequal participation.
-- ---------------------------------------------------------------------------

insert into public.tournaments (name, year, competition_id, season_key, kind, display_timezone, status)
select 'C130 Consensus Probe', 2030, t.competition_id, 'con-probe', 'league_season',
       t.display_timezone, 'active'
  from public.tournaments t
 where t.kind = 'league_season'
 order by t.name
 limit 1;

select set_config('test.con_season',
  (select id::text from public.tournaments where season_key = 'con-probe'), true);

insert into public.bonus_competitions (
  id, tournament_id, game_key, published, availability_status,
  draw_required, visibility_kind, registration_opens_at
) values (
  md5('con-mp')::uuid, current_setting('test.con_season')::uuid,
  'main_predictor', true, 'active', false, 'public',
  now() - interval '2 days'
);

insert into public.teams (tournament_id, name) values
  (current_setting('test.con_season')::uuid, 'Con Rovers'),
  (current_setting('test.con_season')::uuid, 'Con United'),
  (current_setting('test.con_season')::uuid, 'Con City'),
  (current_setting('test.con_season')::uuid, 'Con Athletic');

insert into public.competition_rounds (tournament_id, round_key, ordinal, kind, label)
values
  (current_setting('test.con_season')::uuid, 'con-mw1', 1, 'league_matchweek', 'Matchweek 1'),
  (current_setting('test.con_season')::uuid, 'con-mw2', 2, 'league_matchweek', 'Matchweek 2'),
  (current_setting('test.con_season')::uuid, 'con-mw3', 3, 'league_matchweek', 'Matchweek 3');

select set_config('test.con_mw1',
  (select id::text from public.competition_rounds
    where tournament_id = current_setting('test.con_season')::uuid and round_key = 'con-mw1'), true);
select set_config('test.con_mw2',
  (select id::text from public.competition_rounds
    where tournament_id = current_setting('test.con_season')::uuid and round_key = 'con-mw2'), true);
select set_config('test.con_mw3',
  (select id::text from public.competition_rounds
    where tournament_id = current_setting('test.con_season')::uuid and round_key = 'con-mw3'), true);

insert into public.season_fixtures
  (id, tournament_id, competition_round_id, home_team_id, away_team_id, kickoff_at, status,
   home_score, away_score)
values
  (md5('con-f1')::uuid, current_setting('test.con_season')::uuid, current_setting('test.con_mw1')::uuid,
   (select id from public.teams where tournament_id = current_setting('test.con_season')::uuid and name = 'Con Rovers'),
   (select id from public.teams where tournament_id = current_setting('test.con_season')::uuid and name = 'Con United'),
   now() - interval '3 hours', 'played', 1, 0),
  (md5('con-f2')::uuid, current_setting('test.con_season')::uuid, current_setting('test.con_mw2')::uuid,
   (select id from public.teams where tournament_id = current_setting('test.con_season')::uuid and name = 'Con City'),
   (select id from public.teams where tournament_id = current_setting('test.con_season')::uuid and name = 'Con Athletic'),
   now() - interval '2 hours', 'scheduled', null, null),
  (md5('con-f3')::uuid, current_setting('test.con_season')::uuid, current_setting('test.con_mw3')::uuid,
   (select id from public.teams where tournament_id = current_setting('test.con_season')::uuid and name = 'Con Rovers'),
   (select id from public.teams where tournament_id = current_setting('test.con_season')::uuid and name = 'Con City'),
   now() + interval '6 days', 'scheduled', null, null);

set local session_replication_role = replica;
insert into auth.users (
  id, email, aud, role, raw_app_meta_data, raw_user_meta_data, created_at, updated_at
)
select md5('con-user-' || n)::uuid, format('con-%s@example.test', n),
  'authenticated', 'authenticated', '{}'::jsonb, '{}'::jsonb, now(), now()
from generate_series(1, 13) as n;
set local session_replication_role = origin;

insert into public.profiles (id, display_name, welcomed_at)
select md5('con-user-' || n)::uuid, format('Con Player %s', n), now()
from generate_series(1, 13) as n;

-- Twelve entrants; player 13 has not entered.
insert into public.entries (
  id, user_id, tournament_id, game_competition_id
)
select md5('con-entry-' || n)::uuid, md5('con-user-' || n)::uuid,
       current_setting('test.con_season')::uuid, md5('con-mp')::uuid
from generate_series(1, 12) as n;

-- Triggers off: `enforce_season_matchweek_lock` refuses a write to a matchweek
-- that has locked, which is the state these predictions must be read in.
set local session_replication_role = replica;

-- Matchweek 1: all twelve predict. Eight say a home win, three a draw, one an
-- away win, and 1-0 is the most common scoreline.
insert into public.season_predictions
  (tournament_id, entry_id, season_fixture_id, home_score, away_score)
select current_setting('test.con_season')::uuid, md5('con-entry-' || n)::uuid,
       md5('con-f1')::uuid,
       case when n <= 8 then 1 when n <= 11 then 0 else 0 end,
       case when n <= 8 then 0 when n <= 11 then 0 else 2 end
from generate_series(1, 12) as n;

-- Matchweek 2: only six of them. Below the minimum of ten.
insert into public.season_predictions
  (tournament_id, entry_id, season_fixture_id, home_score, away_score)
select current_setting('test.con_season')::uuid, md5('con-entry-' || n)::uuid,
       md5('con-f2')::uuid, 2, 2
from generate_series(1, 6) as n;

set local session_replication_role = origin;

select set_config('request.jwt.claims',
  json_build_object('sub', md5('con-user-1')::uuid, 'role', 'authenticated')::text, true);

-- ---------------------------------------------------------------------------
-- THE COHORT IS PER MATCHWEEK.
-- ---------------------------------------------------------------------------

select set_config('test.con_mw1_out',
  (select public.get_season_prediction_consensus(
     current_setting('test.con_season')::uuid, 1))::text, true);

select set_config('test.con_mw2_out',
  (select public.get_season_prediction_consensus(
     current_setting('test.con_season')::uuid, 2))::text, true);

select is(
  (current_setting('test.con_mw1_out')::jsonb)->>'suppressed',
  'false',
  'matchweek 1 answers: twelve entrants predicted it');

select is(
  (current_setting('test.con_mw2_out')::jsonb)->>'suppressed',
  'true',
  'AND MATCHWEEK 2 IS SUPPRESSED IN THE SAME SEASON — six predicted it, and a '
  'season-wide count of twelve would have called it safe');

select is(
  (current_setting('test.con_mw2_out')::jsonb)->>'submitted_entries',
  '6',
  'the suppression says how many there are');

select is(
  (current_setting('test.con_mw2_out')::jsonb)->>'minimum_entries',
  '10',
  'and how many are needed — the tournament''s own number, reused');

select is(
  (current_setting('test.con_mw2_out')::jsonb)->>'reason',
  'not_enough_entries',
  'suppression RETURNS rather than raising, matching the tournament shape');

select is(
  jsonb_array_length((current_setting('test.con_mw2_out')::jsonb)->'fixtures'),
  0,
  'and carries no distribution at all');

-- ---------------------------------------------------------------------------
-- What the answer says.
-- ---------------------------------------------------------------------------

select is(
  (current_setting('test.con_mw1_out')::jsonb)->'fixtures'->0->>'predicted',
  '12',
  'the fixture reports how many predicted it');

select is(
  (current_setting('test.con_mw1_out')::jsonb)->'fixtures'->0->>'home_win',
  '8',
  'eight said a home win');

select is(
  (current_setting('test.con_mw1_out')::jsonb)->'fixtures'->0->>'draw',
  '3',
  'three said a draw');

select is(
  (current_setting('test.con_mw1_out')::jsonb)->'fixtures'->0->>'away_win',
  '1',
  'and one an away win — derived from the scoreline, because nothing stores a '
  'predicted outcome');

select is(
  (current_setting('test.con_mw1_out')::jsonb)->'fixtures'->0->'top_scores'->0->>'picks',
  '8',
  'the most-picked scoreline leads the distribution');

select is(
  (current_setting('test.con_mw1_out')::jsonb)->'fixtures'->0->>'result_home',
  '1',
  'and a played fixture shows its confirmed result');

-- ---------------------------------------------------------------------------
-- The reveal boundary and the caller boundary.
-- ---------------------------------------------------------------------------

select throws_ok(
  format('select public.get_season_prediction_consensus(%L::uuid, 3)',
         current_setting('test.con_season')),
  '42501',
  'Prediction consensus is hidden until the matchweek locks',
  'matchweek 3 has not locked, so nothing is revealed — the boundary is the '
  'matchweek''s own lock and not one instant for the season');

select set_config('request.jwt.claims',
  json_build_object('sub', md5('con-user-13')::uuid, 'role', 'authenticated')::text, true);

select throws_ok(
  format('select public.get_season_prediction_consensus(%L::uuid, 1)',
         current_setting('test.con_season')),
  '42501',
  'You have not joined the Main Predictor for this season',
  'and a caller with no entry is refused — a season is not the one competition '
  'everybody is in');

select * from finish();
rollback;
