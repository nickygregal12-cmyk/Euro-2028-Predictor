-- ---------------------------------------------------------------------------
-- Contract 181 — an ordinary private league holds at most 100 members.
--
-- `CAP-003`, approved by [ADR 0028](../../docs/adr/0028-owner-decisions-unblocking-product-work.md)
-- § 3 on 12 August 2026 as the **initial ordinary private-league membership
-- limit**. The ADR is explicit that this is an operating/product limit and not
-- a claim that the architecture may never support a larger league.
--
-- ---------------------------------------------------------------------------
-- WHAT WAS MEASURED
-- ---------------------------------------------------------------------------
--
-- Contract 44 established two site-wide ceilings — public users and TOTAL
-- leagues — in `predictor_internal.operating_limits`, each enforced by a
-- `before insert` trigger holding a fixed advisory lock. There has never been a
-- PER-LEAGUE ceiling of any kind: measured across every migration, nothing
-- counts `league_members` for a league before inserting into it, so an ordinary
-- private league could grow without bound and the only thing standing between
-- it and one is that the invite code has to be shared by hand.
--
-- ---------------------------------------------------------------------------
-- IT IS A TRIGGER, NOT A CHECK IN `join_league`
-- ---------------------------------------------------------------------------
--
-- `public.join_league` is the obvious place and it is the wrong one, because it
-- is not the only writer. `public.create_league` inserts the owner's own
-- `league_members` row directly, and the existing `league_membership` rate
-- limit is itself a trigger on that table precisely so that no writer can be
-- added later that forgets it. A cap enforced in one RPC is a cap the next
-- entry point silently does not have.
--
-- ---------------------------------------------------------------------------
-- THE COUNT IS SERIALISED, AND THAT IS THE WHOLE DIFFICULTY
-- ---------------------------------------------------------------------------
--
-- Counting and then inserting with nothing between the two is exactly the
-- defect contract 145 closed in `enforce_rate_limit`: under the read-committed
-- isolation the Data API uses, two concurrent transactions each observe 99 and
-- both proceed, and the league ends on 101. A limit that can be overshot by
-- running the attempts in parallel is what a scripted client does and a human
-- never does.
--
-- So the trigger takes a transaction-scoped advisory lock keyed on the LEAGUE
-- before it counts — contract 145's idiom, and contract 44's, differing only in
-- that the key is derived from the row rather than fixed, because the counter
-- here is per league rather than site-wide. One key per league and never per
-- caller, so a transaction inserting into one league cannot block a transaction
-- inserting into another, and the function cannot hold two of its own locks.
--
-- ---------------------------------------------------------------------------
-- WHAT THIS DOES NOT DO
-- ---------------------------------------------------------------------------
--
-- **It does not touch Last Man Standing or the Championship.** `league_members`
-- is the ordinary Match Predictor private league's table; a private LMS or
-- Championship container holds its field in `bonus_competition_entrants` and
-- `game_memberships`, neither of which is read or written here. ADR 0013 makes
-- a private Last Man Standing's rules its organiser's, and ADR 0028 § 3 does
-- not extend this figure to either game.
--
-- **There is no organiser exemption**, deliberately. ADR 0028 § 3 says the
-- organiser does not bypass the cap unless a separately authorised admin path
-- exists, and none does. The owner's own membership row counts toward the
-- hundred, because it is a membership.
--
-- **It refuses new members and never removes one.** The trigger fires on insert
-- only, so a league that is somehow already over the limit keeps every member
-- it has and simply admits no more. Deleting somebody to satisfy a ceiling
-- introduced afterwards is not a thing a migration may do.
--
-- **The ceiling's own upper bound is 100**, matching contract 44's pattern
-- rather than leaving an operator free to set any figure. Contract 44 caps
-- `public_user_limit` at 250 and `total_league_limit` at 20 — the approved
-- maxima at the time — so that the setter cannot exceed what was approved and
-- raising it is a migration with an authority behind it. ADR 0028 anticipates a
-- larger limit later "from measured load evidence", which is exactly that
-- migration and exactly that authority.
-- ---------------------------------------------------------------------------

begin;

-- ===========================================================================
-- 1. The configured ceiling, beside the two that already exist.
-- ===========================================================================

alter table predictor_internal.operating_limits
  add column if not exists league_member_limit integer not null default 100;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'operating_limits_league_member_limit_range'
  ) then
    alter table predictor_internal.operating_limits
      add constraint operating_limits_league_member_limit_range
      check (league_member_limit between 1 and 100);
  end if;
end;
$$;

comment on column predictor_internal.operating_limits.league_member_limit is
  'Contract 181 / CAP-003. The maximum membership of ONE ordinary private '
  'league, approved at 100 by ADR 0028 section 3. Site-wide ceilings live '
  'beside it; this one is per league. It does not govern a private Last Man '
  'Standing or Championship container, whose field is not in league_members.';

-- The table was revoked from every role by contract 44 and stays that way. The
-- column inherits that: no browser role can read the ceiling, and
-- `get_public_capacity` is deliberately NOT widened to publish it, because a
-- per-league figure is not an anonymous site-capacity fact and publishing one
-- league's remaining places would say how many members that league has.

