-- Contract 135: a provider result becomes the official season result.
--
-- THE ASSERTION THIS FILE EXISTS FOR is the owner's amendment made checkable in
-- both directions: a provider final score DOES write the official result, and
-- an administrator's correction STOPS it from writing again. Those two together
-- are the whole decision — "the provider is final truth for awarding points,
-- and it stays correctable in the admin panel" — and either one alone would be
-- a different product.
--
-- WHAT IS DELIBERATELY NOT ASSERTED HERE. That a confirmed result produces
-- points. `177_season_fixture_result_entry.sql` already drives that end of the
-- chain through the real settlement job, and duplicating it here would mean two
-- files failing for one cause. This file proves the link 177 could not: that
-- the result arrives without a human typing it.
--
-- Self-contained: its own season, clubs, rounds, fixtures and provider
-- mappings. It never polls anything — a decoded payload is supplied directly,
-- in the exact `normalized_payload` shape contract 96 stores.

begin;

select plan(25);

-- ---------------------------------------------------------------------------
-- The six new relations are internal and stay that way.
-- ---------------------------------------------------------------------------

select is(
  (select count(*)::integer from information_schema.role_table_grants
    where table_schema = 'predictor_internal'
      and table_name in (
        'provider_status_kinds', 'provider_status_observations',
        'season_fixture_live_state', 'season_fixture_result_sources',
        'provider_result_refusals', 'provider_response_consumption')
      and grantee in ('anon', 'authenticated', 'service_role')),
  0,
  'no contract 135 relation is reachable by a browser or service role');

select is(
  (select count(*)::integer from pg_class c join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'predictor_internal'
      and c.relname in (
        'provider_status_kinds', 'provider_status_observations',
        'season_fixture_live_state', 'season_fixture_result_sources',
        'provider_result_refusals', 'provider_response_consumption')
      and c.relrowsecurity),
  6,
  'and every one of them has row level security enabled');

-- ---------------------------------------------------------------------------
-- The vocabulary, which is the whole fail-closed argument.
-- ---------------------------------------------------------------------------

select is(
  predictor_internal.provider_status_kind('football-data', 'FINISHED'),
  'final',
  'a published finished status is final');

select is(
  predictor_internal.provider_status_kind('football-data', 'IN_PLAY'),
  'in_play',
  'and an in-play one is not');

select is(
  predictor_internal.provider_status_kind('football-data', 'SOMETHING_NEW'),
  'unknown',
  'a token nobody has measured is unknown rather than assumed');

select is(
  predictor_internal.provider_status_kind('sportmonks', '7'),
  'unknown',
  'SportMonks state 7 is after extra time, cannot occur in a league fixture, '
  'and is deliberately unmapped rather than treated as full time');

select is(
  (select count(distinct provider)::integer
     from predictor_internal.provider_status_kinds where kind = 'final'),
  3,
  'each supported provider has exactly one measured way of saying finished');

-- ---------------------------------------------------------------------------
-- Setup: one season, one matchweek, one fixture, mapped to football-data.
-- ---------------------------------------------------------------------------

insert into public.tournaments (name, year, competition_id, season_key, kind, display_timezone, status)
select 'C135 Provider Probe', 2031, t.competition_id, 'pra-probe', 'league_season',
       t.display_timezone, 'active'
  from public.tournaments t
 where t.kind = 'league_season'
 order by t.name
 limit 1;

select set_config('test.pra_season',
  (select id::text from public.tournaments where season_key = 'pra-probe'), true);

insert into public.teams (tournament_id, name) values
  (current_setting('test.pra_season')::uuid, 'Provider Rovers'),
  (current_setting('test.pra_season')::uuid, 'Provider United');

insert into public.competition_rounds (tournament_id, round_key, ordinal, kind, label)
values (current_setting('test.pra_season')::uuid, 'pra-mw1', 1, 'league_matchweek', 'Matchweek 1');

select set_config('test.pra_round',
  (select id::text from public.competition_rounds
    where tournament_id = current_setting('test.pra_season')::uuid
      and round_key = 'pra-mw1'), true);

insert into public.season_fixtures
  (tournament_id, competition_round_id, home_team_id, away_team_id, kickoff_at, status)
select current_setting('test.pra_season')::uuid, current_setting('test.pra_round')::uuid,
       (select id from public.teams
         where tournament_id = current_setting('test.pra_season')::uuid and name = 'Provider Rovers'),
       (select id from public.teams
         where tournament_id = current_setting('test.pra_season')::uuid and name = 'Provider United'),
       now() - interval '2 hours', 'scheduled';

