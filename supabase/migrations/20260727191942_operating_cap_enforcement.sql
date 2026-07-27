begin;

-- Contract 44 separates the public rollout limits from the higher technical
-- capacity proven by the scale fixtures. Until custom SMTP is explicitly
-- verified, public registration is limited to 50 users and the site to 20 total
-- private leagues. Both values can be changed only through the service-role RPC.
create table predictor_internal.operating_limits (
  singleton boolean primary key default true check (singleton),
  public_user_limit integer not null check (public_user_limit between 1 and 250),
  total_league_limit integer not null check (total_league_limit between 1 and 20),
  updated_at timestamptz not null default now()
);

insert into predictor_internal.operating_limits (
  singleton,
  public_user_limit,
  total_league_limit
) values (true, 50, 20);

revoke all on table predictor_internal.operating_limits
  from public, anon, authenticated, service_role, supabase_auth_admin;

-- Fixed advisory-lock keys serialize the two independent site-wide counters.
-- A transaction that wins the final slot commits before the next waiter counts,
-- so concurrent requests cannot overshoot either configured limit.
create or replace function predictor_internal.enforce_public_user_limit()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_limit integer;
  v_used integer;
begin
  perform pg_catalog.pg_advisory_xact_lock(202800050::bigint);

  select limits.public_user_limit
    into v_limit
    from predictor_internal.operating_limits limits
    where limits.singleton;

  if v_limit is null then
    raise exception 'Public registration configuration is unavailable'
      using errcode = '55000';
  end if;

  select count(*)::integer
    into v_used
    from auth.users;

  if v_used >= v_limit then
    raise exception 'Public registration is currently full. Contact admin.'
      using errcode = 'PT429',
            detail = 'public_signup_full';
  end if;

  return new;
end;
$$;

create or replace function predictor_internal.enforce_total_league_limit()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_limit integer;
  v_used integer;
begin
  perform pg_catalog.pg_advisory_xact_lock(202800020::bigint);

  select limits.total_league_limit
    into v_limit
    from predictor_internal.operating_limits limits
    where limits.singleton;

  if v_limit is null then
    raise exception 'League capacity configuration is unavailable'
      using errcode = '55000';
  end if;

  select count(*)::integer
    into v_used
    from public.leagues;

  if v_used >= v_limit then
    raise exception 'League limit reached. Contact admin.'
      using errcode = 'PT429',
            detail = 'total_league_limit_reached';
  end if;

  return new;
end;
$$;

create trigger enforce_public_user_limit
before insert on auth.users
for each row
execute function predictor_internal.enforce_public_user_limit();

create trigger enforce_total_league_limit
before insert on public.leagues
for each row
execute function predictor_internal.enforce_total_league_limit();

