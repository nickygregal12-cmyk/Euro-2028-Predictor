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

insert into auth.users (
  id, email, aud, role, raw_app_meta_data, raw_user_meta_data, created_at, updated_at
) values
  (
    '90000000-0000-0000-0000-000000000001',
    'delete-owner@example.test',
    'authenticated',
    'authenticated',
    '{}'::jsonb,
    '{"display_name":"Delete Owner"}'::jsonb,
    now(),
    now()
  ),
  (
    '90000000-0000-0000-0000-000000000002',
    'delete-rival@example.test',
    'authenticated',
    'authenticated',
    '{}'::jsonb,
    '{"display_name":"Delete Rival"}'::jsonb,
    now(),
    now()
  );

insert into public.tournaments (
  id, name, year, starts_on, ends_on, lock_at
) values
  (
    '90000000-0000-0000-0000-000000000101',
    'Delete Test Tournament',
    2036,
    '2036-06-09',
    '2036-07-09',
    now() + interval '10 years'
  ),
  (
    '90000000-0000-0000-0000-000000000102',
    'Foreign Tournament',
    2040,
    '2040-06-09',
    '2040-07-09',
    now() + interval '14 years'
  );

insert into public.groups (id, tournament_id, letter) values
  ('90000000-0000-0000-0000-000000000201', '90000000-0000-0000-0000-000000000101', 'A'),
  ('90000000-0000-0000-0000-000000000202', '90000000-0000-0000-0000-000000000102', 'B');

insert into public.teams (id, tournament_id, name) values
  ('90000000-0000-0000-0000-000000000301', '90000000-0000-0000-0000-000000000101', 'Alpha'),
  ('90000000-0000-0000-0000-000000000302', '90000000-0000-0000-0000-000000000101', 'Bravo'),
  ('90000000-0000-0000-0000-000000000303', '90000000-0000-0000-0000-000000000101', 'Charlie'),
  ('90000000-0000-0000-0000-000000000304', '90000000-0000-0000-0000-000000000101', 'Delta'),
  ('90000000-0000-0000-0000-000000000311', '90000000-0000-0000-0000-000000000102', 'Foreign One'),
  ('90000000-0000-0000-0000-000000000312', '90000000-0000-0000-0000-000000000102', 'Foreign Two');

insert into public.group_teams (group_id, team_id, slot) values
  ('90000000-0000-0000-0000-000000000201', '90000000-0000-0000-0000-000000000301', 1),
  ('90000000-0000-0000-0000-000000000201', '90000000-0000-0000-0000-000000000302', 2),
  ('90000000-0000-0000-0000-000000000201', '90000000-0000-0000-0000-000000000303', 3),
  ('90000000-0000-0000-0000-000000000201', '90000000-0000-0000-0000-000000000304', 4),
  ('90000000-0000-0000-0000-000000000202', '90000000-0000-0000-0000-000000000311', 1),
  ('90000000-0000-0000-0000-000000000202', '90000000-0000-0000-0000-000000000312', 2);

