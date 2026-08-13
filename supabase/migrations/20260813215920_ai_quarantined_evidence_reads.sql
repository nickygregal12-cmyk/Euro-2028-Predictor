-- Contract 189: quarantined forecasts leave every admin AI evidence read.
--
-- Additive and function-replacement only. It creates one private view and
-- replaces eight competition-admin reads in place. No table, column, trigger,
-- constraint, policy or grant moves; no prediction, bet, result or
-- invalidation row is written, edited or deleted; and no scoring, lock,
-- settlement, progression or reveal rule is touched. Schema `ai` keeps the
-- authority ADR 0029 gave it, which is none over platform football.
--
-- CONTRACT NUMBERING IS POSITIONAL. `documentationContractFreshness.test.ts`
-- asserts contractVersion == requiredMigrationCount == the number of committed
-- migration files. At the time of writing `main` is `304d58c` with 188
-- migrations and the two other open pull requests (#770 model research, #736
-- Euro routing) add none, so this file is 189. If something else lands first
-- it renumbers on rebase together with `config/deployment-contract.json` and
-- the three live-authority documents.
--
-- ===========================================================================
-- WHAT WAS ACTUALLY WRONG
--
-- Contract 188 quarantined 37 Production forecasts built on a broken provider
-- identity, wrote `ai.prediction_invalidations` to record why, and created
-- `ai.valid_predictions` as "the one object every evidence path is supposed to
-- read". Three reads were then built on it — the Bet Builder, its book list
-- and the prediction audit — and this repository's own documents went on to
-- say that accuracy, log loss, calibration, CLV, recommendations and
-- publication evidence all read through it.
--
-- Measured against the INSTALLED Production definitions on 13 August 2026,
-- that was not true of seven of them:
--
--   admin_ai_dashboard              graded/accuracy/log loss/RPS/Brier from
--                                   `ai.prediction_results join ai.predictions`,
--                                   and calibration buckets the same way
--   admin_ai_performance_breakdown  its `graded` CTE, so every league, horizon,
--                                   pick, Elo band, season stage and newcomer
--                                   split
--   admin_ai_recent_results         the graded list an administrator reads
--   admin_ai_upcoming_predictions   the live forecast display
--   admin_ai_betting_dashboard      CLV, its interval, beat-close rate,
--                                   settled count, staked, P&L, ROI, hit rate,
--                                   mean odds, claimed edge, line-shopping
--                                   edge, the power calculation and open
--                                   exposure — all `ai.bets` unfiltered
--   admin_ai_evidence_by_market     per-market settled bets, CLV, interval and
--                                   the `meets_evidence_bar` verdict
--   admin_ai_betting_gate_status    the worst of them and not in the original
--                                   finding: it counts `ai.bet_results` with
--                                   no join to `ai.bets` at all, so the
--                                   PUBLICATION gate's settled-bet count and
--                                   mean CLV were derived from every bet ever
--                                   recorded, quarantined or not
--
-- The defect is currently masked on Production by a coincidence rather than by
-- a control: `ai.prediction_results` holds zero rows, because all 37
-- quarantined forecasts are still upcoming. The earliest of them kicks off at
-- 2026-08-14T19:00Z. At that settlement the masking ends and a forecast the
-- platform has formally declared unusable starts counting toward the numbers
-- that decide whether a model is promoted and whether any of this is ever
-- published. 35 of the 49 recorded bets already point at a quarantined
-- forecast and would have joined it.
--
-- WHY A VIEW FOR BETS AND NOT SIX FILTERS. `ai.bets.prediction_id` is `not
-- null` and a foreign key, so "a bet whose forecast is still valid" is exactly
-- one join and has no null case to argue about. There are six such join sites
-- across three functions, and a `not in (...)` written six times is six places
-- for the seventh to be forgotten — which is how this contract came to exist.
-- `ai.valid_bets` is defined ON `ai.valid_predictions` rather than on
-- `ai.prediction_invalidations` directly, so there is still ONE authority: if
-- what counts as valid ever changes, bets follow without being edited.
--
-- WHY INVALIDATION MUST STAY DYNAMIC. Nothing here copies a flag onto a result
-- or a bet row. `ai.prediction_invalidations` is append-only and is read live,
-- so a forecast quarantined AFTER its result, bet and bet result already exist
-- stops counting on the next call rather than on the next backfill. That
-- ordering — result first, quarantine second, read third — is what
-- `236_quarantined_evidence_reads.sql` asserts, because a suite that
-- quarantines first would pass against a design that copied flags forward.
--
-- WHAT IS DELIBERATELY NOT DONE. No quarantined prediction, bet, result or
-- invalidation is deleted, edited or restated: a pipeline that was wrong is a
-- scientific record, and every one of the 37 stays readable through the base
-- tables and through `admin_ai_recommendation_log`, which is a decision log
-- rather than a performance metric. That log keeps its rows and gains a
-- `prediction_quarantined` flag instead, so an administrator can see a
-- quarantined decision as a quarantined decision; its aggregate — the 90-day
-- reason-code counts, which IS a metric — excludes them.
-- ===========================================================================

