-- Contract 170: the action centre learns about the matchweek card.
--
-- THE ASSERTION THIS FILE EXISTS FOR is the one contract 162 wrote its own
-- suite to catch, now for a second authority: when a matchweek's lock MOVES
-- EARLIER, the generator stops selecting the round — so the item it should
-- retire is precisely the one it can no longer see — and only the sweep can
-- close it. Contract 162's sweep re-read `bonus_competition_windows`, which a
-- matchweek does not have. Leaving it on the stored copy would ask a player for
-- a card that can no longer be submitted, for ever.
--
-- The second is that OPEN has two ends and both come from their own authority:
-- a round that has not opened is not an action, and neither is one that has
-- locked.
--
-- The third is that completion is the CARD being complete, not a prediction
-- existing. Telling a player who predicted one fixture of ten that they are
-- done is worse than asking them again.

begin;

select plan(16);

insert into public.tournaments (name, year, competition_id, season_key, kind, display_timezone, status)
select 'C170 Matchweek Actions', 2056, t.competition_id, 'mw-actions', 'league_season',
       'Europe/London', 'active'
  from public.tournaments t where t.kind = 'league_season' order by t.name limit 1;

select set_config('test.ma_season',
  (select id::text from public.tournaments where season_key = 'mw-actions'), true);

insert into public.teams (id, tournament_id, name) values
  (md5('ma-t1')::uuid, current_setting('test.ma_season')::uuid, 'MA Rovers'),
  (md5('ma-t2')::uuid, current_setting('test.ma_season')::uuid, 'MA United');

-- FOUR rounds, each in a different state, so the selection is tested by
-- contrast rather than by a single positive case:
--   3 — opened and closed, and holds NO FIXTURE
--   4 — opened, and already LOCKED
--   5 — opened, and still open        <- the only actionable one
--   6 — has NOT opened yet
--
-- The windows ascend with the ordinals and do not touch, because
-- `assert_round_play_window` refuses a round claiming time another round has
-- already claimed. An earlier draft overlapped them and the suite refused
-- itself before testing anything.
-- `competition_rounds_window_paired` requires both ends of the play window or
-- neither, so every row carries a close as well as an open.
insert into public.competition_rounds (
  id, tournament_id, round_key, ordinal, kind, label,
  window_opens_at, window_closes_at)
values
  (md5('ma-r3')::uuid, current_setting('test.ma_season')::uuid, 'ma-mw3', 3,
   'league_matchweek', 'Matchweek 3',
   now() - interval '30 days', now() - interval '22 days'),
  (md5('ma-r4')::uuid, current_setting('test.ma_season')::uuid, 'ma-mw4', 4,
   'league_matchweek', 'Matchweek 4',
   now() - interval '20 days', now() - interval '10 days'),
  (md5('ma-r5')::uuid, current_setting('test.ma_season')::uuid, 'ma-mw5', 5,
   'league_matchweek', 'Matchweek 5',
   now() - interval '3 days', now() + interval '4 days'),
  (md5('ma-r6')::uuid, current_setting('test.ma_season')::uuid, 'ma-mw6', 6,
   'league_matchweek', 'Matchweek 6',
   now() + interval '5 days', now() + interval '12 days');

-- FOUR clubs: a club plays at most once per matchweek, so the two fixtures in
-- matchweek 5 are two separate pairings rather than the same pair twice.
insert into public.teams (id, tournament_id, name) values
  (md5('ma-t3')::uuid, current_setting('test.ma_season')::uuid, 'MA City'),
  (md5('ma-t4')::uuid, current_setting('test.ma_season')::uuid, 'MA Athletic');

insert into public.season_fixtures (
  id, tournament_id, competition_round_id, home_team_id, away_team_id, kickoff_at, status)
values
  (md5('ma-f5a')::uuid, current_setting('test.ma_season')::uuid, md5('ma-r5')::uuid,
   md5('ma-t1')::uuid, md5('ma-t2')::uuid, now() + interval '2 days', 'scheduled'),
  (md5('ma-f5b')::uuid, current_setting('test.ma_season')::uuid, md5('ma-r5')::uuid,
   md5('ma-t3')::uuid, md5('ma-t4')::uuid, now() + interval '3 days', 'scheduled'),
  (md5('ma-f4a')::uuid, current_setting('test.ma_season')::uuid, md5('ma-r4')::uuid,
   md5('ma-t1')::uuid, md5('ma-t2')::uuid, now() - interval '14 days', 'scheduled'),
  (md5('ma-f6a')::uuid, current_setting('test.ma_season')::uuid, md5('ma-r6')::uuid,
   md5('ma-t1')::uuid, md5('ma-t2')::uuid, now() + interval '9 days', 'scheduled');

