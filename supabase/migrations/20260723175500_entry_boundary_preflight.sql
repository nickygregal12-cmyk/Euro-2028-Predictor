-- Preflight for DB-INTEGRITY-ENTRY-BOUNDARY-1.
--
-- New triggers protect future writes, but they cannot retroactively validate rows
-- already present in a hosted database. Fail the migration rather than silently
-- inheriting cross-tournament scoring inputs. Derived group-position rows are
-- validated here and rebuilt transactionally by the following migration.

begin;

do $$
begin
  if exists (
    select 1
    from public.match_predictions mp
    join public.entries e on e.id = mp.entry_id
    join public.matches m on m.id = mp.match_id
    where e.tournament_id <> m.tournament_id
       or m.round <> 'group'
  ) then
    raise exception 'Entry-boundary preflight failed: invalid match prediction scope exists'
      using errcode = 'check_violation';
  end if;

  if exists (
    select 1
    from public.predicted_progression pp
    join public.entries e on e.id = pp.entry_id
    join public.teams t on t.id = pp.team_id
    where e.tournament_id <> t.tournament_id
  ) then
    raise exception 'Entry-boundary preflight failed: invalid progression scope exists'
      using errcode = 'check_violation';
  end if;

  if exists (
    select 1
    from public.bonus_predictions bp
    join public.entries e on e.id = bp.entry_id
    join public.players p on p.id = bp.golden_boot_player_id
    where bp.golden_boot_player_id is not null
      and e.tournament_id <> p.tournament_id
  ) then
    raise exception 'Entry-boundary preflight failed: invalid bonus prediction scope exists'
      using errcode = 'check_violation';
  end if;

  if exists (
    select 1
    from public.predicted_tie_resolutions ptr
    join public.entries e on e.id = ptr.entry_id
    cross join lateral (
      select
        count(*)::integer as member_count,
        count(distinct ids.team_id)::integer as unique_count,
        count(t.id)::integer as tournament_member_count,
        count(gt.group_id)::integer as grouped_count,
        count(distinct gt.group_id)::integer as distinct_group_count,
        string_agg(ids.team_id::text, '|' order by ids.team_id::text) as expected_key
      from unnest(ptr.ordered_team_ids) as ids(team_id)
      left join public.teams t
        on t.id = ids.team_id
       and t.tournament_id = e.tournament_id
      left join public.group_teams gt
        on gt.team_id = t.id
    ) as checked
    where checked.member_count < 2
       or checked.unique_count <> checked.member_count
       or checked.tournament_member_count <> checked.member_count
       or checked.grouped_count <> checked.member_count
       or checked.expected_key <> ptr.tie_key
       or (ptr.scope = 'group' and checked.distinct_group_count <> 1)
       or (
         ptr.scope = 'third'
         and checked.distinct_group_count <> checked.member_count
       )
  ) then
    raise exception 'Entry-boundary preflight failed: invalid tie-resolution scope exists'
      using errcode = 'check_violation';
  end if;

  if exists (
    select 1
    from public.predicted_group_positions pgp
    join public.entries e on e.id = pgp.entry_id
    join public.groups g on g.id = pgp.group_id
    join public.teams t on t.id = pgp.team_id
    where e.tournament_id <> g.tournament_id
       or e.tournament_id <> t.tournament_id
       or not exists (
         select 1
         from public.group_teams gt
         where gt.group_id = pgp.group_id
           and gt.team_id = pgp.team_id
       )
  ) then
    raise exception 'Entry-boundary preflight failed: invalid group-position scope exists'
      using errcode = 'check_violation';
  end if;
end;
$$;

commit;
