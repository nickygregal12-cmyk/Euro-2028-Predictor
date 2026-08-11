-- Contract 127: a season competition can be opened for play.
--
-- THE ASSERTION THIS FILE EXISTS FOR is that after one administrator call, the
-- Last Man Standing settlement job stops answering `refused / no_setup`. That
-- refusal is the exact reason both season Last Man Standing competitions on
-- hosted development are unplayable, and it is driven here against the real
-- settlement authority rather than asserted from the setup row's presence.
--
-- THE SECOND ASSERTION IS THE ONE THAT KEEPS THE RULE. A calendar is created
-- once and never rescheduled, because rescheduling moves locks under
-- selections already made. So opening twice must be a no-op that says so, and
-- the second call is driven rather than reasoned about.
--
-- THE GATE IS DRIVEN AS A BOUNDARY, AND AGAINST THE WRONG CAPABILITY TOO. A
-- test that only proved an ordinary player is refused would pass on a function
-- gated by `require_result_admin`. The `results` administrator below is refused
-- specifically to show the two gates are distinct: an account trusted to
-- correct a scoreline has not thereby been trusted to fix a season's draw.
--
-- Self-contained: its own season, clubs, rounds, fixtures, competitions and
-- users.

begin;

select plan(36);

-- ---------------------------------------------------------------------------
-- The boundary.
-- ---------------------------------------------------------------------------

select is(
  (select count(*)::integer from pg_proc proc
     join pg_namespace ns on ns.oid = proc.pronamespace
    where ns.nspname = 'public'
      and proc.proname = 'admin_open_season_competition'
      and proc.prosecdef and proc.proconfig @> array['search_path=""']),
  1,
  'the entry point exists, security definer, search path pinned');

select is(
  (select count(*)::integer from information_schema.routine_privileges
    where routine_name = 'admin_open_season_competition'
      and grantee = 'anon'),
  0,
  'anon may not reach it');

select is(
  (select count(*)::integer from information_schema.routine_privileges
    where routine_schema = 'predictor_internal'
      and routine_name in ('require_competition_admin',
                           'generate_lms_first_windows',
                           'open_season_competition')
      and grantee in ('anon', 'authenticated', 'service_role')),
  0,
  'and everything beneath it is reachable by no browser or service role — the '
  'gate cannot be walked around');

-- ---------------------------------------------------------------------------
-- Setup: one season, four clubs, three matchweeks. Matchweek 1 is in the past,
-- which is what makes the eligibility boundary observable rather than assumed.
-- ---------------------------------------------------------------------------

insert into public.tournaments (name, year, competition_id, season_key, kind, display_timezone, status)
select 'C127 Bootstrap Probe', 2030, t.competition_id, 'bst-probe', 'league_season',
       t.display_timezone, 'active'
  from public.tournaments t
 where t.kind = 'league_season'
 order by t.name
 limit 1;

select set_config('test.bst_season',
  (select id::text from public.tournaments where season_key = 'bst-probe'), true);

insert into public.teams (tournament_id, name) values
  (current_setting('test.bst_season')::uuid, 'Bootstrap Rovers'),
  (current_setting('test.bst_season')::uuid, 'Bootstrap United'),
  (current_setting('test.bst_season')::uuid, 'Bootstrap City'),
  (current_setting('test.bst_season')::uuid, 'Bootstrap Athletic');

insert into public.competition_rounds (tournament_id, round_key, ordinal, kind, label)
values
  (current_setting('test.bst_season')::uuid, 'bst-mw1', 1, 'league_matchweek', 'Matchweek 1'),
  (current_setting('test.bst_season')::uuid, 'bst-mw2', 2, 'league_matchweek', 'Matchweek 2'),
  (current_setting('test.bst_season')::uuid, 'bst-mw3', 3, 'league_matchweek', 'Matchweek 3');

insert into public.season_fixtures
  (tournament_id, competition_round_id, home_team_id, away_team_id, kickoff_at, status)
