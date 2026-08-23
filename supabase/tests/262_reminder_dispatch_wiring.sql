-- Contract 216: the reminder sender finally has a caller, and the second of
-- its three fail-closed gates finally works.
--
-- THE ASSERTION THIS FILE EXISTS FOR is the dry-run one, because it is the one
-- that was silently false. `claim_due_reminders` set `dry_run = p_dry_run` on
-- the row it claimed and RETURNED THAT NEW VALUE, and the Edge Function claims
-- with `p_dry_run: false` and then asks the returned row whether sending is
-- permitted. It was asking about a value the same statement had just
-- overwritten, so the answer was always yes. Nothing had ever invoked the
-- sender, so nothing had ever paid for it; this contract invokes the sender.
--
-- The rest is the caller: an unconfigured job that reports itself rather than
-- raising every five minutes, a run ledger that can record a refusal the
-- DELIVERY ledger structurally cannot, and a callback a replay cannot reopen.

begin;

select plan(40);

-- ---------------------------------------------------------------------------
-- THE DRY-RUN GATE
--
-- Written first because it is the defect. Both directions are asserted: the
-- ledger's flag survives a sender that wants to send, and the sender's flag is
-- honoured on a row the ledger left live. A claim may TIGHTEN and never clear.
-- ---------------------------------------------------------------------------

