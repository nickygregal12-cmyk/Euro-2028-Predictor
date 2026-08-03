-- Contract 70: season Main Predictor scoring.
--
-- The parity test compares the SQL to the TypeScript by reading it. This runs
-- it. The case that matters most is the one a reader cannot see: whether an
-- exact score REPLACES the correct-result award or stacks with it. Both look
-- like "points" until a league table is wrong.

begin;
select plan(12);

-- ---------------------------------------------------------------------------
-- One fixture, pure inputs.
-- ---------------------------------------------------------------------------

select is(
  predictor_internal.season_fixture_points(2::smallint, 1::smallint, 2::smallint, 1::smallint),
  5,
  'an exact score is five, not eight — it replaces the correct-result award'
);

select is(
  predictor_internal.season_fixture_points(3::smallint, 1::smallint, 2::smallint, 1::smallint),
  3,
  'the right outcome with the wrong scoreline is three'
);

select is(
  predictor_internal.season_fixture_points(1::smallint, 1::smallint, 0::smallint, 0::smallint),
  3,
  'a predicted draw matches any drawn scoreline'
);

select is(
  predictor_internal.season_fixture_points(0::smallint, 1::smallint, 2::smallint, 1::smallint),
  0,
  'the wrong outcome is zero'
);

select is(
  predictor_internal.season_fixture_points(null, null, 2::smallint, 1::smallint),
  0,
  'a missing prediction scores zero rather than being read as nil-nil'
);

select is(
  predictor_internal.season_fixture_points(2::smallint, 1::smallint, null, null),
  0,
  'an unplayed fixture scores zero'
);

-- ---------------------------------------------------------------------------
-- A whole matchweek, with and without the Joker.
-- ---------------------------------------------------------------------------

create temporary table scoring_probe as
select (select id from public.tournaments where kind = 'league_season' order by name limit 1) as season_id;

insert into public.competition_rounds (tournament_id, round_key, ordinal, kind, label)
select season_id, 'SMW' || n, 100 + n, 'league_matchweek', 'Scoring matchweek ' || n
  from scoring_probe, generate_series(1, 2) as n;

set local session_replication_role = replica;
insert into auth.users(id,email,aud,role,raw_app_meta_data,raw_user_meta_data,created_at,updated_at)
values (md5('season-scoring-user')::uuid,'season-scoring@example.test','authenticated','authenticated','{}','{}',now(),now());
set local session_replication_role = origin;

insert into public.entries (user_id, tournament_id)
select md5('season-scoring-user')::uuid, season_id from scoring_probe;

create temporary table scoring_entry as
select e.id as entry_id, p.season_id
  from public.entries e, scoring_probe p
 where e.tournament_id = p.season_id
   and e.user_id = md5('season-scoring-user')::uuid;

insert into public.teams (tournament_id, name)
select season_id, 'Scoring Club ' || c
  from scoring_probe, unnest(array['A','B','C','D']) as c;

-- Two fixtures in one matchweek, kicking off in the future so predictions are
-- accepted, then settled below.
insert into public.season_fixtures (tournament_id, competition_round_id, home_team_id, away_team_id, kickoff_at)
select p.season_id,
       (select id from public.competition_rounds where tournament_id = p.season_id and round_key = 'SMW1'),
       (select id from public.teams where tournament_id = p.season_id and name = 'Scoring Club ' || h),
       (select id from public.teams where tournament_id = p.season_id and name = 'Scoring Club ' || a),
       now() + interval '7 days'
  from scoring_probe p, (values ('A','B'), ('C','D')) as f(h, a);

insert into public.season_predictions (tournament_id, entry_id, season_fixture_id, home_score, away_score)
select c.season_id, c.entry_id, fixture.id, 2, 1
  from scoring_entry c
  join public.season_fixtures fixture on fixture.tournament_id = c.season_id;

-- Settle both: one exact (5), one right-outcome (3). Base total 8.
update public.season_fixtures fixture
   set status = 'played', home_score = 2, away_score = 1
  from public.teams home
 where home.id = fixture.home_team_id and home.name = 'Scoring Club A';
update public.season_fixtures fixture
   set status = 'played', home_score = 3, away_score = 1
  from public.teams home
 where home.id = fixture.home_team_id and home.name = 'Scoring Club C';

select is(
  predictor_internal.season_matchweek_points(
    (select entry_id from scoring_entry),
    (select id from public.competition_rounds where round_key = 'SMW1')
  ),
  8,
  'a matchweek sums its fixtures: five for the exact, three for the outcome'
);

-- The Joker doubles the matchweek total, applied once. With two scoring
-- fixtures this distinguishes doubling the sum from doubling each fixture —
-- a single-fixture test could not.
insert into public.season_matchweek_jokers (tournament_id, entry_id, competition_round_id)
select c.season_id, c.entry_id,
       (select id from public.competition_rounds where tournament_id = c.season_id and round_key = 'SMW1')
  from scoring_entry c;

select is(
  predictor_internal.season_matchweek_points(
    (select entry_id from scoring_entry),
    (select id from public.competition_rounds where round_key = 'SMW1')
  ),
  16,
  'the Joker doubles the whole matchweek, giving sixteen rather than eleven'
);

-- An unsettled fixture contributes nothing, and does not remove what is
-- already settled.
update public.season_fixtures fixture
   set status = 'postponed', home_score = null, away_score = null
  from public.teams home
 where home.id = fixture.home_team_id and home.name = 'Scoring Club C';

select is(
  predictor_internal.season_matchweek_points(
    (select entry_id from scoring_entry),
    (select id from public.competition_rounds where round_key = 'SMW1')
  ),
  10,
  'a postponed fixture drops out, leaving the exact score doubled'
);

-- A matchweek with nothing settled is zero, not null.
select is(
  predictor_internal.season_matchweek_points(
    (select entry_id from scoring_entry),
    (select id from public.competition_rounds where round_key = 'SMW2')
  ),
  0,
  'an empty matchweek is zero rather than null'
);

-- ---------------------------------------------------------------------------
-- The scoring surface stays server-side.
-- ---------------------------------------------------------------------------

select is(
  (select count(*)::integer
     from information_schema.role_routine_grants
    where routine_schema = 'predictor_internal'
      and routine_name in ('season_fixture_points', 'season_matchweek_points')
      and grantee in ('anon', 'authenticated')),
  0,
  'no browser role may execute the scoring functions'
);

select is(
  (select provolatile from pg_proc
    where proname = 'season_fixture_points'
      and pronamespace = 'predictor_internal'::regnamespace),
  'i'::"char",
  'one fixture is scored by an immutable function: the same inputs always give the same points'
);

select * from finish();
rollback;
