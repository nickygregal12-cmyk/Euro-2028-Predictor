-- ---------------------------------------------------------------------------
-- Contract 167 — the multi-group Championship, made visible.
--
-- ---------------------------------------------------------------------------
-- WHY THIS SHIPS WITH CONTRACT 166 AND NOT AFTER IT
-- ---------------------------------------------------------------------------
--
-- Contract 166 draws a hundred-entrant Championship into five groups of twenty
-- and schedules 950 fixtures. Measured against the browser-reachable surface:
--
--   * `get_season_cup_phase` (contract 120) answers the caller's OWN phase and
--     the table for their OWN group;
--   * `get_season_cup_player_view` (contract 133) answers one selected
--     instance for one player;
--   * `get_my_cup` answers the caller's own competition.
--
-- Every one of them is scoped to the caller. Not one can answer "what do the
-- five groups look like", which for a multi-group competition is the whole
-- surface — a player in group 3 who cannot see groups 1, 2, 4 and 5 cannot tell
-- whether their 24 points is winning the competition or losing it.
--
-- Shipping 166 without this would create, deliberately and in one commit, the
-- exact defect this repository has hit seven times: an authority that writes
-- rows nothing can read. Contracts 116, 118, 120, 122, 124, 128 and 129 are all
-- that shape. So the reader lands with the writer.
--
-- ---------------------------------------------------------------------------
-- IT RECOMPUTES NOTHING
-- ---------------------------------------------------------------------------
--
-- Every figure comes from `predictor_internal.cup_final_group_tables`, which
-- has ranked Championship groups since contract 105 and which contract 124
-- corrected. This read groups its output and adds identity; it does not add a
-- tie-break, a points value or a rank of its own. A second ranking authority
-- would eventually disagree with the first, and the player would be shown two
-- different answers to one question.
--
-- ---------------------------------------------------------------------------
-- WHO SEES WHAT
-- ---------------------------------------------------------------------------
--
-- A group table is the Championship's own standings, so it is visible to the
-- competition's ENTRANTS — the people whose results made it. That is the same
-- boundary contract 164 took for the Last Man Standing field and contract 128
-- took for a league table, and it is narrower than "any signed-in caller",
-- which for a PRIVATE Championship would publish a private group's membership
-- to anyone holding its id.
--
-- Display names come with it, because a table of anonymous rows is not a table.
-- No prediction, no selection and no score event is disclosed: a Championship
-- table is made of tie results, and this returns the results.
--
-- Additive: one new read. No relation, policy, trigger, grant or existing
-- function is altered.
-- ---------------------------------------------------------------------------

