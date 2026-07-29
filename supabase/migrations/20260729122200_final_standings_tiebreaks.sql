-- Euro 2028 Predictor — final standings tie-break activation
--
-- Contract 62. Keeps live standings on shared total-point ranks until every
-- tournament fixture is confirmed. Once the tournament is complete, overall
-- and private-league reads apply the five approved final tie-breakers:
-- exact scores, correct outcomes, correct knockout teams, correct champion,
-- then closest predicted group-stage goals total.

begin;

create or replace function predictor_internal.standing_metrics(
  p_tournament_id uuid
)
returns table (
  entry_id uuid,
  user_id uuid,
  total_points integer,
  exact_scores integer,
  correct_outcomes integer,
  correct_knockout_teams integer,
  correct_champion boolean,
  total_goals_diff integer
)
language sql
stable
security definer
set search_path = ''
as $$
  with submitted_entries as (
    select entry.id, entry.user_id
    from public.entries entry
    where entry.tournament_id = p_tournament_id
      and entry.submitted_at is not null
  ),
  totals as (
    select
      entry.id as entry_id,
      coalesce(sum(event.points), 0)::integer as total_points
    from submitted_entries entry
    left join public.score_events event on event.entry_id = entry.id
    group by entry.id
  ),
  group_accuracy as (
    select
      entry.id as entry_id,
      count(*) filter (
        where match.result_state in ('confirmed', 'corrected')
          and prediction.home_score = match.home_score
          and prediction.away_score = match.away_score
      )::integer as exact_scores,
      count(*) filter (
        where match.result_state in ('confirmed', 'corrected')
          and sign(prediction.home_score - prediction.away_score)
              = sign(match.home_score - match.away_score)
      )::integer as correct_outcomes,
      sum(prediction.home_score + prediction.away_score)::integer as predicted_group_goals
    from submitted_entries entry
    left join public.match_predictions prediction on prediction.entry_id = entry.id
    left join public.matches match
      on match.id = prediction.match_id
     and match.tournament_id = p_tournament_id
     and match.round = 'group'
    group by entry.id
  ),
  knockout_accuracy as (
    select
      entry.id as entry_id,
      count(*) filter (
        where event.category = 'knockout' and event.points > 0
      )::integer as correct_knockout_teams,
      bool_or(
        event.category = 'knockout' and event.points = 110
      ) as correct_champion
    from submitted_entries entry
    left join public.score_events event on event.entry_id = entry.id
    group by entry.id
  ),
  actual_group_goals as (
    select
      case
        when count(*) > 0
         and count(*) = count(*) filter (
           where match.result_state in ('confirmed', 'corrected')
         )
        then sum(match.home_score + match.away_score)::integer
        else null::integer
      end as goals
    from public.matches match
    where match.tournament_id = p_tournament_id
      and match.round = 'group'
  )
  select
    entry.id,
    entry.user_id,
    total.total_points,
    coalesce(accuracy.exact_scores, 0),
    coalesce(accuracy.correct_outcomes, 0),
    coalesce(knockout.correct_knockout_teams, 0),
    coalesce(knockout.correct_champion, false),
    case
      when actual.goals is null or accuracy.predicted_group_goals is null then null
      else abs(accuracy.predicted_group_goals - actual.goals)
    end::integer
  from submitted_entries entry
  join totals total on total.entry_id = entry.id
  left join group_accuracy accuracy on accuracy.entry_id = entry.id
  left join knockout_accuracy knockout on knockout.entry_id = entry.id
  cross join actual_group_goals actual;
$$;

revoke all on function predictor_internal.standing_metrics(uuid)
  from public, anon, authenticated, service_role;

