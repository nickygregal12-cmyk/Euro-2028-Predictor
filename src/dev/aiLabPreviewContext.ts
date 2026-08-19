/**
 * Preview fixtures for the five AI Lab tabs a snapshot alone cannot fill.
 *
 * Shaped from the real Production payloads read on 19 August 2026 rather than
 * invented, so the preview shows the Lab as it actually looks: 53 upcoming
 * fixtures across five leagues, 52 forecast, 35 BET and 17 PASS, nine current
 * models on one version, and the odds budget part-spent. The fixture list is
 * cut to a representative dozen — every decision state and every refusal code
 * that Production is currently producing — because the point is to see the
 * layout, not to mirror the row count.
 */
import {
  mapAiCoverage,
  mapAiHealth,
  mapAiResultsReview,
} from '../services/supabase/aiLabCoverageModel'

const HOUR = 3600_000

function at(hoursFromNow: number): string {
  return new Date(Date.now() + hoursFromNow * HOUR).toISOString()
}

function fixture(o: {
  id: string; league: string; home: string; away: string; hours: number
  decision?: 'BET' | 'PASS'; reasons?: string[]; selection?: string
  prob?: number; odds?: number; edge?: number; book?: string
  ageSeconds?: number; confidence?: number; forecast?: boolean
}) {
  const forecast = o.forecast !== false
  return {
    fixture_id: o.id,
    league: o.league,
    kickoff_at: at(o.hours),
    home: o.home,
    away: o.away,
    status: 'scheduled',
    hours_to_kickoff: o.hours,
    prediction: forecast
      ? {
          prediction_id: `${o.id}-p`,
          model_version: 'auto-20260818T1506Z',
          model_family: 'poisson',
          model_trained_through: '2026-08-17',
          p_home: o.prob ?? 0.44, p_draw: 0.27, p_away: 1 - (o.prob ?? 0.44) - 0.27,
          predicted_result: 'H', predicted_score: '1–0',
          exp_home_goals: 1.42, exp_away_goals: 0.94,
          horizon: 't48', data_snapshot_at: at(-6),
          forecast_made_at: at(-6), forecasts_collapsed: 3, uses_market: false,
        }
      : null,
    quality: forecast
      ? {
          data_confidence: o.confidence ?? 0.78,
          data_confidence_state: (o.confidence ?? 0.78) >= 0.7 ? 'strong' : 'thin',
          missing_inputs: [],
          agreement: 0.82,
          uncertainty_width: 0.11,
        }
      : null,
    market: {
      real_books: o.book ? [o.book] : [],
      real_book_count: o.book ? 1 : 0,
      latest_real_capture_at: o.book ? at(-(o.ageSeconds ?? 3600) / 3600) : null,
      best_real_price: o.book
        ? { bookmaker: o.book, odds_home: o.odds ?? 2.1, odds_draw: 3.4, odds_away: 3.6, captured_at: at(-1) }
        : null,
      aggregate_reference_available: Boolean(o.book),
    },
    decision: o.decision
      ? {
          decision: o.decision,
          selection: o.selection ?? 'H',
          market: '1X2',
          reason_codes: o.reasons ?? [],
          reasons: (o.reasons ?? []).map((code) => ({ code, explanation: EXPLANATIONS[code] ?? code })),
          bookmaker: o.book ?? null,
          odds_offered: o.odds ?? null,
          model_probability: o.prob ?? 0.44,
          model_fair_odds: o.prob ? Number((1 / o.prob).toFixed(2)) : null,
          market_fair_probability: 0.41,
          model_edge: o.edge ?? null,
          data_confidence: o.confidence ?? 0.78,
          data_confidence_state: (o.confidence ?? 0.78) >= 0.7 ? 'strong' : 'thin',
          agreement_score: 0.82,
          uncertainty_width: 0.11,
          odds_captured_at: at(-(o.ageSeconds ?? 3600) / 3600),
          price_age_seconds: o.ageSeconds ?? 3600,
          price_age_limit_seconds: 43200,
          decided_at: at(-1),
          decided_hours_to_kickoff: o.hours + 1,
        }
      : null,
  }
}

