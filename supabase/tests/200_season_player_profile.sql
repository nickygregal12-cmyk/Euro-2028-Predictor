-- Contract 151: one player's season, and what they predicted.
--
-- THE TWO ASSERTIONS THIS FILE EXISTS FOR are the disclosure boundaries, because
-- they are the only things here that can leak.
--
-- First: a stranger who shares the SEASON but no private league is refused. The
-- easy wrong implementation gates on the competition, which in a real league
-- season means every entrant can look up every other one.
--
-- Second: prediction detail appears only after that matchweek's own lock — and
-- a player's own profile is not gated by it, because those are their own picks.

begin;

select plan(14);

insert into public.tournaments (name, year, competition_id, season_key, kind, display_timezone, status)
select 'C151 Profile Probe', 2039, t.competition_id, 'pf-probe', 'league_season',
       t.display_timezone, 'active'
  from public.tournaments t where t.kind = 'league_season' order by t.name limit 1;

select set_config('test.pf_season',
  (select id::text from public.tournaments where season_key = 'pf-probe'), true);

insert into public.teams (tournament_id, name) values
  (current_setting('test.pf_season')::uuid, 'Chelsea FC'),
  (current_setting('test.pf_season')::uuid, 'Aston Villa FC');

insert into public.competition_rounds (tournament_id, round_key, ordinal, kind, label)
values (current_setting('test.pf_season')::uuid, 'pf-mw1', 1, 'league_matchweek', 'Matchweek 1'),
       (current_setting('test.pf_season')::uuid, 'pf-mw2', 2, 'league_matchweek', 'Matchweek 2');

select set_config('test.pf_mw1', (select id::text from public.competition_rounds
  where tournament_id = current_setting('test.pf_season')::uuid and round_key = 'pf-mw1'), true);
select set_config('test.pf_mw2', (select id::text from public.competition_rounds
  where tournament_id = current_setting('test.pf_season')::uuid and round_key = 'pf-mw2'), true);

-- Both matchweeks start ahead, so predictions are legal; matchweek 1 is moved
-- into the past below, exactly as contract 149's suite does.
insert into public.season_fixtures (
  tournament_id, competition_round_id, home_team_id, away_team_id, kickoff_at, status)
select current_setting('test.pf_season')::uuid, current_setting('test.pf_mw1')::uuid,
       (select id from public.teams where tournament_id = current_setting('test.pf_season')::uuid and name = 'Chelsea FC'),
       (select id from public.teams where tournament_id = current_setting('test.pf_season')::uuid and name = 'Aston Villa FC'),
       now() + interval '1 day', 'scheduled';

insert into public.season_fixtures (
  tournament_id, competition_round_id, home_team_id, away_team_id, kickoff_at, status)
select current_setting('test.pf_season')::uuid, current_setting('test.pf_mw2')::uuid,
       (select id from public.teams where tournament_id = current_setting('test.pf_season')::uuid and name = 'Aston Villa FC'),
       (select id from public.teams where tournament_id = current_setting('test.pf_season')::uuid and name = 'Chelsea FC'),
       now() + interval '6 days', 'scheduled';

select set_config('test.pf_fx1', (select id::text from public.season_fixtures
  where competition_round_id = current_setting('test.pf_mw1')::uuid), true);
select set_config('test.pf_fx2', (select id::text from public.season_fixtures
  where competition_round_id = current_setting('test.pf_mw2')::uuid), true);

insert into public.bonus_competitions (
  id, tournament_id, game_key, published, availability_status,
  draw_required, visibility_kind, registration_opens_at
) values (
  md5('pf-mp')::uuid, current_setting('test.pf_season')::uuid,
  'main_predictor', true, 'active', false, 'public', now() - interval '5 days');

