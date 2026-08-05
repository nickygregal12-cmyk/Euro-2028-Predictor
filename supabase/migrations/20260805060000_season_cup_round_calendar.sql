-- Contract 110: the season Championship gets rounds it can be played over.
--
-- Contracts 74 to 79 made the shared Cup machinery competition-neutral,
-- contract 102 persisted the split as a distinct phase and contract 105 derived
-- the continuing table across both phases. What none of them could do is put a
-- single fixture in the database.
--
-- `bonus_cup_fixtures.window_id` is NOT NULL. Every Cup fixture belongs to a
-- round, and until contract 109 the only committed writer of
-- `bonus_competition_windows` anywhere in the repository was
-- `scripts/bonus-games/publish-catalogue.sql`, which publishes the Euro
-- tournament's fixed seven-round plan and nothing else. So a season Predictor
-- Championship had complete rules, neutral sources, a schedule generator, a
-- format selector, phase-aware storage and a derived continuing table — and no
-- round to hang any of it on.
--
-- That is why the phase-transition driver could not be built, and it is the
-- prerequisite this contract supplies.
--
-- ---------------------------------------------------------------------------
-- THE SAME CALENDAR AUTHORITY, ASKED A DIFFERENT QUESTION
-- ---------------------------------------------------------------------------
--
-- Contract 109 established where a season round's instants come from:
-- `season_matchweek_lock_at` derives the lock from the earliest kickoff in the
-- round minus the game's own buffer, `game_definitions` supplies that buffer
-- per game, and a null means the fixture list is incomplete and the round is
-- not schedulable. `next_eligible_league_round` already takes the game key, so
-- the Championship's own lock policy — round-scoped, no buffer — is read from
-- the same place the Last Man Standing thirty minutes is.
--
-- The difference is arity. Last Man Standing wanted ONE next round and then
-- every round after it. A Cup wants exactly N: the format selector decides how
-- many league rounds the competition is played over, and a schedule of N-1
-- rounds is not a shorter competition, it is a broken one.
--
-- So this refuses rather than truncating. If the season cannot supply N
-- schedulable rounds after the boundary, no window is created and the caller is
-- told how many were available. A Cup that quietly played four rounds of a
-- five-round format would produce a final table nobody could reconstruct.
--
-- ---------------------------------------------------------------------------
-- WHY IT APPENDS RATHER THAN OWNING THE WHOLE CALENDAR
-- ---------------------------------------------------------------------------
--
-- The split phase needs rounds too, and it needs them AFTER the league phase
-- has finished — the same competition, a later boundary, a fresh set of rounds
-- continuing the same sequence. Contract 109's generator could refuse outright
-- when any window existed, because a restarted competition is new and its
-- calendar is created once. This one cannot.
--
-- So the boundary carries the idempotence instead of the row count: if this
-- competition already holds a round that locks after `p_after`, the work has
-- been done and nothing is created. Two runs of the league phase collapse to
-- one; a later run for the split, with a later boundary, is a different
-- question and gets a different answer.

begin;

create or replace function predictor_internal.generate_season_cup_windows(
  p_competition_id uuid,
  p_after timestamptz,
  p_rounds integer
)
returns integer
language plpgsql
security definer
set search_path = ''
as $cupcal$
declare
  v_competition record;
  v_tournament_kind text;
  v_buffer integer;
  v_available integer;
  v_next_sequence integer;
  v_created integer := 0;
