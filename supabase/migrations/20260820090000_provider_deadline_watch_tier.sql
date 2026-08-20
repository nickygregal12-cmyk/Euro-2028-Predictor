-- CONTRACT 211. A deadline watch that is cheap enough to leave on.
--
-- WHAT CONTRACT 210 GOT RIGHT AND WHAT IT GOT WRONG.
--
-- Right: the live poll window has to be open before the prediction deadline it
-- protects, and an ordinary fixture's deadline is its MATCHWEEK'S FIRST
-- KICKOFF, not its own.
--
-- Wrong: it bought that coverage by widening the wrong window. It set
-- `live_lead_minutes` to 720 while `live_cadence_minutes` stayed at 10, which
-- means twelve hours of ten-minute polling before every kickoff. That column
-- exists to answer "has this match kicked off, and what is the score" -- a
-- question that genuinely needs ten-minute resolution and genuinely does not
-- need twelve hours of it.
--
-- MEASURED, ON THE REAL FIXTURE LIST RATHER THAN ESTIMATED. `provider_target_is_live`
-- is TOURNAMENT-level: any unresolved fixture inside its window holds the window
-- open for the whole target. A Premier League matchweek spans about 72 hours,
-- Friday evening to Monday evening, so a twelve-hour lead chains the windows
-- into one almost-continuous block. Union of the per-fixture windows for the
-- 21-24 August 2026 round, ten fixtures:
--
--   contract 210, lead 720 / cadence 10   63.5 hours open    381 polls
--   live only,    lead  15 / cadence 10   15.8 hours open     95 polls
--   deadline tier, lead 720 / cadence 60  55.5 hours open     56 polls
--
-- Contract 146 published a budget of about 58 requests on a matchday. Contract
-- 210 spends 381 per matchweek. That is not a rounding error, and a change that
-- has to be watched for cost is a change that will eventually be turned off.
--
-- THE FIX IS A SEPARATE TIER, NOT A WIDER ONE. The two questions want different
-- answers, so they get different dials:
--
--   * `deadline_cadence_minutes` (60) applies inside a DEADLINE WATCH, which
--     opens `deadline_lead_minutes` (720) before an unresolved kickoff and
--     closes AT that kickoff. It answers "is this match still happening", which
--     needs long reach and coarse resolution.
--   * `live_cadence_minutes` (10) keeps its own window, and
--     `live_lead_minutes` goes back to 15 -- the value contract 145 chose for
--     it, for the question it was chosen for. Contract 210 borrowed this column
--     for a job it does not do; this returns it.
--   * `cadence_minutes` (1440) is untouched, as it was under contract 210.
--
-- The deadline watch costs 56 polls where contract 210 spent 381, and it covers
-- MORE hours. A postponement announced at any point in the twelve hours before
-- a deadline is seen within the hour, with hours of margin before the lock.
--
-- WHY THE DEADLINE WATCH CLOSES AT KICKOFF. After kickoff there is no
-- prediction left to protect -- the lock has passed -- and the live tier owns
-- the fixture from fifteen minutes out. A tail here would pay twice for the
-- same minutes.
--
-- WHAT THIS CONTRACT DOES NOT DO. It moves no scoring, lock, settlement,
-- progression or membership rule, and it does not change what a deadline IS:
-- `season_prediction_lock_at` and `season_matchweek_lock_at` are untouched. It
-- changes only when the provider is read.

-- ---------------------------------------------------------------------------
-- 1. The tier.
-- ---------------------------------------------------------------------------

alter table public.provider_poll_targets
  add column if not exists deadline_cadence_minutes integer not null default 60,
  add column if not exists deadline_lead_minutes integer not null default 720;

comment on column public.provider_poll_targets.deadline_cadence_minutes is
  'How often to poll inside the deadline watch, in minutes. CONTRACT 211: this '
  'answers "is this match still happening", which needs long reach and coarse '
  'resolution. It must be no finer than the live cadence and no coarser than '
  'the idle cadence.';

comment on column public.provider_poll_targets.deadline_lead_minutes is
  'How long before an unresolved kickoff the deadline watch opens, in minutes. '
  'CONTRACT 211: an ordinary fixture locks at its matchweek''s FIRST kickoff, so '
  'this must reach back far enough to cover that instant. The watch closes AT '
  'the kickoff, because after it there is no prediction left to protect and the '
  'live tier owns the fixture.';

comment on column public.provider_poll_targets.live_lead_minutes is
  'How long before an unresolved fixture kickoff the LIVE window opens, in '
  'minutes. CONTRACT 211 returns this to 15, the value contract 145 chose for '
  'the question it answers -- has this match kicked off, and what is the score. '
  'Contract 210 raised it to 720 to cover a prediction deadline; that is what '
  'deadline_lead_minutes is for, and covering a deadline at live cadence cost '
  '381 polls a matchweek where the deadline watch costs 56.';

-- ---------------------------------------------------------------------------
-- 2. Bounds, and the ordering between the three cadences.
-- ---------------------------------------------------------------------------