create or replace function public.get_leaderboard(
  p_tournament_id uuid,
  p_limit integer default 50,
  p_after text default null
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_limit integer;
  v_cursor jsonb;
  v_after_position integer;
  v_cursor_final boolean;
  v_final boolean;
  v_result jsonb;
begin
  if p_tournament_id is null then
    raise exception 'Tournament is required' using errcode = '22023';
  end if;

  if p_limit is null then
    v_limit := 50;
  elsif p_limit < 1 then
    raise exception 'Leaderboard page size must be at least 1' using errcode = '22023';
  else
    v_limit := least(p_limit, 100);
  end if;

  select count(*) > 0
     and count(*) = count(*) filter (
       where match.result_state in ('confirmed', 'corrected')
     )
    into v_final
  from public.matches match
  where match.tournament_id = p_tournament_id;

  if p_after is not null and btrim(p_after) <> '' then
    begin
      v_cursor := convert_from(decode(p_after, 'hex'), 'UTF8')::jsonb;
      v_after_position := (v_cursor ->> 'position')::integer;
      v_cursor_final := (v_cursor ->> 'final')::boolean;
    exception when others then
      raise exception 'Invalid leaderboard cursor' using errcode = '22023';
    end;

    if v_after_position is null
       or v_after_position < 1
       or v_cursor_final is null
       or v_cursor_final is distinct from v_final
    then
      raise exception 'Invalid leaderboard cursor' using errcode = '22023';
    end if;
  end if;

  with base as (
    select
      metric.entry_id,
      metric.user_id,
      profile.display_name,
      lower(profile.display_name) collate "C" as sort_name,
      md5(metric.entry_id::text) as entry_key,
      metric.total_points,
      metric.exact_scores,
      metric.correct_outcomes,
      metric.correct_knockout_teams,
      metric.correct_champion,
      metric.total_goals_diff
    from predictor_internal.standing_metrics(p_tournament_id) metric
    join public.profiles profile on profile.id = metric.user_id
  ),
  summary as (
    select
      count(*)::integer as total_count,
      count(distinct base.total_points)::integer as distinct_totals
    from base
  ),
  ranked as (
    select
      base.*,
      summary.total_count,
      summary.distinct_totals,
      row_number() over (
        order by
          base.total_points desc,
          case when v_final then base.exact_scores end desc nulls last,
          case when v_final then base.correct_outcomes end desc nulls last,
          case when v_final then base.correct_knockout_teams end desc nulls last,
          case when v_final then base.correct_champion::integer end desc nulls last,
          case when v_final then base.total_goals_diff end asc nulls last,
          base.sort_name,
          base.display_name collate "C",
          base.entry_key
      )::integer as position,
      rank() over (
        order by
          base.total_points desc,
          case when v_final then base.exact_scores end desc nulls last,
          case when v_final then base.correct_outcomes end desc nulls last,
          case when v_final then base.correct_knockout_teams end desc nulls last,
          case when v_final then base.correct_champion::integer end desc nulls last,
          case when v_final then base.total_goals_diff end asc nulls last
      )::integer as standard_rank,
      count(*) over (
        partition by
          base.total_points,
          case when v_final then base.exact_scores end,
          case when v_final then base.correct_outcomes end,
          case when v_final then base.correct_knockout_teams end,
          case when v_final then base.correct_champion end,
          case when v_final then base.total_goals_diff end
      )::integer as same_rank_count
    from base
    cross join summary
  ),
  candidates as (
    select ranked.*
    from ranked
    where v_after_position is null or ranked.position > v_after_position
    order by ranked.position
    limit v_limit + 1
  ),
  page_rows as (
    select candidate.*
    from candidates candidate
    order by candidate.position
    limit v_limit
  )
  select jsonb_build_object(
    'rows', coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'displayName', row.display_name,
          'totalPoints', row.total_points,
          'rank', case
            when not v_final and row.distinct_totals <= 1 then null
            else row.standard_rank
          end,
          'tied', row.same_rank_count > 1
            and (v_final or row.distinct_totals > 1),
          'position', row.position,
          'isYou', row.user_id = (select auth.uid())
        )
        order by row.position
      )
      from page_rows row
    ), '[]'::jsonb),
    'totalCount', summary.total_count,
    'pageSize', v_limit,
    'hasMore', (select count(*) from candidates) > v_limit,
    'nextCursor', case
      when (select count(*) from candidates) > v_limit then (
        select encode(
          convert_to(
            jsonb_build_object(
              'position', row.position,
              'final', v_final
            )::text,
            'UTF8'
          ),
          'hex'
        )
        from page_rows row
        order by row.position desc
        limit 1
      )
      else null
    end,
    'finalStandings', v_final,
    'you', (
      select jsonb_build_object(
        'displayName', row.display_name,
        'totalPoints', row.total_points,
        'rank', case
          when not v_final and row.distinct_totals <= 1 then null
          else row.standard_rank
        end,
        'tied', row.same_rank_count > 1
          and (v_final or row.distinct_totals > 1),
        'position', row.position
      )
      from ranked row
      where row.user_id = (select auth.uid())
      limit 1
    )
  )
    into v_result
  from summary;

  return v_result;
