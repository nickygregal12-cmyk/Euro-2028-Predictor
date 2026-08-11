-- Contract 172 — the action centre and the reminder ledger acquire a caller.
--
-- ---------------------------------------------------------------------------
-- WHAT WAS MEASURED
-- ---------------------------------------------------------------------------
--
-- Contract 162 built the action inbox, contract 163 built the reminder ledger
-- and contract 170 gave the inbox its second generator. All three end with the
-- same sentence, written honestly by their own authors: `process_player_action
-- _items` is `service_role`-only and **is not scheduled by any migration**.
--
-- Measured on hosted Development at contract 171, and against every migration
-- in this repository, the Edge Function bundle and `src/`:
--
--   * `cron.job` holds seven jobs. Not one of them names an action item or a
--     reminder. They are the two entry submitters, the LMS settlement, the
--     matchweek scoring, the LMS restart, the provider poll and its consumer;
--   * `public.player_action_items` holds ZERO rows and `public.reminder_
--     deliveries` holds ZERO rows, on a project with published competitions,
--     joined entrants and derived matchweek locks;
--   * no function anywhere calls `process_player_action_items`,
--     `process_reminder_schedule` or `reclaim_stalled_reminders`. They are
--     reachable only by `service_role`, and nothing holding `service_role`
--     calls them.
--
-- So the inbox is permanently empty and the ledger is permanently empty. That
-- is the SAME defect shape as contracts 116, 118, 120, 122, 124, 128, 129 and
-- 161 to 165 — an authority built correctly with nothing able to drive it —
-- and it is the shape this repository has now paid for eleven times. The
-- difference here is that the missing caller is not a browser read but a job.
--
-- ---------------------------------------------------------------------------
-- IT SCHEDULES. IT DOES NOT SEND.
-- ---------------------------------------------------------------------------
--
-- This is the boundary that matters, and it is held by construction rather
-- than by intention:
--
--   * `process_reminder_schedule(p_lead, p_dry_run)` defaults `p_dry_run` to
--     TRUE. The job below calls it with NO ARGUMENTS, so every row it writes
--     carries `dry_run = true`. A source assertion at the foot of this
--     migration fails if any scheduled command ever passes `false`;
--   * `claim_due_reminders` is what a sender calls, and **this migration does
--     not schedule it and does not call it**. There is still no sender, no
--     provider and no credential — `SITE-007` blocks the transactional sender
--     on the brand decision, and choosing one here would pre-empt an open
--     owner decision exactly as contract 163 refused to;
--   * therefore nothing is delivered to anybody. What changes is that the
--     ledger fills with the rows a sender WOULD have taken, which is the only
--     way the preference enforcement, the deduplication and the deadline-safe
--     scheduling can be observed working before a provider exists.
--
-- ---------------------------------------------------------------------------
-- CADENCE, AND WHY THE TWO JOBS ARE OFFSET
-- ---------------------------------------------------------------------------
--
--   generation   */15   — 0, 15, 30, 45
--   scheduling   5-59/15 — 5, 20, 35, 50
--   reclamation  45 * * * * — hourly
--
-- The scheduler runs five minutes AFTER the generator, so an action generated
-- at :00 is considered for a reminder at :05 rather than waiting a full cycle.
-- The same reasoning contract 135's consumer used when it took `2-59/5`
-- against the poll's `*/5`: a producer and its consumer on the identical grid
-- compete for one instant and the consumer always reads the previous run's
-- work.
--
-- Fifteen minutes rather than one. A matchweek lock moves on the scale of
-- days, and the reminder lead is twenty-four hours, so a quarter-hour of
-- latency is invisible to a player. It is also the cheapest cadence that still
-- closes an item promptly when contract 117 reschedules a fixture and drags a
-- lock EARLIER — the case contract 170's sweep exists for.
--
-- Reclamation is hourly because it only has work when a sender has crashed
-- mid-flight, and there is no sender.
--
-- ---------------------------------------------------------------------------
-- THE HEALTH READ
-- ---------------------------------------------------------------------------
--
-- A job nobody can see is the failure this contract is fixing, one level up.
-- So it also adds `admin_reminder_delivery_health`, which reports COUNTS and
-- INSTANTS and nothing else: no user id, no display name, no action key, no
-- prediction, no email address and no message body. A reminder is about a
-- named player's outstanding pick, so a health read that named rows would be a
-- disclosure surface wearing an operations badge.
--
-- It reuses `require_competition_admin()` rather than inventing a platform-ops
-- gate. That gate already admits `super_admin` and a delegated `competitions`
-- capability, and a new capability with one member is a rule invented by a
-- migration.
--
-- It reports the JOBS as well as the rows, because "no reminders scheduled"
-- and "the scheduler is not running" look identical from the ledger alone —
-- which is precisely how the state this contract fixes survived three
-- contracts. `cron.job` is read defensively: if the definer cannot see it the
-- read says `unknown` rather than raising, because an operations read that
-- fails closed on its least important section is an operations read nobody
-- runs.
--
-- ---------------------------------------------------------------------------
-- WHAT IT DOES NOT DO
-- ---------------------------------------------------------------------------
--
-- It creates no table, adds no column, changes no generator, moves no lock,
-- deadline, scoring, settlement, progression or reveal rule, and grants no new
-- write to any browser role. `process_player_action_items`,
-- `process_reminder_schedule`, `claim_due_reminders`, `record_reminder_result`
-- and `reclaim_stalled_reminders` are untouched: this migration defines none
-- of them and a source assertion below fails if that stops being true.

