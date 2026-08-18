-- Contract 201: the private AI Lab stops needing SQL to be understood.
--
-- THE QUESTION THE LAB COULD NOT ANSWER. An operator looking at Bet Builder on
-- 18 August 2026 saw almost nothing, and had no way to tell which of these was
-- true: the model found no value, or the pipeline was broken. Both look like an
-- empty list. Answering it needed five separate queries against schema `ai`,
-- which no browser role can read, so in practice it needed a database console.
--
-- Three bounded competition-admin reads close that.
--
--   admin_ai_fixture_coverage      every relevant fixture, and why each one is
--                                  or is not actionable right now
--   admin_ai_operational_health    is each stage of the pipeline current
--   admin_ai_results_review        what happened, one row per fixture
--
-- FIXTURE-FIRST, NOT PREDICTION-FIRST, and that distinction is the substance
-- rather than a style choice. `ai.predictions` is unique on (model_id, fixture,
-- horizon), so a fixture carries one row per model version that has forecast it.
-- Production held 24 predictions for ECH's 12 upcoming fixtures and 30 for
-- EPL's 10. `admin_ai_upcoming_predictions` returns one row per PREDICTION and
-- therefore lists the same match two or three times, and the same multiplicity
-- reaches every aggregate computed over `ai.prediction_results`: a read-only
-- audit of ECH on 17 August reported "5 graded, 0 result correct" for what was
-- ONE fixture — Cardiff v Wrexham — forecast five times.
--
-- That fixture is also the reason `result_correct = false` beside
-- `exact_score_correct = true` is NOT a grading defect, which is what it was
-- reported as. The model gave H 40.3%, D 27.2%, A 32.5% and a modal scoreline
-- of 1-1; the match finished 1-1. `predicted_result` is the argmax of the three
-- outcome probabilities and `predicted_score` is the most likely single
-- scoreline, and those are different statistics over the same joint grid: the
-- draw is the most likely SCORELINE while the home win is the most likely
-- OUTCOME, because home wins are spread over many scorelines and 1-1 is one.
-- Both grades are correct and they disagree honestly. The reviews below say so
-- in the payload rather than leaving a reader to rediscover it.
--
-- So every read here reduces to ONE canonical forecast per fixture — the newest
-- non-quarantined prediction — and reports how many rows that excluded, rather
-- than averaging a match with itself.
--
-- NO GATE IS EVALUATED HERE. These reads report the decisions `find_value`
-- already recorded in `ai.recommendations`; they never re-derive BET or PASS,
-- never soften a threshold, and never promote an aggregate to an actionable
-- venue. A fixture with no current recommendation is reported as having none.

begin;

-- ---------------------------------------------------------------------------
-- 1. The refusal vocabulary, in words.
-- ---------------------------------------------------------------------------
create or replace function ai.pass_reason_explanation(p_code text)
returns text
language sql
immutable
set search_path to ''
as $$
  select case p_code
    when 'PASS_LOW_EDGE' then
      'The price is close to the model''s own fair odds, so there is no margin to bet into.'
    when 'PASS_STALE_PRICE' then
      'The most recent real bookmaker price is older than the limit for this distance from kickoff. An edge against a price nobody is still offering is arithmetic, not value.'
    when 'PASS_LOW_DATA' then
      'One or both clubs have too little usable history for the model''s inputs to be trusted.'
    when 'PASS_HIGH_MODEL_DISAGREEMENT' then
      'The independent model views are too far apart, so their average is not a confident answer.'
    when 'PASS_WIDE_UNCERTAINTY' then
      'The interval around the probability is too wide for the edge to survive it.'
    when 'PASS_MARKET_DISCREPANCY' then
      'The model and the de-vigged market disagree by more than the gate allows, which more often means a missing input than a mispriced market.'
    when 'PASS_INPUT_PENDING' then
      'An input the forecast depends on has not arrived yet.'
    when 'PASS_LONGSHOT' then
      'The selection is too improbable for the staking rule, where a small probability error dominates the edge.'
    when 'PASS_ODDS_OUT_OF_RANGE' then
      'The offered price is outside the range the gate will act on.'
    when 'PASS_UNBETTABLE_BOOK' then
      'The best price is at a venue that is not a real, non-aggregate bookmaker or exchange.'
    when 'PASS_NO_MARKET_REFERENCE' then
      'There is no aggregate market price to de-vig, so the market''s own fair probability cannot be computed as a cross-check.'
    else 'No explanation is recorded for this refusal code.'
  end
