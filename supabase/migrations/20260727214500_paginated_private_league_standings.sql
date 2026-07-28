begin;

-- Contract 45 replaces the capped-but-whole private-league member payload with
-- deterministic keyset pagination and a distinct owner-only candidate search.
drop function if exists public.get_league_members(uuid);

create function public.get_league_members(
  p_league_id uuid,
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
  v_uid uuid := (select auth.uid());
  v_tournament uuid;
  v_limit integer;
  v_cursor jsonb;
  v_after_points integer;
  v_after_sort text;
  v_after_name text;
  v_after_key text;
  v_result jsonb;
begin
  if p_league_id is null then
    raise exception 'League is required'
      using errcode = '22023';
  end if;

  if v_uid is null then
    raise exception 'Not authenticated'
      using errcode = 'insufficient_privilege';
  end if;

  if not exists (
    select 1
    from public.league_members membership
    where membership.league_id = p_league_id
      and membership.user_id = v_uid
  ) then
    raise exception 'Not a member of this league'
      using errcode = 'insufficient_privilege';
  end if;

  select league.tournament_id
    into v_tournament
    from public.leagues league
    where league.id = p_league_id;

  if v_tournament is null then
    raise exception 'League not found'
      using errcode = 'no_data_found';
  end if;

  if p_limit is null then
    v_limit := 50;
  elsif p_limit < 1 then
    raise exception 'League standings page size must be at least 1'
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
        raise exception 'Invalid league standings cursor'
          using errcode = '22023';
    end;

    if v_after_points is null
       or v_after_sort is null
       or v_after_name is null
       or v_after_key is null
       or v_after_key !~ '^[0-9a-f]{32}$'
       or v_after_sort is distinct from lower(v_after_name)
    then
      raise exception 'Invalid league standings cursor'
        using errcode = '22023';
    end if;
  end if;

  with prediction_counts as (
    select
      prediction.entry_id,
      count(*)::integer as predicted_count
    from public.match_predictions prediction
    group by prediction.entry_id
  ),
  base as (
    select
      membership.user_id,
      profile.display_name,
      lower(profile.display_name) collate "C" as sort_name,
      md5(membership.user_id::text) as member_key,
      coalesce(total.total_points, 0)::integer as total_points,
      (membership.role = 'owner') as is_owner,
      (entry.submitted_at is not null) as has_entry,
      coalesce(predictions.predicted_count, 0)::integer as predicted_count,
      membership.joined_at
    from public.league_members membership
    join public.profiles profile
      on profile.id = membership.user_id
    left join public.entries entry
      on entry.user_id = membership.user_id
     and entry.tournament_id = v_tournament
    left join public.entry_totals total
      on total.entry_id = entry.id
    left join prediction_counts predictions
      on predictions.entry_id = entry.id
    where membership.league_id = p_league_id
  ),
  summary as (
    select
      count(*)::integer as total_count,
      count(distinct member.total_points)::integer as distinct_totals
    from base member
  ),
  ranked as (
    select
      member.*,
      summary.total_count,
      summary.distinct_totals,
      row_number() over (
        order by
          member.total_points desc,
          member.sort_name,
          member.display_name collate "C",
          member.member_key
      )::integer as position,
      rank() over (order by member.total_points desc)::integer as standard_rank,
      count(*) over (partition by member.total_points)::integer as same_total_count
    from base member
    cross join summary
  ),
  candidates as (
    select ranked_member.*
    from ranked ranked_member
    where v_after_points is null
       or ranked_member.total_points < v_after_points
       or (
         ranked_member.total_points = v_after_points
         and (
           ranked_member.sort_name > (v_after_sort collate "C")
           or (
             ranked_member.sort_name = (v_after_sort collate "C")
             and ranked_member.display_name collate "C" > v_after_name collate "C"
           )
           or (
             ranked_member.sort_name = (v_after_sort collate "C")
             and ranked_member.display_name collate "C" = v_after_name collate "C"
             and ranked_member.member_key > v_after_key
           )
         )
       )
    order by
      ranked_member.total_points desc,
      ranked_member.sort_name,
      ranked_member.display_name collate "C",
      ranked_member.member_key
    limit v_limit + 1
  ),
  page_rows as (
    select candidate.*
    from candidates candidate
    order by
      candidate.total_points desc,
      candidate.sort_name,
      candidate.display_name collate "C",
      candidate.member_key
    limit v_limit
  )
  select jsonb_build_object(
    'rows', coalesce(
      (
        select jsonb_agg(
          jsonb_build_object(
            'userId', row.user_id,
            'displayName', row.display_name,
            'totalPoints', row.total_points,
            'rank', case
              when row.distinct_totals <= 1 then null
              else row.standard_rank
            end,
            'tied', row.distinct_totals > 1 and row.same_total_count > 1,
            'position', row.position,
            'isYou', row.user_id = v_uid,
            'isOwner', row.is_owner,
            'hasEntry', row.has_entry,
            'predictedCount', row.predicted_count,
            'joinedAt', row.joined_at
          )
          order by
            row.total_points desc,
            row.sort_name,
            row.display_name collate "C",
            row.member_key
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
              'key', row.member_key
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
          row.member_key desc
        limit 1
      )
      else null
    end,
    'you', (
      select jsonb_build_object(
        'userId', row.user_id,
        'displayName', row.display_name,
        'totalPoints', row.total_points,
        'rank', case
          when row.distinct_totals <= 1 then null
          else row.standard_rank
        end,
        'tied', row.distinct_totals > 1 and row.same_total_count > 1,
        'position', row.position,
        'isOwner', row.is_owner,
        'hasEntry', row.has_entry,
        'predictedCount', row.predicted_count,
        'joinedAt', row.joined_at
      )
      from ranked row
      where row.user_id = v_uid
      limit 1
    )
  )
    into v_result
    from summary;

  return v_result;
end;
$$;

create function public.search_league_transfer_candidates(
  p_league_id uuid,
  p_query text default null,
  p_limit integer default 20
)
returns table (
  user_id uuid,
  display_name text
)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
  v_query text := lower(btrim(coalesce(p_query, '')));
  v_limit integer;
begin
  if p_league_id is null then
    raise exception 'League is required'
      using errcode = '22023';
  end if;

  if v_uid is null then
    raise exception 'Not authenticated'
      using errcode = 'insufficient_privilege';
  end if;

  if not exists (
    select 1
    from public.leagues league
    where league.id = p_league_id
      and league.owner_id = v_uid
  ) then
    raise exception 'Only the owner can search transfer candidates'
      using errcode = 'insufficient_privilege';
  end if;

  if p_limit is null then
    v_limit := 20;
  elsif p_limit < 1 then
    raise exception 'Transfer candidate limit must be at least 1'
      using errcode = '22023';
  else
    v_limit := least(p_limit, 50);
  end if;

  return query
    select
      membership.user_id,
      profile.display_name
    from public.league_members membership
    join public.profiles profile
      on profile.id = membership.user_id
    where membership.league_id = p_league_id
      and membership.user_id <> v_uid
      and (
        v_query = ''
        or position(v_query in lower(profile.display_name)) > 0
      )
    order by
      lower(profile.display_name) collate "C",
      profile.display_name collate "C",
      md5(membership.user_id::text)
    limit v_limit;
end;
$$;

-- Preserve the established browser signature while removing the mutable public
-- search path from this security-definer read.
create or replace function public.get_league(p_league_id uuid)
returns table (
  id uuid,
  name text,
  invite_code text,
  member_count integer,
  is_owner boolean,
  owner_id uuid,
  owner_name text
)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
begin
  if v_uid is null then
    raise exception 'Not authenticated'
      using errcode = 'insufficient_privilege';
  end if;

  if not exists (
    select 1
    from public.league_members membership
    where membership.league_id = p_league_id
      and membership.user_id = v_uid
  ) then
    raise exception 'Not a member of this league'
      using errcode = 'insufficient_privilege';
  end if;

  return query
    select
      league.id,
      league.name,
      league.invite_code,
      (
        select count(*)::integer
        from public.league_members member_count
        where member_count.league_id = league.id
      ),
      league.owner_id = v_uid,
      league.owner_id,
      owner_profile.display_name
    from public.leagues league
    join public.profiles owner_profile
      on owner_profile.id = league.owner_id
    where league.id = p_league_id;
end;
$$;

-- The mutation remains authoritative and membership-validated; only its search
-- path and qualification are hardened.
create or replace function public.transfer_ownership(
  p_league_id uuid,
  p_new_owner uuid
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
begin
  if v_uid is null then
    raise exception 'Not authenticated'
      using errcode = 'insufficient_privilege';
  end if;

  if not exists (
    select 1
    from public.leagues league
    where league.id = p_league_id
      and league.owner_id = v_uid
  ) then
    raise exception 'Only the owner can transfer ownership'
      using errcode = 'insufficient_privilege';
  end if;

  if not exists (
    select 1
    from public.league_members membership
    where membership.league_id = p_league_id
      and membership.user_id = p_new_owner
  ) then
    raise exception 'The new owner must be a member of the league'
      using errcode = 'check_violation';
  end if;

  update public.leagues league
    set owner_id = p_new_owner
    where league.id = p_league_id;

  update public.league_members membership
    set role = 'member'
    where membership.league_id = p_league_id
      and membership.user_id = v_uid;

  update public.league_members membership
    set role = 'owner'
    where membership.league_id = p_league_id
      and membership.user_id = p_new_owner;
end;
$$;

revoke all on function public.get_league_members(uuid, integer, text)
  from public, anon, authenticated, service_role;
revoke all on function public.search_league_transfer_candidates(uuid, text, integer)
  from public, anon, authenticated, service_role;
revoke all on function public.get_league(uuid)
  from public, anon, authenticated, service_role;
revoke all on function public.transfer_ownership(uuid, uuid)
  from public, anon, authenticated, service_role;

grant execute on function public.get_league_members(uuid, integer, text)
  to authenticated, service_role;
grant execute on function public.search_league_transfer_candidates(uuid, text, integer)
  to authenticated, service_role;
grant execute on function public.get_league(uuid)
  to authenticated, service_role;
grant execute on function public.transfer_ownership(uuid, uuid)
  to authenticated, service_role;

commit;
