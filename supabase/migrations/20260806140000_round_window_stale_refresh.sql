-- Contract 123: stale round play windows, and the guarded refresh that fixes
-- them without ever failing an import.
--
-- ---------------------------------------------------------------------------
-- THE RULE THIS IMPLEMENTS, AND THE ONE IT REFUSES TO
-- ---------------------------------------------------------------------------
--
-- Contract 122 backfilled the round play windows and deliberately added no
-- driver, because the obvious one is unsafe: re-deriving inside contract 117's
-- provider import means a postponed fixture EXTENDS its round's span, and
-- contract 113's disjointness trigger refuses two rounds claiming the same
-- instant — so an ordinary, valid postponement could make the import fail.
--
-- The owner's decision is that ingestion reliability wins and the windows catch
-- up separately:
--
--   NO synchronous re-derivation inside the import. Contract 117's function is
--   not touched by this migration at all.
--   Mark the affected windows STALE when a kickoff moves.
--   Re-derive on a separate, guarded pass.
--   Apply automatically when disjointness still holds.
--   FAIL CLOSED into admin review when it would not, keeping the previous
--   valid windows and recording what was proposed and why it was refused.
--
-- ---------------------------------------------------------------------------
-- WHY MARKING STALE IS NOT THE THING THAT WAS FORBIDDEN
-- ---------------------------------------------------------------------------
--
-- The trigger below writes one timestamp on the round. It evaluates no
-- disjointness, proposes no window and can raise nothing, so it cannot refuse
-- an import — which is the whole property the owner's decision protects. The
-- forbidden thing is re-derivation in the import path, and that is what lives
-- in the separately invoked function further down.
--
-- It watches `season_fixtures` rather than contract 117's revision record, so
-- it covers every way a round's span can move: a kickoff revised, a fixture
-- added, a fixture removed. Only the first has a writer today; the other two
-- are the admin-controlled changes the owner's note says must wait for
-- approval, and they mark stale here for the same reason — the window IS out
-- of date the moment the fixture set changes, whoever changed it. Marking is
-- not applying; nothing re-derives until the guarded pass runs.
--
-- ---------------------------------------------------------------------------
-- WHAT A STALE WINDOW MEANS TO A READER
-- ---------------------------------------------------------------------------
--
-- A stale window is not a wrong window: it is a window derived before the most
-- recent fixture change, which may or may not still be right. Contract 122's
-- month calendar reads `window_opens_at`, so a stale round can only be
-- MISFILED if its first kickoff moved across a month boundary — narrow, but
-- real. So the monthly and form reads now report staleness rather than
-- silently answering from information known to be out of date. They still
-- answer: refusing a whole season's table because one round is pending a
-- refresh would be a worse trade than saying so.

begin;

-- ---------------------------------------------------------------------------
-- The stale flag.
-- ---------------------------------------------------------------------------

alter table public.competition_rounds
  add column if not exists window_stale_since timestamptz;

comment on column public.competition_rounds.window_stale_since is
  'Contract 123. Set when this round''s fixtures changed after its play window '
  'was derived; null when the window is current. Marking is not applying — the '
  'guarded refresh decides whether the new window can be taken.';

-- ---------------------------------------------------------------------------
-- The conflict queue.
--
-- One row per refusal, holding everything an administrator needs to decide
-- without re-deriving anything themselves: which round, what it holds now,
-- what was proposed, which round that would have collided with, and why.
-- ---------------------------------------------------------------------------