begin;

-- ---------------------------------------------------------------------------
-- 1. The bet-side companion to contract 188's `ai.valid_predictions`.
-- ---------------------------------------------------------------------------
create or replace view ai.valid_bets as
  select b.*
    from ai.bets b
   where exists (select 1 from ai.valid_predictions p where p.id = b.prediction_id);

comment on view ai.valid_bets is
  'ai.bets minus every bet advised from a quarantined forecast. CLV, its
   interval, beat-closing rate, profit, ROI, hit rate, mean odds, claimed
   edge, open exposure, per-market evidence and the publication gate read
   THIS, never the base table. Defined on ai.valid_predictions rather than on
   ai.prediction_invalidations so there is one authority for what counts.';

-- ---------------------------------------------------------------------------
-- 2. Prediction evidence.
-- ---------------------------------------------------------------------------
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
    'quarantined_predictions', (select count(*) from ai.prediction_invalidations),
    'evidence_basis', 'ai.valid_predictions');
end;
$$;

create or replace function public.admin_ai_performance_breakdown(
  p_league text default null)
returns jsonb
language plpgsql stable security definer
set search_path to ''
as $$
declare
  v_out jsonb := '{}'::jsonb;
begin
  perform predictor_internal.require_competition_admin();

  with graded as (
    select p.league,
           p.horizon,
           p.predicted_result,
           r.actual_result,
           r.result_correct,
           r.log_loss,
           r.rps,
           greatest(p.p_home, p.p_draw, p.p_away) as confidence,
           (p.features ->> 'elo_diff')::numeric   as elo_diff,
           (p.features ->> 'season_progress')::numeric as season_progress,
           ((p.features ->> 'home_is_newcomer')::numeric
            + (p.features ->> 'away_is_newcomer')::numeric) > 0 as involves_newcomer
      from ai.valid_predictions p
      join ai.prediction_results r on r.prediction_id = p.id
     where p_league is null or p.league = p_league
  )
  select jsonb_build_object(
    'overall', (select jsonb_build_object(
        'n', count(*), 'accuracy', round(avg(result_correct::int)::numeric, 4),
        'log_loss', round(avg(log_loss), 4), 'rps', round(avg(rps), 4)) from graded),

    'by_league', (select coalesce(jsonb_object_agg(league, j), '{}'::jsonb) from (
        select league, jsonb_build_object(
          'n', count(*), 'accuracy', round(avg(result_correct::int)::numeric, 4),
          'log_loss', round(avg(log_loss), 4)) as j
        from graded group by league) s),

    'by_horizon', (select coalesce(jsonb_object_agg(horizon, j), '{}'::jsonb) from (
        select horizon, jsonb_build_object(
          'n', count(*), 'accuracy', round(avg(result_correct::int)::numeric, 4),
          'log_loss', round(avg(log_loss), 4)) as j
        from graded group by horizon) s),

    'by_pick', (select coalesce(jsonb_object_agg(predicted_result, j), '{}'::jsonb) from (
        select predicted_result, jsonb_build_object(
          'n', count(*), 'accuracy', round(avg(result_correct::int)::numeric, 4)) as j
        from graded group by predicted_result) s),

    -- Favourite vs underdog by Elo, not by who the model picked. This is the
    -- split a broken identity distorts hardest: a club rated at a placeholder
    -- 1180 lands in the wrong band as well as with the wrong probability.
    'by_elo_gap', (select coalesce(jsonb_object_agg(band, j), '{}'::jsonb) from (
        select case when abs(elo_diff) < 50 then 'even (<50)'
                    when abs(elo_diff) < 150 then 'slight (50-150)'
                    when abs(elo_diff) < 300 then 'clear (150-300)'
                    else 'mismatch (300+)' end as band,
               jsonb_build_object(
                 'n', count(*), 'accuracy', round(avg(result_correct::int)::numeric, 4),
                 'log_loss', round(avg(log_loss), 4)) as j
        from graded where elo_diff is not null group by 1) s),

    'by_season_stage', (select coalesce(jsonb_object_agg(band, j), '{}'::jsonb) from (
        select case when season_progress < 0.2 then 'early'
                    when season_progress < 0.75 then 'mid'
                    else 'late' end as band,
               jsonb_build_object(
                 'n', count(*), 'accuracy', round(avg(result_correct::int)::numeric, 4),
                 'log_loss', round(avg(log_loss), 4)) as j
        from graded where season_progress is not null group by 1) s),

    'promoted_clubs', (select coalesce(jsonb_object_agg(band, j), '{}'::jsonb) from (
        select case when involves_newcomer then 'involves newcomer' else 'established only' end as band,
               jsonb_build_object(
                 'n', count(*), 'accuracy', round(avg(result_correct::int)::numeric, 4),
                 'log_loss', round(avg(log_loss), 4)) as j
        from graded where involves_newcomer is not null group by 1) s),

    'evidence_basis', 'ai.valid_predictions'
  ) into v_out;

  return v_out;
