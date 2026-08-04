-- Contract 88: assign a season Last Man Standing entrant the club they did not
-- pick.
--
-- ADR 0013 requires an entrant who misses a selection to be AUTO-ASSIGNED
-- DETERMINISTICALLY, never eliminated, having explicitly rejected no-pick
-- elimination as "too punitive across thirty-eight weekly deadlines". Contract
-- 84 decided WHICH club. Nothing writes it. This does.
--
-- It is the second of the three steps that make season LMS work. Contract 86
-- made a season pick storable at all; contract 87 made the mandatory used-list
-- reset storable; this makes the missed pick happen. The settlement job that
-- drives it over every due round follows, and is deliberately not here.
--
-- ---------------------------------------------------------------------------
-- THE LOCK NEEDS AN EXCEPTION, AND EXACTLY ONE CALLER MAY USE IT
-- ---------------------------------------------------------------------------
--
-- Assignment happens BECAUSE the round locked. The trigger on
-- `bonus_lms_selections` refuses every insert past `locks_at`, so the writer
-- cannot do its job without an exception — and an exception to a lock is the
-- most dangerous thing in this codebase to get wrong, because a hole in it
-- lets a player pick after they have seen a result.
--
-- The tournament has a comparable server-owned exception, and it is written
-- `current_user = 'postgres'`. THAT FORM MUST NOT BE COPIED. Inside a
-- SECURITY DEFINER function `current_user` is the function's OWNER for every
-- caller, so the test is true for everyone and contributes nothing to a control
-- whose only job is to admit one caller. `session_user` is the caller.
--
-- Measured rather than reasoned, with a real second role on PostgreSQL 16:
--
--   caller         capability   session_user form   current_user form
--   postgres       on           admits              admits
--   c87_attacker   on           REFUSES             ADMITS  <- the trap
--   postgres       unset        refuses             —
--   c87_attacker   unset        refuses             —
--
-- The attacker case is the one that matters: an ordinary role can set a custom
-- GUC on its own session, so the capability alone is not a control. It is the
-- SECOND half of the pair — it narrows a `postgres` session to the one
-- statement that actually needs the exception, so a future server function
-- running as `postgres` cannot write past a lock by accident.
--
-- Both halves are required, and `138`'s successor pins all four cases.
--
-- ---------------------------------------------------------------------------
-- WHAT THIS WRITER WILL NOT DO
-- ---------------------------------------------------------------------------
--
-- It does not decide who is eliminated. Elimination is derived by contract 85's
-- replay from setup, picks and results, and re-deriving it here would put the
-- same rule in two places where they can disagree. This reads the recorded
-- outcome and declines to assign to an entrant already marked eliminated.
--
-- It does not invent a pick. `auto_assign_lms_team` returns null when the round
-- offers no eligible club, and the answer is to write nothing and say so.
-- Assigning an arbitrary club would be worse than the elimination ADR 0013
-- rejected, because it would look deliberate.
--
-- It does not touch the tournament. The tournament Last Man Standing is a
-- delivered game at the contract-63 baseline with its own authority; giving it
-- auto-assignment would be a rule change, not an implementation.
--
-- It does not run itself. Nothing calls this yet.

begin;

-- ---------------------------------------------------------------------------
-- The capability, in one readable place.
--
-- SECURITY INVOKER on purpose. `session_user` is the caller either way, but a
-- reader should not have to know that to trust this, and a definer marking here
-- would invite the very confusion the header describes.
-- ---------------------------------------------------------------------------

create or replace function predictor_internal.lms_auto_assignment_in_progress()
returns boolean
language sql
stable
set search_path = ''
as $$
  select session_user = 'postgres'
     and coalesce(current_setting('predictor.lms_auto_assign', true), '') = 'on';
$$;

revoke all on function predictor_internal.lms_auto_assignment_in_progress()
  from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- The lock, with its single exception.
--
-- Every other check in this trigger is character-for-character what contract 86
-- left. Only the lock arm gains a condition.
-- ---------------------------------------------------------------------------

create or replace function predictor_internal.assert_bonus_lms_selection_shape()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_game text;
  v_kind text;
  v_window_competition uuid;
  v_opens timestamptz;
  v_locks timestamptz;
