-- Pure PostgreSQL implementation of the predicted group-order contract.
--
-- Input and output are JSONB so this layer remains independent of entries,
-- profiles, RLS and hosted tournament data. The functions are intentionally
-- private: no client role receives schema usage or function execution.

create or replace function predictor_internal.same_team_members(
  p_left jsonb,
  p_right jsonb
)
returns boolean
language sql
immutable
set search_path = ''
as $$
  with left_ids as (
    select value #>> '{}' as team_id
    from jsonb_array_elements(
      case when jsonb_typeof(p_left) = 'array' then p_left else '[]'::jsonb end
    )
  ),
  right_ids as (
    select value #>> '{}' as team_id
    from jsonb_array_elements(
      case when jsonb_typeof(p_right) = 'array' then p_right else '[]'::jsonb end
    )
  )
  select
    jsonb_typeof(p_left) = 'array'
    and jsonb_typeof(p_right) = 'array'
    and (select count(*) from left_ids) = (select count(distinct team_id) from left_ids)
    and (select count(*) from right_ids) = (select count(distinct team_id) from right_ids)
    and (select count(*) from left_ids) = (select count(*) from right_ids)
    and not exists (
      (select team_id from left_ids except select team_id from right_ids)
      union all
      (select team_id from right_ids except select team_id from left_ids)
    );
$$;

create or replace function predictor_internal.calculate_group_table(
  p_team_ids jsonb,
  p_matches jsonb
)
returns jsonb
language sql
immutable
set search_path = ''
as $$
  with teams as (
    select value #>> '{}' as team_id, ordinality as input_order
    from jsonb_array_elements(
      case when jsonb_typeof(p_team_ids) = 'array' then p_team_ids else '[]'::jsonb end
    ) with ordinality
  ),
  raw_matches as (
    select
      match_value ->> 0 as home_team_id,
      match_value ->> 1 as away_team_id,
      (match_value ->> 2)::integer as home_score,
      (match_value ->> 3)::integer as away_score
    from jsonb_array_elements(
      case when jsonb_typeof(p_matches) = 'array' then p_matches else '[]'::jsonb end
    ) as matches(match_value)
    where jsonb_typeof(match_value) = 'array'
      and jsonb_array_length(match_value) = 4
      and (match_value ->> 2) ~ '^[0-9]+$'
      and (match_value ->> 3) ~ '^[0-9]+$'
  ),
  valid_matches as (
    select match.*
    from raw_matches match
    join teams home on home.team_id = match.home_team_id
    join teams away on away.team_id = match.away_team_id
    where match.home_team_id <> match.away_team_id
  ),
  events as (
    select
      home_team_id as team_id,
      home_score as goals_for,
      away_score as goals_against,
      case when home_score > away_score then 1 else 0 end as won,
      case when home_score = away_score then 1 else 0 end as drawn,
      case when home_score < away_score then 1 else 0 end as lost,
      case when home_score > away_score then 3 when home_score = away_score then 1 else 0 end as points
    from valid_matches
    union all
    select
      away_team_id,
      away_score,
      home_score,
      case when away_score > home_score then 1 else 0 end,
      case when away_score = home_score then 1 else 0 end,
      case when away_score < home_score then 1 else 0 end,
      case when away_score > home_score then 3 when away_score = home_score then 1 else 0 end
    from valid_matches
  ),
  totals as (
    select
      team_id,
      count(*)::integer as played,
      sum(won)::integer as won,
      sum(drawn)::integer as drawn,
      sum(lost)::integer as lost,
      sum(goals_for)::integer as goals_for,
      sum(goals_against)::integer as goals_against,
      sum(points)::integer as points
    from events
    group by team_id
  )
  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'teamId', teams.team_id,
        'played', coalesce(totals.played, 0),
        'won', coalesce(totals.won, 0),
        'drawn', coalesce(totals.drawn, 0),
        'lost', coalesce(totals.lost, 0),
        'goalsFor', coalesce(totals.goals_for, 0),
        'goalsAgainst', coalesce(totals.goals_against, 0),
        'goalDifference', coalesce(totals.goals_for, 0) - coalesce(totals.goals_against, 0),
        'points', coalesce(totals.points, 0)
      )
      order by teams.input_order
    ),
    '[]'::jsonb
  )
  from teams
  left join totals using (team_id);
