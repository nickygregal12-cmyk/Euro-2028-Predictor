-- Euro 2028 Predictor — prediction consensus minimum cohort
--
-- Contract 63. Migration 61 is already applied to development, so preserve it
-- as a private implementation helper and keep the public RPC as the stable
-- boundary. Tournament-wide prediction aggregates are suppressed until ten
-- submitted Original Predictor entries exist. The caller's submitted entry
-- counts toward the threshold. Suppression is a successful, explicit state.

begin;

alter function public.get_prediction_consensus(uuid)
  set schema predictor_internal;

alter function predictor_internal.get_prediction_consensus(uuid)
  rename to get_prediction_consensus_unsuppressed;

revoke all on function predictor_internal.get_prediction_consensus_unsuppressed(uuid)
  from public, anon, authenticated, service_role;

create or replace function public.get_prediction_consensus(
  p_tournament_id uuid
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
  v_lock_at timestamptz;
  v_submitted_entries integer;
  v_minimum_entries constant integer := 10;
  v_result jsonb;
begin
  if v_uid is null then
    raise exception 'Authentication is required'
      using errcode = 'insufficient_privilege';
  end if;

  select tournament.lock_at
    into v_lock_at
  from public.tournaments tournament
  where tournament.id = p_tournament_id;

  if not found then
    raise exception 'Tournament not found'
      using errcode = 'no_data_found';
  end if;

  if v_lock_at is null then
    raise exception 'Tournament lock is not configured'
      using errcode = 'check_violation';
  end if;

  if now() < v_lock_at then
    raise exception 'Prediction consensus is hidden until entries lock'
      using errcode = 'check_violation';
  end if;

  select count(*)::integer
    into v_submitted_entries
  from public.entries entry
  where entry.tournament_id = p_tournament_id
    and entry.submitted_at is not null;

  if v_submitted_entries < v_minimum_entries then
    return jsonb_build_object(
      'suppressed', true,
      'reason', 'not_enough_entries',
      'minimum_entries', v_minimum_entries,
      'submitted_entries', v_submitted_entries,
      'server_now', now(),
      'locked_at', v_lock_at
    );
  end if;

  v_result := predictor_internal.get_prediction_consensus_unsuppressed(
    p_tournament_id
  );

  return v_result || jsonb_build_object(
    'suppressed', false,
    'minimum_entries', v_minimum_entries
  );
end;
$$;

revoke all on function public.get_prediction_consensus(uuid)
  from public, anon, authenticated, service_role;
grant execute on function public.get_prediction_consensus(uuid)
  to authenticated, service_role;

commit;