$$;

comment on function ai.pass_reason_explanation(text) is
  'One sentence per refusal code in value_engine.REASON_CODES. The codes are the '
  'authority and are what is counted; this exists so the admin surface does not '
  'have to keep its own copy of what each one means.';

-- ---------------------------------------------------------------------------
-- 2. The canonical forecast for a fixture: newest, not quarantined.
-- ---------------------------------------------------------------------------
create or replace view ai.canonical_fixture_predictions as
  select distinct on (p.fixture_id)
         p.*,
         (select count(*) from ai.valid_predictions o where o.fixture_id = p.fixture_id)
           as forecasts_for_fixture
    from ai.valid_predictions p
   where p.fixture_id is not null
   order by p.fixture_id, p.created_at desc, p.id desc;

comment on view ai.canonical_fixture_predictions is
  'One forecast per fixture: the newest non-quarantined prediction, whichever '
  'model version produced it. Every fixture-level read uses this so a match '
  'forecast by three model versions is one match rather than three, and '
  'forecasts_for_fixture carries how many rows that collapsed.';

-- ---------------------------------------------------------------------------
-- 3. The current decision for a fixture, whichever forecast it was made on.
-- ---------------------------------------------------------------------------
create or replace view ai.current_fixture_recommendations as
  select distinct on (p.fixture_id)
         p.fixture_id,
         r.id            as recommendation_id,
         r.prediction_id,
         r.league, r.market, r.selection, r.decision, r.reason_codes,
         r.bookmaker, r.odds_offered, r.odds_captured_at, r.odds_age_seconds,
         r.calibrated_prob, r.fair_odds, r.expected_value,
         r.data_confidence, r.data_confidence_state,
         r.agreement_score, r.uncertainty_width,
         r.decided_at, r.kickoff_at, r.hours_to_kickoff, r.evidence
    from ai.recommendations r
    join ai.valid_predictions p on p.id = r.prediction_id
   where p.fixture_id is not null
   order by p.fixture_id, r.decided_at desc, r.id desc;

comment on view ai.current_fixture_recommendations is
  'The newest recorded decision for each fixture, across every forecast of it. '
  'A newer PASS therefore supersedes an older BET without either audit row being '
  'rewritten, which is the rule Bet Builder already applies in the browser and '
  'which now has one definition instead of two.';

-- ---------------------------------------------------------------------------
-- 4. Coverage: every relevant fixture, and why it is or is not actionable.
-- ---------------------------------------------------------------------------
create or replace function public.admin_ai_fixture_coverage(
  p_from timestamptz default null,
  p_to timestamptz default null,
  p_leagues text[] default null)
returns jsonb
language plpgsql
stable
security definer
set search_path to ''
as $$
declare
  v_from timestamptz := coalesce(p_from, now());
  v_to   timestamptz := coalesce(p_to, now() + interval '7 days');
