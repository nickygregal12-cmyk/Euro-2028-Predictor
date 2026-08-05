-- Contract 111: the season Predictor Championship becomes something that runs.
--
-- Six authorities decide how a season Championship works, and until this
-- contract not one of them was reachable. Measured rather than assumed — every
-- function below is called by zero others in the committed schema:
--
--   resolve_public_cup_launch    whether the public Cup may open
--   select_season_cup_format     the shape it takes at that field size
--   cup_league_schedule          the circle-method round-robin
--   generate_season_cup_windows  the rounds it is played over (contract 110)
--   settle_season_cup_tie        how a tie resolves
--   cup_split_group_tables       the continuing table across both phases
--
-- Complete rules, competition-neutral sources, phase-aware storage, a derived
-- continuing table — and nothing that could create a single group, member or
-- fixture. This is the driver that makes the first three of them run.
--
-- ---------------------------------------------------------------------------
-- WHY LAUNCH RATHER THAN THE SPLIT
-- ---------------------------------------------------------------------------
--
-- The roadmap named the phase-transition driver as the next Championship step.
-- It cannot be first. The split assigns entrants **by the final initial
-- table**, and `cup_final_group_tables` derives that table from SETTLED
-- fixtures. Settlement needs fixtures; fixtures need a launch.
--
-- Building the split first would mean hand-constructing groups, members,
-- fixtures and settled results in its test fixture — proving a driver correct
-- against a state no code in the repository can produce. The order is launch,
-- then settlement, then the split.
--
-- ---------------------------------------------------------------------------
-- WHAT THIS DRIVES, AND WHAT IT DELIBERATELY REFUSES
-- ---------------------------------------------------------------------------
--
-- `select_season_cup_format` returns two shapes. `single_group` is one field
-- playing a round-robin, which is what a season of twenty or fewer entrants
-- takes. `groups` divides a larger field, and carries seeding, a draw and a
-- knockout bracket behind it.
--
-- This drives `single_group` and refuses `groups` by name. A driver that
-- half-implements a multi-group draw is worse than one that says which shapes
-- it drives: the refusal is a fact the caller can act on, and a partial draw is
-- a competition nobody can reconstruct.
--
-- A consequence worth stating plainly, because it was found by building this
-- rather than by reading: **the two boundaries do not overlap.** The public
-- Championship opens at a hundred entrants, and a hundred-entrant field always
-- takes the multi-group shape — `single_group` stops at twenty. So the PUBLIC
-- Championship cannot launch at all until the multi-group driver exists, and
-- what this contract delivers is the PRIVATE one, where an organiser's twelve
-- or sixteen entrants are exactly the shape it drives.
--
-- That also fixes a bug this nearly shipped with. Applying the hundred-entrant
-- threshold to every competition would have refused every private Championship
-- on the platform, and the single_group path it exists to drive would have been
-- unreachable — the function would have been incapable of launching anything.
--
-- ---------------------------------------------------------------------------
-- NOT OPEN IS NOT AN ERROR
-- ---------------------------------------------------------------------------
--
-- A season below the hundred-entrant threshold, or one whose remaining calendar
-- cannot hold the shortest viable format, is in an ordinary state rather than a
-- broken one. Those return an outcome naming the reason, so a caller can say
-- "23 more needed" and a scheduled job can keep trying as entrants arrive.
--
-- What raises is what could never be right: a competition that is not a
-- Championship, one that is not in a league season, and the multi-group shape
-- this contract does not drive.

begin;

