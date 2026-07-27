begin;

create or replace function predictor_internal.actual_third_place_ranking(
  p_tournament_id uuid
)
returns table (
  group_letter text,
  team_id uuid,
  points integer,
  goal_difference integer,
  goals_for integer,
  wins integer,
  tie_key text,
  higher_count integer,
  block_size integer,
  unresolved boolean
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_group_count integer;
  v_resolved_group_count integer;
begin
  select count(*)::integer
    into v_group_count
    from public.groups g
    where g.tournament_id = p_tournament_id
      and g.letter in ('A', 'B', 'C', 'D', 'E', 'F');

  if v_group_count <> 6 then
    raise exception 'The current Round of 16 contract requires groups A to F'
      using errcode = '55000';
  end if;

  select count(*)::integer
    into v_resolved_group_count
    from public.groups g
    where g.tournament_id = p_tournament_id
      and g.letter in ('A', 'B', 'C', 'D', 'E', 'F')
      and cardinality(public._actual_group_order(g.id)) = 4;

  if v_resolved_group_count <> 6 then
    raise exception 'Actual group standings are incomplete or unresolved'
      using errcode = '55000';
  end if;

  return query
  with group_orders as (
    select
      g.id as group_id,
      g.letter as group_letter,
      public._actual_group_order(g.id) as ordered_team_ids
    from public.groups g
    where g.tournament_id = p_tournament_id
      and g.letter in ('A', 'B', 'C', 'D', 'E', 'F')
  ),
  thirds as (
    select
      go.group_id,
      go.group_letter,
      (go.ordered_team_ids)[3] as team_id
    from group_orders go
  ),
  appearances as (
    select
      th.group_letter,
      th.team_id,
      case
        when m.home_team_id = th.team_id then m.home_score
        else m.away_score
      end as goals_for,
      case
        when m.home_team_id = th.team_id then m.away_score
        else m.home_score
      end as goals_against
    from thirds th
    join public.matches m
      on m.group_id = th.group_id
     and m.tournament_id = p_tournament_id
     and m.round = 'group'
     and th.team_id in (m.home_team_id, m.away_team_id)
     and m.result_state in ('confirmed', 'corrected')
  ),
  stats as (
    select
      a.group_letter,
      a.team_id,
      sum(
        case
          when a.goals_for > a.goals_against then 3
          when a.goals_for = a.goals_against then 1
          else 0
        end
      )::integer as points,
      sum(a.goals_for - a.goals_against)::integer as goal_difference,
      sum(a.goals_for)::integer as goals_for,
      count(*) filter (where a.goals_for > a.goals_against)::integer as wins
    from appearances a
    group by a.group_letter, a.team_id
  ),
  blocks as (
    select
      s.*,
      (
        select string_agg(peer.team_id::text, '|' order by peer.team_id::text)
        from stats peer
        where row(
          peer.points,
          peer.goal_difference,
          peer.goals_for,
          peer.wins
        ) = row(
          s.points,
          s.goal_difference,
          s.goals_for,
          s.wins
        )
      ) as tie_key,
      (
        select count(*)::integer
        from stats higher
        where row(
          higher.points,
          higher.goal_difference,
          higher.goals_for,
          higher.wins
        ) > row(
          s.points,
          s.goal_difference,
          s.goals_for,
          s.wins
        )
      ) as higher_count,
      (
        select count(*)::integer
        from stats peer
        where row(
          peer.points,
          peer.goal_difference,
          peer.goals_for,
          peer.wins
        ) = row(
          s.points,
          s.goal_difference,
          s.goals_for,
          s.wins
        )
      ) as block_size
    from stats s
  )
  select
    b.group_letter,
    b.team_id,
    b.points,
    b.goal_difference,
    b.goals_for,
    b.wins,
    b.tie_key,
    b.higher_count,
    b.block_size,
    b.block_size > 1 as unresolved
  from blocks b
  order by
    b.points desc,
    b.goal_difference desc,
    b.goals_for desc,
    b.wins desc,
    b.group_letter;
end;
$$;

create or replace function predictor_internal.actual_round_of_16(
  p_tournament_id uuid
)
returns table (
  match_ref text,
  home_team_id uuid,
  away_team_id uuid
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_winners jsonb;
  v_runners jsonb;
  v_winner_count integer;
  v_runner_count integer;
  v_qualifying_groups text;
  v_thirds jsonb;
  v_allocation jsonb;
  v_team_ids uuid[];
  v_unique_count integer;
begin
  with group_orders as (
    select
      g.letter,
      public._actual_group_order(g.id) as ordered_team_ids
    from public.groups g
    where g.tournament_id = p_tournament_id
      and g.letter in ('A', 'B', 'C', 'D', 'E', 'F')
  )
  select
    jsonb_object_agg(go.letter, ((go.ordered_team_ids)[1])::text),
    jsonb_object_agg(go.letter, ((go.ordered_team_ids)[2])::text)
    into v_winners, v_runners
    from group_orders go
    where cardinality(go.ordered_team_ids) = 4;

  select count(*)::integer
    into v_winner_count
    from jsonb_object_keys(coalesce(v_winners, '{}'::jsonb));

  select count(*)::integer
    into v_runner_count
    from jsonb_object_keys(coalesce(v_runners, '{}'::jsonb));

  if v_winner_count <> 6 or v_runner_count <> 6 then
    raise exception 'Actual group winners and runners-up are incomplete or unresolved'
      using errcode = '55000';
  end if;

  if exists (
    select 1
    from predictor_internal.actual_third_place_ranking(p_tournament_id) ranking
    where ranking.unresolved
      and ranking.higher_count < 4
      and ranking.higher_count + ranking.block_size > 4
  ) then
    raise exception 'An unresolved actual third-place tie crosses the qualification boundary'
      using errcode = '55000';
  end if;

  select
    string_agg(ranking.group_letter, '' order by ranking.group_letter),
    jsonb_object_agg(ranking.group_letter, ranking.team_id::text)
    into v_qualifying_groups, v_thirds
    from predictor_internal.actual_third_place_ranking(p_tournament_id) ranking
    where (
      (not ranking.unresolved and ranking.higher_count < 4)
      or
      (
        ranking.unresolved
        and ranking.higher_count + ranking.block_size <= 4
      )
    );

  if v_qualifying_groups is null or length(v_qualifying_groups) <> 4 then
    raise exception 'Exactly four actual third-placed teams must qualify'
      using errcode = '55000';
  end if;

  v_allocation := case v_qualifying_groups
    when 'ABCD' then '{"WB":"A","WC":"D","WE":"B","WF":"C"}'::jsonb
    when 'ABCE' then '{"WB":"A","WC":"E","WE":"B","WF":"C"}'::jsonb
    when 'ABCF' then '{"WB":"A","WC":"F","WE":"B","WF":"C"}'::jsonb
    when 'ABDE' then '{"WB":"D","WC":"E","WE":"A","WF":"B"}'::jsonb
    when 'ABDF' then '{"WB":"D","WC":"F","WE":"A","WF":"B"}'::jsonb
    when 'ABEF' then '{"WB":"E","WC":"F","WE":"B","WF":"A"}'::jsonb
    when 'ACDE' then '{"WB":"E","WC":"D","WE":"C","WF":"A"}'::jsonb
    when 'ACDF' then '{"WB":"F","WC":"D","WE":"C","WF":"A"}'::jsonb
    when 'ACEF' then '{"WB":"E","WC":"F","WE":"C","WF":"A"}'::jsonb
    when 'ADEF' then '{"WB":"E","WC":"F","WE":"D","WF":"A"}'::jsonb
    when 'BCDE' then '{"WB":"E","WC":"D","WE":"B","WF":"C"}'::jsonb
    when 'BCDF' then '{"WB":"F","WC":"D","WE":"C","WF":"B"}'::jsonb
    when 'BCEF' then '{"WB":"F","WC":"E","WE":"C","WF":"B"}'::jsonb
    when 'BDEF' then '{"WB":"F","WC":"E","WE":"D","WF":"B"}'::jsonb
    when 'CDEF' then '{"WB":"F","WC":"E","WE":"D","WF":"C"}'::jsonb
    else null
  end;

  if v_allocation is null then
    raise exception 'No Round of 16 allocation exists for qualifying groups %',
      v_qualifying_groups
      using errcode = '23514';
  end if;

  v_team_ids := array[
    (v_winners ->> 'A')::uuid,
    (v_runners ->> 'C')::uuid,
    (v_runners ->> 'A')::uuid,
    (v_runners ->> 'B')::uuid,
    (v_winners ->> 'B')::uuid,
    (v_thirds ->> (v_allocation ->> 'WB'))::uuid,
    (v_winners ->> 'C')::uuid,
    (v_thirds ->> (v_allocation ->> 'WC'))::uuid,
    (v_winners ->> 'F')::uuid,
    (v_thirds ->> (v_allocation ->> 'WF'))::uuid,
    (v_runners ->> 'D')::uuid,
    (v_runners ->> 'E')::uuid,
    (v_winners ->> 'E')::uuid,
    (v_thirds ->> (v_allocation ->> 'WE'))::uuid,
    (v_winners ->> 'D')::uuid,
    (v_runners ->> 'F')::uuid
  ];

  select count(distinct participants.team_id)::integer
    into v_unique_count
    from unnest(v_team_ids) as participants(team_id)
    where participants.team_id is not null;

  if cardinality(v_team_ids) <> 16
     or v_unique_count <> 16
     or array_position(v_team_ids, null) is not null
  then
    raise exception 'Actual Round of 16 must contain 16 distinct teams'
      using errcode = '23514';
  end if;

  return query
  select *
  from (values
    ('R16-1', v_team_ids[1],  v_team_ids[2]),
    ('R16-2', v_team_ids[3],  v_team_ids[4]),
    ('R16-3', v_team_ids[5],  v_team_ids[6]),
    ('R16-4', v_team_ids[7],  v_team_ids[8]),
    ('R16-5', v_team_ids[9],  v_team_ids[10]),
    ('R16-6', v_team_ids[11], v_team_ids[12]),
    ('R16-7', v_team_ids[13], v_team_ids[14]),
    ('R16-8', v_team_ids[15], v_team_ids[16])
  ) as fixtures(match_ref, home_team_id, away_team_id);
end;
$$;

create or replace function predictor_internal.refresh_actual_round_of_16(
  p_tournament_id uuid
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_group_count integer;
  v_group_match_count integer;
  v_completed_group_match_count integer;
  v_r16_match_count integer;
  v_desired jsonb := '{}'::jsonb;
  v_match record;
  v_home_team_id uuid;
  v_away_team_id uuid;
  v_previous_capability text;
begin
  select count(*)::integer
    into v_group_count
    from public.groups g
    where g.tournament_id = p_tournament_id
      and g.letter in ('A', 'B', 'C', 'D', 'E', 'F');

  select
    count(*)::integer,
    count(*) filter (
      where m.result_state in ('confirmed', 'corrected')
    )::integer
    into v_group_match_count, v_completed_group_match_count
    from public.matches m
    where m.tournament_id = p_tournament_id
      and m.round = 'group';

  select count(*)::integer
    into v_r16_match_count
    from public.matches m
    where m.tournament_id = p_tournament_id
      and m.round = 'r16';

  -- Small database-test fixtures and future non-EURO tournament shapes do not use
  -- this six-group contract. Leave them untouched rather than inventing brackets.
  if v_group_count <> 6
     or v_group_match_count <> 36
     or v_r16_match_count <> 8
  then
    return;
  end if;

  if v_completed_group_match_count = v_group_match_count then
    begin
      select coalesce(
        jsonb_object_agg(
          fixtures.match_ref,
          jsonb_build_array(fixtures.home_team_id, fixtures.away_team_id)
        ),
        '{}'::jsonb
      )
        into v_desired
        from predictor_internal.actual_round_of_16(p_tournament_id) fixtures;
    exception
      when sqlstate '55000' then
        -- The group results remain authoritative, but an incomplete/unresolved
        -- qualifier set must leave the real Round of 16 visibly unresolved.
        v_desired := '{}'::jsonb;
    end;
  end if;

  v_previous_capability := coalesce(
    current_setting('predictor.r16_participant_write', true),
    ''
  );
  perform set_config('predictor.r16_participant_write', 'on', true);

  begin
    for v_match in
      select
        m.id,
        m.match_ref,
        m.result_state,
        m.home_team_id,
        m.away_team_id
      from public.matches m
      where m.tournament_id = p_tournament_id
        and m.round = 'r16'
      order by m.match_ref
      for update
    loop
      v_home_team_id := (v_desired -> v_match.match_ref ->> 0)::uuid;
      v_away_team_id := (v_desired -> v_match.match_ref ->> 1)::uuid;

      if v_match.home_team_id is distinct from v_home_team_id
         or v_match.away_team_id is distinct from v_away_team_id
      then
        if v_match.result_state <> 'scheduled' then
          raise exception 'Clear Round-of-16 result % before replaying group qualification',
            v_match.match_ref
            using errcode = '55000';
        end if;

        update public.matches m
          set home_team_id = v_home_team_id,
              away_team_id = v_away_team_id
          where m.id = v_match.id;
      end if;
    end loop;
  exception
    when others then
      perform set_config(
        'predictor.r16_participant_write',
        v_previous_capability,
        true
      );
      raise;
  end;

  perform set_config(
    'predictor.r16_participant_write',
    v_previous_capability,
    true
  );
end;
$$;

create or replace function predictor_internal.enforce_round_of_16_participant_boundary()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.round = 'r16'
     and (
       new.home_team_id is distinct from old.home_team_id
       or new.away_team_id is distinct from old.away_team_id
     )
     and coalesce(
       current_setting('predictor.r16_participant_write', true),
       ''
     ) <> 'on'
  then
    raise exception 'Actual Round-of-16 participants are server-owned'
      using errcode = '42501';
  end if;

  return new;
end;
$$;

drop trigger if exists enforce_round_of_16_participant_boundary
  on public.matches;

create trigger enforce_round_of_16_participant_boundary
before update of home_team_id, away_team_id on public.matches
for each row
execute function predictor_internal.enforce_round_of_16_participant_boundary();

create or replace function public.trg_recompute_on_result()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_previous_suppression text := coalesce(
    current_setting('predictor.recompute_scores_suppressed', true),
    ''
  );
begin
  if v_previous_suppression = 'on' then
    return new;
  end if;

  perform set_config('predictor.recompute_scores_suppressed', 'on', true);

  begin
    if new.round = 'group' then
      perform predictor_internal.refresh_actual_round_of_16(new.tournament_id);
    end if;

    perform public.recompute_tournament_scores(new.tournament_id);
  exception
    when others then
      perform set_config(
        'predictor.recompute_scores_suppressed',
        v_previous_suppression,
        true
      );
      raise;
  end;

  perform set_config(
    'predictor.recompute_scores_suppressed',
    v_previous_suppression,
    true
  );

  return new;
end;
$$;

revoke all on function predictor_internal.actual_third_place_ranking(uuid)
  from public, anon, authenticated, service_role;
revoke all on function predictor_internal.actual_round_of_16(uuid)
  from public, anon, authenticated, service_role;
revoke all on function predictor_internal.refresh_actual_round_of_16(uuid)
  from public, anon, authenticated, service_role;
revoke all on function predictor_internal.enforce_round_of_16_participant_boundary()
  from public, anon, authenticated, service_role;
revoke all on function public.trg_recompute_on_result()
  from public, anon, authenticated;

commit;
