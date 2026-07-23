begin;

select plan(2);

select ok(
  not exists (
    select 1
    from pg_proc function_row
    join pg_namespace schema_row
      on schema_row.oid = function_row.pronamespace
    cross join lateral aclexplode(
      coalesce(
        function_row.proacl,
        acldefault('f', function_row.proowner)
      )
    ) as privilege_row
    where schema_row.nspname = 'predictor_internal'
      and function_row.proname = 'resolve_predicted_group_order'
      and pg_get_function_identity_arguments(function_row.oid) = 'p_team_ids jsonb, p_matches jsonb, p_resolutions jsonb'
      and privilege_row.grantee = 0
      and privilege_row.privilege_type = 'EXECUTE'
  ),
  'PUBLIC cannot execute the private resolver'
);

select ok(
  has_function_privilege(
    'postgres',
    'predictor_internal.resolve_predicted_group_order(jsonb,jsonb,jsonb)',
    'execute'
  ),
  'database owner can execute the private resolver internally'
);

select * from finish();
rollback;