select
  current_setting('test.bst_season')::uuid,
  round.id,
  (select id from public.teams
    where tournament_id = current_setting('test.bst_season')::uuid and name = pairs.home),
  (select id from public.teams
    where tournament_id = current_setting('test.bst_season')::uuid and name = pairs.away),
  case round.round_key
    when 'bst-mw1' then now() - interval '1 day'
    when 'bst-mw2' then now() + interval '3 days'
    else now() + interval '10 days'
  end + pairs.offset_hours,
  'scheduled'
from public.competition_rounds round
cross join (values
  ('Bootstrap Rovers', 'Bootstrap United', interval '0 hours'),
  ('Bootstrap City', 'Bootstrap Athletic', interval '2 hours')
) pairs(home, away, offset_hours)
where round.tournament_id = current_setting('test.bst_season')::uuid;

select set_config('test.bst_mw2_lock',
  (select (min(fixture.kickoff_at) - interval '30 minutes')::text
     from public.season_fixtures fixture
     join public.competition_rounds round on round.id = fixture.competition_round_id
    where round.tournament_id = current_setting('test.bst_season')::uuid
      and round.round_key = 'bst-mw2'), true);

select set_config('test.bst_mw3_lock',
  (select (min(fixture.kickoff_at) - interval '30 minutes')::text
     from public.season_fixtures fixture
     join public.competition_rounds round on round.id = fixture.competition_round_id
    where round.tournament_id = current_setting('test.bst_season')::uuid
      and round.round_key = 'bst-mw3'), true);

-- The Main Predictor measurement below reads these, so they are derived here
-- through the authority that owns them rather than written by hand.
select is(
  predictor_internal.derive_round_play_windows(current_setting('test.bst_season')::uuid),
  3,
  'all three matchweeks have a derived play window');

-- The players are created BEFORE the competitions now, because contract 152
-- gives a private competition an `owner_id` that references `auth.users` — so
-- the owner has to exist before the row that names them.
set local session_replication_role = replica;
insert into auth.users (
  id, email, aud, role, raw_app_meta_data, raw_user_meta_data, created_at, updated_at
)
select md5('bst-user-' || n)::uuid, format('bst-%s@example.test', n),
  'authenticated', 'authenticated', '{}'::jsonb, '{}'::jsonb, now(), now()
from generate_series(1, 2) as n;
set local session_replication_role = origin;

insert into public.profiles (id, display_name, welcomed_at)
select md5('bst-user-' || n)::uuid, format('Bst Player %s', n), now()
from generate_series(1, 2) as n;

-- Contract 152 requires a private competition to carry a name, an owner and an
-- invite code; a public one must carry none of the three. Both halves of that
-- rule are exercised here, because this fixture holds one of each.
insert into public.bonus_competitions (
  id, tournament_id, game_key, published, availability_status,
  draw_required, visibility_kind, registration_opens_at,
  name, owner_id, invite_code
) values
  (md5('bst-lms')::uuid, current_setting('test.bst_season')::uuid,
   'last_man_standing', true, 'active', false, 'public', now() - interval '2 days',
   null, null, null),
  (md5('bst-lms-private')::uuid, current_setting('test.bst_season')::uuid,
   'last_man_standing', true, 'active', false, 'private', now() - interval '2 days',
   'Bst Private LMS', md5('bst-user-1')::uuid, 'BSTLMS'),
  (md5('bst-mp')::uuid, current_setting('test.bst_season')::uuid,
   'main_predictor', true, 'active', false, 'public', now() - interval '2 days',
   null, null, null),
  (md5('bst-cup')::uuid, current_setting('test.bst_season')::uuid,
   'predictor_cup', true, 'active', true, 'public', now() - interval '2 days',
   null, null, null);

-- ---------------------------------------------------------------------------
-- The gate, driven rather than inspected.
-- ---------------------------------------------------------------------------

select set_config('request.jwt.claims',
  json_build_object('sub', md5('bst-user-1')::uuid, 'role', 'authenticated',
                    'app_metadata', json_build_object())::text, true);
