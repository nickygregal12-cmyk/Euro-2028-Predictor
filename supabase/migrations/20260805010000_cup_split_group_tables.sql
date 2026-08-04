-- Contract 104: the Predictor Championship split table, derived across both
-- phases.
--
-- ADR 0025 decision 2, second half. Contract 102 gave the split a persisted
-- shape — `phase_kind`, `parent_group_id`, phase-aware membership and
-- `stage = 'split'` fixtures carrying the competition's overall matchday. What
-- it deliberately did not do is say what the continuing table READS.
--
-- The decision states the requirement exactly: "Derive the continuing standings
-- from both initial and split fixtures so points genuinely carry forward rather
-- than being copied into a new starting total." And, in rejected alternatives:
-- "Copying carried points into a new starting total at the split. Rejected: it
-- duplicates a fact the fixtures already determine, and duplicated arithmetic
-- drifts."
--
-- So no column anywhere stores "points brought into the split". If a league-
-- phase result is later corrected — a window re-settled, a fixture rescored —
-- the split table moves with it, because it was never a copy.
--
-- ---------------------------------------------------------------------------
-- THE ONE STRUCTURAL IDEA
-- ---------------------------------------------------------------------------
--
-- A league-phase fixture belongs to the entrant's INITIAL group. A split-phase
-- fixture belongs to their SPLIT group. The continuing table ranks within the
-- split group, so fixtures of BOTH kinds are attributed to the entrant's
-- **split** group before aggregation.
--
-- That attribution IS the carry-forward. It is one join, and it replaces a
-- stored starting total entirely.
--
-- A consequence worth stating, because it looks wrong at a glance and is not:
-- an entrant's league-phase opponents were drawn from their initial group, and
-- after the split those opponents may sit in a different split group. The
-- points still carry — they were earned — but the head-to-head tiebreak below
-- only ever compares entrants who share the split group being ranked, which is
-- the table being computed.
--
-- ---------------------------------------------------------------------------
-- WHY A NEW FUNCTION RATHER THAN A WIDENING OF cup_final_group_tables
-- ---------------------------------------------------------------------------
--
-- `cup_final_group_tables` is the tournament's group table and is reached by
-- the qualification and knockout-seeding path. Three things about it are
-- tournament FORMAT rather than shared rule, and widening it would drag all
-- three into the season:
--
--   * it reads `phase_kind = 'initial'` membership, which is the roster
--     qualification and seeding are stored against;
--   * it filters `fixture.stage = 'group'`, so it must never see split
--     fixtures;
--   * its window totals are bounded `win.sequence between 1 and 3` — the
--     tournament's three matchdays, hardcoded, and a season league phase runs
--     far longer.
--
-- Contract 102 already made the first two explicit. Leaving them alone is the
-- point: the initial table must keep answering exactly as it does today after
-- a split exists, and there is a test for that.
--
-- ---------------------------------------------------------------------------
-- WHERE THIS DELIBERATELY DIFFERS
-- ---------------------------------------------------------------------------
--
-- `cup_final_group_tables` sums its tiebreak window points over windows 1-3
-- whether or not those windows settled, while taking table points only from
-- settled fixtures. Across three fixed matchdays that gap is invisible.
--
-- Across a season-length league phase plus a split it is not, so here BOTH
-- come from the same place: the windows of the entrant's own settled fixtures.
-- An unsettled round contributes nothing to either number, so the table cannot
-- rank on points from a round whose result has not been confirmed. This is a
-- new stage rather than a change to a delivered one, so nothing that exists
-- today moves.

create or replace function predictor_internal.cup_split_group_tables(p_competition_id uuid)
returns table (
  user_id uuid,
  group_id uuid,
  group_size smallint,
  parent_group_id uuid,
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
as $function$
  with members as (
    select
      member.user_id,
      member.group_id,
      grp.size,
      grp.parent_group_id,
      member.draw_number
    from public.bonus_cup_members member
    join public.bonus_cup_groups grp on grp.id = member.group_id
    where member.competition_id = p_competition_id
      and member.phase_kind = 'split'
  ),
  -- Both phases, joined to the entrant rather than to the fixture's own group —
  -- a league-phase fixture points at the INITIAL group, so joining on the
  -- entrant is exactly what carries those points into the split table.
  --
  -- And no `group_id` of its own, deliberately. An earlier draft carried one so
  -- the head-to-head subquery could filter `r.group_id = p.group_id`; but every
  -- row already belonged to the entrant's split group, so that filter was a
  -- no-op, and the only way to make it mean anything was to carry the fixture's
  -- group instead — which silently drops league-phase meetings. Both readings
  -- passed the totals tests, because the totals never join on it. Removing the
  -- column deletes the wrong version rather than documenting it: the group
  -- restriction now lives in exactly one place, the `per_user tied` join below.
  results as (
    select
      side.user_id,
      side.opponent_id,
      fixture.window_id,
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
    join members member on member.user_id = side.user_id
    where fixture.competition_id = p_competition_id
      and fixture.stage in ('group', 'split')
      and predictor_internal.cup_window_settled(fixture.window_id)
  ),
  -- One row per window the entrant actually played and that settled, so a
  -- window is never counted twice if both phases somehow reference it.
  counted_windows as (
    select distinct result.user_id, result.window_id
    from results result
  ),
  window_totals as (
    select
      member.user_id,
      coalesce(sum(scores.points), 0)::integer as window_points,
      coalesce(sum(scores.exacts), 0)::integer as exacts,
      coalesce(sum(scores.corrects), 0)::integer as corrects,
      coalesce(sum(scores.scoreline_error), 0)::integer as scoreline_error
    from members member
    left join counted_windows played on played.user_id = member.user_id
    left join lateral (
      select * from predictor_internal.cup_window_scores(p_competition_id, played.window_id) s
      where s.user_id = member.user_id
    ) scores on true
    group by member.user_id
  ),
  per_user as (
    select
      member.user_id,
      member.group_id,
      member.size,
      member.parent_group_id,
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
    left join results result on result.user_id = member.user_id
    group by member.user_id, member.group_id, member.size, member.parent_group_id,
      member.draw_number, totals.window_points, totals.exacts, totals.corrects,
      totals.scoreline_error
  ),
  -- Head-to-head among entrants tied on the earlier keys, counting every
  -- meeting in either phase.
  --
  -- The rule this settles, which ADR 0025 leaves open: everything that counts
  -- towards the table also counts towards the tiebreak. A league-phase meeting
  -- between two entrants who now share a split group is part of why they are
  -- level, so it is part of how the tie is broken.
  --
  -- Opponents outside this split group cannot appear, and the `per_user tied`
  -- join is the single place that guarantees it: `per_user` holds split members
  -- only, and `tied.group_id = p.group_id` pins the group being ranked.
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
        where r.user_id = p.user_id
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
        where r.user_id = p.user_id
      ), 0) as mini_difference
    from per_user p
  )
  select
    wm.user_id,
    wm.group_id,
    wm.size as group_size,
    wm.parent_group_id,
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
$function$;

comment on function predictor_internal.cup_split_group_tables(uuid) is
  'ADR 0025 decision 2: the continuing split table, derived from initial and split fixtures together so points carry forward rather than being copied into a starting total.';

-- Internal only, like every other `predictor_internal` Cup authority. A browser
-- role reaches Cup standings through the bounded read, never through this.
revoke all on function predictor_internal.cup_split_group_tables(uuid)
  from public, anon, authenticated, service_role;