do $$
begin
  if not exists (
    select 1 from pg_constraint
     where conname = 'provider_poll_targets_deadline_watch_bounded'
  ) then
    alter table public.provider_poll_targets
      add constraint provider_poll_targets_deadline_watch_bounded
      check (
        deadline_cadence_minutes between 5 and 1440
        and deadline_lead_minutes between 0 and 1440
      );
  end if;

  -- Finest to coarsest, and the reason is the questions themselves: a score
  -- changes faster than a schedule, which changes faster than a season.
  if not exists (
    select 1 from pg_constraint
     where conname = 'provider_poll_targets_cadences_ordered'
  ) then
    alter table public.provider_poll_targets
      add constraint provider_poll_targets_cadences_ordered
      check (
        live_cadence_minutes <= deadline_cadence_minutes
        and deadline_cadence_minutes <= cadence_minutes
      );
  end if;
end;
$$;

-- ---------------------------------------------------------------------------
-- 3. Return live_lead_minutes to its own question.
-- ---------------------------------------------------------------------------

update public.provider_poll_targets
   set live_lead_minutes = 15
 where live_lead_minutes = 720;

alter table public.provider_poll_targets
  alter column live_lead_minutes set default 15;

-- Every enabled target takes the deadline watch, including any that predate
-- these columns. Idempotent: a target already reaching further is left alone.
update public.provider_poll_targets
   set deadline_lead_minutes = 720
 where deadline_lead_minutes < 720;

-- ---------------------------------------------------------------------------
-- 4. The predicate.
-- ---------------------------------------------------------------------------

create or replace function predictor_internal.provider_target_awaits_deadline(
  p_tournament_id uuid,
  p_now timestamptz,
  p_lead_minutes integer
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $awaits$
  select exists (
    select 1
      from public.season_fixtures fixture
     where fixture.tournament_id = p_tournament_id
       and fixture.home_score is null
       and p_now >= fixture.kickoff_at - pg_catalog.make_interval(mins => p_lead_minutes)
       and p_now <= fixture.kickoff_at
  );
$awaits$;

revoke all on function predictor_internal.provider_target_awaits_deadline(uuid, timestamptz, integer)
  from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- 5. Three tiers, finest applicable wins.
-- ---------------------------------------------------------------------------

create or replace function predictor_internal.due_provider_poll_targets(
  p_now timestamptz
)
returns table (target_id uuid, provider text, path text)
language sql
stable
security definer
set search_path = ''
as $due$
  select
    target.id,
    target.provider,
    predictor_internal.resolve_provider_poll_path(
      target.path, p_now, tournament.display_timezone
    )
    from public.provider_poll_targets target
    left join public.tournaments tournament
      on tournament.id = target.tournament_id
   where target.enabled
     and p_now is not null
     and (
       target.last_dispatched_at is null
       or target.last_dispatched_at <= p_now - pg_catalog.make_interval(
            mins => case
              -- Finest applicable wins. A fixture inside its live window is
              -- also inside nothing else that matters; a fixture whose deadline
              -- is still ahead gets the deadline watch; anything else is idle.
              when predictor_internal.provider_target_is_live(
                     target.tournament_id, p_now,
                     target.live_lead_minutes, target.live_tail_minutes
                   )
              then target.live_cadence_minutes
              when predictor_internal.provider_target_awaits_deadline(
                     target.tournament_id, p_now, target.deadline_lead_minutes
                   )
              then target.deadline_cadence_minutes
              else target.cadence_minutes
            end
          )
     )
   -- Longest-waiting first, so a target added late is not permanently starved
   -- behind one that polls often. The id tiebreak only makes the order
   -- deterministic; it expresses no priority.
   order by target.last_dispatched_at nulls first, target.id;
$due$;

revoke all on function predictor_internal.due_provider_poll_targets(timestamptz)
  from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- 6. Shape assertions, inside the migration transaction.
-- ---------------------------------------------------------------------------

do $$
declare
  v_bad integer;
  v_default text;
begin
  select count(*) into v_bad
    from public.provider_poll_targets
   where enabled and deadline_lead_minutes < 720;
  if v_bad <> 0 then
    raise exception
      'Contract 211: % enabled target(s) open their deadline watch too late to '
      'cover a matchweek lock.', v_bad;
  end if;

  select count(*) into v_bad
    from public.provider_poll_targets
   where enabled and live_lead_minutes <> 15;
  if v_bad <> 0 then
    raise exception
      'Contract 211: % enabled target(s) still carry contract 210''s 720-minute '
      'LIVE lead, which is the expensive way to cover a deadline.', v_bad;
  end if;

  select column_default into v_default
    from information_schema.columns
   where table_schema = 'public' and table_name = 'provider_poll_targets'
     and column_name = 'deadline_lead_minutes';
  if v_default is null or v_default not like '720%' then
    raise exception
      'Contract 211: deadline_lead_minutes default is %, so a new target would '
      'be created blind to its own deadline.', coalesce(v_default, 'null');
  end if;

  -- The property, against the installed predicate: for every enabled target
  -- with an unresolved fixture ahead, the deadline watch must be open at the
  -- first such kickoff -- the instant a zero-buffer matchweek lock resolves to.
  if exists (
    select 1
      from public.provider_poll_targets target
      join lateral (
        select pg_catalog.min(fixture.kickoff_at) as first_kickoff
          from public.season_fixtures fixture
         where fixture.tournament_id = target.tournament_id
           and fixture.home_score is null
      ) upcoming on upcoming.first_kickoff is not null
     where target.enabled
       and not predictor_internal.provider_target_awaits_deadline(
             target.tournament_id, upcoming.first_kickoff, target.deadline_lead_minutes
           )
  ) then
    raise exception
      'Contract 211: a target is not watching at the first unresolved kickoff of '
      'its own tournament, which is the instant its matchweek lock falls on.';
  end if;
end;
$$;
