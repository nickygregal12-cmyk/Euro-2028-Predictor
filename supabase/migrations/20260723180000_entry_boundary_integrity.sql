-- Euro 2028 Predictor — DB-INTEGRITY-ENTRY-BOUNDARY-1
--
-- Server-owned group-position snapshots, RPC-only submission state, strict
-- tournament scoping and lock-safe deletion. This migration is append-only and
-- is designed for the disposable local Supabase integration workflow.
--
-- It deliberately does not implement bracket-tree replay, automatic submission,
-- knockout result modelling, browser UI changes or hosted-environment checks.

begin;

-- ---------------------------------------------------------------------------
-- Entry ownership remains client-readable/creatable, but submitted_at is now a
-- server-owned transition. A client-created entry must begin unsubmitted.
-- ---------------------------------------------------------------------------
drop policy if exists "own entries" on public.entries;
drop policy if exists "own entries select" on public.entries;
drop policy if exists "own entries insert" on public.entries;

create policy "own entries select" on public.entries
  for select to authenticated
  using (user_id = (select auth.uid()));

create policy "own entries insert" on public.entries
  for insert to authenticated
  with check (
    user_id = (select auth.uid())
    and submitted_at is null
  );

revoke update, delete on table public.entries from public, anon, authenticated;
grant select, insert on table public.entries to authenticated;

-- predicted_group_positions is a derived scoring snapshot. Clients may read
-- their own rows but may never insert, alter or delete them directly.
drop policy if exists "own predicted_group_positions" on public.predicted_group_positions;
drop policy if exists "own predicted_group_positions select" on public.predicted_group_positions;

create policy "own predicted_group_positions select"
  on public.predicted_group_positions
  for select to authenticated
  using (exists (
    select 1
    from public.entries e
    where e.id = predicted_group_positions.entry_id
      and e.user_id = (select auth.uid())
  ));

revoke insert, update, delete
  on table public.predicted_group_positions
  from public, anon, authenticated;
grant select on table public.predicted_group_positions to authenticated;

-- ---------------------------------------------------------------------------
-- Same-tournament validation for every user-owned prediction relationship.
-- Trigger functions are private SECURITY DEFINER helpers so checks are not
-- weakened by caller RLS visibility.
-- ---------------------------------------------------------------------------
create or replace function predictor_internal.validate_match_prediction_scope()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_entry_tournament uuid;
  v_match_tournament uuid;
  v_round text;
begin
  select e.tournament_id
    into v_entry_tournament
    from public.entries e
    where e.id = new.entry_id;

  select m.tournament_id, m.round
    into v_match_tournament, v_round
    from public.matches m
    where m.id = new.match_id;

  if v_entry_tournament is null or v_match_tournament is null then
    raise exception 'Prediction references a missing entry or match'
      using errcode = 'foreign_key_violation';
  end if;

  if v_entry_tournament <> v_match_tournament or v_round <> 'group' then
    raise exception 'Match prediction must reference a group match in the entry tournament'
      using errcode = 'check_violation';
  end if;

  return new;
end;
$$;

create or replace function predictor_internal.validate_progression_scope()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_entry_tournament uuid;
  v_team_tournament uuid;
begin
  select e.tournament_id
    into v_entry_tournament
    from public.entries e
    where e.id = new.entry_id;

  select t.tournament_id
    into v_team_tournament
    from public.teams t
    where t.id = new.team_id;

  if v_entry_tournament is null or v_team_tournament is null then
    raise exception 'Progression references a missing entry or team'
      using errcode = 'foreign_key_violation';
  end if;

  if v_entry_tournament <> v_team_tournament then
    raise exception 'Progression team must belong to the entry tournament'
      using errcode = 'check_violation';
  end if;

  return new;
end;
$$;

create or replace function predictor_internal.validate_bonus_scope()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_entry_tournament uuid;
  v_player_tournament uuid;
