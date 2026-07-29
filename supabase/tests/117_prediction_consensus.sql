begin;

select plan(16);

create or replace function pg_temp.capture_sqlstate(p_sql text)
returns text
language plpgsql
as $$
begin
  execute p_sql;
  return null;
exception when others then
  return sqlstate;
end;
$$;

insert into public.tournaments (id, name, year, starts_on, ends_on, lock_at) values
  ('61000000-0000-0000-0000-000000000001', 'Consensus locked test', 2095, '2095-06-01', '2095-07-01', now() - interval '1 day'),
  ('61000000-0000-0000-0000-000000000002', 'Consensus future test', 2096, '2096-06-01', '2096-07-01', now() + interval '1 day');

insert into public.groups (id, tournament_id, letter) values
  ('61000000-0000-0000-0000-000000000010', '61000000-0000-0000-0000-000000000001', 'A');

insert into public.teams (id, tournament_id, name) values
  ('61000000-0000-0000-0000-000000000101', '61000000-0000-0000-0000-000000000001', 'Consensus One'),
  ('61000000-0000-0000-0000-000000000102', '61000000-0000-0000-0000-000000000001', 'Consensus Two'),
  ('61000000-0000-0000-0000-000000000103', '61000000-0000-0000-0000-000000000001', 'Consensus Three'),
  ('61000000-0000-0000-0000-000000000104', '61000000-0000-0000-0000-000000000001', 'Consensus Four');

insert into public.group_teams (group_id, team_id, slot) values
  ('61000000-0000-0000-0000-000000000010', '61000000-0000-0000-0000-000000000101', 1),
  ('61000000-0000-0000-0000-000000000010', '61000000-0000-0000-0000-000000000102', 2),
  ('61000000-0000-0000-0000-000000000010', '61000000-0000-0000-0000-000000000103', 3),
  ('61000000-0000-0000-0000-000000000010', '61000000-0000-0000-0000-000000000104', 4);

insert into public.matches (
  id, tournament_id, match_ref, round, group_id, matchday, home_source, away_source,
  home_team_id, away_team_id, match_date, kickoff_at, venue
) values
  ('61000000-0000-0000-0000-000000000201', '61000000-0000-0000-0000-000000000001', 'CS-G1', 'group', '61000000-0000-0000-0000-000000000010', 1, 'A1', 'A2', '61000000-0000-0000-0000-000000000101', '61000000-0000-0000-0000-000000000102', '2095-06-01', '2095-06-01T12:00:00Z', 'Consensus Test'),
  ('61000000-0000-0000-0000-000000000202', '61000000-0000-0000-0000-000000000001', 'CS-G2', 'group', '61000000-0000-0000-0000-000000000010', 1, 'A3', 'A4', '61000000-0000-0000-0000-000000000103', '61000000-0000-0000-0000-000000000104', '2095-06-01', '2095-06-01T15:00:00Z', 'Consensus Test');

insert into auth.users (id, email, aud, role, raw_app_meta_data, raw_user_meta_data, created_at, updated_at) values
  ('61000000-0000-0000-0001-000000000001', 'consensus-one@example.test', 'authenticated', 'authenticated', '{}'::jsonb, '{"display_name":"Consensus One"}'::jsonb, now(), now()),
  ('61000000-0000-0000-0001-000000000002', 'consensus-two@example.test', 'authenticated', 'authenticated', '{}'::jsonb, '{"display_name":"Consensus Two"}'::jsonb, now(), now()),
  ('61000000-0000-0000-0001-000000000003', 'consensus-draft@example.test', 'authenticated', 'authenticated', '{}'::jsonb, '{"display_name":"Consensus Draft"}'::jsonb, now(), now());

insert into auth.users (
  id, email, aud, role, raw_app_meta_data, raw_user_meta_data, created_at, updated_at
)
select
  ('61000000-0000-0000-0001-' || lpad(index::text, 12, '0'))::uuid,
  format('consensus-extra-%s@example.test', index),
  'authenticated',
  'authenticated',
  '{}'::jsonb,
  jsonb_build_object('display_name', format('Consensus Extra %s', index)),
  now(),
  now()
from generate_series(4, 11) as index;

insert into public.profiles (id, display_name, welcomed_at) values
  ('61000000-0000-0000-0001-000000000001', 'Consensus One', now()),
  ('61000000-0000-0000-0001-000000000002', 'Consensus Two', now()),
  ('61000000-0000-0000-0001-000000000003', 'Consensus Draft', now())
on conflict (id) do update set display_name = excluded.display_name;

insert into public.profiles (id, display_name, welcomed_at)
select
  ('61000000-0000-0000-0001-' || lpad(index::text, 12, '0'))::uuid,
  format('Consensus Extra %s', index),
  now()
from generate_series(4, 11) as index
on conflict (id) do update set display_name = excluded.display_name;

