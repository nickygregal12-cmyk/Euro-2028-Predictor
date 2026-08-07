-- Contract 132: fresh provider fixtures are evidence first and canonical fixtures
-- only after an explicit competition-admin decision. Provider scores remain
-- evidence; result confirmation stays behind contract 125's result authority.

begin;

select plan(31);

-- ---------------------------------------------------------------------------
-- Boundary shape.
-- ---------------------------------------------------------------------------

select ok(
  to_regclass('predictor_internal.provider_fixture_proposals') is not null,
  'provider fixture proposals have a dedicated internal evidence table');

select is(
  (select c.relrowsecurity
     from pg_class c
     join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'predictor_internal'
      and c.relname = 'provider_fixture_proposals'),
  true,
  'proposal evidence has RLS enabled');

select is(
  (select count(*)::integer
     from information_schema.role_table_grants
    where table_schema = 'predictor_internal'
      and table_name = 'provider_fixture_proposals'
      and grantee in ('anon', 'authenticated', 'service_role')),
  0,
  'no browser or service role can write proposal evidence directly');

select is(
  (select count(*)::integer
     from information_schema.routine_privileges
    where routine_schema = 'predictor_internal'
      and routine_name = 'stage_provider_fixture_proposals'
      and grantee in ('anon', 'authenticated', 'service_role')),
  0,
  'the staging writer is not an exposed RPC');

select is(
  (select count(*)::integer
     from pg_proc p
     join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname in (
        'admin_approve_initial_provider_fixtures',
        'admin_reject_initial_provider_fixtures'
      )
      and p.prosecdef
      and p.proconfig @> array['search_path=""']),
  2,
  'both decision entry points are security definer with an empty search path');

select is(
  (select count(*)::integer
     from information_schema.routine_privileges
    where routine_schema = 'public'
      and routine_name in (
        'admin_approve_initial_provider_fixtures',
        'admin_reject_initial_provider_fixtures'
      )
      and grantee = 'anon'),
  0,
  'anonymous callers cannot reach either decision entry point');

select is(
  (select count(*)::integer
     from information_schema.routine_privileges
    where routine_schema = 'public'
      and routine_name in (
        'admin_approve_initial_provider_fixtures',
        'admin_reject_initial_provider_fixtures'
      )
      and grantee = 'authenticated'
      and privilege_type = 'EXECUTE'),
  2,
  'authenticated callers may reach the RPCs, while capability checks decide who may act');

-- ---------------------------------------------------------------------------
-- Self-contained Scottish season and a complete 33-round provider payload.
-- ---------------------------------------------------------------------------

insert into public.tournaments (
  name, year, competition_id, season_key, kind, display_timezone, status
)
select 'C132 Provider Approval Probe', 2030, c.id, 'c132-approval-probe',
       'league_season', 'Europe/London', 'draft'
  from public.competitions c
 where c.slug = 'scottish-premiership';

select set_config(
  'test.c132_season',
  (select id::text from public.tournaments where season_key = 'c132-approval-probe'),
  true
);

insert into predictor_internal.provider_raw_responses (
  provider, request_url, request_method, response_status, response_headers, raw_body
) values (
  'sportmonks',
  'https://api.sportmonks.com/v3/football/fixtures/between/2030-08-01/2031-04-30',
  'GET',
  200,
  '{}'::jsonb,
  '{"test":"contract132"}'
);

select set_config(
  'test.c132_raw',
  (select id::text
     from predictor_internal.provider_raw_responses
    where raw_body = '{"test":"contract132"}'
    order by fetched_at desc
    limit 1),
  true
);

