-- Contract 146: adaptive provider poll cadence and rolling date windows.
--
-- The two properties worth proving are the ones that cost money when wrong:
-- a target with no match near it must poll at the idle cadence, and the day
-- range it asks about must move on its own. Everything else here guards the
-- edges that would silently turn the cheap path back into the expensive one.

begin;

select plan(16);

select set_config('test.appc_tournament',
  (select t.id::text from public.tournaments t where t.name = 'Scottish Premiership 2026/27'), true);

insert into public.teams (tournament_id, name) values
  (current_setting('test.appc_tournament')::uuid, 'Cadence Rovers'),
  (current_setting('test.appc_tournament')::uuid, 'Cadence Athletic');

select set_config('test.appc_home',
  (select id::text from public.teams where name = 'Cadence Rovers'), true);
select set_config('test.appc_away',
  (select id::text from public.teams where name = 'Cadence Athletic'), true);

-- ---------------------------------------------------------------------------
-- Date placeholders.
-- ---------------------------------------------------------------------------

select is(
  predictor_internal.resolve_provider_poll_path(
    '/fixtures/between/{{date:+0}}/{{date:+8}}', timestamptz '2026-08-10T12:00:00Z', 'Europe/London'),
  '/fixtures/between/2026-08-10/2026-08-18',
  'a forward window resolves to a real date range'
);

select is(
  predictor_internal.resolve_provider_poll_path(
    '/x/{{date:+0}}', timestamptz '2026-08-10T23:30:00Z', 'Europe/London'),
  '/x/2026-08-11',
  'resolution uses the competition timezone, not UTC'
);

select is(
  predictor_internal.resolve_provider_poll_path(
    '/x/{{date:+0}}', timestamptz '2026-08-10T23:30:00Z', 'UTC'),
  '/x/2026-08-10',
  'and the same instant in UTC is the previous day, which is why it is threaded through'
);

select is(
  predictor_internal.resolve_provider_poll_path(
    '/x/{{date:-2}}', timestamptz '2026-08-10T12:00:00Z', 'UTC'),
  '/x/2026-08-08',
  'a negative offset looks back'
);

select is(
  predictor_internal.resolve_provider_poll_path(
    '/competitions/PL/matches', timestamptz '2026-08-10T12:00:00Z', 'UTC'),
  '/competitions/PL/matches',
  'a path with no placeholder is returned untouched, so existing targets are unaffected'
);

select is(
  predictor_internal.resolve_provider_poll_path(
    '/x/{{date}}', timestamptz '2026-08-10T12:00:00Z', 'UTC'),
  '/x/2026-08-10',
  'the bare placeholder means today'
);

-- An unknown timezone must not take the poll down.
select is(
  predictor_internal.resolve_provider_poll_path(
    '/x/{{date}}', timestamptz '2026-08-10T12:00:00Z', 'Not/AZone'),
  '/x/2026-08-10',
  'an unusable timezone falls back to UTC rather than raising'
);

-- ---------------------------------------------------------------------------
-- Write-time refusals.
-- ---------------------------------------------------------------------------

select throws_ok(
  format($$insert into public.provider_poll_targets (tournament_id, provider, path, cadence_minutes)
           values (%L, 'sportmonks', '/fixtures/{{season}}', 1440)$$,
         current_setting('test.appc_tournament')),
  '23514',
  null,
  'an unrecognised placeholder is refused rather than sent to the provider verbatim'
);

select throws_ok(
  format($$insert into public.provider_poll_targets
             (tournament_id, provider, path, cadence_minutes, live_cadence_minutes)
           values (%L, 'sportmonks', '/x', 60, 120)$$,
         current_setting('test.appc_tournament')),
  '23514',
  null,
  'a live cadence slower than the idle cadence is a typo and is refused'
);

-- ---------------------------------------------------------------------------
-- The cadence that actually gets used.
-- ---------------------------------------------------------------------------

insert into public.provider_poll_targets (
  tournament_id, provider, path, cadence_minutes, live_cadence_minutes,
  live_lead_minutes, live_tail_minutes, enabled, last_dispatched_at
) values (
  current_setting('test.appc_tournament')::uuid,
  'sportmonks',
  '/fixtures/between/{{date:+0}}/{{date:+8}}',
  1440, 10, 15, 120, true,
  timestamptz '2026-08-10T12:00:00Z'
);

select set_config('test.appc_target',
  (select id::text from public.provider_poll_targets
    where path = '/fixtures/between/{{date:+0}}/{{date:+8}}'), true);

-- No fixture anywhere near: the idle cadence governs, so an hour later it is
-- not due. This is the case that was costing 288 requests a day.
select is(
  (select count(*) from predictor_internal.due_provider_poll_targets(
     timestamptz '2026-08-10T13:00:00Z')
    where target_id = current_setting('test.appc_target')::uuid),
  0::bigint,
  'with no match near, an hour is not enough to be due again'
);

select is(
  (select count(*) from predictor_internal.due_provider_poll_targets(
     timestamptz '2026-08-11T12:30:00Z')
    where target_id = current_setting('test.appc_target')::uuid),
  1::bigint,
  'and a day later it is'
);

-- Now put a fixture in the live window.
insert into public.season_fixtures (
  tournament_id, home_team_id, away_team_id, kickoff_at, status
) values (
  current_setting('test.appc_tournament')::uuid,
  current_setting('test.appc_home')::uuid,
  current_setting('test.appc_away')::uuid,
  timestamptz '2026-08-10T13:00:00Z',
  'scheduled'
);

select ok(
  predictor_internal.provider_target_is_live(
    current_setting('test.appc_tournament')::uuid,
    timestamptz '2026-08-10T12:50:00Z', 15, 120),
  'the window is open ten minutes before kickoff'
);

select ok(
  not predictor_internal.provider_target_is_live(
    current_setting('test.appc_tournament')::uuid,
    timestamptz '2026-08-10T12:40:00Z', 15, 120),
  'and shut twenty minutes before it, which is outside the lead'
);

select is(
  (select count(*) from predictor_internal.due_provider_poll_targets(
     timestamptz '2026-08-10T12:50:00Z')
    where target_id = current_setting('test.appc_target')::uuid),
  1::bigint,
  'inside the live window the ten-minute cadence makes it due'
);

-- The self-limiting half: once the result exists, the fixture stops holding the
-- window open even though the tail has not elapsed.
update public.season_fixtures
   set home_score = 2, away_score = 1
 where tournament_id = current_setting('test.appc_tournament')::uuid
   and kickoff_at = timestamptz '2026-08-10T13:00:00Z';

select ok(
  not predictor_internal.provider_target_is_live(
    current_setting('test.appc_tournament')::uuid,
    timestamptz '2026-08-10T14:00:00Z', 15, 120),
  'a settled fixture stops costing requests before its tail runs out'
);

-- And the path the dispatcher would actually send is the resolved one.
select is(
  (select path from predictor_internal.due_provider_poll_targets(
     timestamptz '2026-08-11T12:30:00Z')
    where target_id = current_setting('test.appc_target')::uuid),
  '/fixtures/between/2026-08-11/2026-08-19',
  'the dispatcher receives a resolved path, never the template'
);

select * from finish();

rollback;
