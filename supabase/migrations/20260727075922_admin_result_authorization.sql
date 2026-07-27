begin;

create or replace function predictor_internal.require_result_admin()
returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_metadata jsonb := coalesce(auth.jwt() -> 'app_metadata', '{}'::jsonb);
  v_capabilities jsonb := coalesce(v_metadata -> 'admin_capabilities', '[]'::jsonb);
begin
  if v_metadata ->> 'admin_role' = 'super_admin' then
    return;
  end if;

  if jsonb_typeof(v_capabilities) = 'array'
     and v_capabilities ? 'results'
  then
    return;
  end if;

  raise exception 'Result administration is not authorised'
    using errcode = '42501';
end;
$$;

create or replace function public.admin_confirm_match_result(
  p_match_id uuid,
  p_method text,
  p_home_90 smallint,
  p_away_90 smallint,
  p_home_120 smallint default null,
  p_away_120 smallint default null,
  p_home_penalties smallint default null,
  p_away_penalties smallint default null,
  p_reason text default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform predictor_internal.require_result_admin();
  return public.confirm_match_result(
    p_match_id,
    p_method,
    p_home_90,
    p_away_90,
    p_home_120,
    p_away_120,
    p_home_penalties,
    p_away_penalties,
    p_reason
  );
end;
$$;

create or replace function public.admin_correct_match_result(
  p_match_id uuid,
  p_method text,
  p_home_90 smallint,
  p_away_90 smallint,
  p_home_120 smallint default null,
  p_away_120 smallint default null,
  p_home_penalties smallint default null,
  p_away_penalties smallint default null,
  p_reason text default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform predictor_internal.require_result_admin();

  if nullif(btrim(p_reason), '') is null then
    raise exception 'A correction requires a reason'
      using errcode = '22023';
  end if;

  return public.correct_match_result(
    p_match_id,
    p_method,
    p_home_90,
    p_away_90,
    p_home_120,
    p_away_120,
    p_home_penalties,
    p_away_penalties,
    p_reason
  );
end;
$$;

create or replace function public.admin_clear_match_result(
  p_match_id uuid,
  p_reason text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform predictor_internal.require_result_admin();

  if nullif(btrim(p_reason), '') is null then
    raise exception 'A clear requires a reason'
      using errcode = '22023';
  end if;

  return public.clear_match_result(p_match_id, p_reason);
end;
$$;

create or replace function public.admin_match_result_revisions(p_match_id uuid)
returns table (
  revision integer,
  action text,
  previous_result jsonb,
  new_result jsonb,
  reason text,
  actor_id uuid,
  created_at timestamptz
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
    r.created_at
  from public.match_result_revisions r
  where r.match_id = p_match_id
  order by r.revision desc;
end;
$$;

revoke all on function predictor_internal.require_result_admin() from public, anon, authenticated;
revoke all on function public.admin_confirm_match_result(uuid,text,smallint,smallint,smallint,smallint,smallint,smallint,text) from public, anon, authenticated;
revoke all on function public.admin_correct_match_result(uuid,text,smallint,smallint,smallint,smallint,smallint,smallint,text) from public, anon, authenticated;
revoke all on function public.admin_clear_match_result(uuid,text) from public, anon, authenticated;
revoke all on function public.admin_match_result_revisions(uuid) from public, anon, authenticated;

grant execute on function public.admin_confirm_match_result(uuid,text,smallint,smallint,smallint,smallint,smallint,smallint,text) to authenticated;
grant execute on function public.admin_correct_match_result(uuid,text,smallint,smallint,smallint,smallint,smallint,smallint,text) to authenticated;
grant execute on function public.admin_clear_match_result(uuid,text) to authenticated;
grant execute on function public.admin_match_result_revisions(uuid) to authenticated;

commit;
