begin;

select plan(18);

-- Capture the SQLSTATE from one statement. NULL means it completed normally.
-- The helper is invoker-rights, so calls made after SET ROLE exercise the same
-- grants, RLS policies and triggers as the authenticated client role.
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

-- ---------------------------------------------------------------------------
-- Two users and two tournaments. Tournament one has one complete four-team
-- group plus four extra in-tournament teams for the existing eight-row
-- winner-only progression shape. Tournament two supplies hostile foreign refs.
-- ---------------------------------------------------------------------------
insert into auth.users (
  id,
  email,
  aud,
  role,
  raw_app_meta_data,
  raw_user_meta_data,
  created_at,
  updated_at
) values
  (
    '00000000-0000-0000-0000-000000000001',
    'entry-owner@example.test',
    'authenticated',
    'authenticated',
    '{}'::jsonb,
    '{}'::jsonb,
    now(),
    now()
  ),
  (
    '00000000-0000-0000-0000-000000000002',
    'other-user@example.test',
    'authenticated',
    'authenticated',
    '{}'::jsonb,
    '{}'::jsonb,
    now(),
    now()
  );

insert into public.tournaments (
  id,
  name,
  year,
  starts_on,
  ends_on,
  lock_at
) values
  (
    '00000000-0000-0000-0000-000000000101',
    'Entry Boundary Test One',
    2028,
    '2028-06-09',
    '2028-07-09',
    now() + interval '1 day'
  ),
  (
    '00000000-0000-0000-0000-000000000102',
    'Entry Boundary Test Two',
    2032,
    '2032-06-09',
    '2032-07-09',
    now() + interval '5 years'
  );

insert into public.groups (id, tournament_id, letter) values
  (
    '00000000-0000-0000-0000-000000000301',
    '00000000-0000-0000-0000-000000000101',
    'A'
  ),
  (
    '00000000-0000-0000-0000-000000000302',
    '00000000-0000-0000-0000-000000000102',
    'B'
  );

insert into public.teams (id, tournament_id, name) values
  ('00000000-0000-0000-0000-000000000401', '00000000-0000-0000-0000-000000000101', 'Boundary A'),
  ('00000000-0000-0000-0000-000000000402', '00000000-0000-0000-0000-000000000101', 'Boundary B'),
  ('00000000-0000-0000-0000-000000000403', '00000000-0000-0000-0000-000000000101', 'Boundary C'),
  ('00000000-0000-0000-0000-000000000404', '00000000-0000-0000-0000-000000000101', 'Boundary D'),
  ('00000000-0000-0000-0000-000000000405', '00000000-0000-0000-0000-000000000101', 'Boundary E'),
  ('00000000-0000-0000-0000-000000000406', '00000000-0000-0000-0000-000000000101', 'Boundary F'),
  ('00000000-0000-0000-0000-000000000407', '00000000-0000-0000-0000-000000000101', 'Boundary G'),
  ('00000000-0000-0000-0000-000000000408', '00000000-0000-0000-0000-000000000101', 'Boundary H'),
  ('00000000-0000-0000-0000-000000000411', '00000000-0000-0000-0000-000000000102', 'Foreign I'),
  ('00000000-0000-0000-0000-000000000412', '00000000-0000-0000-0000-000000000102', 'Foreign J'),
  ('00000000-0000-0000-0000-000000000413', '00000000-0000-0000-0000-000000000102', 'Foreign K'),
  ('00000000-0000-0000-0000-000000000414', '00000000-0000-0000-0000-000000000102', 'Foreign L');

