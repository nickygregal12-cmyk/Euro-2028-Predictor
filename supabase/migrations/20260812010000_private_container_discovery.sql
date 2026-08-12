-- ---------------------------------------------------------------------------
-- Contract 179 — private container discovery, and the workspace read that
-- opens one.
--
-- `PPLAY-001` and `MIG-UI-20`. This is the twelfth instance of the defect
-- behind contracts 116, 118, 120, 122, 124, 128, 129, 161 to 165 and 172, and
-- it is the first one a PLAYER has actually hit: a write that succeeds and
-- then cannot be found again.
--
-- ---------------------------------------------------------------------------
-- WHAT WAS MEASURED
-- ---------------------------------------------------------------------------
--
-- `/leagues` is the product's stated home for private Match Predictor leagues,
-- private Last Man Standing competitions and private Predictor Championships.
-- It rebuilds itself by looping over the caller's PUBLIC game memberships and
-- calling `public.get_my_game_leagues(...)` for each — and that function reads
-- `public.leagues` and `public.league_members`.
--
-- A private Last Man Standing or Championship is NOT a row in `public.leagues`.
-- It is a `public.bonus_competitions` row with `visibility_kind = 'private'`,
-- with participation in `public.game_memberships` and
-- `public.bonus_competition_entrants`. So a create or a join can be completely
-- valid in the database and invisible to the only read the product uses to
-- rediscover it. The hosted Development integrity check in the 12 August 2026
-- investigation found exactly that: structurally complete private LMS rows —
-- owner, invite code, active owner membership, setup row, registry linkage —
-- behind a surface that could not return them.
--
-- **A SECOND MISMATCH COMPOUNDS IT AND IS THE REASON THIS IS A NEW READ RATHER
-- THAN A WIDENED ONE.** The caller decides WHICH containers to ask about from
-- `public.get_competition_games(tournament_id)`, which resolves the current
-- PUBLIC game competition per game. A private container has its own
-- `bonus_competitions` row, so private participation is not represented there
-- at all. Widening `get_my_game_leagues` would therefore still have lost a
-- private Championship held by somebody who never joined the public one —
-- which is precisely the player in `PPLAY-002`. Discovery has to be addressed
-- to the CALLER and to nothing else, which is what this contract does: it
-- takes no competition, no game and no season argument.
--
-- ---------------------------------------------------------------------------
-- PARTICIPATION, NOT OWNERSHIP, AND NOT ACTIVE PARTICIPATION EITHER
-- ---------------------------------------------------------------------------
--
-- Contract 165 already gives an ORGANISER their list. That is half the
-- population: `get_my_organised_competitions` is `owner_id = uid`, so the
-- invitee who joined by code — the larger half, and the half the investigation
-- reproduced — has never had a read at all.
--
-- Participation here is the union of owning the container and holding a
-- `game_memberships` row for it, in ANY status. `left` and `disqualified`
-- count, on contract 161's precedent: a competition a player left is still one
-- they played, and contract 126 lets an LMS competition that has not started
-- be rejoined — a player who cannot FIND it cannot rejoin it. The status is
-- returned rather than filtered on, so a surface may group or hide; the read
-- refuses to make that decision on the surface's behalf, because a read that
-- silently drops rows is how this defect looked in the first place.
--
-- ---------------------------------------------------------------------------
-- THE INVITE CODE IS THE OWNER'S, AND THE MEMBER GETS A BOOLEAN
-- ---------------------------------------------------------------------------
--
-- An organiser needs the code to share it. A member does not: they already
-- joined. `SEC-001` and contracts 158/159 spent two contracts narrowing what a
-- code lookup discloses, and handing every member a live invite secret in a
-- list read would hand it back. Non-owners get `invite_available`, which is
-- whether one exists and nothing more.
--
-- ---------------------------------------------------------------------------
-- ONE LIFECYCLE DERIVATION, USED BY BOTH READS
-- ---------------------------------------------------------------------------
--
-- Both functions state a `lifecycle_state`, and it is computed in exactly one
-- place — `predictor_internal.private_container_lifecycle` — because the whole
-- point of this contract is that two readers answering one question separately
-- is the shape of the defect being fixed. It invents no lifecycle column: it
-- reads `completed_at`, `availability_status`, the registration window and
-- contract 126's `competition_is_running`, all of which already own their
-- facts, and names the combination.
--
-- ---------------------------------------------------------------------------
-- WHAT THIS DOES NOT DO
-- ---------------------------------------------------------------------------
--
-- It creates no relation, writes nothing, and adds no rule. It does not
-- launch, settle, reveal, score or enrol. Every reveal boundary stays with the
-- authority that owns it: the workspace read returns THAT an entrant has
-- picked in Last Man Standing and never WHAT, exactly as contract 165 does and
-- for its reason, and it returns no Championship prediction at all — contract
-- 167's group table and contract 149's league prediction read own that, behind
-- the matchweek's own lock. Nothing here is anonymous.
-- ---------------------------------------------------------------------------