insert into predictor_internal.provider_response_processing (
  raw_response_id,
  decoder_version,
  succeeded,
  decoded_fixture_count,
  normalized_payload
)
select current_setting('test.c132_raw')::uuid,
       'contract-132-v1',
       true,
       198,
       jsonb_agg(
         jsonb_build_object(
           'provider', 'sportmonks',
           'providerFixtureId', format('c132-%s-%s', round_no, match_no),
           'competitionProviderId', '501',
           'seasonProviderId', 'c132-season-provider',
           'roundProviderId', round_no::text,
           'homeTeamProviderId', (match_no * 2 + 1)::text,
           'homeTeamName', format('C132 Club %s', match_no * 2 + 1),
           'awayTeamProviderId', (match_no * 2 + 2)::text,
           'awayTeamName', format('C132 Club %s', match_no * 2 + 2),
           'kickoffAt', to_char(
             timestamptz '2030-08-01 12:00:00+00'
               + ((round_no - 1) * interval '7 days')
               + (match_no * interval '2 hours'),
             'YYYY-MM-DD"T"HH24:MI:SS"Z"'
           ),
           'status', case when round_no = 1 then 'FT' else 'NS' end,
           'homeScore', case when round_no = 1 then 2 else null end,
           'awayScore', case when round_no = 1 then 1 else null end
         )
         order by round_no, match_no
       )
  from generate_series(1, 33) as round_no
 cross join generate_series(0, 5) as match_no;

select is(
  predictor_internal.stage_provider_fixture_proposals(
    current_setting('test.c132_raw')::uuid,
    current_setting('test.c132_season')::uuid
  ) ->> 'inserted',
  '198',
  'a complete successful contract-132 provider response stages all 198 Scottish fixtures');

select is(
  predictor_internal.stage_provider_fixture_proposals(
    current_setting('test.c132_raw')::uuid,
    current_setting('test.c132_season')::uuid
  ) ->> 'existing',
  '198',
  'staging the same archived evidence again is idempotent');

select is(
  (select count(*)::integer
     from predictor_internal.provider_fixture_proposals
    where tournament_id = current_setting('test.c132_season')::uuid
      and state = 'pending'),
  198,
  'discovery creates pending evidence, not canonical competition truth');

select is(
  (select count(*)::integer
     from public.season_fixtures
    where tournament_id = current_setting('test.c132_season')::uuid),
  0,
  'staging alone publishes no fixtures');

-- ---------------------------------------------------------------------------
-- The admin gate is driven with a real signed-in non-admin first.
-- ---------------------------------------------------------------------------

set local session_replication_role = replica;
insert into auth.users (
  id, email, aud, role, raw_app_meta_data, raw_user_meta_data, created_at, updated_at
) values (
  md5('c132-admin')::uuid,
  'c132-admin@example.test',
  'authenticated',
  'authenticated',
  '{}'::jsonb,
  '{}'::jsonb,
  now(),
  now()
);
set local session_replication_role = origin;

select set_config(
  'request.jwt.claims',
  json_build_object(
    'sub', md5('c132-admin')::uuid,
    'role', 'authenticated',
    'app_metadata', json_build_object()
  )::text,
  true
);
set local role authenticated;

select throws_ok(
  format(
    'select public.admin_approve_initial_provider_fixtures(%L::uuid, %L, %L)',
    current_setting('test.c132_season'),
    'sportmonks',
    'Publish the reviewed opening calendar'
  ),
  '42501',
  'Competition administration is not authorised',
  'an ordinary signed-in player can reach the RPC but cannot approve provider fixtures');

reset role;

select is(
  (select count(*)::integer
     from public.season_fixtures
    where tournament_id = current_setting('test.c132_season')::uuid),
  0,
  'the rejected non-admin call changed no canonical fixture');

-- Competition administration is the publication authority.
select set_config(
  'request.jwt.claims',
  json_build_object(
    'sub', md5('c132-admin')::uuid,
    'role', 'authenticated',
    'app_metadata', json_build_object(
      'admin_capabilities', json_build_array('competitions')
    )
  )::text,
  true
);
set local role authenticated;
select set_config(
  'test.c132_approval',
  public.admin_approve_initial_provider_fixtures(
    current_setting('test.c132_season')::uuid,
    'sportmonks',
    'Publish the reviewed opening calendar'
  )::text,
  true
);
reset role;

select is(
  current_setting('test.c132_approval')::jsonb ->> 'outcome',
  'approved',
  'a competition administrator can explicitly publish the complete initial calendar');

select is(
  (select count(*)::integer
     from public.teams
    where tournament_id = current_setting('test.c132_season')::uuid),
  12,
  'approval creates exactly the twelve canonical Scottish clubs');

select is(
  (select count(*)::integer
     from public.competition_rounds
    where tournament_id = current_setting('test.c132_season')::uuid),
  33,
  'approval creates exactly the 33 published pre-split matchweeks');

