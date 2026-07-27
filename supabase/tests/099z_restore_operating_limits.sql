-- pgTAP-only reset for the disposable database after the 120-user scale fixture.
select plan(2);

select lives_ok(
  $$select public.set_operating_limits(50::integer, 20::integer)$$,
  'the disposable database restores the rollout defaults'
);

select is(
  (select public_user_limit from predictor_internal.operating_limits where singleton),
  50,
  'the operating-cap lifecycle starts from the default user limit'
);

select * from finish();