begin;

-- ---------------------------------------------------------------------------
-- 0. Refuse to schedule a job whose target does not exist.
--
-- Scheduling a command that raises is worse than not scheduling it: pg_cron
-- runs it every quarter of an hour for ever and reports the failure only in
-- `cron.job_run_details`, which nothing in this repository reads.
-- ---------------------------------------------------------------------------

do $preconditions$
declare
  v_missing text;
begin
  foreach v_missing in array array[
    'process_player_action_items',
    'process_reminder_schedule',
    'reclaim_stalled_reminders'
  ] loop
    if not exists (
      select 1
        from pg_catalog.pg_proc proc
        join pg_catalog.pg_namespace space on space.oid = proc.pronamespace
       where space.nspname = 'public'
         and proc.proname = v_missing
    ) then
      raise exception 'Contract 172 cannot schedule public.%: it does not exist', v_missing;
    end if;
  end loop;

  -- The dry-run default is the whole safety property of the reminder job, and
  -- it lives in another migration. Prove it here rather than trusting it.
  if not exists (
    select 1
      from pg_catalog.pg_proc proc
      join pg_catalog.pg_namespace space on space.oid = proc.pronamespace
     where space.nspname = 'public'
       and proc.proname = 'process_reminder_schedule'
       and pg_catalog.pg_get_function_arguments(proc.oid)
             like '%p_dry_run boolean DEFAULT true%'
  ) then
    raise exception
      'process_reminder_schedule no longer defaults p_dry_run to true; '
      'contract 172 will not schedule it';
  end if;
end;
$preconditions$;

-- ---------------------------------------------------------------------------
-- 1. The three jobs.
--
-- `cron.schedule` upserts on the job name, so re-applying this migration
-- against a database that already holds them changes nothing.
-- ---------------------------------------------------------------------------

select cron.schedule(
  'player-action-centre-generate',
  '*/15 * * * *',
  'select public.process_player_action_items();'
);

-- NO ARGUMENTS. The defaults are the contract: a twenty-four hour lead, and
-- `dry_run = true`. Passing them explicitly would put the safety property in
-- a string that a later edit could change without changing a function.
select cron.schedule(
  'player-reminder-schedule',
  '5-59/15 * * * *',
  'select public.process_reminder_schedule();'
);

select cron.schedule(
  'player-reminder-reclaim-stalled',
  '45 * * * *',
  'select public.reclaim_stalled_reminders();'
);

