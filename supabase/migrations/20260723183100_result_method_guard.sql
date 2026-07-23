-- DATA-002 follow-up: make the public server-only wrappers reject a missing
-- result method with an explicit invalid-parameter error before the shared
-- lifecycle implementation evaluates method-specific score rules.

begin;

create or replace function public.confirm_match_result(
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
  if p_method is null then
    raise exception 'A result method is required'
      using errcode = 'invalid_parameter_value';
  end if;

  return predictor_internal.write_match_result(
    p_match_id,
    'confirm',
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

create or replace function public.correct_match_result(
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
  if p_method is null then
    raise exception 'A result method is required'
      using errcode = 'invalid_parameter_value';
  end if;

  return predictor_internal.write_match_result(
    p_match_id,
    'correct',
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

revoke all on function public.confirm_match_result(
  uuid, text, smallint, smallint, smallint, smallint, smallint, smallint, text
) from public, anon, authenticated;
revoke all on function public.correct_match_result(
  uuid, text, smallint, smallint, smallint, smallint, smallint, smallint, text
) from public, anon, authenticated;

grant execute on function public.confirm_match_result(
  uuid, text, smallint, smallint, smallint, smallint, smallint, smallint, text
) to service_role;
grant execute on function public.correct_match_result(
  uuid, text, smallint, smallint, smallint, smallint, smallint, smallint, text
) to service_role;

commit;
