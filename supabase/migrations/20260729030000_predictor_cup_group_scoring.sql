-- Euro 2028 Predictor — Predictor Cup group-stage scoring and tables
--
-- Contract 55 (ADR-0010, stage B7b). Cup matchday scoring per
-- docs/predictor-cup-rules.md §4–§5:
--
--   - a user's Cup points for a window are the raw 5 / 3 / 0 over the
--     window's designated real fixtures — exact regulation scoreline 5
--     (total), correct regulation result 3, jokers never apply;
--   - scorelines come from the user's Original Predictor entry for real
--     group matches and from the shared knockout prediction store for real
--     knockout matches (§1 of competition-structure.md) — regulation time
--     only, extra time and penalties never alter the submitted scoreline;
--   - only officially confirmed results contribute; a head-to-head result
--     exists only once its window has settled (deadline passed, every
--     designated fixture confirmed, any settle instant reached);
--   - §9.3: one submitter vs a complete non-submitter is a walkover (3–0);
--     two non-submitters void the fixture (0–0 table points);
--   - the scoreline-error tie-break value (§5.2.7) charges a missing
--     prediction a sentinel error of 999 per fixture — larger than any
--     submittable error, so a blank can never gain an accuracy advantage;
--   - group tables rank by table points then §5.2 steps 1–3 (window points,
--     exacts, correct results), 6 (prediction-point difference), 7
--     (scoreline error) and 8 (neutral draw number). Steps 4–5 (the mini
--     head-to-head among exactly tied players) are applied at the B7c
--     qualification gate, the only decision they can affect.
--
-- Everything here is DERIVED at read time from stored selections and
-- confirmed results — no Cup scores are stored, so result corrections
-- reprice every table automatically with nothing to recompute.

begin;

-- Per-member scoring facts for one Cup window. Internal only.
create or replace function predictor_internal.cup_window_scores(
  p_competition_id uuid,
  p_window_id uuid
)
returns table (
  user_id uuid,
  points integer,
  exacts integer,
  corrects integer,
  scoreline_error integer,
  submitted boolean
)
language sql
stable
security definer
set search_path = ''
as $$
  with fixtures as (
    select
      m.id as match_id,
      m.round,
      case when m.round = 'group' then m.home_score else m.home_score_90 end as actual_home,
      case when m.round = 'group' then m.away_score else m.away_score_90 end as actual_away,
      m.result_state in ('confirmed', 'corrected') as confirmed
    from public.bonus_window_fixtures f
    join public.matches m on m.id = f.match_id
    where f.window_id = p_window_id
  ),
  member_predictions as (
    select
      member.user_id,
      fixture.match_id,
      fixture.confirmed,
      fixture.actual_home,
      fixture.actual_away,
      coalesce(original.home_score, shared.home_score) as predicted_home,
      coalesce(original.away_score, shared.away_score) as predicted_away
    from public.bonus_cup_members member
    cross join fixtures fixture
    left join public.entries entry
      on fixture.round = 'group'
      and entry.user_id = member.user_id
      and entry.tournament_id = (
        select c.tournament_id from public.bonus_competitions c
        where c.id = p_competition_id
      )
    left join public.match_predictions original
      on original.entry_id = entry.id and original.match_id = fixture.match_id
    left join public.bonus_knockout_predictions shared
      on fixture.round <> 'group'
      and shared.user_id = member.user_id
      and shared.match_id = fixture.match_id
    where member.competition_id = p_competition_id
  )
  select
    mp.user_id,
    coalesce(sum(
      case
        when not mp.confirmed or mp.predicted_home is null then 0
        when mp.predicted_home = mp.actual_home
          and mp.predicted_away = mp.actual_away then 5
        when sign(mp.predicted_home - mp.predicted_away)
          = sign(mp.actual_home - mp.actual_away) then 3
        else 0
      end), 0)::integer as points,
    coalesce(sum(
      case
        when mp.confirmed and mp.predicted_home = mp.actual_home
          and mp.predicted_away = mp.actual_away then 1
        else 0
      end), 0)::integer as exacts,
    coalesce(sum(
      case
        when not mp.confirmed or mp.predicted_home is null then 0
        when mp.predicted_home = mp.actual_home
          and mp.predicted_away = mp.actual_away then 0
        when sign(mp.predicted_home - mp.predicted_away)
          = sign(mp.actual_home - mp.actual_away) then 1
        else 0
      end), 0)::integer as corrects,
    coalesce(sum(
      case
        when not mp.confirmed then 0
        when mp.predicted_home is null then 999
        else abs(mp.predicted_home - mp.actual_home)
          + abs(mp.predicted_away - mp.actual_away)
      end), 0)::integer as scoreline_error,
    bool_or(mp.predicted_home is not null) as submitted
  from member_predictions mp
  group by mp.user_id
$$;

