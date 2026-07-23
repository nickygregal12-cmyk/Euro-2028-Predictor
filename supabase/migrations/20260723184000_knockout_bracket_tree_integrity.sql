-- Euro 2028 Predictor — FUNC-001 knockout bracket-tree integrity
--
-- Adds two connected safeguards:
--
-- 1. real confirmed winners automatically populate the winner-fed side of the
--    next knockout fixture; upstream winner changes are blocked while a
--    downstream result remains confirmed;
-- 2. entry submission replays the complete predicted Round of 16, quarter-final,
--    semi-final and final tree rather than accepting stage counts alone.
--
-- All helpers remain private. No hosted project is touched by this migration.

begin;

-- ---------------------------------------------------------------------------
-- Private stage ordering used by the predicted-tree replay.
-- ---------------------------------------------------------------------------
create or replace function predictor_internal.progression_stage_rank(p_stage text)
returns integer
language sql
immutable
set search_path = ''
as $$
  select case p_stage
    when 'r16' then 0
    when 'qf' then 1
    when 'sf' then 2
    when 'final' then 3
    when 'champion' then 4
    else -1
  end;
$$;

revoke all on function predictor_internal.progression_stage_rank(text)
  from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- Rank the six predicted third-placed teams using the documented predictable
-- criteria: points, goal difference, goals scored, wins. Exact-set manual
-- resolutions are applied only to the matching fully-level block.
-- ---------------------------------------------------------------------------
create or replace function predictor_internal.predicted_third_place_ranking(
  p_entry_id uuid
)
returns table (
  group_letter text,
  team_id uuid,
  points integer,
  goal_difference integer,
  goals_for integer,
  wins integer,
  higher_count integer,
  block_size integer,
  resolved_position integer,
  unresolved boolean
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_tournament uuid;
  v_third_count integer;
begin
  select e.tournament_id
    into v_tournament
    from public.entries e
    where e.id = p_entry_id;

  if v_tournament is null then
    raise exception 'Entry not found'
      using errcode = 'no_data_found';
  end if;

  select count(*)
    into v_third_count
    from public.predicted_group_positions pgp
    join public.groups g
      on g.id = pgp.group_id
     and g.tournament_id = v_tournament
    where pgp.entry_id = p_entry_id
      and pgp.position = 3;

  if v_third_count <> 6 then
    raise exception 'Predicted third-place ranking requires one third-placed team from each of six groups'
      using errcode = 'check_violation';
  end if;

  return query
  with thirds as (
    select
      g.id as group_id,
      g.letter as group_letter,
      pgp.team_id
    from public.predicted_group_positions pgp
    join public.groups g
      on g.id = pgp.group_id
     and g.tournament_id = v_tournament
    where pgp.entry_id = p_entry_id
      and pgp.position = 3
  ),
  appearances as (
    select
      th.group_letter,
      th.team_id,
      case when m.home_team_id = th.team_id then mp.home_score else mp.away_score end as gf,
      case when m.home_team_id = th.team_id then mp.away_score else mp.home_score end as ga
    from thirds th
    join public.matches m
      on m.group_id = th.group_id
     and m.tournament_id = v_tournament
     and m.round = 'group'
     and th.team_id in (m.home_team_id, m.away_team_id)
    join public.match_predictions mp
      on mp.match_id = m.id
     and mp.entry_id = p_entry_id
  ),
  stats as (
    select
      a.group_letter,
      a.team_id,
      sum(case when a.gf > a.ga then 3 when a.gf = a.ga then 1 else 0 end)::integer as points,
      sum(a.gf - a.ga)::integer as goal_difference,
      sum(a.gf)::integer as goals_for,
      count(*) filter (where a.gf > a.ga)::integer as wins
    from appearances a
    group by a.group_letter, a.team_id
  ),
  blocks as (
    select
      s.*,
      (
        select count(*)::integer
        from stats h
        where row(h.points, h.goal_difference, h.goals_for, h.wins)
            > row(s.points, s.goal_difference, s.goals_for, s.wins)
      ) as higher_count,
      (
        select count(*)::integer
        from stats b
        where row(b.points, b.goal_difference, b.goals_for, b.wins)
            = row(s.points, s.goal_difference, s.goals_for, s.wins)
      ) as block_size,
      (
        select string_agg(b.team_id::text, '|' order by b.team_id::text)
        from stats b
        where row(b.points, b.goal_difference, b.goals_for, b.wins)
            = row(s.points, s.goal_difference, s.goals_for, s.wins)
      ) as tie_key
    from stats s
  )
  select
    b.group_letter,
    b.team_id,
    b.points,
    b.goal_difference,
    b.goals_for,
    b.wins,
    b.higher_count,
    b.block_size,
    b.higher_count + coalesce(array_position(ptr.ordered_team_ids, b.team_id), 1) as resolved_position,
    b.block_size > 1 and ptr.id is null as unresolved
  from blocks b
  left join public.predicted_tie_resolutions ptr
    on ptr.entry_id = p_entry_id
   and ptr.scope = 'third'
   and ptr.tie_key = b.tie_key
   and cardinality(ptr.ordered_team_ids) = b.block_size
  order by
    b.points desc,
    b.goal_difference desc,
    b.goals_for desc,
    b.wins desc,
    case when ptr.id is null then 1 else array_position(ptr.ordered_team_ids, b.team_id) end,
    b.group_letter;
end;
$$;

revoke all on function predictor_internal.predicted_third_place_ranking(uuid)
  from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- Resolve the eight predicted R16 fixtures from the persisted group-position
-- snapshots and the current 15-combination third-place allocation table.
-- ---------------------------------------------------------------------------
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

  if jsonb_object_length(coalesce(v_winners, '{}'::jsonb)) <> 6
     or jsonb_object_length(coalesce(v_runners, '{}'::jsonb)) <> 6
  then
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

-- ---------------------------------------------------------------------------
-- Validate the configured real knockout source tree before it is used to replay
-- a predicted bracket. The match rows are the database source of truth.
-- ---------------------------------------------------------------------------
create or replace function predictor_internal.assert_knockout_source_tree(
  p_tournament_id uuid
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_counts integer[];
  v_match record;
  v_source text;
  v_source_round text;
  v_expected_round text;
  v_ref_total integer;
  v_ref_unique integer;
begin
  select array[
    count(*) filter (where m.round = 'r16'),
    count(*) filter (where m.round = 'qf'),
    count(*) filter (where m.round = 'sf'),
    count(*) filter (where m.round = 'final')
  ]::integer[]
    into v_counts
    from public.matches m
    where m.tournament_id = p_tournament_id;

  if v_counts <> array[8,4,2,1]::integer[] then
    raise exception 'Knockout source tree must contain 8 R16, 4 QF, 2 SF and 1 final matches'
      using errcode = 'check_violation';
  end if;

  for v_match in
    select m.match_ref, m.round, m.home_source, m.away_source
    from public.matches m
    where m.tournament_id = p_tournament_id
      and m.round in ('qf','sf','final')
  loop
    v_expected_round := case v_match.round
      when 'qf' then 'r16'
      when 'sf' then 'qf'
      when 'final' then 'sf'
    end;

    foreach v_source in array array[v_match.home_source, v_match.away_source]
    loop
      if v_source is null or v_source !~ '^W-.+' then
        raise exception 'Knockout match % has an invalid winner source', v_match.match_ref
          using errcode = 'check_violation';
      end if;

      select m.round
        into v_source_round
        from public.matches m
        where m.tournament_id = p_tournament_id
          and m.match_ref = substring(v_source from 3);

      if v_source_round is distinct from v_expected_round then
        raise exception 'Knockout match % source % does not reference the required prior round',
          v_match.match_ref, v_source
          using errcode = 'check_violation';
      end if;
    end loop;
  end loop;

  with refs as (
    select substring(m.home_source from 3) as source_ref
    from public.matches m
    where m.tournament_id = p_tournament_id
      and m.round in ('qf','sf','final')
    union all
    select substring(m.away_source from 3)
    from public.matches m
    where m.tournament_id = p_tournament_id
      and m.round in ('qf','sf','final')
  )
  select count(*)::integer, count(distinct source_ref)::integer
    into v_ref_total, v_ref_unique
    from refs;

  if v_ref_total <> 14 or v_ref_unique <> 14 then
    raise exception 'Every R16, QF and SF match must feed exactly one later fixture'
      using errcode = 'check_violation';
  end if;

  return true;
end;
$$;

revoke all on function predictor_internal.assert_knockout_source_tree(uuid)
  from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- Replay all 15 predicted winners through the resolved R16 and configured
-- winner-source tree. Stage counts alone are not accepted.
-- ---------------------------------------------------------------------------
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
begin
  select e.tournament_id
    into v_tournament
    from public.entries e
    where e.id = p_entry_id;

  if v_tournament is null then
    raise exception 'Entry not found'
      using errcode = 'no_data_found';
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

  if jsonb_object_length(v_winners) <> 15 then
    raise exception 'Predicted bracket replay did not resolve all 15 knockout matches'
      using errcode = 'check_violation';
  end if;

  return true;
end;
$$;

revoke all on function predictor_internal.validate_predicted_bracket_tree(uuid)
  from public, anon, authenticated;

-- Validate every submission attempt, including a repeat submission where the
-- timestamp already exists but the user has edited the bracket pre-lock.
create or replace function predictor_internal.validate_bracket_on_submission()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.submitted_at is not null then
    perform predictor_internal.validate_predicted_bracket_tree(new.id);
  end if;
  return new;
end;
$$;

revoke all on function predictor_internal.validate_bracket_on_submission()
  from public, anon, authenticated;

drop trigger if exists validate_bracket_on_submission on public.entries;
create trigger validate_bracket_on_submission
  before update of submitted_at
  on public.entries
  for each row
  execute function predictor_internal.validate_bracket_on_submission();

-- Existing submitted rows must satisfy the new contract before this migration
-- can be considered safe. A failure requires explicit data remediation.
do $$
declare
  v_entry record;
begin
  for v_entry in
    select e.id
    from public.entries e
    where e.submitted_at is not null
  loop
    perform predictor_internal.validate_predicted_bracket_tree(v_entry.id);
  end loop;
end;
$$;

-- ---------------------------------------------------------------------------
-- Real-result winner propagation.
-- ---------------------------------------------------------------------------
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

drop trigger if exists enforce_knockout_participant_boundary on public.matches;
create trigger enforce_knockout_participant_boundary
  before update of home_team_id, away_team_id
  on public.matches
  for each row
  execute function predictor_internal.enforce_knockout_participant_boundary();

create or replace function predictor_internal.propagate_knockout_winner()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_child record;
  v_next_team uuid;
  v_previous_capability text;
begin
  if new.round not in ('r16','qf','sf') then
    return new;
  end if;

  v_next_team := case
    when new.result_state in ('confirmed','corrected') then new.winner_team_id
    else null
  end;

  for v_child in
    select m.*
    from public.matches m
    where m.tournament_id = new.tournament_id
      and (
        m.home_source = 'W-' || new.match_ref
        or m.away_source = 'W-' || new.match_ref
      )
    for update
  loop
    if v_child.result_state <> 'scheduled'
       and (
         (v_child.home_source = 'W-' || new.match_ref and v_child.home_team_id is distinct from v_next_team)
         or
         (v_child.away_source = 'W-' || new.match_ref and v_child.away_team_id is distinct from v_next_team)
       )
    then
      raise exception 'Clear downstream result % before changing the winner of %',
        v_child.match_ref, new.match_ref
        using errcode = 'object_not_in_prerequisite_state';
    end if;

    v_previous_capability := coalesce(
      current_setting('predictor.bracket_participant_write', true),
      ''
    );
    perform set_config('predictor.bracket_participant_write', 'on', true);

    update public.matches m
      set home_team_id = case
            when m.home_source = 'W-' || new.match_ref then v_next_team
            else m.home_team_id
          end,
          away_team_id = case
            when m.away_source = 'W-' || new.match_ref then v_next_team
            else m.away_team_id
          end
      where m.id = v_child.id
        and (
          (m.home_source = 'W-' || new.match_ref and m.home_team_id is distinct from v_next_team)
          or
          (m.away_source = 'W-' || new.match_ref and m.away_team_id is distinct from v_next_team)
        );

    perform set_config(
      'predictor.bracket_participant_write',
      v_previous_capability,
      true
    );
  end loop;

  return new;
end;
$$;

revoke all on function predictor_internal.propagate_knockout_winner()
  from public, anon, authenticated;

-- Trigger name deliberately sorts before recompute_scores_on_result, so a
-- blocked downstream dependency aborts before score recomputation begins.
drop trigger if exists propagate_knockout_winner on public.matches;
create trigger propagate_knockout_winner
  after update of result_state, winner_team_id
  on public.matches
  for each row
  when (
    old.result_state is distinct from new.result_state
    or old.winner_team_id is distinct from new.winner_team_id
  )
  execute function predictor_internal.propagate_knockout_winner();

commit;
