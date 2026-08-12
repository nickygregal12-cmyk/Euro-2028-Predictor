-- Contract 177: reconciling offline drafts.
--
-- THE ASSERTION THIS FILE EXISTS FOR is partial acceptance. A batch carrying
-- one locked fixture, one malformed draft and two perfectly submittable ones
-- must submit the two — and the whole point of the contract is lost the moment
-- an implementation wraps the loop in one transaction, because then the locked
-- fixture rolls back the other three and the player loses work they could have
-- kept. The suite proves the two survived by reading them back.
--
-- The second is that the batch is not a second write path: the lock and the
-- version check refuse it exactly as they refuse a single call, because it is
-- the single call, run four times.

begin;

select plan(19);

insert into public.tournaments (name, year, competition_id, season_key, kind, display_timezone, status)
select 'C177 Offline Drafts', 2060, t.competition_id, 'offline-drafts', 'league_season',
       'Europe/London', 'active'
  from public.tournaments t where t.kind = 'league_season' order by t.name limit 1;

select set_config('test.od_season',
  (select id::text from public.tournaments where season_key = 'offline-drafts'), true);

insert into public.teams (id, tournament_id, name)
select md5('od-t' || n)::uuid, current_setting('test.od_season')::uuid, 'OD Club ' || n
  from generate_series(1, 8) n;

-- Matchweek 4 has been played; matchweek 5 is open. The batch spans both,
-- because the interesting case is the one that spans a lock.
insert into public.competition_rounds (
  id, tournament_id, round_key, ordinal, kind, label,
  window_opens_at, window_closes_at)
values
  (md5('od-r4')::uuid, current_setting('test.od_season')::uuid, 'od-mw4', 4,
   'league_matchweek', 'Matchweek 4',
   now() - interval '20 days', now() - interval '12 days'),
  (md5('od-r5')::uuid, current_setting('test.od_season')::uuid, 'od-mw5', 5,
   'league_matchweek', 'Matchweek 5',
   now() - interval '2 days', now() + interval '6 days');

insert into public.season_fixtures (
  id, tournament_id, competition_round_id, home_team_id, away_team_id, kickoff_at, status)
values
  (md5('od-f4a')::uuid, current_setting('test.od_season')::uuid, md5('od-r4')::uuid,
   md5('od-t1')::uuid, md5('od-t2')::uuid, now() - interval '14 days', 'scheduled'),
  (md5('od-f5a')::uuid, current_setting('test.od_season')::uuid, md5('od-r5')::uuid,
   md5('od-t3')::uuid, md5('od-t4')::uuid, now() + interval '3 days', 'scheduled'),
  (md5('od-f5b')::uuid, current_setting('test.od_season')::uuid, md5('od-r5')::uuid,
   md5('od-t5')::uuid, md5('od-t6')::uuid, now() + interval '3 days', 'scheduled'),
  (md5('od-f5c')::uuid, current_setting('test.od_season')::uuid, md5('od-r5')::uuid,
   md5('od-t7')::uuid, md5('od-t8')::uuid, now() + interval '4 days', 'scheduled');

