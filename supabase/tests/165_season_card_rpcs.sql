-- Contract 114: the season matchweek card reaches the browser.
--
-- Four functions, and the property that matters is what they DON'T add: no
-- table grant appears, no rule is restated, and every refusal below comes out
-- of a trigger that contract 69, 47 or 81 already owns. The assertions
-- therefore spend most of their effort on the refusal paths — a bounded RPC
-- layer that only worked on the happy path would be a privilege escalation
-- with good manners.
--
-- The delete path is the one this contract had to build rather than route to:
-- contract 69's lock trigger fired on insert and update only, which was
-- complete while nothing could delete. Clearing a prediction or taking back a
-- Joker after lock rewrites a frozen competitive state, so both now refuse,
-- and the locked-delete probes below seed their rows with triggers disabled to
-- prove it is the DELETE that refuses, not the setup.

begin;

select plan(27);

-- ---------------------------------------------------------------------------
-- Grants: exactly the four functions, exactly to authenticated.
-- ---------------------------------------------------------------------------

select is(
  has_function_privilege('authenticated', 'public.get_season_matchweek_card(uuid,integer)', 'execute'),
  true, 'authenticated may read the matchweek card');
select is(
  has_function_privilege('authenticated', 'public.save_season_prediction(uuid,uuid,smallint,smallint,integer)', 'execute'),
  true, 'authenticated may save a prediction');
select is(
  has_function_privilege('authenticated', 'public.set_season_matchweek_joker(uuid,integer,boolean)', 'execute'),
  true, 'authenticated may set the matchweek Joker');
select is(
  has_function_privilege('authenticated', 'public.confirm_season_matchweek_card(uuid,integer)', 'execute'),
  true, 'authenticated may confirm the card');
select is(
  has_function_privilege('anon', 'public.get_season_matchweek_card(uuid,integer)', 'execute'),
  false, 'anonymous may not read the card');
select is(
  has_function_privilege('anon', 'public.save_season_prediction(uuid,uuid,smallint,smallint,integer)', 'execute'),
  false, 'anonymous may not write');

select is(
  (select count(*)::integer from information_schema.role_table_grants
    where table_name in ('season_predictions', 'season_matchweek_jokers', 'season_matchweek_cards', 'season_fixtures')
      and grantee in ('anon', 'authenticated')),
  0,
  'the RPC layer added no direct table grant');

-- ---------------------------------------------------------------------------
-- Setup: the seeded league season, two matchweeks (one open, one locked),
-- one player with an entry and one without.
-- ---------------------------------------------------------------------------

create temporary table card_probe as
select (select id from public.tournaments where kind = 'league_season' order by name limit 1) as season_id;

insert into public.competition_rounds (tournament_id, round_key, ordinal, kind, label)
select season_id, 'C113-MW' || n, n, 'league_matchweek', 'Card probe MW' || n
from card_probe, generate_series(1, 2) n;

select set_config('test.c113_open_round',
  (select r.id::text from public.competition_rounds r join card_probe p on p.season_id = r.tournament_id
    where r.round_key = 'C113-MW1'), true);
select set_config('test.c113_locked_round',
  (select r.id::text from public.competition_rounds r join card_probe p on p.season_id = r.tournament_id
    where r.round_key = 'C113-MW2'), true);

-- Two clubs, one open fixture (kickoff far in the future) and one locked
-- fixture (kicked off an hour ago).
insert into public.teams (tournament_id, name)
select season_id, name from card_probe, (values ('C113 Home'), ('C113 Away')) clubs(name);

insert into public.season_fixtures (tournament_id, competition_round_id, home_team_id, away_team_id, kickoff_at)
select p.season_id, current_setting('test.c113_open_round')::uuid,
       home.id, away.id, now() + interval '3 days'
  from card_probe p,
       (select id from public.teams where name = 'C113 Home') home,
       (select id from public.teams where name = 'C113 Away') away;

insert into public.season_fixtures (tournament_id, competition_round_id, home_team_id, away_team_id, kickoff_at)
select p.season_id, current_setting('test.c113_locked_round')::uuid,
       away.id, home.id, now() - interval '1 hour'
  from card_probe p,
       (select id from public.teams where name = 'C113 Home') home,
       (select id from public.teams where name = 'C113 Away') away;

select set_config('test.c113_open_fixture',
  (select f.id::text from public.season_fixtures f
    where f.competition_round_id = current_setting('test.c113_open_round')::uuid), true);
select set_config('test.c113_locked_fixture',
  (select f.id::text from public.season_fixtures f
    where f.competition_round_id = current_setting('test.c113_locked_round')::uuid), true);

