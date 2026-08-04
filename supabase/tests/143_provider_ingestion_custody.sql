begin;

select plan(26);

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

select has_table(
  'predictor_internal',
  'provider_raw_responses',
  'private raw provider-response custody exists'
);
select has_table(
  'predictor_internal',
  'provider_response_processing',
  'private decoder-attempt evidence exists'
);

select is(
  (
    select count(*)::integer
    from pg_class
    where relnamespace = 'predictor_internal'::regnamespace
      and relname in ('provider_raw_responses', 'provider_response_processing')
      and relrowsecurity
  ),
  2,
  'RLS is enabled on both private provider custody tables'
);

select is(
  (
    select count(*)::integer
    from information_schema.role_table_grants
    where table_schema = 'predictor_internal'
      and table_name in ('provider_raw_responses', 'provider_response_processing')
      and grantee in ('PUBLIC', 'anon', 'authenticated', 'service_role')
  ),
  0,
  'no browser or service role receives direct provider custody table grants'
);

select ok(
  not has_function_privilege(
    'anon',
    'public.archive_provider_response(text,text,text,integer,jsonb,text,uuid)',
    'execute'
  ),
  'anonymous callers cannot archive provider responses'
);
select ok(
  not has_function_privilege(
    'authenticated',
    'public.archive_provider_response(text,text,text,integer,jsonb,text,uuid)',
    'execute'
  ),
  'signed-in browser callers cannot archive provider responses'
);
select ok(
  has_function_privilege(
    'service_role',
    'public.archive_provider_response(text,text,text,integer,jsonb,text,uuid)',
    'execute'
  ),
  'service role alone can call the raw-response archive RPC'
);
select ok(
  not has_function_privilege(
    'anon',
    'public.record_provider_response_processing(uuid,text,boolean,integer,jsonb,text,text)',
    'execute'
  ),
  'anonymous callers cannot record decoder evidence'
);
select ok(
  not has_function_privilege(
    'authenticated',
    'public.record_provider_response_processing(uuid,text,boolean,integer,jsonb,text,text)',
    'execute'
  ),
  'signed-in browser callers cannot record decoder evidence'
);
select ok(
  has_function_privilege(
    'service_role',
    'public.record_provider_response_processing(uuid,text,boolean,integer,jsonb,text,text)',
    'execute'
  ),
  'service role alone can call the processing-evidence RPC'
);

select is(
  (
    select count(*)::integer
    from pg_proc
    where oid in (
      'public.archive_provider_response(text,text,text,integer,jsonb,text,uuid)'::regprocedure,
      'public.record_provider_response_processing(uuid,text,boolean,integer,jsonb,text,text)'::regprocedure
    )
      and prosecdef
      and proconfig @> array['search_path=""']::text[]
  ),
  2,
  'both public custody RPCs are security definer with an empty search path'
);

set local role service_role;
select set_config(
  'test.provider_raw_response_id',
  public.archive_provider_response(
    'sportmonks',
    'https://api.sportmonks.com/v3/football/fixtures?date=2026-08-03',
    'GET',
    200,
    '{"content-type":"application/json"}'::jsonb,
    '{"fixtures":[]}',
    md5('provider-correlation')::uuid
  )::text,
  true
);
reset role;

select ok(
  nullif(current_setting('test.provider_raw_response_id'), '') is not null,
  'the service role can archive one exact provider response'
);
select is(
  (
    select raw_body
    from predictor_internal.provider_raw_responses
    where id = current_setting('test.provider_raw_response_id')::uuid
  ),
  '{"fixtures":[]}',
  'raw custody preserves the exact response text'
);
select is(
  (
    select raw_body_sha256
    from predictor_internal.provider_raw_responses
    where id = current_setting('test.provider_raw_response_id')::uuid
  ),
  '4cf89f9247b48928a6e62202cdcef016af627c2e9dfd86e3cf0cf8e29ebb31be',
  'PostgreSQL stores the expected SHA-256 digest of the exact text'
);
select is(
  (
    select request_url
    from predictor_internal.provider_raw_responses
    where id = current_setting('test.provider_raw_response_id')::uuid
  ),
  'https://api.sportmonks.com/v3/football/fixtures?date=2026-08-03',
  'the approved fixed provider origin is retained'
);

