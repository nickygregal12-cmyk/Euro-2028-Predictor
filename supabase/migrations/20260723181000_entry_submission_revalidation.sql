-- Finalise DB-INTEGRITY-ENTRY-BOUNDARY-1 by centralising submission validation
-- and revalidating every legacy row already marked submitted.
--
-- The preceding migration rebuilds derived group-position snapshots before the
-- new lock trigger is installed. This migration then proves that each existing
-- submitted entry still satisfies the same server rules as a fresh submission.
-- Invalid legacy state fails the migration rather than remaining leaderboard-
-- eligible behind a now-protected submitted_at value.

begin;

create or replace function predictor_internal.validate_entry_submission_snapshot(
  p_entry_id uuid,
  p_refresh_positions boolean default true
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_tournament uuid;
  v_group_total integer;
  v_group_done integer;
  v_group_count integer;
  v_position_total integer;
  v_position_scoped integer;
  v_foreign_matches integer;
  v_champion integer;
  v_final integer;
  v_sf integer;
  v_qf integer;
  v_prog_total integer;
  v_r16 integer;
  v_foreign_progression integer;
  v_foreign_bonus integer;
  v_group record;
begin
  select e.tournament_id
    into v_tournament
    from public.entries e
    where e.id = p_entry_id;

  if v_tournament is null then
    raise exception 'Entry does not exist'
      using errcode = 'foreign_key_violation';
  end if;

  select count(*)
    into v_group_total
    from public.matches m
    where m.tournament_id = v_tournament
      and m.round = 'group';

  select count(*)
    into v_group_done
    from public.match_predictions mp
    join public.matches m
      on m.id = mp.match_id
    where mp.entry_id = p_entry_id
      and m.tournament_id = v_tournament
      and m.round = 'group';

  select count(*)
    into v_foreign_matches
    from public.match_predictions mp
    join public.matches m
      on m.id = mp.match_id
    where mp.entry_id = p_entry_id
      and (
        m.tournament_id <> v_tournament
        or m.round <> 'group'
      );

  if v_foreign_matches > 0 then
    raise exception 'Entry contains a match prediction outside its tournament'
      using errcode = 'check_violation';
  end if;

  if v_group_total = 0 or v_group_done <> v_group_total then
    raise exception 'Group predictions incomplete (% of %)', v_group_done, v_group_total
      using errcode = 'check_violation';
  end if;

  select count(*)
    into v_group_count
    from public.groups g
    where g.tournament_id = v_tournament;

  if v_group_count = 0 then
    raise exception 'Tournament has no groups'
      using errcode = 'check_violation';
  end if;

  if p_refresh_positions then
    for v_group in
      select g.id, g.letter
      from public.groups g
      where g.tournament_id = v_tournament
      order by g.letter
    loop
      perform predictor_internal.refresh_entry_group_positions(
        p_entry_id,
        v_group.id,
        true
      );
    end loop;
  end if;

  select
    count(*),
    count(*) filter (where g.tournament_id = v_tournament)
    into v_position_total, v_position_scoped
    from public.predicted_group_positions pgp
    join public.groups g
      on g.id = pgp.group_id
    where pgp.entry_id = p_entry_id;

  if v_position_total <> v_group_count * 4
     or v_position_scoped <> v_position_total
  then
    raise exception 'Predicted group positions are incomplete or out of scope (% of %)',
      v_position_scoped, v_group_count * 4
      using errcode = 'check_violation';
  end if;

  select
    count(*) filter (where pp.stage = 'champion'),
    count(*) filter (where pp.stage = 'final'),
    count(*) filter (where pp.stage = 'sf'),
    count(*) filter (where pp.stage = 'qf'),
    count(*),
    count(*) filter (where pp.stage = 'r16')
    into v_champion, v_final, v_sf, v_qf, v_prog_total, v_r16
    from public.predicted_progression pp
    where pp.entry_id = p_entry_id;

  if v_champion <> 1 or v_final <> 1 or v_sf <> 2 or v_qf <> 4 then
    raise exception 'Bracket incomplete — pick all 15 winners'
      using errcode = 'check_violation';
  end if;

  if v_r16 > 0 then
    raise exception 'Bracket has invalid round-of-16 rows — re-pick your winners'
      using errcode = 'check_violation';
  end if;

  if v_prog_total <> 8 then
    raise exception 'Bracket has % progression rows, expected 8', v_prog_total
      using errcode = 'check_violation';
  end if;

  select count(*)
    into v_foreign_progression
    from public.predicted_progression pp
    join public.teams t
      on t.id = pp.team_id
    where pp.entry_id = p_entry_id
      and t.tournament_id <> v_tournament;

  if v_foreign_progression > 0 then
    raise exception 'Bracket contains a team that is not in this tournament'
      using errcode = 'check_violation';
  end if;

  select count(*)
    into v_foreign_bonus
    from public.bonus_predictions bp
    join public.players p
      on p.id = bp.golden_boot_player_id
    where bp.entry_id = p_entry_id
      and bp.golden_boot_player_id is not null
      and p.tournament_id <> v_tournament;

  if v_foreign_bonus > 0 then
    raise exception 'Golden Boot prediction is not in this tournament'
      using errcode = 'check_violation';
  end if;

  return v_tournament;
end;
$$;

revoke all on function predictor_internal.validate_entry_submission_snapshot(uuid, boolean)
  from public, anon, authenticated;

-- Revalidate every legacy submission after the previous migration rebuilt its
-- derived group-position snapshot. A missing lock, late timestamp or malformed
-- entry stops deployment for explicit repair instead of being silently trusted.
do $$
declare
  v_entry record;
begin
  for v_entry in
    select e.id, e.submitted_at, t.lock_at
    from public.entries e
    join public.tournaments t
      on t.id = e.tournament_id
    where e.submitted_at is not null
    order by e.id
  loop
    if v_entry.lock_at is null then
      raise exception 'Entry-boundary legacy validation failed: submitted entry % has no lock',
        v_entry.id
        using errcode = 'check_violation';
    end if;

    if v_entry.submitted_at >= v_entry.lock_at then
      raise exception 'Entry-boundary legacy validation failed: entry % was submitted at or after lock',
        v_entry.id
        using errcode = 'check_violation';
    end if;

    perform predictor_internal.validate_entry_submission_snapshot(
      v_entry.id,
      false
    );
  end loop;
end;
$$;

create or replace function public.submit_entry(p_entry_id uuid)
returns timestamptz
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid;
  v_lock timestamptz;
  v_when timestamptz;
begin
  select e.user_id, t.lock_at
    into v_user, v_lock
    from public.entries e
    join public.tournaments t
      on t.id = e.tournament_id
    where e.id = p_entry_id
    for update of e;

  if v_user is null or v_user <> (select auth.uid()) then
    raise exception 'Not your entry'
      using errcode = 'insufficient_privilege';
  end if;

  if v_lock is null then
    raise exception 'Tournament lock is not configured'
      using errcode = 'check_violation';
  end if;

  if now() >= v_lock then
    raise exception 'Entry submission is closed — the tournament has started'
      using errcode = 'check_violation';
  end if;

  perform predictor_internal.validate_entry_submission_snapshot(
    p_entry_id,
    true
  );

  update public.entries
    set submitted_at = coalesce(submitted_at, now())
    where id = p_entry_id
    returning submitted_at into v_when;

  return v_when;
end;
$$;

revoke all on function public.submit_entry(uuid) from public, anon;
grant execute on function public.submit_entry(uuid) to authenticated;

commit;
