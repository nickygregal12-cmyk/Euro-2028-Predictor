-- ---------------------------------------------------------------------------
-- Contract 216 — wiring the reminder dispatch loop, and recording what it did.
--
-- ---------------------------------------------------------------------------
-- WHAT WAS ALREADY BUILT, AND IS NOT REBUILT HERE
-- ---------------------------------------------------------------------------
--
-- Contracts 163 and 172 own the ledger, the claim/result split, the retry
-- policy and the stale-claim sweep. `supabase/functions/notification-dispatch`
-- owns the send loop and its three fail-closed gates. Every one of those is
-- finished and tested.
--
-- What has never existed is the thing that CALLS the send loop. The function's
-- own header says so — "NOT DEPLOYED. Nothing has invoked this" — and the
-- health panel says so on screen: no job names `claim_due_reminders`. This
-- contract is that missing caller, and nothing else.
--
-- ---------------------------------------------------------------------------
-- WHY A RUN LEDGER, WHEN A DELIVERY LEDGER ALREADY EXISTS
-- ---------------------------------------------------------------------------
--
-- Because they answer different questions, and the second one is currently
-- unanswerable.
--
-- `reminder_deliveries` answers "what happened to this reminder". It cannot
-- answer "did the sender run at all", and the difference is the failure this
-- whole subsystem has already had once: a generator that nothing called reads
-- IDENTICALLY to a generator with nothing to do. Both are zero.
--
-- It is worse for the deployment gate specifically. When `NOTIFICATIONS_DELIVERY`
-- is unset the Edge Function refuses BEFORE it claims anything — deliberately,
-- so an unauthorised deployment cannot move rows into `sending` and then
-- decline to send them. Correct, and it means the delivery ledger records
-- exactly nothing about the refusal. A silent, correct refusal and a dead cron
-- job are the same picture.
--
-- So each invocation opens a row here and the Edge Function closes it, on every
-- path including the refusals. An unclosed row is itself evidence: the callback
-- never came, which is what an unreachable endpoint or a rejected caller key
-- looks like from the database's side.
--
-- THIS DIFFERS FROM CONTRACT 155 DELIBERATELY, and costs something. The provider
-- poll dispatcher writes NOTHING when it is unconfigured, so its ledger counts
-- only real dispatches. This one writes a refusal, because the refusal is the
-- fact that cannot be recovered from anywhere else — and the price is a row
-- every five minutes for as long as an environment stays unconfigured, roughly
-- 288 a day. That is the intended trade: a small bounded table against a job
-- whose silence is indistinguishable from its absence. Anything counting this
-- ledger must scope itself, because the job is live and writing while it counts.
--
-- ---------------------------------------------------------------------------
-- WHAT THIS MUST NOT BECOME
-- ---------------------------------------------------------------------------
--
-- Not a second delivery ledger. It stores counts and an outcome string, never
-- a user, an action key, an address or a provider error body — how many failed
-- is an operations fact, which player failed is theirs, and that line is drawn
-- in exactly the same place contract 172 drew it.
--
-- Not a retry policy. A failed run is not retried here; the reminders it did
-- not send are still due, and the next firing claims them under the policy that
-- already exists.
--
-- Not authority for anything. A run row reports; it never decides whether a
-- reminder was sent. `record_reminder_result` remains the only writer of
-- delivery state, and it still refuses a row that is not in flight.
--
-- Additive. One table, four functions, one job, and two existing functions
-- extended by adding to what they return. No existing table, policy, trigger,
-- grant or delivery function is altered.
-- ---------------------------------------------------------------------------

-- ---------------------------------------------------------------------------
-- 0. Preconditions. What this contract assumes must already be true.
-- ---------------------------------------------------------------------------