insert into public.group_teams (group_id, team_id, slot) values
  ('00000000-0000-0000-0000-000000000301', '00000000-0000-0000-0000-000000000401', 1),
  ('00000000-0000-0000-0000-000000000301', '00000000-0000-0000-0000-000000000402', 2),
  ('00000000-0000-0000-0000-000000000301', '00000000-0000-0000-0000-000000000403', 3),
  ('00000000-0000-0000-0000-000000000301', '00000000-0000-0000-0000-000000000404', 4),
  ('00000000-0000-0000-0000-000000000302', '00000000-0000-0000-0000-000000000411', 1),
  ('00000000-0000-0000-0000-000000000302', '00000000-0000-0000-0000-000000000412', 2),
  ('00000000-0000-0000-0000-000000000302', '00000000-0000-0000-0000-000000000413', 3),
  ('00000000-0000-0000-0000-000000000302', '00000000-0000-0000-0000-000000000414', 4);

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
  ('00000000-0000-0000-0000-000000000501', '00000000-0000-0000-0000-000000000101', 'GA-1', 'group', '00000000-0000-0000-0000-000000000301', 1, 'A1', 'A2', '00000000-0000-0000-0000-000000000401', '00000000-0000-0000-0000-000000000402', '2028-06-09', '2028-06-09 17:00:00+00', 'Test Stadium'),
  ('00000000-0000-0000-0000-000000000502', '00000000-0000-0000-0000-000000000101', 'GA-2', 'group', '00000000-0000-0000-0000-000000000301', 1, 'A3', 'A4', '00000000-0000-0000-0000-000000000403', '00000000-0000-0000-0000-000000000404', '2028-06-09', '2028-06-09 20:00:00+00', 'Test Stadium'),
  ('00000000-0000-0000-0000-000000000503', '00000000-0000-0000-0000-000000000101', 'GA-3', 'group', '00000000-0000-0000-0000-000000000301', 2, 'A1', 'A3', '00000000-0000-0000-0000-000000000401', '00000000-0000-0000-0000-000000000403', '2028-06-13', '2028-06-13 17:00:00+00', 'Test Stadium'),
  ('00000000-0000-0000-0000-000000000504', '00000000-0000-0000-0000-000000000101', 'GA-4', 'group', '00000000-0000-0000-0000-000000000301', 2, 'A4', 'A2', '00000000-0000-0000-0000-000000000404', '00000000-0000-0000-0000-000000000402', '2028-06-13', '2028-06-13 20:00:00+00', 'Test Stadium'),
  ('00000000-0000-0000-0000-000000000505', '00000000-0000-0000-0000-000000000101', 'GA-5', 'group', '00000000-0000-0000-0000-000000000301', 3, 'A4', 'A1', '00000000-0000-0000-0000-000000000404', '00000000-0000-0000-0000-000000000401', '2028-06-17', '2028-06-17 20:00:00+00', 'Test Stadium'),
  ('00000000-0000-0000-0000-000000000506', '00000000-0000-0000-0000-000000000101', 'GA-6', 'group', '00000000-0000-0000-0000-000000000301', 3, 'A2', 'A3', '00000000-0000-0000-0000-000000000402', '00000000-0000-0000-0000-000000000403', '2028-06-17', '2028-06-17 20:00:00+00', 'Test Stadium'),
  ('00000000-0000-0000-0000-000000000511', '00000000-0000-0000-0000-000000000102', 'GB-1', 'group', '00000000-0000-0000-0000-000000000302', 1, 'B1', 'B2', '00000000-0000-0000-0000-000000000411', '00000000-0000-0000-0000-000000000412', '2032-06-09', '2032-06-09 17:00:00+00', 'Foreign Stadium');

insert into public.players (id, tournament_id, name, team_id) values
  ('00000000-0000-0000-0000-000000000601', '00000000-0000-0000-0000-000000000101', 'Owner Player', '00000000-0000-0000-0000-000000000401'),
  ('00000000-0000-0000-0000-000000000602', '00000000-0000-0000-0000-000000000102', 'Foreign Player', '00000000-0000-0000-0000-000000000411');

insert into public.entries (id, user_id, tournament_id) values
  ('00000000-0000-0000-0000-000000000201', '00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000101'),
  ('00000000-0000-0000-0000-000000000202', '00000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000101');

