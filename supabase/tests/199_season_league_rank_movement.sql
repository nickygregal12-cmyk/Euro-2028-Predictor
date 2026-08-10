-- Contract 150: how a league table moved over one settled matchweek.
--
-- THE CASE THIS FILE IS BUILT AROUND is an overtake with a postponed matchweek
-- in it. Player A leads after matchweek 1; player B wins matchweek 2 and goes
-- ahead. Matchweek 3 is played and scored but NOT settled, and matchweek 2 was
-- postponed so it settled AFTER matchweek 3's row was created.
--
-- That shape kills two implementations at once: one that orders by `settled_at`
-- puts matchweek 2 after matchweek 3 and reports the wrong before-table, and one
-- that counts any scored row rather than a settled one lets matchweek 3 move
-- players who have not finished being scored.

begin;

select plan(12);

insert into public.tournaments (name, year, competition_id, season_key, kind, display_timezone, status)
select 'C150 Movement Probe', 2038, t.competition_id, 'mv-probe', 'league_season',
       t.display_timezone, 'active'
  from public.tournaments t where t.kind = 'league_season' order by t.name limit 1;

select set_config('test.mv_season',
  (select id::text from public.tournaments where season_key = 'mv-probe'), true);

insert into public.competition_rounds (tournament_id, round_key, ordinal, kind, label)
values (current_setting('test.mv_season')::uuid, 'mv-mw1', 1, 'league_matchweek', 'Matchweek 1'),
       (current_setting('test.mv_season')::uuid, 'mv-mw2', 2, 'league_matchweek', 'Matchweek 2'),
       (current_setting('test.mv_season')::uuid, 'mv-mw3', 3, 'league_matchweek', 'Matchweek 3');

select set_config('test.mv_mw1', (select id::text from public.competition_rounds
  where tournament_id = current_setting('test.mv_season')::uuid and round_key = 'mv-mw1'), true);
select set_config('test.mv_mw2', (select id::text from public.competition_rounds
  where tournament_id = current_setting('test.mv_season')::uuid and round_key = 'mv-mw2'), true);
select set_config('test.mv_mw3', (select id::text from public.competition_rounds
  where tournament_id = current_setting('test.mv_season')::uuid and round_key = 'mv-mw3'), true);

insert into public.bonus_competitions (
  id, tournament_id, game_key, published, availability_status,
  draw_required, visibility_kind, registration_opens_at
) values (
  md5('mv-mp')::uuid, current_setting('test.mv_season')::uuid,
  'main_predictor', true, 'active', false, 'public', now() - interval '5 days');

