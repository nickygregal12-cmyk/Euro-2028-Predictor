-- Contract 119: a rescheduled fixture locks at its own kickoff.
--
-- Numbered 170 rather than 169 deliberately. Two files already share 168 after
-- a concurrent session took the same number, and a gap costs nothing while a
-- collision costs a rename and a conflict resolution across a dozen live
-- authority documents.
--
-- The assertion this file exists for is the NEGATIVE one: a fixture nobody
-- moved must still answer with its matchweek instant. "Each fixture locks at
-- its own kickoff" and "the matchweek locks together except for fixtures that
-- moved" produce identical arithmetic on every fixture that moved, so a test
-- that only checks moved fixtures cannot tell the owner's rule from the one the
-- owner rejected.

begin;

select plan(18);

select set_config('test.rfl_season',
  (select id::text from public.tournaments where kind = 'league_season' order by name limit 1), true);

insert into public.teams (tournament_id, name) values
  (current_setting('test.rfl_season')::uuid, 'Lock Rovers'),
  (current_setting('test.rfl_season')::uuid, 'Lock United'),
  (current_setting('test.rfl_season')::uuid, 'Lock Athletic'),
  (current_setting('test.rfl_season')::uuid, 'Lock Wanderers');

insert into public.competition_rounds (tournament_id, round_key, ordinal, kind, label)
values (current_setting('test.rfl_season')::uuid, 'rfl-mw1', 981, 'league_matchweek', 'Lock Matchweek 1');

select set_config('test.rfl_round', (select id::text from public.competition_rounds
  where tournament_id = current_setting('test.rfl_season')::uuid and round_key = 'rfl-mw1'), true);

-- One fixture played yesterday: the matchweek's earliest kickoff, so the whole
-- round is locked under the existing rule. One fixture thirty days out, which
-- is the one that will be marked as having moved.
insert into public.season_fixtures
  (tournament_id, competition_round_id, home_team_id, away_team_id, kickoff_at, status)
select current_setting('test.rfl_season')::uuid, current_setting('test.rfl_round')::uuid,
       h.id, a.id, k, 'scheduled'
from (values ('Lock Rovers', 'Lock United', now() - interval '1 day'),
             ('Lock Athletic', 'Lock Wanderers', now() + interval '30 days')) as s(hn, an, k)
join public.teams h on h.tournament_id = current_setting('test.rfl_season')::uuid and h.name = s.hn
join public.teams a on a.tournament_id = current_setting('test.rfl_season')::uuid and a.name = s.an;

select set_config('test.rfl_past', (select f.id::text from public.season_fixtures f
  join public.teams h on h.id = f.home_team_id
  where f.competition_round_id = current_setting('test.rfl_round')::uuid and h.name = 'Lock Rovers'), true);
select set_config('test.rfl_moved', (select f.id::text from public.season_fixtures f
  join public.teams h on h.id = f.home_team_id
  where f.competition_round_id = current_setting('test.rfl_round')::uuid and h.name = 'Lock Athletic'), true);

select set_config('test.rfl_buffer',
  (select buffer_minutes::text from public.game_definitions where game_key = 'main_predictor'), true);

-- ---------------------------------------------------------------------------
-- Reachability
-- ---------------------------------------------------------------------------

select is(
  (select count(*)::integer from information_schema.routine_privileges
    where routine_name = 'season_prediction_lock_at'
      and grantee in ('anon', 'authenticated', 'service_role')),
  0,
  'no browser or service role may call the prediction lock authority directly'
);

select is(
  (select proc.prosecdef and proc.proconfig @> array['search_path=""']
     from pg_proc proc join pg_namespace ns on ns.oid = proc.pronamespace
    where ns.nspname = 'predictor_internal' and proc.proname = 'season_prediction_lock_at'),
  true,
  'and it is security definer with a pinned search path'
);

-- ---------------------------------------------------------------------------
-- The rule, and the reading it is NOT
-- ---------------------------------------------------------------------------