select set_config('test.pra_fixture',
  (select id::text from public.season_fixtures
    where competition_round_id = current_setting('test.pra_round')::uuid), true);

insert into public.provider_entity_map
  (provider, entity_kind, provider_id, tournament_id, competition_round_id, team_id, evidence_ref)
values
  ('football-data', 'season', 'PRA-S1', current_setting('test.pra_season')::uuid,
   null, null, '186_provider_result_authority.sql'),
  ('football-data', 'round', 'PRA-R1', current_setting('test.pra_season')::uuid,
   current_setting('test.pra_round')::uuid, null, '186_provider_result_authority.sql'),
  ('football-data', 'team', 'PRA-T1', current_setting('test.pra_season')::uuid,
   null, (select id from public.teams
           where tournament_id = current_setting('test.pra_season')::uuid
             and name = 'Provider Rovers'), '186_provider_result_authority.sql'),
  ('football-data', 'team', 'PRA-T2', current_setting('test.pra_season')::uuid,
   null, (select id from public.teams
           where tournament_id = current_setting('test.pra_season')::uuid
             and name = 'Provider United'), '186_provider_result_authority.sql');

-- One decoded fixture, parameterised by status and score.
create or replace function pg_temp.pra_payload(p_status text, p_home text, p_away text)
returns jsonb language sql as $$
  select jsonb_build_array(jsonb_build_object(
    'seasonProviderId', 'PRA-S1',
    'roundProviderId', 'PRA-R1',
    'homeTeamProviderId', 'PRA-T1',
    'awayTeamProviderId', 'PRA-T2',
    'status', p_status,
    -- The fixture's own kickoff, so the driver's contract 117 limb sees an
    -- unchanged kickoff rather than a null one. This file is about results.
    'kickoffAt', (select kickoff_at from public.season_fixtures
                   where id = current_setting('test.pra_fixture')::uuid),
    'homeScore', p_home::integer,
    'awayScore', p_away::integer));
$$;

-- ---------------------------------------------------------------------------
-- In play: the projection moves, the result does not.
-- ---------------------------------------------------------------------------

select is(
  (predictor_internal.apply_provider_fixture_facts(
     'football-data', current_setting('test.pra_season')::uuid,
     pg_temp.pra_payload('IN_PLAY', '1', '0')) ->> 'confirmed')::integer,
  0,
  'an in-play fixture confirms no result');

select is(
  (select status from public.season_fixtures
    where id = current_setting('test.pra_fixture')::uuid),
  'scheduled',
  'and the fixture is still scheduled');

select is(
  (select kind || ' ' || home_score || '-' || away_score
     from predictor_internal.season_fixture_live_state
    where season_fixture_id = current_setting('test.pra_fixture')::uuid),
  'in_play 1-0',
  'while the live projection carries what the provider said');

-- ---------------------------------------------------------------------------
-- Finished: the official result is written, with provenance and no actor.
-- ---------------------------------------------------------------------------

select is(
  (predictor_internal.apply_provider_fixture_facts(
     'football-data', current_setting('test.pra_season')::uuid,
     pg_temp.pra_payload('FINISHED', '2', '1')) ->> 'confirmed')::integer,
  1,
  'a finished fixture with both scores confirms the official result');

select is(
  (select status || ' ' || home_score || '-' || away_score
     from public.season_fixtures where id = current_setting('test.pra_fixture')::uuid),
  'played 2-1',
  'and the fixture now holds it');

select is(
  (select revision || ' ' || provider from predictor_internal.season_fixture_result_sources
    where season_fixture_id = current_setting('test.pra_fixture')::uuid),
  '1 football-data',
  'the provenance row names the provider behind revision 1');

select is(
  (select actor_id is null from predictor_internal.season_fixture_result_revisions
    where season_fixture_id = current_setting('test.pra_fixture')::uuid and revision = 1),
  true,
  'and the revision carries no human actor, because no human typed it');

-- ---------------------------------------------------------------------------
-- The same result again changes nothing; a different one corrects.
-- ---------------------------------------------------------------------------

select is(
  (predictor_internal.apply_provider_fixture_facts(
     'football-data', current_setting('test.pra_season')::uuid,
     pg_temp.pra_payload('FINISHED', '2', '1')) ->> 'unchanged')::integer,
  1,
  'the same result again is unchanged rather than a second revision');