begin
  select w.competition_id, w.opens_at, w.locks_at, c.game_key, t.kind
    into v_window_competition, v_opens, v_locks, v_game, v_kind
    from public.bonus_competition_windows w
    join public.bonus_competitions c on c.id = w.competition_id
    join public.tournaments t on t.id = c.tournament_id
    where w.id = new.window_id;

  if v_window_competition is distinct from new.competition_id
    or v_game <> 'last_man_standing' then
    raise exception 'Selections belong to a Last Man Standing round'
      using errcode = 'check_violation';
  end if;

  if v_opens is null or now() < v_opens then
    raise exception 'This round is not open yet'
      using errcode = 'check_violation';
  end if;

  if v_locks is null then
    raise exception 'This round has no scheduled deadline yet'
      using errcode = 'check_violation';
  end if;

  -- The lock refuses every caller EXCEPT a `postgres` session that has
  -- explicitly opened the auto-assignment capability, on a SEASON round. See
  -- the header for why the pair is required and why `current_user` is not.
  --
  -- The competition-kind term is the third narrowing, and it is not decoration:
  -- the exception exists for season auto-assignment, the writer refuses a
  -- tournament round outright, and the tournament Last Man Standing is a
  -- delivered game at the contract-63 baseline. Without this term a locked
  -- tournament round would become writable by a server session that has no
  -- reason to write to it — a wider hole than the feature needs, in the game
  -- least able to absorb one.
  if now() >= v_locks
     and not (v_kind = 'league_season'
              and predictor_internal.lms_auto_assignment_in_progress()) then
    raise exception 'This round has locked'
      using errcode = 'check_violation';
  end if;

  -- The club must play in the round. A tournament round proves that from
  -- `matches`, a season round from `season_fixtures`. Either satisfies it;
  -- neither is weakened, and a club playing in NO fixture of either kind is
  -- still refused. Note that this is NOT relaxed for the writer: an assigned
  -- club must play in the round exactly as a chosen one must.
  if not exists (
    select 1
    from public.bonus_window_fixtures f
    join public.matches m on m.id = f.match_id
    where f.window_id = new.window_id
      and (m.home_team_id = new.team_id or m.away_team_id = new.team_id)
  ) and not exists (
    select 1
    from public.season_cup_window_fixtures link
    join public.season_fixtures fixture on fixture.id = link.season_fixture_id
    where link.window_id = new.window_id
      and (fixture.home_team_id = new.team_id or fixture.away_team_id = new.team_id)
  ) then
    raise exception 'The picked team does not play in this round'
      using errcode = 'check_violation';
  end if;

  return new;
end;
$$;

revoke all on function predictor_internal.assert_bonus_lms_selection_shape()
  from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- Assign one entrant, in one round.
--
-- Returns a jsonb outcome rather than raising, because the driver that follows
-- must be able to record what happened to each entrant and carry on. The
-- outcomes are:
--
--   assigned         a club was chosen and stored;
--   already_picked   the entrant picked for themselves — idempotent, and the
--                    reason a retry after a crash is safe;
--   not_locked       the round has not locked, so the entrant may still pick;
--   eliminated       the recorded outcome says they are out;
--   no_eligible_club the round offers none — nothing written, fail closed;
--   refused          the input is not a season Last Man Standing round, or the
--                    session cannot hold the lock exception.
-- ---------------------------------------------------------------------------