select is(
  (select count(*)::integer
     from public.season_fixtures
    where tournament_id = current_setting('test.c132_season')::uuid),
  198,
  'approval creates exactly the 198 published pre-split fixtures');

select is(
  (select count(*)::integer
     from public.season_fixtures
    where tournament_id = current_setting('test.c132_season')::uuid
      and (
        status <> 'scheduled'
        or home_score is not null
        or away_score is not null
      )),
  0,
  'provider FT statuses and scores never become official result truth during fixture approval');

select is(
  (select count(*)::integer
     from predictor_internal.provider_fixture_proposals
    where tournament_id = current_setting('test.c132_season')::uuid
      and state = 'approved'
      and decided_by = md5('c132-admin')::uuid
      and decision_reason = 'Publish the reviewed opening calendar'
      and created_fixture_id is not null),
  198,
  'every approved fixture retains provider evidence, operator, reason and resulting fixture id');

select is(
  (select count(*)::integer
     from public.provider_entity_map
    where tournament_id = current_setting('test.c132_season')::uuid
      and provider = 'sportmonks'),
  46,
  'approval creates one season, twelve team and 33 round provider mappings');

select is(
  (select count(*)::integer
     from public.competition_rounds
    where tournament_id = current_setting('test.c132_season')::uuid
      and round_key = 'sp-mw' || ordinal::text
      and label = 'Matchweek ' || ordinal::text
      and kind = 'league_matchweek'),
  33,
  'SportMonks round names map onto the canonical sp-mwN matchweek keys');

select throws_ok(
  format(
    'update predictor_internal.provider_fixture_proposals set decision_reason = %L where tournament_id = %L::uuid limit 1',
    'rewritten',
    current_setting('test.c132_season')
  ),
  '42601',
  null,
  'Postgres itself rejects UPDATE LIMIT syntax before it could disguise evidence mutation');

select throws_ok(
  format(
    'delete from predictor_internal.provider_fixture_proposals where id = (select id from predictor_internal.provider_fixture_proposals where tournament_id = %L::uuid limit 1)',
    current_setting('test.c132_season')
  ),
  '42501',
  'Provider fixture proposal evidence is append-only',
  'proposal evidence cannot be deleted after the decision');

-- ---------------------------------------------------------------------------
-- Rejection is also a recorded decision and never creates fixtures.
-- ---------------------------------------------------------------------------

insert into public.tournaments (
  name, year, competition_id, season_key, kind, display_timezone, status
)
select 'C132 Provider Rejection Probe', 2031, c.id, 'c132-rejection-probe',
       'league_season', 'Europe/London', 'draft'
  from public.competitions c
 where c.slug = 'scottish-premiership';

select set_config(
  'test.c132_reject_season',
  (select id::text from public.tournaments where season_key = 'c132-rejection-probe'),
  true
);

select is(
  predictor_internal.stage_provider_fixture_proposals(
    current_setting('test.c132_raw')::uuid,
    current_setting('test.c132_reject_season')::uuid
  ) ->> 'inserted',
  '198',
  'the same archived provider evidence can be reviewed independently for another season instance');

set local role authenticated;
select set_config(
  'test.c132_rejection',
  public.admin_reject_initial_provider_fixtures(
    current_setting('test.c132_reject_season')::uuid,
    'sportmonks',
    'Evidence belongs to the approval test only'
  )::text,
  true
);
reset role;

select is(
  current_setting('test.c132_rejection')::jsonb ->> 'outcome',
  'rejected',
  'a competition administrator can explicitly reject a pending provider calendar');

select is(
  (select count(*)::integer
     from predictor_internal.provider_fixture_proposals
    where tournament_id = current_setting('test.c132_reject_season')::uuid
      and state = 'rejected'
      and decided_by = md5('c132-admin')::uuid),
  198,
  'rejection records the actor against every evidence row');

select is(
  (select count(*)::integer
     from public.season_fixtures
    where tournament_id = current_setting('test.c132_reject_season')::uuid),
  0,
  'rejection publishes no fixture');

-- ---------------------------------------------------------------------------
-- Fail closed on stale decoders and partial initial calendars.
-- ---------------------------------------------------------------------------

