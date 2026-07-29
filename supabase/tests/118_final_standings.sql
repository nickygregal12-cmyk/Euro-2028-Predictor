begin;

select plan(15);

insert into public.tournaments (id, name, year, starts_on, ends_on, lock_at) values
  ('62000000-0000-0000-0000-000000000001', 'Final standings test', 2097, '2097-06-01', '2097-07-01', now() - interval '30 days');

insert into public.groups (id, tournament_id, letter) values
  ('62000000-0000-0000-0000-000000000010', '62000000-0000-0000-0000-000000000001', 'A');

insert into public.teams (id, tournament_id, name) values
  ('62000000-0000-0000-0000-000000000101', '62000000-0000-0000-0000-000000000001', 'Final Home'),
  ('62000000-0000-0000-0000-000000000102', '62000000-0000-0000-0000-000000000001', 'Final Away'),
  ('62000000-0000-0000-0000-000000000103', '62000000-0000-0000-0000-000000000001', 'Final Third'),
  ('62000000-0000-0000-0000-000000000104', '62000000-0000-0000-0000-000000000001', 'Final Fourth');

insert into public.group_teams (group_id, team_id, slot) values
  ('62000000-0000-0000-0000-000000000010', '62000000-0000-0000-0000-000000000101', 1),
  ('62000000-0000-0000-0000-000000000010', '62000000-0000-0000-0000-000000000102', 2),
  ('62000000-0000-0000-0000-000000000010', '62000000-0000-0000-0000-000000000103', 3),
  ('62000000-0000-0000-0000-000000000010', '62000000-0000-0000-0000-000000000104', 4);

set local session_replication_role = replica;
insert into public.matches (
  id, tournament_id, match_ref, round, group_id, matchday, home_source, away_source,
  home_team_id, away_team_id, match_date, kickoff_at, venue,
  home_score, away_score, result_state, result_method, home_score_90, away_score_90,
  result_version, confirmed_at, winner_team_id
) values
  ('62000000-0000-0000-0000-000000000201', '62000000-0000-0000-0000-000000000001', 'FS-G1', 'group', '62000000-0000-0000-0000-000000000010', 1, 'A1', 'A2', '62000000-0000-0000-0000-000000000101', '62000000-0000-0000-0000-000000000102', '2097-06-01', '2097-06-01T12:00:00Z', 'Final Test', 2, 0, 'confirmed', 'regulation', 2, 0, 1, now(), '62000000-0000-0000-0000-000000000101'),
  ('62000000-0000-0000-0000-000000000202', '62000000-0000-0000-0000-000000000001', 'FS-G2', 'group', '62000000-0000-0000-0000-000000000010', 1, 'A3', 'A4', '62000000-0000-0000-0000-000000000103', '62000000-0000-0000-0000-000000000104', '2097-06-01', '2097-06-01T15:00:00Z', 'Final Test', 1, 1, 'confirmed', 'regulation', 1, 1, 1, now(), null),
  ('62000000-0000-0000-0000-000000000203', '62000000-0000-0000-0000-000000000001', 'FS-F', 'final', null, null, 'W-SF-1', 'W-SF-2', '62000000-0000-0000-0000-000000000101', '62000000-0000-0000-0000-000000000102', '2097-07-01', '2097-07-01T20:00:00Z', 'Final Test', null, null, 'scheduled', null, null, null, 0, null, null);
set local session_replication_role = origin;

