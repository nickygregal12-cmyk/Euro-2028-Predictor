-- Contract 161: a player's own season history, and how they find it.
--
-- THE ASSERTION THIS FILE EXISTS FOR is that an ARCHIVED season stays
-- discoverable. Contract 147's catalogue is a list of what is published, so a
-- history built on it would lose a player's 2026/27 the day it was archived —
-- which is the failure this read exists to prevent, and the one a test written
-- against a live season would never see.
--
-- The second is that participation includes a season the player joined a GAME
-- in and never made a predictor entry for. An implementation joining the three
-- sources on `entries` rather than unioning them would drop exactly that
-- player, and every other assertion here would still pass.
--
-- The first draft of this suite tested the OPPOSITE case — an entry with no
-- membership — and the schema disproved it: `prepare_entry_game_membership` is
-- a BEFORE trigger on `entries` that creates the Main Predictor membership when
-- none exists, so an entry always implies one. That case cannot arise, and
-- contract 161's header was corrected to say so rather than left claiming a
-- protection it does not provide.

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
  -- Every season carrying an `entries` row needs its Main Predictor, because
  -- the entry trigger resolves one and refuses when there is none.
  (md5('sh-mp25')::uuid, md5('sh-s25')::uuid, 'main_predictor', true, 'active',
   false, 'public', now() - interval '800 days'),
  (md5('sh-mp26')::uuid, md5('sh-s26')::uuid, 'main_predictor', true, 'active',
   false, 'public', now() - interval '400 days'),
  (md5('sh-lms26')::uuid, md5('sh-s26')::uuid, 'last_man_standing', true, 'active',
   false, 'public', now() - interval '400 days'),
  -- 2027/28 runs a Last Man Standing and NO predictor entry, which is the
  -- union's load-bearing case.
  (md5('sh-lms27')::uuid, md5('sh-s27')::uuid, 'last_man_standing', true, 'active',
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

-- Player one entered the predictor in 2025/26 and 2026/27. The entry trigger
-- creates the Main Predictor membership for each, which is why neither is the
-- union's load-bearing case.
insert into public.entries (id, user_id, tournament_id) values
  (md5('sh-e25')::uuid, md5('sh-p1')::uuid, md5('sh-s25')::uuid),
  (md5('sh-e26')::uuid, md5('sh-p1')::uuid, md5('sh-s26')::uuid);

-- 2026/27 by both games, and they LEFT the Last Man Standing. A season a player
-- left is still a season they played.
-- The 2026/27 Main Predictor membership already exists, created by the entry
-- trigger, so only the Last Man Standing rows are inserted here. 2027/28 is a
-- Last Man Standing membership with NO entry: the union's load-bearing case.
-- `active_since` is required for an ACTIVE membership and forbidden alongside
-- `left_at`: `game_memberships_state_shape` admits exactly one shape per status.
insert into public.game_memberships (
  tournament_id, game_competition_id, user_id, status, active_since, left_at) values
  (md5('sh-s26')::uuid, md5('sh-lms26')::uuid, md5('sh-p1')::uuid, 'left',
   null, now() - interval '30 days'),
  (md5('sh-s27')::uuid, md5('sh-lms27')::uuid, md5('sh-p1')::uuid, 'active',
   now() - interval '30 days', null);

insert into public.bonus_competition_entrants (competition_id, user_id, outcome) values
  (md5('sh-mp26')::uuid, md5('sh-p1')::uuid, 'active'),
  (md5('sh-lms26')::uuid, md5('sh-p1')::uuid, 'eliminated'),
  (md5('sh-lms27')::uuid, md5('sh-p1')::uuid, 'active');

-- Player two played a different season entirely, so the two histories cannot
-- bleed into one another.
insert into public.game_memberships (
  tournament_id, game_competition_id, user_id, status, active_since) values
  (md5('sh-s99')::uuid, md5('sh-mp99')::uuid, md5('sh-p2')::uuid, 'active', now());

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

-- THE SECOND ASSERTION THIS FILE EXISTS FOR: the union's load-bearing case.
-- 2027/28 holds a Last Man Standing membership and entrant row and NO `entries`
-- row at all, because neither that game nor the Championship requires one. A
-- join on `entries` would drop the season entirely.
select ok(
  exists (select 1
            from jsonb_array_elements(current_setting('test.sh_history')::jsonb -> 'seasons') entry
           where entry ->> 'season_key' = 'sh-2027/28'),
  'a season the caller joined a GAME in, with no predictor entry, is still their season');

select is(
  (select game ->> 'game_key'
     from jsonb_array_elements(current_setting('test.sh_history')::jsonb -> 'seasons') entry,
          jsonb_array_elements(entry -> 'games') game
    where entry ->> 'season_key' = 'sh-2027/28'),
  'last_man_standing',
  'and it reports the game they actually joined, and no predictor they never entered');

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
