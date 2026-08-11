-- Contract 152 — SEC-001: invite codes that cannot be enumerated cheaply.
--
-- WHAT WAS WRONG, MEASURED AT `20260719180000_add_leagues.sql`.
--
--   1. `gen_invite_code()` drew six characters from a 31-character alphabet
--      using `random()`. That is a seeded pseudo-random generator, not a
--      cryptographic one: its output is reproducible from its state, and six
--      characters is a 31^6 space — about 887 million — small enough that the
--      keyspace is not what protects a league.
--   2. `get_league_preview` answered ANY authenticated caller's guess with the
--      league's id, name, member count, owner display name and whether the
--      caller was already in it. That is a confirmation oracle: it turns a
--      guess into a positively identified private group, complete with the name
--      of a real person.
--   3. Nothing charged for a wrong guess. The 5/min membership limit is a
--      trigger on `league_members`, so it fires on a SUCCESSFUL join and never
--      on a failed one — and `get_league_preview` inserted nothing at all, so
--      previewing was entirely free. An attacker was rate-limited only on the
--      one action they were not trying to perform.
--   4. A leaked code was permanent. There was no way to rotate one, so an
--      invite posted publicly by mistake could only be escaped by deleting the
--      league.
--
-- Contract 145 fixed the fourth thing SEC-001 needed — the limiter is atomic
-- now — and this contract takes the other three, plus rotation.
--
-- WHAT THIS DOES NOT DO. It does not touch a single existing row. Codes already
-- issued keep working and keep their six characters until an owner rotates
-- them; `rotate_league_invite_code` is how, and doing it for them would
-- invalidate outstanding invitations that people are holding. That is an
-- operator decision with a blast radius, not a migration's to take, and it is
-- recorded as the remainder rather than quietly performed here.
--
-- It moves no scoring, lock, settlement, progression or reveal rule, and it
-- changes no membership rule: who may join, and on what terms, is exactly as it
-- was.

-- ===========================================================================
-- 1. A cryptographically secure generator
-- ===========================================================================
-- `extensions.gen_random_bytes` is pgcrypto's CSPRNG, already installed by
-- `20260719120000_init_v0_1.sql`.
--
-- REJECTION SAMPLING, AND WHY THE OBVIOUS VERSION IS WRONG. The alphabet holds
-- 31 characters and a byte holds 256 values. `byte % 31` is not uniform:
-- 256 = 8*31 + 8, so the first eight characters of the alphabet come up nine
-- times in 256 and the rest eight times — a 12.5% bias toward a quarter of the
-- alphabet, on every character. Bytes at or above 248 (= 8*31) are therefore
-- discarded and redrawn, which costs a few extra bytes and buys an exactly
-- uniform code.
--
-- TWELVE CHARACTERS, not the ten SEC-001 asks for as a minimum. 31^12 is about
-- 7.9e17, roughly 2^59, and twelve divides into three groups of four for
-- reading aloud. The alphabet still omits 0/O and 1/I/L, because a code nobody
-- can dictate over the phone gets pasted into a public channel instead.
create or replace function gen_invite_code() returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  alphabet   text := 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
  size       int  := length(alphabet);   -- 31
  ceiling    int  := (256 / size) * size; -- 248: the largest unbiased multiple
  wanted     int  := 12;
  code       text := '';
  buffer     bytea;
  b          int;
  i          int;
begin
  while length(code) < wanted loop
    -- Drawn in blocks rather than one byte at a time: at 248/256 acceptance a
    -- block of the remaining length almost always finishes the code.
    buffer := extensions.gen_random_bytes(wanted - length(code) + 4);
    for i in 0..(octet_length(buffer) - 1) loop
      exit when length(code) >= wanted;
      b := get_byte(buffer, i);
      if b < ceiling then
        code := code || substr(alphabet, 1 + (b % size), 1);
      end if;
    end loop;
  end loop;

  return code;
