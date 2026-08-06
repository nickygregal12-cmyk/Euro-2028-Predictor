-- Contract 123: a stale round play window is refreshed, and a conflicting
-- refresh queues rather than fails.
--
-- THE CONFLICT PATH IS THE ASSERTION THIS FILE EXISTS FOR. Everything else here
-- is a round's span following its own fixtures, which is contract 113's rule
-- restated at a smaller scale. What is genuinely decided by this contract is
-- what happens when the span cannot follow them: a postponed fixture stretches
-- a round into its neighbour's window, contract 113's disjointness trigger
-- refuses two rounds claiming one instant, and the choice is between failing an
-- ordinary provider import, inventing a boundary nobody agreed, and keeping the
-- stored fact while telling an administrator.
--
-- So the assertions below check BOTH halves of that answer against the
-- database rather than against the return value: the old window is still there,
-- byte for byte, AND the proposal that could not be applied is in the queue
-- with the round that blocked it. A refresh that returned `conflicted: 1` and
-- had quietly written half a window would satisfy a return-value check alone.
--
-- Self-contained. Every season, round, club, fixture and provider map row this
-- suite needs is created here, because CI builds the database from migrations
-- alone and the league seasons arrive without any matchweeks.

begin;

select plan(35);

-- ---------------------------------------------------------------------------
-- The boundary.
-- ---------------------------------------------------------------------------

select ok(
  to_regprocedure('predictor_internal.refresh_round_play_windows(uuid,uuid[],timestamptz)') is not null,
  'the refresh exists');

select is(
  (select count(*)::integer from information_schema.routine_privileges
    where routine_name in ('refresh_round_play_windows',
                           'block_round_window_conflict_rewrite')
      and grantee in ('anon', 'authenticated', 'service_role')),
  0,
  'no browser or service role may refresh a window or touch the immutability guard');

select is(
  (select count(*)::integer from pg_proc proc
    join pg_namespace ns on ns.oid = proc.pronamespace
   where ns.nspname = 'predictor_internal'
     and proc.proname in ('refresh_round_play_windows',
                          'block_round_window_conflict_rewrite')
     and proc.prosecdef and proc.proconfig @> array['search_path=""']),
  2,
  'and both are security definer with a pinned search path');

select is(
  (select count(*)::integer from information_schema.role_table_grants
    where table_name = 'round_window_refresh_conflicts'
      and grantee in ('anon', 'authenticated', 'service_role')),
  0,
  'the conflict queue reaches no browser or service role');

select is(
  (select relrowsecurity from pg_class c join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'predictor_internal' and c.relname = 'round_window_refresh_conflicts'),
  true,
  'and has row level security enabled');

-- ---------------------------------------------------------------------------
-- Setup: one probe season, three matchweeks, four fixtures.
--
--   MW1  A v B  2030-09-07 14:00Z   and   C v D  2030-09-07 16:30Z
--   MW2  A v B  2030-09-14 14:00Z
--   MW3  A v B  2030-09-21 14:00Z
--
-- A separate season rather than a shared one, so nothing here depends on what
-- another suite or a seed script put in the Premier League.
-- ---------------------------------------------------------------------------

insert into public.tournaments (name, year, competition_id, season_key, kind, display_timezone, status)
select 'C123 Window Refresh Probe', 2030, t.competition_id, 'rws-probe', 'league_season',
       t.display_timezone, 'active'
  from public.tournaments t
 where t.kind = 'league_season'
 order by t.name
 limit 1;

select set_config('test.rws_season',
  (select id::text from public.tournaments where season_key = 'rws-probe'), true);

insert into public.competition_rounds (tournament_id, round_key, ordinal, kind, label) values
  (current_setting('test.rws_season')::uuid, 'rws-mw1', 981, 'league_matchweek', 'Refresh Matchweek 1'),
  (current_setting('test.rws_season')::uuid, 'rws-mw2', 982, 'league_matchweek', 'Refresh Matchweek 2'),
  (current_setting('test.rws_season')::uuid, 'rws-mw3', 983, 'league_matchweek', 'Refresh Matchweek 3');

insert into public.teams (tournament_id, name) values
  (current_setting('test.rws_season')::uuid, 'Refresh Albion'),
  (current_setting('test.rws_season')::uuid, 'Refresh Borough'),
  (current_setting('test.rws_season')::uuid, 'Refresh City'),
  (current_setting('test.rws_season')::uuid, 'Refresh Dynamo');

select set_config('test.rws_mw1', (select id::text from public.competition_rounds
  where tournament_id = current_setting('test.rws_season')::uuid and round_key = 'rws-mw1'), true);
