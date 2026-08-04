-- Contract 98: the Cup RPC layer reads window match facts neutrally.
--
-- Contracts 75-77 neutralised `predictor_internal.cup_*`, and contract 76
-- asserted as a set that no shared Cup function reads a tournament relation.
-- The RPC layer above it was never in that set, and three of its functions
-- still joined `bonus_window_fixtures` to `matches` for the two facts the
-- Penalty Number rule (§8.3) needs: the regulation-time goal total and the
-- first kickoff.
--
-- For a season Cup that meant the goal total silently summed to ZERO, making a
-- Penalty Number guess of 0 exactly right, and the lock instant came back null
-- so nobody could submit one at all. Contract 98 moves both reads behind a
-- tournament limb, a season limb and a neutral combiner.
--
-- These assertions cover what a differential sweep cannot: that the neutrality
-- is structural rather than incidental, that the new functions are not exposed
-- to a browser role, and the two halves of the one redundancy this migration
-- knowingly carries.

begin;
select plan(23);

-- ---------------------------------------------------------------------------
-- STRUCTURAL: nothing above the limbs names a tournament relation.
--
-- The sweep proves the numbers agree today. It cannot notice a later edit that
-- reintroduces an inline join and happens to produce the same numbers for the
-- tournament, which is exactly how this coupling survived contracts 75-77.
-- ---------------------------------------------------------------------------

select is(
  (select count(*)::integer
     from pg_catalog.pg_proc p
     join pg_catalog.pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname in ('admin_settle_predictor_cup_round',
                        'submit_cup_penalty_number',
                        'get_my_cup')
      and (p.prosrc like '%bonus_window_fixtures%'
        or p.prosrc like '%public.matches%')),
  0,
  'no Cup RPC reads a tournament relation directly any more'
);

select is(
  (select count(*)::integer
     from pg_catalog.pg_proc p
     join pg_catalog.pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'predictor_internal'
      and p.proname in ('cup_window_goal_total', 'cup_window_first_kickoff')
      and (p.prosrc like '%bonus_window_fixtures%'
        or p.prosrc like '%public.matches%'
        or p.prosrc like '%season_cup_window_fixtures%'
        or p.prosrc like '%season_fixtures%')),
  0,
  'the neutral combiners name no relation at all — they only call their limbs'
);

select is(
  (select count(*)::integer
     from pg_catalog.pg_proc p
     join pg_catalog.pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'predictor_internal'
      and p.proname in ('cup_tournament_window_goal_total',
                        'cup_tournament_window_first_kickoff')
      and p.prosrc like '%bonus_window_fixtures%'),
  2,
  'and the tournament limbs still do read the tournament link — they are the limb'
);

select is(
  (select count(*)::integer
     from pg_catalog.pg_proc p
     join pg_catalog.pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'predictor_internal'
      and p.proname in ('cup_season_window_goal_total',
                        'cup_season_window_first_kickoff')
      and p.prosrc like '%season_cup_window_fixtures%'),
  2,
  'and the season limbs read the season link'
);

-- ---------------------------------------------------------------------------
-- PRIVILEGE: these decide a knockout tie. No browser role may call them.
-- ---------------------------------------------------------------------------

select is(
  (select count(*)::integer
     from pg_catalog.pg_proc p
     join pg_catalog.pg_namespace n on n.oid = p.pronamespace
    cross join unnest(array['anon', 'authenticated', 'service_role']) as role_name
    where n.nspname = 'predictor_internal'
      and p.proname like 'cup_%window_goal_total'
      and pg_catalog.has_function_privilege(role_name, p.oid, 'EXECUTE')),
  0,
  'no browser or service role may execute a goal-total function'
);

select is(
  (select count(*)::integer
     from pg_catalog.pg_proc p
     join pg_catalog.pg_namespace n on n.oid = p.pronamespace
    cross join unnest(array['anon', 'authenticated', 'service_role']) as role_name
    where n.nspname = 'predictor_internal'
      and p.proname like 'cup_%window_first_kickoff'
      and pg_catalog.has_function_privilege(role_name, p.oid, 'EXECUTE')),
  0,
  'nor a first-kickoff function'
);

select is(
  (select count(*)::integer
     from pg_catalog.pg_proc p
     join pg_catalog.pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'predictor_internal'
      and (p.proname like 'cup_%window_goal_total'
        or p.proname like 'cup_%window_first_kickoff')
      and p.provolatile = 's'
      and p.prosecdef),
  6,
  'all six are stable and security definer, matching the sources they join'
);

-- ---------------------------------------------------------------------------
-- BEHAVIOURAL. One tournament window, one season window, one carrying both.
-- ---------------------------------------------------------------------------

create temporary table c98 (label text primary key, id uuid not null) on commit drop;

