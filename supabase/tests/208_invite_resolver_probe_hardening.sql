-- Contract 159: the universal resolver stops being the cheap door.
--
-- THE ASSERTIONS THIS FILE EXISTS FOR are the two that a source-only check
-- would miss, and that contract 158 could not have made because the container
-- kinds this covers did not exist when its finding was written.
--
-- First: probing through the RESOLVER draws on the same budget as probing
-- through the PREVIEW. Two limiters at twenty a minute would be forty attempts
-- a minute wearing two well-behaved faces in the limiter log, and a per-function
-- assertion would pass on both. Only a cross-function assertion catches it.
--
-- Second: the member count is gone for a PRIVATE COMPETITION and not only for a
-- league. `SEC-001` named the field on `get_league_preview`; contracts 153 and
-- 154 then created two more container kinds that the same field identified just
-- as precisely.

begin;

select plan(17);

-- ---------------------------------------------------------------------------
-- A season, a league with a code, and a private competition with one.
-- The same fixture shape as `204_universal_invite_resolver.sql`, because this
-- contract narrows that function and the two must not drift apart.
-- ---------------------------------------------------------------------------

insert into public.tournaments (name, year, competition_id, season_key, kind, display_timezone, status)
select 'C159 Probe Hardening', 2045, t.competition_id, 'probe-hard', 'league_season',
       t.display_timezone, 'active'
  from public.tournaments t where t.kind = 'league_season' order by t.name limit 1;

select set_config('test.ph_season',
  (select id::text from public.tournaments where season_key = 'probe-hard'), true);

insert into public.teams (tournament_id, name) values
  (current_setting('test.ph_season')::uuid, 'Probe Rovers'),
  (current_setting('test.ph_season')::uuid, 'Probe Athletic');

insert into public.competition_rounds (tournament_id, round_key, ordinal, kind, label)
values (current_setting('test.ph_season')::uuid, 'ph-mw1', 1, 'league_matchweek', 'Matchweek 1');

insert into public.season_fixtures (
  tournament_id, competition_round_id, home_team_id, away_team_id, kickoff_at, status)
select current_setting('test.ph_season')::uuid,
       (select id from public.competition_rounds where tournament_id = current_setting('test.ph_season')::uuid),
       (select id from public.teams where tournament_id = current_setting('test.ph_season')::uuid and name = 'Probe Rovers'),
       (select id from public.teams where tournament_id = current_setting('test.ph_season')::uuid and name = 'Probe Athletic'),
       now() + interval '2 days', 'scheduled';

insert into public.bonus_competitions (
  id, tournament_id, game_key, published, availability_status,
  draw_required, visibility_kind, registration_opens_at
) values (
  md5('ph-public-mp')::uuid, current_setting('test.ph_season')::uuid,
  'main_predictor', true, 'active', false, 'public', now() - interval '1 day');