end;
$$;

revoke all on function gen_invite_code() from public;

-- ===========================================================================
-- 2. Room for the longer code, without invalidating the shorter ones
-- ===========================================================================
-- The constraint accepted exactly six characters. It now accepts six to
-- sixteen: six so that every code already issued stays valid and every league
-- keeps working, sixteen so a later change of length needs no second migration.
-- The character class is unchanged, so nothing that failed the old constraint
-- passes the new one.
alter table public.leagues
  drop constraint if exists leagues_invite_code_check;

alter table public.leagues
  add constraint leagues_invite_code_check
  check (invite_code ~ '^[A-Z0-9]{6,16}$');

-- ===========================================================================
-- 3. A wrong guess has to cost something
-- ===========================================================================
-- `league_invite_probe` is a NEW limiter action rather than a reuse of
-- `league_membership`, and the separation is the point: joining a league you
-- were invited to and hunting for one you were not are different activities,
-- and sharing a budget would mean either throttling real members or funding
-- real probing. Twenty a minute is generous for a person typing a code they
-- were sent — including getting it wrong twice — and ruinous for anything
-- working through a keyspace, which needs the number of attempts a scripted
-- client makes rather than the number a human does.
--
-- Charged BEFORE the lookup in both functions, so a miss costs exactly what a
-- hit costs. A limiter that only charges for success is the one that was there
-- before.

-- --- get_league_preview: minimal payload, and no longer free -----------------
--
-- WHAT IT NO LONGER RETURNS: `id`, `member_count` and `owner_name`. A join
-- screen needs to tell you what you are being asked to join, which is the
-- league's name, and whether you are already in it, which decides the button.
-- Member count and owner name are the fields that identify WHICH private group
-- a guessed code belongs to, and the owner's display name is another person's
-- identity disclosed to someone who typed six characters. The id was returned
-- and never read.
--
-- It was `language sql` and `stable`; charging the limiter is a write, so it is
-- now `plpgsql` and volatile. PostgREST calls RPCs with POST either way.
--
-- DROPPED AND RECREATED, NOT REPLACED, AND THAT COSTS THIS MIGRATION THE FAST
-- LANE. PostgreSQL refuses `create or replace` when a function's OUT-parameter
-- row type changes — `cannot change return type of existing function
-- (SQLSTATE 42P13)` — and narrowing five columns to two is exactly that. The
-- Database parity job caught it by rebuilding every committed migration on a
-- disposable local database; nothing that reads the SQL could have.
--
-- The alternative was contract 131's idiom: leave the old signature defined,
-- revoke it, and add the replacement under a new name. That is rejected here
-- for a specific reason rather than a stylistic one. `get_league_preview` is a
-- LIVE browser call, and since `TYPE-001` closed the browser can only call an
-- RPC that hosted Development already has — so a renamed function would be a
-- compile error today and the existing call would keep pointing at a revoked
-- name until the rollout and a type regeneration caught up. Keeping the name
-- keeps the browser working across the rollout; the fixture reads `name` and
-- `is_member`, which exist in both shapes.
--
-- `drop function` is DESTRUCTIVE to `check-migration-additive.mjs`, correctly:
-- narrowing a return type removes a guarantee a caller may rely on. Contract
-- 152 therefore goes through the guarded rollout with its backup and restore
-- rehearsal, not the additive fast lane.
drop function if exists public.get_league_preview(text);

create function public.get_league_preview(p_code text)
returns table (name text, is_member boolean)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
begin
  if v_uid is null then
    raise exception 'Not authenticated'
      using errcode = 'insufficient_privilege';
  end if;

  perform public.enforce_rate_limit('league_invite_probe', 20);

  return query
    select league.name,
           exists (select 1 from public.league_members membership
                   where membership.league_id = league.id
                     and membership.user_id = v_uid)
    from public.leagues league
    where league.invite_code = upper(btrim(p_code));
