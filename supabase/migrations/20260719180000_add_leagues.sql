-- Euro 2028 Predictor — private leagues (Phase 2 / v0.5)
--
-- Follow-up migration; append-only (does not edit earlier files).
--
-- Private leagues belong to the ORIGINAL PREDICTOR only (docs/competition-
-- structure.md §1: leagues never touch bonus games). This adds two tables and
-- the security-definer access path that lets fellow members see each other's
-- name + points WITHOUT loosening the tight profiles/entries RLS.
--
--   leagues          — id, tournament, owner, name (1–40), short invite code
--   league_members   — (league, user) membership with a role and joined_at
--
-- Access model:
--   * RLS on both tables. Members may SELECT their own league + own memberships.
--     There are NO insert/update/delete policies, so every mutation must go
--     through the SECURITY DEFINER functions below — that is what keeps the
--     owner-can't-orphan-a-league invariant server-side (a client cannot delete
--     its owner membership row directly; leave_league() refuses for owners).
--   * Reading other members' names/points is done ONLY via get_league_members(),
--     a security-definer function scoped to co-membership — the profiles and
--     entries policies stay member-private and untouched.
--
-- Owner rule (enforced server-side): an owner cannot leave. They must transfer
-- ownership to another member or delete the league — leagues are never orphaned.
--
-- Points are 0 until scoring lands (no score_events table yet), exactly like
-- get_leaderboard(); the shape is final so wiring real totals later is a
-- one-function change.
--
-- Idempotent (if not exists / or replace / drop-if-exists).

begin;

-- ---------------------------------------------------------------------------
-- leagues
-- ---------------------------------------------------------------------------
create table if not exists leagues (
  id            uuid primary key default gen_random_uuid(),
  tournament_id uuid not null references tournaments (id) on delete cascade,
  owner_id      uuid not null references auth.users (id) on delete cascade,
  name          text not null check (length(btrim(name)) between 1 and 40),
  -- Short, human-shareable code from an unambiguous alphabet (no 0/O/1/I/L).
  invite_code   text not null unique check (invite_code ~ '^[A-Z0-9]{6}$'),
  created_at    timestamptz not null default now()
);
create index if not exists leagues_tournament_idx on leagues (tournament_id);
create index if not exists leagues_owner_idx on leagues (owner_id);

-- ---------------------------------------------------------------------------
-- league_members: one row per (league, user). role is 'owner' or 'member';
-- exactly one 'owner' per league is maintained by the functions below.
-- ---------------------------------------------------------------------------
create table if not exists league_members (
  league_id uuid not null references leagues (id) on delete cascade,
  user_id   uuid not null references auth.users (id) on delete cascade,
  role      text not null default 'member' check (role in ('owner', 'member')),
  joined_at timestamptz not null default now(),
  primary key (league_id, user_id)
);
create index if not exists league_members_user_idx on league_members (user_id);

-- ===========================================================================
-- Row-level security
-- ===========================================================================
alter table leagues        enable row level security;
alter table league_members enable row level security;

-- A user may read leagues they belong to. (Reads normally go through the
-- functions; this policy makes direct member reads safe too.)
drop policy if exists "member leagues readable" on leagues;
create policy "member leagues readable" on leagues
  for select to authenticated
  using (exists (
    select 1 from league_members m
    where m.league_id = leagues.id and m.user_id = (select auth.uid())
  ));

-- A user may read their own membership rows. No write policies exist, so all
-- membership mutations must go through the security-definer functions.
drop policy if exists "own memberships readable" on league_members;
create policy "own memberships readable" on league_members
  for select to authenticated
  using (user_id = (select auth.uid()));

-- ===========================================================================
-- Invite codes
-- ===========================================================================
-- Unambiguous alphabet: omits 0/O, 1/I/L so a code is easy to read aloud/type.
create or replace function gen_invite_code() returns text
language plpgsql
as $$
declare
  alphabet text := 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
  code text := '';
  i int;
begin
  for i in 1..6 loop
    code := code || substr(alphabet, 1 + floor(random() * length(alphabet))::int, 1);
  end loop;
  return code;
end;
$$;

-- ===========================================================================
-- Security-definer access + mutation functions
-- ===========================================================================
-- All are owner/member scoped internally and run as the table owner so they can
-- read co-members without RLS being loosened. Granted to authenticated only.

