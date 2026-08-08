-- Contract 133: let a season player discover and open the Predictor Championships
-- they are actually entitled to see.
--
-- Contract 120 exposed the caller's phase/table only AFTER a competition id was
-- already known. The season catalogue, correctly, resolves only the current
-- PUBLIC game instance, so an entrant in a private Championship had no bounded
-- browser path to discover that competition and no read that could name their
-- opponent or group fixtures. The private Cup tables remain revoked from the
-- browser; these two reads are the missing server-owned boundary.
--
-- Nothing here owns ranking, scoring, settlement or progression. The player
-- view reuses get_season_cup_phase for the authoritative phase/table,
-- cup_window_scores for per-window predictor totals and cup_window_settled for
-- settlement. A guessed private id by a non-member is deliberately
-- indistinguishable from a missing id.

begin;

create or replace function public.get_my_season_cup_instances(
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
  v_instances jsonb := '[]'::jsonb;
  v_comp record;
  v_entered boolean;
  v_group_id uuid;
  v_phase_kind text;
  v_group_ordinal integer;
  v_current jsonb;
begin
  if v_uid is null then
    raise exception 'Authentication is required' using errcode = '42501';
  end if;

  if p_tournament_id is null then
    raise exception 'Tournament is required' using errcode = '22023';
  end if;

  if not exists (
    select 1
    from public.tournaments tournament
    where tournament.id = p_tournament_id
      and tournament.kind = 'league_season'
  ) then
    raise exception 'Tournament is not a league season' using errcode = '22023';
  end if;

  for v_comp in
    select competition.*
    from public.bonus_competitions competition
    where competition.tournament_id = p_tournament_id
      and competition.game_key = 'predictor_cup'
      and (
        (
          competition.visibility_kind = 'public'
          and competition.id = predictor_internal.current_public_competition_id(
            p_tournament_id,
            'predictor_cup'
          )
        )
        or (
          competition.visibility_kind = 'private'
          and exists (
            select 1
            from public.bonus_competition_entrants entrant
            where entrant.competition_id = competition.id
              and entrant.user_id = v_uid
          )
        )
      )
    order by
      case when competition.visibility_kind = 'private' then 0 else 1 end,
      competition.series_sequence desc,
      competition.created_at desc,
      competition.id desc
  loop
    v_entered := exists (
      select 1
      from public.bonus_competition_entrants entrant
      where entrant.competition_id = v_comp.id
        and entrant.user_id = v_uid
    );

    v_group_id := null;
    v_phase_kind := null;
    v_group_ordinal := null;
    v_current := null;

    if v_entered then
      select member.group_id, member.phase_kind, cup_group.ordinal
        into v_group_id, v_phase_kind, v_group_ordinal
      from public.bonus_cup_members member
      join public.bonus_cup_groups cup_group on cup_group.id = member.group_id
      where member.competition_id = v_comp.id
        and member.user_id = v_uid
      order by
        case when member.phase_kind = 'split' then 0 else 1 end,
        cup_group.created_at desc,
        cup_group.id desc
      limit 1;
    end if;

    if v_group_id is not null then
      select jsonb_build_object(
        'fixture_id', fixture.fixture_id,
        'window_sequence', fixture.window_sequence,
        'window_label', fixture.window_label,
        'locks_at', fixture.locks_at,
        'matchday', fixture.matchday,
        'is_home', fixture.is_home,
        'opponent', jsonb_build_object(
          'user_id', fixture.opponent_id,
          'display_name', fixture.opponent_name
        ),
        'status', case when fixture.settled then 'settled' else 'pending' end,
        'my_points', fixture.my_points,
        'opponent_points', fixture.opponent_points,
        'result', fixture.result
      )
        into v_current
      from (
        select
          cup_fixture.id as fixture_id,
          cup_window.sequence as window_sequence,
          cup_window.label as window_label,
          cup_window.locks_at,
          cup_fixture.matchday,
          cup_fixture.home_user_id = v_uid as is_home,
          case
            when cup_fixture.home_user_id = v_uid then cup_fixture.away_user_id
            else cup_fixture.home_user_id
          end as opponent_id,
          coalesce(opponent_profile.display_name, 'Player') as opponent_name,
          predictor_internal.cup_window_settled(cup_fixture.window_id) as settled,
          me.points as my_points,
          opponent_score.points as opponent_points,
          case
            when not predictor_internal.cup_window_settled(cup_fixture.window_id) then null
            when me.submitted and not opponent_score.submitted then 'walkover_win'
            when not me.submitted and opponent_score.submitted then 'walkover_loss'
            when not me.submitted and not opponent_score.submitted then 'void'
            when me.points > opponent_score.points then 'win'
            when me.points < opponent_score.points then 'loss'
            else 'draw'
          end as result
        from public.bonus_cup_fixtures cup_fixture
        join public.bonus_competition_windows cup_window
          on cup_window.id = cup_fixture.window_id
        left join public.profiles opponent_profile
          on opponent_profile.id = case
            when cup_fixture.home_user_id = v_uid then cup_fixture.away_user_id
            else cup_fixture.home_user_id
          end
        left join lateral (
          select score.points, score.submitted
          from predictor_internal.cup_window_scores(v_comp.id, cup_fixture.window_id) score
          where score.user_id = v_uid
        ) me on true
        left join lateral (
          select score.points, score.submitted
          from predictor_internal.cup_window_scores(v_comp.id, cup_fixture.window_id) score
          where score.user_id = case
            when cup_fixture.home_user_id = v_uid then cup_fixture.away_user_id
            else cup_fixture.home_user_id
          end
        ) opponent_score on true
        where cup_fixture.competition_id = v_comp.id
          and cup_fixture.group_id = v_group_id
          and v_uid in (cup_fixture.home_user_id, cup_fixture.away_user_id)
        order by
          case
            when predictor_internal.cup_window_settled(cup_fixture.window_id) then 1
            else 0
          end,
          case
            when not predictor_internal.cup_window_settled(cup_fixture.window_id)
              then cup_window.sequence
          end asc,
          case
            when predictor_internal.cup_window_settled(cup_fixture.window_id)
              then cup_window.sequence
          end desc,
          cup_fixture.created_at,
          cup_fixture.id
        limit 1
      ) fixture;
    end if;

    v_instances := v_instances || jsonb_build_array(
      jsonb_build_object(
        'competition_id', v_comp.id,
        'visibility_kind', v_comp.visibility_kind,
        'availability_status', v_comp.availability_status,
        'entered', v_entered,
        'entrant_count', (
          select count(*)::integer
          from public.bonus_competition_entrants entrant
          where entrant.competition_id = v_comp.id
        ),
        'completed_at', v_comp.completed_at,
        'registration_closes_at', v_comp.registration_closes_at,
        'phase_kind', v_phase_kind,
        'group_ordinal', v_group_ordinal,
        'current_fixture', v_current
      )
    );
  end loop;

  return jsonb_build_object(
    'tournament_id', p_tournament_id,
    'server_now', now(),
    'instances', v_instances
  );
end;
$$;

create or replace function public.get_season_cup_player_view(
  p_competition_id uuid
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
  v_comp record;
  v_is_entrant boolean;
  v_phase jsonb;
  v_group_id uuid;
  v_members jsonb;
  v_fixtures jsonb;
begin
  if v_uid is null then
    raise exception 'Authentication is required' using errcode = '42501';
  end if;

  if p_competition_id is null then
    raise exception 'Competition is required' using errcode = '22023';
  end if;

  select competition.*
    into v_comp
  from public.bonus_competitions competition
  join public.tournaments tournament on tournament.id = competition.tournament_id
  where competition.id = p_competition_id
    and competition.game_key = 'predictor_cup'
    and tournament.kind = 'league_season';

  if not found then
    return jsonb_build_object(
      'competition_id', p_competition_id,
      'entered', false
    );
  end if;

  v_is_entrant := exists (
    select 1
    from public.bonus_competition_entrants entrant
    where entrant.competition_id = p_competition_id
      and entrant.user_id = v_uid
  );

  -- Deliberately the same response as an unknown id. A private UUID is not an
  -- existence oracle for a caller who is not already a member.
  if not v_is_entrant then
    return jsonb_build_object(
      'competition_id', p_competition_id,
      'entered', false
    );
  end if;

  v_phase := public.get_season_cup_phase(p_competition_id);

  if coalesce((v_phase ->> 'entered')::boolean, false) = false then
    return jsonb_build_object(
      'competition_id', p_competition_id,
      'entered', true,
      'phase_ready', false,
      'visibility_kind', v_comp.visibility_kind,
      'availability_status', v_comp.availability_status
    );
  end if;

  v_group_id := (v_phase #>> '{group,id}')::uuid;

  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'user_id', member.user_id,
        'display_name', coalesce(profile.display_name, 'Player'),
        'is_you', member.user_id = v_uid
      )
      order by member.draw_number, member.user_id
    ),
    '[]'::jsonb
  )
    into v_members
  from public.bonus_cup_members member
  left join public.profiles profile on profile.id = member.user_id
  where member.competition_id = p_competition_id
    and member.group_id = v_group_id;

  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'fixture_id', fixture.fixture_id,
        'window_sequence', fixture.window_sequence,
        'window_label', fixture.window_label,
        'opens_at', fixture.opens_at,
        'locks_at', fixture.locks_at,
        'matchday', fixture.matchday,
        'home', jsonb_build_object(
          'user_id', fixture.home_user_id,
          'display_name', fixture.home_name
        ),
        'away', jsonb_build_object(
          'user_id', fixture.away_user_id,
          'display_name', fixture.away_name
        ),
        'is_my_fixture', fixture.is_my_fixture,
        'is_home', fixture.is_home,
        'status', case when fixture.settled then 'settled' else 'pending' end,
        'home_points', fixture.home_points,
        'away_points', fixture.away_points,
        'result', fixture.result
      )
      order by fixture.window_sequence, fixture.matchday nulls last, fixture.fixture_id
    ),
    '[]'::jsonb
  )
    into v_fixtures
  from (
    select
      cup_fixture.id as fixture_id,
      cup_window.sequence as window_sequence,
      cup_window.label as window_label,
      cup_window.opens_at,
      cup_window.locks_at,
      cup_fixture.matchday,
      cup_fixture.home_user_id,
      cup_fixture.away_user_id,
      coalesce(home_profile.display_name, 'Player') as home_name,
      coalesce(away_profile.display_name, 'Player') as away_name,
      v_uid in (cup_fixture.home_user_id, cup_fixture.away_user_id) as is_my_fixture,
      cup_fixture.home_user_id = v_uid as is_home,
      predictor_internal.cup_window_settled(cup_fixture.window_id) as settled,
      home_score.points as home_points,
      away_score.points as away_points,
      case
        when v_uid not in (cup_fixture.home_user_id, cup_fixture.away_user_id) then null
        when not predictor_internal.cup_window_settled(cup_fixture.window_id) then null
        when cup_fixture.home_user_id = v_uid
             and home_score.submitted and not away_score.submitted then 'walkover_win'
        when cup_fixture.home_user_id = v_uid
             and not home_score.submitted and away_score.submitted then 'walkover_loss'
        when cup_fixture.away_user_id = v_uid
             and away_score.submitted and not home_score.submitted then 'walkover_win'
        when cup_fixture.away_user_id = v_uid
             and not away_score.submitted and home_score.submitted then 'walkover_loss'
        when not home_score.submitted and not away_score.submitted then 'void'
        when cup_fixture.home_user_id = v_uid and home_score.points > away_score.points then 'win'
        when cup_fixture.home_user_id = v_uid and home_score.points < away_score.points then 'loss'
        when cup_fixture.away_user_id = v_uid and away_score.points > home_score.points then 'win'
        when cup_fixture.away_user_id = v_uid and away_score.points < home_score.points then 'loss'
        else 'draw'
      end as result
    from public.bonus_cup_fixtures cup_fixture
    join public.bonus_competition_windows cup_window
      on cup_window.id = cup_fixture.window_id
    left join public.profiles home_profile on home_profile.id = cup_fixture.home_user_id
    left join public.profiles away_profile on away_profile.id = cup_fixture.away_user_id
    left join lateral (
      select score.points, score.submitted
      from predictor_internal.cup_window_scores(p_competition_id, cup_fixture.window_id) score
      where score.user_id = cup_fixture.home_user_id
    ) home_score on true
    left join lateral (
      select score.points, score.submitted
      from predictor_internal.cup_window_scores(p_competition_id, cup_fixture.window_id) score
      where score.user_id = cup_fixture.away_user_id
    ) away_score on true
    where cup_fixture.competition_id = p_competition_id
      and cup_fixture.group_id = v_group_id
  ) fixture;

  return jsonb_build_object(
    'competition_id', p_competition_id,
    'entered', true,
    'phase_ready', true,
    'visibility_kind', v_comp.visibility_kind,
    'availability_status', v_comp.availability_status,
    'phase_kind', v_phase ->> 'phase_kind',
    'group', v_phase -> 'group',
    'members', v_members,
    'table', v_phase -> 'table',
    'fixtures', v_fixtures
  );
end;
$$;

revoke all on function public.get_my_season_cup_instances(uuid)
  from public, anon, authenticated, service_role;
revoke all on function public.get_season_cup_player_view(uuid)
  from public, anon, authenticated, service_role;

grant execute on function public.get_my_season_cup_instances(uuid)
  to authenticated;
grant execute on function public.get_season_cup_player_view(uuid)
  to authenticated;

commit;