select is(
  predictor_internal.season_prediction_lock_at(
    current_setting('test.rfl_moved')::uuid, current_setting('test.rfl_buffer')::integer),
  predictor_internal.season_matchweek_lock_at(
    current_setting('test.rfl_season')::uuid, current_setting('test.rfl_round')::uuid,
    current_setting('test.rfl_buffer')::integer),
  'a fixture NOBODY MOVED answers with its matchweek instant, not its own kickoff — this is the assertion that separates the owner''s rule from the universal per-fixture reading, which is arithmetically identical on every fixture that did move'
);

insert into predictor_internal.season_fixture_revisions
  (tournament_id, season_fixture_id, provider, previous_kickoff_at, new_kickoff_at)
values (current_setting('test.rfl_season')::uuid, current_setting('test.rfl_moved')::uuid,
        'football-data', now() - interval '2 days', now() + interval '30 days');

-- Asserted with an EXPLICIT 45-minute buffer rather than the configured one.
-- `main_predictor` is configured at buffer 0, so `kickoff - buffer` and
-- `kickoff` are the same instant and a version that forgot to subtract the
-- buffer at all passed this suite unnoticed. A constant that cannot be zero is
-- what makes the subtraction observable.
select is(
  predictor_internal.season_prediction_lock_at(current_setting('test.rfl_moved')::uuid, 45),
  (select kickoff_at from public.season_fixtures where id = current_setting('test.rfl_moved')::uuid)
    - interval '45 minutes',
  'once a revision is recorded, that fixture answers with its OWN kickoff minus the buffer — and the buffer is genuinely subtracted'
);

select is(
  predictor_internal.season_prediction_lock_at(
    current_setting('test.rfl_moved')::uuid, current_setting('test.rfl_buffer')::integer),
  (select kickoff_at from public.season_fixtures where id = current_setting('test.rfl_moved')::uuid)
    - make_interval(mins => current_setting('test.rfl_buffer')::integer),
  'and it answers the same way for the buffer this game is actually configured with'
);

select is(
  predictor_internal.season_prediction_lock_at(
    current_setting('test.rfl_past')::uuid, current_setting('test.rfl_buffer')::integer),
  predictor_internal.season_matchweek_lock_at(
    current_setting('test.rfl_season')::uuid, current_setting('test.rfl_round')::uuid,
    current_setting('test.rfl_buffer')::integer),
  'and its neighbour in the same matchweek is unaffected — one fixture moving does not release the round'
);

-- The safety property. Strictly permissive, in the sense contract 79's CHECK
-- widening was: no prediction that was legal before becomes illegal after.
select is(
  (select count(*)::integer from public.season_fixtures fixture
    where fixture.competition_round_id = current_setting('test.rfl_round')::uuid
      and predictor_internal.season_prediction_lock_at(
            fixture.id, current_setting('test.rfl_buffer')::integer)
          < predictor_internal.season_matchweek_lock_at(
            current_setting('test.rfl_season')::uuid, current_setting('test.rfl_round')::uuid,
            current_setting('test.rfl_buffer')::integer)),
  0,
  'no fixture in the round locks EARLIER than it did before, because a fixture''s own kickoff is never earlier than its round''s minimum — the rule can only extend a window, never shorten one'
);

-- ---------------------------------------------------------------------------
-- Absence fails closed
-- ---------------------------------------------------------------------------

update public.season_fixtures set kickoff_at = null
 where id = current_setting('test.rfl_moved')::uuid;

select is(
  predictor_internal.season_prediction_lock_at(
    current_setting('test.rfl_moved')::uuid, current_setting('test.rfl_buffer')::integer),
  null,
  'a moved fixture whose kickoff was cleared falls back to the matchweek rule rather than to "no lock" — absence of a kickoff is the one state that must fail closed'
);

update public.season_fixtures set kickoff_at = now() + interval '30 days'
 where id = current_setting('test.rfl_moved')::uuid;

select is(
  predictor_internal.season_prediction_lock_at(
    md5('rfl-nowhere')::uuid, current_setting('test.rfl_buffer')::integer),
  null,
  'an unknown fixture resolves to nothing rather than raising'
);

select is(
  predictor_internal.season_prediction_lock_at(current_setting('test.rfl_moved')::uuid, null),
  null,
  'a null buffer resolves to nothing, matching contract 83''s convention'
);

select is(
  predictor_internal.season_prediction_lock_at(current_setting('test.rfl_moved')::uuid, -1),
  null,
  'and so does a negative one'
);

