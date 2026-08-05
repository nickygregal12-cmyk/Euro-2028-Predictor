-- Contract 104: every tournament+game caller resolves an explicit public instance.
--
-- Operational callers require the live public row. Read surfaces prefer that live
-- row but retain the latest terminal result when no successor exists, so final
-- standings and honours do not disappear. Direct-ID history remains direct.

begin;

-- Read surfaces need the current public run, not only a running one.
-- Prefer the live row; after a terminal finish with no successor, retain the
-- latest completed result so final standings, honours and entrant history do
-- not disappear. Once Contract 105 creates a successor, the live row wins.
create or replace function predictor_internal.current_public_competition_id(
  p_tournament_id uuid,
  p_game_key text
)
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(
    predictor_internal.live_competition_id(p_tournament_id, p_game_key),
    (
      select competition.id
      from public.bonus_competitions competition
      where competition.tournament_id = p_tournament_id
        and competition.game_key = p_game_key
        and competition.visibility_kind = 'public'
        and competition.completed_at is not null
      order by competition.completed_at desc,
               competition.series_sequence desc,
               competition.id desc
      limit 1
    )
  )
$$;

revoke all on function predictor_internal.current_public_competition_id(uuid, text)
  from public, anon, authenticated, service_role;

-- predictor_internal.enforce_season_matchweek_lock
create or replace function predictor_internal.enforce_season_matchweek_lock()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_round uuid;
  v_tournament uuid;
  v_buffer integer;
  v_earliest timestamptz;
  v_missing integer;
begin
  if tg_table_name = 'season_predictions' then
    select fixture.competition_round_id, fixture.tournament_id
      into v_round, v_tournament
      from public.season_fixtures fixture
     where fixture.id = new.season_fixture_id;
  else
    v_round := new.competition_round_id;
    v_tournament := new.tournament_id;
  end if;

  select definition.buffer_minutes into v_buffer
    from public.bonus_competitions availability
    join public.game_definitions definition on definition.game_key = availability.game_key
   where availability.tournament_id = v_tournament
     and availability.game_key = 'main_predictor'
     and availability.id = predictor_internal.live_competition_id(
       v_tournament, 'main_predictor'
     );

  if v_buffer is null then
    raise exception 'No Main Predictor availability for this season, so its lock cannot be resolved'
      using errcode = '23514';
  end if;

  select min(fixture.kickoff_at), count(*) filter (where fixture.kickoff_at is null)
    into v_earliest, v_missing
    from public.season_fixtures fixture
   where fixture.competition_round_id = v_round;

  if v_earliest is null or v_missing > 0 then
    raise exception 'This matchweek has unconfirmed kickoff times, so it is locked'
      using errcode = '55000';
  end if;

  if now() >= v_earliest - make_interval(mins => v_buffer) then
    raise exception 'This matchweek is locked'
      using errcode = '55000';
  end if;

  if tg_table_name = 'season_predictions' then
    new.updated_at := now();
  end if;

  return new;
end;
$$;

-- predictor_internal.prepare_competition_season_scope
create or replace function predictor_internal.prepare_competition_season_scope()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_tournament uuid;
begin
  case tg_table_name
    when 'group_teams' then
      select tournament_id into v_tournament
      from public.groups where id = new.group_id;
    when 'match_predictions' then
      select tournament_id into v_tournament
      from public.entries where id = new.entry_id;
    when 'predicted_group_positions' then
      select tournament_id into v_tournament
      from public.entries where id = new.entry_id;
    when 'predicted_progression' then
      select tournament_id into v_tournament
      from public.entries where id = new.entry_id;
    when 'predicted_tie_resolutions' then
      select tournament_id into v_tournament
      from public.entries where id = new.entry_id;
    when 'bonus_predictions' then
      select tournament_id into v_tournament
      from public.entries where id = new.entry_id;
    when 'score_events' then
      select tournament_id into v_tournament
      from public.entries where id = new.entry_id;
    when 'bonus_competition_entrants' then
      select tournament_id into v_tournament
      from public.bonus_competitions where id = new.competition_id;
    when 'bonus_competition_windows' then
      select tournament_id into v_tournament
      from public.bonus_competitions where id = new.competition_id;
    when 'bonus_window_fixtures' then
      select tournament_id into v_tournament
      from public.bonus_competition_windows where id = new.window_id;
    when 'bonus_knockout_predictions' then
      select tournament_id into v_tournament
      from public.matches where id = new.match_id;
      if new.competition_id is null and v_tournament is not null then
        select id into new.competition_id
        from public.bonus_competitions
        where tournament_id = v_tournament
          and game_key = 'ko_predictor'
          and id = predictor_internal.live_competition_id(
            v_tournament, 'ko_predictor'
          );
      end if;
    when 'bonus_lms_selections' then
      select tournament_id into v_tournament
      from public.bonus_competitions where id = new.competition_id;
    when 'bonus_score_events' then
      select tournament_id into v_tournament
      from public.bonus_competitions where id = new.competition_id;
    when 'bonus_competition_audit' then
      select tournament_id into v_tournament
      from public.bonus_competitions where id = new.competition_id;
    when 'bonus_cup_groups' then
      select tournament_id into v_tournament
      from public.bonus_competitions where id = new.competition_id;
    when 'bonus_cup_members' then
      select tournament_id into v_tournament
      from public.bonus_competitions where id = new.competition_id;
    when 'bonus_cup_fixtures' then
      select tournament_id into v_tournament
      from public.bonus_competitions where id = new.competition_id;
    when 'bonus_cup_penalty_numbers' then
      select tournament_id into v_tournament
      from public.bonus_competitions where id = new.competition_id;
    else
      raise exception 'Unsupported competition-season scope table %', tg_table_name;
  end case;

  if v_tournament is null then
    raise exception 'Competition-season scope parent is missing'
      using errcode = 'foreign_key_violation';
  end if;

  if new.tournament_id is not null
     and new.tournament_id <> v_tournament
  then
    raise exception 'Stored competition-season scope does not match its parent'
      using errcode = 'check_violation';
  end if;

  new.tournament_id := v_tournament;
  return new;