begin
  if new.golden_boot_player_id is null then
    return new;
  end if;

  select e.tournament_id
    into v_entry_tournament
    from public.entries e
    where e.id = new.entry_id;

  select p.tournament_id
    into v_player_tournament
    from public.players p
    where p.id = new.golden_boot_player_id;

  if v_entry_tournament is null or v_player_tournament is null then
    raise exception 'Bonus prediction references a missing entry or player'
      using errcode = 'foreign_key_violation';
  end if;

  if v_entry_tournament <> v_player_tournament then
    raise exception 'Golden Boot player must belong to the entry tournament'
      using errcode = 'check_violation';
  end if;

  return new;
end;
$$;

create or replace function predictor_internal.validate_tie_resolution_scope()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_entry_tournament uuid;
  v_team_count integer;
  v_unique_count integer;
  v_group_count integer;
  v_expected_key text;
begin
  select e.tournament_id
    into v_entry_tournament
    from public.entries e
    where e.id = new.entry_id;

  if v_entry_tournament is null then
    raise exception 'Tie resolution references a missing entry'
      using errcode = 'foreign_key_violation';
  end if;

  if cardinality(new.ordered_team_ids) < 2 then
    raise exception 'Tie resolution must contain at least two teams'
      using errcode = 'check_violation';
  end if;

  select count(*), count(distinct ids.team_id), count(distinct gt.group_id)
    into v_team_count, v_unique_count, v_group_count
    from unnest(new.ordered_team_ids) as ids(team_id)
    join public.teams t
      on t.id = ids.team_id
     and t.tournament_id = v_entry_tournament
    join public.group_teams gt
      on gt.team_id = ids.team_id;

  if v_team_count <> cardinality(new.ordered_team_ids)
     or v_unique_count <> cardinality(new.ordered_team_ids)
  then
    raise exception 'Tie resolution teams must be unique members of the entry tournament'
      using errcode = 'check_violation';
  end if;

  select string_agg(ids.team_id::text, '|' order by ids.team_id::text)
    into v_expected_key
    from unnest(new.ordered_team_ids) as ids(team_id);

  if new.tie_key <> v_expected_key then
    raise exception 'Tie resolution key does not match its team set'
      using errcode = 'check_violation';
  end if;

  if new.scope = 'group' and v_group_count <> 1 then
    raise exception 'A group tie resolution must contain teams from one group'
      using errcode = 'check_violation';
  end if;

  if new.scope = 'third'
     and v_group_count <> cardinality(new.ordered_team_ids)
  then
    raise exception 'A third-place tie resolution must contain at most one team per group'
      using errcode = 'check_violation';
  end if;

  return new;
end;
$$;

create or replace function predictor_internal.validate_group_position_scope()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_entry_tournament uuid;
  v_group_tournament uuid;
  v_team_tournament uuid;
begin
  select e.tournament_id
    into v_entry_tournament
    from public.entries e
    where e.id = new.entry_id;

  select g.tournament_id
    into v_group_tournament
    from public.groups g
    where g.id = new.group_id;

  select t.tournament_id
    into v_team_tournament
    from public.teams t
    where t.id = new.team_id;

  if v_entry_tournament is null
     or v_group_tournament is null
     or v_team_tournament is null
  then
    raise exception 'Group position references a missing entry, group or team'
      using errcode = 'foreign_key_violation';
  end if;

  if v_entry_tournament <> v_group_tournament
     or v_entry_tournament <> v_team_tournament
     or not exists (
       select 1
       from public.group_teams gt
       where gt.group_id = new.group_id
         and gt.team_id = new.team_id
     )
  then
    raise exception 'Predicted group position must use an in-group team from the entry tournament'
      using errcode = 'check_violation';
  end if;

  return new;
end;
$$;

revoke all on function predictor_internal.validate_match_prediction_scope()
  from public, anon, authenticated;
revoke all on function predictor_internal.validate_progression_scope()
  from public, anon, authenticated;
revoke all on function predictor_internal.validate_bonus_scope()
  from public, anon, authenticated;
revoke all on function predictor_internal.validate_tie_resolution_scope()
  from public, anon, authenticated;
revoke all on function predictor_internal.validate_group_position_scope()
  from public, anon, authenticated;

