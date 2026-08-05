-- Contract 109: the successor gets a calendar, and the endgame closes.
--
-- ADR 0025 decision 1 lists eight things a restart must do. Contract 107 did
-- seven of them and deliberately left the eighth — "generate new windows
-- beginning with the next eligible league round" — because it looked as though
-- "eligible" had no authority to read.
--
-- It has one. Contract 83 built `predictor_internal.season_matchweek_lock_at`,
-- which derives a round's lock instant from the earliest kickoff in it minus
-- the game's own buffer, and returns NULL when the fixture list is incomplete.
-- `game_definitions` supplies that buffer per game — Last Man Standing is
-- matchweek-scoped with 30 minutes. `competition_rounds` supplies the ordering
-- and the `league_matchweek` kind.
--
-- So "the next eligible league round" is expressible exactly, with nothing
-- invented: the earliest-locking league matchweek whose instant is DERIVABLE
-- and falls strictly after the predecessor finished. Contract 83's convention
-- carries over unchanged — not derivable is not due there, not eligible here —
-- so a season whose fixtures are not yet published leaves the successor inert
-- rather than guessing at a date.
--
-- That boundary is the same one contract 108 enforces from the other side. The
-- guard refuses a successor round that opened or locked before its predecessor
-- ended; this scheduler starts at the first round the guard would accept. They
-- were derived from the same rule rather than fitted to each other, which is
-- why neither needed to know about the other.
--
-- ---------------------------------------------------------------------------
-- WHY THE JOB CANNOT LOOK FOR A LIFECYCLE STATE
-- ---------------------------------------------------------------------------
--
-- The obvious way to find a competition awaiting restart is to look for one
-- that finished with that reason. There is no such row.
--
-- Contract 89's settler acts on `winner`, `shared_win` and `reset_no_winner`,
-- and its ELSE branch — which `restart_all_reentered` falls into — actively
-- UN-COMPLETES the competition. That is correct: the branch exists so that a
-- correction reopening a finished competition clears its completion. But it
-- means a competition awaiting restart sits live, with `completed_at` null and
-- no `completion_reason`, indistinguishable by lifecycle state from one still
-- being played.
--
-- What does distinguish it is the settler's own report. It writes a
-- `season_lms_settled` audit row carrying the derived conclusion on every run,
-- so the job reads the LATEST one and acts on what settlement reported. The
-- ADR's division holds exactly as written: settlement continues only to derive
-- and report, and the lifecycle happens elsewhere, driven by that report.
--
-- The second condition matters as much as the first. `bonus_competition_audit`
-- is immutable, so the predecessor's `restart_all_reentered` row is permanent
-- and would re-trigger for ever. The job therefore skips any competition that
-- already has a successor. Both driver and scheduler are idempotent underneath
-- that, so a retry costs nothing either way — but a job that relies only on
-- downstream idempotence to avoid doing the wrong thing repeatedly is one
-- misreading away from doing it once.

begin;

-- ---------------------------------------------------------------------------
-- The next eligible league round.
-- ---------------------------------------------------------------------------

create or replace function predictor_internal.next_eligible_league_round(
  p_tournament_id uuid,
  p_game_key text,
  p_after timestamptz
)
returns uuid
language sql
stable
set search_path = ''
as $$
  -- Ordered by the derived instant rather than by `ordinal`. Those usually
  -- agree, and where they do not the fixture list has been rescheduled — in
  -- which case the round that locks NEXT is the round a player picks for next,
  -- whatever its league number says.
  select eligible.id
  from (
    select
      round.id,
      round.ordinal,
      predictor_internal.season_matchweek_lock_at(
        p_tournament_id, round.id, definition.buffer_minutes) as locks_at
    from public.competition_rounds round
    cross join public.game_definitions definition
    where round.tournament_id = p_tournament_id
      and round.kind = 'league_matchweek'
      and definition.game_key = p_game_key
  ) eligible
  where eligible.locks_at is not null
    and eligible.locks_at > p_after
  order by eligible.locks_at, eligible.ordinal
  limit 1;
$$;

revoke all on function predictor_internal.next_eligible_league_round(uuid, text, timestamptz)
  from public, anon, authenticated, service_role;

