-- ---------------------------------------------------------------------------
-- Contract 166 — the multi-group Championship, which the launcher refuses.
--
-- ---------------------------------------------------------------------------
-- WHAT WAS MEASURED
-- ---------------------------------------------------------------------------
--
-- `predictor_internal.select_season_cup_format` has answered the large-field
-- question since contract 74. Given a field it cannot seat in one group it
-- returns `{"kind": "groups", "groupCount": N, "groupSizes": [...]}`, balanced
-- so the sizes differ by at most one, with the largest capped at 20.
--
-- `predictor_internal.launch_season_cup` then refuses that answer, by name and
-- in so many words:
--
--     if v_format->>'kind' = 'groups' then
--       raise exception 'A % entrant field takes the multi-group shape, which
--         carries seeding, a draw and a bracket and is not driven by this
--         contract'
--
-- So a hundred-entrant Championship computes its own shape correctly and then
-- cannot be started. It is the same authority-with-no-driver shape as contracts
-- 116, 118, 120, 122, 124 and 127, and this is its driver.
--
-- Neither the group size nor the matchday domain needs widening: contract 79
-- took `bonus_cup_groups.size` to `between 3 and 20` and contract 124 restated
-- it, and contract 79 replaced `matchday between 1 and 3` with
-- `matchday > 0`. Both were checked before anything here was written, because
-- a launch that inserted rows the store then refused would be worse than one
-- that refuses honestly.
--
-- ---------------------------------------------------------------------------
-- THE DRAW: DETERMINISTIC, AUDITABLE, AND NOT A LOTTERY
-- ---------------------------------------------------------------------------
--
-- Draw numbers are assigned by ENTRANT ID, exactly as the single-group launch
-- does, and for the reason it gives: join order would make the draw depend on
-- registration timing, which is not a competitive input anybody agreed to,
-- while the id is arbitrary but stable, so a replay produces the same draw.
--
-- This contract does NOT introduce randomness, and that is a decision rather
-- than an omission. A random draw would need a stored seed to be auditable at
-- all, and an unseeded one could not be replayed or checked — a Championship
-- whose draw cannot be re-derived is one nobody can verify was fair.
--
-- Allocation is `((draw_number - 1) % groupCount) + 1` — dealing round the
-- groups like cards. It is one line, it is obviously balanced, and it agrees
-- with `select_season_cup_format`'s own size arithmetic by construction: that
-- function gives the first `field % groupCount` groups one extra member, and
-- dealing does exactly the same thing. The agreement is asserted rather than
-- assumed, because two independent expressions of one rule is how they drift.
--
-- There is NO SEEDING, because there is nothing to seed on: at launch the
-- Championship has been played zero rounds and the platform holds no
-- cross-season Championship rating. Seeding on Match Predictor points would
-- import one game's standings into another's structure, which ADR 0011
-- forbids. Recorded here so a later contract adding seeds knows this was
-- considered and refused rather than forgotten.
--
-- ---------------------------------------------------------------------------
-- HOW MANY ROUNDS, AND WHAT AN UNEVEN GROUP DOES
-- ---------------------------------------------------------------------------
--
-- Every group plays a single round-robin, run in PARALLEL over the same
-- windows: matchday N of group 1 and matchday N of group 5 are the same round
-- of the competition, which is what makes `matchday` meaningful as the
-- competition's own round number.
--
-- A k-entrant round-robin needs k-1 rounds when k is even and k when odd,
-- because an odd field carries a bye. So the competition needs the largest
-- group's requirement, and a smaller group simply has no fixture in the last
-- round or two. That is not an edge case being tolerated: it is exactly the
-- behaviour contract 124 established for the split, stated there as "the
-- smaller half simply has no fixture in the last round or two, because
-- `matchday` is the competition's round number".
--
-- ONE MEETING, not two. `select_season_cup_format` caps the largest group at
-- `least(20, (remaining / 2) + 1)`, which guarantees room for two meetings of
-- the largest group — but spending the whole calendar on the group stage would
-- leave nothing for the knockout the multi-group shape exists to feed. One
-- meeting is the conservative half of that guarantee and leaves the remaining
-- rounds free. What happens in them is the NEXT contract's decision, and this
-- one deliberately does not pre-empt it: it creates the group stage and stops.
--
-- ---------------------------------------------------------------------------
-- WHAT IT DOES NOT DO
-- ---------------------------------------------------------------------------
--
-- No knockout bracket, no qualification rule, no seeding of a later round. It
-- draws the groups and schedules them. `bonus_cup_fixtures.stage` already
-- admits `knockout`, and who reaches it is a rule ADR 0014 owns rather than one
-- a launcher should invent while nobody is watching.
--
-- Additive: one new internal driver and one administrator entry point.
-- `launch_season_cup` is NOT redefined — its refusal stands, and this is a
-- separate call, because the two shapes fix different things at different
-- moments and one function that silently did either would be a function whose
-- effect the caller cannot predict.
-- ---------------------------------------------------------------------------

