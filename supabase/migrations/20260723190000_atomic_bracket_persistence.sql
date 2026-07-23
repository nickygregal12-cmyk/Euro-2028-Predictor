-- Euro 2028 Predictor — REL-004 atomic predicted-bracket persistence
--
-- The bracket UI works with one logical winner tree, but the original client
-- persistence path issued independent INSERT/UPDATE/DELETE statements for each
-- predicted_progression row. A mid-batch failure could therefore leave a partial
-- server state even though the browser treated the change as one action.
--
-- This migration makes the complete progression set a server transaction:
--
--   * authenticated clients lose direct predicted_progression DML;
--   * replace_predicted_progression() owns the full replacement;
--   * the entry row and an entry-scoped advisory lock serialize replacement with
--     submission and other bracket writers;
--   * the caller must echo the complete version snapshot it last read;
--   * any added, removed or changed row on another device raises PT409 before a
--     mutation occurs;
--   * the desired set is validated for ownership, lock time, tournament scope
--     and partial bracket cardinality;
--   * a complete 1/1/2/4 set is replayed through the FUNC-001 validator before
--     the transaction commits; and
--   * the authoritative replacement snapshot is returned to the client.
--
-- No hosted project is touched by this migration.

begin;

-- ---------------------------------------------------------------------------
-- predicted_progression becomes RPC-written and client-read-only.
-- ---------------------------------------------------------------------------
drop policy if exists "own predicted_progression" on public.predicted_progression;
drop policy if exists "own predicted_progression select" on public.predicted_progression;

create policy "own predicted_progression select"
  on public.predicted_progression
  for select to authenticated
  using (exists (
    select 1
    from public.entries e
    where e.id = predicted_progression.entry_id
      and e.user_id = (select auth.uid())
  ));

revoke insert, update, delete
  on table public.predicted_progression
  from public, anon, authenticated;
grant select on table public.predicted_progression to authenticated;

