-- Contract 157: Follow, favourite team, onboarding progress and the pinned
-- rival.
--
-- THE ASSERTION THIS FILE EXISTS FOR is that following is not entering.
-- CLAUDE.md draws that line and `playerCompetitions.ts` has been reporting
-- `followed: 'unknown'` precisely because no authority existed; the risk in
-- closing that gap is closing it by quietly making a follow into a membership.
--
-- The second is that a pin cannot reach a stranger. `MIG-UI-09`'s boundary is
-- explicit — never user discovery — so the pin reuses contract 151's
-- shared-private-league test rather than inventing a looser one.

begin;

select plan(12);

insert into public.tournaments (name, year, competition_id, season_key, kind, display_timezone, status)
select 'C157 Preferences Probe', 2046, t.competition_id, 'pref-probe', 'league_season',
       t.display_timezone, 'active'
  from public.tournaments t where t.kind = 'league_season' order by t.name limit 1;

select set_config('test.pf_season',
  (select id::text from public.tournaments where season_key = 'pref-probe'), true);

insert into public.tournaments (name, year, competition_id, season_key, kind, display_timezone, status)
select 'C157 Other Probe', 2047, t.competition_id, 'pref-other', 'league_season',
       t.display_timezone, 'active'
  from public.tournaments t where t.kind = 'league_season' order by t.name limit 1;

insert into public.teams (tournament_id, name) values
  (current_setting('test.pf_season')::uuid, 'Iota FC');
insert into public.teams (tournament_id, name)
select id, 'Foreign FC' from public.tournaments where season_key = 'pref-other';

insert into public.bonus_competitions (
  id, tournament_id, game_key, published, availability_status,
  draw_required, visibility_kind, registration_opens_at
) values (
  md5('pf-mp')::uuid, current_setting('test.pf_season')::uuid,
  'main_predictor', true, 'active', false, 'public', now() - interval '1 day');

set local session_replication_role = replica;
insert into auth.users (id, email, aud, role, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
select md5('pf-u-' || n)::uuid, format('pf-%s@example.test', n),
       'authenticated', 'authenticated', '{}'::jsonb, '{}'::jsonb, now(), now()
from generate_series(1, 3) as n;
set local session_replication_role = origin;

insert into public.profiles (id, display_name, welcomed_at)
select md5('pf-u-' || n)::uuid, 'Pref Player ' || n, now() from generate_series(1, 3) as n;

-- Players 1 and 2 share a private league. Player 3 shares nothing.
insert into public.leagues (id, tournament_id, owner_id, name, invite_code, game_competition_id)
values (md5('pf-league')::uuid, current_setting('test.pf_season')::uuid,
        md5('pf-u-1')::uuid, 'Pref League', 'PRF001', md5('pf-mp')::uuid);

insert into public.league_members (league_id, user_id, role) values
  (md5('pf-league')::uuid, md5('pf-u-1')::uuid, 'owner'),
  (md5('pf-league')::uuid, md5('pf-u-2')::uuid, 'member')
on conflict do nothing;

select set_config('request.jwt.claims',
  json_build_object('sub', md5('pf-u-1')::uuid, 'role', 'authenticated',
                    'app_metadata', json_build_object())::text, true);
set local role authenticated;

-- ---------------------------------------------------------------------------
-- Following.
-- ---------------------------------------------------------------------------

select is(
  (public.set_competition_follow(
     current_setting('test.pf_season')::uuid, true,
     (select id from public.teams where tournament_id = current_setting('test.pf_season')::uuid))
   ->> 'following')::boolean,
  true,
  'a player can follow a competition and name a favourite team in it');

select is(
  jsonb_array_length(public.get_my_preferences() -> 'follows'),
  1,
  'and reads it back');

-- ---------------------------------------------------------------------------
-- THE CASE THIS FILE IS BUILT AROUND.
-- ---------------------------------------------------------------------------

select is(
  (select count(*)::integer from public.game_memberships where user_id = md5('pf-u-1')::uuid),
  0,
  'following created NO game membership');

select is(
  (select count(*)::integer from public.entries where user_id = md5('pf-u-1')::uuid),
  0,
  'and no entry, because following a competition is not entering a game');

select throws_ok(
  format($$select public.set_competition_follow(%L::uuid, true, %L::uuid)$$,
         current_setting('test.pf_season'),
         (select id from public.teams where name = 'Foreign FC')),
  '23514',
  null,
  'a favourite team from another competition is refused');

select is(
  (public.set_competition_follow(current_setting('test.pf_season')::uuid, false) ->> 'following')::boolean,
  false,
  'unfollowing removes it');

select is(
  jsonb_array_length(public.get_my_preferences() -> 'follows'),
  0,
  'and it is gone');

-- ---------------------------------------------------------------------------
-- Onboarding.
-- ---------------------------------------------------------------------------

select is(
  public.set_onboarding_progress('games') ->> 'step',
  'games',
  'onboarding progress is recorded');

select lives_ok(
  $$select public.set_onboarding_progress('done', true)$$,
  'and completion is recorded');

select set_config('test.pf_first_completion',
  (select onboarding_completed_at::text from public.profiles where id = md5('pf-u-1')::uuid), true);

select lives_ok(
  $$select public.set_onboarding_progress('competition', true)$$,
  'running onboarding again is allowed');

select is(
  (select onboarding_completed_at::text from public.profiles where id = md5('pf-u-1')::uuid),
  current_setting('test.pf_first_completion'),
  'but it does not rewrite when the player FIRST finished');

-- ---------------------------------------------------------------------------
-- The pin cannot reach a stranger.
-- ---------------------------------------------------------------------------

select throws_ok(
  format($$select public.set_pinned_rival(%L::uuid, %L::uuid)$$,
         current_setting('test.pf_season'), md5('pf-u-3')::uuid),
  '42501',
  null,
  'a player who shares no private league cannot be pinned, so a pin is not user discovery');

select * from finish();

rollback;
