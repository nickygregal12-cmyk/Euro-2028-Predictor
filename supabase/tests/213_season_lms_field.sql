-- Contract 164: the Last Man Standing field, revealed when the round locks.
--
-- THE ASSERTION THIS FILE EXISTS FOR is that before the lock, one entrant sees
-- their OWN pick and absolutely nothing of anybody else's — not the club, and
-- not even that a pick exists. In a game whose clubs are a depleting resource,
-- "who has already picked" is itself information, so a `has_picked` flag left
-- visible would be a real leak that a test checking only the club would miss.
--
-- The second is that the boundary moves on its own. The same call, made after
-- the round's stored lock has passed, discloses every pick — and nothing in
-- between changes except the clock, because there is no argument that could.

begin;

select plan(19);

insert into public.tournaments (name, year, competition_id, season_key, kind, display_timezone, status)
select 'C164 LMS Field', 2049, t.competition_id, 'lms-field', 'league_season',
       'Europe/London', 'active'
  from public.tournaments t where t.kind = 'league_season' order by t.name limit 1;

select set_config('test.lf_season',
  (select id::text from public.tournaments where season_key = 'lms-field'), true);

insert into public.teams (id, tournament_id, name) values
  (md5('lf-t1')::uuid, current_setting('test.lf_season')::uuid, 'Field Rovers'),
  (md5('lf-t2')::uuid, current_setting('test.lf_season')::uuid, 'Field United'),
  (md5('lf-t3')::uuid, current_setting('test.lf_season')::uuid, 'Field City');

insert into public.competition_rounds (id, tournament_id, round_key, ordinal, kind, label)
values (md5('lf-r5')::uuid, current_setting('test.lf_season')::uuid,
        'lf-mw5', 5, 'league_matchweek', 'Matchweek 5');

-- Rovers beat United 2-0, so the settlement authority has a real verdict to give
-- for both picks rather than a null that would pass either way.
insert into public.season_fixtures (
  id, tournament_id, competition_round_id, home_team_id, away_team_id,
  kickoff_at, status, home_score, away_score)
values (md5('lf-fx')::uuid, current_setting('test.lf_season')::uuid, md5('lf-r5')::uuid,
        md5('lf-t1')::uuid, md5('lf-t2')::uuid, now() - interval '1 hour', 'played', 2, 0);

insert into public.bonus_competitions (
  id, tournament_id, game_key, published, availability_status,
  draw_required, visibility_kind, registration_opens_at)
values (md5('lf-lms')::uuid, current_setting('test.lf_season')::uuid,
        'last_man_standing', true, 'active', false, 'public', now() - interval '30 days');

-- A PUBLIC setup must be Classic and only Classic:
-- `season_lms_setups_public_is_classic` refuses any other public row, and
-- `season_lms_setups_wipeout_matches_scope` refuses a public row that names a
-- wipeout outcome. Zero lives and zero saves are therefore not a simplification
-- here — they are the only public setup the table accepts, which is ADR 0022's
-- rule made unavoidable by the schema.
insert into public.season_lms_setups (competition_id, lives, saves, draws_rule, endgame_scope)
values (md5('lf-lms')::uuid, 0, 0, 'eliminate', 'public');

