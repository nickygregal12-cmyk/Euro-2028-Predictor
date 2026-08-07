-- Contract 129: two season players, one matchweek, side by side.
--
-- THE ASSERTION THIS FILE EXISTS FOR is the reveal boundary, and it is driven
-- against ONE season holding two matchweeks in opposite states: matchweek 1 has
-- kicked off and comparison is allowed, matchweek 2 has not and the same call
-- for the same two players is refused. A tournament-shaped reveal — one instant
-- for the whole competition — cannot produce both answers.
--
-- THE SECOND ASSERTION is that a round whose kickoffs are incomplete HIDES.
-- `season_matchweek_lock_at` returns null there and the write trigger treats
-- that as locked; this treats it as not revealed, and the asymmetry is driven
-- rather than argued.
--
-- Self-contained: its own season, clubs, rounds, fixtures, entries and users.

begin;

select plan(22);

select is(
  (select count(*)::integer from pg_proc proc
     join pg_namespace ns on ns.oid = proc.pronamespace
    where ns.nspname = 'public'
      and proc.proname = 'get_season_head_to_head'
      and proc.prosecdef and proc.proconfig @> array['search_path=""']),
  1,
  'the read exists, security definer, search path pinned');

select is(
  (select count(*)::integer from information_schema.routine_privileges
    where routine_name in ('get_season_head_to_head', 'season_entrant_matchweek')
      and grantee in ('anon', 'service_role')),
  0,
  'and neither it nor the side-builder beneath it reaches anon or service_role');

-- ---------------------------------------------------------------------------
-- Setup.
-- ---------------------------------------------------------------------------

insert into public.tournaments (name, year, competition_id, season_key, kind, display_timezone, status)
select 'C129 H2H Probe', 2030, t.competition_id, 'h2h-probe', 'league_season',
       t.display_timezone, 'active'
  from public.tournaments t
 where t.kind = 'league_season'
 order by t.name
 limit 1;

select set_config('test.h2h_season',
  (select id::text from public.tournaments where season_key = 'h2h-probe'), true);

insert into public.bonus_competitions (
  id, tournament_id, game_key, published, availability_status,
  draw_required, visibility_kind, registration_opens_at
) values (
  md5('h2h-mp')::uuid, current_setting('test.h2h_season')::uuid,
  'main_predictor', true, 'active', false, 'public',
  now() - interval '2 days'
);

insert into public.teams (tournament_id, name) values
  (current_setting('test.h2h_season')::uuid, 'H2H Rovers'),
  (current_setting('test.h2h_season')::uuid, 'H2H United'),
  (current_setting('test.h2h_season')::uuid, 'H2H City'),
  (current_setting('test.h2h_season')::uuid, 'H2H Athletic');

insert into public.competition_rounds (tournament_id, round_key, ordinal, kind, label)
values
  (current_setting('test.h2h_season')::uuid, 'h2h-mw1', 1, 'league_matchweek', 'Matchweek 1'),
  (current_setting('test.h2h_season')::uuid, 'h2h-mw2', 2, 'league_matchweek', 'Matchweek 2'),
  (current_setting('test.h2h_season')::uuid, 'h2h-mw3', 3, 'league_matchweek', 'Matchweek 3');

select set_config('test.h2h_mw1',
  (select id::text from public.competition_rounds
    where tournament_id = current_setting('test.h2h_season')::uuid and round_key = 'h2h-mw1'), true);
select set_config('test.h2h_mw2',
  (select id::text from public.competition_rounds
    where tournament_id = current_setting('test.h2h_season')::uuid and round_key = 'h2h-mw2'), true);
select set_config('test.h2h_mw3',
  (select id::text from public.competition_rounds
    where tournament_id = current_setting('test.h2h_season')::uuid and round_key = 'h2h-mw3'), true);

-- Matchweek 1 has kicked off; matchweek 2 has not. Matchweek 3 carries a
-- fixture with NO kickoff, which is the incomplete-list case.
insert into public.season_fixtures
  (id, tournament_id, competition_round_id, home_team_id, away_team_id, kickoff_at, status,
   home_score, away_score)