begin;

-- ===========================================================================
-- 1. The lifecycle vocabulary, derived once.
-- ===========================================================================

create or replace function predictor_internal.private_container_lifecycle(
  p_competition_id uuid
)
returns text
language sql
stable
security definer
set search_path = ''
as $lifecycle$
  select case
    -- Terminal first: a completed competition is completed whatever its
    -- registration window says, and an archived one has stopped being
    -- available for any reason at all.
    when competition.completed_at is not null then 'completed'
    when competition.availability_status <> 'active' then 'unavailable'
    -- Contract 126's authority, unchanged: running is the first window whose
    -- `locks_at` has passed. Asked before the registration window, because a
    -- competition can be running with registration still nominally open and
    -- the more specific fact is the one worth saying.
    when predictor_internal.competition_is_running(competition.id) then 'running'
    when competition.registration_closes_at is not null
     and competition.registration_closes_at <= now() then 'registration_closed'
    when competition.registration_opens_at is not null
     and competition.registration_opens_at <= now() then 'registration_open'
    -- Created, and not yet open to anybody. The state a private container sits
    -- in between `create_private_season_cup` and its launch, which is exactly
    -- the state `PPLAY-003` strands an organiser in.
    else 'setup'
  end
  from public.bonus_competitions competition
  where competition.id = p_competition_id;
$lifecycle$;

comment on function predictor_internal.private_container_lifecycle(uuid) is
  'Contract 179. The single derivation of a private container''s lifecycle '
  'state, composed from completed_at, availability_status, contract 126''s '
  'competition_is_running and the registration window. Stores nothing and '
  'decides nothing new.';

revoke all on function predictor_internal.private_container_lifecycle(uuid)
  from public, anon, authenticated, service_role;

