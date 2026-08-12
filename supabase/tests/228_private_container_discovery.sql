-- Contract 179: private container discovery, and the workspace that opens one.
--
-- THE ASSERTION THIS FILE EXISTS FOR is the one the 12 August 2026 investigation
-- says a component mock cannot make: a private container created or joined by a
-- player who has NEVER joined the corresponding public game is still returned by
-- the authoritative read. Every seeded fixture below is deliberately built with
-- no public-game membership at all, because a suite seeded with a player who
-- already holds one would pass against the broken implementation.
--
-- The second is the differential one on launch readiness. A readiness read that
-- can disagree with the launcher is worse than no readiness read, because an
-- organiser acts on it. So the suite drives a field through BOTH the readiness
-- projection and a real `launch_private_season_cup`, before and after, and
-- requires them to agree each time.

begin;

select plan(26);

insert into public.tournaments (name, year, competition_id, season_key, kind, display_timezone, status)
select 'C179 Private Play', 2062, t.competition_id, 'private-play', 'league_season',
       'Europe/London', 'active'
  from public.tournaments t where t.kind = 'league_season' order by t.name limit 1;

select set_config('test.pp_season',
  (select id::text from public.tournaments where season_key = 'private-play'), true);

insert into public.teams (id, tournament_id, name)
select md5('pp-t' || n)::uuid, current_setting('test.pp_season')::uuid, 'PP Club ' || n
  from generate_series(1, 4) n;

-- Enough calendar ahead for the Championship format selector to find a viable
-- single-group shape; `select_season_cup_format` refuses on remaining rounds.
-- The round windows are deliberately left null: contract 113's disjointness
-- trigger owns them, and nothing this suite asserts reads them. The Championship
-- format selector counts remaining rounds from `season_matchweek_lock_at`, which
-- derives from the kickoffs below.
insert into public.competition_rounds (
  id, tournament_id, round_key, ordinal, kind, label)
select md5('pp-r' || n)::uuid, current_setting('test.pp_season')::uuid,
       'pp-mw' || n, n, 'league_matchweek', 'Matchweek ' || n
  from generate_series(1, 12) n;

insert into public.season_fixtures (
  id, tournament_id, competition_round_id, home_team_id, away_team_id, kickoff_at, status)
select md5('pp-fx' || n)::uuid, current_setting('test.pp_season')::uuid,
       md5('pp-r' || n)::uuid, md5('pp-t1')::uuid, md5('pp-t2')::uuid,
       now() + (n || ' days')::interval + interval '12 hours', 'scheduled'
  from generate_series(1, 12) n;