set local session_replication_role = replica;
insert into auth.users (id, email, aud, role, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
select md5('ph-user-' || n)::uuid, format('ph-%s@example.test', n),
       'authenticated', 'authenticated', '{}'::jsonb, '{}'::jsonb, now(), now()
from generate_series(1, 3) as n;
set local session_replication_role = origin;

insert into public.profiles (id, display_name, welcomed_at) values
  (md5('ph-user-1')::uuid, 'Probe Owner', now()),
  (md5('ph-user-2')::uuid, 'Probe Stranger', now()),
  (md5('ph-user-3')::uuid, 'Probe Budget', now());

insert into public.leagues (id, tournament_id, owner_id, name, invite_code, game_competition_id)
values (md5('ph-league')::uuid, current_setting('test.ph_season')::uuid,
        md5('ph-user-1')::uuid, 'Probe League', 'PHL001', md5('ph-public-mp')::uuid);

insert into public.league_members (league_id, user_id, role)
values (md5('ph-league')::uuid, md5('ph-user-1')::uuid, 'owner')
on conflict do nothing;

-- Three more members, so a member count would be a distinguishing fact if the
-- resolver still leaked one. Four is not two.
insert into public.league_members (league_id, user_id, role) values
  (md5('ph-league')::uuid, md5('ph-user-2')::uuid, 'member'),
  (md5('ph-league')::uuid, md5('ph-user-3')::uuid, 'member')
on conflict do nothing;

select set_config('request.jwt.claims',
  json_build_object('sub', md5('ph-user-1')::uuid, 'role', 'authenticated',
                    'app_metadata', json_build_object())::text, true);
set local role authenticated;

select set_config('test.ph_created',
  public.create_private_season_lms(
    current_setting('test.ph_season')::uuid, 'Probe Cup')::text, true);
select set_config('test.ph_code',
  current_setting('test.ph_created')::jsonb ->> 'invite_code', true);

reset role;

-- ---------------------------------------------------------------------------
-- THE FIELD `SEC-001` NAMED, GONE FROM BOTH CONTAINER KINDS
-- ---------------------------------------------------------------------------

select set_config('request.jwt.claims',
  json_build_object('sub', md5('ph-user-2')::uuid, 'role', 'authenticated',
                    'app_metadata', json_build_object())::text, true);
set local role authenticated;

select ok(
  not (public.resolve_invite_code('PHL001') ? 'members'),
  'a resolved league no longer discloses how many members it has');

select ok(
  not (public.resolve_invite_code(current_setting('test.ph_code')) ? 'members'),
  'and neither does a resolved PRIVATE competition, which contract 158 never covered');

select ok(
  not (public.resolve_invite_code('PHL001') ? 'id'),
  'a resolved league no longer discloses its id, because join_league takes a code');

select ok(
  not (public.resolve_invite_code(current_setting('test.ph_code')) ? 'id'),
  'and neither does a private competition, because join_private_competition takes a code too');

-- The owner's display name was never returned and must not start being. This is
-- the other half of the field pair `SEC-001` named on the preview.
select ok(
  not (public.resolve_invite_code(current_setting('test.ph_code')) ? 'owner_name')
  and not (public.resolve_invite_code(current_setting('test.ph_code')) ? 'owner_id'),
  'a resolved private competition names no owner');

-- ---------------------------------------------------------------------------
-- WHAT IT STILL ANSWERS. Narrowing that broke routing would close SEC-001 by
-- breaking MIG-UI-07, which is not closing it.
-- ---------------------------------------------------------------------------

select is(
  public.resolve_invite_code('PHL001') ->> 'kind', 'league',
  'a league code still resolves as a league');

select is(
  public.resolve_invite_code('PHL001') ->> 'join_with', 'join_league',
  'and still names the write that joins it');

select is(
  (public.resolve_invite_code('PHL001') ->> 'requires_game_entry')::boolean, true,
  'and still says a caller must enter the game first');

select is(
  public.resolve_invite_code(current_setting('test.ph_code')) ->> 'kind', 'competition',
  'a private competition code still resolves as a competition');

select is(
  public.resolve_invite_code(current_setting('test.ph_code')) ->> 'game_key', 'last_man_standing',
  'and still says which game it runs, which the code alone never could');

select is(
  (public.resolve_invite_code(current_setting('test.ph_code')) ->> 'is_owner')::boolean, false,
  'and still answers a caller-relative ownership fact, computed from their own uid');

-- ---------------------------------------------------------------------------
-- A MISS AND A HIT ARE STILL INDISTINGUISHABLE
-- ---------------------------------------------------------------------------

select is(
  (public.resolve_invite_code('ZZZZZZ') ->> 'found')::boolean, false,
  'an unknown code is still not found');

select is(
  (public.resolve_invite_code('nope!!') ->> 'found')::boolean, false,
  'and a malformed code still answers identically rather than saying it is invalid');

-- ---------------------------------------------------------------------------
-- THE CASE THIS FILE IS BUILT AROUND, PART ONE: a wrong guess now costs.
--
-- User 3 has spent nothing. Twenty wrong guesses exhaust the budget and the
-- twenty-first is refused — through the RESOLVER alone, which before this
-- contract could be called without limit for ever.
-- ---------------------------------------------------------------------------

reset role;
select set_config('request.jwt.claims',
  json_build_object('sub', md5('ph-user-3')::uuid, 'role', 'authenticated',
                    'app_metadata', json_build_object())::text, true);
set local role authenticated;

select lives_ok($$
  select public.resolve_invite_code('ZZZZZ' || n::text)
  from generate_series(1, 20) as n
$$, 'twenty wrong guesses through the resolver are permitted');

select throws_ok($$
  select public.resolve_invite_code('AAAAAA')
$$, '23514', null,
  'and the twenty-first is refused, where before this contract probing was free');

-- ---------------------------------------------------------------------------
-- PART TWO: the budget is SHARED. Having spent it on the resolver, the same
-- caller cannot switch doors and carry on through the preview.
--
-- This is the assertion that a per-function limiter would pass and that would
-- have left an attacker forty attempts a minute across two functions.
-- ---------------------------------------------------------------------------

select throws_ok($$
  select * from public.get_league_preview('BBBBBB')
$$, '23514', null,
  'and the preview refuses the same caller, because both doors draw on one budget');

-- ---------------------------------------------------------------------------
-- Volatility, asserted because restoring `stable` would make the limiter's
-- insert fail at runtime and quietly return the resolver to being free.
-- ---------------------------------------------------------------------------

reset role;

select is(
  (select p.provolatile::text
     from pg_catalog.pg_proc p
     join pg_catalog.pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname = 'resolve_invite_code'),
  'v',
  'the resolver is volatile, which is what charging a limit requires');

select * from finish();

rollback;
