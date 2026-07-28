begin;

select plan(38);

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

select public.set_operating_limits(250, 20);

select set_config(
  'test.private_league_tournament',
  (select id::text from public.tournaments order by created_at, id limit 1),
  true
);

update public.tournaments tournament
set lock_at = now() + interval '1 day'
where tournament.id = current_setting('test.private_league_tournament')::uuid;

insert into auth.users (
  id, email, aud, role, raw_app_meta_data, raw_user_meta_data, created_at, updated_at
)
select
  md5('private-league-user-' || fixture.number)::uuid,
  format('private-league-%s@example.test', lpad(fixture.number::text, 3, '0')),
  'authenticated',
  'authenticated',
  '{}'::jsonb,
  '{}'::jsonb,
  now(),
  now()
from generate_series(1, 120) as fixture(number);

insert into auth.users (
  id, email, aud, role, raw_app_meta_data, raw_user_meta_data, created_at, updated_at
) values (
  md5('private-league-outsider')::uuid,
  'private-league-outsider@example.test',
  'authenticated',
  'authenticated',
  '{}'::jsonb,
  '{}'::jsonb,
  now(),
  now()
);

update public.profiles profile
set display_name = case
  when fixture.number = 1 then 'League Owner'
  when fixture.number in (2, 3) then 'Duplicate Player'
  else format('League Player %s', lpad(fixture.number::text, 3, '0'))
end,
welcomed_at = now()
from generate_series(1, 120) as fixture(number)
where profile.id = md5('private-league-user-' || fixture.number)::uuid;

update public.profiles profile
set display_name = 'League Outsider', welcomed_at = now()
where profile.id = md5('private-league-outsider')::uuid;

insert into public.leagues (
  id, tournament_id, owner_id, name, invite_code, created_at
) values (
  md5('private-league-fixture')::uuid,
  current_setting('test.private_league_tournament')::uuid,
  md5('private-league-user-1')::uuid,
  'Private League Pagination Fixture',
  'PRIV45',
  now()
);

insert into public.league_members (league_id, user_id, role, joined_at)
select
  md5('private-league-fixture')::uuid,
  md5('private-league-user-' || fixture.number)::uuid,
  case when fixture.number = 1 then 'owner' else 'member' end,
  now() + make_interval(secs => fixture.number)
from generate_series(1, 120) as fixture(number);

insert into public.entries (id, user_id, tournament_id, submitted_at)
select
  md5('private-league-entry-' || fixture.number)::uuid,
  md5('private-league-user-' || fixture.number)::uuid,
  current_setting('test.private_league_tournament')::uuid,
  now()
from generate_series(1, 120) as fixture(number);

insert into public.score_events (entry_id, category, points, explanation)
select
  md5('private-league-entry-' || fixture.number)::uuid,
  'group_matches',
  case
    when fixture.number = 1 then 1000
    when fixture.number in (2, 3) then 900
    else 900 - fixture.number
  end,
  'Private league pagination fixture'
from generate_series(1, 120) as fixture(number);

create temporary table private_league_pages (
  page_number integer primary key,
  payload jsonb not null
) on commit drop;

select set_config(
  'request.jwt.claim.sub',
  md5('private-league-user-120')::uuid::text,
  true
);

insert into private_league_pages (page_number, payload)
values (
  1,
  public.get_league_members(md5('private-league-fixture')::uuid, 50, null)
);

select is(
  jsonb_array_length((select payload -> 'rows' from private_league_pages where page_number = 1)),
  50,
  'the first private-league page returns 50 members'
);
select is(
  ((select payload from private_league_pages where page_number = 1) ->> 'totalCount')::integer,
  120,
  'the private-league page returns the full member count'
);
select is(
  ((select payload from private_league_pages where page_number = 1) ->> 'pageSize')::integer,
  50,
  'the default private-league page size is 50'
);
select is(
  ((select payload from private_league_pages where page_number = 1) ->> 'hasMore')::boolean,
  true,
  'the first private-league page reports more members'
);
select ok(
  length((select payload ->> 'nextCursor' from private_league_pages where page_number = 1)) > 0,
  'the first private-league page returns an opaque cursor'
);
select is(
  ((select payload from private_league_pages where page_number = 1) -> 'you' ->> 'position')::integer,
  120,
  'caller context is returned independently when the caller is outside page one'
);
select is(
  (
    select count(*)
    from jsonb_array_elements(
      (select payload -> 'rows' from private_league_pages where page_number = 1)
    ) row
    where (row ->> 'isYou')::boolean
  ),
  0::bigint,
  'the outside-page caller is not duplicated into the first page rows'
);
select is(
  (
    select (row ->> 'totalPoints')::integer
    from jsonb_array_elements(
      (select payload -> 'rows' from private_league_pages where page_number = 1)
    ) with ordinality page_row(row, ordinal)
    where ordinal = 1
  ),
  1000,
  'the highest-scoring league member remains first'
);
select is(
  (
    select count(*)
    from jsonb_array_elements(
      (select payload -> 'rows' from private_league_pages where page_number = 1)
    ) row
    where row ->> 'displayName' = 'Duplicate Player'
      and (row ->> 'rank')::integer = 2
      and (row ->> 'tied')::boolean
  ),
  2::bigint,
  'duplicate names with equal points share standard-competition rank two'
);
select is(
  (
    select array_agg((row ->> 'position')::integer order by (row ->> 'position')::integer)
    from jsonb_array_elements(
      (select payload -> 'rows' from private_league_pages where page_number = 1)
    ) row
    where row ->> 'displayName' = 'Duplicate Player'
  ),
  array[2, 3],
  'duplicate names retain distinct deterministic absolute positions'
);

