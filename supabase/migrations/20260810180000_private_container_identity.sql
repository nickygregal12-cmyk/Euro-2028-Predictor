-- ---------------------------------------------------------------------------
-- Contract 152 — the private container's identity, and the invite-code
-- namespace it shares with a league.
--
-- THIS IS THE FOUNDATION `MIG-UI-05` AND `MIG-UI-06` BOTH NEED, and it is a
-- separate contract because it is one decision serving two, not half of each.
--
-- WHAT WAS MEASURED, rather than assumed. `public.bonus_competitions` carries
-- `visibility_kind` with `'private'` already permitted by its own check
-- constraint, and a private Championship has existed on hosted Development
-- since the contract 133 seed. But the table has **no name, no owner and no
-- invite code**. So a private competition today cannot be called anything, has
-- nobody who owns it, and cannot be joined by anyone who was not inserted by
-- hand. That is why `MIG-UI-05`/`06` are "creation, invite and join" rather
-- than "a flag".
--
-- ---------------------------------------------------------------------------
-- WHY THE CODE NAMESPACE IS SHARED AND DB-ENFORCED
-- ---------------------------------------------------------------------------
--
-- `leagues.invite_code` is unique. The obvious move is a second unique
-- `invite_code` on `bonus_competitions` — and it is wrong, because two
-- independent unique constraints do not make one namespace. `ABC123` could be
-- a league to one player and a private Championship to another, and
-- `MIG-UI-07` asks for ONE code entry point. A resolver over two columns
-- would have to pick a winner, and whichever it picked would send somebody to
-- the wrong competition.
--
-- Nor can a check constraint span two tables. So the namespace gets its own
-- relation: `public.invite_code_registry`, whose PRIMARY KEY is the code
-- itself. Both sides write to it through a trigger, so a collision is a
-- primary-key violation raised by PostgreSQL rather than a race nobody
-- notices.
--
-- IT IS A TRIGGER RATHER THAN A REWRITE OF `create_game_league`. That function
-- ships, works, and already retries on `unique_violation` up to ten times —
-- which is exactly what a registry collision raises. So the league path gains
-- cross-table safety without a line of its logic moving, and the existing
-- retry loop becomes the collision handler for free. Rewriting a working
-- allocator to make a new feature possible is how working allocators break.
--
-- The registry also carries the TARGET, so `MIG-UI-07`'s resolver is a single
-- primary-key lookup rather than a union of two searches that could disagree.
-- Exactly one target is set, enforced by a check.
--
-- Existing league codes are backfilled, because a namespace that only knows
-- about codes issued after today would happily reissue one issued yesterday.
--
-- ---------------------------------------------------------------------------
-- WHAT THIS DOES NOT DO
-- ---------------------------------------------------------------------------
--
-- It creates no competition, opens no game, and grants nothing to a browser
-- role. `bonus_competitions` has row-level security on with zero policies and
-- no browser grant, and that is untouched: these columns are writable only by
-- the definer functions contracts 153 and 154 add. Nothing here lets a player
-- name, own or join anything yet — it gives those contracts somewhere to put
-- the answer.
-- ---------------------------------------------------------------------------

-- ---------------------------------------------------------------------------
-- 1. The private container's identity.
-- ---------------------------------------------------------------------------

alter table public.bonus_competitions
  add column if not exists name text,
  add column if not exists owner_id uuid,
  add column if not exists invite_code text;

-- The reference is a named constraint of its own rather than inline on the
-- column, so the account-deletion matrix can read which column it is. An
-- inline `add column if not exists owner_id uuid references ...` parses as
-- `unknown`, and a deletion guard that cannot name the column it is pinning is
-- not pinning anything.
--
-- `restrict` matches `leagues.owner_id`, measured rather than assumed: a
-- private competition is a thing its owner made and other people joined, so
-- erasing the account must be a decision about the competition too, not a
-- silent cascade. Stage C2 erasure is issue #272 and owns that decision.
do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'bonus_competitions_owner_fk'
  ) then
    alter table public.bonus_competitions
      add constraint bonus_competitions_owner_fk
      foreign key (owner_id) references auth.users(id) on delete restrict;
  end if;
end;
$$;

