-- Euro 2028 Predictor — account entry controls
--
-- Contract 57. The server half of the More → Account page (design-system
-- §Account, decided 2026-07-22):
--
--   - profiles.reminder_emails: the deadline-reminder opt-out that must exist
--     before reminder emails ever ship (default on; owner-updatable through
--     the existing own-profile row policy);
--   - clear_my_predictions: the pre-lock "clear my predictions" danger-zone
--     action — one atomic wipe of the caller's own entry (36 scores, tie
--     resolutions, derived group positions, bracket, awards picks; jokers
--     live on match_predictions and disappear with them) and the submitted
--     flag, leaving the account, profile and leagues untouched. Post-lock it
--     refuses with the standard lock error; the existing per-table lock
--     triggers (writes AND deletes) back it up as defence in depth.

begin;

alter table public.profiles
  add column reminder_emails boolean not null default true;

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
      and entry.tournament_id = p_tournament_id;

  if v_entry is null then
    raise exception 'You have no entry for this tournament'
      using errcode = 'no_data_found';
  end if;

  if v_lock is not null and now() >= v_lock then
    raise exception 'Predictions are locked — the tournament has started'
      using errcode = 'check_violation';
  end if;

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

  update public.entries entry
    set submitted_at = null
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
