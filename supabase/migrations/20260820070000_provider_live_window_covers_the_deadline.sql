-- CONTRACT 210. The live poll window must open before the deadline it protects.
--
-- WHAT WENT WRONG, STATED PRECISELY.
--
-- Contract 209 taught the ingestion chain to apply a postponement. It did not
-- change how often the chain looks, and looking is the half that decides
-- whether a player ever sees one in time.
--
-- Contract 145 made polling adaptive, which was right: `cadence_minutes` is the
-- IDLE cadence (one call a day), and inside a live window the target polls at
-- `live_cadence_minutes` (ten minutes) instead. The window opens
-- `live_lead_minutes` before an unresolved fixture's kickoff.
--
-- `live_lead_minutes` defaulted to 15, and every seeded target carried 15.
-- Fifteen minutes is the right size for the question that default was written
-- for -- "has this match kicked off yet" -- and the wrong size for the question
-- a postponement asks, which is "is this match still happening at all".
--
-- Put that next to the deadline and the gap is exact. An ordinary fixture locks
-- at `season_matchweek_lock_at`, which is the EARLIEST KICKOFF OF THE MATCHWEEK
-- minus a buffer, and every caller in this schema passes a buffer of 0. So the
-- deadline IS the first kickoff of the round. With a 15-minute lead the feed
-- began watching fifteen minutes before that instant, and before then the only
-- look was the daily idle poll.
--
-- THE EXPOSURE, WITHOUT ROUNDING IN OUR OWN FAVOUR: a postponement announced
-- after the last idle poll and more than fifteen minutes before the matchweek's
-- first kickoff was not seen until after predictions had already locked. That
-- is up to a day of blindness ending fifteen minutes before the one instant it
-- mattered. This is the risk recorded as ING-006.
--
-- WHY NOT SIMPLY POLL MORE OFTEN. The obvious answer -- drop `cadence_minutes`
-- from 1440 to 360 -- is the one this contract deliberately does NOT take, and
-- the earlier note in the risk register proposing it was wrong. It would spend
-- four times the provider credit every day of the year, including the weeks
-- with no fixture near, to shrink a gap that only exists in the hours before a
-- lock -- and it would still leave up to six hours of silence immediately
-- before that lock, which is exactly where the gap does its damage. Frequency
-- everywhere is a worse instrument than coverage where it counts.
--
-- WHAT THIS CONTRACT DOES. It opens the live window as early as the schema
-- permits: `live_lead_minutes` becomes 720, the maximum allowed by
-- `provider_poll_targets_live_window_bounded`. From twelve hours before a
-- matchweek's first kickoff the feed is read every ten minutes, so the deadline
-- falls INSIDE a ten-minute window rather than behind up to a day of silence.
--
-- The window remains self-limiting in the way contract 145 designed: it is held
-- open only by fixtures that still have no score, so a matchday whose results
-- are all in goes quiet without anyone deciding it should.
--
-- WHAT THIS CONTRACT DOES NOT DO. It moves no scoring, lock, settlement,
-- progression or membership rule. It does not change `cadence_minutes`,
-- `live_cadence_minutes` or `live_tail_minutes`. It does not decide that a
-- postponement is real -- contract 209 owns that -- and it does not touch a
-- single fixture, prediction or player-owned row. It changes how early we look,
-- and nothing else.

-- ---------------------------------------------------------------------------
-- 1. The rule, applied to every target that is currently blind to it.
-- ---------------------------------------------------------------------------

-- Idempotent by construction: a target already at or above the deadline-covering
-- lead is left exactly as it is, so re-running this changes nothing and a target
-- deliberately raised higher by hand is never lowered.
update public.provider_poll_targets
   set live_lead_minutes = 720
 where live_lead_minutes < 720;

-- A target created after this contract inherits the safe value rather than the
-- one that caused the gap. Contract 145 chose 15 for a question about kickoff;
-- the default now answers the question about the deadline.
alter table public.provider_poll_targets
  alter column live_lead_minutes set default 720;

comment on column public.provider_poll_targets.live_lead_minutes is
  'How long before an unresolved fixture kickoff the live window opens, in '
  'minutes. CONTRACT 210: this must be large enough to cover the prediction '
  'deadline it protects. An ordinary fixture locks at the matchweek lock, which '
  'is the earliest kickoff of the round, so a lead shorter than the gap between '
  'the last idle poll and that kickoff leaves a postponement unseen until after '
  'predictions have locked. 720 is the maximum the bounding constraint allows '
  'and is the intended setting.';

-- ---------------------------------------------------------------------------
-- 2. Shape assertions. These run inside the migration transaction, so a
--    Production apply that did not achieve what this file claims fails here
--    rather than being discovered later by a player who lost a Joker.
-- ---------------------------------------------------------------------------

do $$
declare
  v_blind integer;
  v_default text;
begin
  select count(*) into v_blind
    from public.provider_poll_targets
   where enabled
     and live_lead_minutes < 720;
  if v_blind <> 0 then
    raise exception
      'Contract 210: % enabled poll target(s) still open their live window too '
      'late to cover a prediction deadline.', v_blind;
  end if;

  select column_default into v_default
    from information_schema.columns
   where table_schema = 'public'
     and table_name = 'provider_poll_targets'
     and column_name = 'live_lead_minutes';
  if v_default is null or v_default not like '720%' then
    raise exception
      'Contract 210: live_lead_minutes default is %, so a new target would be '
      'created blind to its own deadline.', coalesce(v_default, 'null');
  end if;

  -- The whole point of the change is that the window is open at the deadline.
  -- Proven here against the installed predicate rather than asserted in prose:
  -- for every enabled target whose tournament has an unresolved fixture ahead,
  -- the window must already be open twelve hours before that kickoff, and the
  -- earliest such kickoff is the matchweek lock a zero buffer resolves to.
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
       and not predictor_internal.provider_target_is_live(
             target.tournament_id,
             upcoming.first_kickoff,
             target.live_lead_minutes,
             target.live_tail_minutes
           )
  ) then
    raise exception
      'Contract 210: a target is still not live at the first unresolved kickoff '
      'of its own tournament, which is the instant its matchweek lock falls on.';
  end if;
end;
$$;
