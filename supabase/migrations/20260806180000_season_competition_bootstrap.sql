-- Contract 127: a season competition can be opened for play.
--
-- ---------------------------------------------------------------------------
-- THE GAP, MEASURED ON HOSTED DEVELOPMENT RATHER THAN INFERRED
-- ---------------------------------------------------------------------------
--
-- Two league seasons are published, both carrying a full fixture list with
-- every kickoff set and their round play windows derived. Six competitions sit
-- on them, all published and active, and entrants have already joined. Not one
-- of them can be played:
--
--   last_man_standing   0 rounds, and no `season_lms_setups` row at all
--   predictor_cup       0 groups, so no draw and no fixtures
--   main_predictor      nothing missing — see below
--
-- The Last Man Standing settlement job returns `refused / no_setup` without a
-- setup row, and `nothing_settled` without a locked round. Nothing in the
-- repository writes either. The Championship has a launch driver (contract 111)
-- that has never had a caller. So both games are complete, tested and
-- unreachable — the same "an authority with no caller" shape as contracts 116,
-- 118, 120, 122 and 124, and this is the acquisition end of it.
--
-- MAIN PREDICTOR IS DELIBERATELY NOT IN THAT LIST. Its rounds ARE the season's
-- matchweeks and its lock is derived from `season_fixtures.kickoff_at` minus
-- its own buffer, every time, by the trigger that owns it. It has never used
-- `bonus_competition_windows` and giving it one here would create a second
-- source for the same lock. The dispatch below says so in an outcome rather
-- than staying silent about it, because "nothing to do" and "not handled" look
-- identical to a caller otherwise.
--
-- ---------------------------------------------------------------------------
-- WHY AN OPERATOR ACTION AND NOT A JOB
-- ---------------------------------------------------------------------------
--
-- This was left open deliberately when contract 122 landed, and it is decided
-- here as an explicit administrator call.
--
-- The reason is that opening is not reversible in the way a scheduled job
-- assumes. `launch_season_cup` fixes the format, the draw and the whole fixture
-- list at the field size it finds at that instant, and refuses ever after
-- because redrawing would move fixtures under predictions. A cron tick decides
-- WHEN that snapshot is taken, which means scheduler timing would choose the
-- competition's shape. The Last Man Standing calendar is the same in kind:
-- windows are created once and never rescheduled, because rescheduling moves
-- locks under selections already made.
--
-- So the instant belongs to a person. Turning this into a driver later remains
-- available and is a separate decision — everything below is idempotent and
-- takes its boundary as an argument, which is what a driver would need.
--
-- ---------------------------------------------------------------------------
-- WHY THE FIRST INSTANCE NEEDS ITS OWN GENERATOR
-- ---------------------------------------------------------------------------
--
-- Contract 109 already schedules a Last Man Standing calendar, and refuses a
-- first instance by name: "A first instance takes its calendar from the
-- catalogue. Scheduling one here would be a second, competing source for the
-- same rounds."
--
-- That was true and is now the thing being fixed. The catalogue it refers to is
-- `scripts/bonus-games/publish-catalogue.sql`, which publishes the Euro 2028
-- tournament's fixed seven-round plan and only that — it is keyed on the
-- tournament by name and carries hard-coded 2028 instants. A league season has
-- no catalogue and never will: its rounds come from its own fixture list.
--
-- The two remain non-competing because they refuse each other's case rather
-- than sharing a boundary. Contract 109 handles a competition WITH a
-- predecessor and refuses one without; this handles a competition WITHOUT a
-- predecessor and refuses one with. The derivation is identical — the same
-- `next_eligible_league_round`, the same `season_matchweek_lock_at`, the same
-- open-when-the-previous-locked chaining — because the calendar of a first
-- instance and of a successor differ only in what they start after.
--
-- ---------------------------------------------------------------------------
-- WHAT THIS DOES NOT DECIDE
-- ---------------------------------------------------------------------------
--
-- A PRIVATE Last Man Standing competition's rules are its organiser's choice
-- among ADR 0022's presets, and this refuses one that has not made it rather
-- than picking Classic on their behalf. Only the PUBLIC competition is written
-- here, and only because ADR 0022 pins it to Classic and the schema already
-- enforces that — `season_lms_setups_public_is_classic` refuses any other
-- public setup outright. So the row this writes is the only public row the
-- table would accept.
--
-- Nothing here settles, scores or completes anything. Opening a competition
-- creates the calendar and the draw; results still arrive through the protected
-- confirmation gate, and the existing rederivation jobs do the rest.

