-- Contract 111: the season Predictor Championship becomes something that runs.
--
-- The competition under test is PRIVATE, and that is the finding rather than a
-- convenience. The public Championship opens at a hundred entrants, and a
-- hundred-entrant field always takes the multi-group shape — `single_group`
-- stops at twenty. The two boundaries do not overlap, so the shape this
-- contract drives belongs to organiser-created competitions, and the public one
-- waits for the multi-group driver.
--
-- The first version of the driver applied the public threshold to everything.
-- It would have refused every private Championship and been incapable of
-- launching anything at all, which is what the assertion below about a twelve
-- entrant private field actually protects.

begin;

select plan(20);

select set_config('test.cl_pl',
  (select t.id::text from public.tournaments t where t.name = 'Premier League 2026/27'), true);

select set_config('test.cl_euro',
  (select t.id::text from public.tournaments t where t.name = 'UEFA Euro 2028'), true);

-- Twenty-four league matchweeks ahead of us, one fixture each.
--
-- The count is not arbitrary and the first attempt got it wrong. A twelve
-- entrant field needs eleven rounds per meeting, and `select_season_cup_format`
-- only returns `single_group` when it can fit at least TWO meetings — with one
-- meeting's worth of calendar it divides the field into groups instead. So a
-- twelve-round season takes the multi-group shape, and twenty-two is the floor
-- for the shape this contract drives. Twenty-four is used so the two rounds
-- left over prove the calendar is not simply consumed whole.

insert into public.teams (tournament_id, name) values
  (current_setting('test.cl_pl')::uuid, 'Launch Rovers'),
  (current_setting('test.cl_pl')::uuid, 'Launch United');

insert into public.competition_rounds (tournament_id, round_key, ordinal, kind, label)
select current_setting('test.cl_pl')::uuid, format('cl-mw%s', n), n,
       'league_matchweek', format('Matchweek %s', n)
from generate_series(1, 24) as n;

insert into public.season_fixtures (
  tournament_id, competition_round_id, home_team_id, away_team_id, kickoff_at, status
)
select round.tournament_id, round.id,
  (select team.id from public.teams team
    where team.tournament_id = round.tournament_id and team.name = 'Launch Rovers'),
  (select team.id from public.teams team
    where team.tournament_id = round.tournament_id and team.name = 'Launch United'),
  now() + (round.ordinal * interval '7 days'), 'scheduled'
from public.competition_rounds round
where round.tournament_id = current_setting('test.cl_pl')::uuid
  and round.kind = 'league_matchweek';

set local session_replication_role = replica;
insert into auth.users (
  id, email, aud, role, raw_app_meta_data, raw_user_meta_data, created_at, updated_at
)
select md5('cl-user-' || n)::uuid, format('cl-%s@example.test', n),
  'authenticated', 'authenticated', '{}'::jsonb, '{}'::jsonb, now(), now()
from generate_series(1, 12) as n;
set local session_replication_role = origin;

insert into public.profiles (id, display_name, welcomed_at)
select md5('cl-user-' || n)::uuid, format('Cl Player %s', n), now()
from generate_series(1, 12) as n;

-- ---------------------------------------------------------------------------
-- Refusals: what could never be right
-- ---------------------------------------------------------------------------

select is(
  (select count(*)::integer from information_schema.routine_privileges
   where routine_schema = 'predictor_internal'
     and routine_name = 'launch_season_cup'
     and grantee in ('anon', 'authenticated', 'service_role')),
  0,
  'no browser or service role may launch a Championship'
);

select throws_ok(
  format('select predictor_internal.launch_season_cup(%L::uuid)', md5('cl-missing')::uuid),
  '23503',
  null,
  'an unknown competition is refused rather than silently launching nothing'
);

select throws_ok(
  format('select predictor_internal.launch_season_cup(%L::uuid)',
         (select competition.id from public.bonus_competitions competition
           where competition.tournament_id = current_setting('test.cl_pl')::uuid
             and competition.game_key = 'last_man_standing'
             and competition.completed_at is null)),
  '23514',
  null,
  'and a competition that is not a Championship is refused'
);

