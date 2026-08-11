-- ---------------------------------------------------------------------------
-- Contract 163 — DFA-012: making the reminder preference mean something.
--
-- ---------------------------------------------------------------------------
-- WHAT WAS MEASURED
-- ---------------------------------------------------------------------------
--
-- `public.profiles.reminder_emails` has existed since
-- `20260729070000_account_entry_controls.sql`, which introduces it as "the
-- deadline-reminder opt-out that must exist". It defaults to true, every
-- account carries it, and the settings surface lets a player change it.
--
-- Measured against every migration and the one Edge Function: **nothing reads
-- it.** No job, no function, no bundle. There is no delivery path of any kind,
-- so the control is a switch wired to nothing — a player who turned reminders
-- OFF and a player who left them ON receive exactly the same nothing, and a
-- player who turned them off has been told a falsehood about what the platform
-- does with their data.
--
-- ---------------------------------------------------------------------------
-- PROVIDER-NEUTRAL, DELIBERATELY AND COMPLETELY
-- ---------------------------------------------------------------------------
--
-- The task authorising this work is explicit: do not select an external email
-- provider and do not perform a production send unless current repository
-- decisions and credentials authorise it, and completing the provider-neutral
-- delivery contract first is acceptable. No such decision exists in this
-- repository — `SITE-007` records that the transactional sender is *blocked on
-- the brand decision*, so choosing one here would pre-empt an open owner
-- decision.
--
-- So this contract builds the LEDGER and the STATE MACHINE and stops there:
--
--   * it names no provider, holds no credential and makes no outbound call.
--     `provider` is a nullable free-text column a sender fills in;
--   * `claim_due_reminders` hands a batch to whatever sender exists and marks
--     it in flight; `record_reminder_result` takes the answer back. Between
--     those two calls is where a provider goes, and there is nothing there yet;
--   * **`dry_run` defaults to TRUE at every level.** A sender that is wired up
--     but not yet authorised runs the whole machine and sends nothing, and
--     making it live is an explicit argument rather than an omission.
--
-- ---------------------------------------------------------------------------
-- WHAT STOPS A DUPLICATE SEND, WHICH IS THE WHOLE PROBLEM
-- ---------------------------------------------------------------------------
--
-- Three independent controls, because a reminder sent twice is the failure a
-- player actually notices:
--
--   1. **The unique key `(user_id, action_key, reminder_kind)`.** A reminder is
--      about a THING — contract 162's stable action key — so a second
--      scheduling pass for the same deadline collides with the row that already
--      exists rather than adding one. Scheduling is `on conflict do nothing`.
--   2. **`for update skip locked` in the claim.** Two overlapping schedules,
--      or one job started twice, cannot claim the same row: the second sees it
--      locked and skips it rather than waiting and then sending it again.
--   3. **The claim is a state transition, not a read.** A row leaves `pending`
--      the moment it is claimed, so even a sender that crashes after sending
--      cannot have the row re-offered as `pending` — it sits in `sending` until
--      a result arrives or the stale sweep reclaims it, and the sweep counts
--      an attempt so it cannot loop for ever.
--
-- ---------------------------------------------------------------------------
-- WHAT IS DELIBERATELY NOT STORED
-- ---------------------------------------------------------------------------
--
-- No subject, no body, no rendered content, and **no email address** — the
-- address lives in `auth.users` and is read by the sender at send time, so this
-- ledger never becomes a second copy of everyone's contact details. What it
-- keeps is what observability actually needs: which player, which action, when
-- it was scheduled, how many attempts, when the last one was, and a bounded
-- error string. A ledger that stored the message would be a mailbox.
--
-- Additive: one table, one enum-free status vocabulary in a CHECK, four
-- functions. No existing relation, policy, trigger, grant or function is
-- altered, and `profiles` is read and never written.
-- ---------------------------------------------------------------------------

