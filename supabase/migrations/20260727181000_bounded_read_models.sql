begin;

-- Contract 42: keep every current browser RPC signature intact while placing an
-- explicit maximum on each user-facing collection. These values match the
-- intended operating caps for the Original Predictor: 250 users, 20 leagues per
-- user, 250 members in a league, 36 group matches and 24 tournament teams.

create or replace function public.get_leaderboard(p_tournament_id uuid)
returns table (
  display_name text,
  total_points integer,
  is_you boolean
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    profile.display_name,
    coalesce(total.total_points, 0) as total_points,
    (entry.user_id = (select auth.uid())) as is_you
  from public.entries entry
  join public.profiles profile
    on profile.id = entry.user_id
  left join public.entry_totals total
    on total.entry_id = entry.id
  where entry.tournament_id = p_tournament_id
    and entry.submitted_at is not null
  order by
    coalesce(total.total_points, 0) desc,
    profile.display_name,
    entry.id
  limit 250;
$$;

create or replace function public.get_my_leagues(p_tournament_id uuid)
returns table (
  id uuid,
  name text,
  invite_code text,
  member_count integer,
  is_owner boolean,
  owner_name text
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    league.id,
    league.name,
    league.invite_code,
    (
      select count(*)::integer
      from public.league_members member_count
      where member_count.league_id = league.id
    ),
    (league.owner_id = (select auth.uid())) as is_owner,
    (
      select owner_profile.display_name
      from public.profiles owner_profile
      where owner_profile.id = league.owner_id
    )
  from public.leagues league
  join public.league_members own_membership
    on own_membership.league_id = league.id
   and own_membership.user_id = (select auth.uid())
  where league.tournament_id = p_tournament_id
  order by league.created_at, league.id
  limit 20;
$$;

create or replace function public.get_league_members(p_league_id uuid)
returns table (
  user_id uuid,
  display_name text,
  total_points integer,
  is_you boolean,
  is_owner boolean,
  has_entry boolean,
  predicted_count integer,
  joined_at timestamptz
)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_tournament uuid;
begin
  if not exists (
    select 1
    from public.league_members membership
    where membership.league_id = p_league_id
      and membership.user_id = (select auth.uid())
  ) then
    raise exception 'Not a member of this league'
      using errcode = 'insufficient_privilege';
  end if;

  select league.tournament_id
    into v_tournament
    from public.leagues league
    where league.id = p_league_id;

  return query
    select
      membership.user_id,
      profile.display_name,
      coalesce(total.total_points, 0) as total_points,
      (membership.user_id = (select auth.uid())) as is_you,
      (membership.role = 'owner') as is_owner,
      (entry.submitted_at is not null) as has_entry,
      coalesce(
        (
          select count(*)::integer
          from public.match_predictions prediction
          where prediction.entry_id = entry.id
        ),
        0
      ) as predicted_count,
      membership.joined_at
    from public.league_members membership
    join public.profiles profile
      on profile.id = membership.user_id
    left join public.entries entry
      on entry.user_id = membership.user_id
     and entry.tournament_id = v_tournament
    left join public.entry_totals total
      on total.entry_id = entry.id
    where membership.league_id = p_league_id
    order by
      coalesce(total.total_points, 0) desc,
      profile.display_name,
      membership.user_id
    limit 250;
end;
$$;

create or replace function public.get_league_match_picks(
  p_league_id uuid,
  p_match_id uuid
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
  v_lock timestamptz;
  v_round text;
  v_home uuid;
  v_away uuid;
  v_locked boolean;
  v_total integer;
  v_predicted integer;
  v_picks jsonb := '[]'::jsonb;
begin
  if v_uid is null or not exists (
    select 1
    from public.league_members membership
    where membership.league_id = p_league_id
      and membership.user_id = v_uid
  ) then
    raise exception 'Not a member of this league'
      using errcode = 'insufficient_privilege';
  end if;

  select
    match.tournament_id,
    match.round,
    match.home_team_id,
    match.away_team_id
    into v_tournament, v_round, v_home, v_away
    from public.matches match
    where match.id = p_match_id;

  if v_tournament is null then
    raise exception 'Match not found'
      using errcode = 'no_data_found';
  end if;

  if not exists (
    select 1
    from public.leagues league
    where league.id = p_league_id
      and league.tournament_id = v_tournament
  ) then
    raise exception 'Not a member of this league'
      using errcode = 'insufficient_privilege';
  end if;

  select tournament.lock_at
    into v_lock
    from public.tournaments tournament
    where tournament.id = v_tournament;

  v_locked := v_lock is not null and now() >= v_lock;

  select count(*)::integer
    into v_total
    from public.league_members membership
    join public.entries entry
      on entry.user_id = membership.user_id
     and entry.tournament_id = v_tournament
     and entry.submitted_at is not null
    where membership.league_id = p_league_id;

  if v_round = 'group' then
    select count(*)::integer
      into v_predicted
      from public.league_members membership
      join public.entries entry
        on entry.user_id = membership.user_id
       and entry.tournament_id = v_tournament
       and entry.submitted_at is not null
      join public.match_predictions prediction
        on prediction.entry_id = entry.id
       and prediction.match_id = p_match_id
      where membership.league_id = p_league_id;

    if v_locked then
      select coalesce(
        jsonb_agg(
          jsonb_build_object(
            'display_name', bounded.display_name,
            'is_you', bounded.is_you,
            'home_score', bounded.home_score,
            'away_score', bounded.away_score,
            'joker', bounded.joker
          )
          order by bounded.display_name, bounded.user_id
        ),
        '[]'::jsonb
      )
        into v_picks
        from (
          select
            profile.display_name,
            membership.user_id,
            (membership.user_id = v_uid) as is_you,
            prediction.home_score,
            prediction.away_score,
            prediction.joker
          from public.league_members membership
          join public.entries entry
            on entry.user_id = membership.user_id
           and entry.tournament_id = v_tournament
           and entry.submitted_at is not null
          join public.profiles profile
            on profile.id = membership.user_id
          join public.match_predictions prediction
            on prediction.entry_id = entry.id
           and prediction.match_id = p_match_id
          where membership.league_id = p_league_id
          order by profile.display_name, membership.user_id
          limit 250
        ) bounded;
    end if;

    return jsonb_build_object(
      'kind', 'group',
      'locked', v_locked,
      'total_members', v_total,
      'predicted_count', v_predicted,
      'picks', v_picks
    );
  end if;

  v_predicted := v_total;

  if v_locked then
    select coalesce(
      jsonb_agg(
        jsonb_build_object(
          'display_name', bounded.display_name,
          'is_you', bounded.is_you,
          'home_stage', bounded.home_stage,
          'away_stage', bounded.away_stage
        )
        order by bounded.display_name, bounded.user_id
      ),
      '[]'::jsonb
    )
      into v_picks
      from (
        select
          profile.display_name,
          membership.user_id,
          (membership.user_id = v_uid) as is_you,
          (
            select progression.stage
            from public.predicted_progression progression
            where progression.entry_id = entry.id
              and progression.team_id = v_home
          ) as home_stage,
          (
            select progression.stage
            from public.predicted_progression progression
            where progression.entry_id = entry.id
              and progression.team_id = v_away
          ) as away_stage
        from public.league_members membership
        join public.entries entry
          on entry.user_id = membership.user_id
         and entry.tournament_id = v_tournament
         and entry.submitted_at is not null
        join public.profiles profile
          on profile.id = membership.user_id
        where membership.league_id = p_league_id
        order by profile.display_name, membership.user_id
        limit 250
      ) bounded;
  end if;

  return jsonb_build_object(
    'kind', 'knockout',
    'locked', v_locked,
    'total_members', v_total,
    'predicted_count', v_predicted,
    'home_team_id', v_home,
    'away_team_id', v_away,
    'picks', v_picks
  );
end;
$$;

create or replace function public.get_rival_entry(
  p_rival_id uuid,
  p_tournament_id uuid
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
  v_lock timestamptz;
  v_entry uuid;
  v_out jsonb;
begin
  select tournament.lock_at
    into v_lock
    from public.tournaments tournament
    where tournament.id = p_tournament_id;

  if v_lock is null or now() < v_lock then
    raise exception 'Other players'' predictions are hidden until entries lock'
      using errcode = 'insufficient_privilege';
  end if;

  if v_uid is null or not exists (
    select 1
    from public.league_members caller_membership
    join public.league_members rival_membership
      on rival_membership.league_id = caller_membership.league_id
    where caller_membership.user_id = v_uid
      and rival_membership.user_id = p_rival_id
  ) then
    raise exception 'You can only compare with players in your leagues'
      using errcode = 'insufficient_privilege';
  end if;

  select entry.id
    into v_entry
    from public.entries entry
    where entry.user_id = p_rival_id
      and entry.tournament_id = p_tournament_id
      and entry.submitted_at is not null;

  if v_entry is null then
    raise exception 'That player has not submitted an entry'
      using errcode = 'no_data_found';
  end if;

  select jsonb_build_object(
    'display_name', (
      select profile.display_name
      from public.profiles profile
      where profile.id = p_rival_id
    ),
    'total_points', coalesce(
      (
        select total.total_points
        from public.entry_totals total
        where total.entry_id = v_entry
      ),
      0
    ),
    'group_matches', coalesce(
      (
        select jsonb_agg(
          jsonb_build_object(
            'match_id', bounded.match_id,
            'home_score', bounded.home_score,
            'away_score', bounded.away_score,
            'joker', bounded.joker
          )
          order by bounded.match_ref, bounded.match_id
        )
        from (
          select
            prediction.match_id,
            prediction.home_score,
            prediction.away_score,
            prediction.joker,
            match.match_ref
          from public.match_predictions prediction
          join public.matches match
            on match.id = prediction.match_id
          where prediction.entry_id = v_entry
            and match.tournament_id = p_tournament_id
            and match.round = 'group'
          order by match.match_ref, prediction.match_id
          limit 36
        ) bounded
      ),
      '[]'::jsonb
    ),
    'progression', coalesce(
      (
        select jsonb_agg(
          jsonb_build_object(
            'team_id', bounded.team_id,
            'stage', bounded.stage
          )
          order by bounded.team_id
        )
        from (
          select progression.team_id, progression.stage
          from public.predicted_progression progression
          join public.teams team
            on team.id = progression.team_id
          where progression.entry_id = v_entry
            and team.tournament_id = p_tournament_id
          order by progression.team_id
          limit 24
        ) bounded
      ),
      '[]'::jsonb
    )
  ) into v_out;

  return v_out;
end;
$$;

revoke all on function public.get_leaderboard(uuid)
  from public, anon, authenticated, service_role;
revoke all on function public.get_my_leagues(uuid)
  from public, anon, authenticated, service_role;
revoke all on function public.get_league_members(uuid)
  from public, anon, authenticated, service_role;
revoke all on function public.get_league_match_picks(uuid, uuid)
  from public, anon, authenticated, service_role;
revoke all on function public.get_rival_entry(uuid, uuid)
  from public, anon, authenticated, service_role;

grant execute on function public.get_leaderboard(uuid)
  to authenticated, service_role;
grant execute on function public.get_my_leagues(uuid)
  to authenticated, service_role;
grant execute on function public.get_league_members(uuid)
  to authenticated, service_role;
grant execute on function public.get_league_match_picks(uuid, uuid)
  to authenticated, service_role;
grant execute on function public.get_rival_entry(uuid, uuid)
  to authenticated, service_role;

commit;