end;
$$;

-- predictor_internal.recompute_ko_predictor_for_match
CREATE OR REPLACE FUNCTION predictor_internal.recompute_ko_predictor_for_match(p_match_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_match public.matches%rowtype;
  v_competition_id uuid;
  v_window_id uuid;
begin
  select * into v_match from public.matches m where m.id = p_match_id;
  if not found then
    return;
  end if;

  -- REL-001. Taken as soon as the tournament is known and before anything is
  -- deleted. Same key expression as `public.recompute_tournament_scores`, so
  -- the Bonus Games rederive and the Original rederive serialise against each
  -- other rather than each against itself.
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(v_match.tournament_id::text, 0)
  );

  v_competition_id := predictor_internal.live_competition_id(
    v_match.tournament_id, 'ko_predictor'
  );

  if v_competition_id is null then
    return;
  end if;

  -- Delete-and-rederive, per competition and per match: corrections replace
  -- history rather than patching it, mirroring the Original recompute.
  delete from public.bonus_score_events event
    where event.competition_id = v_competition_id
      and event.match_id = p_match_id;

  if v_match.round = 'group' then
    return;
  end if;

  if v_match.result_state not in ('confirmed', 'corrected') then
    return;
  end if;

  if v_match.home_score_90 is null
    or v_match.away_score_90 is null
    or v_match.winner_team_id is null
    or v_match.kickoff_at is null then
    return;
  end if;

  select w.id
    into v_window_id
    from public.bonus_competition_windows w
    join public.bonus_window_fixtures f on f.window_id = w.id
    where w.competition_id = v_competition_id
      and f.match_id = p_match_id
    limit 1;

  insert into public.bonus_score_events (
    competition_id, user_id, window_id, match_id, category, points, explanation
  )
  select
    v_competition_id,
    scored.user_id,
    v_window_id,
    p_match_id,
    scored.category,
    scored.points,
    scored.explanation
  from (
    select
      prediction.user_id,
      event.category,
      event.points,
      event.explanation
    from public.bonus_knockout_predictions prediction
    join public.bonus_competition_entrants entrant
      on entrant.competition_id = v_competition_id
      and entrant.user_id = prediction.user_id
    cross join lateral (
      select
        case
          when prediction.home_score > prediction.away_score then v_match.home_team_id
          when prediction.away_score > prediction.home_score then v_match.away_team_id
          else prediction.advancing_team_id
        end as predicted_advancing
    ) derived
    cross join lateral (
      values
        (
          'exact_score',
          5,
          'Exact knockout scoreline',
          prediction.home_score = v_match.home_score_90
            and prediction.away_score = v_match.away_score_90
        ),
        (
          'correct_result',
          3,
          'Correct knockout result',
          not (
            prediction.home_score = v_match.home_score_90
              and prediction.away_score = v_match.away_score_90
          )
          and sign(prediction.home_score - prediction.away_score)
            = sign(v_match.home_score_90 - v_match.away_score_90)
        ),
        (
          'advancing_team',
          2,
          'Advancing team correct',
          derived.predicted_advancing = v_match.winner_team_id
        )
    ) as event(category, points, explanation, earned)
    where prediction.match_id = p_match_id
      -- Rolling entry: earlier rounds are unbanked for late joiners.
      and entrant.joined_at <= v_match.kickoff_at
      and event.earned
  ) scored;
end;
$function$

;