-- --- create_league: make a league + owner membership, return its code --------
create or replace function create_league(p_tournament_id uuid, p_name text)
returns table (id uuid, name text, invite_code text)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid  uuid := auth.uid();
  v_name text := btrim(p_name);
  v_id   uuid;
  v_code text;
  v_try  int := 0;
begin
  if v_uid is null then
    raise exception 'Not authenticated' using errcode = 'insufficient_privilege';
  end if;
  if length(v_name) < 1 or length(v_name) > 40 then
    raise exception 'League name must be 1 to 40 characters' using errcode = 'check_violation';
  end if;

  -- Insert with a fresh code, retrying only on invite-code collision.
  loop
    v_try := v_try + 1;
    v_code := gen_invite_code();
    begin
      insert into leagues (tournament_id, owner_id, name, invite_code)
      values (p_tournament_id, v_uid, v_name, v_code)
      returning leagues.id into v_id;
      exit;
    exception when unique_violation then
      if v_try >= 10 then
        raise exception 'Could not allocate an invite code, please retry';
      end if;
    end;
  end loop;

  insert into league_members (league_id, user_id, role) values (v_id, v_uid, 'owner');

  return query select v_id, v_name, v_code;
end;
$$;

-- --- get_league_preview: pre-join summary, callable by any authed user -------
-- Exposes only what the join screen needs (name, member count, owner name) and
-- whether the caller is already in. Never leaks member ids.
create or replace function get_league_preview(p_code text)
returns table (id uuid, name text, member_count int, owner_name text, is_member boolean)
language sql
security definer
set search_path = public
stable
as $$
  select l.id,
         l.name,
         (select count(*)::int from league_members m where m.league_id = l.id),
         (select p.display_name from profiles p where p.id = l.owner_id),
         exists (select 1 from league_members m
                 where m.league_id = l.id and m.user_id = auth.uid())
  from leagues l
  where l.invite_code = upper(btrim(p_code));
$$;

-- --- join_league: add the caller as a member (idempotent), return the league -
create or replace function join_league(p_code text)
returns table (id uuid, name text)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_id  uuid;
begin
  if v_uid is null then
    raise exception 'Not authenticated' using errcode = 'insufficient_privilege';
  end if;
  select l.id into v_id from leagues l where l.invite_code = upper(btrim(p_code));
  if v_id is null then
    raise exception 'That invite code does not match a league' using errcode = 'no_data_found';
  end if;

  insert into league_members (league_id, user_id, role)
  values (v_id, v_uid, 'member')
  on conflict (league_id, user_id) do nothing;

  return query select l.id, l.name from leagues l where l.id = v_id;
end;
$$;

-- --- get_my_leagues: the caller's leagues for a tournament (hub list) --------
create or replace function get_my_leagues(p_tournament_id uuid)
returns table (
  id           uuid,
  name         text,
  invite_code  text,
  member_count int,
  is_owner     boolean,
  owner_name   text
)
language sql
security definer
set search_path = public
stable
as $$
  select l.id,
         l.name,
         l.invite_code,
         (select count(*)::int from league_members m2 where m2.league_id = l.id),
         (l.owner_id = auth.uid()) as is_owner,
         (select p.display_name from profiles p where p.id = l.owner_id)
  from leagues l
  join league_members m on m.league_id = l.id and m.user_id = auth.uid()
  where l.tournament_id = p_tournament_id
  order by l.created_at;
$$;

-- --- get_league: header for a league the caller belongs to -------------------
create or replace function get_league(p_league_id uuid)
returns table (
  id           uuid,
  name         text,
  invite_code  text,
  member_count int,
  is_owner     boolean,
  owner_id     uuid,
  owner_name   text
)
language plpgsql
security definer
set search_path = public
stable
as $$
begin
  if not exists (
    select 1 from league_members m
    where m.league_id = p_league_id and m.user_id = auth.uid()
  ) then
    raise exception 'Not a member of this league' using errcode = 'insufficient_privilege';
  end if;

  return query
    select l.id,
           l.name,
           l.invite_code,
           (select count(*)::int from league_members m2 where m2.league_id = l.id),
           (l.owner_id = auth.uid()) as is_owner,
           l.owner_id,
           (select p.display_name from profiles p where p.id = l.owner_id)
    from leagues l
    where l.id = p_league_id;
end;
$$;

