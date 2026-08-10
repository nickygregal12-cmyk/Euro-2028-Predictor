-- Contract 152: the private container's identity, and the shared invite-code
-- namespace.
--
-- THE ASSERTION THIS FILE EXISTS FOR is the cross-table one: a code held by a
-- league cannot be issued to a private competition, and vice versa. Two
-- independent unique constraints would pass every other test in this file and
-- fail that one, which is exactly why the registry exists.

begin;

select plan(13);

insert into public.tournaments (name, year, competition_id, season_key, kind, display_timezone, status)
select 'C152 Namespace Probe', 2040, t.competition_id, 'ns-probe', 'league_season',
       t.display_timezone, 'active'
  from public.tournaments t where t.kind = 'league_season' order by t.name limit 1;

select set_config('test.ns_season',
  (select id::text from public.tournaments where season_key = 'ns-probe'), true);

set local session_replication_role = replica;
insert into auth.users (id, email, aud, role, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
values (md5('ns-user-1')::uuid, 'ns-1@example.test', 'authenticated', 'authenticated',
        '{}'::jsonb, '{}'::jsonb, now(), now());
set local session_replication_role = origin;

insert into public.profiles (id, display_name, welcomed_at)
values (md5('ns-user-1')::uuid, 'Namespace Owner', now());

insert into public.bonus_competitions (
  id, tournament_id, game_key, published, availability_status,
  draw_required, visibility_kind, registration_opens_at
) values (
  md5('ns-public-mp')::uuid, current_setting('test.ns_season')::uuid,
  'main_predictor', true, 'active', false, 'public', now() - interval '1 day');

-- ---------------------------------------------------------------------------
-- The identity columns exist and are gated on visibility.
-- ---------------------------------------------------------------------------

select has_column('public', 'bonus_competitions', 'name', 'a competition can be named');
select has_column('public', 'bonus_competitions', 'owner_id', 'a competition can be owned');
select has_column('public', 'bonus_competitions', 'invite_code', 'a competition can carry a code');

select throws_ok(
  format($$insert into public.bonus_competitions (
             tournament_id, game_key, published, availability_status,
             draw_required, visibility_kind)
           values (%L::uuid, 'last_man_standing', false, 'inactive', false, 'private')$$,
         current_setting('test.ns_season')),
  '23514',
  null,
  'a private competition with no name, owner or code is refused');

select throws_ok(
  format($$insert into public.bonus_competitions (
             tournament_id, game_key, published, availability_status,
             draw_required, visibility_kind, name, owner_id, invite_code)
           values (%L::uuid, 'main_predictor', true, 'active', false, 'public',
                   'Not Allowed', %L::uuid, 'PUB111')$$,
         current_setting('test.ns_season'), md5('ns-user-1')::uuid),
  '23514',
  null,
  'and a PUBLIC competition carrying a private identity is refused just as hard');

-- ---------------------------------------------------------------------------
-- A private competition registers its code.
-- ---------------------------------------------------------------------------

insert into public.bonus_competitions (
  id, tournament_id, game_key, published, availability_status,
  draw_required, visibility_kind, name, owner_id, invite_code
) values (
  md5('ns-private-lms')::uuid, current_setting('test.ns_season')::uuid,
  'last_man_standing', false, 'inactive', false, 'private',
  'The Office Sweepstake', md5('ns-user-1')::uuid, 'PRV001');

select is(
  (select competition_id from public.invite_code_registry where code = 'PRV001'),
  md5('ns-private-lms')::uuid,
  'a private competition''s code is registered against it');

-- ---------------------------------------------------------------------------
-- THE CASE THIS FILE IS BUILT AROUND: one namespace, not two.
-- ---------------------------------------------------------------------------

insert into public.leagues (id, tournament_id, owner_id, name, invite_code, game_competition_id)
values (md5('ns-league')::uuid, current_setting('test.ns_season')::uuid,
        md5('ns-user-1')::uuid, 'Namespace League', 'LEG001', md5('ns-public-mp')::uuid);

select is(
  (select league_id from public.invite_code_registry where code = 'LEG001'),
  md5('ns-league')::uuid,
  'a league''s code is registered against it by the same namespace');

select throws_ok(
  format($$insert into public.bonus_competitions (
             tournament_id, game_key, published, availability_status,
             draw_required, visibility_kind, name, owner_id, invite_code)
           values (%L::uuid, 'last_man_standing', false, 'inactive', false, 'private',
                   'Code Thief', %L::uuid, 'LEG001')$$,
         current_setting('test.ns_season'), md5('ns-user-1')::uuid),
  '23505',
  null,
  'a private competition CANNOT take a code a league already holds');

select throws_ok(
  format($$insert into public.leagues (tournament_id, owner_id, name, invite_code, game_competition_id)
           values (%L::uuid, %L::uuid, 'Reverse Thief', 'PRV001', %L::uuid)$$,
         current_setting('test.ns_season'), md5('ns-user-1')::uuid, md5('ns-public-mp')::uuid),
  '23505',
  null,
  'and a league cannot take a code a private competition already holds');

-- ---------------------------------------------------------------------------
-- The namespace stays true as rows change.
-- ---------------------------------------------------------------------------

delete from public.bonus_competitions where id = md5('ns-private-lms')::uuid;

select is(
  (select count(*)::integer from public.invite_code_registry where code = 'PRV001'),
  0,
  'deleting a private competition releases its code back to the namespace');

select lives_ok(
  format($$insert into public.leagues (tournament_id, owner_id, name, invite_code, game_competition_id)
           values (%L::uuid, %L::uuid, 'Now Free', 'PRV001', %L::uuid)$$,
         current_setting('test.ns_season'), md5('ns-user-1')::uuid, md5('ns-public-mp')::uuid),
  'and the released code can then be issued to a league');

-- ---------------------------------------------------------------------------
-- The namespace is not browser-reachable.
-- ---------------------------------------------------------------------------

select is(
  (select count(*)::integer from information_schema.table_privileges
    where table_schema = 'public' and table_name = 'invite_code_registry'
      and grantee in ('anon', 'authenticated', 'PUBLIC')),
  0,
  'the registry grants nothing to a browser role, so codes cannot be enumerated');

select is(
  (select count(*)::integer from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'predictor_internal'
      and p.proname in ('allocate_invite_code', 'register_league_invite_code',
                        'register_competition_invite_code')),
  3,
  'the allocator and both registrars are internal');

select * from finish();

rollback;