set local role service_role;
select set_config(
  'test.provider_processing_id',
  public.record_provider_response_processing(
    current_setting('test.provider_raw_response_id')::uuid,
    'contract-73-test',
    true,
    1,
    '[{"provider":"sportmonks","providerFixtureId":"fixture-1"}]'::jsonb,
    null,
    null
  )::text,
  true
);
reset role;

select ok(
  nullif(current_setting('test.provider_processing_id'), '') is not null,
  'the service role can append one successful decoder attempt'
);
select is(
  (
    select decoded_fixture_count
    from predictor_internal.provider_response_processing
    where id = current_setting('test.provider_processing_id')::uuid
  ),
  1,
  'successful processing records its bounded decoded fixture count'
);
select is(
  (
    select normalized_payload
    from predictor_internal.provider_response_processing
    where id = current_setting('test.provider_processing_id')::uuid
  ),
  '[{"provider":"sportmonks","providerFixtureId":"fixture-1"}]'::jsonb,
  'successful processing retains normalized evidence without touching application fixtures'
);

select is(
  pg_temp.capture_sqlstate(format(
    'update predictor_internal.provider_raw_responses set raw_body = %L where id = %L::uuid',
    '{"changed":true}',
    current_setting('test.provider_raw_response_id')
  )),
  '42501',
  'raw provider custody cannot be updated'
);
select is(
  pg_temp.capture_sqlstate(format(
    'delete from predictor_internal.provider_raw_responses where id = %L::uuid',
    current_setting('test.provider_raw_response_id')
  )),
  '42501',
  'raw provider custody cannot be deleted'
);
select is(
  pg_temp.capture_sqlstate(format(
    'update predictor_internal.provider_response_processing set decoder_version = %L where id = %L::uuid',
    'rewritten',
    current_setting('test.provider_processing_id')
  )),
  '42501',
  'decoder-attempt evidence cannot be rewritten'
);

set local role service_role;
select is(
  pg_temp.capture_sqlstate($sql$
    select public.archive_provider_response(
      'sportmonks',
      'https://example.com/v3/football/fixtures',
      'GET',
      200,
      '{}'::jsonb,
      '{}',
      gen_random_uuid()
    )
  $sql$),
  '23514',
  'the database rejects a provider response from an unapproved origin'
);
select is(
  pg_temp.capture_sqlstate($sql$
    select public.archive_provider_response(
      'sportmonks',
      'https://api.sportmonks.com/v3/football/fixtures?api_token=must-not-be-archived',
      'GET',
      200,
      '{}'::jsonb,
      '{}',
      gen_random_uuid()
    )
  $sql$),
  '23514',
  'the database rejects credential-shaped provider query parameters'
);
select is(
  pg_temp.capture_sqlstate($sql$
    select public.archive_provider_response(
      'sportmonks',
      'https://api.sportmonks.com/v3/football/fixtures?date=2026-08-03',
      'GET',
      200,
      '{"authorization":"must-not-be-archived"}'::jsonb,
      '{}',
      gen_random_uuid()
    )
  $sql$),
  '23514',
  'the database rejects response-header keys outside the safe evidence allowlist'
);
select is(
  pg_temp.capture_sqlstate(format(
    $sql$
      select public.record_provider_response_processing(
        %L::uuid,
        'contract-73-test',
        true,
        2,
        '[{"only":"one"}]'::jsonb,
        null,
        null
      )
    $sql$,
    current_setting('test.provider_raw_response_id')
  )),
  '23514',
  'successful evidence rejects a fixture count that disagrees with its payload'
);
reset role;

set local role authenticated;
select is(
  pg_temp.capture_sqlstate($sql$
    select public.archive_provider_response(
      'football-data',
      'https://api.football-data.org/v4/matches',
      'GET',
      200,
      '{}'::jsonb,
      '{}',
      gen_random_uuid()
    )
  $sql$),
  '42501',
  'an authenticated browser role cannot bypass the RPC grant boundary'
);
reset role;

select * from finish();
rollback;