values
  (md5('h2h-f1')::uuid, current_setting('test.h2h_season')::uuid, current_setting('test.h2h_mw1')::uuid,
   (select id from public.teams where tournament_id = current_setting('test.h2h_season')::uuid and name = 'H2H Rovers'),
   (select id from public.teams where tournament_id = current_setting('test.h2h_season')::uuid and name = 'H2H United'),
   now() - interval '2 hours', 'played', 2, 1),
  (md5('h2h-f2')::uuid, current_setting('test.h2h_season')::uuid, current_setting('test.h2h_mw1')::uuid,
   (select id from public.teams where tournament_id = current_setting('test.h2h_season')::uuid and name = 'H2H City'),
   (select id from public.teams where tournament_id = current_setting('test.h2h_season')::uuid and name = 'H2H Athletic'),
   now() - interval '1 hour', 'scheduled', null, null),
  (md5('h2h-f3')::uuid, current_setting('test.h2h_season')::uuid, current_setting('test.h2h_mw2')::uuid,
   (select id from public.teams where tournament_id = current_setting('test.h2h_season')::uuid and name = 'H2H Rovers'),
   (select id from public.teams where tournament_id = current_setting('test.h2h_season')::uuid and name = 'H2H City'),
   now() + interval '5 days', 'scheduled', null, null),
  (md5('h2h-f4')::uuid, current_setting('test.h2h_season')::uuid, current_setting('test.h2h_mw3')::uuid,
   (select id from public.teams where tournament_id = current_setting('test.h2h_season')::uuid and name = 'H2H United'),
   (select id from public.teams where tournament_id = current_setting('test.h2h_season')::uuid and name = 'H2H Athletic'),
   null, 'scheduled', null, null);

set local session_replication_role = replica;
insert into auth.users (
  id, email, aud, role, raw_app_meta_data, raw_user_meta_data, created_at, updated_at
)
select md5('h2h-user-' || n)::uuid, format('h2h-%s@example.test', n),
  'authenticated', 'authenticated', '{}'::jsonb, '{}'::jsonb, now(), now()
from generate_series(1, 3) as n;
set local session_replication_role = origin;

insert into public.profiles (id, display_name, welcomed_at) values
  (md5('h2h-user-1')::uuid, 'H2H One', now()),
  (md5('h2h-user-2')::uuid, 'H2H Two', now()),
  (md5('h2h-user-3')::uuid, 'H2H Three', now());

-- Players 1 and 2 have entered; player 3 has not.
insert into public.entries (
  id, user_id, tournament_id, game_competition_id
)
select md5('h2h-entry-' || n)::uuid, md5('h2h-user-' || n)::uuid,
       current_setting('test.h2h_season')::uuid, md5('h2h-mp')::uuid
from generate_series(1, 2) as n;

-- Seeded with triggers off. `enforce_season_matchweek_lock` refuses a write to
-- a matchweek that has locked, which is exactly the state this suite needs to
-- have predictions IN — a prediction made before the lock and read after it.
-- Driving that through the RPC would mean moving the clock, and the lock rule
-- is contract 114's to test, not this one's.
set local session_replication_role = replica;

insert into public.season_predictions
  (tournament_id, entry_id, season_fixture_id, home_score, away_score)
values
  (current_setting('test.h2h_season')::uuid, md5('h2h-entry-1')::uuid, md5('h2h-f1')::uuid, 2, 1),
  (current_setting('test.h2h_season')::uuid, md5('h2h-entry-1')::uuid, md5('h2h-f2')::uuid, 0, 0),
  (current_setting('test.h2h_season')::uuid, md5('h2h-entry-2')::uuid, md5('h2h-f1')::uuid, 3, 0),
  (current_setting('test.h2h_season')::uuid, md5('h2h-entry-2')::uuid, md5('h2h-f3')::uuid, 1, 1);

insert into public.season_matchweek_jokers (tournament_id, entry_id, competition_round_id)
values (current_setting('test.h2h_season')::uuid, md5('h2h-entry-2')::uuid,
        current_setting('test.h2h_mw1')::uuid);

set local session_replication_role = origin;

insert into public.season_matchweek_scores
  (tournament_id, entry_id, competition_round_id, points, fixtures_scored)
values
  (current_setting('test.h2h_season')::uuid, md5('h2h-entry-1')::uuid,
   current_setting('test.h2h_mw1')::uuid, 7, 2),
  (current_setting('test.h2h_season')::uuid, md5('h2h-entry-2')::uuid,
   current_setting('test.h2h_mw1')::uuid, 4, 2);

select set_config('request.jwt.claims',
  json_build_object('sub', md5('h2h-user-1')::uuid, 'role', 'authenticated')::text, true);

-- ---------------------------------------------------------------------------
-- THE REVEAL BOUNDARY, both answers from one season.
-- ---------------------------------------------------------------------------

select throws_ok(
  format('select public.get_season_head_to_head(%L::uuid, %L::uuid, 2)',
         current_setting('test.h2h_season'), md5('h2h-user-2')::uuid),
  '42501',
  'Other players'' predictions are hidden until the matchweek locks',
  'MATCHWEEK 2 HAS NOT LOCKED, so the comparison is refused');