begin
  perform predictor_internal.require_competition_admin();

  -- One statement, one CTE, several aggregates over it. A temporary table would
  -- read more clearly and would also be a write, which a STABLE read has no
  -- business performing and which fails outright inside a read-only transaction.
  return (
    with cov as (
      select f.id as fixture_id, f.league_key as league, f.kickoff_at,
             f.home_canonical as home, f.away_canonical as away,
             cp.id is not null                            as has_prediction,
             cr.recommendation_id is not null             as has_decision,
             coalesce(cr.decision = 'BET', false)         as is_bet,
             mk.books is not null                         as has_real_price,
             coalesce(cr.odds_age_seconds
                      <= ai.price_age_limit_seconds(
                           extract(epoch from (f.kickoff_at - now())) / 3600.0, false),
                      false)                              as price_fresh,
             coalesce(cr.reason_codes, array[]::text[])   as reason_codes,
             jsonb_build_object(
               'fixture_id', f.id,
               'league', f.league_key,
               'kickoff_at', f.kickoff_at,
               'home', f.home_canonical,
               'away', f.away_canonical,
               'status', f.status,
               'hours_to_kickoff',
                 round((extract(epoch from (f.kickoff_at - now())) / 3600.0)::numeric, 2),
               'prediction', case when cp.id is null then null else jsonb_build_object(
                 'prediction_id', cp.id,
                 'model_version', m.version,
                 'model_family', m.family,
                 'model_trained_through', m.final_trained_through,
                 'p_home', cp.p_home, 'p_draw', cp.p_draw, 'p_away', cp.p_away,
                 'predicted_result', cp.predicted_result,
                 'predicted_score', cp.predicted_score,
                 'exp_home_goals', cp.exp_home_goals,
                 'exp_away_goals', cp.exp_away_goals,
                 'horizon', cp.horizon,
                 'data_snapshot_at', cp.data_snapshot_at,
                 'forecast_made_at', cp.created_at,
                 'forecasts_collapsed', cp.forecasts_for_fixture,
                 'uses_market', cp.uses_market) end,
               'quality', case when cp.id is null then null else jsonb_build_object(
                 'data_confidence', cp.data_confidence -> 'score',
                 'data_confidence_state', cp.data_confidence ->> 'state',
                 'missing_inputs', coalesce(cp.data_confidence -> 'missing_inputs', '[]'::jsonb),
                 'agreement', cp.agreement -> 'score',
                 'uncertainty_width', cp.uncertainty -> 'width') end,
               'market', jsonb_build_object(
                 'real_books', coalesce(mk.books, '[]'::jsonb),
                 'real_book_count', coalesce(jsonb_array_length(mk.books), 0),
                 'latest_real_capture_at', mk.latest_capture,
                 'best_real_price', mk.best_price,
                 'aggregate_reference_available', coalesce(mk.has_aggregate, false)),
               'decision', case when cr.recommendation_id is null then null else jsonb_build_object(
                 'decision', cr.decision,
                 'selection', cr.selection,
                 'market', cr.market,
                 'reason_codes', cr.reason_codes,
                 'reasons', (select coalesce(jsonb_agg(jsonb_build_object(
                                      'code', code,
                                      'explanation', ai.pass_reason_explanation(code))), '[]'::jsonb)
                               from unnest(cr.reason_codes) as code),
                 'bookmaker', cr.bookmaker,
                 'odds_offered', cr.odds_offered,
                 'model_probability', cr.calibrated_prob,
                 'model_fair_odds', cr.fair_odds,
                 'market_fair_probability', cr.evidence -> 'market_fair_prob',
                 'model_edge', cr.expected_value,
                 'data_confidence', cr.data_confidence,
                 'data_confidence_state', cr.data_confidence_state,
                 'agreement_score', cr.agreement_score,
                 'uncertainty_width', cr.uncertainty_width,
                 'odds_captured_at', cr.odds_captured_at,
                 'price_age_seconds', cr.odds_age_seconds,
                 'price_age_limit_seconds', ai.price_age_limit_seconds(
                    extract(epoch from (f.kickoff_at - now())) / 3600.0, false),
                 'decided_at', cr.decided_at,
                 'decided_hours_to_kickoff', cr.hours_to_kickoff) end) as payload
        from ai.fixtures f
        left join ai.canonical_fixture_predictions cp on cp.fixture_id = f.id
        left join ai.models m on m.id = cp.model_id
        left join ai.current_fixture_recommendations cr on cr.fixture_id = f.id
        left join lateral (
          select jsonb_agg(distinct l.bookmaker)
                   filter (where l.is_real_price and l.kind <> 'aggregate') as books,
                 max(l.captured_at)
                   filter (where l.is_real_price and l.kind <> 'aggregate') as latest_capture,
                 bool_or(l.kind = 'aggregate')                              as has_aggregate,
                 (select jsonb_build_object('bookmaker', b.bookmaker,
                                            'odds_home', b.odds_h,
                                            'odds_draw', b.odds_d,
                                            'odds_away', b.odds_a,
                                            'captured_at', b.captured_at)
                    from (select distinct on (fo2.bookmaker) fo2.*
                            from ai.fixture_odds fo2
                            join ai.bookmakers bk2 on bk2.code = fo2.bookmaker
                           where fo2.fixture_id = f.id
                             and bk2.is_real_price and bk2.kind <> 'aggregate'
                           order by fo2.bookmaker, fo2.captured_at desc) b
                   order by b.captured_at desc limit 1)                     as best_price
            from (select distinct on (fo.bookmaker)
                         fo.bookmaker, fo.captured_at, bk.is_real_price, bk.kind
                    from ai.fixture_odds fo
                    join ai.bookmakers bk on bk.code = fo.bookmaker
                   where fo.fixture_id = f.id
                   order by fo.bookmaker, fo.captured_at desc) l) mk on true
       where f.kickoff_at between v_from and v_to
         and f.status = 'scheduled'
         and (p_leagues is null or f.league_key = any(p_leagues))
    )
    select jsonb_build_object(
      'window', jsonb_build_object('from', v_from, 'to', v_to),
      'leagues_requested', to_jsonb(p_leagues),
      'totals', (
        select jsonb_build_object(
            'fixtures', count(*),
            'with_forecast', count(*) filter (where has_prediction),
            'without_forecast', count(*) filter (where not has_prediction),
            'with_real_bookmaker_price', count(*) filter (where has_real_price),
            'without_real_bookmaker_price', count(*) filter (where not has_real_price),
            'with_current_decision', count(*) filter (where has_decision),
            'without_current_decision', count(*) filter (where not has_decision),
            'actionable_bets', count(*) filter (where is_bet),
            'passed', count(*) filter (where has_decision and not is_bet),
            'price_within_freshness_limit', count(*) filter (where price_fresh))
          from cov),
      'pass_reason_counts', (
        select coalesce(jsonb_object_agg(code, n), '{}'::jsonb)
          from (select code, count(*) as n
                  from cov, unnest(cov.reason_codes) as code
                 where not cov.is_bet
                 group by code) r),
      'by_league', (
        select coalesce(jsonb_agg(x order by x ->> 'league'), '[]'::jsonb)
          from (select jsonb_build_object(
                         'league', league,
                         'fixtures', count(*),
                         'with_forecast', count(*) filter (where has_prediction),
                         'with_real_bookmaker_price', count(*) filter (where has_real_price),
                         'with_current_decision', count(*) filter (where has_decision),
                         'actionable_bets', count(*) filter (where is_bet),
                         'passed', count(*) filter (where has_decision and not is_bet)) as x
                  from cov group by league) l),
      'fixtures', (
        select coalesce(jsonb_agg(payload order by kickoff_at, league, home), '[]'::jsonb)
          from cov),
      'basis', 'ai.fixtures scheduled in the window, one canonical forecast per fixture '
               'from ai.canonical_fixture_predictions and the newest recorded decision '
               'from ai.current_fixture_recommendations. No gate is re-evaluated here.',
      'generated_at', now()));
