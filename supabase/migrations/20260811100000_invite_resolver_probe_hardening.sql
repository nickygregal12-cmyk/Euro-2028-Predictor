-- ---------------------------------------------------------------------------
-- Contract 159 — the half of SEC-001 contract 158 left open on a second door.
--
-- ---------------------------------------------------------------------------
-- WHAT WAS MEASURED
-- ---------------------------------------------------------------------------
--
-- Contract 158 closed `SEC-001` on `get_league_preview` and `join_league`: the
-- preview was narrowed from `(id, name, member_count, owner_name, is_member)`
-- to `(name, is_member)` because "member count and owner name are the fields
-- that identify WHICH private group a guessed code belongs to", and both
-- functions began charging `league_invite_probe` BEFORE the lookup so that a
-- wrong guess costs what a right one does.
--
-- `public.resolve_invite_code(text)` — contract 155, the UNIVERSAL code entry
-- point — received neither. Measured against the committed text of
-- `20260811000000_invite_code_hardening.sql`, which recreates that very
-- function to widen its shape check from `{6}` to `{6,16}` and carries nothing
-- else into it:
--
--   * it is executable by `authenticated` and charges NO limiter of any kind,
--     so probing through it is free where probing through the preview is
--     capped at twenty a minute;
--   * for a league it returns `id`, `name`, `season`, `game`, `members` and
--     `already_in`;
--   * for a private competition it returns `id`, `name`, `season`, `game`,
--     `game_key`, `members`, `already_in`, `is_owner` and `closed`.
--
-- So after contract 158 the narrowed, rate-limited preview and the wide,
-- unlimited resolver both answer the same guessed code, and an attacker uses
-- the second. `member_count` — the field SEC-001 names by name — is still
-- returned, for private Last Man Standing and Championship containers as well
-- as for leagues, which contract 158 could not have covered because those
-- containers did not exist when its finding was written.
--
-- This is not a criticism of contract 158 recorded after the fact. It is the
-- ordinary consequence of two contracts landing in the same batch: 155 created
-- the second door on 10 August and 158 hardened the first on 11 August, and
-- nothing in either was wrong on its own.
--
-- ---------------------------------------------------------------------------
-- WHAT THIS CHANGES, AND WHAT IT DELIBERATELY DOES NOT
-- ---------------------------------------------------------------------------
--
-- 1. THE LIMITER IS CHARGED FIRST, before the shape check and before the
--    registry lookup. Position is the whole fix: charging after the shape check
--    would leave a malformed guess free, and a keyspace search sends malformed
--    guesses too. It is the SAME `league_invite_probe` action and the SAME
--    ceiling of twenty a minute as contract 158, deliberately, so that the
--    three doors share one budget. Giving the resolver its own action would
--    hand an attacker forty attempts a minute across two functions and would
--    look, in the limiter log, like two well-behaved callers.
--
--    Charging the limiter is a write, so the function stops being `stable`.
--    Contract 155's own DO block asserted `stable` and asserted that the
--    resolver writes nothing; both assertions were one-shot statements inside
--    that migration's transaction and neither is a live constraint. The reason
--    for `stable` was that a resolver is not a join — that reason is preserved
--    and re-asserted below in the form that still holds: it writes no league,
--    no competition and no membership. Charging a rate limit is not joining
--    anything.
--
-- 2. `members` AND `id` GO, for both container kinds. `members` is the SEC-001
--    field verbatim. `id` was the other field contract 158 removed, and it is
--    removable here for the same measured reason: BOTH joins take a code —
--    `join_league(p_code text)` and contract 153's
--    `join_private_competition(p_code text)` — so no caller needs the target's
--    id to act on the code it already holds. Contract 155's own header claims
--    the resolver "never returns the code's target id when the caller cannot
--    act on it", and its body returned it unconditionally. That claim becomes
--    true here.
--
-- 3. `name`, `season`, `game` AND `game_key` STAY. `name` stays because the
--    narrowed `get_league_preview` keeps it, and a join screen that cannot say
--    what it is asking you to join is not a join screen. `season` and `game`
--    are facts about the PUBLIC competition the container hangs off — "Premier
--    League 2026/27", "Last Man Standing" — and identify no private group and
--    no person. They are what lets one entry point route a code without the
--    browser guessing the container type, which is the whole of `MIG-UI-07`.
--
-- 4. `is_owner` STAYS. It is computed from the caller's own `auth.uid()` and
--    discloses nothing about a third party: it tells a caller a fact about
--    themselves. It is what distinguishes an organiser who pasted their own
--    code from a stranger who guessed it, and removing it would make the
--    resolver route an owner to a Join button for a competition they created.
--    `owner_id` itself is never returned, then or now.
--
-- 5. `already_in`, `requires_game_entry` and `closed` STAY. Each decides which
--    control the client renders, each is caller-relative or a property of the
--    container's lifecycle rather than of its membership, and without them the
--    single entry point shows buttons the membership authority will refuse.
--
-- NOTHING ELSE MOVES. No relation, policy, trigger, grant, threshold or
-- generator changes. It creates and joins nothing, and it changes no scoring,
-- lock, settlement, progression, membership or reveal rule. An unknown code, a
-- malformed code and a code the caller cannot use still answer identically,
-- which is the property that stops the alphabet being worked through.
--
-- Additive by `check-migration-additive.mjs`: one `create or replace function`
-- and one `do` block that reads catalogues. The return type is `jsonb`, which
-- does not change, so unlike contract 158 this needs no drop and keeps the fast
-- lane.
-- ---------------------------------------------------------------------------

