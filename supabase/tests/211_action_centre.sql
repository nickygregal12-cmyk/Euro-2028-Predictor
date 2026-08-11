-- Contract 162: the action centre, and the read state nothing kept.
--
-- THE ASSERTIONS THIS FILE EXISTS FOR are the two the register's own audit
-- names as the reason the AppBar carries no notification control:
--
--   * a regenerated inbox must not come back UNREAD. That is the "shouts for
--     ever" failure, and it is what a single-table design produces, because an
--     upsert that corrects a moved deadline also rewrites the read state;
--   * an item whose deadline has passed must CLOSE. No generator can close one,
--     because a generator only selects rounds that are still open — so the item
--     it should retire is precisely the one it can no longer see.
--
-- The third is that regeneration is idempotent: the key is derived from what
-- the action is, so a job run twice writes the same row rather than a second.

begin;

select plan(16);

insert into public.tournaments (name, year, competition_id, season_key, kind, display_timezone, status)
select 'C162 Action Centre', 2047, t.competition_id, 'action-centre', 'league_season',
       'Europe/London', 'active'
  from public.tournaments t where t.kind = 'league_season' order by t.name limit 1;

select set_config('test.ac_season',
  (select id::text from public.tournaments where season_key = 'action-centre'), true);

insert into public.teams (id, tournament_id, name) values
  (md5('ac-t1')::uuid, current_setting('test.ac_season')::uuid, 'Action Rovers'),
  (md5('ac-t2')::uuid, current_setting('test.ac_season')::uuid, 'Action United');

-- A round, a fixture in it, and the window link. `assert_bonus_lms_selection_shape`
-- refuses a pick whose club does not play in that round, so the selection below
-- needs real football underneath it rather than two bare club rows.
insert into public.competition_rounds (id, tournament_id, round_key, ordinal, kind, label)
values (md5('ac-r5')::uuid, current_setting('test.ac_season')::uuid,
        'ac-mw5', 5, 'league_matchweek', 'Matchweek 5');

insert into public.season_fixtures (
  id, tournament_id, competition_round_id, home_team_id, away_team_id, kickoff_at, status)
values (md5('ac-fx')::uuid, current_setting('test.ac_season')::uuid, md5('ac-r5')::uuid,
        md5('ac-t1')::uuid, md5('ac-t2')::uuid, now() + interval '2 days', 'scheduled');

insert into public.bonus_competitions (
  id, tournament_id, game_key, published, availability_status,
  draw_required, visibility_kind, registration_opens_at)
values (md5('ac-lms')::uuid, current_setting('test.ac_season')::uuid,
        'last_man_standing', true, 'active', false, 'public', now() - interval '10 days');