set local session_replication_role = replica;
insert into auth.users (id, email, aud, role, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
select md5('pp-' || who)::uuid, format('pp-%s@example.test', who),
       'authenticated', 'authenticated', '{}'::jsonb, '{}'::jsonb, now(), now()
  from unnest(array['lmsown', 'lmsjoin', 'cupown', 'cupjoin', 'stranger']) as who;
set local session_replication_role = origin;

insert into public.profiles (id, display_name, welcomed_at)
select md5('pp-' || who)::uuid, initcap(who), now()
  from unnest(array['lmsown', 'lmsjoin', 'cupown', 'cupjoin', 'stranger']) as who;

-- A PUBLIC Last Man Standing on the same season that NOBODY below joins. It is
-- here so the suite proves discovery does not run through public-game
-- membership: if it did, every assertion would still pass by accident once a
-- public row existed for the game.
insert into public.bonus_competitions (
  id, tournament_id, game_key, published, availability_status, draw_required,
  visibility_kind, registration_opens_at)
values (md5('pp-publms')::uuid, current_setting('test.pp_season')::uuid,
        'last_man_standing', true, 'active', false, 'public', now() - interval '5 days');

insert into public.bonus_competitions (
  id, tournament_id, game_key, name, owner_id, invite_code, published,
  availability_status, draw_required, visibility_kind, registration_opens_at)
values
  (md5('pp-lms')::uuid, current_setting('test.pp_season')::uuid, 'last_man_standing',
   'The Local', md5('pp-lmsown')::uuid, 'PPLMSCODE001', true, 'active', false,
   'private', now() - interval '2 days'),
  (md5('pp-cup')::uuid, current_setting('test.pp_season')::uuid, 'predictor_cup',
   'Office Championship', md5('pp-cupown')::uuid, 'PPCUPCODE001', true, 'active', false,
   'private', now() - interval '2 days');

insert into public.season_lms_setups (
  competition_id, lives, saves, draws_rule, endgame_scope, endgame_on_wipeout)
values (md5('pp-lms')::uuid, 1, 1, 'eliminate', 'private', 'reset');

-- Participation. `prepare_bonus_entrant_membership` writes the matching
-- `game_memberships` row for each, so none is inserted by hand.
insert into public.bonus_competition_entrants (competition_id, user_id, outcome) values
  (md5('pp-lms')::uuid, md5('pp-lmsown')::uuid, 'active'),
  (md5('pp-lms')::uuid, md5('pp-lmsjoin')::uuid, 'active'),
  (md5('pp-cup')::uuid, md5('pp-cupown')::uuid, 'active'),
  (md5('pp-cup')::uuid, md5('pp-cupjoin')::uuid, 'active');

insert into public.season_lms_entrant_state (competition_id, user_id, lives_remaining, saves_remaining) values
  (md5('pp-lms')::uuid, md5('pp-lmsown')::uuid, 1, 1),
  (md5('pp-lms')::uuid, md5('pp-lmsjoin')::uuid, 1, 1);

-- An OPEN Last Man Standing round: the owner has picked, the joiner has not.
-- Deliberately still open, because that is when "has picked" and "which club"
-- are in tension.
insert into public.bonus_competition_windows (id, competition_id, sequence, label, opens_at, locks_at)
values (md5('pp-w1')::uuid, md5('pp-lms')::uuid, 1, 'Round 1',
        now() - interval '6 hours', now() + interval '2 days');

insert into public.season_cup_window_fixtures (window_id, season_fixture_id)
values (md5('pp-w1')::uuid, md5('pp-fx1')::uuid);

insert into public.bonus_lms_selections (competition_id, user_id, window_id, team_id)
values (md5('pp-lms')::uuid, md5('pp-lmsown')::uuid, md5('pp-w1')::uuid, md5('pp-t1')::uuid);

-- The property every assertion below depends on, asserted rather than assumed:
-- not one of these players holds a membership in ANY public competition.
select is(
  (select count(*)::integer
     from public.game_memberships membership
     join public.bonus_competitions competition
       on competition.id = membership.game_competition_id
    where competition.visibility_kind = 'public'
      and membership.user_id in (md5('pp-lmsown')::uuid, md5('pp-lmsjoin')::uuid,
                                 md5('pp-cupown')::uuid, md5('pp-cupjoin')::uuid)),
  0,
  'the fixture holds no public-game membership, so nothing below can pass through one');

-- ===========================================================================
-- Last Man Standing — the owner
-- ===========================================================================

select set_config('request.jwt.claims',
  json_build_object('sub', md5('pp-lmsown')::uuid, 'role', 'authenticated',
                    'app_metadata', json_build_object())::text, true);
set local role authenticated;

select set_config('test.pp_own',
  public.get_my_private_competitions(25, 0)::text, true);

select is(
  current_setting('test.pp_own')::jsonb ->> 'total', '1',
  'the LMS organiser rediscovers the competition they created');

select is(
  (select entry ->> 'competition_id'
     from jsonb_array_elements(current_setting('test.pp_own')::jsonb -> 'competitions') entry),
  md5('pp-lms')::uuid::text,
  'and it is the private container, addressed by its own id');

select is(
  (select entry ->> 'game_key'
     from jsonb_array_elements(current_setting('test.pp_own')::jsonb -> 'competitions') entry),
  'last_man_standing',
  'carrying the canonical game key rather than a league shape');

select is(
  (select entry ->> 'invite_code'
     from jsonb_array_elements(current_setting('test.pp_own')::jsonb -> 'competitions') entry),
  'PPLMSCODE001',
  'the organiser gets the live invite code, because sharing it is their job');

select is(
  (select entry ->> 'lifecycle_state'
     from jsonb_array_elements(current_setting('test.pp_own')::jsonb -> 'competitions') entry),
  'registration_open',
  'and one lifecycle state, derived rather than stored');

-- ===========================================================================
-- Last Man Standing — the invitee, who owns nothing
-- ===========================================================================

reset role;
select set_config('request.jwt.claims',
  json_build_object('sub', md5('pp-lmsjoin')::uuid, 'role', 'authenticated',
                    'app_metadata', json_build_object())::text, true);
set local role authenticated;

select set_config('test.pp_join',
  public.get_my_private_competitions(25, 0)::text, true);

select is(
  current_setting('test.pp_join')::jsonb ->> 'total', '1',
  'the invitee rediscovers it too, which contract 165''s owner-scoped read cannot do');

select is(
  (select entry ->> 'is_owner'
     from jsonb_array_elements(current_setting('test.pp_join')::jsonb -> 'competitions') entry),
  'false',
  'and is told they are not the organiser');

select is(
  (select entry -> 'invite_code'
     from jsonb_array_elements(current_setting('test.pp_join')::jsonb -> 'competitions') entry),
  'null'::jsonb,
  'a member never receives the invite secret; they already joined');

select is(
  (select entry ->> 'invite_available'
     from jsonb_array_elements(current_setting('test.pp_join')::jsonb -> 'competitions') entry),
  'true',
  'they learn only that one exists');

select is(
  (select entry ->> 'membership_status'
     from jsonb_array_elements(current_setting('test.pp_join')::jsonb -> 'competitions') entry),
  'active',
  'with their own membership state, so a surface need not guess it');

-- The reveal boundary, on the surface that most invites a leak: the workspace
-- shows THAT the organiser has picked in an open round, and no club anywhere.
select set_config('test.pp_ws',
  public.get_private_competition_workspace(md5('pp-lms')::uuid)::text, true);

select is(
  (select entry ->> 'has_picked_current_round'
     from jsonb_array_elements(current_setting('test.pp_ws')::jsonb -> 'members') entry
    where entry ->> 'user_id' = md5('pp-lmsown')::uuid::text),
  'true',
  'the workspace says THAT the organiser has picked in the open round');

select ok(
  current_setting('test.pp_ws')::jsonb::text not like '%PP Club%'
  and current_setting('test.pp_ws')::jsonb::text not like '%' || md5('pp-t1')::uuid::text || '%',
  'and names no club and no team id anywhere, because the round has not locked');

select is(
  current_setting('test.pp_ws')::jsonb -> 'current_round' ->> 'locked', 'false',
  'the round in play is reported unlocked from the stored instant, not from a caller argument');

select is(
  current_setting('test.pp_ws')::jsonb -> 'caller' -> 'invite_code', 'null'::jsonb,
  'and the workspace withholds the code from a member exactly as the list does');

-- ===========================================================================
-- The stranger
-- ===========================================================================

reset role;
select set_config('request.jwt.claims',
  json_build_object('sub', md5('pp-stranger')::uuid, 'role', 'authenticated',
                    'app_metadata', json_build_object())::text, true);
set local role authenticated;

select is(
  public.get_my_private_competitions(25, 0)::jsonb ->> 'total', '0',
  'a player in nothing discovers nothing, and gets an empty list rather than an error');

select throws_ok(
  format('select public.get_private_competition_workspace(%L::uuid)', md5('pp-lms')::uuid),
  'P0002',
  null,
  'a non-member cannot open the container');

select throws_ok(
  format('select public.get_private_competition_workspace(%L::uuid)', md5('pp-nonexistent')::uuid),
  'P0002',
  null,
  'and an id that does not exist refuses identically, so the read is not a probe');

-- ===========================================================================
-- Predictor Championship — discovery, and PPLAY-003's return-and-launch
-- ===========================================================================

reset role;
select set_config('request.jwt.claims',
  json_build_object('sub', md5('pp-cupjoin')::uuid, 'role', 'authenticated',
                    'app_metadata', json_build_object())::text, true);
set local role authenticated;

select is(
  (select entry ->> 'game_key'
     from jsonb_array_elements(
       public.get_my_private_competitions(25, 0)::jsonb -> 'competitions') entry),
  'predictor_cup',
  'a Championship entrant who joined by code rediscovers the Championship');

select is(
  public.get_private_competition_workspace(md5('pp-cup')::uuid)::jsonb
    -> 'launch' ->> 'can_launch',
  'false',
  'but an entrant may not launch it, however ready the field is');

select is(
  public.get_private_competition_workspace(md5('pp-cup')::uuid)::jsonb
    -> 'launch' ->> 'blocked_reason',
  'not_the_organiser',
  'and is told why, from the server rather than from a browser rule');

reset role;
select set_config('request.jwt.claims',
  json_build_object('sub', md5('pp-cupown')::uuid, 'role', 'authenticated',
                    'app_metadata', json_build_object())::text, true);
set local role authenticated;

-- Two entrants is below the format selector's minimum field of four. THE
-- DIFFERENTIAL ASSERTION: readiness says no, and a real launch also declines.
select set_config('test.pp_small',
  public.get_private_competition_workspace(md5('pp-cup')::uuid)::text, true);

select is(
  current_setting('test.pp_small')::jsonb -> 'launch' ->> 'can_launch', 'false',
  'the organiser returning to a short field is told the launch is not available');

select is(
  public.launch_private_season_cup(md5('pp-cup')::uuid)::jsonb ->> 'outcome',
  'no_viable_format',
  'and the launcher itself agrees: readiness and the writer cannot disagree here');

-- Fill the field to four and re-ask both.
reset role;
set local session_replication_role = replica;
insert into auth.users (id, email, aud, role, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
select md5('pp-fill' || n)::uuid, format('pp-fill%s@example.test', n),
       'authenticated', 'authenticated', '{}'::jsonb, '{}'::jsonb, now(), now()
  from generate_series(1, 2) n;
set local session_replication_role = origin;

insert into public.profiles (id, display_name, welcomed_at)
select md5('pp-fill' || n)::uuid, 'Filler ' || n, now() from generate_series(1, 2) n;

insert into public.bonus_competition_entrants (competition_id, user_id, outcome)
select md5('pp-cup')::uuid, md5('pp-fill' || n)::uuid, 'active' from generate_series(1, 2) n;

select set_config('request.jwt.claims',
  json_build_object('sub', md5('pp-cupown')::uuid, 'role', 'authenticated',
                    'app_metadata', json_build_object())::text, true);
set local role authenticated;

select is(
  public.get_private_competition_workspace(md5('pp-cup')::uuid)::jsonb
    -> 'launch' ->> 'can_launch',
  'true',
  'with a viable field the organiser who left and came back can launch');

select is(
  public.launch_private_season_cup(md5('pp-cup')::uuid)::jsonb ->> 'outcome',
  'launched',
  'and the launch actually happens, which is the lifecycle PPLAY-003 had no path through');

select is(
  public.get_private_competition_workspace(md5('pp-cup')::uuid)::jsonb
    -> 'launch' ->> 'blocked_reason',
  'already_launched',
  'after which readiness reports the launcher''s own idempotence rather than a second opinion');

select * from finish();
rollback;
