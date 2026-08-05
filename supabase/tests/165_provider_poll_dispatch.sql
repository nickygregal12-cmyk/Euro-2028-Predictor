-- Contract 114: the database calls the provider.
--
-- Two things this suite is careful about.
--
-- It creates every row it needs. Contract 112's suite was written against
-- development seed data, passed on a developer machine and failed in CI, where
-- the database is built from migrations alone. A test that depends on seed data
-- is testing the seed.
--
-- And it really does dispatch. `net.http_post` enqueues into
-- `net.http_request_queue` inside the current transaction, so the rollback at
-- the foot of this file removes the request before pg_net's background worker
-- can see it — nothing leaves the machine. Asserting the dispatch path from
-- outside, with the endpoint left unconfigured, would leave "always report
-- unconfigured" as a mutation this suite could not see.

begin;

select plan(36);

select set_config('test.ppd_season',
  (select t.id::text from public.tournaments t where t.name = 'Premier League 2026/27'), true);

insert into public.provider_poll_targets (tournament_id, provider, path, cadence_minutes)
values
  (current_setting('test.ppd_season')::uuid, 'football-data', '/competitions/PL/matches', 60),
  (current_setting('test.ppd_season')::uuid, 'sportmonks', '/fixtures/between/2026-08-01/2026-08-31', 360);

select set_config('test.ppd_target',
  (select id::text from public.provider_poll_targets
    where tournament_id = current_setting('test.ppd_season')::uuid
      and provider = 'football-data'), true);

-- A disabled target, to prove enablement is read rather than assumed.
insert into public.provider_poll_targets (tournament_id, provider, path, cadence_minutes, enabled)
values (current_setting('test.ppd_season')::uuid, 'api-football', '/fixtures?league=39', 60, false);

-- ---------------------------------------------------------------------------
-- The outbound capability reaches nothing but this job
-- ---------------------------------------------------------------------------

select is(
  (select count(*)::integer from information_schema.routine_privileges
    where routine_schema in ('predictor_internal', 'public')
      and routine_name in ('due_provider_poll_targets', 'provider_poll_endpoint',
                           'post_provider_poll', 'dispatch_due_provider_polls',
                           'touch_provider_poll_target')
      and grantee in ('anon', 'authenticated', 'service_role')),
  0,
  'no browser or service role may select due targets, read the endpoint, post a poll or run the job'
);

select is(
  (select count(*)::integer from pg_proc proc
    join pg_namespace ns on ns.oid = proc.pronamespace
   where ns.nspname in ('predictor_internal', 'public')
     and proc.proname in ('due_provider_poll_targets', 'provider_poll_endpoint',
                          'post_provider_poll', 'dispatch_due_provider_polls',
                          'touch_provider_poll_target')
     and proc.prosecdef
     and proc.proconfig @> array['search_path=""']),
  5,
  'and all five are security definer with a pinned search path'
);

-- The point of the whole revoke block. If a browser role can execute
-- net.http_post, an authenticated session can make the database fetch any URL
-- it likes, using the database's network position.
select is(
  (select count(*)::integer
     from pg_proc proc
     join pg_namespace ns on ns.oid = proc.pronamespace
    cross join unnest(array['anon', 'authenticated', 'service_role']) as role_name
    where ns.nspname = 'net'
      and has_function_privilege(role_name, proc.oid, 'execute')),
  0,
  'no browser or service role may execute any pg_net function — the database''s outbound reach is not a browser capability'
);

select is(
  (select count(*)::integer
     from unnest(array['anon', 'authenticated', 'service_role']) as role_name
    where has_schema_privilege(role_name, 'net', 'usage')),
  0,
  'and none of them may even reach the net schema'
);

select is(
  (select count(*)::integer from information_schema.role_table_grants
    where table_name in ('provider_poll_targets', 'provider_poll_dispatches')
      and grantee in ('anon', 'authenticated', 'service_role')),
  0,
  'the target list and the dispatch record reach no browser or service role'
);

select is(
  (select count(*)::integer from pg_class relation
     join pg_namespace ns on ns.oid = relation.relnamespace
    where relation.relname in ('provider_poll_targets', 'provider_poll_dispatches')
      and ns.nspname in ('public', 'predictor_internal')
      and relation.relrowsecurity),
  2,
  'and both have row level security enabled'
);

select is(
  (select count(*)::integer from cron.job where jobname = 'provider-poll-dispatch-due-targets' and active),
  1,
  'the job is scheduled and active, which is the whole point of the contract'
);