select set_config('test.rws_mw2', (select id::text from public.competition_rounds
  where tournament_id = current_setting('test.rws_season')::uuid and round_key = 'rws-mw2'), true);
select set_config('test.rws_mw3', (select id::text from public.competition_rounds
  where tournament_id = current_setting('test.rws_season')::uuid and round_key = 'rws-mw3'), true);

select set_config('test.rws_a', (select id::text from public.teams
  where tournament_id = current_setting('test.rws_season')::uuid and name = 'Refresh Albion'), true);
select set_config('test.rws_b', (select id::text from public.teams
  where tournament_id = current_setting('test.rws_season')::uuid and name = 'Refresh Borough'), true);
select set_config('test.rws_c', (select id::text from public.teams
  where tournament_id = current_setting('test.rws_season')::uuid and name = 'Refresh City'), true);
select set_config('test.rws_d', (select id::text from public.teams
  where tournament_id = current_setting('test.rws_season')::uuid and name = 'Refresh Dynamo'), true);

insert into public.season_fixtures
  (tournament_id, competition_round_id, home_team_id, away_team_id, kickoff_at, status) values
  (current_setting('test.rws_season')::uuid, current_setting('test.rws_mw1')::uuid,
   current_setting('test.rws_a')::uuid, current_setting('test.rws_b')::uuid,
   timestamptz '2030-09-07 14:00:00+00', 'scheduled'),
  (current_setting('test.rws_season')::uuid, current_setting('test.rws_mw1')::uuid,
   current_setting('test.rws_c')::uuid, current_setting('test.rws_d')::uuid,
   timestamptz '2030-09-07 16:30:00+00', 'scheduled'),
  (current_setting('test.rws_season')::uuid, current_setting('test.rws_mw2')::uuid,
   current_setting('test.rws_a')::uuid, current_setting('test.rws_b')::uuid,
   timestamptz '2030-09-14 14:00:00+00', 'scheduled'),
  (current_setting('test.rws_season')::uuid, current_setting('test.rws_mw3')::uuid,
   current_setting('test.rws_a')::uuid, current_setting('test.rws_b')::uuid,
   timestamptz '2030-09-21 14:00:00+00', 'scheduled');

-- The fixture that moves, and the one contract 117 will move through the map.
select set_config('test.rws_late', (select id::text from public.season_fixtures
  where competition_round_id = current_setting('test.rws_mw1')::uuid
    and home_team_id = current_setting('test.rws_c')::uuid), true);
select set_config('test.rws_mw3_fixture', (select id::text from public.season_fixtures
  where competition_round_id = current_setting('test.rws_mw3')::uuid), true);

insert into public.provider_entity_map (provider, entity_kind, provider_id, tournament_id, evidence_ref)
values ('football-data', 'season', 'rws-season', current_setting('test.rws_season')::uuid, 'test');
insert into public.provider_entity_map
  (provider, entity_kind, provider_id, tournament_id, competition_round_id, evidence_ref)
values ('football-data', 'round', 'rws-3', current_setting('test.rws_season')::uuid,
        current_setting('test.rws_mw3')::uuid, 'test');
insert into public.provider_entity_map
  (provider, entity_kind, provider_id, tournament_id, team_id, evidence_ref)
values
  ('football-data', 'team', 'rws-a', current_setting('test.rws_season')::uuid,
   current_setting('test.rws_a')::uuid, 'test'),
  ('football-data', 'team', 'rws-b', current_setting('test.rws_season')::uuid,
   current_setting('test.rws_b')::uuid, 'test');

-- ---------------------------------------------------------------------------
-- The starting calendar.
-- ---------------------------------------------------------------------------

select is(
  predictor_internal.refresh_round_play_windows(
    current_setting('test.rws_season')::uuid, null, timestamptz '2030-09-01 12:00:00+00'),
  jsonb_build_object('refreshed', 3, 'unchanged', 0, 'cleared', 0,
                     'conflicted', 0, 'queued', 0),
  'a season whose windows have never been derived gets all three from its own fixtures');

select is(
  (select jsonb_build_object('opens', window_opens_at, 'closes', window_closes_at)
     from public.competition_rounds where id = current_setting('test.rws_mw1')::uuid),
  jsonb_build_object('opens', timestamptz '2030-09-07 14:00:00+00',
                     'closes', timestamptz '2030-09-07 16:30:00+00'),
  'matchweek 1 spans its own first kickoff to its own last');

-- ---------------------------------------------------------------------------
-- A postponement that stays clear of the next round is simply applied.
-- ---------------------------------------------------------------------------