-- Anonymous-safe aggregate only: no identities, emails, names or private rows.
create or replace function public.get_public_capacity()
returns table (
  public_users_used integer,
  public_user_limit integer,
  signup_available boolean,
  leagues_used integer,
  total_league_limit integer,
  league_creation_available boolean
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    user_count.used,
    limits.public_user_limit,
    user_count.used < limits.public_user_limit,
    league_count.used,
    limits.total_league_limit,
    league_count.used < limits.total_league_limit
  from predictor_internal.operating_limits limits
  cross join lateral (
    select count(*)::integer as used from auth.users
  ) user_count
  cross join lateral (
    select count(*)::integer as used from public.leagues
  ) league_count
  where limits.singleton;
$$;

-- Controlled operations can raise the public limit after SMTP verification or
-- temporarily enlarge disposable test stacks. Limits may never be set below the
-- number of already-created objects, and browser roles cannot call this RPC.
create or replace function public.set_operating_limits(
  p_public_user_limit integer,
  p_total_league_limit integer
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_users integer;
  v_leagues integer;
begin
  if p_public_user_limit is null
     or p_public_user_limit < 1
     or p_public_user_limit > 250
  then
    raise exception 'Public user limit must be between 1 and 250'
      using errcode = '22023';
  end if;

  if p_total_league_limit is null
     or p_total_league_limit < 1
     or p_total_league_limit > 20
  then
    raise exception 'Total league limit must be between 1 and 20'
      using errcode = '22023';
  end if;

  -- Always acquire locks in the same order.
  perform pg_catalog.pg_advisory_xact_lock(202800050::bigint);
  perform pg_catalog.pg_advisory_xact_lock(202800020::bigint);

  select count(*)::integer into v_users from auth.users;
  select count(*)::integer into v_leagues from public.leagues;

  if p_public_user_limit < v_users then
    raise exception 'Public user limit cannot be below the current user count'
      using errcode = 'check_violation';
  end if;

  if p_total_league_limit < v_leagues then
    raise exception 'Total league limit cannot be below the current league count'
      using errcode = 'check_violation';
  end if;

  update predictor_internal.operating_limits limits
    set public_user_limit = p_public_user_limit,
        total_league_limit = p_total_league_limit,
        updated_at = now()
    where limits.singleton;

  return jsonb_build_object(
    'publicUserLimit', p_public_user_limit,
    'totalLeagueLimit', p_total_league_limit,
    'publicUsersUsed', v_users,
    'leaguesUsed', v_leagues
  );
end;
$$;

-- Keep the existing profile setup focused on profile creation, but harden its
-- security-definer search path while this migration touches the auth boundary.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_name text;
begin
  v_name := btrim(coalesce(new.raw_user_meta_data ->> 'display_name', ''));
  if v_name = '' then
    v_name := 'Player';
  end if;

  v_name := btrim(left(v_name, 40));
  if v_name = '' then
    v_name := 'Player';
  end if;

  insert into public.profiles (id, display_name)
  values (new.id, v_name)
  on conflict (id) do nothing;

  return new;
end;
$$;

-- Existing league APIs keep their signatures and behaviour. The table trigger
-- is the authoritative total-league guard, including privileged direct inserts.
create or replace function public.create_league(
  p_tournament_id uuid,
  p_name text
)
returns table (id uuid, name text, invite_code text)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
  v_name text := btrim(p_name);
  v_id uuid;
  v_code text;
  v_try integer := 0;
begin
  if v_uid is null then
    raise exception 'Not authenticated'
      using errcode = 'insufficient_privilege';
  end if;

  if length(v_name) < 1 or length(v_name) > 40 then
    raise exception 'League name must be 1 to 40 characters'
      using errcode = 'check_violation';
  end if;

  loop
    v_try := v_try + 1;
    v_code := public.gen_invite_code();
    begin
      insert into public.leagues (
        tournament_id,
        owner_id,
        name,
        invite_code
      ) values (
        p_tournament_id,
        v_uid,
        v_name,
        v_code
      ) returning leagues.id into v_id;
      exit;
    exception when unique_violation then
      if v_try >= 10 then
        raise exception 'Could not allocate an invite code, please retry';
      end if;
    end;
  end loop;

  insert into public.league_members (league_id, user_id, role)
  values (v_id, v_uid, 'owner');

  return query select v_id, v_name, v_code;
end;
$$;

create or replace function public.join_league(p_code text)
returns table (id uuid, name text)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
  v_id uuid;
begin
  if v_uid is null then
    raise exception 'Not authenticated'
      using errcode = 'insufficient_privilege';
  end if;

  select league.id
    into v_id
    from public.leagues league
    where league.invite_code = upper(btrim(p_code));

  if v_id is null then
    raise exception 'That invite code does not match a league'
      using errcode = 'no_data_found';
  end if;

  insert into public.league_members (league_id, user_id, role)
  values (v_id, v_uid, 'member')
  on conflict (league_id, user_id) do nothing;

  return query
    select league.id, league.name
    from public.leagues league
    where league.id = v_id;
end;
$$;

revoke all on function predictor_internal.enforce_public_user_limit()
  from public, anon, authenticated, service_role, supabase_auth_admin;
revoke all on function predictor_internal.enforce_total_league_limit()
  from public, anon, authenticated, service_role;
revoke all on function public.get_public_capacity()
  from public, anon, authenticated, service_role;
revoke all on function public.set_operating_limits(integer, integer)
  from public, anon, authenticated, service_role;
revoke all on function public.handle_new_user()
  from public, anon, authenticated, service_role;
revoke all on function public.create_league(uuid, text)
  from public, anon, authenticated, service_role;
revoke all on function public.join_league(text)
  from public, anon, authenticated, service_role;

grant execute on function public.get_public_capacity()
  to anon, authenticated, service_role;
grant execute on function public.set_operating_limits(integer, integer)
  to service_role;
grant execute on function public.create_league(uuid, text)
  to authenticated, service_role;
grant execute on function public.join_league(text)
  to authenticated, service_role;

commit;