-- A public competition is named by its game definition and owned by the
-- platform; a private one is named and owned by the person who created it.
-- Stated as constraints so the distinction cannot rot into convention.
--
-- THE IDENTITY CONSTRAINT IS `NOT VALID`, DELIBERATELY, and this is measured
-- rather than defensive. Hosted Development holds exactly one private
-- competition — `d3fa0007-2026-4808-8000-000000000001`, an unpublished
-- Scottish Championship written by the contract 133 seed before any of this
-- existed. It has no owner, because nothing had an owner then.
--
-- `NOT VALID` enforces the rule on every INSERT and every UPDATE from now on,
-- and declines to retroactively reject that one row. The alternative was to
-- invent an owner for a competition nobody created, which would put a false
-- fact in the database to make a constraint look tidy. A legacy row that
-- cannot be updated until someone gives it a real identity is the honest
-- outcome, and Production holds no private competition at all.
do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'bonus_competitions_private_identity'
  ) then
    alter table public.bonus_competitions
      add constraint bonus_competitions_private_identity
      check (
        case
          when visibility_kind = 'private'
            then name is not null and owner_id is not null and invite_code is not null
          else name is null and owner_id is null and invite_code is null
        end
      ) not valid;
  end if;

  if not exists (
    select 1 from pg_constraint where conname = 'bonus_competitions_name_length'
  ) then
    alter table public.bonus_competitions
      add constraint bonus_competitions_name_length
      check (name is null or (length(btrim(name)) between 1 and 40));
  end if;

  -- The same shape a league code has, so one namespace cannot hold two
  -- different notions of what a code looks like.
  if not exists (
    select 1 from pg_constraint where conname = 'bonus_competitions_invite_code_shape'
  ) then
    alter table public.bonus_competitions
      add constraint bonus_competitions_invite_code_shape
      check (invite_code is null or invite_code ~ '^[A-Z0-9]{6}$');
  end if;
end;
$$;

create unique index if not exists bonus_competitions_invite_code_key
  on public.bonus_competitions (invite_code)
  where invite_code is not null;

-- ---------------------------------------------------------------------------
-- 2. The shared namespace.
-- ---------------------------------------------------------------------------

create table if not exists public.invite_code_registry (
  code text primary key,
  league_id uuid references public.leagues(id) on delete cascade,
  competition_id uuid references public.bonus_competitions(id) on delete cascade,
  created_at timestamptz not null default now(),
  constraint invite_code_registry_shape check (code ~ '^[A-Z0-9]{6}$'),
  -- Exactly one target. A row naming both would make the resolver ambiguous,
  -- which is the whole failure this table exists to prevent.
  constraint invite_code_registry_one_target check (
    (league_id is not null)::integer + (competition_id is not null)::integer = 1
  )
);

alter table public.invite_code_registry enable row level security;

-- No policy, and no browser grant. The registry is read through the contract
-- 155 resolver, never directly: a table a player can select from is a table a
-- player can enumerate codes from.
revoke all on table public.invite_code_registry from public, anon, authenticated;

create index if not exists invite_code_registry_league_idx
  on public.invite_code_registry (league_id) where league_id is not null;
create index if not exists invite_code_registry_competition_idx
  on public.invite_code_registry (competition_id) where competition_id is not null;

-- ---------------------------------------------------------------------------
-- 3. Both sides register their code, by trigger.
-- ---------------------------------------------------------------------------

create or replace function predictor_internal.register_league_invite_code()
returns trigger
language plpgsql
security definer
set search_path = ''
as $register$
begin
  if tg_op = 'UPDATE' and new.invite_code is not distinct from old.invite_code then
    return new;
  end if;

  if tg_op = 'UPDATE' and old.invite_code is not null then
    delete from public.invite_code_registry where code = old.invite_code;
  end if;

  insert into public.invite_code_registry (code, league_id)
  values (new.invite_code, new.id);

  return new;
end;
$register$;

create or replace function predictor_internal.register_competition_invite_code()
returns trigger
language plpgsql
security definer
set search_path = ''
as $register$
begin
  if new.invite_code is null then
    if tg_op = 'UPDATE' and old.invite_code is not null then
      delete from public.invite_code_registry where code = old.invite_code;
    end if;
    return new;
  end if;

  if tg_op = 'UPDATE' and new.invite_code is not distinct from old.invite_code then
    return new;
  end if;

  if tg_op = 'UPDATE' and old.invite_code is not null then
    delete from public.invite_code_registry where code = old.invite_code;
  end if;

  insert into public.invite_code_registry (code, competition_id)
  values (new.invite_code, new.id);

  return new;
