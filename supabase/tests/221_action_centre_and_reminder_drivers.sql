-- Contract 172: the action centre and the reminder ledger acquire a caller.
--
-- THE ASSERTION THIS FILE EXISTS FOR is that scheduling a reminder pipeline
-- cannot become sending one. `process_reminder_schedule` defaults `p_dry_run`
-- to true and the job calls it with no arguments, so the safety property lives
-- in a default rather than in a string — but a later edit could pass `false`
-- in the cron command, and nothing in PostgreSQL would notice. So the command
-- text itself is asserted, for every job in the table rather than for the
-- three this contract owns: a sender arriving under a different job name is
-- exactly the change this needs to catch.
--
-- The second is that the jobs exist at all, which is the defect being fixed:
-- three contracts built an inbox, a ledger and a second generator, and every
-- one of them ended by recording that nothing called them.
--
-- The third is that the health read reports operations and not people.

begin;

select plan(17);

-- ---------------------------------------------------------------------------
-- THE JOBS EXIST AND ARE ACTIVE
-- ---------------------------------------------------------------------------

select is(
  (select count(*)::integer from cron.job
    where jobname in ('player-action-centre-generate',
                      'player-reminder-schedule',
                      'player-reminder-reclaim-stalled')
      and active),
  3,
  'all three of this contract''s jobs are scheduled and active');

select is(
  (select command from cron.job where jobname = 'player-action-centre-generate'),
  'select public.process_player_action_items();',
  'the generator job calls the driver and nothing else');

select is(
  (select command from cron.job where jobname = 'player-reminder-schedule'),
  'select public.process_reminder_schedule();',
  'and the reminder job passes NO arguments, so the dry-run default is what applies');

-- ---------------------------------------------------------------------------
-- THE SAFETY PROPERTY, ASSERTED OVER EVERY JOB
-- ---------------------------------------------------------------------------

select is(
  (select count(*)::integer from cron.job
    where command ~* 'process_reminder_schedule\s*\(\s*[^)]*false'),
  0,
  'no scheduled command turns the reminder dry run off');

-- Contract 216 gave the sender a caller, which makes this property STRONGER
-- rather than obsolete. Claiming from a scheduled command would take rows out
-- of the ledger without passing any of the three gates the Edge Function holds,
-- so the dispatch job posts to the sender and never claims on its behalf.
select is(
  (select count(*)::integer from cron.job where command ~* 'claim_due_reminders'),
  0,
  'and no scheduled command claims a batch for sending — a sender exists now, and claiming from SQL would route around every gate it has');

select is(
  (select count(*)::integer from cron.job where command ~* 'record_reminder_result'),
  0,
  'nor records a delivery result');

-- The offset. A producer and its consumer on the same grid compete for one
-- instant, which is the reason contract 135's consumer took `2-59/5`.
select isnt(
  (select schedule from cron.job where jobname = 'player-action-centre-generate'),
  (select schedule from cron.job where jobname = 'player-reminder-schedule'),
  'the scheduler runs offset from the generator rather than on the same grid');

-- ---------------------------------------------------------------------------
-- THE DRIVER IS STILL SERVICE-ROLE ONLY
--
-- Giving something a job must not have given it a browser.
-- ---------------------------------------------------------------------------

select is(
  (select count(*)::integer
     from pg_proc proc
     cross join aclexplode(proc.proacl) entry
     left join pg_roles grantee on grantee.oid = entry.grantee
    where proc.oid in (
            to_regprocedure('public.process_player_action_items()'),
            to_regprocedure('public.process_reminder_schedule(interval, boolean)'),
            to_regprocedure('public.claim_due_reminders(integer, boolean)'),
            to_regprocedure('public.reclaim_stalled_reminders(interval)'))
      and coalesce(grantee.rolname, 'PUBLIC') in ('anon', 'authenticated', 'PUBLIC')),
  0,
  'no browser role may run the generator, the scheduler, the claim or the reclaim');

-- ---------------------------------------------------------------------------
-- THE DRIVER RUNS, IDEMPOTENTLY, ON A DATABASE WITH NOTHING TO DO
--
-- The migration is inert on apply; this proves the job it schedules is inert
-- too, rather than raising every quarter of an hour into a table nothing reads.
-- ---------------------------------------------------------------------------