set local session_replication_role = replica;
insert into auth.users (id, email, aud, role, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
values (md5('od-ana')::uuid, 'od-ana@example.test', 'authenticated', 'authenticated',
        '{}'::jsonb, '{}'::jsonb, now(), now()),
       (md5('od-out')::uuid, 'od-out@example.test', 'authenticated', 'authenticated',
        '{}'::jsonb, '{}'::jsonb, now(), now());
set local session_replication_role = origin;

insert into public.profiles (id, display_name, welcomed_at) values
  (md5('od-ana')::uuid, 'Ana', now()),
  (md5('od-out')::uuid, 'Outsider', now());

insert into public.bonus_competitions (
  tournament_id, game_key, published, availability_status,
  draw_required, visibility_kind, registration_opens_at)
values (current_setting('test.od_season')::uuid, 'main_predictor', true, 'active',
        false, 'public', now() - interval '60 days');

insert into public.entries (id, user_id, tournament_id) values
  (md5('od-e-ana')::uuid, md5('od-ana')::uuid, current_setting('test.od_season')::uuid);

select set_config('test.od_ana', md5('od-e-ana')::uuid::text, true);

set local role authenticated;
select set_config('request.jwt.claim.sub', md5('od-ana')::uuid::text, true);
select set_config('request.jwt.claim.role', 'authenticated', true);

-- ---------------------------------------------------------------------------
-- 1. PARTIAL ACCEPTANCE: four drafts, four different answers, one call.
-- ---------------------------------------------------------------------------

select set_config('test.od_batch1',
  public.save_season_predictions_batch(
    current_setting('test.od_season')::uuid,
    jsonb_build_array(
      jsonb_build_object('fixture_id', md5('od-f5a')::uuid, 'home', 1, 'away', 0, 'version', 0),
      jsonb_build_object('fixture_id', md5('od-f5b')::uuid, 'home', 2, 'away', 2, 'version', 0),
      jsonb_build_object('fixture_id', md5('od-f4a')::uuid, 'home', 1, 'away', 1, 'version', 0),
      jsonb_build_object('fixture_id', md5('od-f5c')::uuid, 'home', 'x', 'away', 0, 'version', 0)
    ))::text, true);

select is(
  (current_setting('test.od_batch1')::jsonb ->> 'accepted')::integer,
  2,
  'the two submittable drafts are accepted');

select is(
  (current_setting('test.od_batch1')::jsonb ->> 'rejected')::integer,
  2,
  'and the locked and the malformed one are rejected, in the same call');

select is(
  (select entry ->> 'outcome'
     from jsonb_array_elements(current_setting('test.od_batch1')::jsonb -> 'results') entry
    where entry ->> 'fixture_id' = md5('od-f4a')::uuid::text),
  'locked',
  'the fixture in the locked matchweek is named as locked rather than as a generic failure');

select is(
  (select entry ->> 'outcome'
     from jsonb_array_elements(current_setting('test.od_batch1')::jsonb -> 'results') entry
    where entry ->> 'fixture_id' = md5('od-f5c')::uuid::text),
  'invalid',
  'and a draft whose score is not a number is named as invalid');

-- Read back as the owner: a browser role has no table access to
-- `season_predictions`, which is the platform behaving correctly.
reset role;

select is(
  (select count(*)::integer from public.season_predictions
    where entry_id = current_setting('test.od_ana')::uuid),
  2,
  'THE POINT OF THE CONTRACT: the two good drafts were written, so one locked fixture did not roll back the batch');

select is(
  (select prediction.home_score::integer from public.season_predictions prediction
    where prediction.entry_id = current_setting('test.od_ana')::uuid
      and prediction.season_fixture_id = md5('od-f5a')::uuid),
  1,
  'and they were written with the scores the player drafted');

select is(
  (select count(*)::integer from public.season_predictions
    where entry_id = current_setting('test.od_ana')::uuid
      and season_fixture_id = md5('od-f4a')::uuid),
  0,
  'while the locked fixture wrote nothing, because the trigger that owns the lock refused it');

set local role authenticated;

-- ---------------------------------------------------------------------------
-- 2. THE VERSION CONFLICT, AND WHAT IT HANDS BACK.
-- ---------------------------------------------------------------------------

-- A second submission at the version the client last read succeeds and moves
-- the stored version on. That is the "other device" in the story.
select is(
  (select entry ->> 'outcome'
     from jsonb_array_elements(
       public.save_season_predictions_batch(
         current_setting('test.od_season')::uuid,
         jsonb_build_array(jsonb_build_object(
           'fixture_id', md5('od-f5a')::uuid, 'home', 3, 'away', 1, 'version', 0))
       ) -> 'results') entry),
  'accepted',
  'a write at the version the caller last read is accepted and advances the stored version');

select set_config('test.od_conflict',
  (select entry
     from jsonb_array_elements(
       public.save_season_predictions_batch(
         current_setting('test.od_season')::uuid,
         jsonb_build_array(jsonb_build_object(
           'fixture_id', md5('od-f5a')::uuid, 'home', 0, 'away', 0, 'version', 0))
       ) -> 'results') entry)::text, true);

select is(
  current_setting('test.od_conflict')::jsonb ->> 'outcome',
  'conflict',
  'a stale draft from the phone is a conflict rather than an overwrite');

select is(
  (current_setting('test.od_conflict')::jsonb -> 'stored' ->> 'home')::integer,
  3,
  'and the conflict hands back what the server holds, so the player can be shown both');

select is(
  (current_setting('test.od_conflict')::jsonb -> 'draft' ->> 'home')::integer,
  0,
  'beside the draft that lost, which is the choice a reconciliation surface has to offer');

-- Read back as the owner: a browser role has no table access to
-- `season_predictions`, which is the platform behaving correctly.
reset role;

select is(
  (select prediction.home_score::integer from public.season_predictions prediction
    where prediction.entry_id = current_setting('test.od_ana')::uuid
      and prediction.season_fixture_id = md5('od-f5a')::uuid),
  3,
  'the stale draft changed nothing: the newer device''s prediction still stands');

set local role authenticated;

-- ---------------------------------------------------------------------------
-- 3. CLEARING, WHICH IS A LEGITIMATE DRAFT.
-- ---------------------------------------------------------------------------

select is(
  (select entry ->> 'outcome'
     from jsonb_array_elements(
       public.save_season_predictions_batch(
         current_setting('test.od_season')::uuid,
         jsonb_build_array(jsonb_build_object(
           'fixture_id', md5('od-f5b')::uuid, 'home', null, 'away', null, 'version', 0))
       ) -> 'results') entry),
  'accepted',
  'a draft with no scores clears the prediction, through the same delete path the lock guards');

-- Read back as the owner: a browser role has no table access to
-- `season_predictions`, which is the platform behaving correctly.
reset role;

select is(
  (select count(*)::integer from public.season_predictions
    where entry_id = current_setting('test.od_ana')::uuid
      and season_fixture_id = md5('od-f5b')::uuid),
  0,
  'and the cleared prediction is gone');

set local role authenticated;

-- ---------------------------------------------------------------------------
-- 4. WHAT REFUSES THE WHOLE CALL.
-- ---------------------------------------------------------------------------

select throws_ok(
  format($$select public.save_season_predictions_batch(%L, jsonb_build_array(
            jsonb_build_object('fixture_id', %L, 'home', 1, 'away', 0, 'version', 0),
            jsonb_build_object('fixture_id', %L, 'home', 2, 'away', 0, 'version', 0)))$$,
         current_setting('test.od_season'), md5('od-f5c')::uuid, md5('od-f5c')::uuid),
  '22023',
  null,
  'two drafts for one fixture refuse the call rather than letting array order decide');

select throws_ok(
  format($$select public.save_season_predictions_batch(%L, to_jsonb('not an array'::text))$$,
         current_setting('test.od_season')),
  '22023',
  null,
  'a payload that is not an array is refused');

select throws_ok(
  format($$select public.save_season_predictions_batch(%L, (
            select jsonb_agg(jsonb_build_object('fixture_id', %L, 'home', 1, 'away', 0))
              from generate_series(1, 61)))$$,
         current_setting('test.od_season'), md5('od-f5c')::uuid),
  '22023',
  null,
  'and a batch above the cap is refused before anything is written');

select set_config('request.jwt.claim.sub', md5('od-out')::uuid::text, true);

select throws_ok(
  format($$select public.save_season_predictions_batch(%L, '[]'::jsonb)$$,
         current_setting('test.od_season')),
  '42501',
  null,
  'a caller with no entry is refused for the whole call, never reported per item');

reset role;

select is(
  (select has_function_privilege('anon',
     'public.save_season_predictions_batch(uuid,jsonb)', 'execute')),
  false,
  'no anonymous role may submit a batch');

select * from finish();
rollback;
