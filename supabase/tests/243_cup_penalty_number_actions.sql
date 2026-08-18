-- Contract 195: the action centre learns about the Championship tie.
--
-- THE ASSERTION THIS FILE EXISTS FOR is the one that is invisible from the
-- outside: a Championship Penalty Number does NOT lock when its window locks.
-- Contract 161 writes a season Cup round's `locks_at` as the first kickoff
-- minus the game definition's buffer, and `submit_cup_penalty_number` accepts a
-- number right up to the kickoff itself. An item keyed on `window_id` would be
-- swept away by contract 162's existing re-read while the write authority was
-- still taking submissions, and every other assertion here would still pass.
--
-- So the fixture is built with the window ALREADY LOCKED and the first kickoff
-- still ahead, and the sweep is driven for real against it.
--
-- The completion condition is proved through the REAL WRITE PATH rather than by
-- inserting a row: `submit_cup_penalty_number` is called as the player, so if
-- the generator ever stopped agreeing with the authority that owns the fact,
-- this would fail rather than agree with itself.

begin;

select plan(21);

do $$
declare
  v_competition uuid;
  v_t uuid;
  v_home uuid;
  v_away uuid;
  v_group uuid;
  v_win uuid;
  v_match uuid;
begin
  -- Seeding a confirmed result needs the protected-lifecycle capability; this
  -- whole file runs inside a transaction the harness rolls back.
  set local predictor.match_result_write = 'on';

  select competition_id into v_competition
    from public.tournaments where kind = 'tournament' order by name limit 1;

  insert into public.tournaments
      (name, year, competition_id, season_key, kind, display_timezone, status)
    values ('C195 T', 2045, v_competition, '2045', 'tournament', 'Europe/London', 'active')
    returning id into v_t;

  insert into public.groups (tournament_id, letter) values (v_t, 'A') returning id into v_group;
  insert into public.teams (tournament_id, name) values (v_t, 'PH') returning id into v_home;
  insert into public.teams (tournament_id, name) values (v_t, 'PA') returning id into v_away;

  set local session_replication_role = replica;
  insert into auth.users (id, email, aud, role, raw_app_meta_data, raw_user_meta_data,
                          created_at, updated_at)
  select md5('pn-user-' || n)::uuid, format('pn-%s@example.test', n),
         'authenticated', 'authenticated', '{}'::jsonb, '{}'::jsonb, now(), now()
  from generate_series(1, 6) as n;
  set local session_replication_role = origin;

  insert into public.profiles (id, display_name, welcomed_at)
  select md5('pn-user-' || n)::uuid, 'Penalty ' || n, now() from generate_series(1, 6) as n;

  insert into public.bonus_competitions
      (id, tournament_id, game_key, published, availability_status, draw_required)
    values (md5('pn-cup')::uuid, v_t, 'predictor_cup', true, 'active', true);

  insert into public.bonus_competition_entrants (competition_id, user_id)
  select md5('pn-cup')::uuid, md5('pn-user-' || n)::uuid from generate_series(1, 6) as n;

  -- THE FIXTURE THIS SUITE TURNS ON. The window locked an hour ago; the
  -- designated real match kicks off in three hours. A Penalty Number is still
  -- legal for those three hours.
  insert into public.bonus_competition_windows
      (id, competition_id, tournament_id, sequence, label, opens_at, locks_at, settles_at)
    values (md5('pn-win')::uuid, md5('pn-cup')::uuid, v_t, 1, 'QF',
            now() - interval '2 days', now() - interval '1 hour',
            now() + interval '2 days');

  insert into public.matches (
      tournament_id, match_ref, round, home_source, away_source,
      home_team_id, away_team_id, group_id, matchday, match_date, kickoff_at, venue)
    values (
      v_t, 'PN-1', 'group', 'A', 'B', v_home, v_away, v_group, 1,
      date '2045-06-10', now() + interval '3 hours', 'V')
    returning id into v_match;
  insert into public.bonus_window_fixtures (window_id, match_id, tournament_id)
    values (md5('pn-win')::uuid, v_match, v_t);

  insert into public.bonus_cup_groups (id, competition_id, ordinal, size)
    values (md5('pn-grp')::uuid, md5('pn-cup')::uuid, 1, 4);
  insert into public.bonus_cup_members (competition_id, group_id, user_id, draw_number, seed)
  select md5('pn-cup')::uuid, md5('pn-grp')::uuid, md5('pn-user-' || n)::uuid, n, n
  from generate_series(1, 6) as n;

  -- Tie 1: an ordinary open tie. Users 1 (home, ODD lane) and 2 (away, EVEN).
  insert into public.bonus_cup_fixtures
      (id, competition_id, window_id, stage, round_size, bracket_slot,
       home_user_id, away_user_id)
    values (md5('pn-tie-1')::uuid, md5('pn-cup')::uuid, md5('pn-win')::uuid,
            'knockout', 4, 1, md5('pn-user-1')::uuid, md5('pn-user-2')::uuid);

  -- Tie 2: user 3 is disqualified BEFORE anything is generated, so this proves
  -- suppression rather than deletion.
  insert into public.bonus_cup_fixtures
      (id, competition_id, window_id, stage, round_size, bracket_slot,
       home_user_id, away_user_id)
    values (md5('pn-tie-2')::uuid, md5('pn-cup')::uuid, md5('pn-win')::uuid,
            'knockout', 4, 2, md5('pn-user-3')::uuid, md5('pn-user-4')::uuid);

  update public.game_memberships
     set status = 'disqualified', disqualified_at = now(), left_at = null
   where game_competition_id = md5('pn-cup')::uuid
     and user_id = md5('pn-user-3')::uuid;

  -- Tie 3: already settled. Nothing is due on a tie that is over.
  insert into public.bonus_cup_fixtures
      (id, competition_id, window_id, stage, round_size, bracket_slot,
       home_user_id, away_user_id, winner_user_id, decided_by, settled_at)
    values (md5('pn-tie-3')::uuid, md5('pn-cup')::uuid, md5('pn-win')::uuid,
            'knockout', 4, 3, md5('pn-user-5')::uuid, md5('pn-user-6')::uuid,
            md5('pn-user-5')::uuid, 'points', now());