insert into predictor_internal.provider_raw_responses (
  provider, request_url, response_status, raw_body
) values (
  'sportmonks', 'https://api.sportmonks.com/v3/football/fixtures/old-decoder', 200,
  '{"test":"contract132-old"}'
);

select set_config(
  'test.c132_old_raw',
  (select id::text
     from predictor_internal.provider_raw_responses
    where raw_body = '{"test":"contract132-old"}'
    order by fetched_at desc
    limit 1),
  true
);

insert into predictor_internal.provider_response_processing (
  raw_response_id, decoder_version, succeeded, decoded_fixture_count, normalized_payload
) values (
  current_setting('test.c132_old_raw')::uuid,
  'contract-73-v1',
  true,
  1,
  jsonb_build_array(jsonb_build_object(
    'provider', 'sportmonks',
    'providerFixtureId', 'old-1',
    'competitionProviderId', '501',
    'seasonProviderId', 'old-season',
    'roundProviderId', '1',
    'homeTeamProviderId', '1',
    'homeTeamName', 'Old Home',
    'awayTeamProviderId', '2',
    'awayTeamName', 'Old Away',
    'kickoffAt', '2030-08-01T12:00:00Z',
    'status', 'NS',
    'homeScore', null,
    'awayScore', null
  ))
);

select throws_ok(
  format(
    'select predictor_internal.stage_provider_fixture_proposals(%L::uuid, %L::uuid)',
    current_setting('test.c132_old_raw'),
    current_setting('test.c132_reject_season')
  ),
  '23514',
  'Provider response must be decoded by contract-132-v1 before staging',
  'pre-contract-132 normalized payloads cannot enter the new proposal authority');

insert into public.tournaments (
  name, year, competition_id, season_key, kind, display_timezone, status
)
select 'C132 Partial Provider Probe', 2032, c.id, 'c132-partial-probe',
       'league_season', 'Europe/London', 'draft'
  from public.competitions c
 where c.slug = 'scottish-premiership';

select set_config(
  'test.c132_partial_season',
  (select id::text from public.tournaments where season_key = 'c132-partial-probe'),
  true
);

insert into predictor_internal.provider_raw_responses (
  provider, request_url, response_status, raw_body
) values (
  'sportmonks', 'https://api.sportmonks.com/v3/football/fixtures/partial', 200,
  '{"test":"contract132-partial"}'
);

select set_config(
  'test.c132_partial_raw',
  (select id::text
     from predictor_internal.provider_raw_responses
    where raw_body = '{"test":"contract132-partial"}'
    order by fetched_at desc
    limit 1),
  true
);

insert into predictor_internal.provider_response_processing (
  raw_response_id, decoder_version, succeeded, decoded_fixture_count, normalized_payload
) values (
  current_setting('test.c132_partial_raw')::uuid,
  'contract-132-v1',
  true,
  1,
  jsonb_build_array(jsonb_build_object(
    'provider', 'sportmonks',
    'providerFixtureId', 'partial-1',
    'competitionProviderId', '501',
    'seasonProviderId', 'partial-season',
    'roundProviderId', '1',
    'homeTeamProviderId', '1',
    'homeTeamName', 'Partial Home',
    'awayTeamProviderId', '2',
    'awayTeamName', 'Partial Away',
    'kickoffAt', '2032-08-01T12:00:00Z',
    'status', 'NS',
    'homeScore', null,
    'awayScore', null
  ))
);

select is(
  predictor_internal.stage_provider_fixture_proposals(
    current_setting('test.c132_partial_raw')::uuid,
    current_setting('test.c132_partial_season')::uuid
  ) ->> 'inserted',
  '1',
  'a bounded provider poll may stage a partial batch for later accumulation');

set local role authenticated;
select throws_ok(
  format(
    'select public.admin_approve_initial_provider_fixtures(%L::uuid, %L, %L)',
    current_setting('test.c132_partial_season'),
    'sportmonks',
    'Do not publish a partial season'
  ),
  '23514',
  null,
  'approval refuses a partial initial season instead of publishing the first bounded poll');
reset role;

select is(
  (select count(*)::integer
     from public.season_fixtures
    where tournament_id = current_setting('test.c132_partial_season')::uuid),
  0,
  'the partial approval refusal leaves the canonical season empty');

select finish();
rollback;
