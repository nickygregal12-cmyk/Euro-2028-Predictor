-- Contract 117: a provider kickoff change reaches the fixture.
--
-- Self-contained: every team, round, fixture and map row this suite needs is
-- created here. Contract 112's suite was written against development seed data,
-- passed on a developer machine and failed in CI, where the database is built
-- from migrations alone.
--
-- The assertion this file exists for is the one about the ROUND. The owner
-- amendment of 5 August 2026 says a rescheduled fixture stays in the matchweek
-- it was scheduled in, and the comfortable implementation moves it to wherever
-- its new kickoff lands. So the moved kickoff below is deliberately placed
-- inside the NEXT matchweek's week, and the fixture is expected not to budge.

begin;

select plan(27);

select set_config('test.pfr_season',
  (select t.id::text from public.tournaments t where t.name = 'Premier League 2026/27'), true);

insert into public.teams (tournament_id, name) values
  (current_setting('test.pfr_season')::uuid, 'Revision Rovers'),
  (current_setting('test.pfr_season')::uuid, 'Revision United'),
  (current_setting('test.pfr_season')::uuid, 'Revision Athletic');

insert into public.competition_rounds (tournament_id, round_key, ordinal, kind, label) values
  (current_setting('test.pfr_season')::uuid, 'pfr-mw1', 971, 'league_matchweek', 'Revision Matchweek 1'),
  (current_setting('test.pfr_season')::uuid, 'pfr-mw2', 972, 'league_matchweek', 'Revision Matchweek 2');

select set_config('test.pfr_r1', (select id::text from public.competition_rounds
  where tournament_id = current_setting('test.pfr_season')::uuid and round_key = 'pfr-mw1'), true);
select set_config('test.pfr_r2', (select id::text from public.competition_rounds
  where tournament_id = current_setting('test.pfr_season')::uuid and round_key = 'pfr-mw2'), true);
select set_config('test.pfr_home', (select id::text from public.teams
  where tournament_id = current_setting('test.pfr_season')::uuid and name = 'Revision Rovers'), true);
select set_config('test.pfr_away', (select id::text from public.teams
  where tournament_id = current_setting('test.pfr_season')::uuid and name = 'Revision United'), true);
select set_config('test.pfr_third', (select id::text from public.teams
  where tournament_id = current_setting('test.pfr_season')::uuid and name = 'Revision Athletic'), true);

insert into public.provider_entity_map (provider, entity_kind, provider_id, tournament_id, evidence_ref)
values ('football-data', 'season', 'pfr-season', current_setting('test.pfr_season')::uuid, 'test');
insert into public.provider_entity_map
  (provider, entity_kind, provider_id, tournament_id, competition_round_id, evidence_ref)
values
  ('football-data', 'round', 'pfr-1', current_setting('test.pfr_season')::uuid,
   current_setting('test.pfr_r1')::uuid, 'test'),
  ('football-data', 'round', 'pfr-2', current_setting('test.pfr_season')::uuid,
   current_setting('test.pfr_r2')::uuid, 'test');
insert into public.provider_entity_map
  (provider, entity_kind, provider_id, tournament_id, team_id, evidence_ref)
values
  ('football-data', 'team', 'pfr-h', current_setting('test.pfr_season')::uuid,
   current_setting('test.pfr_home')::uuid, 'test'),
  ('football-data', 'team', 'pfr-a', current_setting('test.pfr_season')::uuid,
   current_setting('test.pfr_away')::uuid, 'test'),
  ('football-data', 'team', 'pfr-x', current_setting('test.pfr_season')::uuid,
   current_setting('test.pfr_third')::uuid, 'test');

insert into public.season_fixtures
  (tournament_id, competition_round_id, home_team_id, away_team_id, kickoff_at, status)
values (current_setting('test.pfr_season')::uuid, current_setting('test.pfr_r1')::uuid,
        current_setting('test.pfr_home')::uuid, current_setting('test.pfr_away')::uuid,
        timestamptz '2030-09-07 14:00:00+00', 'scheduled');

