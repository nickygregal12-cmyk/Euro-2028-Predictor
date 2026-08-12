-- Contract 178: the independent shadow scoring verifier.
--
-- THE ASSERTION THIS FILE EXISTS FOR is the differential one. A verifier that
-- cannot disagree is worthless and looks identical to one that can: both report
-- zero mismatches on a healthy season, for ever. So this suite banks a total
-- that is deliberately WRONG and requires the verifier to name it, the round it
-- is in, the entry it belongs to, and both numbers — and then banks the right
-- one and requires silence.
--
-- The second is that it corrects nothing. After a run that found a critical
-- mismatch the wrong total is still exactly as wrong as it was, because a
-- second implementation quietly overwriting the first would only move the
-- question of which one is right somewhere nobody is looking.

begin;

select plan(18);

insert into public.tournaments (name, year, competition_id, season_key, kind, display_timezone, status)
select 'C178 Shadow Scoring', 2061, t.competition_id, 'shadow-scoring', 'league_season',
       'Europe/London', 'active'
  from public.tournaments t where t.kind = 'league_season' order by t.name limit 1;

select set_config('test.ss_season',
  (select id::text from public.tournaments where season_key = 'shadow-scoring'), true);

insert into public.teams (id, tournament_id, name)
select md5('ss-t' || n)::uuid, current_setting('test.ss_season')::uuid, 'SS Club ' || n
  from generate_series(1, 4) n;

insert into public.competition_rounds (
  id, tournament_id, round_key, ordinal, kind, label,
  window_opens_at, window_closes_at)
values
  (md5('ss-r2')::uuid, current_setting('test.ss_season')::uuid, 'ss-mw2', 2,
   'league_matchweek', 'Matchweek 2',
   now() - interval '30 days', now() - interval '22 days');

insert into public.season_fixtures (
  id, tournament_id, competition_round_id, home_team_id, away_team_id,
  kickoff_at, status, home_score, away_score)
values
  (md5('ss-f2a')::uuid, current_setting('test.ss_season')::uuid, md5('ss-r2')::uuid,
   md5('ss-t1')::uuid, md5('ss-t2')::uuid, now() - interval '25 days', 'played', 2, 1),
  (md5('ss-f2b')::uuid, current_setting('test.ss_season')::uuid, md5('ss-r2')::uuid,
   md5('ss-t3')::uuid, md5('ss-t4')::uuid, now() - interval '25 days', 'played', 1, 1);

