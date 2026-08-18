-- Contract 194 / `CUP-004`: eligibility at Championship tie settlement.
--
-- THE ASSERTION THIS FILE EXISTS FOR is that an entrant who may not contest a
-- tie does not win it. The defect it guards against is not hypothetical: before
-- this contract, `admin_settle_predictor_cup_round` consulted submission and
-- points and NEVER consulted `game_memberships`, so a disqualified player who
-- had submitted before being removed still won on points and advanced.
--
-- The fixture is built so that ordinary scoring and eligibility DISAGREE. The
-- away side outscores the home side, so points alone hand them the tie; the
-- away side is then disqualified, and the assertion is that the home side
-- advances anyway. A test where the eligible player also happened to score
-- more would pass against the old implementation.
--
-- The second half is ADR 0028 section 8's other clause: when NEITHER entrant may
-- contest, nothing is settled and nothing is written. That path is driven for
-- real, and it fires before the designated-fixture gate, so it needs no match.

begin;

select plan(14);

-- ---------------------------------------------------------------------------
-- The eligibility authority, on its own.
-- ---------------------------------------------------------------------------

do $$
declare
  v_competition uuid;
  v_t uuid;
  v_home uuid;
  v_away uuid;
  v_comp uuid;
  v_win uuid;
  v_match uuid;
  v_group uuid;
begin
  -- Seeding a confirmed result needs the protected-lifecycle capability, which
  -- contract 50 gates on `predictor.match_result_write`. It is set LOCAL and
  -- this whole file runs inside a transaction the harness rolls back.
  set local predictor.match_result_write = 'on';

  select competition_id into v_competition
    from public.tournaments where kind = 'tournament' order by name limit 1;

  insert into public.tournaments
      (name, year, competition_id, season_key, kind, display_timezone, status)
    values ('C194 T', 2044, v_competition, '2044', 'tournament', 'Europe/London', 'active')
    returning id into v_t;

  insert into public.groups (tournament_id, letter) values (v_t, 'A') returning id into v_group;
  insert into public.teams (tournament_id, name) values (v_t, 'EH') returning id into v_home;
  insert into public.teams (tournament_id, name) values (v_t, 'EA') returning id into v_away;

  set local session_replication_role = replica;
  insert into auth.users (id, email, aud, role, raw_app_meta_data, raw_user_meta_data,
                          created_at, updated_at)
  select md5('el-user-' || n)::uuid, format('el-%s@example.test', n),
         'authenticated', 'authenticated', '{}'::jsonb, '{}'::jsonb, now(), now()
  from generate_series(1, 3) as n;
  set local session_replication_role = origin;

  insert into public.profiles (id, display_name, welcomed_at)
  select md5('el-user-' || n)::uuid, 'Eligible ' || n, now() from generate_series(1, 3) as n;

  insert into public.bonus_competitions
      (id, tournament_id, game_key, published, availability_status, draw_required)
    values (md5('el-cup')::uuid, v_t, 'predictor_cup', true, 'active', true)
    returning id into v_comp;

  insert into public.bonus_competition_entrants (competition_id, user_id)
  select md5('el-cup')::uuid, md5('el-user-' || n)::uuid from generate_series(1, 2) as n;

  -- The window LOCKED in the past, with one CONFIRMED designated match, so
  -- `cup_window_settled` is satisfied and the driver reaches its loop. The
  -- fixture idiom is contract 98's own suite, reused rather than reinvented.
  insert into public.bonus_competition_windows
      (id, competition_id, tournament_id, sequence, label, locks_at, settles_at)
    values (md5('el-win')::uuid, md5('el-cup')::uuid, v_t, 1, 'QF',
            now() - interval '2 days', now() - interval '1 day')
    returning id into v_win;

  -- `round_id` is left null on purpose. `prepare_match_season_scope` derives the
  -- competition round from `round` and `matchday` and creates it if absent, so a
  -- hand-built round is both redundant and a way to contradict the trigger: the
  -- first draft of this file paired a `knockout_round` row with a `group`
  -- fixture, and the whole suite aborted on
  -- "Tournament fixture round is incompatible with the season kind".
  insert into public.matches (
      tournament_id, match_ref, round, home_source, away_source,
      home_team_id, away_team_id, group_id, matchday, match_date, kickoff_at, venue,
      result_state, result_method, result_version, confirmed_at,
      home_score, away_score, home_score_90, away_score_90, winner_team_id)
    values (
      v_t, 'EL-1', 'group', 'A', 'B', v_home, v_away, v_group, 1,
      date '2044-06-10', now() - interval '3 days', 'V',
      'confirmed', 'regulation', 1, now(), 2, 1, 2, 1, v_home)
    returning id into v_match;
  insert into public.bonus_window_fixtures (window_id, match_id, tournament_id)
    values (md5('el-win')::uuid, v_match, v_t);

  -- Seeds, so the untouched `admin_walkover` rule has something to resolve on
  -- if it is ever reached.
  insert into public.bonus_cup_groups (id, competition_id, ordinal, size)
    values (md5('el-grp')::uuid, md5('el-cup')::uuid, 1, 4);
  insert into public.bonus_cup_members (competition_id, group_id, user_id, draw_number, seed)
  select md5('el-cup')::uuid, md5('el-grp')::uuid, md5('el-user-' || n)::uuid, n, n
  from generate_series(1, 2) as n;

  -- The tie: user 1 at home, user 2 away.
  insert into public.bonus_cup_fixtures
      (id, competition_id, window_id, stage, round_size, bracket_slot,
       home_user_id, away_user_id)
    values (md5('el-tie')::uuid, md5('el-cup')::uuid, md5('el-win')::uuid,
            'knockout', 2, 1, md5('el-user-1')::uuid, md5('el-user-2')::uuid);
