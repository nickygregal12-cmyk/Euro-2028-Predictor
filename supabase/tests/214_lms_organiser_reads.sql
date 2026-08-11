-- Contract 165: what a private Last Man Standing organiser can see.
--
-- THE ASSERTION THIS FILE EXISTS FOR is that an organiser sees THAT an entrant
-- has picked and never WHAT. Owning a competition is not a reveal exemption,
-- and one built in here would be the exemption every other contract in this
-- repository is written to avoid. A test checking only that the read works
-- would pass against an implementation that returned the club.
--
-- The second is that "not yours" and "does not exist" refuse IDENTICALLY.
-- Distinguishing them turns the read into a probe for which competition ids are
-- real, which is the shape `SEC-001` named on `get_league_preview`.

begin;

select plan(14);

insert into public.tournaments (name, year, competition_id, season_key, kind, display_timezone, status)
select 'C165 Organiser', 2050, t.competition_id, 'organiser', 'league_season',
       'Europe/London', 'active'
  from public.tournaments t where t.kind = 'league_season' order by t.name limit 1;

select set_config('test.og_season',
  (select id::text from public.tournaments where season_key = 'organiser'), true);

insert into public.teams (id, tournament_id, name) values
  (md5('og-t1')::uuid, current_setting('test.og_season')::uuid, 'Organiser Rovers'),
  (md5('og-t2')::uuid, current_setting('test.og_season')::uuid, 'Organiser United');

