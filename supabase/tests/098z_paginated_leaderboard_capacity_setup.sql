select plan(2);

select lives_ok(
  $$select public.set_operating_limits(250, 20)$$,
  'the disposable scale fixture can use the proven 250-user technical ceiling'
);

select is(
  (select public_user_limit from predictor_internal.operating_limits where singleton),
  250,
  'the paginated leaderboard fixture starts with sufficient synthetic capacity'
);

select * from finish();
