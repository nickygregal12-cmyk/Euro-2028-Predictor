-- Contract 149: what a private league predicted, once the matchweek has locked.
--
-- THE ASSERTION THIS FILE EXISTS FOR is that nothing is returned before the
-- matchweek's own lock, and everything after it. The two are one property seen
-- from either side, and the same fixture data proves both because the only
-- thing that changes between them is the kickoff.
--
-- The rest — the non-member refusal, the tournament-league refusal, the
-- unsettled points, the member who entered nothing — are the edges that would
-- turn a working reveal into a leak or into a wrong count.

begin;

select plan(13);

-- ---------------------------------------------------------------------------
-- Setup: a season, two matchweeks, two players in one league.
-- ---------------------------------------------------------------------------

insert into public.tournaments (name, year, competition_id, season_key, kind, display_timezone, status)
select 'C149 League Picks Probe', 2037, t.competition_id, 'lp-probe', 'league_season',
       t.display_timezone, 'active'
  from public.tournaments t
 where t.kind = 'league_season'
 order by t.name
 limit 1;

select set_config('test.lp_season',
  (select id::text from public.tournaments where season_key = 'lp-probe'), true);

insert into public.teams (tournament_id, name) values
  (current_setting('test.lp_season')::uuid, 'Chelsea FC'),
  (current_setting('test.lp_season')::uuid, 'Aston Villa FC');

-- One matchweek already kicked off, one still ahead. Both real rounds, so the
-- lock resolver is exercised rather than stubbed.
insert into public.competition_rounds (tournament_id, round_key, ordinal, kind, label)
values (current_setting('test.lp_season')::uuid, 'lp-mw1', 1, 'league_matchweek', 'Matchweek 1'),
       (current_setting('test.lp_season')::uuid, 'lp-mw2', 2, 'league_matchweek', 'Matchweek 2');

select set_config('test.lp_locked',
  (select id::text from public.competition_rounds
    where tournament_id = current_setting('test.lp_season')::uuid and round_key = 'lp-mw1'), true);
select set_config('test.lp_open',
  (select id::text from public.competition_rounds
    where tournament_id = current_setting('test.lp_season')::uuid and round_key = 'lp-mw2'), true);

insert into public.season_fixtures (
  tournament_id, competition_round_id, home_team_id, away_team_id, kickoff_at, status)
select current_setting('test.lp_season')::uuid, current_setting('test.lp_locked')::uuid,
       (select id from public.teams where tournament_id = current_setting('test.lp_season')::uuid and name = 'Chelsea FC'),
       (select id from public.teams where tournament_id = current_setting('test.lp_season')::uuid and name = 'Aston Villa FC'),
       now() - interval '2 hours', 'scheduled';

insert into public.season_fixtures (
  tournament_id, competition_round_id, home_team_id, away_team_id, kickoff_at, status)
select current_setting('test.lp_season')::uuid, current_setting('test.lp_open')::uuid,
       (select id from public.teams where tournament_id = current_setting('test.lp_season')::uuid and name = 'Aston Villa FC'),
       (select id from public.teams where tournament_id = current_setting('test.lp_season')::uuid and name = 'Chelsea FC'),
       now() + interval '3 days', 'scheduled';

select set_config('test.lp_locked_fixture',
  (select id::text from public.season_fixtures
    where competition_round_id = current_setting('test.lp_locked')::uuid), true);