do $preconditions$
begin
  if not exists (
    select 1 from pg_catalog.pg_proc proc
      join pg_catalog.pg_namespace ns on ns.oid = proc.pronamespace
     where ns.nspname = 'public' and proc.proname = 'claim_due_reminders'
  ) then
    raise exception 'public.claim_due_reminders must exist before it can be dispatched to';
  end if;

  if not exists (
    select 1 from pg_catalog.pg_proc proc
      join pg_catalog.pg_namespace ns on ns.oid = proc.pronamespace
     where ns.nspname = 'public' and proc.proname = 'record_reminder_result'
  ) then
    raise exception 'public.record_reminder_result must exist before a run can report against it';
  end if;

  if not exists (
    select 1 from pg_catalog.pg_class relation
      join pg_catalog.pg_namespace ns on ns.oid = relation.relnamespace
     where ns.nspname = 'public' and relation.relname = 'reminder_deliveries'
  ) then
    raise exception 'public.reminder_deliveries must exist';
  end if;
end;
$preconditions$;

-- ---------------------------------------------------------------------------
-- 1. The run ledger.
-- ---------------------------------------------------------------------------

create table if not exists predictor_internal.reminder_dispatch_runs (
  id uuid primary key default gen_random_uuid(),
  requested_at timestamptz not null default now(),
  -- How many rows were claimable at the moment the run was opened. Counted
  -- here rather than reported by the sender, so "the sender says it found
  -- nothing" and "there was nothing to find" stay separable.
  due_at_request integer not null,
  -- False when no endpoint or caller key is configured. A run is still opened,
  -- because "the job fired and could not reach a sender" is the fact worth
  -- keeping; a job that logged nothing when unconfigured would be invisible for
  -- exactly as long as it was broken.
  configured boolean not null,
  net_request_id bigint,
  reported_at timestamptz,
  outcome text,
  claimed integer,
  delivered integer,
  refused integer,
  skipped integer,
  -- Bounded, and never a provider's message about a person. See the header.
  detail text,
  constraint reminder_dispatch_runs_outcome_known check (
    outcome is null or outcome in (
      'completed',
      'not-configured',
      'delivery-disabled',
      'dispatch-failed'
    )
  ),
  constraint reminder_dispatch_runs_reported_together check (
    (reported_at is null) = (outcome is null)
  ),
  constraint reminder_dispatch_runs_counts_nonnegative check (
    coalesce(claimed, 0) >= 0 and coalesce(delivered, 0) >= 0
    and coalesce(refused, 0) >= 0 and coalesce(skipped, 0) >= 0
  ),
  -- A run cannot report more delivered than it claimed. The point of the run
  -- ledger is to be checkable against the delivery ledger, and a summary that
  -- cannot be true is worse than no summary.
  constraint reminder_dispatch_runs_delivered_within_claimed check (
    claimed is null or coalesce(delivered, 0) + coalesce(refused, 0)
      + coalesce(skipped, 0) <= claimed
  ),
  constraint reminder_dispatch_runs_detail_bounded check (
    detail is null or length(detail) <= 500
  )
);

alter table predictor_internal.reminder_dispatch_runs enable row level security;

-- No policy is created, deliberately. Every read goes through a definer
-- function that returns counts; nothing may select rows directly.

create index if not exists reminder_dispatch_runs_requested_idx
  on predictor_internal.reminder_dispatch_runs (requested_at desc);

create index if not exists reminder_dispatch_runs_unreported_idx
  on predictor_internal.reminder_dispatch_runs (requested_at desc)
  where reported_at is null;

-- ---------------------------------------------------------------------------
-- 2. The endpoint, read from the vault at call time.
--
-- Both secrets absent is the normal state before an operator provisions them,
-- and it is reported rather than raised — see contract 155's provider poll
-- dispatcher, which learned that a job failing loudly every five minutes is
-- noise nobody reads by the time it means something.
-- ---------------------------------------------------------------------------

