-- Euro 2028 Predictor — private Account controls
--
-- Contract 57:
--   - persistent deadline-reminder email preference on the signed-in profile;
--   - one atomic, pre-lock-only clear action for the caller's Original Predictor
--     entry. The action deliberately leaves the account, league memberships and
--     every Bonus Games table untouched.

begin;

alter table public.profiles
  add column if not exists deadline_reminder_emails_enabled boolean not null default true;

comment on column public.profiles.deadline_reminder_emails_enabled is
  'Whether the account may receive Original Predictor deadline reminder emails. Defaults on; users can opt out before reminder delivery is enabled.';

create or replace function public.clear_my_entry(
  p_tournament_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
  v_entry_id uuid;
  v_lock_at timestamptz;
  v_match_predictions integer := 0;
  v_group_positions integer := 0;
  v_tie_resolutions integer := 0;
  v_progression integer := 0;
  v_award_picks integer := 0;
begin
  if v_uid is null then
    raise exception 'Authentication is required'
      using errcode = 'insufficient_privilege';
  end if;

  select e.id, t.lock_at
    into v_entry_id, v_lock_at
    from public.entries e
    join public.tournaments t on t.id = e.tournament_id
    where e.user_id = v_uid
      and e.tournament_id = p_tournament_id
    for update of e;

  if v_entry_id is null then
    select t.lock_at
      into v_lock_at
      from public.tournaments t
      where t.id = p_tournament_id;

    if not found then
      raise exception 'Tournament not found'
        using errcode = 'no_data_found';
    end if;
  end if;

  if v_lock_at is null then
    raise exception 'Tournament lock is not configured'
      using errcode = 'check_violation';
  end if;

  if now() >= v_lock_at then
    raise exception 'Predictions are locked — the tournament has started'
      using errcode = 'check_violation';
  end if;

  if v_entry_id is null then
    return jsonb_build_object(
      'entry_id', null,
      'match_predictions', 0,
      'group_positions', 0,
      'tie_resolutions', 0,
      'progression', 0,
      'award_picks', 0
    );
  end if;

  -- Match deletion runs the existing derived-position refresh trigger. The
  -- explicit group-position delete below guarantees the final state is empty.
  delete from public.match_predictions
    where entry_id = v_entry_id;
  get diagnostics v_match_predictions = row_count;

  delete from public.predicted_tie_resolutions
    where entry_id = v_entry_id;
  get diagnostics v_tie_resolutions = row_count;

  delete from public.predicted_group_positions
    where entry_id = v_entry_id;
  get diagnostics v_group_positions = row_count;

  delete from public.predicted_progression
    where entry_id = v_entry_id;
  get diagnostics v_progression = row_count;

  -- bonus_predictions stores Original Predictor award picks. It is not one of
  -- the separate bonus_* game tables introduced by contracts 49–56.
  delete from public.bonus_predictions
    where entry_id = v_entry_id;
  get diagnostics v_award_picks = row_count;

  update public.entries
    set submitted_at = null
    where id = v_entry_id;

  return jsonb_build_object(
    'entry_id', v_entry_id,
    'match_predictions', v_match_predictions,
    'group_positions', v_group_positions,
    'tie_resolutions', v_tie_resolutions,
    'progression', v_progression,
    'award_picks', v_award_picks
  );
end;
$$;

revoke all on function public.clear_my_entry(uuid)
  from public, anon, authenticated, service_role;
grant execute on function public.clear_my_entry(uuid)
  to authenticated, service_role;

commit;