-- predictor_internal.recompute_lms_for_tournament
CREATE OR REPLACE FUNCTION predictor_internal.recompute_lms_for_tournament(p_tournament_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_competition_id uuid;
  v_alive uuid[];
  v_survivors uuid[];
  v_any_settled boolean := false;
  v_final_settled boolean := false;
  v_last_sequence integer;
  w record;
  v_changed integer := 0;
begin
  -- REL-001. The tournament is the parameter, so the lock is taken before any
  -- read: an early return costs nothing, because every caller of this function
  -- is already inside a statement that will take the same lock for the
  -- Original rederive a moment later.
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(p_tournament_id::text, 0)
  );

  v_competition_id := predictor_internal.live_competition_id(
    p_tournament_id, 'last_man_standing'
  );

  if v_competition_id is null then
    return;
  end if;

  select coalesce(array_agg(entrant.user_id), '{}')
    into v_alive
    from public.bonus_competition_entrants entrant
    where entrant.competition_id = v_competition_id;

  select max(win.sequence)
    into v_last_sequence
    from public.bonus_competition_windows win
    where win.competition_id = v_competition_id;

  for w in
    select win.id, win.sequence
    from public.bonus_competition_windows win
    where win.competition_id = v_competition_id
      -- A round settles only when it locked, every fixture is officially
      -- confirmed and any scheduled settle instant has passed.
      and win.locks_at is not null and now() >= win.locks_at
      and (win.settles_at is null or now() >= win.settles_at)
      and exists (
        select 1 from public.bonus_window_fixtures f where f.window_id = win.id
      )
      and not exists (
        select 1
        from public.bonus_window_fixtures f
        join public.matches m on m.id = f.match_id
        where f.window_id = win.id
          and m.result_state not in ('confirmed', 'corrected')
      )
    order by win.sequence
  loop
    v_any_settled := true;

    select coalesce(array_agg(candidate.user_id), '{}')
      into v_survivors
      from unnest(v_alive) as candidate(user_id)
      where exists (
        select 1
        from public.bonus_lms_selections sel
        join public.bonus_window_fixtures f on f.window_id = w.id
        join public.matches m
          on m.id = f.match_id
          and (m.home_team_id = sel.team_id or m.away_team_id = sel.team_id)
        where sel.competition_id = v_competition_id
          and sel.user_id = candidate.user_id
          and sel.window_id = w.id
          and (
            (m.round = 'group' and (
              (m.home_team_id = sel.team_id and m.home_score > m.away_score)
              or (m.away_team_id = sel.team_id and m.away_score > m.home_score)
            ))
            or (m.round <> 'group' and m.winner_team_id = sel.team_id)
          )
      );

    -- Whole-round wipeout voids the round: everyone still standing carries.
    if cardinality(v_survivors) = 0 and cardinality(v_alive) > 0 then
      v_survivors := v_alive;
    end if;

    v_alive := v_survivors;

    if w.sequence = v_last_sequence then
      v_final_settled := true;
    end if;
  end loop;

  update public.bonus_competition_entrants entrant
    set outcome = derived.outcome,
        updated_at = now()
    from (
      select
        e.user_id,
        case
          when not (e.user_id = any (v_alive)) then 'eliminated'
          when v_final_settled then 'champion'
          when v_any_settled then 'survived'
          else 'active'
        end as outcome
      from public.bonus_competition_entrants e
      where e.competition_id = v_competition_id
    ) derived
    where entrant.competition_id = v_competition_id
      and entrant.user_id = derived.user_id
      and entrant.outcome is distinct from derived.outcome;

  get diagnostics v_changed = row_count;

  if v_changed > 0 then
    insert into public.bonus_competition_audit (competition_id, action, detail)
    values (
      v_competition_id,
      'lms_resolved',
      jsonb_build_object(
        'outcomes_changed', v_changed,
        'remaining', cardinality(v_alive),
        'final_settled', v_final_settled
      )
    );
  end if;
end;
$function$

;

-- public.create_league
create or replace function public.create_league(
  p_tournament_id uuid,
  p_name text
)
returns table(id uuid, name text, invite_code text)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_game_id uuid;
begin
  select availability.id
    into v_game_id
    from public.bonus_competitions availability
    join public.game_definitions definition on definition.game_key = availability.game_key
    where availability.tournament_id = p_tournament_id
      and availability.id = predictor_internal.live_competition_id(
        p_tournament_id, availability.game_key
      )
      and definition.requires_prediction_entry
    order by case availability.game_key
      when 'main_predictor' then 1
      when 'original_predictor' then 2
      else 3
    end
    limit 1;

  if v_game_id is null then
    raise exception 'The season has no Main or Original Predictor'
      using errcode = 'no_data_found';
  end if;

  return query
    select * from public.create_game_league(v_game_id, p_name);
end;
$$;