begin;

-- ---------------------------------------------------------------------------
-- The authorisation boundary.
--
-- A separate gate from `require_result_admin`, because opening a competition is
-- not result administration and an account trusted to correct a scoreline has
-- not thereby been trusted to fix a season's draw. Both admit `super_admin`,
-- which is how the owner reaches this today; the `competitions` capability
-- exists so the two can be delegated apart later.
-- ---------------------------------------------------------------------------

create or replace function predictor_internal.require_competition_admin()
returns void
language plpgsql
security invoker
set search_path = ''
as $gate$
declare
  v_metadata jsonb := coalesce(auth.jwt() -> 'app_metadata', '{}'::jsonb);
  v_capabilities jsonb := coalesce(v_metadata -> 'admin_capabilities', '[]'::jsonb);
begin
  if v_metadata ->> 'admin_role' = 'super_admin' then
    return;
  end if;

  if jsonb_typeof(v_capabilities) = 'array'
     and v_capabilities ? 'competitions'
  then
    return;
  end if;

  raise exception 'Competition administration is not authorised'
    using errcode = '42501';
end;
$gate$;

revoke all on function predictor_internal.require_competition_admin()
  from public, anon, authenticated, service_role;

-- ---------------------------------------------------------------------------
-- The first instance's calendar.
--
-- The same shape as contract 109's successor generator, starting after an
-- argument instead of after a predecessor's completion.
-- ---------------------------------------------------------------------------

create or replace function predictor_internal.generate_lms_first_windows(
  p_competition_id uuid,
  p_after timestamptz
)
returns integer
language plpgsql
security definer
set search_path = ''
as $first$
declare
  v_competition record;
  v_tournament_kind text;
  v_buffer integer;
  v_first_round uuid;
  v_first_locks_at timestamptz;
  v_created integer := 0;
begin
  if p_after is null then
    raise exception 'A boundary instant is required: rounds are scheduled after something'
      using errcode = '22023';
  end if;

  select competition.id,
         competition.tournament_id,
         competition.game_key,
         competition.predecessor_competition_id
    into v_competition
    from public.bonus_competitions competition
    where competition.id = p_competition_id;

  if not found then
    raise exception 'Competition % does not exist', p_competition_id
      using errcode = '23503';
  end if;

  if v_competition.game_key <> 'last_man_standing' then
    raise exception 'Only a Last Man Standing competition has rounds to schedule this way, not %',
      v_competition.game_key
      using errcode = '23514';
  end if;

  -- The other half of contract 109's refusal. A successor starts after its
  -- predecessor finished, which is a boundary this function is not given and
  -- must not guess at.
  if v_competition.predecessor_competition_id is not null then
    raise exception
      'Competition % is a restarted successor; its calendar comes from the successor scheduler, which starts it after its predecessor finished',
      p_competition_id
      using errcode = '23514';
  end if;

  select tournament.kind into v_tournament_kind
    from public.tournaments tournament
    where tournament.id = v_competition.tournament_id;

  -- The Euro tournament's Last Man Standing has a published seven-round plan of
  -- its own and no league matchweeks at all. Refusing here says so, rather than
  -- returning zero and leaving the caller to read it as "no fixtures yet".
  if v_tournament_kind is distinct from 'league_season' then
    raise exception
      'Competition % belongs to a % rather than a league season, so it has no league rounds to be scheduled over',
      p_competition_id, coalesce(v_tournament_kind, 'competition of unknown kind')
      using errcode = '23514';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(p_competition_id::text, 0)
  );

  -- Idempotent, re-read under the lock. A competition that already has rounds
  -- is not rescheduled: its calendar may already have been played against, and
  -- replacing it would move locks under existing selections.
  if exists (
    select 1 from public.bonus_competition_windows existing
    where existing.competition_id = p_competition_id
  ) then
    return 0;
  end if;

  select definition.buffer_minutes
    into v_buffer
    from public.game_definitions definition
    where definition.game_key = 'last_man_standing';

  v_first_round := predictor_internal.next_eligible_league_round(
    v_competition.tournament_id, 'last_man_standing', p_after
  );

  -- No eligible round. Contract 109's convention exactly: this is not an error,
  -- it is a season whose remaining fixtures carry no derivable lock, and a
  -- later run will find one if one appears.
  if v_first_round is null then
    return 0;
  end if;

  v_first_locks_at := predictor_internal.season_matchweek_lock_at(
    v_competition.tournament_id, v_first_round, v_buffer
  );

  with scheduled as (
    select
      round.id as round_id,
      round.label,
      round.ordinal,
      predictor_internal.season_matchweek_lock_at(
        v_competition.tournament_id, round.id, v_buffer) as locks_at
    from public.competition_rounds round
    where round.tournament_id = v_competition.tournament_id
      and round.kind = 'league_matchweek'
  ), eligible as (
    select
      scheduled.round_id,
      scheduled.label,
      scheduled.locks_at,
      row_number() over (order by scheduled.locks_at, scheduled.ordinal) as sequence,
      -- Each round opens when the previous one locked; the first opens at the
      -- boundary. Ordering by the lock instant makes this monotonic by
      -- construction, so `locks_at > opens_at` cannot be violated by a
      -- rescheduled fixture.
      lag(scheduled.locks_at) over (order by scheduled.locks_at, scheduled.ordinal)
        as previous_locks_at
    from scheduled
    where scheduled.locks_at is not null
      and scheduled.locks_at >= v_first_locks_at
  ), created as (
    insert into public.bonus_competition_windows (
      competition_id, sequence, label, opens_at, locks_at
    )
    select
      p_competition_id,
      eligible.sequence,
      eligible.label,
      coalesce(eligible.previous_locks_at, p_after),
      eligible.locks_at
    from eligible
    returning id, sequence
  ), linked as (
    insert into public.season_cup_window_fixtures (window_id, season_fixture_id)
    select created.id, fixture.id
    from created
    join eligible on eligible.sequence = created.sequence
    join public.season_fixtures fixture
      on fixture.tournament_id = v_competition.tournament_id
     and fixture.competition_round_id = eligible.round_id
    returning window_id
  )
  select count(*)::integer into v_created from created;

  insert into public.bonus_competition_audit (competition_id, action, detail)
  values (
    p_competition_id,
    'first_calendar_scheduled',
    jsonb_build_object(
      'windowsCreated', v_created,
      'firstRoundId', v_first_round,
      'scheduledAfter', p_after
    )
  );

  return v_created;
