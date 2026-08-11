-- Contract 169: a season Championship group table measured over the season.
--
-- THE ASSERTION THIS FILE EXISTS FOR is that the GROUP WINNER CHANGES. The
-- delivered table breaks a tie on prediction points earned in matchdays one to
-- three — the tournament's whole group stage, hard-coded — and a season group
-- stage runs to thirty-eight. The group winner decides qualification and
-- seeding, so this was never a display defect.
--
-- The field below is engineered so that the tie-break decides everything and
-- the two spans disagree about it:
--
--     player  table_points  points over MD1-3  points over MD1-6
--     A                 15                 30                 39
--     B                 15                 18                 48
--
-- A and B are LEVEL on the primary key. Over the first three matchdays A leads
-- by twelve; over the six actually played B leads by nine. So the delivered
-- table makes A the group winner and the season table makes B, from the same
-- rows, with nothing between them but the span.
--
-- The second assertion is that an UNSETTLED matchday contributes to neither
-- key, which is contract 105's rule and not the delivered function's: that one
-- sums windows 1-3 whether or not they settled, while taking table points only
-- from settled fixtures. Across three fixed matchdays the gap is invisible.
--
-- The third is that the TOURNAMENT table is unchanged, because a settled,
-- production-hosted authority does not move to fix a season.

begin;

select plan(13);

insert into public.tournaments (name, year, competition_id, season_key, kind, display_timezone, status)
select 'C169 Initial Table', 2054, t.competition_id, 'initial-table', 'league_season',
       'Europe/London', 'active'
  from public.tournaments t where t.kind = 'league_season' order by t.name limit 1;

select set_config('test.it_season',
  (select id::text from public.tournaments where season_key = 'initial-table'), true);

-- FOUR clubs, not two. `assert_season_fixture_shape` enforces that a club
-- plays at most once per matchweek, so two fixtures in one round need two
-- separate pairings — which is real football as well as a real constraint.
insert into public.teams (id, tournament_id, name) values
  (md5('it-t1')::uuid, current_setting('test.it_season')::uuid, 'IT Rovers'),
  (md5('it-t2')::uuid, current_setting('test.it_season')::uuid, 'IT United'),
  (md5('it-t3')::uuid, current_setting('test.it_season')::uuid, 'IT City'),
  (md5('it-t4')::uuid, current_setting('test.it_season')::uuid, 'IT Athletic');

-- SIX matchdays. Three would make the defect invisible by construction, which
-- is precisely why it survived to contract 167.
insert into public.competition_rounds (id, tournament_id, round_key, ordinal, kind, label)
select md5('it-r' || n)::uuid, current_setting('test.it_season')::uuid,
       'it-mw' || n, n, 'league_matchweek', 'Matchweek ' || n
  from generate_series(1, 6) as n;

-- Two PLAYED fixtures per matchday, both 2-1, so a player's window score can be
-- 10 (two exacts), 6 (two right outcomes), 3 (one right outcome) or 0.
insert into public.season_fixtures (
  id, tournament_id, competition_round_id, home_team_id, away_team_id,
  kickoff_at, status, home_score, away_score)
select md5('it-fx' || n || '-' || leg)::uuid, current_setting('test.it_season')::uuid,
       md5('it-r' || n)::uuid,
       case when leg = 1 then md5('it-t1')::uuid else md5('it-t3')::uuid end,
       case when leg = 1 then md5('it-t2')::uuid else md5('it-t4')::uuid end,
       now() + ((n + 1) || ' days')::interval, 'scheduled', null, null
  from generate_series(1, 6) as n, generate_series(1, 2) as leg;