end;
$$;

create or replace function public.admin_ai_recent_results(
  p_league text default null, p_limit integer default 50)
returns jsonb language plpgsql stable security definer set search_path to '' as $$
begin
  perform predictor_internal.require_competition_admin();
  return coalesce((
    select jsonb_agg(to_jsonb(x) order by x.kickoff_at desc)
      from (
        select p.id, p.league, p.kickoff_at,
               p.home_canonical as home, p.away_canonical as away,
               p.p_home, p.p_draw, p.p_away, p.predicted_result,
               p.predicted_score, r.actual_home_goals, r.actual_away_goals,
               r.actual_result, r.result_correct, r.exact_score_correct,
               r.log_loss, r.rps, m.version as model_version
          from ai.valid_predictions p
          join ai.prediction_results r on r.prediction_id=p.id
          join ai.models m on m.id=p.model_id
         where p_league is null or p.league=p_league
         order by p.kickoff_at desc
         limit greatest(1, least(coalesce(p_limit, 50), 200))) x), '[]'::jsonb);
end;
$$;

-- Not merely performance evidence: this is what an administrator reads as the
-- lab's CURRENT forecasts. A quarantined forecast shown here is a forecast the
-- platform has withdrawn being presented as one it stands behind.
create or replace function public.admin_ai_upcoming_predictions(
  p_league text default null, p_limit integer default 50)
returns jsonb language plpgsql stable security definer set search_path to '' as $$
begin
  perform predictor_internal.require_competition_admin();
  return coalesce((
    select jsonb_agg(to_jsonb(x) order by x.kickoff_at)
      from (
        select p.id, p.league, p.kickoff_at,
               p.home_canonical as home, p.away_canonical as away,
               p.p_home, p.p_draw, p.p_away, p.predicted_result,
               p.predicted_score, p.exp_home_goals, p.exp_away_goals,
               p.scoreline_grid, m.version as model_version,
               f.status as fixture_status
          from ai.valid_predictions p
          join ai.models m on m.id=p.model_id
          join ai.fixtures f on f.id=p.fixture_id
         where p.kickoff_at >= now() - interval '2 hours'
           and (p_league is null or p.league=p_league)
         order by p.kickoff_at
         limit greatest(1, least(coalesce(p_limit, 50), 200))) x), '[]'::jsonb);
end;
$$;

-- ---------------------------------------------------------------------------
-- 3. Betting evidence. Every one of these reads `ai.valid_bets`.
-- ---------------------------------------------------------------------------
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
    'quarantined_predictions', (select count(*) from ai.prediction_invalidations),
    'evidence_basis', 'ai.valid_bets');
end;
$$;

