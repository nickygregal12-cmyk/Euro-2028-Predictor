begin;

select plan(4);

select has_schema(
  'predictor_internal',
  'private predictor schema is installed'
);

select ok(
  not has_schema_privilege('anon', 'predictor_internal', 'usage'),
  'anon cannot use the private predictor schema'
);

select ok(
  not has_schema_privilege('authenticated', 'predictor_internal', 'usage'),
  'authenticated cannot use the private predictor schema'
);

select is(
  (
    select count(*)::integer
    from information_schema.role_usage_grants
    where object_type = 'SCHEMA'
      and object_schema = 'predictor_internal'
      and grantee in ('PUBLIC', 'anon', 'authenticated')
  ),
  0,
  'no public client-role schema grants are recorded'
);

select * from finish();
rollback;
