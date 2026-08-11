-- Contract 163: the provider-neutral reminder delivery ledger.
--
-- THE ASSERTIONS THIS FILE EXISTS FOR are the three that would each produce a
-- real, visible failure and that a happy-path test would not reach:
--
--   * a player who turned reminders OFF is never queued. That preference has
--     existed since contract 30-something and nothing read it, so a player who
--     opted out had been told a falsehood about what the platform does;
--   * a claimed row cannot be claimed again. `for update` alone would make a
--     second sender WAIT and then send the same reminder, which is the
--     duplicate a player actually notices;
--   * a sender that dies leaves a row reclaimable. `sending` is the one state
--     that cannot recover on its own — invisible to the claim, never retried,
--     never abandoned.

begin;

select plan(18);

set local session_replication_role = replica;
insert into auth.users (id, email, aud, role, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
values (md5('rd-on')::uuid, 'rd-on@example.test', 'authenticated', 'authenticated',
        '{}'::jsonb, '{}'::jsonb, now(), now()),
       (md5('rd-off')::uuid, 'rd-off@example.test', 'authenticated', 'authenticated',
        '{}'::jsonb, '{}'::jsonb, now(), now());
set local session_replication_role = origin;

insert into public.profiles (id, display_name, welcomed_at, reminder_emails) values
  (md5('rd-on')::uuid, 'Wants Reminders', now(), true),
  (md5('rd-off')::uuid, 'Opted Out', now(), false);

insert into public.tournaments (name, year, competition_id, season_key, kind, display_timezone, status)
select 'C163 Reminders', 2048, t.competition_id, 'reminders', 'league_season',
       'Europe/London', 'active'
  from public.tournaments t where t.kind = 'league_season' order by t.name limit 1;

select set_config('test.rd_season',
  (select id::text from public.tournaments where season_key = 'reminders'), true);

insert into public.bonus_competitions (
  id, tournament_id, game_key, published, availability_status,
  draw_required, visibility_kind, registration_opens_at)
values (md5('rd-lms')::uuid, current_setting('test.rd_season')::uuid,
        'last_man_standing', true, 'active', false, 'public', now() - interval '10 days');

-- One open action each, thirty hours from its deadline.
insert into public.player_action_items (
  user_id, action_key, action_type, priority, tournament_id, competition_id,
  deadline_at, expires_at)
values
  (md5('rd-on')::uuid, 'lms_pick_due:reminders:one', 'lms_pick_due', 1,
   current_setting('test.rd_season')::uuid, md5('rd-lms')::uuid,
   now() + interval '30 hours', now() + interval '30 hours'),
  (md5('rd-off')::uuid, 'lms_pick_due:reminders:one', 'lms_pick_due', 1,
   current_setting('test.rd_season')::uuid, md5('rd-lms')::uuid,
   now() + interval '30 hours', now() + interval '30 hours');

-- ---------------------------------------------------------------------------
-- THE PREFERENCE, WHICH IS WHAT THIS CONTRACT EXISTS FOR
-- ---------------------------------------------------------------------------

select is(
  (public.process_reminder_schedule(interval '24 hours', true) ->> 'scheduled')::integer, 1,
  'exactly one of two identical actions is queued');

select is(
  (select user_id from public.reminder_deliveries
    where action_key = 'lms_pick_due:reminders:one'),
  md5('rd-on')::uuid,
  'AND IT IS THE PLAYER WHO WANTS THEM — the opted-out player has no row at all');

select ok(
  (select scheduled_for < deadline_at from public.reminder_deliveries
    where action_key = 'lms_pick_due:reminders:one'),
  'the queued reminder is deadline-safe, which the schema enforces as well as the scheduler');

select ok(
  (select dry_run from public.reminder_deliveries
    where action_key = 'lms_pick_due:reminders:one'),
  'and it is a dry run, because that is the default at every level');

-- ---------------------------------------------------------------------------
-- DEDUPLICATION
-- ---------------------------------------------------------------------------

select is(
  (public.process_reminder_schedule(interval '24 hours', true) ->> 'scheduled')::integer, 0,
  'scheduling twice adds nothing, because the unique key is the action itself');

select is(
  (select count(*)::integer from public.reminder_deliveries
    where action_key = 'lms_pick_due:reminders:one'),
  1,
  'and one row remains rather than two');

-- ---------------------------------------------------------------------------
-- CLAIMING
-- ---------------------------------------------------------------------------

select is(
  (select count(*)::integer from public.claim_due_reminders(50, true)),
  0,
  'a reminder scheduled 24 hours before a 30-hour deadline is not yet due');

update public.reminder_deliveries
   set scheduled_for = now() - interval '1 minute',
       next_attempt_at = now() - interval '1 minute'
 where action_key = 'lms_pick_due:reminders:one';

select is(
  (select email from public.claim_due_reminders(50, true)),
  'rd-on@example.test',
  'when due it is claimed, and the address is read from auth.users rather than stored');

-- THE SECOND ASSERTION THIS FILE EXISTS FOR.
select is(
  (select count(*)::integer from public.claim_due_reminders(50, true)),
  0,
  'A CLAIMED ROW CANNOT BE CLAIMED AGAIN — the control that makes overlapping schedules safe');

select is(
  (select status from public.reminder_deliveries where action_key = 'lms_pick_due:reminders:one'),
  'sending',
  'it sits in flight rather than staying pending');

-- ---------------------------------------------------------------------------
-- THE RETRY POLICY
-- ---------------------------------------------------------------------------

select is(
  public.record_reminder_result(
    (select id from public.reminder_deliveries where action_key = 'lms_pick_due:reminders:one'),
    false, null, null, 'pgTAP: simulated provider timeout') ->> 'status',
  'failed',
  'a failure is recorded as failed rather than lost');

select ok(
  (select next_attempt_at > now() from public.reminder_deliveries
    where action_key = 'lms_pick_due:reminders:one'),
  'and a backoff is set, so the next attempt is later rather than immediate');

select is(
  (select last_error from public.reminder_deliveries where action_key = 'lms_pick_due:reminders:one'),
  'pgTAP: simulated provider timeout',
  'the error is retained for observability');

-- Drive it to terminal. Four more failures take attempts from 1 to 5, and the
-- fifth is terminal — measured against the implementation rather than asserted
-- from the comment.
do $$
declare
  v_id uuid := (select id from public.reminder_deliveries
                 where action_key = 'lms_pick_due:reminders:one');
begin
  for i in 1..4 loop
    update public.reminder_deliveries set next_attempt_at = now() - interval '1 second'
     where id = v_id;
    perform public.claim_due_reminders(50, true);
    perform public.record_reminder_result(v_id, false, null, null, 'pgTAP: failure ' || i);
  end loop;
end;
$$;

select is(
  (select status from public.reminder_deliveries where action_key = 'lms_pick_due:reminders:one'),
  'abandoned',
  'the fifth failure is terminal, so a broken queue stops rather than retrying for ever');

select is(
  (select next_attempt_at from public.reminder_deliveries
    where action_key = 'lms_pick_due:reminders:one'),
  null,
  'and an abandoned row is scheduled for nothing');

-- Replay protection: a terminal row is not in flight and refuses a result.
select throws_ok(
  format($$select public.record_reminder_result(%L::uuid, true, 'provider', 'msg', null)$$,
         (select id from public.reminder_deliveries where action_key = 'lms_pick_due:reminders:one')),
  '22023', null,
  'a row that is not in flight refuses a result, so a replayed batch cannot resurrect it');

-- ---------------------------------------------------------------------------
-- THE THIRD ASSERTION: a sender that dies
-- ---------------------------------------------------------------------------

update public.reminder_deliveries
   set status = 'sending', attempts = 1, last_attempt_at = now() - interval '1 hour'
 where action_key = 'lms_pick_due:reminders:one';

select is(
  (public.reclaim_stalled_reminders(interval '15 minutes') ->> 'reclaimed')::integer, 1,
  'A STALLED SENDER IS RECLAIMED — the one state that cannot recover on its own');

-- ---------------------------------------------------------------------------
-- WITHDRAWAL: doing the thing beats being reminded about it
-- ---------------------------------------------------------------------------

update public.reminder_deliveries set status = 'pending'
 where action_key = 'lms_pick_due:reminders:one';
update public.player_action_items set completed_at = now()
 where user_id = md5('rd-on')::uuid and action_key = 'lms_pick_due:reminders:one';

select public.process_reminder_schedule(interval '24 hours', true);

select is(
  (select status from public.reminder_deliveries
    where action_key = 'lms_pick_due:reminders:one'),
  'skipped',
  'a completed action withdraws its reminder rather than sending it');

select * from finish();

rollback;
