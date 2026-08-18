-- Contract 197: one chronological calendar across the player's competitions.
--
-- THE ASSERTION THIS FILE EXISTS FOR is a DIFFERENTIAL. Adding a second fixture
-- read risks the two drifting -- a field in one and not the other, a live-state
-- block that means something slightly different -- and a player then sees two
-- versions of the same match. So this does not compare the two projections by
-- eye. It seeds one season, calls `get_season_fixtures` and
-- `get_my_football_calendar` over the same window, and requires the per-fixture
-- objects to be IDENTICAL. Copying a projection is not evidence that it was
-- copied correctly; running both is. That is contract 192's method.
--
-- The rest is what the single-season read cannot answer: two competitions
-- interleaved by kickoff, a season the caller has not entered excluded, and the
-- bounds refused.

begin;

select plan(15);

do $$
declare
  v_competition_a uuid;
  v_competition_b uuid;
  v_a uuid;
  v_b uuid;
  v_c uuid;
  v_round_a uuid;
  v_round_b uuid;
  v_round_c uuid;
  v_teams uuid[];
begin
  insert into public.competitions (slug, name, sport)
    values ('c197a', 'C197 A', 'football') returning id into v_competition_a;
  insert into public.competitions (slug, name, sport)
    values ('c197b', 'C197 B', 'football') returning id into v_competition_b;

  insert into public.tournaments
      (name, year, competition_id, season_key, kind, display_timezone, status)
    values ('C197 A season', 2047, v_competition_a, '2047-48', 'league_season',
            'Europe/London', 'active')
    returning id into v_a;
  insert into public.tournaments
      (name, year, competition_id, season_key, kind, display_timezone, status)
    values ('C197 B season', 2047, v_competition_b, '2047-48', 'league_season',
            'Europe/London', 'active')
    returning id into v_b;
  -- A third season the caller never enters. It must not appear.
  insert into public.tournaments
      (name, year, competition_id, season_key, kind, display_timezone, status)
    values ('C197 C season', 2047, v_competition_a, '2048-49', 'league_season',
            'Europe/London', 'active')
    returning id into v_c;

  insert into public.competition_rounds (tournament_id, round_key, ordinal, kind, label)
    values (v_a, 'MW01', 1, 'league_matchweek', 'Matchweek 1') returning id into v_round_a;
  insert into public.competition_rounds (tournament_id, round_key, ordinal, kind, label)
    values (v_b, 'MW01', 1, 'league_matchweek', 'Matchweek 1') returning id into v_round_b;
  insert into public.competition_rounds (tournament_id, round_key, ordinal, kind, label)
    values (v_c, 'MW01', 1, 'league_matchweek', 'Matchweek 1') returning id into v_round_c;

  insert into public.teams (tournament_id, name)
  select v_a, 'A Club ' || n from generate_series(1, 4) n;
  insert into public.teams (tournament_id, name)
  select v_b, 'B Club ' || n from generate_series(1, 2) n;
  insert into public.teams (tournament_id, name)
  select v_c, 'C Club ' || n from generate_series(1, 2) n;

  set local session_replication_role = replica;
  insert into auth.users (id, email, aud, role, raw_app_meta_data, raw_user_meta_data,
                          created_at, updated_at)
  values (md5('cal-user')::uuid, 'cal@example.test', 'authenticated', 'authenticated',
          '{}'::jsonb, '{}'::jsonb, now(), now());
  set local session_replication_role = origin;

  insert into public.profiles (id, display_name, welcomed_at)
    values (md5('cal-user')::uuid, 'Calendar Player', now());

  -- An entry must belong to the season's Main Predictor, so each season needs
  -- its game row before anyone can enter it. That is contract 180's rule, read
  -- rather than worked around.
  insert into public.bonus_competitions
      (tournament_id, game_key, published, availability_status, draw_required)
  values (v_a, 'main_predictor', true, 'active', false),
         (v_b, 'main_predictor', true, 'active', false),
         (v_c, 'main_predictor', true, 'active', false);

  -- Entered A and B. NOT C.
  insert into public.entries (tournament_id, user_id) values (v_a, md5('cal-user')::uuid);
  insert into public.entries (tournament_id, user_id) values (v_b, md5('cal-user')::uuid);

  -- Season A: two fixtures, one already played, one still to come.
  insert into public.season_fixtures
      (tournament_id, competition_round_id, home_team_id, away_team_id, kickoff_at,
       status, home_score, away_score)
  select v_a, v_round_a,
         (select id from public.teams where tournament_id = v_a and name = 'A Club 1'),
         (select id from public.teams where tournament_id = v_a and name = 'A Club 2'),
         now() - interval '2 days', 'played', 2, 1;
  insert into public.season_fixtures
      (tournament_id, competition_round_id, home_team_id, away_team_id, kickoff_at, status)
  select v_a, v_round_a,
         (select id from public.teams where tournament_id = v_a and name = 'A Club 3'),
         (select id from public.teams where tournament_id = v_a and name = 'A Club 4'),
         now() + interval '3 days', 'scheduled';

  -- Season B: ONE fixture, deliberately timed BETWEEN season A's two, so a
  -- calendar that merely concatenated the seasons would order it wrongly and
  -- this suite would notice.
  insert into public.season_fixtures
      (tournament_id, competition_round_id, home_team_id, away_team_id, kickoff_at, status)
  select v_b, v_round_b,
         (select id from public.teams where tournament_id = v_b and name = 'B Club 1'),
         (select id from public.teams where tournament_id = v_b and name = 'B Club 2'),
         now() + interval '1 day', 'scheduled';

  -- Season C: inside the window, but not the caller's.
  insert into public.season_fixtures
      (tournament_id, competition_round_id, home_team_id, away_team_id, kickoff_at, status)
  select v_c, v_round_c,
         (select id from public.teams where tournament_id = v_c and name = 'C Club 1'),
         (select id from public.teams where tournament_id = v_c and name = 'C Club 2'),
         now() + interval '2 days', 'scheduled';

  perform set_config('test.c197_a', v_a::text, true);
  perform set_config('test.c197_b', v_b::text, true);
  perform set_config('test.c197_c', v_c::text, true);