-- Confidence intervals use the number of observed CLVs, not every settled
-- bet. Both counts are exposed so missing closing lines are visible.
create or replace function public.admin_ai_evidence_by_market()
returns jsonb language plpgsql stable security definer set search_path to '' as $$
begin
  perform predictor_internal.require_competition_admin();
  return coalesce((
    select jsonb_object_agg(m.code, jsonb_build_object(
      'name', m.name,
      'free_historical_odds', m.free_historical_odds,
      'derived_from_scoreline', m.derived_from_scoreline,
      'typical_overround', m.typical_overround,
      'settled_bets', coalesce(s.settled_bets, 0),
      'clv_observations', coalesce(s.clv_n, 0),
      'mean_clv', round(coalesce(s.mean_clv, 0), 5),
      'clv_ci_low', case when s.clv_n > 1
                    then round(s.mean_clv - 1.96*s.sd_clv/sqrt(s.clv_n::numeric), 5) end,
      'flat_unit_roi', round(coalesce(s.flat_roi, 0), 5),
      'stake_weighted_roi', case when coalesce(s.staked, 0) > 0
                            then round(s.pnl/s.staked, 5) end,
      'required_bets', g.min_settled_bets,
      'required_clv', g.min_mean_clv,
      'trusted', g.trusted,
      'evidence_basis', 'ai.valid_bets',
      'meets_evidence_bar', (
        coalesce(s.clv_n, 0) >= g.min_settled_bets
        and coalesce(s.mean_clv, -1) >= g.min_mean_clv
        and (not g.require_ci_above_zero or
             (s.clv_n > 1 and
              s.mean_clv - 1.96*s.sd_clv/sqrt(s.clv_n::numeric) > 0)))))
      from ai.markets m
      join ai.evidence_gate g on g.market=m.code
      left join (
        select b.market as code, count(*) as settled_bets,
               count(r.clv) as clv_n, avg(r.clv) as mean_clv,
               stddev_samp(r.clv) as sd_clv,
               avg(r.return_per_unit) as flat_roi,
               sum(r.pnl_units) as pnl, sum(b.stake_units) as staked
          from ai.valid_bets b join ai.bet_results r on r.bet_id=b.id
         group by b.market) s on s.code=m.code), '{}'::jsonb);
end;
$$;

-- Publishing is gated on evidence AND on compliance, in one place.
--
-- The count below used to come from `ai.bet_results` alone, with no join to
-- `ai.bets` at all — so the gate that decides whether a betting record may be
-- shown to the public was counting settled bets and averaging CLV over rows it
-- could not attribute to a forecast, quarantined ones included. Of the three
-- betting reads this was the one where an inflated number does actual harm.
create or replace function public.admin_ai_betting_gate_status()
returns jsonb
language plpgsql stable security definer
set search_path to ''
as $$
declare g record; v_n integer; v_mean numeric; v_sd numeric; v_lo numeric;
        v_unverified integer;
begin
  perform predictor_internal.require_competition_admin();
  select * into g from ai.publication_gate;

  select count(*), avg(r.clv), stddev_samp(r.clv) into v_n, v_mean, v_sd
    from ai.bet_results r
    join ai.valid_bets b on b.id = r.bet_id
   where r.clv is not null;
  v_lo := case when v_n > 1 then v_mean - 1.96 * v_sd / sqrt(v_n::numeric) end;

  select count(*) into v_unverified
    from ai.bookmakers where is_real_price and not gb_licence_verified;

  return jsonb_build_object(
    'settled_bets',        jsonb_build_object('value', coalesce(v_n,0),
                             'required', g.min_settled_bets,
                             'met', coalesce(v_n,0) >= g.min_settled_bets),
    'mean_clv',            jsonb_build_object('value', round(coalesce(v_mean,0),5),
                             'required', g.min_mean_clv,
                             'met', coalesce(v_mean,0) >= g.min_mean_clv),
    'clv_ci_above_zero',   jsonb_build_object('value', round(coalesce(v_lo,0),5),
                             'met', coalesce(v_lo, -1) > 0 or not g.require_clv_ci_above_zero),
    'bookmaker_licences',  jsonb_build_object('unverified', v_unverified,
                             'met', v_unverified = 0),
    'age_gate',            jsonb_build_object('met', g.age_gate_live),
    'safer_gambling_signpost', jsonb_build_object('value', g.safer_gambling_signpost,
                             'met', coalesce(btrim(g.safer_gambling_signpost),'') <> ''),
    'full_record_published', jsonb_build_object('met', g.results_page_shows_full_record),
    'currently_public',    g.betting_public_enabled,
    'evidence_basis',      'ai.valid_bets');
end;
$$;

-- ---------------------------------------------------------------------------
-- 4. The decision log keeps every row, and labels the withdrawn ones.
--
--    This one is deliberately NOT narrowed to `ai.valid_predictions`. It
--    exists to record that a decision was taken — including the decision not
--    to bet — and dropping rows from an append-only log because their subject
--    was later withdrawn is how the reason a thing happened gets lost. What is
--    a metric here is the 90-day reason-code tally, and that excludes them.
-- ---------------------------------------------------------------------------
create or replace function public.admin_ai_recommendation_log(
  p_league text default null,
  p_limit  integer default 100)
