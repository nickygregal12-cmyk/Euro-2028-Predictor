-- Contract 119: a rescheduled fixture locks at its own kickoff.
--
-- ---------------------------------------------------------------------------
-- THE RULE, AND THE READING THE OWNER CHOSE
-- ---------------------------------------------------------------------------
--
-- Contract 117 made a provider kickoff change reach the fixture automatically.
-- The lock did not follow it. `season_matchweek_lock_at` is
-- `min(kickoff) - buffer` across the whole round, so a fixture postponed from
-- Saturday to the following Wednesday still locked at Saturday lunchtime — the
-- exact case ADR 0020's amendment of 5 August 2026 was written about, where the
-- prediction is supposed to stay open to its own kickoff.
--
-- "Each fixture locks at its own kickoff" and "the matchweek locks together
-- except for fixtures that moved" produce the SAME arithmetic, because a
-- fixture's own kickoff is never earlier than the round's minimum. They are not
-- the same game, and the difference only shows on fixtures nobody moved:
-- applied universally, an ordinary Friday-to-Monday matchweek becomes
-- predictable in stages, so Monday's game could be predicted knowing Saturday's
-- results.
--
-- **The owner chose the narrow reading on 5 August 2026: only a rescheduled
-- fixture gets its own lock.** An ordinary matchweek keeps locking together at
-- its earliest kickoff, exactly as it does today. That preserves the fairness
-- property the season Match Predictor already had, and implements the amendment
-- for the case the amendment was about.
--
-- ---------------------------------------------------------------------------
-- WHAT "RESCHEDULED" MEANS, AND WHY IT IS NOT A GUESS
-- ---------------------------------------------------------------------------
--
-- A fixture is rescheduled when `predictor_internal.season_fixture_revisions`
-- holds a row for it. That table is contract 117's append-only record of every
-- kickoff a provider moved, with the instant it moved from.
--
-- So "has this moved?" is a stored fact with provenance, not an inference from
-- comparing a kickoff against a round's shape. The alternative — deciding a
-- fixture moved because its kickoff sits outside some window — would need a
-- definition of the window and would silently reclassify fixtures whenever that
-- definition was tuned. Here, a fixture is rescheduled because something
-- recorded that it was.
--
-- ---------------------------------------------------------------------------
-- THIS RULE CAN ONLY EVER EXTEND AN EDITING WINDOW
-- ---------------------------------------------------------------------------
--
-- The instant this returns is never earlier than the matchweek lock, because a
-- fixture's own kickoff is never earlier than the earliest kickoff in its
-- round. Strictly permissive, in the same sense contract 79's CHECK widening
-- was: no prediction that was legal before becomes illegal after, and no player
-- loses a window they had.
--
-- That property is asserted rather than assumed, because it is what makes this
-- safe to apply to a live season, and because the obvious defect — reading the
-- moved fixture's kickoff for the WHOLE round — would break it in the one
-- direction that invalidates work somebody already did.

begin;

-- ---------------------------------------------------------------------------
-- The authority.
--
-- Separate from the trigger that enforces it so the rule can be tested
-- directly, and so the trigger reads as enforcement rather than as policy.
-- ---------------------------------------------------------------------------

create or replace function predictor_internal.season_prediction_lock_at(
  p_season_fixture_id uuid,
  p_buffer_minutes integer
)
returns timestamptz
language plpgsql
stable
security definer
set search_path = ''
as $lock$
declare
  v_fixture record;
  v_rescheduled boolean;
begin
  if p_buffer_minutes is null or p_buffer_minutes < 0 then
    return null;
  end if;

  select fixture.id, fixture.tournament_id, fixture.competition_round_id, fixture.kickoff_at
    into v_fixture
    from public.season_fixtures fixture
   where fixture.id = p_season_fixture_id;

  if not found then
    return null;
  end if;

  select exists (
    select 1 from predictor_internal.season_fixture_revisions revision
     where revision.season_fixture_id = p_season_fixture_id
  ) into v_rescheduled;

  -- A rescheduled fixture with a known kickoff answers for itself. A
  -- rescheduled fixture whose kickoff has since been cleared falls back to the
  -- matchweek rule rather than to "no lock": absence of a kickoff is the one
  -- state that must fail closed, and contract 83's derivation already does.
  if v_rescheduled and v_fixture.kickoff_at is not null then
    return v_fixture.kickoff_at - pg_catalog.make_interval(mins => p_buffer_minutes);
  end if;

  return predictor_internal.season_matchweek_lock_at(
    v_fixture.tournament_id, v_fixture.competition_round_id, p_buffer_minutes
  );