$$;

create or replace function predictor_internal.bucket_teams(
  p_team_ids jsonb,
  p_table jsonb,
  p_fields jsonb
)
returns jsonb
language sql
immutable
set search_path = ''
as $$
  with wanted as (
    select value #>> '{}' as team_id, ordinality as input_order
    from jsonb_array_elements(p_team_ids) with ordinality
  ),
  table_rows as (
    select value as standing
    from jsonb_array_elements(p_table)
  ),
  scored as (
    select
      wanted.team_id,
      wanted.input_order,
      coalesce((table_rows.standing ->> (p_fields ->> 0))::integer, 0) as metric_1,
      case when jsonb_array_length(p_fields) > 1
        then coalesce((table_rows.standing ->> (p_fields ->> 1))::integer, 0)
        else 0
      end as metric_2,
      case when jsonb_array_length(p_fields) > 2
        then coalesce((table_rows.standing ->> (p_fields ->> 2))::integer, 0)
        else 0
      end as metric_3
    from wanted
    join table_rows on table_rows.standing ->> 'teamId' = wanted.team_id
  ),
  grouped as (
    select
      metric_1,
      metric_2,
      metric_3,
      jsonb_agg(to_jsonb(team_id) order by input_order) as bucket
    from scored
    group by metric_1, metric_2, metric_3
  )
  select coalesce(
    jsonb_agg(bucket order by metric_1 desc, metric_2 desc, metric_3 desc),
    '[]'::jsonb
  )
  from grouped;
$$;

create or replace function predictor_internal.resolve_cluster(
  p_team_ids jsonb,
  p_matches jsonb,
  p_full_table jsonb
)
returns jsonb
language plpgsql
immutable
set search_path = ''
as $$
declare
  v_head_to_head jsonb;
  v_buckets jsonb;
  v_bucket jsonb;
  v_blocks jsonb := '[]'::jsonb;
begin
  if jsonb_array_length(p_team_ids) = 1 then
    return jsonb_build_array(
      jsonb_build_object('teamIds', p_team_ids, 'resolved', true)
    );
  end if;

  v_head_to_head := predictor_internal.calculate_group_table(p_team_ids, p_matches);
  v_buckets := predictor_internal.bucket_teams(
    p_team_ids,
    v_head_to_head,
    '["points", "goalDifference", "goalsFor"]'::jsonb
  );

  if jsonb_array_length(v_buckets) > 1 then
    for v_bucket in select value from jsonb_array_elements(v_buckets)
    loop
      v_blocks := v_blocks || predictor_internal.resolve_cluster(
        v_bucket,
        p_matches,
        p_full_table
      );
    end loop;
    return v_blocks;
  end if;

  v_buckets := predictor_internal.bucket_teams(
    p_team_ids,
    p_full_table,
    '["goalDifference", "goalsFor"]'::jsonb
  );

  if jsonb_array_length(v_buckets) > 1 then
    for v_bucket in select value from jsonb_array_elements(v_buckets)
    loop
      v_blocks := v_blocks || jsonb_build_array(
        jsonb_build_object(
          'teamIds', v_bucket,
          'resolved', jsonb_array_length(v_bucket) = 1
        )
      );
    end loop;
    return v_blocks;
  end if;

  return jsonb_build_array(
    jsonb_build_object('teamIds', p_team_ids, 'resolved', false)
  );
end;
$$;

create or replace function predictor_internal.resolved_order_for(
  p_resolutions jsonb,
  p_tied_team_ids jsonb
)
returns jsonb
language plpgsql
immutable
set search_path = ''
as $$
declare
  v_candidate jsonb;
begin
  if jsonb_typeof(p_resolutions) <> 'array'
     or not predictor_internal.same_team_members(p_tied_team_ids, p_tied_team_ids)
  then
    return null;
  end if;

  for v_candidate in select value from jsonb_array_elements(p_resolutions)
  loop
    if jsonb_typeof(v_candidate) <> 'object' then
      continue;
    end if;

    if predictor_internal.same_team_members(v_candidate -> 'teamIds', p_tied_team_ids)
       and predictor_internal.same_team_members(v_candidate -> 'order', p_tied_team_ids)
    then
      return v_candidate -> 'order';
    end if;
  end loop;

  return null;
end;
$$;

