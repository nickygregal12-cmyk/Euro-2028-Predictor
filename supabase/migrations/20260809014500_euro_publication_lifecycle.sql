-- Contract 134: EURO-002 server-owned Euro 2028 publication lifecycle.
--
-- This contract deliberately creates no browser-facing RPC. It establishes one
-- private singleton authority and immutable transition history first. Route/UI
-- guards may consume a bounded public read in a later contract without ever
-- making the publication decision client-owned.

create table predictor_internal.euro_publication_control (
  singleton boolean primary key default true,
  state text not null default 'hidden',
  changed_at timestamptz not null default clock_timestamp(),
  changed_by uuid,
  reason text not null,
  constraint euro_publication_control_singleton check (singleton),
  constraint euro_publication_control_state_allowed check (
    state in ('hidden', 'prelaunch', 'registration-open', 'live', 'completed', 'archived')
  ),
  constraint euro_publication_control_reason_length check (
    char_length(btrim(reason)) between 1 and 500
  )
);

alter table predictor_internal.euro_publication_control enable row level security;
revoke all on table predictor_internal.euro_publication_control
  from public, anon, authenticated, service_role;

create table predictor_internal.euro_publication_transitions (
  id bigint generated always as identity primary key,
  from_state text,
  to_state text not null,
  changed_at timestamptz not null default clock_timestamp(),
  changed_by uuid,
  reason text not null,
  constraint euro_publication_transitions_from_allowed check (
    from_state is null
    or from_state in ('hidden', 'prelaunch', 'registration-open', 'live', 'completed', 'archived')
  ),
  constraint euro_publication_transitions_to_allowed check (
    to_state in ('hidden', 'prelaunch', 'registration-open', 'live', 'completed', 'archived')
  ),
  constraint euro_publication_transitions_reason_length check (
    char_length(btrim(reason)) between 1 and 500
  )
);

alter table predictor_internal.euro_publication_transitions enable row level security;
revoke all on table predictor_internal.euro_publication_transitions
  from public, anon, authenticated, service_role;

create or replace function predictor_internal.block_euro_publication_transition_rewrite()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  raise exception 'Euro publication transition history is append-only'
    using errcode = '42501';
end;
$$;

revoke all on function predictor_internal.block_euro_publication_transition_rewrite()
  from public, anon, authenticated, service_role;

create trigger euro_publication_transitions_append_only
before update or delete on predictor_internal.euro_publication_transitions
for each row execute function predictor_internal.block_euro_publication_transition_rewrite();

create or replace function predictor_internal.set_euro_publication_state(
  p_state text,
  p_reason text,
  p_actor uuid default null
)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_current text;
  v_expected text;
begin
  if p_state is null
     or p_state not in ('hidden', 'prelaunch', 'registration-open', 'live', 'completed', 'archived')
  then
    raise exception 'Unsupported Euro publication state'
      using errcode = '22023';
  end if;

  if p_reason is null or char_length(btrim(p_reason)) not between 1 and 500 then
    raise exception 'Publication-state reason must contain between 1 and 500 characters'
      using errcode = '22023';
  end if;

  select c.state
    into v_current
    from predictor_internal.euro_publication_control c
   where c.singleton
   for update;

  if not found then
    raise exception 'Euro publication control row is missing'
      using errcode = '23514';
  end if;

  if p_state = v_current then
    return v_current;
  end if;

  v_expected := case v_current
    when 'hidden' then 'prelaunch'
    when 'prelaunch' then 'registration-open'
    when 'registration-open' then 'live'
    when 'live' then 'completed'
    when 'completed' then 'archived'
    else null
  end;

  if v_expected is null or p_state <> v_expected then
    raise exception 'Euro publication state may only advance from % to %',
      v_current,
      coalesce(v_expected, '<terminal>')
      using errcode = '23514';
  end if;

  update predictor_internal.euro_publication_control
     set state = p_state,
         changed_at = clock_timestamp(),
         changed_by = p_actor,
         reason = btrim(p_reason)
   where singleton;

  insert into predictor_internal.euro_publication_transitions (
    from_state,
    to_state,
    changed_by,
    reason
  ) values (
    v_current,
    p_state,
    p_actor,
    btrim(p_reason)
  );

  return p_state;
end;
$$;

revoke all on function predictor_internal.set_euro_publication_state(text, text, uuid)
  from public, anon, authenticated, service_role;

insert into predictor_internal.euro_publication_control (
  singleton,
  state,
  changed_by,
  reason
) values (
  true,
  'hidden',
  null,
  'Contract 134 default: Euro 2028 remains hidden until an explicit owner-approved transition.'
);

insert into predictor_internal.euro_publication_transitions (
  from_state,
  to_state,
  changed_by,
  reason
) values (
  null,
  'hidden',
  null,
  'Contract 134 default: Euro 2028 remains hidden until an explicit owner-approved transition.'
);
