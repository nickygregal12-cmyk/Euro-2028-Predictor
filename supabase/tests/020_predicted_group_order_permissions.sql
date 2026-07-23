begin;

select plan(2);

select ok(
  not has_function_privilege(
    'PUBLIC',
    'predictor_internal.resolve_predicted_group_order(jsonb,jsonb,jsonb)',
    'execute'
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
