-- Contract 138: an administrator can see what the provider path refused.
--
-- THE ASSERTION THIS FILE EXISTS FOR is that the queues are reachable and the
-- gate holds. Contract 135 refuses silently by design, so until this read
-- existed the answer to "why did that match never settle?" required database
-- access -- and a read that any signed-in player could make would be a
-- different defect, not a fix.
--
-- The gate is driven with a real non-administrator session rather than
-- inspected, on the reasoning 177 records: a test that only checks the grant
-- passes on a function with no gate at all.

begin;

select plan(13);

select is(
  (select count(*)::integer from information_schema.role_table_grants
    where table_schema = 'predictor_internal'
      and table_name = 'provider_review_acknowledgements'
      and grantee in ('anon', 'authenticated', 'service_role')),
  0,
  'the acknowledgement record is not reachable by a browser or service role');

select is(
  (select relrowsecurity from pg_class c join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'predictor_internal'
      and c.relname = 'provider_review_acknowledgements'),
  true,
  'and has row level security enabled');

select is(
  (select count(*)::integer from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname in ('get_provider_review_queues', 'acknowledge_provider_review_items')
      and pg_get_functiondef(p.oid) like '%require_competition_admin%'),
  2,
  'both entry points call the competition-admin gate');

-- ---------------------------------------------------------------------------
-- Setup: one season with one queued refusal of each interesting kind.
-- ---------------------------------------------------------------------------

insert into public.tournaments (name, year, competition_id, season_key, kind, display_timezone, status)
select 'C138 Review Probe', 2033, t.competition_id, 'prq-probe', 'league_season',
       t.display_timezone, 'active'
  from public.tournaments t
 where t.kind = 'league_season'
 order by t.name
 limit 1;

select set_config('test.prq_season',
  (select id::text from public.tournaments where season_key = 'prq-probe'), true);

insert into public.teams (tournament_id, name) values
  (current_setting('test.prq_season')::uuid, 'Review Rovers'),
  (current_setting('test.prq_season')::uuid, 'Review United');

insert into public.competition_rounds (tournament_id, round_key, ordinal, kind, label)
values (current_setting('test.prq_season')::uuid, 'prq-mw1', 1, 'league_matchweek', 'Matchweek 1');

insert into public.season_fixtures
  (tournament_id, competition_round_id, home_team_id, away_team_id, kickoff_at, status)
select current_setting('test.prq_season')::uuid,
       (select id from public.competition_rounds
         where tournament_id = current_setting('test.prq_season')::uuid),
       (select id from public.teams
         where tournament_id = current_setting('test.prq_season')::uuid and name = 'Review Rovers'),
       (select id from public.teams
         where tournament_id = current_setting('test.prq_season')::uuid and name = 'Review United'),
       now() - interval '2 hours', 'scheduled';

insert into predictor_internal.provider_result_refusals
  (tournament_id, season_fixture_id, provider, provider_status, reason, detail)
select current_setting('test.prq_season')::uuid,
       (select id from public.season_fixtures
         where tournament_id = current_setting('test.prq_season')::uuid),
       'football-data', 'FINISHED', 'administrator_owns_result',
       jsonb_build_object('revision', 3);

insert into predictor_internal.provider_status_observations
  (provider, provider_status, tournament_id, fixtures)
values ('sportmonks', '99', current_setting('test.prq_season')::uuid, 4);

select set_config('test.prq_refusal',
  (select id::text from predictor_internal.provider_result_refusals
    where tournament_id = current_setting('test.prq_season')::uuid), true);

-- ---------------------------------------------------------------------------
-- The gate, driven rather than inspected.
-- ---------------------------------------------------------------------------

set local session_replication_role = replica;
insert into auth.users (
  id, email, aud, role, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
values (md5('prq-player')::uuid, 'prq-player@example.test', 'authenticated', 'authenticated',
        '{}'::jsonb, '{}'::jsonb, now(), now()),
       (md5('prq-admin')::uuid, 'prq-admin@example.test', 'authenticated', 'authenticated',
        '{"admin_role":"super_admin"}'::jsonb, '{}'::jsonb, now(), now());
set local session_replication_role = origin;

select set_config('request.jwt.claims',
  json_build_object('sub', md5('prq-player')::uuid, 'role', 'authenticated',
                    'app_metadata', json_build_object())::text, true);
set local role authenticated;

select throws_ok(
  format('select public.get_provider_review_queues(%L::uuid)',
         current_setting('test.prq_season')),
  '42501',
  null,
  'an ordinary signed-in player may not read the review queues');

select throws_ok(
  format('select public.acknowledge_provider_review_items(%L, array[%L]::uuid[])',
         'result_refusal', current_setting('test.prq_refusal')),
  '42501',
  null,
  'nor acknowledge one');

reset role;

-- ---------------------------------------------------------------------------
-- The administrator.
-- ---------------------------------------------------------------------------

select set_config('request.jwt.claims',
  json_build_object('sub', md5('prq-admin')::uuid, 'role', 'authenticated',
                    'app_metadata', json_build_object('admin_role', 'super_admin'))::text, true);
set local role authenticated;

select is(
  ((select public.get_provider_review_queues(current_setting('test.prq_season')::uuid))
    -> 'result_refusals' ->> 'unreviewed')::integer,
  1,
  'the administrator sees the queued refusal');

select is(
  ((select public.get_provider_review_queues(current_setting('test.prq_season')::uuid))
    -> 'result_refusals' -> 'items' -> 0 ->> 'reason'),
  'administrator_owns_result',
  'with the reason it was refused');

select is(
  ((select public.get_provider_review_queues(current_setting('test.prq_season')::uuid))
    -> 'result_refusals' -> 'items' -> 0 -> 'fixture' ->> 'home'),
  'Review Rovers',
  'and the fixture named, because a refusal without one is unactionable');

select is(
  ((select public.get_provider_review_queues(current_setting('test.prq_season')::uuid))
    -> 'status_observations' ->> 'unreviewed')::integer,
  1,
  'and the unmeasured status token beside it');

-- ---------------------------------------------------------------------------
-- Acknowledgement clears the queue, records the actor, and cannot be replayed.
-- ---------------------------------------------------------------------------

select is(
  (public.acknowledge_provider_review_items(
     'result_refusal', array[current_setting('test.prq_refusal')::uuid],
     'Checked; our correction stands') ->> 'marked')::integer,
  1,
  'acknowledging marks the item');

select is(
  (public.acknowledge_provider_review_items(
     'result_refusal', array[current_setting('test.prq_refusal')::uuid], 'again')
   ->> 'marked')::integer,
  0,
  'and acknowledging again marks nothing -- when a human first looked cannot be '
  'moved by looking again');

select is(
  ((select public.get_provider_review_queues(current_setting('test.prq_season')::uuid))
    -> 'result_refusals' ->> 'unreviewed')::integer,
  0,
  'so the queue is empty');

reset role;

select is(
  (select count(*)::integer from predictor_internal.provider_review_acknowledgements
    where item_id = current_setting('test.prq_refusal')::uuid
      and actor_id = md5('prq-admin')::uuid),
  2,
  'and both attempts are recorded against the administrator who made them');

select finish();
rollback;
