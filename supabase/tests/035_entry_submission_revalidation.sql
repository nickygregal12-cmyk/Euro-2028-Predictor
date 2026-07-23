begin;

select plan(6);

create or replace function pg_temp.capture_sqlstate(p_sql text)
returns text
language plpgsql
as $$
begin
  execute p_sql;
  return null;
exception when others then
  return sqlstate;
end;
$$;

insert into auth.users (
  id,
  email,
  aud,
  role,
  raw_app_meta_data,
  raw_user_meta_data,
  created_at,
  updated_at
) values (
  '00000000-0000-0000-0000-000000000021',
  'incomplete-entry@example.test',
  'authenticated',
  'authenticated',
  '{}'::jsonb,
  '{}'::jsonb,
  now(),
  now()
);

insert into public.tournaments (
  id,
  name,
  year,
  starts_on,
  ends_on,
  lock_at
) values (
  '00000000-0000-0000-0000-000000000121',
  'Submission Revalidation Test',
  2028,
  '2028-06-09',
  '2028-07-09',
  now() + interval '1 day'
);

insert into public.groups (id, tournament_id, letter) values (
  '00000000-0000-0000-0000-000000000321',
  '00000000-0000-0000-0000-000000000121',
  'A'
);

insert into public.entries (id, user_id, tournament_id) values (
  '00000000-0000-0000-0000-000000000221',
  '00000000-0000-0000-0000-000000000021',
  '00000000-0000-0000-0000-000000000121'
);

select ok(
  not has_function_privilege(
    'authenticated',
    'predictor_internal.validate_entry_submission_snapshot(uuid,boolean)',
    'execute'
  ),
  'authenticated users cannot execute the private submission validator'
);

select ok(
  not has_table_privilege('authenticated', 'public.entries', 'update')
  and not has_table_privilege('authenticated', 'public.entries', 'delete'),
  'authenticated users have no direct entries update or delete privilege'
);

select ok(
  has_table_privilege('authenticated', 'public.predicted_group_positions', 'select')
  and not has_table_privilege('authenticated', 'public.predicted_group_positions', 'insert')
  and not has_table_privilege('authenticated', 'public.predicted_group_positions', 'update')
  and not has_table_privilege('authenticated', 'public.predicted_group_positions', 'delete'),
  'group-position snapshots are client-readable but not client-writable'
);

select is(
  pg_temp.capture_sqlstate($sql$
    select predictor_internal.validate_entry_submission_snapshot(
      '00000000-0000-0000-0000-000000000221',
      false
    )
  $sql$),
  '23514',
  'the shared validator rejects an incomplete legacy submission snapshot'
);

set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000021', true);
select set_config('request.jwt.claim.role', 'authenticated', true);

select is(
  pg_temp.capture_sqlstate($sql$
    select public.submit_entry('00000000-0000-0000-0000-000000000221')
  $sql$),
  '23514',
  'an owner cannot submit an incomplete entry through the protected RPC'
);

select is(
  (
    select e.submitted_at
    from public.entries e
    where e.id = '00000000-0000-0000-0000-000000000221'
  ),
  null::timestamptz,
  'a failed submission leaves submitted_at null'
);

reset role;
select * from finish();
rollback;