create or replace function public.resolve_invite_code(p_code text)
returns jsonb
language plpgsql
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

  -- THE ADDED LINE, and its position is the fix. Before the shape check, so a
  -- malformed guess costs a slot; before the lookup, so a miss costs what a hit
  -- costs. The same action and ceiling as `get_league_preview` and
  -- `join_league`, so all three doors draw on one budget.
  perform public.enforce_rate_limit('league_invite_probe', 20);

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

  -- ---------------------------------------------------------------------
  -- A league.
  -- ---------------------------------------------------------------------
  if v_registry.league_id is not null then
    select league.name, league.game_competition_id,
           season.name as season_name,
           definition.display_name as game_name,
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
      'name', v_league.name,
      'season', v_league.season_name,
      'game', v_league.game_name,
      'already_in', v_league.is_member,
      -- `join_league` refuses a caller with no active membership in the
      -- league's game. Saying so here is what lets a client send them to join
      -- the game first instead of showing them a button that will fail.
      'requires_game_entry', not v_league.holds_game,
      'join_with', 'join_league');
  end if;

  -- ---------------------------------------------------------------------
  -- A private competition.
  -- ---------------------------------------------------------------------
  select competition.name, competition.game_key,
         competition.registration_closes_at, competition.completed_at,
         competition.owner_id,
         season.name as season_name,
         definition.display_name as game_name,
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
    'name', v_competition.name,
    'season', v_competition.season_name,
    'game', v_competition.game_name,
    'game_key', v_competition.game_key,
    'already_in', v_competition.is_member,
    -- Caller-relative, and computed from the caller's own uid. `owner_id` is
    -- never returned.
    'is_owner', v_competition.owner_id = v_uid,
    -- Closed is closed, whether because the organiser launched a Championship
    -- or because the competition finished. A client that cannot tell shows a
    -- join button that the membership authority will refuse.
    'closed', v_competition.completed_at is not null
              or (v_competition.registration_closes_at is not null
                  and now() >= v_competition.registration_closes_at),
    'join_with', 'join_private_competition');
end;
$resolve$;

revoke all on function public.resolve_invite_code(text) from public, anon;
grant execute on function public.resolve_invite_code(text) to authenticated;

-- ---------------------------------------------------------------------------
-- Prove it, in the same transaction.
-- ---------------------------------------------------------------------------

do $$
declare
  v_src text := pg_get_functiondef('public.resolve_invite_code(text)'::regprocedure);
begin
  -- The limiter is charged, and charged FIRST. A resolver that charges after
  -- the registry lookup gives a miss away free, which is the defect contract
  -- 158 fixed on the other two doors.
  if v_src !~ 'league_invite_probe' then
    raise exception 'The resolver must charge the invite probe limit';
  end if;

  if position('enforce_rate_limit' in v_src) > position('invite_code_registry' in v_src) then
    raise exception 'The resolver must charge the limit BEFORE it looks a code up';
  end if;

  if position('enforce_rate_limit' in v_src) > position('{6,16}' in v_src) then
    raise exception 'The resolver must charge the limit BEFORE it checks the shape';
  end if;

  -- The SEC-001 field, gone from both container kinds. Spelled as the JSON key
  -- so a member count reintroduced under any other name still trips the count
  -- assertion below rather than passing on a spelling.
  if v_src ~ '''members''' then
    raise exception 'The resolver must not return a member count';
  end if;

  if v_src ~* 'count\(\*\)' then
    raise exception 'The resolver must not count members at all';
  end if;

  -- The target id, which both joins prove is unnecessary because both take a
  -- code.
  if v_src ~ '''id'',' then
    raise exception 'The resolver must not return the code target''s id';
  end if;

  -- The owner's identity was never returned and must not start being. Asserted
  -- as "it never reads `public.profiles`" rather than as a spelling: the
  -- function legitimately selects `game_definitions.display_name`, which is the
  -- GAME's name — "Last Man Standing" — and an earlier draft of this very block
  -- matched that and refused its own migration. Where a person's display name
  -- could only come from is the profiles table, so that is what is forbidden.
  if v_src ~ 'owner_name' or v_src ~ 'public\.profiles' then
    raise exception 'The resolver must not return an owner identity';
  end if;

  -- Contract 155's reason for `stable` preserved in the form that still holds:
  -- it is a resolver and not a join. Charging a limit is neither.
  --
  -- The write verbs are spelled with POSIX classes rather than literal spaces
  -- for the reason contract 155 recorded: `check-migration-additive.mjs` scans
  -- DO blocks at statement level and cannot tell a pattern held in a string
  -- from a statement.
  if v_src ~* 'insert[[:space:]]+into|update[[:space:]]+public\.|delete[[:space:]]+from' then
    raise exception 'The resolver must not write a league, a competition or a membership';
  end if;

  -- It can no longer be `stable`, because charging the limit writes. Asserted
  -- rather than left implicit: a later `create or replace` that restored
  -- `stable` would make the limiter's insert fail at runtime, and the function
  -- would go back to being free to probe.
  if exists (
    select 1 from pg_catalog.pg_proc p
    join pg_catalog.pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname = 'resolve_invite_code'
      and p.provolatile <> 'v'
  ) then
    raise exception 'The resolver must be volatile now that it charges a limit';
  end if;

  -- One namespace, one lookup, unchanged from contract 155.
  if v_src !~ 'invite_code_registry' then
    raise exception 'The resolver must read the shared code namespace';
  end if;

  -- No anonymous caller, unchanged from contract 155.
  if has_function_privilege('anon', 'public.resolve_invite_code(text)', 'execute') then
    raise exception 'The resolver must not be reachable anonymously';
  end if;

  if not has_function_privilege('authenticated', 'public.resolve_invite_code(text)', 'execute') then
    raise exception 'The resolver must stay reachable by a signed-in caller';
  end if;
end;
$$;
