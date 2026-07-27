begin;

select plan(24);

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

-- The canonical database seed has no users. Create two normal baseline users
-- through the real cap/profile triggers so league create/join behaviour can be
-- tested without relying on ordering from another rollback-scoped test.
insert into auth.users (
  id, email, aud, role, raw_app_meta_data, raw_user_meta_data, created_at, updated_at
) values
  (
    '43000000-0000-0000-0000-000000000101',
    'operating-cap-owner@example.test',
    'authenticated',
    'authenticated',
    '{}'::jsonb,
    '{"display_name":"Operating Cap Owner"}'::jsonb,
    now(),
    now()
  ),
  (
    '43000000-0000-0000-0000-000000000102',
    'operating-cap-member@example.test',
    'authenticated',
    'authenticated',
    '{}'::jsonb,
    '{"display_name":"Operating Cap Member"}'::jsonb,
    now(),
    now()
  );

select set_config(
  'test.cap_initial_users',
  (select count(*)::integer::text from auth.users),
  true
);
select set_config(
  'test.cap_initial_leagues',
  (select count(*)::integer::text from public.leagues),
  true
);
select set_config(
  'test.cap_tournament_id',
  (select id::text from public.tournaments order by created_at, id limit 1),
  true
);
select set_config(
  'test.cap_owner_id',
  '43000000-0000-0000-0000-000000000101',
  true
);
select set_config(
  'test.cap_member_id',
  '43000000-0000-0000-0000-000000000102',
  true
);

select is(
  (select public_user_limit from predictor_internal.operating_limits where singleton),
  50,
  'the fail-closed pre-SMTP public user limit starts at 50'
);
select is(
  (select total_league_limit from predictor_internal.operating_limits where singleton),
  20,
  'the total site league limit starts at 20'
);

set local role anon;
select lives_ok(
  $$select * from public.get_public_capacity()$$,
  'anonymous users can read aggregate-only public capacity'
);
reset role;

select ok(
  not has_table_privilege('anon', 'predictor_internal.operating_limits', 'select')
  and not has_table_privilege('authenticated', 'predictor_internal.operating_limits', 'select')
  and not has_table_privilege('service_role', 'predictor_internal.operating_limits', 'select'),
  'browser and service roles cannot read the private operating-limits table'
);

select ok(
  has_function_privilege(
    'service_role',
    'public.set_operating_limits(integer,integer)',
    'execute'
  )
  and not has_function_privilege(
    'authenticated',
    'public.set_operating_limits(integer,integer)',
    'execute'
  )
  and not has_function_privilege(
    'anon',
    'public.set_operating_limits(integer,integer)',
    'execute'
  ),
  'only service role can adjust operating limits'
);

select is(
  (
    select count(*)
    from pg_proc function_row
    join pg_namespace namespace on namespace.oid = function_row.pronamespace
    where namespace.nspname = 'predictor_internal'
      and function_row.proname in (
        'enforce_public_user_limit',
        'enforce_total_league_limit'
      )
      and function_row.proconfig::text = '{"search_path=\"\""}'
  ),
  2::bigint,
  'both cap triggers use an immutable empty search path'
);

select is(
  (
    select count(*)
    from pg_proc function_row
    join pg_namespace namespace on namespace.oid = function_row.pronamespace
    where namespace.nspname = 'predictor_internal'
      and function_row.proname in (
        'enforce_public_user_limit',
        'enforce_total_league_limit'
      )
      and pg_get_functiondef(function_row.oid) like '%pg_advisory_xact_lock%'
  ),
  2::bigint,
  'both site-wide counters are transaction-serialized before counting'
);

select lives_ok(
  format(
    'select public.set_operating_limits(%s, %s)',
    current_setting('test.cap_initial_users')::integer + 1,
    current_setting('test.cap_initial_leagues')::integer + 1
  ),
  'service operation can set each limit to one remaining slot'
);

select lives_ok(
  $sql$
    insert into auth.users (
      id, email, aud, role, raw_app_meta_data, raw_user_meta_data, created_at, updated_at
    ) values (
      '43000000-0000-0000-0000-000000000001',
      'operating-cap-final-user@example.test',
      'authenticated',
      'authenticated',
      '{}'::jsonb,
      '{"display_name":"Operating Cap Final User"}'::jsonb,
      now(),
      now()
    )
  $sql$,
  'the final configured public user slot succeeds'
);