end;
$$;

-- THE DROP TOOK THE GRANTS WITH IT, so both roles are restated. `service_role`
-- is not an afterthought here: `20260724001500_harden_function_privileges.sql`
-- grants every league function to `authenticated, service_role`, and an earlier
-- draft of this migration restated only `authenticated` — which silently
-- removed a privilege while claiming to add a rate limit.
-- `080_function_privileges.sql` caught it, which is what that suite is for.
revoke all on function public.get_league_preview(text) from public;
grant execute on function public.get_league_preview(text) to authenticated, service_role;

-- --- join_league: the same charge, before the lookup ------------------------
-- Redefined because the limiter has to be charged on the path that ACTS on a
-- code, not only the one that inspects it. Otherwise the preview is limited and
-- the join is not, and an attacker simply stops previewing. The membership
-- trigger still applies on top, unchanged: this adds a charge, it does not
-- replace one.
--
-- THE BODY IS `20260803070000_c1b_game_catalogue_memberships.sql`'s, VERBATIM,
-- WITH ONE LINE ADDED. An earlier draft of this migration rebuilt it from the
-- 19 July original instead and silently dropped two things: the game-membership
-- gate — *"Join this league game before joining its private league"* — and the
-- pinned empty `search_path`. Deleting a membership rule while claiming to add
-- a rate limit is precisely the kind of change this repository forbids doing
-- quietly, and it is recorded here rather than fixed in silence.
create or replace function public.join_league(
  p_code text
)
returns table(id uuid, name text)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
  v_id uuid;
  v_game_id uuid;
begin
  if v_uid is null then
    raise exception 'Not authenticated'
      using errcode = 'insufficient_privilege';
  end if;

  -- THE ONE ADDED LINE, and its position is the fix: before the lookup, so a
  -- miss costs exactly what a hit costs.
  perform public.enforce_rate_limit('league_invite_probe', 20);

  select league.id, league.game_competition_id
    into v_id, v_game_id
    from public.leagues league
    where league.invite_code = upper(btrim(p_code));

  if v_id is null then
    raise exception 'That invite code does not match a league'
      using errcode = 'no_data_found';
  end if;

  if not exists (
    select 1 from public.game_memberships membership
    where membership.game_competition_id = v_game_id
      and membership.user_id = v_uid
      and membership.status = 'active'
  ) then
    raise exception 'Join this league game before joining its private league'
      using errcode = 'insufficient_privilege';
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

-- `join_league` was replaced rather than dropped, so its grants survived — but
-- restating only `authenticated` here would have REVOKED `service_role`. Both
-- are named for the same reason as above.
revoke all on function public.join_league(text) from public;
grant execute on function public.join_league(text) to authenticated, service_role;

-- ===========================================================================
-- 4. Rotation, so a leaked code is recoverable
-- ===========================================================================
-- OWNER ONLY, and deliberately not "any admin of the league": rotating is what
-- you do when a code has escaped, and it invalidates every invitation already
-- sent. That is the owner's call.
--
-- There is no separate "revoke". Rotating IS revoking — the old code stops
-- matching the moment the new one is stored — and a league with no usable code
-- would be a state nothing else in this schema knows how to describe.
create or replace function rotate_league_invite_code(p_league_id uuid)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid  uuid := (select auth.uid());
  v_code text;
  v_try  int := 0;
begin
  if v_uid is null then
    raise exception 'Not authenticated' using errcode = 'insufficient_privilege';
  end if;

  if not exists (
    select 1 from public.leagues league
     where league.id = p_league_id and league.owner_id = v_uid
  ) then
    -- Same refusal whether the league does not exist or is not the caller's, so
    -- this cannot be used to discover which league ids are real.
    raise exception 'Only the league owner can change its invite code'
      using errcode = 'insufficient_privilege';
  end if;

  -- Rotating is a write on the caller's own league and is not invite probing,
  -- but it is still cheap to script, so it carries the membership budget.
  perform public.enforce_rate_limit('league_membership', 5);

  loop
    v_try := v_try + 1;
    v_code := gen_invite_code();
    begin
      update public.leagues set invite_code = v_code where id = p_league_id;
      exit;
    exception when unique_violation then
      if v_try >= 10 then
        raise exception 'Could not allocate an invite code, please retry';
      end if;
    end;
  end loop;

  return v_code;