create or replace function public.get_season_cup_group_stage(
  p_competition_id uuid,
  p_group_ordinal integer default null
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $stage$
declare
  v_uid uuid := (select auth.uid());
  v_competition record;
  v_is_entrant boolean;
  v_my_group uuid;
  v_groups jsonb;
begin
  if v_uid is null then
    raise exception 'Not authenticated' using errcode = 'insufficient_privilege';
  end if;

  select competition.id, competition.name, competition.game_key,
         competition.tournament_id, competition.visibility_kind,
         competition.completed_at,
         season.name as season_name, season.season_key
    into v_competition
    from public.bonus_competitions competition
    join public.tournaments season on season.id = competition.tournament_id
   where competition.id = p_competition_id;

  if v_competition.id is null or v_competition.game_key is distinct from 'predictor_cup' then
    -- Identical answer for "not a Championship" and "does not exist", so an id
    -- cannot be probed for what kind of thing it is.
    raise exception 'No such Championship' using errcode = 'no_data_found';
  end if;

  select exists (
    select 1 from public.bonus_competition_entrants entrant
     where entrant.competition_id = p_competition_id
       and entrant.user_id = v_uid)
    into v_is_entrant;

  -- ENTRANCY IS THE BOUNDARY, checked before any group is read so a
  -- non-entrant cannot learn the field's shape from a timing difference.
  if not v_is_entrant then
    return jsonb_build_object(
      'available', true,
      'entered', false,
      'competition', jsonb_build_object(
        'id', v_competition.id,
        'name', v_competition.name,
        'season_name', v_competition.season_name),
      'groups', '[]'::jsonb,
      'my_group_ordinal', null);
  end if;

  select member.group_id into v_my_group
    from public.bonus_cup_members member
   where member.competition_id = p_competition_id
     and member.user_id = v_uid
     and member.phase_kind = 'initial';

  -- The whole group stage, or one group of it. The optional argument is what
  -- keeps a hundred-entrant competition renderable: five groups of twenty is a
  -- hundred rows, and a surface showing one group at a time asks for one.
  select coalesce(jsonb_agg(grouped.entry order by grouped.ordinal), '[]'::jsonb)
    into v_groups
    from (
      select cup_group.ordinal,
             jsonb_build_object(
               'group_id', cup_group.id,
               'ordinal', cup_group.ordinal,
               'size', cup_group.size,
               'is_my_group', cup_group.id = v_my_group,
               'rows', coalesce((
                 select jsonb_agg(jsonb_build_object(
                          'rank', standing.group_rank,
                          'user_id', standing.user_id,
                          'display_name', coalesce(player.display_name, 'Player'),
                          'is_me', standing.user_id = v_uid,
                          'draw_number', standing.draw_number,
                          -- Every figure below is the ranking authority's own.
                          -- Nothing here recomputes a point or a position.
                          'table_points', standing.table_points,
                          'points_for', standing.points_for,
                          'points_against', standing.points_against,
                          'window_points', standing.window_points,
                          'exacts', standing.exacts,
                          'corrects', standing.corrects,
                          'scoreline_error', standing.scoreline_error)
                        order by standing.group_rank, standing.draw_number)
                   from predictor_internal.cup_final_group_tables(p_competition_id) standing
                   left join public.profiles player on player.id = standing.user_id
                  where standing.group_id = cup_group.id), '[]'::jsonb)
             ) as entry
        from public.bonus_cup_groups cup_group
       where cup_group.competition_id = p_competition_id
         and cup_group.phase_kind = 'initial'
         and (p_group_ordinal is null or cup_group.ordinal = p_group_ordinal)
    ) grouped;

  return jsonb_build_object(
    'available', true,
    'entered', true,
    'competition', jsonb_build_object(
      'id', v_competition.id,
      'name', v_competition.name,
      'season_name', v_competition.season_name,
      'season_key', v_competition.season_key,
      'visibility', v_competition.visibility_kind,
      'completed_at', v_competition.completed_at),
    'group_count', (select count(*)::integer from public.bonus_cup_groups g
                     where g.competition_id = p_competition_id and g.phase_kind = 'initial'),
    'my_group_ordinal', (select g.ordinal from public.bonus_cup_groups g
                          where g.id = v_my_group),
    -- The competition's own round number, from the fixtures that exist rather
    -- than from a count of windows: a group with no fixture in the last round
    -- is contract 124's established behaviour and must not shorten the
    -- competition.
    'matchdays', (select max(fixture.matchday)::integer
                    from public.bonus_cup_fixtures fixture
                   where fixture.competition_id = p_competition_id
                     and fixture.stage = 'group'),
    'groups', v_groups);
end;
$stage$;

revoke all on function public.get_season_cup_group_stage(uuid, integer) from public, anon;
grant execute on function public.get_season_cup_group_stage(uuid, integer) to authenticated;

-- ===========================================================================
-- Prove it, in the same transaction
-- ===========================================================================

do $$
declare
  v_read text := pg_get_functiondef(
    'public.get_season_cup_group_stage(uuid,integer)'::regprocedure);
begin
  -- IT RECOMPUTES NOTHING. Every figure is the ranking authority's own, so the
  -- overview and the caller's own view cannot disagree about a position.
  if v_read !~ 'cup_final_group_tables' then
    raise exception 'The group stage read must take its table from the ranking authority';
  end if;

  -- A second ranking would eventually disagree with the first.
  if v_read ~* 'row_number\(\)[[:space:]]*over|rank\(\)[[:space:]]*over|dense_rank' then
    raise exception 'The group stage read must not rank anything itself';
  end if;

  -- It discloses no prediction, no selection and no score event: a Championship
  -- table is made of tie results, and this returns the results.
  if v_read ~* 'match_predictions|bonus_lms_selections|score_events|season_predictions' then
    raise exception 'A group table must disclose no prediction or selection';
  end if;

  -- ENTRANCY IS THE BOUNDARY. Without it, a private Championship's membership
  -- is readable by anyone holding its id.
  if v_read !~ 'bonus_competition_entrants' or v_read !~ 'auth\.uid\(\)' then
    raise exception 'The group stage read must check the caller''s own entry';
  end if;

  -- It reads and writes nothing.
  if v_read ~* 'insert[[:space:]]+into|update[[:space:]]+public\.|delete[[:space:]]+from' then
    raise exception 'The group stage read must write nothing';
  end if;

  if has_function_privilege('anon', 'public.get_season_cup_group_stage(uuid,integer)', 'execute') then
    raise exception 'The group stage read must not be reachable anonymously';
  end if;

  if not has_function_privilege('authenticated',
       'public.get_season_cup_group_stage(uuid,integer)', 'execute') then
    raise exception 'The group stage read must stay reachable by a signed-in caller';
  end if;
end;
$$;