-- Asserted on the SHAPE rather than on a count: the parity database carries
-- seed competitions, so how many items a run writes is a fact about the seed
-- and would make this suite fail the next time the seed changed. That the
-- driver runs at all, and reports each generator separately, is the property.
select is(
  (select count(*)::integer
     from jsonb_object_keys(public.process_player_action_items()) key
    where key in ('lms_pick_actions_written', 'matchweek_prediction_actions_written',
                  'actions_invalidated', 'ran_at')),
  4,
  'the generator driver runs and reports each generator separately');

select is(
  (public.process_reminder_schedule() ->> 'dry_run')::boolean,
  true,
  'the scheduler called the way the job calls it is a dry run');

select is(
  (public.reclaim_stalled_reminders() ->> 'reclaimed')::integer,
  0,
  'and the reclaim finds nothing in flight, because nothing sends');

-- ---------------------------------------------------------------------------
-- THE HEALTH READ
-- ---------------------------------------------------------------------------

set local session_replication_role = replica;
insert into auth.users (id, email, aud, role, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
select md5('c172-' || who)::uuid, format('c172-%s@example.test', who),
       'authenticated', 'authenticated', '{}'::jsonb, '{}'::jsonb, now(), now()
  from unnest(array['plain', 'admin']) as who;
set local session_replication_role = origin;

insert into public.profiles (id, display_name, welcomed_at) values
  (md5('c172-plain')::uuid, 'Ordinary Olive', now()),
  (md5('c172-admin')::uuid, 'Admin Ada', now());

select set_config('request.jwt.claims',
  json_build_object('sub', md5('c172-plain')::uuid, 'role', 'authenticated',
                    'app_metadata', json_build_object())::text, true);
set local role authenticated;

select throws_ok(
  'select public.admin_reminder_delivery_health()',
  '42501',
  'Competition administration is not authorised',
  'an ordinary signed-in player is refused');

reset role;
select set_config('request.jwt.claims',
  json_build_object('sub', md5('c172-admin')::uuid, 'role', 'authenticated',
                    'app_metadata', json_build_object('admin_role', 'super_admin'))::text, true);
set local role authenticated;

select set_config('test.c172_health',
  public.admin_reminder_delivery_health()::text, true);

select is(
  current_setting('test.c172_health')::jsonb -> 'actions' ->> 'open_past_deadline',
  '0',
  'the administrator sees the sweep''s own health figure');

-- Still false here, and now for a REASON rather than by literal: contract 216
-- derives this from the vault and the job, and a fresh test database has
-- neither secret. The value is the same; what changed is that it can become
-- true without anybody editing a function.
select is(
  current_setting('test.c172_health')::jsonb ->> 'sender_configured',
  'false',
  'and is told plainly that no sender is configured, rather than inferring it from a zero');

-- `jobs` is `[]` only when the read looked and found none; `null` when it could
-- not look. Either is acceptable here; what is not is the section vanishing.
select ok(
  current_setting('test.c172_health')::jsonb ? 'jobs',
  'the read reports the jobs as well as the rows, because an empty ledger and a dead scheduler look identical');

-- ---------------------------------------------------------------------------
-- IT REPORTS OPERATIONS, NOT PEOPLE
--
-- Asserted against the payload rather than against the source, so an added
-- field is caught even if it is spelled differently from the columns the
-- migration's own assertion looks for.
-- ---------------------------------------------------------------------------

select is(
  (select count(*)::integer
     from jsonb_each_text(current_setting('test.c172_health')::jsonb -> 'deliveries') field
    where field.value ~ '^[0-9a-f]{8}-[0-9a-f]{4}-'),
  0,
  'no value in the delivery section is a uuid, so no player is named');

select is(
  (select count(*)::integer
     from jsonb_object_keys(current_setting('test.c172_health')::jsonb -> 'deliveries') key
    where key in ('user_id', 'action_key', 'last_error', 'email', 'display_name', 'provider_message_id')),
  0,
  'and it carries no per-player or per-message key');

reset role;
select set_config('request.jwt.claims', null, true);

select * from finish();
rollback;
