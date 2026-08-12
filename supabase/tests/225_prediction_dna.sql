-- Contract 176: Prediction DNA.
--
-- THE ASSERTIONS THIS FILE EXISTS FOR are the two that make the metrics safe
-- rather than merely interesting:
--
--   1. THE WINDOW IS THE LOCK. A prediction in a matchweek that has not locked
--      never reaches a denominator, for the caller's own profile as much as for
--      a rival's — an average over one unlocked prediction is that prediction.
--   2. THE COHORT PROTECTS THE CONSENSUS. A fixture only counts towards
--      agreement-with-the-field when at least ten entries predicted it AND one
--      outcome is strictly the most predicted, and the excluded fixtures are
--      reported rather than silently dropped.
--
-- Every rate is checked against its own denominator, because a rate with a
-- wrong denominator is the failure this contract exists to prevent.

begin;

select plan(24);

insert into public.tournaments (name, year, competition_id, season_key, kind, display_timezone, status)
select 'C176 Prediction DNA', 2059, t.competition_id, 'dna-season', 'league_season',
       'Europe/London', 'active'
  from public.tournaments t where t.kind = 'league_season' order by t.name limit 1;

select set_config('test.dna_season',
  (select id::text from public.tournaments where season_key = 'dna-season'), true);

insert into public.teams (id, tournament_id, name)
select md5('dna-t' || n)::uuid, current_setting('test.dna_season')::uuid, 'DNA Club ' || n
  from generate_series(1, 6) n;

-- Matchweek 3 is played and locked; matchweek 4 has not opened. The second
-- exists only so the window can be proven to exclude it.
insert into public.competition_rounds (
  id, tournament_id, round_key, ordinal, kind, label,
  window_opens_at, window_closes_at)
values
  (md5('dna-r3')::uuid, current_setting('test.dna_season')::uuid, 'dna-mw3', 3,
   'league_matchweek', 'Matchweek 3',
   now() - interval '20 days', now() - interval '9 days'),
  (md5('dna-r4')::uuid, current_setting('test.dna_season')::uuid, 'dna-mw4', 4,
   'league_matchweek', 'Matchweek 4',
   now() + interval '2 days', now() + interval '9 days');

insert into public.season_fixtures (
  id, tournament_id, competition_round_id, home_team_id, away_team_id,
  kickoff_at, status, home_score, away_score)
values
  (md5('dna-f3a')::uuid, current_setting('test.dna_season')::uuid, md5('dna-r3')::uuid,
   md5('dna-t1')::uuid, md5('dna-t2')::uuid, now() - interval '10 days', 'played', 2, 1),
  (md5('dna-f3b')::uuid, current_setting('test.dna_season')::uuid, md5('dna-r3')::uuid,
   md5('dna-t3')::uuid, md5('dna-t4')::uuid, now() - interval '10 days', 'played', 0, 0),
  (md5('dna-f3c')::uuid, current_setting('test.dna_season')::uuid, md5('dna-r3')::uuid,
   md5('dna-t5')::uuid, md5('dna-t6')::uuid, now() - interval '10 days', 'played', 0, 2),
  (md5('dna-f4a')::uuid, current_setting('test.dna_season')::uuid, md5('dna-r4')::uuid,
   md5('dna-t1')::uuid, md5('dna-t3')::uuid, now() + interval '5 days', 'scheduled', null, null);

