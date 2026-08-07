-- Contract 126: a game that has not started can be rejoined.
--
-- ---------------------------------------------------------------------------
-- WHAT WAS ACTUALLY WRONG
-- ---------------------------------------------------------------------------
--
-- Found in the deploy preview: leave the season Last Man Standing competition
-- and you cannot get back in, on a competition where nothing has happened at
-- all. Measured on hosted development at the time: `bonus_competition_windows`
-- holds ZERO rows for all six season game competitions, so no round exists, no
-- round has opened or locked, no club has been picked and nothing has settled.
--
-- `last_man_standing` is the only game in `game_definitions` with
-- `allow_rejoin = false`; every other game is true. `join_competition_game`
-- read that flag alone:
--
--     if not v_definition.allow_rejoin then
--       raise exception 'This game cannot be rejoined after leaving'
--
-- So the refusal was permanent from the moment the competition was published,
-- which is months before it can be played.
--
-- ---------------------------------------------------------------------------
-- THIS ENFORCES THE RULE RATHER THAN CHANGING IT
-- ---------------------------------------------------------------------------
--
-- The rule is not "you may never rejoin". ADR 0013 § Entry says **"Entry closes
-- after round one — public and private alike... The field is fixed once the
-- first round locks."** ADR 0020 adds that leaving "never permits rejoining
-- that same RUNNING competition, consistent with the rolling-entry rejection".
--
-- Running is load-bearing, and the rolling-entry rejection says why in its own
-- words: "a player joining at round eight arrives with all twenty clubs while
-- survivors have burned eight." That asymmetry is the entire reason. Before the
-- first round locks it does not exist — nobody has burned a club, the field is
-- not yet fixed, and a player who left is in precisely the position of one who
-- never joined.
--
-- So the flag now bites when the competition is running, and not before. The
-- game's capability is unchanged; what changes is that a capability about a
-- running competition stops being applied to one that has not begun.
--
-- ---------------------------------------------------------------------------
-- WHERE "RUNNING" SITS, AND WHY THERE
-- ---------------------------------------------------------------------------
--
-- The first window to LOCK, which is ADR 0013's own boundary ("the field is
-- fixed once the first round locks") and the same instant the game's other
-- rules already turn on: managed entrants lock at exactly that instant with no
-- late entry, and setup options become immutable there.
--
-- Not first window CREATED: a calendar published weeks ahead has fixed nothing.
-- Not first pick SAVED: one entrant making an early selection would close entry
-- for everybody else, which no authority says and which would make the boundary
-- depend on another player's behaviour.
--
-- ---------------------------------------------------------------------------
-- WHAT IS UNCHANGED
-- ---------------------------------------------------------------------------
--
-- A disqualified entry still cannot be rejoined — that refusal sits above this
-- one and is untouched. An already-active membership still refuses. Leaving is
-- still refused once the caller holds a score event. And no state survives a
-- leave to be inherited on rejoin: `leave_competition_game` deletes the
-- `bonus_competition_entrants` row, and `season_lms_entrant_state` cascades off
-- it, so a rejoined entrant starts from nothing.
--
-- Behaviour changes for exactly one game today. Every other `game_definitions`
-- row has `allow_rejoin = true`, so this branch has never been reached for
-- them and is not reached now.

begin;

-- ---------------------------------------------------------------------------
-- Is this competition running?
--
-- One window whose lock has passed is enough: from that instant the field is
-- fixed. A null `locks_at` is not a lock — an unscheduled window has fixed
-- nothing — and is therefore not running.
-- ---------------------------------------------------------------------------

create or replace function predictor_internal.competition_is_running(
  p_competition_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $running$
  select exists (
    select 1
      from public.bonus_competition_windows win
     where win.competition_id = p_competition_id
       and win.locks_at is not null
       and win.locks_at <= now()
  );
$running$;

comment on function predictor_internal.competition_is_running(uuid) is
  'Contract 126. True once any window of this competition has locked, which is '
  'ADR 0013''s "the field is fixed once the first round locks".';

revoke all on function predictor_internal.competition_is_running(uuid)
  from public, anon, authenticated, service_role;

-- ---------------------------------------------------------------------------
-- The entry point, redefined from its committed text in
-- `20260803070000_c1b_game_catalogue_memberships.sql` with ONE branch changed.
-- Verified by diff in
-- `tests/database-parity/rejoinBeforeStartParity.test.ts` rather than by
-- reading: this function also holds the authentication check, the availability
-- and registration-window refusals, the disqualification refusal and the
-- membership write, and none of them may move.
-- ---------------------------------------------------------------------------

create or replace function public.join_competition_game(
  p_game_competition_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
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
$$;


-- ---------------------------------------------------------------------------
-- Prove the shape, in the same transaction.
-- ---------------------------------------------------------------------------

do $$
begin
  -- The gate is now conditional. A redefinition that dropped the condition
  -- would restore the permanent refusal with nothing else failing.
  if pg_catalog.pg_get_functiondef(
       pg_catalog.to_regprocedure('public.join_competition_game(uuid)')::oid
     ) not like '%competition_is_running%' then
    raise exception 'join_competition_game no longer asks whether the competition is running';
  end if;

  -- And the refusals above it are still there.
  if pg_catalog.pg_get_functiondef(
       pg_catalog.to_regprocedure('public.join_competition_game(uuid)')::oid
     ) not like '%A disqualified game entry cannot be rejoined%' then
    raise exception 'the disqualification refusal was lost in the redefinition';
  end if;

  if exists (
    select 1 from information_schema.routine_privileges
     where routine_name = 'competition_is_running'
       and grantee in ('anon', 'authenticated', 'service_role')
  ) then
    raise exception 'competition_is_running is reachable by a browser role';
  end if;
end;
$$;

commit;
