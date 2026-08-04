-- ---------------------------------------------------------------------------
-- Contract 100 — REL-001: the Bonus Games rederive joins the tournament lock.
--
-- ADR 0025 decision 3. REL-001 ("score recomputation is not serialised") has
-- been Open on the risk register since 23 July 2026, and the 23 July live-
-- environment audit recorded it as "materially addressed locally; hosted
-- rollout remains open".
--
-- Reading the live schema shows why both of those were true at once, and why
-- the risk stayed real: the lock exists, on one of the two paths.
--
-- ---------------------------------------------------------------------------
-- WHAT WAS ACTUALLY UNSERIALISED
-- ---------------------------------------------------------------------------
--
-- `public.recompute_tournament_scores` already opens with
--
--     pg_advisory_xact_lock(hashtextextended(p_tournament_id::text, 0))
--
-- and it is the function everybody looks at, because it is the one that
-- delete-and-rederives `score_events`. That half was genuinely addressed.
--
-- But confirming a result fires TWO after-row triggers on `public.matches`:
--
--   recompute_bonus_scores_on_result -> trg_recompute_bonus_on_result
--        -> predictor_internal.recompute_ko_predictor_for_match   (deletes
--           bonus_score_events and re-inserts them)
--        -> predictor_internal.recompute_lms_for_tournament       (rewrites
--           entrant outcomes and writes audit rows)
--
--   recompute_scores_on_result       -> trg_recompute_on_result
--        -> public.recompute_tournament_scores                    (locks)
--
-- **PostgreSQL fires after-row triggers in name order**, and
-- `recompute_bonus_scores_on_result` sorts before `recompute_scores_on_result`.
-- So the Bonus Games delete-and-rederive runs FIRST, in full, holding no
-- tournament lock at all — and only afterwards does the Original rederive take
-- one. Two administrators confirming two different matches in the same
-- tournament concurrently could interleave inside the KO Predictor rederive:
-- one transaction's DELETE against the other's re-INSERT, with the winner
-- decided by timing.
--
-- Neither function took a lock, and neither is reachable except through that
-- trigger, so nothing in the existing evidence would have shown it. The lock
-- being present on the loudest path is precisely what made the quiet path easy
-- to overlook.
--
-- ---------------------------------------------------------------------------
-- THE FIX, AND WHERE IT GOES
-- ---------------------------------------------------------------------------
--
-- The same transaction-scoped advisory lock, on the same key expression, taken
-- INSIDE both `predictor_internal` functions rather than in the trigger that
-- calls them.
--
-- That placement is deliberate. Putting it in `trg_recompute_bonus_on_result`
-- would work today and would make the guarantee depend on trigger firing
-- order — the exact property that made this defect reachable in the first
-- place. A function that delete-and-rederives a tournament's derived rows
-- should hold the tournament lock because of what it does, not because of who
-- happened to call it.
--
-- Same key as `recompute_tournament_scores`, deliberately: one lock per
-- tournament, so the Bonus rederive and the Original rederive serialise
-- against EACH OTHER and not merely each against itself.
--
-- BLOCKING, not `try`. ADR 0025 is explicit: result confirmation and
-- correction are low-frequency administrator operations, and returning success
-- while silently skipping recomputation would be worse than briefly
-- serialising them. Neither function has a typed busy/retry outcome to report
-- into — both return void — so a try-lock could only be swallowed.
--
-- Transaction-scoped, so rollback releases it with no unlock path to forget.
-- No session-scoped lock is introduced anywhere; contract 88's narrowed
-- server-only lock exception is untouched.
--
-- ---------------------------------------------------------------------------
-- SCOPE
-- ---------------------------------------------------------------------------
--
-- Behaviour is otherwise unchanged: both bodies are the live definitions with
-- one statement added and nothing else edited. No scoring rule, elimination
-- rule, audit row or return value moves. This does not touch, and does not
-- depend on, the incremental-versus-full recomputation question deferred as
-- DEC-009 under ADR 0003 — REL-001 closes on correctness, independently of any
-- later performance decision.
--
-- A forward hazard worth recording where it will be found: both functions
-- resolve their competition with a bare `select ... into` on
-- `(tournament_id, game_key)`. ADR 0025 decision 1 removes the uniqueness that
-- makes that unambiguous, so both become arbitrary-row reads the moment a
-- competition can repeat. That is lifecycle work, not lock work, and it is
-- listed as a prerequisite of the LMS restart rather than fixed here.
-- ---------------------------------------------------------------------------

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
$function$

;

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

  select competition.id
    into v_competition_id
    from public.bonus_competitions competition
    where competition.tournament_id = p_tournament_id
      and competition.game_key = 'last_man_standing';

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

commit;
