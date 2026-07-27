select plan(2);

select lives_ok(
  $$select public.set_operating_limits(50, 20)$$,
  'the disposable database restores the fail-closed public rollout limits'
);

select is(
  (select public_user_limit from predictor_internal.operating_limits where singleton),
  50,
  'the operating-cap lifecycle starts from the production default user limit'
);

select * from finish();