-- ===========================================================================
-- 2. Enforcement, serialised per league.
-- ===========================================================================

create or replace function predictor_internal.enforce_league_member_limit()
returns trigger
language plpgsql
security definer
set search_path = ''
as $limit$
declare
  v_limit integer;
  v_used integer;
begin
  -- Keyed on the LEAGUE, so two leagues filling at once do not serialise
  -- against each other. `hashtextextended` with a zero seed is the same
  -- derivation contracts 145 and 166 use for a row-scoped advisory key.
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended('league_member_limit:' || new.league_id::text, 0)
  );

  select limits.league_member_limit
    into v_limit
    from predictor_internal.operating_limits limits
    where limits.singleton;

  if v_limit is null then
    raise exception 'League membership configuration is unavailable'
      using errcode = '55000';
  end if;

  select count(*)::integer
    into v_used
    from public.league_members member
    where member.league_id = new.league_id;

  if v_used >= v_limit then
    raise exception 'This league is full.'
      using errcode = 'PT429',
            detail = 'league_member_limit_reached';
  end if;

  return new;
end;
$limit$;

revoke all on function predictor_internal.enforce_league_member_limit()
  from public, anon, authenticated, service_role;

-- `before insert` only. An update never adds a member — `league_members` is
-- keyed on `(league_id, user_id)` — and firing on update would recount on every
-- role change for no benefit.
drop trigger if exists enforce_league_member_limit on public.league_members;
create trigger enforce_league_member_limit
before insert on public.league_members
for each row
execute function predictor_internal.enforce_league_member_limit();

-- ===========================================================================
-- 3. The setter, and why it is a new function rather than a third parameter.
-- ===========================================================================
--
-- `public.set_operating_limits(integer, integer)` is the obvious home and
-- cannot be used. Adding a third parameter with a default produces an overload
-- that matches every existing two-argument call, so every existing call becomes
-- ambiguous and fails — contract 171 recorded exactly this about adding a page
-- argument to `get_leaderboard`, and the fix there was to not do it. Dropping
-- and recreating the function would make this migration destructive and force
-- it out of the additive fast lane for no gain.
--
-- So the per-league ceiling gets its own setter, on the same terms as contract
-- 44's: `service_role` and nothing else, and it refuses to set a ceiling below
-- a league that already exists, because that would leave a real league in
-- permanent violation of a limit nobody could satisfy without removing people.

create or replace function public.set_league_member_limit(p_limit integer)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $set$
declare
  v_largest integer;
begin
  if p_limit is null or p_limit < 1 or p_limit > 100 then
    raise exception 'League member limit must be between 1 and 100'
      using errcode = '22023';
  end if;

  -- Every per-league key, in one deterministic order, so two administrators
  -- pressing this together cannot deadlock against each other; then the count.
  perform pg_catalog.pg_advisory_xact_lock(202800030::bigint);

  select coalesce(max(member_count), 0)::integer
    into v_largest
    from (
      select count(*)::integer as member_count
        from public.league_members
       group by league_id
    ) counted;

  if p_limit < v_largest then
    raise exception 'League member limit cannot be below the largest existing league (%)',
      v_largest
      using errcode = 'check_violation';
  end if;

  update predictor_internal.operating_limits limits
     set league_member_limit = p_limit,
         updated_at = now()
   where limits.singleton;

  return jsonb_build_object(
    'leagueMemberLimit', p_limit,
    'largestLeague', v_largest);
end;
$set$;

revoke all on function public.set_league_member_limit(integer)
  from public, anon, authenticated, service_role;
grant execute on function public.set_league_member_limit(integer) to service_role;

-- ===========================================================================
-- 4. Prove what cannot be left to a test file.
-- ===========================================================================

do $$
begin
  if has_function_privilege('anon', 'public.set_league_member_limit(integer)', 'execute')
     or has_function_privilege('authenticated', 'public.set_league_member_limit(integer)', 'execute')
  then
    raise exception 'The operating ceiling must not be settable from a browser role';
  end if;

  if not exists (
    select 1 from pg_trigger
     where tgname = 'enforce_league_member_limit'
       and tgrelid = 'public.league_members'::regclass
       and not tgisinternal
  ) then
    raise exception 'The cap must be enforced on the table, not in one entry point';
  end if;

  -- The trigger must serialise before it counts. A cap that reads and then
  -- writes with nothing between them is the DATA-007 defect contract 145
  -- closed, and it is invisible in every single-threaded test.
  if pg_catalog.pg_get_functiondef(
       'predictor_internal.enforce_league_member_limit()'::regprocedure
     ) !~ 'pg_advisory_xact_lock' then
    raise exception 'The membership cap must take an advisory lock before counting';
  end if;

  if (select league_member_limit from predictor_internal.operating_limits where singleton) <> 100 then
    raise exception 'CAP-003 approves 100, and the installed ceiling must be that figure';
  end if;
end;
$$;

commit;