select is(
  (predictor_internal.apply_provider_fixture_facts(
     'football-data', current_setting('test.pra_season')::uuid,
     pg_temp.pra_payload('FINISHED', '3', '1')) ->> 'corrected')::integer,
  1,
  'a provider that revises its own score records a correction');

select is(
  (select reason is not null from predictor_internal.season_fixture_result_revisions
    where season_fixture_id = current_setting('test.pra_fixture')::uuid and revision = 2),
  true,
  'and that correction carries a reason, as contract 125 requires of one');

-- ---------------------------------------------------------------------------
-- The administrator wins. This is the half the owner asked for by name.
-- ---------------------------------------------------------------------------

set local session_replication_role = replica;
insert into auth.users (
  id, email, aud, role, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
values (md5('pra-admin')::uuid, 'pra-admin@example.test', 'authenticated', 'authenticated',
        '{}'::jsonb, '{}'::jsonb, now(), now());
set local session_replication_role = origin;

select set_config('request.jwt.claims',
  json_build_object('sub', md5('pra-admin')::uuid, 'role', 'authenticated',
                    'app_metadata', json_build_object())::text, true);

select predictor_internal.record_season_fixture_result(
  current_setting('test.pra_fixture')::uuid, 'correct', 0::smallint, 0::smallint,
  'Awarded 0-0 by the league');

select set_config('request.jwt.claims', null, true);

select is(
  (predictor_internal.apply_provider_fixture_facts(
     'football-data', current_setting('test.pra_season')::uuid,
     pg_temp.pra_payload('FINISHED', '3', '1')) ->> 'administratorOwned')::integer,
  1,
  'once an administrator has corrected a result the provider is refused');

select is(
  (select home_score || '-' || away_score from public.season_fixtures
    where id = current_setting('test.pra_fixture')::uuid),
  '0-0',
  'and the administrator''s result stands');

select is(
  (select reason from predictor_internal.provider_result_refusals
    where season_fixture_id = current_setting('test.pra_fixture')::uuid
      and reason = 'administrator_owns_result'
    limit 1),
  'administrator_owns_result',
  'with the refusal recorded rather than dropped -- a provider that silently '
  'stops writing is indistinguishable from one that agrees');

-- ---------------------------------------------------------------------------
-- Fail-closed: an unmeasured status, and an unmapped identifier.
-- ---------------------------------------------------------------------------

select is(
  (predictor_internal.apply_provider_fixture_facts(
     'football-data', current_setting('test.pra_season')::uuid,
     pg_temp.pra_payload('SOMETHING_NEW', '9', '9')) ->> 'unknownStatus')::integer,
  1,
  'an unmeasured status writes no result');

select is(
  (select fixtures from predictor_internal.provider_status_observations
    where provider_status = 'SOMETHING_NEW'
      and tournament_id = current_setting('test.pra_season')::uuid),
  1,
  'and is recorded, so a fail-closed vocabulary is visible rather than silent');

select is(
  predictor_internal.apply_provider_fixture_facts(
    'football-data', current_setting('test.pra_season')::uuid,
    jsonb_build_array(jsonb_build_object(
      'roundProviderId', 'PRA-R1',
      'homeTeamProviderId', 'PRA-T1',
      'awayTeamProviderId', 'PRA-UNMAPPED',
      'status', 'FINISHED', 'homeScore', 5, 'awayScore', 5))) ->> 'reason',
  'unmapped_identifiers',
  'one unmapped club fails the whole payload, exactly as contract 117 does');

-- ---------------------------------------------------------------------------
-- The driver, and the idempotency that makes it safe to run every five minutes.
-- ---------------------------------------------------------------------------

insert into predictor_internal.provider_raw_responses
  (provider, request_url, request_method, response_status, raw_body)
values ('football-data', 'https://api.football-data.org/v4/competitions/PRA/matches',
        'GET', 200, '{"probe":true}');

insert into predictor_internal.provider_response_processing
  (raw_response_id, decoder_version, succeeded, decoded_fixture_count, normalized_payload)
select id, '186-probe', true, 1, pg_temp.pra_payload('SCHEDULED', null, null)
  from predictor_internal.provider_raw_responses
 where request_url like '%/competitions/PRA/matches';

select is(
  (predictor_internal.consume_provider_responses() ->> 'considered')::integer,
  1,
  'the driver consumes a decoded response that nothing had ever read');

select is(
  (predictor_internal.consume_provider_responses() ->> 'considered')::integer,
  0,
  'and consumes it exactly once, which is what makes a five-minute job safe');

select finish();
rollback;