set local role authenticated;

select throws_ok(
  format('select public.admin_open_season_competition(%L::uuid)', md5('bst-lms')::uuid),
  '42501',
  'Competition administration is not authorised',
  'an ordinary signed-in player may reach the function and may not act — the '
  'grant is not the boundary');

-- The distinctness assertion. `results` is the capability every other admin
-- entry point in this repository takes, so a contract that reused it would
-- pass every other test in this file and fail only here.
select set_config('request.jwt.claims',
  json_build_object('sub', md5('bst-user-1')::uuid, 'role', 'authenticated',
                    'app_metadata', json_build_object(
                      'admin_capabilities', json_build_array('results')))::text, true);

select throws_ok(
  format('select public.admin_open_season_competition(%L::uuid)', md5('bst-lms')::uuid),
  '42501',
  'Competition administration is not authorised',
  'and a RESULT administrator is refused too — correcting a scoreline is not '
  'authority to fix a season''s draw');

reset role;

select is(
  (select count(*)::integer from public.bonus_competition_windows
    where competition_id = md5('bst-lms')::uuid),
  0,
  'and nothing was opened, not merely reported as refused');

-- ---------------------------------------------------------------------------
-- Opening the public Last Man Standing competition.
--
-- The claims alone decide the outcome — `require_competition_admin` reads the
-- JWT GUC, not the session role — so the role is not switched again and the
-- assertions below can read tables `authenticated` cannot.
-- ---------------------------------------------------------------------------

select is(
  (predictor_internal.settle_season_lms_competition(md5('bst-lms')::uuid, now()))->>'reason',
  'no_setup',
  'BEFORE OPENING, settlement refuses for want of a setup — this is the exact '
  'state both season competitions are in on hosted development');

select set_config('request.jwt.claims',
  json_build_object('sub', md5('bst-user-1')::uuid, 'role', 'authenticated',
                    'app_metadata', json_build_object(
                      'admin_role', 'super_admin'))::text, true);

select set_config('test.bst_opened',
  (select public.admin_open_season_competition(md5('bst-lms')::uuid))::text, true);

select is(
  (current_setting('test.bst_opened')::jsonb)->>'outcome',
  'opened',
  'a super administrator opens it');

select is(
  (current_setting('test.bst_opened')::jsonb)->>'setupWritten',
  'true',
  'the setup was written, because a public competition has no creator to choose it');

select is(
  (current_setting('test.bst_opened')::jsonb)->>'windows',
  '2',
  'and two rounds were scheduled — the third matchweek is in the past');

select results_eq(
  format($q$select lives, saves, draws_rule, endgame_scope, endgame_on_wipeout
           from public.season_lms_setups where competition_id = %L::uuid$q$,
         md5('bst-lms')::uuid),
  $q$values (0::smallint, 0::smallint, 'eliminate'::text, 'public'::text, null::text)$q$,
  'the setup is Classic under the public endgame — ADR 0022 pins it, and the '
  'schema would refuse any other public row');

select is(
  (predictor_internal.settle_season_lms_competition(md5('bst-lms')::uuid, now()))->>'outcome',
  'nothing_settled',
  'AND SETTLEMENT NO LONGER REFUSES. It is past the setup gate and answering '
  'about rounds, which is what makes the competition playable at all');

-- ---------------------------------------------------------------------------
-- The calendar it created.
-- ---------------------------------------------------------------------------

select is(
  (select count(*)::integer from public.bonus_competition_windows
    where competition_id = md5('bst-lms')::uuid),
  2,
  'two windows exist');

select is(
  (select label from public.bonus_competition_windows
    where competition_id = md5('bst-lms')::uuid and sequence = 1),
  'Matchweek 2',
  'round 1 of the competition is the season''s SECOND matchweek — the first '
  'has already been played and cannot be picked for');

