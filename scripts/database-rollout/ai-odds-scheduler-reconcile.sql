-- Hosted operational reconciliation for the AI paid-odds scheduler.
--
-- pg_cron jobs are managed extension state rather than schema state: Supabase
-- database dumps do not carry them, and the four Contract-185 DST-twin jobs
-- were measured active in Production while never appearing in
-- cron.job_run_details. Keep database contract 190 unchanged; this script owns
-- the hosted scheduler configuration and is safe to run repeatedly.
--
-- It never calls the provider itself. The installed heartbeat remains gated by
-- the existing public.dispatch_ai_odds_polls() London-time window and adds a
-- 15-minute retry band plus an append-only dispatch-ledger idempotency check.

do $reconcile$
declare
  desired_schedule constant text := '*/5 * * * *';
  desired_command constant text := $job$
  select public.dispatch_ai_odds_polls()
   where (
     (extract(isodow from now() at time zone 'Europe/London') = 2
      and extract(hour from now() at time zone 'Europe/London') = 13)
     or
     (extract(isodow from now() at time zone 'Europe/London') = 5
      and extract(hour from now() at time zone 'Europe/London') = 17)
   )
     and extract(minute from now() at time zone 'Europe/London') between 30 and 44
     and not exists (
       select 1
         from ai.odds_api_dispatches d
        where d.dispatched_at >= now() - interval '45 minutes'
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