insert into public.entries (id, user_id, tournament_id, submitted_at) values
  ('61000000-0000-0000-0002-000000000001', '61000000-0000-0000-0001-000000000001', '61000000-0000-0000-0000-000000000001', now()),
  ('61000000-0000-0000-0002-000000000002', '61000000-0000-0000-0001-000000000002', '61000000-0000-0000-0000-000000000001', now()),
  ('61000000-0000-0000-0002-000000000003', '61000000-0000-0000-0001-000000000003', '61000000-0000-0000-0000-000000000001', null);

insert into public.entries (id, user_id, tournament_id, submitted_at)
select
  ('61000000-0000-0000-0002-' || lpad(index::text, 12, '0'))::uuid,
  ('61000000-0000-0000-0001-' || lpad(index::text, 12, '0'))::uuid,
  '61000000-0000-0000-0000-000000000001'::uuid,
  now()
from generate_series(4, 11) as index;

set local session_replication_role = replica;
insert into public.match_predictions (entry_id, match_id, home_score, away_score) values
  ('61000000-0000-0000-0002-000000000001', '61000000-0000-0000-0000-000000000201', 2, 0),
  ('61000000-0000-0000-0002-000000000001', '61000000-0000-0000-0000-000000000202', 1, 1),
  ('61000000-0000-0000-0002-000000000002', '61000000-0000-0000-0000-000000000201', 2, 0),
  ('61000000-0000-0000-0002-000000000002', '61000000-0000-0000-0000-000000000202', 2, 1),
  ('61000000-0000-0000-0002-000000000003', '61000000-0000-0000-0000-000000000201', 9, 9);

insert into public.predicted_progression (entry_id, team_id, stage) values
  ('61000000-0000-0000-0002-000000000001', '61000000-0000-0000-0000-000000000101', 'champion'),
  ('61000000-0000-0000-0002-000000000001', '61000000-0000-0000-0000-000000000102', 'final'),
  ('61000000-0000-0000-0002-000000000002', '61000000-0000-0000-0000-000000000101', 'champion'),
  ('61000000-0000-0000-0002-000000000002', '61000000-0000-0000-0000-000000000103', 'final'),
  ('61000000-0000-0000-0002-000000000003', '61000000-0000-0000-0000-000000000104', 'champion');
set local session_replication_role = origin;

select set_config('request.jwt.claim.sub', '61000000-0000-0000-0001-000000000001', true);
set local role authenticated;

create temporary table consensus_payload (payload jsonb not null) on commit drop;
insert into consensus_payload values (public.get_prediction_consensus('61000000-0000-0000-0000-000000000001'));

select is((select payload ->> 'suppressed' from consensus_payload), 'false', 'consensus is available at the ten-entry threshold');
select is((select (payload ->> 'minimum_entries')::integer from consensus_payload), 10, 'the public response declares the fixed cohort threshold');
select is((select (payload ->> 'submitted_entries')::integer from consensus_payload), 10, 'only submitted entries contribute');
select is((select jsonb_array_length(payload -> 'champion_race') from consensus_payload), 1, 'champion race is grouped and bounded');
select is((select (payload #>> '{champion_race,0,picks}')::integer from consensus_payload), 2, 'champion race counts both submitted picks');
select is((select jsonb_array_length(payload -> 'peoples_final') from consensus_payload), 2, 'distinct predicted final pairs remain separate');
select is((select payload #>> '{most_agreed_match,match_ref}' from consensus_payload), 'CS-G1', 'the unanimous scoreline produces the most-agreed match');
select is((select (payload #>> '{most_agreed_match,dominant_picks}')::integer from consensus_payload), 2, 'the dominant outcome count is preserved');
select is((select (payload #>> '{goals_spread,minimum}')::integer from consensus_payload), 4, 'goal spread minimum uses submitted entries only');
select is((select (payload #>> '{goals_spread,maximum}')::integer from consensus_payload), 5, 'goal spread maximum uses submitted entries only');
select ok((select jsonb_array_length(payload -> 'only_you') from consensus_payload) <= 6, 'caller-only uniqueness cards remain bounded');
select ok((select jsonb_array_length(payload -> 'champion_race') from consensus_payload) <= 10, 'ranked lists remain bounded');
select is((select payload -> 'golden_boot' from consensus_payload), '[]'::jsonb, 'missing award picks return a truthful empty list');
select is(pg_temp.capture_sqlstate($q$select public.get_prediction_consensus('61000000-0000-0000-0000-000000000002')$q$), '23514', 'consensus stays hidden before the tournament lock');
reset role;

select ok(has_function_privilege('authenticated', 'public.get_prediction_consensus(uuid)', 'execute'), 'authenticated users can call the bounded consensus RPC');
select ok(not has_function_privilege('anon', 'public.get_prediction_consensus(uuid)', 'execute'), 'anonymous users cannot call prediction consensus');

select * from finish();
rollback;