const EXPLANATIONS: Record<string, string> = {
  PASS_LOW_EDGE: 'The price is close enough to the model’s own fair odds that the edge does not clear the threshold.',
  PASS_STALE_PRICE: 'The newest real bookmaker price is older than the freshness limit for this distance from kick-off.',
  PASS_WIDE_UNCERTAINTY: 'The forecast’s uncertainty band is too wide for the edge claimed against it.',
  PASS_HIGH_MODEL_DISAGREEMENT: 'The component models disagree enough that the blended probability is not trustworthy here.',
  PASS_ODDS_OUT_OF_RANGE: 'The offered price sits outside the range the gate will act on.',
  PASS_LOW_DATA: 'One or both clubs have too little recorded history for a confident forecast.',
  PASS_MARKET_DISCREPANCY: 'The model and the market disagree by more than the gate treats as credible value.',
}

export const previewCoverage = mapAiCoverage({
  window: { from: at(0), to: at(24 * 7) },
  totals: {
    fixtures: 53, with_forecast: 52, without_forecast: 1,
    with_real_bookmaker_price: 51, without_real_bookmaker_price: 2,
    with_current_decision: 52, without_current_decision: 1,
    actionable_bets: 35, passed: 17, price_within_freshness_limit: 48,
  },
  pass_reason_counts: {
    PASS_LOW_EDGE: 5, PASS_STALE_PRICE: 5, PASS_WIDE_UNCERTAINTY: 4,
    PASS_HIGH_MODEL_DISAGREEMENT: 3, PASS_MARKET_DISCREPANCY: 2,
    PASS_LOW_DATA: 2, PASS_ODDS_OUT_OF_RANGE: 1,
  },
  by_league: [
    { league: 'ECH', fixtures: 12, with_forecast: 12, with_real_bookmaker_price: 12, with_current_decision: 12, actionable_bets: 9, passed: 3 },
    { league: 'EL1', fixtures: 13, with_forecast: 12, with_real_bookmaker_price: 12, with_current_decision: 12, actionable_bets: 8, passed: 4 },
    { league: 'EL2', fixtures: 12, with_forecast: 12, with_real_bookmaker_price: 12, with_current_decision: 12, actionable_bets: 8, passed: 4 },
    { league: 'EPL', fixtures: 10, with_forecast: 10, with_real_bookmaker_price: 10, with_current_decision: 10, actionable_bets: 6, passed: 4 },
    { league: 'SPL', fixtures: 6, with_forecast: 6, with_real_bookmaker_price: 5, with_current_decision: 6, actionable_bets: 4, passed: 2 },
  ],
  fixtures: [
    fixture({ id: 'f1', league: 'EPL', home: 'Arsenal', away: 'Coventry', hours: 27, decision: 'BET', selection: 'H', prob: 0.62, odds: 1.85, edge: 0.147, book: 'PS', ageSeconds: 1800, confidence: 0.88 }),
    fixture({ id: 'f2', league: 'EPL', home: 'Hull', away: 'Man United', hours: 43, decision: 'BET', selection: 'A', prob: 0.55, odds: 2.05, edge: 0.128, book: 'BFE', ageSeconds: 2400, confidence: 0.81 }),
    fixture({ id: 'f3', league: 'ECH', home: 'Norwich', away: 'Watford', hours: 44, decision: 'BET', selection: 'H', prob: 0.48, odds: 2.30, edge: 0.104, book: 'B365', ageSeconds: 5400, confidence: 0.76 }),
    fixture({ id: 'f4', league: 'EL1', home: 'Sheffield Weds', away: 'Bradford', hours: 25, decision: 'BET', selection: 'H', prob: 0.51, odds: 2.15, edge: 0.097, book: 'MTB', ageSeconds: 900, confidence: 0.84 }),
    fixture({ id: 'f5', league: 'SPL', home: 'Falkirk', away: 'Hearts', hours: 46, decision: 'PASS', reasons: ['PASS_LOW_EDGE'], prob: 0.39, odds: 2.55, edge: 0.006, book: 'PS', ageSeconds: 3600, confidence: 0.72 }),
    fixture({ id: 'f6', league: 'EL2', home: 'Barrow', away: 'Bromley', hours: 44, decision: 'PASS', reasons: ['PASS_STALE_PRICE'], prob: 0.45, odds: 2.20, book: 'B365', ageSeconds: 194_400, confidence: 0.69 }),
    fixture({ id: 'f7', league: 'ECH', home: 'Preston', away: 'Swansea', hours: 45, decision: 'PASS', reasons: ['PASS_WIDE_UNCERTAINTY'], prob: 0.41, odds: 2.60, book: 'BFE', ageSeconds: 4200, confidence: 0.58 }),
    fixture({ id: 'f8', league: 'EPL', home: 'Ipswich', away: 'Sunderland', hours: 46, decision: 'PASS', reasons: ['PASS_HIGH_MODEL_DISAGREEMENT'], prob: 0.36, odds: 2.90, book: 'PS', ageSeconds: 2700, confidence: 0.74 }),
    fixture({ id: 'f9', league: 'EL2', home: 'Salford', away: 'Walsall', hours: 47, decision: 'PASS', reasons: ['PASS_MARKET_DISCREPANCY'], prob: 0.58, odds: 3.40, book: 'SMK', ageSeconds: 1500, confidence: 0.71 }),
    fixture({ id: 'f10', league: 'SPL', home: 'Dundee United', away: 'Dundee', hours: 48, decision: 'PASS', reasons: ['PASS_LOW_DATA'], prob: 0.44, odds: 2.35, book: 'B365', ageSeconds: 3300, confidence: 0.41 }),
    fixture({ id: 'f11', league: 'EL1', home: 'Wigan', away: 'Wycombe', hours: 49, decision: 'PASS', reasons: ['PASS_ODDS_OUT_OF_RANGE'], prob: 0.19, odds: 9.50, book: 'BFE', ageSeconds: 2100, confidence: 0.66 }),
    fixture({ id: 'f12', league: 'EL1', home: 'Stockport', away: 'Lincoln', hours: 50, forecast: false }),
  ],
  basis: 'Preview fixtures shaped from the Production payload of 19 August 2026.',
  generated_at: at(0),
})