do $seed$
declare
  v_competition uuid; v_t uuid; v_s uuid;
  v_group uuid; v_round_k uuid; v_round_g uuid; v_round_s uuid;
  v_home_t uuid; v_away_t uuid;
  v_home_s uuid; v_away_s uuid;
  v_home_s2 uuid; v_away_s2 uuid;
  v_home_s3 uuid; v_away_s3 uuid;
  v_home_s4 uuid; v_away_s4 uuid;
  v_comp_t uuid; v_comp_s uuid;
  v_win uuid; v_match uuid; v_fix uuid;
begin
  -- Seeding a result needs the protected-lifecycle flag; this whole file runs
  -- inside a transaction the harness rolls back.
  set local predictor.match_result_write = 'on';

  insert into public.competitions (slug, name, sport)
    values ('c98', 'C98', 'football') returning id into v_competition;
  insert into public.tournaments
      (name, year, competition_id, season_key, kind, display_timezone, status)
    values ('C98 T', 2028, v_competition, '2028', 'tournament', 'Europe/London', 'active')
    returning id into v_t;
  insert into public.tournaments
      (name, year, competition_id, season_key, kind, display_timezone, status)
    values ('C98 S', 2026, v_competition, '2026-27', 'league_season', 'Europe/London', 'active')
    returning id into v_s;

  insert into public.groups (tournament_id, letter) values (v_t, 'A') returning id into v_group;
  insert into public.competition_rounds (tournament_id, round_key, ordinal, kind, label)
    values (v_t, 'g', 1, 'group_matchday', 'G') returning id into v_round_g;
  insert into public.competition_rounds (tournament_id, round_key, ordinal, kind, label)
    values (v_t, 'qf', 2, 'knockout_round', 'QF') returning id into v_round_k;
  insert into public.competition_rounds (tournament_id, round_key, ordinal, kind, label)
    values (v_s, 'mw', 1, 'league_matchweek', 'MW') returning id into v_round_s;

  insert into public.teams (tournament_id, name) values (v_t, 'TH') returning id into v_home_t;
  insert into public.teams (tournament_id, name) values (v_t, 'TA') returning id into v_away_t;
  -- Three club pairs: `assert_season_fixture_shape` allows a club at most one
  -- fixture per matchweek, and all three season fixtures below sit in one.
  insert into public.teams (tournament_id, name) values (v_s, 'SH') returning id into v_home_s;
  insert into public.teams (tournament_id, name) values (v_s, 'SA') returning id into v_away_s;
  insert into public.teams (tournament_id, name) values (v_s, 'SH2') returning id into v_home_s2;
  insert into public.teams (tournament_id, name) values (v_s, 'SA2') returning id into v_away_s2;
  insert into public.teams (tournament_id, name) values (v_s, 'SH3') returning id into v_home_s3;
  insert into public.teams (tournament_id, name) values (v_s, 'SA3') returning id into v_away_s3;
  -- A fourth pair, unused by any fixture, so the redundancy probe below is
  -- refused by the CHECK it is aiming at rather than by club uniqueness.
  insert into public.teams (tournament_id, name) values (v_s, 'SH4') returning id into v_home_s4;
  insert into public.teams (tournament_id, name) values (v_s, 'SA4') returning id into v_away_s4;

  insert into public.bonus_competitions
      (tournament_id, game_key, published, availability_status)
    values (v_t, 'predictor_cup', true, 'active') returning id into v_comp_t;
  insert into public.bonus_competitions
      (tournament_id, game_key, published, availability_status)
    values (v_s, 'predictor_cup', true, 'active') returning id into v_comp_s;

  -- (1) Tournament window: one group match 2-1 and one extra-time knockout
  -- that finished 1-1 after ninety and 3-1 after extra time. Regulation goals
  -- are 3 + 2 = 5; summing the FINAL scores would give 3 + 4 = 7. The two
  -- differ, which is the whole point of the `case` in the tournament limb.
  insert into public.bonus_competition_windows (competition_id, tournament_id, sequence, label)
    values (v_comp_t, v_t, 1, 'T') returning id into v_win;
  insert into c98 values ('tournament', v_win);

  insert into public.matches (
      tournament_id, round_id, match_ref, round, home_source, away_source,
      home_team_id, away_team_id, group_id, matchday, match_date, kickoff_at, venue,
      result_state, result_method, result_version, confirmed_at,
      home_score, away_score, home_score_90, away_score_90, winner_team_id)
    values (
      v_t, v_round_g, 'T-G', 'group', 'A', 'B', v_home_t, v_away_t, v_group, 1,
      date '2028-06-10', timestamptz '2028-06-10 18:00Z', 'V',
      'confirmed', 'regulation', 1, now(), 2, 1, 2, 1, v_home_t)
    returning id into v_match;
  insert into public.bonus_window_fixtures (window_id, match_id, tournament_id)
    values (v_win, v_match, v_t);

  insert into public.matches (
      tournament_id, round_id, match_ref, round, home_source, away_source,
      home_team_id, away_team_id, match_date, kickoff_at, venue,
      result_state, result_method, result_version, confirmed_at,
      home_score, away_score, home_score_90, away_score_90,
      home_score_120, away_score_120, winner_team_id)
    values (
      v_t, v_round_k, 'T-K', 'qf', 'A', 'B', v_home_t, v_away_t,
      date '2028-06-12', timestamptz '2028-06-12 20:00Z', 'V',
      'confirmed', 'extra_time', 1, now(), 3, 1, 1, 1, 3, 1, v_home_t)
    returning id into v_match;
  insert into public.bonus_window_fixtures (window_id, match_id, tournament_id)
    values (v_win, v_match, v_t);

  -- (2) Season window: a played 2-2 plus a void fixture carrying no score.
  insert into public.bonus_competition_windows (competition_id, tournament_id, sequence, label)
    values (v_comp_s, v_s, 1, 'S') returning id into v_win;
  insert into c98 values ('season', v_win);

  insert into public.season_fixtures (
      tournament_id, competition_round_id, home_team_id, away_team_id,
      kickoff_at, status, home_score, away_score)
    values (v_s, v_round_s, v_home_s, v_away_s,
            timestamptz '2028-09-01 14:00Z', 'played', 2, 2)
    returning id into v_fix;
  insert into public.season_cup_window_fixtures (window_id, season_fixture_id) values (v_win, v_fix);

  insert into public.season_fixtures (
      tournament_id, competition_round_id, home_team_id, away_team_id,
      kickoff_at, status)
    values (v_s, v_round_s, v_home_s2, v_away_s2,
            timestamptz '2028-08-30 12:00Z', 'void')
    returning id into v_fix;
  insert into public.season_cup_window_fixtures (window_id, season_fixture_id) values (v_win, v_fix);

  -- (3) Mixed window: a tournament match and a season fixture on one window,
  -- with the SEASON fixture kicking off first. Nothing forbids this, and
  -- contract 77 unions rather than branching precisely so it is one case.
  insert into public.bonus_competition_windows (competition_id, tournament_id, sequence, label)
    values (v_comp_t, v_t, 2, 'M') returning id into v_win;
  insert into c98 values ('mixed', v_win);

  insert into public.matches (
      tournament_id, round_id, match_ref, round, home_source, away_source,
      home_team_id, away_team_id, match_date, kickoff_at, venue,
      result_state, result_method, result_version, confirmed_at,
      home_score, away_score, home_score_90, away_score_90, winner_team_id)
    values (
      v_t, v_round_k, 'M-K', 'qf', 'A', 'B', v_home_t, v_away_t,
      date '2028-07-01', timestamptz '2028-07-01 19:00Z', 'V',
      'confirmed', 'regulation', 1, now(), 4, 0, 4, 0, v_home_t)
    returning id into v_match;
  insert into public.bonus_window_fixtures (window_id, match_id, tournament_id)
    values (v_win, v_match, v_t);

  insert into public.season_fixtures (
      tournament_id, competition_round_id, home_team_id, away_team_id,
      kickoff_at, status, home_score, away_score)
    values (v_s, v_round_s, v_home_s3, v_away_s3,
            timestamptz '2028-06-30 11:00Z', 'played', 1, 0)
    returning id into v_fix;
  insert into public.season_cup_window_fixtures (window_id, season_fixture_id) values (v_win, v_fix);

  -- (4) An empty window: neither limb has anything.
  insert into public.bonus_competition_windows (competition_id, tournament_id, sequence, label)
    values (v_comp_t, v_t, 3, 'E') returning id into v_win;
  insert into c98 values ('empty', v_win);

  -- Handles the redundancy probe needs, since it cannot declare variables.
  insert into c98 values ('season_tournament', v_s), ('season_round', v_round_s),
                         ('spare_home', v_home_s4), ('spare_away', v_away_s4);
