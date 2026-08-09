-- Contract 141: recent form and head-to-head, from football we already hold.
--
-- THE ASSERTION THIS FILE EXISTS FOR is that the derivation reads a result from
-- the right club's perspective. A form table that silently swaps home and away
-- is wrong in a way no error surfaces: every count is plausible, every total
-- adds up, and only the clubs disagree with reality.
--
-- So the seed is asymmetric on purpose -- one club wins at home and loses away
-- against the same opponent -- and both sides are asserted. A swapped
-- perspective makes the two clubs identical, which the mirror assertion below
-- catches.

begin;

select plan(10);

insert into public.tournaments (name, year, competition_id, season_key, kind, display_timezone, status)
select 'C141 Form Probe', 2036, t.competition_id, 'frm-probe', 'league_season',
       t.display_timezone, 'active'
  from public.tournaments t where t.kind = 'league_season' order by t.name limit 1;

select set_config('test.frm_season',
  (select id::text from public.tournaments where season_key = 'frm-probe'), true);

-- Real club names, so the contract 136/137 identity join is exercised too.
insert into public.teams (tournament_id, name) values
  (current_setting('test.frm_season')::uuid, 'Chelsea FC'),
  (current_setting('test.frm_season')::uuid, 'Aston Villa FC'),
  (current_setting('test.frm_season')::uuid, 'Nowhere Rovers');

insert into public.competition_rounds (tournament_id, round_key, ordinal, kind, label)
values (current_setting('test.frm_season')::uuid, 'frm-mw1', 1, 'league_matchweek', 'Matchweek 1'),
       (current_setting('test.frm_season')::uuid, 'frm-mw2', 2, 'league_matchweek', 'Matchweek 2');

select set_config('test.frm_chelsea',
  (select id::text from public.teams where tournament_id = current_setting('test.frm_season')::uuid
    and name = 'Chelsea FC'), true);
select set_config('test.frm_villa',
  (select id::text from public.teams where tournament_id = current_setting('test.frm_season')::uuid
    and name = 'Aston Villa FC'), true);

-- Chelsea win 3-1 at home, then lose 0-2 away. Same opponent both times.
insert into public.season_fixtures
  (tournament_id, competition_round_id, home_team_id, away_team_id, kickoff_at, status, home_score, away_score)
values
  (current_setting('test.frm_season')::uuid,
   (select id from public.competition_rounds where tournament_id = current_setting('test.frm_season')::uuid and round_key = 'frm-mw1'),
   current_setting('test.frm_chelsea')::uuid, current_setting('test.frm_villa')::uuid,
   now() - interval '9 days', 'played', 3, 1),
  (current_setting('test.frm_season')::uuid,
   (select id from public.competition_rounds where tournament_id = current_setting('test.frm_season')::uuid and round_key = 'frm-mw2'),
   current_setting('test.frm_villa')::uuid, current_setting('test.frm_chelsea')::uuid,
   now() - interval '2 days', 'played', 2, 0),
  -- A postponed fixture with no score must contribute nothing at all.
  (current_setting('test.frm_season')::uuid,
   (select id from public.competition_rounds where tournament_id = current_setting('test.frm_season')::uuid and round_key = 'frm-mw2'),
   current_setting('test.frm_chelsea')::uuid,
   (select id from public.teams where tournament_id = current_setting('test.frm_season')::uuid and name = 'Nowhere Rovers'),
   now() - interval '1 days', 'postponed', null, null);

set local session_replication_role = replica;
insert into auth.users (id, email, aud, role, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
values (md5('frm-user')::uuid, 'frm@example.test', 'authenticated', 'authenticated',
        '{}'::jsonb, '{}'::jsonb, now(), now());
set local session_replication_role = origin;

select set_config('request.jwt.claims',
  json_build_object('sub', md5('frm-user')::uuid, 'role', 'authenticated',
                    'app_metadata', json_build_object())::text, true);
set local role authenticated;

-- ---------------------------------------------------------------------------
-- Form, from each club's own perspective.
-- ---------------------------------------------------------------------------

select is(
  (select club->'form'
     from jsonb_array_elements(
       public.get_season_club_form(current_setting('test.frm_season')::uuid) -> 'clubs') club
    where club->>'name' = 'Chelsea FC'),
  '["L", "W"]'::jsonb,
  'Chelsea lost most recently and won before it -- most recent first');

select is(
  (select club->'form'
     from jsonb_array_elements(
       public.get_season_club_form(current_setting('test.frm_season')::uuid) -> 'clubs') club
    where club->>'name' = 'Aston Villa FC'),
  '["W", "L"]'::jsonb,
  'and Aston Villa is the exact mirror -- a swapped perspective would make these '
  'two identical');

select is(
  (select (club->>'goals_for')::integer || '-' || (club->>'goals_against')::integer
     from jsonb_array_elements(
       public.get_season_club_form(current_setting('test.frm_season')::uuid) -> 'clubs') club
    where club->>'name' = 'Chelsea FC'),
  '3-3',
  'Chelsea scored three and conceded three across the two');

select is(
  (select (club->>'goals_for')::integer || '-' || (club->>'goals_against')::integer
     from jsonb_array_elements(
       public.get_season_club_form(current_setting('test.frm_season')::uuid) -> 'clubs') club
    where club->>'name' = 'Aston Villa FC'),
  '3-3',
  'and Villa the same, from the other side');

select is(
  (select (club->>'played')::integer
     from jsonb_array_elements(
       public.get_season_club_form(current_setting('test.frm_season')::uuid) -> 'clubs') club
    where club->>'name' = 'Nowhere Rovers'),
  0,
  'a club whose only fixture was postponed has played nothing -- a postponed '
  'match is not a nil-nil');

select is(
  (select club->'form'
     from jsonb_array_elements(
       public.get_season_club_form(current_setting('test.frm_season')::uuid) -> 'clubs') club
    where club->>'name' = 'Nowhere Rovers'),
  '[]'::jsonb,
  'and it appears with an empty sequence rather than being absent, because a '
  'missing row would read as a missing club');

select is(
  (select club->>'short_code'
     from jsonb_array_elements(
       public.get_season_club_form(current_setting('test.frm_season')::uuid) -> 'clubs') club
    where club->>'name' = 'Chelsea FC'),
  'CHE',
  'club identity travels with the form row');

-- ---------------------------------------------------------------------------
-- Head-to-head.
-- ---------------------------------------------------------------------------

select is(
  (public.get_season_club_head_to_head(
     current_setting('test.frm_season')::uuid,
     current_setting('test.frm_chelsea')::uuid,
     current_setting('test.frm_villa')::uuid) -> 'summary' ->> 'played')::integer,
  2,
  'the two clubs have met twice');

select is(
  (public.get_season_club_head_to_head(
     current_setting('test.frm_season')::uuid,
     current_setting('test.frm_chelsea')::uuid,
     current_setting('test.frm_villa')::uuid)
   -> 'meetings' -> 0 ->> 'outcome'),
  'L',
  'and the most recent meeting is listed first, from the named club''s side');

select throws_ok(
  format('select public.get_season_club_head_to_head(%L::uuid, %L::uuid, %L::uuid)',
         current_setting('test.frm_season'), current_setting('test.frm_chelsea'),
         current_setting('test.frm_chelsea')),
  '22023',
  null,
  'a club cannot play itself');

reset role;

select finish();
rollback;
