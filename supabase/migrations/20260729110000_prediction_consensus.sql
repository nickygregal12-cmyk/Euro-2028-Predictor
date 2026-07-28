-- Euro 2028 Predictor — post-lock prediction consensus
--
-- Contract 59. One bounded, authenticated, post-lock aggregate read for the
-- Original Predictor. The browser never scans entry tables. Only frozen,
-- submitted entries contribute; Bonus Games remain entirely separate.

begin;

create or replace function public.get_prediction_consensus(
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
  v_result jsonb;
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

  if v_lock_at is null then
    raise exception 'Tournament lock is not configured'
      using errcode = 'check_violation';
  end if;

  if now() < v_lock_at then
    raise exception 'Prediction consensus is hidden until entries lock'
      using errcode = 'check_violation';
  end if;

  with submitted_entries as (
    select entry.id, entry.user_id
    from public.entries entry
    where entry.tournament_id = p_tournament_id
      and entry.submitted_at is not null
  ),
  caller_entry as (
    select entry.id
    from submitted_entries entry
    where entry.user_id = v_uid
    limit 1
  ),
  champion_counts as (
    select progression.team_id, team.name as team_name, count(*)::integer as picks
    from public.predicted_progression progression
    join submitted_entries entry on entry.id = progression.entry_id
    join public.teams team on team.id = progression.team_id
    where progression.stage = 'champion'
    group by progression.team_id, team.name
  ),
  champion_top as (
    select *
    from champion_counts
    order by picks desc, team_name, team_id
    limit 10
  ),
  entry_finals as (
    select
      progression.entry_id,
      array_agg(progression.team_id order by progression.team_id) as finalists
    from public.predicted_progression progression
    join submitted_entries entry on entry.id = progression.entry_id
    where progression.stage in ('final', 'champion')
    group by progression.entry_id
    having count(*) = 2
  ),
  final_counts as (
    select
      final.finalists[1] as team_a_id,
      final.finalists[2] as team_b_id,
      team_a.name as team_a_name,
      team_b.name as team_b_name,
      count(*)::integer as picks
    from entry_finals final
    join public.teams team_a on team_a.id = final.finalists[1]
    join public.teams team_b on team_b.id = final.finalists[2]
    group by
      final.finalists[1], final.finalists[2], team_a.name, team_b.name
  ),
  final_top as (
    select *
    from final_counts
    order by picks desc, team_a_name, team_b_name, team_a_id, team_b_id
    limit 10
  ),
  boot_counts as (
    select
      bonus.golden_boot_player_id as player_id,
      player.name as player_name,
      player.team_id,
      count(*)::integer as picks
    from public.bonus_predictions bonus
    join submitted_entries entry on entry.id = bonus.entry_id
    join public.players player on player.id = bonus.golden_boot_player_id
    where bonus.golden_boot_player_id is not null
    group by bonus.golden_boot_player_id, player.name, player.team_id
  ),
  boot_top as (
    select *
    from boot_counts
    order by picks desc, player_name, player_id
    limit 10
  ),
  outcome_counts as (
    select
      match.id as match_id,
      match.match_ref,
      match.home_team_id,
      match.away_team_id,
      count(*)::integer as predictions,
      count(*) filter (
        where prediction.home_score > prediction.away_score
      )::integer as home_picks,
      count(*) filter (
        where prediction.home_score = prediction.away_score
      )::integer as draw_picks,
      count(*) filter (
        where prediction.home_score < prediction.away_score
      )::integer as away_picks
    from public.matches match
    join public.match_predictions prediction on prediction.match_id = match.id
    join submitted_entries entry on entry.id = prediction.entry_id
    where match.tournament_id = p_tournament_id
      and match.round = 'group'
    group by
      match.id, match.match_ref, match.home_team_id, match.away_team_id
  ),
  outcome_ranked as (
    select
      counts.*,
      greatest(home_picks, draw_picks, away_picks) as top_picks,
      predictions
        - greatest(home_picks, draw_picks, away_picks)
        - least(home_picks, draw_picks, away_picks) as second_picks,
      case
        when home_picks >= draw_picks and home_picks >= away_picks then 'home'
        when draw_picks >= away_picks then 'draw'
        else 'away'
      end as dominant_outcome
    from outcome_counts counts
    where predictions > 0
  ),
  most_agreed as (
    select *
    from outcome_ranked
    order by
      top_picks::numeric / predictions desc,
      predictions desc,
      match_ref,
      match_id
    limit 1
  ),
  most_divided as (
    select *
    from outcome_ranked
    where predictions >= 2
    order by
      top_picks - second_picks asc,
      predictions desc,
      match_ref,
      match_id
    limit 1
  ),
  predicted_winners as (
    select
      case
        when prediction.home_score > prediction.away_score then match.home_team_id
        when prediction.home_score < prediction.away_score then match.away_team_id
        else null
      end as team_id
    from public.match_predictions prediction
    join submitted_entries entry on entry.id = prediction.entry_id
    join public.matches match on match.id = prediction.match_id
    where match.tournament_id = p_tournament_id
      and match.round = 'group'
  ),
  trusted_counts as (
    select winner.team_id, team.name as team_name, count(*)::integer as predicted_wins
    from predicted_winners winner
    join public.teams team on team.id = winner.team_id
    where winner.team_id is not null
    group by winner.team_id, team.name
  ),
  most_trusted as (
    select *
    from trusted_counts
    order by predicted_wins desc, team_name, team_id
    limit 1
  ),
  goal_totals as (
    select
      entry.id as entry_id,
      sum(prediction.home_score + prediction.away_score)::integer as total_goals
    from submitted_entries entry
    join public.match_predictions prediction on prediction.entry_id = entry.id
    join public.matches match on match.id = prediction.match_id
    where match.tournament_id = p_tournament_id
      and match.round = 'group'
    group by entry.id
  ),
  goal_stats as (
    select
      min(total_goals)::integer as minimum,
      percentile_disc(0.5) within group (order by total_goals)::integer as median,
      max(total_goals)::integer as maximum,
      round(avg(total_goals)::numeric, 1) as average,
      count(distinct total_goals)::integer as distinct_totals
    from goal_totals
  ),
  goal_distribution as (
    select total_goals, count(*)::integer as entries
    from goal_totals
    group by total_goals
    order by total_goals
    limit 40
  ),
  caller_champion as (
    select progression.team_id
    from public.predicted_progression progression
    join caller_entry caller on caller.id = progression.entry_id
    where progression.stage = 'champion'
    limit 1
  ),
  caller_final as (
    select final.finalists
    from entry_finals final
    join caller_entry caller on caller.id = final.entry_id
  ),
  caller_boot as (
    select bonus.golden_boot_player_id as player_id
    from public.bonus_predictions bonus
    join caller_entry caller on caller.id = bonus.entry_id
    where bonus.golden_boot_player_id is not null
    limit 1
  ),
  unique_exact_scores as (
    select
      match.id as match_id,
      match.match_ref,
      prediction.home_score,
      prediction.away_score
    from caller_entry caller
    join public.match_predictions prediction on prediction.entry_id = caller.id
    join public.matches match on match.id = prediction.match_id
    where match.tournament_id = p_tournament_id
      and match.round = 'group'
      and 1 = (
        select count(*)
        from public.match_predictions peer_prediction
        join submitted_entries peer_entry on peer_entry.id = peer_prediction.entry_id
        where peer_prediction.match_id = prediction.match_id
          and peer_prediction.home_score = prediction.home_score
          and peer_prediction.away_score = prediction.away_score
      )
    order by match.match_ref, match.id
    limit 3
  ),
  only_you_rows as (
    select 1 as priority, jsonb_build_object(
      'kind', 'champion',
      'team_id', caller.team_id
    ) as item
    from caller_champion caller
    join champion_counts counts on counts.team_id = caller.team_id
    where counts.picks = 1

    union all

    select 2, jsonb_build_object(
      'kind', 'final',
      'team_a_id', caller.finalists[1],
      'team_b_id', caller.finalists[2]
    )
    from caller_final caller
    join final_counts counts
      on counts.team_a_id = caller.finalists[1]
      and counts.team_b_id = caller.finalists[2]
    where counts.picks = 1

    union all

    select 3, jsonb_build_object(
      'kind', 'golden_boot',
      'player_id', caller.player_id
    )
    from caller_boot caller
    join boot_counts counts on counts.player_id = caller.player_id
    where counts.picks = 1

    union all

    select 4, jsonb_build_object(
      'kind', 'exact_score',
      'match_id', score.match_id,
      'match_ref', score.match_ref,
      'home_score', score.home_score,
      'away_score', score.away_score
    )
    from unique_exact_scores score
  ),
  bounded_only_you as (
    select item
    from only_you_rows
    order by priority, item::text
    limit 6
  )
  select jsonb_build_object(
    'server_now', now(),
    'locked_at', v_lock_at,
    'submitted_entries', (select count(*)::integer from submitted_entries),
    'champion_race', coalesce((
      select jsonb_agg(jsonb_build_object(
        'team_id', champion.team_id,
        'picks', champion.picks
      ) order by champion.picks desc, champion.team_name, champion.team_id)
      from champion_top champion
    ), '[]'::jsonb),
    'peoples_final', coalesce((
      select jsonb_agg(jsonb_build_object(
        'team_a_id', final.team_a_id,
        'team_b_id', final.team_b_id,
        'picks', final.picks
      ) order by final.picks desc, final.team_a_name, final.team_b_name,
        final.team_a_id, final.team_b_id)
      from final_top final
    ), '[]'::jsonb),
    'golden_boot', coalesce((
      select jsonb_agg(jsonb_build_object(
        'player_id', boot.player_id,
        'team_id', boot.team_id,
        'picks', boot.picks
      ) order by boot.picks desc, boot.player_name, boot.player_id)
      from boot_top boot
    ), '[]'::jsonb),
    'most_agreed_match', (
      select jsonb_build_object(
        'match_id', signal.match_id,
        'match_ref', signal.match_ref,
        'home_team_id', signal.home_team_id,
        'away_team_id', signal.away_team_id,
        'predictions', signal.predictions,
        'home_picks', signal.home_picks,
        'draw_picks', signal.draw_picks,
        'away_picks', signal.away_picks,
        'dominant_outcome', signal.dominant_outcome,
        'dominant_picks', signal.top_picks
      )
      from most_agreed signal
    ),
    'most_divided_match', (
      select jsonb_build_object(
        'match_id', signal.match_id,
        'match_ref', signal.match_ref,
        'home_team_id', signal.home_team_id,
        'away_team_id', signal.away_team_id,
        'predictions', signal.predictions,
        'home_picks', signal.home_picks,
        'draw_picks', signal.draw_picks,
        'away_picks', signal.away_picks,
        'top_two_gap', signal.top_picks - signal.second_picks
      )
      from most_divided signal
    ),
    'most_trusted_team', (
      select jsonb_build_object(
        'team_id', trusted.team_id,
        'predicted_wins', trusted.predicted_wins
      )
      from most_trusted trusted
    ),
    'goals_spread', jsonb_build_object(
      'minimum', (select stats.minimum from goal_stats stats),
      'median', (select stats.median from goal_stats stats),
      'maximum', (select stats.maximum from goal_stats stats),
      'average', (select stats.average from goal_stats stats),
      'distinct_totals', (select stats.distinct_totals from goal_stats stats),
      'distribution', coalesce((
        select jsonb_agg(jsonb_build_object(
          'total_goals', distribution.total_goals,
          'entries', distribution.entries
        ) order by distribution.total_goals)
        from goal_distribution distribution
      ), '[]'::jsonb)
    ),
    'only_you', coalesce((
      select jsonb_agg(unique_pick.item)
      from bounded_only_you unique_pick
    ), '[]'::jsonb)
  ) into v_result;

  return v_result;
end;
$$;

revoke all on function public.get_prediction_consensus(uuid)
  from public, anon, authenticated, service_role;
grant execute on function public.get_prediction_consensus(uuid)
  to authenticated, service_role;

commit;