set local session_replication_role = replica;
insert into auth.users (id, email, aud, role, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
select md5('mv-user-' || n)::uuid, format('mv-%s@example.test', n),
       'authenticated', 'authenticated', '{}'::jsonb, '{}'::jsonb, now(), now()
from generate_series(1, 3) as n;
set local session_replication_role = origin;

insert into public.profiles (id, display_name, welcomed_at) values
  (md5('mv-user-1')::uuid, 'Alpha Mv', now()),
  (md5('mv-user-2')::uuid, 'Bravo Mv', now()),
  (md5('mv-user-3')::uuid, 'Charlie Mv', now());

insert into public.entries (id, user_id, tournament_id, game_competition_id)
select md5('mv-entry-' || n)::uuid, md5('mv-user-' || n)::uuid,
       current_setting('test.mv_season')::uuid, md5('mv-mp')::uuid
from generate_series(1, 3) as n;

insert into public.leagues (id, tournament_id, owner_id, name, invite_code, game_competition_id)
values (md5('mv-league')::uuid, current_setting('test.mv_season')::uuid,
        md5('mv-user-1')::uuid, 'Movement Probe League', 'MV0001', md5('mv-mp')::uuid);

insert into public.league_members (league_id, user_id, role) values
  (md5('mv-league')::uuid, md5('mv-user-1')::uuid, 'owner'),
  (md5('mv-league')::uuid, md5('mv-user-2')::uuid, 'member'),
  (md5('mv-league')::uuid, md5('mv-user-3')::uuid, 'member')
on conflict do nothing;

-- Matchweek 1: Alpha 20, Bravo 5, Charlie 5. Alpha leads.
-- Matchweek 2: Alpha 1, Bravo 30, Charlie 2. Bravo overtakes.
--   Settled LATER than matchweek 3's row was created, because it was postponed.
-- Matchweek 3: scored but NOT settled. It must move nobody.
insert into public.season_matchweek_scores
  (tournament_id, entry_id, competition_round_id, points, fixtures_scored, settled_at)
values
  (current_setting('test.mv_season')::uuid, md5('mv-entry-1')::uuid, current_setting('test.mv_mw1')::uuid, 20, 10, now() - interval '9 days'),
  (current_setting('test.mv_season')::uuid, md5('mv-entry-2')::uuid, current_setting('test.mv_mw1')::uuid,  5, 10, now() - interval '9 days'),
  (current_setting('test.mv_season')::uuid, md5('mv-entry-3')::uuid, current_setting('test.mv_mw1')::uuid,  5, 10, now() - interval '9 days'),
  (current_setting('test.mv_season')::uuid, md5('mv-entry-1')::uuid, current_setting('test.mv_mw2')::uuid,  1, 10, now() - interval '1 day'),
  (current_setting('test.mv_season')::uuid, md5('mv-entry-2')::uuid, current_setting('test.mv_mw2')::uuid, 30, 10, now() - interval '1 day'),
  (current_setting('test.mv_season')::uuid, md5('mv-entry-3')::uuid, current_setting('test.mv_mw2')::uuid,  2, 10, now() - interval '1 day'),
  (current_setting('test.mv_season')::uuid, md5('mv-entry-1')::uuid, current_setting('test.mv_mw3')::uuid, 99, 10, null),
  (current_setting('test.mv_season')::uuid, md5('mv-entry-2')::uuid, current_setting('test.mv_mw3')::uuid,  0, 10, null),
  (current_setting('test.mv_season')::uuid, md5('mv-entry-3')::uuid, current_setting('test.mv_mw3')::uuid,  0, 10, null);

select set_config('request.jwt.claims',
  json_build_object('sub', md5('mv-user-1')::uuid, 'role', 'authenticated',
                    'app_metadata', json_build_object())::text, true);
set local role authenticated;

-- ---------------------------------------------------------------------------
-- The case this file is built around.
-- ---------------------------------------------------------------------------

select set_config('test.mv_result',
  public.get_season_league_rank_movement(
    md5('mv-league')::uuid, current_setting('test.mv_mw2')::uuid)::text, true);

select is(
  (current_setting('test.mv_result')::jsonb ->> 'settled')::boolean,
  true,
  'a settled matchweek reports movement');

select is(
  (select entry->>'rank_before' from jsonb_array_elements(
     current_setting('test.mv_result')::jsonb -> 'members') entry
    where entry->>'display_name' = 'Bravo Mv'),
  '2',
  'Bravo was second before matchweek 2');

select is(
  (select entry->>'rank_after' from jsonb_array_elements(
     current_setting('test.mv_result')::jsonb -> 'members') entry
    where entry->>'display_name' = 'Bravo Mv'),
  '1',
  'and first after it');

select is(
  (select entry->>'movement' from jsonb_array_elements(
     current_setting('test.mv_result')::jsonb -> 'members') entry
    where entry->>'display_name' = 'Bravo Mv'),
  '1',
  'so the movement is a climb of one, stated as a signed number');

select is(
  (select entry->>'movement' from jsonb_array_elements(
     current_setting('test.mv_result')::jsonb -> 'members') entry
    where entry->>'display_name' = 'Alpha Mv'),
  '-1',
  'and the player overtaken fell by one');

-- The unsettled matchweek 3 must not be counted in the after-table, even though
-- Alpha has 99 points sitting in it.
select is(
  (select entry->>'points_after' from jsonb_array_elements(
     current_setting('test.mv_result')::jsonb -> 'members') entry
    where entry->>'display_name' = 'Alpha Mv'),
  '21',
  'an unsettled matchweek contributes nothing, however many points it holds');

select is(
  (select entry->>'points_before' from jsonb_array_elements(
     current_setting('test.mv_result')::jsonb -> 'members') entry
    where entry->>'display_name' = 'Alpha Mv'),
  '20',
  'and the before-table is the matchweeks ordered before this one');

select is(
  (select entry->>'points_this_matchweek' from jsonb_array_elements(
     current_setting('test.mv_result')::jsonb -> 'members') entry
    where entry->>'display_name' = 'Bravo Mv'),
  '30',
  'the matchweek''s own points are reported alongside the totals');

select is(
  (select entry->>'gap_to_leader_after' from jsonb_array_elements(
     current_setting('test.mv_result')::jsonb -> 'members') entry
    where entry->>'display_name' = 'Alpha Mv'),
  '14',
  'the gap to the leader is measured after the matchweek');

-- ---------------------------------------------------------------------------
-- Defaulting, refusals and the unsettled case.
-- ---------------------------------------------------------------------------

select is(
  public.get_season_league_rank_movement(md5('mv-league')::uuid)
    -> 'matchweek' ->> 'label',
  'Matchweek 2',
  'with no matchweek named it uses the most recent SETTLED one, not the latest');

select is(
  (public.get_season_league_rank_movement(
     md5('mv-league')::uuid, current_setting('test.mv_mw3')::uuid) ->> 'settled')::boolean,
  false,
  'an unsettled matchweek is answered honestly rather than refused');

reset role;
select set_config('request.jwt.claims',
  json_build_object('sub', md5('mv-user-1')::uuid, 'role', 'authenticated',
                    'app_metadata', json_build_object())::text, true);
set local role authenticated;

select throws_ok(
  format($$select public.get_season_league_rank_movement(%L::uuid,
            '00000000-0000-0000-0000-000000000007'::uuid)$$, md5('mv-league')::uuid),
  '22023', null,
  'a matchweek from another season is named as such');

select * from finish();

rollback;
