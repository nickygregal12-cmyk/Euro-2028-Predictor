begin;

create extension if not exists pg_cron;

create table public.entry_automatic_submission_outcomes (
  id uuid primary key default gen_random_uuid(),
  entry_id uuid not null references public.entries(id) on delete cascade,
  tournament_id uuid not null references public.tournaments(id) on delete cascade,
  lock_at timestamptz not null,
  outcome text not null check (outcome in ('submitted', 'invalid')),
  attempted_at timestamptz not null,
  submitted_at timestamptz,
  failure_code text,
  failure_message text,
  unique (entry_id, lock_at),
  check (
    (
      outcome = 'submitted'
      and submitted_at is not null
      and failure_code is null
      and failure_message is null
    )
    or
    (
      outcome = 'invalid'
      and submitted_at is null
      and failure_code is not null
      and char_length(btrim(failure_message)) between 1 and 500
    )
  )
);

create index entry_automatic_submission_outcomes_tournament_idx
  on public.entry_automatic_submission_outcomes (tournament_id, lock_at);

alter table public.entry_automatic_submission_outcomes enable row level security;

create or replace function predictor_internal.block_automatic_submission_outcome_mutation()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  raise exception 'Automatic submission outcomes are immutable'
    using errcode = '42501';
end;
$$;

create trigger block_automatic_submission_outcome_mutation
before update or delete on public.entry_automatic_submission_outcomes
for each row
execute function predictor_internal.block_automatic_submission_outcome_mutation();

-- Automatic submission is the only after-lock path that may refresh derived
-- group-position rows. The transaction-local capability is set only by the
-- server-owned processor below. Every user-owned prediction table remains
-- locked, and this exception is additionally restricted to the postgres owner
-- executing inside a SECURITY DEFINER call.
create or replace function public.enforce_entry_lock_generic()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_entry uuid;
  v_lock timestamptz;
  v_server_position_refresh boolean :=
    tg_table_schema = 'public'
    and tg_table_name = 'predicted_group_positions'
    and current_user = 'postgres'
    and coalesce(
      current_setting('predictor.auto_submission_refresh', true),
      ''
    ) = 'on';
begin
  if tg_op = 'DELETE' then
    v_entry := old.entry_id;
  else
    v_entry := new.entry_id;
  end if;

  select t.lock_at
    into v_lock
    from public.entries e
    join public.tournaments t
      on t.id = e.tournament_id
    where e.id = v_entry;

  if v_lock is not null
     and now() >= v_lock
     and not v_server_position_refresh
  then
    raise exception 'Predictions are locked — the tournament has started'
      using errcode = 'check_violation';
  end if;

  if tg_op = 'DELETE' then
    return old;
  end if;
  return new;
end;
$$;