update public.season_fixtures
   set kickoff_at = timestamptz '2030-09-09 20:00:00+00'
 where id = current_setting('test.rws_late')::uuid;

select is(
  predictor_internal.refresh_round_play_windows(
    current_setting('test.rws_season')::uuid,
    array[current_setting('test.rws_mw1')::uuid],
    timestamptz '2030-09-01 12:00:00+00'),
  jsonb_build_object('refreshed', 1, 'unchanged', 0, 'cleared', 0,
                     'conflicted', 0, 'queued', 0),
  'a fixture postponed to the Monday widens its round and is applied');

select is(
  (select window_closes_at from public.competition_rounds
    where id = current_setting('test.rws_mw1')::uuid),
  timestamptz '2030-09-09 20:00:00+00',
  'the stored window follows the kickoff that moved');

select is(
  (select count(*)::integer from predictor_internal.round_window_refresh_conflicts),
  0,
  'and nothing is queued, because nothing was refused');

-- ---------------------------------------------------------------------------
-- THE CONFLICT. The same fixture moves again, this time onto matchweek 2's
-- only kickoff, so matchweek 1's proposed span would claim an instant
-- matchweek 2 already claims.
-- ---------------------------------------------------------------------------

update public.season_fixtures
   set kickoff_at = timestamptz '2030-09-14 14:00:00+00'
 where id = current_setting('test.rws_late')::uuid;

select is(
  predictor_internal.refresh_round_play_windows(
    current_setting('test.rws_season')::uuid,
    array[current_setting('test.rws_mw1')::uuid],
    timestamptz '2030-09-02 09:00:00+00'),
  jsonb_build_object('refreshed', 0, 'unchanged', 0, 'cleared', 0,
                     'conflicted', 1, 'queued', 1),
  'an overlapping proposal is refused and queued, and the refresh RETURNS — a '
  'raise here would roll back the whole provider import');

-- THE assertion. Not "the refresh said it refused" but "the stored fact is
-- still the stored fact".
select is(
  (select jsonb_build_object('opens', window_opens_at, 'closes', window_closes_at)
     from public.competition_rounds where id = current_setting('test.rws_mw1')::uuid),
  jsonb_build_object('opens', timestamptz '2030-09-07 14:00:00+00',
                     'closes', timestamptz '2030-09-09 20:00:00+00'),
  'matchweek 1 keeps the window it had — a refused refresh writes NOTHING, not '
  'a half-applied span');

select is(
  (select jsonb_build_object('opens', window_opens_at, 'closes', window_closes_at)
     from public.competition_rounds where id = current_setting('test.rws_mw2')::uuid),
  jsonb_build_object('opens', timestamptz '2030-09-14 14:00:00+00',
                     'closes', timestamptz '2030-09-14 14:00:00+00'),
  'and matchweek 2 is untouched — the blocking round is never widened or moved '
  'to make room, which would invent the boundary contract 113 left open');

select is(
  (select jsonb_build_object(
            'round', competition_round_id = current_setting('test.rws_mw1')::uuid,
            'retained_opens', retained_opens_at, 'retained_closes', retained_closes_at,
            'proposed_opens', proposed_opens_at, 'proposed_closes', proposed_closes_at,
            'blocked_by', blocking_round_id = current_setting('test.rws_mw2')::uuid,
            'blocking_opens', blocking_opens_at, 'blocking_closes', blocking_closes_at,
            'detected', detected_at, 'unreviewed', reviewed_at is null)
     from predictor_internal.round_window_refresh_conflicts),
  jsonb_build_object(
    'round', true,
    'retained_opens', timestamptz '2030-09-07 14:00:00+00',
    'retained_closes', timestamptz '2030-09-09 20:00:00+00',
    'proposed_opens', timestamptz '2030-09-07 14:00:00+00',
    'proposed_closes', timestamptz '2030-09-14 14:00:00+00',
    'blocked_by', true,
    'blocking_opens', timestamptz '2030-09-14 14:00:00+00',
    'blocking_closes', timestamptz '2030-09-14 14:00:00+00',
    'detected', timestamptz '2030-09-02 09:00:00+00',
    'unreviewed', true),
  'the queue says what was kept, what was proposed, and which round stood in '
  'the way — an administrator can act on all three');

select is(
  (select count(*)::integer from predictor_internal.round_window_refresh_conflicts),
  1,
  'exactly one row, not one per overlapping round');

