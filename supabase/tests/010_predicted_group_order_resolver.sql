begin;

select plan(10);

select has_function(
  'predictor_internal',
  'resolve_predicted_group_order',
  array['jsonb', 'jsonb', 'jsonb'],
  'private predicted group-order resolver is installed'
);

select ok(
  not has_function_privilege(
    'anon',
    'predictor_internal.resolve_predicted_group_order(jsonb,jsonb,jsonb)',
    'execute'
  ),
  'anon cannot execute the private resolver'
);

select ok(
  not has_function_privilege(
    'authenticated',
    'predictor_internal.resolve_predicted_group_order(jsonb,jsonb,jsonb)',
    'execute'
  ),
  'authenticated cannot execute the private resolver'
);

select is(
  (
    select jsonb_agg(standing ->> 'teamId')
    from jsonb_array_elements(
      predictor_internal.resolve_predicted_group_order(
        '["a","b","c","d"]'::jsonb,
        '[["a","b",2,0],["a","c",1,0],["a","d",1,0],["b","c",1,0],["b","d",1,0],["c","d",1,0]]'::jsonb
      ) -> 'standings'
    ) as rows(standing)
  ),
  '["a","b","c","d"]'::jsonb,
  'ordinary points ordering matches TypeScript'
);

select is(
  (
    select jsonb_agg(standing ->> 'teamId')
    from jsonb_array_elements(
      predictor_internal.resolve_predicted_group_order(
        '["a","b","c","d"]'::jsonb,
        '[["a","b",1,0],["a","c",0,3],["a","d",1,0],["b","c",4,0],["b","d",1,0],["c","d",0,0]]'::jsonb
      ) -> 'standings'
    ) as rows(standing)
  ),
  '["a","b","c","d"]'::jsonb,
  'head-to-head points outrank better overall goal difference'
);

select is(
  predictor_internal.resolve_predicted_group_order(
    '["a","b","c","d"]'::jsonb,
    '[["a","b",1,1],["a","c",1,1],["a","d",1,1],["b","c",1,1],["b","d",1,1],["c","d",1,1]]'::jsonb
  ) -> 'unresolvedGroups',
  '[["a","b","c","d"]]'::jsonb,
  'a complete score-derived tie remains unresolved'
);

select is(
  (
    select jsonb_agg(standing ->> 'teamId')
    from jsonb_array_elements(
      predictor_internal.resolve_predicted_group_order(
        '["a","b","c","d"]'::jsonb,
        '[["a","b",1,1],["a","c",1,1],["a","d",1,1],["b","c",1,1],["b","d",1,1],["c","d",1,1]]'::jsonb,
        '[{"teamIds":["d","c","b","a"],"order":["c","a","d","b"]}]'::jsonb
      ) -> 'standings'
    ) as rows(standing)
  ),
  '["c","a","d","b"]'::jsonb,
  'an exact-set manual order resolves the tied block'
);

select is(
  (
    select jsonb_agg(standing ->> 'teamId')
    from jsonb_array_elements(
      predictor_internal.resolve_predicted_group_order(
        '["a","b","c","d"]'::jsonb,
        '[["a","b",1,1],["a","c",1,1],["a","d",1,1],["b","c",1,1],["b","d",1,1],["c","d",1,1]]'::jsonb,
        '[{"teamIds":["a","b","c","d"],"order":["a","a","c","d"]},{"teamIds":["d","c","b","a"],"order":["b","d","a","c"]}]'::jsonb
      ) -> 'standings'
    ) as rows(standing)
  ),
  '["b","d","a","c"]'::jsonb,
  'a malformed stored row cannot mask a later valid row'
);

select is(
  predictor_internal.resolve_predicted_group_order(
    '["a","b","c","d"]'::jsonb,
    '[["a","b",2,1],["a","c",1,1],["a","d",1,1],["b","c",1,1],["b","d",1,1],["c","d",1,1]]'::jsonb,
    '[{"teamIds":["a","b","c","d"],"order":["d","c","b","a"]}]'::jsonb
  ) -> 'unresolvedGroups',
  '[["c","d"]]'::jsonb,
  'a stale decision is ignored when score changes alter the tied set'
);

select is(
  (
    select jsonb_agg(
      jsonb_build_object(
        'teamId', standing ->> 'teamId',
        'rank', (standing ->> 'rank')::integer,
        'tiedUnresolved', (standing ->> 'tiedUnresolved')::boolean
      )
    )
    from jsonb_array_elements(
      predictor_internal.resolve_predicted_group_order(
        '["a","b","c","d"]'::jsonb,
        '[["a","b",1,0]]'::jsonb
      ) -> 'standings'
    ) as rows(standing)
  ),
  '[{"rank":1,"teamId":"a","tiedUnresolved":false},{"rank":2,"teamId":"c","tiedUnresolved":true},{"rank":2,"teamId":"d","tiedUnresolved":true},{"rank":4,"teamId":"b","tiedUnresolved":false}]'::jsonb,
  'partial-group ranks and unresolved flags match TypeScript'
);

select * from finish();
rollback;
