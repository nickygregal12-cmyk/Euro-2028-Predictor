-- Validate legacy submitted entries before DB-INTEGRITY-ENTRY-BOUNDARY-1 makes
-- any policy change or discards any derived group-position row.
--
-- Supabase records migration files independently, so this preflight must run
-- before the destructive snapshot rebuild. It derives each group directly from
-- saved scores and exact manual group-tie decisions using the already-proven
-- private resolver. Invalid legacy data blocks deployment without changing it.

begin;

do $$
declare
  v_entry record;
  v_group record;
  v_lock timestamptz;
  v_group_count integer;
  v_team_ids jsonb;
  v_team_count integer;
  v_match_total integer;
  v_match_done integer;
  v_valid_match_count integer;
  v_matches jsonb;
  v_resolutions jsonb;
  v_result jsonb;
  v_result_count integer;
  v_result_unique integer;
  v_champion integer;
  v_final integer;
  v_sf integer;
  v_qf integer;
  v_r16 integer;
  v_progression_total integer;
  v_foreign_progression integer;
  v_foreign_bonus integer;
begin
  for v_entry in
    select e.id, e.tournament_id, e.submitted_at
    from public.entries e
    where e.submitted_at is not null
  loop
    select t.lock_at
      into v_lock
      from public.tournaments t
      where t.id = v_entry.tournament_id;

    if v_lock is null or v_entry.submitted_at >= v_lock then
      raise exception 'Submitted-entry preflight failed lock timing for entry %', v_entry.id
        using errcode = 'check_violation';
    end if;

    select count(*)
      into v_group_count
      from public.groups g
      where g.tournament_id = v_entry.tournament_id;

    if v_group_count = 0 then
      raise exception 'Submitted-entry preflight found no groups for entry %', v_entry.id
        using errcode = 'check_violation';
    end if;

    for v_group in
      select g.id, g.letter
      from public.groups g
      where g.tournament_id = v_entry.tournament_id
      order by g.letter
    loop
      select
        coalesce(jsonb_agg(to_jsonb(gt.team_id::text) order by gt.slot), '[]'::jsonb),
        count(*)
        into v_team_ids, v_team_count
        from public.group_teams gt
        join public.teams t
          on t.id = gt.team_id
         and t.tournament_id = v_entry.tournament_id
        where gt.group_id = v_group.id;

      select count(*)
        into v_match_total
        from public.matches m
        where m.group_id = v_group.id
          and m.tournament_id = v_entry.tournament_id
          and m.round = 'group';

      select count(*)
        into v_valid_match_count
        from public.matches m
        where m.group_id = v_group.id
          and m.tournament_id = v_entry.tournament_id
          and m.round = 'group'
          and m.home_team_id is not null
          and m.away_team_id is not null
          and m.home_team_id <> m.away_team_id
          and exists (
            select 1
            from public.group_teams home_gt
            where home_gt.group_id = v_group.id
              and home_gt.team_id = m.home_team_id
          )
          and exists (
            select 1
            from public.group_teams away_gt
            where away_gt.group_id = v_group.id
              and away_gt.team_id = m.away_team_id
          );

      select count(*)
        into v_match_done
        from public.match_predictions mp
        join public.matches m on m.id = mp.match_id
        where mp.entry_id = v_entry.id
          and m.group_id = v_group.id
          and m.tournament_id = v_entry.tournament_id
          and m.round = 'group';

      if v_team_count <> 4
         or v_match_total <> 6
         or v_valid_match_count <> 6
         or v_match_done <> 6
      then
        raise exception 'Submitted-entry preflight found incomplete group % for entry %',
          v_group.letter, v_entry.id
          using errcode = 'check_violation';
      end if;

      select jsonb_agg(
        jsonb_build_array(
          m.home_team_id::text,
          m.away_team_id::text,
          mp.home_score,
          mp.away_score
        )
        order by m.match_ref
      )
        into v_matches
        from public.match_predictions mp
        join public.matches m on m.id = mp.match_id
        where mp.entry_id = v_entry.id
          and m.group_id = v_group.id
          and m.tournament_id = v_entry.tournament_id
          and m.round = 'group';

      select coalesce(
        jsonb_agg(
          jsonb_build_object(
            'teamIds', to_jsonb(ptr.ordered_team_ids),
            'order', to_jsonb(ptr.ordered_team_ids)
          )
          order by ptr.created_at, ptr.id
        ),
        '[]'::jsonb
      )
        into v_resolutions
        from public.predicted_tie_resolutions ptr
        where ptr.entry_id = v_entry.id
          and ptr.scope = 'group'
          and cardinality(ptr.ordered_team_ids) >= 2
          and not exists (
            select 1
            from unnest(ptr.ordered_team_ids) as ids(team_id)
            where not exists (
              select 1
              from public.group_teams gt
              where gt.group_id = v_group.id
                and gt.team_id = ids.team_id
            )
          );

      v_result := predictor_internal.resolve_predicted_group_order(
        v_team_ids,
        v_matches,
        v_resolutions
      );

      select count(*), count(distinct standing ->> 'teamId')
        into v_result_count, v_result_unique
        from jsonb_array_elements(v_result -> 'standings') as rows(standing);

      if jsonb_array_length(v_result -> 'unresolvedGroups') <> 0
         or v_result_count <> 4
         or v_result_unique <> 4
      then
        raise exception 'Submitted-entry preflight found unresolved group % for entry %',
          v_group.letter, v_entry.id
          using errcode = 'check_violation';
      end if;
    end loop;

    select
      count(*) filter (where pp.stage = 'champion'),
      count(*) filter (where pp.stage = 'final'),
      count(*) filter (where pp.stage = 'sf'),
      count(*) filter (where pp.stage = 'qf'),
      count(*) filter (where pp.stage = 'r16'),
      count(*)
      into v_champion, v_final, v_sf, v_qf, v_r16, v_progression_total
      from public.predicted_progression pp
      where pp.entry_id = v_entry.id;

    select count(*)
      into v_foreign_progression
      from public.predicted_progression pp
      join public.teams t on t.id = pp.team_id
      where pp.entry_id = v_entry.id
        and t.tournament_id <> v_entry.tournament_id;

    select count(*)
      into v_foreign_bonus
      from public.bonus_predictions bp
      join public.players p on p.id = bp.golden_boot_player_id
      where bp.entry_id = v_entry.id
        and bp.golden_boot_player_id is not null
        and p.tournament_id <> v_entry.tournament_id;

    if v_champion <> 1
       or v_final <> 1
       or v_sf <> 2
       or v_qf <> 4
       or v_r16 <> 0
       or v_progression_total <> 8
       or v_foreign_progression <> 0
       or v_foreign_bonus <> 0
    then
      raise exception 'Submitted-entry preflight found invalid bracket or bonus data for entry %',
        v_entry.id
        using errcode = 'check_violation';
    end if;
  end loop;
end;
$$;

commit;