set local session_replication_role = replica;
insert into auth.users (id, email, aud, role, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
values (md5('c216-a')::uuid, 'c216-a@example.test', 'authenticated', 'authenticated',
        '{}'::jsonb, '{}'::jsonb, now(), now()),
       (md5('c216-b')::uuid, 'c216-b@example.test', 'authenticated', 'authenticated',
        '{}'::jsonb, '{}'::jsonb, now(), now());
set local session_replication_role = origin;

insert into public.profiles (id, display_name, welcomed_at, reminder_emails) values
  (md5('c216-a')::uuid, 'Dry Row', now(), true),
  (md5('c216-b')::uuid, 'Live Row', now(), true);

insert into public.reminder_deliveries
  (user_id, action_key, reminder_kind, deadline_at, scheduled_for, next_attempt_at, dry_run)
values (md5('c216-a')::uuid, 'c216-dry', 'deadline',
        now() + interval '2 hours', now() - interval '1 minute', now() - interval '1 minute', true),
       (md5('c216-b')::uuid, 'c216-live', 'deadline',
        now() + interval '2 hours', now() - interval '1 minute', now() - interval '1 minute', false);

select is(
  (select count(*)::integer from public.claim_due_reminders(50, false) claimed
    where claimed.action_key = 'c216-dry' and claimed.dry_run),
  1,
  'a row the ledger scheduled as a dry run is STILL a dry run when a sender claims it asking to send — before this contract the claim overwrote the flag and handed back its own answer'
);

select is(
  (select delivery.dry_run from public.reminder_deliveries delivery
    where delivery.action_key = 'c216-dry'),
  true,
  'and the stored row keeps it too, so a second look at the ledger agrees with what the sender was told'
);

select is(
  (select count(*)::integer from public.reminder_deliveries delivery
    where delivery.action_key = 'c216-live' and not delivery.dry_run),
  1,
  'while a row the ledger left live is not turned into a dry run by a sender that did not ask for one'
);

-- Reset both rows and claim the other way round.
update public.reminder_deliveries
   set status = 'pending', attempts = 0,
       dry_run = (action_key = 'c216-dry')
 where action_key in ('c216-dry', 'c216-live');

select is(
  (select count(*)::integer from public.claim_due_reminders(50, true) claimed
    where claimed.dry_run),
  2,
  'a sender that asks for a dry run gets one on every row, including the live one — the gate tightens in both directions and clears in neither'
);

update public.reminder_deliveries
   set status = 'pending', attempts = 0, dry_run = true
 where action_key in ('c216-dry', 'c216-live');

-- ---------------------------------------------------------------------------
-- THE JOB
-- ---------------------------------------------------------------------------

select is(
  (select count(*)::integer from cron.job
    where jobname = 'player-reminder-dispatch' and active),
  1,
  'the sender has a caller at last, and it is active'
);

select is(
  (select command from cron.job where jobname = 'player-reminder-dispatch'),
  'select public.dispatch_due_reminders();',
  'the dispatch job calls the dispatcher and nothing else — no arguments, so no scheduled string can change a default'
);

select is(
  (select count(*)::integer from cron.job
    where jobname in ('player-action-centre-generate',
                      'player-reminder-schedule',
                      'player-reminder-reclaim-stalled',
                      'player-reminder-dispatch')
      and active),
  4,
  'and contract 172''s three jobs are still there beside it'
);

select is(
  (select count(*)::integer from cron.job
    where command ~* 'process_reminder_schedule\s*\(\s*[^)]*false'),
  0,
  'no scheduled command turns the reminder dry run off — making delivery live stays a deliberate change to this contract, not a string edit'
);

select is(
  (select count(*)::integer from cron.job where command ~* 'claim_due_reminders'),
  0,
  'and no scheduled command claims a batch directly. There IS a sender now, which makes this property stronger rather than obsolete: claiming from SQL would take rows out of the ledger without passing any of the three delivery gates'
);

select is(
  (select jsonb_array_length(predictor_internal.reminder_job_status())),
  4,
  'the health read counts the new job as one of its own, rather than reporting three and looking healthy'
);

-- ---------------------------------------------------------------------------
-- NOT CONFIGURED IS REPORTED, NOT RAISED — AND IT IS RECORDED
--
-- This is the half `reminder_deliveries` cannot hold. The deployment gate
-- refuses BEFORE anything is claimed, by design, so the delivery ledger records
-- nothing whatsoever about a refusal. Without a run row, a correct silent
-- refusal and a dead cron job are the same picture.
-- ---------------------------------------------------------------------------

delete from vault.secrets
 where name in ('notification_dispatch_function_url', 'notification_dispatch_caller_key');

select is(
  (select endpoint_url is null and caller_key is null
     from predictor_internal.reminder_dispatch_endpoint()),
  true,
  'with no secrets recorded the endpoint is simply absent'
);

select is(
  public.dispatch_due_reminders(now())->>'configured',
  'false',
  'an unconfigured job reports itself rather than raising every five minutes until somebody finishes the setup'
);

select is(
  (select count(*)::integer from predictor_internal.reminder_dispatch_runs
    where outcome = 'not-configured' and reported_at is not null),
  1,
  'and it RECORDS the refusal, closed, which is the fact the delivery ledger cannot carry because nothing was ever claimed'
);

select is(
  (select count(*)::integer from net.http_request_queue),
  0,
  'having sent nothing at all'
);

-- A vault row holding whitespace is not a configuration. Left as one, the
-- dispatcher would post every five minutes with an empty `apikey`, the sender
-- would refuse each request at its caller-key check, every run would sit
-- unanswered, and the health read would report a configured sender throughout.
select lives_ok(
  $$select vault.create_secret('   ', 'notification_dispatch_caller_key')$$,
  'a blank caller key can be recorded by mistake'
);

select is(
  (select caller_key is null from predictor_internal.reminder_dispatch_endpoint()),
  true,
  'and it reads as ABSENT rather than as a key made of spaces'
);

select is(
  public.dispatch_due_reminders(now())->>'configured',
  'false',
  'so the job refuses rather than posting a request the sender can never authorise'
);

select is(
  (select count(*)::integer from net.http_request_queue),
  0,
  'and nothing is queued'
);

delete from vault.secrets where name = 'notification_dispatch_caller_key';

select lives_ok(
  $$select vault.create_secret('a-caller-key', 'notification_dispatch_caller_key')$$,
  'a caller key alone is recorded'
);

select is(
  public.dispatch_due_reminders(now())->>'configured',
  'false',
  'but half a configuration is still not configured — a key with nowhere to send it dispatches nothing'
);

select lives_ok(
  $$select vault.create_secret('http://127.0.0.1:1/functions/v1/notification-dispatch', 'notification_dispatch_function_url')$$,
  'an http endpoint can be recorded by mistake'
);

select throws_ok(
  'select * from predictor_internal.reminder_dispatch_endpoint()',
  '22023',
  null,
  'and reading it RAISES rather than returning null — sending the caller key in clear text is a misconfiguration to fix, not an absence to tolerate'
);

select is(
  predictor_internal.reminder_sender_configuration()->>'error',
  'notification_dispatch_function_url must be an https URL',
  'the health read reports that misconfiguration as its own state, because telling an administrator "no sender" when the truth is "a sender that cannot start" sends them to the wrong place'
);

select is(
  predictor_internal.reminder_sender_configuration()->>'configured',
  'false',
  'and a sender that cannot start is not a configured sender'
);

delete from vault.secrets where name = 'notification_dispatch_function_url';

-- Port 1 answers nothing, and the rollback at the foot of this file removes the
-- queued request before pg_net's worker runs. Both, deliberately: the test does
-- not depend on the transaction being the only thing stopping an outbound call.
select lives_ok(
  $$select vault.create_secret('https://127.0.0.1:1/functions/v1/notification-dispatch', 'notification_dispatch_function_url')$$,
  'an https endpoint is accepted'
);

-- ---------------------------------------------------------------------------
-- DISPATCH
-- ---------------------------------------------------------------------------

select is(
  predictor_internal.reminder_sender_configuration()->>'configured',
  'true',
  'with both secrets and an active job, the health read says a sender is configured — derived, where contract 172 could only state a literal false'
);

select set_config('test.c216_run',
  (public.dispatch_due_reminders(now())->>'runId'), true);

select isnt(
  current_setting('test.c216_run'),
  '',
  'a configured dispatch opens a run and names it'
);

select is(
  (select count(*)::integer from net.http_request_queue
    where url = 'https://127.0.0.1:1/functions/v1/notification-dispatch'),
  1,
  'and posts exactly once to the endpoint the vault named'
);

-- pg_net stores the pending body as `bytea`, so it is decoded rather than cast.
-- Suite 166 established the idiom; a plain `::jsonb` raises.
select is(
  (select convert_from(body, 'UTF8')::jsonb->>'runId' from net.http_request_queue),
  current_setting('test.c216_run'),
  'carrying the id of the run it just opened, which is how the sender closes the right one'
);

select is(
  (select count(*)::integer from net.http_request_queue
    where headers->>'apikey' = 'a-caller-key'),
  1,
  'the caller key travelled as the apikey HEADER — as a query parameter it would be written into proxy access logs, and the Edge Function would reject it anyway'
);

select is(
  (select reported_at is null from predictor_internal.reminder_dispatch_runs
    where id = current_setting('test.c216_run')::uuid),
  true,
  'the run stays OPEN until the sender answers — an unreported run is what an unreachable endpoint or a rejected caller key looks like from here, and the delivery ledger cannot show it because nothing was claimed'
);

-- ---------------------------------------------------------------------------
-- THE CALLBACK, AND WHAT IT MAY NOT SAY
-- ---------------------------------------------------------------------------

select is(
  public.record_reminder_dispatch_run(
    current_setting('test.c216_run')::uuid, 'delivery-disabled', 0, 0, 0, 0,
    'NOTIFICATIONS_DELIVERY is not enabled on this deployment')->>'outcome',
  'delivery-disabled',
  'the sender closes its own run, including when its own deployment gate refused'
);

select throws_ok(
  format('select public.record_reminder_dispatch_run(%L, %L)',
         current_setting('test.c216_run'), 'completed'),
  '22023',
  null,
  'a replayed callback cannot reopen a closed run and rewrite what happened, for the same reason record_reminder_result refuses a row that is not in flight'
);

insert into predictor_internal.reminder_dispatch_runs (requested_at, due_at_request, configured)
values (now(), 0, true);

select set_config('test.c216_open',
  (select id::text from predictor_internal.reminder_dispatch_runs
    where reported_at is null order by requested_at desc limit 1), true);

select throws_ok(
  format('select public.record_reminder_dispatch_run(%L, %L)',
         current_setting('test.c216_open'), 'not-configured'),
  '22023',
  null,
  'and a sender may not report an outcome the DATABASE owns — only the dispatcher knows it never found an endpoint'
);

select throws_ok(
  format('select public.record_reminder_dispatch_run(%L, %L, 2, 5, 0, 0)',
         current_setting('test.c216_open'), 'completed'),
  '23514',
  null,
  'nor may it claim to have delivered more than it claimed — a summary that cannot be true is worse than no summary, because this ledger exists to be checked against the other one'
);

-- ---------------------------------------------------------------------------
-- IT REPORTS OPERATIONS, NOT PEOPLE
--
-- Asserted against the payload and the columns rather than the source, so a
-- field spelled differently from its column cannot slip through.
-- ---------------------------------------------------------------------------

select is(
  (select count(*)::integer
     from information_schema.columns
    where table_schema = 'predictor_internal'
      and table_name = 'reminder_dispatch_runs'
      and column_name in ('user_id', 'action_key', 'email', 'recipient', 'last_error')),
  0,
  'the run ledger has no column that could name a player or carry a provider''s message about one'
);

select is(
  (select relrowsecurity from pg_catalog.pg_class relation
     join pg_catalog.pg_namespace ns on ns.oid = relation.relnamespace
    where ns.nspname = 'predictor_internal'
      and relation.relname = 'reminder_dispatch_runs'),
  true,
  'row level security is on'
);

select is(
  (select count(*)::integer from pg_catalog.pg_policies
    where schemaname = 'predictor_internal' and tablename = 'reminder_dispatch_runs'),
  0,
  'and no policy grants a direct read — every look goes through a definer function that returns counts'
);

select is(
  (select count(*)::integer
     from jsonb_object_keys(predictor_internal.reminder_dispatch_status()) as key
    where key in ('last_user', 'last_action_key', 'recipients')),
  0,
  'the dispatch health read returns counts and instants and nothing that identifies anybody'
);

select ok(
  predictor_internal.reminder_dispatch_status() ? 'unreported_over_ten_minutes',
  'and it surfaces the unreported runs, which is the number that distinguishes a sender that never answered from a sender with nothing to do'
);

select * from finish();
rollback;