-- --- get_league_members: member rows for a league the caller belongs to ------
-- The ONLY path by which co-members see each other's name + points; guarded on
-- co-membership. total_points is 0 until scoring lands (mirrors get_leaderboard).
-- predicted_count feeds the pre-deadline "12/36 predicted" progress display for
-- members without a submitted entry (a count only — never the predictions).
create or replace function get_league_members(p_league_id uuid)
returns table (
  user_id         uuid,
  display_name    text,
  total_points    int,
  is_you          boolean,
  is_owner        boolean,
  has_entry       boolean,
  predicted_count int,
  joined_at       timestamptz
)
language plpgsql
security definer
set search_path = public
stable
as $$
declare
  v_tournament uuid;
begin
  if not exists (
    select 1 from league_members m
    where m.league_id = p_league_id and m.user_id = auth.uid()
  ) then
    raise exception 'Not a member of this league' using errcode = 'insufficient_privilege';
  end if;

  select l.tournament_id into v_tournament from leagues l where l.id = p_league_id;

  return query
    select m.user_id,
           p.display_name,
           0::int as total_points,
           (m.user_id = auth.uid()) as is_you,
           (m.role = 'owner') as is_owner,
           (e.submitted_at is not null) as has_entry,
           coalesce(
             (select count(*)::int from match_predictions mp where mp.entry_id = e.id),
             0
           ) as predicted_count,
           m.joined_at
    from league_members m
    join profiles p on p.id = m.user_id
    left join entries e on e.user_id = m.user_id and e.tournament_id = v_tournament
    where m.league_id = p_league_id
    order by p.display_name;
end;
$$;

-- --- leave_league: a non-owner member leaves. Owners are refused. -----------
create or replace function leave_league(p_league_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid  uuid := auth.uid();
  v_role text;
begin
  select m.role into v_role
  from league_members m
  where m.league_id = p_league_id and m.user_id = v_uid;

  if v_role is null then
    raise exception 'Not a member of this league' using errcode = 'insufficient_privilege';
  end if;
  if v_role = 'owner' then
    raise exception 'Owners cannot leave — transfer ownership or delete the league instead'
      using errcode = 'check_violation';
  end if;

  delete from league_members
  where league_id = p_league_id and user_id = v_uid;
end;
$$;

-- --- transfer_ownership: current owner hands the league to another member ----
create or replace function transfer_ownership(p_league_id uuid, p_new_owner uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
begin
  if not exists (select 1 from leagues l where l.id = p_league_id and l.owner_id = v_uid) then
    raise exception 'Only the owner can transfer ownership' using errcode = 'insufficient_privilege';
  end if;
  if not exists (
    select 1 from league_members m
    where m.league_id = p_league_id and m.user_id = p_new_owner
  ) then
    raise exception 'The new owner must be a member of the league' using errcode = 'check_violation';
  end if;

  update leagues set owner_id = p_new_owner where id = p_league_id;
  update league_members set role = 'member' where league_id = p_league_id and user_id = v_uid;
  update league_members set role = 'owner'  where league_id = p_league_id and user_id = p_new_owner;
end;
$$;

-- --- delete_league: current owner deletes the whole league -------------------
create or replace function delete_league(p_league_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
begin
  if not exists (select 1 from leagues l where l.id = p_league_id and l.owner_id = v_uid) then
    raise exception 'Only the owner can delete the league' using errcode = 'insufficient_privilege';
  end if;
  delete from leagues where id = p_league_id; -- cascades to league_members
end;
$$;

-- --- grants -----------------------------------------------------------------
revoke all on function gen_invite_code() from public;
revoke all on function create_league(uuid, text) from public;
revoke all on function get_league_preview(text) from public;
revoke all on function join_league(text) from public;
revoke all on function get_my_leagues(uuid) from public;
revoke all on function get_league(uuid) from public;
revoke all on function get_league_members(uuid) from public;
revoke all on function leave_league(uuid) from public;
revoke all on function transfer_ownership(uuid, uuid) from public;
revoke all on function delete_league(uuid) from public;

grant execute on function create_league(uuid, text) to authenticated;
grant execute on function get_league_preview(text) to authenticated;
grant execute on function join_league(text) to authenticated;
grant execute on function get_my_leagues(uuid) to authenticated;
grant execute on function get_league(uuid) to authenticated;
grant execute on function get_league_members(uuid) to authenticated;
grant execute on function leave_league(uuid) to authenticated;
grant execute on function transfer_ownership(uuid, uuid) to authenticated;
grant execute on function delete_league(uuid) to authenticated;

commit;