insert into private_league_pages (page_number, payload)
select
  2,
  public.get_league_members(
    md5('private-league-fixture')::uuid,
    50,
    (select payload ->> 'nextCursor' from private_league_pages where page_number = 1)
  );

select is(
  jsonb_array_length((select payload -> 'rows' from private_league_pages where page_number = 2)),
  50,
  'the second private-league page returns the next 50 members'
);
select is(
  ((select payload from private_league_pages where page_number = 2) ->> 'hasMore')::boolean,
  true,
  'the second private-league page reports the final page'
);

insert into private_league_pages (page_number, payload)
select
  3,
  public.get_league_members(
    md5('private-league-fixture')::uuid,
    50,
    (select payload ->> 'nextCursor' from private_league_pages where page_number = 2)
  );

select is(
  jsonb_array_length((select payload -> 'rows' from private_league_pages where page_number = 3)),
  20,
  'the final private-league page returns the remaining 20 members'
);
select is(
  ((select payload from private_league_pages where page_number = 3) ->> 'hasMore')::boolean,
  false,
  'the final private-league page closes traversal'
);

create temporary table traversed_private_members on commit drop as
select
  (row ->> 'position')::integer as position,
  row ->> 'userId' as user_id
from private_league_pages page
cross join lateral jsonb_array_elements(page.payload -> 'rows') row;

select is(
  (select count(*) from traversed_private_members),
  120::bigint,
  'three private-league pages traverse all members'
);
select is(
  (select count(distinct position) from traversed_private_members),
  120::bigint,
  'private-league traversal contains no duplicate positions'
);
select is(
  (select count(distinct user_id) from traversed_private_members),
  120::bigint,
  'private-league traversal contains no duplicate members'
);
select is(
  (select max(position) from traversed_private_members),
  120,
  'private-league absolute positions reach the final member'
);

select is(
  (public.get_league_members(md5('private-league-fixture')::uuid, 500, null) ->> 'pageSize')::integer,
  100,
  'private-league page requests are clamped to 100'
);
select is(
  jsonb_array_length(
    public.get_league_members(md5('private-league-fixture')::uuid, 500, null) -> 'rows'
  ),
  100,
  'the clamped private-league response contains at most 100 rows'
);
select is(
  pg_temp.capture_sqlstate(
    format(
      'select public.get_league_members(%L::uuid, 0, null)',
      md5('private-league-fixture')::uuid
    )
  ),
  '22023',
  'private-league pagination rejects a page size below one'
);
select is(
  pg_temp.capture_sqlstate(
    format(
      'select public.get_league_members(%L::uuid, 50, %L)',
      md5('private-league-fixture')::uuid,
      'not-a-cursor'
    )
  ),
  '22023',
  'private-league pagination rejects a malformed cursor'
);

select set_config(
  'request.jwt.claim.sub',
  md5('private-league-outsider')::uuid::text,
  true
);
set local role authenticated;
select is(
  pg_temp.capture_sqlstate(
    format(
      'select public.get_league_members(%L::uuid, 50, null)',
      md5('private-league-fixture')::uuid
    )
  ),
  '42501',
  'a non-member cannot read paginated private-league standings'
);
reset role;

select set_config(
  'request.jwt.claim.sub',
  md5('private-league-user-1')::uuid::text,
  true
);