select is(
  (select locks_at from public.bonus_competition_windows
    where competition_id = md5('bst-lms')::uuid and sequence = 1),
  current_setting('test.bst_mw2_lock')::timestamptz,
  'and it locks at that matchweek''s earliest kickoff minus the game''s own '
  'thirty-minute buffer, from the same derivation the successor scheduler uses');

select is(
  (select locks_at from public.bonus_competition_windows
    where competition_id = md5('bst-lms')::uuid and sequence = 2),
  current_setting('test.bst_mw3_lock')::timestamptz,
  'round 2 locks at the third matchweek''s');

select ok(
  (select win2.opens_at = win1.locks_at
     from public.bonus_competition_windows win1
     join public.bonus_competition_windows win2
       on win2.competition_id = win1.competition_id and win2.sequence = 2
    where win1.competition_id = md5('bst-lms')::uuid and win1.sequence = 1),
  'each round opens when the previous one locked, so the calendar has no gap a '
  'selection could fall into');

select ok(
  (select win.opens_at <= now() and win.opens_at > now() - interval '5 minutes'
     from public.bonus_competition_windows win
    where win.competition_id = md5('bst-lms')::uuid and win.sequence = 1),
  'and the first opens at the boundary the caller supplied');

select is(
  (select count(*)::integer from public.season_cup_window_fixtures link
     join public.bonus_competition_windows win on win.id = link.window_id
    where win.competition_id = md5('bst-lms')::uuid),
  4,
  'both rounds carry the fixtures they are played over — without these the '
  'round read has nothing to show and the window can never settle');

select is(
  (select count(*)::integer from public.bonus_competition_audit
    where competition_id = md5('bst-lms')::uuid
      and action = 'first_calendar_scheduled'),
  1,
  'and the scheduling is recorded');

-- ---------------------------------------------------------------------------
-- Opening twice.
-- ---------------------------------------------------------------------------

select is(
  (public.admin_open_season_competition(md5('bst-lms')::uuid))->>'outcome',
  'already_open',
  'a second call says so by name rather than reporting zero rounds, which is '
  'the opposite fact');

select is(
  (select count(*)::integer from public.bonus_competition_windows
    where competition_id = md5('bst-lms')::uuid),
  2,
  'and the calendar is untouched — rescheduling would move locks under '
  'selections already made');

-- ---------------------------------------------------------------------------
-- The private competition, whose rules are not this contract's to choose.
-- ---------------------------------------------------------------------------

select is(
  (public.admin_open_season_competition(md5('bst-lms-private')::uuid))->>'reason',
  'private_setup_not_chosen',
  'a private competition with no setup is REFUSED rather than given Classic — '
  'ADR 0013 makes those rules its organiser''s');

select is(
  (select count(*)::integer from public.bonus_competition_windows
    where competition_id = md5('bst-lms-private')::uuid),
  0,
  'and it gets no calendar, so the refusal is total rather than partial');

insert into public.season_lms_setups (
  competition_id, lives, saves, draws_rule, endgame_scope, endgame_on_wipeout
) values (md5('bst-lms-private')::uuid, 1, 1, 'eliminate', 'private', 'play_on');

select is(
  (public.admin_open_season_competition(md5('bst-lms-private')::uuid))->>'outcome',
  'opened',
  'once the organiser has chosen, the same call opens it — and on THEIR setup');

select results_eq(
  format($q$select lives, saves from public.season_lms_setups where competition_id = %L::uuid$q$,
         md5('bst-lms-private')::uuid),
  $q$values (1::smallint, 1::smallint)$q$,
  'which is left exactly as they wrote it');

-- ---------------------------------------------------------------------------
-- The other two season games.
-- ---------------------------------------------------------------------------

select is(
  (public.admin_open_season_competition(md5('bst-mp')::uuid))->>'outcome',
  'no_windows_required',
  'Main Predictor needs no rounds created: its rounds ARE the season''s '
  'matchweeks and its lock derives from their kickoffs');

