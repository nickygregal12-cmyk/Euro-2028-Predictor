-- Contract 144: provider team profile enrichment foundation.
--
-- This proves the storage is subordinate to the existing provider identity map,
-- provenance cannot be relabelled, duplicate descriptive short codes are legal,
-- stale provider evidence cannot overwrite newer facts, and the whole surface
-- remains server/operator-only.

begin;

select plan(20);

select set_config('test.ptp_tournament',
  (select t.id::text from public.tournaments t where t.name = 'Scottish Premiership 2026/27'), true);

insert into public.teams (tournament_id, name) values
  (current_setting('test.ptp_tournament')::uuid, 'Profile Dundee'),
  (current_setting('test.ptp_tournament')::uuid, 'Profile Dundee United');

select set_config('test.ptp_dundee',
  (select id::text from public.teams
    where tournament_id = current_setting('test.ptp_tournament')::uuid
      and name = 'Profile Dundee'), true);
select set_config('test.ptp_united',
  (select id::text from public.teams
    where tournament_id = current_setting('test.ptp_tournament')::uuid
      and name = 'Profile Dundee United'), true);

insert into public.competition_rounds
  (tournament_id, round_key, ordinal, kind, label)
values
  (current_setting('test.ptp_tournament')::uuid,
   'ptp-round', 9901, 'league_matchweek', 'Profile test round');

select set_config('test.ptp_round',
  (select id::text from public.competition_rounds
    where tournament_id = current_setting('test.ptp_tournament')::uuid
      and round_key = 'ptp-round'), true);

insert into public.provider_entity_map
  (provider, entity_kind, provider_id, tournament_id, team_id, evidence_ref)
values
  ('sportmonks', 'team', 'ptp-284', current_setting('test.ptp_tournament')::uuid,
   current_setting('test.ptp_dundee')::uuid, 'contract 144 test'),
  ('sportmonks', 'team', 'ptp-282', current_setting('test.ptp_tournament')::uuid,
   current_setting('test.ptp_united')::uuid, 'contract 144 test');

insert into public.provider_entity_map
  (provider, entity_kind, provider_id, tournament_id, competition_round_id, evidence_ref)
values
  ('sportmonks', 'round', 'ptp-round-provider', current_setting('test.ptp_tournament')::uuid,
   current_setting('test.ptp_round')::uuid, 'contract 144 non-team test');

select set_config('test.ptp_dundee_map',
  (select id::text from public.provider_entity_map
    where provider='sportmonks' and entity_kind='team' and provider_id='ptp-284'
      and tournament_id=current_setting('test.ptp_tournament')::uuid), true);
select set_config('test.ptp_united_map',
  (select id::text from public.provider_entity_map
    where provider='sportmonks' and entity_kind='team' and provider_id='ptp-282'
      and tournament_id=current_setting('test.ptp_tournament')::uuid), true);
select set_config('test.ptp_round_map',
  (select id::text from public.provider_entity_map
    where provider='sportmonks' and entity_kind='round' and provider_id='ptp-round-provider'
      and tournament_id=current_setting('test.ptp_tournament')::uuid), true);

insert into predictor_internal.provider_raw_responses
  (provider, request_url, response_status, response_headers, raw_body, fetched_at)
values
  ('sportmonks', 'https://api.sportmonks.com/v3/football/fixtures/ptp-old', 200, '{}'::jsonb, '{}', '2026-08-08 09:00:00+00'),
  ('sportmonks', 'https://api.sportmonks.com/v3/football/fixtures/ptp-first', 200, '{}'::jsonb, '{}', '2026-08-08 10:00:00+00'),
  ('sportmonks', 'https://api.sportmonks.com/v3/football/fixtures/ptp-same', 200, '{}'::jsonb, '{}', '2026-08-08 11:00:00+00'),
  ('sportmonks', 'https://api.sportmonks.com/v3/football/fixtures/ptp-change', 200, '{}'::jsonb, '{}', '2026-08-08 12:00:00+00'),
  ('sportmonks', 'https://api.sportmonks.com/v3/football/fixtures/ptp-failed', 500, '{}'::jsonb, '{}', '2026-08-08 13:00:00+00'),
  ('api-football', 'https://v3.football.api-sports.io/fixtures?league=179', 200, '{}'::jsonb, '{}', '2026-08-08 14:00:00+00');

