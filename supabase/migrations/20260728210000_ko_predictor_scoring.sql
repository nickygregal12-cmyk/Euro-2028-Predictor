-- Euro 2028 Predictor — KO Predictor scoring and standings
--
-- Contract 52 (ADR-0010, stage B5). The first bonus game becomes live scoring:
-- shared knockout predictions (contract 51) are scored under the decided KO
-- Predictor rules (competition-structure.md §4, 2026-07-22) into the game's
-- own bonus_score_events, never touching Original Predictor scoring.
--
-- Scoring per confirmed knockout match:
--   - Exact:  predicted regulation scoreline matches the 90-minute score → 5
--     (total — exact and result never stack);
--   - Result: predicted regulation outcome matches the 90-minute outcome → 3;
--   - Through: the predicted advancing team (explicit on a predicted draw,
--     implied by a decisive scoreline) matches the authoritative winner → +2,
--     stacking on exact or result, and paying alone on a wrong scoreline.
--   - Rolling entry: rounds before the entrant joined are unbanked — a match
--     scores only when the KO entry predates its kickoff.
--   - No jokers, ever (shared-store integrity).
--
-- Fan-out (ADR-0010 decision 5, architecture §9): recompute runs INSIDE the
-- single result operation — an AFTER UPDATE trigger on matches fires in the
-- same transaction and per-tournament advisory lock as write_match_result,
-- exactly as the Original Predictor recompute does. One result, one lock,
-- independent per-competition recompute. Nothing is scored from a
-- provisional state: only confirmed/corrected results produce events, and a
-- clear deletes them.

begin;

create or replace function predictor_internal.recompute_ko_predictor_for_match(
  p_match_id uuid
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_match public.matches%rowtype;
  v_competition_id uuid;
  v_window_id uuid;
begin
  select * into v_match from public.matches m where m.id = p_match_id;
  if not found then
    return;
  end if;

  select competition.id
    into v_competition_id
    from public.bonus_competitions competition
    where competition.tournament_id = v_match.tournament_id
      and competition.game_key = 'ko_predictor';

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
$$;

-- The bonus fan-out leg of the single result operation (§9): fires in the
-- same transaction, after the same advisory-locked write, on the same column
-- list as the Original Predictor recompute trigger.
create or replace function predictor_internal.trg_recompute_bonus_on_result()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform predictor_internal.recompute_ko_predictor_for_match(new.id);
  return new;
end;
$$;

drop trigger if exists recompute_bonus_scores_on_result on public.matches;
create trigger recompute_bonus_scores_on_result
  after update of
    home_team_id,
    away_team_id,
    result_state,
    result_method,
    home_score,
    away_score,
    home_score_90,
    away_score_90,
    home_score_120,
    away_score_120,
    home_penalties,
    away_penalties,
    winner_team_id
  on public.matches
  for each row
  execute function predictor_internal.trg_recompute_bonus_on_result();

-- ---------------------------------------------------------------------------
-- Global KO Predictor standings: bounded, server-ranked, keyset-paginated.
-- Every entrant appears (zero-point rows included); rank ties share a rank;
-- order is deterministic (points desc, user id asc). The decided launch scope
-- is the global leaderboard only — no invite-only KO competitions yet.
-- ---------------------------------------------------------------------------

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

revoke all on function predictor_internal.recompute_ko_predictor_for_match(uuid)
  from public, anon, authenticated, service_role;
revoke all on function predictor_internal.trg_recompute_bonus_on_result()
  from public, anon, authenticated, service_role;
revoke all on function public.get_ko_predictor_standings(uuid, integer, text)
  from public, anon, authenticated, service_role;

grant execute on function public.get_ko_predictor_standings(uuid, integer, text)
  to authenticated, service_role;

commit;
