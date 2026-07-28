-- Euro 2028 Predictor — secure other-player profile read
--
-- Contract 47. Adds one bounded, read-only profile RPC that preserves the
-- existing H2H privacy boundary: authenticated league co-members may see a safe
-- identity/entry summary before lock and the submitted profile detail after
-- lock. Overall standings do not become a public profile directory.

begin;

create or replace function public.get_player_profile(
  p_player_id uuid,
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
  v_lock_at timestamptz;
  v_locked boolean;
  v_display_name text;
  v_league_count integer := 0;
  v_entry_id uuid;
  v_has_entry boolean := false;
  v_total_points integer := 0;
  v_rank integer;
  v_base jsonb;
begin
  if v_uid is null then
    raise exception 'Authentication is required'
      using errcode = 'insufficient_privilege';
  end if;

  select tournament.lock_at
    into v_lock_at
    from public.tournaments tournament
    where tournament.id = p_tournament_id;

  if not found then
    raise exception 'Tournament not found'
      using errcode = 'no_data_found';
  end if;

  select profile.display_name
    into v_display_name
    from public.profiles profile
    where profile.id = p_player_id;

  if v_display_name is null then
    raise exception 'Player not found'
      using errcode = 'no_data_found';
  end if;

  if p_player_id <> v_uid and not exists (
    select 1
    from public.league_members caller_membership
    join public.leagues league
      on league.id = caller_membership.league_id
     and league.tournament_id = p_tournament_id
    join public.league_members player_membership
      on player_membership.league_id = caller_membership.league_id
     and player_membership.user_id = p_player_id
    where caller_membership.user_id = v_uid
  ) then
    raise exception 'You can only view profiles for players in your leagues'
      using errcode = 'insufficient_privilege';
  end if;

  select count(*)::integer
    into v_league_count
    from public.league_members membership
    join public.leagues league on league.id = membership.league_id
    where membership.user_id = p_player_id
      and league.tournament_id = p_tournament_id;

  select entry.id, entry.submitted_at is not null
    into v_entry_id, v_has_entry
    from public.entries entry
    where entry.user_id = p_player_id
      and entry.tournament_id = p_tournament_id;

  v_has_entry := coalesce(v_has_entry, false);
  v_locked := v_lock_at is not null and now() >= v_lock_at;

  v_base := jsonb_build_object(
    'player_id', p_player_id,
    'display_name', v_display_name,
    'league_count', v_league_count,
    'has_entry', v_has_entry,
    'locked', v_locked,
    'lock_at', v_lock_at
  );

  if not v_locked or not v_has_entry then
    return v_base;
  end if;

  select coalesce(total.total_points, 0)
    into v_total_points
    from public.entry_totals total
    where total.entry_id = v_entry_id;

  v_total_points := coalesce(v_total_points, 0);

  select ranked.rank
    into v_rank
    from (
      select
        entry.user_id,
        rank() over (
          order by coalesce(total.total_points, 0) desc
        )::integer as rank
      from public.entries entry
      left join public.entry_totals total on total.entry_id = entry.id
      where entry.tournament_id = p_tournament_id
        and entry.submitted_at is not null
    ) ranked
    where ranked.user_id = p_player_id;

  return v_base || jsonb_build_object(
    'total_points', v_total_points,
    'rank', v_rank,
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
          join public.matches match on match.id = prediction.match_id
          where prediction.entry_id = v_entry_id
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
          join public.teams team on team.id = progression.team_id
          where progression.entry_id = v_entry_id
            and team.tournament_id = p_tournament_id
          order by progression.team_id
          limit 24
        ) bounded
      ),
      '[]'::jsonb
    ),
    'score_events', coalesce(
      (
        select jsonb_agg(
          jsonb_build_object(
            'id', bounded.id,
            'category', bounded.category,
            'points', bounded.points,
            'joker', bounded.joker,
            'explanation', bounded.explanation
          )
          order by bounded.category, bounded.created_at, bounded.id
        )
        from (
          select
            event.id,
            event.category,
            event.points,
            event.joker,
            event.explanation,
            event.created_at
          from public.score_events event
          where event.entry_id = v_entry_id
          order by event.category, event.created_at, event.id
          limit 100
        ) bounded
      ),
      '[]'::jsonb
    )
  );
end;
$$;

revoke all on function public.get_player_profile(uuid, uuid)
  from public, anon, authenticated, service_role;
grant execute on function public.get_player_profile(uuid, uuid)
  to authenticated, service_role;

commit;