set local session_replication_role = replica;
insert into auth.users (id, email, aud, role, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
select md5('lf-' || who)::uuid, format('lf-%s@example.test', who),
       'authenticated', 'authenticated', '{}'::jsonb, '{}'::jsonb, now(), now()
  from unnest(array['ada', 'bo', 'cyd', 'out', 'stranger']) as who;
set local session_replication_role = origin;

insert into public.profiles (id, display_name, welcomed_at) values
  (md5('lf-ada')::uuid, 'Ada', now()),
  (md5('lf-bo')::uuid, 'Bo', now()),
  (md5('lf-cyd')::uuid, 'Cyd', now()),
  (md5('lf-out')::uuid, 'Dev', now()),
  (md5('lf-stranger')::uuid, 'Stranger', now());

insert into public.bonus_competition_entrants (competition_id, user_id, outcome) values
  (md5('lf-lms')::uuid, md5('lf-ada')::uuid, 'active'),
  (md5('lf-lms')::uuid, md5('lf-bo')::uuid, 'active'),
  (md5('lf-lms')::uuid, md5('lf-cyd')::uuid, 'active'),
  (md5('lf-lms')::uuid, md5('lf-out')::uuid, 'eliminated');

-- The allowance a Classic setup grants is zero, and
-- `assert_lms_entrant_allowance` refuses an entrant holding more than the setup
-- gave. So every entrant state is zero here, and the reveal assertions below
-- test PRESENCE versus ABSENCE of the field rather than its value — which is
-- the boundary in question anyway.
insert into public.season_lms_entrant_state (competition_id, user_id, lives_remaining, saves_remaining) values
  (md5('lf-lms')::uuid, md5('lf-ada')::uuid, 0, 0),
  (md5('lf-lms')::uuid, md5('lf-bo')::uuid, 0, 0),
  (md5('lf-lms')::uuid, md5('lf-cyd')::uuid, 0, 0),
  (md5('lf-lms')::uuid, md5('lf-out')::uuid, 0, 0);

-- OPEN: opened two days ago, locks in two days.
insert into public.bonus_competition_windows (id, competition_id, sequence, label, opens_at, locks_at)
values (md5('lf-w5')::uuid, md5('lf-lms')::uuid, 5, 'Round 5',
        now() - interval '2 days', now() + interval '2 days');

insert into public.season_cup_window_fixtures (window_id, season_fixture_id)
values (md5('lf-w5')::uuid, md5('lf-fx')::uuid);

insert into public.bonus_lms_selections (competition_id, user_id, window_id, team_id) values
  (md5('lf-lms')::uuid, md5('lf-ada')::uuid, md5('lf-w5')::uuid, md5('lf-t1')::uuid),
  (md5('lf-lms')::uuid, md5('lf-bo')::uuid, md5('lf-w5')::uuid, md5('lf-t2')::uuid);

-- ---------------------------------------------------------------------------
-- BEFORE THE LOCK
-- ---------------------------------------------------------------------------

select set_config('request.jwt.claims',
  json_build_object('sub', md5('lf-ada')::uuid, 'role', 'authenticated',
                    'app_metadata', json_build_object())::text, true);
set local role authenticated;

select set_config('test.lf_before',
  public.get_season_lms_field(current_setting('test.lf_season')::uuid)::text, true);

select is(
  current_setting('test.lf_before')::jsonb -> 'round' ->> 'revealed', 'false',
  'the round has not locked, so the server says it is not revealed');

select is(
  (select entry -> 'pick' ->> 'team_name'
     from jsonb_array_elements(current_setting('test.lf_before')::jsonb -> 'entrants') entry
    where (entry ->> 'is_me')::boolean),
  'Field Rovers',
  'the caller sees their OWN pick before the lock, because it is theirs');

-- THE ASSERTION THIS FILE EXISTS FOR.
select is(
  (select count(*)::integer
     from jsonb_array_elements(current_setting('test.lf_before')::jsonb -> 'entrants') entry
    where not (entry ->> 'is_me')::boolean
      and entry -> 'pick' <> 'null'::jsonb),
  0,
  'and NO other entrant''s club at all');

select is(
  (select count(*)::integer
     from jsonb_array_elements(current_setting('test.lf_before')::jsonb -> 'entrants') entry
    where not (entry ->> 'is_me')::boolean
      and entry ->> 'has_picked' is not null),
  0,
  'nor whether they have picked — which is itself information when clubs deplete');

select is(
  (select count(*)::integer
     from jsonb_array_elements(current_setting('test.lf_before')::jsonb -> 'entrants') entry
    where not (entry ->> 'is_me')::boolean
      and entry ->> 'saves_remaining' is not null),
  0,
  'nor how many saves they hold, which is spent DURING a round rather than settled before it');

select is(
  current_setting('test.lf_before')::jsonb -> 'field' ->> 'picked', null,
  'and the count of who has picked is withheld with them');

-- WHAT IS VISIBLE, because it is settled history rather than a secret.
select is(
  current_setting('test.lf_before')::jsonb -> 'field' ->> 'remaining', '3',
  'the surviving field size IS visible, because it is settled history');

select is(
  current_setting('test.lf_before')::jsonb -> 'field' ->> 'eliminated', '1',
  'and so is the number knocked out');

select is(
  (select entry ->> 'outcome'
     from jsonb_array_elements(current_setting('test.lf_before')::jsonb -> 'entrants') entry
    where entry ->> 'display_name' = 'Dev'),
  'eliminated',
  'an eliminated entrant is named as eliminated, because being out is not a secret');

select is(
  (select entry ->> 'saves_remaining'
     from jsonb_array_elements(current_setting('test.lf_before')::jsonb -> 'entrants') entry
    where (entry ->> 'is_me')::boolean),
  '0',
  'the caller''s own counts are always visible, because those are their own');

-- ---------------------------------------------------------------------------
-- THE BOUNDARY MOVES ON ITS OWN. Only the stored lock changes.
-- ---------------------------------------------------------------------------

reset role;
update public.bonus_competition_windows
   set locks_at = now() - interval '1 minute'
 where id = md5('lf-w5')::uuid;

select set_config('request.jwt.claims',
  json_build_object('sub', md5('lf-ada')::uuid, 'role', 'authenticated',
                    'app_metadata', json_build_object())::text, true);
set local role authenticated;

select set_config('test.lf_after',
  public.get_season_lms_field(current_setting('test.lf_season')::uuid)::text, true);

select is(
  current_setting('test.lf_after')::jsonb -> 'round' ->> 'revealed', 'true',
  'once the stored lock has passed the server says it is revealed');

select is(
  (select entry -> 'pick' ->> 'team_name'
     from jsonb_array_elements(current_setting('test.lf_after')::jsonb -> 'entrants') entry
    where entry ->> 'display_name' = 'Bo'),
  'Field United',
  'and another entrant''s club is disclosed');

select is(
  (select entry -> 'pick' ->> 'outcome'
     from jsonb_array_elements(current_setting('test.lf_after')::jsonb -> 'entrants') entry
    where entry ->> 'display_name' = 'Bo'),
  'lost',
  'with the SETTLEMENT AUTHORITY''s verdict, not a browser reading a scoreline');

select is(
  (select entry -> 'pick' ->> 'outcome'
     from jsonb_array_elements(current_setting('test.lf_after')::jsonb -> 'entrants') entry
    where (entry ->> 'is_me')::boolean),
  'won',
  'and the caller''s own verdict from the same authority');

select is(
  (select entry ->> 'has_picked'
     from jsonb_array_elements(current_setting('test.lf_after')::jsonb -> 'entrants') entry
    where entry ->> 'display_name' = 'Cyd'),
  'false',
  'an entrant who picked nothing is now visibly missing, which is the point of a field view');

select is(
  current_setting('test.lf_after')::jsonb -> 'field' ->> 'picked', '2',
  'and the picked count is released with them');

-- ---------------------------------------------------------------------------
-- WHO MAY SEE IT
-- ---------------------------------------------------------------------------

reset role;
select set_config('request.jwt.claims',
  json_build_object('sub', md5('lf-out')::uuid, 'role', 'authenticated',
                    'app_metadata', json_build_object())::text, true);
set local role authenticated;

select is(
  jsonb_array_length(
    public.get_season_lms_field(current_setting('test.lf_season')::uuid) -> 'entrants'),
  4,
  'an ELIMINATED entrant still sees the field — being knocked out is not being expelled');

reset role;
select set_config('request.jwt.claims',
  json_build_object('sub', md5('lf-stranger')::uuid, 'role', 'authenticated',
                    'app_metadata', json_build_object())::text, true);
set local role authenticated;

select is(
  jsonb_array_length(
    public.get_season_lms_field(current_setting('test.lf_season')::uuid) -> 'entrants'),
  0,
  'a non-entrant sees nobody');

-- Hides rather than refuses: "join to see the field" is a different message
-- from "you may not", and the player is entitled to know which.
select is(
  public.get_season_lms_field(current_setting('test.lf_season')::uuid) ->> 'available',
  'true',
  'and is told the competition exists rather than being refused, as contract 149 chose');

reset role;

select * from finish();

rollback;