select set_config('test.ptp_old_source',
  (select id::text from predictor_internal.provider_raw_responses
    where request_url='https://api.sportmonks.com/v3/football/fixtures/ptp-old'), true);
select set_config('test.ptp_first_source',
  (select id::text from predictor_internal.provider_raw_responses
    where request_url='https://api.sportmonks.com/v3/football/fixtures/ptp-first'), true);
select set_config('test.ptp_same_source',
  (select id::text from predictor_internal.provider_raw_responses
    where request_url='https://api.sportmonks.com/v3/football/fixtures/ptp-same'), true);
select set_config('test.ptp_change_source',
  (select id::text from predictor_internal.provider_raw_responses
    where request_url='https://api.sportmonks.com/v3/football/fixtures/ptp-change'), true);
select set_config('test.ptp_failed_source',
  (select id::text from predictor_internal.provider_raw_responses
    where request_url='https://api.sportmonks.com/v3/football/fixtures/ptp-failed'), true);
select set_config('test.ptp_other_provider_source',
  (select id::text from predictor_internal.provider_raw_responses
    where request_url='https://v3.football.api-sports.io/fixtures?league=179'), true);

-- ---------------------------------------------------------------------------
-- Shape and reachability
-- ---------------------------------------------------------------------------

select has_table(
  'predictor_internal', 'provider_team_profiles',
  'provider team profiles are stored outside the exposed public schema'
);

select is(
  (select relrowsecurity from pg_class
    where oid='predictor_internal.provider_team_profiles'::regclass),
  true,
  'provider team profiles have RLS enabled as defence in depth'
);

select is(
  (select count(*)::integer from information_schema.role_table_grants
    where table_schema='predictor_internal'
      and table_name='provider_team_profiles'
      and grantee in ('anon','authenticated','service_role')),
  0,
  'no browser or service role receives direct table access'
);

select has_function(
  'predictor_internal', 'upsert_provider_team_profile',
  array['uuid','uuid','text','text','integer','text','text','text'],
  'the controlled profile upsert exists'
);

select is(
  (select count(*)::integer from information_schema.routine_privileges
    where routine_schema='predictor_internal'
      and routine_name='upsert_provider_team_profile'
      and grantee in ('public','anon','authenticated','service_role')),
  0,
  'the profile writer is not granted to browser or service roles'
);

select is(
  (select count(*)::integer from pg_proc proc
    join pg_namespace ns on ns.oid=proc.pronamespace
    where ns.nspname='predictor_internal'
      and proc.proname='upsert_provider_team_profile'
      and proc.prosecdef
      and proc.proconfig @> array['search_path=""']),
  1,
  'the internal writer is security definer with a pinned search path'
);

-- ---------------------------------------------------------------------------
-- Provenance and identity failures
-- ---------------------------------------------------------------------------

select throws_ok(
  format($$select predictor_internal.upsert_provider_team_profile(
    %L::uuid, %L::uuid, 'Round pretending to be a team')$$,
    current_setting('test.ptp_round_map'), current_setting('test.ptp_first_source')),
  '22023', 'Provider mapping is not a team mapping',
  'a non-team provider mapping cannot acquire a team profile'
);

select throws_ok(
  format($$select predictor_internal.upsert_provider_team_profile(
    %L::uuid, %L::uuid, 'Dundee')$$,
    current_setting('test.ptp_dundee_map'), current_setting('test.ptp_other_provider_source')),
  '22023', 'Provider source does not match team mapping',
  'custody evidence from another provider cannot be relabelled onto the mapping'
);

select throws_ok(
  format($$select predictor_internal.upsert_provider_team_profile(
    %L::uuid, %L::uuid, 'Dundee')$$,
    current_setting('test.ptp_dundee_map'), current_setting('test.ptp_failed_source')),
  '22023', 'Provider source response was not successful',
  'a failed provider response cannot become a current profile fact'
);

select throws_ok(
  format($$select predictor_internal.upsert_provider_team_profile(
    %L::uuid, %L::uuid, '   ')$$,
    current_setting('test.ptp_dundee_map'), current_setting('test.ptp_first_source')),
  '22023', 'Provider team name is required',
  'a blank provider name is refused rather than normalized into an empty fact'
);

