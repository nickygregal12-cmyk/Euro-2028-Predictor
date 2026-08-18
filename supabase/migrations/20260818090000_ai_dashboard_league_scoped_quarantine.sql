-- Contract 204: the AI Lab dashboards count the quarantine they are ABOUT.
--
-- `admin_ai_dashboard(p_league)` and `admin_ai_betting_dashboard(p_league)`
-- scope every number they return to the league they are asked about -- graded,
-- accuracy, calibration, CLV, profit, open bets -- with ONE exception:
--
--   'quarantined_predictions', (select count(*) from ai.prediction_invalidations)
--
-- which counted every quarantined forecast in the lab regardless of league.
--
-- That number exists to explain the numbers beside it. The comment it carries
-- says so: it is "why a settled count can fall without the pipeline having
-- stopped". A global figure cannot explain a league-scoped fall -- asked about
-- ECH it answers with ENL's quarantine too, and the reader has no way to tell.
--
-- HOW THIS WAS FOUND, because it says something about where to look next. It
-- was not found by CI. `236_quarantined_evidence_reads.sql` asserts the
-- dashboard reports 1 excluded forecast for its one seeded league, and that
-- assertion passed on every run -- because the database CI builds is empty
-- apart from the fixture, so the global count and the league count are the
-- same number. It failed for the first time in the 198-to-203 Production
-- REHEARSAL, against a disposable copy of Production carrying 37 real
-- quarantined forecasts, which reported 38 where the league had 1.
--
-- The test was right and had always been right. It was passing vacuously.
--
-- Nothing in the browser reads this field today, so no rendered number changes.
-- It is fixed because a read model that answers a league question with a
-- lab-wide number is wrong whether or not anything is currently displaying it,
-- and because the next surface to use it would have inherited the defect.
--
-- Additive: two SECURITY DEFINER functions redefined at their existing
-- signatures and return shapes. No relation is created or altered, no row is
-- touched, no grant changes, no threshold moves. Asked with p_league => null
-- both functions still return the lab-wide count, which is the same answer
-- they gave before.

begin;

-- THE COUNT NEEDS A LEAGUE, AND THE LEAGUE LIVES ON THE PREDICTION.
--
-- `ai.prediction_invalidations` records prediction_id and reason, not league,
-- so scoping the count needs the prediction row. It cannot come from
-- `ai.valid_predictions`, which exists precisely to EXCLUDE quarantined
-- forecasts -- joining it would return zero, always.
--
-- Nor may an `admin_ai_*` read reach `ai.predictions` directly:
-- `236_quarantined_evidence_reads.sql` asserts, over installed definitions
-- rather than migration text, that every admin AI read goes through valid
-- custody, with `admin_ai_recommendation_log` the single earned exception.
-- Writing the join inline broke that guard, which is how this view came to
-- exist rather than being reasoned about in advance.
--
-- So the withdrawn rows get the same treatment the valid ones already have: one
-- named view in schema `ai` that the reads go through. `ai.valid_predictions`
-- is custody for what still counts; this is custody for what stopped counting.
create or replace view ai.quarantined_predictions as
  select i.prediction_id,
         i.reason_code,
         i.invalidated_at,
         p.league,
         p.fixture_id
    from ai.prediction_invalidations i
    join ai.predictions p on p.id = i.prediction_id;

comment on view ai.quarantined_predictions is
  'Quarantined forecasts with the league they belong to. The counterpart of
   ai.valid_predictions: that view is what still counts, this is what stopped.
   Admin reads scope their exclusion counts through THIS rather than joining
   ai.predictions, which 236_quarantined_evidence_reads.sql forbids them.';

revoke all on ai.quarantined_predictions from public, anon, authenticated;


create or replace function public.admin_ai_dashboard(p_league text default null)
returns jsonb
language plpgsql
stable
security definer
set search_path to ''
as $$
declare
  v_models jsonb;
  v_perf   jsonb;
  v_calib  jsonb;
  v_jobs   jsonb;
  v_gate   jsonb;