-- ---------------------------------------------------------------------------
-- 2. The health read.
--
-- Counts and instants. Deliberately no identity of any kind.
-- ---------------------------------------------------------------------------

create or replace function predictor_internal.reminder_job_status()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $jobs$
declare
  v_jobs jsonb;
begin
  select coalesce(jsonb_agg(jsonb_build_object(
           'jobname', job.jobname,
           'schedule', job.schedule,
           'active', job.active)
         order by job.jobname), '[]'::jsonb)
    into v_jobs
    from cron.job job
   where job.jobname in (
     'player-action-centre-generate',
     'player-reminder-schedule',
     'player-reminder-reclaim-stalled');

  return v_jobs;
exception
  -- See the header: an operations read that dies on its least important
  -- section is an operations read nobody runs. `null` here is reported to the
  -- caller as `"jobs": null`, which is distinguishable from `[]` — "I could
  -- not look" and "I looked and there are none" are different facts.
  when insufficient_privilege or undefined_table then
    return null;
end;
$jobs$;

revoke all on function predictor_internal.reminder_job_status()
  from public, anon, authenticated, service_role;

create or replace function public.admin_reminder_delivery_health()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $health$
declare
  v_now timestamptz := now();
  v_deliveries jsonb;
  v_actions jsonb;
begin
  perform predictor_internal.require_competition_admin();

  select jsonb_build_object(
      'total', count(*),
      'by_status', coalesce((
        select jsonb_object_agg(grouped.status, grouped.rows)
          from (select delivery.status, count(*) as rows
                  from public.reminder_deliveries delivery
                 group by delivery.status) grouped), '{}'::jsonb),
      -- Live rows only. A ledger that is 100% dry-run reads the same whether
      -- nothing has been sent or everything already finished, so this counts
      -- what is still ahead rather than the whole history.
      'pending_live', count(*) filter (where delivery.status = 'pending' and not delivery.dry_run),
      'pending_dry_run', count(*) filter (where delivery.status = 'pending' and delivery.dry_run),
      'due_now', count(*) filter (
        where delivery.status = 'pending' and delivery.next_attempt_at <= v_now),
      'in_flight', count(*) filter (where delivery.status = 'sending'),
      -- Stall evidence. A row in `sending` with no attempt for an hour is a
      -- sender that died; with no sender at all this must stay zero, and a
      -- non-zero value here is the first thing worth knowing.
      'stalled_over_an_hour', count(*) filter (
        where delivery.status = 'sending'
          and coalesce(delivery.last_attempt_at, delivery.updated_at) < v_now - interval '1 hour'),
      'oldest_pending_scheduled_for', min(delivery.scheduled_for) filter (
        where delivery.status = 'pending'),
      'last_updated_at', max(delivery.updated_at),
      -- `last_error` is a PROVIDER's message about a delivery. It is not shown
      -- here, and neither is the address it failed to reach: how many failed is
      -- an operations fact, which one failed is a player's.
      'terminal_failures', count(*) filter (where delivery.status = 'abandoned'),
      'withdrawn', count(*) filter (where delivery.status = 'skipped'),
      'max_attempts_seen', coalesce(max(delivery.attempts), 0))
    into v_deliveries
    from public.reminder_deliveries delivery;

  select jsonb_build_object(
      'total', count(*),
      'open', count(*) filter (
        where item.completed_at is null and item.invalidated_at is null),
      'completed', count(*) filter (where item.completed_at is not null),
      'invalidated', count(*) filter (where item.invalidated_at is not null),
      'by_type', coalesce((
        select jsonb_object_agg(grouped.action_type, grouped.rows)
          from (select typed.action_type, count(*) as rows
                  from public.player_action_items typed
                 where typed.completed_at is null and typed.invalidated_at is null
                 group by typed.action_type) grouped), '{}'::jsonb),
      'last_generated_at', max(item.generated_at),
      -- An action open past its own deadline is the sweep failing to close it,
      -- which is what `211_action_centre.sql` was written to catch. Zero is the
      -- only correct value once the generator has run.
      'open_past_deadline', count(*) filter (
        where item.completed_at is null
          and item.invalidated_at is null
          and item.deadline_at is not null
          and item.deadline_at <= v_now))
    into v_actions
    from public.player_action_items item;

  return jsonb_build_object(
    'as_of', v_now,
    'jobs', predictor_internal.reminder_job_status(),
    'actions', v_actions,
    'deliveries', v_deliveries,
    -- Stated rather than inferred from `pending_live` being zero, because
    -- "nothing is live" and "nothing has been scheduled yet" are the same
    -- number and only one of them is a sender being absent.
    'sender_configured', false);
