-- Contract 155: one code entry point, for every container.
--
-- THE ASSERTION THIS FILE EXISTS FOR is that an unknown code, a malformed code
-- and a code that is real are not distinguishable beyond `found`. A resolver
-- that answered "invalid" to one and "not found" to another would let someone
-- work through the alphabet learning which codes are real.
--
-- The second is that it resolves and does not join: asking about a code must
-- leave the caller outside whatever it names.

begin;

select plan(11);

insert into public.tournaments (name, year, competition_id, season_key, kind, display_timezone, status)
select 'C155 Resolver Probe', 2044, t.competition_id, 'res-probe', 'league_season',
       t.display_timezone, 'active'
  from public.tournaments t where t.kind = 'league_season' order by t.name limit 1;

select set_config('test.rs_season',
  (select id::text from public.tournaments where season_key = 'res-probe'), true);

insert into public.teams (tournament_id, name) values
  (current_setting('test.rs_season')::uuid, 'Epsilon FC'),
  (current_setting('test.rs_season')::uuid, 'Zeta FC');

insert into public.competition_rounds (tournament_id, round_key, ordinal, kind, label)
values (current_setting('test.rs_season')::uuid, 'res-mw1', 1, 'league_matchweek', 'Matchweek 1');

insert into public.season_fixtures (
  tournament_id, competition_round_id, home_team_id, away_team_id, kickoff_at, status)
select current_setting('test.rs_season')::uuid,
       (select id from public.competition_rounds where tournament_id = current_setting('test.rs_season')::uuid),
       (select id from public.teams where tournament_id = current_setting('test.rs_season')::uuid and name = 'Epsilon FC'),
       (select id from public.teams where tournament_id = current_setting('test.rs_season')::uuid and name = 'Zeta FC'),
       now() + interval '2 days', 'scheduled';

insert into public.bonus_competitions (
  id, tournament_id, game_key, published, availability_status,
  draw_required, visibility_kind, registration_opens_at
) values (
  md5('rs-public-mp')::uuid, current_setting('test.rs_season')::uuid,
  'main_predictor', true, 'active', false, 'public', now() - interval '1 day');

set local session_replication_role = replica;
insert into auth.users (id, email, aud, role, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
select md5('rs-user-' || n)::uuid, format('rs-%s@example.test', n),
       'authenticated', 'authenticated', '{}'::jsonb, '{}'::jsonb, now(), now()
from generate_series(1, 2) as n;
set local session_replication_role = origin;

insert into public.profiles (id, display_name, welcomed_at) values
  (md5('rs-user-1')::uuid, 'Resolver Owner', now()),
  (md5('rs-user-2')::uuid, 'Resolver Stranger', now());

insert into public.leagues (id, tournament_id, owner_id, name, invite_code, game_competition_id)
values (md5('rs-league')::uuid, current_setting('test.rs_season')::uuid,
        md5('rs-user-1')::uuid, 'Resolver League', 'RSL001', md5('rs-public-mp')::uuid);

insert into public.league_members (league_id, user_id, role)
values (md5('rs-league')::uuid, md5('rs-user-1')::uuid, 'owner')
on conflict do nothing;

-- A private competition, made the way a player makes one.
select set_config('request.jwt.claims',
  json_build_object('sub', md5('rs-user-1')::uuid, 'role', 'authenticated',
                    'app_metadata', json_build_object())::text, true);
set local role authenticated;

select set_config('test.rs_created',
  public.create_private_season_lms(
    current_setting('test.rs_season')::uuid, 'Resolver Cup')::text, true);
select set_config('test.rs_code',
  current_setting('test.rs_created')::jsonb ->> 'invite_code', true);

-- ---------------------------------------------------------------------------
-- One entry point, two destinations.
-- ---------------------------------------------------------------------------

reset role;
select set_config('request.jwt.claims',
  json_build_object('sub', md5('rs-user-2')::uuid, 'role', 'authenticated',
                    'app_metadata', json_build_object())::text, true);
set local role authenticated;

select is(
  public.resolve_invite_code('RSL001') ->> 'kind',
  'league',
  'a league code resolves as a league');

select is(
  public.resolve_invite_code('RSL001') ->> 'join_with',
  'join_league',
  'and names the write that joins it');

select is(
  (public.resolve_invite_code('RSL001') ->> 'requires_game_entry')::boolean,
  true,
  'a caller with no entry in the league''s game is told so before they try');

select is(
  public.resolve_invite_code(current_setting('test.rs_code')) ->> 'kind',
  'competition',
  'a private competition code resolves as a competition');

select is(
  public.resolve_invite_code(current_setting('test.rs_code')) ->> 'game_key',
  'last_man_standing',
  'and says which game it runs, which the code alone never could');

select is(
  public.resolve_invite_code(current_setting('test.rs_code')) ->> 'join_with',
  'join_private_competition',
  'and names its own, different, write');

-- ---------------------------------------------------------------------------
-- THE CASE THIS FILE IS BUILT AROUND.
-- ---------------------------------------------------------------------------

select is(
  (public.resolve_invite_code('ZZZZZZ') ->> 'found')::boolean,
  false,
  'an unknown code is not found');

select is(
  (public.resolve_invite_code('nope!!') ->> 'found')::boolean,
  false,
  'and a malformed code answers identically rather than saying it is invalid');

select is(
  (select jsonb_object_keys(public.resolve_invite_code('ZZZZZZ')) limit 1),
  'found',
  'a miss returns nothing at all beyond that one word');

-- ---------------------------------------------------------------------------
-- Resolving is not joining.
-- ---------------------------------------------------------------------------

select is(
  (select count(*)::integer from public.game_memberships
    where user_id = md5('rs-user-2')::uuid),
  0,
  'resolving a competition code joined nobody');

select is(
  (select count(*)::integer from public.league_members
    where user_id = md5('rs-user-2')::uuid),
  0,
  'and resolving a league code joined nobody either');

select * from finish();

rollback;