insert into public.bonus_competitions (
  id, tournament_id, game_key, published, availability_status,
  draw_required, visibility_kind, registration_opens_at
) values (
  md5('cl-euro-cup')::uuid, current_setting('test.cl_euro')::uuid,
  'predictor_cup', true, 'active', true, 'public', now() - interval '1 day'
);

select throws_ok(
  format('select predictor_internal.launch_season_cup(%L::uuid)', md5('cl-euro-cup')::uuid),
  '23514',
  null,
  'a tournament Championship is refused — it has its own published draw, not a league calendar'
);

-- ---------------------------------------------------------------------------
-- Not open is not an error
-- ---------------------------------------------------------------------------

select is(
  predictor_internal.launch_season_cup(
    (select competition.id from public.bonus_competitions competition
      where competition.tournament_id = current_setting('test.cl_pl')::uuid
        and competition.game_key = 'predictor_cup'
        and competition.visibility_kind = 'public'
        and competition.completed_at is null))
    - 'shortfall',
  jsonb_build_object('outcome', 'not_open', 'reason', 'below_threshold',
                     'entrants', 0, 'fixtures', 0),
  'the public Championship with no entrants reports the threshold rather than raising'
);

select is(
  (select count(*)::integer from public.bonus_cup_groups),
  0,
  'and nothing was created on the way to that report'
);

-- ---------------------------------------------------------------------------
-- THE LAUNCH — a private Championship of twelve
-- ---------------------------------------------------------------------------

insert into public.bonus_competitions (
  id, tournament_id, game_key, published, availability_status,
  draw_required, visibility_kind, registration_opens_at
) values (
  md5('cl-private')::uuid, current_setting('test.cl_pl')::uuid,
  'predictor_cup', true, 'active', true, 'private', now() - interval '2 days'
);

insert into public.bonus_competition_entrants (competition_id, user_id, joined_at)
select md5('cl-private')::uuid, md5('cl-user-' || n)::uuid, now() - interval '1 day'
from generate_series(1, 12) as n;

select set_config('test.cl_result',
  predictor_internal.launch_season_cup(md5('cl-private')::uuid)::text, true);

select is(
  current_setting('test.cl_result')::jsonb ->> 'outcome',
  'launched',
  'a twelve-entrant PRIVATE Championship launches — the public threshold is not applied to it, and applying it would have made this function incapable of launching anything'
);

select is(
  (current_setting('test.cl_result')::jsonb ->> 'meetings')::integer,
  2,
  'two meetings, which is the fewest that makes this a single-group competition rather than a divided field'
);

select is(
  (current_setting('test.cl_result')::jsonb ->> 'leagueRounds')::integer,
  22,
  'across twenty-two rounds, which is a twelve-entrant round-robin played twice'
);

select is(
  (select count(*)::integer from public.bonus_cup_members
    where competition_id = md5('cl-private')::uuid and phase_kind = 'initial'),
  12,
  'every entrant is drawn into the initial phase'
);

select is(
  (select jsonb_build_object('groups', count(*), 'size', min(size), 'phase', min(phase_kind))
   from public.bonus_cup_groups where competition_id = md5('cl-private')::uuid),
  jsonb_build_object('groups', 1, 'size', 12, 'phase', 'initial'),
  'as one initial group holding the whole field'
);

select is(
  (select count(*)::integer from public.bonus_competition_windows
    where competition_id = md5('cl-private')::uuid),
  22,
  'twenty-two rounds are scheduled, leaving two matchweeks unused rather than consuming the calendar whole'
);

select is(
  (current_setting('test.cl_result')::jsonb ->> 'fixtures')::integer,
  132,
  'and a hundred and thirty-two fixtures are placed — six ties in each of twenty-two rounds'
);

-- Every fixture must sit on the window of its own round. Getting this wrong is
-- silent: the fixtures exist, the counts agree, and the competition plays its
-- rounds in the wrong weeks.
select is(
  (select count(*)::integer
   from public.bonus_cup_fixtures fixture
   join public.bonus_competition_windows competition_window
     on competition_window.id = fixture.window_id
   where fixture.competition_id = md5('cl-private')::uuid
     and competition_window.sequence <> fixture.matchday),
  0,
  'each fixture sits on the window whose sequence is its own matchday'
);