-- ---------------------------------------------------------------------------
-- A target the Edge Function would reject cannot be stored
-- ---------------------------------------------------------------------------

select throws_ok(
  format($$insert into public.provider_poll_targets (tournament_id, provider, path, cadence_minutes)
           values (%L::uuid, 'opta', '/fixtures', 60)$$, current_setting('test.ppd_season')),
  '23514',
  null,
  'a provider the Edge Function has no configuration for is refused'
);

select throws_ok(
  format($$insert into public.provider_poll_targets (tournament_id, provider, path, cadence_minutes)
           values (%L::uuid, 'sportmonks', '/fixtures', 4)$$, current_setting('test.ppd_season')),
  '23514',
  null,
  'a cadence below the schedule''s own resolution is refused rather than stored as a promise the job cannot keep'
);

select throws_ok(
  format($$insert into public.provider_poll_targets (tournament_id, provider, path, cadence_minutes)
           values (%L::uuid, 'sportmonks', '/fixtures', 1441)$$, current_setting('test.ppd_season')),
  '23514',
  null,
  'and a cadence longer than a day is refused too'
);

select throws_ok(
  format($$insert into public.provider_poll_targets (tournament_id, provider, path, cadence_minutes)
           values (%L::uuid, 'sportmonks', 'fixtures', 60)$$, current_setting('test.ppd_season')),
  '23514',
  null,
  'a path that is not provider-relative is refused'
);

select throws_ok(
  format($$insert into public.provider_poll_targets (tournament_id, provider, path, cadence_minutes)
           values (%L::uuid, 'sportmonks', '/../admin', 60)$$, current_setting('test.ppd_season')),
  '23514',
  null,
  'a path that climbs out of its provider prefix is refused'
);

select throws_ok(
  format($$insert into public.provider_poll_targets (tournament_id, provider, path, cadence_minutes)
           values (%L::uuid, 'sportmonks', '/x?u=https://elsewhere.example/', 60)$$,
         current_setting('test.ppd_season')),
  '23514',
  null,
  'and a path carrying an absolute URL is refused, so a stored target cannot aim the Edge Function somewhere else'
);

select throws_ok(
  format($$insert into public.provider_poll_targets (tournament_id, provider, path, cadence_minutes)
           values (%L::uuid, 'football-data', '/competitions/PL/matches', 60)$$,
         current_setting('test.ppd_season')),
  '23505',
  null,
  'one endpoint is polled once per season, not twice — a duplicate would double the quota spend for identical data'
);

-- ---------------------------------------------------------------------------
-- Which targets are due
-- ---------------------------------------------------------------------------

select is(
  (select count(*)::integer from predictor_internal.due_provider_poll_targets(
     timestamptz '2030-04-01 12:00:00+00')),
  2,
  'a never-dispatched target is due immediately, and the disabled one is not — enablement is read, not assumed'
);

select is(
  (select count(*)::integer from predictor_internal.due_provider_poll_targets(null)),
  0,
  'and a null instant selects nothing rather than everything'
);

update public.provider_poll_targets
   set last_dispatched_at = timestamptz '2030-04-01 12:00:00+00'
 where id = current_setting('test.ppd_target')::uuid;

select is(
  (select count(*)::integer from predictor_internal.due_provider_poll_targets(
     timestamptz '2030-04-01 12:59:00+00')
    where target_id = current_setting('test.ppd_target')::uuid),
  0,
  'a target polled 59 minutes ago on an hourly cadence is not due, so the cadence is the rate limit rather than decoration'
);

select is(
  (select count(*)::integer from predictor_internal.due_provider_poll_targets(
     timestamptz '2030-04-01 13:00:00+00')
    where target_id = current_setting('test.ppd_target')::uuid),
  1,
  'and it is due again exactly one cadence later'
);

update public.provider_poll_targets
   set last_dispatched_at = null
 where id = current_setting('test.ppd_target')::uuid;

-- ---------------------------------------------------------------------------
-- The endpoint, and what "not configured" means
-- ---------------------------------------------------------------------------

delete from vault.secrets
 where name in ('provider_poll_function_url', 'provider_poll_caller_key');

select is(
  (select endpoint_url is null and caller_key is null
     from predictor_internal.provider_poll_endpoint()),
  true,
  'with no secrets recorded the endpoint is simply absent'
);