end;
$register$;

revoke all on function predictor_internal.register_league_invite_code() from public, anon, authenticated, service_role;
revoke all on function predictor_internal.register_competition_invite_code() from public, anon, authenticated, service_role;

drop trigger if exists trg_register_league_invite_code on public.leagues;
create trigger trg_register_league_invite_code
  after insert or update of invite_code on public.leagues
  for each row execute function predictor_internal.register_league_invite_code();

drop trigger if exists trg_register_competition_invite_code on public.bonus_competitions;
create trigger trg_register_competition_invite_code
  after insert or update of invite_code on public.bonus_competitions
  for each row execute function predictor_internal.register_competition_invite_code();

-- ---------------------------------------------------------------------------
-- 4. Backfill, so yesterday's codes are in the namespace too.
-- ---------------------------------------------------------------------------

insert into public.invite_code_registry (code, league_id)
select league.invite_code, league.id
  from public.leagues league
 where league.invite_code is not null
on conflict (code) do nothing;

-- ---------------------------------------------------------------------------
-- 5. The allocator both private containers use.
--
-- It exists here rather than in each container's contract so the two cannot
-- drift into allocating differently. It never inserts: the caller supplies the
-- code to its own insert, and the trigger is what makes it unique. Returning a
-- candidate that is free *now* is a hint, not a guarantee, which is why the
-- caller must still retry on `unique_violation` exactly as the league path
-- does.
-- ---------------------------------------------------------------------------

create or replace function predictor_internal.allocate_invite_code()
returns text
language plpgsql
volatile
security definer
set search_path = ''
as $allocate$
declare
  v_code text;
  v_try integer := 0;
begin
  loop
    v_try := v_try + 1;
    v_code := public.gen_invite_code();

    if not exists (select 1 from public.invite_code_registry where code = v_code) then
      return v_code;
    end if;

    if v_try >= 20 then
      raise exception 'Could not allocate an invite code, please retry'
        using errcode = '55006';
    end if;
  end loop;
end;
$allocate$;

revoke all on function predictor_internal.allocate_invite_code() from public, anon, authenticated, service_role;

-- ---------------------------------------------------------------------------
-- Prove the shape, in the same transaction.
-- ---------------------------------------------------------------------------

do $$
declare
  v_leagues integer;
  v_registered integer;
begin
  -- Every existing league code is in the namespace. A partial backfill would
  -- let a new container reissue a code a league already holds.
  select count(*) into v_leagues from public.leagues where invite_code is not null;
  select count(*) into v_registered
    from public.invite_code_registry where league_id is not null;

  if v_registered <> v_leagues then
    raise exception 'Invite code backfill covered % of % leagues', v_registered, v_leagues;
  end if;

  -- The registry is not browser-reachable. A player who can read it can
  -- enumerate every private competition on the platform.
  if exists (
    select 1 from information_schema.table_privileges
     where table_schema = 'public' and table_name = 'invite_code_registry'
       and grantee in ('anon', 'authenticated', 'PUBLIC')
  ) then
    raise exception 'The invite code registry must not be readable by a browser role';
  end if;

  -- The identity columns are gated on visibility, both ways.
  if not exists (
    select 1 from pg_constraint where conname = 'bonus_competitions_private_identity'
  ) then
    raise exception 'A private competition must be required to carry a name, owner and code';
  end if;

  -- The constraint governs new rows. Proven by attempting the thing it exists
  -- to refuse, rather than by reading the catalogue and hoping. Skipped where
  -- there is no season to probe with, so a fresh database does not fail on the
  -- absence of football.
  declare
    v_season uuid;
  begin
    select t.id into v_season
      from public.tournaments t where t.kind = 'league_season' limit 1;

    if v_season is not null then
      begin
        insert into public.bonus_competitions (
          tournament_id, game_key, published, availability_status,
          draw_required, visibility_kind
        ) values (v_season, 'last_man_standing', false, 'inactive', false, 'private');

        raise exception 'A private competition was accepted with no name, owner or invite code';
      exception
        when check_violation then null;   -- refused, which is the point
      end;
    end if;
  end;
end;
$$;