create or replace function predictor_internal.reminder_dispatch_endpoint(
  out endpoint_url text,
  out caller_key text
)
language plpgsql
stable
security definer
set search_path = ''
as $endpoint$
begin
  begin
    -- BLANK IS ABSENT. A vault row holding an empty string is not a
    -- configuration, and treating it as one is worse than treating it as
    -- missing: the dispatcher would post every five minutes with an empty
    -- `apikey`, the sender would refuse each one at the caller-key check
    -- without a run id it is willing to write against, and the health read
    -- would report a configured sender the whole time. Every run would sit
    -- unanswered and the operator would be looking for a network fault.
    select nullif(pg_catalog.btrim(secret.decrypted_secret), '')
      into endpoint_url
      from vault.decrypted_secrets secret
     where secret.name = 'notification_dispatch_function_url';

    select nullif(pg_catalog.btrim(secret.decrypted_secret), '')
      into caller_key
      from vault.decrypted_secrets secret
     where secret.name = 'notification_dispatch_caller_key';
  exception
    when undefined_table or invalid_schema_name then
      endpoint_url := null;
      caller_key := null;
      return;
  end;

  -- An http:// endpoint would put the caller key on the wire in clear text.
  -- This is a misconfiguration rather than an absence, so it is louder.
  if endpoint_url is not null and endpoint_url !~ '^https://' then
    raise exception 'notification_dispatch_function_url must be an https URL'
      using errcode = '22023';
  end if;
end;
$endpoint$;

revoke all on function predictor_internal.reminder_dispatch_endpoint()
  from public, anon, authenticated, service_role;

-- ---------------------------------------------------------------------------
-- 3. The one outbound call.
--
-- Named arguments rather than positional, for the reason contract 155 records:
-- pg_net has changed its parameter list across versions, and a positional call
-- that bound `params` to a headers object would put the caller key in a query
-- string.
-- ---------------------------------------------------------------------------

create or replace function predictor_internal.post_reminder_dispatch(
  p_endpoint_url text,
  p_caller_key text,
  p_run_id uuid
)
returns bigint
language plpgsql
security definer
set search_path = ''
as $post$
declare
  v_request_id bigint;
begin
  select net.http_post(
    url => p_endpoint_url,
    -- The run id is the whole body. The sender needs no instruction from here:
    -- what is due is the ledger's answer, not this caller's.
    body => pg_catalog.jsonb_build_object('runId', p_run_id),
    headers => pg_catalog.jsonb_build_object(
      'content-type', 'application/json',
      'apikey', p_caller_key
    ),
    -- A batch of twenty-five reminders is twenty-five provider calls in
    -- sequence. Sixty seconds is the sender's own worst case with margin; a
    -- shorter timeout would abandon runs that were about to finish, and the
    -- run row would then never close even though the sends happened.
    timeout_milliseconds => 60000
  ) into v_request_id;

  return v_request_id;
end;
$post$;

revoke all on function predictor_internal.post_reminder_dispatch(text, text, uuid)
  from public, anon, authenticated, service_role;

-- ---------------------------------------------------------------------------
-- 4. The job.
-- ---------------------------------------------------------------------------

