-- Contract 128: a season league has a standings table of its own.
--
-- THE ASSERTION THIS FILE EXISTS FOR is the one that shows the defect was real:
-- the SAME league, with the SAME three members and the SAME banked matchweek
-- points, read through the tournament function and through the season one. The
-- tournament read now refuses; before this contract it answered, and answered
-- every member on zero.
--
-- THE SECOND ASSERTION IS THAT THE TOTALS COME FROM THE SEASON AUTHORITY. Points
-- are driven in through `season_matchweek_scores` — the table
-- `process_due_season_matchweek_scores` writes — and read back through the RPC,
-- rather than being asserted from the function's text.
--
-- THE THIRD IS THE BOUNDARY. A signed-in player who is not in the league is
-- refused, driven with a real session rather than inspected as a grant.
--
-- Self-contained: its own season, clubs, rounds, fixtures, entries and users.

begin;

select plan(27);

-- ---------------------------------------------------------------------------
-- The boundary.
-- ---------------------------------------------------------------------------

select is(
  (select count(*)::integer from pg_proc proc
     join pg_namespace ns on ns.oid = proc.pronamespace
    where ns.nspname = 'public'
      and proc.proname = 'get_season_league_standings'
      and proc.prosecdef and proc.proconfig @> array['search_path=""']),
  1,
  'the season league read exists, security definer, search path pinned');

select is(
  (select count(*)::integer from information_schema.routine_privileges
    where routine_name = 'get_season_league_standings'
      and grantee in ('anon', 'service_role')),
  0,
  'anon and service_role may not reach it');

select is(
  (select count(*)::integer from information_schema.routine_privileges
    where routine_name = 'get_season_league_standings'
      and grantee = 'authenticated'),
  1,
  'and a signed-in caller may');

-- ---------------------------------------------------------------------------
-- Setup: one season, two matchweeks, three players, one league.
-- ---------------------------------------------------------------------------

insert into public.tournaments (name, year, competition_id, season_key, kind, display_timezone, status)
select 'C128 League Probe', 2030, t.competition_id, 'sls-probe', 'league_season',
       t.display_timezone, 'active'
  from public.tournaments t
 where t.kind = 'league_season'
 order by t.name
 limit 1;

select set_config('test.sls_season',
  (select id::text from public.tournaments where season_key = 'sls-probe'), true);

insert into public.competition_rounds (tournament_id, round_key, ordinal, kind, label)
values
  (current_setting('test.sls_season')::uuid, 'sls-mw1', 1, 'league_matchweek', 'Matchweek 1'),
  (current_setting('test.sls_season')::uuid, 'sls-mw2', 2, 'league_matchweek', 'Matchweek 2');

select set_config('test.sls_mw1',
  (select id::text from public.competition_rounds
    where tournament_id = current_setting('test.sls_season')::uuid
      and round_key = 'sls-mw1'), true);

select set_config('test.sls_mw2',
  (select id::text from public.competition_rounds
    where tournament_id = current_setting('test.sls_season')::uuid
      and round_key = 'sls-mw2'), true);

insert into public.bonus_competitions (
  id, tournament_id, game_key, published, availability_status,
  draw_required, visibility_kind, registration_opens_at
) values (
  md5('sls-mp')::uuid, current_setting('test.sls_season')::uuid,
  'main_predictor', true, 'active', false, 'public', now() - interval '2 days');

set local session_replication_role = replica;
insert into auth.users (
  id, email, aud, role, raw_app_meta_data, raw_user_meta_data, created_at, updated_at
)
select md5('sls-user-' || n)::uuid, format('sls-%s@example.test', n),
  'authenticated', 'authenticated', '{}'::jsonb, '{}'::jsonb, now(), now()
from generate_series(1, 5) as n;
set local session_replication_role = origin;

-- Deliberately NOT alphabetical by user number: the display names order
-- Charlie, Bravo, Alpha, Delta, so a table sorted by name rather than by points
-- is visibly wrong rather than accidentally right.
insert into public.profiles (id, display_name, welcomed_at) values
  (md5('sls-user-1')::uuid, 'Charlie Sls', now()),
  (md5('sls-user-2')::uuid, 'Bravo Sls', now()),
  (md5('sls-user-3')::uuid, 'Alpha Sls', now()),
  (md5('sls-user-4')::uuid, 'Delta Sls', now()),
  (md5('sls-user-5')::uuid, 'Echo Sls', now());