end
$seed$;

select is(
  predictor_internal.cup_window_goal_total((select id from c98 where label = 'tournament')),
  5,
  'tournament total counts REGULATION goals: 3 from the group match and 2 from ninety minutes of the extra-time tie'
);

select is(
  predictor_internal.cup_tournament_window_goal_total((select id from c98 where label = 'tournament')),
  5,
  'and the limb alone gives the same, so the combiner adds nothing to a tournament window'
);

select is(
  predictor_internal.cup_season_window_goal_total((select id from c98 where label = 'tournament')),
  0,
  'the season limb contributes zero to a tournament window rather than erroring'
);

select is(
  predictor_internal.cup_window_goal_total((select id from c98 where label = 'season')),
  4,
  'season total is 4 — the played 2-2. This is the number that was silently ZERO before contract 98'
);

select is(
  predictor_internal.cup_window_goal_total((select id from c98 where label = 'mixed')),
  5,
  'a window served by both limbs adds them: 4 from the tournament tie and 1 from the season fixture'
);

select is(
  predictor_internal.cup_window_goal_total((select id from c98 where label = 'empty')),
  0,
  'an empty window totals zero, not null — `coalesce` on both limbs'
);

select is(
  predictor_internal.cup_window_first_kickoff((select id from c98 where label = 'tournament')),
  timestamptz '2028-06-10 18:00Z',
  'tournament first kickoff is the earlier of its two matches'
);