-- ===========================================================================
-- 2. Championship launch readiness — read-only, and never a second rule.
-- ===========================================================================
--
-- `PPLAY-003`. `public.launch_private_season_cup` exists and works. What an
-- organiser who pressed **Done** and came back the next day has never had is
-- any way to learn whether pressing it now would do anything — so the creation
-- screen instructs a workflow (create, share, wait, launch) whose last step has
-- no surface.
--
-- This states readiness and REFUSES TO RESTATE THE RULE. Every figure comes
-- from the authority that already owns it:
--
--   * launched              -- `bonus_cup_groups`, which is the idempotence
--                              check `launch_season_cup` itself re-reads under
--                              its advisory lock;
--   * entrants              -- `bonus_competition_entrants`, the same count;
--   * remaining_rounds      -- contract 83's `season_matchweek_lock_at` over
--                              `competition_rounds`, character-identical to the
--                              launcher's own derivation;
--   * format                -- `select_season_cup_format`, called rather than
--                              approximated.
--
-- It is deliberately NOT a copy of the launcher's `if` ladder, and it is not
-- trusted on its own word either: `228_private_container_discovery.sql` drives
-- a real field through both this read and an actual launch and requires them to
-- agree, over a field too small to launch, a launchable field, and a field
-- already launched. A readiness read that can disagree with the launcher is
-- worse than none, because an organiser would act on it.
create or replace function predictor_internal.private_cup_launch_readiness(
  p_competition_id uuid
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $ready$
declare
  v_competition record;
  v_entrants integer;
  v_buffer smallint;
  v_remaining integer;
  v_format jsonb;
  v_launched boolean;
  v_blocked text;
begin
  select competition.id, competition.game_key, competition.visibility_kind,
         competition.owner_id, competition.tournament_id, competition.completed_at,
         season.kind as season_kind
    into v_competition
    from public.bonus_competitions competition
    join public.tournaments season on season.id = competition.tournament_id
   where competition.id = p_competition_id;

  -- Not a Championship: the question does not apply, and answering it with a
  -- blocker would suggest it might one day.
  if v_competition.id is null or v_competition.game_key <> 'predictor_cup' then
    return null;
  end if;

  select exists (
    select 1 from public.bonus_cup_groups drawn
     where drawn.competition_id = p_competition_id
  ) into v_launched;

  select count(*)::integer into v_entrants
    from public.bonus_competition_entrants entrant
   where entrant.competition_id = p_competition_id;

  select definition.buffer_minutes into v_buffer
    from public.game_definitions definition
   where definition.game_key = 'predictor_cup';

  -- The launcher's own derivation of how much calendar is left, not a
  -- paraphrase of it.
  select count(*)::integer into v_remaining
    from (
      select predictor_internal.season_matchweek_lock_at(
               v_competition.tournament_id, round.id, v_buffer) as locks_at
        from public.competition_rounds round
       where round.tournament_id = v_competition.tournament_id
         and round.kind = 'league_matchweek'
    ) candidate
   where candidate.locks_at is not null
     and candidate.locks_at > now();

  v_format := predictor_internal.select_season_cup_format(v_entrants, v_remaining);

  -- The blockers, in the order `launch_private_season_cup` and
  -- `predictor_internal.launch_season_cup` reach them.
  v_blocked := case
    when v_competition.visibility_kind <> 'private' then 'not_private'
    when v_competition.season_kind is distinct from 'league_season' then 'not_a_league_season'
    when v_competition.completed_at is not null then 'already_completed'
    when v_launched then 'already_launched'
    -- Contract 166 draws a multi-group field, and it is reached by
    -- `admin_launch_cup_group_stage` under `require_competition_admin` — NOT by
    -- the organiser's own launch, which raises on this shape. Said plainly
    -- rather than left to surface as an unhandled exception, because an
    -- organiser whose competition grew past twenty entrants is entitled to know
    -- that is why the button will not work.
    when v_format->>'kind' = 'groups' then 'field_needs_administered_draw'
    when v_format->>'kind' <> 'single_group'
      then coalesce(v_format->>'reason', 'no_viable_format')
    else null
  end;

  return jsonb_build_object(
    'launched', v_launched,
    'entrants', v_entrants,
    'remaining_rounds', v_remaining,
    'format_kind', v_format->>'kind',
    'can_launch', v_blocked is null,
    'blocked_reason', v_blocked);
end;
$ready$;

comment on function predictor_internal.private_cup_launch_readiness(uuid) is
  'Contract 179 / PPLAY-003. Read-only launch readiness for a private season '
  'Championship, composed from the same authorities launch_season_cup uses. '
  'Adds no rule and is differential-tested against an actual launch.';

revoke all on function predictor_internal.private_cup_launch_readiness(uuid)
  from public, anon, authenticated, service_role;

-- ===========================================================================
-- 3. Discovery: every private container the caller participates in.
-- ===========================================================================

create or replace function public.get_my_private_competitions(
  p_limit integer default 25,
  p_offset integer default 0
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $mine$
declare
  v_uid uuid := (select auth.uid());
  v_limit integer;
  v_offset integer;
  v_total integer;
  v_rows jsonb;
begin
  if v_uid is null then
    raise exception 'Not authenticated' using errcode = 'insufficient_privilege';
  end if;

  v_limit := least(greatest(coalesce(p_limit, 25), 1), 50);
  v_offset := greatest(coalesce(p_offset, 0), 0);

  -- Owned OR joined. Expressed once, as a CTE both the count and the page
  -- read, so a total that disagrees with its own list is unreachable —
  -- contract 171's lesson about a capped list beside an uncapped size.
  with mine as (
    select competition.id,
           competition.owner_id = v_uid as is_owner,
           membership.status as membership_status,
           membership.joined_at,
           membership.left_at
      from public.bonus_competitions competition
      left join public.game_memberships membership
             on membership.game_competition_id = competition.id
            and membership.user_id = v_uid
     where competition.visibility_kind = 'private'
       and (competition.owner_id = v_uid or membership.id is not null)
  )
  select count(*)::integer into v_total from mine;

  with mine as (
    select competition.id,
           competition.owner_id = v_uid as is_owner,
           membership.status as membership_status,
           membership.joined_at,
           membership.left_at
      from public.bonus_competitions competition
      left join public.game_memberships membership
             on membership.game_competition_id = competition.id
            and membership.user_id = v_uid
     where competition.visibility_kind = 'private'
       and (competition.owner_id = v_uid or membership.id is not null)
  )
  select coalesce(jsonb_agg(page.entry order by page.ordinal), '[]'::jsonb)
    into v_rows
    from (
      select row_number() over (
               order by competition.created_at desc, competition.id desc
             ) as ordinal,
             jsonb_build_object(
               'competition_id', competition.id,
               'name', competition.name,
               'game_key', competition.game_key,
               'game_name', definition.display_name,
               'tournament_id', competition.tournament_id,
               'season_name', season.name,
               'season_key', season.season_key,
               'season_kind', season.kind,
               'is_owner', mine.is_owner,
               -- Null for an owner who never entered their own competition,
               -- which contract 154 permits: creating a Championship does not
               -- enter you into it.
               'membership_status', mine.membership_status,
               'joined_at', mine.joined_at,
               'left_at', mine.left_at,
               'lifecycle_state',
                 predictor_internal.private_container_lifecycle(competition.id),
               'created_at', competition.created_at,
               'registration_opens_at', competition.registration_opens_at,
               'registration_closes_at', competition.registration_closes_at,
               'completed_at', competition.completed_at,
               'members', (select count(*)::integer
                             from public.bonus_competition_entrants e
                            where e.competition_id = competition.id),
               -- The secret goes to the organiser only. Everybody else learns
               -- that one exists.
               'invite_code', case when mine.is_owner then competition.invite_code end,
               'invite_available', competition.invite_code is not null,
               -- The destination is the container's own id, which is what
               -- `get_private_competition_workspace` takes. Stated by the
               -- server so a surface does not have to know which game routes
               -- where, and so a container with no workspace yet can say so.
               'workspace_available', true
             ) as entry
        from mine
        join public.bonus_competitions competition on competition.id = mine.id
        join public.tournaments season on season.id = competition.tournament_id
        left join public.game_definitions definition
               on definition.game_key = competition.game_key
       order by competition.created_at desc, competition.id desc
       limit v_limit offset v_offset
    ) page;

  return jsonb_build_object(
    'total', v_total,
    'limit', v_limit,
    'offset', v_offset,
    'returned', jsonb_array_length(v_rows),
    'has_more', v_offset + v_limit < v_total,
    'competitions', v_rows);
end;
$mine$;

comment on function public.get_my_private_competitions(integer, integer) is
  'Contract 179 / PPLAY-001. Every private competition container the '
  'authenticated caller owns or holds a membership in, in any membership '
  'status. Takes no competition, game or season argument and is not a '
  'directory. Does not depend on public-game membership.';

revoke all on function public.get_my_private_competitions(integer, integer)
  from public, anon;
grant execute on function public.get_my_private_competitions(integer, integer)
  to authenticated;

-- ===========================================================================
-- 4. The workspace: one container, addressed by its own id.
-- ===========================================================================
--
-- `MIG-UI-20`. Refuses identically for "not yours" and "does not exist", which
-- is contract 158's idiom and contract 165's: distinguishing them turns the
-- function into a probe for which container ids are real.

create or replace function public.get_private_competition_workspace(
  p_competition_id uuid
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $workspace$
declare
  v_uid uuid := (select auth.uid());
  v_competition record;
  v_is_owner boolean;
  v_membership record;
  v_members jsonb;
  v_current record;
  v_readiness jsonb;
begin
  if v_uid is null then
    raise exception 'Not authenticated' using errcode = 'insufficient_privilege';
  end if;

  select competition.id, competition.name, competition.game_key,
         competition.tournament_id, competition.invite_code,
         competition.owner_id, competition.visibility_kind,
         competition.registration_opens_at, competition.registration_closes_at,
         competition.completed_at, competition.completion_reason,
         competition.created_at,
         season.name as season_name, season.season_key, season.kind as season_kind,
         definition.display_name as game_name,
         definition.allow_rejoin
    into v_competition
    from public.bonus_competitions competition
    join public.tournaments season on season.id = competition.tournament_id
    left join public.game_definitions definition
           on definition.game_key = competition.game_key
   where competition.id = p_competition_id
     and competition.visibility_kind = 'private';

  if v_competition.id is null then
    raise exception 'No such competition' using errcode = 'no_data_found';
  end if;

  v_is_owner := v_competition.owner_id = v_uid;

  select membership.status, membership.joined_at, membership.left_at,
         membership.disqualified_at
    into v_membership
    from public.game_memberships membership
   where membership.game_competition_id = p_competition_id
     and membership.user_id = v_uid;

  -- Membership OR ownership. A non-member gets the same refusal a non-existent
  -- container gets.
  if not v_is_owner and v_membership.status is null then
    raise exception 'No such competition' using errcode = 'no_data_found';
  end if;

  -- The round in play, for Last Man Standing only: it is the one time-sensitive
  -- organiser fact, and contract 165 already established both that it is a
  -- count of who has picked and that the CLUB stays hidden until the round
  -- locks. Nothing here widens that.
  -- Unconditional, with the Championship selected out inside the predicate
  -- rather than by skipping the statement: a `select into` that matches no row
  -- assigns nulls, whereas a statement that never runs leaves the record
  -- unassigned and every later reference raises.
  select window_row.id, window_row.sequence, window_row.label,
         window_row.opens_at, window_row.locks_at,
         window_row.locks_at is not null and window_row.locks_at <= now() as locked
    into v_current
    from public.bonus_competition_windows window_row
   where window_row.id = case
           when v_competition.game_key <> 'predictor_cup'
             then predictor_internal.season_lms_current_window(p_competition_id, now())
         end;

  select coalesce(jsonb_agg(entry order by entry ->> 'display_name'), '[]'::jsonb)
    into v_members
    from (
      select jsonb_build_object(
               'user_id', entrant.user_id,
               'display_name', coalesce(player.display_name, 'Player'),
               'is_me', entrant.user_id = v_uid,
               'is_owner', entrant.user_id = v_competition.owner_id,
               'joined_at', entrant.joined_at,
               'outcome', entrant.outcome,
               'membership_status', membership.status,
               'left_at', membership.left_at,
               -- THAT they have picked, never what — and only where a round is
               -- actually in play. `null` for a Championship, which has no
               -- round-scoped pick and whose predictions are the shared season
               -- card behind the matchweek's own lock.
               'has_picked_current_round',
                 case when v_current.id is null then null
                      else exists (
                        select 1 from public.bonus_lms_selections pick
                         where pick.competition_id = p_competition_id
                           and pick.user_id = entrant.user_id
                           and pick.window_id = v_current.id)
                 end
             ) as entry
        from public.bonus_competition_entrants entrant
        left join public.profiles player on player.id = entrant.user_id
        left join public.game_memberships membership
               on membership.game_competition_id = entrant.competition_id
              and membership.user_id = entrant.user_id
       where entrant.competition_id = p_competition_id
    ) rows;

  -- Null for anything that is not a Championship. The organiser half of it is
  -- only meaningful to the organiser, but the FACT of being launched is not a
  -- secret from the field, so the readiness object is returned to every member
  -- and `can_launch` is additionally conjoined with ownership.
  v_readiness := predictor_internal.private_cup_launch_readiness(p_competition_id);
  if v_readiness is not null then
    v_readiness := jsonb_set(
      v_readiness, '{can_launch}',
      to_jsonb((v_readiness->>'can_launch')::boolean and v_is_owner), true);
    -- Ownership is stated FIRST, not last, because that is the order
    -- `launch_private_season_cup` reaches its refusals in: an entrant is told
    -- they are not the organiser whatever else is also true of the field, which
    -- is both the truth and the only reason that will not change when somebody
    -- else joins.
    if not v_is_owner then
      v_readiness := jsonb_set(
        v_readiness, '{blocked_reason}', '"not_the_organiser"'::jsonb, true);
    end if;
  end if;

  return jsonb_build_object(
    'competition', jsonb_build_object(
      'id', v_competition.id,
      'name', v_competition.name,
      'game_key', v_competition.game_key,
      'game_name', v_competition.game_name,
      'tournament_id', v_competition.tournament_id,
      'season_name', v_competition.season_name,
      'season_key', v_competition.season_key,
      'season_kind', v_competition.season_kind,
      'created_at', v_competition.created_at,
      'registration_opens_at', v_competition.registration_opens_at,
      'registration_closes_at', v_competition.registration_closes_at,
      'completed_at', v_competition.completed_at,
      'completion_reason', v_competition.completion_reason,
      'lifecycle_state',
        predictor_internal.private_container_lifecycle(p_competition_id),
      'allow_rejoin', v_competition.allow_rejoin),
    'caller', jsonb_build_object(
      'is_owner', v_is_owner,
      'membership_status', v_membership.status,
      'joined_at', v_membership.joined_at,
      'left_at', v_membership.left_at,
      'disqualified_at', v_membership.disqualified_at,
      -- Only the organiser gets the live code. See the header.
      'invite_code', case when v_is_owner then v_competition.invite_code end,
      'invite_available', v_competition.invite_code is not null),
    'current_round', case when v_current.id is null then null else jsonb_build_object(
      'window_id', v_current.id,
      'sequence', v_current.sequence,
      'label', v_current.label,
      'opens_at', v_current.opens_at,
      'locks_at', v_current.locks_at,
      'locked', v_current.locked) end,
    'members', v_members,
    'member_count', jsonb_array_length(v_members),
    'launch', v_readiness);
end;
$workspace$;

comment on function public.get_private_competition_workspace(uuid) is
  'Contract 179 / MIG-UI-20. One private competition container addressed by '
  'its own id, for a member or its organiser. Refuses a non-member exactly as '
  'it refuses an unknown id. Reveal boundaries stay with the authorities that '
  'own them; it shows THAT an LMS entrant has picked and never what.';

revoke all on function public.get_private_competition_workspace(uuid)
  from public, anon;
grant execute on function public.get_private_competition_workspace(uuid)
  to authenticated;

-- ===========================================================================
-- 5. Prove the boundaries that cannot be left to a test file.
-- ===========================================================================
--
-- Grants and anonymity are asserted here rather than only in pgTAP, because a
-- migration that installs a browser-reachable read has to be the thing that
-- refuses to install it wrongly.

do $$
begin
  if has_function_privilege('anon',
       'public.get_my_private_competitions(integer, integer)', 'execute')
     or has_function_privilege('anon',
       'public.get_private_competition_workspace(uuid)', 'execute')
  then
    raise exception 'Private container discovery must not be reachable anonymously';
  end if;

  if not has_function_privilege('authenticated',
       'public.get_my_private_competitions(integer, integer)', 'execute')
     or not has_function_privilege('authenticated',
       'public.get_private_competition_workspace(uuid)', 'execute')
  then
    raise exception 'Private container discovery must be reachable by a signed-in player';
  end if;

  -- The internal helpers are helpers. A browser reaching the readiness read
  -- directly would be reading a competition it may not be in.
  if has_function_privilege('authenticated',
       'predictor_internal.private_cup_launch_readiness(uuid)', 'execute')
     or has_function_privilege('authenticated',
       'predictor_internal.private_container_lifecycle(uuid)', 'execute')
  then
    raise exception 'Internal private-container helpers must not be browser-reachable';
  end if;

  -- Discovery must not have become a directory. Neither function may take a
  -- user argument, now or later.
  if exists (
    select 1
      from pg_catalog.pg_proc p
      join pg_catalog.pg_namespace n on n.oid = p.pronamespace
     where n.nspname = 'public'
       and p.proname in ('get_my_private_competitions',
                         'get_private_competition_workspace')
       and pg_catalog.pg_get_function_identity_arguments(p.oid) ilike '%uuid%user%'
  ) then
    raise exception 'Private container discovery must never take a player argument';
  end if;
end;
$$;

commit;