set local session_replication_role = replica;
insert into auth.users (id, email, aud, role, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
select md5('og-' || who)::uuid, format('og-%s@example.test', who),
       'authenticated', 'authenticated', '{}'::jsonb, '{}'::jsonb, now(), now()
  from unnest(array['own', 'p1', 'p2', 'nosy']) as who;
set local session_replication_role = origin;

insert into public.profiles (id, display_name, welcomed_at) values
  (md5('og-own')::uuid, 'Olive Owner', now()),
  (md5('og-p1')::uuid, 'Pat', now()),
  (md5('og-p2')::uuid, 'Quinn', now()),
  (md5('og-nosy')::uuid, 'Nosy', now());

insert into public.bonus_competitions (
  id, tournament_id, game_key, name, owner_id, invite_code, published,
  availability_status, draw_required, visibility_kind, registration_opens_at)
values
  (md5('og-priv')::uuid, current_setting('test.og_season')::uuid, 'last_man_standing',
   'Olive''s Cup', md5('og-own')::uuid, 'OGCODE123456', true, 'active', false,
   'private', now() - interval '10 days'),
  (md5('og-pub')::uuid, current_setting('test.og_season')::uuid, 'last_man_standing',
   null, null, null, true, 'active', false, 'public', now() - interval '10 days');

insert into public.season_lms_setups (
  competition_id, lives, saves, draws_rule, endgame_scope, endgame_on_wipeout)
-- `reset`, not `restart`: `season_lms_setups_wipeout_allowed` admits exactly
-- `play_on`, `shared_win` and `reset`. A private scope MUST name one, which is
-- what `season_lms_setups_wipeout_matches_scope` enforces.
values (md5('og-priv')::uuid, 1, 1, 'eliminate', 'private', 'reset');

insert into public.bonus_competition_entrants (competition_id, user_id, outcome) values
  (md5('og-priv')::uuid, md5('og-own')::uuid, 'active'),
  (md5('og-priv')::uuid, md5('og-p1')::uuid, 'active'),
  (md5('og-priv')::uuid, md5('og-p2')::uuid, 'eliminated');

insert into public.season_lms_entrant_state (competition_id, user_id, lives_remaining, saves_remaining) values
  (md5('og-priv')::uuid, md5('og-own')::uuid, 1, 1),
  (md5('og-priv')::uuid, md5('og-p1')::uuid, 1, 0),
  (md5('og-priv')::uuid, md5('og-p2')::uuid, 0, 0);

insert into public.game_memberships (tournament_id, game_competition_id, user_id, status) values
  (current_setting('test.og_season')::uuid, md5('og-priv')::uuid, md5('og-own')::uuid, 'active'),
  (current_setting('test.og_season')::uuid, md5('og-priv')::uuid, md5('og-p1')::uuid, 'active'),
  (current_setting('test.og_season')::uuid, md5('og-priv')::uuid, md5('og-p2')::uuid, 'active');

-- An OPEN round. Olive has picked; Pat has not. The round is deliberately still
-- open, because that is when the organiser's question and the reveal boundary
-- are in tension.
insert into public.bonus_competition_windows (id, competition_id, sequence, label, opens_at, locks_at)
values (md5('og-w5')::uuid, md5('og-priv')::uuid, 5, 'Round 5',
        now() - interval '1 day', now() + interval '2 days');

insert into public.bonus_lms_selections (competition_id, user_id, window_id, team_id)
values (md5('og-priv')::uuid, md5('og-own')::uuid, md5('og-w5')::uuid, md5('og-t1')::uuid);

-- ---------------------------------------------------------------------------

select set_config('request.jwt.claims',
  json_build_object('sub', md5('og-own')::uuid, 'role', 'authenticated',
                    'app_metadata', json_build_object())::text, true);
set local role authenticated;

select set_config('test.og_view',
  public.get_my_organised_competition(md5('og-priv')::uuid)::text, true);

select is(
  (select count(*)::integer
     from jsonb_array_elements(current_setting('test.og_view')::jsonb -> 'entrants') entry),
  3,
  'the organiser sees every entrant');

select is(
  current_setting('test.og_view')::jsonb -> 'counts' ->> 'awaiting_pick', '1',
  'and how many are yet to pick in the round in play, which is the chase list''s size');

select is(
  (select entry ->> 'has_picked_current_round'
     from jsonb_array_elements(current_setting('test.og_view')::jsonb -> 'entrants') entry
    where entry ->> 'display_name' = 'Pat'),
  'false',
  'an entrant who has not picked is identified, because chasing them is the organiser''s job');

-- THE ASSERTION THIS FILE EXISTS FOR.
select ok(
  current_setting('test.og_view') !~ 'Organiser Rovers'
  and current_setting('test.og_view') !~ 'Organiser United',
  'AND NO CLUB NAME APPEARS ANYWHERE — owning a competition is not a reveal exemption');

select is(
  current_setting('test.og_view')::jsonb ->> 'organiser_commands_available', '[]',
  'no organiser command is offered, because no accepted authority grants one');

select is(
  current_setting('test.og_view')::jsonb -> 'competition' ->> 'invite_code', 'OGCODE123456',
  'the organiser sees their own invite code, which is theirs to re-share');

select is(
  current_setting('test.og_view')::jsonb -> 'setup' ->> 'endgame_on_wipeout', 'reset',
  'and the setup they fixed at creation');

select is(
  current_setting('test.og_view')::jsonb -> 'counts' ->> 'eliminated', '1',
  'eliminations are counted');

-- ---------------------------------------------------------------------------
-- THE SECOND ASSERTION: refusals must be indistinguishable.
-- ---------------------------------------------------------------------------

reset role;
select set_config('request.jwt.claims',
  json_build_object('sub', md5('og-nosy')::uuid, 'role', 'authenticated',
                    'app_metadata', json_build_object())::text, true);
set local role authenticated;

select throws_ok(
  format($$select public.get_my_organised_competition(%L::uuid)$$, md5('og-priv')::uuid),
  'P0002', 'No such competition',
  'a competition that is not yours refuses');

select throws_ok(
  $$select public.get_my_organised_competition('00000000-0000-0000-0000-0000000000aa'::uuid)$$,
  'P0002', 'No such competition',
  'and one that does not exist refuses with the SAME message, so ids cannot be probed');

-- An entrant is not an organiser.
reset role;
select set_config('request.jwt.claims',
  json_build_object('sub', md5('og-p1')::uuid, 'role', 'authenticated',
                    'app_metadata', json_build_object())::text, true);
set local role authenticated;

select throws_ok(
  format($$select public.get_my_organised_competition(%L::uuid)$$, md5('og-priv')::uuid),
  'P0002', null,
  'an ordinary entrant cannot read the organiser view of a competition they play in');

-- A public competition has no organiser in this sense.
reset role;
select set_config('request.jwt.claims',
  json_build_object('sub', md5('og-own')::uuid, 'role', 'authenticated',
                    'app_metadata', json_build_object())::text, true);
set local role authenticated;

select throws_ok(
  format($$select public.get_my_organised_competition(%L::uuid)$$, md5('og-pub')::uuid),
  'P0002', null,
  'a PUBLIC competition is organised by nobody: it belongs to the platform');

select is(
  (public.get_my_organised_competitions(25, 0) ->> 'total')::integer, 1,
  'the list holds the caller''s own private container and not the public one');

select is(
  (public.get_my_organised_competitions(1000000, 0) ->> 'limit')::integer, 50,
  'and its page size is clamped server-side');

reset role;

select * from finish();

rollback;