-- ---------------------------------------------------------------------------
-- Replace the complete winner-only progression snapshot in one transaction.
--
-- p_desired is a JSON object keyed by team UUID with values qf/sf/final/champion.
-- p_expected_versions is the complete server snapshot last read by the client,
-- keyed by every currently persisted team UUID. New desired teams are therefore
-- absent from p_expected_versions; deleted teams remain present in it.
-- ---------------------------------------------------------------------------
create or replace function public.replace_predicted_progression(
  p_entry_id uuid,
  p_desired jsonb,
  p_expected_versions jsonb
)
returns table (
  team_id uuid,
  stage text,
  version integer
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid;
  v_tournament uuid;
  v_lock timestamptz;
  v_current_count integer;
  v_expected_count integer;
  v_mismatch_count integer;
  v_total integer;
  v_qf integer;
  v_sf integer;
  v_final integer;
  v_champion integer;
  v_item record;
  v_team uuid;
begin
  if p_desired is null or pg_catalog.jsonb_typeof(p_desired) <> 'object' then
    raise exception 'Desired bracket progression must be a JSON object'
      using errcode = 'check_violation';
  end if;

  if p_expected_versions is null
     or pg_catalog.jsonb_typeof(p_expected_versions) <> 'object'
  then
    raise exception 'Expected bracket versions must be a JSON object'
      using errcode = 'check_violation';
  end if;

  select e.user_id, e.tournament_id, t.lock_at
    into v_user, v_tournament, v_lock
    from public.entries e
    join public.tournaments t on t.id = e.tournament_id
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

  if pg_catalog.now() >= v_lock then
    raise exception 'Predictions are locked — the tournament has started'
      using errcode = 'check_violation';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended('predicted-progression:' || p_entry_id::text, 0)
  );

  -- Expected versions must be non-negative whole JSON numbers.
  if exists (
    select 1
    from pg_catalog.jsonb_each(p_expected_versions) e
    where pg_catalog.jsonb_typeof(e.value) <> 'number'
       or (e.value #>> '{}') !~ '^[0-9]+$'
  ) then
    raise exception 'Expected bracket versions must be non-negative integers'
      using errcode = 'check_violation';
  end if;

  select count(*)::integer
    into v_current_count
    from public.predicted_progression pp
    where pp.entry_id = p_entry_id;

  select count(*)::integer
    into v_expected_count
    from pg_catalog.jsonb_object_keys(p_expected_versions);

  select count(*)::integer
    into v_mismatch_count
    from public.predicted_progression pp
    where pp.entry_id = p_entry_id
      and (
        not (p_expected_versions ? pp.team_id::text)
        or (p_expected_versions ->> pp.team_id::text)::integer <> pp.version
      );

  if v_current_count <> v_expected_count or v_mismatch_count > 0 then
    raise exception 'prediction version conflict (complete bracket snapshot changed)'
      using errcode = 'PT409';
  end if;

  -- Validate every desired team and stage before any row is changed.
  for v_item in
    select d.key as team_key, d.value as desired_stage
    from pg_catalog.jsonb_each_text(p_desired) d
  loop
    begin
      v_team := v_item.team_key::uuid;
    exception when invalid_text_representation then
      raise exception 'Bracket progression contains an invalid team id'
        using errcode = 'check_violation';
    end;

    if v_item.desired_stage not in ('qf', 'sf', 'final', 'champion') then
      raise exception 'Bracket progression contains an invalid stage'
        using errcode = 'check_violation';
    end if;

    if not exists (
      select 1
      from public.teams t
      where t.id = v_team
        and t.tournament_id = v_tournament
    ) then
      raise exception 'Bracket contains a team that is not in this tournament'
        using errcode = 'check_violation';
    end if;
  end loop;

  select
    count(*)::integer,
    count(*) filter (where d.value = 'qf')::integer,
    count(*) filter (where d.value = 'sf')::integer,
    count(*) filter (where d.value = 'final')::integer,
    count(*) filter (where d.value = 'champion')::integer
    into v_total, v_qf, v_sf, v_final, v_champion
    from pg_catalog.jsonb_each_text(p_desired) d;

  -- Partial picking is allowed, but no snapshot may claim more teams at or beyond
  -- a round than the bracket can contain. Exact identity/path replay is applied
  -- once the complete 1/1/2/4 winner-only shape exists.
  if v_total > 8
     or v_champion > 1
     or v_final + v_champion > 2
     or v_sf + v_final + v_champion > 4
  then
    raise exception 'Bracket progression has an impossible partial stage shape'
      using errcode = 'check_violation';
  end if;

  -- Delete removed teams, update changed stages and insert new winners. Existing
  -- updates echo their stored version so enforce_write_version() increments it;
  -- inserts begin at version 0. Any later failure rolls all three operations back.
  delete from public.predicted_progression pp
    where pp.entry_id = p_entry_id
      and not (p_desired ? pp.team_id::text);

  update public.predicted_progression pp
    set stage = d.desired_stage,
        version = pp.version,
        updated_at = pg_catalog.now()
    from (
      select e.key::uuid as team_id, e.value as desired_stage
      from pg_catalog.jsonb_each_text(p_desired) e
    ) d
    where pp.entry_id = p_entry_id
      and pp.team_id = d.team_id
      and pp.stage is distinct from d.desired_stage;

  insert into public.predicted_progression (
    entry_id,
    team_id,
    stage,
    version,
    updated_at
  )
  select
    p_entry_id,
    d.team_id,
    d.desired_stage,
    0,
    pg_catalog.now()
  from (
    select e.key::uuid as team_id, e.value as desired_stage
    from pg_catalog.jsonb_each_text(p_desired) e
  ) d
  where not exists (
    select 1
    from public.predicted_progression pp
    where pp.entry_id = p_entry_id
      and pp.team_id = d.team_id
  );

  if v_total = 8
     and v_qf = 4
     and v_sf = 2
     and v_final = 1
     and v_champion = 1
  then
    perform predictor_internal.validate_predicted_bracket_tree(p_entry_id);
  end if;

  return query
  select pp.team_id, pp.stage, pp.version
  from public.predicted_progression pp
  where pp.entry_id = p_entry_id
  order by pp.team_id;
end;
$$;

revoke all on function public.replace_predicted_progression(uuid, jsonb, jsonb)
  from public, anon;
grant execute on function public.replace_predicted_progression(uuid, jsonb, jsonb)
  to authenticated;

commit;