select is(
  public.dispatch_due_provider_polls(timestamptz '2030-04-01 12:00:00+00'),
  jsonb_build_object('configured', false, 'due', 2, 'dispatched', 0, 'failed', 0),
  'an unconfigured job reports itself unconfigured and still counts what was waiting, rather than raising every five minutes until somebody finishes the setup'
);

select is(
  (select count(*)::integer from predictor_internal.provider_poll_dispatches),
  0,
  'and it sends nothing, so an unconfigured job leaves no dispatch record to mislead an operator'
);

select is(
  (select count(*)::integer from public.provider_poll_targets where last_dispatched_at is not null),
  0,
  'nor does it advance any target''s clock, which would have made the waiting targets look polled'
);

select lives_ok(
  $$select vault.create_secret('a-caller-key', 'provider_poll_caller_key')$$,
  'a caller key alone is recorded'
);

select is(
  public.dispatch_due_provider_polls(timestamptz '2030-04-01 12:00:00+00')->>'configured',
  'false',
  'but half a configuration is still not configured — a key with nowhere to send it dispatches nothing'
);

select lives_ok(
  $$select vault.create_secret('http://127.0.0.1:1/functions/v1/provider-poll', 'provider_poll_function_url')$$,
  'an http endpoint can be recorded by mistake'
);

select throws_ok(
  'select * from predictor_internal.provider_poll_endpoint()',
  '22023',
  null,
  'and reading it RAISES rather than returning null — sending the caller key in clear text is a misconfiguration to fix, not an absence to tolerate'
);

delete from vault.secrets where name = 'provider_poll_function_url';

-- Port 1 answers nothing, and the rollback at the foot of this file removes the
-- queued request before pg_net's worker runs. Both, deliberately: the test does
-- not depend on the transaction being the only thing stopping an outbound call.
select lives_ok(
  $$select vault.create_secret('https://127.0.0.1:1/functions/v1/provider-poll', 'provider_poll_function_url')$$,
  'an https endpoint is accepted'
);

-- ---------------------------------------------------------------------------
-- Dispatch
-- ---------------------------------------------------------------------------

select is(
  public.dispatch_due_provider_polls(timestamptz '2030-04-01 12:00:00+00'),
  jsonb_build_object('configured', true, 'due', 2, 'dispatched', 2, 'failed', 0),
  'a configured job dispatches every due target and no disabled one'
);

select is(
  (select count(*)::integer from predictor_internal.provider_poll_dispatches
    where succeeded and net_request_id is not null),
  2,
  'each dispatch is recorded against pg_net''s own request id, which is what correlates this row to the request that was made'
);

select is(
  (select count(*)::integer from public.provider_poll_targets
    where last_dispatched_at = timestamptz '2030-04-01 12:00:00+00'),
  2,
  'and each dispatched target has its clock advanced to the instant it was sent'
);

-- What was actually queued. pg_net holds the pending request in
-- `net.http_request_queue` until its worker delivers it, and inside this
-- transaction that row is the only description of the call this database made.
-- Everything above proves a dispatch was COUNTED; these three prove it was
-- ADDRESSED, AUTHORISED and SHAPED the way the Edge Function requires.
select is(
  (select count(distinct url)::integer from net.http_request_queue),
  1,
  'every poll went to the one configured endpoint, so a target cannot redirect the database somewhere else'
);

select is(
  (select count(*)::integer from net.http_request_queue
    where headers->>'apikey' = 'a-caller-key'),
  2,
  'the caller key travelled as the apikey HEADER — as a query parameter it would be written into provider and proxy access logs, and the Edge Function would reject it anyway'
);

select is(
  (select array_agg(convert_from(body, 'UTF8')::jsonb->>'provider' order by
                    convert_from(body, 'UTF8')::jsonb->>'provider')
     from net.http_request_queue),
  array['football-data', 'sportmonks'],
  'and each body names its own target''s provider, so two due targets are not two copies of one poll'
);

select is(
  public.dispatch_due_provider_polls(timestamptz '2030-04-01 12:00:00+00'),
  jsonb_build_object('configured', true, 'due', 0, 'dispatched', 0, 'failed', 0),
  're-running at the same instant sends nothing, so the five-minute schedule polls at the cadence rather than at the schedule'
);

select is(
  (select count(*)::integer from predictor_internal.provider_poll_dispatches),
  2,
  'and writes no second dispatch record'
);

select throws_ok(
  'select public.dispatch_due_provider_polls(null)',
  '22023',
  null,
  'a null dispatch instant is refused rather than treated as now, which would make the cadence untestable and the job unreproducible'
);

select finish();

rollback;