end;
$lock$;

revoke all on function predictor_internal.season_prediction_lock_at(uuid, integer)
  from public, anon, authenticated, service_role;

-- ---------------------------------------------------------------------------
-- The enforcement.
--
-- Redefines contract 114's trigger. Only the `season_predictions` branch
-- changes; the Joker branch keeps the matchweek rule untouched, because a Joker
-- is a matchweek-level choice rather than a per-fixture one and nothing in the
-- amendment says otherwise.
--
-- Contract 104's live-instance resolution is preserved verbatim:
-- availability comes through `predictor_internal.live_competition_id`, never an
-- arbitrary row. `155_live_competition_callers.sql` pins this body to that
-- resolver, and the first draft of contract 114's redefinition was caught by
-- exactly that pin when it copied an older body instead.
-- ---------------------------------------------------------------------------

create or replace function predictor_internal.enforce_season_matchweek_lock()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_row record;
  v_round uuid;
  v_tournament uuid;
  v_buffer integer;
  v_lock_at timestamptz;
  v_earliest timestamptz;
  v_missing integer;
begin
  if tg_op = 'DELETE' then
    v_row := old;
  else
    v_row := new;
  end if;

  if tg_table_name = 'season_predictions' then
    select fixture.competition_round_id, fixture.tournament_id
      into v_round, v_tournament
      from public.season_fixtures fixture
     where fixture.id = v_row.season_fixture_id;
  else
    v_round := v_row.competition_round_id;
    v_tournament := v_row.tournament_id;
  end if;

  select definition.buffer_minutes into v_buffer
    from public.bonus_competitions availability
    join public.game_definitions definition on definition.game_key = availability.game_key
   where availability.tournament_id = v_tournament
     and availability.game_key = 'main_predictor'
     and availability.id = predictor_internal.live_competition_id(
       v_tournament, 'main_predictor'
     );

  if v_buffer is null then
    raise exception 'No Main Predictor availability for this season, so its lock cannot be resolved'
      using errcode = '23514';
  end if;

  if tg_table_name = 'season_predictions' then
    -- Contract 119. Per fixture, and only because it moved: the authority
    -- returns the matchweek instant for everything else, so an ordinary
    -- matchweek still locks together.
    v_lock_at := predictor_internal.season_prediction_lock_at(
      v_row.season_fixture_id, v_buffer
    );

    if v_lock_at is null then
      raise exception 'This matchweek has unconfirmed kickoff times, so it is locked'
        using errcode = '55000';
    end if;
  else
    select min(fixture.kickoff_at), count(*) filter (where fixture.kickoff_at is null)
      into v_earliest, v_missing
      from public.season_fixtures fixture
     where fixture.competition_round_id = v_round;

    if v_earliest is null or v_missing > 0 then
      raise exception 'This matchweek has unconfirmed kickoff times, so it is locked'
        using errcode = '55000';
    end if;

    v_lock_at := v_earliest - make_interval(mins => v_buffer);
  end if;

  if now() >= v_lock_at then
    raise exception 'This matchweek is locked'
      using errcode = '55000';
  end if;

  if tg_op = 'DELETE' then
    return old;
  end if;

  if tg_table_name = 'season_predictions' then
    new.updated_at := now();
  end if;

  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- Prove the shape, in the same transaction.
-- ---------------------------------------------------------------------------

do $$
begin
  -- The contract 104 pin, restated here so a future redefinition that drops the
  -- resolver fails at rollout rather than at the next parity run.
  if pg_catalog.pg_get_functiondef(
       'predictor_internal.enforce_season_matchweek_lock()'::regprocedure
     ) not like '%live_competition_id%' then
    raise exception 'the lock trigger no longer resolves availability through live_competition_id';
  end if;

  if exists (
    select 1 from information_schema.routine_privileges
     where routine_name = 'season_prediction_lock_at'
       and grantee in ('anon', 'authenticated', 'service_role')
  ) then
    raise exception 'a browser or service role can call the prediction lock authority directly';
  end if;

  -- Nothing has moved yet on a fresh apply, so the new rule must be behaviour
  -- neutral: every fixture still answers with its matchweek instant.
  if exists (select 1 from predictor_internal.season_fixture_revisions) then
    raise exception 'this migration expects no recorded fixture revision at apply time';
  end if;
end;
$$;

commit;
