-- Postflight for DB-INTEGRITY-ENTRY-BOUNDARY-1.
--
-- Group-position snapshots have now been rebuilt from authoritative saved input.
-- Revalidate every existing submitted entry before accepting submitted_at as a
-- trusted eligibility marker under the new RPC-only boundary. Fail closed so a
-- hosted rollout requires explicit remediation instead of silently preserving an
-- incomplete or cross-tournament legacy submission.

begin;

do $$
declare
  v_entry record;
  v_lock timestamptz;
  v_group_count integer;
  v_group_total integer;
  v_group_done integer;
  v_position_count integer;
  v_foreign_matches integer;
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

    select count(*)
      into v_group_count
      from public.groups g
      where g.tournament_id = v_entry.tournament_id;

    select count(*)
      into v_group_total
      from public.matches m
      where m.tournament_id = v_entry.tournament_id
        and m.round = 'group';

    select count(*)
      into v_group_done
      from public.match_predictions mp
      join public.matches m on m.id = mp.match_id
      where mp.entry_id = v_entry.id
        and m.tournament_id = v_entry.tournament_id
        and m.round = 'group';

    select count(*)
      into v_foreign_matches
      from public.match_predictions mp
      join public.matches m on m.id = mp.match_id
      where mp.entry_id = v_entry.id
        and (
          m.tournament_id <> v_entry.tournament_id
          or m.round <> 'group'
        );

    select count(*)
      into v_position_count
      from public.predicted_group_positions pgp
      join public.groups g on g.id = pgp.group_id
      where pgp.entry_id = v_entry.id
        and g.tournament_id = v_entry.tournament_id;

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

    if v_lock is null
       or v_entry.submitted_at >= v_lock
       or v_group_count = 0
       or v_group_total = 0
       or v_group_done <> v_group_total
       or v_foreign_matches <> 0
       or v_position_count <> v_group_count * 4
       or v_champion <> 1
       or v_final <> 1
       or v_sf <> 2
       or v_qf <> 4
       or v_r16 <> 0
       or v_progression_total <> 8
       or v_foreign_progression <> 0
       or v_foreign_bonus <> 0
    then
      raise exception 'Entry-boundary postflight failed for submitted entry %', v_entry.id
        using errcode = 'check_violation';
    end if;
  end loop;
end;
$$;

commit;