create or replace function predictor_internal.launch_season_cup_groups(p_competition_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $groups$
declare
  v_competition record;
  v_tournament_kind text;
  v_entrants integer;
  v_remaining integer;
  v_format jsonb;
  v_group_count integer;
  v_sizes jsonb;
  v_rounds_needed integer := 0;
  v_windows integer;
  v_fixtures integer := 0;
  v_group record;
  v_draw text[];
  v_schedule jsonb;
  v_group_rounds integer;
  v_placed integer;
  v_allocation jsonb;
begin
  select competition.id, competition.tournament_id, competition.game_key,
         competition.visibility_kind, competition.name
    into v_competition
    from public.bonus_competitions competition
   where competition.id = p_competition_id;

  if v_competition.id is null then
    raise exception 'Competition % does not exist', p_competition_id
      using errcode = '22023';
  end if;

  if v_competition.game_key is distinct from 'predictor_cup' then
    raise exception 'Only a Predictor Championship is launched this way, not %',
      v_competition.game_key using errcode = '23514';
  end if;

  select season.kind into v_tournament_kind
    from public.tournaments season where season.id = v_competition.tournament_id;

  if v_tournament_kind is distinct from 'league_season' then
    raise exception
      'Competition % belongs to a %, and this launcher draws a league season''s Championship',
      p_competition_id, coalesce(v_tournament_kind, 'competition of unknown kind')
      using errcode = '23514';
  end if;

  -- IDEMPOTENCE BY REFUSAL, which is the right shape here and not the usual
  -- one. Everywhere else in this batch a second run is a no-op; a draw is
  -- different, because re-running it after entrants have joined or left would
  -- silently redraw a competition people are already playing. Contract 127
  -- recorded the same reasoning for the single-group launch: the draw is fixed
  -- at whatever field it finds and refuses ever after.
  if exists (
    select 1 from public.bonus_cup_groups existing
     where existing.competition_id = p_competition_id
  ) then
    return jsonb_build_object(
      'outcome', 'already_drawn',
      'groups', (select count(*)::integer from public.bonus_cup_groups g
                  where g.competition_id = p_competition_id));
  end if;

  select count(*)::integer into v_entrants
    from public.bonus_competition_entrants entrant
   where entrant.competition_id = p_competition_id;

  -- Rounds still to come, from the season's own matchweek locks. The same
  -- derivation the single-group launcher uses, so the two cannot disagree about
  -- how much calendar is left.
  select count(*)::integer into v_remaining
    from (
      select window_row.locks_at
        from public.bonus_competition_windows window_row
       where false
      union all
      select round.locks_at
        from (
          select max(fixture.kickoff_at) as locks_at
            from public.season_fixtures fixture
            join public.competition_rounds round
              on round.id = fixture.competition_round_id
           where round.tournament_id = v_competition.tournament_id
             and round.kind = 'league_matchweek'
           group by round.id
        ) round
    ) candidate
   where candidate.locks_at is not null
     and candidate.locks_at > now();

  v_format := predictor_internal.select_season_cup_format(v_entrants, v_remaining);

  -- The mirror image of `launch_season_cup`'s refusal. A field that fits one
  -- group belongs to that launcher, and answering it here would give the
  -- platform two drivers for one shape.
  if v_format->>'kind' = 'single_group' then
    raise exception
      'A % entrant field fits a single group and is launched by launch_season_cup, not by this driver',
      v_entrants using errcode = '23514';
  end if;

  if v_format->>'kind' <> 'groups' then
    return jsonb_build_object(
      'outcome', 'no_viable_format',
      'reason', coalesce(v_format->>'reason', v_format->>'kind'),
      'entrants', v_entrants,
      'remainingRounds', v_remaining,
      'groups', 0,
      'fixtures', 0);
  end if;

  v_group_count := (v_format->>'groupCount')::integer;
  v_sizes := v_format->'groupSizes';

  -- ---------------------------------------------------------------------
  -- The groups, then the draw.
  -- ---------------------------------------------------------------------

  insert into public.bonus_cup_groups (competition_id, ordinal, size, phase_kind)
  select p_competition_id, slot.ordinality::integer, slot.value::integer, 'initial'
    from jsonb_array_elements_text(v_sizes) with ordinality as slot(value, ordinality);

  -- Draw numbers by entrant id, as the single-group launcher does; the group is
  -- then dealt round the table. Both halves are one statement so a partially
  -- drawn competition is not a state that can exist.
  insert into public.bonus_cup_members (
    competition_id, user_id, group_id, draw_number, phase_kind)
  select p_competition_id,
         numbered.user_id,
         cup_group.id,
         numbered.draw_number,
         'initial'
    from (
      select entrant.user_id,
             row_number() over (order by entrant.user_id)::integer as draw_number
        from public.bonus_competition_entrants entrant
       where entrant.competition_id = p_competition_id
    ) numbered
    join public.bonus_cup_groups cup_group
      on cup_group.competition_id = p_competition_id
     and cup_group.phase_kind = 'initial'
     and cup_group.ordinal = ((numbered.draw_number - 1) % v_group_count) + 1;

  -- THE AGREEMENT ASSERTION. `select_season_cup_format` computes the sizes and
  -- dealing computes the membership, and they are two independent expressions
  -- of one rule. If they ever disagree the competition is drawn wrong and every
  -- table it produces is wrong with it, so the disagreement is caught here
  -- rather than discovered in week six.
  if exists (
    select 1
      from public.bonus_cup_groups cup_group
      left join (
        select member.group_id, count(*)::integer as drawn
          from public.bonus_cup_members member
         where member.competition_id = p_competition_id
           and member.phase_kind = 'initial'
         group by member.group_id
      ) counted on counted.group_id = cup_group.id
     where cup_group.competition_id = p_competition_id
       and cup_group.phase_kind = 'initial'
       and coalesce(counted.drawn, 0) <> cup_group.size
  ) then
    raise exception
      'The draw and the declared group sizes disagree, so the format and the allocation are not the same rule'
      using errcode = '23514';
  end if;

  -- ---------------------------------------------------------------------
  -- How many rounds the largest group needs, and therefore the competition.
  -- ---------------------------------------------------------------------

  select max(case when cup_group.size % 2 = 0 then cup_group.size - 1 else cup_group.size end)
    into v_rounds_needed
    from public.bonus_cup_groups cup_group
   where cup_group.competition_id = p_competition_id
     and cup_group.phase_kind = 'initial';

  if v_rounds_needed > v_remaining then
    raise exception
      'The group stage needs % rounds and only % remain, which select_season_cup_format should have excluded',
      v_rounds_needed, v_remaining using errcode = '23514';
  end if;

  v_windows := predictor_internal.generate_season_cup_windows(
    p_competition_id, now(), v_rounds_needed);

  -- ---------------------------------------------------------------------
  -- One round-robin per group, all running over the same windows.
  -- ---------------------------------------------------------------------

  for v_group in
    select cup_group.id, cup_group.ordinal, cup_group.size
      from public.bonus_cup_groups cup_group
     where cup_group.competition_id = p_competition_id
       and cup_group.phase_kind = 'initial'
     order by cup_group.ordinal
  loop
    select array_agg(member.user_id::text order by member.draw_number)
      into v_draw
      from public.bonus_cup_members member
     where member.competition_id = p_competition_id
       and member.group_id = v_group.id
       and member.phase_kind = 'initial';

    -- The same generator the single-group launch uses, so one group of eight
    -- here and one group of eight there produce the same fixtures.
    v_schedule := predictor_internal.cup_league_schedule(v_draw, 1);

    if not (v_schedule->>'ok')::boolean then
      raise exception 'The schedule generator refused group %: %',
        v_group.ordinal, v_schedule->>'reason' using errcode = '23514';
    end if;

    with rounds as (
      select (entry->>'round')::integer as round_number, entry->'ties' as ties
        from jsonb_array_elements(v_schedule->'rounds') as entry
    ), placed as (
      insert into public.bonus_cup_fixtures (
        competition_id, stage, group_id, window_id, matchday, home_user_id, away_user_id)
      select p_competition_id,
             'group',
             v_group.id,
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
    select count(*)::integer into v_placed from placed;

    v_fixtures := v_fixtures + v_placed;
  end loop;

  -- The whole allocation, recorded so the draw can be audited without
  -- re-deriving it. This is the "auditable" half of the requirement: a draw
  -- nobody can inspect afterwards is a draw nobody can check.
  select jsonb_agg(jsonb_build_object(
           'group', cup_group.ordinal,
           'size', cup_group.size,
           'members', (
             select jsonb_agg(member.draw_number order by member.draw_number)
               from public.bonus_cup_members member
              where member.group_id = cup_group.id
                and member.phase_kind = 'initial'))
         order by cup_group.ordinal)
    into v_allocation
    from public.bonus_cup_groups cup_group
   where cup_group.competition_id = p_competition_id
     and cup_group.phase_kind = 'initial';

  insert into public.bonus_competition_audit (competition_id, action, detail)
  values (
    p_competition_id,
    'championship_group_stage_drawn',
    jsonb_build_object(
      'entrants', v_entrants,
      'groupCount', v_group_count,
      'groupSizes', v_sizes,
      'roundsNeeded', v_rounds_needed,
      'remainingRounds', v_remaining,
      'windowsCreated', v_windows,
      'fixturesCreated', v_fixtures,
      -- Named, so a reader of the audit knows the draw was not a lottery and
      -- can re-derive it.
      'drawRule', 'draw numbers by entrant id ascending; groups dealt round-robin by draw number',
      'allocation', v_allocation));

  return jsonb_build_object(
    'outcome', 'launched',
    'entrants', v_entrants,
    'groupCount', v_group_count,
    'groupSizes', v_sizes,
    'roundsNeeded', v_rounds_needed,
    'windowsCreated', v_windows,
    'fixturesCreated', v_fixtures);
end;
$groups$;

revoke all on function predictor_internal.launch_season_cup_groups(uuid)
  from public, anon, authenticated, service_role;

-- ===========================================================================
-- The administrator entry point
-- ===========================================================================
--
-- An OPERATOR ACTION and not a job, for contract 127's reason stated about the
-- single-group case and just as true here: the draw is fixed at whatever field
-- size it finds and refuses ever after, so a cron tick would be choosing the
-- competition's shape.
--
-- `require_competition_admin`, contract 127's gate — not `require_result_admin`,
-- because an account trusted to correct a scoreline has not thereby been
-- trusted to draw a hundred-entrant Championship.

create or replace function public.admin_launch_cup_group_stage(p_competition_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $admin$
declare
  v_result jsonb;
begin
  perform predictor_internal.require_competition_admin();

  -- A transaction-scoped advisory lock keyed on the competition, so two
  -- administrators pressing the button together cannot both pass the
  -- already-drawn check and both draw. The same idiom contract 145 used for the
  -- rate limiter, and for the same reason: read-then-write with nothing between
  -- is not atomic under the isolation the Data API uses.
  perform pg_advisory_xact_lock(hashtextextended(p_competition_id::text, 0));

  v_result := predictor_internal.launch_season_cup_groups(p_competition_id);

  return v_result;
end;
$admin$;

revoke all on function public.admin_launch_cup_group_stage(uuid) from public, anon;
grant execute on function public.admin_launch_cup_group_stage(uuid) to authenticated;

-- ===========================================================================
-- Prove it, in the same transaction
-- ===========================================================================

do $$
declare
  v_driver text := pg_get_functiondef(
    'predictor_internal.launch_season_cup_groups(uuid)'::regprocedure);
  v_admin text := pg_get_functiondef(
    'public.admin_launch_cup_group_stage(uuid)'::regprocedure);
begin
  -- THE DRAW IS DETERMINISTIC. A random draw would need a stored seed to be
  -- auditable, and an unseeded one could not be replayed or checked at all.
  if v_driver ~* 'random\(\)|gen_random_uuid\(\)|clock_timestamp\(\)' then
    raise exception 'The draw must be deterministic and replayable';
  end if;

  -- Ordered by entrant id, as the single-group launcher is, so join order is
  -- not a competitive input.
  if v_driver !~ 'order by entrant\.user_id' then
    raise exception 'Draw numbers must be assigned by entrant id, not by join order';
  end if;

  -- IT IS AUDITED. A draw nobody can inspect afterwards is a draw nobody can
  -- check was fair.
  if v_driver !~ 'bonus_competition_audit' or v_driver !~ 'allocation' then
    raise exception 'The draw must record its full allocation';
  end if;

  -- It refuses rather than redraws.
  if v_driver !~ 'already_drawn' then
    raise exception 'A second launch must refuse rather than redraw a competition in play';
  end if;

  -- It creates a GROUP stage and no knockout: who reaches a bracket is ADR
  -- 0014's rule, not a launcher's.
  if v_driver ~* '''knockout''|''playoff''' then
    raise exception 'This contract draws the group stage only';
  end if;

  -- The two launchers refuse each other's case, so the platform has one driver
  -- per shape rather than two that might both answer.
  if v_driver !~ 'single_group' then
    raise exception 'The multi-group driver must refuse a single-group field by name';
  end if;

  -- Concurrency, and the admin gate.
  if v_admin !~ 'pg_advisory_xact_lock' then
    raise exception 'Two administrators pressing the button together must not both draw';
  end if;

  if v_admin !~ 'require_competition_admin' then
    raise exception 'Drawing a Championship must be gated on competition administration';
  end if;

  if has_function_privilege('anon', 'public.admin_launch_cup_group_stage(uuid)', 'execute') then
    raise exception 'The launch must not be reachable anonymously';
  end if;

  if has_function_privilege('authenticated',
       'predictor_internal.launch_season_cup_groups(uuid)', 'execute') then
    raise exception 'The driver must have exactly one caller';
  end if;
end;
$$;
