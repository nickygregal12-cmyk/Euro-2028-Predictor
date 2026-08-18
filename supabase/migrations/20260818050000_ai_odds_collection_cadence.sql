-- Contract 200: collect prices often enough that a price is still a price.
--
-- THE DEFECT. The fixture-aware odds heartbeat asked for a paid-covered fixture
-- inside TWENTY-FOUR HOURS and did nothing at all when there was none. The AI
-- Lab forecasts ten days ahead. So from the moment a matchday cluster finishes
-- until twenty-four hours before the next one, no price was collected — and
-- `ai.price_age_limit_seconds` refuses any real-book quote older than twelve
-- hours. Every quote therefore aged out, every recommendation became
-- PASS_STALE_PRICE, and the Bet Builder emptied.
--
-- Measured on Production, 18 August 2026 at 10:00 UTC: 52 scheduled fixtures
-- across the five paid-covered leagues, the nearest kickoff on the 20th at
-- 19:00 — fifty-seven hours away — the last dispatch at 18:45 on the 17th, and
-- all 120 current recommendations PASS with PASS_STALE_PRICE dominating. Fresh
-- collection on the 17th had produced BET decisions from the same gate on the
-- same fixtures. The gate was right both times. The scheduler was asleep.
--
-- Widening the window is not the same as weakening the gate, and this contract
-- deliberately does the first and nothing to the second. The freshness limits
-- in `ai.price_age_limit_seconds` and `value_engine.FreshnessPolicy` are
-- untouched.
--
-- THE CADENCE, and why each tier is where it is. The only invariant that
-- matters is that the maximum gap between polls stays comfortably inside the
-- freshness limit that applies at the same distance from kickoff — otherwise
-- prices are guaranteed to be stale for part of every cycle no matter how the
-- gate is written. `ai.odds_poll_max_gap_seconds` states it, and a test asserts
-- the invariant at every tier boundary rather than trusting the arithmetic here.
--
--   nearest kickoff <= 2h    poll every 10 min   limit 20 min
--   nearest kickoff <= 8h    poll every 50 min   limit 60 min
--   nearest kickoff <= 24h   poll every  6 h     limit 12 h   (was 10 h)
--   nearest kickoff <= 7.5d  poll every  8 h     limit 12 h   (was: never)
--   nothing inside 7.5 days  no poll
--
-- 7.5 days rather than 7 so a Saturday fixture is already covered on the
-- previous Friday, when the free Football-Data feed publishes and an operator
-- is most likely to be looking.
--
-- THE COST, because a cadence that cannot be afforded is not a cadence. One
-- dispatch is five sport keys at two credits each: ten credits. The far tier
-- adds three dispatches a day, thirty credits, on days that previously cost
-- nothing. `ai.api_budget` on 18 August 2026 held 20,000 monthly credits with
-- an 18,000 soft cap and 740 spent since collection was re-enabled on the 13th.
-- `public.dispatch_ai_odds_polls` still calls `public.ai_odds_budget_check(10)`
-- before every dispatch and still fails closed on `collection_enabled` and on
-- the soft cap, so the ceiling is unchanged and enforced in one place.
--
-- Nothing here calls a provider. Installing a schedule spends no credit.

begin;

create or replace function ai.odds_poll_max_gap_seconds(
  p_hours_to_nearest_kickoff double precision)
returns integer
language sql
immutable
set search_path to ''
as $$
  select case
           when p_hours_to_nearest_kickoff is null then null
           when p_hours_to_nearest_kickoff <= 2.0   then 600     -- 10 min
           when p_hours_to_nearest_kickoff <= 8.0   then 3000    -- 50 min
           when p_hours_to_nearest_kickoff <= 24.0  then 21600   -- 6 hours
           when p_hours_to_nearest_kickoff <= 180.0 then 28800   -- 8 hours
           else null                                             -- no poll
         end::int
$$;

comment on function ai.odds_poll_max_gap_seconds(double precision) is
  'How long the paid odds collector may go between polls, given the hours to the '
  'nearest paid-covered kickoff. NULL means do not poll: nothing is close enough '
  'to be worth a credit. Every non-null tier is strictly smaller than the '
  'ai.price_age_limit_seconds allowance at the same distance, which is the one '
  'invariant that keeps a collected price usable rather than stale on arrival.';

-- The invariant, asserted here as well as in the test suite, because a cadence
-- that exceeds its own freshness limit collects prices that are already too old.
do $$
declare
  v_hours double precision;
  v_gap   integer;
  v_limit integer;
begin
  foreach v_hours in array array[
    0.5, 1.0, 2.0, 2.001, 4.0, 8.0, 8.001, 12.0, 24.0, 24.001, 72.0, 180.0
  ] loop
    v_gap := ai.odds_poll_max_gap_seconds(v_hours);
    v_limit := ai.price_age_limit_seconds(v_hours, false);
    if v_gap is null then
      raise exception 'no cadence tier covers % hours to kickoff', v_hours;
    end if;
    if v_gap >= v_limit then
      raise exception
        'cadence % s at % hours is not inside the % s freshness limit',
        v_gap, v_hours, v_limit;
    end if;
  end loop;

  if ai.odds_poll_max_gap_seconds(180.001) is not null then
    raise exception 'a fixture beyond 7.5 days must not be polled for';
  end if;
  if ai.odds_poll_max_gap_seconds(null) is not null then
    raise exception 'no upcoming fixture must not be polled for';
  end if;
end;
$$;

commit;