begin
  perform predictor_internal.require_competition_admin();

  select coalesce(jsonb_agg(to_jsonb(m) order by m.league, m.trained_at desc), '[]'::jsonb)
    into v_models
    from (select id, league, version, family, family as model_family, trained_at,
                 training_matches, val_accuracy, val_log_loss, val_rps,
                 baseline_log_loss, market_log_loss, status
            from ai.models
           where p_league is null or league = p_league) m;

  -- Every figure below is measured over VALID forecasts only. A quarantined
  -- forecast may well acquire a `prediction_results` row once its match is
  -- played — the grading job has no reason to skip it and the prediction is
  -- immutable — and that row is still not evidence about the model.
  select jsonb_build_object(
      'graded',          count(*),
      'result_correct',  count(*) filter (where r.result_correct),
      'accuracy',        round(avg(case when r.result_correct then 1 else 0 end)::numeric, 5),
      'exact_scores',    count(*) filter (where r.exact_score_correct),
      'mean_log_loss',   round(avg(r.log_loss)::numeric, 5),
      'mean_rps',        round(avg(r.rps)::numeric, 5),
      'mean_brier',      round(avg(r.brier)::numeric, 5))
    into v_perf
    from ai.prediction_results r
    join ai.valid_predictions p on p.id = r.prediction_id
   where p_league is null or p.league = p_league;

  -- Calibration: for each confidence decile of the probability the model
  -- assigned to its OWN pick, how often was that pick right? These two
  -- numbers converging is the whole point of the exercise, and a cluster of
  -- 99% forecasts produced by a club with no history is exactly the input
  -- that would make them appear to converge when they had not.
  select coalesce(jsonb_agg(to_jsonb(c) order by c.bucket), '[]'::jsonb)
    into v_calib
    from (
      select width_bucket(greatest(p.p_home, p.p_draw, p.p_away), 0.2, 1.0, 8) as bucket,
             round(min(greatest(p.p_home, p.p_draw, p.p_away))::numeric, 3) as min_conf,
             round(max(greatest(p.p_home, p.p_draw, p.p_away))::numeric, 3) as max_conf,
             count(*) as n,
             round(avg(greatest(p.p_home, p.p_draw, p.p_away))::numeric, 4) as mean_predicted,
             round(avg(case when r.result_correct then 1 else 0 end)::numeric, 4) as actual_rate
        from ai.valid_predictions p
        join ai.prediction_results r on r.prediction_id = p.id
       where p_league is null or p.league = p_league
       group by 1) c;

  select coalesce(jsonb_object_agg(j.job, to_jsonb(j) - 'job'), '{}'::jsonb)
    into v_jobs
    from (select distinct on (job) job, started_at, finished_at, status,
                 rows_written, message
            from ai.job_runs
           order by job, started_at desc) j;

  select to_jsonb(g) into v_gate from ai.publication_gate g;

  return jsonb_build_object(
    'as_of',       now(),
    'models',      v_models,
    'performance', coalesce(v_perf, '{}'::jsonb),
    'calibration', v_calib,
    'jobs',        v_jobs,
    'gate',        v_gate,
    -- Stated rather than implied, because "graded: 14" with no denominator is
    -- indistinguishable from a pipeline that has stopped grading.
    'quarantined_predictions', (select count(*)
                                   from ai.quarantined_predictions q
                                  where p_league is null or q.league = p_league),
    'evidence_basis', 'ai.valid_predictions');
end;
$$;

create or replace function public.admin_ai_betting_dashboard(p_league text default null)
returns jsonb
language plpgsql stable security definer
set search_path to ''
as $$
declare
  v_clv jsonb; v_pnl jsonb; v_open jsonb; v_gate jsonb; v_books jsonb;
  v_n integer; v_mean numeric; v_sd numeric;
