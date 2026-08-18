-- Contract 196: a player is told what happened to them in a game.
--
-- THE TWO ASSERTIONS THIS FILE EXISTS FOR:
--
--   1. A Championship elimination DATES ITSELF. Before this contract,
--      `admin_settle_predictor_cup_round` wrote `outcome = 'eliminated'` and
--      left `updated_at` at whenever the row was last touched for some other
--      reason, while the Last Man Standing and disqualification paths both set
--      it. The tie below is settled through the real driver and the stored
--      instant is compared against the settlement, so a repair that stopped
--      working would fail here rather than in a comment.
--
--   2. A REVERSED outcome closes its own recap. `recompute_lms_for_tournament`
--      exists so a rescore can move an outcome, and it can move it back. A recap
--      of an elimination that has since been reversed is wrong rather than
--      stale, and the sweep's fourth re-read is what closes it. That is driven
--      here rather than described.

begin;

select plan(17);

do $$
declare
  v_competition uuid;
  v_t uuid;
  v_home uuid;
  v_away uuid;
  v_group uuid;
  v_match uuid;
begin
  set local predictor.match_result_write = 'on';

  select competition_id into v_competition
    from public.tournaments where kind = 'tournament' order by name limit 1;

  insert into public.tournaments
      (name, year, competition_id, season_key, kind, display_timezone, status)
    values ('C196 T', 2046, v_competition, '2046', 'tournament', 'Europe/London', 'active')
    returning id into v_t;

  insert into public.groups (tournament_id, letter) values (v_t, 'A') returning id into v_group;
  insert into public.teams (tournament_id, name) values (v_t, 'GH') returning id into v_home;
  insert into public.teams (tournament_id, name) values (v_t, 'GA') returning id into v_away;

  set local session_replication_role = replica;
  insert into auth.users (id, email, aud, role, raw_app_meta_data, raw_user_meta_data,
                          created_at, updated_at)
  select md5('gc-user-' || n)::uuid, format('gc-%s@example.test', n),
         'authenticated', 'authenticated', '{}'::jsonb, '{}'::jsonb, now(), now()
  from generate_series(1, 3) as n;
  set local session_replication_role = origin;

  insert into public.profiles (id, display_name, welcomed_at)
  select md5('gc-user-' || n)::uuid, 'Consequence ' || n, now() from generate_series(1, 3) as n;

  insert into public.bonus_competitions
      (id, tournament_id, game_key, published, availability_status, draw_required)
    values (md5('gc-cup')::uuid, v_t, 'predictor_cup', true, 'active', true);

  insert into public.bonus_competition_entrants (competition_id, user_id)
  select md5('gc-cup')::uuid, md5('gc-user-' || n)::uuid from generate_series(1, 3) as n;

  -- A locked window with one confirmed designated match, so the settlement
  -- driver reaches its loop. Contract 98's own fixture idiom.
  insert into public.bonus_competition_windows
      (id, competition_id, tournament_id, sequence, label, locks_at, settles_at)
    values (md5('gc-win')::uuid, md5('gc-cup')::uuid, v_t, 1, 'QF',
            now() - interval '2 days', now() - interval '1 day');

  insert into public.matches (
      tournament_id, match_ref, round, home_source, away_source,
      home_team_id, away_team_id, group_id, matchday, match_date, kickoff_at, venue,
      result_state, result_method, result_version, confirmed_at,
      home_score, away_score, home_score_90, away_score_90, winner_team_id)
    values (
      v_t, 'GC-1', 'group', 'A', 'B', v_home, v_away, v_group, 1,
      date '2046-06-10', now() - interval '3 days', 'V',
      'confirmed', 'regulation', 1, now(), 2, 1, 2, 1, v_home)
    returning id into v_match;
  insert into public.bonus_window_fixtures (window_id, match_id, tournament_id)
    values (md5('gc-win')::uuid, v_match, v_t);

  insert into public.bonus_cup_groups (id, competition_id, ordinal, size)
    values (md5('gc-grp')::uuid, md5('gc-cup')::uuid, 1, 4);
  insert into public.bonus_cup_members (competition_id, group_id, user_id, draw_number, seed)
  select md5('gc-cup')::uuid, md5('gc-grp')::uuid, md5('gc-user-' || n)::uuid, n, n
  from generate_series(1, 3) as n;

  -- `round_size` 2 makes this the FINAL, so settling it crowns a champion and
  -- eliminates the loser without needing a next window to progress into -- and
  -- it exercises both consequence outcomes in one settlement. Neither side
  -- submitted, so the untouched `admin_walkover` rule decides it on seed: user 1
  -- wins and user 2 is eliminated. The rule is not the subject here; the DATE it
  -- writes is.
  insert into public.bonus_cup_fixtures
      (id, competition_id, window_id, stage, round_size, bracket_slot,
       home_user_id, away_user_id)
    values (md5('gc-tie')::uuid, md5('gc-cup')::uuid, md5('gc-win')::uuid,
            'knockout', 2, 1, md5('gc-user-1')::uuid, md5('gc-user-2')::uuid);

  -- BACK-DATE the two entrants who are about to be settled. Without this their
  -- rows were inserted seconds ago, so a `updated_at` the settlement never
  -- touched would still be inside the seven-day window and the date assertion
  -- below would pass against an unrepaired driver. Mutating the repair proved
  -- exactly that, which is why the back-dating is here.
  update public.bonus_competition_entrants
     set updated_at = now() - interval '30 days'
   where competition_id = md5('gc-cup')::uuid
     and user_id in (md5('gc-user-1')::uuid, md5('gc-user-2')::uuid);

  -- User 3's outcome predates the window this generator reads, so it proves the
  -- backlog bound rather than being swept up with everything else.
  update public.bonus_competition_entrants
     set outcome = 'eliminated', updated_at = now() - interval '30 days'
   where competition_id = md5('gc-cup')::uuid and user_id = md5('gc-user-3')::uuid;