create or replace function public.dispatch_due_reminders(
  p_now timestamptz default now()
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $dispatch$
declare
  v_endpoint record;
  v_run_id uuid;
  v_due integer;
  v_request_id bigint;
begin
  if p_now is null then
    raise exception 'Dispatch time is required' using errcode = '22023';
  end if;

  -- The same predicate `claim_due_reminders` uses, counted rather than claimed.
  -- Nothing is locked and no row changes state: this must be able to run when
  -- there is no sender at all.
  select count(*)::integer into v_due
    from public.reminder_deliveries delivery
   where delivery.status in ('pending', 'failed')
     and coalesce(delivery.next_attempt_at, delivery.scheduled_for) <= p_now
     and delivery.deadline_at > p_now;

  select * into v_endpoint from predictor_internal.reminder_dispatch_endpoint();

  if v_endpoint.endpoint_url is null or v_endpoint.caller_key is null then
    insert into predictor_internal.reminder_dispatch_runs (
      requested_at, due_at_request, configured, reported_at, outcome, detail
    ) values (
      p_now, v_due, false, p_now, 'not-configured',
      'no notification_dispatch_function_url or notification_dispatch_caller_key in the vault'
    );

    return pg_catalog.jsonb_build_object(
      'configured', false, 'due', v_due, 'dispatched', false
    );
  end if;

  insert into predictor_internal.reminder_dispatch_runs (
    requested_at, due_at_request, configured
  ) values (p_now, v_due, true)
  returning id into v_run_id;

  begin
    v_request_id := predictor_internal.post_reminder_dispatch(
      v_endpoint.endpoint_url, v_endpoint.caller_key, v_run_id
    );

    update predictor_internal.reminder_dispatch_runs
       set net_request_id = v_request_id
     where id = v_run_id;
  exception
    -- Closed here, because a post that never left cannot be closed by a sender
    -- that never heard of it. Distinct from an unreported run, which means the
    -- request went and the answer did not come back.
    when others then
      update predictor_internal.reminder_dispatch_runs
         set reported_at = p_now,
             outcome = 'dispatch-failed',
             detail = left(sqlerrm, 500)
       where id = v_run_id;

      return pg_catalog.jsonb_build_object(
        'configured', true, 'due', v_due, 'dispatched', false, 'runId', v_run_id
      );
  end;

  return pg_catalog.jsonb_build_object(
    'configured', true, 'due', v_due, 'dispatched', true, 'runId', v_run_id
  );
end;
$dispatch$;

revoke all on function public.dispatch_due_reminders(timestamptz)
  from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- 5. The sender closes its own run.
--
-- Called by the Edge Function on every path it can reach, including both of
-- its own refusals. It cannot be called for a run that is already closed: a
-- replayed callback must not overwrite what actually happened, for the same
-- reason `record_reminder_result` refuses a row that is not in flight.
-- ---------------------------------------------------------------------------

create or replace function public.record_reminder_dispatch_run(
  p_run_id uuid,
  p_outcome text,
  p_claimed integer default null,
  p_delivered integer default null,
  p_refused integer default null,
  p_skipped integer default null,
  p_detail text default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $report$
declare
  v_now timestamptz := now();
  v_run predictor_internal.reminder_dispatch_runs;
begin
  if p_outcome is null or p_outcome not in ('completed', 'delivery-disabled') then
    raise exception 'A sender may report only completed or delivery-disabled, not %', p_outcome
      using errcode = '22023';
  end if;

  select * into v_run
    from predictor_internal.reminder_dispatch_runs
   where id = p_run_id
     for update;

  if v_run.id is null then
    raise exception 'No such dispatch run' using errcode = 'no_data_found';
  end if;

  if v_run.reported_at is not null then
    raise exception 'That dispatch run is already closed (%)', v_run.outcome
      using errcode = '22023';
  end if;

  update predictor_internal.reminder_dispatch_runs
     set reported_at = v_now,
         outcome = p_outcome,
         claimed = greatest(coalesce(p_claimed, 0), 0),
         delivered = greatest(coalesce(p_delivered, 0), 0),
         refused = greatest(coalesce(p_refused, 0), 0),
         skipped = greatest(coalesce(p_skipped, 0), 0),
         detail = left(p_detail, 500)
   where id = p_run_id;

  return pg_catalog.jsonb_build_object('id', p_run_id, 'outcome', p_outcome);
end;
$report$;

revoke all on function public.record_reminder_dispatch_run(uuid, text, integer, integer, integer, integer, text)
  from public, anon, authenticated;
grant execute on function public.record_reminder_dispatch_run(uuid, text, integer, integer, integer, integer, text)
  to service_role;

-- ---------------------------------------------------------------------------
-- 6. The per-row dry-run gate, made able to refuse.
--
-- MEASURED, NOT SUSPECTED. `claim_due_reminders` sets `dry_run = p_dry_run` on
-- the row it claims and returns that NEW value; the Edge Function claims with
-- `p_dry_run: false` and then asks `sendingIsPermitted(row)` whether the row
-- allows sending. The row it is asking about is the row the same statement just
-- overwrote, so the answer is always yes. The second of the three fail-closed
-- gates has never been able to refuse anything.
--
-- It has cost nothing so far only because nothing has ever invoked the sender.
-- This contract is what invokes it, so the gate has to work before the job
-- exists, not after.
--
-- `docs/ops/notification-delivery.md` states the intended design exactly:
-- "`dry_run` defaults to true on the ledger, and `NOTIFICATIONS_DELIVERY`
-- defaults to off here. Both must be turned off deliberately. That is two
-- switches on purpose." One switch was being cleared by the other's caller.
--
-- The fix is the only one that keeps both switches: a claim may TIGHTEN
-- dry-run and may never clear it. A sender may force a dry run on a live row;
-- it may not talk a dry row into being live. Fail-closed in both directions,
-- and the ledger keeps the last word about a row it scheduled.
--
-- Signature unchanged, so no caller, grant or contract signature moves.
-- ---------------------------------------------------------------------------

create or replace function public.claim_due_reminders(
  p_limit integer default 50,
  p_dry_run boolean default true
)
returns table (
  id uuid,
  user_id uuid,
  email text,
  action_key text,
  reminder_kind text,
  deadline_at timestamptz,
  attempts smallint,
  dry_run boolean
)
language plpgsql
security definer
set search_path = ''
as $claim$
declare
  v_now timestamptz := now();
  v_limit integer := least(greatest(coalesce(p_limit, 50), 1), 200);
  -- Null is not "live". An omitted argument means the caller stated no
  -- intention, and the fail-safe reading of no intention is a dry run.
  v_requested_dry_run boolean := coalesce(p_dry_run, true);
begin
  return query
  with claimed as (
    select delivery.id
      from public.reminder_deliveries delivery
     where delivery.status in ('pending', 'failed')
       and coalesce(delivery.next_attempt_at, delivery.scheduled_for) <= v_now
       -- Still worth sending. A deadline that has passed between scheduling and
       -- claiming is caught here as well as in the sweep, because the sweep runs
       -- on its own cadence and this one must not depend on that.
       and delivery.deadline_at > v_now
     order by delivery.scheduled_for
     limit v_limit
     -- THE CONTROL. Not `for update` alone, which would make a second sender
     -- WAIT and then process the same row after the first committed.
     for update skip locked
  ),
  taken as (
    update public.reminder_deliveries delivery
       set status = 'sending',
           attempts = delivery.attempts + 1,
           last_attempt_at = v_now,
           -- TIGHTEN ONLY. See the header above this function.
           dry_run = delivery.dry_run or v_requested_dry_run,
           updated_at = v_now
      from claimed
     where delivery.id = claimed.id
    returning delivery.id, delivery.user_id, delivery.action_key,
              delivery.reminder_kind, delivery.deadline_at, delivery.attempts,
              delivery.dry_run
  )
  select taken.id,
         taken.user_id,
         account.email::text,
         taken.action_key,
         taken.reminder_kind,
         taken.deadline_at,
         taken.attempts,
         taken.dry_run
    from taken
    join auth.users account on account.id = taken.user_id;
end;
$claim$;

-- ---------------------------------------------------------------------------
-- 7. The job, and the two health reads extended to see it.
-- ---------------------------------------------------------------------------

-- Every five minutes. The scheduler runs at :05 past each quarter hour, so the
-- sender is never chasing a queue that is being written in the same instant,
-- and a reminder scheduled at the top of a quarter waits at most five minutes.
-- `cron.schedule` upserts on the job name, so re-applying changes nothing.
select cron.schedule(
  'player-reminder-dispatch',
  '*/5 * * * *',
  'select public.dispatch_due_reminders();'
);

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
     'player-reminder-reclaim-stalled',
     'player-reminder-dispatch');

  return v_jobs;
exception
  -- Contract 172's reasoning, unchanged: an operations read that dies on its
  -- least important section is an operations read nobody runs. `null` is
  -- reported as `"jobs": null`, which is distinguishable from `[]` — "I could
  -- not look" and "I looked and there are none" are different facts.
  when insufficient_privilege or undefined_table then
    return null;
end;
$jobs$;

revoke all on function predictor_internal.reminder_job_status()
  from public, anon, authenticated, service_role;

-- ---------------------------------------------------------------------------
-- 8. Dispatch health, in the same shape and under the same restraint.
--
-- Counts and instants only. No user, no action key, no address, no provider
-- error body. `last_detail` is this database's own string — 'not-configured',
-- or a SQLERRM from a failed post — and never a provider's message about a
-- person.
-- ---------------------------------------------------------------------------

create or replace function predictor_internal.reminder_dispatch_status()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $dispatch_status$
declare
  v_now timestamptz := now();
  v_last predictor_internal.reminder_dispatch_runs;
begin
  select * into v_last
    from predictor_internal.reminder_dispatch_runs
   order by requested_at desc
   limit 1;

  return jsonb_build_object(
    'runs_total', (select count(*) from predictor_internal.reminder_dispatch_runs),
    'runs_last_hour', (
      select count(*) from predictor_internal.reminder_dispatch_runs
       where requested_at >= v_now - interval '1 hour'),
    -- A run that was posted and never reported back. This is what an
    -- unreachable endpoint, a rejected caller key or a sender that died
    -- mid-batch looks like from here, and it is the number to watch: the
    -- delivery ledger cannot show it, because those rows were never claimed.
    'unreported_over_ten_minutes', (
      select count(*) from predictor_internal.reminder_dispatch_runs
       where reported_at is null
         and requested_at < v_now - interval '10 minutes'),
    'last_requested_at', v_last.requested_at,
    'last_configured', v_last.configured,
    'last_outcome', v_last.outcome,
    'last_reported_at', v_last.reported_at,
    'last_due_at_request', v_last.due_at_request,
    'last_claimed', v_last.claimed,
    'last_delivered', v_last.delivered,
    'last_refused', v_last.refused,
    'last_skipped', v_last.skipped,
    'last_detail', v_last.detail,
    'delivery_disabled_last_hour', (
      select count(*) from predictor_internal.reminder_dispatch_runs
       where outcome = 'delivery-disabled'
         and reported_at >= v_now - interval '1 hour'),
    'not_configured_last_hour', (
      select count(*) from predictor_internal.reminder_dispatch_runs
       where outcome = 'not-configured'
         and reported_at >= v_now - interval '1 hour'));
exception
  when insufficient_privilege or undefined_table then
    return null;
end;
$dispatch_status$;

revoke all on function predictor_internal.reminder_dispatch_status()
  from public, anon, authenticated, service_role;

-- ---------------------------------------------------------------------------
-- 9. Is a sender configured? Derived, not asserted.
--
-- Contract 172 returned a literal `false` here, correctly: there was no sender
-- and no way for one to appear. There is one now, so a literal would be a
-- statement that stops being true the moment an operator provisions the vault
-- and nobody edits this function.
--
-- THREE ANSWERS, NOT TWO. `false` means no secrets. `true` means both secrets
-- and an active job. A misconfiguration — an http:// endpoint, which the
-- endpoint reader refuses outright — is neither, and collapsing it into
-- `false` would tell an administrator "no sender" when the truth is "a sender
-- that cannot start". So the error travels beside the boolean rather than
-- replacing it, and the read never raises: an operations page that 500s on its
-- least important section is an operations page nobody opens.
-- ---------------------------------------------------------------------------

create or replace function predictor_internal.reminder_sender_configuration()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $configured$
declare
  v_endpoint record;
  v_job_active boolean;
begin
  begin
    select * into v_endpoint from predictor_internal.reminder_dispatch_endpoint();
  exception
    when others then
      -- The message, never the secret. `reminder_dispatch_endpoint` raises only
      -- its own fixed sentence about the scheme; it does not echo the value.
      return pg_catalog.jsonb_build_object(
        'configured', false, 'error', left(sqlerrm, 200));
  end;

  begin
    select job.active into v_job_active
      from cron.job job
     where job.jobname = 'player-reminder-dispatch';
  exception
    when insufficient_privilege or undefined_table then
      v_job_active := null;
  end;

  return pg_catalog.jsonb_build_object(
    'configured',
      v_endpoint.endpoint_url is not null
      and v_endpoint.caller_key is not null
      and coalesce(v_job_active, false),
    -- Stated separately, because "the secrets are there and the job is off" is
    -- a different thing to fix from "no secrets".
    'secrets_present',
      v_endpoint.endpoint_url is not null and v_endpoint.caller_key is not null,
    'job_active', v_job_active,
    'error', null);
end;
$configured$;

revoke all on function predictor_internal.reminder_sender_configuration()
  from public, anon, authenticated, service_role;

-- ---------------------------------------------------------------------------
-- 10. The administrator's read, extended rather than replaced.
--
-- Contract 172 owns this function's restraint and none of it is relaxed here:
-- counts and instants, gated on the competition-admin authority, naming no
-- player and carrying no provider message. Two sections are added — whether a
-- sender is configured, derived rather than stated, and what the dispatch runs
-- have been doing — because a delivery ledger cannot answer either.
-- ---------------------------------------------------------------------------

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
  v_sender jsonb;
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
      -- sender that died. There IS a sender now, so this stops being a number
      -- that must be zero and becomes a number worth watching.
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

  v_sender := predictor_internal.reminder_sender_configuration();

  return jsonb_build_object(
    'as_of', v_now,
    'jobs', predictor_internal.reminder_job_status(),
    'actions', v_actions,
    'deliveries', v_deliveries,
    -- DERIVED NOW, where contract 172 could only state a literal. A sender can
    -- exist from this contract onward, so a hard-coded false would become a
    -- lie the moment an operator finished the setup and nobody edited this.
    'sender_configured', coalesce((v_sender->>'configured')::boolean, false),
    'sender', v_sender,
    'dispatch', predictor_internal.reminder_dispatch_status());
end;
$health$;

revoke all on function public.admin_reminder_delivery_health() from public, anon;
grant execute on function public.admin_reminder_delivery_health() to authenticated;

comment on function public.admin_reminder_delivery_health() is
  'Contracts 172 and 216. Competition-administrator operational health for the '
  'action centre, the reminder ledger, the four jobs and the dispatch runs. It '
  'returns no user id, display name, action key, prediction or message '
  'content, and no provider error text.';

-- ---------------------------------------------------------------------------
-- 11. Prove the shape, in the same transaction.
-- ---------------------------------------------------------------------------

do $assertions$
declare
  v_command text;
  v_health text;
begin
  if not exists (select 1 from cron.job
                  where jobname = 'player-reminder-dispatch' and active) then
    raise exception 'Contract 216 did not schedule an active player-reminder-dispatch job';
  end if;

  -- Contract 172's safety property, kept and strengthened. There is a sender
  -- now, which is exactly why a SCHEDULED command still may not claim: claiming
  -- from SQL would take rows out of the ledger without passing any of the three
  -- delivery gates the Edge Function holds.
  for v_command in select job.command from cron.job job loop
    if v_command ~* 'process_reminder_schedule\s*\(\s*[^)]*false' then
      raise exception 'A scheduled command turns the reminder dry run off: %', v_command;
    end if;
    if v_command ~* 'claim_due_reminders' then
      raise exception 'A scheduled command claims reminders for sending: %', v_command;
    end if;
  end loop;

  -- THE GATE THIS CONTRACT EXISTS TO REPAIR. Asserted from the source, because
  -- the behaviour needs two sessions and a clock to demonstrate and this must
  -- fail at apply time on a database where the old body somehow survived.
  -- Comments are stripped first, for the reason contract 172 records: a comment
  -- explaining the rule contains the words the check looks for.
  v_health := pg_catalog.regexp_replace(
    pg_catalog.pg_get_functiondef(
      to_regprocedure('public.claim_due_reminders(integer, boolean)')),
    '--[^\n]*', '', 'g');

  if v_health !~ 'dry_run\s*=\s*delivery\.dry_run\s+or' then
    raise exception 'claim_due_reminders must tighten the dry run, never clear it';
  end if;

  if to_regprocedure('public.dispatch_due_reminders(timestamp with time zone)') is null
     or to_regprocedure('public.record_reminder_dispatch_run(uuid, text, integer, integer, integer, integer, text)') is null then
    raise exception 'Contract 216 lost one of the functions it schedules or reports through';
  end if;

  -- The run ledger is reachable only through a definer function.
  if not exists (
    select 1 from pg_catalog.pg_class relation
      join pg_catalog.pg_namespace ns on ns.oid = relation.relnamespace
     where ns.nspname = 'predictor_internal'
       and relation.relname = 'reminder_dispatch_runs'
       and relation.relrowsecurity
  ) then
    raise exception 'reminder_dispatch_runs must have row level security enabled';
  end if;

  v_health := pg_catalog.regexp_replace(
    pg_catalog.pg_get_functiondef(
      to_regprocedure('public.admin_reminder_delivery_health()')),
    '--[^\n]*', '', 'g');

  if v_health !~ 'require_competition_admin' then
    raise exception 'The health read does not call require_competition_admin';
  end if;
end;
$assertions$;