select set_config('test.pfr_fixture', (select id::text from public.season_fixtures
  where tournament_id = current_setting('test.pfr_season')::uuid
    and home_team_id = current_setting('test.pfr_home')::uuid), true);

-- A payload entry helper. `pfr-1` is matchweek 1; the moved kickoff below sits
-- in matchweek 2's week on purpose.
select set_config('test.pfr_payload_moved', jsonb_build_array(jsonb_build_object(
  'provider', 'football-data', 'providerFixtureId', 'pf-1',
  'competitionProviderId', 'pfr-comp', 'seasonProviderId', 'pfr-season',
  'roundProviderId', 'pfr-1', 'homeTeamProviderId', 'pfr-h', 'awayTeamProviderId', 'pfr-a',
  'kickoffAt', '2030-09-16T19:00:00+00:00', 'status', 'SCHEDULED',
  'homeScore', null, 'awayScore', null))::text, true);

-- ---------------------------------------------------------------------------
-- Reachability
-- ---------------------------------------------------------------------------

select is(
  (select count(*)::integer from information_schema.routine_privileges
    where routine_name in ('import_provider_fixture_revisions',
                           'block_season_fixture_revision_rewrite')
      and grantee in ('anon', 'authenticated', 'service_role')),
  0,
  'no browser or service role may import a revision or touch the immutability guard'
);

select is(
  (select count(*)::integer from pg_proc proc
    join pg_namespace ns on ns.oid = proc.pronamespace
   where ns.nspname = 'predictor_internal'
     and proc.proname in ('import_provider_fixture_revisions',
                          'block_season_fixture_revision_rewrite')
     and proc.prosecdef and proc.proconfig @> array['search_path=""']),
  2,
  'and both are security definer with a pinned search path'
);

select is(
  (select count(*)::integer from information_schema.role_table_grants
    where table_name = 'season_fixture_revisions'
      and grantee in ('anon', 'authenticated', 'service_role')),
  0,
  'the revision record reaches no browser or service role'
);

select is(
  (select relrowsecurity from pg_class c join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'predictor_internal' and c.relname = 'season_fixture_revisions'),
  true,
  'and has row level security enabled'
);

-- ---------------------------------------------------------------------------
-- It fails closed on the whole payload
-- ---------------------------------------------------------------------------

select is(
  predictor_internal.import_provider_fixture_revisions(
    'football-data', current_setting('test.pfr_season')::uuid,
    jsonb_build_array(
      current_setting('test.pfr_payload_moved')::jsonb->0,
      jsonb_build_object('providerFixtureId', 'pf-2', 'roundProviderId', 'pfr-1',
        'homeTeamProviderId', 'pfr-h', 'awayTeamProviderId', 'NOT-MAPPED',
        'kickoffAt', '2030-09-20T19:00:00+00:00')),
    null, timestamptz '2030-09-01 12:00:00+00')->>'applied',
  'false',
  'one unmapped identifier refuses the WHOLE payload, because a half-applied fixture list leaves some kickoffs current and some stale with no record of which'
);

select is(
  (select kickoff_at from public.season_fixtures where id = current_setting('test.pfr_fixture')::uuid),
  timestamptz '2030-09-07 14:00:00+00',
  'and the mapped fixture in that same payload is genuinely untouched, not merely reported as such'
);

select is(
  (select count(*)::integer from predictor_internal.season_fixture_revisions),
  0,
  'nor is a revision recorded for it'
);

-- ---------------------------------------------------------------------------
-- The revision itself, and the rule the amendment made
-- ---------------------------------------------------------------------------

select is(
  predictor_internal.import_provider_fixture_revisions(
    'football-data', current_setting('test.pfr_season')::uuid,
    current_setting('test.pfr_payload_moved')::jsonb,
    null, timestamptz '2030-09-01 12:00:00+00'),
  jsonb_build_object('applied', true, 'considered', 1, 'revised', 1,
                     'unchanged', 0, 'unmatched', 0, 'refused', 0,
                     -- Contract 123. The round the fixture stayed in now plays
                     -- over a different span, so its stored window is refreshed
                     -- in the same transaction and reported here.
                     'windows', jsonb_build_object(
                       'refreshed', 1, 'unchanged', 0, 'cleared', 0,
                       'conflicted', 0, 'queued', 0)),
  'a mapped payload whose kickoff moved revises exactly one fixture'
);

