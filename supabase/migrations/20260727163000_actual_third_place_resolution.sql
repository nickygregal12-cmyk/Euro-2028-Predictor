begin;

create table public.actual_third_place_resolutions (
  id uuid primary key default gen_random_uuid(),
  tournament_id uuid not null references public.tournaments(id) on delete cascade,
  tie_key text not null,
  basis_hash text not null,
  ordered_team_ids uuid[] not null,
  version integer not null check (version > 0),
  last_reason text not null,
  updated_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tournament_id),
  check (cardinality(ordered_team_ids) >= 2),
  check (char_length(btrim(last_reason)) between 5 and 500)
);

create table public.actual_third_place_resolution_revisions (
  id uuid primary key default gen_random_uuid(),
  tournament_id uuid not null references public.tournaments(id) on delete cascade,
  tie_key text not null,
  revision integer not null check (revision > 0),
  action text not null check (action in ('resolve', 'correct', 'clear')),
  previous_resolution jsonb not null,
  new_resolution jsonb not null,
  reason text not null,
  actor_id uuid references auth.users(id) on delete set null,
  recorded_at timestamptz not null default now(),
  unique (tournament_id, revision),
  check (char_length(btrim(reason)) between 5 and 500)
);

alter table public.actual_third_place_resolutions enable row level security;
alter table public.actual_third_place_resolution_revisions enable row level security;

create or replace function predictor_internal.actual_group_result_fingerprint(
  p_tournament_id uuid
)
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select md5(
    coalesce(
      string_agg(
        concat_ws(
          ':',
          m.match_ref,
          m.result_state,
          m.result_version::text,
          coalesce(m.home_score::text, '~'),
          coalesce(m.away_score::text, '~'),
          coalesce(m.winner_team_id::text, '~')
        ),
        '|'
        order by m.match_ref
      ),
      ''
    )
  )
  from public.matches m
  where m.tournament_id = p_tournament_id
    and m.round = 'group';
$$;

