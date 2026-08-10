-- Contract 153: a private Last Man Standing, created, invited and joined.
--
-- THE ASSERTION THIS FILE EXISTS FOR is the one that was a hole until this
-- contract: joining a private competition BY ITS ID must be refused. A
-- competition id is not a secret, and before the refusal existed anyone
-- holding one could have joined somebody's private competition without ever
-- seeing the code.
--
-- The second thing it protects is the extraction. The membership rules moved
-- into `predictor_internal.enter_competition_game`, so the public path is
-- driven here too — a private competition that works while the public one
-- silently stopped rejoining correctly would be a bad trade.

begin;

select plan(14);

insert into public.tournaments (name, year, competition_id, season_key, kind, display_timezone, status)
select 'C153 Private LMS Probe', 2041, t.competition_id, 'plms-probe', 'league_season',
       t.display_timezone, 'active'
  from public.tournaments t where t.kind = 'league_season' order by t.name limit 1;

select set_config('test.pl_season',
  (select id::text from public.tournaments where season_key = 'plms-probe'), true);

insert into public.tournaments (name, year, competition_id, season_key, kind, display_timezone, status)
select 'C153 Draft Probe', 2042, t.competition_id, 'plms-draft', 'league_season',
       t.display_timezone, 'draft'
  from public.tournaments t where t.kind = 'league_season' order by t.name limit 1;

insert into public.teams (tournament_id, name) values
  (current_setting('test.pl_season')::uuid, 'Alpha FC'),
  (current_setting('test.pl_season')::uuid, 'Beta FC');

insert into public.competition_rounds (tournament_id, round_key, ordinal, kind, label)
values (current_setting('test.pl_season')::uuid, 'plms-mw1', 1, 'league_matchweek', 'Matchweek 1'),
       (current_setting('test.pl_season')::uuid, 'plms-mw2', 2, 'league_matchweek', 'Matchweek 2');

insert into public.season_fixtures (
  tournament_id, competition_round_id, home_team_id, away_team_id, kickoff_at, status)
select current_setting('test.pl_season')::uuid, r.id,
       (select id from public.teams where tournament_id = current_setting('test.pl_season')::uuid and name = 'Alpha FC'),
       (select id from public.teams where tournament_id = current_setting('test.pl_season')::uuid and name = 'Beta FC'),
       now() + (r.ordinal || ' days')::interval, 'scheduled'
  from public.competition_rounds r
 where r.tournament_id = current_setting('test.pl_season')::uuid;

-- A PUBLIC competition on the same season, so the regression half has
-- something to prove against.
insert into public.bonus_competitions (
  id, tournament_id, game_key, published, availability_status,
  draw_required, visibility_kind, registration_opens_at
) values (
  md5('pl-public-mp')::uuid, current_setting('test.pl_season')::uuid,
  'main_predictor', true, 'active', false, 'public', now() - interval '1 day');