end;
$$;

comment on function public.admin_ai_fixture_coverage(timestamptz,timestamptz,text[]) is
  'Competition-admin coverage read: every scheduled fixture in the window with its '
  'canonical forecast, data quality, real-bookmaker price coverage and the current '
  'recorded BET/PASS decision with each refusal explained. Reports decisions; never '
  'makes one.';

-- ---------------------------------------------------------------------------
-- 5. Operational health: is each stage of the pipeline current.
-- ---------------------------------------------------------------------------
create or replace function public.admin_ai_operational_health()
returns jsonb
language plpgsql
stable
security definer
set search_path to ''
as $$
declare
  v_budget ai.api_budget%rowtype;
begin
  perform predictor_internal.require_competition_admin();
  select * into v_budget from ai.api_budget where provider = 'the-odds-api';

  return jsonb_build_object(
    'fixtures', (
      select jsonb_build_object(
        'upcoming_7d', count(*) filter (
          where f.status = 'scheduled' and f.kickoff_at between now() and now() + interval '7 days'),
        'leagues_with_upcoming', (
          select count(distinct g.league_key) from ai.fixtures g
           where g.status = 'scheduled' and g.kickoff_at between now() and now() + interval '7 days'),
        'played_awaiting_result', count(*) filter (
          where f.status = 'scheduled' and f.kickoff_at < now() - interval '3 hours'),
        'last_sync_at', (select max(j.finished_at) from ai.job_runs j
                          where j.job = 'sync_fixtures' and j.status = 'succeeded'))
        from ai.fixtures f),
    'predictions', (
      select jsonb_build_object(
        'upcoming_fixtures', count(*),
        'with_current_forecast', count(*) filter (where cp.id is not null),
        'without_forecast', count(*) filter (where cp.id is null),
        'oldest_forecast_at', min(cp.created_at),
        'last_predict_at', (select max(j.finished_at) from ai.job_runs j
                             where j.job = 'predict' and j.status = 'succeeded'))
        from ai.fixtures f
        left join ai.canonical_fixture_predictions cp on cp.fixture_id = f.id
       where f.status = 'scheduled' and f.kickoff_at between now() and now() + interval '7 days'),
    'prices', (
      select jsonb_build_object(
        'last_real_capture_at', max(fo.captured_at) filter (
          where bk.is_real_price and bk.kind <> 'aggregate'),
        'last_reference_capture_at', max(fo.captured_at) filter (where bk.kind = 'aggregate'),
        'real_books_seen_7d', (
          select coalesce(jsonb_agg(distinct o.bookmaker), '[]'::jsonb)
            from ai.fixture_odds o join ai.bookmakers b on b.code = o.bookmaker
           where b.is_real_price and b.kind <> 'aggregate'
             and o.captured_at > now() - interval '7 days'))
        from ai.fixture_odds fo
        join ai.bookmakers bk on bk.code = fo.bookmaker
        join ai.fixtures f on f.id = fo.fixture_id
       where f.status = 'scheduled' and f.kickoff_at > now()),
    'value_loop', (
      select jsonb_build_object(
        'last_run_at', (select max(j.finished_at) from ai.job_runs j
                         where j.job = 'find_value' and j.status = 'succeeded'),
        'current_bets', count(*) filter (where cr.decision = 'BET'),
        'current_passes', count(*) filter (where cr.decision = 'PASS'))
        from ai.fixtures f
        join ai.current_fixture_recommendations cr on cr.fixture_id = f.id
       where f.status = 'scheduled' and f.kickoff_at > now()),
    'settlement', (
      select jsonb_build_object(
        'advised', count(*) filter (where b.status = 'advised'),
        'settled', count(*) filter (where b.status = 'settled'),
        'played_and_unsettled', count(*) filter (
          where b.status = 'advised' and f.status = 'played' and f.home_goals is not null),
        'awaiting_closing_benchmark', (
          select count(*) from ai.bet_results br where br.clv is null),
        'last_run_at', (select max(j.finished_at) from ai.job_runs j
                         where j.job = 'settle_bets' and j.status = 'succeeded'))
        from ai.valid_bets b join ai.fixtures f on f.id = b.fixture_id),
    'odds_api', jsonb_build_object(
      'collection_enabled', coalesce(v_budget.collection_enabled, false),
      'monthly_credits', v_budget.monthly_credits,
      'soft_cap', v_budget.soft_cap,
      'credits_used_this_month', ai.credits_used_this_month('the-odds-api'),
      'last_dispatch_at', (select max(d.dispatched_at) from ai.odds_api_dispatches d),
      'last_successful_call_at', (select max(u.called_at) from ai.api_usage u
                                   where u.http_status = 200),
      'last_call_status', (select u.http_status from ai.api_usage u
                            order by u.called_at desc limit 1),
      'events_seen', (select count(*) from ai.odds_api_events),
      'events_matched_to_fixture', (select count(*) from ai.odds_api_events e
                                     where e.fixture_id is not null)),
    'models', (
      select jsonb_build_object(
        'current', count(*),
        'expected', 9,
        'versions', coalesce(jsonb_agg(distinct m.version), '[]'::jsonb),
        'oldest_trained_through', min(m.final_trained_through),
        'newest_trained_through', max(m.final_trained_through),
        'last_train_at', (select max(j.finished_at) from ai.job_runs j
                           where j.job = 'train' and j.status = 'succeeded'))
        from ai.models m where m.status = 'current'),
    'jobs', (
      select coalesce(jsonb_agg(x order by x ->> 'job'), '[]'::jsonb)
        from (select jsonb_build_object(
                       'job', j.job,
                       'last_run_at', max(j.started_at),
                       'last_success_at', max(j.started_at) filter (where j.status = 'succeeded'),
                       'failures_7d', count(*) filter (
                         where j.status <> 'succeeded' and j.started_at > now() - interval '7 days')) as x
                from ai.job_runs j
               where j.started_at > now() - interval '30 days'
               group by j.job) y),
    'generated_at', now());