end;
$first$;

revoke all on function predictor_internal.generate_lms_first_windows(uuid, timestamptz)
  from public, anon, authenticated, service_role;

-- ---------------------------------------------------------------------------
-- Opening one competition.
--
-- Dispatches by game rather than doing one game's work, because the three
-- season games need three different things and a caller opening a season should
-- not have to know which. Every branch is idempotent and every refusal names
-- the game it refused for.
-- ---------------------------------------------------------------------------

create or replace function predictor_internal.open_season_competition(
  p_competition_id uuid,
  p_after timestamptz
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $open$
declare
  v_competition record;
  v_tournament_kind text;
  v_setup_written boolean := false;
  v_windows integer;
  v_playable integer;
begin
  if p_after is null then
    raise exception 'A boundary instant is required: a competition is opened as of something'
      using errcode = '22023';
  end if;

  select competition.id,
         competition.tournament_id,
         competition.game_key,
         competition.visibility_kind,
         competition.completed_at
    into v_competition
    from public.bonus_competitions competition
    where competition.id = p_competition_id;

  if not found then
    raise exception 'Competition % does not exist', p_competition_id
      using errcode = '23503';
  end if;

  select tournament.kind into v_tournament_kind
    from public.tournaments tournament
    where tournament.id = v_competition.tournament_id;

  if v_tournament_kind is distinct from 'league_season' then
    raise exception
      'Competition % belongs to a % rather than a league season; a tournament competition takes its calendar from the published catalogue',
      p_competition_id, coalesce(v_tournament_kind, 'competition of unknown kind')
      using errcode = '23514';
  end if;

  -- A finished competition is not opened. It may legitimately re-derive if a
  -- result is corrected, but creating a calendar or a draw on it would be
  -- creating a second competition inside the first.
  if v_competition.completed_at is not null then
    return jsonb_build_object(
      'outcome', 'refused',
      'reason', 'already_completed',
      'gameKey', v_competition.game_key);
  end if;

  if v_competition.game_key = 'main_predictor' then
    -- Nothing to open. Stated with a measurement rather than asserted, so a
    -- season whose fixtures are genuinely missing is distinguishable from one
    -- that is simply already playable.
    select count(*)::integer into v_playable
      from public.competition_rounds round
      where round.tournament_id = v_competition.tournament_id
        and round.kind = 'league_matchweek'
        and round.window_opens_at is not null;

    return jsonb_build_object(
      'outcome', 'no_windows_required',
      'gameKey', 'main_predictor',
      'playableRounds', v_playable);
  end if;

  if v_competition.game_key = 'predictor_cup' then
    -- Contract 111 owns every rule here: the public threshold, the format
    -- selector, the draw, the schedule and its own idempotence. This supplies
    -- the caller it has never had.
    return jsonb_set(
      predictor_internal.launch_season_cup(p_competition_id),
      '{gameKey}', '"predictor_cup"'::jsonb, true);
  end if;

  if v_competition.game_key <> 'last_man_standing' then
    raise exception
      'Competition % is a %, which is not a season game this opens',
      p_competition_id, v_competition.game_key
      using errcode = '23514';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(p_competition_id::text, 0)
  );

  -- Already open. Reported by name rather than falling through to the
  -- generator's zero, because "this competition has a calendar" and "this
  -- season has no schedulable round left" are opposite facts and an operator
  -- acts differently on each.
  if exists (
    select 1 from public.bonus_competition_windows existing
    where existing.competition_id = p_competition_id
  ) then
    return jsonb_build_object(
      'outcome', 'already_open',
      'gameKey', 'last_man_standing',
      'setupWritten', false,
      'windows', 0);
  end if;

  if not exists (
    select 1 from public.season_lms_setups setup
    where setup.competition_id = p_competition_id
  ) then
    -- ADR 0022 pins the public competition to Classic under the public endgame,
    -- and `season_lms_setups_public_is_classic` refuses any other public row —
    -- so this writes the only public setup the table would accept rather than
    -- making a choice. A private competition's rules are its organiser's.
    if v_competition.visibility_kind <> 'public' then
      return jsonb_build_object(
        'outcome', 'refused',
        'reason', 'private_setup_not_chosen',
        'gameKey', 'last_man_standing');
    end if;

    insert into public.season_lms_setups (
      competition_id, lives, saves, draws_rule, endgame_scope, endgame_on_wipeout
    )
    values (p_competition_id, 0, 0, 'eliminate', 'public', null);

    v_setup_written := true;
  end if;

  v_windows := predictor_internal.generate_lms_first_windows(p_competition_id, p_after);

  return jsonb_build_object(
    'outcome', case when v_windows > 0 then 'opened' else 'no_schedulable_round' end,
    'gameKey', 'last_man_standing',
    'setupWritten', v_setup_written,
    'windows', v_windows);