-- public.get_bonus_games
create or replace function public.get_bonus_games(
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
begin
  if v_uid is null then
    raise exception 'Authentication is required'
      using errcode = 'insufficient_privilege';
  end if;

  if not exists (
    select 1 from public.tournaments tournament
    where tournament.id = p_tournament_id
  ) then
    raise exception 'Tournament not found'
      using errcode = 'no_data_found';
  end if;

  return jsonb_build_object(
    'server_now', now(),
    'competitions', coalesce(
      (
        select jsonb_agg(
          jsonb_build_object(
            'id', competition.id,
            'game_key', competition.game_key,
            'registration_opens_at', competition.registration_opens_at,
            'registration_closes_at', competition.registration_closes_at,
            'draw_required', competition.draw_required,
            'draw_completed_at', competition.draw_completed_at,
            'completed_at', competition.completed_at,
            'entrant', (
              select jsonb_build_object(
                'joined_at', entrant.joined_at,
                'outcome', entrant.outcome
              )
              from public.bonus_competition_entrants entrant
              where entrant.competition_id = competition.id
                and entrant.user_id = v_uid
            ),
            'windows', coalesce(
              (
                select jsonb_agg(
                  jsonb_build_object(
                    'id', bounded_window.id,
                    'sequence', bounded_window.sequence,
                    'label', bounded_window.label,
                    'opens_at', bounded_window.opens_at,
                    'locks_at', bounded_window.locks_at,
                    'settles_at', bounded_window.settles_at,
                    'requires_tie_break_input', bounded_window.requires_tie_break_input,
                    'fixtures', coalesce(
                      (
                        select jsonb_agg(
                          jsonb_build_object(
                            'kickoff_at', bounded_fixture.kickoff_at,
                            'result_state', bounded_fixture.result_state
                          )
                          order by
                            bounded_fixture.kickoff_at nulls last,
                            bounded_fixture.match_id
                        )
                        from (
                          select match.kickoff_at, match.result_state, match.id as match_id
                          from public.bonus_window_fixtures window_fixture
                          join public.matches match
                            on match.id = window_fixture.match_id
                          where window_fixture.window_id = bounded_window.id
                          order by match.kickoff_at nulls last, match.id
                          limit 16
                        ) bounded_fixture
                      ),
                      '[]'::jsonb
                    )
                  )
                  order by bounded_window.sequence
                )
                from (
                  select
                    competition_window.id,
                    competition_window.sequence,
                    competition_window.label,
                    competition_window.opens_at,
                    competition_window.locks_at,
                    competition_window.settles_at,
                    competition_window.requires_tie_break_input
                  from public.bonus_competition_windows competition_window
                  where competition_window.competition_id = competition.id
                  order by competition_window.sequence
                  limit 12
                ) bounded_window
              ),
              '[]'::jsonb
            )
          )
          order by competition.game_key
        )
        from (
          select *
          from public.bonus_competitions candidate
          where candidate.tournament_id = p_tournament_id
            and candidate.id = predictor_internal.current_public_competition_id(
              p_tournament_id, candidate.game_key
            )
            and candidate.published
          order by candidate.game_key
          limit 6
        ) competition
      ),
      '[]'::jsonb
    )
  );
end;
$$;

-- public.get_competition_games
create or replace function public.get_competition_games(
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
begin
  if v_uid is null then
    raise exception 'Authentication is required'
      using errcode = 'insufficient_privilege';
  end if;

  if not exists (select 1 from public.tournaments where id = p_tournament_id) then
    raise exception 'Competition season not found'
      using errcode = 'no_data_found';
  end if;

  return jsonb_build_object(
    'server_now', now(),
    'competition_member', exists (
      select 1
      from public.game_memberships membership
      where membership.tournament_id = p_tournament_id
        and membership.user_id = v_uid
        and membership.status = 'active'
    ),
    'games', coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'id', availability.id,
          'game_key', availability.game_key,
          'display_name', definition.display_name,
          'active', availability.availability_status = 'active',
          'registration_opens_at', availability.registration_opens_at,
          'registration_closes_at', availability.registration_closes_at,
          'completed_at', availability.completed_at,
          'lock_policy', jsonb_build_object(
            'scope', definition.lock_scope,
            'buffer_minutes', definition.buffer_minutes
          ),
          'allow_rejoin', definition.allow_rejoin,
          'membership', case when membership.id is null then null else
            jsonb_build_object(
              'id', membership.id,
              'status', membership.status,
              'joined_at', membership.joined_at,
              'active_since', membership.active_since,
              'left_at', membership.left_at,
              'disqualified_at', membership.disqualified_at,
              'rejoin_count', membership.rejoin_count
            ) end
        )
        order by availability.game_key
      )
      from public.bonus_competitions availability
      join public.game_definitions definition on definition.game_key = availability.game_key
      left join public.game_memberships membership
        on membership.game_competition_id = availability.id
       and membership.user_id = v_uid
      where availability.tournament_id = p_tournament_id
        and availability.id = predictor_internal.current_public_competition_id(
          p_tournament_id, availability.game_key
        )
    ), '[]'::jsonb)
  );
end;
$$;