end;
$$;

comment on function public.admin_ai_operational_health() is
  'Competition-admin pipeline health: fixtures, forecasts, price freshness, the '
  'value loop, settlement backlog, the paid provider ledger and the current model '
  'set. Exists so an operator does not need a database console to tell a quiet '
  'pipeline from a broken one.';

-- ---------------------------------------------------------------------------
-- 6. Results review: what happened, one row per fixture.
-- ---------------------------------------------------------------------------
create or replace function public.admin_ai_results_review(
  p_from timestamptz default null,
  p_to timestamptz default null,
  p_leagues text[] default null)
returns jsonb
language plpgsql
stable
security definer
set search_path to ''
as $$
declare
  v_from timestamptz := coalesce(p_from, now() - interval '7 days');
  v_to   timestamptz := coalesce(p_to, now());
begin
  perform predictor_internal.require_competition_admin();

  return (
    with review as (
      select f.id as fixture_id, f.league_key as league, f.kickoff_at,
             cp.predicted_result,
             cp.data_confidence ->> 'state' as confidence_state,
             pr.result_correct, pr.exact_score_correct,
             pr.log_loss, pr.rps, pr.brier, pr.market_log_loss,
             jsonb_build_object(
               'fixture_id', f.id, 'league', f.league_key, 'kickoff_at', f.kickoff_at,
               'home', f.home_canonical, 'away', f.away_canonical,
               'home_goals', f.home_goals, 'away_goals', f.away_goals,
               'actual_result', pr.actual_result,
               'predicted_result', cp.predicted_result,
               'predicted_score', cp.predicted_score,
               'p_home', cp.p_home, 'p_draw', cp.p_draw, 'p_away', cp.p_away,
               'result_correct', pr.result_correct,
               'exact_score_correct', pr.exact_score_correct,
               -- Stated per fixture, because the pair looks like a contradiction
               -- and is not: the modal SCORELINE and the modal OUTCOME are
               -- different statistics over the same joint grid.
               'modal_scoreline_beat_modal_outcome',
                 coalesce(pr.exact_score_correct and not pr.result_correct, false),
               'log_loss', pr.log_loss, 'rps', pr.rps, 'brier', pr.brier,
               'market_log_loss', pr.market_log_loss,
               'log_loss_vs_market', pr.log_loss_vs_market,
               'diagnosis', pr.diagnosis,
               'model_version', m.version, 'model_family', m.family,
               'horizon', cp.horizon,
               'data_confidence_state', cp.data_confidence ->> 'state',
               'agreement', cp.agreement -> 'score',
               'uncertainty_width', cp.uncertainty -> 'width',
               'forecasts_collapsed', cp.forecasts_for_fixture) as payload
        from ai.fixtures f
        join ai.canonical_fixture_predictions cp on cp.fixture_id = f.id
        join ai.prediction_results pr on pr.prediction_id = cp.id
        left join ai.models m on m.id = cp.model_id
       where f.status = 'played'
         and f.kickoff_at between v_from and v_to
         and (p_leagues is null or f.league_key = any(p_leagues))
    ),
    all_graded as (
      select count(*) as rows_graded
        from ai.prediction_results pr
        join ai.valid_predictions p on p.id = pr.prediction_id
        join ai.fixtures f on f.id = p.fixture_id
       where f.status = 'played'
         and f.kickoff_at between v_from and v_to
         and (p_leagues is null or f.league_key = any(p_leagues))
    )
    select jsonb_build_object(
      'window', jsonb_build_object('from', v_from, 'to', v_to),
      'totals', (
        select jsonb_build_object(
            'graded_fixtures', count(*),
            'result_correct', count(*) filter (where result_correct),
            'result_accuracy', case when count(*) = 0 then null
                                    else round((count(*) filter (where result_correct))::numeric
                                               / count(*), 4) end,
            'exact_scores', count(*) filter (where exact_score_correct),
            'mean_log_loss', round(avg(log_loss), 5),
            'mean_rps', round(avg(rps), 5),
            'mean_brier', round(avg(brier), 5),
            'mean_market_log_loss', round(avg(market_log_loss), 5),
            'market_comparisons', count(*) filter (where market_log_loss is not null))
          from review),
      'by_league', (
        select coalesce(jsonb_agg(x order by x ->> 'league'), '[]'::jsonb)
          from (select jsonb_build_object(
                         'league', league, 'graded_fixtures', count(*),
                         'result_correct', count(*) filter (where result_correct),
                         'exact_scores', count(*) filter (where exact_score_correct),
                         'mean_log_loss', round(avg(log_loss), 5),
                         'mean_rps', round(avg(rps), 5),
                         'mean_brier', round(avg(brier), 5)) as x
                  from review group by league) l),
      'by_predicted_result', (
        select coalesce(jsonb_agg(x order by x ->> 'predicted_result'), '[]'::jsonb)
          from (select jsonb_build_object(
                         'predicted_result', predicted_result, 'graded_fixtures', count(*),
                         'result_correct', count(*) filter (where result_correct)) as x
                  from review group by predicted_result) p),
      'by_data_confidence', (
        select coalesce(jsonb_agg(x order by x ->> 'data_confidence_state'), '[]'::jsonb)
          from (select jsonb_build_object(
                         'data_confidence_state', confidence_state, 'graded_fixtures', count(*),
                         'result_correct', count(*) filter (where result_correct),
                         'mean_log_loss', round(avg(log_loss), 5)) as x
                  from review group by confidence_state) c),
      'fixtures', (
        select coalesce(jsonb_agg(payload order by kickoff_at, league), '[]'::jsonb)
          from review),
      'duplicate_graded_rows_excluded',
        greatest((select rows_graded from all_graded) - (select count(*) from review), 0),
      -- A sample this size cannot separate a good model from a lucky one, and
      -- saying so beside the number is the difference between evidence and a
      -- press release. The threshold is deliberately blunt.
      'sample_sufficiency', (
        select case
            when count(*) = 0 then 'NO_SAMPLE'
            when count(*) < 30 then 'EARLY_SAMPLE'
            when count(*) < 100 then 'INDICATIVE_ONLY'
            else 'USABLE' end
          from review),
      'sample_note',
        'Result accuracy over a few dozen fixtures is dominated by variance. Log '
        'loss, RPS and Brier are more informative at this size, and the market '
        'comparison more informative still, but none of them separates a good '
        'model from a lucky one at this sample. Treat a difference from the '
        'validation record as unproven until the sample is far larger.',
      'basis', 'One canonical forecast per fixture from ai.canonical_fixture_predictions, '
               'graded in ai.prediction_results. Quarantined forecasts are excluded by '
               'ai.valid_predictions and repeated forecasts of the same fixture are '
               'collapsed rather than averaged.',
      'generated_at', now()));
end;
$$;

comment on function public.admin_ai_results_review(timestamptz,timestamptz,text[]) is
  'Competition-admin results review over a window, ONE ROW PER FIXTURE. Reports how '
  'many repeated graded forecasts that collapsed and how far the sample is from '
  'being able to support a conclusion.';

revoke all on function public.admin_ai_fixture_coverage(timestamptz,timestamptz,text[]) from public;
revoke all on function public.admin_ai_operational_health() from public;
revoke all on function public.admin_ai_results_review(timestamptz,timestamptz,text[]) from public;
grant execute on function public.admin_ai_fixture_coverage(timestamptz,timestamptz,text[]) to authenticated;
grant execute on function public.admin_ai_operational_health() to authenticated;
grant execute on function public.admin_ai_results_review(timestamptz,timestamptz,text[]) to authenticated;

revoke all on ai.canonical_fixture_predictions from public, anon, authenticated;
revoke all on ai.current_fixture_recommendations from public, anon, authenticated;

commit;
