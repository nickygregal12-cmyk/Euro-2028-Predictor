-- ---------------------------------------------------------------------------
-- Contract 153 — MIG-UI-05: a private Last Man Standing, created, invited and
-- joined.
--
-- Contract 152 gave a private competition a name, an owner and a code. This
-- creates one, and it is the first container on the platform that a player can
-- make for their own friends.
--
-- ---------------------------------------------------------------------------
-- THE HOLE THIS HAD TO CLOSE ON THE WAY, MEASURED RATHER THAN SUSPECTED
-- ---------------------------------------------------------------------------
--
-- `public.join_competition_game` checks authentication, availability,
-- completion and both registration instants — and never once looks at
-- `visibility_kind`. That was harmless while every competition was public and
-- no private one could be created. The moment this contract creates the first
-- joinable private container it stops being harmless: a competition id is not
-- a secret, it appears in URLs and in every response that names a game, so
-- anyone holding one could have joined somebody's private competition without
-- ever seeing the code.
--
-- So `join_competition_game` now refuses a private competition by name and
-- says where to go instead. That is a NARROWING of a shipped function, and it
-- is safe to make: Production holds no private competition at all, and hosted
-- Development holds exactly one unpublished seeded row that nobody can join
-- because it is not `active`. Nothing that works today stops working.
--
-- ---------------------------------------------------------------------------
-- ONE MEMBERSHIP AUTHORITY, NOT TWO
-- ---------------------------------------------------------------------------
--
-- Joining by code and joining by id have to do the same thing: the rejoin
-- rules, contract 126's running check, the disqualification refusal, the
-- entry-versus-entrant split. Writing that twice is how two paths drift until
-- one of them lets a disqualified player back in.
--
-- The body therefore moves, VERBATIM, into
-- `predictor_internal.enter_competition_game`, and both public entry points
-- call it. `join_competition_game` keeps its signature, its grant and its
-- behaviour for every competition that exists today, and gains one refusal in
-- front. The DO block at the end proves the extraction kept the rules rather
-- than trusting that it did.
--
-- ---------------------------------------------------------------------------
-- WHAT THE ORGANISER CHOOSES, AND WHAT THEY DO NOT
-- ---------------------------------------------------------------------------
--
-- ADR 0013 makes a private competition's rules its organiser's, which is why
-- contract 127 refuses to write the public Classic setup for one and returns
-- `private_setup_not_chosen`. This is the other half of that refusal: the
-- organiser supplies lives, saves, the draw rule and what happens on a
-- wipeout, and `season_lms_setups` already constrains every one of them
-- (lives 0-3, saves 0-2, `eliminate`/`survive`, and a private scope REQUIRING
-- a wipeout answer). The migration does not restate those ranges; it lets the
-- table refuse, and turns the refusal into a readable message.
--
-- The calendar is NOT the organiser's. It comes from
-- `predictor_internal.generate_lms_first_windows`, the same generator contract
-- 127 uses for the public competition, because a private competition is played
-- over the same real football as the public one and a second calendar
-- authority is how two competitions on one season start disagreeing about when
-- a round locks.
--
-- Creation and joining are rate limited through `enforce_rate_limit` on the
-- EXISTING `league_membership` action. A new action would need a new ceiling,
-- and `CAP-003`/`CAP-007` record that no such figure is approved. Reusing the
-- approved one is the only option that invents nothing.
-- ---------------------------------------------------------------------------

-- ---------------------------------------------------------------------------
-- 1. The membership authority, extracted verbatim.
-- ---------------------------------------------------------------------------