end $$;

-- ---------------------------------------------------------------------------
-- Generation.
-- ---------------------------------------------------------------------------

select is(
  predictor_internal.generate_cup_penalty_number_actions(now()),
  3,
  'one item per contestable side: both of tie 1, the eligible side of tie 2, neither of the settled tie');

select is(
  (select count(*)::integer from public.player_action_items
    where action_type = 'cup_penalty_number_due'
      and user_id in (md5('pn-user-1')::uuid, md5('pn-user-2')::uuid)),
  2,
  'both sides of an open tie are told');

select is(
  (select count(*)::integer from public.player_action_items
    where action_type = 'cup_penalty_number_due'
      and user_id = md5('pn-user-3')::uuid),
  0,
  'a disqualified entrant is not asked for a number they cannot use');

select is(
  (select count(*)::integer from public.player_action_items
    where action_type = 'cup_penalty_number_due'
      and user_id = md5('pn-user-4')::uuid),
  1,
  'and their eligible opponent still is');

select is(
  (select count(*)::integer from public.player_action_items
    where action_type = 'cup_penalty_number_due'
      and user_id in (md5('pn-user-5')::uuid, md5('pn-user-6')::uuid)),
  0,
  'a settled tie is history rather than an action');

select is(
  (select priority::integer from public.player_action_items
    where user_id = md5('pn-user-1')::uuid
      and action_type = 'cup_penalty_number_due'),
  1,
  'it carries the elimination priority rather than the points one');

-- The deadline is the FIRST KICKOFF, not the window lock. Those differ here by
-- four hours, so a copy of the wrong one would be visible.
select is(
  (select deadline_at from public.player_action_items
    where user_id = md5('pn-user-1')::uuid
      and action_type = 'cup_penalty_number_due'),
  predictor_internal.cup_window_first_kickoff(md5('pn-win')::uuid),
  'the deadline is the derived first kickoff');

select isnt(
  (select deadline_at from public.player_action_items
    where user_id = md5('pn-user-1')::uuid
      and action_type = 'cup_penalty_number_due'),
  (select locks_at from public.bonus_competition_windows where id = md5('pn-win')::uuid),
  'and is not the window lock, which is earlier by the game definition''s buffer');