end $$;

select set_config('request.jwt.claims',
  json_build_object('sub', md5('cal-user')::uuid, 'role', 'authenticated')::text, true);
set local role authenticated;

-- ---------------------------------------------------------------------------
-- THE DIFFERENTIAL.
-- ---------------------------------------------------------------------------

select is(
  (select jsonb_agg(fixture - 'competition_id' order by fixture ->> 'id')
     from jsonb_array_elements(
            public.get_my_football_calendar() -> 'fixtures') as fixture
    where (fixture ->> 'competition_id')::uuid = current_setting('test.c197_a')::uuid),
  (select jsonb_agg(fixture order by fixture ->> 'id')
     from jsonb_array_elements(
            public.get_season_fixtures(current_setting('test.c197_a')::uuid) -> 'fixtures')
            as fixture),
  'the calendar''s fixture cards are IDENTICAL to the season read''s, field for field');

-- THE ASSERTION ABOUT THE ASSERTION. A differential over an empty set passes
-- against anything, so the fixture must actually contain cards to compare.
select cmp_ok(
  (select jsonb_array_length(
            public.get_season_fixtures(current_setting('test.c197_a')::uuid) -> 'fixtures')),
  '>',
  1,
  'and the season really did return more than one card to compare');

select is(
  (select fixture -> 'result' from jsonb_array_elements(
            public.get_my_football_calendar() -> 'fixtures') as fixture
    where fixture ->> 'status' = 'played' limit 1),
  jsonb_build_object('home', 2, 'away', 1),
  'a settled result travels, in its own field');

-- `jsonb_typeof(...) = 'null'` rather than `is null`: a CASE that yields SQL
-- NULL inside `jsonb_build_object` stores a JSON null, so `-> 'live' is null`
-- is FALSE for a fixture with no live state and the assertion would be vacuous.
select ok(
  (select bool_and(jsonb_typeof(fixture -> 'live') = 'null') from jsonb_array_elements(
            public.get_my_football_calendar() -> 'fixtures') as fixture),
  'and the live field is a different claim, absent when no provider has said anything');

-- ---------------------------------------------------------------------------
-- What the single-season read cannot answer.
-- ---------------------------------------------------------------------------

select is(
  (select jsonb_array_length(public.get_my_football_calendar() -> 'fixtures')),
  3,
  'the calendar spans every season the caller entered');

select is(
  (select count(*)::integer from jsonb_array_elements(
            public.get_my_football_calendar() -> 'fixtures') as fixture
    where (fixture ->> 'competition_id')::uuid = current_setting('test.c197_c')::uuid),
  0,
  'and holds nothing from a season the caller did not enter');

-- The B fixture is timed between A's two. Concatenating the seasons would put
-- it last; a chronological calendar puts it second.
select is(
  (select (public.get_my_football_calendar() -> 'fixtures' -> 1 ->> 'competition_id')::uuid),
  current_setting('test.c197_b')::uuid,
  'fixtures INTERLEAVE by kickoff across competitions rather than grouping by one');

select is(
  (select (public.get_my_football_calendar() -> 'fixtures' -> 0 ->> 'competition_id')::uuid),
  current_setting('test.c197_a')::uuid,
  'with the earliest first');

select is(
  (select jsonb_array_length(public.get_my_football_calendar() -> 'competitions')),
  2,
  'the competitions the rows belong to are named once rather than repeated per fixture');

select is(
  (select competition ->> 'season_key' from jsonb_array_elements(
            public.get_my_football_calendar() -> 'competitions') as competition
    where (competition ->> 'id')::uuid = current_setting('test.c197_a')::uuid),
  '2047-48',
  'each with the identity a surface needs to label a row');

-- ---------------------------------------------------------------------------
-- The window, and its refusals.
-- ---------------------------------------------------------------------------

select is(
  (select jsonb_array_length(public.get_my_football_calendar(
            now() + interval '2 days', now() + interval '10 days') -> 'fixtures')),
  1,
  'a narrower window returns only what falls inside it');

select throws_ok(
  $$select public.get_my_football_calendar(now(), now() - interval '1 day')$$,
  '22023',
  -- pgTAP's THREE-argument form takes the expected MESSAGE here, not the
  -- description. Passing the description made CI compare it against the real
  -- message and fail; the four-argument form with a null message is what the
  -- rest of this repository's suites use.
  null,
  'a window that ends before it starts is refused rather than returned empty');

select throws_ok(
  $$select public.get_my_football_calendar(now(), now() + interval '200 days')$$,
  '22023',
  null,
  'and a window wider than the season read allows is refused by the same limit');

reset role;
select set_config('request.jwt.claims', '', true);

select throws_ok(
  $$select public.get_my_football_calendar()$$,
  '42501',
  null,
  'an unauthenticated caller has no calendar');

select is(
  (select count(*)::integer from information_schema.role_routine_grants
    where routine_schema = 'public'
      and routine_name = 'get_my_football_calendar'
      and grantee in ('PUBLIC', 'anon', 'service_role')),
  0,
  'and no role but authenticated may execute it');

select * from finish();
rollback;