insert into public.entries (id, user_id, tournament_id, game_competition_id)
select md5('sls-entry-' || n)::uuid, md5('sls-user-' || n)::uuid,
       current_setting('test.sls_season')::uuid, md5('sls-mp')::uuid
from generate_series(1, 3) as n;

-- Banked matchweek totals. Player 1 leads on 30, players 2 and 3 tie on 12,
-- and player 3 has played one matchweek fewer — the pairing ADR 0012 requires.
insert into public.season_matchweek_scores
  (tournament_id, entry_id, competition_round_id, points, fixtures_scored)
values
  (current_setting('test.sls_season')::uuid, md5('sls-entry-1')::uuid,
   current_setting('test.sls_mw1')::uuid, 18, 10),
  (current_setting('test.sls_season')::uuid, md5('sls-entry-1')::uuid,
   current_setting('test.sls_mw2')::uuid, 12, 10),
  (current_setting('test.sls_season')::uuid, md5('sls-entry-2')::uuid,
   current_setting('test.sls_mw1')::uuid, 5, 10),
  (current_setting('test.sls_season')::uuid, md5('sls-entry-2')::uuid,
   current_setting('test.sls_mw2')::uuid, 7, 10),
  (current_setting('test.sls_season')::uuid, md5('sls-entry-3')::uuid,
   current_setting('test.sls_mw1')::uuid, 12, 10);

insert into public.leagues (id, tournament_id, owner_id, name, invite_code, game_competition_id)
values (md5('sls-league')::uuid, current_setting('test.sls_season')::uuid,
        md5('sls-user-1')::uuid, 'Season Probe League', 'SLS123', md5('sls-mp')::uuid);

-- Player 4 is a member with NO entry, which is the case both reads have always
-- listed rather than omitted.
insert into public.league_members (league_id, user_id, role) values
  (md5('sls-league')::uuid, md5('sls-user-1')::uuid, 'owner'),
  (md5('sls-league')::uuid, md5('sls-user-2')::uuid, 'member'),
  (md5('sls-league')::uuid, md5('sls-user-3')::uuid, 'member'),
  (md5('sls-league')::uuid, md5('sls-user-4')::uuid, 'member');

-- ---------------------------------------------------------------------------
-- THE DEFECT. The tournament read no longer answers for this league.
-- ---------------------------------------------------------------------------

select set_config('request.jwt.claims',
  json_build_object('sub', md5('sls-user-1')::uuid, 'role', 'authenticated')::text, true);

select throws_ok(
  format('select public.get_league_members(%L::uuid)', md5('sls-league')::uuid),
  '23514',
  'This league belongs to a competition season; its standings come from get_season_league_standings',
  'the tournament read REFUSES a season league — before this contract it '
  'returned every member on zero, alphabetically, with no error');

-- A tournament league is untouched, which is what makes the refusal narrow.
-- Its own season and league, so this does not depend on what the seed holds.
insert into public.tournaments (name, year, competition_id, season_key, kind, display_timezone, status)
select 'C128 Tournament Probe', 2031, t.competition_id, 'sls-tourn', 'tournament',
       t.display_timezone, 'active'
  from public.tournaments t
 where t.kind = 'tournament'
 order by t.name
 limit 1;

insert into public.leagues (id, tournament_id, owner_id, name, invite_code, game_competition_id)
select md5('sls-tourn-league')::uuid, season.id, md5('sls-user-1')::uuid,
       'Tournament Probe League', 'SLS456', availability.id
  from public.tournaments season
  join public.bonus_competitions availability
    on availability.tournament_id = season.id
   and availability.game_key = 'original_predictor'
 where season.season_key = 'sls-tourn';

insert into public.league_members (league_id, user_id, role)
values (md5('sls-tourn-league')::uuid, md5('sls-user-1')::uuid, 'owner');

select lives_ok(
  format('select public.get_league_members(%L::uuid)', md5('sls-tourn-league')::uuid),
  'and a tournament league still reads, so the refusal reaches exactly the '
  'competition kind it was written for');

-- ---------------------------------------------------------------------------
-- The season table.
-- ---------------------------------------------------------------------------

select set_config('test.sls_table',
  (select public.get_season_league_standings(md5('sls-league')::uuid))::text, true);

select is(
  (current_setting('test.sls_table')::jsonb)->>'totalCount',
  '4',
  'every league member is in the table, including the one with no entry');

select is(
  jsonb_array_length((current_setting('test.sls_table')::jsonb)->'rows'),
  4,
  'and the first page holds all four');

