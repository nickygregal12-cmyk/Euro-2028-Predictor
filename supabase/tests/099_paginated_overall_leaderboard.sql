begin;

select plan(36);

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

insert into public.tournaments (
  id, name, year, starts_on, ends_on, lock_at
) values
  (
    '25000000-0000-0000-0000-000000000001',
    'Paginated Leaderboard Scale Test',
    2098,
    '2098-06-01',
    '2098-07-01',
    '2098-06-01T12:00:00Z'
  ),
  (
    '25000000-0000-0000-0000-000000000002',
    'Paginated Leaderboard Pre-results Test',
    2099,
    '2099-06-01',
    '2099-07-01',
    '2099-06-01T12:00:00Z'
  );

insert into auth.users (
  id, email, aud, role, raw_app_meta_data, raw_user_meta_data,
  created_at, updated_at
)
select
  ('25000000-0000-0000-0001-' || lpad(series.i::text, 12, '0'))::uuid,
  format('paginated-leaderboard-%s@example.test', lpad(series.i::text, 3, '0')),
  'authenticated',
  'authenticated',
  '{}'::jsonb,
  jsonb_build_object(
    'display_name',
    case
      when series.i in (1, 2) then 'Alex'
      else format('Player %s', lpad(series.i::text, 3, '0'))
    end
  ),
  now(),
  now()
from generate_series(1, 120) as series(i);

insert into public.profiles (id, display_name, welcomed_at)
select
  ('25000000-0000-0000-0001-' || lpad(series.i::text, 12, '0'))::uuid,
  case
    when series.i in (1, 2) then 'Alex'
    else format('Player %s', lpad(series.i::text, 3, '0'))
  end,
  now()
from generate_series(1, 120) as series(i)
on conflict (id) do update
set display_name = excluded.display_name,
    welcomed_at = excluded.welcomed_at;

insert into public.entries (id, user_id, tournament_id, submitted_at)
select
  ('25000000-0000-0000-0002-' || lpad(series.i::text, 12, '0'))::uuid,
  ('25000000-0000-0000-0001-' || lpad(series.i::text, 12, '0'))::uuid,
  '25000000-0000-0000-0000-000000000001',
  now()
from generate_series(1, 120) as series(i);

insert into public.score_events (entry_id, category, points, explanation)
select
  ('25000000-0000-0000-0002-' || lpad(series.i::text, 12, '0'))::uuid,
  'group_matches',
  100 - ((series.i - 1) / 2),
  'Paginated leaderboard scale fixture'
from generate_series(1, 120) as series(i);

insert into public.entries (id, user_id, tournament_id, submitted_at)
select
  ('25000000-0000-0000-0003-' || lpad(series.i::text, 12, '0'))::uuid,
  ('25000000-0000-0000-0001-' || lpad(series.i::text, 12, '0'))::uuid,
  '25000000-0000-0000-0000-000000000002',
  now()
from generate_series(1, 3) as series(i);

select set_config(
  'request.jwt.claim.sub',
  '25000000-0000-0000-0001-000000000120',
  true
);

create temporary table leaderboard_pages (
  name text primary key,
  payload jsonb not null
) on commit drop;

insert into leaderboard_pages values (
  'page1',
  public.get_leaderboard(
    '25000000-0000-0000-0000-000000000001', 50, null
  )
);

insert into leaderboard_pages
select
  'page2',
  public.get_leaderboard(
    '25000000-0000-0000-0000-000000000001',
    50,
    page.payload ->> 'nextCursor'
  )
from leaderboard_pages page where page.name = 'page1';

insert into leaderboard_pages
select
  'page3',
  public.get_leaderboard(
    '25000000-0000-0000-0000-000000000001',
    50,
    page.payload ->> 'nextCursor'
  )
from leaderboard_pages page where page.name = 'page2';