set local session_replication_role = replica;
insert into auth.users (id, email, aud, role, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
select md5('pf-user-' || n)::uuid, format('pf-%s@example.test', n),
       'authenticated', 'authenticated', '{}'::jsonb, '{}'::jsonb, now(), now()
from generate_series(1, 3) as n;
set local session_replication_role = origin;

insert into public.profiles (id, display_name, welcomed_at) values
  (md5('pf-user-1')::uuid, 'Subject One', now()),
  (md5('pf-user-2')::uuid, 'Team Mate', now()),
  (md5('pf-user-3')::uuid, 'Stranger Three', now());

-- All three entered the SAME season. Only 1 and 2 share a private league, which
-- is the distinction the boundary turns on.
insert into public.entries (id, user_id, tournament_id, game_competition_id)
select md5('pf-entry-' || n)::uuid, md5('pf-user-' || n)::uuid,
       current_setting('test.pf_season')::uuid, md5('pf-mp')::uuid
from generate_series(1, 3) as n;

insert into public.leagues (id, tournament_id, owner_id, name, invite_code, game_competition_id)
values (md5('pf-league')::uuid, current_setting('test.pf_season')::uuid,
        md5('pf-user-1')::uuid, 'Profile Probe League', 'PF0001', md5('pf-mp')::uuid);

insert into public.league_members (league_id, user_id, role) values
  (md5('pf-league')::uuid, md5('pf-user-1')::uuid, 'owner'),
  (md5('pf-league')::uuid, md5('pf-user-2')::uuid, 'member')
on conflict do nothing;

-- Subject predicts both matchweeks while both are open. Matchweek 1 is an exact
-- score; matchweek 2 stays hidden from a co-member because it has not locked.
insert into public.season_predictions (tournament_id, entry_id, season_fixture_id, home_score, away_score)
values (current_setting('test.pf_season')::uuid, md5('pf-entry-1')::uuid,
        current_setting('test.pf_fx1')::uuid, 2, 1),
       (current_setting('test.pf_season')::uuid, md5('pf-entry-1')::uuid,
        current_setting('test.pf_fx2')::uuid, 3, 0);

insert into public.season_matchweek_jokers (tournament_id, entry_id, competition_round_id)
values (current_setting('test.pf_season')::uuid, md5('pf-entry-1')::uuid,
        current_setting('test.pf_mw1')::uuid);

-- Matchweek 1 locks and settles with the subject's exact score correct.
set local session_replication_role = replica;
update public.season_fixtures
   set kickoff_at = now() - interval '3 hours', status = 'played', home_score = 2, away_score = 1
 where id = current_setting('test.pf_fx1')::uuid;
set local session_replication_role = origin;

insert into public.season_matchweek_scores
  (tournament_id, entry_id, competition_round_id, points, fixtures_scored, settled_at)
values (current_setting('test.pf_season')::uuid, md5('pf-entry-1')::uuid,
        current_setting('test.pf_mw1')::uuid, 14, 1, now() - interval '1 hour');

-- ---------------------------------------------------------------------------
-- The boundary a co-member sees.
-- ---------------------------------------------------------------------------

select set_config('request.jwt.claims',
  json_build_object('sub', md5('pf-user-2')::uuid, 'role', 'authenticated',
                    'app_metadata', json_build_object())::text, true);
set local role authenticated;

select set_config('test.pf_seen',
  public.get_season_player_profile(
    current_setting('test.pf_season')::uuid, md5('pf-user-1')::uuid)::text, true);

select is(
  current_setting('test.pf_seen')::jsonb -> 'player' ->> 'display_name',
  'Subject One',
  'a private-league co-member may see the player');

select is(
  (current_setting('test.pf_seen')::jsonb -> 'player' ->> 'is_self')::boolean,
  false,
  'and is told it is not their own profile');

select is(
  current_setting('test.pf_seen')::jsonb -> 'season' ->> 'points',
  '14',
  'season points come from the banked authority');

select is(
  current_setting('test.pf_seen')::jsonb -> 'accuracy' ->> 'exact_scores',
  '1',
  'an exact score is counted');

select is(
  current_setting('test.pf_seen')::jsonb -> 'accuracy' ->> 'correct_outcomes',
  '1',
  'and so is the outcome it also got right');

select is(
  current_setting('test.pf_seen')::jsonb -> 'jokers' ->> 'played',
  '1',
  'the Joker summary counts the matchweek it was played on');

-- The reveal boundary: matchweek 1 has locked, matchweek 2 has not.
select is(
  jsonb_array_length(current_setting('test.pf_seen')::jsonb -> 'history'),
  1,
  'a co-member sees only matchweeks that have locked');

select is(
  current_setting('test.pf_seen')::jsonb -> 'history' -> 0 ->> 'label',
  'Matchweek 1',
  'and that matchweek is the locked one');

select is(
  current_setting('test.pf_seen')::jsonb -> 'history' -> 0 -> 'predictions'
    -> current_setting('test.pf_fx1') ->> 'home',
  '2',
  'with the prediction itself, now that it may be shown');

-- ---------------------------------------------------------------------------
-- The player's own profile is not gated by the lock.
-- ---------------------------------------------------------------------------

reset role;
select set_config('request.jwt.claims',
  json_build_object('sub', md5('pf-user-1')::uuid, 'role', 'authenticated',
                    'app_metadata', json_build_object())::text, true);
set local role authenticated;

select is(
  jsonb_array_length(public.get_season_player_profile(
    current_setting('test.pf_season')::uuid, md5('pf-user-1')::uuid) -> 'history'),
  2,
  'a player sees their own unlocked matchweek, because those are their own picks');

select is(
  (public.get_season_player_profile(
    current_setting('test.pf_season')::uuid, md5('pf-user-1')::uuid)
    -> 'player' ->> 'is_self')::boolean,
  true,
  'and their own profile is marked as such');

-- ---------------------------------------------------------------------------
-- The refusal that matters.
-- ---------------------------------------------------------------------------

reset role;
select set_config('request.jwt.claims',
  json_build_object('sub', md5('pf-user-3')::uuid, 'role', 'authenticated',
                    'app_metadata', json_build_object())::text, true);
set local role authenticated;

select throws_ok(
  format($$select public.get_season_player_profile(%L::uuid, %L::uuid)$$,
         current_setting('test.pf_season'), md5('pf-user-1')::uuid),
  '42501',
  null,
  'sharing the SEASON is not enough: a stranger with no shared private league is refused');

select throws_ok(
  format($$select public.get_season_player_profile(%L::uuid,
            '00000000-0000-0000-0000-000000000008'::uuid)$$,
         current_setting('test.pf_season')),
  '42501',
  null,
  'and an unknown player is refused by the same boundary rather than probed for');

-- A co-member who never entered is a real answer, not an error.
reset role;
insert into public.league_members (league_id, user_id, role)
values (md5('pf-league')::uuid, md5('pf-user-3')::uuid, 'member')
on conflict do nothing;
delete from public.entries where id = md5('pf-entry-3')::uuid;

select set_config('request.jwt.claims',
  json_build_object('sub', md5('pf-user-1')::uuid, 'role', 'authenticated',
                    'app_metadata', json_build_object())::text, true);
set local role authenticated;

select is(
  (public.get_season_player_profile(
    current_setting('test.pf_season')::uuid, md5('pf-user-3')::uuid) ->> 'entered')::boolean,
  false,
  'a league member who never entered the game reports no season rather than failing');

select * from finish();

rollback;
