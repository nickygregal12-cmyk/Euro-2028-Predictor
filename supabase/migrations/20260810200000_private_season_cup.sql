-- ---------------------------------------------------------------------------
-- Contract 154 — MIG-UI-06: a private Predictor Championship, created,
-- invited, joined and launched.
--
-- THIS IS A SMALL CONTRACT, AND THAT IS THE POINT. The register describes
-- "creation, invite, join, owner configuration, entrant setup and
-- deterministic format creation", which reads like a large piece of work. Most
-- of it already exists and was measured rather than assumed:
--
--   * contract 111's `launch_season_cup` ALREADY handles a private
--     competition. It applies the hundred-entrant threshold only when
--     `visibility_kind = 'public'`, and says so in its own header: "applying it
--     to a private one would refuse every organiser-created competition on the
--     platform. A private Championship has no threshold; its floor is the
--     format selector's own minimum field, which refuses below four."
--   * contract 152 gave the container its name, owner and code.
--   * contract 153 gave it a join path — `join_private_competition` resolves a
--     code to a competition and enters the caller through the one membership
--     authority, and it does not care which game that competition runs.
--
-- So what was actually missing was creation, and a way for the organiser to
-- say "we are all here now". This adds exactly those two things and writes no
-- rule about format, seeding, the draw or the schedule, all of which remain
-- contract 111's.
--
-- ---------------------------------------------------------------------------
-- WHY CREATION AND LAUNCH ARE TWO CALLS
-- ---------------------------------------------------------------------------
--
-- Contract 111 fixes the format, the draw and the whole fixture list at the
-- field size it finds, and refuses ever after, because redrawing would move
-- fixtures under predictions already made. A private Championship therefore
-- cannot be launched at the moment it is created: it has one entrant, the
-- organiser, and the format selector's floor is four.
--
-- Creating and launching in one call would mean either creating something
-- permanently broken or refusing to create anything until four people had
-- somehow already joined a competition that did not exist. So the organiser
-- creates it, shares the code, and launches when the field has arrived. That
-- is the same reason contract 127 made the public opening an operator action
-- rather than a job — the instant belongs to a person, because the instant
-- decides the shape.
--
-- LAUNCHING CLOSES REGISTRATION, in the same statement. A field fixed at
-- launch while the door stays open would leave the fifth player joining a
-- competition whose fixture list can never include them — a membership that
-- looks like entry and is not.
-- ---------------------------------------------------------------------------

