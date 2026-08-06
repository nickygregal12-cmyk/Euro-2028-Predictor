-- Contract 124: the Predictor Championship split actually happens.
--
-- ---------------------------------------------------------------------------
-- THE GAP THIS CLOSES
-- ---------------------------------------------------------------------------
--
-- Contract 102 made the split representable: `bonus_cup_groups.phase_kind`,
-- one-parent ancestry, a membership key that holds one row per phase, and
-- `stage = 'split'` fixtures carrying a group and a matchday. Contract 105
-- derives the continuing table across both phases. Contract 120 gives that
-- table a browser read.
--
-- Nothing has ever written a split-phase row. Measured against the tree before
-- this contract: **zero** statements anywhere insert into
-- `bonus_cup_groups` with `phase_kind = 'split'`, so `cup_split_group_tables`
-- has never returned a row and `get_season_cup_phase`'s split branch has never
-- been reachable. Three contracts of persistence, derivation and read sit on
-- top of a transition that does not exist.
--
-- `src/domain/season/cupGroupTable.ts` has the same shape on the other side:
-- `executeCupSplit` is exported, tested, and called by nothing. This is the
-- same "an authority with no caller" pattern contracts 116, 118, 120 and 122
-- each closed, and it is the last one blocking the Championship surface from
-- ever showing a split.
--
-- ---------------------------------------------------------------------------
-- WHERE THE SPLIT PLAN COMES FROM, AND WHY IT IS NOT RE-DERIVED
-- ---------------------------------------------------------------------------
--
-- `select_season_cup_format` answers "given this field and this many rounds
-- left, what shape fits?". At launch it answered with a `tail` naming the top
-- half size, the bottom half size and the split round count. Asking it again
-- now would ask a DIFFERENT question — the league phase has been played, so
-- `remainingRounds` has shrunk, and the format it returns today is not the
-- format this competition is running.
--
-- Contract 111 recorded its answer in `bonus_competition_audit` as
-- `championship_launched`, and that record is the authority here. A stored fact
-- rather than an inference, the same reasoning contract 119 used for "moved":
-- the plan the entrants were shown at entry close is the plan they play.
--
-- The arithmetic is still checked against it. The field cannot change after
-- Matchday 1 (ADR 0014 as amended by ADR 0020 closes entry there), so a stored
-- `topHalfSize` that disagrees with `ceil(size / 2)` means something moved that
-- should not have, and this refuses rather than picking one.
--
-- ---------------------------------------------------------------------------
-- THE LARGER HALF GOES TO THE TOP, AND THE SMALLER ONE FINISHES EARLIER
-- ---------------------------------------------------------------------------
--
-- `executeCupSplit` takes `Math.ceil(rows.length / 2)` for the top, and
-- `select_season_cup_format` computes `topHalfSize` the same way. Thirteen
-- becomes seven and six. This does not decide that — it follows two authorities
-- that already agree, and the parity guard holds all three together.
--
-- ADR 0014 § Consequences records the loose end: "Odd fields split unevenly …
-- and the smaller half finishes its round-robin earlier. This needs a stated
-- behaviour rather than being discovered mid-season." Here is the stated
-- behaviour, and it is the one that invents least:
--
--   **Both halves play in the same windows, and the smaller half simply has no
--   fixture in the last round or two.**
--
-- The split round count is sized for the TOP half, because the top half is
-- never the smaller one. A seven-player half needs seven rounds (odd fields
-- carry a bye); a six-player half needs five. So the bottom half's schedule
-- runs out first and its entrants play nothing in the remaining rounds.
--
-- The alternative — giving each half its own window run so neither idles — was
-- rejected: it would make one half's matchday numbers disagree with the other's
-- for the same instant, and `matchday` is the COMPETITION's round number (ADR
-- 0025 decision 2), not a per-group counter. A competition where round 36 means
-- two different weeks depending on which half you are in is worse than a half
-- that finishes a fortnight early.
--
-- ---------------------------------------------------------------------------
-- WHAT REFUSES, AND WHAT IS MERELY NOT YET
-- ---------------------------------------------------------------------------
--
-- The launch driver's distinction, kept exactly. What could never be right
-- raises; what is an ordinary state of a healthy competition returns an outcome
-- a scheduled caller can act on and retry.
--
--   RAISES   a competition that is not a Championship; one that is not in a
--            league season; a multi-group field, because ADR 0014 is explicit
--            that "the split applies only to the single-group case" — merging
--            top halves across groups would carry points earned against
--            different opponents; and a final table this cannot trust.
--
--   OUTCOME  not launched yet; a format whose tail is not a split (an even
--            meeting count is already balanced and takes a playoff instead);
--            an initial phase with a window still unsettled; already split.
--
-- ---------------------------------------------------------------------------
-- THE DEFECT THIS HAD TO FIX BEFORE IT COULD BE SAFE
-- ---------------------------------------------------------------------------
--
-- `cup_final_group_tables` builds its `members` CTE from every
-- `bonus_cup_members` row for the competition, with no `phase_kind` filter, and
-- its `window_totals` groups by `user_id` alone. One entrant holding both an
-- initial and a split membership therefore contributes TWO member rows, and the
-- sequence 1–3 window totals — points, exacts, corrects, scoreline error — are
-- summed twice.
--
-- That is latent today only because nothing has ever created a split
-- membership. This contract creates them, so it would light the defect on the
-- first competition to split, in the initial-phase table contract 120 shows a
-- browser. The filter is added here, in the same migration that makes it
-- reachable, and it is behaviour-neutral to every existing row because
-- `phase_kind` defaults to 'initial' and nothing has ever written anything else.
--
-- `results` needed nothing: it already filters `fixture.stage = 'group'`, so
-- split fixtures were never going to reach the initial table.