returns jsonb
language plpgsql
stable
security definer
set search_path to ''
as $$
declare
  v_rows    jsonb;
  v_reasons jsonb;
  v_limit   integer := least(greatest(coalesce(p_limit, 100), 1), 500);
begin
  perform predictor_internal.require_competition_admin();

  select coalesce(jsonb_agg(to_jsonb(r) order by r.decided_at desc), '[]'::jsonb)
    into v_rows
    from (select rec.id, rec.league, rec.market, rec.selection, rec.decision,
                 rec.reason_codes, rec.decided_at, rec.kickoff_at,
                 rec.hours_to_kickoff, rec.bookmaker, rec.odds_offered,
                 rec.odds_captured_at, rec.odds_age_seconds,
                 rec.calibrated_prob, rec.fair_odds, rec.expected_value,
                 rec.data_confidence, rec.data_confidence_state,
                 rec.agreement_score, rec.uncertainty_width,
                 p.home_canonical, p.away_canonical, p.horizon,
                 exists (select 1 from ai.prediction_invalidations i
                          where i.prediction_id = rec.prediction_id)
                   as prediction_quarantined
            from ai.recommendations rec
            join ai.predictions p on p.id = rec.prediction_id
           where p_league is null or rec.league = p_league
           order by rec.decided_at desc
           limit v_limit) r;

  -- Which gate fires most is the single most useful thing this log knows: it
  -- says whether the lab is passing on price, on data or on disagreement, and
  -- those three have completely different fixes. A withdrawn forecast's reason
  -- code answers none of those questions, so it is not counted here.
  select coalesce(jsonb_object_agg(code, n), '{}'::jsonb)
    into v_reasons
    from (select unnest(rec.reason_codes) as code, count(*) as n
            from ai.recommendations rec
            join ai.valid_predictions p on p.id = rec.prediction_id
           where (p_league is null or rec.league = p_league)
             and rec.decided_at > now() - interval '90 days'
           group by 1) c;

  return jsonb_build_object(
    'recommendations', v_rows,
    'reason_code_counts_90d', v_reasons,
    'reason_code_counts_basis', 'ai.valid_predictions',
    'quarantined_in_page', (
      select count(*) from jsonb_array_elements(v_rows) e
       where (e ->> 'prediction_quarantined')::boolean),
    'generated_at', now());
end;
$$;

-- ---------------------------------------------------------------------------
-- 5. Nothing about who may call these changes.
--
--    Every function above keeps `security definer`, the empty `search_path`
--    and `predictor_internal.require_competition_admin()`, and none of their
--    signatures moves, so the existing grants survive `create or replace`
--    untouched. They are restated anyway — an EXECUTE grant that depends on
--    nobody having revoked it in between is not a control — and the whole
--    schema is re-revoked so the new view cannot be reached from a browser.
-- ---------------------------------------------------------------------------
revoke all on function public.admin_ai_dashboard(text) from public, anon;
revoke all on function public.admin_ai_performance_breakdown(text) from public, anon;
revoke all on function public.admin_ai_recent_results(text, integer) from public, anon;
revoke all on function public.admin_ai_upcoming_predictions(text, integer) from public, anon;
revoke all on function public.admin_ai_betting_dashboard(text) from public, anon;
revoke all on function public.admin_ai_evidence_by_market() from public, anon;
revoke all on function public.admin_ai_betting_gate_status() from public, anon;
revoke all on function public.admin_ai_recommendation_log(text, integer) from public, anon;

grant execute on function public.admin_ai_dashboard(text) to authenticated;
grant execute on function public.admin_ai_performance_breakdown(text) to authenticated;
grant execute on function public.admin_ai_recent_results(text, integer) to authenticated;
grant execute on function public.admin_ai_upcoming_predictions(text, integer) to authenticated;
grant execute on function public.admin_ai_betting_dashboard(text) to authenticated;
grant execute on function public.admin_ai_evidence_by_market() to authenticated;
grant execute on function public.admin_ai_betting_gate_status() to authenticated;
grant execute on function public.admin_ai_recommendation_log(text, integer) to authenticated;

revoke all on all tables in schema ai from anon, authenticated;
grant all on all tables in schema ai to service_role;

commit;