end;
$$;

revoke all on function public.rotate_league_invite_code(uuid) from public;
grant execute on function public.rotate_league_invite_code(uuid) to authenticated, service_role;

-- ===========================================================================
-- 5. The private containers, which learned about codes after this was written
-- ===========================================================================
-- THIS SECTION EXISTS BECAUSE THIS CONTRACT WOULD OTHERWISE BREAK PRODUCTION,
-- and the break is silent until somebody tries to create a private
-- competition.
--
-- This migration was authored against a repository where `gen_invite_code()`
-- had exactly one caller: the league path. Contracts 152 to 155 landed in
-- between and gave it a second family of callers —
-- `predictor_internal.allocate_invite_code()` feeds
-- `create_private_season_lms` and `create_private_season_cup`, and both write
-- the result into `bonus_competitions.invite_code`, which the shared
-- `invite_code_registry` then mirrors by trigger.
--
-- Section 1 widens the generator to twelve characters. Section 2 widened the
-- LEAGUE constraint to match. The private side was pinned to exactly six in
-- three places, and each is a real failure rather than a theoretical one:
--
--   1. `bonus_competitions_invite_code_shape` — creating any private
--      competition raises check_violation, so the feature is simply dead.
--   2. `invite_code_registry_shape` — even were the first widened, the
--      registering trigger fails and takes the creating transaction with it.
--   3. `resolve_invite_code` rejects anything that is not exactly six
--      characters BEFORE it looks anything up, and answers `found: false`. So
--      every code issued after this contract would read as an unknown code —
--      the failure that looks like a wrong code rather than a broken one, and
--      therefore the one nobody would report as a bug.
--
-- The same widening, for the same reason: six so that every code already
-- issued keeps working, sixteen so the twelve the generator now produces fits
-- with room left. Contracts 152 to 157 are already applied to both hosted
-- environments, so these arrive as ALTERs here rather than as edits there.

alter table public.bonus_competitions
  drop constraint if exists bonus_competitions_invite_code_shape;

alter table public.bonus_competitions
  add constraint bonus_competitions_invite_code_shape
  check (invite_code is null or invite_code ~ '^[A-Z0-9]{6,16}$');

alter table public.invite_code_registry
  drop constraint if exists invite_code_registry_shape;

alter table public.invite_code_registry
  add constraint invite_code_registry_shape
  check (code ~ '^[A-Z0-9]{6,16}$');

-- Only the accepted shape moves. Every other line is contract 155's, verbatim:
-- the disclosure boundary, the identical answer for an unknown and an
-- unusable code, and the single primary-key lookup over the shared namespace
-- are unchanged.
create or replace function public.resolve_invite_code(p_code text)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $resolve$
declare
  v_uid uuid := (select auth.uid());
  v_code text := upper(btrim(coalesce(p_code, '')));
  v_registry record;
  v_league record;
  v_competition record;