set local session_replication_role = replica;
insert into auth.users (id, email, aud, role, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
select md5('ss-' || who)::uuid, format('ss-%s@example.test', who),
       'authenticated', 'authenticated', '{}'::jsonb, '{}'::jsonb, now(), now()
  from unnest(array['right', 'wrong', 'admin', 'plain']) as who;
set local session_replication_role = origin;

insert into public.profiles (id, display_name, welcomed_at) values
  (md5('ss-right')::uuid, 'Rita Correct', now()),
  (md5('ss-wrong')::uuid, 'Wendy Skewed', now()),
  (md5('ss-admin')::uuid, 'Olive Operator', now()),
  (md5('ss-plain')::uuid, 'Percy Player', now());

insert into public.bonus_competitions (
  tournament_id, game_key, published, availability_status,
  draw_required, visibility_kind, registration_opens_at)
values (current_setting('test.ss_season')::uuid, 'main_predictor', true, 'active',
        false, 'public', now() - interval '90 days');

insert into public.entries (id, user_id, tournament_id) values
  (md5('ss-e-right')::uuid, md5('ss-right')::uuid, current_setting('test.ss_season')::uuid),
  (md5('ss-e-wrong')::uuid, md5('ss-wrong')::uuid, current_setting('test.ss_season')::uuid);

set local session_replication_role = replica;
-- Both players predict the same thing: one exact score and one correct
-- outcome. ADR 0012 makes that 5 + 3 = 8, and 8 is what both banked totals
-- should be. Only the banked figures differ.
insert into public.season_predictions (tournament_id, entry_id, season_fixture_id, home_score, away_score)
values
  (current_setting('test.ss_season')::uuid, md5('ss-e-right')::uuid, md5('ss-f2a')::uuid, 2, 1),
  (current_setting('test.ss_season')::uuid, md5('ss-e-right')::uuid, md5('ss-f2b')::uuid, 0, 0),
  (current_setting('test.ss_season')::uuid, md5('ss-e-wrong')::uuid, md5('ss-f2a')::uuid, 2, 1),
  (current_setting('test.ss_season')::uuid, md5('ss-e-wrong')::uuid, md5('ss-f2b')::uuid, 0, 0);
set local session_replication_role = origin;

-- ---------------------------------------------------------------------------
-- 1. THE TWO IMPLEMENTATIONS AGREE ON CORRECT DATA.
--
-- Asserted before anything is banked, because a verifier that disagreed with
-- the scoring authority on a healthy matchweek would make every mismatch below
-- meaningless.
-- ---------------------------------------------------------------------------

select is(
  predictor_internal.shadow_matchweek_points(md5('ss-e-right')::uuid, md5('ss-r2')::uuid),
  predictor_internal.season_matchweek_points(md5('ss-e-right')::uuid, md5('ss-r2')::uuid),
  'the independent implementation and the scoring authority agree on a healthy matchweek');

select is(
  predictor_internal.shadow_matchweek_points(md5('ss-e-right')::uuid, md5('ss-r2')::uuid),
  8,
  'and they agree on ADR 0012''s answer: one exact score at five, one correct outcome at three');

select isnt(
  predictor_internal.shadow_matchweek_points(md5('ss-e-right')::uuid, md5('ss-r2')::uuid),
  11,
  'the exact score REPLACES the correct-result award rather than stacking with it');

-- The Joker doubles, in the shadow implementation as in the canonical one.
set local session_replication_role = replica;
insert into public.season_matchweek_jokers (tournament_id, entry_id, competition_round_id)
values (current_setting('test.ss_season')::uuid, md5('ss-e-right')::uuid, md5('ss-r2')::uuid);
set local session_replication_role = origin;

select is(
  predictor_internal.shadow_matchweek_points(md5('ss-e-right')::uuid, md5('ss-r2')::uuid),
  predictor_internal.season_matchweek_points(md5('ss-e-right')::uuid, md5('ss-r2')::uuid),
  'and they agree once a Joker is in play');

select is(
  predictor_internal.shadow_matchweek_points(md5('ss-e-right')::uuid, md5('ss-r2')::uuid),
  16,
  'which is the matchweek doubled once, never each fixture doubled');

-- ---------------------------------------------------------------------------
-- 2. THE DIFFERENTIAL CASE. One banked total is right; one is wrong.
-- ---------------------------------------------------------------------------

insert into public.season_matchweek_scores (
  tournament_id, entry_id, competition_round_id, points, joker_applied, fixtures_scored)
values
  (current_setting('test.ss_season')::uuid, md5('ss-e-right')::uuid,
   md5('ss-r2')::uuid, 16, true, 2),
  -- The silent defect: 11, which is what a stacking implementation awards.
  -- Every job succeeded; the number is simply wrong.
  (current_setting('test.ss_season')::uuid, md5('ss-e-wrong')::uuid,
   md5('ss-r2')::uuid, 11, false, 2);

set local role service_role;

select set_config('test.ss_run',
  public.run_shadow_scoring_verification(current_setting('test.ss_season')::uuid)::text, true);

select is(
  (current_setting('test.ss_run')::jsonb ->> 'rounds_checked')::integer,
  1,
  'the run checks the one settled matchweek');

select is(
  (current_setting('test.ss_run')::jsonb ->> 'scores_checked')::integer,
  2,
  'and both banked totals in it');

select is(
  (current_setting('test.ss_run')::jsonb ->> 'critical_mismatches')::integer,
  1,
  'THE POINT OF THE CONTRACT: the verifier disagrees with the wrong total, and only with that one');

select is(
  (current_setting('test.ss_run')::jsonb ->> 'advisory_mismatches')::integer,
  0,
  'and the fixtures-scored denominator agrees, so the advisory channel stays quiet');

select isnt(
  current_setting('test.ss_run')::jsonb ->> 'not_checked',
  null,
  'every run states what it did NOT check, so a clean result is never read as a whole-lifecycle guarantee');

reset role;

select is(
  (select mismatch.entry_id from predictor_internal.shadow_scoring_mismatches mismatch
    where mismatch.tournament_id = current_setting('test.ss_season')::uuid),
  md5('ss-e-wrong')::uuid,
  'the recorded mismatch names the entry whose total is wrong');

select is(
  (select mismatch.banked_value || '/' || mismatch.expected_value
     from predictor_internal.shadow_scoring_mismatches mismatch
    where mismatch.tournament_id = current_setting('test.ss_season')::uuid),
  '11/8',
  'and records both numbers, so the disagreement is investigable rather than merely announced');

-- ---------------------------------------------------------------------------
-- 3. IT CORRECTS NOTHING.
-- ---------------------------------------------------------------------------

select is(
  (select score.points from public.season_matchweek_scores score
    where score.entry_id = md5('ss-e-wrong')::uuid
      and score.competition_round_id = md5('ss-r2')::uuid),
  11,
  'after the run the wrong total is still exactly as wrong: the verifier has no authority');

-- ---------------------------------------------------------------------------
-- 4. A SECOND RUN OVER CORRECTED DATA IS SILENT.
-- ---------------------------------------------------------------------------

update public.season_matchweek_scores
   set points = 8
 where entry_id = md5('ss-e-wrong')::uuid
   and competition_round_id = md5('ss-r2')::uuid;

set local role service_role;

select is(
  (public.run_shadow_scoring_verification(current_setting('test.ss_season')::uuid)
   ->> 'critical_mismatches')::integer,
  0,
  'once the total is right the verifier is silent, so it is not simply always complaining');

reset role;

-- ---------------------------------------------------------------------------
-- 5. WHO MAY RUN IT AND WHO MAY READ IT.
-- ---------------------------------------------------------------------------

select is(
  (select has_function_privilege('authenticated',
     'public.run_shadow_scoring_verification(uuid,integer)', 'execute')),
  false,
  'no browser role may start a verification run');

select is(
  (select has_function_privilege('anon',
     'public.admin_shadow_scoring_report(uuid,integer)', 'execute')),
  false,
  'and no anonymous role may read the report');

set local role authenticated;
select set_config('request.jwt.claim.sub', md5('ss-plain')::uuid::text, true);
select set_config('request.jwt.claims', '{"role":"authenticated","app_metadata":{}}', true);

select throws_ok(
  format('select public.admin_shadow_scoring_report(%L)', current_setting('test.ss_season')),
  '42501',
  null,
  'an ordinary authenticated player is refused the report');

select set_config('request.jwt.claims',
  '{"role":"authenticated","app_metadata":{"admin_capabilities":["competitions"]}}', true);

select is(
  (public.admin_shadow_scoring_report(current_setting('test.ss_season')::uuid)
   -> 'run' ->> 'critical_mismatches')::integer,
  0,
  'while a competition administrator reads the latest run, which is the clean one');

reset role;

select * from finish();
rollback;
