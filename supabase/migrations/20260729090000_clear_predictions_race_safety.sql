-- Euro 2028 Predictor — clear-predictions race safety
--
-- Contract 58. Redefine the contract-57 Account wipe so the caller's unlocked
-- Original Predictor children are removed while the entry still exists, then
-- retire the now-empty entry identity. A delayed autosave still carrying the old
-- entry id fails the entry foreign key and cannot recreate predictions.

begin;

create or replace function public.clear_my_predictions(
  p_tournament_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
  v_entry uuid;
  v_lock timestamptz;
  v_scores integer;
  v_ties integer;
  v_positions integer;
  v_progression integer;
  v_awards integer;
begin
  if v_uid is null then
    raise exception 'Authentication is required'
      using errcode = 'insufficient_privilege';
  end if;

  select entry.id, tournament.lock_at
    into v_entry, v_lock
    from public.entries entry
    join public.tournaments tournament on tournament.id = entry.tournament_id
    where entry.user_id = v_uid
      and entry.tournament_id = p_tournament_id
    for update of entry;

  if v_entry is null then
    raise exception 'You have no entry for this tournament'
      using errcode = 'no_data_found';
  end if;

  if v_lock is not null and now() >= v_lock then
    raise exception 'Predictions are locked — the tournament has started'
      using errcode = 'check_violation';
  end if;

  -- Delete the children explicitly while the parent still exists. In particular,
  -- match_predictions has an AFTER DELETE derived-position refresh trigger that
  -- needs the entry row to remain resolvable during the child delete.
  delete from public.match_predictions prediction
    where prediction.entry_id = v_entry;
  get diagnostics v_scores = row_count;

  delete from public.predicted_tie_resolutions resolution
    where resolution.entry_id = v_entry;
  get diagnostics v_ties = row_count;

  delete from public.predicted_group_positions snapshot
    where snapshot.entry_id = v_entry;
  get diagnostics v_positions = row_count;

  delete from public.predicted_progression progression
    where progression.entry_id = v_entry;
  get diagnostics v_progression = row_count;

  delete from public.bonus_predictions bonus
    where bonus.entry_id = v_entry;
  get diagnostics v_awards = row_count;

  -- The application immediately reloads through getOrCreateEntry, which creates
  -- a fresh empty entry. PostgreSQL's FK locking serialises any concurrent stale
  -- child insert with this parent delete: a write completed first is cascaded;
  -- a write arriving after deletion fails the foreign key.
  delete from public.entries entry
    where entry.id = v_entry;

  return jsonb_build_object(
    'entry_id', v_entry,
    'scores', v_scores,
    'tie_resolutions', v_ties,
    'group_positions', v_positions,
    'progression', v_progression,
    'awards', v_awards
  );
end;
$$;

revoke all on function public.clear_my_predictions(uuid)
  from public, anon, authenticated, service_role;
grant execute on function public.clear_my_predictions(uuid)
  to authenticated, service_role;

commit;
