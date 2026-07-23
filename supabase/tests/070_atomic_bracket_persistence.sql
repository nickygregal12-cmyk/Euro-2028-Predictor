begin;

select plan(27);

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
    '40000000-0000-0000-0000-000000000001',
    'atomic-owner@example.test',
    'authenticated', 'authenticated', '{}'::jsonb, '{}'::jsonb, now(), now()
  ),
  (
    '40000000-0000-0000-0000-000000000002',
    'atomic-other@example.test',
    'authenticated', 'authenticated', '{}'::jsonb, '{}'::jsonb, now(), now()
  );

insert into public.tournaments (
  id, name, year, starts_on, ends_on, lock_at
) values
  (
    '40000000-0000-0000-0000-000000000101',
    'Atomic Bracket Test', 2041, '2041-06-01', '2041-07-01', now() + interval '1 day'
  ),
  (
    '40000000-0000-0000-0000-000000000102',
    'Atomic Foreign Tournament', 2042, '2042-06-01', '2042-07-01', now() + interval '1 day'
  );

insert into public.teams (id, tournament_id, name) values
  ('40000000-0000-0000-0000-000000000301', '40000000-0000-0000-0000-000000000101', 'Atomic A'),
  ('40000000-0000-0000-0000-000000000302', '40000000-0000-0000-0000-000000000101', 'Atomic B'),
  ('40000000-0000-0000-0000-000000000303', '40000000-0000-0000-0000-000000000101', 'Atomic C'),
  ('40000000-0000-0000-0000-000000000304', '40000000-0000-0000-0000-000000000102', 'Foreign X');

insert into public.entries (id, user_id, tournament_id) values
  (
    '40000000-0000-0000-0000-000000000201',
    '40000000-0000-0000-0000-000000000001',
    '40000000-0000-0000-0000-000000000101'
  ),
  (
    '40000000-0000-0000-0000-000000000202',
    '40000000-0000-0000-0000-000000000002',
    '40000000-0000-0000-0000-000000000101'
  );

select ok(
  has_function_privilege(
    'authenticated',
    'public.replace_predicted_progression(uuid,jsonb,jsonb)',
    'execute'
  ),
  'authenticated users can execute the atomic bracket replacement RPC'
);

select ok(
  not has_table_privilege('authenticated', 'public.predicted_progression', 'insert'),
  'authenticated users cannot insert progression rows directly'
);

select ok(
  not has_table_privilege('authenticated', 'public.predicted_progression', 'update'),
  'authenticated users cannot update progression rows directly'
);

select ok(
  not has_table_privilege('authenticated', 'public.predicted_progression', 'delete'),
  'authenticated users cannot delete progression rows directly'
);

set local role authenticated;
select set_config('request.jwt.claim.sub', '40000000-0000-0000-0000-000000000001', true);
select set_config('request.jwt.claim.role', 'authenticated', true);

select is(
  pg_temp.capture_sqlstate($sql$
    insert into public.predicted_progression (entry_id, team_id, stage)
    values (
      '40000000-0000-0000-0000-000000000201',
      '40000000-0000-0000-0000-000000000301',
      'qf'
    )
  $sql$),
  '42501',
  'an authenticated owner cannot bypass the RPC with direct progression DML'
);

select lives_ok(
  $sql$
    select *
    from public.replace_predicted_progression(
      '40000000-0000-0000-0000-000000000201',
      '{
        "40000000-0000-0000-0000-000000000301":"qf",
        "40000000-0000-0000-0000-000000000302":"sf"
      }'::jsonb,
      '{}'::jsonb
    )
  $sql$,
  'an empty bracket can be replaced with two initial winners'
);

select is(
  (
    select count(*)::integer
    from public.predicted_progression pp
    where pp.entry_id = '40000000-0000-0000-0000-000000000201'
  ),
  2,
  'the initial replacement stores exactly the desired rows'
);

select is(
  (
    select string_agg(pp.team_id::text || ':' || pp.stage, ',' order by pp.team_id)
    from public.predicted_progression pp
    where pp.entry_id = '40000000-0000-0000-0000-000000000201'
  ),
  '40000000-0000-0000-0000-000000000301:qf,40000000-0000-0000-0000-000000000302:sf',
  'the initial replacement stores the exact desired team-stage map'
);

select is(
  (
    select max(pp.version)::integer
    from public.predicted_progression pp
    where pp.entry_id = '40000000-0000-0000-0000-000000000201'
  ),
  0,
  'new progression rows begin at version zero'
);