export const previewHealth = mapAiHealth({
  fixtures: { upcoming_7d: 53, leagues_with_upcoming: 5, played_awaiting_result: 0, last_sync_at: at(-2) },
  predictions: { upcoming_fixtures: 53, with_current_forecast: 52, without_forecast: 1, oldest_forecast_at: at(-25), last_predict_at: at(-10) },
  prices: { last_real_capture_at: at(-2), last_reference_capture_at: at(-2), real_books_seen_7d: ['B365', 'BFE', 'MTB', 'PS', 'SMK'] },
  value_loop: { current_bets: 35, current_passes: 17, last_run_at: at(-2) },
  settlement: { advised: 42, settled: 37, played_and_unsettled: 0, awaiting_closing_benchmark: 0, last_run_at: at(-10) },
  models: {
    current: 9, expected: 9, versions: ['auto-20260818T1506Z'],
    last_train_at: at(-25), newest_trained_through: '2026-08-17', oldest_trained_through: '2026-08-08',
  },
  odds_api: {
    collection_enabled: true, monthly_credits: 20000, soft_cap: 18000,
    credits_used_this_month: 784, last_dispatch_at: at(-2.5),
    last_successful_call_at: at(-2.5), last_call_status: 200,
    events_seen: 88, events_matched_to_fixture: 88,
  },
  jobs: [
    { job: 'sync_fixtures', last_run_at: at(-2), last_success_at: at(-2), failures_7d: 0 },
    { job: 'predict', last_run_at: at(-10), last_success_at: at(-10), failures_7d: 0 },
    { job: 'fetch_fixture_odds', last_run_at: at(-2), last_success_at: at(-2), failures_7d: 0 },
    { job: 'find_value', last_run_at: at(-2), last_success_at: at(-2), failures_7d: 0 },
    { job: 'settle_bets', last_run_at: at(-10), last_success_at: at(-10), failures_7d: 0 },
    { job: 'evaluate', last_run_at: at(-10), last_success_at: at(-10), failures_7d: 0 },
    { job: 'train', last_run_at: at(-25), last_success_at: at(-25), failures_7d: 0 },
  ],
  generated_at: at(0),
})