select is(
  (
    select count(*)
    from public.search_league_transfer_candidates(
      md5('private-league-fixture')::uuid,
      null,
      20
    )
  ),
  20::bigint,
  'owner candidate search returns its default 20 rows'
);
select is(
  (
    select count(*)
    from public.search_league_transfer_candidates(
      md5('private-league-fixture')::uuid,
      null,
      20
    ) candidate
    where candidate.user_id = md5('private-league-user-1')::uuid
  ),
  0::bigint,
  'owner candidate search excludes the current owner'
);
select is(
  (
    select count(*)
    from public.search_league_transfer_candidates(
      md5('private-league-fixture')::uuid,
      'player 010',
      20
    ) candidate
    where candidate.user_id = md5('private-league-user-10')::uuid
      and candidate.display_name = 'League Player 010'
  ),
  1::bigint,
  'owner candidate search performs case-insensitive literal name matching'
);
select is(
  (
    select count(*)
    from public.search_league_transfer_candidates(
      md5('private-league-fixture')::uuid,
      '%',
      20
    )
  ),
  0::bigint,
  'candidate search treats SQL wildcard characters literally'
);
select is(
  (
    select count(*)
    from public.search_league_transfer_candidates(
      md5('private-league-fixture')::uuid,
      null,
      500
    )
  ),
  50::bigint,
  'candidate search requests are clamped to 50 rows'
);

select set_config(
  'request.jwt.claim.sub',
  md5('private-league-user-20')::uuid::text,
  true
);
set local role authenticated;
select is(
  pg_temp.capture_sqlstate(
    format(
      'select * from public.search_league_transfer_candidates(%L::uuid, null, 20)',
      md5('private-league-fixture')::uuid
    )
  ),
  '42501',
  'an ordinary member cannot search ownership-transfer candidates'
);
reset role;

select set_config(
  'request.jwt.claim.sub',
  md5('private-league-user-1')::uuid::text,
  true
);
select is(
  pg_temp.capture_sqlstate(
    format(
      'select public.transfer_ownership(%L::uuid, %L::uuid)',
      md5('private-league-fixture')::uuid,
      md5('private-league-outsider')::uuid
    )
  ),
  '23514',
  'ownership transfer still rejects a non-member'
);
select lives_ok(
  format(
    'select public.transfer_ownership(%L::uuid, %L::uuid)',
    md5('private-league-fixture')::uuid,
    md5('private-league-user-10')::uuid
  ),
  'ownership transfer succeeds for a selected league member'
);
select is(
  (
    select owner_id
    from public.leagues
    where id = md5('private-league-fixture')::uuid
  ),
  md5('private-league-user-10')::uuid,
  'the selected candidate becomes the authoritative league owner'
);
select is(
  pg_temp.capture_sqlstate(
    format(
      'select * from public.search_league_transfer_candidates(%L::uuid, null, 20)',
      md5('private-league-fixture')::uuid
    )
  ),
  '42501',
  'the previous owner loses candidate-search authority immediately'
);

select set_config(
  'request.jwt.claim.sub',
  md5('private-league-user-10')::uuid::text,
  true
);
select lives_ok(
  format(
    'select * from public.search_league_transfer_candidates(%L::uuid, null, 20)',
    md5('private-league-fixture')::uuid
  ),
  'the new owner gains candidate-search authority immediately'
);

select is(
  (
    select count(*)
    from pg_proc function_row
    join pg_namespace namespace on namespace.oid = function_row.pronamespace
    where namespace.nspname = 'public'
      and function_row.proname in (
        'get_league',
        'get_league_members',
        'search_league_transfer_candidates',
        'transfer_ownership'
      )
      and function_row.proconfig::text = '{"search_path=\"\""}'
  ),
  4::bigint,
  'all touched private-league security-definer functions use an empty search path'
);
select ok(
  has_function_privilege(
    'authenticated',
    'public.get_league_members(uuid,integer,text)',
    'execute'
  )
  and has_function_privilege(
    'service_role',
    'public.get_league_members(uuid,integer,text)',
    'execute'
  )
  and has_function_privilege(
    'authenticated',
    'public.search_league_transfer_candidates(uuid,text,integer)',
    'execute'
  ),
  'authenticated and service roles retain the protected private-league RPCs'
);
select ok(
  not has_function_privilege(
    'anon',
    'public.get_league_members(uuid,integer,text)',
    'execute'
  )
  and not has_function_privilege(
    'anon',
    'public.search_league_transfer_candidates(uuid,text,integer)',
    'execute'
  ),
  'anonymous callers gain no private-league access'
);
select ok(
  to_regprocedure('public.get_league_members(uuid)') is null,
  'the capped whole-member RPC signature is removed'
);

select * from finish();
rollback;