select lives_ok(
  $sql$
    select *
    from public.replace_predicted_progression(
      '40000000-0000-0000-0000-000000000201',
      '{
        "40000000-0000-0000-0000-000000000301":"sf",
        "40000000-0000-0000-0000-000000000303":"qf"
      }'::jsonb,
      '{
        "40000000-0000-0000-0000-000000000301":0,
        "40000000-0000-0000-0000-000000000302":0
      }'::jsonb
    )
  $sql$,
  'one transaction can update, delete and insert progression rows together'
);

select is(
  (
    select count(*)::integer
    from public.predicted_progression pp
    where pp.entry_id = '40000000-0000-0000-0000-000000000201'
  ),
  2,
  'the mixed replacement still stores exactly the desired row count'
);

select is(
  (
    select string_agg(
      pp.team_id::text || ':' || pp.stage || ':' || pp.version::text,
      ',' order by pp.team_id
    )
    from public.predicted_progression pp
    where pp.entry_id = '40000000-0000-0000-0000-000000000201'
  ),
  '40000000-0000-0000-0000-000000000301:sf:1,40000000-0000-0000-0000-000000000303:qf:0',
  'the mixed replacement commits one exact authoritative snapshot'
);

select is(
  (
    select pp.version
    from public.predicted_progression pp
    where pp.entry_id = '40000000-0000-0000-0000-000000000201'
      and pp.team_id = '40000000-0000-0000-0000-000000000301'
  ),
  1,
  'an updated progression row increments its server version'
);

select is(
  (
    select pp.version
    from public.predicted_progression pp
    where pp.entry_id = '40000000-0000-0000-0000-000000000201'
      and pp.team_id = '40000000-0000-0000-0000-000000000303'
  ),
  0,
  'a newly inserted progression row keeps version zero'
);

select lives_ok(
  $sql$
    select *
    from public.replace_predicted_progression(
      '40000000-0000-0000-0000-000000000201',
      '{
        "40000000-0000-0000-0000-000000000301":"sf",
        "40000000-0000-0000-0000-000000000303":"qf"
      }'::jsonb,
      '{
        "40000000-0000-0000-0000-000000000301":1,
        "40000000-0000-0000-0000-000000000303":0
      }'::jsonb
    )
  $sql$,
  'replacing an identical snapshot is a valid no-op'
);

select is(
  (
    select string_agg(pp.team_id::text || ':' || pp.version::text, ',' order by pp.team_id)
    from public.predicted_progression pp
    where pp.entry_id = '40000000-0000-0000-0000-000000000201'
  ),
  '40000000-0000-0000-0000-000000000301:1,40000000-0000-0000-0000-000000000303:0',
  'a no-op replacement does not increment row versions'
);

select is(
  pg_temp.capture_sqlstate($sql$
    select *
    from public.replace_predicted_progression(
      '40000000-0000-0000-0000-000000000201',
      '{
        "40000000-0000-0000-0000-000000000301":"final",
        "40000000-0000-0000-0000-000000000303":"qf"
      }'::jsonb,
      '{
        "40000000-0000-0000-0000-000000000301":0,
        "40000000-0000-0000-0000-000000000303":0
      }'::jsonb
    )
  $sql$),
  'PT409',
  'a stale row version rejects the complete replacement before mutation'
);

select is(
  (
    select string_agg(
      pp.team_id::text || ':' || pp.stage || ':' || pp.version::text,
      ',' order by pp.team_id
    )
    from public.predicted_progression pp
    where pp.entry_id = '40000000-0000-0000-0000-000000000201'
  ),
  '40000000-0000-0000-0000-000000000301:sf:1,40000000-0000-0000-0000-000000000303:qf:0',
  'a stale-version rejection leaves the entire prior snapshot unchanged'
);

select is(
  pg_temp.capture_sqlstate($sql$
    select *
    from public.replace_predicted_progression(
      '40000000-0000-0000-0000-000000000201',
      '{
        "40000000-0000-0000-0000-000000000301":"sf",
        "40000000-0000-0000-0000-000000000303":"qf"
      }'::jsonb,
      '{"40000000-0000-0000-0000-000000000301":1}'::jsonb
    )
  $sql$),
  'PT409',
  'omitting a persisted row from the expected snapshot is also a conflict'
);