set local session_replication_role = replica;
insert into auth.users (id, email, aud, role, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
select md5('dna-' || who)::uuid, format('dna-%s@example.test', who),
       'authenticated', 'authenticated', '{}'::jsonb, '{}'::jsonb, now(), now()
  from unnest(array['ana', 'ben', 'cal', 'dee']) as who;

-- The field: twenty-one other entrants, present only to make the cohort real.
insert into auth.users (id, email, aud, role, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
select md5('dna-field-' || n)::uuid, format('dna-field-%s@example.test', n),
       'authenticated', 'authenticated', '{}'::jsonb, '{}'::jsonb, now(), now()
  from generate_series(1, 21) n;
set local session_replication_role = origin;

insert into public.profiles (id, display_name, welcomed_at) values
  (md5('dna-ana')::uuid, 'Ana', now()),
  (md5('dna-ben')::uuid, 'Ben', now()),
  (md5('dna-cal')::uuid, 'Cal', now()),
  (md5('dna-dee')::uuid, 'Dee', now());

insert into public.profiles (id, display_name, welcomed_at)
select md5('dna-field-' || n)::uuid, 'Field ' || n, now() from generate_series(1, 21) n;

insert into public.bonus_competitions (
  tournament_id, game_key, published, availability_status,
  draw_required, visibility_kind, registration_opens_at)
values (current_setting('test.dna_season')::uuid, 'main_predictor', true, 'active',
        false, 'public', now() - interval '60 days');

insert into public.entries (id, user_id, tournament_id) values
  (md5('dna-e-ana')::uuid, md5('dna-ana')::uuid, current_setting('test.dna_season')::uuid),
  (md5('dna-e-ben')::uuid, md5('dna-ben')::uuid, current_setting('test.dna_season')::uuid);

insert into public.entries (id, user_id, tournament_id)
select md5('dna-e-field-' || n)::uuid, md5('dna-field-' || n)::uuid,
       current_setting('test.dna_season')::uuid
  from generate_series(1, 21) n;

select set_config('test.dna_ana', md5('dna-e-ana')::uuid::text, true);

-- Matchweek 3 is locked, so setup writes past the lock trigger deliberately:
-- this suite tests the READ, not the write path contract 114 owns.
set local session_replication_role = replica;

-- Ana: one home win, one draw, one away win. Two correct outcomes and one
-- exact score, chosen so every tendency rate has a different numerator.
insert into public.season_predictions (tournament_id, entry_id, season_fixture_id, home_score, away_score)
values
  (current_setting('test.dna_season')::uuid, current_setting('test.dna_ana')::uuid,
   md5('dna-f3a')::uuid, 2, 1),
  (current_setting('test.dna_season')::uuid, current_setting('test.dna_ana')::uuid,
   md5('dna-f3b')::uuid, 1, 1),
  (current_setting('test.dna_season')::uuid, current_setting('test.dna_ana')::uuid,
   md5('dna-f3c')::uuid, 0, 1),
  -- The unlocked matchweek. Must never reach a denominator.
  (current_setting('test.dna_season')::uuid, current_setting('test.dna_ana')::uuid,
   md5('dna-f4a')::uuid, 3, 0);

-- f3a: eight of the field back the home side, three the away side. With Ana
-- that is twelve predictions and a strict home-win consensus she agreed with.
insert into public.season_predictions (tournament_id, entry_id, season_fixture_id, home_score, away_score)
select current_setting('test.dna_season')::uuid, md5('dna-e-field-' || n)::uuid,
       md5('dna-f3a')::uuid,
       case when n <= 8 then 1 else 0 end, case when n <= 8 then 0 else 1 end
  from generate_series(1, 11) n;

-- f3b: two others only. Three predictions is below the cohort, so the fixture
-- is excluded and SAID to be excluded.
insert into public.season_predictions (tournament_id, entry_id, season_fixture_id, home_score, away_score)
select current_setting('test.dna_season')::uuid, md5('dna-e-field-' || n)::uuid,
       md5('dna-f3b')::uuid, 1, 0
  from generate_series(12, 13) n;

-- f3c: ten of the field back the home side; Ana alone backs the away side, and
-- the away side wins. One measured disagreement with the field, and it lands.
insert into public.season_predictions (tournament_id, entry_id, season_fixture_id, home_score, away_score)
select current_setting('test.dna_season')::uuid, md5('dna-e-field-' || n)::uuid,
       md5('dna-f3c')::uuid, 1, 0
  from generate_series(1, 10) n;
set local session_replication_role = origin;

insert into public.leagues (id, tournament_id, owner_id, name, invite_code) values
  (md5('dna-league')::uuid, current_setting('test.dna_season')::uuid,
   md5('dna-ana')::uuid, 'DNA League', 'DNALEAGUE0001');

insert into public.league_members (league_id, user_id, role) values
  (md5('dna-league')::uuid, md5('dna-ana')::uuid, 'owner'),
  (md5('dna-league')::uuid, md5('dna-ben')::uuid, 'member'),
  (md5('dna-league')::uuid, md5('dna-cal')::uuid, 'member');

set local role authenticated;
select set_config('request.jwt.claim.sub', md5('dna-ana')::uuid::text, true);
select set_config('request.jwt.claim.role', 'authenticated', true);

select set_config('test.dna_self',
  public.get_season_prediction_dna(
    current_setting('test.dna_season')::uuid, md5('dna-ana')::uuid)::text, true);

-- ---------------------------------------------------------------------------
-- 1. THE WINDOW IS THE LOCK.
-- ---------------------------------------------------------------------------

select is(
  (current_setting('test.dna_self')::jsonb ->> 'predictions_counted')::integer,
  3,
  'four predictions exist and three are counted: the unlocked matchweek is outside the window');

select is(
  (current_setting('test.dna_self')::jsonb ->> 'settled_predictions')::integer,
  3,
  'and all three counted fixtures have been played, so accuracy has the same denominator here');

-- ---------------------------------------------------------------------------
-- 2. TENDENCIES, EACH AGAINST ITS OWN DENOMINATOR.
-- ---------------------------------------------------------------------------

select is(
  (current_setting('test.dna_self')::jsonb -> 'tendencies' ->> 'denominator')::integer,
  3,
  'the tendency block states the denominator every rate below it is over');

select is(
  (current_setting('test.dna_self')::jsonb -> 'tendencies' ->> 'home_wins')::integer,
  1,
  'one home win predicted');

select is(
  (current_setting('test.dna_self')::jsonb -> 'tendencies' ->> 'draws')::integer,
  1,
  'one draw predicted');

select is(
  (current_setting('test.dna_self')::jsonb -> 'tendencies' ->> 'away_wins')::integer,
  1,
  'one away win predicted');

select is(
  (current_setting('test.dna_self')::jsonb -> 'tendencies' ->> 'average_predicted_goals')::numeric,
  2.0000::numeric,
  'three, two and one goals predicted averages two');

select is(
  (current_setting('test.dna_self')::jsonb -> 'tendencies' ->> 'average_predicted_margin')::numeric,
  0.0000::numeric,
  'and a home win, a draw and an away win average a margin of nothing');

select is(
  current_setting('test.dna_self')::jsonb -> 'tendencies' -> 'most_common_scoreline' ->> 'count',
  '1',
  'with every scoreline used once the most common is reported at a count of one');

select is(
  (current_setting('test.dna_self')::jsonb -> 'tendencies' ->> 'sufficient')::boolean,
  false,
  'and three predictions is honestly reported as too few rather than dressed as a tendency');

-- ---------------------------------------------------------------------------
-- 3. ACCURACY. Counting is not scoring: no point value appears.
-- ---------------------------------------------------------------------------

select is(
  (current_setting('test.dna_self')::jsonb -> 'accuracy' ->> 'exact_scores')::integer,
  1,
  'one exact score');

select is(
  (current_setting('test.dna_self')::jsonb -> 'accuracy' ->> 'correct_outcomes')::integer,
  3,
  'and three correct outcomes, the exact score among them');

select is(
  (current_setting('test.dna_self')::jsonb -> 'accuracy' ->> 'correct_outcome_rate')::numeric,
  1.0000::numeric,
  'three of three is stated as a rate over the stated denominator');

-- ---------------------------------------------------------------------------
-- 4. THE COHORT PROTECTS THE CONSENSUS.
-- ---------------------------------------------------------------------------

select is(
  (current_setting('test.dna_self')::jsonb -> 'consensus' ->> 'minimum_cohort')::integer,
  10,
  'the cohort minimum is contract 61''s ten, and it is returned rather than hidden');

select is(
  (current_setting('test.dna_self')::jsonb -> 'consensus' ->> 'measured')::integer,
  2,
  'two of the three settled fixtures had a large enough field with a strict consensus');

select is(
  (current_setting('test.dna_self')::jsonb -> 'consensus' ->> 'excluded_small_cohort')::integer,
  1,
  'and the three-prediction fixture is reported as excluded rather than silently dropped');

select is(
  (current_setting('test.dna_self')::jsonb -> 'consensus' ->> 'agreed_with_field')::integer,
  1,
  'she agreed with the field once');

select is(
  (current_setting('test.dna_self')::jsonb -> 'consensus' ->> 'against_field')::integer,
  1,
  'and went against it once');

select is(
  (current_setting('test.dna_self')::jsonb -> 'consensus' ->> 'against_field_success_rate')::numeric,
  1.0000::numeric,
  'the one time she went against the field she was right, over a denominator of one');

-- ---------------------------------------------------------------------------
-- 5. PER-CLUB.
-- ---------------------------------------------------------------------------

select is(
  (select (club ->> 'predicted_to_win')::integer
     from jsonb_array_elements(current_setting('test.dna_self')::jsonb -> 'clubs') club
    where club ->> 'team_id' = md5('dna-t1')::uuid::text),
  1,
  'the club she predicted to win at home is recorded as predicted to win');

-- ---------------------------------------------------------------------------
-- 6. THE DISCLOSURE BOUNDARY.
-- ---------------------------------------------------------------------------

select set_config('request.jwt.claim.sub', md5('dna-ben')::uuid::text, true);

select is(
  (public.get_season_prediction_dna(
     current_setting('test.dna_season')::uuid, md5('dna-ana')::uuid
   ) ->> 'predictions_counted')::integer,
  3,
  'a private-league co-member reads the same three counted predictions, so the window does not favour the caller');

select is(
  (public.get_season_prediction_dna(
     current_setting('test.dna_season')::uuid, md5('dna-cal')::uuid
   ) ->> 'entered')::boolean,
  false,
  'a co-member who never entered the season is a real answer rather than an error');

select set_config('request.jwt.claim.sub', md5('dna-dee')::uuid::text, true);

select throws_ok(
  format('select public.get_season_prediction_dna(%L, %L)',
         current_setting('test.dna_season'), md5('dna-ana')::uuid),
  '42501',
  null,
  'and someone who shares no private league with her is refused, because a season is not consent');

reset role;

select is(
  (select has_function_privilege('anon',
     'public.get_season_prediction_dna(uuid,uuid)', 'execute')),
  false,
  'no anonymous role may execute it');

select * from finish();
rollback;
