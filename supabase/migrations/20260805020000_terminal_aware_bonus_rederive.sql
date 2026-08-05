-- Contract 106: a corrected result still rederives after a competition ends.
--
-- DATA-009, found by the 5 August nightly run and confirmed here against the
-- committed SQL. Contract 104 moved every tournament+game lookup onto an
-- explicit resolver, which was right, but it gave the two Bonus Games rederive
-- functions the LIVE resolver:
--
--   predictor_internal.live_competition_id  -- ... and completed_at is null
--
-- Each then guards `if v_competition_id is null then return; end if;`, so once a
-- competition is completed a corrected result resolves nothing and the rederive
-- silently does nothing at all. Not an error, not a refusal — a no-op, which is
-- the worst shape for a scoring defect because nothing reports it.
--
-- The previous versions (contract 100) matched on `tournament_id` + `game_key`
-- with no completion condition, so this is a behavioural change contract 104
-- introduced rather than a gap it inherited.
--
-- ---------------------------------------------------------------------------
-- WHY REDERIVING IS THE ANSWER, RATHER THAN FREEZING
-- ---------------------------------------------------------------------------
--
-- The repository already decided this for the season path, and decided the
-- opposite way round from where contract 104 left the tournament path. Contract
-- 89's `settle_season_lms_competition` handles a correction that arrives after
-- completion by REOPENING the competition:
--
--   -- The conclusion is no longer terminal: a correction reopened the
--   -- competition. Un-complete it.
--   update public.bonus_competitions
--      set completed_at = null, updated_at = p_now
--    where id = p_competition_id and completed_at is not null;
--
-- A season Last Man Standing competition therefore cannot keep the wrong
-- champion after a result is restated, while the tournament KO Predictor and
-- Last Man Standing could. Two paths answering the same question differently is
-- the drift worth removing, and the season answer is the one with an authority
-- behind it.
--
-- ---------------------------------------------------------------------------
-- WHAT CHANGES, AND WHAT DELIBERATELY DOES NOT
-- ---------------------------------------------------------------------------
--
-- One call in each function: `live_competition_id` becomes
-- `current_public_competition_id`, which contract 104 already defines as the
-- live instance when one exists and otherwise the most recently completed
-- public instance. Nothing else in either body moves — same lock, same
-- delete-and-rederive, same scoring arithmetic, same rolling-entry rule.
--
-- This does NOT un-complete anything. Contract 89 reopens a season competition
-- because it owns that competition's lifecycle; these two functions are score
-- derivations and own no lifecycle, so they rederive the scores of the
-- competition the correction belongs to and leave `completed_at` alone. Whether
-- a restart-completed competition should also reopen is contract 107's
-- question, where the driver that writes `completed_at` lives.
--
-- Reachability today is nil and that is the point of doing it now: development
-- holds zero completed competitions, and nothing writes `completed_at` for a
-- tournament-kind `ko_predictor` or `last_man_standing` row. Contract 107 — the
-- Last Man Standing restart driver — is precisely the thing that starts writing
-- it, so this lands first rather than as a repair afterwards.

begin;

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

  v_competition_id := predictor_internal.current_public_competition_id(
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
$function$;

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

  v_competition_id := predictor_internal.current_public_competition_id(
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
$function$;

commit;