create table if not exists public.reminder_deliveries (
  id uuid primary key default gen_random_uuid(),

  user_id uuid not null references auth.users(id) on delete cascade,

  -- Contract 162's stable identity. A reminder is about an action, and reusing
  -- that key is what makes "have we already reminded them about this" a unique
  -- constraint rather than a judgement.
  action_key text not null,

  reminder_kind text not null default 'deadline',

  -- The deadline the reminder is about, copied from the action item at
  -- scheduling time so the ledger can be reasoned about without re-joining, and
  -- so a rescheduled fixture cannot silently change what a sent reminder said.
  deadline_at timestamptz not null,

  -- When it becomes eligible to send. DEADLINE-SAFE: the scheduler never writes
  -- a row whose `scheduled_for` is at or after `deadline_at`, so a reminder that
  -- could only arrive too late is never created at all rather than created and
  -- then suppressed.
  scheduled_for timestamptz not null,

  status text not null default 'pending',

  attempts smallint not null default 0,
  last_attempt_at timestamptz,
  next_attempt_at timestamptz,

  -- Bounded, and an error rather than a message. Never content.
  last_error text,

  -- Filled in by whatever sender exists. Null here is the honest state of this
  -- repository: no provider has been chosen.
  provider text,
  provider_message_id text,

  -- TRUE means the machine ran and nothing left the building. Defaulting to
  -- true is the fail-safe direction: a misconfigured job sends nothing.
  dry_run boolean not null default true,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  -- THE DEDUPLICATION KEY. One reminder per player per action per kind, ever.
  constraint reminder_deliveries_once_per_action
    unique (user_id, action_key, reminder_kind),

  constraint reminder_deliveries_status_allowed
    check (status in ('pending', 'sending', 'sent', 'failed', 'abandoned', 'skipped')),

  constraint reminder_deliveries_kind_allowed
    check (reminder_kind in ('deadline', 'final_call')),

  constraint reminder_deliveries_attempts_sane
    check (attempts >= 0 and attempts <= 10),

  constraint reminder_deliveries_error_bounded
    check (last_error is null or char_length(last_error) <= 500),

  -- Deadline-safe, enforced by the schema and not only by the scheduler that
  -- writes it. A row that could only arrive after the thing it reminds about
  -- cannot exist.
  constraint reminder_deliveries_before_deadline
    check (scheduled_for < deadline_at)
);

create index if not exists reminder_deliveries_due_idx
  on public.reminder_deliveries (scheduled_for)
  where status = 'pending';

create index if not exists reminder_deliveries_user_idx
  on public.reminder_deliveries (user_id);

alter table public.reminder_deliveries enable row level security;
revoke all on table public.reminder_deliveries from public, anon, authenticated;

comment on table public.reminder_deliveries is
  'Contract 163. The provider-neutral reminder delivery ledger. Holds no '
  'message content and no email address: the address is read from auth.users '
  'at send time so this never becomes a second copy of contact details.';

-- ===========================================================================
-- 1. Scheduling
-- ===========================================================================
--
-- Reads contract 162's open action items and the player's preference, and
-- writes one pending row per player per action. `service_role` only.
--
-- THE PREFERENCE IS ENFORCED HERE, at scheduling, rather than at send. Both
-- would work; scheduling is chosen because it means an opted-out player has no
-- row in the ledger at all, rather than a row that says "we decided not to
-- send this". The strongest form of "we do not email you" is having nothing
-- queued.