-- ---------------------------------------------------------------------------
-- First observation and the measured short-code collision
-- ---------------------------------------------------------------------------

select lives_ok(
  format($$select predictor_internal.upsert_provider_team_profile(
    %L::uuid, %L::uuid, 'Dundee', 'DUD', 1893, '1161', '284597', 'https://example.invalid/dundee.png')$$,
    current_setting('test.ptp_dundee_map'), current_setting('test.ptp_first_source')),
  'a valid mapped provider observation creates the current profile'
);

select lives_ok(
  format($$select predictor_internal.upsert_provider_team_profile(
    %L::uuid, %L::uuid, 'Dundee United', 'DUD', 1909, '1161', '8947', 'https://example.invalid/united.png')$$,
    current_setting('test.ptp_united_map'), current_setting('test.ptp_first_source')),
  'duplicate descriptive short codes are legal across teams — DUD is measured for both Dundee clubs'
);

select is(
  (select count(*)::integer from predictor_internal.provider_team_profiles
    where short_code='DUD'),
  2,
  'short code is not an identity or uniqueness key'
);

select is(
  (select last_changed_at from predictor_internal.provider_team_profiles
    where provider_entity_map_id=current_setting('test.ptp_dundee_map')::uuid),
  '2026-08-08 10:00:00+00'::timestamptz,
  'the first provider observation is also the first changed instant'
);

-- ---------------------------------------------------------------------------
-- Re-observation, correction and stale evidence
-- ---------------------------------------------------------------------------

select lives_ok(
  format($$select predictor_internal.upsert_provider_team_profile(
    %L::uuid, %L::uuid, 'Dundee', 'DUD', 1893, '1161', '284597', 'https://example.invalid/dundee.png')$$,
    current_setting('test.ptp_dundee_map'), current_setting('test.ptp_same_source')),
  'an identical later observation is accepted'
);

select is(
  (select jsonb_build_object(
      'lastObserved', last_observed_at,
      'lastChanged', last_changed_at
    )
    from predictor_internal.provider_team_profiles
    where provider_entity_map_id=current_setting('test.ptp_dundee_map')::uuid),
  jsonb_build_object(
    'lastObserved', '2026-08-08 11:00:00+00'::timestamptz,
    'lastChanged', '2026-08-08 10:00:00+00'::timestamptz
  ),
  'identical evidence advances last observed without inventing a change'
);

select lives_ok(
  format($$select predictor_internal.upsert_provider_team_profile(
    %L::uuid, %L::uuid, 'Dundee FC', 'DUD', 1893, '1161', '284597', 'https://example.invalid/dundee.png')$$,
    current_setting('test.ptp_dundee_map'), current_setting('test.ptp_change_source')),
  'a later provider correction updates the current fact'
);

select is(
  (select jsonb_build_object(
      'name', provider_name,
      'lastObserved', last_observed_at,
      'lastChanged', last_changed_at
    )
    from predictor_internal.provider_team_profiles
    where provider_entity_map_id=current_setting('test.ptp_dundee_map')::uuid),
  jsonb_build_object(
    'name', 'Dundee FC',
    'lastObserved', '2026-08-08 12:00:00+00'::timestamptz,
    'lastChanged', '2026-08-08 12:00:00+00'::timestamptz
  ),
  'a changed fact records the custody instant at which the provider correction was observed'
);

select throws_ok(
  format($$select predictor_internal.upsert_provider_team_profile(
    %L::uuid, %L::uuid, 'Old Dundee', 'DUD', 1893, '1161', '284597', null)$$,
    current_setting('test.ptp_dundee_map'), current_setting('test.ptp_old_source')),
  '22023', 'Provider team profile observation is older than the current fact',
  'older retained evidence cannot overwrite a newer current profile'
);

select is(
  (select provider_name from predictor_internal.provider_team_profiles
    where provider_entity_map_id=current_setting('test.ptp_dundee_map')::uuid),
  'Dundee FC',
  'refusing stale evidence leaves the current fact unchanged'
);

select finish();

rollback;