insert into auth.users (id, email, aud, role, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
select
  ('62000000-0000-0000-0001-' || lpad(i::text, 12, '0'))::uuid,
  format('final-standing-%s@example.test', i), 'authenticated', 'authenticated', '{}'::jsonb,
  jsonb_build_object('display_name', format('Player %s', 7 - i)), now(), now()
from generate_series(1, 6) i;

insert into public.profiles (id, display_name, welcomed_at)
select ('62000000-0000-0000-0001-' || lpad(i::text, 12, '0'))::uuid,
       format('Player %s', 7 - i), now()
from generate_series(1, 6) i
on conflict (id) do update set display_name = excluded.display_name;

insert into public.entries (id, user_id, tournament_id, submitted_at)
select ('62000000-0000-0000-0002-' || lpad(i::text, 12, '0'))::uuid,
       ('62000000-0000-0000-0001-' || lpad(i::text, 12, '0'))::uuid,
       '62000000-0000-0000-0000-000000000001', now()
from generate_series(1, 6) i;

set local session_replication_role = replica;
insert into public.match_predictions (entry_id, match_id, home_score, away_score) values
  ('62000000-0000-0000-0002-000000000001','62000000-0000-0000-0000-000000000201',2,0),
  ('62000000-0000-0000-0002-000000000001','62000000-0000-0000-0000-000000000202',0,1),
  ('62000000-0000-0000-0002-000000000002','62000000-0000-0000-0000-000000000201',3,0),
  ('62000000-0000-0000-0002-000000000002','62000000-0000-0000-0000-000000000202',2,2),
  ('62000000-0000-0000-0002-000000000003','62000000-0000-0000-0000-000000000201',1,0),
  ('62000000-0000-0000-0002-000000000003','62000000-0000-0000-0000-000000000202',0,1),
  ('62000000-0000-0000-0002-000000000004','62000000-0000-0000-0000-000000000201',1,0),
  ('62000000-0000-0000-0002-000000000004','62000000-0000-0000-0000-000000000202',0,1),
  ('62000000-0000-0000-0002-000000000005','62000000-0000-0000-0000-000000000201',3,0),
  ('62000000-0000-0000-0002-000000000005','62000000-0000-0000-0000-000000000202',0,1),
  ('62000000-0000-0000-0002-000000000006','62000000-0000-0000-0000-000000000201',1,0),
  ('62000000-0000-0000-0002-000000000006','62000000-0000-0000-0000-000000000202',0,1);

insert into public.score_events (entry_id, category, points, explanation) values
  ('62000000-0000-0000-0002-000000000001','group_positions',200,'balance'),
  ('62000000-0000-0000-0002-000000000002','group_positions',200,'balance'),
  ('62000000-0000-0000-0002-000000000003','knockout',10,'qf'),
  ('62000000-0000-0000-0002-000000000003','knockout',25,'sf'),
  ('62000000-0000-0000-0002-000000000003','group_positions',165,'balance'),
  ('62000000-0000-0000-0002-000000000004','knockout',110,'champion'),
  ('62000000-0000-0000-0002-000000000004','group_positions',90,'balance'),
  ('62000000-0000-0000-0002-000000000005','knockout',10,'qf'),
  ('62000000-0000-0000-0002-000000000005','group_positions',190,'balance'),
  ('62000000-0000-0000-0002-000000000006','knockout',10,'qf'),
  ('62000000-0000-0000-0002-000000000006','group_positions',190,'balance');
set local session_replication_role = origin;

insert into public.leagues (id, tournament_id, name, invite_code, owner_id) values
  ('62000000-0000-0000-0000-000000000301', '62000000-0000-0000-0000-000000000001', 'Final standings league', 'FINL62', '62000000-0000-0000-0001-000000000001');
insert into public.league_members (league_id, user_id, role)
select '62000000-0000-0000-0000-000000000301',
       ('62000000-0000-0000-0001-' || lpad(i::text, 12, '0'))::uuid,
       case when i = 1 then 'owner' else 'member' end
from generate_series(1, 6) i;

select set_config('request.jwt.claim.sub', '62000000-0000-0000-0001-000000000001', true);

select is(
  public.get_leaderboard('62000000-0000-0000-0000-000000000001', 10, null) ->> 'finalStandings',
  'false',
  'standings remain live while any tournament fixture is scheduled'
);
select is(
  (public.get_leaderboard('62000000-0000-0000-0000-000000000001', 10, null) #>> '{rows,0,rank}')::integer,
  null::integer,
  'equal live totals keep the pre-result rank hidden'
);
select is(
  public.get_leaderboard('62000000-0000-0000-0000-000000000001', 10, null) #>> '{rows,0,displayName}',
  'Player 1',
  'live equal totals retain deterministic alphabetical ordering'
);

set local session_replication_role = replica;
update public.matches set
  home_score = 1, away_score = 0, result_state = 'confirmed', result_method = 'regulation',
  home_score_90 = 1, away_score_90 = 0, result_version = 1, confirmed_at = now(),
  winner_team_id = '62000000-0000-0000-0000-000000000101'
where id = '62000000-0000-0000-0000-000000000203';
set local session_replication_role = origin;

create temporary table final_pages (name text primary key, payload jsonb not null) on commit drop;
insert into final_pages values
  ('overall', public.get_leaderboard('62000000-0000-0000-0000-000000000001', 10, null)),
  ('page1', public.get_leaderboard('62000000-0000-0000-0000-000000000001', 2, null));
insert into final_pages
select 'page2', public.get_leaderboard('62000000-0000-0000-0000-000000000001', 2, payload ->> 'nextCursor')
from final_pages where name = 'page1';

select is((select payload ->> 'finalStandings' from final_pages where name = 'overall'), 'true', 'final standings activate only after every result');
select is((select payload #>> '{rows,0,displayName}' from final_pages where name = 'overall'), 'Player 6', 'most exact scores wins the first tie-break');
select is((select payload #>> '{rows,1,displayName}' from final_pages where name = 'overall'), 'Player 5', 'most correct outcomes wins the second tie-break');
select is((select payload #>> '{rows,2,displayName}' from final_pages where name = 'overall'), 'Player 4', 'most correct knockout teams wins before champion');
select is((select payload #>> '{rows,3,displayName}' from final_pages where name = 'overall'), 'Player 3', 'correct champion wins the fourth tie-break');
select is((select payload #>> '{rows,4,displayName}' from final_pages where name = 'overall'), 'Player 2', 'closest group goals wins the fifth tie-break');
select is((select payload #>> '{rows,5,displayName}' from final_pages where name = 'overall'), 'Player 1', 'the remaining tied entry follows after all five criteria');
select is((select (payload #>> '{rows,0,rank}')::integer from final_pages where name = 'overall'), 1, 'final ranks use tie-break order');
select is((select (payload #>> '{rows,1,rank}')::integer from final_pages where name = 'page2'), 4, 'final cursor traversal preserves absolute rank and position');

set local role authenticated;
select is(
  public.get_league_members('62000000-0000-0000-0000-000000000301', 10, null) ->> 'finalStandings',
  'true',
  'private leagues activate the same final mode'
);
select is(
  public.get_league_members('62000000-0000-0000-0000-000000000301', 10, null) #>> '{rows,0,displayName}',
  'Player 6',
  'private leagues use the same tie-break ordering'
);
reset role;

select ok(
  not has_function_privilege('authenticated', 'predictor_internal.standing_metrics(uuid)', 'execute'),
  'browser roles cannot execute the internal metrics helper'
);

select * from finish();
rollback;