create or replace function predictor_internal.auto_assign_lms_entrant(
  p_competition_id uuid,
  p_user_id uuid,
  p_window_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_tournament_id uuid;
  v_kind text;
  v_game text;
  v_locks timestamptz;
  v_outcome text;
  v_fixtures jsonb;
  v_teams jsonb;
  v_used jsonb;
  v_cycle smallint;
  v_team_id uuid;
begin
  select c.tournament_id, t.kind, c.game_key, w.locks_at
    into v_tournament_id, v_kind, v_game, v_locks
    from public.bonus_competition_windows w
    join public.bonus_competitions c on c.id = w.competition_id
    join public.tournaments t on t.id = c.tournament_id
   where w.id = p_window_id
     and c.id = p_competition_id;

  -- Season Last Man Standing only. The tournament game keeps contract-63
  -- behaviour, and a round from another game is not this function's business.
  if v_tournament_id is null or v_game <> 'last_man_standing'
     or v_kind <> 'league_season' then
    return jsonb_build_object('outcome', 'refused', 'reason', 'not_a_season_lms_round');
  end if;

  -- Assignment is what the LOCK does. Before it, the entrant may still pick,
  -- and writing for them would take that away.
  if v_locks is null or now() < v_locks then
    return jsonb_build_object('outcome', 'not_locked');
  end if;

  select entrant.outcome
    into v_outcome
    from public.bonus_competition_entrants entrant
   where entrant.competition_id = p_competition_id
     and entrant.user_id = p_user_id;

  if v_outcome is null then
    return jsonb_build_object('outcome', 'refused', 'reason', 'not_an_entrant');
  end if;

  if v_outcome = 'eliminated' then
    return jsonb_build_object('outcome', 'eliminated');
  end if;

  -- Checked BEFORE anything is computed, so a retry costs one index lookup.
  if exists (
    select 1 from public.bonus_lms_selections sel
     where sel.competition_id = p_competition_id
       and sel.user_id = p_user_id
       and sel.window_id = p_window_id
  ) then
    return jsonb_build_object('outcome', 'already_picked');
  end if;

  select jsonb_agg(
           jsonb_build_object(
             'fixtureId', fixture.id::text,
             'homeTeamId', fixture.home_team_id::text,
             'awayTeamId', fixture.away_team_id::text)
           order by fixture.id)
    into v_fixtures
    from public.season_cup_window_fixtures link
    join public.season_fixtures fixture
      on fixture.id = link.season_fixture_id
     and fixture.tournament_id = v_tournament_id
   where link.window_id = p_window_id;

  if v_fixtures is null then
    -- A round with no fixtures offers no club. Contract 84 would return null
    -- here anyway; returning early says why.
    return jsonb_build_object('outcome', 'no_eligible_club', 'reason', 'no_fixtures');
  end if;

  -- Every club in the season, because `resolve_lms_eligibility` refuses a
  -- fixture naming a club it was not given.
  select jsonb_agg(jsonb_build_object('teamId', t.id::text, 'name', t.name)
                   order by t.id)
    into v_teams
    from public.teams t
   where t.tournament_id = v_tournament_id;

  v_used := predictor_internal.lms_used_team_ids(p_competition_id, p_user_id);
  v_cycle := predictor_internal.lms_cycle_for_pick(p_competition_id, p_user_id, p_window_id);

  v_team_id := predictor_internal.auto_assign_lms_team(
                 v_fixtures, coalesce(v_teams, '[]'::jsonb), v_used)::uuid;

  -- Null means the round offers no eligible club, or the input was refused.
  -- Write nothing. See the header: an invented pick would look deliberate.
  if v_team_id is null then
    return jsonb_build_object('outcome', 'no_eligible_club');
  end if;

  -- The capability is opened for one statement and closed immediately. `true`
  -- makes it transaction-local, so it cannot leak into a later transaction on a
  -- pooled connection; closing it by hand means it cannot leak into a later
  -- STATEMENT of this one either.
  perform set_config('predictor.lms_auto_assign', 'on', true);

  -- Opening the capability is not the same as HOLDING the exception: the
  -- session half is `session_user`, which no SECURITY DEFINER function can
  -- change. A session that is not `postgres` therefore gets nowhere, and it
  -- must find that out HERE rather than by raising out of the insert below.
  --
  -- This is a real caller, not a hypothetical: PostgREST logs in as
  -- `authenticator` and switches role, so anything reaching this function
  -- through the API — including with a service-role key — cannot hold the
  -- exception. Only a database session that logged in as `postgres` can, which
  -- in practice means pg_cron and migrations.
  --
  -- Reporting beats raising because the driver settles a batch: one entrant it
  -- cannot assign must not abort the round for everyone else.
  --
  -- THE CONSTRAINT THIS PUTS ON THE NEXT CONTRACT: the settlement job must be
  -- scheduled through pg_cron, which runs as the role that scheduled it. It
  -- must NOT be granted to `service_role` and driven through the API the way
  -- contract 83's matchweek job is, because that path can never hold the
  -- exception and every assignment would come back refused.
  if not predictor_internal.lms_auto_assignment_in_progress() then
    perform set_config('predictor.lms_auto_assign', '', true);
    return jsonb_build_object(
      'outcome', 'refused',
      'reason', 'lock_exception_unavailable');
  end if;

  begin
    insert into public.bonus_lms_selections (
      competition_id, user_id, window_id, team_id, used_cycle
    ) values (
      p_competition_id, p_user_id, p_window_id, v_team_id, v_cycle
    );
  exception when others then
    -- Close the capability on the way out too. Without this an insert that
    -- trips the club-uniqueness key would leave the lock exception open for the
    -- rest of the transaction, which is precisely the hole this design exists
    -- to avoid.
    perform set_config('predictor.lms_auto_assign', '', true);
    raise;
  end;

  perform set_config('predictor.lms_auto_assign', '', true);

  return jsonb_build_object(
    'outcome', 'assigned',
    'teamId', v_team_id::text,
    'usedCycle', v_cycle);
end;
$$;

revoke all on function predictor_internal.auto_assign_lms_entrant(uuid, uuid, uuid)
  from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- Prove at apply time that the exception is shut.
--
-- The failure this guards against is the capability being left open — by a
-- default, by a leaked `set_config`, or by the guard being written so that an
-- unset capability satisfies it. If a plain caller can insert past a lock, the
-- game is broken in the way players notice.
-- ---------------------------------------------------------------------------

do $$
begin
  if predictor_internal.lms_auto_assignment_in_progress() then
    raise exception
      'the auto-assignment capability is open by default; the lock exception is a hole';
  end if;

  perform set_config('predictor.lms_auto_assign', 'on', true);
  if not predictor_internal.lms_auto_assignment_in_progress() then
    raise exception
      'the auto-assignment capability cannot be opened; the writer could never assign';
  end if;

  perform set_config('predictor.lms_auto_assign', '', true);
  if predictor_internal.lms_auto_assignment_in_progress() then
    raise exception
      'the auto-assignment capability cannot be closed; it would stay open for the transaction';
  end if;
end;
$$;

commit;