begin;

-- ---------------------------------------------------------------------------
-- The initial-phase table stops counting a split entrant twice.
--
-- Redefined from its committed text in
-- `20260729050000_predictor_cup_knockouts.sql` with one line added, verified by
-- diff in `tests/database-parity/seasonCupSplitTransitionParity.test.ts` rather
-- than by reading — contract 118's method, for contract 118's reason. The first
-- draft of this migration hand-reconstructed the tail of that function and
-- silently replaced ADR 0014 §5.2's steps 4-5 mini head-to-head tie-break with
-- a different rule; the diff caught it, reading it had not.
-- ---------------------------------------------------------------------------

create or replace function predictor_internal.cup_final_group_tables(
  p_competition_id uuid
)
returns table (
  user_id uuid,
  group_id uuid,
  group_size smallint,
  draw_number integer,
  table_points integer,
  points_for integer,
  points_against integer,
  window_points integer,
  exacts integer,
  corrects integer,
  scoreline_error integer,
  group_rank integer
)
language sql
stable
security definer
set search_path = ''
as $$
  with members as (
    select member.user_id, member.group_id, grp.size, member.draw_number
    from public.bonus_cup_members member
    join public.bonus_cup_groups grp on grp.id = member.group_id
    where member.competition_id = p_competition_id
      -- Contract 124. Without this an entrant holding a split membership as
      -- well as their initial one appears twice, and window_totals doubles.
      and member.phase_kind = 'initial'
  ),
  window_totals as (
    select
      member.user_id,
      coalesce(sum(scores.points), 0)::integer as window_points,
      coalesce(sum(scores.exacts), 0)::integer as exacts,
      coalesce(sum(scores.corrects), 0)::integer as corrects,
      coalesce(sum(scores.scoreline_error), 0)::integer as scoreline_error
    from members member
    left join public.bonus_competition_windows win
      on win.competition_id = p_competition_id
      and win.sequence between 1 and 3
    left join lateral (
      select * from predictor_internal.cup_window_scores(p_competition_id, win.id) s
      where s.user_id = member.user_id
    ) scores on true
    group by member.user_id
  ),
  results as (
    select
      fixture.group_id,
      side.user_id,
      side.opponent_id,
      side.table_points,
      side.points_for,
      side.points_against
    from public.bonus_cup_fixtures fixture
    cross join lateral (
      select * from predictor_internal.cup_window_scores(p_competition_id, fixture.window_id) s
      where s.user_id = fixture.home_user_id
    ) home_score
    cross join lateral (
      select * from predictor_internal.cup_window_scores(p_competition_id, fixture.window_id) s
      where s.user_id = fixture.away_user_id
    ) away_score
    cross join lateral (values
      (
        fixture.home_user_id,
        fixture.away_user_id,
        case
          when home_score.submitted and not away_score.submitted then 3
          when not home_score.submitted then 0
          when home_score.points > away_score.points then 3
          when home_score.points < away_score.points then 0
          else 1
        end,
        home_score.points,
        away_score.points
      ),
      (
        fixture.away_user_id,
        fixture.home_user_id,
        case
          when away_score.submitted and not home_score.submitted then 3
          when not away_score.submitted then 0
          when away_score.points > home_score.points then 3
          when away_score.points < home_score.points then 0
          else 1
        end,
        away_score.points,
        home_score.points
      )
    ) side(user_id, opponent_id, table_points, points_for, points_against)
    where fixture.competition_id = p_competition_id
      and fixture.stage = 'group'
      and predictor_internal.cup_window_settled(fixture.window_id)
  ),
  per_user as (
    select
      member.user_id,
      member.group_id,
      member.size,
      member.draw_number,
      coalesce(sum(result.table_points), 0)::integer as table_points,
      coalesce(sum(result.points_for), 0)::integer as points_for,
      coalesce(sum(result.points_against), 0)::integer as points_against,
      totals.window_points,
      totals.exacts,
      totals.corrects,
      totals.scoreline_error
    from members member
    join window_totals totals on totals.user_id = member.user_id
    left join results result
      on result.user_id = member.user_id and result.group_id = member.group_id
    group by member.user_id, member.group_id, member.size, member.draw_number,
      totals.window_points, totals.exacts, totals.corrects, totals.scoreline_error
  ),
  -- Steps 4–5: among players whose steps 0–3 key is identical, a mini
  -- head-to-head of table points then prediction-point difference.
  with_mini as (
    select
      p.*,
      coalesce((
        select sum(r.table_points)::integer
        from results r
        join per_user tied
          on tied.group_id = p.group_id
          and tied.user_id = r.opponent_id
          and tied.table_points = p.table_points
          and tied.window_points = p.window_points
          and tied.exacts = p.exacts
          and tied.corrects = p.corrects
        where r.user_id = p.user_id and r.group_id = p.group_id
      ), 0) as mini_points,
      coalesce((
        select sum(r.points_for - r.points_against)::integer
        from results r
        join per_user tied
          on tied.group_id = p.group_id
          and tied.user_id = r.opponent_id
          and tied.table_points = p.table_points
          and tied.window_points = p.window_points
          and tied.exacts = p.exacts
          and tied.corrects = p.corrects
        where r.user_id = p.user_id and r.group_id = p.group_id
      ), 0) as mini_difference
    from per_user p
  )
  select
    wm.user_id,
    wm.group_id,
    wm.size as group_size,
    wm.draw_number,
    wm.table_points,
    wm.points_for,
    wm.points_against,
    wm.window_points,
    wm.exacts,
    wm.corrects,
    wm.scoreline_error,
    row_number() over (
      partition by wm.group_id
      order by
        wm.table_points desc,
        wm.window_points desc,
        wm.exacts desc,
        wm.corrects desc,
        wm.mini_points desc,
        wm.mini_difference desc,
        (wm.points_for - wm.points_against) desc,
        wm.scoreline_error asc,
        wm.draw_number asc
    )::integer as group_rank
  from with_mini wm