create table predictor_internal.round_window_refresh_conflicts (
  id uuid primary key default gen_random_uuid(),

  tournament_id uuid not null
    references public.tournaments(id) on delete cascade,
  competition_round_id uuid not null
    references public.competition_rounds(id) on delete cascade,

  -- The windows kept, because a refusal retains them.
  previous_opens_at timestamptz,
  previous_closes_at timestamptz,

  -- The windows the refresh would have written.
  proposed_opens_at timestamptz not null,
  proposed_closes_at timestamptz not null,

  -- The round it would have overlapped, and its span at the time.
  conflicting_round_id uuid
    references public.competition_rounds(id) on delete set null,
  conflicting_opens_at timestamptz,
  conflicting_closes_at timestamptz,

  -- The fixtures whose movement produced the proposal.
  affected_fixture_ids uuid[] not null default '{}',

  reason text not null,
  detected_at timestamptz not null default now(),

  -- Null until an administrator has acted. Unresolved rows are the queue.
  resolved_at timestamptz,
  resolution_note text,

  constraint round_window_refresh_conflicts_ordered
    check (proposed_opens_at <= proposed_closes_at),
  constraint round_window_refresh_conflicts_reason
    check (char_length(btrim(reason)) between 1 and 500)
);

comment on table predictor_internal.round_window_refresh_conflicts is
  'Contract 123. Round play window refreshes refused because the proposed span '
  'would overlap another round. The previous windows are retained; this is the '
  'evidence an administrator resolves from.';

alter table predictor_internal.round_window_refresh_conflicts enable row level security;
revoke all on table predictor_internal.round_window_refresh_conflicts
  from public, anon, authenticated, service_role;

create index round_window_refresh_conflicts_open_idx
  on predictor_internal.round_window_refresh_conflicts (tournament_id, detected_at desc)
  where resolved_at is null;

-- ---------------------------------------------------------------------------
-- Marking stale.
--
-- AFTER, and deliberately not row-by-row careful about which round: a fixture
-- can move BETWEEN rounds, in which case both the round it left and the round
-- it joined have out-of-date spans. Statement-level would lose which rows
-- moved, so this is per row and marks both sides when they differ.
-- ---------------------------------------------------------------------------

create or replace function predictor_internal.mark_round_window_stale()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  -- A row trigger that cannot fail is the point. There is no disjointness test
  -- here, no proposal and no exception path: an import that moves a kickoff
  -- gets a flag written and carries on.
  if tg_op in ('UPDATE', 'DELETE') and old.competition_round_id is not null then
    update public.competition_rounds
       set window_stale_since = coalesce(window_stale_since, now())
     where id = old.competition_round_id;
  end if;

  if tg_op in ('INSERT', 'UPDATE') and new.competition_round_id is not null then
    update public.competition_rounds
       set window_stale_since = coalesce(window_stale_since, now())
     where id = new.competition_round_id;
  end if;

  return null;
end;
$$;

revoke all on function predictor_internal.mark_round_window_stale()
  from public, anon, authenticated, service_role;

-- `of kickoff_at` on the update arm: a score or status write does not move a
-- round's span and must not queue a refresh. Insert and delete carry no column
-- list because either changes the fixture set outright.
create trigger season_fixtures_mark_round_window_stale_ins
  after insert on public.season_fixtures
  for each row execute function predictor_internal.mark_round_window_stale();

create trigger season_fixtures_mark_round_window_stale_upd
  after update of kickoff_at, competition_round_id on public.season_fixtures
  for each row execute function predictor_internal.mark_round_window_stale();

create trigger season_fixtures_mark_round_window_stale_del
  after delete on public.season_fixtures
  for each row execute function predictor_internal.mark_round_window_stale();

-- ---------------------------------------------------------------------------
-- The guarded refresh.
--
-- Separately invoked, never called from the import. For each stale round it
-- proposes the span its own fixtures now describe, and takes it only if the
-- rule contract 113 enforces still holds. A refusal writes a conflict row and
-- leaves the round exactly as it was — stale, with its previous valid window
-- intact, and now visible in the queue.
--
-- Returns a summary rather than raising: a pass over twelve rounds where one
-- conflicts should apply the eleven and report the one, not abandon the lot.
-- ---------------------------------------------------------------------------

