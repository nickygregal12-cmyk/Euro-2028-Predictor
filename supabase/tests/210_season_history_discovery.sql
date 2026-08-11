-- Contract 161: a player's own season history, and how they find it.
--
-- THE ASSERTION THIS FILE EXISTS FOR is that an ARCHIVED season stays
-- discoverable. Contract 147's catalogue is a list of what is published, so a
-- history built on it would lose a player's 2026/27 the day it was archived —
-- which is the failure this read exists to prevent, and the one a test written
-- against a live season would never see.
--
-- The second is that participation includes a season a player only ENTERED,
-- with no game membership at all. An implementation joining the three
-- participation sources rather than unioning them would drop exactly that
-- player, and every other assertion here would still pass.

begin;

select plan(14);

-- ---------------------------------------------------------------------------
-- Three seasons of one competition — archived, complete, active — and a fourth
-- the caller never touched.
-- ---------------------------------------------------------------------------

insert into public.competitions (id, slug, name)
values (md5('sh-comp')::uuid, 'season-history-verify', 'History Verify League')
on conflict (slug) do nothing;

insert into public.tournaments (id, name, year, competition_id, season_key, kind, display_timezone, status)
values
  (md5('sh-s25')::uuid, 'History Verify 2025/26', 2025, md5('sh-comp')::uuid,
   'sh-2025/26', 'league_season', 'Europe/London', 'archived'),
  (md5('sh-s26')::uuid, 'History Verify 2026/27', 2026, md5('sh-comp')::uuid,
   'sh-2026/27', 'league_season', 'Europe/London', 'complete'),
  (md5('sh-s27')::uuid, 'History Verify 2027/28', 2027, md5('sh-comp')::uuid,
   'sh-2027/28', 'league_season', 'Europe/London', 'active'),
  (md5('sh-s99')::uuid, 'History Verify 2099/00', 2099, md5('sh-comp')::uuid,
   'sh-2099/00', 'league_season', 'Europe/London', 'active');

insert into public.bonus_competitions (
  id, tournament_id, game_key, published, availability_status,
  draw_required, visibility_kind, registration_opens_at)
values
  (md5('sh-mp26')::uuid, md5('sh-s26')::uuid, 'main_predictor', true, 'active',
   false, 'public', now() - interval '400 days'),
  (md5('sh-lms26')::uuid, md5('sh-s26')::uuid, 'last_man_standing', true, 'active',
   false, 'public', now() - interval '400 days'),
  (md5('sh-mp27')::uuid, md5('sh-s27')::uuid, 'main_predictor', true, 'active',
   false, 'public', now() - interval '30 days'),
  (md5('sh-mp99')::uuid, md5('sh-s99')::uuid, 'main_predictor', true, 'active',
   false, 'public', now() - interval '1 day');

