-- Contract 169 — the season Championship's initial group table stops ranking
-- on three matchdays out of thirty-eight.
--
-- ---------------------------------------------------------------------------
-- THE DEFECT, MEASURED
-- ---------------------------------------------------------------------------
--
-- `predictor_internal.cup_final_group_tables` is the ranking authority for an
-- INITIAL Championship group. Its table points come from every settled group
-- fixture, which is right. Its four other ranking keys — `window_points`,
-- `exacts`, `corrects` and `scoreline_error` — come from
--
--     and win.sequence between 1 and 3
--
-- which is the TOURNAMENT's three group matchdays, hard-coded since
-- `20260729050000_predictor_cup_knockouts.sql`. Contract 105 named this
-- exactly, in prose, as one of the three reasons it wrote a separate function
-- for the split rather than widening this one. It then left the INITIAL phase
-- alone, correctly — nothing at that point created a season group stage.
--
-- Contract 120 shows this table to a season entrant, and contract 167 shows it
-- for every group of a multi-group season Championship. So the truncation is
-- now reachable from a browser, for a competition whose group stage runs to
-- thirty-eight matchdays.
--
-- Driven on a disposable PostgreSQL 16 against the function's own committed
-- text — a four-entrant group over SIX matchdays, everyone tied on nine table
-- points, so the prediction-point key decides the whole table:
--
--     player  rank  table_points  window_points   ACTUAL total over 6
--     A          1             9             30                    30
--     D          2             9             30                    33
--     B          3             9             18                    78
--     C          4             9             15                    30
--
-- B scored more than twice A's prediction points across the group stage and is
-- ranked third of four. A wins the group. **The group winner decides
-- qualification and seeding**, so this is not a display defect.
--
-- Note also that the ordering is internally inconsistent: its seventh key,
-- `points_for - points_against`, IS full-span, so one ordering mixes keys
-- measured over three matchdays with keys measured over all of them.
--
-- ---------------------------------------------------------------------------
-- WHY A NEW FUNCTION AND NOT A FIX TO THAT ONE
-- ---------------------------------------------------------------------------
--
-- `cup_final_group_tables` is the tournament's group table. It is
-- production-hosted, it is reached by `admin_finalise_predictor_cup_groups`
-- — the qualification and knockout-seeding path — and for a tournament its
-- bound is not a bug at all: sequences 1 to 3 ARE the whole group stage.
--
-- It also differs from what a season needs in a second way that contract 105
-- already recorded: it sums the tie-break window totals over windows 1-3
-- whether or not those windows settled, while taking table points only from
-- settled fixtures. Across three fixed matchdays that gap is invisible.
-- Across thirty-eight it is a table that ranks on a round whose result nobody
-- has confirmed.
--
-- Widening the delivered function would therefore change a settled tournament
-- authority's answers in two ways at once, to fix a season. This contract
-- adds a season function beside it and moves the two SEASON readers onto it.
-- The tournament path is not touched, and `admin_finalise_predictor_cup_groups`
-- keeps calling exactly what it calls today.
--
-- The rule is contract 105's, applied to the initial phase: BOTH the table
-- points and the tie-break totals come from the windows of the entrant's own
-- SETTLED group fixtures. An unsettled matchday contributes to neither, so the
-- table cannot rank on a round that has not been confirmed.
--
-- ---------------------------------------------------------------------------
-- WHAT THIS DOES NOT DO
-- ---------------------------------------------------------------------------
--
-- It adds no rule. ADR 0014 §5.2's key order — table points, prediction
-- points, exacts, corrects, the mini head-to-head among the players tied on
-- all of those, prediction-point difference, scoreline error, draw number — is
-- carried across unchanged and in the same order. Only the SPAN the middle
-- keys are measured over changes, and only for a league season.
--
-- It creates no table, moves no grant, and settles, progresses and qualifies
-- nothing.

begin;

-- ---------------------------------------------------------------------------
-- The season's initial-phase group table.
--
-- Structurally this is `cup_final_group_tables` with its `window_totals` CTE
-- replaced. Everything downstream of that CTE — `results`, `per_user`,
-- `with_mini` and the final ordering — is carried across so the two functions
-- cannot drift on the tie-break sequence. `tests/database-parity` asserts the
-- ordering clauses are identical rather than trusting this comment; contract
-- 124 learned that lesson by hand-reconstructing a tail and silently replacing
-- a tie-break.
-- ---------------------------------------------------------------------------