set local session_replication_role = replica;
insert into auth.users (id, email, aud, role, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
values
  (md5('c113-player')::uuid, 'c113-player@example.test', 'authenticated', 'authenticated', '{}'::jsonb, '{}'::jsonb, now(), now()),
  (md5('c113-spectator')::uuid, 'c113-spectator@example.test', 'authenticated', 'authenticated', '{}'::jsonb, '{}'::jsonb, now(), now());
set local session_replication_role = origin;

insert into public.entries (tournament_id, user_id)
select season_id, md5('c113-player')::uuid from card_probe;

-- ---------------------------------------------------------------------------
-- Authentication is the outermost gate.
-- ---------------------------------------------------------------------------

select set_config('request.jwt.claim.sub', '', true);
select throws_ok(
  $$select public.get_season_matchweek_card((select season_id from card_probe), 1)$$,
  '42501', null, 'an unauthenticated read refuses');

-- ---------------------------------------------------------------------------
-- The player's journey on the open matchweek.
-- ---------------------------------------------------------------------------

select set_config('request.jwt.claim.sub', md5('c113-player')::uuid::text, true);
select set_config('request.jwt.claim.role', 'authenticated', true);

select is(
  (select card->>'card_status' from public.get_season_matchweek_card((select season_id from card_probe), 1) card),
  'no_submission',
  'an untouched matchweek reads as no_submission — absence IS the state');

select is(
  (select jsonb_array_length(card->'fixtures') from public.get_season_matchweek_card((select season_id from card_probe), 1) card),
  1,
  'the card carries the matchweek''s fixtures');

select is(
  (select public.save_season_prediction(
     (select season_id from card_probe),
     current_setting('test.c113_open_fixture')::uuid,
     2::smallint, 1::smallint, 0)->>'version'),
  '0',
  'a first save stores at version 0');

select is(
  (select card->'fixtures'->0->'prediction'->>'home'
     from public.get_season_matchweek_card((select season_id from card_probe), 1) card),
  '2',
  'the read returns the caller''s own saved prediction');

select is(
  (select card->>'card_status' from public.get_season_matchweek_card((select season_id from card_probe), 1) card),
  'provisional',
  'first engagement makes the card provisional, exactly as the browser assumes optimistically');

select throws_ok(
  format($$select public.save_season_prediction('%s', '%s', 3::smallint, 3::smallint, 7)$$,
    (select season_id from card_probe), current_setting('test.c113_open_fixture')),
  'PT409', null,
  'a stale version echo refuses as a conflict, not a lock or a validation error');

select is(
  (select public.save_season_prediction(
     (select season_id from card_probe),
     current_setting('test.c113_open_fixture')::uuid,
     3::smallint, 3::smallint, 0)->>'version'),
  '1',
  'the correct echo saves and the server increments the version');

select lives_ok(
  format($$select public.save_season_prediction('%s', '%s', null, null, null)$$,
    (select season_id from card_probe), current_setting('test.c113_open_fixture')),
  'both scores null clears the prediction before lock');

select is(
  (select count(*)::integer from public.season_predictions
    where entry_id in (select id from public.entries where user_id = md5('c113-player')::uuid)),
  0,
  'the cleared prediction is gone — a blank is a blank, not a zero');

select is(
  (select public.set_season_matchweek_joker((select season_id from card_probe), 1, true)->>'played'),
  'true',
  'the Joker plays on an open matchweek');

select is(
  (select card->'joker'->>'used_first_half' from public.get_season_matchweek_card((select season_id from card_probe), 1) card),
  '1',
  'the read reports Joker usage by half, so the browser never recomputes the boundary');

select lives_ok(
  format($$select public.set_season_matchweek_joker('%s', 1, false)$$, (select season_id from card_probe)),
  'the Joker can be taken back before lock');

select is(
  (select public.confirm_season_matchweek_card((select season_id from card_probe), 1)->>'card_status'),
  'confirmed',
  'the card confirms before lock');

-- ---------------------------------------------------------------------------
-- The locked matchweek refuses every write, including the deletes.
-- ---------------------------------------------------------------------------

select throws_ok(
  format($$select public.save_season_prediction('%s', '%s', 1::smallint, 0::smallint, 0)$$,
    (select season_id from card_probe), current_setting('test.c113_locked_fixture')),
  '55000', null, 'a save after kickoff refuses as locked');

-- Seed a pre-lock prediction and Joker with triggers silenced, so the probes
-- below prove the DELETE refuses rather than the setup failing.
set local session_replication_role = replica;
insert into public.season_predictions (tournament_id, entry_id, season_fixture_id, home_score, away_score)
select p.season_id, e.id, current_setting('test.c113_locked_fixture')::uuid, 1, 1
  from card_probe p join public.entries e on e.tournament_id = p.season_id
 where e.user_id = md5('c113-player')::uuid;
insert into public.season_matchweek_jokers (tournament_id, entry_id, competition_round_id)
select p.season_id, e.id, current_setting('test.c113_locked_round')::uuid
  from card_probe p join public.entries e on e.tournament_id = p.season_id
 where e.user_id = md5('c113-player')::uuid;
set local session_replication_role = origin;

select throws_ok(
  format($$select public.save_season_prediction('%s', '%s', null, null, null)$$,
    (select season_id from card_probe), current_setting('test.c113_locked_fixture')),
  '55000', null,
  'clearing a banked prediction after lock refuses — the delete path is guarded too');

select throws_ok(
  format($$select public.set_season_matchweek_joker('%s', 2, false)$$, (select season_id from card_probe)),
  '55000', null,
  'taking a Joker back after lock refuses — it would halve a frozen matchweek');

select throws_ok(
  format($$select public.confirm_season_matchweek_card('%s', 2)$$, (select season_id from card_probe)),
  '55000', null,
  'confirming after lock refuses — intent about a frozen card is backdating');

-- ---------------------------------------------------------------------------
-- A player without an entry can look, and cannot touch.
-- ---------------------------------------------------------------------------

select set_config('request.jwt.claim.sub', md5('c113-spectator')::uuid::text, true);

select is(
  (select card->>'card_status' from public.get_season_matchweek_card((select season_id from card_probe), 1) card),
  'no_submission',
  'a player with no entry sees an empty card rather than an error');

select throws_ok(
  format($$select public.save_season_prediction('%s', '%s', 1::smallint, 1::smallint, 0)$$,
    (select season_id from card_probe), current_setting('test.c113_open_fixture')),
  '42501', null, 'a write without an entry refuses');

select * from finish();

rollback;
