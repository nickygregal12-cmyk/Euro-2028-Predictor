-- Hosted operational reconciliation for the AI paid-odds scheduler.
--
-- pg_cron jobs are managed extension state rather than schema state: Supabase
-- database dumps do not carry them. Keep database contract 190 unchanged; this
-- script owns the hosted scheduler configuration and is safe to run repeatedly.
--
-- Bet Builder can only present a stored BET while its underlying real-bookmaker
-- quote still satisfies ai.price_age_limit_seconds(): 12 hours when kickoff is
-- more than eight hours away, one hour inside eight hours, and twenty minutes
-- inside two hours. A Tuesday/Friday-only collection window therefore cannot
-- keep Saturday matchday prices actionable.
--
-- The heartbeat below is fixture-aware and deliberately slightly stricter than
-- those browser/value freshness limits:
--   * nearest paid-covered fixture <= 2h: refresh at most every 10 minutes;
--   * nearest paid-covered fixture <= 8h: refresh at most every 50 minutes;
--   * nearest paid-covered fixture <= 24h: refresh at most every 10 hours;
--   * no paid-covered fixture inside 24h: do nothing.
--
-- Automatic collection MUST be non-forced. public.dispatch_ai_odds_polls(false)
-- owns the collection-enabled/provider authority and enforces ai_odds_budget_check
-- before each league dispatch. Manual recovery can still explicitly force a poll
-- through the existing authority when an operator deliberately chooses to do so.

do $reconcile$
declare
  desired_schedule constant text := '*/5 * * * *';
  desired_command constant text := $job$
  with due as (
    select min(extract(epoch from (f.kickoff_at - now())) / 3600.0) as nearest_hours
      from ai.fixtures f
     where f.status = 'scheduled'
       and f.kickoff_at > now()
       and f.kickoff_at <= now() + interval '24 hours'
       and f.league_key in ('EPL','ECH','EL1','EL2','SPL')
  ), cadence as (
    select case
             when nearest_hours <= 2.0 then interval '10 minutes'
             when nearest_hours <= 8.0 then interval '50 minutes'
             else interval '10 hours'
           end as max_gap
      from due
     where nearest_hours is not null
  )
  select public.dispatch_ai_odds_polls(false, 'pg_cron:' || now()::text)
    from cadence c
   where not exists (
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