create or replace function predictor_internal.cup_season_group_tables(
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
as $function$
  with members as (
    select member.user_id, member.group_id, grp.size, member.draw_number
    from public.bonus_cup_members member
    join public.bonus_cup_groups grp on grp.id = member.group_id
    where member.competition_id = p_competition_id
      and member.phase_kind = 'initial'
  ),
  -- THE ONE CHANGE. The windows an entrant actually played a settled group
  -- fixture in, rather than sequences one to three.
  --
  -- `distinct` matters: a matchday holds one fixture per entrant today, but
  -- nothing in the store forbids two, and summing a window's prediction points
  -- once per fixture would double it. The window's score is a fact about the
  -- entrant's matchweek, not about the fixture it was used to decide.
  played_windows as (
    select distinct member.user_id, fixture.window_id
    from members member
    join public.bonus_cup_fixtures fixture
      on fixture.competition_id = p_competition_id
      and fixture.stage = 'group'
      and member.user_id in (fixture.home_user_id, fixture.away_user_id)
    where predictor_internal.cup_window_settled(fixture.window_id)
  ),
  window_totals as (
    select
      member.user_id,
      coalesce(sum(scores.points), 0)::integer as window_points,
      coalesce(sum(scores.exacts), 0)::integer as exacts,
      coalesce(sum(scores.corrects), 0)::integer as corrects,
      coalesce(sum(scores.scoreline_error), 0)::integer as scoreline_error
    from members member
    left join played_windows played on played.user_id = member.user_id
    left join lateral (
      select * from predictor_internal.cup_window_scores(p_competition_id, played.window_id) s
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
  -- ADR 0014 §5.2 steps 4-5: among players whose steps 0-3 key is identical, a
  -- mini head-to-head of table points then prediction-point difference.
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
$function$;

revoke all on function predictor_internal.cup_season_group_tables(uuid)
  from public, anon, authenticated, service_role;

comment on function predictor_internal.cup_season_group_tables(uuid) is
  'Contract 169. The initial-phase group table for a LEAGUE SEASON Predictor '
  'Championship. ADR 0014 §5.2''s key order is identical to '
  'cup_final_group_tables; the difference is that every key is measured over '
  'the windows of the entrant''s own SETTLED group fixtures rather than over '
  'the tournament''s three matchdays. Not granted to any role: the two season '
  'reads reach it as definers.';

-- ---------------------------------------------------------------------------
-- Which table a competition gets, decided once.
--
-- A function rather than a repeated subquery, because two readers deciding the
-- same thing separately is how they come to disagree — which is the shape of
-- the defect this contract is fixing.
-- ---------------------------------------------------------------------------

create or replace function predictor_internal.cup_is_league_season(
  p_competition_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce((
    select season.kind = 'league_season'
      from public.bonus_competitions competition
      join public.tournaments season on season.id = competition.tournament_id
     where competition.id = p_competition_id
  ), false);
$$;

revoke all on function predictor_internal.cup_is_league_season(uuid)
  from public, anon, authenticated, service_role;

comment on function predictor_internal.cup_is_league_season(uuid) is
  'Contract 169. Whether a Cup competition belongs to a league season. Fails '
  'CLOSED on an unknown competition: false selects the tournament table, which '
  'is the delivered behaviour, so a missing row cannot silently change how an '
  'existing competition is ranked.';


-- ---------------------------------------------------------------------------
-- ONE decision point for both readers.
--
-- Contract 120's read and contract 167's read both want "the initial group
-- table for this competition". Letting each of them choose separately is how
-- two readers of one thing come to disagree — which is the shape of the defect
-- this contract is fixing, so repeating it here would be perverse.
--
-- plpgsql rather than a `union all` filtered on the flag, because a set
-- returned by the branch not taken is work done to be thrown away, and on a
-- hundred-entrant competition that is the whole other table.
-- ---------------------------------------------------------------------------

create or replace function predictor_internal.cup_initial_group_tables(
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
language plpgsql
stable
security definer
set search_path = ''
as $dispatch$
begin
  if predictor_internal.cup_is_league_season(p_competition_id) then
    return query
      select * from predictor_internal.cup_season_group_tables(p_competition_id);
  else
    return query
      select * from predictor_internal.cup_final_group_tables(p_competition_id);
  end if;
end;
$dispatch$;

revoke all on function predictor_internal.cup_initial_group_tables(uuid)
  from public, anon, authenticated, service_role;

comment on function predictor_internal.cup_initial_group_tables(uuid) is
  'Contract 169. The initial-phase group table for a Cup competition, from the '
  'authority that owns it: cup_season_group_tables for a league season, '
  'cup_final_group_tables for a tournament. The single decision point, so two '
  'reads of one table cannot disagree about which span it is measured over.';

commit;

begin;

-- ---------------------------------------------------------------------------
-- Contract 120's read, moved onto the dispatcher.
--
-- Redefined from its committed text in
-- `20260806100000_season_cup_phase_read.sql`. The split branch, the entrancy
-- gate, the non-entrant shape, the emitted keys and their order are carried
-- across unchanged, and `tests/database-parity/seasonCupInitialTableParity.test.ts`
-- asserts that by diff rather than by reading — contract 124 proved that
-- hand-copying the tail of one of these functions and reading it afterwards
-- does not catch a substituted tie-break.
--
-- One key is ADDED: `table_source`, naming which authority produced the table.
-- A surface that wants to say what a table is ranked over must not have to
-- infer it from the competition's kind.
-- ---------------------------------------------------------------------------

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
    select coalesce(
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
    select coalesce(
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
      from predictor_internal.cup_initial_group_tables(p_competition_id) t
     where t.group_id = v_group_id;
  end if;

  return pg_catalog.jsonb_build_object(
    'competition_id', p_competition_id,
    'entered', true,
    'phase_kind', v_phase_kind,
    'table_source', case
                      when v_phase_kind = 'split' then 'split'
                      when predictor_internal.cup_is_league_season(p_competition_id)
                        then 'season_initial'
                      else 'tournament_initial'
                    end,
    'group', pg_catalog.jsonb_build_object(
      'id', v_group.id,
      'ordinal', v_group.ordinal,
      'size', v_group.size,
      'phase_kind', v_group.phase_kind,
      'parent_group_id', v_group.parent_group_id
    ),
    'table', coalesce(v_table, '[]'::jsonb)
  );
end;
$get_season_cup_phase$;

revoke all on function public.get_season_cup_phase(uuid) from public, anon, authenticated;
grant execute on function public.get_season_cup_phase(uuid) to authenticated;

comment on function public.get_season_cup_phase(uuid) is
  'Contract 120, amended by contract 169. The caller''s own Predictor '
  'Championship phase and the table for their own group, taken from the '
  'authority that owns that phase: cup_split_group_tables for a split group '
  'and cup_initial_group_tables otherwise, which is the season table for a '
  'league season and the tournament table for a tournament. Adds no rule and '
  'recomputes nothing. A non-entrant receives entered=false rather than an '
  'exception.';

commit;

begin;

-- ---------------------------------------------------------------------------
-- Contract 167's read, moved onto the same dispatcher.
--
-- Derived from its committed text in `20260811180000_cup_group_stage_read.sql`
-- by substituting the one call, so the group selection, the entrancy gate, the
-- optional single-group argument, the emitted keys and the competition-round
-- derivation are byte-identical to what shipped an hour ago. This is the read
-- the defect above is most visible through: contract 166 draws up to five
-- groups of twenty over a full season, and every one of those tables was
-- ranked on its first three matchdays.
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
                   from predictor_internal.cup_initial_group_tables(p_competition_id) standing
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

comment on function public.get_season_cup_group_stage(uuid, integer) is
  'Contract 167, amended by contract 169. The initial group stage of a '
  'Predictor Championship, for an entrant, one group or all. Every figure '
  'comes from cup_initial_group_tables — the season table for a league season '
  'and the tournament table for a tournament. Recomputes nothing.';

commit;

-- ---------------------------------------------------------------------------
-- What this migration must be true of, checked against the catalogue rather
-- than against this file's own prose.
-- ---------------------------------------------------------------------------

do $assert$
declare
  v_season text := pg_catalog.pg_get_functiondef(
    'predictor_internal.cup_season_group_tables(uuid)'::regprocedure);
  v_tournament text := pg_catalog.pg_get_functiondef(
    'predictor_internal.cup_final_group_tables(uuid)'::regprocedure);
  v_phase text := pg_catalog.pg_get_functiondef(
    'public.get_season_cup_phase(uuid)'::regprocedure);
  v_stage text := pg_catalog.pg_get_functiondef(
    'public.get_season_cup_group_stage(uuid, integer)'::regprocedure);
begin
  -- THE ASSERTION THIS CONTRACT EXISTS FOR. The season table must not carry
  -- the tournament's three-matchday bound in any spelling.
  if v_season ~* 'sequence\s+between' or v_season ~* 'sequence\s*<=?\s*3' then
    raise exception
      'The season group table still bounds its windows by sequence';
  end if;

  -- And the tournament's must still carry it, because leaving it alone is the
  -- point: a settled, production-hosted authority does not change to fix a
  -- season.
  if v_tournament !~* 'sequence\s+between\s+1\s+and\s+3' then
    raise exception
      'The tournament group table no longer bounds windows 1-3; contract 169 '
      'must not have altered it';
  end if;

  -- Neither season reader may reach the tournament table directly any more:
  -- the dispatcher is the only thing entitled to choose.
  if v_phase ~ 'cup_final_group_tables' then
    raise exception 'get_season_cup_phase still calls the tournament table directly';
  end if;

  if v_stage ~ 'cup_final_group_tables' then
    raise exception 'get_season_cup_group_stage still calls the tournament table directly';
  end if;

  if v_phase !~ 'cup_initial_group_tables'
     or v_stage !~ 'cup_initial_group_tables' then
    raise exception 'A season reader does not reach the dispatcher';
  end if;

  -- The split branch is untouched.
  if v_phase !~ 'cup_split_group_tables' then
    raise exception 'get_season_cup_phase lost its split branch';
  end if;

  -- ADR 0014 §5.2's key order must be identical in both initial tables. Read
  -- from the catalogue and compared, because contract 124 established that
  -- reading a hand-copied tail does not catch a substituted tie-break.
  if pg_catalog.substring(v_season from 'order by(.*?)\)::integer as group_rank')
     is distinct from
     pg_catalog.substring(v_tournament from 'order by(.*?)\)::integer as group_rank') then
    raise exception
      'The two initial group tables disagree about the tie-break sequence';
  end if;

  -- The dispatcher decides once. Nothing else may ask the question.
  if v_stage ~ 'cup_is_league_season' then
    raise exception
      'get_season_cup_group_stage decides the season question for itself';
  end if;
end;
$assert$;
