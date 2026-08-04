-- Contract 89: settle a season Last Man Standing competition from results.
--
-- The last of the three steps. Contract 86 made a season pick storable, 87 made
-- the mandatory used-list reset storable, 88 wrote the pick an entrant missed.
-- Nothing yet turns a RESULT into who is still standing. This does, and it is
-- the first thing in the season game that writes `season_lms_entrant_state`.
--
-- ---------------------------------------------------------------------------
-- IT REPLAYS. IT DOES NOT SPEND.
-- ---------------------------------------------------------------------------
--
-- Contract 85 set the law and the reason: a season result can be corrected, and
-- if survival were spent incrementally then restating a 1-0 as 0-1 four rounds
-- later would leave an entrant eliminated by a defeat that no longer happened,
-- with no way back — the life is already gone. So `season_lms_entrant_state` is
-- a PROJECTION, the truth is (setup + picks + results), and every run rebuilds
-- from the first round. Re-running is idempotent by construction rather than by
-- a ledger, and a corrected result simply produces a different answer next run.
--
-- That is also why a round settles when it LOCKS rather than when its fixtures
-- are all played. Contract 85 makes every non-'played' status a postponement —
-- survive, consume nothing — so a locked round with no results yet eliminates
-- nobody, and the next run, once the results land, produces the real answer.
-- Settling on the lock costs nothing and keeps the projection current.
--
-- ---------------------------------------------------------------------------
-- WHY IT IS ENTRANT-OUTER AND ROUND-INNER
-- ---------------------------------------------------------------------------
--
-- Assignment and elimination are entangled: an entrant eliminated in round two
-- must not be auto-assigned a club in round three, because that consumes a club
-- from their pool and can bring their used-list reset forward. But who is
-- eliminated is only known by replaying. Walking ENTRANTS on the outside and
-- ROUNDS on the inside dissolves it — one entrant's fate never depends on
-- another's, so the running state is a local variable and assignment for round
-- N happens only if the fold through round N-1 left them alive.
--
-- The alternative, assigning everyone everywhere and replaying afterwards, is
-- what a round-outer loop forces, and it hands clubs to the dead.
--
-- ---------------------------------------------------------------------------
-- THE ADVISORY LOCK, WHICH IS A REQUIREMENT INHERITED FROM CONTRACT 85
-- ---------------------------------------------------------------------------
--
-- Known risk REL-001 records that the tournament's delete-and-rederive is not
-- serialised. Contract 85 wrote that this job must not inherit it. Two
-- concurrent runs over one competition would interleave assignment and replay
-- and could double-assign a round, so each competition is taken under a
-- TRANSACTION-SCOPED advisory lock. Transaction-scoped, not session-scoped,
-- because a session lock outlives a failed statement on a pooled connection and
-- would strand the competition until the backend died.
--
-- A run that cannot take the lock reports `busy` and moves on rather than
-- waiting. The next tick settles it; blocking would let one slow competition
-- hold up every other.
--
-- ---------------------------------------------------------------------------
-- WHO MAY RUN IT
-- ---------------------------------------------------------------------------
--
-- Contract 88's lock exception requires `session_user = 'postgres'`, and
-- `session_user` is fixed for the life of a connection. PostgREST logs in as
-- `authenticator` and switches role, so ANY path through the API — a
-- service-role key included — can never hold it, and every auto-assignment
-- would come back `refused`/`lock_exception_unavailable`.
--
-- So this job is scheduled through pg_cron, which runs as the role that
-- scheduled it, and is deliberately NOT granted to `service_role` the way
-- contract 83's matchweek job is. That difference is the point, not an
-- oversight. The settler reports assignment refusals in its return value, so a
-- run from the wrong identity is visible rather than silent.
--
-- ---------------------------------------------------------------------------
-- WHAT IT DOES NOT DO
-- ---------------------------------------------------------------------------
--
-- `restart_all_reentered` — ADR 0013's public endgame when more than three
-- entrants share a wipeout — is REPORTED and not acted on. It means re-entering
-- every player into a fresh competition with all picks reset, which is a new
-- competition lifecycle rather than a settlement, and inventing one here would
-- be the largest unreviewed change in this run. The competition keeps running
-- and the conclusion is returned and audited so it cannot be missed.

