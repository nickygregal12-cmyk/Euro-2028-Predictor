begin;

select plan(16);

select is(
  (select state from predictor_internal.euro_publication_control where singleton),
  'hidden',
  'Euro publication defaults to hidden'
);

select is(
  (select count(*)::integer from predictor_internal.euro_publication_transitions),
  1,
  'the hidden bootstrap state is recorded once'
);

select ok(
  not has_table_privilege('anon', 'predictor_internal.euro_publication_control', 'select'),
  'anon cannot read the publication-control table directly'
);
select ok(
  not has_table_privilege('authenticated', 'predictor_internal.euro_publication_control', 'select'),
  'authenticated cannot read the publication-control table directly'
);
select ok(
  not has_table_privilege('service_role', 'predictor_internal.euro_publication_control', 'select'),
  'service_role cannot read the publication-control table directly'
);
select ok(
  not has_table_privilege('anon', 'predictor_internal.euro_publication_transitions', 'select'),
  'anon cannot read publication transition history directly'
);
select ok(
  not has_table_privilege('authenticated', 'predictor_internal.euro_publication_transitions', 'select'),
  'authenticated cannot read publication transition history directly'
);
select ok(
  not has_table_privilege('service_role', 'predictor_internal.euro_publication_transitions', 'select'),
  'service_role cannot read publication transition history directly'
);

select ok(
  not has_function_privilege(
    'anon',
    'predictor_internal.set_euro_publication_state(text,text,uuid)',
    'execute'
  ),
  'anon cannot transition Euro publication state'
);
select ok(
  not has_function_privilege(
    'authenticated',
    'predictor_internal.set_euro_publication_state(text,text,uuid)',
    'execute'
  ),
  'authenticated cannot transition Euro publication state directly'
);
select ok(
  not has_function_privilege(
    'service_role',
    'predictor_internal.set_euro_publication_state(text,text,uuid)',
    'execute'
  ),
  'service_role cannot transition Euro publication state directly'
);

select throws_ok(
  $$select predictor_internal.set_euro_publication_state('live', 'skip the lifecycle', null)$$,
  '23514',
  null,
  'publication state cannot skip lifecycle stages'
);

select is(
  predictor_internal.set_euro_publication_state('prelaunch', 'owner approved prelaunch', null),
  'prelaunch',
  'the owner-only authority can advance exactly one stage'
);

select is(
  (select state from predictor_internal.euro_publication_control where singleton),
  'prelaunch',
  'the singleton stores the advanced state'
);

select is(
  (select count(*)::integer from predictor_internal.euro_publication_transitions),
  2,
  'an approved state change appends one transition record'
);

select throws_ok(
  $$update predictor_internal.euro_publication_transitions set reason = 'rewrite' where id = 1$$,
  '42501',
  'Euro publication transition history is append-only',
  'transition history cannot be rewritten'
);

select * from finish();
rollback;