-- Whether a Cup window has settled: deadline passed, every designated real
-- fixture officially confirmed, any settle instant reached. Nothing is ever
-- decided from a provisional or partial round (§10.1).
create or replace function predictor_internal.cup_window_settled(
  p_window_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select
    win.locks_at is not null and now() >= win.locks_at
    and (win.settles_at is null or now() >= win.settles_at)
    and exists (
      select 1 from public.bonus_window_fixtures f where f.window_id = win.id
    )
    and not exists (
      select 1
      from public.bonus_window_fixtures f
      join public.matches m on m.id = f.match_id
      where f.window_id = win.id
        and m.result_state not in ('confirmed', 'corrected')
    )
  from public.bonus_competition_windows win
  where win.id = p_window_id
$$;

revoke all on function predictor_internal.cup_window_scores(uuid, uuid)
  from public, anon, authenticated, service_role;
revoke all on function predictor_internal.cup_window_settled(uuid)
  from public, anon, authenticated, service_role;

-- ---------------------------------------------------------------------------
-- The my-cup read grows scoring: live/settled head-to-head points, results
-- (win/draw/loss, walkover, void) and the ranked group table.
-- ---------------------------------------------------------------------------

create or replace function public.get_my_cup(
  p_tournament_id uuid
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
  v_competition public.bonus_competitions%rowtype;
  v_group_id uuid;
begin
  if v_uid is null then
    raise exception 'Authentication is required'
      using errcode = 'insufficient_privilege';
  end if;

  select * into v_competition
    from public.bonus_competitions competition
    where competition.tournament_id = p_tournament_id
      and competition.game_key = 'predictor_cup'
      and competition.published;

  if not found then
    raise exception 'The Predictor Cup is not available for this tournament'
      using errcode = 'no_data_found';
  end if;

  select member.group_id into v_group_id
    from public.bonus_cup_members member
    where member.competition_id = v_competition.id
      and member.user_id = v_uid;

  return jsonb_build_object(
    'server_now', now(),
    'competition_id', v_competition.id,
    'registration_closes_at', v_competition.registration_closes_at,
    'draw_completed_at', v_competition.draw_completed_at,
    'entrant', (
      select jsonb_build_object(
        'joined_at', entrant.joined_at,
        'outcome', entrant.outcome
      )
      from public.bonus_competition_entrants entrant
      where entrant.competition_id = v_competition.id
        and entrant.user_id = v_uid
    ),
    'entrant_count', (
      select count(*)::integer
      from public.bonus_competition_entrants entrant
      where entrant.competition_id = v_competition.id
    ),
    'group_count', (
      select count(*)::integer
      from public.bonus_cup_groups grp
      where grp.competition_id = v_competition.id
    ),
    'my_group', case when v_group_id is null then null else (
      select jsonb_build_object(
        'ordinal', grp.ordinal,
        'size', grp.size,
        'members', (
          select jsonb_agg(
            jsonb_build_object(
              'user_id', member.user_id,
              'display_name', coalesce(profile.display_name, 'Player'),
              'draw_number', member.draw_number
            )
            order by member.draw_number
          )
          from public.bonus_cup_members member
          left join public.profiles profile on profile.id = member.user_id
          where member.group_id = grp.id
        ),
        'standings', (
          with member_windows as (
            select
              member.user_id,
              member.draw_number,
              coalesce(profile.display_name, 'Player') as display_name,
              coalesce(sum(scores.points), 0)::integer as window_points,
              coalesce(sum(scores.exacts), 0)::integer as exacts,
              coalesce(sum(scores.corrects), 0)::integer as corrects,
              coalesce(sum(scores.scoreline_error), 0)::integer as scoreline_error
            from public.bonus_cup_members member
            left join public.profiles profile on profile.id = member.user_id
            left join public.bonus_competition_windows win
              on win.competition_id = v_competition.id
              and win.sequence between 1 and 3
            left join lateral (
              select * from predictor_internal.cup_window_scores(v_competition.id, win.id) s
              where s.user_id = member.user_id
            ) scores on true
            where member.group_id = v_group_id
            group by member.user_id, member.draw_number, profile.display_name
          ),
          settled_results as (
            select
              fixture.home_user_id,
              fixture.away_user_id,
              home_score.points as home_points,
              away_score.points as away_points,
              home_score.submitted as home_submitted,
              away_score.submitted as away_submitted
            from public.bonus_cup_fixtures fixture
            join lateral (
              select * from predictor_internal.cup_window_scores(v_competition.id, fixture.window_id) s
              where s.user_id = fixture.home_user_id
            ) home_score on true
            join lateral (
              select * from predictor_internal.cup_window_scores(v_competition.id, fixture.window_id) s
              where s.user_id = fixture.away_user_id
            ) away_score on true
            where fixture.group_id = v_group_id
              and predictor_internal.cup_window_settled(fixture.window_id)
          ),
          per_user as (
            select
              side.user_id,
              count(*)::integer as played,
              count(*) filter (where side.outcome = 'win')::integer as wins,
              count(*) filter (where side.outcome = 'draw')::integer as draws,
              count(*) filter (where side.outcome = 'loss')::integer as losses,
              coalesce(sum(side.points_for), 0)::integer as points_for,
              coalesce(sum(side.points_against), 0)::integer as points_against,
              coalesce(sum(side.table_points), 0)::integer as table_points
            from (
              select r.home_user_id as user_id,
                case
                  when r.home_submitted and not r.away_submitted then 'win'
                  when not r.home_submitted and r.away_submitted then 'loss'
                  when not r.home_submitted and not r.away_submitted then 'void'
                  when r.home_points > r.away_points then 'win'
                  when r.home_points < r.away_points then 'loss'
                  else 'draw'
                end as outcome,
                r.home_points as points_for,
                r.away_points as points_against,
                case
                  when r.home_submitted and not r.away_submitted then 3
                  when not r.home_submitted then 0
                  when r.home_points > r.away_points then 3
                  when r.home_points < r.away_points then 0
                  else 1
                end as table_points
              from settled_results r
              union all
              select r.away_user_id,
                case
                  when r.away_submitted and not r.home_submitted then 'win'
                  when not r.away_submitted and r.home_submitted then 'loss'
                  when not r.away_submitted and not r.home_submitted then 'void'
                  when r.away_points > r.home_points then 'win'
                  when r.away_points < r.home_points then 'loss'
                  else 'draw'
                end,
                r.away_points,
                r.home_points,
                case
                  when r.away_submitted and not r.home_submitted then 3
                  when not r.away_submitted then 0
                  when r.away_points > r.home_points then 3
                  when r.away_points < r.home_points then 0
                  else 1
                end
              from settled_results r
            ) side
            group by side.user_id
          )
          select jsonb_agg(
            jsonb_build_object(
              'user_id', ranked.user_id,
              'display_name', ranked.display_name,
              'played', ranked.played,
              'wins', ranked.wins,
              'draws', ranked.draws,
              'losses', ranked.losses,
              'points_for', ranked.points_for,
              'points_against', ranked.points_against,
              'table_points', ranked.table_points,
              'window_points', ranked.window_points,
              'position', ranked.position
            )
            order by ranked.position
          )
          from (
            select
              mw.user_id,
              mw.display_name,
              coalesce(pu.played, 0) as played,
              coalesce(pu.wins, 0) as wins,
              coalesce(pu.draws, 0) as draws,
              coalesce(pu.losses, 0) as losses,
              coalesce(pu.points_for, 0) as points_for,
              coalesce(pu.points_against, 0) as points_against,
              coalesce(pu.table_points, 0) as table_points,
              mw.window_points,
              row_number() over (
                order by
                  coalesce(pu.table_points, 0) desc,
                  mw.window_points desc,
                  mw.exacts desc,
                  mw.corrects desc,
                  coalesce(pu.points_for, 0) - coalesce(pu.points_against, 0) desc,
                  mw.scoreline_error asc,
                  mw.draw_number asc
              )::integer as position
            from member_windows mw
            left join per_user pu on pu.user_id = mw.user_id
          ) ranked
        )
      )
      from public.bonus_cup_groups grp
      where grp.id = v_group_id
    ) end,
    'my_fixtures', coalesce(
      (
        select jsonb_agg(
          jsonb_build_object(
            'fixture_id', fixture.id,
            'stage', fixture.stage,
            'matchday', fixture.matchday,
            'window_label', win.label,
            'window_opens_at', win.opens_at,
            'window_locks_at', win.locks_at,
            'opponent', jsonb_build_object(
              'user_id', opponent.user_id,
              'display_name', coalesce(opponent_profile.display_name, 'Player')
            ),
            'my_points', my_score.points,
            'opponent_points', opponent_score.points,
            'status', case
              when predictor_internal.cup_window_settled(fixture.window_id)
                then 'settled' else 'pending' end,
            'result', case
              when not predictor_internal.cup_window_settled(fixture.window_id) then null
              when my_score.submitted and not opponent_score.submitted then 'walkover_win'
              when not my_score.submitted and opponent_score.submitted then 'walkover_loss'
              when not my_score.submitted and not opponent_score.submitted then 'void'
              when my_score.points > opponent_score.points then 'win'
              when my_score.points < opponent_score.points then 'loss'
              else 'draw'
            end
          )
          order by fixture.matchday nulls last, fixture.created_at
        )
        from public.bonus_cup_fixtures fixture
        join public.bonus_competition_windows win on win.id = fixture.window_id
        cross join lateral (
          select case when fixture.home_user_id = v_uid
            then fixture.away_user_id else fixture.home_user_id end as user_id
        ) opponent
        left join public.profiles opponent_profile
          on opponent_profile.id = opponent.user_id
        left join lateral (
          select * from predictor_internal.cup_window_scores(v_competition.id, fixture.window_id) s
          where s.user_id = v_uid
        ) my_score on true
        left join lateral (
          select * from predictor_internal.cup_window_scores(v_competition.id, fixture.window_id) s
          where s.user_id = opponent.user_id
        ) opponent_score on true
        where fixture.competition_id = v_competition.id
          and v_uid in (fixture.home_user_id, fixture.away_user_id)
      ),
      '[]'::jsonb
    )
  );
end;
$$;

revoke all on function public.get_my_cup(uuid)
  from public, anon, authenticated, service_role;
grant execute on function public.get_my_cup(uuid)
  to authenticated, service_role;

commit;