$$;

revoke all on function predictor_internal.cup_final_group_tables(uuid)
  from public, anon, authenticated, service_role;

-- ---------------------------------------------------------------------------
-- The transition.
--
-- Idempotent under an advisory lock, for contract 111's reason: a split that
-- ran twice would move fixtures under predictions already made against them,
-- and a scheduled driver retries by design.
-- ---------------------------------------------------------------------------

create or replace function predictor_internal.transition_season_cup_to_split(
  p_competition_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $split$
declare
  v_competition record;
  v_tournament_kind text;
  v_initial record;
  v_groups integer;
  v_tail jsonb;
  v_unsettled integer;
  v_ranked integer;
  v_top_size integer;
  v_bottom_size integer;
  v_split_rounds integer;
  v_base_sequence integer;
  v_top_group uuid;
  v_bottom_group uuid;
  v_windows integer;
  v_fixtures integer := 0;
  v_half record;
  v_draw text[];
  v_schedule jsonb;
  v_placed integer;
begin
  select competition.id, competition.tournament_id, competition.game_key
    into v_competition
    from public.bonus_competitions competition
    where competition.id = p_competition_id;

  if not found then
    raise exception 'Competition % does not exist', p_competition_id
      using errcode = '23503';
  end if;

  if v_competition.game_key <> 'predictor_cup' then
    raise exception 'Only a Predictor Championship splits, not %',
      v_competition.game_key
      using errcode = '23514';
  end if;

  select tournament.kind into v_tournament_kind
    from public.tournaments tournament
    where tournament.id = v_competition.tournament_id;

  if v_tournament_kind is distinct from 'league_season' then
    raise exception
      'Competition % belongs to a % rather than a league season; the tournament Championship finishes through its bracket',
      p_competition_id, coalesce(v_tournament_kind, 'competition of unknown kind')
      using errcode = '23514';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(p_competition_id::text, 0)
  );

  -- Everything below is re-read under the lock.
  if exists (
    select 1 from public.bonus_cup_groups existing
    where existing.competition_id = p_competition_id
      and existing.phase_kind = 'split'
  ) then
    return pg_catalog.jsonb_build_object(
      'outcome', 'already_split', 'fixtures', 0);
  end if;

  select count(*)::integer into v_groups
    from public.bonus_cup_groups grp
    where grp.competition_id = p_competition_id
      and grp.phase_kind = 'initial';

  if v_groups = 0 then
    return pg_catalog.jsonb_build_object(
      'outcome', 'not_launched', 'fixtures', 0);
  end if;

  -- ADR 0014: "The split applies only to the single-group case. Merging top
  -- halves across groups would carry points earned against different opponents,
  -- breaking the comparability the design rests on."
  if v_groups > 1 then
    raise exception
      'Competition % has % initial groups; a multi-group Championship finishes with qualification, seeded playoff and knockout rather than a split',
      p_competition_id, v_groups
      using errcode = '23514';
  end if;

  select grp.id, grp.size, grp.ordinal
    into v_initial
    from public.bonus_cup_groups grp
    where grp.competition_id = p_competition_id
      and grp.phase_kind = 'initial';

  -- The plan recorded at launch, not a fresh answer to a changed question.
  select audit.detail->'tail'
    into v_tail
    from public.bonus_competition_audit audit
    where audit.competition_id = p_competition_id
      and audit.action = 'championship_launched'
    order by audit.recorded_at desc
    limit 1;

  if v_tail is null or v_tail->>'kind' is distinct from 'split' then
    -- An even meeting count is already balanced and takes a playoff. Not an
    -- error: most formats do not split.
    return pg_catalog.jsonb_build_object(
      'outcome', 'no_split_in_format',
      'tail', v_tail,
      'fixtures', 0);
  end if;

  -- The initial phase must be finished. A split computed from a table that can
  -- still move would assign an entrant to the wrong half permanently, and
  -- nothing downstream reopens a phase.
  select count(*)::integer into v_unsettled
    from public.bonus_cup_fixtures fixture
    where fixture.competition_id = p_competition_id
      and fixture.stage = 'group'
      and not predictor_internal.cup_window_settled(fixture.window_id);

  if v_unsettled > 0 then
    return pg_catalog.jsonb_build_object(
      'outcome', 'initial_phase_incomplete',
      'unsettledFixtures', v_unsettled,
      'fixtures', 0);
  end if;

  v_top_size := ceil(v_initial.size::numeric / 2)::integer;
  v_bottom_size := v_initial.size - v_top_size;
  v_split_rounds := (v_tail->>'splitRounds')::integer;

  -- `executeCupSplit` refuses below four, and so does the format selector's
  -- minimum field. Restated rather than assumed, because this is the function
  -- that would otherwise create a one-player half.
  if v_initial.size < 4 then
    raise exception
      'A % entrant field is too small to split; four is the minimum field',
      v_initial.size
      using errcode = '23514';
  end if;

  -- The field cannot change after Matchday 1, so a stored plan that disagrees
  -- with the arithmetic means something moved. Refuse rather than choose.
  if (v_tail->>'topHalfSize')::integer is distinct from v_top_size
     or (v_tail->>'bottomHalfSize')::integer is distinct from v_bottom_size then
    raise exception
      'The launch record plans halves of %/% but the group of % splits %/%; the field changed after entry closed',
      v_tail->>'topHalfSize', v_tail->>'bottomHalfSize',
      v_initial.size, v_top_size, v_bottom_size
      using errcode = '23514';
  end if;

  if v_split_rounds is null or v_split_rounds < 1 then
    raise exception 'The launch record names no usable split round count'
      using errcode = '23514';
  end if;

  -- The final table, from the authority that owns it. Ranks must be the
  -- complete 1..size run — the same `invalid_input` refusal `executeCupSplit`
  -- makes, and for the same reason: a half taken from a table with a gap in it
  -- is not the top half of anything.
  select count(*)::integer into v_ranked
    from predictor_internal.cup_final_group_tables(p_competition_id) standing
    where standing.group_id = v_initial.id;

  if v_ranked <> v_initial.size then
    raise exception
      'The final table holds % rows for a group of %; the split cannot be taken from it',
      v_ranked, v_initial.size
      using errcode = '23514';
  end if;

  if exists (
    select 1
      from predictor_internal.cup_final_group_tables(p_competition_id) standing
     where standing.group_id = v_initial.id
       and (standing.group_rank < 1 or standing.group_rank > v_initial.size)
  ) or (
    select count(distinct standing.group_rank)::integer
      from predictor_internal.cup_final_group_tables(p_competition_id) standing
     where standing.group_id = v_initial.id
  ) <> v_initial.size then
    raise exception
      'The final table does not rank a group of % as 1..% without ties or gaps',
      v_initial.size, v_initial.size
      using errcode = '23514';
  end if;

  -- ---------------------------------------------------------------------------
  -- The two halves.
  --
  -- Ordinals continue the competition's own group numbering rather than
  -- restarting, because `(competition_id, ordinal)` is unique across phases and
  -- a split group is a group of this competition like any other.
  -- ---------------------------------------------------------------------------

  insert into public.bonus_cup_groups
    (competition_id, ordinal, size, phase_kind, parent_group_id)
  values
    (p_competition_id, v_initial.ordinal + 1, v_top_size, 'split', v_initial.id)
  returning id into v_top_group;

  insert into public.bonus_cup_groups
    (competition_id, ordinal, size, phase_kind, parent_group_id)
  values
    (p_competition_id, v_initial.ordinal + 2, v_bottom_size, 'split', v_initial.id)
  returning id into v_bottom_group;

  -- Draw numbers are CARRIED, not reassigned. They are the guaranteed
  -- terminator of the tie-break sequence, they are unique per phase by contract
  -- 102's key, and reassigning them would silently change which of two
  -- otherwise-identical entrants finishes above the other.
  insert into public.bonus_cup_members
    (competition_id, user_id, group_id, draw_number, phase_kind)
  select
    p_competition_id,
    standing.user_id,
    case when standing.group_rank <= v_top_size then v_top_group else v_bottom_group end,
    standing.draw_number,
    'split'
  from predictor_internal.cup_final_group_tables(p_competition_id) standing
  where standing.group_id = v_initial.id;

  -- ---------------------------------------------------------------------------
  -- The calendar and the fixtures.
  --
  -- Contract 110 appends rather than owning the calendar, which is exactly what
  -- it said this phase would need. `matchday` is the window sequence, so the
  -- competition's round numbering continues through the split rather than
  -- resetting (ADR 0025 decision 2).
  -- ---------------------------------------------------------------------------

  select coalesce(max(win.sequence), 0)::integer into v_base_sequence
    from public.bonus_competition_windows win
    where win.competition_id = p_competition_id;

  v_windows := predictor_internal.generate_season_cup_windows(
    p_competition_id, now(), v_split_rounds);

  if v_windows < v_split_rounds then
    raise exception
      'The season has room for % more Championship rounds but the split needs %',
      v_windows, v_split_rounds
      using errcode = '23514';
  end if;

  for v_half in
    select v_top_group as group_id union all select v_bottom_group as group_id
  loop
    select array_agg(member.user_id::text order by member.draw_number)
      into v_draw
      from public.bonus_cup_members member
      where member.competition_id = p_competition_id
        and member.phase_kind = 'split'
        and member.group_id = v_half.group_id;

    -- One meeting: the split is a single round-robin within the half.
    v_schedule := predictor_internal.cup_league_schedule(v_draw, 1);

    if not (v_schedule->>'ok')::boolean then
      raise exception 'The schedule generator refused a split half: %',
        v_schedule->>'reason'
        using errcode = '23514';
    end if;

    -- The smaller half's round-robin is shorter, so it simply stops early. Its
    -- entrants have no fixture in the competition's final round or two, which
    -- is ADR 0014's stated consequence rather than an omission here.
    with rounds as (
      select
        (entry->>'round')::integer as round_number,
        entry->'ties' as ties
      from pg_catalog.jsonb_array_elements(v_schedule->'rounds') as entry
    ), placed as (
      insert into public.bonus_cup_fixtures (
        competition_id, stage, group_id, window_id, matchday,
        home_user_id, away_user_id
      )
      select
        p_competition_id,
        'split',
        v_half.group_id,
        competition_window.id,
        v_base_sequence + rounds.round_number,
        (tie->>'home')::uuid,
        (tie->>'away')::uuid
      from rounds
      cross join lateral pg_catalog.jsonb_array_elements(rounds.ties) as tie
      join public.bonus_competition_windows competition_window
        on competition_window.competition_id = p_competition_id
       and competition_window.sequence = v_base_sequence + rounds.round_number
      returning id
    )
    select count(*)::integer into v_placed from placed;

    v_fixtures := v_fixtures + v_placed;
  end loop;

  insert into public.bonus_competition_audit (competition_id, action, detail)
  values (
    p_competition_id,
    'championship_split',
    pg_catalog.jsonb_build_object(
      'initialGroupId', v_initial.id,
      'topGroupId', v_top_group,
      'bottomGroupId', v_bottom_group,
      'topHalfSize', v_top_size,
      'bottomHalfSize', v_bottom_size,
      'splitRounds', v_split_rounds,
      'firstSplitMatchday', v_base_sequence + 1,
      'windowsCreated', v_windows,
      'fixturesCreated', v_fixtures
    )
  );

  return pg_catalog.jsonb_build_object(
    'outcome', 'split',
    'topGroupId', v_top_group,
    'bottomGroupId', v_bottom_group,
    'topHalfSize', v_top_size,
    'bottomHalfSize', v_bottom_size,
    'splitRounds', v_split_rounds,
    'firstSplitMatchday', v_base_sequence + 1,
    'windows', v_windows,
    'fixtures', v_fixtures);
end;
$split$;

revoke all on function predictor_internal.transition_season_cup_to_split(uuid)
  from public, anon, authenticated, service_role;

-- ---------------------------------------------------------------------------
-- Prove the shape, in the same transaction.
-- ---------------------------------------------------------------------------

do $$
begin
  -- This migration adds a driver; it must not drive anything.
  if exists (
    select 1 from public.bonus_cup_groups where phase_kind = 'split'
  ) then
    raise exception 'this migration must create no split group';
  end if;

  if exists (
    select 1 from information_schema.routine_privileges
     where routine_name = 'transition_season_cup_to_split'
       and grantee in ('anon', 'authenticated', 'service_role')
  ) then
    raise exception 'a browser or service role can drive the Championship split';
  end if;

  -- The redefinition kept the phase filter it was made for. A later
  -- `create or replace` that dropped it would restore the double-count in the
  -- initial table with nothing else failing.
  if pg_catalog.pg_get_functiondef(
       pg_catalog.to_regprocedure('predictor_internal.cup_final_group_tables(uuid)')::oid
     ) not like '%member.phase_kind = ''initial''%' then
    raise exception 'cup_final_group_tables no longer filters to the initial phase';
  end if;
end;
$$;

commit;