end;
$$;

create or replace function public.get_league_members(
  p_league_id uuid,
  p_limit integer default 50,
  p_after text default null
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
  v_tournament uuid;
  v_limit integer;
  v_cursor jsonb;
  v_after_position integer;
  v_cursor_final boolean;
  v_final boolean;
  v_result jsonb;
begin
  if p_league_id is null then
    raise exception 'League is required' using errcode = '22023';
  end if;

  if v_uid is null then
    raise exception 'Not authenticated' using errcode = 'insufficient_privilege';
  end if;

  if not exists (
    select 1
    from public.league_members membership
    where membership.league_id = p_league_id
      and membership.user_id = v_uid
  ) then
    raise exception 'Not a member of this league' using errcode = 'insufficient_privilege';
  end if;

  select league.tournament_id
    into v_tournament
  from public.leagues league
  where league.id = p_league_id;

  if v_tournament is null then
    raise exception 'League not found' using errcode = 'no_data_found';
  end if;

  if p_limit is null then
    v_limit := 50;
  elsif p_limit < 1 then
    raise exception 'League standings page size must be at least 1' using errcode = '22023';
  else
    v_limit := least(p_limit, 100);
  end if;

  select count(*) > 0
     and count(*) = count(*) filter (
       where match.result_state in ('confirmed', 'corrected')
     )
    into v_final
  from public.matches match
  where match.tournament_id = v_tournament;

  if p_after is not null and btrim(p_after) <> '' then
    begin
      v_cursor := convert_from(decode(p_after, 'hex'), 'UTF8')::jsonb;
      v_after_position := (v_cursor ->> 'position')::integer;
      v_cursor_final := (v_cursor ->> 'final')::boolean;
    exception when others then
      raise exception 'Invalid league standings cursor' using errcode = '22023';
    end;

    if v_after_position is null
       or v_after_position < 1
       or v_cursor_final is null
       or v_cursor_final is distinct from v_final
    then
      raise exception 'Invalid league standings cursor' using errcode = '22023';
    end if;
  end if;

  with prediction_counts as (
    select prediction.entry_id, count(*)::integer as predicted_count
    from public.match_predictions prediction
    group by prediction.entry_id
  ),
  base as (
    select
      membership.user_id,
      profile.display_name,
      lower(profile.display_name) collate "C" as sort_name,
      md5(membership.user_id::text) as member_key,
      coalesce(metric.total_points, 0)::integer as total_points,
      coalesce(metric.exact_scores, 0)::integer as exact_scores,
      coalesce(metric.correct_outcomes, 0)::integer as correct_outcomes,
      coalesce(metric.correct_knockout_teams, 0)::integer as correct_knockout_teams,
      coalesce(metric.correct_champion, false) as correct_champion,
      metric.total_goals_diff,
      (membership.role = 'owner') as is_owner,
      (entry.submitted_at is not null) as has_entry,
      coalesce(predictions.predicted_count, 0)::integer as predicted_count,
      membership.joined_at
    from public.league_members membership
    join public.profiles profile on profile.id = membership.user_id
    left join public.entries entry
      on entry.user_id = membership.user_id
     and entry.tournament_id = v_tournament
    left join predictor_internal.standing_metrics(v_tournament) metric
      on metric.user_id = membership.user_id
    left join prediction_counts predictions on predictions.entry_id = entry.id
    where membership.league_id = p_league_id
  ),
  summary as (
    select
      count(*)::integer as total_count,
      count(distinct member.total_points)::integer as distinct_totals
    from base member
  ),
  ranked as (
    select
      member.*,
      summary.total_count,
      summary.distinct_totals,
      row_number() over (
        order by
          member.total_points desc,
          case when v_final then member.exact_scores end desc nulls last,
          case when v_final then member.correct_outcomes end desc nulls last,
          case when v_final then member.correct_knockout_teams end desc nulls last,
          case when v_final then member.correct_champion::integer end desc nulls last,
          case when v_final then member.total_goals_diff end asc nulls last,
          member.sort_name,
          member.display_name collate "C",
          member.member_key
      )::integer as position,
      rank() over (
        order by
          member.total_points desc,
          case when v_final then member.exact_scores end desc nulls last,
          case when v_final then member.correct_outcomes end desc nulls last,
          case when v_final then member.correct_knockout_teams end desc nulls last,
          case when v_final then member.correct_champion::integer end desc nulls last,
          case when v_final then member.total_goals_diff end asc nulls last
      )::integer as standard_rank,
      count(*) over (
        partition by
          member.total_points,
          case when v_final then member.exact_scores end,
          case when v_final then member.correct_outcomes end,
          case when v_final then member.correct_knockout_teams end,
          case when v_final then member.correct_champion end,
          case when v_final then member.total_goals_diff end
      )::integer as same_rank_count
    from base member
    cross join summary
  ),
  candidates as (
    select ranked_member.*
    from ranked ranked_member
    where v_after_position is null or ranked_member.position > v_after_position
    order by ranked_member.position
    limit v_limit + 1
  ),
  page_rows as (
    select candidate.*
    from candidates candidate
    order by candidate.position
    limit v_limit
  )
  select jsonb_build_object(
    'rows', coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'userId', row.user_id,
          'displayName', row.display_name,
          'totalPoints', row.total_points,
          'rank', case
            when not v_final and row.distinct_totals <= 1 then null
            else row.standard_rank
          end,
          'tied', row.same_rank_count > 1
            and (v_final or row.distinct_totals > 1),
          'position', row.position,
          'isYou', row.user_id = v_uid,
          'isOwner', row.is_owner,
          'hasEntry', row.has_entry,
          'predictedCount', row.predicted_count,
          'joinedAt', row.joined_at
        )
        order by row.position
      )
      from page_rows row
    ), '[]'::jsonb),
    'totalCount', summary.total_count,
    'pageSize', v_limit,
    'hasMore', (select count(*) from candidates) > v_limit,
    'nextCursor', case
      when (select count(*) from candidates) > v_limit then (
        select encode(
          convert_to(
            jsonb_build_object(
              'position', row.position,
              'final', v_final
            )::text,
            'UTF8'
          ),
          'hex'
        )
        from page_rows row
        order by row.position desc
        limit 1
      )
      else null
    end,
    'finalStandings', v_final,
    'you', (
      select jsonb_build_object(
        'userId', row.user_id,
        'displayName', row.display_name,
        'totalPoints', row.total_points,
        'rank', case
          when not v_final and row.distinct_totals <= 1 then null
          else row.standard_rank
        end,
        'tied', row.same_rank_count > 1
          and (v_final or row.distinct_totals > 1),
        'position', row.position,
        'isOwner', row.is_owner,
        'hasEntry', row.has_entry,
        'predictedCount', row.predicted_count,
        'joinedAt', row.joined_at
      )
      from ranked row
      where row.user_id = v_uid
      limit 1
    )
  )
    into v_result
  from summary;

  return v_result;
end;
$$;

commit;
