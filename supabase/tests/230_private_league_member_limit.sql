-- Contract 181: the ordinary private league's 100-member ceiling (`CAP-003`).
--
-- THE ASSERTION THIS FILE EXISTS FOR is that the cap is enforced on the TABLE
-- rather than in one entry point. `join_league` is the obvious place to check
-- and it is not the only writer — `create_league` inserts the owner's row
-- directly — so this suite fills a league to its ceiling through a **direct
-- insert**, which is the path a cap living in an RPC would not cover. A test
-- that only calls `join_league` would pass against exactly the wrong
-- implementation.
--
-- The second is that the ceiling does not reach the other two games. A private
-- Last Man Standing and a private Championship hold their fields in
-- `bonus_competition_entrants`, and ADR 0028 § 3 does not extend this figure to
-- either; the suite drives one past a hundred entrants to prove it.

begin;

select plan(12);

insert into public.tournaments (name, year, competition_id, season_key, kind, display_timezone, status)
select 'C181 Capacity', 2064, t.competition_id, 'capacity', 'league_season',
       'Europe/London', 'active'
  from public.tournaments t where t.kind = 'league_season' order by t.name limit 1;

select set_config('test.cap_season',
  (select id::text from public.tournaments where season_key = 'capacity'), true);

insert into public.bonus_competitions (
  id, tournament_id, game_key, published, availability_status, draw_required,
  visibility_kind, registration_opens_at)
values
  (md5('cap-main')::uuid, current_setting('test.cap_season')::uuid, 'main_predictor',
   true, 'active', false, 'public', now() - interval '5 days'),
  (md5('cap-lms')::uuid, current_setting('test.cap_season')::uuid, 'last_man_standing',
   true, 'active', false, 'public', now() - interval '5 days');

-- 102 accounts: enough to fill a hundred-member league, refuse the hundred and
-- first, and still have one left to prove the refusal is per league.
set local session_replication_role = replica;
insert into auth.users (id, email, aud, role, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
select md5('cap-u' || n)::uuid, format('cap-u%s@example.test', n),
       'authenticated', 'authenticated', '{}'::jsonb, '{}'::jsonb, now(), now()
  from generate_series(1, 102) n;
set local session_replication_role = origin;

insert into public.profiles (id, display_name, welcomed_at)
select md5('cap-u' || n)::uuid, 'Capacity ' || n, now() from generate_series(1, 102) n;

-- ---------------------------------------------------------------------------
-- The configured ceiling
-- ---------------------------------------------------------------------------

select is(
  (select league_member_limit from predictor_internal.operating_limits where singleton),
  100,
  'the approved ceiling from ADR 0028 section 3 is the installed one');

select ok(
  not has_table_privilege('authenticated', 'predictor_internal.operating_limits', 'select'),
  'and no browser role can read it, as contract 44 established for the two beside it');

-- ---------------------------------------------------------------------------
-- Filling a league, through a direct insert rather than through join_league
-- ---------------------------------------------------------------------------

insert into public.leagues (id, tournament_id, name, invite_code, owner_id, game_competition_id)
values (md5('cap-l1')::uuid, current_setting('test.cap_season')::uuid, 'Full House',
        'CAPFULL00001', md5('cap-u1')::uuid, md5('cap-main')::uuid);

-- `create_league` writes the owner's own membership row, and that row counts
-- toward the hundred because it IS a membership. Written by hand here for the
-- same reason the whole suite is: to exercise the table rather than the RPC.
insert into public.league_members (league_id, user_id, role)
values (md5('cap-l1')::uuid, md5('cap-u1')::uuid, 'owner');

insert into public.league_members (league_id, user_id, role)
select md5('cap-l1')::uuid, md5('cap-u' || n)::uuid, 'member'
  from generate_series(2, 100) n;

select is(
  (select count(*)::integer from public.league_members
    where league_id = md5('cap-l1')::uuid),
  100,
  'members 1 to 100 are admitted, the owner among them');

select throws_ok(
  format(
    'insert into public.league_members (league_id, user_id, role) values (%L::uuid, %L::uuid, %L)',
    md5('cap-l1')::uuid, md5('cap-u101')::uuid, 'member'),
  'PT429',
  null,
  'and member 101 is refused by the table, not by an entry point');

select is(
  (select count(*)::integer from public.league_members
    where league_id = md5('cap-l1')::uuid),
  100,
  'the refusal admits nobody: the league is still on exactly a hundred');

-- The owner has no exemption. ADR 0028 section 3 says so, and the absence of an
-- exemption is the kind of thing that gets added later "for convenience".
select throws_ok(
  format(
    'insert into public.league_members (league_id, user_id, role) values (%L::uuid, %L::uuid, %L)',
    md5('cap-l1')::uuid, md5('cap-u102')::uuid, 'owner'),
  'PT429',
  null,
  'and the owner role is no exemption, because there is no authorised admin path');

-- ---------------------------------------------------------------------------
-- The cap is per league
-- ---------------------------------------------------------------------------

insert into public.leagues (id, tournament_id, name, invite_code, owner_id, game_competition_id)
values (md5('cap-l2')::uuid, current_setting('test.cap_season')::uuid, 'Second League',
        'CAPSECOND001', md5('cap-u101')::uuid, md5('cap-main')::uuid);

select lives_ok(
  format(
    'insert into public.league_members (league_id, user_id, role) values (%L::uuid, %L::uuid, %L)',
    md5('cap-l2')::uuid, md5('cap-u101')::uuid, 'owner'),
  'a different league is unaffected by the first one being full');

-- ---------------------------------------------------------------------------
-- It does not reach the other two games
-- ---------------------------------------------------------------------------

insert into public.bonus_competition_entrants (competition_id, user_id, outcome)
select md5('cap-lms')::uuid, md5('cap-u' || n)::uuid, 'active'
  from generate_series(1, 102) n;

select is(
  (select count(*)::integer from public.bonus_competition_entrants
    where competition_id = md5('cap-lms')::uuid),
  102,
  'a Last Man Standing field passes a hundred entrants untouched: ADR 0013 makes its rules its own');

-- ---------------------------------------------------------------------------
-- The setter
-- ---------------------------------------------------------------------------

select ok(
  not has_function_privilege('anon', 'public.set_league_member_limit(integer)', 'execute')
  and not has_function_privilege('authenticated', 'public.set_league_member_limit(integer)', 'execute'),
  'the ceiling is not settable from any browser role');

select throws_ok(
  'select public.set_league_member_limit(50)',
  '23514',
  null,
  'and it cannot be set below a league that already exists, which nobody could satisfy without removing people');

select throws_ok(
  'select public.set_league_member_limit(101)',
  '22023',
  null,
  'nor above the figure ADR 0028 approved, which is contract 44''s pattern and its reason');

select is(
  public.set_league_member_limit(100)::jsonb ->> 'largestLeague',
  '100',
  'setting it to the value it already holds reports the largest league rather than guessing');

select * from finish();
rollback;