set local session_replication_role = replica;
insert into auth.users (id, email, aud, role, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
values (md5('sh-p1')::uuid, 'sh-1@example.test', 'authenticated', 'authenticated',
        '{}'::jsonb, '{}'::jsonb, now(), now()),
       (md5('sh-p2')::uuid, 'sh-2@example.test', 'authenticated', 'authenticated',
        '{}'::jsonb, '{}'::jsonb, now(), now());
set local session_replication_role = origin;

insert into public.profiles (id, display_name, welcomed_at) values
  (md5('sh-p1')::uuid, 'History One', now()),
  (md5('sh-p2')::uuid, 'History Two', now());

-- Player one: 2025/26 by ENTRY ONLY — no membership anywhere. This is the row
-- an implementation that joined rather than unioned would lose.
insert into public.entries (id, user_id, tournament_id) values
  (md5('sh-e25')::uuid, md5('sh-p1')::uuid, md5('sh-s25')::uuid),
  (md5('sh-e26')::uuid, md5('sh-p1')::uuid, md5('sh-s26')::uuid);

-- 2026/27 by both games, and they LEFT the Last Man Standing. A season a player
-- left is still a season they played.
insert into public.game_memberships (tournament_id, game_competition_id, user_id, status, left_at) values
  (md5('sh-s26')::uuid, md5('sh-mp26')::uuid, md5('sh-p1')::uuid, 'active', null),
  (md5('sh-s26')::uuid, md5('sh-lms26')::uuid, md5('sh-p1')::uuid, 'left', now() - interval '30 days'),
  (md5('sh-s27')::uuid, md5('sh-mp27')::uuid, md5('sh-p1')::uuid, 'active', null);

insert into public.bonus_competition_entrants (competition_id, user_id, outcome) values
  (md5('sh-mp26')::uuid, md5('sh-p1')::uuid, 'active'),
  (md5('sh-lms26')::uuid, md5('sh-p1')::uuid, 'eliminated');

-- Player two played a different season entirely, so the two histories cannot
-- bleed into one another.
insert into public.game_memberships (tournament_id, game_competition_id, user_id, status) values
  (md5('sh-s99')::uuid, md5('sh-mp99')::uuid, md5('sh-p2')::uuid, 'active');

-- A banked Wrapped for 2026/27 only.
insert into public.season_wrapped (
  tournament_id, entry_id, user_id, final_points, final_rank, field_size, matchweeks_played)
values (md5('sh-s26')::uuid, md5('sh-e26')::uuid, md5('sh-p1')::uuid, 412, 7, 4013, 38);

-- ---------------------------------------------------------------------------

select set_config('request.jwt.claims',
  json_build_object('sub', md5('sh-p1')::uuid, 'role', 'authenticated',
                    'app_metadata', json_build_object())::text, true);
set local role authenticated;

select set_config('test.sh_history', public.get_my_season_history(25, 0)::text, true);

select is(
  (current_setting('test.sh_history')::jsonb ->> 'total')::integer, 3,
  'the caller''s three seasons are found, and the fourth they never touched is not');

-- THE ASSERTION THIS FILE EXISTS FOR.
select is(
  (select entry ->> 'season_key'
     from jsonb_array_elements(current_setting('test.sh_history')::jsonb -> 'seasons') entry
    where (entry ->> 'in_published_catalogue')::boolean = false),
  'sh-2025/26',
  'an ARCHIVED season stays discoverable, and is marked as gone from the catalogue');

-- The second one: participation by entry alone.
select ok(
  exists (select 1
            from jsonb_array_elements(current_setting('test.sh_history')::jsonb -> 'seasons') entry
           where entry ->> 'season_key' = 'sh-2025/26'),
  'a season the caller only ENTERED counts as participation, with no membership anywhere');

select is(
  (select jsonb_array_length(entry -> 'games')
     from jsonb_array_elements(current_setting('test.sh_history')::jsonb -> 'seasons') entry
    where entry ->> 'season_key' = 'sh-2025/26'),
  0,
  'and it correctly reports no games, rather than being dropped for having none');

select is(
  (select jsonb_array_length(entry -> 'games')
     from jsonb_array_elements(current_setting('test.sh_history')::jsonb -> 'seasons') entry
    where entry ->> 'season_key' = 'sh-2026/27'),
  2,
  'a season with two games reports both, separately, as ADR 0011 requires');

select is(
  (select game ->> 'membership_status'
     from jsonb_array_elements(current_setting('test.sh_history')::jsonb -> 'seasons') entry,
          jsonb_array_elements(entry -> 'games') game
    where game ->> 'game_key' = 'last_man_standing'),
  'left',
  'a game the caller left says so, rather than vanishing');

select is(
  (select game ->> 'outcome'
     from jsonb_array_elements(current_setting('test.sh_history')::jsonb -> 'seasons') entry,
          jsonb_array_elements(entry -> 'games') game
    where game ->> 'game_key' = 'last_man_standing'),
  'eliminated',
  'and carries the settlement authority''s own word for how it ended');

select is(
  (select entry -> 'final' ->> 'rank'
     from jsonb_array_elements(current_setting('test.sh_history')::jsonb -> 'seasons') entry
    where entry ->> 'season_key' = 'sh-2026/27'),
  '7',
  'the final figures come from the banked Wrapped');

select is(
  (select entry ->> 'wrapped_available'
     from jsonb_array_elements(current_setting('test.sh_history')::jsonb -> 'seasons') entry
    where entry ->> 'season_key' = 'sh-2025/26'),
  'false',
  'a season with no Wrapped says so rather than deriving a stand-in');

select is(
  (select entry ->> 'final'
     from jsonb_array_elements(current_setting('test.sh_history')::jsonb -> 'seasons') entry
    where entry ->> 'season_key' = 'sh-2025/26'),
  null,
  'and returns no final figures at all for it');

-- ---------------------------------------------------------------------------
-- ONE PLAYER'S HISTORY IS ONLY THEIRS
-- ---------------------------------------------------------------------------

reset role;
select set_config('request.jwt.claims',
  json_build_object('sub', md5('sh-p2')::uuid, 'role', 'authenticated',
                    'app_metadata', json_build_object())::text, true);
set local role authenticated;

select is(
  (select string_agg(entry ->> 'season_key', ',')
     from jsonb_array_elements(public.get_my_season_history(25, 0) -> 'seasons') entry),
  'sh-2099/00',
  'a second player sees their own season and none of the first player''s');

-- ---------------------------------------------------------------------------
-- BOUNDS AND PAGING
-- ---------------------------------------------------------------------------

reset role;
select set_config('request.jwt.claims',
  json_build_object('sub', md5('sh-p1')::uuid, 'role', 'authenticated',
                    'app_metadata', json_build_object())::text, true);
set local role authenticated;

select is(
  (public.get_my_season_history(1000000, 0) ->> 'limit')::integer, 50,
  'a page size is clamped server-side and never trusted');

-- Keyset-free paging still has to traverse every row exactly once. Two pages of
-- two over three rows must produce all three, with no duplicate.
select is(
  (select count(distinct key)::integer from (
     select entry ->> 'season_key' as key
       from jsonb_array_elements(public.get_my_season_history(2, 0) -> 'seasons') entry
     union all
     select entry ->> 'season_key'
       from jsonb_array_elements(public.get_my_season_history(2, 2) -> 'seasons') entry
   ) traversed),
  3,
  'two pages traverse every season exactly once, with a deterministic order');

select is(
  (public.get_my_season_history(2, 0) ->> 'has_more')::boolean, true,
  'and the first page says there is more');

reset role;

select * from finish();

rollback;