create or replace function predictor_internal.refresh_stale_round_windows(
  p_tournament_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_round record;
  v_first timestamptz;
  v_last timestamptz;
  v_clash record;
  v_applied integer := 0;
  v_refused integer := 0;
  v_cleared integer := 0;
begin
  if p_tournament_id is null then
    raise exception 'Competition season is required' using errcode = '22023';
  end if;

  for v_round in
    select round.id, round.round_key, round.window_opens_at, round.window_closes_at
      from public.competition_rounds round
     where round.tournament_id = p_tournament_id
       and round.window_stale_since is not null
     order by round.ordinal
  loop
    select min(fixture.kickoff_at), max(fixture.kickoff_at)
      into v_first, v_last
      from public.season_fixtures fixture
     where fixture.competition_round_id = v_round.id
       and fixture.kickoff_at is not null;

    if v_first is null then
      -- Every fixture left this round, or none has a kickoff. Contract 113's
      -- reading is that such a round has no window and cannot be a
      -- reassignment destination, so clearing is the correct refresh and it
      -- can never overlap anything.
      update public.competition_rounds
         set window_opens_at = null,
             window_closes_at = null,
             window_stale_since = null
       where id = v_round.id;
      v_cleared := v_cleared + 1;
      continue;
    end if;

    -- The rule contract 113's trigger enforces, evaluated BEFORE writing so a
    -- refusal is a recorded decision rather than a caught exception. Bounds are
    -- inclusive at both ends, matching that trigger exactly: windows that merely
    -- touch overlap, because a kickoff at that instant would satisfy both.
    select other.id, other.window_opens_at, other.window_closes_at
      into v_clash
      from public.competition_rounds other
     where other.tournament_id = p_tournament_id
       and other.id <> v_round.id
       and other.window_opens_at is not null
       and other.window_opens_at <= v_last
       and other.window_closes_at >= v_first
     order by other.window_opens_at
     limit 1;

    if v_clash.id is not null then
      insert into predictor_internal.round_window_refresh_conflicts (
        tournament_id, competition_round_id,
        previous_opens_at, previous_closes_at,
        proposed_opens_at, proposed_closes_at,
        conflicting_round_id, conflicting_opens_at, conflicting_closes_at,
        affected_fixture_ids, reason
      )
      select
        p_tournament_id, v_round.id,
        v_round.window_opens_at, v_round.window_closes_at,
        v_first, v_last,
        v_clash.id, v_clash.window_opens_at, v_clash.window_closes_at,
        coalesce(array_agg(fixture.id order by fixture.kickoff_at), '{}'),
        'The refreshed play span would overlap another round in this season, '
        'so the previous window is retained and the round stays stale.'
      from public.season_fixtures fixture
      where fixture.competition_round_id = v_round.id
        and fixture.kickoff_at is not null;

      -- Deliberately NOT clearing window_stale_since: the round is still out of
      -- date, and a reader must keep being told so until an administrator
      -- resolves the conflict.
      v_refused := v_refused + 1;
      continue;
    end if;

    update public.competition_rounds
       set window_opens_at = v_first,
           window_closes_at = v_last,
           window_stale_since = null
     where id = v_round.id;
    v_applied := v_applied + 1;
  end loop;

  return jsonb_build_object(
    'applied', v_applied,
    'cleared', v_cleared,
    'refused', v_refused
  );
end;
$$;

revoke all on function predictor_internal.refresh_stale_round_windows(uuid)
  from public, anon, authenticated, service_role;

-- ---------------------------------------------------------------------------
-- The asynchronous attempt.
--
-- Every league season with a stale round, on a cadence. Behaviour-neutral on
-- application: nothing is stale at the moment this migration runs, so the job
-- runs and does nothing until an import moves a kickoff. It swallows no
-- failure — a season that raises stops that season, and the others still run.
-- ---------------------------------------------------------------------------

create or replace function predictor_internal.refresh_due_round_windows()
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_season record;
  v_result jsonb;
  v_applied integer := 0;
  v_cleared integer := 0;
  v_refused integer := 0;
  v_seasons integer := 0;
begin
  for v_season in
    select distinct season.id
      from public.tournaments season
      join public.competition_rounds round on round.tournament_id = season.id
     where season.kind = 'league_season'
       and round.window_stale_since is not null
  loop
    v_result := predictor_internal.refresh_stale_round_windows(v_season.id);
    v_applied := v_applied + (v_result ->> 'applied')::integer;
    v_cleared := v_cleared + (v_result ->> 'cleared')::integer;
    v_refused := v_refused + (v_result ->> 'refused')::integer;
    v_seasons := v_seasons + 1;
  end loop;

  return jsonb_build_object(
    'seasons', v_seasons,
    'applied', v_applied,
    'cleared', v_cleared,
    'refused', v_refused
  );
end;
$$;

revoke all on function predictor_internal.refresh_due_round_windows()
  from public, anon, authenticated, service_role;

-- Hourly, on the half hour. The existing jobs sit on the hour and on the
-- five-minute grid; this shares a slot with neither.
select cron.schedule(
  'round-window-refresh-stale',
  '30 * * * *',
  'select predictor_internal.refresh_due_round_windows();'
);

-- ---------------------------------------------------------------------------
-- Telling the reader.
--
-- `get_season_period_standings` is redefined from contract 122's text with the
-- staleness fields ADDED and nothing else changed — the boundary, the period
-- vocabulary, the refusal and both payload shapes are as they were. Verified by
-- diff rather than by reading, because contract 114 made exactly that mistake
-- and contract 118 records the lesson.
-- ---------------------------------------------------------------------------

create or replace function public.get_season_period_standings(
  p_tournament_id uuid,
  p_period text,
  p_window integer default 5
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_uid uuid;
  v_period text;
  v_payload jsonb;
  v_stale integer;
begin
  if p_tournament_id is null then
    raise exception 'Season is required' using errcode = '22023';
  end if;

  v_uid := (select auth.uid());
  if v_uid is null then
    raise exception 'Authentication is required' using errcode = '42501';
  end if;

  v_period := lower(btrim(coalesce(p_period, '')));
  if v_period not in ('month', 'form') then
    raise exception 'Unknown standings period' using errcode = '22023';
  end if;

  if not exists (
    select 1
      from public.tournaments season
     where season.id = p_tournament_id
       and season.kind = 'league_season'
  ) then
    raise exception 'Season is required' using errcode = '22023';
  end if;

  if not exists (
    select 1
      from public.entries entry
     where entry.tournament_id = p_tournament_id
       and entry.user_id = v_uid
  ) then
    raise exception 'This season is not yours to read' using errcode = '42501';
  end if;

  -- Contract 123. Counted for both periods, and reported rather than hidden.
  -- Form does not read a window at all, so its answer cannot be misfiled by a
  -- stale one; it still reports the count, because the same surface shows both
  -- and a warning that appears only on one tab reads as a glitch.
  select count(*) into v_stale
    from public.competition_rounds round
   where round.tournament_id = p_tournament_id
     and round.window_stale_since is not null;

  if v_period = 'form' then
    return jsonb_build_object(
      'period', 'form',
      'window', p_window,
      'months', null,
      'rows', predictor_internal.season_form_standings(p_tournament_id, p_window),
      'stale_rounds', v_stale,
      'stale_affects_period', false
    );
  end if;

  v_payload := predictor_internal.season_monthly_standings(p_tournament_id);

  if v_payload is null then
    raise exception
      'This season has a settled matchweek with no play window, so its monthly table cannot be built'
      using errcode = '55000';
  end if;

  return jsonb_build_object(
    'period', 'month',
    'window', null,
    'months', v_payload,
    'rows', null,
    'stale_rounds', v_stale,
    -- The monthly table reads `window_opens_at`, so a stale round CAN be
    -- misfiled — only if its first kickoff moved across a month boundary, but
    -- that is exactly the case a silent answer would hide.
    'stale_affects_period', v_stale > 0
  );
end;
$$;

revoke all on function public.get_season_period_standings(uuid, text, integer)
  from public, anon;
grant execute on function public.get_season_period_standings(uuid, text, integer)
  to authenticated;

commit;