select is(
  (select signup_available from public.get_public_capacity()),
  false,
  'public capacity closes immediately when the final user slot is taken'
);

select is(
  pg_temp.capture_sqlstate(
    $sql$
      insert into auth.users (
        id, email, aud, role, raw_app_meta_data, raw_user_meta_data, created_at, updated_at
      ) values (
        '43000000-0000-0000-0000-000000000002',
        'operating-cap-rejected-user@example.test',
        'authenticated',
        'authenticated',
        '{}'::jsonb,
        '{"display_name":"Rejected Cap User"}'::jsonb,
        now(),
        now()
      )
    $sql$
  ),
  'PT429',
  'the next signup cannot exceed the configured user limit'
);

select is(
  (
    select count(*)
    from auth.users
    where id = '43000000-0000-0000-0000-000000000002'
  ),
  0::bigint,
  'a rejected signup leaves no auth user behind'
);

select is(
  pg_temp.capture_sqlstate(
    format(
      'select public.set_operating_limits(%s, %s)',
      current_setting('test.cap_initial_users')::integer,
      current_setting('test.cap_initial_leagues')::integer + 1
    )
  ),
  '23514',
  'operations cannot lower the public user limit below current usage'
);

delete from auth.users
where id = '43000000-0000-0000-0000-000000000001';

select is(
  (select signup_available from public.get_public_capacity()),
  true,
  'deleting a user reopens one public signup slot'
);

select set_config(
  'request.jwt.claim.sub',
  current_setting('test.cap_owner_id'),
  true
);
set local role authenticated;
select lives_ok(
  format(
    'select * from public.create_league(%L::uuid, %L)',
    current_setting('test.cap_tournament_id'),
    'Operating Cap Final League'
  ),
  'the final configured total league slot succeeds'
);
reset role;

select set_config(
  'test.cap_league_id',
  (
    select id::text
    from public.leagues
    where name = 'Operating Cap Final League'
    order by created_at desc
    limit 1
  ),
  true
);
select set_config(
  'test.cap_invite_code',
  (
    select invite_code
    from public.leagues
    where id = current_setting('test.cap_league_id')::uuid
  ),
  true
);

select is(
  (select league_creation_available from public.get_public_capacity()),
  false,
  'public capacity closes immediately when the final league slot is taken'
);

select set_config(
  'request.jwt.claim.sub',
  current_setting('test.cap_owner_id'),
  true
);
set local role authenticated;
select is(
  pg_temp.capture_sqlstate(
    format(
      'select * from public.create_league(%L::uuid, %L)',
      current_setting('test.cap_tournament_id'),
      'Rejected Excess League'
    )
  ),
  'PT429',
  'the next league creation cannot exceed the configured total limit'
);
reset role;

select is(
  pg_temp.capture_sqlstate(
    format(
      'select public.set_operating_limits(%s, %s)',
      current_setting('test.cap_initial_users')::integer + 1,
      current_setting('test.cap_initial_leagues')::integer
    )
  ),
  '23514',
  'operations cannot lower the total league limit below current usage'
);

select set_config(
  'request.jwt.claim.sub',
  current_setting('test.cap_member_id'),
  true
);
set local role authenticated;
select lives_ok(
  format(
    'select * from public.join_league(%L)',
    current_setting('test.cap_invite_code')
  ),
  'joining an existing league remains available when league creation is full'
);
reset role;

select is(
  (
    select count(*)
    from public.league_members
    where league_id = current_setting('test.cap_league_id')::uuid
      and user_id = current_setting('test.cap_member_id')::uuid
  ),
  1::bigint,
  'the existing league receives the joined member at the global league cap'
);

delete from public.leagues
where id = current_setting('test.cap_league_id')::uuid;

select is(
  (select league_creation_available from public.get_public_capacity()),
  true,
  'deleting a league reopens one total league slot'
);

set local role authenticated;
select is(
  pg_temp.capture_sqlstate(
    $$select public.set_operating_limits(50, 20)$$
  ),
  '42501',
  'authenticated users cannot adjust private operating limits'
);
reset role;

select is(
  (select public_users_used from public.get_public_capacity()),
  current_setting('test.cap_initial_users')::integer,
  'the user lifecycle returns aggregate usage to its initial count'
);

select is(
  (select leagues_used from public.get_public_capacity()),
  current_setting('test.cap_initial_leagues')::integer,
  'the league lifecycle returns aggregate usage to its initial count'
);

select * from finish();
rollback;
