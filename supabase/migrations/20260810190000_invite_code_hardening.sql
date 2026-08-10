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
set search_path = public
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
create or replace function get_league_preview(p_code text)
returns table (name text, is_member boolean)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
begin
  if v_uid is null then
    raise exception 'Not authenticated' using errcode = 'insufficient_privilege';
  end if;

  perform enforce_rate_limit('league_invite_probe', 20);

  return query
    select l.name,
           exists (select 1 from league_members m
                   where m.league_id = l.id and m.user_id = v_uid)
    from leagues l
    where l.invite_code = upper(btrim(p_code));
end;
$$;

revoke all on function get_league_preview(text) from public;
grant execute on function get_league_preview(text) to authenticated;

-- --- join_league: the same charge, before the lookup ------------------------
-- Redefined rather than left alone because the limiter has to be charged on the
-- path that ACTS on a code, not only the one that inspects it. Otherwise the
-- preview is limited and the join is not, and an attacker simply stops
-- previewing. The membership trigger still applies on top, unchanged: this adds
-- a charge, it does not replace one.
--
-- Everything else is verbatim from `20260803070000_c1b_game_catalogue_memberships.sql`.
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

  perform enforce_rate_limit('league_invite_probe', 20);

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

revoke all on function join_league(text) from public;
grant execute on function join_league(text) to authenticated;

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
set search_path = public
as $$
declare
  v_uid  uuid := auth.uid();
  v_code text;
  v_try  int := 0;
begin
  if v_uid is null then
    raise exception 'Not authenticated' using errcode = 'insufficient_privilege';
  end if;

  if not exists (
    select 1 from leagues l where l.id = p_league_id and l.owner_id = v_uid
  ) then
    -- Same refusal whether the league does not exist or is not the caller's, so
    -- this cannot be used to discover which league ids are real.
    raise exception 'Only the league owner can change its invite code'
      using errcode = 'insufficient_privilege';
  end if;

  -- Rotating is a write on the caller's own league and is not invite probing,
  -- but it is still cheap to script, so it carries the membership budget.
  perform enforce_rate_limit('league_membership', 5);

  loop
    v_try := v_try + 1;
    v_code := gen_invite_code();
    begin
      update leagues set invite_code = v_code where id = p_league_id;
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

revoke all on function rotate_league_invite_code(uuid) from public;
grant execute on function rotate_league_invite_code(uuid) to authenticated;
