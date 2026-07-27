begin;

create or replace function public.admin_match_result_revisions(p_match_id uuid)
returns table (
  revision integer,
  action text,
  previous_result jsonb,
  new_result jsonb,
  reason text,
  actor_id uuid,
  recorded_at timestamptz
)
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform predictor_internal.require_result_admin();

  return query
  select
    r.revision,
    r.action,
    r.previous_result,
    r.new_result,
    r.reason,
    r.actor_id,
    r.recorded_at
  from public.match_result_revisions r
  where r.match_id = p_match_id
  order by r.revision desc;
end;
$$;

revoke all on function public.admin_match_result_revisions(uuid) from public, anon, authenticated;
grant execute on function public.admin_match_result_revisions(uuid) to authenticated;

commit;
