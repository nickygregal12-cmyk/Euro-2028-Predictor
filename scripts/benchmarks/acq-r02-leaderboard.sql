-- ===========================================================================
-- ACQ-R02 — does get_leaderboard() cost grow with the field, and does page
--           depth matter?   [v2 — pure SQL, no psql meta-commands]
-- ===========================================================================
--
-- RUN THIS ON A DISPOSABLE LOCAL SUPABASE ONLY.
--     supabase start && supabase db reset --local
-- Do NOT run it against hosted development or production. It writes ~300k rows.
-- It aborts if it finds more than 25 auth.users rows, deletes its own rows at
-- the end, and the whole thing is wrapped in a transaction that ROLLBACKs.
--
-- Paste the whole file as ONE execution. It returns a single result set at the
-- end — send that back, all rows.
--
-- WHAT DECIDES ACQ-R02
--   Not raw milliseconds (your hardware is not Supabase's). The shape:
--     * page_10_ms ~= page_1_ms at the same field size
--         -> every page re-aggregates the whole field; pagination is
--            presentational; the materialised standings table is warranted.
--     * mean_ms rising roughly linearly with field_size
--         -> cost tracks the field, as the SQL implies.
--     * mean_ms flat across sizes
--         -> score_events_entry_idx is carrying it; ACQ-R02 is theoretical at
--            these volumes and can be deferred with evidence.
-- ===========================================================================

begin;

-- 0. Refuse to run anywhere that looks real. ------------------------------
do $$
begin
  if (select count(*) from auth.users) > 25 then
    raise exception
      'Refusing to run: % auth.users rows present. Disposable local stack only.',
      (select count(*) from auth.users);
  end if;
end $$;

create temporary table bench_pages (
  field_size   integer,
  total_events bigint,
  page         integer,
  ms           numeric
) on commit drop;

create temporary table bench_plans (
  field_size   integer,
  exec_ms      numeric,
  plan_json    jsonb
) on commit drop;

-- 1. Seed helper. ---------------------------------------------------------
create or replace function pg_temp.bench_seed(p_add integer, p_events integer)
returns void language plpgsql as $$
declare v_from integer;
begin
  select count(*)::integer into v_from
  from public.entries
  where tournament_id = 'aca2ac02-0000-0000-0000-000000000001'::uuid;

  insert into public.profiles (id, display_name)
  select ('aca2ac02-0000-0000-0001-' || lpad((v_from + n)::text, 12, '0'))::uuid,
         'Benchmark Player ' || (v_from + n)
  from generate_series(1, p_add) as n;

  insert into public.entries (id, user_id, tournament_id, submitted_at)
  select ('aca2ac02-0000-0000-0002-' || lpad((v_from + n)::text, 12, '0'))::uuid,
         ('aca2ac02-0000-0000-0001-' || lpad((v_from + n)::text, 12, '0'))::uuid,
         'aca2ac02-0000-0000-0000-000000000001'::uuid,
         now() - interval '2 hours'
  from generate_series(1, p_add) as n;

  insert into public.score_events (entry_id, category, points, explanation)
  select ('aca2ac02-0000-0000-0002-' || lpad((v_from + n)::text, 12, '0'))::uuid,
         'group_matches',
         ((n * 7 + e * 3) % 6),
         'benchmark'
  from generate_series(1, p_add) as n,
       generate_series(1, p_events) as e;
end $$;

-- 2. Page walk, chaining the function's own nextCursor. -------------------
create or replace function pg_temp.bench_walk(p_pages integer, p_limit integer)
returns void language plpgsql as $$
declare
  v_cursor text := null;
  v_result jsonb;
  v_started timestamptz;
  v_entries integer;
  v_events bigint;
  i integer;
begin
  select count(*) into v_entries from public.entries
  where tournament_id = 'aca2ac02-0000-0000-0000-000000000001'::uuid;

  select count(*) into v_events
  from public.score_events se
  join public.entries e on e.id = se.entry_id
  where e.tournament_id = 'aca2ac02-0000-0000-0000-000000000001'::uuid;

  for i in 1..p_pages loop
    v_started := clock_timestamp();
    v_result := public.get_leaderboard(
      'aca2ac02-0000-0000-0000-000000000001'::uuid, p_limit, v_cursor);
    insert into bench_pages values (
      v_entries, v_events, i,
      round(extract(epoch from clock_timestamp() - v_started)::numeric * 1000, 1));
    v_cursor := v_result ->> 'nextCursor';
    exit when v_cursor is null;
  end loop;
end $$;

-- 3. Capture the real aggregation plan at the current size. ---------------
create or replace function pg_temp.bench_plan()
returns void language plpgsql as $$
declare
  v_plan jsonb;
  v_entries integer;
begin
  select count(*)::integer into v_entries from public.entries
  where tournament_id = 'aca2ac02-0000-0000-0000-000000000001'::uuid;

  execute $q$
    explain (analyze, buffers, format json)
    with base as (
      select e.id as entry_id, e.user_id, p.display_name,
             lower(p.display_name) collate "C" as sort_name,
             md5(e.id::text) as entry_key,
             coalesce(sum(se.points), 0)::integer as total_points
      from public.entries e
      join public.profiles p on p.id = e.user_id
      left join public.score_events se on se.entry_id = e.id
      where e.tournament_id = 'aca2ac02-0000-0000-0000-000000000001'::uuid
        and e.submitted_at is not null
      group by e.id, e.user_id, p.display_name
    ),
    summary as (
      select count(*)::integer as total_count,
             count(distinct b.total_points)::integer as distinct_totals
      from base b
    ),
    ranked as (
      select b.*, s.total_count, s.distinct_totals,
        row_number() over (order by b.total_points desc, b.sort_name,
                           b.display_name collate "C", b.entry_key)::integer as position
      from base b cross join summary s
    )
    select * from ranked order by position limit 20
  $q$ into v_plan;

  insert into bench_plans
  values (v_entries, (v_plan -> 0 ->> 'Execution Time')::numeric, v_plan);
end $$;

-- 4. Run the scales. ------------------------------------------------------
do $$
declare
  v_steps integer[] := array[50, 200, 750, 4000];   -- cumulative: 50, 250, 1000, 5000
  v_step integer;
begin
  set local session_replication_role = replica;

  insert into public.tournaments (id, name, year, starts_on, ends_on, lock_at)
  values ('aca2ac02-0000-0000-0000-000000000001'::uuid,
          'ACQ-R02 benchmark', 2028, current_date, current_date + 30,
          now() - interval '1 hour');

  foreach v_step in array v_steps loop
    perform pg_temp.bench_seed(v_step, 60);

    -- Measure under normal semantics, never under suspended FK checks.
    set local session_replication_role = origin;
    execute 'analyze public.entries';
    execute 'analyze public.score_events';
    execute 'analyze public.profiles';

    perform pg_temp.bench_plan();
    perform pg_temp.bench_walk(10, 20);

    set local session_replication_role = replica;
  end loop;

  set local session_replication_role = origin;
end $$;

-- 5. Belt and braces: remove the benchmark rows even if the rollback below
--    is somehow not honoured by the client.
delete from public.score_events se
using public.entries e
where e.id = se.entry_id
  and e.tournament_id = 'aca2ac02-0000-0000-0000-000000000001'::uuid;
delete from public.entries
where tournament_id = 'aca2ac02-0000-0000-0000-000000000001'::uuid;
delete from public.profiles
where id::text like 'aca2ac02-0000-0000-0001-%';
delete from public.tournaments
where id = 'aca2ac02-0000-0000-0000-000000000001'::uuid;

-- 6. The single result set to send back. ----------------------------------
select
  p.field_size,
  p.total_events                                    as score_events,
  pl.exec_ms                                        as aggregation_exec_ms,
  max(p.ms) filter (where p.page = 1)               as page_1_ms,
  max(p.ms) filter (where p.page = 5)               as page_5_ms,
  max(p.ms) filter (where p.page = 10)              as page_10_ms,
  round(avg(p.ms), 1)                               as mean_page_ms,
  count(*)                                          as pages_walked,
  -- Was score_events scanned whole, or reached by index?
  case
    when pl.plan_json::text like '%"Seq Scan"%score_events%' then 'seq scan'
    when pl.plan_json::text like '%score_events_entry_idx%' then 'index'
    else 'see plan_json'
  end                                               as score_events_access
from bench_pages p
join bench_plans pl on pl.field_size = p.field_size
group by p.field_size, p.total_events, pl.exec_ms, pl.plan_json
order by p.field_size;

rollback;
