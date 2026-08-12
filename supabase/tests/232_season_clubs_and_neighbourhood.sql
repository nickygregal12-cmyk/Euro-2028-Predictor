-- Contract 183: a season's clubs (`MIG-UI-16`) and the leaderboard
-- neighbourhood (`MIG-UI-18`).
--
-- THE TWO ASSERTIONS THIS FILE EXISTS FOR:
--
--   1. **A club with no fixture at all is still returned, with its stored
--      identity.** That is the one real failure mode of the two-read browser
--      join this contract replaces: it harvests identity from a fixture window,
--      so a club the window does not cover silently loses its stored short code
--      and colours and falls back to a derived one. A suite that seeded a
--      fixture for every club would pass against exactly that implementation.
--
--   2. **The neighbourhood and the paged leaderboard agree on position.** Two
--      reads answering "where am I" differently is invisible — both look
--      sorted — so the suite pages the leaderboard to the same entry and
--      requires the two positions to be equal. Copying an ORDER BY is not
--      evidence that it was copied correctly; running both is.

begin;

select plan(13);

insert into public.tournaments (name, year, competition_id, season_key, kind, display_timezone, status)
select 'C183 Clubs And Neighbours', 2065, t.competition_id, 'clubs-neighbours',
       'league_season', 'Europe/London', 'active'
  from public.tournaments t where t.kind = 'league_season' order by t.name limit 1;

select set_config('test.cn_season',
  (select id::text from public.tournaments where season_key = 'clubs-neighbours'), true);

-- Three clubs. Two play each other; the THIRD never appears in a fixture, and
-- it is the one assertion 3 is about.
insert into public.teams (id, tournament_id, name) values
  (md5('cn-t1')::uuid, current_setting('test.cn_season')::uuid, 'Arsenal'),
  (md5('cn-t2')::uuid, current_setting('test.cn_season')::uuid, 'Chelsea FC'),
  (md5('cn-t3')::uuid, current_setting('test.cn_season')::uuid, 'Aston Villa FC');

-- Contract 136's reference, keyed on contract 137's CORRECTED normaliser. Both
-- names below are exactly the ones contract 137 was written for: 'Chelsea FC'
-- normalised to 'chelse' and 'Aston Villa FC' to 'astonvill' before the fix.
--
-- `on conflict do nothing` MATTERS HERE AND IS NOT DEFENSIVE. Contract 136
-- already seeds all three of these clubs, so these inserts are no-ops on a real
-- rebuild and the assertions below read the OWNER-CONTROLLED reference rather
-- than one this file planted. That is the stronger test: it proves the function
-- returns the shipped identity, and it is why the expected colours below are
-- contract 136's values and not the ones written here. Written out anyway so
-- the suite still means something against a reference that has been reseeded.
insert into predictor_internal.club_identity_reference
  (normalised_name, short_code, club_colours, note)
values
  (predictor_internal.normalised_club_name('Arsenal'), 'ARS', 'Red / White', 'c183'),
  (predictor_internal.normalised_club_name('Chelsea FC'), 'CHE', 'Blue / White', 'c183'),
  (predictor_internal.normalised_club_name('Aston Villa FC'), 'AVL', 'Claret / Blue', 'c183')
on conflict (normalised_name) do nothing;

insert into public.competition_rounds (id, tournament_id, round_key, ordinal, kind, label)
values (md5('cn-r1')::uuid, current_setting('test.cn_season')::uuid,
        'cn-mw1', 1, 'league_matchweek', 'Matchweek 1');

-- Arsenal v Chelsea only. Aston Villa plays nobody, ever.
insert into public.season_fixtures (
  id, tournament_id, competition_round_id, home_team_id, away_team_id, kickoff_at, status)
values (md5('cn-fx1')::uuid, current_setting('test.cn_season')::uuid, md5('cn-r1')::uuid,
        md5('cn-t1')::uuid, md5('cn-t2')::uuid, now() + interval '3 days', 'scheduled');

insert into public.bonus_competitions (
  id, tournament_id, game_key, published, availability_status, draw_required,
  visibility_kind, registration_opens_at)
values (md5('cn-main')::uuid, current_setting('test.cn_season')::uuid, 'main_predictor',
        true, 'active', false, 'public', now() - interval '5 days');