create or replace function public.create_private_season_cup(
  p_tournament_id uuid,
  p_name text
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

  if v_kind <> 'league_season' then
    raise exception 'A private Championship belongs to a league season, not a %', v_kind
      using errcode = '23514';
  end if;

  if v_status = 'draft' then
    raise exception 'That season is not published yet' using errcode = '55000';
  end if;

  loop
    v_try := v_try + 1;
    v_code := predictor_internal.allocate_invite_code();

    begin
      -- `draw_required` is true because a Championship has one, and
      -- `draw_completed_at` stays null until contract 111 does it. The
      -- `bonus_competitions_draw_shape` constraint already refuses the
      -- reverse, so this is stating a fact the table would otherwise catch.
      insert into public.bonus_competitions (
        tournament_id, game_key, published, availability_status,
        draw_required, visibility_kind, registration_opens_at,
        name, owner_id, invite_code
      ) values (
        p_tournament_id, 'predictor_cup', false, 'active',
        true, 'private', now(),
        v_name, v_uid, v_code
      )
      returning id into v_id;
      exit;
    exception when unique_violation then
      if v_try >= 10 then
        raise exception 'Could not allocate an invite code, please retry'
          using errcode = '55006';
      end if;
    end;
  end loop;

  perform predictor_internal.enter_competition_game(v_id);

  return jsonb_build_object(
    'competition_id', v_id,
    'name', v_name,
    'invite_code', v_code,
    'outcome', 'created',
    -- Said plainly, because the caller has to explain it to a person: nothing
    -- is drawn yet, and the draw is what cannot be undone.
    'launched', false);
end;
$create$;

revoke all on function public.create_private_season_cup(uuid, text) from public, anon;
grant execute on function public.create_private_season_cup(uuid, text) to authenticated;

-- ---------------------------------------------------------------------------
-- The organiser says the field is complete.
-- ---------------------------------------------------------------------------

create or replace function public.launch_private_season_cup(p_competition_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $launch$
declare
  v_uid uuid := (select auth.uid());
  v_competition record;
  v_result jsonb;
begin
  if v_uid is null then
    raise exception 'Not authenticated' using errcode = 'insufficient_privilege';
  end if;

  select competition.id, competition.owner_id, competition.game_key,
         competition.visibility_kind, competition.completed_at
    into v_competition
    from public.bonus_competitions competition
    where competition.id = p_competition_id
    for update;

  if v_competition.id is null then
    raise exception 'That competition does not exist' using errcode = '22023';
  end if;

  -- The organiser's decision and nobody else's. An entrant launching a
  -- competition would be fixing a draw the owner had not agreed to, and it
  -- cannot be undone afterwards.
  if v_competition.visibility_kind <> 'private' or v_competition.owner_id is distinct from v_uid then
    raise exception 'Only the organiser of a private competition may launch it'
      using errcode = 'insufficient_privilege';
  end if;

  if v_competition.game_key <> 'predictor_cup' then
    raise exception 'Only a Championship is launched this way, not a %', v_competition.game_key
      using errcode = '23514';
  end if;

  if v_competition.completed_at is not null then
    return jsonb_build_object('outcome', 'refused', 'reason', 'already_completed');
  end if;

  -- Contract 111 owns the format, the seeding, the draw, the schedule and its
  -- own idempotence. This adds none of it and checks none of it: a second
  -- opinion here about what a six-entrant field looks like is exactly the
  -- second authority the repository keeps refusing to create.
  v_result := predictor_internal.launch_season_cup(p_competition_id);

  -- A field fixed at launch with the door left open produces a membership that
  -- looks like entry and is not. Only on a launch that actually happened —
  -- `not_open` and `no_viable_format` leave the competition gathering players.
  if v_result->>'outcome' not in ('not_open', 'no_viable_format') then
    update public.bonus_competitions
       set registration_closes_at = now(), updated_at = now()
     where id = p_competition_id
       and registration_closes_at is null;
  end if;

  return jsonb_set(v_result, '{gameKey}', '"predictor_cup"'::jsonb, true);
end;
$launch$;

revoke all on function public.launch_private_season_cup(uuid) from public, anon;
grant execute on function public.launch_private_season_cup(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- Prove the shape, in the same transaction.
-- ---------------------------------------------------------------------------

do $$
declare
  -- The assertions below are about what these functions DO, so they are made
  -- against the code with its comments stripped.
  --
  -- Scanning the comments too is what made the first version of this block
  -- refuse its own migration, twice over. `launch_private_season_cup`
  -- documents that "Contract 111 owns the format, the seeding, the draw" — and
  -- `seed` matched inside `seeding`, so the sentence explaining that the
  -- function DELEGATES the format read as the function RESTATING it. The
  -- `draw_completed_at` check below failed the same way, on a comment saying
  -- that column stays null until contract 111 sets it.
  --
  -- Stripping comments keeps the checks strict rather than loosening them: a
  -- real `seeding` or `draw_completed_at` in the code still trips them. Found
  -- by the pgTAP suite on run 31442319307 — the first run in which a local
  -- database started, and so the first execution these blocks ever had.
  v_launch text := regexp_replace(
    pg_get_functiondef('public.launch_private_season_cup(uuid)'::regprocedure),
    '--[^\n]*', '', 'g');
  v_create text := regexp_replace(
    pg_get_functiondef('public.create_private_season_cup(uuid,text)'::regprocedure),
    '--[^\n]*', '', 'g');
begin
  -- The launch delegates the whole format decision.
  if v_launch !~ 'launch_season_cup' then
    raise exception 'The private launch must delegate to contract 111';
  end if;

  -- And states no format rule of its own. These are the words a second
  -- opinion about the draw would need.
  if v_launch ~* 'single_group|meetings|leagueRounds|seed' then
    raise exception 'The private launch must not restate contract 111 format rules';
  end if;

  -- Creation does not draw. A competition drawn at creation is drawn at a
  -- field size of one, permanently.
  if v_create ~ 'launch_season_cup' or v_create ~ 'draw_completed_at' then
    raise exception 'Creating a private Championship must not launch or draw it';
  end if;

  if exists (
    select 1 from information_schema.routine_privileges
     where routine_schema = 'public'
       and routine_name in ('create_private_season_cup', 'launch_private_season_cup')
       and grantee in ('anon', 'PUBLIC')
  ) then
    raise exception 'A private Championship must not be created or launched anonymously';
  end if;
end;
$$;