select is(
  (select kickoff_at from public.season_fixtures where id = current_setting('test.pfr_fixture')::uuid),
  timestamptz '2030-09-16 19:00:00+00',
  'the fixture now carries the provider''s kickoff'
);

-- THE assertion. The new instant is nine days on, inside matchweek 2's week.
select is(
  (select competition_round_id from public.season_fixtures
    where id = current_setting('test.pfr_fixture')::uuid),
  current_setting('test.pfr_r1')::uuid,
  'and it is STILL in matchweek 1 — the owner amendment: a rescheduled fixture keeps the matchweek it was scheduled in, however far its new kickoff moves'
);

select is(
  (select jsonb_build_object('from', previous_kickoff_at, 'to', new_kickoff_at,
                             'provider', provider, 'pf', provider_fixture_id,
                             'reviewed', reviewed_at is null)
     from predictor_internal.season_fixture_revisions),
  jsonb_build_object('from', timestamptz '2030-09-07 14:00:00+00',
                     'to', timestamptz '2030-09-16 19:00:00+00',
                     'provider', 'football-data', 'pf', 'pf-1', 'reviewed', true),
  'and the move is recorded with the instant it moved FROM, unreviewed — a column that has been overwritten cannot be reviewed'
);

select is(
  predictor_internal.import_provider_fixture_revisions(
    'football-data', current_setting('test.pfr_season')::uuid,
    current_setting('test.pfr_payload_moved')::jsonb,
    null, timestamptz '2030-09-01 12:00:00+00'),
  jsonb_build_object('applied', true, 'considered', 1, 'revised', 0,
                     'unchanged', 1, 'unmatched', 0, 'refused', 0,
                     -- Contract 123. Nothing moved, so nothing is recomputed —
                     -- the refresh is not run at all rather than run and found
                     -- to have nothing to do.
                     'windows', null),
  're-importing the same payload changes nothing and is counted as unchanged, so a scheduled importer does not fill the review queue with noise'
);

select is(
  (select count(*)::integer from predictor_internal.season_fixture_revisions),
  1,
  'and writes no second revision row'
);

-- ---------------------------------------------------------------------------
-- What it refuses to do
-- ---------------------------------------------------------------------------

select is(
  predictor_internal.import_provider_fixture_revisions(
    'football-data', current_setting('test.pfr_season')::uuid,
    jsonb_build_array(jsonb_build_object(
      'providerFixtureId', 'pf-new', 'roundProviderId', 'pfr-2',
      'homeTeamProviderId', 'pfr-h', 'awayTeamProviderId', 'pfr-x',
      'kickoffAt', '2030-09-21T14:00:00+00:00')),
    null, timestamptz '2030-09-01 12:00:00+00'),
  jsonb_build_object('applied', true, 'considered', 1, 'revised', 0,
                     'unchanged', 0, 'unmatched', 1, 'refused', 0),
  'a fixture this platform does not hold is counted as unmatched, never created — what a competition consists of is not a kickoff importer''s decision'
);

select is(
  (select count(*)::integer from public.season_fixtures
    where tournament_id = current_setting('test.pfr_season')::uuid),
  1,
  'and no fixture row appears'
);

select is(
  predictor_internal.import_provider_fixture_revisions(
    'football-data', current_setting('test.pfr_season')::uuid,
    jsonb_build_array(jsonb_build_object(
      'providerFixtureId', 'pf-1', 'roundProviderId', 'pfr-1',
      'homeTeamProviderId', 'pfr-h', 'awayTeamProviderId', 'pfr-a',
      'kickoffAt', '2030-08-01T14:00:00+00:00')),
    null, timestamptz '2030-09-01 12:00:00+00')->>'refused',
  '1',
  'a kickoff moved into the PAST is refused — it would retroactively close a lock that was open, the one direction that can invalidate a prediction somebody was entitled to make'
);