insert into public.predicted_progression (entry_id, team_id, stage) values
  ('00000000-0000-0000-0000-000000000201', '00000000-0000-0000-0000-000000000401', 'champion'),
  ('00000000-0000-0000-0000-000000000201', '00000000-0000-0000-0000-000000000402', 'final'),
  ('00000000-0000-0000-0000-000000000201', '00000000-0000-0000-0000-000000000403', 'sf'),
  ('00000000-0000-0000-0000-000000000201', '00000000-0000-0000-0000-000000000404', 'sf'),
  ('00000000-0000-0000-0000-000000000201', '00000000-0000-0000-0000-000000000405', 'qf'),
  ('00000000-0000-0000-0000-000000000201', '00000000-0000-0000-0000-000000000406', 'qf'),
  ('00000000-0000-0000-0000-000000000201', '00000000-0000-0000-0000-000000000407', 'qf'),
  ('00000000-0000-0000-0000-000000000201', '00000000-0000-0000-0000-000000000408', 'qf');

insert into public.bonus_predictions (entry_id, golden_boot_player_id) values
  ('00000000-0000-0000-0000-000000000201', '00000000-0000-0000-0000-000000000601');

-- The sixth insert makes the group complete. The AFTER trigger must atomically
-- materialise the trusted A-B-C-D order without any client group-position write.
insert into public.match_predictions (entry_id, match_id, home_score, away_score) values
  ('00000000-0000-0000-0000-000000000201', '00000000-0000-0000-0000-000000000501', 2, 0),
  ('00000000-0000-0000-0000-000000000201', '00000000-0000-0000-0000-000000000502', 1, 0),
  ('00000000-0000-0000-0000-000000000201', '00000000-0000-0000-0000-000000000503', 1, 0),
  ('00000000-0000-0000-0000-000000000201', '00000000-0000-0000-0000-000000000504', 0, 1),
  ('00000000-0000-0000-0000-000000000201', '00000000-0000-0000-0000-000000000505', 0, 1),
  ('00000000-0000-0000-0000-000000000201', '00000000-0000-0000-0000-000000000506', 1, 0);

select is(
  (
    select jsonb_agg(to_jsonb(pgp.team_id::text) order by pgp.position)
    from public.predicted_group_positions pgp
    where pgp.entry_id = '00000000-0000-0000-0000-000000000201'
      and pgp.group_id = '00000000-0000-0000-0000-000000000301'
  ),
  '["00000000-0000-0000-0000-000000000401","00000000-0000-0000-0000-000000000402","00000000-0000-0000-0000-000000000403","00000000-0000-0000-0000-000000000404"]'::jsonb,
  'complete scores automatically create the four trusted group-position rows'
);

select ok(
  has_function_privilege('authenticated', 'public.submit_entry(uuid)', 'execute'),
  'authenticated users can execute the protected submit RPC'
);

select ok(
  not has_function_privilege(
    'authenticated',
    'predictor_internal.refresh_entry_group_positions(uuid,uuid,boolean)',
    'execute'
  ),
  'authenticated users cannot execute the private snapshot builder'
);

set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000001', true);
select set_config('request.jwt.claim.role', 'authenticated', true);

select is(
  pg_temp.capture_sqlstate($sql$
    update public.entries
      set submitted_at = now()
      where id = '00000000-0000-0000-0000-000000000201'
  $sql$),
  '42501',
  'the owner cannot directly alter submitted_at'
);

select is(
  pg_temp.capture_sqlstate($sql$
    insert into public.entries (
      id,
      user_id,
      tournament_id,
      submitted_at
    ) values (
      '00000000-0000-0000-0000-000000000203',
      '00000000-0000-0000-0000-000000000001',
      '00000000-0000-0000-0000-000000000102',
      now()
    )
  $sql$),
  '42501',
  'a client-created entry cannot begin in a submitted state'
);

select is(
  pg_temp.capture_sqlstate($sql$
    insert into public.predicted_group_positions (
      entry_id,
      group_id,
      team_id,
      position
    ) values (
      '00000000-0000-0000-0000-000000000201',
      '00000000-0000-0000-0000-000000000301',
      '00000000-0000-0000-0000-000000000401',
      1
    )
  $sql$),
  '42501',
  'the owner cannot forge a group-position scoring row'
);

select ok(
  public.submit_entry('00000000-0000-0000-0000-000000000201') is not null,
  'a complete correctly scoped owner entry submits through the RPC'
);

select ok(
  (
    select e.submitted_at is not null
    from public.entries e
    where e.id = '00000000-0000-0000-0000-000000000201'
  ),
  'the protected RPC stamps submitted_at'
);