-- ---------------------------------------------------------------------------
-- The trigger enforces it
-- ---------------------------------------------------------------------------

-- Creates its own player rather than borrowing a seeded one. A test that
-- depends on seed data is testing the seed, and this file has to pass in CI
-- where the database is built from migrations alone.
set local session_replication_role = replica;
insert into auth.users (id, email, aud, role, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
values (md5('rfl-player')::uuid, 'rfl-player@example.test', 'authenticated', 'authenticated',
        '{}'::jsonb, '{}'::jsonb, now(), now());
set local session_replication_role = origin;

insert into public.entries (tournament_id, user_id)
values (current_setting('test.rfl_season')::uuid, md5('rfl-player')::uuid);

select set_config('test.rfl_entry', (select id::text from public.entries
  where tournament_id = current_setting('test.rfl_season')::uuid
    and user_id = md5('rfl-player')::uuid), true);

select throws_ok(
  format($$insert into public.season_predictions
             (tournament_id, entry_id, season_fixture_id, home_score, away_score)
           values (%L::uuid, %L::uuid, %L::uuid, 1, 0)$$,
         current_setting('test.rfl_season'), current_setting('test.rfl_entry'),
         current_setting('test.rfl_past')),
  '55000', null,
  'a prediction on the fixture that was not moved is still refused, because its matchweek locked yesterday'
);

select lives_ok(
  format($$insert into public.season_predictions
             (tournament_id, entry_id, season_fixture_id, home_score, away_score)
           values (%L::uuid, %L::uuid, %L::uuid, 2, 1)$$,
         current_setting('test.rfl_season'), current_setting('test.rfl_entry'),
         current_setting('test.rfl_moved')),
  'but a prediction on the MOVED fixture is accepted, in the same locked matchweek — which is the whole amendment'
);

select lives_ok(
  format($$update public.season_predictions set home_score = 3
             where season_fixture_id = %L::uuid$$, current_setting('test.rfl_moved')),
  'and it stays editable, rather than being a one-shot write the lock then closes'
);

-- The delete path needs a prediction that already exists on a locked fixture,
-- which the trigger will not let us create the ordinary way. Inserted with the
-- trigger disabled so the assertion is about DELETE rather than about insert.
set local session_replication_role = replica;
insert into public.season_predictions
  (tournament_id, entry_id, season_fixture_id, home_score, away_score)
values (current_setting('test.rfl_season')::uuid, current_setting('test.rfl_entry')::uuid,
        current_setting('test.rfl_past')::uuid, 0, 0);
set local session_replication_role = origin;

select throws_ok(
  format($$delete from public.season_predictions where season_fixture_id = %L::uuid$$,
         current_setting('test.rfl_past')),
  '55000', null,
  'the delete path follows the same rule rather than a looser one — contract 114 brought delete under the lock, and per-fixture must not quietly reopen it'
);

select lives_ok(
  format($$delete from public.season_predictions where season_fixture_id = %L::uuid$$,
         current_setting('test.rfl_moved')),
  'while the moved fixture''s prediction can still be deleted, because its own kickoff has not passed'
);

-- The Joker is a matchweek-level choice, and the amendment says nothing about
-- it, so it stays on the matchweek rule.
--
-- Asserted structurally rather than behaviourally on purpose. The behavioural
-- version needs a season with enough matchweeks for a Joker allowance to be
-- defined, and how many matchweeks a season has differs between a migrations-only
-- CI build and a seeded developer database — which is the environment dependence
-- that made contract 112's suite pass locally and fail in CI. This says the same
-- thing without depending on the season's shape.
select is(
  (select pg_get_functiondef('predictor_internal.enforce_season_matchweek_lock()'::regprocedure)
     like '%min(fixture.kickoff_at)%'),
  true,
  'the trigger still derives the matchweek instant for the Joker branch, so one fixture moving does not reopen a matchweek-level choice'
);

select is(
  (select pg_get_functiondef('predictor_internal.enforce_season_matchweek_lock()'::regprocedure)
     like '%live_competition_id%'),
  true,
  'and contract 104''s live-instance resolution survives the redefinition, which is the pin that caught contract 114''s first draft'
);

select finish();

rollback;
