-- Contract 125: a season fixture can be given a result.
--
-- THE ASSERTION THIS FILE EXISTS FOR is that a confirmed result reaches
-- `season_matchweek_scores` without this contract settling anything. Everything
-- upstream of that — the admin gate, the state machine, the revision record —
-- is worth checking and is not the point. The point is that one missing write
-- was holding the entire season product, and that filling it in makes the
-- existing scoring job produce points on its next run.
--
-- THE GATE IS ASSERTED AS A BOUNDARY, NOT AS A GRANT. All three entry points
-- are granted to `authenticated`, because that is how every admin RPC in this
-- repository is shaped: the grant lets a signed-in caller reach the function
-- and `require_result_admin()` decides whether they may act. A test that only
-- checked the grant would pass on a function with no gate at all, so the
-- refusal is driven with a real non-admin session below.
--
-- Self-contained: its own season, clubs, entries and users.

begin;

select plan(31);

-- ---------------------------------------------------------------------------
-- The boundary.
-- ---------------------------------------------------------------------------

select is(
  (select count(*)::integer from pg_proc proc
     join pg_namespace ns on ns.oid = proc.pronamespace
    where ns.nspname = 'public'
      and proc.proname in ('admin_confirm_season_fixture_result',
                           'admin_correct_season_fixture_result',
                           'admin_clear_season_fixture_result')
      and proc.prosecdef and proc.proconfig @> array['search_path=""']),
  3,
  'all three entry points exist, security definer, search path pinned');

select is(
  (select count(*)::integer from information_schema.routine_privileges
    where routine_name in ('admin_confirm_season_fixture_result',
                           'admin_correct_season_fixture_result',
                           'admin_clear_season_fixture_result')
      and grantee = 'anon'),
  0,
  'anon may not reach any of them');

select is(
  (select count(*)::integer from information_schema.routine_privileges
    where routine_name in ('record_season_fixture_result',
                           'block_season_result_revision_rewrite')
      and grantee in ('anon', 'authenticated', 'service_role')),
  0,
  'and the writer beneath them is reachable by no role at all — the gate cannot '
  'be walked around');

select is(
  (select count(*)::integer from information_schema.role_table_grants
    where table_name = 'season_fixture_result_revisions'
      and grantee in ('anon', 'authenticated', 'service_role')),
  0,
  'the revision record reaches no browser or service role');

select is(
  (select relrowsecurity from pg_class c join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'predictor_internal'
      and c.relname = 'season_fixture_result_revisions'),
  true,
  'and has row level security enabled');

-- ---------------------------------------------------------------------------
-- Setup: one season, one matchweek, two fixtures, two entrants with
-- predictions, so a settled matchweek has something to score.
-- ---------------------------------------------------------------------------

insert into public.tournaments (name, year, competition_id, season_key, kind, display_timezone, status)
select 'C125 Result Probe', 2030, t.competition_id, 'sfr-probe', 'league_season',
       t.display_timezone, 'active'
  from public.tournaments t
 where t.kind = 'league_season'
 order by t.name
 limit 1;

select set_config('test.sfr_season',
  (select id::text from public.tournaments where season_key = 'sfr-probe'), true);

insert into public.teams (tournament_id, name) values
  (current_setting('test.sfr_season')::uuid, 'Result Rovers'),
  (current_setting('test.sfr_season')::uuid, 'Result United'),
  (current_setting('test.sfr_season')::uuid, 'Result City'),
  (current_setting('test.sfr_season')::uuid, 'Result Athletic');

insert into public.competition_rounds (tournament_id, round_key, ordinal, kind, label)
values (current_setting('test.sfr_season')::uuid, 'sfr-mw1', 1, 'league_matchweek', 'Matchweek 1');

select set_config('test.sfr_round',
  (select id::text from public.competition_rounds
    where tournament_id = current_setting('test.sfr_season')::uuid
      and round_key = 'sfr-mw1'), true);