begin
  if p_after is null then
    raise exception 'A boundary instant is required: rounds are scheduled after something'
      using errcode = '22023';
  end if;

  if p_rounds is null or p_rounds < 1 then
    raise exception 'A round count of at least one is required, not %', p_rounds
      using errcode = '22023';
  end if;

  select competition.id, competition.tournament_id, competition.game_key
    into v_competition
    from public.bonus_competitions competition
    where competition.id = p_competition_id;

  if not found then
    raise exception 'Competition % does not exist', p_competition_id
      using errcode = '23503';
  end if;

  if v_competition.game_key <> 'predictor_cup' then
    raise exception 'Only a Predictor Championship is scheduled over league rounds this way, not %',
      v_competition.game_key
      using errcode = '23514';
  end if;

  select tournament.kind
    into v_tournament_kind
    from public.tournaments tournament
    where tournament.id = v_competition.tournament_id;

  -- The Euro tournament's Championship has a published calendar of its own and
  -- no league matchweeks at all. Refusing here says so, rather than returning
  -- zero and leaving the caller to guess whether the season was simply full.
  if v_tournament_kind is distinct from 'league_season' then
    raise exception
      'Competition % belongs to a % rather than a league season, so it has no league rounds to be scheduled over',
      p_competition_id, coalesce(v_tournament_kind, 'competition of unknown kind')
      using errcode = '23514';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(p_competition_id::text, 0)
  );

  -- Re-read under the lock. The boundary is what makes this idempotent: rounds
  -- already scheduled past it are this call's own work, done.
  if exists (
    select 1
    from public.bonus_competition_windows existing
    where existing.competition_id = p_competition_id
      and existing.locks_at is not null
      and existing.locks_at > p_after
  ) then
    return 0;
  end if;

  select coalesce(max(existing.sequence), 0)
    into v_next_sequence
    from public.bonus_competition_windows existing
    where existing.competition_id = p_competition_id;

  select definition.buffer_minutes
    into v_buffer
    from public.game_definitions definition
    where definition.game_key = 'predictor_cup';

  select count(*)::integer
    into v_available
    from (
      select predictor_internal.season_matchweek_lock_at(
               v_competition.tournament_id, round.id, v_buffer) as locks_at
      from public.competition_rounds round
      where round.tournament_id = v_competition.tournament_id
        and round.kind = 'league_matchweek'
    ) candidate
    where candidate.locks_at is not null
      and candidate.locks_at > p_after;

  -- Fail closed. A short schedule is a different competition, not this one.
  if v_available < p_rounds then
    raise exception
      'The season supplies % schedulable round(s) after %, and this Championship needs %',
      v_available, p_after, p_rounds
      using errcode = '23514';
  end if;

  with candidate as (
    select
      round.id as round_id,
      round.label,
      round.ordinal,
      predictor_internal.season_matchweek_lock_at(
        v_competition.tournament_id, round.id, v_buffer) as locks_at
    from public.competition_rounds round
    where round.tournament_id = v_competition.tournament_id
      and round.kind = 'league_matchweek'
  ), ranked as (
    -- Ordered by the derived instant rather than by league number, for the
    -- reason contract 109 gives: where the two disagree the fixtures have been
    -- rescheduled, and the round that locks next is the one played next. It
    -- also makes the opens_at chain monotonic, so `locks_at > opens_at` cannot
    -- be violated by a rescheduled fixture.
    select
      candidate.round_id,
      candidate.label,
      candidate.locks_at,
      row_number() over (order by candidate.locks_at, candidate.ordinal) as position
    from candidate
    where candidate.locks_at is not null
      and candidate.locks_at > p_after
  ), chosen as (
    select
      ranked.round_id,
      ranked.label,
      ranked.locks_at,
      ranked.position,
      lag(ranked.locks_at) over (order by ranked.position) as previous_locks_at
    from ranked
    where ranked.position <= p_rounds
  ), created as (
    insert into public.bonus_competition_windows (
      competition_id, sequence, label, opens_at, locks_at
    )
    select
      p_competition_id,
      v_next_sequence + chosen.position,
      chosen.label,
      coalesce(chosen.previous_locks_at, p_after),
      chosen.locks_at
    from chosen
    -- Correlated by sequence, as contract 109 does it: a duplicated matchweek
    -- label would otherwise attach one round's fixtures to another's window.
    returning id, sequence
  ), linked as (
    insert into public.season_cup_window_fixtures (window_id, season_fixture_id)
    select created.id, fixture.id
    from created
    join chosen on v_next_sequence + chosen.position = created.sequence
    join public.season_fixtures fixture
      on fixture.tournament_id = v_competition.tournament_id
     and fixture.competition_round_id = chosen.round_id
    returning window_id
  )
  select count(*)::integer into v_created from created;

  insert into public.bonus_competition_audit (competition_id, action, detail)
  values (
    p_competition_id,
    'championship_calendar_scheduled',
    jsonb_build_object(
      'windowsCreated', v_created,
      'firstSequence', v_next_sequence + 1,
      'scheduledAfter', p_after,
      'roundsAvailable', v_available
    )
  );

  return v_created;
end;
$cupcal$;

revoke all on function predictor_internal.generate_season_cup_windows(uuid, timestamptz, integer)
  from public, anon, authenticated, service_role;

commit;