-- Submission does not freeze the entry before lock. Changing A-B to a B win
-- must remain legal and refresh the snapshot to B-A-C-D.
select is(
  pg_temp.capture_sqlstate($sql$
    update public.match_predictions
      set home_score = 0,
          away_score = 1
      where entry_id = '00000000-0000-0000-0000-000000000201'
        and match_id = '00000000-0000-0000-0000-000000000501'
  $sql$),
  null::text,
  'a submitted entry remains editable before the tournament lock'
);

select is(
  (
    select jsonb_agg(to_jsonb(pgp.team_id::text) order by pgp.position)
    from public.predicted_group_positions pgp
    where pgp.entry_id = '00000000-0000-0000-0000-000000000201'
      and pgp.group_id = '00000000-0000-0000-0000-000000000301'
  ),
  '["00000000-0000-0000-0000-000000000402","00000000-0000-0000-0000-000000000401","00000000-0000-0000-0000-000000000403","00000000-0000-0000-0000-000000000404"]'::jsonb,
  'a pre-lock score edit atomically refreshes the group-position snapshot'
);

select is(
  pg_temp.capture_sqlstate($sql$
    insert into public.match_predictions (
      entry_id,
      match_id,
      home_score,
      away_score
    ) values (
      '00000000-0000-0000-0000-000000000201',
      '00000000-0000-0000-0000-000000000511',
      0,
      0
    )
  $sql$),
  '23514',
  'a match prediction cannot reference another tournament'
);

select is(
  pg_temp.capture_sqlstate($sql$
    insert into public.predicted_progression (
      entry_id,
      team_id,
      stage
    ) values (
      '00000000-0000-0000-0000-000000000201',
      '00000000-0000-0000-0000-000000000411',
      'qf'
    )
  $sql$),
  '23514',
  'a progression row cannot reference another tournament'
);

select is(
  pg_temp.capture_sqlstate($sql$
    update public.bonus_predictions
      set golden_boot_player_id = '00000000-0000-0000-0000-000000000602'
      where entry_id = '00000000-0000-0000-0000-000000000201'
  $sql$),
  '23514',
  'a Golden Boot row cannot reference another tournament'
);

select is(
  pg_temp.capture_sqlstate($sql$
    insert into public.predicted_tie_resolutions (
      entry_id,
      scope,
      tie_key,
      ordered_team_ids
    ) values (
      '00000000-0000-0000-0000-000000000201',
      'third',
      '00000000-0000-0000-0000-000000000401|00000000-0000-0000-0000-000000000411',
      array[
        '00000000-0000-0000-0000-000000000401'::uuid,
        '00000000-0000-0000-0000-000000000411'::uuid
      ]
    )
  $sql$),
  '23514',
  'a manual tie decision cannot mix tournaments'
);

set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000002', true);
select set_config('request.jwt.claim.role', 'authenticated', true);

select is(
  (
    select count(*)::integer
    from public.predicted_group_positions pgp
    where pgp.entry_id = '00000000-0000-0000-0000-000000000201'
  ),
  0,
  'another user cannot read the owner group-position snapshot'
);

select is(
  pg_temp.capture_sqlstate($sql$
    select public.submit_entry('00000000-0000-0000-0000-000000000201')
  $sql$),
  '42501',
  'another user cannot submit the owner entry'
);

reset role;
update public.tournaments
  set lock_at = now() - interval '1 second'
  where id = '00000000-0000-0000-0000-000000000101';

set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000001', true);
select set_config('request.jwt.claim.role', 'authenticated', true);

select is(
  pg_temp.capture_sqlstate($sql$
    delete from public.match_predictions
      where entry_id = '00000000-0000-0000-0000-000000000201'
        and match_id = '00000000-0000-0000-0000-000000000506'
  $sql$),
  '23514',
  'a match prediction cannot be deleted after tournament lock'
);

select is(
  pg_temp.capture_sqlstate($sql$
    select public.submit_entry('00000000-0000-0000-0000-000000000201')
  $sql$),
  '23514',
  'manual submission is rejected at or after tournament lock'
);

reset role;
select * from finish();
rollback;