end $$;

-- ---------------------------------------------------------------------------
-- 1. The repair, measured through the real settlement driver.
-- ---------------------------------------------------------------------------

select lives_ok(
  format('select public.admin_settle_predictor_cup_round(%L::uuid, %L::uuid)',
         md5('gc-cup')::uuid, md5('gc-win')::uuid),
  'the tie settles');

select is(
  (select outcome from public.bonus_competition_entrants
    where competition_id = md5('gc-cup')::uuid and user_id = md5('gc-user-2')::uuid),
  'eliminated',
  'the beaten entrant is eliminated');

select cmp_ok(
  (select updated_at from public.bonus_competition_entrants
    where competition_id = md5('gc-cup')::uuid and user_id = md5('gc-user-2')::uuid),
  '>',
  now() - interval '1 minute',
  'and the elimination DATES ITSELF, which before this contract it did not');

-- ---------------------------------------------------------------------------
-- 2. Generation.
-- ---------------------------------------------------------------------------

select is(
  predictor_internal.generate_game_consequence_actions(now()),
  2,
  'one item per consequence inside the seven-day window, and only those');

select is(
  (select context ->> 'outcome' from public.player_action_items
    where action_type = 'game_consequence' and user_id = md5('gc-user-1')::uuid),
  'champion',
  'the winner is told they won it');

select is(
  (select count(*)::integer from public.player_action_items
    where action_type = 'game_consequence' and user_id = md5('gc-user-3')::uuid),
  0,
  'a consequence older than the window is not posted, so enabling this never floods an inbox');

select is(
  (select context ->> 'outcome' from public.player_action_items
    where action_type = 'game_consequence' and user_id = md5('gc-user-2')::uuid),
  'eliminated',
  'the item says what happened');

select is(
  (select priority::integer from public.player_action_items
    where action_type = 'game_consequence' and user_id = md5('gc-user-2')::uuid),
  5,
  'at the lowest priority, because nothing that merely happened outranks something due');

select ok(
  (select deadline_at is null from public.player_action_items
    where action_type = 'game_consequence' and user_id = md5('gc-user-2')::uuid),
  'with no deadline, which is what keeps it out of the reminder scheduler');

select is(
  (select expires_at from public.player_action_items
    where action_type = 'game_consequence' and user_id = md5('gc-user-2')::uuid),
  (select updated_at + interval '7 days' from public.bonus_competition_entrants
    where competition_id = md5('gc-cup')::uuid and user_id = md5('gc-user-2')::uuid),
  'expiring seven days after the consequence rather than seven days after the job ran');

select is(
  (select context ->> 'disqualified' from public.player_action_items
    where action_type = 'game_consequence' and user_id = md5('gc-user-2')::uuid),
  'false',
  'and says they were beaten rather than removed');

select is(
  predictor_internal.generate_game_consequence_actions(now()),
  0,
  'a second run writes nothing, so updated_at does not churn');

-- Removed is a different sentence to beaten, and the platform knows which.
insert into public.game_memberships
    (tournament_id, game_competition_id, user_id, status, disqualified_at)
select tournament_id, md5('gc-cup')::uuid, md5('gc-user-2')::uuid, 'disqualified', now()
  from public.bonus_competitions where id = md5('gc-cup')::uuid
on conflict (game_competition_id, user_id) do update
  set status = 'disqualified', disqualified_at = now(), left_at = null, active_since = null;

select is(
  predictor_internal.generate_game_consequence_actions(now()),
  1,
  'the reason is re-read rather than frozen at first generation');

select is(
  (select context ->> 'disqualified' from public.player_action_items
    where action_type = 'game_consequence' and user_id = md5('gc-user-2')::uuid),
  'true',
  'and a removed entrant is told they were removed');

-- ---------------------------------------------------------------------------
-- 3. THE ASSERTION THIS FILE EXISTS FOR. A reversed outcome closes its recap.
-- ---------------------------------------------------------------------------

select is(
  predictor_internal.invalidate_expired_actions(now()),
  0,
  'a live consequence is not closed while it is still true');

update public.bonus_competition_entrants
   set outcome = 'survived', updated_at = now()
 where competition_id = md5('gc-cup')::uuid and user_id = md5('gc-user-2')::uuid;

select is(
  predictor_internal.invalidate_expired_actions(now()),
  1,
  'a rescore that reverses an elimination closes the recap that said otherwise');

select ok(
  (select invalidated_at is not null from public.player_action_items
    where action_type = 'game_consequence' and user_id = md5('gc-user-2')::uuid),
  'and the item is closed rather than left saying something untrue');

select * from finish();
rollback;