end;
$health$;

revoke all on function public.admin_reminder_delivery_health() from public, anon;
grant execute on function public.admin_reminder_delivery_health() to authenticated;

comment on function public.admin_reminder_delivery_health() is
  'Contract 172. Competition-administrator operational health for the action '
  'centre and the reminder ledger: counts, instants and the three jobs. It '
  'returns no user id, display name, action key, prediction or message '
  'content, and no provider error text.';

-- ---------------------------------------------------------------------------
-- 3. Prove the shape, in the same transaction.
-- ---------------------------------------------------------------------------

do $assertions$
declare
  v_command text;
  v_health text;
begin
  -- Every job this contract owns exists and is active.
  foreach v_command in array array[
    'player-action-centre-generate',
    'player-reminder-schedule',
    'player-reminder-reclaim-stalled'
  ] loop
    if not exists (select 1 from cron.job job
                    where job.jobname = v_command and job.active) then
      raise exception 'Contract 172 did not schedule an active job named %', v_command;
    end if;
  end loop;

  -- THE SAFETY PROPERTY. No scheduled command may turn the dry run off, and no
  -- scheduled command may claim a batch — claiming is what a sender does, and
  -- there is no sender.
  for v_command in select job.command from cron.job job loop
    if v_command ~* 'process_reminder_schedule\s*\(\s*[^)]*false' then
      raise exception 'A scheduled command turns the reminder dry run off: %', v_command;
    end if;
    if v_command ~* 'claim_due_reminders' then
      raise exception 'A scheduled command claims reminders for sending: %', v_command;
    end if;
  end loop;

  -- This migration schedules callers. It does not redefine the things it calls.
  if to_regprocedure('public.process_player_action_items()') is null
     or to_regprocedure('public.process_reminder_schedule(interval, boolean)') is null
     or to_regprocedure('public.reclaim_stalled_reminders(interval)') is null then
    raise exception 'Contract 172 lost one of the functions it schedules';
  end if;

  -- The health read is gated, and gated on the competition-admin authority
  -- rather than on a role name.
  v_health := pg_catalog.pg_get_functiondef(
    to_regprocedure('public.admin_reminder_delivery_health()'));

  if v_health !~ 'require_competition_admin' then
    raise exception 'The health read does not call require_competition_admin';
  end if;

  -- Nothing that identifies a player leaves it.
  if v_health ~ '\muser_id\M' or v_health ~ 'display_name'
     or v_health ~ '\maction_key\M' or v_health ~ 'last_error' then
    raise exception 'The health read names a per-player column';
  end if;

  -- Read from `proacl` rather than `information_schema`: the information schema
  -- shows a grantee only where the CURRENT role can see it, so a missing row
  -- there is not evidence of a missing grant. `aclexplode` is the fact.
  if exists (
    select 1
      from pg_catalog.pg_proc proc
      cross join pg_catalog.aclexplode(proc.proacl) entry
      left join pg_catalog.pg_roles grantee on grantee.oid = entry.grantee
     where proc.oid = to_regprocedure('public.admin_reminder_delivery_health()')
       and coalesce(grantee.rolname, 'PUBLIC') in ('anon', 'PUBLIC')
  ) then
    raise exception 'The health read is reachable anonymously';
  end if;
end;
$assertions$;

commit;