select throws_ok(
  format('select public.get_season_head_to_head(%L::uuid, %L::uuid, 3)',
         current_setting('test.h2h_season'), md5('h2h-user-2')::uuid),
  '42501',
  'Other players'' predictions are hidden until the matchweek locks',
  'and a matchweek whose fixture list has no kickoff HIDES rather than reveals '
  '— the write trigger calls that state locked, and revealing on it would '
  'expose a season whose kickoffs were never published');

select set_config('test.h2h_card',
  (select public.get_season_head_to_head(
     current_setting('test.h2h_season')::uuid, md5('h2h-user-2')::uuid, 1))::text, true);

select ok(
  (current_setting('test.h2h_card')::jsonb) ? 'fixtures',
  'MATCHWEEK 1 HAS LOCKED, so the same call for the same two players answers — '
  'one season, two matchweeks, opposite states');

-- ---------------------------------------------------------------------------
-- What it says.
-- ---------------------------------------------------------------------------

select is(
  (current_setting('test.h2h_card')::jsonb)->'you'->>'display_name',
  'H2H One',
  'the caller is named');

select is(
  (current_setting('test.h2h_card')::jsonb)->'opponent'->>'display_name',
  'H2H Two',
  'and so is the opponent');

select is(
  (current_setting('test.h2h_card')::jsonb)->'you'->>'points',
  '7',
  'the caller''s settled matchweek total comes from season_matchweek_scores');

select is(
  (current_setting('test.h2h_card')::jsonb)->'opponent'->>'points',
  '4',
  'and so does the opponent''s');

select is(
  (current_setting('test.h2h_card')::jsonb)->'opponent'->>'joker',
  'true',
  'the opponent played their Joker here');

select is(
  (current_setting('test.h2h_card')::jsonb)->'you'->>'joker',
  'false',
  'and the caller did not — the two sides are built by one function, so they '
  'cannot be crossed');

select is(
  (current_setting('test.h2h_card')::jsonb)->'you'->>'predicted',
  '2',
  'the caller predicted both fixtures');

select is(
  (current_setting('test.h2h_card')::jsonb)->'opponent'->>'predicted',
  '1',
  'the opponent predicted one');

select is(
  jsonb_array_length((current_setting('test.h2h_card')::jsonb)->'fixtures'),
  2,
  'both fixtures of the matchweek are returned');

select is(
  (current_setting('test.h2h_card')::jsonb)->'fixtures'->0->'your_prediction'->>'home',
  '2',
  'with the caller''s prediction on the first');

select is(
  (current_setting('test.h2h_card')::jsonb)->'fixtures'->0->'their_prediction'->>'home',
  '3',
  'and the opponent''s beside it');

select is(
  (current_setting('test.h2h_card')::jsonb)->'fixtures'->0->>'result_home',
  '2',
  'a played fixture shows its result');

select is(
  (current_setting('test.h2h_card')::jsonb)->'fixtures'->1->>'result_home',
  null,
  'and a fixture that is not `played` shows none, however a provider has '
  'scored it provisionally — the protected confirmation gate, unchanged');

select is(
  (current_setting('test.h2h_card')::jsonb)->'fixtures'->1->'their_prediction',
  'null'::jsonb,
  'a fixture the opponent did not predict is null rather than zero-zero');

-- ---------------------------------------------------------------------------
-- Who may look.
-- ---------------------------------------------------------------------------

select throws_ok(
  format('select public.get_season_head_to_head(%L::uuid, %L::uuid, 1)',
         current_setting('test.h2h_season'), md5('h2h-user-1')::uuid),
  '22023',
  'You cannot compare yourself with yourself',
  'comparing with yourself is refused rather than rendering one column twice');

select throws_ok(
  format('select public.get_season_head_to_head(%L::uuid, %L::uuid, 1)',
         current_setting('test.h2h_season'), md5('h2h-user-3')::uuid),
  'P0002',
  'That player has not entered this season',
  'and a player who has not entered has nothing to compare');

select set_config('request.jwt.claims',
  json_build_object('sub', md5('h2h-user-3')::uuid, 'role', 'authenticated')::text, true);

select throws_ok(
  format('select public.get_season_head_to_head(%L::uuid, %L::uuid, 1)',
         current_setting('test.h2h_season'), md5('h2h-user-1')::uuid),
  '42501',
  'You have not joined the Main Predictor for this season',
  'a caller with no entry of their own is refused — contract 95''s boundary, '
  'driven with a real session rather than inspected');

select * from finish();
rollback;
