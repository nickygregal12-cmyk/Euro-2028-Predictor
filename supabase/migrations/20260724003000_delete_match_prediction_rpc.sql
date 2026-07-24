-- Euro 2028 Predictor — persist score clearing through a version-safe RPC
--
-- DATA-005 follow-up. A match prediction row stores a complete score pair, so
-- clearing either score in the client means deleting that row. Direct table
-- deletion is removed from API roles because it cannot carry the optimistic
-- version the user actually read. The protected RPC below verifies ownership,
-- tournament scope, lock time and expected version before deleting.
--
-- The existing AFTER DELETE trigger on match_predictions clears the affected
-- predicted group-position snapshot. The existing delete lock trigger remains a
-- second database-level guard.

begin;

-- Keep score reads and upserts under own-row RLS, but make deletion RPC-only.
drop policy if exists "own match_predictions" on public.match_predictions;
drop policy if exists "own match_predictions select" on public.match_predictions;
drop policy if exists "own match_predictions insert" on public.match_predictions;
drop policy if exists "own match_predictions update" on public.match_predictions;

create policy "own match_predictions select"
  on public.match_predictions
  for select to authenticated
  using (exists (
    select 1
    from public.entries e
    where e.id = match_predictions.entry_id
      and e.user_id = (select auth.uid())
  ));

create policy "own match_predictions insert"
  on public.match_predictions
  for insert to authenticated
  with check (exists (
    select 1
    from public.entries e
    where e.id = match_predictions.entry_id
      and e.user_id = (select auth.uid())
  ));

create policy "own match_predictions update"
  on public.match_predictions
  for update to authenticated
  using (exists (
    select 1
    from public.entries e
    where e.id = match_predictions.entry_id
      and e.user_id = (select auth.uid())
  ))
  with check (exists (
    select 1
    from public.entries e
    where e.id = match_predictions.entry_id
      and e.user_id = (select auth.uid())
  ));

revoke delete on table public.match_predictions
  from public, anon, authenticated, service_role;
grant select, insert, update on table public.match_predictions
  to authenticated;

create or replace function public.delete_match_prediction(
  p_entry_id uuid,
  p_match_id uuid,
  p_expected_version integer
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid;
  v_entry_tournament uuid;
  v_lock timestamptz;
  v_match_tournament uuid;
  v_round text;
  v_prediction_id uuid;
  v_stored_version integer;
begin
  if auth.uid() is null then
    raise exception 'Not authenticated'
      using errcode = 'insufficient_privilege';
  end if;

  select e.user_id, e.tournament_id, t.lock_at
    into v_user, v_entry_tournament, v_lock
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
    raise exception 'Predictions are locked — the tournament has started'
      using errcode = 'check_violation';
  end if;

  select m.tournament_id, m.round
    into v_match_tournament, v_round
    from public.matches m
    where m.id = p_match_id;

  if v_match_tournament is null then
    raise exception 'Match not found'
      using errcode = 'no_data_found';
  end if;

  if v_match_tournament <> v_entry_tournament or v_round <> 'group' then
    raise exception 'Match prediction must reference a group match in the entry tournament'
      using errcode = 'check_violation';
  end if;

  select mp.id, mp.version
    into v_prediction_id, v_stored_version
    from public.match_predictions mp
    where mp.entry_id = p_entry_id
      and mp.match_id = p_match_id
    for update;

  -- Clearing is idempotent when the row is already absent. A caller that never
  -- read a row passes NULL; if a concurrent device created one, the branch below
  -- sees it and raises PT409 rather than deleting unseen work.
  if v_prediction_id is null then
    return false;
  end if;

  if p_expected_version is null
     or p_expected_version is distinct from v_stored_version
  then
    raise exception 'prediction version conflict (expected %, stored %)',
      p_expected_version, v_stored_version
      using errcode = 'PT409';
  end if;

  delete from public.match_predictions
    where id = v_prediction_id;

  return true;
end;
$$;

revoke all on function public.delete_match_prediction(uuid, uuid, integer)
  from public, anon, authenticated, service_role;
grant execute on function public.delete_match_prediction(uuid, uuid, integer)
  to authenticated, service_role;

commit;