set local session_replication_role = replica;
insert into auth.users (id, email, aud, role, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
values (md5('ac-p1')::uuid, 'ac-1@example.test', 'authenticated', 'authenticated',
        '{}'::jsonb, '{}'::jsonb, now(), now()),
       (md5('ac-p2')::uuid, 'ac-2@example.test', 'authenticated', 'authenticated',
        '{}'::jsonb, '{}'::jsonb, now(), now());
set local session_replication_role = origin;

insert into public.profiles (id, display_name, welcomed_at) values
  (md5('ac-p1')::uuid, 'Action One', now()),
  (md5('ac-p2')::uuid, 'Action Two', now());

insert into public.bonus_competition_entrants (competition_id, user_id, outcome) values
  (md5('ac-lms')::uuid, md5('ac-p1')::uuid, 'active'),
  (md5('ac-lms')::uuid, md5('ac-p2')::uuid, 'active');

-- One round open now, one that locked days ago.
insert into public.bonus_competition_windows (id, competition_id, sequence, label, opens_at, locks_at) values
  (md5('ac-w5')::uuid, md5('ac-lms')::uuid, 5, 'Round 5',
   now() - interval '2 days', now() + interval '2 days'),
  (md5('ac-w4')::uuid, md5('ac-lms')::uuid, 4, 'Round 4',
   now() - interval '9 days', now() - interval '5 days');

-- Player two has already picked in the open round, so their item is generated
-- already complete rather than never generated — completion is a server verdict
-- and has to be visible as one.
insert into public.season_cup_window_fixtures (window_id, season_fixture_id)
values (md5('ac-w5')::uuid, md5('ac-fx')::uuid);

insert into public.bonus_lms_selections (competition_id, user_id, window_id, team_id)
values (md5('ac-lms')::uuid, md5('ac-p2')::uuid, md5('ac-w5')::uuid, md5('ac-t1')::uuid);

-- ---------------------------------------------------------------------------
-- GENERATION
-- ---------------------------------------------------------------------------

select is(
  (public.process_player_action_items() ->> 'lms_pick_actions_written')::integer, 2,
  'the driver writes one item per active entrant in an open round');

-- THE IDEMPOTENCE ASSERTION. The key is derived from what the action IS, so a
-- second run collides with the row that already exists.
select is(
  (public.process_player_action_items() ->> 'lms_pick_actions_written')::integer, 0,
  'a second run writes nothing, because the key is derived from the action and not the run');

select is(
  (select count(*)::integer from public.player_action_items
    where competition_id = md5('ac-lms')::uuid),
  2,
  'and two runs leave two rows rather than four');

select is(
  (select count(*)::integer from public.player_action_items
    where competition_id = md5('ac-lms')::uuid and completed_at is not null),
  1,
  'the entrant who already picked has a COMPLETED item — a server verdict, not a dismissal');

select is(
  (select deadline_at from public.player_action_items
    where user_id = md5('ac-p1')::uuid and competition_id = md5('ac-lms')::uuid),
  (select locks_at from public.bonus_competition_windows where id = md5('ac-w5')::uuid),
  'the deadline is the round''s own lock, copied from the authority that owns it');

-- ---------------------------------------------------------------------------
-- THE READ
-- ---------------------------------------------------------------------------

select set_config('request.jwt.claims',
  json_build_object('sub', md5('ac-p1')::uuid, 'role', 'authenticated',
                    'app_metadata', json_build_object())::text, true);
set local role authenticated;

select is(
  (public.get_my_actions(20, false) ->> 'unseen')::integer, 1,
  'the player who has not picked has one unseen action');

select is(
  jsonb_array_length(public.get_my_actions(20, false) -> 'actions'), 1,
  'and one action in the list, so the badge and the list agree');

select set_config('test.ac_key',
  public.get_my_actions(20, false) -> 'actions' -> 0 ->> 'action_key', true);

reset role;
select set_config('request.jwt.claims',
  json_build_object('sub', md5('ac-p2')::uuid, 'role', 'authenticated',
                    'app_metadata', json_build_object())::text, true);
set local role authenticated;

select is(
  jsonb_array_length(public.get_my_actions(20, false) -> 'actions'), 0,
  'the player who has picked is asked for nothing');

-- ---------------------------------------------------------------------------
-- THE COMMANDS, AND WHAT THEY MAY NOT DO
-- ---------------------------------------------------------------------------

reset role;
select set_config('request.jwt.claims',
  json_build_object('sub', md5('ac-p1')::uuid, 'role', 'authenticated',
                    'app_metadata', json_build_object())::text, true);
set local role authenticated;

select is(
  public.mark_actions_seen(array[current_setting('test.ac_key')]) ->> 'marked', '1',
  'marking an action seen marks it');

-- IDEMPOTENT, and the first sighting is the fact.
select is(
  public.mark_actions_seen(array[current_setting('test.ac_key')]) ->> 'marked', '0',
  'marking it again changes nothing, so a re-render does not restate when it was first seen');

select is(
  (public.get_my_actions(20, false) ->> 'unseen')::integer, 0,
  'and the badge clears while the action stays in the list');

select is(
  jsonb_array_length(public.get_my_actions(20, false) -> 'actions'), 1,
  'seen is not done: the action is still outstanding');

-- State cannot be written for a key the caller holds no item for, which is what
-- stops this becoming a key-value store keyed on a user id.
select is(
  public.mark_actions_seen(array['lms_pick_due:not:mine']) ->> 'marked', '0',
  'a key the caller holds no item for marks nothing');

select throws_ok(
  $$select public.dismiss_action('lms_pick_due:not:mine')$$,
  'P0002', null,
  'and dismissing one is refused outright');

-- ---------------------------------------------------------------------------
-- THE ASSERTION THIS FILE EXISTS FOR, PART ONE: regeneration must not un-read.
-- ---------------------------------------------------------------------------

select public.dismiss_action(current_setting('test.ac_key'));

reset role;
select public.process_player_action_items();

select set_config('request.jwt.claims',
  json_build_object('sub', md5('ac-p1')::uuid, 'role', 'authenticated',
                    'app_metadata', json_build_object())::text, true);
set local role authenticated;

select is(
  jsonb_array_length(public.get_my_actions(20, false) -> 'actions'), 0,
  'REGENERATION PRESERVES DISMISSAL — the two-table split doing the one job it exists for');

-- ---------------------------------------------------------------------------
-- PART TWO: a passed deadline must close, and no generator can close it.
-- ---------------------------------------------------------------------------

reset role;

update public.player_action_items
   set expires_at = now() - interval '1 minute'
 where competition_id = md5('ac-lms')::uuid;

select is(
  (public.process_player_action_items() ->> 'actions_invalidated')::integer, 1,
  'the expiry sweep closes an item whose moment has passed, which no generator could');

select * from finish();

rollback;