create or replace function predictor_internal.actual_third_place_ranking_base(
  p_tournament_id uuid
)
returns table (
  group_letter text,
  team_id uuid,
  points integer,
  goal_difference integer,
  goals_for integer,
  wins integer,
  tie_key text,
  higher_count integer,
  block_size integer,
  unresolved boolean
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_group_count integer;
  v_resolved_group_count integer;
begin
  select count(*)::integer
    into v_group_count
    from public.groups g
    where g.tournament_id = p_tournament_id
      and g.letter in ('A', 'B', 'C', 'D', 'E', 'F');

  if v_group_count <> 6 then
    raise exception 'The current Round of 16 contract requires groups A to F'
      using errcode = '55000';
  end if;

  select count(*)::integer
    into v_resolved_group_count
    from public.groups g
    where g.tournament_id = p_tournament_id
      and g.letter in ('A', 'B', 'C', 'D', 'E', 'F')
      and cardinality(public._actual_group_order(g.id)) = 4;

  if v_resolved_group_count <> 6 then
    raise exception 'Actual group standings are incomplete or unresolved'
      using errcode = '55000';
  end if;

  return query
  with group_orders as (
    select
      g.id as group_id,
      g.letter as group_letter,
      public._actual_group_order(g.id) as ordered_team_ids
    from public.groups g
    where g.tournament_id = p_tournament_id
      and g.letter in ('A', 'B', 'C', 'D', 'E', 'F')
  ),
  thirds as (
    select
      go.group_id,
      go.group_letter,
      (go.ordered_team_ids)[3] as team_id
    from group_orders go
  ),
  appearances as (
    select
      th.group_letter,
      th.team_id,
      case
        when m.home_team_id = th.team_id then m.home_score
        else m.away_score
      end as goals_for,
      case
        when m.home_team_id = th.team_id then m.away_score
        else m.home_score
      end as goals_against
    from thirds th
    join public.matches m
      on m.group_id = th.group_id
     and m.tournament_id = p_tournament_id
     and m.round = 'group'
     and th.team_id in (m.home_team_id, m.away_team_id)
     and m.result_state in ('confirmed', 'corrected')
  ),
  stats as (
    select
      a.group_letter,
      a.team_id,
      sum(
        case
          when a.goals_for > a.goals_against then 3
          when a.goals_for = a.goals_against then 1
          else 0
        end
      )::integer as points,
      sum(a.goals_for - a.goals_against)::integer as goal_difference,
      sum(a.goals_for)::integer as goals_for,
      count(*) filter (where a.goals_for > a.goals_against)::integer as wins
    from appearances a
    group by a.group_letter, a.team_id
  ),
  blocks as (
    select
      s.*,
      (
        select string_agg(peer.team_id::text, '|' order by peer.team_id::text)
        from stats peer
        where row(
          peer.points,
          peer.goal_difference,
          peer.goals_for,
          peer.wins
        ) = row(
          s.points,
          s.goal_difference,
          s.goals_for,
          s.wins
        )
      ) as tie_key,
      (
        select count(*)::integer
        from stats higher
        where row(
          higher.points,
          higher.goal_difference,
          higher.goals_for,
          higher.wins
        ) > row(
          s.points,
          s.goal_difference,
          s.goals_for,
          s.wins
        )
      ) as higher_count,
      (
        select count(*)::integer
        from stats peer
        where row(
          peer.points,
          peer.goal_difference,
          peer.goals_for,
          peer.wins
        ) = row(
          s.points,
          s.goal_difference,
          s.goals_for,
          s.wins
        )
      ) as block_size
    from stats s
  )
  select
    b.group_letter,
    b.team_id,
    b.points,
    b.goal_difference,
    b.goals_for,
    b.wins,
    b.tie_key,
    b.higher_count,
    b.block_size,
    b.block_size > 1 as unresolved
  from blocks b
  order by
    b.points desc,
    b.goal_difference desc,
    b.goals_for desc,
    b.wins desc,
    b.group_letter;
end;
$$;

create or replace function predictor_internal.actual_third_place_boundary(
  p_tournament_id uuid
)
returns table (
  tie_key text,
  basis_hash text,
  higher_count integer,
  block_size integer,
  qualifying_places integer,
  team_ids uuid[]
)
language sql
stable
security definer
set search_path = ''
as $$
  with ranking as (
    select *
    from predictor_internal.actual_third_place_ranking_base(p_tournament_id)
  ),
  boundary as (
    select
      r.tie_key,
      min(r.higher_count)::integer as higher_count,
      max(r.block_size)::integer as block_size
    from ranking r
    where r.block_size > 1
    group by r.tie_key
    having min(r.higher_count) < 4
       and min(r.higher_count) + max(r.block_size) > 4
    order by min(r.higher_count), r.tie_key
    limit 1
  )
  select
    b.tie_key,
    predictor_internal.actual_group_result_fingerprint(p_tournament_id),
    b.higher_count,
    b.block_size,
    4 - b.higher_count,
    array_agg(r.team_id order by r.group_letter)
  from boundary b
  join ranking r on r.tie_key = b.tie_key
  group by b.tie_key, b.higher_count, b.block_size;
$$;

create or replace function predictor_internal.actual_third_place_ranking(
  p_tournament_id uuid
)
returns table (
  group_letter text,
  team_id uuid,
  points integer,
  goal_difference integer,
  goals_for integer,
  wins integer,
  tie_key text,
  higher_count integer,
  block_size integer,
  unresolved boolean
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_basis_hash text := predictor_internal.actual_group_result_fingerprint(
    p_tournament_id
  );
begin
  return query
  with ranking as (
    select *
    from predictor_internal.actual_third_place_ranking_base(p_tournament_id)
  ),
  ranked as (
    select
      base.group_letter,
      base.team_id,
      base.points,
      base.goal_difference,
      base.goals_for,
      base.wins,
      base.tie_key,
      base.higher_count + case
        when resolution.id is null then 0
        else coalesce(
          array_position(resolution.ordered_team_ids, base.team_id),
          1
        ) - 1
      end as effective_higher_count,
      base.block_size,
      base.block_size > 1 and resolution.id is null as unresolved,
      resolution.ordered_team_ids
    from ranking base
    left join public.actual_third_place_resolutions resolution
      on resolution.tournament_id = p_tournament_id
     and resolution.tie_key = base.tie_key
     and resolution.basis_hash = v_basis_hash
     and cardinality(resolution.ordered_team_ids) = base.block_size
     and base.team_id = any(resolution.ordered_team_ids)
  )
  select
    ranked.group_letter,
    ranked.team_id,
    ranked.points,
    ranked.goal_difference,
    ranked.goals_for,
    ranked.wins,
    ranked.tie_key,
    ranked.effective_higher_count,
    ranked.block_size,
    ranked.unresolved
  from ranked
  order by
    ranked.points desc,
    ranked.goal_difference desc,
    ranked.goals_for desc,
    ranked.wins desc,
    ranked.effective_higher_count,
    ranked.group_letter;
end;
$$;

create or replace function predictor_internal.validate_actual_third_place_resolution()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_boundary record;
  v_expected_key text;
  v_team_count integer;
  v_unique_count integer;
  v_group_count integer;
begin
  select *
    into v_boundary
    from predictor_internal.actual_third_place_boundary(new.tournament_id);

  if not found then
    raise exception 'There is no current actual third-place qualification-boundary tie'
      using errcode = '55000';
  end if;

  select
    string_agg(ids.team_id::text, '|' order by ids.team_id::text),
    count(*)::integer,
    count(distinct ids.team_id)::integer,
    count(distinct gt.group_id)::integer
    into v_expected_key, v_team_count, v_unique_count, v_group_count
    from unnest(new.ordered_team_ids) as ids(team_id)
    left join public.teams team
      on team.id = ids.team_id
     and team.tournament_id = new.tournament_id
    left join public.group_teams gt
      on gt.team_id = team.id;

  if new.tie_key <> v_boundary.tie_key
     or new.basis_hash <> v_boundary.basis_hash
     or new.tie_key <> v_expected_key
     or v_team_count <> v_boundary.block_size
     or v_unique_count <> v_boundary.block_size
     or v_group_count <> v_boundary.block_size
  then
    raise exception 'Actual third-place resolution must order the exact current boundary tie set'
      using errcode = '23514';
  end if;

  new.last_reason := btrim(new.last_reason);
  new.updated_at := now();
  return new;
end;
$$;

create trigger validate_actual_third_place_resolution
before insert or update on public.actual_third_place_resolutions
for each row
execute function predictor_internal.validate_actual_third_place_resolution();

create or replace function predictor_internal.block_actual_tie_revision_mutation()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  raise exception 'Actual third-place resolution revisions are immutable'
    using errcode = '42501';
end;
$$;

create trigger block_actual_tie_revision_mutation
before update or delete on public.actual_third_place_resolution_revisions
for each row
execute function predictor_internal.block_actual_tie_revision_mutation();

create or replace function public.admin_actual_third_place_tie_status(
  p_tournament_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_boundary record;
  v_resolution public.actual_third_place_resolutions%rowtype;
  v_teams jsonb;
begin
  perform predictor_internal.require_result_admin();

  begin
    select *
      into v_boundary
      from predictor_internal.actual_third_place_boundary(p_tournament_id);
  exception
    when sqlstate '55000' then
      return jsonb_build_object(
        'state', 'not_ready',
        'message', 'Complete and resolve all six group tables before ranking third-placed teams.'
      );
  end;

  if not found then
    return jsonb_build_object(
      'state', 'clear',
      'message', 'No actual third-place tie crosses the qualification boundary.'
    );
  end if;

  select *
    into v_resolution
    from public.actual_third_place_resolutions resolution
    where resolution.tournament_id = p_tournament_id
      and resolution.tie_key = v_boundary.tie_key
      and resolution.basis_hash = v_boundary.basis_hash;

  select jsonb_agg(
    jsonb_build_object(
      'teamId', ranking.team_id,
      'teamName', team.name,
      'groupLetter', ranking.group_letter,
      'points', ranking.points,
      'goalDifference', ranking.goal_difference,
      'goalsFor', ranking.goals_for,
      'wins', ranking.wins,
      'currentPosition', case
        when v_resolution.id is null then null
        else ranking.higher_count + array_position(
          v_resolution.ordered_team_ids,
          ranking.team_id
        )
      end
    )
    order by case
      when v_resolution.id is null then ascii(ranking.group_letter)
      else array_position(v_resolution.ordered_team_ids, ranking.team_id)
    end
  )
    into v_teams
    from predictor_internal.actual_third_place_ranking_base(p_tournament_id) ranking
    join public.teams team on team.id = ranking.team_id
    where ranking.tie_key = v_boundary.tie_key;

  return jsonb_build_object(
    'state', case when v_resolution.id is null then 'requires_resolution' else 'resolved' end,
    'tieKey', v_boundary.tie_key,
    'basisHash', v_boundary.basis_hash,
    'higherCount', v_boundary.higher_count,
    'blockSize', v_boundary.block_size,
    'qualifyingPlaces', v_boundary.qualifying_places,
    'teams', coalesce(v_teams, '[]'::jsonb),
    'orderedTeamIds', case
      when v_resolution.id is null then '[]'::jsonb
      else to_jsonb(v_resolution.ordered_team_ids)
    end,
    'version', v_resolution.version,
    'reason', v_resolution.last_reason,
    'updatedAt', v_resolution.updated_at
  );
end;
$$;

create or replace function public.admin_actual_third_place_tie_revisions(
  p_tournament_id uuid
)
returns table (
  revision integer,
  action text,
  previous_resolution jsonb,
  new_resolution jsonb,
  reason text,
  recorded_at timestamptz
)
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform predictor_internal.require_result_admin();

  return query
  select
    history.revision,
    history.action,
    history.previous_resolution,
    history.new_resolution,
    history.reason,
    history.recorded_at
  from public.actual_third_place_resolution_revisions history
  where history.tournament_id = p_tournament_id
  order by history.revision desc;
end;
$$;

create or replace function public.admin_resolve_actual_third_place_tie(
  p_tournament_id uuid,
  p_ordered_team_ids uuid[],
  p_reason text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_boundary record;
  v_existing public.actual_third_place_resolutions%rowtype;
  v_action text;
  v_reason text := btrim(coalesce(p_reason, ''));
  v_expected_key text;
  v_unique_count integer;
  v_revision integer;
  v_previous jsonb;
  v_new jsonb;
  v_actor uuid := auth.uid();
begin
  perform predictor_internal.require_result_admin();

  if v_actor is null then
    raise exception 'Result administration requires an authenticated user'
      using errcode = '42501';
  end if;

  if char_length(v_reason) not between 5 and 500 then
    raise exception 'A resolution reason between 5 and 500 characters is required'
      using errcode = '22023';
  end if;

  perform pg_advisory_xact_lock(
    hashtextextended('actual-third-place:' || p_tournament_id::text, 0)
  );

  select *
    into v_boundary
    from predictor_internal.actual_third_place_boundary(p_tournament_id);

  if not found then
    raise exception 'There is no current actual third-place qualification-boundary tie'
      using errcode = '55000';
  end if;

  select
    string_agg(ids.team_id::text, '|' order by ids.team_id::text),
    count(distinct ids.team_id)::integer
    into v_expected_key, v_unique_count
    from unnest(p_ordered_team_ids) as ids(team_id);

  if cardinality(p_ordered_team_ids) <> v_boundary.block_size
     or v_unique_count <> v_boundary.block_size
     or v_expected_key <> v_boundary.tie_key
  then
    raise exception 'Order every team in the exact current boundary tie once'
      using errcode = '23514';
  end if;

  select *
    into v_existing
    from public.actual_third_place_resolutions resolution
    where resolution.tournament_id = p_tournament_id
    for update;

  if v_existing.id is not null
     and v_existing.tie_key = v_boundary.tie_key
     and v_existing.basis_hash = v_boundary.basis_hash
     and v_existing.ordered_team_ids = p_ordered_team_ids
  then
    raise exception 'The submitted third-place order is unchanged'
      using errcode = '22023';
  end if;

  select coalesce(max(history.revision), 0) + 1
    into v_revision
    from public.actual_third_place_resolution_revisions history
    where history.tournament_id = p_tournament_id;

  v_action := case
    when v_existing.id is null
      or v_existing.tie_key <> v_boundary.tie_key
      or v_existing.basis_hash <> v_boundary.basis_hash
    then 'resolve'
    else 'correct'
  end;

  v_previous := case
    when v_existing.id is null then '{}'::jsonb
    else jsonb_build_object(
      'tieKey', v_existing.tie_key,
      'basisHash', v_existing.basis_hash,
      'orderedTeamIds', v_existing.ordered_team_ids,
      'version', v_existing.version,
      'reason', v_existing.last_reason
    )
  end;

  insert into public.actual_third_place_resolutions (
    tournament_id,
    tie_key,
    basis_hash,
    ordered_team_ids,
    version,
    last_reason,
    updated_by
  ) values (
    p_tournament_id,
    v_boundary.tie_key,
    v_boundary.basis_hash,
    p_ordered_team_ids,
    v_revision,
    v_reason,
    v_actor
  )
  on conflict (tournament_id) do update
    set tie_key = excluded.tie_key,
        basis_hash = excluded.basis_hash,
        ordered_team_ids = excluded.ordered_team_ids,
        version = excluded.version,
        last_reason = excluded.last_reason,
        updated_by = excluded.updated_by,
        updated_at = now();

  v_new := jsonb_build_object(
    'tieKey', v_boundary.tie_key,
    'basisHash', v_boundary.basis_hash,
    'orderedTeamIds', p_ordered_team_ids,
    'version', v_revision,
    'reason', v_reason
  );

  insert into public.actual_third_place_resolution_revisions (
    tournament_id,
    tie_key,
    revision,
    action,
    previous_resolution,
    new_resolution,
    reason,
    actor_id
  ) values (
    p_tournament_id,
    v_boundary.tie_key,
    v_revision,
    v_action,
    v_previous,
    v_new,
    v_reason,
    v_actor
  );

  perform predictor_internal.refresh_actual_round_of_16(p_tournament_id);
  perform public.recompute_tournament_scores(p_tournament_id);

  return public.admin_actual_third_place_tie_status(p_tournament_id);
end;
$$;

create or replace function public.admin_clear_actual_third_place_tie(
  p_tournament_id uuid,
  p_reason text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_boundary record;
  v_existing public.actual_third_place_resolutions%rowtype;
  v_reason text := btrim(coalesce(p_reason, ''));
  v_revision integer;
  v_previous jsonb;
  v_actor uuid := auth.uid();
begin
  perform predictor_internal.require_result_admin();

  if v_actor is null then
    raise exception 'Result administration requires an authenticated user'
      using errcode = '42501';
  end if;

  if char_length(v_reason) not between 5 and 500 then
    raise exception 'A clear reason between 5 and 500 characters is required'
      using errcode = '22023';
  end if;

  perform pg_advisory_xact_lock(
    hashtextextended('actual-third-place:' || p_tournament_id::text, 0)
  );

  select *
    into v_boundary
    from predictor_internal.actual_third_place_boundary(p_tournament_id);

  if not found then
    raise exception 'There is no current actual third-place qualification-boundary tie'
      using errcode = '55000';
  end if;

  select *
    into v_existing
    from public.actual_third_place_resolutions resolution
    where resolution.tournament_id = p_tournament_id
      and resolution.tie_key = v_boundary.tie_key
      and resolution.basis_hash = v_boundary.basis_hash
    for update;

  if not found then
    raise exception 'There is no active actual third-place resolution to clear'
      using errcode = '55000';
  end if;

  select coalesce(max(history.revision), 0) + 1
    into v_revision
    from public.actual_third_place_resolution_revisions history
    where history.tournament_id = p_tournament_id;

  v_previous := jsonb_build_object(
    'tieKey', v_existing.tie_key,
    'basisHash', v_existing.basis_hash,
    'orderedTeamIds', v_existing.ordered_team_ids,
    'version', v_existing.version,
    'reason', v_existing.last_reason
  );

  delete from public.actual_third_place_resolutions resolution
    where resolution.id = v_existing.id;

  insert into public.actual_third_place_resolution_revisions (
    tournament_id,
    tie_key,
    revision,
    action,
    previous_resolution,
    new_resolution,
    reason,
    actor_id
  ) values (
    p_tournament_id,
    v_boundary.tie_key,
    v_revision,
    'clear',
    v_previous,
    '{}'::jsonb,
    v_reason,
    v_actor
  );

  perform predictor_internal.refresh_actual_round_of_16(p_tournament_id);
  perform public.recompute_tournament_scores(p_tournament_id);

  return public.admin_actual_third_place_tie_status(p_tournament_id);
end;
$$;

revoke all on table public.actual_third_place_resolutions
  from public, anon, authenticated, service_role;
revoke all on table public.actual_third_place_resolution_revisions
  from public, anon, authenticated, service_role;

revoke all on function predictor_internal.actual_group_result_fingerprint(uuid)
  from public, anon, authenticated, service_role;
revoke all on function predictor_internal.actual_third_place_ranking_base(uuid)
  from public, anon, authenticated, service_role;
revoke all on function predictor_internal.actual_third_place_boundary(uuid)
  from public, anon, authenticated, service_role;
revoke all on function predictor_internal.validate_actual_third_place_resolution()
  from public, anon, authenticated, service_role;
revoke all on function predictor_internal.block_actual_tie_revision_mutation()
  from public, anon, authenticated, service_role;

revoke all on function public.admin_actual_third_place_tie_status(uuid)
  from public, anon, authenticated, service_role;
revoke all on function public.admin_actual_third_place_tie_revisions(uuid)
  from public, anon, authenticated, service_role;
revoke all on function public.admin_resolve_actual_third_place_tie(uuid, uuid[], text)
  from public, anon, authenticated, service_role;
revoke all on function public.admin_clear_actual_third_place_tie(uuid, text)
  from public, anon, authenticated, service_role;

grant execute on function public.admin_actual_third_place_tie_status(uuid)
  to authenticated;
grant execute on function public.admin_actual_third_place_tie_revisions(uuid)
  to authenticated;
grant execute on function public.admin_resolve_actual_third_place_tie(uuid, uuid[], text)
  to authenticated;
grant execute on function public.admin_clear_actual_third_place_tie(uuid, text)
  to authenticated;

commit;
