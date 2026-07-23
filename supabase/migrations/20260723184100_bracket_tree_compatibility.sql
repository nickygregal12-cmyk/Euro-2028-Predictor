-- FUNC-001 integration adjustments discovered by the full existing pgTAP suite.
--
-- - tournaments with no knockout fixture rows retain the prior stage-count-only
--   submission contract (used by isolated entry-boundary fixtures and applicable
--   to non-knockout competitions);
-- - once any knockout fixture exists, the complete 8/4/2/1 source tree is
--   mandatory and fully replayed;
-- - confirmed participant edits continue to be rejected by the older result
--   lifecycle trigger with its established check_violation contract;
-- - key counting uses jsonb_object_keys for PostgreSQL image compatibility.

begin;

create or replace function predictor_internal.predicted_round_of_16(
  p_entry_id uuid
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
  v_tournament uuid;
  v_winners jsonb;
  v_runners jsonb;
  v_winner_count integer;
  v_runner_count integer;
  v_qualifying_groups text;
  v_allocation jsonb;
  v_thirds jsonb;
  v_team_ids uuid[];
  v_unique_count integer;
begin
  select e.tournament_id
    into v_tournament
    from public.entries e
    where e.id = p_entry_id;

  if v_tournament is null then
    raise exception 'Entry not found'
      using errcode = 'no_data_found';
  end if;

  if (
    select count(*)
    from public.groups g
    where g.tournament_id = v_tournament
      and g.letter in ('A','B','C','D','E','F')
  ) <> 6 then
    raise exception 'The current Round of 16 contract requires groups A to F'
      using errcode = 'check_violation';
  end if;

  select
    jsonb_object_agg(g.letter, pgp.team_id::text) filter (where pgp.position = 1),
    jsonb_object_agg(g.letter, pgp.team_id::text) filter (where pgp.position = 2)
    into v_winners, v_runners
    from public.predicted_group_positions pgp
    join public.groups g
      on g.id = pgp.group_id
     and g.tournament_id = v_tournament
    where pgp.entry_id = p_entry_id
      and pgp.position in (1, 2);

  select count(*)::integer
    into v_winner_count
    from jsonb_object_keys(coalesce(v_winners, '{}'::jsonb));

  select count(*)::integer
    into v_runner_count
    from jsonb_object_keys(coalesce(v_runners, '{}'::jsonb));

  if v_winner_count <> 6 or v_runner_count <> 6 then
    raise exception 'Predicted group winners and runners-up are incomplete'
      using errcode = 'check_violation';
  end if;

  if exists (
    select 1
    from predictor_internal.predicted_third_place_ranking(p_entry_id) r
    where r.unresolved
      and r.higher_count < 4
      and r.higher_count + r.block_size > 4
  ) then
    raise exception 'An unresolved third-place tie crosses the qualification boundary'
      using errcode = 'check_violation';
  end if;

  select
    string_agg(r.group_letter, '' order by r.group_letter),
    jsonb_object_agg(r.group_letter, r.team_id::text)
    into v_qualifying_groups, v_thirds
    from predictor_internal.predicted_third_place_ranking(p_entry_id) r
    where (
      (not r.unresolved and r.resolved_position <= 4)
      or
      (r.unresolved and r.higher_count + r.block_size <= 4)
    );

  if v_qualifying_groups is null or length(v_qualifying_groups) <> 4 then
    raise exception 'Exactly four predicted third-placed teams must qualify'
      using errcode = 'check_violation';
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
    raise exception 'No Round of 16 allocation exists for qualifying groups %', v_qualifying_groups
      using errcode = 'check_violation';
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

  select count(distinct ids.team_id)
    into v_unique_count
    from unnest(v_team_ids) as ids(team_id)
    where ids.team_id is not null;

  if cardinality(v_team_ids) <> 16
     or v_unique_count <> 16
     or array_position(v_team_ids, null) is not null
  then
    raise exception 'Predicted Round of 16 must contain 16 distinct teams'
      using errcode = 'check_violation';
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

revoke all on function predictor_internal.predicted_round_of_16(uuid)
  from public, anon, authenticated;

create or replace function predictor_internal.validate_predicted_bracket_tree(
  p_entry_id uuid
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_tournament uuid;
  v_knockout_total integer;
  v_progression jsonb;
  v_total integer;
  v_qf integer;
  v_sf integer;
  v_final integer;
  v_champion integer;
  v_fixture record;
  v_match record;
  v_home_rank integer;
  v_away_rank integer;
  v_threshold integer;
  v_home_team uuid;
  v_away_team uuid;
  v_winner uuid;
  v_winners jsonb := '{}'::jsonb;
  v_winner_count integer;
begin
  select e.tournament_id
    into v_tournament
    from public.entries e
    where e.id = p_entry_id;

  if v_tournament is null then
    raise exception 'Entry not found'
      using errcode = 'no_data_found';
  end if;

  select count(*)::integer
    into v_knockout_total
    from public.matches m
    where m.tournament_id = v_tournament
      and m.round in ('r16','qf','sf','final');

  -- Preserve the existing submission contract for synthetic/non-knockout
  -- tournaments. A tournament that has begun defining a knockout stage must
  -- provide and satisfy the entire source tree.
  if v_knockout_total = 0 then
    return true;
  end if;

  perform predictor_internal.assert_knockout_source_tree(v_tournament);

  select
    jsonb_object_agg(pp.team_id::text, pp.stage),
    count(*)::integer,
    count(*) filter (where pp.stage = 'qf')::integer,
    count(*) filter (where pp.stage = 'sf')::integer,
    count(*) filter (where pp.stage = 'final')::integer,
    count(*) filter (where pp.stage = 'champion')::integer
    into v_progression, v_total, v_qf, v_sf, v_final, v_champion
    from public.predicted_progression pp
    join public.teams t
      on t.id = pp.team_id
     and t.tournament_id = v_tournament
    where pp.entry_id = p_entry_id;

  if v_total <> 8 or v_qf <> 4 or v_sf <> 2 or v_final <> 1 or v_champion <> 1 then
    raise exception 'Bracket must contain four quarter-finalists, two semi-finalists, one finalist and one champion'
      using errcode = 'check_violation';
  end if;

  for v_fixture in
    select *
    from predictor_internal.predicted_round_of_16(p_entry_id)
    order by match_ref
  loop
    v_home_rank := predictor_internal.progression_stage_rank(
      v_progression ->> v_fixture.home_team_id::text
    );
    v_away_rank := predictor_internal.progression_stage_rank(
      v_progression ->> v_fixture.away_team_id::text
    );

    if (case when v_home_rank >= 1 then 1 else 0 end)
       + (case when v_away_rank >= 1 then 1 else 0 end) <> 1
    then
      raise exception 'Predicted bracket is invalid at %: exactly one participant must advance',
        v_fixture.match_ref
        using errcode = 'check_violation';
    end if;

    v_winner := case when v_home_rank >= 1 then v_fixture.home_team_id else v_fixture.away_team_id end;
    v_winners := v_winners || jsonb_build_object(v_fixture.match_ref, v_winner::text);
  end loop;

  for v_match in
    select m.match_ref, m.round, m.home_source, m.away_source
    from public.matches m
    where m.tournament_id = v_tournament
      and m.round in ('qf','sf','final')
    order by
      case m.round when 'qf' then 1 when 'sf' then 2 else 3 end,
      m.match_ref
  loop
    v_home_team := nullif(v_winners ->> substring(v_match.home_source from 3), '')::uuid;
    v_away_team := nullif(v_winners ->> substring(v_match.away_source from 3), '')::uuid;

    if v_home_team is null or v_away_team is null or v_home_team = v_away_team then
      raise exception 'Predicted bracket cannot resolve both distinct participants for %', v_match.match_ref
        using errcode = 'check_violation';
    end if;

    v_threshold := case v_match.round
      when 'qf' then 2
      when 'sf' then 3
      when 'final' then 4
    end;

    v_home_rank := predictor_internal.progression_stage_rank(
      v_progression ->> v_home_team::text
    );
    v_away_rank := predictor_internal.progression_stage_rank(
      v_progression ->> v_away_team::text
    );

    if (case when v_home_rank >= v_threshold then 1 else 0 end)
       + (case when v_away_rank >= v_threshold then 1 else 0 end) <> 1
    then
      raise exception 'Predicted bracket is invalid at %: exactly one participant must advance',
        v_match.match_ref
        using errcode = 'check_violation';
    end if;

    v_winner := case
      when v_home_rank >= v_threshold then v_home_team
      else v_away_team
    end;
    v_winners := v_winners || jsonb_build_object(v_match.match_ref, v_winner::text);
  end loop;

  select count(*)::integer
    into v_winner_count
    from jsonb_object_keys(v_winners);

  if v_winner_count <> 15 then
    raise exception 'Predicted bracket replay did not resolve all 15 knockout matches'
      using errcode = 'check_violation';
  end if;

  return true;
end;
$$;

revoke all on function predictor_internal.validate_predicted_bracket_tree(uuid)
  from public, anon, authenticated;

create or replace function predictor_internal.enforce_knockout_participant_boundary()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_expected uuid;
  v_source_ref text;
begin
  if new.round not in ('qf','sf','final') then
    return new;
  end if;

  -- Preserve the established result-lifecycle error contract for a confirmed
  -- match. The existing enforce_match_result_boundary trigger will reject it as
  -- a check violation and instruct the operator to clear the result first.
  if old.result_state <> 'scheduled' then
    return new;
  end if;

  if new.home_team_id is distinct from old.home_team_id
     and new.home_source ~ '^W-.+'
  then
    if coalesce(current_setting('predictor.bracket_participant_write', true), '') <> 'on' then
      raise exception 'Winner-fed knockout participants are server-owned'
        using errcode = 'insufficient_privilege';
    end if;

    v_source_ref := substring(new.home_source from 3);
    select case when m.result_state in ('confirmed','corrected') then m.winner_team_id else null end
      into v_expected
      from public.matches m
      where m.tournament_id = new.tournament_id
        and m.match_ref = v_source_ref;

    if not found or new.home_team_id is distinct from v_expected then
      raise exception 'Home participant for % must equal the confirmed winner of %',
        new.match_ref, v_source_ref
        using errcode = 'check_violation';
    end if;
  end if;

  if new.away_team_id is distinct from old.away_team_id
     and new.away_source ~ '^W-.+'
  then
    if coalesce(current_setting('predictor.bracket_participant_write', true), '') <> 'on' then
      raise exception 'Winner-fed knockout participants are server-owned'
        using errcode = 'insufficient_privilege';
    end if;

    v_source_ref := substring(new.away_source from 3);
    select case when m.result_state in ('confirmed','corrected') then m.winner_team_id else null end
      into v_expected
      from public.matches m
      where m.tournament_id = new.tournament_id
        and m.match_ref = v_source_ref;

    if not found or new.away_team_id is distinct from v_expected then
      raise exception 'Away participant for % must equal the confirmed winner of %',
        new.match_ref, v_source_ref
        using errcode = 'check_violation';
    end if;
  end if;

  return new;
end;
$$;

revoke all on function predictor_internal.enforce_knockout_participant_boundary()
  from public, anon, authenticated;

commit;
