-- Contract 171: a capped league read stops choosing arbitrarily, and says so.
--
-- THE ASSERTION THIS FILE EXISTS FOR needs a league with MORE MEMBERS THAN THE
-- CAP, because a cap tested below its own bound proves nothing. Contract 149
-- capped at two hundred with no ordering, so which two hundred survived was
-- whatever the plan produced — and the aggregate outside then ranked that
-- arbitrary subset and presented it as the league's table.
--
-- The league below holds 205 members and the LEADER is deliberately not among
-- the first two hundred by insertion order. A read that caps without ordering
-- can lose them; one that caps in the order it ranks by cannot.
--
-- The second is that a truncated payload says it was truncated. The league's
-- real size is already in the payload, so 200 rows beside a count of 205 is
-- indistinguishable from five members who did not predict — and those two need
-- opposite copy.

begin;

select plan(9);

insert into public.tournaments (name, year, competition_id, season_key, kind, display_timezone, status)
select 'C171 Cap Honesty', 2058, t.competition_id, 'cap-honesty', 'league_season',
       'Europe/London', 'active'
  from public.tournaments t where t.kind = 'league_season' order by t.name limit 1;

select set_config('test.cap_season',
  (select id::text from public.tournaments where season_key = 'cap-honesty'), true);

insert into public.teams (id, tournament_id, name) values
  (md5('cap-t1')::uuid, current_setting('test.cap_season')::uuid, 'Cap Rovers'),
  (md5('cap-t2')::uuid, current_setting('test.cap_season')::uuid, 'Cap United');

-- `competition_rounds_window_paired` requires both ends or neither.
insert into public.competition_rounds (
  id, tournament_id, round_key, ordinal, kind, label,
  window_opens_at, window_closes_at)
values (md5('cap-r1')::uuid, current_setting('test.cap_season')::uuid, 'cap-mw1', 1,
        'league_matchweek', 'Matchweek 1',
        now() - interval '10 days', now() - interval '2 days');

-- LOCKED, so the read reveals. An unrevealed matchweek returns no members at
-- all and would pass every assertion below for the wrong reason.
-- SCHEDULED for now, so the predictions below can be entered. The matchweek is
-- locked further down, once they are in.
insert into public.season_fixtures (
  id, tournament_id, competition_round_id, home_team_id, away_team_id,
  kickoff_at, status)
values (md5('cap-f1')::uuid, current_setting('test.cap_season')::uuid, md5('cap-r1')::uuid,
        md5('cap-t1')::uuid, md5('cap-t2')::uuid,
        now() + interval '2 days', 'scheduled');