set local session_replication_role = replica;
insert into auth.users (id, email, aud, role, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
select md5('pl-user-' || n)::uuid, format('pl-%s@example.test', n),
       'authenticated', 'authenticated', '{}'::jsonb, '{}'::jsonb, now(), now()
from generate_series(1, 2) as n;
set local session_replication_role = origin;

insert into public.profiles (id, display_name, welcomed_at) values
  (md5('pl-user-1')::uuid, 'Organiser', now()),
  (md5('pl-user-2')::uuid, 'Invitee', now());

-- ---------------------------------------------------------------------------
-- The organiser creates one.
-- ---------------------------------------------------------------------------

select set_config('request.jwt.claims',
  json_build_object('sub', md5('pl-user-1')::uuid, 'role', 'authenticated',
                    'app_metadata', json_build_object())::text, true);
set local role authenticated;

select set_config('test.pl_created',
  public.create_private_season_lms(
    current_setting('test.pl_season')::uuid, 'Friday Night Club',
    1::smallint, 1::smallint, 'survive', 'shared_win')::text, true);

select set_config('test.pl_competition',
  current_setting('test.pl_created')::jsonb ->> 'competition_id', true);
select set_config('test.pl_code',
  current_setting('test.pl_created')::jsonb ->> 'invite_code', true);

select matches(
  current_setting('test.pl_code'),
  '^[A-Z0-9]{6}$',
  'creating a private competition issues an invite code of the shared shape');

-- The role convention in this file, from here on. What a PLAYER can do is
-- asserted as `authenticated`; what the DATABASE now holds is asserted as the
-- session role. `bonus_competitions` and `season_lms_setups` are revoked from
-- every browser role — contract 152 keeps it that way deliberately — so reading
-- them to verify a write is a job for the session role, not for the player.
reset role;

select is(
  (select count(*)::integer from public.bonus_competitions
    where id = current_setting('test.pl_competition')::uuid
      and visibility_kind = 'private' and published = false
      and owner_id = md5('pl-user-1')::uuid and name = 'Friday Night Club'),
  1,
  'the competition is private, unpublished, named and owned by its creator');

select is(
  (select jsonb_build_object('lives', lives, 'saves', saves, 'draws', draws_rule,
                             'scope', endgame_scope, 'wipeout', endgame_on_wipeout)
     from public.season_lms_setups
    where competition_id = current_setting('test.pl_competition')::uuid),
  jsonb_build_object('lives', 1, 'saves', 1, 'draws', 'survive',
                     'scope', 'private', 'wipeout', 'shared_win'),
  'the organiser''s own rules are stored, not the public Classic ones');

select cmp_ok(
  (current_setting('test.pl_created')::jsonb ->> 'windows')::integer,
  '>', 0,
  'and the calendar comes from the same generator the public competition uses');

select is(
  (select count(*)::integer from public.game_memberships
    where game_competition_id = current_setting('test.pl_competition')::uuid
      and user_id = md5('pl-user-1')::uuid and status = 'active'),
  1,
  'the organiser is entered in their own competition');

-- ---------------------------------------------------------------------------
-- THE CASE THIS FILE IS BUILT AROUND.
-- ---------------------------------------------------------------------------

reset role;
select set_config('request.jwt.claims',
  json_build_object('sub', md5('pl-user-2')::uuid, 'role', 'authenticated',
                    'app_metadata', json_build_object())::text, true);
set local role authenticated;

select throws_ok(
  format($$select public.join_competition_game(%L::uuid)$$,
         current_setting('test.pl_competition')),
  '42501',
  null,
  'a private competition CANNOT be joined by its id, which a URL hands out freely');

reset role;
select is(
  (select count(*)::integer from public.game_memberships
    where game_competition_id = current_setting('test.pl_competition')::uuid
      and user_id = md5('pl-user-2')::uuid),
  0,
  'and the refusal left no membership behind');

set local role authenticated;
select lives_ok(
  format($$select public.join_private_competition(%L)$$, current_setting('test.pl_code')),
  'the same player joins with the code');

reset role;
select is(
  (select count(*)::integer from public.game_memberships
    where game_competition_id = current_setting('test.pl_competition')::uuid
      and user_id = md5('pl-user-2')::uuid and status = 'active'),
  1,
  'and is entered by it');

-- ---------------------------------------------------------------------------
-- The code namespace does not leak across container kinds.
-- ---------------------------------------------------------------------------

reset role;
insert into public.leagues (id, tournament_id, owner_id, name, invite_code, game_competition_id)
values (md5('pl-league')::uuid, current_setting('test.pl_season')::uuid,
        md5('pl-user-1')::uuid, 'A League', 'LGE777', md5('pl-public-mp')::uuid);

select set_config('request.jwt.claims',
  json_build_object('sub', md5('pl-user-2')::uuid, 'role', 'authenticated',
                    'app_metadata', json_build_object())::text, true);
set local role authenticated;

select throws_ok(
  $$select public.join_private_competition('LGE777')$$,
  'P0002',
  null,
  'a LEAGUE code is refused by the competition join, and told apart from nothing');

select throws_ok(
  $$select public.join_private_competition('ZZZZZZ')$$,
  'P0002',
  null,
  'an unknown code is refused identically, so a code cannot be probed for');

-- ---------------------------------------------------------------------------
-- The public path still works, because the rules only moved.
-- ---------------------------------------------------------------------------

select lives_ok(
  format($$select public.join_competition_game(%L::uuid)$$, md5('pl-public-mp')::uuid),
  'a PUBLIC competition is still joined by its id exactly as before');

reset role;
select is(
  (select count(*)::integer from public.entries
    where game_competition_id = md5('pl-public-mp')::uuid
      and user_id = md5('pl-user-2')::uuid),
  1,
  'and the prediction entry the extracted authority owes it is still written');

-- Back to the player: creating a competition reads `auth.uid()`, so this must
-- refuse for the season being a draft rather than for there being no caller.
set local role authenticated;

-- ---------------------------------------------------------------------------
-- A season nobody has published is not a foundation for a competition.
-- ---------------------------------------------------------------------------

select throws_ok(
  format($$select public.create_private_season_lms(%L::uuid, 'Too Early')$$,
         (select id from public.tournaments where season_key = 'plms-draft')),
  '55000',
  null,
  'a draft season cannot carry a private competition');

select * from finish();

rollback;