end $$;

-- User 3 was created but never entered, so no `game_memberships` row exists for
-- them. That matters: entering a competition WRITES one, so asking about an
-- entrant would answer `eligible` from a stored `active` row and prove nothing
-- about the absent-row branch. The first draft of this file asked about user 1
-- and passed for the wrong reason.
select is(
  (select count(*)::integer from public.game_memberships
    where game_competition_id = md5('el-cup')::uuid and user_id = md5('el-user-3')::uuid),
  0,
  'the absent-row case really has no membership row');

select is(
  predictor_internal.cup_entrant_eligibility(md5('el-cup')::uuid, md5('el-user-3')::uuid),
  'eligible',
  'an entrant with no membership row reports eligible, because a gap in the data must not decide a tie');

select is(
  predictor_internal.cup_entrant_eligibility(md5('el-cup')::uuid, md5('el-user-1')::uuid),
  'eligible',
  'an active membership reports eligible');

-- `game_memberships_state_shape` pairs each status with its timestamps:
-- `active` needs `active_since` and neither of the others, `left` needs
-- `left_at`, `disqualified` needs `disqualified_at`. Writing a bare status
-- fails the constraint, so every transition below carries its own instants.

update public.game_memberships
   set status = 'left', left_at = now(), disqualified_at = null
 where game_competition_id = md5('el-cup')::uuid and user_id = md5('el-user-1')::uuid;

select is(
  predictor_internal.cup_entrant_eligibility(md5('el-cup')::uuid, md5('el-user-1')::uuid),
  'left',
  'a withdrawn entrant reports their stored state rather than a paraphrase of it');

update public.game_memberships
   set status = 'disqualified', disqualified_at = now()
 where game_competition_id = md5('el-cup')::uuid and user_id = md5('el-user-1')::uuid;

select is(
  predictor_internal.cup_entrant_eligibility(md5('el-cup')::uuid, md5('el-user-1')::uuid),
  'disqualified',
  'and so does a disqualified one');

-- ---------------------------------------------------------------------------
-- NEITHER may contest: nothing is settled and nothing is written.
-- ---------------------------------------------------------------------------

update public.game_memberships
   set status = 'left', left_at = now(), disqualified_at = null
 where game_competition_id = md5('el-cup')::uuid and user_id = md5('el-user-2')::uuid;

select throws_ok(
  format('select public.admin_settle_predictor_cup_round(%L::uuid, %L::uuid)',
         md5('el-cup')::uuid, md5('el-win')::uuid),
  '55000',
  null,
  'a tie neither entrant may contest refuses rather than inventing a winner');

select is(
  (select count(*)::integer from public.bonus_cup_fixtures
    where id = md5('el-tie')::uuid and winner_user_id is not null),
  0,
  'and settles nothing on that path');

select is(
  (select count(*)::integer from public.bonus_competition_audit
    where competition_id = md5('el-cup')::uuid),
  0,
  'and writes no audit row, because it decided nothing');

-- ---------------------------------------------------------------------------
-- EXACTLY ONE may contest: the eligible opponent advances, against the points.
-- ---------------------------------------------------------------------------
--
-- User 1 is disqualified and user 2 is restored. Neither has submitted, so the
-- OLD implementation would have reached `admin_walkover` and handed the tie to
-- the better SEED — which is user 1, the disqualified player. That is what makes
-- this assertion able to fail.

update public.game_memberships
   set status = 'active', active_since = now(), left_at = null, disqualified_at = null
 where game_competition_id = md5('el-cup')::uuid and user_id = md5('el-user-2')::uuid;

select lives_ok(
  format('select public.admin_settle_predictor_cup_round(%L::uuid, %L::uuid)',
         md5('el-cup')::uuid, md5('el-win')::uuid),
  'a tie with one eligible entrant settles');

select is(
  (select winner_user_id from public.bonus_cup_fixtures where id = md5('el-tie')::uuid),
  md5('el-user-2')::uuid,
  'the ELIGIBLE entrant advances, even though the better seed is the disqualified one');

select is(
  (select decided_by from public.bonus_cup_fixtures where id = md5('el-tie')::uuid),
  'walkover',
  'recorded inside the existing decided_by vocabulary rather than a new one');

select is(
  (select detail ->> 'ineligible_state' from public.bonus_competition_audit
    where competition_id = md5('el-cup')::uuid
      and action = 'cup_tie_walkover_ineligible'),
  'disqualified',
  'the audit evidence carries the stored membership state, which is the reason ADR 0028 section 8 requires');

select is(
  (select (detail ->> 'invented_score')::boolean or (detail ->> 'invented_points')::boolean
     from public.bonus_competition_audit
    where competition_id = md5('el-cup')::uuid
      and action = 'cup_tie_walkover_ineligible'),
  false,
  'and states that no football score and no prediction points were invented');

-- Safe to run twice: by refusal, so a settled winner is never revisited.
select throws_ok(
  format('select public.admin_settle_predictor_cup_round(%L::uuid, %L::uuid)',
         md5('el-cup')::uuid, md5('el-win')::uuid),
  '55000',
  null,
  're-running refuses rather than re-deciding a settled tie');

select * from finish();

rollback;