drop trigger if exists validate_match_prediction_scope on public.match_predictions;
create trigger validate_match_prediction_scope
  before insert or update of entry_id, match_id
  on public.match_predictions
  for each row
  execute function predictor_internal.validate_match_prediction_scope();

drop trigger if exists validate_progression_scope on public.predicted_progression;
create trigger validate_progression_scope
  before insert or update of entry_id, team_id
  on public.predicted_progression
  for each row
  execute function predictor_internal.validate_progression_scope();

drop trigger if exists validate_bonus_scope on public.bonus_predictions;
create trigger validate_bonus_scope
  before insert or update of entry_id, golden_boot_player_id
  on public.bonus_predictions
  for each row
  execute function predictor_internal.validate_bonus_scope();

drop trigger if exists validate_tie_resolution_scope on public.predicted_tie_resolutions;
create trigger validate_tie_resolution_scope
  before insert or update of entry_id, scope, tie_key, ordered_team_ids
  on public.predicted_tie_resolutions
  for each row
  execute function predictor_internal.validate_tie_resolution_scope();

drop trigger if exists validate_group_position_scope on public.predicted_group_positions;
create trigger validate_group_position_scope
  before insert or update of entry_id, group_id, team_id, position
  on public.predicted_group_positions
  for each row
  execute function predictor_internal.validate_group_position_scope();

-- ---------------------------------------------------------------------------
-- Materialise one group's current predicted order from saved scores and exact
-- manual group-tie resolutions. Incomplete or unresolved groups have no trusted
-- snapshot; strict mode raises instead of returning false.
-- ---------------------------------------------------------------------------
create or replace function predictor_internal.refresh_entry_group_positions(
  p_entry_id uuid,
  p_group_id uuid,
  p_require_complete boolean default false
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_entry_tournament uuid;
  v_group_tournament uuid;
  v_group_letter text;
  v_team_ids jsonb;
  v_team_count integer;
  v_match_total integer;
  v_match_done integer;
  v_matches jsonb;
  v_resolutions jsonb;
  v_result jsonb;
  v_result_count integer;
  v_result_unique integer;
  v_result_in_group integer;
begin
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(p_entry_id::text || ':' || p_group_id::text, 0)
  );

  select e.tournament_id
    into v_entry_tournament
    from public.entries e
    where e.id = p_entry_id;

  select g.tournament_id, g.letter
    into v_group_tournament, v_group_letter
    from public.groups g
    where g.id = p_group_id;

  if v_entry_tournament is null or v_group_tournament is null then
    raise exception 'Cannot refresh positions for a missing entry or group'
      using errcode = 'foreign_key_violation';
  end if;

  if v_entry_tournament <> v_group_tournament then
    raise exception 'Group does not belong to the entry tournament'
      using errcode = 'check_violation';
  end if;

  select
    coalesce(jsonb_agg(to_jsonb(gt.team_id::text) order by gt.slot), '[]'::jsonb),
    count(*)
    into v_team_ids, v_team_count
    from public.group_teams gt
    join public.teams t
      on t.id = gt.team_id
     and t.tournament_id = v_entry_tournament
    where gt.group_id = p_group_id;

  select count(*)
    into v_match_total
    from public.matches m
    where m.group_id = p_group_id
      and m.tournament_id = v_entry_tournament
      and m.round = 'group';

  select count(*)
    into v_match_done
    from public.match_predictions mp
    join public.matches m
      on m.id = mp.match_id
    where mp.entry_id = p_entry_id
      and m.group_id = p_group_id
      and m.tournament_id = v_entry_tournament
      and m.round = 'group'
      and m.home_team_id is not null
      and m.away_team_id is not null;

  if v_team_count <> 4 or v_match_total <> 6 or v_match_done <> v_match_total then
    delete from public.predicted_group_positions
      where entry_id = p_entry_id
        and group_id = p_group_id;

    if p_require_complete then
      raise exception 'Group % is incomplete or has invalid reference data', v_group_letter
        using errcode = 'check_violation';
    end if;
    return false;
  end if;

  select coalesce(
    jsonb_agg(
      jsonb_build_array(
        m.home_team_id::text,
        m.away_team_id::text,
        mp.home_score,
        mp.away_score
      )
      order by m.match_ref
    ),
    '[]'::jsonb
  )
    into v_matches
    from public.match_predictions mp
    join public.matches m
      on m.id = mp.match_id
    where mp.entry_id = p_entry_id
      and m.group_id = p_group_id
      and m.tournament_id = v_entry_tournament
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
    where ptr.entry_id = p_entry_id
      and ptr.scope = 'group'
      and not exists (
        select 1
        from unnest(ptr.ordered_team_ids) as ids(team_id)
        where not exists (
          select 1
          from public.group_teams gt
          where gt.group_id = p_group_id
            and gt.team_id = ids.team_id
        )
      )
      and exists (
        select 1
        from unnest(ptr.ordered_team_ids) as ids(team_id)
      );

  v_result := predictor_internal.resolve_predicted_group_order(
    v_team_ids,
    v_matches,
    v_resolutions
  );

  if jsonb_array_length(v_result -> 'unresolvedGroups') > 0 then
    delete from public.predicted_group_positions
      where entry_id = p_entry_id
        and group_id = p_group_id;

    if p_require_complete then
      raise exception 'Group % still has an unresolved predicted tie', v_group_letter
        using errcode = 'check_violation';
    end if;
    return false;
  end if;

  select
    count(*),
    count(distinct standing ->> 'teamId'),
    count(*) filter (
      where exists (
        select 1
        from public.group_teams gt
        where gt.group_id = p_group_id
          and gt.team_id = (standing ->> 'teamId')::uuid
      )
    )
    into v_result_count, v_result_unique, v_result_in_group
    from jsonb_array_elements(v_result -> 'standings') as rows(standing);

  if v_result_count <> 4
     or v_result_unique <> 4
     or v_result_in_group <> 4
  then
    raise exception 'Predicted group resolver returned an invalid four-team order'
      using errcode = 'data_exception';
  end if;

  delete from public.predicted_group_positions
    where entry_id = p_entry_id
      and group_id = p_group_id;

  insert into public.predicted_group_positions (
    entry_id,
    group_id,
    team_id,
    position,
    updated_at
  )
  select
    p_entry_id,
    p_group_id,
    (standing ->> 'teamId')::uuid,
    ordinality::smallint,
    now()
  from jsonb_array_elements(v_result -> 'standings')
    with ordinality as rows(standing, ordinality);

  return true;