select is(
  (select count(*)::integer from public.bonus_cup_fixtures
    where competition_id = md5('cl-private')::uuid
      and (stage <> 'group' or group_id is null or home_user_id = away_user_id)),
  0,
  'every fixture is a group-stage tie between two different entrants'
);

-- A round-robin means each entrant meets each other exactly once.
select is(
  (select count(*)::integer from (
     select least(home_user_id, away_user_id) as a, greatest(home_user_id, away_user_id) as b,
            count(*) as meetings
     from public.bonus_cup_fixtures
     where competition_id = md5('cl-private')::uuid
     group by 1, 2
     having count(*) <> 2
   ) as wrong),
  0,
  'and every pair meets exactly twice, which is what two meetings of a round-robin means'
);

-- ---------------------------------------------------------------------------
-- The shape this contract does not drive
--
-- Same twelve entrants, a season with only twelve rounds. That cannot hold two
-- meetings, so the selector divides the field into two groups of six — and this
-- driver must say so rather than launching a competition whose draw it cannot
-- complete.
-- ---------------------------------------------------------------------------

select set_config('test.cl_sp',
  (select t.id::text from public.tournaments t where t.name = 'Scottish Premiership 2026/27'), true);

insert into public.teams (tournament_id, name) values
  (current_setting('test.cl_sp')::uuid, 'Narrow Rovers'),
  (current_setting('test.cl_sp')::uuid, 'Narrow United');

insert into public.competition_rounds (tournament_id, round_key, ordinal, kind, label)
select current_setting('test.cl_sp')::uuid, format('cl-sp-mw%s', n), n,
       'league_matchweek', format('Matchweek %s', n)
from generate_series(1, 12) as n;

insert into public.season_fixtures (
  tournament_id, competition_round_id, home_team_id, away_team_id, kickoff_at, status
)
select round.tournament_id, round.id,
  (select team.id from public.teams team
    where team.tournament_id = round.tournament_id and team.name = 'Narrow Rovers'),
  (select team.id from public.teams team
    where team.tournament_id = round.tournament_id and team.name = 'Narrow United'),
  now() + (round.ordinal * interval '7 days'), 'scheduled'
from public.competition_rounds round
where round.tournament_id = current_setting('test.cl_sp')::uuid
  and round.kind = 'league_matchweek';

insert into public.bonus_competitions (
  id, tournament_id, game_key, published, availability_status,
  draw_required, visibility_kind, registration_opens_at
) values (
  md5('cl-narrow')::uuid, current_setting('test.cl_sp')::uuid,
  'predictor_cup', true, 'active', true, 'private', now() - interval '2 days'
);

insert into public.bonus_competition_entrants (competition_id, user_id, joined_at)
select md5('cl-narrow')::uuid, md5('cl-user-' || n)::uuid, now() - interval '1 day'
from generate_series(1, 12) as n;

select throws_ok(
  format('select predictor_internal.launch_season_cup(%L::uuid)', md5('cl-narrow')::uuid),
  '23514',
  null,
  'a field the selector divides into groups is refused by name, not launched with a draw this contract cannot complete'
);

select is(
  (select count(*)::integer from public.bonus_cup_groups
    where competition_id = md5('cl-narrow')::uuid),
  0,
  'and nothing was created on the way to that refusal'
);

-- ---------------------------------------------------------------------------
-- Idempotency
-- ---------------------------------------------------------------------------

select is(
  predictor_internal.launch_season_cup(md5('cl-private')::uuid),
  jsonb_build_object('outcome', 'already_launched', 'fixtures', 0),
  'a second run does not redraw — the draw IS the competition, and moving it would move fixtures under predictions'
);

select is(
  (select count(*)::integer from public.bonus_cup_fixtures
    where competition_id = md5('cl-private')::uuid),
  132,
  'so a retrying job leaves a hundred and thirty-two fixtures, not two hundred and sixty-four'
);

select finish();

rollback;