-- ---------------------------------------------------------------------------
-- The queue does not grow while nobody acts.
--
-- Contract 115 drives the provider poll hourly, so an unresolved conflict is
-- re-proposed on every cadence. A queue that gains an identical row an hour is
-- a queue nobody reads.
-- ---------------------------------------------------------------------------

select is(
  predictor_internal.refresh_round_play_windows(
    current_setting('test.rws_season')::uuid,
    array[current_setting('test.rws_mw1')::uuid],
    timestamptz '2030-09-02 10:00:00+00'),
  jsonb_build_object('refreshed', 0, 'unchanged', 0, 'cleared', 0,
                     'conflicted', 1, 'queued', 0),
  're-running with the same proposal still refuses, and queues nothing new');

select is(
  (select count(*)::integer from predictor_internal.round_window_refresh_conflicts),
  1,
  'so the hourly poll cannot fill the queue with copies of one conflict');

-- A DIFFERENT proposal is different information, and does queue.
update public.season_fixtures
   set kickoff_at = timestamptz '2030-09-15 14:00:00+00'
 where id = current_setting('test.rws_late')::uuid;

select is(
  predictor_internal.refresh_round_play_windows(
    current_setting('test.rws_season')::uuid,
    array[current_setting('test.rws_mw1')::uuid],
    timestamptz '2030-09-02 11:00:00+00'),
  jsonb_build_object('refreshed', 0, 'unchanged', 0, 'cleared', 0,
                     'conflicted', 1, 'queued', 1),
  'a further reschedule proposes a different span, which is new information');

select is(
  (select count(*)::integer from predictor_internal.round_window_refresh_conflicts),
  2,
  'and earns its own row rather than being folded into the first');

select is(
  (select window_closes_at from public.competition_rounds
    where id = current_setting('test.rws_mw1')::uuid),
  timestamptz '2030-09-09 20:00:00+00',
  'through both refusals matchweek 1 has never moved');

-- ---------------------------------------------------------------------------
-- The conflict resolves itself once the blocking round vacates the instant.
--
-- This is the ordering limitation the migration header states, asserted rather
-- than claimed: a round refused against a neighbour that moves later in the
-- same pass is deferred, not lost, and the next run applies it with nobody
-- doing anything.
-- ---------------------------------------------------------------------------

update public.season_fixtures
   set kickoff_at = timestamptz '2030-09-20 12:00:00+00'
 where competition_round_id = current_setting('test.rws_mw2')::uuid;

select is(
  predictor_internal.refresh_round_play_windows(
    current_setting('test.rws_season')::uuid,
    array[current_setting('test.rws_mw1')::uuid, current_setting('test.rws_mw2')::uuid],
    timestamptz '2030-09-02 12:00:00+00'),
  jsonb_build_object('refreshed', 1, 'unchanged', 0, 'cleared', 0,
                     'conflicted', 1, 'queued', 0),
  'in one pass matchweek 1 is still refused against the window matchweek 2 has '
  'not vacated yet — order decides the outcome, never the correctness');

select is(
  (select jsonb_build_object('opens', window_opens_at, 'closes', window_closes_at)
     from public.competition_rounds where id = current_setting('test.rws_mw2')::uuid),
  jsonb_build_object('opens', timestamptz '2030-09-20 12:00:00+00',
                     'closes', timestamptz '2030-09-20 12:00:00+00'),
  'matchweek 2 has moved on');

select is(
  predictor_internal.refresh_round_play_windows(
    current_setting('test.rws_season')::uuid,
    array[current_setting('test.rws_mw1')::uuid],
    timestamptz '2030-09-02 13:00:00+00'),
  jsonb_build_object('refreshed', 1, 'unchanged', 0, 'cleared', 0,
                     'conflicted', 0, 'queued', 0),
  'and the next run applies the proposal that was deferred, with nobody having '
  'resolved anything by hand');

select is(
  (select jsonb_build_object('opens', window_opens_at, 'closes', window_closes_at)
     from public.competition_rounds where id = current_setting('test.rws_mw1')::uuid),
  jsonb_build_object('opens', timestamptz '2030-09-07 14:00:00+00',
                     'closes', timestamptz '2030-09-15 14:00:00+00'),
  'matchweek 1 finally spans the fixture that moved');

-- ---------------------------------------------------------------------------
-- The driver. Contract 117's importer is the only thing that moves a season
-- kickoff, and it is what makes this contract reachable at all rather than
-- another authority with no caller.
-- ---------------------------------------------------------------------------