-- public.get_ko_predictor_standings
create or replace function public.get_ko_predictor_standings(
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
  v_uid uuid := (select auth.uid());
  v_competition_id uuid;
  v_limit integer := least(greatest(coalesce(p_limit, 50), 1), 100);
  v_after_points integer;
  v_after_user uuid;
  v_rows jsonb;
  v_row_count integer;
  v_me jsonb;
begin
  if v_uid is null then
    raise exception 'Authentication is required'
      using errcode = 'insufficient_privilege';
  end if;

  select competition.id
    into v_competition_id
    from public.bonus_competitions competition
    where competition.tournament_id = p_tournament_id
      and competition.game_key = 'ko_predictor'
      and competition.id = predictor_internal.current_public_competition_id(
        p_tournament_id, 'ko_predictor'
      )
      and competition.published;

  if v_competition_id is null then
    raise exception 'The KO Predictor is not available for this tournament'
      using errcode = 'no_data_found';
  end if;

  if p_after is not null then
    begin
      v_after_points := split_part(p_after, ':', 1)::integer;
      v_after_user := split_part(p_after, ':', 2)::uuid;
    exception when others then
      raise exception 'Invalid standings cursor'
        using errcode = 'invalid_parameter_value';
    end;
  end if;

  with ranked as (
    select
      entrant.user_id,
      coalesce(profile.display_name, 'Player') as display_name,
      coalesce(totals.total_points, 0)::integer as total_points,
      coalesce(totals.exact_count, 0)::integer as exact_count,
      coalesce(totals.result_count, 0)::integer as result_count,
      coalesce(totals.through_count, 0)::integer as through_count,
      coalesce(totals.matches_scored, 0)::integer as matches_scored,
      rank() over (order by coalesce(totals.total_points, 0) desc)::integer as rank
    from public.bonus_competition_entrants entrant
    left join public.profiles profile on profile.id = entrant.user_id
    left join (
      select
        event.user_id,
        sum(event.points) as total_points,
        count(*) filter (where event.category = 'exact_score') as exact_count,
        count(*) filter (where event.category = 'correct_result') as result_count,
        count(*) filter (where event.category = 'advancing_team') as through_count,
        count(distinct event.match_id) as matches_scored
      from public.bonus_score_events event
      where event.competition_id = v_competition_id
      group by event.user_id
    ) totals on totals.user_id = entrant.user_id
    where entrant.competition_id = v_competition_id
  ),
  page as (
    select *
    from ranked candidate
    where v_after_points is null
      or candidate.total_points < v_after_points
      or (candidate.total_points = v_after_points and candidate.user_id > v_after_user)
    order by candidate.total_points desc, candidate.user_id
    limit v_limit
  )
  select
    coalesce(
      (
        select jsonb_agg(
          jsonb_build_object(
            'user_id', page.user_id,
            'display_name', page.display_name,
            'rank', page.rank,
            'total_points', page.total_points,
            'exact_count', page.exact_count,
            'result_count', page.result_count,
            'through_count', page.through_count,
            'matches_scored', page.matches_scored
          )
          order by page.total_points desc, page.user_id
        )
        from page
      ),
      '[]'::jsonb
    ),
    (select count(*)::integer from page),
    (
      select jsonb_build_object(
        'rank', me.rank,
        'total_points', me.total_points,
        'exact_count', me.exact_count,
        'result_count', me.result_count,
        'through_count', me.through_count,
        'matches_scored', me.matches_scored
      )
      from ranked me
      where me.user_id = v_uid
    )
    into v_rows, v_row_count, v_me;

  return jsonb_build_object(
    'server_now', now(),
    'competition_id', v_competition_id,
    'standings', v_rows,
    'me', v_me,
    'next_cursor', case
      when v_row_count < v_limit then null
      else (v_rows -> (v_row_count - 1) ->> 'total_points')
        || ':' || (v_rows -> (v_row_count - 1) ->> 'user_id')
    end
  );
end;
$$;

-- public.get_my_cup
CREATE OR REPLACE FUNCTION public.get_my_cup(p_tournament_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_uid uuid := (select auth.uid());
  v_competition public.bonus_competitions%rowtype;
  v_group_id uuid;
  v_is_entrant boolean;
begin
  if v_uid is null then
    raise exception 'Authentication is required'
      using errcode = 'insufficient_privilege';
  end if;

  select * into v_competition
    from public.bonus_competitions competition
    where competition.tournament_id = p_tournament_id
      and competition.game_key = 'predictor_cup'
      and competition.id = predictor_internal.current_public_competition_id(
        p_tournament_id, 'predictor_cup'
      )
      and competition.published;

  if not found then
    raise exception 'The Predictor Cup is not available for this tournament'
      using errcode = 'no_data_found';
  end if;

  select member.group_id into v_group_id
    from public.bonus_cup_members member
    where member.competition_id = v_competition.id
      and member.user_id = v_uid
      and member.phase_kind = 'initial';

  v_is_entrant := exists (
    select 1 from public.bonus_competition_entrants entrant
    where entrant.competition_id = v_competition.id
      and entrant.user_id = v_uid
  );

  return jsonb_build_object(
    'server_now', now(),
    'competition_id', v_competition.id,
    'registration_closes_at', v_competition.registration_closes_at,
    'draw_completed_at', v_competition.draw_completed_at,
    'completed_at', v_competition.completed_at,
    'entrant', (
      select jsonb_build_object(
        'joined_at', entrant.joined_at,
        'outcome', entrant.outcome
      )
      from public.bonus_competition_entrants entrant
      where entrant.competition_id = v_competition.id
        and entrant.user_id = v_uid
    ),
    'entrant_count', (
      select count(*)::integer
      from public.bonus_competition_entrants entrant
      where entrant.competition_id = v_competition.id
    ),
    'group_count', (
      select count(*)::integer
      from public.bonus_cup_groups grp
      where grp.competition_id = v_competition.id
    ),
    'my_member', case when v_group_id is null then null else (
      select jsonb_build_object(
        'draw_number', member.draw_number,
        'group_position', member.group_position,
        'qualified_as', member.qualified_as,
        'seed', member.seed
      )
      from public.bonus_cup_members member
      where member.competition_id = v_competition.id
        and member.user_id = v_uid
        and member.phase_kind = 'initial'
    ) end,
    'my_group', case when v_group_id is null then null else (
      select jsonb_build_object(
        'ordinal', grp.ordinal,
        'size', grp.size,
        'members', (
          select jsonb_agg(
            jsonb_build_object(
              'user_id', member.user_id,
              'display_name', coalesce(profile.display_name, 'Player'),
              'draw_number', member.draw_number
            )
            order by member.draw_number
          )
          from public.bonus_cup_members member
          left join public.profiles profile on profile.id = member.user_id
          where member.group_id = grp.id
        ),
        'standings', (
          with member_windows as (
            select
              member.user_id,
              member.draw_number,
              coalesce(profile.display_name, 'Player') as display_name,
              coalesce(sum(scores.points), 0)::integer as window_points,
              coalesce(sum(scores.exacts), 0)::integer as exacts,
              coalesce(sum(scores.corrects), 0)::integer as corrects,
              coalesce(sum(scores.scoreline_error), 0)::integer as scoreline_error
            from public.bonus_cup_members member
            left join public.profiles profile on profile.id = member.user_id
            left join public.bonus_competition_windows win
              on win.competition_id = v_competition.id
              and win.sequence between 1 and 3
            left join lateral (
              select * from predictor_internal.cup_window_scores(v_competition.id, win.id) s
              where s.user_id = member.user_id
            ) scores on true
            where member.group_id = v_group_id
            group by member.user_id, member.draw_number, profile.display_name
          ),
          settled_results as (
            select
              fixture.home_user_id,
              fixture.away_user_id,
              home_score.points as home_points,
              away_score.points as away_points,
              home_score.submitted as home_submitted,
              away_score.submitted as away_submitted
            from public.bonus_cup_fixtures fixture
            join lateral (
              select * from predictor_internal.cup_window_scores(v_competition.id, fixture.window_id) s
              where s.user_id = fixture.home_user_id
            ) home_score on true
            join lateral (
              select * from predictor_internal.cup_window_scores(v_competition.id, fixture.window_id) s
              where s.user_id = fixture.away_user_id
            ) away_score on true
            where fixture.group_id = v_group_id
              and predictor_internal.cup_window_settled(fixture.window_id)
          ),
          per_user as (
            select
              side.user_id,
              count(*)::integer as played,
              count(*) filter (where side.outcome = 'win')::integer as wins,
              count(*) filter (where side.outcome = 'draw')::integer as draws,
              count(*) filter (where side.outcome = 'loss')::integer as losses,
              coalesce(sum(side.points_for), 0)::integer as points_for,
              coalesce(sum(side.points_against), 0)::integer as points_against,
              coalesce(sum(side.table_points), 0)::integer as table_points
            from (
              select r.home_user_id as user_id,
                case
                  when r.home_submitted and not r.away_submitted then 'win'
                  when not r.home_submitted and r.away_submitted then 'loss'
                  when not r.home_submitted and not r.away_submitted then 'void'
                  when r.home_points > r.away_points then 'win'
                  when r.home_points < r.away_points then 'loss'
                  else 'draw'
                end as outcome,
                r.home_points as points_for,
                r.away_points as points_against,
                case
                  when r.home_submitted and not r.away_submitted then 3
                  when not r.home_submitted then 0
                  when r.home_points > r.away_points then 3
                  when r.home_points < r.away_points then 0
                  else 1
                end as table_points
              from settled_results r
              union all
              select r.away_user_id,
                case
                  when r.away_submitted and not r.home_submitted then 'win'
                  when not r.away_submitted and r.home_submitted then 'loss'
                  when not r.away_submitted and not r.home_submitted then 'void'
                  when r.away_points > r.home_points then 'win'
                  when r.away_points < r.home_points then 'loss'
                  else 'draw'
                end,
                r.away_points,
                r.home_points,
                case
                  when r.away_submitted and not r.home_submitted then 3
                  when not r.away_submitted then 0
                  when r.away_points > r.home_points then 3
                  when r.away_points < r.home_points then 0
                  else 1
                end
              from settled_results r
            ) side
            group by side.user_id
          )
          select jsonb_agg(
            jsonb_build_object(
              'user_id', ranked.user_id,
              'display_name', ranked.display_name,
              'played', ranked.played,
              'wins', ranked.wins,
              'draws', ranked.draws,
              'losses', ranked.losses,
              'points_for', ranked.points_for,
              'points_against', ranked.points_against,
              'table_points', ranked.table_points,
              'window_points', ranked.window_points,
              'position', ranked.position
            )
            order by ranked.position
          )
          from (
            select
              mw.user_id,
              mw.display_name,
              coalesce(pu.played, 0) as played,
              coalesce(pu.wins, 0) as wins,
              coalesce(pu.draws, 0) as draws,
              coalesce(pu.losses, 0) as losses,
              coalesce(pu.points_for, 0) as points_for,
              coalesce(pu.points_against, 0) as points_against,
              coalesce(pu.table_points, 0) as table_points,
              mw.window_points,
              row_number() over (
                order by
                  coalesce(pu.table_points, 0) desc,
                  mw.window_points desc,
                  mw.exacts desc,
                  mw.corrects desc,
                  coalesce(pu.points_for, 0) - coalesce(pu.points_against, 0) desc,
                  mw.scoreline_error asc,
                  mw.draw_number asc
              )::integer as position
            from member_windows mw
            left join per_user pu on pu.user_id = mw.user_id
          ) ranked
        )
      )
      from public.bonus_cup_groups grp
      where grp.id = v_group_id
    ) end,
    'my_fixtures', coalesce(
      (
        select jsonb_agg(
          jsonb_build_object(
            'fixture_id', fixture.id,
            'stage', fixture.stage,
            'matchday', fixture.matchday,
            'round_size', fixture.round_size,
            'bracket_slot', fixture.bracket_slot,
            'window_label', win.label,
            'window_opens_at', win.opens_at,
            'window_locks_at', win.locks_at,
            'opponent', jsonb_build_object(
              'user_id', opponent.user_id,
              'display_name', coalesce(opponent_profile.display_name, 'Player')
            ),
            'my_points', my_score.points,
            'opponent_points', opponent_score.points,
            'decided_by', fixture.decided_by,
            'status', case
              when fixture.winner_user_id is not null then 'settled'
              when fixture.stage <> 'group' then 'pending'
              when predictor_internal.cup_window_settled(fixture.window_id)
                then 'settled' else 'pending' end,
            'result', case
              when fixture.winner_user_id is not null then
                case when fixture.winner_user_id = v_uid then 'win' else 'loss' end
              when fixture.stage <> 'group' then null
              when not predictor_internal.cup_window_settled(fixture.window_id) then null
              when my_score.submitted and not opponent_score.submitted then 'walkover_win'
              when not my_score.submitted and opponent_score.submitted then 'walkover_loss'
              when not my_score.submitted and not opponent_score.submitted then 'void'
              when my_score.points > opponent_score.points then 'win'
              when my_score.points < opponent_score.points then 'loss'
              else 'draw'
            end
          )
          order by win.sequence, fixture.matchday nulls last, fixture.created_at
        )
        from public.bonus_cup_fixtures fixture
        join public.bonus_competition_windows win on win.id = fixture.window_id
        cross join lateral (
          select case when fixture.home_user_id = v_uid
            then fixture.away_user_id else fixture.home_user_id end as user_id
        ) opponent
        left join public.profiles opponent_profile
          on opponent_profile.id = opponent.user_id
        left join lateral (
          select * from predictor_internal.cup_window_scores(v_competition.id, fixture.window_id) s
          where s.user_id = v_uid
        ) my_score on true
        left join lateral (
          select * from predictor_internal.cup_window_scores(v_competition.id, fixture.window_id) s
          where s.user_id = opponent.user_id
        ) opponent_score on true
        where fixture.competition_id = v_competition.id
          and v_uid in (fixture.home_user_id, fixture.away_user_id)
      ),
      '[]'::jsonb
    ),
    'penalty_number', (
      select jsonb_build_object(
        'window_id', win.id,
        'window_label', win.label,
        'lane', case when fixture.home_user_id = v_uid then 'odd' else 'even' end,
        'value', pn.value,
        'version', pn.version,
        'locks_at', first_kickoff.at,
        'locked', first_kickoff.at is not null and now() >= first_kickoff.at
      )
      from public.bonus_cup_fixtures fixture
      join public.bonus_competition_windows win on win.id = fixture.window_id
      left join public.bonus_cup_penalty_numbers pn
        on pn.window_id = fixture.window_id and pn.user_id = v_uid
      left join lateral (
        select predictor_internal.cup_window_first_kickoff(fixture.window_id) as at
      ) first_kickoff on true
      where fixture.competition_id = v_competition.id
        and fixture.stage <> 'group'
        and fixture.winner_user_id is null
        and v_uid in (fixture.home_user_id, fixture.away_user_id)
      limit 1
    ),
    'bracket', case when not v_is_entrant then null else coalesce(
      (
        select jsonb_agg(
          jsonb_build_object(
            'stage', fixture.stage,
            'round_size', fixture.round_size,
            'bracket_slot', fixture.bracket_slot,
            'window_sequence', win.sequence,
            'window_label', win.label,
            'home', jsonb_build_object(
              'user_id', fixture.home_user_id,
              'display_name', coalesce(home_profile.display_name, 'Player')
            ),
            'away', jsonb_build_object(
              'user_id', fixture.away_user_id,
              'display_name', coalesce(away_profile.display_name, 'Player')
            ),
            'winner_user_id', fixture.winner_user_id,
            'decided_by', fixture.decided_by
          )
          order by win.sequence, fixture.bracket_slot
        )
        from public.bonus_cup_fixtures fixture
        join public.bonus_competition_windows win on win.id = fixture.window_id
        left join public.profiles home_profile
          on home_profile.id = fixture.home_user_id
        left join public.profiles away_profile
          on away_profile.id = fixture.away_user_id
        where fixture.competition_id = v_competition.id
          and fixture.stage <> 'group'
      ),
      '[]'::jsonb
    ) end,
    'champion', (
      select jsonb_build_object(
        'user_id', fixture.winner_user_id,
        'display_name', coalesce(profile.display_name, 'Player')
      )
      from public.bonus_cup_fixtures fixture
      left join public.profiles profile on profile.id = fixture.winner_user_id
      where fixture.competition_id = v_competition.id
        and fixture.stage = 'knockout'
        and fixture.round_size = 2
        and fixture.winner_user_id is not null
    ),
    'golden_predictor', case
      when not v_is_entrant or v_competition.draw_completed_at is null then null
      else (
        with totals as (
          select
            member.user_id,
            member.draw_number,
            coalesce(sum(scores.points), 0)::integer as points,
            coalesce(sum(scores.exacts), 0)::integer as exacts,
            coalesce(sum(scores.corrects), 0)::integer as corrects,
            coalesce(sum(scores.scoreline_error), 0)::integer as scoreline_error
          from public.bonus_cup_members member
          left join public.bonus_competition_windows win
            on win.competition_id = v_competition.id
          left join lateral (
            select * from predictor_internal.cup_window_scores(v_competition.id, win.id) s
            where s.user_id = member.user_id
          ) scores on true
          where member.competition_id = v_competition.id
          group by member.user_id, member.draw_number
        ),
        ranked as (
          select
            t.*,
            row_number() over (
              order by t.points desc, t.exacts desc, t.corrects desc,
                t.scoreline_error asc, t.draw_number asc
            )::integer as rank
          from totals t
        )
        select jsonb_build_object(
          'top', coalesce((
            select jsonb_agg(
              jsonb_build_object(
                'user_id', top_ranked.user_id,
                'display_name', coalesce(profile.display_name, 'Player'),
                'points', top_ranked.points,
                'rank', top_ranked.rank
              )
              order by top_ranked.rank
            )
            from (
              select * from ranked order by rank limit 20
            ) top_ranked
            left join public.profiles profile on profile.id = top_ranked.user_id
          ), '[]'::jsonb),
          'me', (
            select jsonb_build_object('points', r.points, 'rank', r.rank)
            from ranked r where r.user_id = v_uid
          )
        )
      )
    end
  );
end;
$function$;

-- public.get_my_lms
create or replace function public.get_my_lms(
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
  v_competition_id uuid;
begin
  if v_uid is null then
    raise exception 'Authentication is required'
      using errcode = 'insufficient_privilege';
  end if;

  select competition.id
    into v_competition_id
    from public.bonus_competitions competition
    where competition.tournament_id = p_tournament_id
      and competition.game_key = 'last_man_standing'
      and competition.id = predictor_internal.current_public_competition_id(
        p_tournament_id, 'last_man_standing'
      )
      and competition.published;

  if v_competition_id is null then
    raise exception 'Last Man Standing is not available for this tournament'
      using errcode = 'no_data_found';
  end if;

  return jsonb_build_object(
    'server_now', now(),
    'competition_id', v_competition_id,
    'entrant', (
      select jsonb_build_object(
        'joined_at', entrant.joined_at,
        'outcome', entrant.outcome
      )
      from public.bonus_competition_entrants entrant
      where entrant.competition_id = v_competition_id
        and entrant.user_id = v_uid
    ),
    'entrant_count', (
      select count(*)::integer
      from public.bonus_competition_entrants entrant
      where entrant.competition_id = v_competition_id
    ),
    'remaining_count', (
      select count(*)::integer
      from public.bonus_competition_entrants entrant
      where entrant.competition_id = v_competition_id
        and entrant.outcome <> 'eliminated'
    ),
    'used_team_ids', coalesce(
      (
        select jsonb_agg(sel.team_id order by sel.team_id)
        from public.bonus_lms_selections sel
        where sel.competition_id = v_competition_id
          and sel.user_id = v_uid
      ),
      '[]'::jsonb
    ),
    'windows', coalesce(
      (
        select jsonb_agg(
          jsonb_build_object(
            'id', bounded_window.id,
            'sequence', bounded_window.sequence,
            'label', bounded_window.label,
            'opens_at', bounded_window.opens_at,
            'locks_at', bounded_window.locks_at,
            'settles_at', bounded_window.settles_at,
            'my_selection', (
              select jsonb_build_object(
                'team_id', sel.team_id,
                'version', sel.version
              )
              from public.bonus_lms_selections sel
              where sel.competition_id = v_competition_id
                and sel.user_id = v_uid
                and sel.window_id = bounded_window.id
            ),
            'fixtures', coalesce(
              (
                select jsonb_agg(
                  jsonb_build_object(
                    'match_id', bounded_fixture.match_id,
                    'round', bounded_fixture.round,
                    'kickoff_at', bounded_fixture.kickoff_at,
                    'home_team_id', bounded_fixture.home_team_id,
                    'away_team_id', bounded_fixture.away_team_id,
                    'result_state', bounded_fixture.result_state,
                    'home_score', bounded_fixture.home_score,
                    'away_score', bounded_fixture.away_score,
                    'winner_team_id', bounded_fixture.winner_team_id
                  )
                  order by bounded_fixture.kickoff_at nulls last, bounded_fixture.match_id
                )
                from (
                  select
                    m.id as match_id, m.round, m.kickoff_at,
                    m.home_team_id, m.away_team_id,
                    m.result_state, m.home_score, m.away_score, m.winner_team_id
                  from public.bonus_window_fixtures f
                  join public.matches m on m.id = f.match_id
                  where f.window_id = bounded_window.id
                  order by m.kickoff_at nulls last, m.id
                  limit 16
                ) bounded_fixture
              ),
              '[]'::jsonb
            )
          )
          order by bounded_window.sequence
        )
        from (
          select w.id, w.sequence, w.label, w.opens_at, w.locks_at, w.settles_at
          from public.bonus_competition_windows w
          where w.competition_id = v_competition_id
          order by w.sequence
          limit 12
        ) bounded_window
      ),
      '[]'::jsonb
    )
  );
end;
$$;

commit;