begin;

-- ---------------------------------------------------------------------------
-- Settle one competition.
-- ---------------------------------------------------------------------------

create or replace function predictor_internal.settle_season_lms_competition(
  p_competition_id uuid,
  p_now timestamptz default now()
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_tournament_id uuid;
  v_kind text;
  v_game text;
  v_completed timestamptz;
  v_lives smallint;
  v_saves smallint;
  v_draws text;
  v_scope text;
  v_wipeout text;
  v_entrant record;
  v_round record;
  v_selection uuid;
  v_assignment jsonb;
  v_outcome text;
  v_step jsonb;
  v_alive boolean;
  v_lives_left integer;
  v_saves_left integer;
  v_last_postponed boolean;
  v_outcomes jsonb;
  v_replay jsonb;
  v_entrant_refused boolean;
  v_settled_rounds integer := 0;
  v_assigned integer := 0;
  v_assign_refused integer := 0;
  v_entrants_settled integer := 0;
  v_entrants_refused integer := 0;
  v_eliminated integer := 0;
  v_verdict jsonb := '[]'::jsonb;
  v_conclusion jsonb;
  v_changed integer := 0;
  v_champions uuid[];
begin
  if p_now is null then
    raise exception 'Settlement time is required'
      using errcode = '22023';
  end if;

  -- REL-001. See the header: transaction-scoped, and non-blocking so one
  -- competition cannot hold up the tick.
  if not pg_try_advisory_xact_lock(hashtextextended(p_competition_id::text, 0)) then
    return jsonb_build_object('outcome', 'busy', 'competitionId', p_competition_id);
  end if;

  select c.tournament_id, t.kind, c.game_key, c.completed_at
    into v_tournament_id, v_kind, v_game, v_completed
    from public.bonus_competitions c
    join public.tournaments t on t.id = c.tournament_id
   where c.id = p_competition_id;

  if v_tournament_id is null or v_game <> 'last_man_standing'
     or v_kind <> 'league_season' then
    return jsonb_build_object('outcome', 'refused', 'reason', 'not_a_season_lms_competition');
  end if;

  -- NO `already_completed` SHORT CIRCUIT, and that is deliberate. An early
  -- return here would be the one place the correction law breaks: a result
  -- restated AFTER the competition finished — which is precisely when a final
  -- standing gets disputed — could never re-derive, and the wrong player would
  -- keep the title for ever. Completion is DERIVED like everything else, so it
  -- is set when the conclusion is terminal and cleared when it stops being one.
  --
  -- The cost is that a finished competition is replayed on every tick. That is
  -- bounded work and the alternative is a permanent wrong answer.

  select setup.lives, setup.saves, setup.draws_rule,
         setup.endgame_scope, setup.endgame_on_wipeout
    into v_lives, v_saves, v_draws, v_scope, v_wipeout
    from public.season_lms_setups setup
   where setup.competition_id = p_competition_id;

  if v_lives is null then
    return jsonb_build_object('outcome', 'refused', 'reason', 'no_setup');
  end if;

  select count(*)
    into v_settled_rounds
    from public.bonus_competition_windows w
   where w.competition_id = p_competition_id
     and w.locks_at is not null
     and w.locks_at <= p_now;

  if v_settled_rounds = 0 then
    return jsonb_build_object('outcome', 'nothing_settled');
  end if;

  -- ENTRANT OUTER, ROUND INNER. See the header for why this order and not the
  -- other one.
  for v_entrant in
    select entrant.user_id
      from public.bonus_competition_entrants entrant
     where entrant.competition_id = p_competition_id
     order by entrant.user_id
  loop
    v_alive := true;
    v_lives_left := v_lives;
    v_saves_left := v_saves;
    v_last_postponed := false;
    v_outcomes := '[]'::jsonb;
    v_entrant_refused := false;

    <<rounds>>
    for v_round in
      select w.id, w.sequence
        from public.bonus_competition_windows w
       where w.competition_id = p_competition_id
         and w.locks_at is not null
         and w.locks_at <= p_now
       order by w.sequence
    loop
      select sel.team_id
        into v_selection
        from public.bonus_lms_selections sel
       where sel.competition_id = p_competition_id
         and sel.user_id = v_entrant.user_id
         and sel.window_id = v_round.id;

      -- A missed pick is assigned, never punished. ADR 0013 rejected
      -- elimination for silence as "too punitive across thirty-eight weekly
      -- deadlines".
      if v_selection is null then
        v_assignment := predictor_internal.auto_assign_lms_entrant(
                          p_competition_id, v_entrant.user_id, v_round.id);

        if v_assignment->>'outcome' = 'assigned' then
          v_assigned := v_assigned + 1;
          v_selection := (v_assignment->>'teamId')::uuid;
        else
          v_assign_refused := v_assign_refused + 1;
        end if;
      end if;

      if v_selection is null then
        -- No pick and none assignable — a round that offered this entrant no
        -- eligible club, or a session that could not hold the lock exception.
        -- AVAILABILITY NEVER ELIMINATES (ADR 0013), so this is a postponement:
        -- survive, consume nothing. Treating it as a defeat would eliminate a
        -- player for the fixture list, which is the reading the ADR rules out.
        v_outcome := 'postponed';
      else
        v_outcome := predictor_internal.season_lms_pick_outcome(
                       v_tournament_id, v_round.id, v_selection);
      end if;

      if v_outcome is null then
        -- A stored pick whose club has no fixture in the round. The selection
        -- trigger forbids that, so this is a contradiction rather than a
        -- postponement. Fail closed on this ENTRANT and leave their projection
        -- untouched; one contradictory row must not settle the rest wrongly,
        -- nor abort the competition for everyone else.
        --
        -- `exit rounds` plus a flag, NOT `continue`: continuing would walk on
        -- to the next round and then write this entrant's projection from a
        -- fold with a hole in it, which is worse than not settling them.
        v_entrants_refused := v_entrants_refused + 1;
        v_entrant_refused := true;
        exit rounds;
      end if;

      v_step := predictor_internal.resolve_lms_pick(
                  v_outcome, v_draws, v_lives_left, v_saves_left);

      if v_step ? 'refused' then
        v_entrants_refused := v_entrants_refused + 1;
        v_entrant_refused := true;
        exit rounds;
      end if;

      v_outcomes := v_outcomes || to_jsonb(v_outcome);
      v_lives_left := (v_step->>'livesRemaining')::integer;
      v_saves_left := (v_step->>'savesRemaining')::integer;
      v_alive := (v_step->>'alive')::boolean;
      v_last_postponed := v_outcome = 'postponed';

      -- A player who is out does not keep spending, and must not be assigned a
      -- club in a later round.
      exit rounds when not v_alive;
    end loop rounds;

    -- An abandoned entrant keeps whatever projection they already had. Writing
    -- a partial fold would be the one outcome worse than leaving them stale.
    continue when v_entrant_refused;

    -- CROSS-CHECK. The loop above folds round by round because it has to
    -- interleave assignment; contract 85's `replay_lms_entrant` folds the same
    -- outcomes in one call. They must agree. This turns that function into a
    -- live check on this one rather than leaving two implementations of the
    -- same rule to drift apart, and it costs one call per entrant.
    v_replay := predictor_internal.replay_lms_entrant(
                  v_outcomes, v_lives, v_saves, v_draws);

    if v_replay ? 'refused'
       or (v_replay->>'alive')::boolean is distinct from v_alive
       or (v_replay->>'livesRemaining')::integer is distinct from v_lives_left
       or (v_replay->>'savesRemaining')::integer is distinct from v_saves_left then
      v_entrants_refused := v_entrants_refused + 1;
      continue;
    end if;

    insert into public.season_lms_entrant_state (
      competition_id, user_id, lives_remaining, saves_remaining, updated_at
    ) values (
      p_competition_id, v_entrant.user_id,
      v_lives_left::smallint, v_saves_left::smallint, p_now
    )
    on conflict (competition_id, user_id) do update
      set lives_remaining = excluded.lives_remaining,
          saves_remaining = excluded.saves_remaining,
          updated_at = excluded.updated_at;

    v_entrants_settled := v_entrants_settled + 1;
    if not v_alive then
      v_eliminated := v_eliminated + 1;
    end if;

    v_verdict := v_verdict || jsonb_build_object(
      'entryId', v_entrant.user_id::text,
      'alive', v_alive,
      'viaPostponement', v_last_postponed);
  end loop;

  -- Outcomes, following the tournament's derivation so the two games read the
  -- same on a shared surface: eliminated, or survived once any round settled.
  -- 'champion' is NOT set here — the tournament awards it to whoever is alive
  -- when the last round settles, and ADR 0013 is stricter for the season: a
  -- sole survivor who only survived a postponement has beaten nobody. That is
  -- `conclude_lms_round`'s judgement, applied below.
  update public.bonus_competition_entrants entrant
     set outcome = derived.outcome,
         updated_at = p_now
    from (
      select
        (verdict->>'entryId')::uuid as user_id,
        case when (verdict->>'alive')::boolean then 'survived' else 'eliminated' end as outcome
      from jsonb_array_elements(v_verdict) as verdict
    ) derived
   where entrant.competition_id = p_competition_id
     and entrant.user_id = derived.user_id
     and entrant.outcome is distinct from derived.outcome;

  get diagnostics v_changed = row_count;

  v_conclusion := predictor_internal.conclude_lms_round(v_verdict, v_scope, v_wipeout);

  -- Acting on the conclusion. `restart_all_reentered` is deliberately not
  -- acted on; see the header.
  if v_conclusion->>'kind' in ('winner', 'shared_win') then
    v_champions := case
      when v_conclusion->>'kind' = 'winner'
        then array[(v_conclusion->>'entryId')::uuid]
      else (select array_agg((value #>> '{}')::uuid)
              from jsonb_array_elements(v_conclusion->'entryIds'))
    end;

    update public.bonus_competition_entrants entrant
       set outcome = 'champion', updated_at = p_now
     where entrant.competition_id = p_competition_id
       and entrant.user_id = any (v_champions)
       and entrant.outcome is distinct from 'champion';

    update public.bonus_competitions
       set completed_at = p_now, updated_at = p_now
     where id = p_competition_id and completed_at is null;

  elsif v_conclusion->>'kind' = 'reset_no_winner' then
    update public.bonus_competitions
       set completed_at = p_now, updated_at = p_now
     where id = p_competition_id and completed_at is null;

  else
    -- The conclusion is no longer terminal: a correction reopened the
    -- competition. Un-complete it. Any 'champion' has already been written back
    -- to 'survived' or 'eliminated' by the outcome update above, which derives
    -- from the replay rather than from the previous run's answer.
    update public.bonus_competitions
       set completed_at = null, updated_at = p_now
     where id = p_competition_id and completed_at is not null;
  end if;

  insert into public.bonus_competition_audit (competition_id, action, detail)
  values (
    p_competition_id,
    'season_lms_settled',
    jsonb_build_object(
      'settledRounds', v_settled_rounds,
      'assigned', v_assigned,
      'assignmentRefusals', v_assign_refused,
      'entrantsSettled', v_entrants_settled,
      'entrantsRefused', v_entrants_refused,
      'eliminated', v_eliminated,
      'outcomesChanged', v_changed,
      'conclusion', v_conclusion
    )
  );

  return jsonb_build_object(
    'outcome', 'settled',
    'competitionId', p_competition_id,
    'settledRounds', v_settled_rounds,
    'assigned', v_assigned,
    'assignmentRefusals', v_assign_refused,
    'entrantsSettled', v_entrants_settled,
    'entrantsRefused', v_entrants_refused,
    'eliminated', v_eliminated,
    'outcomesChanged', v_changed,
    'conclusion', v_conclusion
  );
end;
$$;

revoke all on function predictor_internal.settle_season_lms_competition(uuid, timestamptz)
  from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- The job.
--
-- Per-competition exception handling for the same reason the settler isolates
-- entrants: one competition's contradiction must not stop every other
-- competition settling.
-- ---------------------------------------------------------------------------

create or replace function public.process_due_season_lms_settlements(
  p_now timestamptz default now()
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_due record;
  v_result jsonb;
  v_attempted integer := 0;
  v_settled integer := 0;
  v_busy integer := 0;
  v_failed integer := 0;
begin
  if p_now is null then
    raise exception 'Processing time is required'
      using errcode = '22023';
  end if;

  for v_due in
    select c.id
      from public.bonus_competitions c
      join public.tournaments t on t.id = c.tournament_id
     where c.game_key = 'last_man_standing'
       and t.kind = 'league_season'
       and c.published
       -- Completed competitions are NOT filtered out: see the settler's note on
       -- why completion is derived. A correction after the final round has to
       -- be able to reach the competition that the correction unfinishes.
       and exists (
         select 1 from public.bonus_competition_windows w
          where w.competition_id = c.id
            and w.locks_at is not null
            and w.locks_at <= p_now
       )
     order by c.id
  loop
    v_attempted := v_attempted + 1;

    begin
      v_result := predictor_internal.settle_season_lms_competition(v_due.id, p_now);

      if v_result->>'outcome' = 'settled' then
        v_settled := v_settled + 1;
      elsif v_result->>'outcome' = 'busy' then
        v_busy := v_busy + 1;
      end if;
    exception when others then
      v_failed := v_failed + 1;
      insert into public.bonus_competition_audit (competition_id, action, detail)
      values (
        v_due.id,
        'season_lms_settlement_failed',
        jsonb_build_object('sqlstate', sqlstate, 'message', sqlerrm)
      );
    end;
  end loop;

  return jsonb_build_object(
    'attempted', v_attempted,
    'settled', v_settled,
    'busy', v_busy,
    'failed', v_failed
  );
end;
$$;

-- NOT granted to service_role, unlike contract 83's matchweek job. See the
-- header: an API caller's `session_user` is `authenticator`, which can never
-- hold contract 88's lock exception, so every auto-assignment would refuse.
revoke all on function public.process_due_season_lms_settlements(timestamptz)
  from public, anon, authenticated, service_role;

-- Hourly, not every minute. A matchweek lock is an instant and the card
-- scheduler must catch it promptly; a Last Man Standing round is settled by
-- RESULTS, which arrive over hours, and every run replays the whole season for
-- every entrant. An hourly tick keeps the projection fresh without paying that
-- cost sixty times an hour for nothing.
select cron.schedule(
  'season-settle-due-lms-rounds',
  '0 * * * *',
  'select public.process_due_season_lms_settlements();'
);

-- ---------------------------------------------------------------------------
-- Prove at apply time that the lock is transaction-scoped.
--
-- A session-scoped lock here would survive this migration and every later
-- statement on the connection, and the failure would be invisible until two
-- runs collided in production. `pg_advisory_xact_lock` releases at commit, so
-- the lock this block takes must be gone from the session's own view the
-- moment its transaction ends — which is what the second check confirms.
-- ---------------------------------------------------------------------------

do $$
declare
  v_key constant bigint := hashtextextended('contract-89-lock-scope-probe', 0);
begin
  if not pg_try_advisory_xact_lock(v_key) then
    raise exception 'the settlement advisory lock could not be taken at all';
  end if;

  -- Taking it twice in the same transaction succeeds (advisory locks are
  -- re-entrant for the holder), which is what lets one run settle many
  -- competitions.
  if not pg_try_advisory_xact_lock(v_key) then
    raise exception 'the settlement advisory lock is not re-entrant for its holder';
  end if;

  if not exists (
    select 1 from pg_locks
     where locktype = 'advisory' and pid = pg_backend_pid()
  ) then
    raise exception 'the advisory lock is not visible in pg_locks; the key is not being taken';
  end if;
end;
$$;

commit;
