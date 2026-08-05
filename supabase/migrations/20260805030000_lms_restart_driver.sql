-- Contract 107: the Last Man Standing restart, as a lifecycle transition.
--
-- ADR 0025 decision 1, the driver contracts 103 to 106 were clearing the way
-- for. ADR 0013's public endgame, when more than three entrants share a
-- wipeout, is that everybody re-enters a fresh competition with selections
-- reset. Contract 89's settlement job derives and reports
-- `restart_all_reentered` and deliberately does not act on it, because "a new
-- competition lifecycle rather than a settlement" had no definition. This is
-- that definition.
--
-- The decision, quoted, is that a restart "creates a new competition row. It
-- does not wipe and reuse the existing one", because reusing the row would
-- destroy "the completed competition's picks, elimination history, audit
-- evidence and correction trail — the record of the competition that produced
-- the wipeout in the first place".
--
-- ---------------------------------------------------------------------------
-- WHAT IS COPIED, AND WHAT IS DELIBERATELY NOT
-- ---------------------------------------------------------------------------
--
-- Copied — the immutable setup, which is what makes the successor the same
-- competition run again rather than a different one: season, game, public or
-- private scope, publication, availability and the draw rule.
--
-- Re-entered — every previous entrant, as a fresh row with a fresh
-- `joined_at` and the default outcome. Re-entry is the endgame's whole point.
--
-- NOT copied — selections, used-team cycles, entrant-state projections,
-- completed windows, score events, audit rows. The ADR lists these explicitly
-- and they are not an oversight: a restart resets the competition, so carrying
-- any of them forward would make the successor a continuation instead.
--
-- ---------------------------------------------------------------------------
-- IDEMPOTENCY, WHICH THE DECISION REQUIRES BY NAME
-- ---------------------------------------------------------------------------
--
-- "Creation belongs in a separate, idempotent lifecycle function or job
-- protected by an advisory lock, not inside settlement."
--
-- Both halves are here. The lock is transaction-scoped and keyed on the
-- SERIES, not the tournament, because that is the thing being extended and two
-- concurrent restarts of the same series are the collision that matters. And
-- the function returns the existing successor rather than creating a second
-- one when the restart has already happened — so a job that retries, or two
-- callers racing, produce one successor rather than a fork.
--
-- The uniqueness contract 103 installed would refuse a second live row anyway,
-- which is a good backstop but a poor interface: a retry would raise instead of
-- returning what the caller wanted.
--
-- ---------------------------------------------------------------------------
-- WHAT THIS DOES NOT DO, STATED RATHER THAN IMPLIED
-- ---------------------------------------------------------------------------
--
-- The ADR's lifecycle also says "generate new windows beginning with the next
-- eligible league round". That is NOT here, and the successor therefore
-- arrives with no windows and cannot yet be played.
--
-- The reason is that no shared authority exists for it. Not one committed
-- migration inserts a `bonus_competition_windows` row: tournament windows are
-- seeded alongside their matches and season windows would come from a round
-- calendar that contract 83's scheduler owns for matchweek cards, not for Last
-- Man Standing rounds. Choosing "the next eligible league round" needs that
-- calendar, and inventing one inside a lifecycle function would put a
-- scheduling rule where nobody would look for it.
--
-- So the transition lands first and window generation follows as its own
-- contract, against whichever calendar authority the competition kind supplies.
-- A successor with no windows is inert rather than wrong: every reader resolves
-- it, no round is open, and nothing can be picked until windows exist.

begin;