begin
  perform predictor_internal.require_competition_admin();

  select count(*), avg(r.clv), stddev_samp(r.clv)
    into v_n, v_mean, v_sd
    from ai.valid_bets b join ai.bet_results r on r.bet_id = b.id
   where r.clv is not null and (p_league is null or b.league = p_league);

  -- Normal-approximation interval on CLV. Reported with n because a mean
  -- without a sample size is a rumour.
  v_clv := jsonb_build_object(
    'n', coalesce(v_n, 0),
    'mean_clv', round(coalesce(v_mean, 0), 5),
    'ci_low',  case when v_n > 1 then round(v_mean - 1.96 * v_sd / sqrt(v_n::numeric), 5) end,
    'ci_high', case when v_n > 1 then round(v_mean + 1.96 * v_sd / sqrt(v_n::numeric), 5) end,
    'beat_close_rate', (
      select round(avg(case when r2.beat_closing_price then 1 else 0 end)::numeric, 4)
        from ai.valid_bets b2 join ai.bet_results r2 on r2.bet_id = b2.id
       where r2.beat_closing_price is not null
         and (p_league is null or b2.league = p_league)),
    'significant', case when v_n > 1 then (v_mean - 1.96 * v_sd / sqrt(v_n::numeric)) > 0 else false end);

  select jsonb_build_object(
      'settled_bets', count(*),
      'staked', round(coalesce(sum(b.stake_units), 0), 3),
      'pnl', round(coalesce(sum(r.pnl_units), 0), 3),
      'roi', round(coalesce(avg(r.return_per_unit), 0), 5),
      'hit_rate', round(coalesce(avg(case when r.won then 1 else 0 end)::numeric, 0), 4),
      'mean_odds', round(coalesce(avg(b.odds_taken), 0), 3),
      'mean_claimed_edge', round(coalesce(avg(b.edge), 0), 5),
      'mean_model_edge_vs_average', round(coalesce(avg(b.edge_vs_average), 0), 5),
      'mean_line_shopping_edge', round(coalesce(avg(b.edge_line_shopping), 0), 5),
      -- Stated next to the ROI so the ROI is never read on its own.
      'bets_needed_for_80pct_power', case
        when coalesce(avg(r.return_per_unit), 0) > 0 and stddev_samp(r.return_per_unit) > 0
        then ceil(power((1.6449 + 0.8416) * stddev_samp(r.return_per_unit)
                        / avg(r.return_per_unit), 2))
        end)
    into v_pnl
    from ai.valid_bets b join ai.bet_results r on r.bet_id = b.id
   where p_league is null or b.league = p_league;

  -- Open exposure is money the lab currently says is at risk. A bet advised
  -- from a withdrawn forecast is not a position anyone should be holding, so
  -- it is not reported as one; the row itself stays in `ai.bets`.
  select jsonb_build_object(
      'open_bets', count(*),
      'exposure', round(coalesce(sum(b.stake_units), 0), 3))
    into v_open
    from ai.valid_bets b
   where b.status = 'advised' and (p_league is null or b.league = p_league);

  select jsonb_build_object(
      'total', count(*),
      'licence_verified', count(*) filter (where gb_licence_verified),
      'unverified_real_books', coalesce(jsonb_agg(code) filter (
        where is_real_price and not gb_licence_verified), '[]'::jsonb))
    into v_books from ai.bookmakers;

  select to_jsonb(g) into v_gate from ai.publication_gate g;

  return jsonb_build_object(
    'as_of', now(), 'clv', v_clv, 'profit', coalesce(v_pnl, '{}'::jsonb),
    'open', v_open, 'bookmakers', v_books, 'gate', v_gate,
    -- Deliberately the quarantined FORECAST count rather than a count of the
    -- bets excluded, which would have to be measured against `ai.bets` — and
    -- `236_quarantined_evidence_reads.sql` asserts that no admin AI read
    -- touches that table at all. An absolute structural rule is worth more
    -- than a convenience number, and this one carries the same warning: it is
    -- why a settled count can fall without the pipeline having stopped.
    'quarantined_predictions', (select count(*)
                                   from ai.quarantined_predictions q
                                  where p_league is null or q.league = p_league),
    'evidence_basis', 'ai.valid_bets');
end;
$$;

commit;