select is(
  (public.admin_open_season_competition(md5('bst-mp')::uuid))->>'playableRounds',
  '3',
  'and it says how many are playable, so "nothing to do" is distinguishable '
  'from "this season has no fixtures"');

select is(
  (select count(*)::integer from public.bonus_competition_windows
    where competition_id = md5('bst-mp')::uuid),
  0,
  'no window was created for it — a second source for the same lock is exactly '
  'what this must not build');

select is(
  (public.admin_open_season_competition(md5('bst-cup')::uuid))->>'outcome',
  'not_open',
  'the public Championship reports contract 111''s own answer at this field '
  'size rather than a second threshold invented here');

select is(
  (public.admin_open_season_competition(md5('bst-cup')::uuid))->>'gameKey',
  'predictor_cup',
  'and the caller can tell which game answered');

-- ---------------------------------------------------------------------------
-- What each generator refuses, so the two calendars cannot compete.
-- ---------------------------------------------------------------------------

-- A predecessor and its successor, both private, so both carry the contract 152
-- identity. They hold DIFFERENT invite codes because the shared namespace keys
-- on the code itself: one code names exactly one container.
insert into public.bonus_competitions (
  id, tournament_id, game_key, published, availability_status, draw_required,
  visibility_kind, registration_opens_at, completed_at, completion_reason,
  series_id, series_sequence, predecessor_competition_id,
  name, owner_id, invite_code
) values (
  md5('bst-pred')::uuid, current_setting('test.bst_season')::uuid,
  'last_man_standing', true, 'active', false, 'private', now() - interval '9 days',
  now() - interval '2 days', 'no_winner_restarted',
  md5('bst-pred')::uuid, 1, null,
  'Bst Predecessor', md5('bst-user-1')::uuid, 'BSTPRE'
), (
  md5('bst-succ')::uuid, current_setting('test.bst_season')::uuid,
  'last_man_standing', true, 'active', false, 'private', now() - interval '2 days',
  null, null,
  md5('bst-pred')::uuid, 2, md5('bst-pred')::uuid,
  'Bst Successor', md5('bst-user-1')::uuid, 'BSTSUC'
);

select throws_ok(
  format('select predictor_internal.generate_lms_first_windows(%L::uuid, now())',
         md5('bst-succ')::uuid),
  '23514',
  null,
  'a restarted successor is refused here — contract 109 starts it after its '
  'predecessor finished, and this function is given no such boundary');

select throws_ok(
  format('select predictor_internal.generate_lms_successor_windows(%L::uuid)',
         md5('bst-lms')::uuid),
  '23514',
  null,
  'and a first instance is still refused THERE, so the two generators cover '
  'the two cases without ever covering the same one');

-- ---------------------------------------------------------------------------
-- The tournament, which takes its calendar from the published catalogue.
-- ---------------------------------------------------------------------------

insert into public.tournaments (name, year, competition_id, season_key, kind, display_timezone, status)
select 'C127 Tournament Probe', 2031, t.competition_id, 'bst-tourn', 'tournament',
       t.display_timezone, 'active'
  from public.tournaments t
 where t.kind = 'tournament'
 order by t.name
 limit 1;

insert into public.bonus_competitions (
  id, tournament_id, game_key, published, availability_status,
  draw_required, visibility_kind, registration_opens_at
)
select md5('bst-tourn-lms')::uuid, t.id, 'last_man_standing', true, 'active',
       false, 'public', now() - interval '2 days'
  from public.tournaments t
 where t.season_key = 'bst-tourn';

select throws_ok(
  format('select public.admin_open_season_competition(%L::uuid)',
         md5('bst-tourn-lms')::uuid),
  '23514',
  null,
  'a tournament competition is refused: its rounds are published reference '
  'data, not derived from a league fixture list');

select is(
  (public.admin_open_season_competition(md5('bst-pred')::uuid))->>'reason',
  'already_completed',
  'and a finished competition is refused too — opening one would be creating a '
  'second competition inside the first');

select * from finish();
rollback;