select is(
  (current_setting('test.sls_table')::jsonb)->'rows'->0->>'displayName',
  'Charlie Sls',
  'THE LEADER IS THE PLAYER WITH THE MOST POINTS, not the first name '
  'alphabetically — which is what the tournament read returned');

select is(
  (current_setting('test.sls_table')::jsonb)->'rows'->0->>'points',
  '30',
  'on the total banked in season_matchweek_scores');

select is(
  (current_setting('test.sls_table')::jsonb)->'rows'->0->>'matchweeksPlayed',
  '2',
  'from two matchweeks');

select is(
  (current_setting('test.sls_table')::jsonb)->'rows'->0->>'rank',
  '1',
  'ranked first');

select is(
  (current_setting('test.sls_table')::jsonb)->'rows'->1->>'points',
  '12',
  'the two players level on 12 come next');

select is(
  (current_setting('test.sls_table')::jsonb)->'rows'->1->>'rank',
  '2',
  'sharing rank 2');

select is(
  (current_setting('test.sls_table')::jsonb)->'rows'->2->>'rank',
  '2',
  'both of them');

select is(
  (current_setting('test.sls_table')::jsonb)->'rows'->1->>'tied',
  'true',
  'and told they are tied');

select is(
  (current_setting('test.sls_table')::jsonb)->'rows'->1->>'displayName',
  'Alpha Sls',
  'the tie is broken for DISPLAY by name, so a page boundary is stable');

select is(
  (current_setting('test.sls_table')::jsonb)->'rows'->1->>'matchweeksPlayed',
  '1',
  'and matchweeks played is carried beside the total — ADR 0012 pairs them, '
  'because 12 from 1 and 12 from 2 are not tied in meaning');

select is(
  (current_setting('test.sls_table')::jsonb)->'rows'->3->>'rank',
  '4',
  'the member with no entry is ranked last on zero — rank() SKIPS 3, which is '
  'standard competition ranking rather than dense_rank');

select is(
  (current_setting('test.sls_table')::jsonb)->'rows'->3->>'hasEntry',
  'false',
  'and is marked as not having entered rather than being omitted');

select is(
  (current_setting('test.sls_table')::jsonb)->'you'->>'displayName',
  'Charlie Sls',
  'the caller gets their own row whatever page they asked for');

select is(
  (current_setting('test.sls_table')::jsonb)->'rows'->0->>'isOwner',
  'true',
  'and the owner is named');

-- ---------------------------------------------------------------------------
-- It agrees with the season-wide leaderboard, because both read one authority.
-- ---------------------------------------------------------------------------

select is(
  (select (row->>'points')::integer
     from jsonb_array_elements(
       (public.get_season_leaderboard(current_setting('test.sls_season')::uuid))->'rows') row
    where row->>'displayName' = 'Charlie Sls'),
  30,
  'the season-wide leaderboard gives the same total for the same player — one '
  'authority, so a league table cannot disagree with the season');

-- ---------------------------------------------------------------------------
-- Pagination.
-- ---------------------------------------------------------------------------

select is(
  (public.get_season_league_standings(md5('sls-league')::uuid, 2))->>'hasMore',
  'true',
  'a page of two reports more to come');

select is(
  jsonb_array_length(
    (public.get_season_league_standings(
      md5('sls-league')::uuid, 2,
      (public.get_season_league_standings(md5('sls-league')::uuid, 2))->>'nextCursor'
    ))->'rows'),
  2,
  'and its cursor returns the remaining two');

select throws_ok(
  format('select public.get_season_league_standings(%L::uuid, 2, %L)',
         md5('sls-league')::uuid, 'not-a-cursor'),
  '22023',
  'Invalid league standings cursor',
  'a malformed cursor is refused rather than silently read as page one');

-- ---------------------------------------------------------------------------
-- The boundary, driven.
-- ---------------------------------------------------------------------------

select set_config('request.jwt.claims',
  json_build_object('sub', md5('sls-user-4')::uuid, 'role', 'authenticated')::text, true);

select lives_ok(
  format('select public.get_season_league_standings(%L::uuid)', md5('sls-league')::uuid),
  'a member who has not entered the game still reads their own league');

select set_config('request.jwt.claims',
  json_build_object('sub', md5('sls-user-5')::uuid, 'role', 'authenticated')::text, true);

select throws_ok(
  format('select public.get_season_league_standings(%L::uuid)', md5('sls-league')::uuid),
  '42501',
  'Not a member of this league',
  'and a signed-in player who is not in it is refused — the grant is not the '
  'boundary');

select * from finish();
rollback;