insert into public.matches (
  id,
  tournament_id,
  match_ref,
  round,
  group_id,
  matchday,
  home_source,
  away_source,
  home_team_id,
  away_team_id,
  match_date,
  kickoff_at,
  venue
) values
  ('90000000-0000-0000-0000-000000000401', '90000000-0000-0000-0000-000000000101', 'D1', 'group', '90000000-0000-0000-0000-000000000201', 1, 'A1', 'A2', '90000000-0000-0000-0000-000000000301', '90000000-0000-0000-0000-000000000302', '2036-06-09', '2036-06-09 19:00:00+00', 'Delete Stadium'),
  ('90000000-0000-0000-0000-000000000402', '90000000-0000-0000-0000-000000000101', 'D2', 'group', '90000000-0000-0000-0000-000000000201', 1, 'A3', 'A4', '90000000-0000-0000-0000-000000000303', '90000000-0000-0000-0000-000000000304', '2036-06-10', '2036-06-10 19:00:00+00', 'Delete Stadium'),
  ('90000000-0000-0000-0000-000000000403', '90000000-0000-0000-0000-000000000101', 'D3', 'group', '90000000-0000-0000-0000-000000000201', 2, 'A1', 'A3', '90000000-0000-0000-0000-000000000301', '90000000-0000-0000-0000-000000000303', '2036-06-13', '2036-06-13 19:00:00+00', 'Delete Stadium'),
  ('90000000-0000-0000-0000-000000000404', '90000000-0000-0000-0000-000000000101', 'D4', 'group', '90000000-0000-0000-0000-000000000201', 2, 'A2', 'A4', '90000000-0000-0000-0000-000000000302', '90000000-0000-0000-0000-000000000304', '2036-06-14', '2036-06-14 19:00:00+00', 'Delete Stadium'),
  ('90000000-0000-0000-0000-000000000405', '90000000-0000-0000-0000-000000000101', 'D5', 'group', '90000000-0000-0000-0000-000000000201', 3, 'A1', 'A4', '90000000-0000-0000-0000-000000000301', '90000000-0000-0000-0000-000000000304', '2036-06-17', '2036-06-17 19:00:00+00', 'Delete Stadium'),
  ('90000000-0000-0000-0000-000000000406', '90000000-0000-0000-0000-000000000101', 'D6', 'group', '90000000-0000-0000-0000-000000000201', 3, 'A2', 'A3', '90000000-0000-0000-0000-000000000302', '90000000-0000-0000-0000-000000000303', '2036-06-18', '2036-06-18 19:00:00+00', 'Delete Stadium'),
  ('90000000-0000-0000-0000-000000000411', '90000000-0000-0000-0000-000000000102', 'F1', 'group', '90000000-0000-0000-0000-000000000202', 1, 'B1', 'B2', '90000000-0000-0000-0000-000000000311', '90000000-0000-0000-0000-000000000312', '2040-06-09', '2040-06-09 19:00:00+00', 'Foreign Stadium');

insert into public.entries (id, user_id, tournament_id) values
  ('90000000-0000-0000-0000-000000000501', '90000000-0000-0000-0000-000000000001', '90000000-0000-0000-0000-000000000101'),
  ('90000000-0000-0000-0000-000000000502', '90000000-0000-0000-0000-000000000002', '90000000-0000-0000-0000-000000000101');

insert into public.match_predictions (entry_id, match_id, home_score, away_score) values
  ('90000000-0000-0000-0000-000000000501', '90000000-0000-0000-0000-000000000401', 2, 0),
  ('90000000-0000-0000-0000-000000000501', '90000000-0000-0000-0000-000000000402', 1, 0),
  ('90000000-0000-0000-0000-000000000501', '90000000-0000-0000-0000-000000000403', 1, 0),
  ('90000000-0000-0000-0000-000000000501', '90000000-0000-0000-0000-000000000404', 0, 1),
  ('90000000-0000-0000-0000-000000000501', '90000000-0000-0000-0000-000000000405', 0, 1),
  ('90000000-0000-0000-0000-000000000501', '90000000-0000-0000-0000-000000000406', 1, 0);

select ok(
  has_function_privilege(
    'authenticated',
    'public.delete_match_prediction(uuid,uuid,integer)',
    'execute'
  ),
  'authenticated users can execute the protected prediction-delete RPC'
);

select ok(
  not has_function_privilege(
    'anon',
    'public.delete_match_prediction(uuid,uuid,integer)',
    'execute'
  ),
  'anonymous users cannot execute the prediction-delete RPC'
);

select ok(
  not has_table_privilege('authenticated', 'public.match_predictions', 'delete'),
  'authenticated users cannot delete match prediction rows directly'
);

select ok(
  not has_table_privilege('service_role', 'public.match_predictions', 'delete'),
  'service_role cannot bypass the version-safe prediction-delete RPC'
);

set local role authenticated;
select set_config('request.jwt.claim.sub', '90000000-0000-0000-0000-000000000001', true);
select set_config('request.jwt.claim.role', 'authenticated', true);