select is(
  (select kickoff_at from public.season_fixtures where id = current_setting('test.pfr_fixture')::uuid),
  timestamptz '2030-09-16 19:00:00+00',
  'and the fixture keeps the kickoff it had'
);

update public.season_fixtures set status = 'played', home_score = 1, away_score = 0
 where id = current_setting('test.pfr_fixture')::uuid;

select is(
  predictor_internal.import_provider_fixture_revisions(
    'football-data', current_setting('test.pfr_season')::uuid,
    jsonb_build_array(jsonb_build_object(
      'providerFixtureId', 'pf-1', 'roundProviderId', 'pfr-1',
      'homeTeamProviderId', 'pfr-h', 'awayTeamProviderId', 'pfr-a',
      'kickoffAt', '2030-10-05T14:00:00+00:00')),
    null, timestamptz '2030-09-01 12:00:00+00')->>'refused',
  '1',
  'a fixture that is no longer scheduled is refused too — once played, its kickoff is a historical fact rather than a plan'
);

select is(
  (select kickoff_at from public.season_fixtures where id = current_setting('test.pfr_fixture')::uuid),
  timestamptz '2030-09-16 19:00:00+00',
  'and its kickoff is genuinely unmoved rather than merely counted as refused'
);

update public.season_fixtures set status = 'scheduled', home_score = null, away_score = null
 where id = current_setting('test.pfr_fixture')::uuid;

select throws_ok(
  format('select predictor_internal.import_provider_fixture_revisions(%L, %L::uuid, %L::jsonb, null, null)',
         'football-data', current_setting('test.pfr_season'), '[]'),
  '22023', null,
  'a null import instant is refused rather than treated as now, which would make both refusals untestable'
);

select throws_ok(
  format('select predictor_internal.import_provider_fixture_revisions(%L, %L::uuid, %L::jsonb)',
         'football-data', md5('pfr-nowhere')::uuid, '[]'),
  '23503', null,
  'and an unknown competition season is refused rather than silently importing nothing'
);

-- ---------------------------------------------------------------------------
-- The record is evidence
-- ---------------------------------------------------------------------------

select lives_ok(
  $$update predictor_internal.season_fixture_revisions set reviewed_at = now()$$,
  'an administrator may mark a revision reviewed'
);

select throws_ok(
  $$update predictor_internal.season_fixture_revisions
       set previous_kickoff_at = '2030-01-01 00:00:00+00'$$,
  '42501', null,
  'but may not rewrite what the kickoff moved from, which would make the queue a record of what somebody decided rather than of what a provider said'
);

select throws_ok(
  $$delete from predictor_internal.season_fixture_revisions$$,
  '42501', null,
  'and may not delete one at all'
);

select throws_ok(
  format($$insert into predictor_internal.season_fixture_revisions
             (tournament_id, season_fixture_id, provider, previous_kickoff_at, new_kickoff_at)
           values (%L::uuid, %L::uuid, 'football-data',
                   '2030-09-16 19:00:00+00', '2030-09-16 19:00:00+00')$$,
         current_setting('test.pfr_season'), current_setting('test.pfr_fixture')),
  '23514', null,
  'a revision that moved nothing is refused, because it would be noise in the queue an administrator is meant to read'
);

select throws_ok(
  format($$insert into predictor_internal.season_fixture_revisions
             (tournament_id, season_fixture_id, provider, previous_kickoff_at, new_kickoff_at)
           values (%L::uuid, %L::uuid, 'opta', '2030-09-16 19:00:00+00', '2030-09-20 19:00:00+00')$$,
         current_setting('test.pfr_season'), current_setting('test.pfr_fixture')),
  '23514', null,
  'and a provider this platform has no decoder for cannot appear in the record'
);

select is(
  (select count(*)::integer from pg_trigger t
     join pg_class c on c.oid = t.tgrelid
     join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'predictor_internal'
      and c.relname = 'season_fixture_revisions'
      and not t.tgisinternal),
  1,
  'one trigger owns that immutability, bound to the table rather than trusted to callers'
);

select finish();

rollback;