set local session_replication_role = replica;
insert into auth.users (id, email, aud, role, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
select md5('ma-' || who)::uuid, format('ma-%s@example.test', who),
       'authenticated', 'authenticated', '{}'::jsonb, '{}'::jsonb, now(), now()
  from unnest(array['full', 'part']) as who;
set local session_replication_role = origin;

insert into public.profiles (id, display_name, welcomed_at) values
  (md5('ma-full')::uuid, 'Completes', now()),
  (md5('ma-part')::uuid, 'Partial', now());

-- The season's Main Predictor availability row. `c1b` seeded these for the two
-- seasons that existed when it ran, so a season created here has none.
insert into public.bonus_competitions (
  tournament_id, game_key, published, availability_status,
  draw_required, visibility_kind, registration_opens_at)
values (current_setting('test.ma_season')::uuid, 'main_predictor', true, 'active',
        false, 'public', now() - interval '60 days');

-- Entries inserted directly, because `prepare_entry_game_membership` is a BEFORE
-- trigger that resolves `game_competition_id` and creates the membership itself.
-- Setting either by hand here would be this file asserting against its own guess
-- rather than against the platform's join path — the correction suite 210 needed.
insert into public.entries (id, user_id, tournament_id) values
  (md5('ma-e-full')::uuid, md5('ma-full')::uuid, current_setting('test.ma_season')::uuid),
  (md5('ma-e-part')::uuid, md5('ma-part')::uuid, current_setting('test.ma_season')::uuid);

select set_config('test.ma_full_entry', md5('ma-e-full')::uuid::text, true);
select set_config('test.ma_part_entry', md5('ma-e-part')::uuid::text, true);

select is(
  (select entry.game_competition_id is not null from public.entries entry
    where entry.id = md5('ma-e-full')::uuid),
  true,
  'the entry trigger resolved the season''s Main Predictor, so the generator has a game to join through');

-- One player completes the card; the other predicts one fixture of two.
insert into public.season_predictions (tournament_id, entry_id, season_fixture_id, home_score, away_score)
values (current_setting('test.ma_season')::uuid, current_setting('test.ma_full_entry')::uuid,
        md5('ma-f5a')::uuid, 2, 1),
       (current_setting('test.ma_season')::uuid, current_setting('test.ma_full_entry')::uuid,
        md5('ma-f5b')::uuid, 1, 1),
       (current_setting('test.ma_season')::uuid, current_setting('test.ma_part_entry')::uuid,
        md5('ma-f5a')::uuid, 3, 0);

-- ---------------------------------------------------------------------------
-- SELECTION: one round of four, and the other three each excluded for their
-- own reason.
-- ---------------------------------------------------------------------------

select is(
  (public.process_player_action_items() ->> 'matchweek_prediction_actions_written')::integer,
  2,
  'the driver writes one item per entry for the one round that is open');

select is(
  (select count(distinct item.context ->> 'round_id')::integer
     from public.player_action_items item
    where item.tournament_id = current_setting('test.ma_season')::uuid
      and item.action_type = 'matchweek_predictions_due'),
  1,
  'and for exactly one round, not four');

select is(
  (select item.context ->> 'ordinal'
     from public.player_action_items item
    where item.tournament_id = current_setting('test.ma_season')::uuid
      and item.action_type = 'matchweek_predictions_due'
    limit 1),
  '5',
  'the open one — matchweek 4 has locked, 6 has not opened and 3 holds no fixture');

select is(
  (public.process_player_action_items() ->> 'matchweek_prediction_actions_written')::integer,
  0,
  'a second run writes nothing, because the key is derived from the round and not the run');

select is(
  (select count(*)::integer from public.player_action_items item
    where item.tournament_id = current_setting('test.ma_season')::uuid),
  2,
  'and two runs leave two rows rather than four');

-- ---------------------------------------------------------------------------
-- COMPLETION IS THE CARD, NOT A PREDICTION
-- ---------------------------------------------------------------------------

select is(
  (select item.completed_at is not null
     from public.player_action_items item
    where item.user_id = md5('ma-full')::uuid
      and item.tournament_id = current_setting('test.ma_season')::uuid),
  true,
  'the player who predicted both fixtures has a COMPLETED item');

select is(
  (select item.completed_at is null
     from public.player_action_items item
    where item.user_id = md5('ma-part')::uuid
      and item.tournament_id = current_setting('test.ma_season')::uuid),
  true,
  'and the player who predicted ONE of two does not — a card is not done because it is started');

select is(
  (select item.context ->> 'predicted' || ' of ' || (item.context ->> 'fixtures')
     from public.player_action_items item
    where item.user_id = md5('ma-part')::uuid
      and item.tournament_id = current_setting('test.ma_season')::uuid),
  '1 of 2',
  'the item carries both counts, so a surface can say how far through the card they are');

select is(
  (select item.deadline_at
     from public.player_action_items item
    where item.user_id = md5('ma-part')::uuid
      and item.tournament_id = current_setting('test.ma_season')::uuid),
  predictor_internal.season_matchweek_lock_at(
    current_setting('test.ma_season')::uuid, md5('ma-r5')::uuid,
    (select definition.buffer_minutes from public.game_definitions definition
      where definition.game_key = 'main_predictor')),
  'and its deadline is the matchweek lock, from the authority that derives it');

select is(
  (select item.priority::integer
     from public.player_action_items item
    where item.user_id = md5('ma-part')::uuid
      and item.tournament_id = current_setting('test.ma_season')::uuid),
  2,
  'ranked below a Last Man Standing pick, because a missed matchweek costs points and does not eliminate');

-- ---------------------------------------------------------------------------
-- THE READ SEES IT
-- ---------------------------------------------------------------------------

select set_config('request.jwt.claims',
  json_build_object('sub', md5('ma-part')::uuid, 'role', 'authenticated',
                    'app_metadata', json_build_object())::text, true);
set local role authenticated;

select is(
  (select action ->> 'action_type'
     from jsonb_array_elements(public.get_my_actions(20, false) -> 'actions') action
    limit 1),
  'matchweek_predictions_due',
  'and the player''s own inbox contains it');

reset role;
select set_config('request.jwt.claims',
  json_build_object('sub', md5('ma-full')::uuid, 'role', 'authenticated',
                    'app_metadata', json_build_object())::text, true);
set local role authenticated;

select is(
  jsonb_array_length(public.get_my_actions(20, false) -> 'actions'),
  0,
  'while the player who finished their card is asked for nothing');

reset role;

-- ---------------------------------------------------------------------------
-- THE ASSERTION THIS FILE EXISTS FOR: a lock that MOVES EARLIER.
--
-- Contracts 117 and 119 reschedule a fixture and drag the matchweek's lock with
-- it. The generator then no longer selects the round, so nothing it does can
-- retire the item — and `expires_at` is a stale copy of the old instant. Only a
-- sweep that RE-DERIVES the lock closes it.
-- ---------------------------------------------------------------------------

update public.season_fixtures
   set kickoff_at = now() - interval '1 hour'
 where competition_round_id = md5('ma-r5')::uuid;

select is(
  (public.process_player_action_items() ->> 'matchweek_prediction_actions_written')::integer,
  0,
  'once the round has locked the generator cannot see it — which is why the sweep must');

select is(
  (select item.invalidated_at is not null
     from public.player_action_items item
    where item.user_id = md5('ma-part')::uuid
      and item.tournament_id = current_setting('test.ma_season')::uuid),
  true,
  'THE SWEEP CLOSES IT, by re-deriving the lock rather than trusting the copy it stored');

-- ---------------------------------------------------------------------------
-- A kickoff withdrawn entirely stops the lock being derivable at all. That is
-- contract 123's queue-for-an-owner case, and an action with no derivable
-- deadline must not sit open asking for a card against it.
-- ---------------------------------------------------------------------------

delete from public.player_action_items
 where tournament_id = current_setting('test.ma_season')::uuid;

update public.season_fixtures
   set kickoff_at = now() + interval '2 days'
 where competition_round_id = md5('ma-r5')::uuid;

select public.process_player_action_items();

update public.season_fixtures set kickoff_at = null where id = md5('ma-f5b')::uuid;

select is(
  (public.process_player_action_items() ->> 'actions_invalidated')::integer,
  1,
  'a withdrawn kickoff makes the lock underivable, and the open item closes rather than waiting for one');

select * from finish();

rollback;