end;
$$;

revoke all on function predictor_internal.refresh_entry_group_positions(uuid, uuid, boolean)
  from public, anon, authenticated;

-- Ordinary score edits keep the derived snapshot current. An incomplete or
-- unresolved group safely removes its old snapshot.
create or replace function predictor_internal.refresh_group_positions_from_match()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_old_group uuid;
  v_new_group uuid;
begin
  if tg_op in ('UPDATE', 'DELETE') then
    select m.group_id
      into v_old_group
      from public.matches m
      where m.id = old.match_id;

    if v_old_group is not null then
      perform predictor_internal.refresh_entry_group_positions(
        old.entry_id,
        v_old_group,
        false
      );
    end if;
  end if;

  if tg_op in ('INSERT', 'UPDATE') then
    select m.group_id
      into v_new_group
      from public.matches m
      where m.id = new.match_id;

    if v_new_group is not null
       and (
         tg_op = 'INSERT'
         or new.entry_id is distinct from old.entry_id
         or v_new_group is distinct from v_old_group
         or new.home_score is distinct from old.home_score
         or new.away_score is distinct from old.away_score
       )
    then
      perform predictor_internal.refresh_entry_group_positions(
        new.entry_id,
        v_new_group,
        false
      );
    end if;
  end if;

  return coalesce(new, old);
end;
$$;

create or replace function predictor_internal.refresh_group_positions_from_tie()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_old_group uuid;
  v_new_group uuid;