select is(
  pg_temp.capture_sqlstate($sql$
    select *
    from public.replace_predicted_progression(
      '40000000-0000-0000-0000-000000000201',
      '{
        "40000000-0000-0000-0000-000000000301":"sf",
        "40000000-0000-0000-0000-000000000303":"qf"
      }'::jsonb,
      '{
        "40000000-0000-0000-0000-000000000301":"one",
        "40000000-0000-0000-0000-000000000303":0
      }'::jsonb
    )
  $sql$),
  '23514',
  'malformed expected versions are rejected explicitly'
);

select is(
  pg_temp.capture_sqlstate($sql$
    select *
    from public.replace_predicted_progression(
      '40000000-0000-0000-0000-000000000201',
      '{
        "40000000-0000-0000-0000-000000000301":"final",
        "40000000-0000-0000-0000-000000000302":"final",
        "40000000-0000-0000-0000-000000000303":"final"
      }'::jsonb,
      '{
        "40000000-0000-0000-0000-000000000301":1,
        "40000000-0000-0000-0000-000000000303":0
      }'::jsonb
    )
  $sql$),
  '23514',
  'an impossible partial stage shape is rejected before replacement'
);

select is(
  (
    select string_agg(
      pp.team_id::text || ':' || pp.stage || ':' || pp.version::text,
      ',' order by pp.team_id
    )
    from public.predicted_progression pp
    where pp.entry_id = '40000000-0000-0000-0000-000000000201'
  ),
  '40000000-0000-0000-0000-000000000301:sf:1,40000000-0000-0000-0000-000000000303:qf:0',
  'the impossible-shape rejection rolls the complete replacement back'
);

select is(
  pg_temp.capture_sqlstate($sql$
    select *
    from public.replace_predicted_progression(
      '40000000-0000-0000-0000-000000000201',
      '{
        "40000000-0000-0000-0000-000000000301":"sf",
        "40000000-0000-0000-0000-000000000304":"qf"
      }'::jsonb,
      '{
        "40000000-0000-0000-0000-000000000301":1,
        "40000000-0000-0000-0000-000000000303":0
      }'::jsonb
    )
  $sql$),
  '23514',
  'a team from another tournament is rejected'
);

select is(
  (
    select string_agg(
      pp.team_id::text || ':' || pp.stage || ':' || pp.version::text,
      ',' order by pp.team_id
    )
    from public.predicted_progression pp
    where pp.entry_id = '40000000-0000-0000-0000-000000000201'
  ),
  '40000000-0000-0000-0000-000000000301:sf:1,40000000-0000-0000-0000-000000000303:qf:0',
  'the cross-tournament rejection leaves the prior snapshot unchanged'
);

select set_config('request.jwt.claim.sub', '40000000-0000-0000-0000-000000000002', true);

select is(
  pg_temp.capture_sqlstate($sql$
    select *
    from public.replace_predicted_progression(
      '40000000-0000-0000-0000-000000000201',
      '{
        "40000000-0000-0000-0000-000000000301":"sf",
        "40000000-0000-0000-0000-000000000303":"qf"
      }'::jsonb,
      '{
        "40000000-0000-0000-0000-000000000301":1,
        "40000000-0000-0000-0000-000000000303":0
      }'::jsonb
    )
  $sql$),
  '42501',
  'another authenticated user cannot replace the owner bracket'
);

reset role;
update public.tournaments
  set lock_at = now() - interval '1 minute'
  where id = '40000000-0000-0000-0000-000000000101';

set local role authenticated;
select set_config('request.jwt.claim.sub', '40000000-0000-0000-0000-000000000001', true);
select set_config('request.jwt.claim.role', 'authenticated', true);

select is(
  pg_temp.capture_sqlstate($sql$
    select *
    from public.replace_predicted_progression(
      '40000000-0000-0000-0000-000000000201',
      '{
        "40000000-0000-0000-0000-000000000301":"final",
        "40000000-0000-0000-0000-000000000303":"qf"
      }'::jsonb,
      '{
        "40000000-0000-0000-0000-000000000301":1,
        "40000000-0000-0000-0000-000000000303":0
      }'::jsonb
    )
  $sql$),
  '23514',
  'the atomic bracket replacement is rejected after tournament lock'
);

select is(
  (
    select string_agg(
      pp.team_id::text || ':' || pp.stage || ':' || pp.version::text,
      ',' order by pp.team_id
    )
    from public.predicted_progression pp
    where pp.entry_id = '40000000-0000-0000-0000-000000000201'
  ),
  '40000000-0000-0000-0000-000000000301:sf:1,40000000-0000-0000-0000-000000000303:qf:0',
  'the post-lock rejection leaves the complete bracket snapshot unchanged'
);

select * from finish();
rollback;
