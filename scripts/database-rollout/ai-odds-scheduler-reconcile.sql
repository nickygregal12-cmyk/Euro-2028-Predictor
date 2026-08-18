-- Hosted operational reconciliation for the AI paid-odds scheduler.
--
-- pg_cron jobs are managed extension state rather than schema state: Supabase
-- database dumps do not carry them. This script owns the hosted scheduler
-- configuration and is safe to run repeatedly.
--
-- Bet Builder can only present a stored BET while its underlying real-bookmaker
-- quote still satisfies ai.price_age_limit_seconds(): 12 hours when kickoff is
-- more than eight hours away, one hour inside eight hours, and twenty minutes
-- inside two hours. A Tuesday/Friday-only collection window cannot keep Saturday
-- matchday prices actionable, which is why the heartbeat is fixture-aware.
--
-- IT WAS ALSO ASLEEP FOR MOST OF THE WEEK. The window asked for a paid-covered
-- fixture inside twenty-four hours and did nothing when there was none, while
-- the lab forecasts ten days ahead. Between matchday clusters no price was
-- collected at all, every quote aged past the twelve-hour limit, and every
-- recommendation became PASS_STALE_PRICE. Production on 18 August 2026 at 10:00
-- UTC: 52 scheduled fixtures, nearest kickoff fifty-seven hours away, last
-- dispatch 18:45 on the 17th, all 120 current recommendations PASS. The same
-- gate had produced BET decisions from fresh prices the previous afternoon. The
-- gate was right; the scheduler was not running.
--
-- The window is now 180 hours — seven and a half days, so a Saturday fixture is
-- already covered on the previous Friday — and the cadence has a far tier:
--
--   nearest kickoff <= 2h     poll every 10 min   freshness limit 20 min
--   nearest kickoff <= 8h     poll every 50 min   freshness limit 60 min
--   nearest kickoff <= 24h    poll every  6 h     freshness limit 12 h
--   nearest kickoff <= 180h   poll every  8 h     freshness limit 12 h
--   nothing inside 180h       no poll
--
-- Every tier is strictly inside the freshness limit that applies at the same
-- distance, which is the invariant that keeps a collected price usable rather
-- than stale on arrival. Contract 200's ai.odds_poll_max_gap_seconds() states
-- the same table as a tested function; the seconds are INLINED in the cron
-- command below rather than called, so this hosted reconciliation never depends
-- on a migration having been applied first. `ai/test_db_lifecycle.py` reads this
-- file and asserts the inlined tiers equal the function's, so the two cannot
-- drift.
--
-- COST. One dispatch is five sport keys at two credits each: ten credits. The
-- far tier adds three dispatches a day on days that previously cost nothing.
-- public.dispatch_ai_odds_polls(boolean) uses p_force only to bypass its legacy
-- Tuesday/Friday wall-clock window; its ai_odds_budget_check(10) runs after that
-- branch for forced and non-forced calls alike, so the monthly allowance and the
-- soft cap remain the single spending authority and still fail closed. The cron
-- command never embeds a provider key.

do $reconcile$
declare
  desired_schedule constant text := '*/5 * * * *';
  desired_command constant text := $job$
  with due as (
    select min(extract(epoch from (f.kickoff_at - now())) / 3600.0) as nearest_hours
      from ai.fixtures f
     where f.status = 'scheduled'
       and f.kickoff_at > now()
       and f.kickoff_at <= now() + interval '180 hours'
       and f.league_key in ('EPL','ECH','EL1','EL2','SPL')
  ), cadence as (
    select make_interval(secs => case
             when nearest_hours <= 2.0   then 600
             when nearest_hours <= 8.0   then 3000
             when nearest_hours <= 24.0  then 21600
             when nearest_hours <= 180.0 then 28800
           end) as max_gap
      from due
     where nearest_hours is not null
  )
  select public.dispatch_ai_odds_polls(true)
    from cadence c
   where c.max_gap is not null
     and not exists (
     select 1
       from ai.odds_api_dispatches d
      where d.dispatched_at >= now() - c.max_gap
   );
  $job$;
  existing record;
  heartbeat_count integer;
  legacy_count integer;
begin
  select count(*) into heartbeat_count
    from cron.job
   where jobname = 'ai-odds-window-heartbeat'
     and schedule = desired_schedule
     and command = desired_command
     and active;

  select count(*) into legacy_count
    from cron.job
   where jobname in (
     'ai-odds-tuesday-bst', 'ai-odds-tuesday-gmt',
     'ai-odds-friday-bst', 'ai-odds-friday-gmt'
   );

  if heartbeat_count <> 1 or legacy_count <> 0 then
    for existing in
      select jobid
        from cron.job
       where jobname in (
         'ai-odds-tuesday-bst', 'ai-odds-tuesday-gmt',
         'ai-odds-friday-bst', 'ai-odds-friday-gmt',
         'ai-odds-window-heartbeat'
       )
    loop
      perform cron.unschedule(existing.jobid);
    end loop;

    perform cron.schedule(
      'ai-odds-window-heartbeat',
      desired_schedule,
      desired_command
    );
  end if;

  select count(*) into heartbeat_count
    from cron.job
   where jobname = 'ai-odds-window-heartbeat'
     and schedule = desired_schedule
     and command = desired_command
     and active;
  if heartbeat_count <> 1 then
    raise exception 'AI odds scheduler reconciliation failed: expected exactly one active heartbeat, got %', heartbeat_count;
  end if;

  select count(*) into legacy_count
    from cron.job
   where jobname in (
     'ai-odds-tuesday-bst', 'ai-odds-tuesday-gmt',
     'ai-odds-friday-bst', 'ai-odds-friday-gmt'
   );
  if legacy_count <> 0 then
    raise exception 'AI odds scheduler reconciliation failed: % legacy DST-twin jobs remain', legacy_count;
  end if;
end
$reconcile$;