begin
  if tg_op in ('UPDATE', 'DELETE') and old.scope = 'group' then
    select gt.group_id
      into v_old_group
      from public.group_teams gt
      where gt.team_id = old.ordered_team_ids[1];

    if v_old_group is not null then
      perform predictor_internal.refresh_entry_group_positions(
        old.entry_id,
        v_old_group,
        false
      );
    end if;
  end if;

  if tg_op in ('INSERT', 'UPDATE') and new.scope = 'group' then
    select gt.group_id
      into v_new_group
      from public.group_teams gt
      where gt.team_id = new.ordered_team_ids[1];

    if v_new_group is not null
       and (
         tg_op = 'INSERT'
         or new.entry_id is distinct from old.entry_id
         or v_new_group is distinct from v_old_group
         or new.ordered_team_ids is distinct from old.ordered_team_ids
       )
    then
      perform predictor_internal.refresh_entry_group_positions(
        new.entry_id,
        v_new_group,
        false
      );
    end if;
  end if;

  return coalesce(new, old);
end;
$$;

revoke all on function predictor_internal.refresh_group_positions_from_match()
  from public, anon, authenticated;
revoke all on function predictor_internal.refresh_group_positions_from_tie()
  from public, anon, authenticated;

drop trigger if exists refresh_group_positions_after_match_prediction
  on public.match_predictions;
create trigger refresh_group_positions_after_match_prediction
  after insert or update of entry_id, match_id, home_score, away_score or delete
  on public.match_predictions
  for each row
  execute function predictor_internal.refresh_group_positions_from_match();

drop trigger if exists refresh_group_positions_after_tie_resolution
  on public.predicted_tie_resolutions;
create trigger refresh_group_positions_after_tie_resolution
  after insert or update of entry_id, scope, ordered_team_ids or delete
  on public.predicted_tie_resolutions
  for each row
  execute function predictor_internal.refresh_group_positions_from_tie();

-- Rebuild every existing entry/group snapshot from trusted source rows before
-- applying the new lock trigger. Incomplete or unresolved groups are cleared.
do $$
declare
  v_row record;
begin
  for v_row in
    select e.id as entry_id, g.id as group_id
    from public.entries e
    join public.groups g
      on g.tournament_id = e.tournament_id
  loop
    perform predictor_internal.refresh_entry_group_positions(
      v_row.entry_id,
      v_row.group_id,
      false
    );
  end loop;
end;
$$;

-- Group-position snapshots are frozen at tournament lock. Match-prediction
-- deletion is also brought under the existing generic lock.
drop trigger if exists enforce_lock_group_positions
  on public.predicted_group_positions;
create trigger enforce_lock_group_positions
  before insert or update or delete
  on public.predicted_group_positions
  for each row
  execute function public.enforce_entry_lock_generic();

drop trigger if exists enforce_lock_match_prediction_delete
  on public.match_predictions;
create trigger enforce_lock_match_prediction_delete
  before delete
  on public.match_predictions
  for each row
  execute function public.enforce_entry_lock_generic();

-- ---------------------------------------------------------------------------
-- Submission is now a SECURITY DEFINER transaction boundary. It explicitly
-- verifies ownership, lock time, tournament scope, complete group predictions,
-- derived group-position snapshots and the existing winner-only bracket shape.
-- ---------------------------------------------------------------------------
create or replace function public.submit_entry(p_entry_id uuid)
returns timestamptz
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid;
  v_tournament uuid;
  v_lock timestamptz;
  v_group_total integer;
  v_group_done integer;
  v_group_count integer;
  v_position_count integer;
  v_foreign_matches integer;
  v_champion integer;
  v_final integer;
  v_sf integer;
  v_qf integer;
  v_prog_total integer;
  v_r16 integer;
  v_foreign_progression integer;
  v_foreign_bonus integer;
  v_when timestamptz;
  v_group record;
begin
  select e.user_id, e.tournament_id, t.lock_at
    into v_user, v_tournament, v_lock
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

  select count(*)
    into v_position_count
    from public.predicted_group_positions pgp
    join public.groups g
      on g.id = pgp.group_id
    where pgp.entry_id = p_entry_id
      and g.tournament_id = v_tournament;

  if v_position_count <> v_group_count * 4 then
    raise exception 'Predicted group positions are incomplete (% of %)',
      v_position_count, v_group_count * 4
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