select is(
  predictor_internal.cup_window_first_kickoff((select id from c98 where label = 'season')),
  timestamptz '2028-08-30 12:00Z',
  'season first kickoff counts a VOID fixture — the kickoff limb filters on status deliberately, unlike the goal limb'
);

select is(
  predictor_internal.cup_window_first_kickoff((select id from c98 where label = 'mixed')),
  timestamptz '2028-06-30 11:00Z',
  'a mixed window takes the EARLIER of the two limbs — `greatest` here would lock the Penalty Number after the round had started'
);

select is(
  predictor_internal.cup_window_first_kickoff((select id from c98 where label = 'empty')),
  null::timestamptz,
  'an empty window has no kickoff, so the Penalty Number stays refused — fail closed'
);

-- ---------------------------------------------------------------------------
-- THE ONE REDUNDANCY THIS MIGRATION KNOWINGLY CARRIES.
--
-- `cup_season_window_goal_total` filters `status = 'played'`. Dropping that
-- filter changes no result today, and a differential sweep over 700 windows
-- confirms it: the mutant is equivalent. It is kept as a statement of the rule
-- at the point that depends on it rather than borrowed from a CHECK three
-- migrations away.
--
-- Both halves are pinned so the claim cannot quietly become false:
--   * the constraint that makes it redundant still refuses the row;
--   * and a non-played fixture contributes nothing, which is the behaviour
--     the filter would provide if the constraint ever stopped.
-- ---------------------------------------------------------------------------

select throws_ok(
  $$insert into public.season_fixtures (
      tournament_id, competition_round_id, home_team_id, away_team_id,
      kickoff_at, status, home_score, away_score)
    select (select id from c98 where label = 'season_tournament'),
           (select id from c98 where label = 'season_round'),
           (select id from c98 where label = 'spare_home'),
           (select id from c98 where label = 'spare_away'),
           timestamptz '2028-09-09 12:00Z', 'abandoned', 3, 3$$,
  '23514',
  null,
  'an abandoned fixture may not carry a score at all — `season_fixtures_scores_match_status` is what makes the played filter redundant'
);

select is(
  predictor_internal.cup_season_window_goal_total((select id from c98 where label = 'season')),
  4,
  'and the void fixture on that window contributes nothing, filter or no filter'
);

-- ---------------------------------------------------------------------------
-- The RPCs still refuse what they refused. Contract 98 moved a read; it did
-- not open a door.
-- ---------------------------------------------------------------------------

select throws_ok(
  format(
    $$select public.admin_settle_predictor_cup_round(%L::uuid, %L::uuid)$$,
    (select bc.id from public.bonus_competitions bc
      join c98 on c98.label = 'tournament'
      join public.bonus_competition_windows w on w.id = c98.id and w.competition_id = bc.id),
    (select id from c98 where label = 'tournament')),
  'P0002',
  null,
  'settling a window with no knockout ties still refuses with no_data_found'
);

select is(
  (select count(*)::integer
     from pg_catalog.pg_proc p
     join pg_catalog.pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname = 'get_my_cup'
      and p.prosrc like '%cup_window_first_kickoff%'),
  1,
  'get_my_cup reads the neutral kickoff, so a season entrant sees a lock instant rather than null'
);

select is(
  (select count(*)::integer
     from pg_catalog.pg_proc p
     join pg_catalog.pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname = 'submit_cup_penalty_number'
      and p.prosrc like '%cup_window_first_kickoff%'),
  1,
  'and so does submit_cup_penalty_number, which refused every season submission before'
);

select is(
  (select count(*)::integer
     from pg_catalog.pg_proc p
     join pg_catalog.pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname = 'admin_settle_predictor_cup_round'
      and p.prosrc like '%cup_window_goal_total%'),
  1,
  'and admin_settle_predictor_cup_round takes the Penalty Number target from the neutral total'
);

select * from finish();
rollback;