select is(
  (select context ->> 'lane' from public.player_action_items
    where user_id = md5('pn-user-1')::uuid
      and action_type = 'cup_penalty_number_due'),
  'odd',
  'the home side is told their lane is ODD, as section 8.3 fixed it');

select is(
  (select context ->> 'lane' from public.player_action_items
    where user_id = md5('pn-user-2')::uuid
      and action_type = 'cup_penalty_number_due'),
  'even',
  'and the away side EVEN');

-- Nothing about the opponent. Contract 193 withholds even WHETHER they have
-- submitted, and this must not become the surface that gives it away.
select is(
  (select count(*)::integer from public.player_action_items
    where action_type = 'cup_penalty_number_due'
      and (context::text like '%pn-user%'
        or context ? 'opponent_user_id'
        or context ? 'opponent_submitted')),
  0,
  'the item names no opponent and reports no opponent state');

-- ---------------------------------------------------------------------------
-- THE ASSERTION THIS FILE EXISTS FOR.
-- ---------------------------------------------------------------------------

select cmp_ok(
  (select locks_at from public.bonus_competition_windows where id = md5('pn-win')::uuid),
  '<=',
  now(),
  'the window really has already locked, so the sweep has something to get wrong');

select is(
  predictor_internal.invalidate_expired_actions(now()),
  0,
  'a locked window does not close a Penalty Number that is still legal to submit');

select is(
  (select count(*)::integer from public.player_action_items
    where action_type = 'cup_penalty_number_due' and invalidated_at is not null),
  0,
  'and every item is still open');

-- ---------------------------------------------------------------------------
-- Completion, through the real write path.
-- ---------------------------------------------------------------------------

select set_config('request.jwt.claims',
  json_build_object('sub', md5('pn-user-1')::uuid, 'role', 'authenticated')::text, true);
set local role authenticated;

select lives_ok(
  format('select public.submit_cup_penalty_number(%L::uuid, %L::uuid, 7::smallint, null)',
         md5('pn-cup')::uuid, md5('pn-win')::uuid),
  'the write authority accepts a number after the window lock, which is the whole point');

reset role;
select set_config('request.jwt.claims', '', true);

select is(
  predictor_internal.generate_cup_penalty_number_actions(now()),
  1,
  'regeneration writes only the row that changed');

select is(
  (select count(*)::integer from public.player_action_items
    where user_id = md5('pn-user-1')::uuid
      and action_type = 'cup_penalty_number_due'
      and completed_at is not null),
  1,
  'a submitted Penalty Number completes the item');

-- Editing is not undoing. The number may be changed until the kickoff.
update public.bonus_cup_penalty_numbers
   set value = 9, version = version + 1, updated_at = now()
 where window_id = md5('pn-win')::uuid and user_id = md5('pn-user-1')::uuid;

select is(
  (select count(*)::integer from public.player_action_items
    where user_id = md5('pn-user-1')::uuid
      and action_type = 'cup_penalty_number_due'
      and completed_at is not null),
  1,
  'and editing it does not reopen the item');

select is(
  predictor_internal.generate_cup_penalty_number_actions(now()),
  0,
  'a run that changes nothing writes nothing, so updated_at does not churn');

-- ---------------------------------------------------------------------------
-- The vocabulary and the driver agree, which contract 170 could not say.
-- ---------------------------------------------------------------------------

select is(
  (select count(*)::integer
     from unnest(array['matchweek_predictions_due', 'lms_pick_due',
                       'cup_penalty_number_due', 'matchweek_settled'])
            as declared(action_type)
    where not exists (
      select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
       where n.nspname = 'predictor_internal'
         and p.proname like 'generate%actions'
         and p.prosrc like '%''' || declared.action_type || '''%')),
  0,
  'every deadline-shaped action type now has a generator, which contract 170 could not say');

select ok(
  (select public.process_player_action_items()) ? 'cup_penalty_number_actions_written',
  'and the driver reports what it wrote, so an operator sees the generator ran');

select * from finish();
rollback;