insert into leaderboard_pages values
  (
    'single1',
    public.get_leaderboard(
      '25000000-0000-0000-0000-000000000001', 1, null
    )
  ),
  (
    'clamped',
    public.get_leaderboard(
      '25000000-0000-0000-0000-000000000001', 1000, null
    )
  ),
  (
    'pre_results',
    public.get_leaderboard(
      '25000000-0000-0000-0000-000000000002', 50, null
    )
  );

insert into leaderboard_pages
select
  'single2',
  public.get_leaderboard(
    '25000000-0000-0000-0000-000000000001',
    1,
    page.payload ->> 'nextCursor'
  )
from leaderboard_pages page where page.name = 'single1';

insert into leaderboard_pages
select
  'single3',
  public.get_leaderboard(
    '25000000-0000-0000-0000-000000000001',
    1,
    page.payload ->> 'nextCursor'
  )
from leaderboard_pages page where page.name = 'single2';

select ok(
  to_regprocedure('public.get_leaderboard(uuid)') is null,
  'the contract-42 capped-only leaderboard signature is removed'
);
select ok(
  to_regprocedure('public.get_leaderboard(uuid,integer,text)') is not null,
  'the paginated leaderboard signature is installed'
);
select ok(
  exists (
    select 1 from pg_indexes
    where schemaname = 'public'
      and indexname = 'entries_submitted_tournament_idx'
  ),
  'submitted entries have a tournament-scoped partial index'
);
select is(
  (select (payload ->> 'totalCount')::integer from leaderboard_pages where name = 'page1'),
  120,
  'page one reports the full submitted-entry count'
);
select is(
  (select jsonb_array_length(payload -> 'rows') from leaderboard_pages where name = 'page1'),
  50,
  'page one returns 50 rows'
);
select is(
  (select (payload ->> 'hasMore')::boolean from leaderboard_pages where name = 'page1'),
  true,
  'page one reports more rows'
);
select is(
  (select payload #>> '{rows,0,displayName}' from leaderboard_pages where name = 'page1'),
  'Alex',
  'the first duplicate name is retained'
);
select is(
  (select payload #>> '{rows,1,displayName}' from leaderboard_pages where name = 'page1'),
  'Alex',
  'the second duplicate name is retained'
);
select is(
  (select (payload #>> '{rows,0,rank}')::integer from leaderboard_pages where name = 'page1'),
  1,
  'the first tied row has rank 1'
);
select is(
  (select (payload #>> '{rows,1,rank}')::integer from leaderboard_pages where name = 'page1'),
  1,
  'the second tied row shares rank 1'
);
select is(
  (select (payload #>> '{rows,2,rank}')::integer from leaderboard_pages where name = 'page1'),
  3,
  'the next total receives standard-competition rank 3'
);
select is(
  (select (payload #>> '{rows,0,tied}')::boolean from leaderboard_pages where name = 'page1'),
  true,
  'equal totals are marked tied after results begin'
);
select ok(
  not (
    select (payload #> '{rows,0}') ? 'userId'
    from leaderboard_pages where name = 'page1'
  ),
  'row data exposes no user identifier'
);
select is(
  (select (payload #>> '{you,position}')::integer from leaderboard_pages where name = 'page1'),
  120,
  'current-user context is returned outside page one'
);
select is(
  (select (payload #>> '{you,rank}')::integer from leaderboard_pages where name = 'page1'),
  119,
  'current-user context has the correct shared rank'
);
select is(
  (select (payload #>> '{you,tied}')::boolean from leaderboard_pages where name = 'page1'),
  true,
  'current-user context preserves tie state'
);
select is(
  (
    select count(*)
    from leaderboard_pages page,
         jsonb_array_elements(page.payload -> 'rows') row
    where page.name = 'page1'
      and (row ->> 'isYou')::boolean
  ),
  0::bigint,
  'current-user context does not require loading their row'
);
select is(
  (select jsonb_array_length(payload -> 'rows') from leaderboard_pages where name = 'page2'),
  50,
  'page two returns the next 50 rows'
);
select is(
  (select (payload #>> '{rows,0,position}')::integer from leaderboard_pages where name = 'page2'),
  51,
  'page two begins at absolute position 51'
);
select is(
  (
    select count(*)
    from (
      select (row ->> 'position')::integer
      from leaderboard_pages page,
           jsonb_array_elements(page.payload -> 'rows') row
      where page.name = 'page1'
      intersect
      select (row ->> 'position')::integer
      from leaderboard_pages page,
           jsonb_array_elements(page.payload -> 'rows') row
      where page.name = 'page2'
    ) overlap
  ),
  0::bigint,
  'adjacent pages have no overlap'
);
select is(
  (select jsonb_array_length(payload -> 'rows') from leaderboard_pages where name = 'page3'),
  20,
  'page three returns the final 20 rows'
);
select is(
  (select (payload ->> 'hasMore')::boolean from leaderboard_pages where name = 'page3'),
  false,
  'page three reports no more rows'
);
select is(
  (
    select count(distinct (row ->> 'position')::integer)
    from leaderboard_pages page,
         jsonb_array_elements(page.payload -> 'rows') row
    where page.name in ('page1', 'page2', 'page3')
  ),
  120::bigint,
  'three-page traversal returns every position exactly once'
);
select is(
  (select jsonb_array_length(payload -> 'rows') from leaderboard_pages where name = 'clamped'),
  100,
  'oversized requests are clamped to 100 rows'
);
select is(
  (select (payload ->> 'pageSize')::integer from leaderboard_pages where name = 'clamped'),
  100,
  'the response reports the clamped page size'
);
select is(
  pg_temp.capture_sqlstate(
    $$select public.get_leaderboard('25000000-0000-0000-0000-000000000001', 0, null)$$
  ),
  '22023',
  'page sizes below one are rejected'
);
select is(
  pg_temp.capture_sqlstate(
    $$select public.get_leaderboard('25000000-0000-0000-0000-000000000001', 50, 'not-a-cursor')$$
  ),
  '22023',
  'malformed cursors are rejected'
);
select is(
  (select payload #>> '{rows,0,displayName}' from leaderboard_pages where name = 'single1'),
  'Alex',
  'single-row traversal starts with the first duplicate name'
);
select is(
  (select payload #>> '{rows,0,displayName}' from leaderboard_pages where name = 'single2'),
  'Alex',
  'the cursor advances to the second duplicate name'
);
select isnt(
  (select payload ->> 'nextCursor' from leaderboard_pages where name = 'single1'),
  (select payload ->> 'nextCursor' from leaderboard_pages where name = 'single2'),
  'duplicate names receive distinct cursors'
);
select is(
  (select (payload #>> '{rows,0,position}')::integer from leaderboard_pages where name = 'single3'),
  3,
  'cursor traversal advances beyond both duplicate names'
);
select is(
  (select payload #>> '{rows,0,rank}' from leaderboard_pages where name = 'pre_results'),
  null::text,
  'pre-results standings expose no rank'
);
select is(
  (select (payload #>> '{rows,0,tied}')::boolean from leaderboard_pages where name = 'pre_results'),
  false,
  'pre-results standings are not framed as a tie'
);
select is(
  (select payload #>> '{you,rank}' from leaderboard_pages where name = 'pre_results'),
  null::text,
  'pre-results current-user context suppresses rank'
);
select ok(
  has_function_privilege(
    'authenticated',
    'public.get_leaderboard(uuid,integer,text)',
    'execute'
  ),
  'authenticated users can execute the paginated leaderboard RPC'
);
select ok(
  not has_function_privilege(
    'anon',
    'public.get_leaderboard(uuid,integer,text)',
    'execute'
  ),
  'anonymous users cannot execute the paginated leaderboard RPC'
);

select * from finish();
rollback;