-- ---------------------------------------------------------------------------
-- The successor's calendar.
-- ---------------------------------------------------------------------------

create or replace function predictor_internal.generate_lms_successor_windows(
  p_competition_id uuid
)
returns integer
language plpgsql
security definer
set search_path = ''
as $windows$
declare
  v_competition record;
  v_predecessor_completed_at timestamptz;
  v_buffer integer;
  v_first_round uuid;
  v_first_locks_at timestamptz;
  v_created integer := 0;
begin
  select competition.id,
         competition.tournament_id,
         competition.game_key,
         competition.series_id,
         competition.predecessor_competition_id
    into v_competition
    from public.bonus_competitions competition
    where competition.id = p_competition_id;

  if not found then
    raise exception 'Competition % does not exist', p_competition_id
      using errcode = '23503';
  end if;

  if v_competition.game_key <> 'last_man_standing' then
    raise exception 'Only a Last Man Standing competition has rounds to schedule this way, not %',
      v_competition.game_key
      using errcode = '23514';
  end if;

  -- A first instance takes its calendar from the catalogue. Scheduling one here
  -- would be a second, competing source for the same rounds.
  if v_competition.predecessor_competition_id is null then
    raise exception 'Competition % is a first instance and has no restart to schedule from', p_competition_id
      using errcode = '23514';
  end if;

  -- Series-scoped, matching the restart driver: the contention is between two
  -- runs over the same series, not between unrelated competitions.
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(v_competition.series_id::text, 0)
  );

  -- Idempotent, and re-read under the lock. A competition that already has
  -- rounds is not rescheduled: its calendar may already have been played
  -- against, and replacing it would move locks under existing selections.
  if exists (
    select 1 from public.bonus_competition_windows existing
    where existing.competition_id = p_competition_id
  ) then
    return 0;
  end if;

  select predecessor.completed_at
    into v_predecessor_completed_at
    from public.bonus_competitions predecessor
    where predecessor.id = v_competition.predecessor_competition_id;

  if v_predecessor_completed_at is null then
    raise exception 'The predecessor of % has not finished, so there is no instant to schedule after', p_competition_id
      using errcode = '23514';
  end if;

  select definition.buffer_minutes
    into v_buffer
    from public.game_definitions definition
    where definition.game_key = 'last_man_standing';

  v_first_round := predictor_internal.next_eligible_league_round(
    v_competition.tournament_id, 'last_man_standing', v_predecessor_completed_at
  );

  -- No eligible round. The successor stays inert, which is the honest answer:
  -- the season may be over, or its remaining fixtures may not carry kickoffs
  -- yet. Either way this is not an error, and a later run will find one if one
  -- appears.
  if v_first_round is null then
    return 0;
  end if;

  v_first_locks_at := predictor_internal.season_matchweek_lock_at(
    v_competition.tournament_id, v_first_round, v_buffer
  );

  with scheduled as (
    select
      round.id as round_id,
      round.label,
      round.ordinal,
      predictor_internal.season_matchweek_lock_at(
        v_competition.tournament_id, round.id, v_buffer) as locks_at
    from public.competition_rounds round
    where round.tournament_id = v_competition.tournament_id
      and round.kind = 'league_matchweek'
  ), eligible as (
    select
      scheduled.round_id,
      scheduled.label,
      scheduled.locks_at,
      row_number() over (order by scheduled.locks_at, scheduled.ordinal) as sequence,
      -- Each round opens when the previous one locked; the first opens at the
      -- restart. Ordering by the lock instant makes this monotonic by
      -- construction, so `locks_at > opens_at` cannot be violated by a
      -- rescheduled fixture.
      lag(scheduled.locks_at) over (order by scheduled.locks_at, scheduled.ordinal)
        as previous_locks_at
    from scheduled
    where scheduled.locks_at is not null
      and scheduled.locks_at >= v_first_locks_at
  ), created as (
    insert into public.bonus_competition_windows (
      competition_id, sequence, label, opens_at, locks_at
    )
    select
      p_competition_id,
      eligible.sequence,
      eligible.label,
      coalesce(eligible.previous_locks_at, v_predecessor_completed_at),
      eligible.locks_at
    from eligible
    -- `sequence` carries the correlation back to the round. Matching on the
    -- label instead would have been one duplicated matchweek name away from
    -- attaching a round's fixtures to the wrong window.
    returning id, sequence
  ), linked as (
    -- The fixtures each round is played over, through the season link. The
    -- name says Cup; the table is (window_id, season_fixture_id) and carries
    -- nothing Cup-specific, and contract 77 is applied so it cannot be renamed.
    insert into public.season_cup_window_fixtures (window_id, season_fixture_id)
    select created.id, fixture.id
    from created
    join eligible on eligible.sequence = created.sequence
    join public.season_fixtures fixture
      on fixture.tournament_id = v_competition.tournament_id
     and fixture.competition_round_id = eligible.round_id
    returning window_id
  )
  select count(*)::integer into v_created from created;

  insert into public.bonus_competition_audit (competition_id, action, detail)
  values (
    p_competition_id,
    'successor_calendar_scheduled',
    jsonb_build_object(
      'windowsCreated', v_created,
      'firstRoundId', v_first_round,
      'scheduledAfter', v_predecessor_completed_at
    )
  );

  return v_created;