create or replace function predictor_internal.launch_season_cup(
  p_competition_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $launch$
declare
  v_competition record;
  v_tournament_kind text;
  v_entrants integer;
  v_running boolean;
  v_launch jsonb;
  v_remaining integer;
  v_format jsonb;
  v_buffer integer;
  v_group_id uuid;
  v_meetings integer;
  v_league_rounds integer;
  v_draw text[];
  v_schedule jsonb;
  v_windows integer;
  v_fixtures integer := 0;
begin
  select competition.id, competition.tournament_id, competition.game_key,
         competition.visibility_kind
    into v_competition
    from public.bonus_competitions competition
    where competition.id = p_competition_id;

  if not found then
    raise exception 'Competition % does not exist', p_competition_id
      using errcode = '23503';
  end if;

  if v_competition.game_key <> 'predictor_cup' then
    raise exception 'Only a Predictor Championship is launched this way, not %',
      v_competition.game_key
      using errcode = '23514';
  end if;

  select tournament.kind into v_tournament_kind
    from public.tournaments tournament
    where tournament.id = v_competition.tournament_id;

  if v_tournament_kind is distinct from 'league_season' then
    raise exception
      'Competition % belongs to a % rather than a league season; the tournament Championship has its own published draw',
      p_competition_id, coalesce(v_tournament_kind, 'competition of unknown kind')
      using errcode = '23514';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(p_competition_id::text, 0)
  );

  -- Idempotent, re-read under the lock. A launched Championship is never
  -- relaunched: its draw is the competition, and redrawing it would move
  -- fixtures under predictions already made against them.
  if exists (
    select 1 from public.bonus_cup_groups existing
    where existing.competition_id = p_competition_id
  ) then
    return jsonb_build_object('outcome', 'already_launched', 'fixtures', 0);
  end if;

  select count(*)::integer into v_entrants
    from public.bonus_competition_entrants entrant
    where entrant.competition_id = p_competition_id;

  -- One public Championship runs per competition season. A completed
  -- predecessor is not running, and contract 103's live-instance key already
  -- makes a second live public row impossible — so this reads as false today
  -- and is computed rather than assumed, because the key is the thing keeping
  -- it true and keys change.
  select exists (
    select 1
    from public.bonus_competitions other
    join public.bonus_cup_groups drawn on drawn.competition_id = other.id
    where other.tournament_id = v_competition.tournament_id
      and other.game_key = 'predictor_cup'
      and other.visibility_kind = 'public'
      and other.completed_at is null
      and other.id <> p_competition_id
  ) into v_running;

  -- The hundred-entrant threshold is the PUBLIC Championship's, and applying it
  -- to a private one would refuse every organiser-created competition on the
  -- platform. A private Championship has no threshold; its floor is the format
  -- selector's own minimum field, which refuses below four.
  if v_competition.visibility_kind = 'public' then
    v_launch := predictor_internal.resolve_public_cup_launch(v_entrants, v_running);

    if not (v_launch->>'open')::boolean then
      return jsonb_build_object(
        'outcome', 'not_open',
        'reason', v_launch->>'reason',
        'entrants', v_entrants,
        'shortfall', v_launch->>'shortfall',
        'fixtures', 0);
    end if;
  end if;

  select definition.buffer_minutes into v_buffer
    from public.game_definitions definition
    where definition.game_key = 'predictor_cup';

  -- How much calendar is left. The same derivation contract 110 schedules
  -- against, so the format is chosen against rounds that can actually be used.
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

  if v_format->>'kind' = 'groups' then
    raise exception
      'A % entrant field takes the multi-group shape, which carries seeding, a draw and a bracket and is not driven by this contract',
      v_entrants
      using errcode = '23514';
  end if;

  if v_format->>'kind' <> 'single_group' then
    return jsonb_build_object(
      'outcome', 'no_viable_format',
      'reason', coalesce(v_format->>'reason', v_format->>'kind'),
      'entrants', v_entrants,
      'remainingRounds', v_remaining,
      'fixtures', 0);
  end if;

  v_meetings := (v_format->>'meetings')::integer;
  v_league_rounds := (v_format->>'leagueRounds')::integer;

  insert into public.bonus_cup_groups (competition_id, ordinal, size, phase_kind)
  values (p_competition_id, 1, v_entrants, 'initial')
  returning id into v_group_id;

  -- Draw numbers are assigned by entrant id rather than by join order. Join
  -- order would make the draw depend on registration timing, which is not a
  -- competitive input anybody agreed to; the id is arbitrary but stable, so a
  -- replay produces the same draw.
  insert into public.bonus_cup_members (
    competition_id, user_id, group_id, draw_number, phase_kind
  )
  select
    p_competition_id,
    entrant.user_id,
    v_group_id,
    row_number() over (order by entrant.user_id),
    'initial'
  from public.bonus_competition_entrants entrant
  where entrant.competition_id = p_competition_id;

  v_windows := predictor_internal.generate_season_cup_windows(
    p_competition_id, now(), v_league_rounds
  );

  select array_agg(member.user_id::text order by member.draw_number)
    into v_draw
    from public.bonus_cup_members member
    where member.competition_id = p_competition_id
      and member.phase_kind = 'initial';

  v_schedule := predictor_internal.cup_league_schedule(v_draw, v_meetings);

  if not (v_schedule->>'ok')::boolean then
    raise exception 'The schedule generator refused this draw: %',
      v_schedule->>'reason'
      using errcode = '23514';
  end if;

  -- `matchday` is the competition's own round number and matches the window
  -- sequence, which is what keeps it meaningful when the split continues it
  -- rather than resetting (ADR 0025 decision 2).
  with rounds as (
    select
      (entry->>'round')::integer as round_number,
      entry->'ties' as ties
    from jsonb_array_elements(v_schedule->'rounds') as entry
  ), placed as (
    insert into public.bonus_cup_fixtures (
      competition_id, stage, group_id, window_id, matchday,
      home_user_id, away_user_id
    )
    select
      p_competition_id,
      'group',
      v_group_id,
      competition_window.id,
      rounds.round_number,
      (tie->>'home')::uuid,
      (tie->>'away')::uuid
    from rounds
    cross join lateral jsonb_array_elements(rounds.ties) as tie
    join public.bonus_competition_windows competition_window
      on competition_window.competition_id = p_competition_id
     and competition_window.sequence = rounds.round_number
    returning id
  )
  select count(*)::integer into v_fixtures from placed;

  insert into public.bonus_competition_audit (competition_id, action, detail)
  values (
    p_competition_id,
    'championship_launched',
    jsonb_build_object(
      'entrants', v_entrants,
      'meetings', v_meetings,
      'leagueRounds', v_league_rounds,
      'windowsCreated', v_windows,
      'fixturesCreated', v_fixtures,
      'tail', v_format->'tail'
    )
  );

  return jsonb_build_object(
    'outcome', 'launched',
    'entrants', v_entrants,
    'meetings', v_meetings,
    'leagueRounds', v_league_rounds,
    'windows', v_windows,
    'fixtures', v_fixtures,
    'tail', v_format->'tail');
end;
$launch$;

revoke all on function predictor_internal.launch_season_cup(uuid)
  from public, anon, authenticated, service_role;

commit;