end;
$open$;

revoke all on function predictor_internal.open_season_competition(uuid, timestamptz)
  from public, anon, authenticated, service_role;

-- ---------------------------------------------------------------------------
-- The administrator's entry point.
-- ---------------------------------------------------------------------------

create or replace function public.admin_open_season_competition(
  p_competition_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $admin$
begin
  perform predictor_internal.require_competition_admin();
  return predictor_internal.open_season_competition(p_competition_id, now());
end;
$admin$;

revoke all on function public.admin_open_season_competition(uuid)
  from public, anon, authenticated;
grant execute on function public.admin_open_season_competition(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- Prove the shape, in the same transaction.
-- ---------------------------------------------------------------------------

do $$
begin
  -- The entry point is gated. Contract 125's guard for the result entry points
  -- caught nothing because it was written alongside them; this one exists for
  -- the same reason and against the same failure — a definer function reachable
  -- by every signed-in account with no check in its body.
  if (
    select pg_catalog.pg_get_functiondef(to_regprocedure(
      'public.admin_open_season_competition(uuid)'))
  ) not like '%require_competition_admin%' then
    raise exception 'the season opening entry point does not call require_competition_admin';
  end if;

  -- The internal layer stays internal.
  if exists (
    select 1 from information_schema.routine_privileges
    where routine_schema = 'predictor_internal'
      and routine_name in (
        'require_competition_admin', 'generate_lms_first_windows',
        'open_season_competition')
      and grantee in ('anon', 'authenticated', 'service_role', 'PUBLIC')
  ) then
    raise exception 'a contract 127 internal function is reachable from a browser role';
  end if;

  -- This migration opens nothing. It supplies the ability to. The audit action
  -- is created here, so no row can carry it yet in any environment.
  if exists (
    select 1 from public.bonus_competition_audit
    where action = 'first_calendar_scheduled'
  ) then
    raise exception 'contract 127 must not open a competition itself';
  end if;
end;
$$;

commit;
