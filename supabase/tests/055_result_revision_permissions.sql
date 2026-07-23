begin;

select plan(5);

select ok(
  not has_table_privilege('service_role', 'public.match_result_revisions', 'select'),
  'service role cannot read the revision log directly'
);

select ok(
  not has_table_privilege('service_role', 'public.match_result_revisions', 'insert'),
  'service role cannot forge revision rows directly'
);

select ok(
  not has_table_privilege('service_role', 'public.match_result_revisions', 'update'),
  'service role cannot edit revision rows'
);

select ok(
  not has_table_privilege('service_role', 'public.match_result_revisions', 'delete'),
  'service role cannot delete revision rows'
);

select ok(
  has_function_privilege(
    'service_role',
    'public.correct_match_result(uuid,text,smallint,smallint,smallint,smallint,smallint,smallint,text)',
    'execute'
  ),
  'service role retains the protected correction RPC'
);

select * from finish();
rollback;
