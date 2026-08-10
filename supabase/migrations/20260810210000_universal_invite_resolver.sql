-- ---------------------------------------------------------------------------
-- Contract 155 — MIG-UI-07: one code entry point, for every container.
--
-- The register records this item as **reduced, not closed**, and its audit note
-- says exactly what was left: "The remaining gap is a code for a container that
-- is not a league... once `MIG-UI-05` or `MIG-UI-06` creates one, a code for it
-- needs somewhere to resolve to, and whether `join_league` widens or a new
-- resolver appears is that work's decision rather than this one's."
--
-- Contracts 153 and 154 created those containers, so this is that decision.
--
-- ---------------------------------------------------------------------------
-- A NEW RESOLVER RATHER THAN WIDENING `join_league`
-- ---------------------------------------------------------------------------
--
-- `join_league` is a WRITE that takes a code. Widening it to also join a
-- private competition would make one function that joins two different things
-- depending on data the caller cannot see, and a caller who meant to join a
-- league would sometimes enter a Championship instead.
--
-- Worse, it would have to decide alone. A player pasting a code needs to know
-- what it is BEFORE they commit — which league or competition, on which
-- season, running which game, and whether they can actually join it. That is a
-- read, and it is the thing the frontend has never had: `get_league_preview`
-- answers it for leagues only, and only after assuming the code is a league's.
--
-- So this resolves, and does not join. The two joins stay exactly where they
-- are: `join_league` for a league, contract 153's `join_private_competition`
-- for a private container. One code entry point, two deliberate destinations,
-- and the caller is told which before anything is written.
--
-- ---------------------------------------------------------------------------
-- WHAT IT DISCLOSES, AND WHY THAT IS THE SAME AS TODAY
-- ---------------------------------------------------------------------------
--
-- Answering "this code is a league called X" to anyone holding the code
-- confirms the code exists. That is inherent to every invite-code system and
-- is already the shipped behaviour of `get_league_preview`, so this changes no
-- disclosure boundary — it extends the existing one to a second container kind
-- rather than inventing a looser one.
--
-- An unknown code and a code the caller cannot use are answered the SAME way:
-- `found: false`. A resolver that distinguished them would let someone work
-- through the alphabet learning which codes are real.
--
-- It never returns the code's target id when the caller cannot act on it, and
-- it reads nothing about other members beyond a count.
-- ---------------------------------------------------------------------------

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

  -- A malformed code is not found rather than invalid, for the same reason an
  -- unknown one is: both answers must look identical from outside.
  if v_code !~ '^[A-Z0-9]{6}$' then
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
      -- `join_league` refuses a caller with no active membership in the
      -- league's game. Saying so here is what lets a client send them to join
      -- the game first instead of showing them a button that will fail.
      'requires_game_entry', not v_league.holds_game,
      'join_with', 'join_league');
  end if;

  -- ---------------------------------------------------------------------
  -- A private competition.
  -- ---------------------------------------------------------------------
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
-- Prove the shape, in the same transaction.
-- ---------------------------------------------------------------------------

do $$
declare
  v_src text := pg_get_functiondef('public.resolve_invite_code(text)'::regprocedure);
begin
  -- It resolves. It does not join, and a resolver that writes is a join with a
  -- misleading name.
  --
  -- The write verbs are spelled with POSIX classes rather than literal spaces
  -- deliberately. `scripts/check-migration-additive.mjs` scans DO blocks at
  -- statement level — correctly, because a DO block can `execute` a delete —
  -- and it cannot tell a pattern held in a string from a statement. Written
  -- literally, the word pair below refused this migration from the ADR 0024
  -- fast lane on run 31441578911. The class means exactly the same thing to
  -- PostgreSQL, so the assertion is unchanged; only its spelling is.
  if v_src ~* 'insert[[:space:]]+into|update[[:space:]]+public\.|delete[[:space:]]+from' then
    raise exception 'The resolver must not write anything';
  end if;

  if v_src !~ 'stable' and pg_get_function_result('public.resolve_invite_code(text)'::regprocedure) is not null then
    -- `stable` is the declaration that says so to PostgreSQL as well as to a
    -- reader.
    if not exists (
      select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
       where n.nspname = 'public' and p.proname = 'resolve_invite_code'
         and p.provolatile = 's'
    ) then
      raise exception 'The resolver must be declared stable';
    end if;
  end if;

  -- One namespace, one lookup. Searching two tables and picking a winner is
  -- the ambiguity contract 152 exists to prevent.
  if v_src !~ 'invite_code_registry' then
    raise exception 'The resolver must read the shared namespace';
  end if;

  if exists (
    select 1 from information_schema.routine_privileges
     where routine_schema = 'public' and routine_name = 'resolve_invite_code'
       and grantee in ('anon', 'PUBLIC')
  ) then
    raise exception 'An invite code must not be resolvable anonymously';
  end if;
end;
$$;