insert into public.season_fixtures
  (tournament_id, competition_round_id, home_team_id, away_team_id, kickoff_at, status)
select current_setting('test.sfr_season')::uuid, current_setting('test.sfr_round')::uuid,
       (select id from public.teams where tournament_id = current_setting('test.sfr_season')::uuid and name = home),
       (select id from public.teams where tournament_id = current_setting('test.sfr_season')::uuid and name = away),
       now() - interval '2 hours', 'scheduled'
  from (values ('Result Rovers', 'Result United'), ('Result City', 'Result Athletic')) pairs(home, away);

select set_config('test.sfr_fixture',
  (select fixture.id::text from public.season_fixtures fixture
     join public.teams home on home.id = fixture.home_team_id
    where fixture.competition_round_id = current_setting('test.sfr_round')::uuid
      and home.name = 'Result Rovers'), true);

select set_config('test.sfr_other',
  (select fixture.id::text from public.season_fixtures fixture
     join public.teams home on home.id = fixture.home_team_id
    where fixture.competition_round_id = current_setting('test.sfr_round')::uuid
      and home.name = 'Result City'), true);

set local session_replication_role = replica;
insert into auth.users (
  id, email, aud, role, raw_app_meta_data, raw_user_meta_data, created_at, updated_at
)
select md5('sfr-user-' || n)::uuid, format('sfr-%s@example.test', n),
  'authenticated', 'authenticated', '{}'::jsonb, '{}'::jsonb, now(), now()
from generate_series(1, 2) as n;
set local session_replication_role = origin;

insert into public.profiles (id, display_name, welcomed_at)
select md5('sfr-user-' || n)::uuid, format('Sfr Player %s', n), now()
from generate_series(1, 2) as n;

-- ---------------------------------------------------------------------------
-- The gate, driven rather than inspected.
-- ---------------------------------------------------------------------------

select set_config('request.jwt.claims',
  json_build_object('sub', md5('sfr-user-1')::uuid, 'role', 'authenticated',
                    'app_metadata', json_build_object())::text, true);
set local role authenticated;

select throws_ok(
  format('select public.admin_confirm_season_fixture_result(%L::uuid, 2::smallint, 1::smallint)',
         current_setting('test.sfr_fixture')),
  '42501',
  'Result administration is not authorised',
  'an ordinary signed-in player may reach the function and may not act — the '
  'grant is not the boundary');

select is(
  (select status from public.season_fixtures where id = current_setting('test.sfr_fixture')::uuid),
  'scheduled',
  'and the fixture is genuinely untouched, not merely reported as refused');

reset role;

-- Now as a result administrator, through the same capability the tournament
-- path uses rather than a second admin model.
select set_config('request.jwt.claims',
  json_build_object('sub', md5('sfr-user-1')::uuid, 'role', 'authenticated',
                    'app_metadata', json_build_object(
                      'admin_capabilities', json_build_array('results')))::text, true);
set local role authenticated;

-- ---------------------------------------------------------------------------
-- Confirming a result.
-- ---------------------------------------------------------------------------

select is(
  public.admin_confirm_season_fixture_result(
    current_setting('test.sfr_fixture')::uuid, 2::smallint, 1::smallint) -> 'result',
  jsonb_build_object('status', 'played', 'home', 2, 'away', 1),
  'a season fixture takes a result, which nothing in this repository could do before');

select is(
  (select jsonb_build_object('status', status, 'home', home_score, 'away', away_score)
     from public.season_fixtures where id = current_setting('test.sfr_fixture')::uuid),
  jsonb_build_object('status', 'played', 'home', 2, 'away', 1),
  'and the fixture actually carries it');