create or replace function public.process_reminder_schedule(
  p_lead interval default interval '24 hours',
  p_dry_run boolean default true
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $schedule$
declare
  v_now timestamptz := now();
  v_scheduled integer;
  v_swept integer;
begin
  insert into public.reminder_deliveries (
    user_id, action_key, reminder_kind, deadline_at, scheduled_for,
    next_attempt_at, dry_run)
  select item.user_id,
         item.action_key,
         'deadline',
         item.deadline_at,
         -- One lead time before the deadline, or now if that moment has already
         -- passed — a player who joins twelve hours before the lock still gets
         -- one reminder rather than none.
         greatest(item.deadline_at - p_lead, v_now),
         greatest(item.deadline_at - p_lead, v_now),
         p_dry_run
    from public.player_action_items item
    join public.profiles player on player.id = item.user_id
   where item.completed_at is null
     and item.invalidated_at is null
     and item.deadline_at is not null
     -- THE PREFERENCE. An opted-out player is never queued.
     and player.reminder_emails
     -- DEADLINE-SAFE. Never schedule something that could only arrive late.
     -- Without this the greatest() above would produce `scheduled_for =
     -- deadline_at` for an action already past its lock, and the CHECK would
     -- raise rather than skip — turning one stale action into a failed job.
     and greatest(item.deadline_at - p_lead, v_now) < item.deadline_at
  -- The dedup key doing its work. A scheduler run twice, or two overlapping
  -- runs, add nothing the second time.
  on conflict (user_id, action_key, reminder_kind) do nothing;

  get diagnostics v_scheduled = row_count;

  -- A reminder for something that is no longer outstanding is withdrawn rather
  -- than sent. `skipped` is a terminal state distinct from `abandoned`: the
  -- player did the thing, which is a success for the product and a non-send for
  -- the ledger, and the two must not read the same in observability.
  update public.reminder_deliveries delivery
     set status = 'skipped',
         updated_at = v_now
   where delivery.status = 'pending'
     and (
       exists (
         select 1 from public.player_action_items item
          where item.user_id = delivery.user_id
            and item.action_key = delivery.action_key
            and (item.completed_at is not null or item.invalidated_at is not null))
       or not exists (
         select 1 from public.profiles player
          where player.id = delivery.user_id and player.reminder_emails)
       -- The deadline passed while it sat in the queue.
       or delivery.deadline_at <= v_now);

  get diagnostics v_swept = row_count;

  return jsonb_build_object(
    'ran_at', v_now,
    'scheduled', v_scheduled,
    'withdrawn', v_swept,
    'dry_run', p_dry_run);
end;
$schedule$;

revoke all on function public.process_reminder_schedule(interval, boolean)
  from public, anon, authenticated;
grant execute on function public.process_reminder_schedule(interval, boolean) to service_role;

-- ===========================================================================
-- 2. Claiming a batch
-- ===========================================================================
--
-- `for update skip locked` is the control that makes overlapping schedules
-- safe. Two concurrent senders each take a disjoint batch; neither waits, and
-- neither can be handed a row the other already has.
--
-- It returns the ADDRESS alongside the row, read from `auth.users` at claim
-- time, so the sender never needs its own copy and the ledger never stores one.

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
           dry_run = p_dry_run,
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

revoke all on function public.claim_due_reminders(integer, boolean)
  from public, anon, authenticated;
grant execute on function public.claim_due_reminders(integer, boolean) to service_role;

-- ===========================================================================
-- 3. Recording the outcome
-- ===========================================================================
--
-- The retry policy lives here and nowhere else, so there is one place a backoff
-- can be wrong. Driven rather than described: FIVE attempts in all, with 2, 4,
-- 8 and 16 minutes between them, and the FIFTH failure is terminal — recorded
-- as `abandoned` rather than left `failed` for ever, because a queue that
-- retries indefinitely is a queue that never tells anyone it is broken.
--
-- An abandoned row is not claimable, so a sender replaying an old batch is
-- refused rather than allowed to resurrect it.

create or replace function public.record_reminder_result(
  p_id uuid,
  p_sent boolean,
  p_provider text default null,
  p_provider_message_id text default null,
  p_error text default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $result$
declare
  v_now timestamptz := now();
  v_row public.reminder_deliveries;
begin
  select * into v_row from public.reminder_deliveries where id = p_id for update;

  if v_row.id is null then
    raise exception 'No such reminder delivery' using errcode = 'no_data_found';
  end if;

  -- Only a claimed row may be resolved. A sender reporting on a row it never
  -- held is either a bug or a replay, and both should be refused rather than
  -- allowed to overwrite a terminal state.
  if v_row.status <> 'sending' then
    raise exception 'That reminder is not in flight (status %)', v_row.status
      using errcode = '22023';
  end if;

  if p_sent then
    update public.reminder_deliveries
       set status = 'sent',
           provider = p_provider,
           provider_message_id = p_provider_message_id,
           last_error = null,
           next_attempt_at = null,
           updated_at = v_now
     where id = p_id;

    return jsonb_build_object('id', p_id, 'status', 'sent');
  end if;

  update public.reminder_deliveries
     set status = case when v_row.attempts >= 5 then 'abandoned' else 'failed' end,
         -- Exponential from two minutes: 2, 4, 8, 16, 32.
         next_attempt_at = case
           when v_row.attempts >= 5 then null
           else v_now + (interval '2 minutes' * power(2, v_row.attempts - 1))
         end,
         -- Truncated rather than refused: a provider returning a long error
         -- must not fail the function that is recording the failure.
         last_error = left(coalesce(p_error, 'unspecified'), 500),
         provider = coalesce(p_provider, v_row.provider),
         updated_at = v_now
   where id = p_id;

  return jsonb_build_object(
    'id', p_id,
    'status', case when v_row.attempts >= 5 then 'abandoned' else 'failed' end,
    'attempts', v_row.attempts);
end;
$result$;

revoke all on function public.record_reminder_result(uuid, boolean, text, text, text)
  from public, anon, authenticated;
grant execute on function public.record_reminder_result(uuid, boolean, text, text, text)
  to service_role;

-- ===========================================================================
-- 4. Reclaiming a row whose sender died
-- ===========================================================================
--
-- Without this, a sender that crashes between claim and result leaves the row
-- in `sending` for ever — invisible to the claim, never retried, never
-- abandoned. It is the one state that cannot recover on its own.
--
-- It counts against the same attempt budget, so a repeatedly-crashing sender
-- abandons the row rather than reclaiming it indefinitely.

create or replace function public.reclaim_stalled_reminders(
  p_stale_after interval default interval '15 minutes'
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $reclaim$
declare
  v_now timestamptz := now();
  v_reclaimed integer;
begin
  update public.reminder_deliveries
     set status = case when attempts >= 5 then 'abandoned' else 'pending' end,
         next_attempt_at = case when attempts >= 5 then null else v_now end,
         last_error = 'reclaimed: no result recorded before the stale window elapsed',
         updated_at = v_now
   where status = 'sending'
     and last_attempt_at is not null
     and last_attempt_at <= v_now - p_stale_after;

  get diagnostics v_reclaimed = row_count;

  return jsonb_build_object('ran_at', v_now, 'reclaimed', v_reclaimed);
end;
$reclaim$;

revoke all on function public.reclaim_stalled_reminders(interval)
  from public, anon, authenticated;
grant execute on function public.reclaim_stalled_reminders(interval) to service_role;

-- ===========================================================================
-- 5. Prove it, in the same transaction
-- ===========================================================================

do $$
declare
  v_schedule text := pg_get_functiondef(
    'public.process_reminder_schedule(interval,boolean)'::regprocedure);
  v_claim text := pg_get_functiondef(
    'public.claim_due_reminders(integer,boolean)'::regprocedure);
begin
  -- NO MESSAGE CONTENT AND NO STORED ADDRESS. The ledger must not become a
  -- mailbox or a second copy of everyone's contact details.
  if exists (
    select 1 from information_schema.columns
     where table_schema = 'public' and table_name = 'reminder_deliveries'
       and column_name in ('email', 'subject', 'body', 'html', 'text_body', 'recipient')
  ) then
    raise exception 'The reminder ledger must hold no address and no content';
  end if;

  -- THE PREFERENCE IS READ. A delivery path that does not consult
  -- `reminder_emails` is the defect this contract exists to fix.
  if v_schedule !~ 'reminder_emails' then
    raise exception 'Scheduling must enforce the reminder preference';
  end if;

  -- THE CONCURRENCY CONTROL. `for update` alone would make a second sender wait
  -- and then send the same reminder again.
  if v_claim !~ 'skip[[:space:]]+locked' then
    raise exception 'The claim must skip locked rows, not wait for them';
  end if;

  -- Dry run defaults to true everywhere, so an unauthorised sender sends
  -- nothing by default rather than by omission.
  if (select pg_get_function_arguments('public.claim_due_reminders(integer,boolean)'::regprocedure))
       !~ 'p_dry_run boolean DEFAULT true'
     or (select pg_get_function_arguments(
          'public.process_reminder_schedule(interval,boolean)'::regprocedure))
       !~ 'p_dry_run boolean DEFAULT true'
  then
    raise exception 'Dry run must default to true';
  end if;

  -- NO PROVIDER IS CHOSEN HERE. `SITE-007` records that the transactional
  -- sender is blocked on the brand decision, so naming one would pre-empt an
  -- open owner decision.
  if (v_schedule || v_claim) ~* 'resend|sendgrid|postmark|mailgun|smtp|ses\.|net\.http' then
    raise exception 'This contract must name no email provider and make no outbound call';
  end if;

  -- NOTHING HERE IS BROWSER-REACHABLE. Every one of the four is a server job.
  if has_function_privilege('authenticated',
       'public.process_reminder_schedule(interval,boolean)', 'execute')
     or has_function_privilege('authenticated',
       'public.claim_due_reminders(integer,boolean)', 'execute')
     or has_function_privilege('authenticated',
       'public.record_reminder_result(uuid,boolean,text,text,text)', 'execute')
     or has_function_privilege('authenticated',
       'public.reclaim_stalled_reminders(interval)', 'execute')
  then
    raise exception 'No browser role may drive reminder delivery';
  end if;

  if has_table_privilege('authenticated', 'public.reminder_deliveries', 'select')
     or has_table_privilege('anon', 'public.reminder_deliveries', 'select')
  then
    raise exception 'No browser role may read the reminder ledger';
  end if;

  if exists (
    select 1 from pg_catalog.pg_class c
    join pg_catalog.pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public' and c.relname = 'reminder_deliveries'
      and not c.relrowsecurity
  ) then
    raise exception 'The reminder ledger must keep row-level security enabled';
  end if;
end;
$$;