-- Seven entrants on descending points, so the caller in the middle has three
-- above and three below and the window is genuinely symmetric.
set local session_replication_role = replica;
insert into auth.users (id, email, aud, role, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
select md5('cn-u' || n)::uuid, format('cn-u%s@example.test', n),
       'authenticated', 'authenticated', '{}'::jsonb, '{}'::jsonb, now(), now()
  from generate_series(1, 7) n;
set local session_replication_role = origin;

insert into public.profiles (id, display_name, welcomed_at)
select md5('cn-u' || n)::uuid, 'Player ' || n, now() from generate_series(1, 7) n;

insert into public.entries (id, user_id, tournament_id, game_competition_id)
select md5('cn-e' || n)::uuid, md5('cn-u' || n)::uuid,
       current_setting('test.cn_season')::uuid, md5('cn-main')::uuid
  from generate_series(1, 7) n;

-- Player 1 leads on 70, player 7 trails on 10.
insert into public.season_matchweek_scores
  (entry_id, tournament_id, competition_round_id, points, joker_applied,
   fixtures_scored, settled_at)
select md5('cn-e' || n)::uuid, current_setting('test.cn_season')::uuid,
       md5('cn-r1')::uuid, (80 - n * 10), false, 1, now() - interval '1 day'
  from generate_series(1, 7) n;

select set_config('request.jwt.claims',
  json_build_object('sub', md5('cn-u4')::uuid, 'role', 'authenticated',
                    'app_metadata', json_build_object())::text, true);
set local role authenticated;

-- ===========================================================================
-- MIG-UI-16 — the clubs read
-- ===========================================================================

select set_config('test.cn_clubs',
  public.get_season_clubs(current_setting('test.cn_season')::uuid)::text, true);

select is(
  jsonb_array_length(current_setting('test.cn_clubs')::jsonb), 3,
  'every club in the season is returned, including the one that plays nobody');

select is(
  (select entry ->> 'id'
     from jsonb_array_elements(current_setting('test.cn_clubs')::jsonb) entry
    where entry ->> 'name' = 'Arsenal'),
  md5('cn-t1')::uuid::text,
  'each carries the canonical teams.id that set_competition_follow takes');

-- THE ASSERTION. A club with no fixture keeps its STORED identity, which the
-- two-read browser join cannot do.
select is(
  (select entry ->> 'shortCode'
     from jsonb_array_elements(current_setting('test.cn_clubs')::jsonb) entry
    where entry ->> 'name' = 'Aston Villa FC'),
  'AVL',
  'a club with NO fixture still carries its stored short code, which the fixture-window join loses');

select is(
  (select entry ->> 'clubColours'
     from jsonb_array_elements(current_setting('test.cn_clubs')::jsonb) entry
    where entry ->> 'name' = 'Aston Villa FC'),
  'Claret / Sky Blue',
  'and its stored colours -- contract 136''s own seeded value, not one this file planted');

-- Contract 137's corrected normaliser, exercised on the two names it was
-- written for rather than on a synthetic one.
select is(
  (select entry ->> 'shortCode'
     from jsonb_array_elements(current_setting('test.cn_clubs')::jsonb) entry
    where entry ->> 'name' = 'Chelsea FC'),
  'CHE',
  'a name ending in FC resolves, which is the defect contract 137 fixed');

select ok(
  current_setting('test.cn_clubs')::jsonb::text not like '%Player %',
  'the clubs read names no player: it is football about clubs');

-- ===========================================================================
-- MIG-UI-18 — the neighbourhood
-- ===========================================================================

select set_config('test.cn_hood',
  public.get_season_leaderboard_neighbourhood(
    current_setting('test.cn_season')::uuid, 2)::text, true);

select is(
  current_setting('test.cn_hood')::jsonb -> 'you' ->> 'rank', '4',
  'the caller is found at their own rank without paging to it');

select is(
  jsonb_array_length(current_setting('test.cn_hood')::jsonb -> 'rows'), 5,
  'a window of two returns two above, two below and the caller: five rows in one request');

select is(
  (select entry ->> 'pointsFromYou'
     from jsonb_array_elements(current_setting('test.cn_hood')::jsonb -> 'rows') entry
    where (entry ->> 'rank')::integer = 3),
  '10',
  'and says how far ahead the player immediately above is, which is the sentence this read exists for');

select is(
  current_setting('test.cn_hood')::jsonb ->> 'totalCount', '7',
  'field size travels with it, so rank never stands alone');

-- THE DIFFERENTIAL ASSERTION. Copying an ORDER BY is not evidence it was
-- copied correctly; running both reads and comparing is.
select is(
  (select entry ->> 'position'
     from jsonb_array_elements(current_setting('test.cn_hood')::jsonb -> 'rows') entry
    where (entry ->> 'isYou')::boolean),
  (select entry ->> 'position'
     from jsonb_array_elements(
       public.get_season_leaderboard(current_setting('test.cn_season')::uuid, 100, null)::jsonb
         -> 'rows') entry
    where (entry ->> 'isYou')::boolean),
  'the neighbourhood and the paged leaderboard agree on the caller''s position');

-- A caller at the top gets fewer rows above and is TOLD so, rather than the
-- array being padded with players who do not exist.
reset role;
select set_config('request.jwt.claims',
  json_build_object('sub', md5('cn-u1')::uuid, 'role', 'authenticated',
                    'app_metadata', json_build_object())::text, true);
set local role authenticated;

select is(
  public.get_season_leaderboard_neighbourhood(
    current_setting('test.cn_season')::uuid, 3)::jsonb ->> 'atTop',
  'true',
  'the leader is told they are at the top rather than handed invented neighbours');

-- A player who entered nothing is refused, and identically to a season that
-- does not exist -- contract 95's boundary, reused rather than restated.
reset role;
set local session_replication_role = replica;
insert into auth.users (id, email, aud, role, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
values (md5('cn-out')::uuid, 'cn-out@example.test', 'authenticated', 'authenticated',
        '{}'::jsonb, '{}'::jsonb, now(), now());
set local session_replication_role = origin;
insert into public.profiles (id, display_name, welcomed_at)
values (md5('cn-out')::uuid, 'Outsider', now());

select set_config('request.jwt.claims',
  json_build_object('sub', md5('cn-out')::uuid, 'role', 'authenticated',
                    'app_metadata', json_build_object())::text, true);
set local role authenticated;

select throws_ok(
  format('select public.get_season_leaderboard_neighbourhood(%L::uuid, 3)',
         current_setting('test.cn_season')::uuid),
  '42501',
  null,
  'a player with no entry in this season cannot read its neighbourhood');

select * from finish();
rollback;