create or replace function predictor_internal.enter_competition_game(
  p_game_competition_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $enter$
declare
  v_uid uuid := (select auth.uid());
  v_availability public.bonus_competitions%rowtype;
  v_definition public.game_definitions%rowtype;
  v_membership public.game_memberships%rowtype;
begin
  if v_uid is null then
    raise exception 'Authentication is required'
      using errcode = 'insufficient_privilege';
  end if;

  select availability.*
    into v_availability
    from public.bonus_competitions availability
    where availability.id = p_game_competition_id
    for update;

  if not found or v_availability.availability_status <> 'active' then
    raise exception 'Game not found'
      using errcode = 'no_data_found';
  end if;

  select * into strict v_definition
    from public.game_definitions
    where game_key = v_availability.game_key;

  if v_availability.completed_at is not null then
    raise exception 'This game has finished'
      using errcode = '55000';
  end if;

  if v_availability.registration_opens_at is null
     or now() < v_availability.registration_opens_at then
    raise exception 'Registration has not opened'
      using errcode = '55000';
  end if;

  if v_availability.registration_closes_at is not null
     and now() >= v_availability.registration_closes_at then
    raise exception 'Registration has closed'
      using errcode = '55000';
  end if;

  select * into v_membership
    from public.game_memberships membership
    where membership.game_competition_id = p_game_competition_id
      and membership.user_id = v_uid
    for update;

  if found then
    if v_membership.status = 'active' then
      raise exception 'You have already entered this game'
        using errcode = 'unique_violation';
    end if;

    if v_membership.status = 'disqualified' then
      raise exception 'A disqualified game entry cannot be rejoined'
        using errcode = '55000';
    end if;

    -- Contract 126. `allow_rejoin` is the game's capability, and it bites only
    -- once the competition is RUNNING. ADR 0020's word is deliberate: "leaving
    -- an LMS competition never permits rejoining that same RUNNING
    -- competition, consistent with the rolling-entry rejection". That
    -- rejection's own reason is depletion — "a player joining at round eight
    -- arrives with all twenty clubs while survivors have burned eight" — and
    -- before the first round locks nobody has burned anything.
    if not v_definition.allow_rejoin
       and predictor_internal.competition_is_running(v_availability.id)
    then
      raise exception 'This game cannot be rejoined once it has started'
        using errcode = '55000';
    end if;

    update public.game_memberships membership
      set status = 'active',
          active_since = now(),
          left_at = null,
          disqualified_at = null,
          rejoin_count = membership.rejoin_count + 1,
          updated_at = now()
      where membership.id = v_membership.id
      returning * into v_membership;
  else
    insert into public.game_memberships (
      tournament_id,
      game_competition_id,
      user_id,
      status,
      active_since
    ) values (
      v_availability.tournament_id,
      v_availability.id,
      v_uid,
      'active',
      now()
    )
    returning * into v_membership;
  end if;

  if v_definition.requires_prediction_entry then
    insert into public.entries (
      user_id,
      tournament_id,
      game_competition_id,
      game_membership_id
    ) values (
      v_uid,
      v_availability.tournament_id,
      v_availability.id,
      v_membership.id
    )
    on conflict (user_id, tournament_id) do nothing;
  else
    insert into public.bonus_competition_entrants (
      competition_id,
      user_id,
      game_membership_id
    ) values (
      v_availability.id,
      v_uid,
      v_membership.id
    )
    on conflict (competition_id, user_id) do update
      set game_membership_id = excluded.game_membership_id,
          updated_at = now();
  end if;

  return jsonb_build_object(
    'game_competition_id', v_availability.id,
    'game_key', v_availability.game_key,
    'membership_id', v_membership.id,
    'status', v_membership.status,
    'joined_at', v_membership.joined_at,
    'active_since', v_membership.active_since,
    'rejoin_count', v_membership.rejoin_count
  );
end;
$enter$;

revoke all on function predictor_internal.enter_competition_game(uuid)
  from public, anon, authenticated, service_role;

-- ---------------------------------------------------------------------------
-- 2. The public join, narrowed.
-- ---------------------------------------------------------------------------

create or replace function public.join_competition_game(p_game_competition_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $join$
declare
  v_visibility text;
begin
  select availability.visibility_kind
    into v_visibility
    from public.bonus_competitions availability
    where availability.id = p_game_competition_id;

  -- A competition id is not a secret. Without this, holding one would be
  -- enough to join somebody's private competition without ever seeing a code.
  if v_visibility = 'private' then
    raise exception 'That competition is private; join it with its invite code'
      using errcode = 'insufficient_privilege';
  end if;

  return predictor_internal.enter_competition_game(p_game_competition_id);
end;
$join$;

revoke all on function public.join_competition_game(uuid) from public, anon;
grant execute on function public.join_competition_game(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- 3. Creating one.
-- ---------------------------------------------------------------------------

create or replace function public.create_private_season_lms(
  p_tournament_id uuid,
  p_name text,
  p_lives smallint default 0,
  p_saves smallint default 0,
  p_draws_rule text default 'eliminate',
  p_endgame_on_wipeout text default 'play_on'
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $create$
declare
  v_uid uuid := (select auth.uid());
  v_name text := btrim(coalesce(p_name, ''));
  v_kind text;
  v_status text;
  v_id uuid;
  v_code text;
  v_try integer := 0;
  v_windows integer;
begin
  if v_uid is null then
    raise exception 'Not authenticated' using errcode = 'insufficient_privilege';
  end if;

  perform public.enforce_rate_limit('league_membership', 5);

  if length(v_name) < 1 or length(v_name) > 40 then
    raise exception 'A competition name must be 1 to 40 characters'
      using errcode = 'check_violation';
  end if;

  select season.kind, season.status
    into v_kind, v_status
    from public.tournaments season
    where season.id = p_tournament_id;

  if v_kind is null then
    raise exception 'That competition season does not exist' using errcode = '22023';
  end if;

  -- A league season, because the calendar generator derives its rounds from
  -- season matchweeks; and a published one, because a draft season is not a
  -- thing a player may build a competition on top of.
  if v_kind <> 'league_season' then
    raise exception 'A private Last Man Standing belongs to a league season, not a %', v_kind
      using errcode = '23514';
  end if;

  if v_status = 'draft' then
    raise exception 'That season is not published yet' using errcode = '55000';
  end if;

  -- The organiser's rules. `season_lms_setups` owns the ranges; this turns its
  -- refusals into something a person can read rather than restating them.
  if p_draws_rule not in ('eliminate', 'survive') then
    raise exception 'A draw must either eliminate or survive' using errcode = '23514';
  end if;

  if p_endgame_on_wipeout not in ('play_on', 'shared_win', 'reset') then
    raise exception 'A wipeout must play on, share the win, or reset'
      using errcode = '23514';
  end if;

  loop
    v_try := v_try + 1;
    v_code := predictor_internal.allocate_invite_code();

    begin
      insert into public.bonus_competitions (
        tournament_id, game_key, published, availability_status,
        draw_required, visibility_kind, registration_opens_at,
        name, owner_id, invite_code
      ) values (
        p_tournament_id, 'last_man_standing', false, 'active',
        false, 'private', now(),
        v_name, v_uid, v_code
      )
      returning id into v_id;
      exit;
    exception when unique_violation then
      -- The registry raised it. Same handling the league allocator has always
      -- had, for the same reason.
      if v_try >= 10 then
        raise exception 'Could not allocate an invite code, please retry'
          using errcode = '55006';
      end if;
    end;
  end loop;

  insert into public.season_lms_setups (
    competition_id, lives, saves, draws_rule, endgame_scope, endgame_on_wipeout
  ) values (
    v_id, coalesce(p_lives, 0), coalesce(p_saves, 0), p_draws_rule,
    'private', p_endgame_on_wipeout
  );

  -- The organiser is in their own competition. Through the one membership
  -- authority, so an owner's entry is the same shape as everyone else's.
  perform predictor_internal.enter_competition_game(v_id);

  -- The same generator the public competition uses.
  v_windows := predictor_internal.generate_lms_first_windows(v_id, now());

  return jsonb_build_object(
    'competition_id', v_id,
    'name', v_name,
    'invite_code', v_code,
    'windows', v_windows,
    'outcome', case when v_windows > 0 then 'opened' else 'no_schedulable_round' end
  );
end;
$create$;

revoke all on function public.create_private_season_lms(uuid, text, smallint, smallint, text, text)
  from public, anon;
grant execute on function public.create_private_season_lms(uuid, text, smallint, smallint, text, text)
  to authenticated;

-- ---------------------------------------------------------------------------
-- 4. Joining one, by the code and only by the code.
-- ---------------------------------------------------------------------------

create or replace function public.join_private_competition(p_code text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $joincode$
declare
  v_uid uuid := (select auth.uid());
  v_code text := upper(btrim(coalesce(p_code, '')));
  v_competition uuid;
begin
  if v_uid is null then
    raise exception 'Not authenticated' using errcode = 'insufficient_privilege';
  end if;

  perform public.enforce_rate_limit('league_membership', 5);

  select registry.competition_id
    into v_competition
    from public.invite_code_registry registry
    where registry.code = v_code;

  -- A code that names a LEAGUE is answered the same way as a code that names
  -- nothing. Telling the caller "that is a league code" would confirm the code
  -- exists, which is a probe for anyone working through the alphabet.
  if v_competition is null then
    raise exception 'That invite code does not match a competition'
      using errcode = 'no_data_found';
  end if;

  return predictor_internal.enter_competition_game(v_competition);
end;
$joincode$;

revoke all on function public.join_private_competition(text) from public, anon;
grant execute on function public.join_private_competition(text) to authenticated;

-- ---------------------------------------------------------------------------
-- Prove the shape, in the same transaction.
-- ---------------------------------------------------------------------------

do $$
declare
  v_enter text := pg_get_functiondef('predictor_internal.enter_competition_game(uuid)'::regprocedure);
  v_join text := pg_get_functiondef('public.join_competition_game(uuid)'::regprocedure);
begin
  -- The extraction kept the rules. Each of these was in the shipped body and
  -- would be silently lost by a careless copy — which is the whole risk of
  -- moving a function rather than calling it.
  if v_enter !~ 'A disqualified game entry cannot be rejoined'
     or v_enter !~ 'competition_is_running'
     or v_enter !~ 'requires_prediction_entry'
     or v_enter !~ 'bonus_competition_entrants'
     or v_enter !~ 'rejoin_count' then
    raise exception 'The extracted membership authority lost a rule it must keep';
  end if;

  -- The public join delegates rather than duplicating.
  if v_join !~ 'enter_competition_game' then
    raise exception 'join_competition_game must delegate to the one membership authority';
  end if;

  if v_join ~ 'bonus_competition_entrants' or v_join ~ 'rejoin_count' then
    raise exception 'join_competition_game kept a copy of the membership rules';
  end if;

  -- And it refuses a private competition.
  if v_join !~ 'private' then
    raise exception 'join_competition_game must refuse a private competition';
  end if;

  -- The internal authority is not browser-reachable; the two public entry
  -- points are, and nothing else new is.
  if exists (
    select 1 from information_schema.routine_privileges
     where routine_schema = 'predictor_internal'
       and routine_name = 'enter_competition_game'
       and grantee in ('anon', 'authenticated', 'PUBLIC', 'service_role')
  ) then
    raise exception 'The membership authority must not be reachable from a browser';
  end if;

  if exists (
    select 1 from information_schema.routine_privileges
     where routine_schema = 'public'
       and routine_name in ('create_private_season_lms', 'join_private_competition')
       and grantee in ('anon', 'PUBLIC')
  ) then
    raise exception 'Creating or joining a private competition must not be anonymous';
  end if;
end;
$$;