select is(
  (select jsonb_build_object('revision', revision, 'action', action,
                             'previous', previous_result, 'new', new_result,
                             'actor', actor_id = md5('sfr-user-1')::uuid)
     from predictor_internal.season_fixture_result_revisions
    where season_fixture_id = current_setting('test.sfr_fixture')::uuid),
  jsonb_build_object('revision', 1, 'action', 'confirm',
                     'previous', jsonb_build_object('status', 'scheduled', 'home', null, 'away', null),
                     'new', jsonb_build_object('status', 'played', 'home', 2, 'away', 1),
                     'actor', true),
  'recorded with the result it replaced and who recorded it');

select throws_ok(
  format('select public.admin_confirm_season_fixture_result(%L::uuid, 3::smallint, 0::smallint)',
         current_setting('test.sfr_fixture')),
  '23514', null,
  'confirming a second time is refused — replacing a result silently would lose '
  'the correction trail this record exists for');

-- ---------------------------------------------------------------------------
-- THE POINT: the existing scoring job now has something to settle.
-- ---------------------------------------------------------------------------

select is(
  (select count(*)::integer from public.season_matchweek_scores
    where competition_round_id = current_setting('test.sfr_round')::uuid),
  0,
  'nothing is settled while the matchweek still has an unplayed fixture');

select public.admin_confirm_season_fixture_result(
  current_setting('test.sfr_other')::uuid, 0::smallint, 0::smallint);

select is(
  (select count(*)::integer from public.season_fixtures
    where competition_round_id = current_setting('test.sfr_round')::uuid
      and status = 'played'),
  2,
  'both fixtures of the matchweek now hold results');

-- The job that already existed, unchanged by this contract.
select set_config('test.sfr_settled',
  predictor_internal.settle_season_matchweek_scores(
    current_setting('test.sfr_season')::uuid)::text, true);

select is(
  current_setting('test.sfr_settled')::jsonb->>'outcome',
  'settled',
  'and the matchweek scoring job settles it — the contract writes a result and '
  'settles nothing, because full rederivation already belongs to that job');

-- ---------------------------------------------------------------------------
-- Correcting, and what a correction must say.
-- ---------------------------------------------------------------------------

set local role authenticated;

select throws_ok(
  format('select public.admin_correct_season_fixture_result(%L::uuid, 3::smallint, 1::smallint, null)',
         current_setting('test.sfr_fixture')),
  '22023', null,
  'a correction with no reason is refused — by now points have been banked '
  'against the result and somebody will ask why they moved');

select throws_ok(
  format('select public.admin_correct_season_fixture_result(%L::uuid, 2::smallint, 1::smallint, %L)',
         current_setting('test.sfr_fixture'), 'no change'),
  '23514', null,
  'and a correction to the same score is refused rather than filling the record '
  'with revisions that changed nothing');

select is(
  public.admin_correct_season_fixture_result(
    current_setting('test.sfr_fixture')::uuid, 3::smallint, 1::smallint,
    'Third goal awarded on review') -> 'result',
  jsonb_build_object('status', 'played', 'home', 3, 'away', 1),
  'a corrected result replaces the old one');

select is(
  (select jsonb_build_object('revision', revision, 'action', action, 'reason', reason,
                             'previous', previous_result)
     from predictor_internal.season_fixture_result_revisions
    where season_fixture_id = current_setting('test.sfr_fixture')::uuid
      and revision = 2),
  jsonb_build_object('revision', 2, 'action', 'correct',
                     'reason', 'Third goal awarded on review',
                     'previous', jsonb_build_object('status', 'played', 'home', 2, 'away', 1)),
  'and the second revision records what it replaced, so the first is not lost');

select is(
  (select count(*)::integer from predictor_internal.season_fixture_result_revisions
    where season_fixture_id = current_setting('test.sfr_fixture')::uuid),
  2,
  'both revisions survive — the record is the history, not the current value');

-- ---------------------------------------------------------------------------
-- Clearing.
-- ---------------------------------------------------------------------------

