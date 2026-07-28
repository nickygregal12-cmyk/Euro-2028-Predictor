-- Euro 2028 Predictor — Bonus Games hub read model and voluntary entry
--
-- Contract 50 (ADR-0010, stage B3 database slice). Adds the bounded read the
-- Games hub consumes and the voluntary registration/withdrawal writes. The
-- platform tables stay deny-all: these three RPCs are the only browser paths.
--
-- Boundaries preserved:
--   - unpublished competitions are invisible and unregistrable (same error as
--     not-found, so existence is not leaked);
--   - entry is voluntary and per-competition (competition-structure §1) — no
--     Original Predictor entry is required or touched;
--   - withdrawal never destroys scored history: it is refused once the
--     entrant holds any bonus score event;
--   - every registration and withdrawal appends an immutable audit entry.

begin;

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

create or replace function public.register_bonus_competition(
  p_competition_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
  v_competition public.bonus_competitions%rowtype;
  v_joined_at timestamptz;
begin
  if v_uid is null then
    raise exception 'Authentication is required'
      using errcode = 'insufficient_privilege';
  end if;

  select *
    into v_competition
    from public.bonus_competitions competition
    where competition.id = p_competition_id
    for update;

  -- An unpublished competition is indistinguishable from a missing one.
  if not found or not v_competition.published then
    raise exception 'Competition not found'
      using errcode = 'no_data_found';
  end if;

  if v_competition.completed_at is not null and now() >= v_competition.completed_at then
    raise exception 'This competition has finished'
      using errcode = '55000';
  end if;

  -- A null opening instant means the date is still provisional: not open.
  if v_competition.registration_opens_at is null
    or now() < v_competition.registration_opens_at then
    raise exception 'Registration has not opened'
      using errcode = '55000';
  end if;

  -- A null close means rolling entry (the KO Predictor's decided rule).
  if v_competition.registration_closes_at is not null
    and now() >= v_competition.registration_closes_at then
    raise exception 'Registration has closed'
      using errcode = '55000';
  end if;

  if exists (
    select 1
    from public.bonus_competition_entrants entrant
    where entrant.competition_id = p_competition_id
      and entrant.user_id = v_uid
  ) then
    raise exception 'You have already entered this competition'
      using errcode = 'unique_violation';
  end if;

  insert into public.bonus_competition_entrants (competition_id, user_id)
  values (p_competition_id, v_uid)
  returning joined_at into v_joined_at;

  insert into public.bonus_competition_audit (competition_id, action, detail, actor_id)
  values (
    p_competition_id,
    'entrant_registered',
    jsonb_build_object('user_id', v_uid),
    v_uid
  );

  return jsonb_build_object(
    'competition_id', p_competition_id,
    'joined_at', v_joined_at,
    'outcome', 'active'
  );
end;
$$;

create or replace function public.withdraw_bonus_competition(
  p_competition_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
  v_competition public.bonus_competitions%rowtype;
begin
  if v_uid is null then
    raise exception 'Authentication is required'
      using errcode = 'insufficient_privilege';
  end if;

  select *
    into v_competition
    from public.bonus_competitions competition
    where competition.id = p_competition_id
    for update;

  if not found or not v_competition.published then
    raise exception 'Competition not found'
      using errcode = 'no_data_found';
  end if;

  if not exists (
    select 1
    from public.bonus_competition_entrants entrant
    where entrant.competition_id = p_competition_id
      and entrant.user_id = v_uid
  ) then
    raise exception 'You have not entered this competition'
      using errcode = 'no_data_found';
  end if;

  if v_competition.completed_at is not null and now() >= v_competition.completed_at then
    raise exception 'This competition has finished'
      using errcode = '55000';
  end if;

  -- Scored history is standings-relevant and never silently destroyed.
  if exists (
    select 1
    from public.bonus_score_events event
    where event.competition_id = p_competition_id
      and event.user_id = v_uid
  ) then
    raise exception 'You cannot withdraw after scoring has started for you'
      using errcode = '55000';
  end if;

  delete from public.bonus_competition_entrants entrant
  where entrant.competition_id = p_competition_id
    and entrant.user_id = v_uid;

  insert into public.bonus_competition_audit (competition_id, action, detail, actor_id)
  values (
    p_competition_id,
    'entrant_withdrawn',
    jsonb_build_object('user_id', v_uid),
    v_uid
  );

  return jsonb_build_object(
    'competition_id', p_competition_id,
    'withdrawn', true
  );
end;
$$;

revoke all on function public.get_bonus_games(uuid)
  from public, anon, authenticated, service_role;
revoke all on function public.register_bonus_competition(uuid)
  from public, anon, authenticated, service_role;
revoke all on function public.withdraw_bonus_competition(uuid)
  from public, anon, authenticated, service_role;

grant execute on function public.get_bonus_games(uuid)
  to authenticated, service_role;
grant execute on function public.register_bonus_competition(uuid)
  to authenticated, service_role;
grant execute on function public.withdraw_bonus_competition(uuid)
  to authenticated, service_role;

commit;
