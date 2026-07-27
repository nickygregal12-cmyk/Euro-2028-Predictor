begin;

create index if not exists entries_submitted_tournament_idx
  on public.entries (tournament_id, id)
  where submitted_at is not null;

drop function if exists public.get_leaderboard(uuid);

create function public.get_leaderboard(
  p_tournament_id uuid,
  p_limit integer default 50,
  p_after text default null
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_limit integer;
  v_cursor jsonb;
  v_after_points integer;
  v_after_sort text;
  v_after_name text;
  v_after_key text;
  v_result jsonb;
begin
  if p_tournament_id is null then
    raise exception 'Tournament is required'
      using errcode = '22023';
  end if;

  if p_limit is null then
    v_limit := 50;
  elsif p_limit < 1 then
    raise exception 'Leaderboard page size must be at least 1'
      using errcode = '22023';
  else
    v_limit := least(p_limit, 100);
  end if;

  if p_after is not null and btrim(p_after) <> '' then
    begin
      v_cursor := convert_from(decode(p_after, 'hex'), 'UTF8')::jsonb;
      v_after_points := (v_cursor ->> 'points')::integer;
      v_after_sort := v_cursor ->> 'sort';
      v_after_name := v_cursor ->> 'name';
      v_after_key := v_cursor ->> 'key';
    exception
      when others then
        raise exception 'Invalid leaderboard cursor'
          using errcode = '22023';
    end;

    if v_after_points is null
       or v_after_sort is null
       or v_after_name is null
       or v_after_key is null
       or v_after_key !~ '^[0-9a-f]{32}$'
       or v_after_sort is distinct from lower(v_after_name)
    then
      raise exception 'Invalid leaderboard cursor'
        using errcode = '22023';
    end if;
  end if;

  with base as (
    select
      e.id as entry_id,
      e.user_id,
      p.display_name,
      lower(p.display_name) collate "C" as sort_name,
      md5(e.id::text) as entry_key,
      coalesce(sum(se.points), 0)::integer as total_points
    from public.entries e
    join public.profiles p
      on p.id = e.user_id
    left join public.score_events se
      on se.entry_id = e.id
    where e.tournament_id = p_tournament_id
      and e.submitted_at is not null
    group by e.id, e.user_id, p.display_name
  ),
  summary as (
    select
      count(*)::integer as total_count,
      count(distinct b.total_points)::integer as distinct_totals
    from base b
  ),
  ranked as (
    select
      b.entry_id,
      b.user_id,
      b.display_name,
      b.sort_name,
      b.entry_key,
      b.total_points,
      s.total_count,
      s.distinct_totals,
      row_number() over (
        order by
          b.total_points desc,
          b.sort_name,
          b.display_name collate "C",
          b.entry_key
      )::integer as position,
      rank() over (order by b.total_points desc)::integer as standard_rank,
      count(*) over (partition by b.total_points)::integer as same_total_count
    from base b
    cross join summary s
  ),
  candidates as (
    select r.*
    from ranked r
    where v_after_points is null
       or r.total_points < v_after_points
       or (
         r.total_points = v_after_points
         and (
           r.sort_name > (v_after_sort collate "C")
           or (
             r.sort_name = (v_after_sort collate "C")
             and r.display_name collate "C" > v_after_name collate "C"
           )
           or (
             r.sort_name = (v_after_sort collate "C")
             and r.display_name collate "C" = v_after_name collate "C"
             and r.entry_key > v_after_key
           )
         )
       )
    order by
      r.total_points desc,
      r.sort_name,
      r.display_name collate "C",
      r.entry_key
    limit v_limit + 1
  ),
  page_rows as (
    select c.*
    from candidates c
    order by
      c.total_points desc,
      c.sort_name,
      c.display_name collate "C",
      c.entry_key
    limit v_limit
  )
  select jsonb_build_object(
    'rows', coalesce(
      (
        select jsonb_agg(
          jsonb_build_object(
            'displayName', row.display_name,
            'totalPoints', row.total_points,
            'rank', case
              when row.distinct_totals <= 1 then null
              else row.standard_rank
            end,
            'tied', row.distinct_totals > 1 and row.same_total_count > 1,
            'position', row.position,
            'isYou', row.user_id = (select auth.uid())
          )
          order by
            row.total_points desc,
            row.sort_name,
            row.display_name collate "C",
            row.entry_key
        )
        from page_rows row
      ),
      '[]'::jsonb
    ),
    'totalCount', summary.total_count,
    'pageSize', v_limit,
    'hasMore', (select count(*) from candidates) > v_limit,
    'nextCursor', case
      when (select count(*) from candidates) > v_limit then (
        select encode(
          convert_to(
            jsonb_build_object(
              'points', row.total_points,
              'sort', row.sort_name,
              'name', row.display_name,
              'key', row.entry_key
            )::text,
            'UTF8'
          ),
          'hex'
        )
        from page_rows row
        order by
          row.total_points asc,
          row.sort_name desc,
          row.display_name collate "C" desc,
          row.entry_key desc
        limit 1
      )
      else null
    end,
    'you', (
      select jsonb_build_object(
        'displayName', row.display_name,
        'totalPoints', row.total_points,
        'rank', case
          when row.distinct_totals <= 1 then null
          else row.standard_rank
        end,
        'tied', row.distinct_totals > 1 and row.same_total_count > 1,
        'position', row.position
      )
      from ranked row
      where row.user_id = (select auth.uid())
      limit 1
    )
  )
    into v_result
    from summary;

  return v_result;
end;
$$;

revoke all on function public.get_leaderboard(uuid, integer, text)
  from public, anon, authenticated, service_role;
grant execute on function public.get_leaderboard(uuid, integer, text)
  to authenticated, service_role;

commit;