select throws_ok(
  format('select public.admin_clear_season_fixture_result(%L::uuid, null)',
         current_setting('test.sfr_fixture')),
  '22023', null,
  'clearing also needs a reason');

select is(
  public.admin_clear_season_fixture_result(
    current_setting('test.sfr_fixture')::uuid, 'Entered against the wrong fixture') -> 'result',
  jsonb_build_object('status', 'scheduled', 'home', null, 'away', null),
  'a cleared fixture goes back to scheduled with no score');

select is(
  (select jsonb_build_object('status', status, 'home', home_score, 'away', away_score)
     from public.season_fixtures where id = current_setting('test.sfr_fixture')::uuid),
  jsonb_build_object('status', 'scheduled', 'home', null, 'away', null),
  'which the fixture itself reflects');

select throws_ok(
  format('select public.admin_clear_season_fixture_result(%L::uuid, %L)',
         current_setting('test.sfr_fixture'), 'again'),
  '23514', null,
  'and clearing a fixture that holds no result is refused rather than recording '
  'a revision from nothing to nothing');

select throws_ok(
  format('select public.admin_correct_season_fixture_result(%L::uuid, 1::smallint, 1::smallint, %L)',
         current_setting('test.sfr_fixture'), 'reason'),
  '23514', null,
  'correcting one that holds no confirmed result is refused too — a correction '
  'is not a confirmation by another name');

-- ---------------------------------------------------------------------------
-- Refusals on the inputs.
-- ---------------------------------------------------------------------------

select throws_ok(
  format('select public.admin_confirm_season_fixture_result(%L::uuid, 1::smallint, 1::smallint)',
         md5('sfr-nowhere')::uuid),
  '23503', null,
  'an unknown fixture is refused rather than silently recording nothing');

select throws_ok(
  format('select public.admin_confirm_season_fixture_result(%L::uuid, null, 1::smallint)',
         current_setting('test.sfr_fixture')),
  '22023', null,
  'a half-supplied score is refused');

select throws_ok(
  format('select public.admin_confirm_season_fixture_result(%L::uuid, -1::smallint, 1::smallint)',
         current_setting('test.sfr_fixture')),
  '22023', null,
  'and a negative one is refused before it reaches the table constraint');

reset role;

-- ---------------------------------------------------------------------------
-- The record is evidence.
-- ---------------------------------------------------------------------------

select throws_ok(
  $$update predictor_internal.season_fixture_result_revisions set reason = 'rewritten'$$,
  '42501', null,
  'a revision may not be rewritten — a mistake is corrected by recording '
  'another one, which is why they are numbered');

select throws_ok(
  $$delete from predictor_internal.season_fixture_result_revisions$$,
  '42501', null,
  'nor deleted');

-- ---------------------------------------------------------------------------
-- The confirmation gate, in the one direction that matters.
-- ---------------------------------------------------------------------------

select is(
  (select count(*)::integer from pg_proc proc
     join pg_namespace ns on ns.oid = proc.pronamespace
    where ns.nspname = 'predictor_internal'
      and proc.proname = 'import_provider_fixture_revisions'
      and pg_get_functiondef(proc.oid) like '%home_score%'),
  0,
  'the provider importer still cannot write a score — live data stays '
  'provisional and confirmation remains the official gate');

select is(
  (select count(*)::integer from pg_proc proc
     join pg_namespace ns on ns.oid = proc.pronamespace
    where ns.nspname in ('public', 'predictor_internal')
      and proc.prokind = 'f'
      and has_function_privilege('authenticated', proc.oid, 'execute')
      and pg_get_functiondef(proc.oid) ~ 'update public\.season_fixtures'
      and proc.proname not in ('admin_confirm_season_fixture_result',
                               'admin_correct_season_fixture_result',
                               'admin_clear_season_fixture_result')),
  0,
  'and no other function a signed-in caller may execute writes season_fixtures '
  'at all');

select * from finish();
rollback;