export const previewReview = mapAiResultsReview({
  window: { from: at(-24 * 7), to: at(0) },
  sample_sufficiency: 'EARLY_SAMPLE',
  sample_note:
    'Fifty-seven fixtures is enough to spot an operational fault and nowhere near enough to judge a model.',
  duplicate_graded_rows_excluded: 50,
  totals: {
    graded_fixtures: 57, result_correct: 30, result_accuracy: 0.5263,
    exact_scores: 6, mean_log_loss: 0.9906, mean_rps: 0.2177, mean_brier: 0.6301,
    mean_market_log_loss: 0.9689, market_comparisons: 57,
  },
  by_league: [
    { league: 'ECH', graded_fixtures: 12, result_correct: 3, exact_scores: 1, mean_log_loss: 1.058, mean_rps: 0.241, mean_brier: 0.672 },
    { league: 'EL1', graded_fixtures: 12, result_correct: 6, exact_scores: 2, mean_log_loss: 1.030, mean_rps: 0.223, mean_brier: 0.641 },
    { league: 'EL2', graded_fixtures: 12, result_correct: 8, exact_scores: 1, mean_log_loss: 0.941, mean_rps: 0.198, mean_brier: 0.588 },
    { league: 'ENL', graded_fixtures: 12, result_correct: 7, exact_scores: 1, mean_log_loss: 0.972, mean_rps: 0.211, mean_brier: 0.612 },
    { league: 'SL1', graded_fixtures: 4, result_correct: 4, exact_scores: 1, mean_log_loss: 0.812, mean_rps: 0.164, mean_brier: 0.503 },
    { league: 'SL2', graded_fixtures: 5, result_correct: 2, exact_scores: 0, mean_log_loss: 1.104, mean_rps: 0.257, mean_brier: 0.701 },
  ],
  by_predicted_result: [
    { predicted_result: 'H', graded_fixtures: 34, result_correct: 20, mean_log_loss: 0.951 },
    { predicted_result: 'A', graded_fixtures: 19, result_correct: 9, mean_log_loss: 1.042 },
    { predicted_result: 'D', graded_fixtures: 4, result_correct: 1, mean_log_loss: 1.088 },
  ],
  by_data_confidence: [
    { data_confidence_state: 'strong', graded_fixtures: 38, result_correct: 22, mean_log_loss: 0.958 },
    { data_confidence_state: 'thin', graded_fixtures: 19, result_correct: 8, mean_log_loss: 1.056 },
  ],
  fixtures: [
    { fixture_id: 'r1', league: 'EL2', kickoff_at: at(-52), home: 'Barrow', away: 'Bromley', home_goals: 2, away_goals: 0, actual_result: 'H', predicted_result: 'H', predicted_score: '1–0', p_home: 0.51, p_draw: 0.27, p_away: 0.22, result_correct: true, exact_score_correct: false, log_loss: 0.673, rps: 0.121, market_log_loss: 0.702, log_loss_vs_market: -0.029 },
    { fixture_id: 'r2', league: 'ECH', kickoff_at: at(-51), home: 'Norwich', away: 'Watford', home_goals: 1, away_goals: 1, actual_result: 'D', predicted_result: 'H', predicted_score: '2–1', p_home: 0.47, p_draw: 0.26, p_away: 0.27, result_correct: false, exact_score_correct: false, log_loss: 1.347, rps: 0.288, market_log_loss: 1.221, log_loss_vs_market: 0.126 },
    { fixture_id: 'r3', league: 'EL1', kickoff_at: at(-50), home: 'Wigan', away: 'Wycombe', home_goals: 2, away_goals: 1, actual_result: 'H', predicted_result: 'H', predicted_score: '2–1', p_home: 0.55, p_draw: 0.25, p_away: 0.20, result_correct: true, exact_score_correct: true, log_loss: 0.598, rps: 0.098, market_log_loss: 0.641, log_loss_vs_market: -0.043 },
    { fixture_id: 'r4', league: 'SL2', kickoff_at: at(-49), home: 'Elgin', away: 'Forfar', home_goals: 1, away_goals: 1, actual_result: 'D', predicted_result: 'A', predicted_score: '0–1', p_home: 0.31, p_draw: 0.32, p_away: 0.37, result_correct: false, exact_score_correct: false, log_loss: 1.139, rps: 0.228, market_log_loss: 1.094, log_loss_vs_market: 0.045 },
    { fixture_id: 'r5', league: 'ENL', kickoff_at: at(-48), home: 'Gateshead', away: 'Woking', home_goals: 0, away_goals: 2, actual_result: 'A', predicted_result: 'A', predicted_score: '0–1', p_home: 0.28, p_draw: 0.26, p_away: 0.46, result_correct: true, exact_score_correct: false, log_loss: 0.777, rps: 0.142, market_log_loss: 0.812, log_loss_vs_market: -0.035 },
  ],
  generated_at: at(0),
})