create or replace function predictor_internal.resolve_predicted_group_order(
  p_team_ids jsonb,
  p_matches jsonb,
  p_resolutions jsonb default '[]'::jsonb
)
returns jsonb
language plpgsql
immutable
set search_path = ''
as $$
declare
  v_full_table jsonb;
  v_point_buckets jsonb;
  v_bucket jsonb;
  v_blocks jsonb := '[]'::jsonb;
  v_resolved_blocks jsonb := '[]'::jsonb;
  v_block jsonb;
  v_order jsonb;
  v_team_id text;
  v_standing jsonb;
  v_standings jsonb := '[]'::jsonb;
  v_unresolved_groups jsonb := '[]'::jsonb;
  v_position integer := 1;
  v_rank integer;
  v_unresolved boolean;
begin
  if jsonb_typeof(p_team_ids) <> 'array'
     or jsonb_array_length(p_team_ids) <> 4
     or not predictor_internal.same_team_members(p_team_ids, p_team_ids)
  then
    raise exception 'teamIds must contain exactly four unique team IDs'
      using errcode = '22023';
  end if;

  if jsonb_typeof(p_matches) <> 'array' then
    raise exception 'matches must be an array' using errcode = '22023';
  end if;

  v_full_table := predictor_internal.calculate_group_table(p_team_ids, p_matches);
  v_point_buckets := predictor_internal.bucket_teams(
    p_team_ids,
    v_full_table,
    '["points"]'::jsonb
  );

  for v_bucket in select value from jsonb_array_elements(v_point_buckets)
  loop
    v_blocks := v_blocks || predictor_internal.resolve_cluster(
      v_bucket,
      p_matches,
      v_full_table
    );
  end loop;

  for v_block in select value from jsonb_array_elements(v_blocks)
  loop
    if not coalesce((v_block ->> 'resolved')::boolean, false)
       and jsonb_array_length(v_block -> 'teamIds') > 1
    then
      v_order := predictor_internal.resolved_order_for(
        p_resolutions,
        v_block -> 'teamIds'
      );

      if v_order is not null then
        for v_team_id in select value #>> '{}' from jsonb_array_elements(v_order)
        loop
          v_resolved_blocks := v_resolved_blocks || jsonb_build_array(
            jsonb_build_object(
              'teamIds', jsonb_build_array(v_team_id),
              'resolved', true
            )
          );
        end loop;
        continue;
      end if;
    end if;

    v_resolved_blocks := v_resolved_blocks || jsonb_build_array(v_block);
  end loop;

  for v_block in select value from jsonb_array_elements(v_resolved_blocks)
  loop
    v_unresolved := not coalesce((v_block ->> 'resolved')::boolean, false)
      and jsonb_array_length(v_block -> 'teamIds') > 1;
    v_rank := v_position;

    if v_unresolved then
      v_unresolved_groups := v_unresolved_groups || jsonb_build_array(v_block -> 'teamIds');
    end if;

    for v_team_id in
      select value #>> '{}' from jsonb_array_elements(v_block -> 'teamIds')
    loop
      select value
      into v_standing
      from jsonb_array_elements(v_full_table)
      where value ->> 'teamId' = v_team_id
      limit 1;

      v_standings := v_standings || jsonb_build_array(
        v_standing || jsonb_build_object(
          'rank', v_rank,
          'tiedUnresolved', v_unresolved
        )
      );
      v_position := v_position + 1;
    end loop;
  end loop;

  return jsonb_build_object(
    'standings', v_standings,
    'unresolvedGroups', v_unresolved_groups
  );
end;
$$;

revoke all on function predictor_internal.same_team_members(jsonb, jsonb)
  from public, anon, authenticated;
revoke all on function predictor_internal.calculate_group_table(jsonb, jsonb)
  from public, anon, authenticated;
revoke all on function predictor_internal.bucket_teams(jsonb, jsonb, jsonb)
  from public, anon, authenticated;
revoke all on function predictor_internal.resolve_cluster(jsonb, jsonb, jsonb)
  from public, anon, authenticated;
revoke all on function predictor_internal.resolved_order_for(jsonb, jsonb)
  from public, anon, authenticated;
revoke all on function predictor_internal.resolve_predicted_group_order(jsonb, jsonb, jsonb)
  from public, anon, authenticated;
