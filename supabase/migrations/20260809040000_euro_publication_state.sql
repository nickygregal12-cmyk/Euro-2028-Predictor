-- Contract 134 / EURO-002: server-owned Euro 2028 publication state.
--
-- Publication is an owner operational act, not a frontend flag and not a deploy
-- side effect. The public read below exposes one bounded state value so future
-- route/site guards can fail closed from server truth. Mutation is narrower:
-- only a signed-in `super_admin` may advance the lifecycle, one adjacent state
-- at a time, with optimistic expected-state checking and a mandatory reason.

begin;

create type predictor_internal.euro_publication_status as enum (
  'hidden',
  'prelaunch',
  'registration-open',
  'live',
  'completed',
  'archived'
);

create table predictor_internal.euro_publication_state (
  singleton boolean primary key default true check (singleton),
  state predictor_internal.euro_publication_status not null default 'hidden',
  changed_at timestamptz not null default now(),
  changed_by uuid references auth.users(id) on delete set null,
  constraint euro_publication_state_singleton check (singleton = true)
);

-- RLS plus no browser/service table grants keeps the storage private while the
-- SECURITY DEFINER RPC owner can perform the deliberately bounded read/write.
-- FORCE RLS is intentionally not used: with no table policies it would also
-- deny the definer owner and turn the RPCs into non-functional controls.
alter table predictor_internal.euro_publication_state enable row level security;

insert into predictor_internal.euro_publication_state (singleton, state)
values (true, 'hidden');

create table predictor_internal.euro_publication_transitions (
  id bigint generated always as identity primary key,
  from_state predictor_internal.euro_publication_status not null,
  to_state predictor_internal.euro_publication_status not null,
  reason text not null check (char_length(btrim(reason)) between 1 and 1000),
  -- Preserve the operational record if the actor's Auth identity is later
  -- deleted. Historical attribution then becomes explicitly unknown rather
  -- than blocking deletion or removing the publication event itself.
  actor_id uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  constraint euro_publication_transition_changes_state check (from_state <> to_state)
);

alter table predictor_internal.euro_publication_transitions enable row level security;

create or replace function predictor_internal.refuse_euro_publication_history_mutation()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $function$
begin
  raise exception 'Euro publication transition history is append-only'
    using errcode = '42501';
end;
$function$;

create trigger euro_publication_transitions_append_only
before update or delete on predictor_internal.euro_publication_transitions
for each row execute function predictor_internal.refuse_euro_publication_history_mutation();

create or replace function predictor_internal.require_publication_owner()
returns void
language plpgsql
security invoker
set search_path = ''
as $function$
declare
  v_metadata jsonb := coalesce(auth.jwt() -> 'app_metadata', '{}'::jsonb);
begin
  if auth.uid() is not null
     and v_metadata ->> 'admin_role' = 'super_admin'
  then
    return;
  end if;

  raise exception 'Euro publication administration is not authorised'
    using errcode = '42501';
end;
$function$;

create or replace function public.euro_publication_state()
returns table (
  state text,
  changed_at timestamptz
)
language sql
stable
security definer
set search_path = ''
as $function$
  select s.state::text, s.changed_at
  from predictor_internal.euro_publication_state s
  where s.singleton = true;
$function$;

create or replace function public.admin_transition_euro_publication_state(
  p_expected_state text,
  p_next_state text,
  p_reason text
)
returns table (
  state text,
  changed_at timestamptz
)
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_current predictor_internal.euro_publication_status;
  v_expected predictor_internal.euro_publication_status;
  v_next predictor_internal.euro_publication_status;
  v_actor uuid := auth.uid();
  v_changed_at timestamptz := clock_timestamp();
begin
  perform predictor_internal.require_publication_owner();

  if nullif(btrim(p_reason), '') is null then
    raise exception 'A publication-state transition requires a reason'
      using errcode = '22023';
  end if;

  begin
    v_expected := p_expected_state::predictor_internal.euro_publication_status;
    v_next := p_next_state::predictor_internal.euro_publication_status;
  exception
    when invalid_text_representation then
      raise exception 'Unknown Euro publication state'
        using errcode = '22023';
  end;

  select s.state
    into v_current
    from predictor_internal.euro_publication_state s
   where s.singleton = true
   for update;

  if v_current is null then
    raise exception 'Euro publication state authority is missing'
      using errcode = '55000';
  end if;

  if v_current <> v_expected then
    raise exception 'Euro publication state changed concurrently: expected %, found %',
      v_expected, v_current
      using errcode = '40001';
  end if;

  if not (
    (v_current = 'hidden' and v_next = 'prelaunch')
    or (v_current = 'prelaunch' and v_next = 'registration-open')
    or (v_current = 'registration-open' and v_next = 'live')
    or (v_current = 'live' and v_next = 'completed')
    or (v_current = 'completed' and v_next = 'archived')
  ) then
    raise exception 'Invalid Euro publication transition: % -> %', v_current, v_next
      using errcode = '22023';
  end if;

  insert into predictor_internal.euro_publication_transitions (
    from_state,
    to_state,
    reason,
    actor_id,
    created_at
  ) values (
    v_current,
    v_next,
    btrim(p_reason),
    v_actor,
    v_changed_at
  );

  update predictor_internal.euro_publication_state
     set state = v_next,
         changed_at = v_changed_at,
         changed_by = v_actor
   where singleton = true;

  return query select v_next::text, v_changed_at;
end;
$function$;

revoke all on table predictor_internal.euro_publication_state from public, anon, authenticated, service_role;
revoke all on table predictor_internal.euro_publication_transitions from public, anon, authenticated, service_role;
revoke all on function predictor_internal.refuse_euro_publication_history_mutation() from public, anon, authenticated, service_role;
revoke all on function predictor_internal.require_publication_owner() from public, anon, authenticated, service_role;
revoke all on function public.euro_publication_state() from public, anon, authenticated, service_role;
revoke all on function public.admin_transition_euro_publication_state(text,text,text) from public, anon, authenticated, service_role;

grant execute on function public.euro_publication_state() to anon, authenticated, service_role;
grant execute on function public.admin_transition_euro_publication_state(text,text,text) to authenticated;

commit;