set local session_replication_role = replica;
insert into auth.users (id, email, aud, role, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
select md5('it-' || who)::uuid, format('it-%s@example.test', who),
       'authenticated', 'authenticated', '{}'::jsonb, '{}'::jsonb, now(), now()
  from unnest(array['a', 'b', 'c', 'd']) as who;
set local session_replication_role = origin;

insert into public.profiles (id, display_name, welcomed_at)
select md5('it-' || who)::uuid, upper(who), now()
  from unnest(array['a', 'b', 'c', 'd']) as who;

-- `assert_entry_game_scope` requires an entry to belong to the season's Main or
-- Original Predictor, and `c1b` seeded those availability rows only for the two
-- seasons that existed when it ran.
insert into public.bonus_competitions (
  id, tournament_id, game_key, published, availability_status,
  draw_required, visibility_kind, registration_opens_at)
values (md5('it-mp')::uuid, current_setting('test.it_season')::uuid, 'main_predictor',
        true, 'active', false, 'public', now() - interval '60 days');

insert into public.entries (id, user_id, tournament_id, game_competition_id)
select md5('it-e-' || who)::uuid, md5('it-' || who)::uuid,
       current_setting('test.it_season')::uuid, md5('it-mp')::uuid
  from unnest(array['a', 'b', 'c', 'd']) as who;

-- The predictions that produce the table above. An exact 2-1 scores 5, a 3-1
-- scores 3 for the outcome, and a 0-1 scores nothing.
--
--   A: both exact in MD1-3 (10), one right outcome in MD4-6 (3)
--   B: both right outcomes in MD1-3 (6), both exact in MD4-6 (10)
--   C and D: one right outcome in MD1-3 (3), nothing in MD4-6 (0)
insert into public.season_predictions (tournament_id, entry_id, season_fixture_id, home_score, away_score)
select current_setting('test.it_season')::uuid, md5('it-e-a')::uuid,
       md5('it-fx' || n || '-' || leg)::uuid,
       case when n <= 3 then 2 when leg = 1 then 3 else 0 end,
       case when n <= 3 then 1 when leg = 1 then 1 else 1 end
  from generate_series(1, 6) as n, generate_series(1, 2) as leg
union all
select current_setting('test.it_season')::uuid, md5('it-e-b')::uuid,
       md5('it-fx' || n || '-' || leg)::uuid,
       case when n <= 3 then 3 else 2 end, 1
  from generate_series(1, 6) as n, generate_series(1, 2) as leg
union all
select current_setting('test.it_season')::uuid, md5('it-e-' || who)::uuid,
       md5('it-fx' || n || '-' || leg)::uuid,
       case when n <= 3 and leg = 1 then 3 else 0 end, 1
  from generate_series(1, 6) as n, generate_series(1, 2) as leg,
       unnest(array['c', 'd']) as who;

-- The predictions are in. NOW the matchweeks lock and the results land, with
-- replication role `replica` so the fixture's own reschedule and result
-- triggers do not treat this as provider activity — contract 119's rescheduled
-- lock and contract 125's result path are not what this file is testing.
set local session_replication_role = replica;
update public.season_fixtures
   set kickoff_at = now() - ((40 - ordinal) || ' days')::interval,
       status = 'played', home_score = 2, away_score = 1
  from public.competition_rounds round
 where round.id = season_fixtures.competition_round_id
   and season_fixtures.tournament_id = current_setting('test.it_season')::uuid;
set local session_replication_role = origin;

insert into public.bonus_competitions (
  id, tournament_id, game_key, published, availability_status,
  draw_required, visibility_kind, registration_opens_at)
values (md5('it-cup')::uuid, current_setting('test.it_season')::uuid, 'predictor_cup',
        true, 'active', true, 'public', now() - interval '60 days');

insert into public.bonus_competition_entrants (competition_id, user_id)
select md5('it-cup')::uuid, md5('it-' || who)::uuid
  from unnest(array['a', 'b', 'c', 'd']) as who;

insert into public.bonus_cup_groups (id, competition_id, ordinal, size, phase_kind)
values (md5('it-g1')::uuid, md5('it-cup')::uuid, 1, 4, 'initial');

insert into public.bonus_cup_members (competition_id, group_id, user_id, draw_number, phase_kind)
select md5('it-cup')::uuid, md5('it-g1')::uuid, md5('it-' || t.who)::uuid, t.n, 'initial'
  from unnest(array['a', 'b', 'c', 'd']) with ordinality as t(who, n);

-- Every window has locked and settled.
insert into public.bonus_competition_windows (id, competition_id, sequence, label, opens_at, locks_at)
select md5('it-w' || n)::uuid, md5('it-cup')::uuid, n, 'Matchday ' || n,
       now() - ((45 - n) || ' days')::interval,
       now() - ((41 - n) || ' days')::interval
  from generate_series(1, 6) as n;

insert into public.season_cup_window_fixtures (window_id, season_fixture_id)
select md5('it-w' || n)::uuid, md5('it-fx' || n || '-' || leg)::uuid
  from generate_series(1, 6) as n, generate_series(1, 2) as leg;

-- A proper four-player double round robin: three pairings, each played twice.
-- `bonus_cup_fixtures_group_shape` requires a group fixture to carry both its
-- group and its matchday, so the matchday is stated rather than inferred.
insert into public.bonus_cup_fixtures (
  competition_id, group_id, window_id, matchday, stage, home_user_id, away_user_id)
values
  (md5('it-cup')::uuid, md5('it-g1')::uuid, md5('it-w1')::uuid, 1, 'group', md5('it-a')::uuid, md5('it-b')::uuid),
  (md5('it-cup')::uuid, md5('it-g1')::uuid, md5('it-w1')::uuid, 1, 'group', md5('it-c')::uuid, md5('it-d')::uuid),
  (md5('it-cup')::uuid, md5('it-g1')::uuid, md5('it-w2')::uuid, 2, 'group', md5('it-a')::uuid, md5('it-c')::uuid),
  (md5('it-cup')::uuid, md5('it-g1')::uuid, md5('it-w2')::uuid, 2, 'group', md5('it-b')::uuid, md5('it-d')::uuid),
  (md5('it-cup')::uuid, md5('it-g1')::uuid, md5('it-w3')::uuid, 3, 'group', md5('it-a')::uuid, md5('it-d')::uuid),
  (md5('it-cup')::uuid, md5('it-g1')::uuid, md5('it-w3')::uuid, 3, 'group', md5('it-b')::uuid, md5('it-c')::uuid),
  (md5('it-cup')::uuid, md5('it-g1')::uuid, md5('it-w4')::uuid, 4, 'group', md5('it-b')::uuid, md5('it-a')::uuid),
  (md5('it-cup')::uuid, md5('it-g1')::uuid, md5('it-w4')::uuid, 4, 'group', md5('it-d')::uuid, md5('it-c')::uuid),
  (md5('it-cup')::uuid, md5('it-g1')::uuid, md5('it-w5')::uuid, 5, 'group', md5('it-c')::uuid, md5('it-a')::uuid),
  (md5('it-cup')::uuid, md5('it-g1')::uuid, md5('it-w5')::uuid, 5, 'group', md5('it-d')::uuid, md5('it-b')::uuid),
  (md5('it-cup')::uuid, md5('it-g1')::uuid, md5('it-w6')::uuid, 6, 'group', md5('it-d')::uuid, md5('it-a')::uuid),
  (md5('it-cup')::uuid, md5('it-g1')::uuid, md5('it-w6')::uuid, 6, 'group', md5('it-c')::uuid, md5('it-b')::uuid);

-- ---------------------------------------------------------------------------
-- THE FIELD IS AS DESIGNED — asserted, so a later change to the scoring
-- authority cannot leave the assertions below passing for the wrong reason.
-- ---------------------------------------------------------------------------

select is(
  (select t.table_points from predictor_internal.cup_season_group_tables(md5('it-cup')::uuid) t
    where t.user_id = md5('it-a')::uuid),
  15,
  'A holds fifteen table points');

select is(
  (select t.table_points from predictor_internal.cup_season_group_tables(md5('it-cup')::uuid) t
    where t.user_id = md5('it-b')::uuid),
  15,
  'and so does B, so the tie-break is what decides the group');

select is(
  (select t.window_points from predictor_internal.cup_season_group_tables(md5('it-cup')::uuid) t
    where t.user_id = md5('it-a')::uuid),
  39,
  'A scored thirty-nine prediction points across the six matchdays played');

select is(
  (select t.window_points from predictor_internal.cup_season_group_tables(md5('it-cup')::uuid) t
    where t.user_id = md5('it-b')::uuid),
  48,
  'and B scored forty-eight, so B leads on the tie-break over the real span');

-- ---------------------------------------------------------------------------
-- THE ASSERTION THIS FILE EXISTS FOR: the group winner changes.
-- ---------------------------------------------------------------------------

select is(
  (select t.user_id from predictor_internal.cup_final_group_tables(md5('it-cup')::uuid) t
    where t.group_rank = 1),
  md5('it-a')::uuid,
  'the DELIVERED table makes A the group winner, on matchdays one to three alone');

select is(
  (select t.window_points from predictor_internal.cup_final_group_tables(md5('it-cup')::uuid) t
    where t.user_id = md5('it-b')::uuid),
  18,
  'because it reports eighteen of B''s forty-eight points — the tournament''s three matchdays');

select is(
  (select t.user_id from predictor_internal.cup_season_group_tables(md5('it-cup')::uuid) t
    where t.group_rank = 1),
  md5('it-b')::uuid,
  'THE GROUP WINNER CHANGES: the season table makes B the winner, from the same rows');

-- ---------------------------------------------------------------------------
-- The reads a browser can actually reach both move with it.
-- ---------------------------------------------------------------------------

select set_config('request.jwt.claims',
  json_build_object('sub', md5('it-b')::uuid, 'role', 'authenticated',
                    'app_metadata', json_build_object())::text, true);
set local role authenticated;

select is(
  (select standing ->> 'user_id'
     from jsonb_array_elements(
            public.get_season_cup_phase(md5('it-cup')::uuid) -> 'table') standing
    where (standing ->> 'group_rank')::integer = 1),
  md5('it-b')::uuid::text,
  'contract 120''s read now names B first');

select is(
  public.get_season_cup_phase(md5('it-cup')::uuid) ->> 'table_source',
  'season_initial',
  'and says which authority ranked it, rather than leaving that to be inferred');

select is(
  (select standing ->> 'user_id'
     from jsonb_array_elements(
            public.get_season_cup_group_stage(md5('it-cup')::uuid) -> 'groups') entry,
          jsonb_array_elements(entry -> 'rows') standing
    where (standing ->> 'rank')::integer = 1),
  md5('it-b')::uuid::text,
  'and contract 167''s multi-group read agrees with it, because both ask one dispatcher');

reset role;

-- ---------------------------------------------------------------------------
-- AN UNSETTLED MATCHDAY CONTRIBUTES TO NEITHER KEY.
--
-- The delivered function counts an unsettled window's prediction points toward
-- the tie-break while excluding its fixture from the table points. Over
-- thirty-eight matchdays that ranks a player on a round nobody has confirmed.
-- ---------------------------------------------------------------------------

update public.bonus_competition_windows
   set locks_at = now() + interval '2 days'
 where id = md5('it-w6')::uuid;

select is(
  (select t.window_points from predictor_internal.cup_season_group_tables(md5('it-cup')::uuid) t
    where t.user_id = md5('it-b')::uuid),
  38,
  'an unsettled matchday contributes to neither key — B''s forty-eight becomes thirty-eight');

select isnt(
  (select t.window_points from predictor_internal.cup_final_group_tables(md5('it-cup')::uuid) t
    where t.user_id = md5('it-b')::uuid),
  38,
  'which the delivered function does not do, and this is the difference contract 105 recorded');

update public.bonus_competition_windows
   set locks_at = now() - interval '35 days'
 where id = md5('it-w6')::uuid;

-- ---------------------------------------------------------------------------
-- THE TOURNAMENT TABLE IS UNCHANGED.
-- ---------------------------------------------------------------------------

select is(
  pg_catalog.substring(
    pg_catalog.pg_get_functiondef('predictor_internal.cup_final_group_tables(uuid)'::regprocedure),
    '(sequence\s+between\s+1\s+and\s+3)'),
  'sequence between 1 and 3',
  'the tournament table is unchanged: it still bounds its windows to the three it plays');

select * from finish();

rollback;
