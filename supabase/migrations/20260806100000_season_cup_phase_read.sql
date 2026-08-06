-- Contract 120: the Championship's phase and continuing table reach the browser.
--
-- ---------------------------------------------------------------------------
-- THE GAP THIS CLOSES, MEASURED RATHER THAN ASSUMED
-- ---------------------------------------------------------------------------
--
-- Contract 102 persists the Predictor Championship split as a distinct phase:
-- `bonus_cup_groups.phase_kind` is 'initial' or 'split', `parent_group_id`
-- carries one-parent ancestry, and `bonus_cup_members.phase_kind` places an
-- entrant in one of them. Contract 105 derives the continuing table for a split
-- group from settled initial and split fixtures, without copying a starting
-- total, in `predictor_internal.cup_split_group_tables`.
--
-- None of it is reachable from a browser. Measured against hosted development
-- at contract 115, counting functions in `public`/`graphql_public` that
-- `authenticated` may execute:
--
--   functions reading cup_split_group_tables ... 0
--   functions reading parent_group_id ......... 0
--   functions reading cup_final_group_tables .. 0
--   functions touching bonus_cup_groups ....... 1  (get_my_cup)
--
-- and `get_my_cup`'s deployed definition names neither `cup_split_group_tables`
-- nor the string 'split'. It was last defined on 29 July 2026, before contract
-- 102 existed, and nothing has widened it since.
--
-- THIS IS THE FIFTH INSTANCE OF ONE DEFECT. Contract 86 (the LMS selection
-- trigger), 98 (three Cup RPCs), 116 (the LMS round read) and 118 (the games
-- hub listing) were each a function written for what existed at the time,
-- defined once, never widened -- and each failed SILENTLY, returning an empty
-- set rather than an error. `168_tournament_only_browser_reads.sql` was added
-- so the fifth would be caught rather than discovered. It catches the
-- tournament/season split specifically; this one is the same shape along a
-- different axis, initial versus split phase, which is why it went unseen.
--
-- ---------------------------------------------------------------------------
-- WHAT THIS DECIDES, AND WHAT IT DELIBERATELY DOES NOT
-- ---------------------------------------------------------------------------
--
-- It adds NO rule. It recomputes nothing. Which authority produces a group's
-- table is read from the data rather than chosen here:
--
--   * `cup_split_group_tables` already filters `member.phase_kind = 'split'`,
--     so it IS the authority for a split group;
--   * `cup_final_group_tables` is the authority for an initial group.
--
-- So the branch below is a lookup of a fact contract 105 already established,
-- not a new decision about how a phase is scored.
--
-- IT TAKES A COMPETITION, NOT A SEASON, unlike `get_my_cup(p_tournament_id)`
-- and `get_season_lms_round(p_tournament_id)`. A season can hold several
-- Championship instances -- one live public competition plus organiser-created
-- private ones -- and resolving "the" one is a question contracts 103 and 104
-- already own through `current_public_competition_id`. Re-deciding it inside a
-- read would put a second answer in the repository, so the caller passes the
-- competition it already holds from the games hub listing.
--
-- IT RETURNS NO DISPLAY NAME. The group table carries `user_id` and the stats
-- the authority computes; resolving an identity to a name stays with the
-- existing profile reads that already own that disclosure. Adding a join here
-- would decide a disclosure question this contract has no authority over.
--
-- A non-entrant gets `entered: false` and nothing else -- not an exception,
-- which would confirm the competition exists to somebody with no membership
-- in it.

create or replace function public.get_season_cup_phase(
  p_competition_id uuid
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $get_season_cup_phase$
declare
  v_uid uuid := (select auth.uid());
  v_group_id uuid;
  v_phase_kind text;
  v_group record;
  v_table jsonb;
begin
  if p_competition_id is null then
    raise exception 'Competition is required' using errcode = '22023';
  end if;

  if v_uid is null then
    raise exception 'Authentication is required' using errcode = '42501';
  end if;

  -- The caller's own membership, and only their own. Everything below is
  -- scoped by the group this resolves to.
  select member.group_id, member.phase_kind
    into v_group_id, v_phase_kind
    from public.bonus_cup_members member
   where member.competition_id = p_competition_id
     and member.user_id = v_uid;

  if v_group_id is null then
    return pg_catalog.jsonb_build_object(
      'competition_id', p_competition_id,
      'entered', false
    );
  end if;

  select grp.id, grp.ordinal, grp.size, grp.phase_kind, grp.parent_group_id
    into v_group
    from public.bonus_cup_groups grp
   where grp.id = v_group_id;

  -- The table for the caller's own group, from whichever authority owns that
  -- phase. Ordered by the rank the authority assigned rather than re-derived.
  if v_phase_kind = 'split' then
    select pg_catalog.coalesce(
             pg_catalog.jsonb_agg(
               pg_catalog.jsonb_build_object(
                 'user_id', t.user_id,
                 'is_you', t.user_id = v_uid,
                 'group_rank', t.group_rank,
                 'table_points', t.table_points,
                 'points_for', t.points_for,
                 'points_against', t.points_against,
                 'window_points', t.window_points,
                 'exacts', t.exacts,
                 'corrects', t.corrects,
                 'scoreline_error', t.scoreline_error
               )
               order by t.group_rank, t.user_id
             ),
             '[]'::jsonb
           )
      into v_table
      from predictor_internal.cup_split_group_tables(p_competition_id) t
     where t.group_id = v_group_id;
  else
    select pg_catalog.coalesce(
             pg_catalog.jsonb_agg(
               pg_catalog.jsonb_build_object(
                 'user_id', t.user_id,
                 'is_you', t.user_id = v_uid,
                 'group_rank', t.group_rank,
                 'table_points', t.table_points,
                 'points_for', t.points_for,
                 'points_against', t.points_against,
                 'window_points', t.window_points,
                 'exacts', t.exacts,
                 'corrects', t.corrects,
                 'scoreline_error', t.scoreline_error
               )
               order by t.group_rank, t.user_id
             ),
             '[]'::jsonb
           )
      into v_table
      from predictor_internal.cup_final_group_tables(p_competition_id) t
     where t.group_id = v_group_id;
  end if;

  return pg_catalog.jsonb_build_object(
    'competition_id', p_competition_id,
    'entered', true,
    'phase_kind', v_phase_kind,
    'group', pg_catalog.jsonb_build_object(
      'id', v_group.id,
      'ordinal', v_group.ordinal,
      'size', v_group.size,
      'phase_kind', v_group.phase_kind,
      'parent_group_id', v_group.parent_group_id
    ),
    'table', pg_catalog.coalesce(v_table, '[]'::jsonb)
  );
end;
$get_season_cup_phase$;

revoke all on function public.get_season_cup_phase(uuid) from public, anon, authenticated;
grant execute on function public.get_season_cup_phase(uuid) to authenticated;

comment on function public.get_season_cup_phase(uuid) is
  'Contract 120. The caller''s own Predictor Championship phase and the table '
  'for their own group, taken from the authority that owns that phase: '
  'cup_split_group_tables for a split group, cup_final_group_tables for an '
  'initial one. Adds no rule and recomputes nothing. A non-entrant receives '
  'entered=false rather than an exception.';