select is(
  predictor_internal.import_provider_fixture_revisions(
    'football-data', current_setting('test.rws_season')::uuid,
    jsonb_build_array(jsonb_build_object(
      'provider', 'football-data', 'providerFixtureId', 'rws-pf-3',
      'competitionProviderId', 'rws-comp', 'seasonProviderId', 'rws-season',
      'roundProviderId', 'rws-3', 'homeTeamProviderId', 'rws-a',
      'awayTeamProviderId', 'rws-b',
      'kickoffAt', '2030-09-28T15:00:00+00:00', 'status', 'SCHEDULED',
      'homeScore', null, 'awayScore', null)),
    null, timestamptz '2030-09-02 14:00:00+00') -> 'windows',
  jsonb_build_object('refreshed', 1, 'unchanged', 0, 'cleared', 0,
                     'conflicted', 0, 'queued', 0),
  'importing a moved kickoff refreshes the round it moved inside, and reports it');

select is(
  (select jsonb_build_object('opens', window_opens_at, 'closes', window_closes_at)
     from public.competition_rounds where id = current_setting('test.rws_mw3')::uuid),
  jsonb_build_object('opens', timestamptz '2030-09-28 15:00:00+00',
                     'closes', timestamptz '2030-09-28 15:00:00+00'),
  'the stale window is gone without an operator running anything');

select is(
  (select competition_round_id from public.season_fixtures
    where id = current_setting('test.rws_mw3_fixture')::uuid),
  current_setting('test.rws_mw3')::uuid,
  'and the fixture is STILL in matchweek 3 — refreshing a window is not '
  'reassignment, and the owner amendment is untouched');

-- ---------------------------------------------------------------------------
-- A round that plays over nothing has no window, and says so once.
-- ---------------------------------------------------------------------------

update public.season_fixtures
   set kickoff_at = null
 where id = current_setting('test.rws_mw3_fixture')::uuid;

select is(
  predictor_internal.refresh_round_play_windows(
    current_setting('test.rws_season')::uuid,
    array[current_setting('test.rws_mw3')::uuid],
    timestamptz '2030-09-02 15:00:00+00'),
  jsonb_build_object('refreshed', 0, 'unchanged', 0, 'cleared', 1,
                     'conflicted', 0, 'queued', 0),
  'a round with no scheduled kickoff left is cleared rather than kept on a span '
  'it no longer plays over');

select is(
  (select window_opens_at from public.competition_rounds
    where id = current_setting('test.rws_mw3')::uuid),
  null,
  'and holds no window at all, which is contract 113''s "no destination"');

select is(
  predictor_internal.refresh_round_play_windows(
    current_setting('test.rws_season')::uuid,
    array[current_setting('test.rws_mw3')::uuid],
    timestamptz '2030-09-02 16:00:00+00'),
  jsonb_build_object('refreshed', 0, 'unchanged', 1, 'cleared', 0,
                     'conflicted', 0, 'queued', 0),
  'clearing it a second time is counted as unchanged, not as another clear');

-- ---------------------------------------------------------------------------
-- The queue is evidence.
-- ---------------------------------------------------------------------------

select set_config('test.rws_conflict',
  (select id::text from predictor_internal.round_window_refresh_conflicts
    order by detected_at limit 1), true);

select throws_ok(
  format(
    'update predictor_internal.round_window_refresh_conflicts '
    'set proposed_closes_at = now() where id = %L::uuid',
    current_setting('test.rws_conflict')),
  '42501',
  'A round window refresh conflict may only be marked reviewed',
  'the proposal that was refused cannot be rewritten into a different one');

select throws_ok(
  format(
    'delete from predictor_internal.round_window_refresh_conflicts where id = %L::uuid',
    current_setting('test.rws_conflict')),
  '42501',
  'A round window refresh conflict may not be deleted',
  'nor can a conflict be made to disappear instead of being resolved');

select lives_ok(
  format(
    'update predictor_internal.round_window_refresh_conflicts '
    'set reviewed_at = now() where id = %L::uuid',
    current_setting('test.rws_conflict')),
  'but an administrator may mark it reviewed, which is what empties the queue');

-- ---------------------------------------------------------------------------
-- Nothing above this line wrote a rule.
-- ---------------------------------------------------------------------------

select is(
  (select count(*)::integer from predictor_internal.season_fixture_revisions
    where tournament_id = current_setting('test.rws_season')::uuid),
  1,
  'the only revision recorded is the one contract 117 made, and every hand '
  'reschedule above went straight to the table without inventing one');

select is(
  (select count(*)::integer from public.season_fixtures
    where tournament_id = current_setting('test.rws_season')::uuid),
  4,
  'and the refresh created and destroyed no fixture');

select * from finish();
rollback;