create or replace function predictor_internal.restart_lms_competition(
  p_competition_id uuid
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $restart$
declare
  v_old public.bonus_competitions%rowtype;
  v_successor_id uuid;
  v_new_id uuid;
  v_entrants integer;
begin
  select * into v_old
    from public.bonus_competitions
    where id = p_competition_id;

  if not found then
    raise exception 'Competition not found'
      using errcode = '23503';
  end if;

  -- The lock is taken before anything is read for a decision, and keyed on the
  -- series so a second caller restarting the SAME series waits rather than
  -- racing. Transaction-scoped, so it releases with the caller's transaction
  -- however that ends.
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(v_old.series_id::text, 0)
  );

  -- Re-read under the lock. Without this the idempotency check below could
  -- act on state a competing transaction has already changed.
  select * into v_old
    from public.bonus_competitions
    where id = p_competition_id;

  if v_old.game_key <> 'last_man_standing' then
    raise exception 'Only a Last Man Standing competition can be restarted'
      using errcode = '23514';
  end if;

  -- Already restarted: return the successor rather than creating a second one.
  -- This is the idempotency the decision asks for, and it is what makes the
  -- function safe to retry.
  select id into v_successor_id
    from public.bonus_competitions
    where predecessor_competition_id = v_old.id;

  if v_successor_id is not null then
    return v_successor_id;
  end if;

  -- A competition that finished for any other reason is not restartable. A won
  -- competition has a champion; an abandoned one was ended deliberately.
  -- Refusing here rather than silently completing it is the difference between
  -- a lifecycle transition and an overwrite.
  if v_old.completed_at is not null
     and v_old.completion_reason is distinct from 'no_winner_restarted' then
    raise exception 'A competition completed as % cannot be restarted',
      coalesce(v_old.completion_reason, 'complete')
      using errcode = '23514';
  end if;

  update public.bonus_competitions
    set completed_at = coalesce(completed_at, now()),
        completion_reason = 'no_winner_restarted',
        updated_at = now()
    where id = v_old.id;

  insert into public.bonus_competitions (
    tournament_id,
    game_key,
    published,
    availability_status,
    draw_required,
    visibility_kind,
    series_id,
    series_sequence,
    predecessor_competition_id,
    registration_opens_at
  ) values (
    v_old.tournament_id,
    v_old.game_key,
    v_old.published,
    v_old.availability_status,
    v_old.draw_required,
    v_old.visibility_kind,
    v_old.series_id,
    v_old.series_sequence + 1,
    v_old.id,
    now()
  )
  returning id into v_new_id;

  -- Every previous entrant re-enters. `joined_at` is now rather than the
  -- original, because rolling-entry rules elsewhere compare it against kickoff
  -- times and copying the old instant would silently grant the successor's
  -- entrants standing in rounds they have not played.
  insert into public.bonus_competition_entrants (competition_id, user_id, joined_at)
  select v_new_id, entrant.user_id, now()
    from public.bonus_competition_entrants entrant
    where entrant.competition_id = v_old.id;

  get diagnostics v_entrants = row_count;

  -- The lifecycle event the decision requires, on the immutable audit trail.
  -- Written against the OLD competition: the restart is the last thing that
  -- happened to it, and its trail is where anyone reconstructing the wipeout
  -- will look. The successor is named in the detail rather than given a
  -- genesis row of its own, so one event records one transition.
  insert into public.bonus_competition_audit (competition_id, action, detail)
  values (
    v_old.id,
    'public_wipeout_restart',
    jsonb_build_object(
      'successorCompetitionId', v_new_id,
      'seriesId', v_old.series_id,
      'seriesSequence', v_old.series_sequence + 1,
      'entrantsReentered', v_entrants
    )
  );

  return v_new_id;
end;
$restart$;

comment on function predictor_internal.restart_lms_competition(uuid) is
  'ADR 0025 decision 1: completes a wiped-out Last Man Standing competition as no_winner_restarted and creates its successor, re-entering every entrant and copying no selections, cycles, projections or windows. Idempotent under a series-scoped advisory lock.';

-- Internal only. Settlement continues to derive and report; a caller for this
-- belongs in a later admin or job surface, and giving it a browser grant now
-- would make a lifecycle transition reachable from a session.
revoke all on function predictor_internal.restart_lms_competition(uuid)
  from public, anon, authenticated, service_role;

commit;