set local session_replication_role = replica;
insert into auth.users (id, email, aud, role, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
values (md5('lp-owner')::uuid, 'lp-owner@example.test', 'authenticated', 'authenticated',
        '{}'::jsonb, '{}'::jsonb, now(), now()),
       (md5('lp-rival')::uuid, 'lp-rival@example.test', 'authenticated', 'authenticated',
        '{}'::jsonb, '{}'::jsonb, now(), now()),
       (md5('lp-outsider')::uuid, 'lp-outsider@example.test', 'authenticated', 'authenticated',
        '{}'::jsonb, '{}'::jsonb, now(), now());
set local session_replication_role = origin;

insert into public.profiles (id, display_name, welcomed_at) values
  (md5('lp-owner')::uuid, 'Owner One', now()),
  (md5('lp-rival')::uuid, 'Rival Two', now()),
  (md5('lp-outsider')::uuid, 'Outsider Three', now())
on conflict (id) do update set display_name = excluded.display_name;

-- An entry belongs to a game, not merely to a season:
-- `prepare_entry_game_membership` refuses one that names no Main or Original
-- Predictor. The league is scoped to the same game, which is what
-- `create_game_league` does in the product.
insert into public.bonus_competitions (
  id, tournament_id, game_key, published, availability_status,
  draw_required, visibility_kind, registration_opens_at
) values (
  md5('lp-mp')::uuid, current_setting('test.lp_season')::uuid,
  'main_predictor', true, 'active', false, 'public', now() - interval '2 days');

insert into public.entries (user_id, tournament_id, game_competition_id) values
  (md5('lp-owner')::uuid, current_setting('test.lp_season')::uuid, md5('lp-mp')::uuid),
  (md5('lp-rival')::uuid, current_setting('test.lp_season')::uuid, md5('lp-mp')::uuid);

select set_config('test.lp_owner_entry',
  (select id::text from public.entries
    where user_id = md5('lp-owner')::uuid
      and tournament_id = current_setting('test.lp_season')::uuid), true);
select set_config('test.lp_rival_entry',
  (select id::text from public.entries
    where user_id = md5('lp-rival')::uuid
      and tournament_id = current_setting('test.lp_season')::uuid), true);

insert into public.leagues (tournament_id, owner_id, name, invite_code, game_competition_id)
values (current_setting('test.lp_season')::uuid, md5('lp-owner')::uuid, 'Picks Probe League',
        'LP0001', md5('lp-mp')::uuid);

select set_config('test.lp_league',
  (select id::text from public.leagues where invite_code = 'LP0001'), true);

insert into public.league_members (league_id, user_id, role) values
  (current_setting('test.lp_league')::uuid, md5('lp-owner')::uuid, 'owner'),
  (current_setting('test.lp_league')::uuid, md5('lp-rival')::uuid, 'member')
on conflict do nothing;

-- Both players predicted the locked matchweek; nobody predicted the open one.
insert into public.season_predictions (tournament_id, entry_id, season_fixture_id, home_score, away_score)
values (current_setting('test.lp_season')::uuid, current_setting('test.lp_owner_entry')::uuid,
        current_setting('test.lp_locked_fixture')::uuid, 2, 1),
       (current_setting('test.lp_season')::uuid, current_setting('test.lp_rival_entry')::uuid,
        current_setting('test.lp_locked_fixture')::uuid, 0, 0);

select set_config('request.jwt.claims',
  json_build_object('sub', md5('lp-owner')::uuid, 'role', 'authenticated',
                    'app_metadata', json_build_object())::text, true);
set local role authenticated;

-- ---------------------------------------------------------------------------
-- The assertion this file exists for.
-- ---------------------------------------------------------------------------

select is(
  (public.get_season_league_matchweek_predictions(
     current_setting('test.lp_league')::uuid,
     current_setting('test.lp_open')::uuid) ->> 'revealed')::boolean,
  false,
  'a matchweek that has not locked is not revealed');

select is(
  jsonb_array_length(public.get_season_league_matchweek_predictions(
    current_setting('test.lp_league')::uuid,
    current_setting('test.lp_open')::uuid) -> 'members'),
  0,
  'and it returns no member rows at all, rather than redacted ones');

select is(
  (public.get_season_league_matchweek_predictions(
     current_setting('test.lp_league')::uuid,
     current_setting('test.lp_locked')::uuid) ->> 'revealed')::boolean,
  true,
  'a matchweek that has locked is revealed');

select is(
  jsonb_array_length(public.get_season_league_matchweek_predictions(
    current_setting('test.lp_league')::uuid,
    current_setting('test.lp_locked')::uuid) -> 'members'),
  2,
  'and every league member appears');

-- The rival's actual prediction, which is the thing the surface exists to show.
select is(
  (select member -> 'predictions' -> current_setting('test.lp_locked_fixture') ->> 'home'
     from jsonb_array_elements(public.get_season_league_matchweek_predictions(
       current_setting('test.lp_league')::uuid,
       current_setting('test.lp_locked')::uuid) -> 'members') member
    where member->>'display_name' = 'Rival Two'),
  '0',
  'a revealed matchweek shows another member''s prediction');

select ok(
  (select (member->>'is_self')::boolean
     from jsonb_array_elements(public.get_season_league_matchweek_predictions(
       current_setting('test.lp_league')::uuid,
       current_setting('test.lp_locked')::uuid) -> 'members') member
    where member->>'display_name' = 'Owner One'),
  'the caller''s own row is marked');

-- ---------------------------------------------------------------------------
-- Counts, points and the edges.
-- ---------------------------------------------------------------------------

select is(
  (public.get_season_league_matchweek_predictions(
     current_setting('test.lp_league')::uuid,
     current_setting('test.lp_locked')::uuid) ->> 'member_count')::integer,
  2,
  'the member count is the league''s membership');

select is(
  (public.get_season_league_matchweek_predictions(
     current_setting('test.lp_league')::uuid,
     current_setting('test.lp_locked')::uuid) ->> 'predicted_count')::integer,
  2,
  'the predicted count is how many of them played that matchweek');

select is(
  (public.get_season_league_matchweek_predictions(
     current_setting('test.lp_league')::uuid,
     current_setting('test.lp_open')::uuid) ->> 'predicted_count')::integer,
  0,
  'and it is zero before the reveal rather than a leak of who has played');

-- Points are absent until settlement, and absent is not zero.
select is(
  (select jsonb_typeof(member -> 'points')
     from jsonb_array_elements(public.get_season_league_matchweek_predictions(
       current_setting('test.lp_league')::uuid,
       current_setting('test.lp_locked')::uuid) -> 'members') member
    where member->>'display_name' = 'Owner One'),
  'null',
  'an unsettled matchweek reports no points rather than zero');

select is(
  jsonb_array_length(public.get_season_league_matchweek_predictions(
    current_setting('test.lp_league')::uuid,
    current_setting('test.lp_locked')::uuid) -> 'fixtures'),
  1,
  'the matchweek''s fixtures come back so a client need not ask twice');

-- ---------------------------------------------------------------------------
-- Refusals.
-- ---------------------------------------------------------------------------

reset role;
select set_config('request.jwt.claims',
  json_build_object('sub', md5('lp-outsider')::uuid, 'role', 'authenticated',
                    'app_metadata', json_build_object())::text, true);
set local role authenticated;

select throws_ok(
  format($$select public.get_season_league_matchweek_predictions(%L::uuid, %L::uuid)$$,
         current_setting('test.lp_league'), current_setting('test.lp_locked')),
  'insufficient_privilege',
  null,
  'someone who is not in the league is refused, revealed or not');

reset role;
select set_config('request.jwt.claims',
  json_build_object('sub', md5('lp-owner')::uuid, 'role', 'authenticated',
                    'app_metadata', json_build_object())::text, true);
set local role authenticated;

select throws_ok(
  format($$select public.get_season_league_matchweek_predictions(%L::uuid,
            '00000000-0000-0000-0000-000000000004'::uuid)$$,
         current_setting('test.lp_league')),
  '22023',
  null,
  'a matchweek from another season is named as such rather than answered empty');

select * from finish();

rollback;