select is(
  pg_temp.capture_sqlstate($sql$
    delete from public.match_predictions
    where entry_id = '90000000-0000-0000-0000-000000000501'
      and match_id = '90000000-0000-0000-0000-000000000401'
  $sql$),
  '42501',
  'the owner cannot bypass the RPC with a direct table delete'
);

select set_config('request.jwt.claim.sub', '90000000-0000-0000-0000-000000000002', true);
select is(
  pg_temp.capture_sqlstate($sql$
    select public.delete_match_prediction(
      '90000000-0000-0000-0000-000000000501',
      '90000000-0000-0000-0000-000000000401',
      0
    )
  $sql$),
  '42501',
  'another user cannot clear the owner prediction'
);

select set_config('request.jwt.claim.sub', '90000000-0000-0000-0000-000000000001', true);

select is(
  pg_temp.capture_sqlstate($sql$
    select public.delete_match_prediction(
      '90000000-0000-0000-0000-000000000501',
      '90000000-0000-0000-0000-000000000401',
      null
    )
  $sql$),
  'PT409',
  'an unknown version cannot delete a row created by another device'
);

select is(
  pg_temp.capture_sqlstate($sql$
    select public.delete_match_prediction(
      '90000000-0000-0000-0000-000000000501',
      '90000000-0000-0000-0000-000000000401',
      99
    )
  $sql$),
  'PT409',
  'a stale version cannot delete a newer prediction row'
);

select is(
  (
    select count(*)::integer
    from public.match_predictions
    where entry_id = '90000000-0000-0000-0000-000000000501'
      and match_id = '90000000-0000-0000-0000-000000000401'
  ),
  1,
  'conflicting clear attempts leave the prediction row intact'
);

select is(
  pg_temp.capture_sqlstate($sql$
    select public.delete_match_prediction(
      '90000000-0000-0000-0000-000000000501',
      '90000000-0000-0000-0000-000000000411',
      0
    )
  $sql$),
  '23514',
  'the RPC rejects a match from another tournament'
);

select ok(
  public.delete_match_prediction(
    '90000000-0000-0000-0000-000000000501',
    '90000000-0000-0000-0000-000000000401',
    0
  ),
  'the owner can clear the row using the exact version read'
);

select is(
  (
    select count(*)::integer
    from public.match_predictions
    where entry_id = '90000000-0000-0000-0000-000000000501'
      and match_id = '90000000-0000-0000-0000-000000000401'
  ),
  0,
  'the protected clear removes the complete score row'
);

select is(
  (
    select count(*)::integer
    from public.predicted_group_positions
    where entry_id = '90000000-0000-0000-0000-000000000501'
      and group_id = '90000000-0000-0000-0000-000000000201'
  ),
  0,
  'clearing one score removes the now-invalid derived group-position snapshot'
);

select ok(
  not public.delete_match_prediction(
    '90000000-0000-0000-0000-000000000501',
    '90000000-0000-0000-0000-000000000401',
    0
  ),
  'clearing an already absent row is idempotent'
);

reset role;
insert into public.match_predictions (
  entry_id, match_id, home_score, away_score
) values (
  '90000000-0000-0000-0000-000000000501',
  '90000000-0000-0000-0000-000000000401',
  2,
  0
);
update public.tournaments
set lock_at = now() - interval '1 minute'
where id = '90000000-0000-0000-0000-000000000101';

set local role authenticated;
select set_config('request.jwt.claim.sub', '90000000-0000-0000-0000-000000000001', true);
select set_config('request.jwt.claim.role', 'authenticated', true);

select is(
  pg_temp.capture_sqlstate($sql$
    select public.delete_match_prediction(
      '90000000-0000-0000-0000-000000000501',
      '90000000-0000-0000-0000-000000000401',
      0
    )
  $sql$),
  '23514',
  'a prediction cannot be cleared after the tournament lock'
);

select is(
  (
    select count(*)::integer
    from public.match_predictions
    where entry_id = '90000000-0000-0000-0000-000000000501'
      and match_id = '90000000-0000-0000-0000-000000000401'
  ),
  1,
  'the locked prediction remains intact after the refused clear'
);

select * from finish();
rollback;