end;
$windows$;

revoke all on function predictor_internal.generate_lms_successor_windows(uuid)
  from public, anon, authenticated, service_role;

-- ---------------------------------------------------------------------------
-- The lifecycle job.
-- ---------------------------------------------------------------------------

create or replace function public.process_due_lms_restarts(
  p_now timestamptz default now()
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $restarts$
declare
  v_due record;
  v_successor uuid;
  v_windows integer;
  v_attempted integer := 0;
  v_restarted integer := 0;
  v_scheduled integer := 0;
  v_inert integer := 0;
  v_failed integer := 0;
begin
  if p_now is null then
    raise exception 'Processing time is required'
      using errcode = '22023';
  end if;

  for v_due in
    select competition.id
      from public.bonus_competitions competition
      join public.tournaments tournament on tournament.id = competition.tournament_id
     where competition.game_key = 'last_man_standing'
       and tournament.kind = 'league_season'
       and competition.visibility_kind = 'public'
       -- What settlement last reported for this competition. Ordered by
       -- `recorded_at`, which is sound because the settler writes exactly one
       -- report per run and its job is scheduled hourly — two reports for one
       -- competition never share an instant. The `id` tiebreak is a UUID and so
       -- arbitrary; it is there only to make the row choice deterministic
       -- rather than to express a second ordering.
       and (
         select audit.detail->'conclusion'->>'kind'
           from public.bonus_competition_audit audit
          where audit.competition_id = competition.id
            and audit.action = 'season_lms_settled'
          order by audit.recorded_at desc, audit.id desc
          limit 1
       ) = 'restart_all_reentered'
       -- The audit trail is immutable, so the report that triggered a restart
       -- stays true for ever. The successor is what makes it spent.
       and not exists (
         select 1 from public.bonus_competitions successor
          where successor.predecessor_competition_id = competition.id
       )
     order by competition.id
  loop
    v_attempted := v_attempted + 1;

    -- Per-competition isolation, as the settlement job does it: one
    -- competition's contradiction must not stop every other restart.
    begin
      v_successor := predictor_internal.restart_lms_competition(v_due.id);
      v_restarted := v_restarted + 1;

      v_windows := predictor_internal.generate_lms_successor_windows(v_successor);
      if v_windows > 0 then
        v_scheduled := v_scheduled + 1;
      else
        v_inert := v_inert + 1;
      end if;
    exception
      when others then
        v_failed := v_failed + 1;
    end;
  end loop;

  return jsonb_build_object(
    'attempted', v_attempted,
    'restarted', v_restarted,
    'scheduled', v_scheduled,
    'inert', v_inert,
    'failed', v_failed
  );
end;
$restarts$;

revoke all on function public.process_due_lms_restarts(timestamptz)
  from public, anon, authenticated, service_role;

-- Fifteen past the hour. Settlement runs on the hour and is what produces the
-- conclusion this job reads, so running them together would race a report this
-- job depends on. Hourly for the same reason settlement is hourly: a wipeout
-- is decided by results, which arrive over hours.
select cron.schedule(
  'season-restart-due-lms-competitions',
  '15 * * * *',
  'select public.process_due_lms_restarts();'
);

commit;