set local session_replication_role = replica;
insert into auth.users (id, email, aud, role, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
select md5('cap-u' || n)::uuid, format('cap-%s@example.test', n),
       'authenticated', 'authenticated', '{}'::jsonb, '{}'::jsonb, now(), now()
  from generate_series(1, 205) as n;
set local session_replication_role = origin;

insert into public.profiles (id, display_name, welcomed_at)
select md5('cap-u' || n)::uuid, 'Capped ' || lpad(n::text, 3, '0'), now()
  from generate_series(1, 205) as n;

insert into public.bonus_competitions (
  tournament_id, game_key, published, availability_status,
  draw_required, visibility_kind, registration_opens_at)
values (current_setting('test.cap_season')::uuid, 'main_predictor', true, 'active',
        false, 'public', now() - interval '60 days');

insert into public.entries (id, user_id, tournament_id)
select md5('cap-e' || n)::uuid, md5('cap-u' || n)::uuid,
       current_setting('test.cap_season')::uuid
  from generate_series(1, 205) as n;
-- The trigger resolves the season's Main Predictor and the membership itself.

insert into public.leagues (id, tournament_id, name, owner_id, invite_code)
values (md5('cap-lg')::uuid, current_setting('test.cap_season')::uuid,
        'The Big League', md5('cap-u1')::uuid, 'CAPCODE12345');

-- Contract 181 caps an ordinary private league at 100 members, and this fixture
-- is deliberately larger. The two are not in conflict: the membership ceiling is
-- an OPERATING limit that ADR 0028 § 3 expects to be raised from measured load
-- evidence, while the read's own cap is defence-in-depth that must hold whatever
-- that ceiling becomes. A read test that could only build a league the current
-- ceiling permits would stop testing the cap the day the ceiling moved.
--
-- `session_replication_role = replica` suspends the trigger for the fixture
-- build only. It is superuser-only and unreachable from any browser role, so it
-- weakens nothing: it is the same idiom this suite already uses to seed
-- `auth.users`.
set local session_replication_role = replica;
insert into public.league_members (league_id, user_id, role)
select md5('cap-lg')::uuid, md5('cap-u' || n)::uuid,
       case when n = 1 then 'owner' else 'member' end
  from generate_series(1, 205) as n;
set local session_replication_role = origin;

insert into public.season_predictions (tournament_id, entry_id, season_fixture_id, home_score, away_score)
select current_setting('test.cap_season')::uuid, md5('cap-e' || n)::uuid,
       md5('cap-f1')::uuid, 2, 1
  from generate_series(1, 205) as n;

-- THE LEADER IS MEMBER 205 — the last inserted, and so the one an unordered cap
-- of two hundred is most likely to drop. Everyone else scores their own index,
-- so the ordering is strict and there is exactly one right answer.
insert into public.season_matchweek_scores (
  tournament_id, entry_id, competition_round_id, points, fixtures_scored, settled_at)
select current_setting('test.cap_season')::uuid, md5('cap-e' || n)::uuid,
       md5('cap-r1')::uuid,
       case when n = 205 then 5000 else n end,
       1,
       now() - interval '1 day'
  from generate_series(1, 205) as n;

-- NOW the matchweek locks, so the read reveals. Moving the kickoff rather than
-- waiting for one is the only way to read across a lock inside a transaction,
-- and it is done with replication role `replica` so the fixture's own triggers
-- do not treat this as contract 119's provider reschedule.
set local session_replication_role = replica;
update public.season_fixtures
   set kickoff_at = now() - interval '2 hours', status = 'played',
       home_score = 2, away_score = 1
 where id = md5('cap-f1')::uuid;
set local session_replication_role = origin;

select set_config('request.jwt.claims',
  json_build_object('sub', md5('cap-u1')::uuid, 'role', 'authenticated',
                    'app_metadata', json_build_object())::text, true);
set local role authenticated;

select set_config('test.cap_view',
  public.get_season_league_matchweek_predictions(
    md5('cap-lg')::uuid, md5('cap-r1')::uuid)::text, true);

select is(
  current_setting('test.cap_view')::jsonb ->> 'revealed', 'true',
  'the matchweek has locked, so the read reveals and the assertions below mean something');

select is(
  current_setting('test.cap_view')::jsonb ->> 'member_count', '205',
  'the league really does hold more members than the cap');

-- THE ASSERTION THIS FILE EXISTS FOR.
select is(
  (select entry ->> 'display_name'
     from jsonb_array_elements(current_setting('test.cap_view')::jsonb -> 'members') entry
    limit 1),
  'Capped 205',
  'THE LEAGUE LEADER SURVIVES THE CAP, because the cap keeps the top rows rather than an arbitrary two hundred');

select is(
  jsonb_array_length(current_setting('test.cap_view')::jsonb -> 'members'), 200,
  'and the payload carries the cap''s worth of rows, not all 205');

select is(
  current_setting('test.cap_view')::jsonb ->> 'members_returned', '200',
  'the read states how many rows it carried');

select is(
  current_setting('test.cap_view')::jsonb ->> 'members_truncated', 'true',
  'and that this was not all of them — which 200 rows beside a count of 205 could not otherwise show');

-- The ordering is TOTAL, so a member on the boundary cannot flicker between two
-- renders of the same league.
select is(
  (select bool_and(ordered)
     from (
       select (entry ->> 'points')::integer
              <= lag((entry ->> 'points')::integer) over (order by idx) as ordered
         from jsonb_array_elements(current_setting('test.cap_view')::jsonb -> 'members')
              with ordinality as t(entry, idx)
     ) pairs
    where ordered is not null),
  true,
  'the rows are in descending points order, so the cap and the ranking agree');

-- A league SMALLER than the cap must not claim truncation.
reset role;

insert into public.leagues (id, tournament_id, name, owner_id, invite_code)
values (md5('cap-sm')::uuid, current_setting('test.cap_season')::uuid,
        'The Small League', md5('cap-u1')::uuid, 'CAPCODE54321');

insert into public.league_members (league_id, user_id, role)
select md5('cap-sm')::uuid, md5('cap-u' || n)::uuid,
       case when n = 1 then 'owner' else 'member' end
  from generate_series(1, 4) as n;

select set_config('request.jwt.claims',
  json_build_object('sub', md5('cap-u1')::uuid, 'role', 'authenticated',
                    'app_metadata', json_build_object())::text, true);
set local role authenticated;

select is(
  public.get_season_league_matchweek_predictions(
    md5('cap-sm')::uuid, md5('cap-r1')::uuid) ->> 'members_truncated',
  'false',
  'a league smaller than the cap does not claim to have been truncated');

select is(
  public.get_season_league_matchweek_predictions(
    md5('cap-sm')::uuid, md5('cap-r1')::uuid) ->> 'members_returned',
  '4',
  'and reports the rows it really carried');

reset role;

select * from finish();

rollback;