create or replace function public.process_due_entry_submissions(
  p_now timestamptz default now()
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_entry record;
  v_attempted integer := 0;
  v_submitted integer := 0;
  v_invalid integer := 0;
  v_submitted_at timestamptz;
  v_failure_code text;
  v_failure_message text;
  v_previous_capability text;
begin
  if p_now is null then
    raise exception 'Processing time is required'
      using errcode = '22023';
  end if;

  for v_entry in
    select
      e.id,
      e.tournament_id,
      t.lock_at
    from public.entries e
    join public.tournaments t
      on t.id = e.tournament_id
    where t.lock_at is not null
      and t.lock_at <= p_now
      and e.submitted_at is null
      and not exists (
        select 1
        from public.entry_automatic_submission_outcomes outcome
        where outcome.entry_id = e.id
          and outcome.lock_at = t.lock_at
      )
    order by t.lock_at, e.id
    for update of e skip locked
  loop
    v_attempted := v_attempted + 1;
    v_previous_capability := coalesce(
      current_setting('predictor.auto_submission_refresh', true),
      ''
    );

    begin
      perform set_config('predictor.auto_submission_refresh', 'on', true);

      perform predictor_internal.validate_entry_submission_snapshot(
        v_entry.id,
        true
      );

      update public.entries entry
        set submitted_at = coalesce(entry.submitted_at, p_now)
        where entry.id = v_entry.id
        returning entry.submitted_at into v_submitted_at;

      perform set_config(
        'predictor.auto_submission_refresh',
        v_previous_capability,
        true
      );

      insert into public.entry_automatic_submission_outcomes (
        entry_id,
        tournament_id,
        lock_at,
        outcome,
        attempted_at,
        submitted_at
      ) values (
        v_entry.id,
        v_entry.tournament_id,
        v_entry.lock_at,
        'submitted',
        p_now,
        v_submitted_at
      );

      v_submitted := v_submitted + 1;
    exception
      when check_violation or foreign_key_violation or data_exception then
        get stacked diagnostics
          v_failure_code = returned_sqlstate,
          v_failure_message = message_text;

        perform set_config(
          'predictor.auto_submission_refresh',
          v_previous_capability,
          true
        );

        insert into public.entry_automatic_submission_outcomes (
          entry_id,
          tournament_id,
          lock_at,
          outcome,
          attempted_at,
          failure_code,
          failure_message
        ) values (
          v_entry.id,
          v_entry.tournament_id,
          v_entry.lock_at,
          'invalid',
          p_now,
          v_failure_code,
          left(v_failure_message, 500)
        );

        v_invalid := v_invalid + 1;
    end;
  end loop;

  return jsonb_build_object(
    'processedAt', p_now,
    'attempted', v_attempted,
    'submitted', v_submitted,
    'invalid', v_invalid
  );
end;
$$;

create or replace function public.get_entry_submission_status(
  p_entry_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid;
  v_lock timestamptz;
  v_submitted_at timestamptz;
  v_outcome public.entry_automatic_submission_outcomes%rowtype;
begin
  select e.user_id, t.lock_at, e.submitted_at
    into v_user, v_lock, v_submitted_at
    from public.entries e
    join public.tournaments t
      on t.id = e.tournament_id
    where e.id = p_entry_id;

  if v_user is null or v_user <> (select auth.uid()) then
    raise exception 'Not your entry'
      using errcode = '42501';
  end if;

  if v_lock is not null then
    select outcome.*
      into v_outcome
      from public.entry_automatic_submission_outcomes outcome
      where outcome.entry_id = p_entry_id
        and outcome.lock_at = v_lock;
  end if;

  if v_submitted_at is not null then
    return jsonb_build_object(
      'state', case
        when v_outcome.outcome = 'submitted' then 'automatically_submitted'
        else 'manually_submitted'
      end,
      'lockAt', v_lock,
      'submittedAt', v_submitted_at,
      'attemptedAt', v_outcome.attempted_at,
      'failureCode', null,
      'failureMessage', null
    );
  end if;

  if v_lock is null or now() < v_lock then
    return jsonb_build_object(
      'state', 'pending',
      'lockAt', v_lock,
      'submittedAt', null,
      'attemptedAt', null,
      'failureCode', null,
      'failureMessage', null
    );
  end if;

  if v_outcome.outcome = 'invalid' then
    return jsonb_build_object(
      'state', 'automatic_submission_failed',
      'lockAt', v_lock,
      'submittedAt', null,
      'attemptedAt', v_outcome.attempted_at,
      'failureCode', v_outcome.failure_code,
      'failureMessage', v_outcome.failure_message
    );
  end if;

  return jsonb_build_object(
    'state', 'automatic_submission_pending',
    'lockAt', v_lock,
    'submittedAt', null,
    'attemptedAt', null,
    'failureCode', null,
    'failureMessage', null
  );
end;
$$;

revoke all on table public.entry_automatic_submission_outcomes
  from public, anon, authenticated, service_role;

revoke all on function predictor_internal.block_automatic_submission_outcome_mutation()
  from public, anon, authenticated, service_role;

revoke all on function public.process_due_entry_submissions(timestamptz)
  from public, anon, authenticated, service_role;
revoke all on function public.get_entry_submission_status(uuid)
  from public, anon, authenticated, service_role;

grant execute on function public.process_due_entry_submissions(timestamptz)
  to service_role;
grant execute on function public.get_entry_submission_status(uuid)
  to authenticated;

select cron.schedule(
  'euro28-auto-submit-due-entries',
  '* * * * *',
  'select public.process_due_entry_submissions();'
);

commit;