begin
  if v_uid is null then
    raise exception 'Not authenticated' using errcode = 'insufficient_privilege';
  end if;

  -- Six to sixteen, matching the generator and both container constraints. A
  -- malformed code is still not found rather than invalid, for the reason
  -- contract 155 gave: both answers must look identical from outside.
  if v_code !~ '^[A-Z0-9]{6,16}$' then
    return jsonb_build_object('found', false);
  end if;

  select registry.league_id, registry.competition_id
    into v_registry
    from public.invite_code_registry registry
    where registry.code = v_code;

  if v_registry is null then
    return jsonb_build_object('found', false);
  end if;

  if v_registry.league_id is not null then
    select league.id, league.name, league.game_competition_id,
           season.name as season_name, season.kind as season_kind,
           definition.display_name as game_name,
           (select count(*) from public.league_members member
             where member.league_id = league.id) as members,
           exists (select 1 from public.league_members mine
                    where mine.league_id = league.id and mine.user_id = v_uid) as is_member,
           exists (select 1 from public.game_memberships membership
                    where membership.game_competition_id = league.game_competition_id
                      and membership.user_id = v_uid
                      and membership.status = 'active') as holds_game
      into v_league
      from public.leagues league
      join public.tournaments season on season.id = league.tournament_id
      left join public.bonus_competitions competition on competition.id = league.game_competition_id
      left join public.game_definitions definition on definition.game_key = competition.game_key
      where league.id = v_registry.league_id;

    return jsonb_build_object(
      'found', true,
      'kind', 'league',
      'id', v_league.id,
      'name', v_league.name,
      'season', v_league.season_name,
      'game', v_league.game_name,
      'members', v_league.members,
      'already_in', v_league.is_member,
      'requires_game_entry', not v_league.holds_game,
      'join_with', 'join_league');
  end if;

  select competition.id, competition.name, competition.game_key,
         competition.registration_closes_at, competition.completed_at,
         competition.owner_id,
         season.name as season_name,
         definition.display_name as game_name,
         (select count(*) from public.game_memberships membership
           where membership.game_competition_id = competition.id
             and membership.status = 'active') as members,
         exists (select 1 from public.game_memberships mine
                  where mine.game_competition_id = competition.id
                    and mine.user_id = v_uid
                    and mine.status = 'active') as is_member
    into v_competition
    from public.bonus_competitions competition
    join public.tournaments season on season.id = competition.tournament_id
    join public.game_definitions definition on definition.game_key = competition.game_key
    where competition.id = v_registry.competition_id;

  return jsonb_build_object(
    'found', true,
    'kind', 'competition',
    'id', v_competition.id,
    'name', v_competition.name,
    'season', v_competition.season_name,
    'game', v_competition.game_name,
    'game_key', v_competition.game_key,
    'members', v_competition.members,
    'already_in', v_competition.is_member,
    'is_owner', v_competition.owner_id = v_uid,
    'closed', v_competition.completed_at is not null
              or (v_competition.registration_closes_at is not null
                  and now() >= v_competition.registration_closes_at),
    'join_with', 'join_private_competition');
end;
$resolve$;

revoke all on function public.resolve_invite_code(text) from public, anon;
grant execute on function public.resolve_invite_code(text) to authenticated;

-- ---------------------------------------------------------------------------
-- Prove the private path survives this contract, in the same transaction.
-- ---------------------------------------------------------------------------

do $$
declare
  v_code text;
begin
  -- The generator's own output must satisfy every constraint that now receives
  -- it. Asserted against a real generated code rather than against the pattern,
  -- because the pattern is what was wrong.
  v_code := public.gen_invite_code();

  if v_code !~ '^[A-Z0-9]{6,16}$' then
    raise exception 'gen_invite_code produced % which no container will accept', v_code;
  end if;

  if not exists (
    select 1 from pg_constraint
     where conname = 'bonus_competitions_invite_code_shape'
       and pg_get_constraintdef(oid) like '%6,16%'
  ) then
    raise exception 'The private competition code constraint was not widened';
  end if;

  if not exists (
    select 1 from pg_constraint
     where conname = 'invite_code_registry_shape'
       and pg_get_constraintdef(oid) like '%6,16%'
  ) then
    raise exception 'The shared registry code constraint was not widened';
  end if;

  if pg_get_functiondef('public.resolve_invite_code(text)'::regprocedure) !~ '6,16' then
    raise exception 'The resolver still refuses every code this contract issues';
  end if;
end;
$$;
