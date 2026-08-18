import { describe, expect, it } from 'vitest'
import {
  mapAiCoverage,
  mapAiHealth,
  mapAiResultsReview,
} from '../../../src/services/supabase/aiLabCoverageModel'

/**
 * The decoder for contract 201's three reads.
 *
 * The cases that matter are the absences. A fixture with no forecast, a decision
 * with no market reference, a review with no closing benchmark: each has to
 * arrive as null rather than as a zero, because a zero is a measurement and
 * these are the absence of one. An empty Bet Builder that reports 0% data
 * confidence for a match nobody has forecast sends its reader after the wrong
 * problem.
 */

describe('mapAiCoverage', () => {
  it('carries a fixture that has been decided, with the price age beside its limit', () => {
    const coverage = mapAiCoverage({
      window: { from: '2026-08-20T00:00:00Z', to: '2026-08-24T00:00:00Z' },
      totals: {
        fixtures: 2, with_forecast: 1, without_forecast: 1,
        with_real_bookmaker_price: 1, without_real_bookmaker_price: 1,
        with_current_decision: 1, without_current_decision: 1,
        actionable_bets: 0, passed: 1, price_within_freshness_limit: 0,
      },
      pass_reason_counts: { PASS_STALE_PRICE: 1, PASS_LOW_EDGE: 1 },
      by_league: [{
        league: 'EPL', fixtures: 2, with_forecast: 1, with_real_bookmaker_price: 1,
        with_current_decision: 1, actionable_bets: 0, passed: 1,
      }],
      fixtures: [
        {
          fixture_id: 'f-1', league: 'EPL', kickoff_at: '2026-08-22T14:00:00Z',
          home: 'Arsenal', away: 'Leeds', hours_to_kickoff: 55.5,
          prediction: {
            prediction_id: 'p-1', model_version: 'auto-1', model_family: 'poisson',
            model_trained_through: '2026-08-08', p_home: 0.55, p_draw: 0.25,
            p_away: 0.2, predicted_result: 'H', predicted_score: '2-1',
            exp_home_goals: 1.7, exp_away_goals: 1.1, horizon: 't72',
            data_snapshot_at: '2026-08-20T06:00:00Z',
            forecast_made_at: '2026-08-20T06:00:00Z', forecasts_collapsed: 3,
            uses_market: false,
          },
          quality: {
            data_confidence: 0.82, data_confidence_state: 'sufficient',
            missing_inputs: [], agreement: 0.91, uncertainty_width: 0.11,
          },
          market: {
            real_books: ['B365', 'PS'], real_book_count: 2,
            latest_real_capture_at: '2026-08-17T18:45:00Z',
            best_real_price: {
              bookmaker: 'B365', odds_home: 2.1, odds_draw: 3.4, odds_away: 3.6,
              captured_at: '2026-08-17T18:45:00Z',
            },
            aggregate_reference_available: true,
          },
          decision: {
            decision: 'PASS', selection: 'H', market: '1X2',
            reason_codes: ['PASS_STALE_PRICE'],
            reasons: [{ code: 'PASS_STALE_PRICE', explanation: 'The price is too old.' }],
            bookmaker: 'B365', odds_offered: 2.1, model_probability: 0.55,
            model_fair_odds: 1.82, market_fair_probability: 0.52, model_edge: 0.155,
            data_confidence: 0.82, data_confidence_state: 'sufficient',
            agreement_score: 0.91, uncertainty_width: 0.11,
            odds_captured_at: '2026-08-17T18:45:00Z',
            price_age_seconds: 259200, price_age_limit_seconds: 43200,
            decided_at: '2026-08-20T09:00:00Z',
          },
        },
        {
          fixture_id: 'f-2', league: 'EPL', kickoff_at: '2026-08-22T16:30:00Z',
          home: 'Everton', away: 'Fulham', hours_to_kickoff: 58,
          prediction: null, quality: null,
          market: {
            real_books: [], real_book_count: 0, latest_real_capture_at: null,
            best_real_price: null, aggregate_reference_available: false,
          },
          decision: null,
        },
      ],
      generated_at: '2026-08-20T09:05:00Z',
    })

    expect(coverage.totals.fixtures).toBe(2)
    expect(coverage.totals.actionableBets).toBe(0)
    // Sorted by how often each gate fired, because that is the number that says
    // which fix is worth making.
    expect(coverage.passReasonCounts.map((row) => row.code))
      .toEqual(['PASS_LOW_EDGE', 'PASS_STALE_PRICE'])

    const decided = coverage.fixtures[0]!
    expect(decided.prediction?.forecastsCollapsed).toBe(3)
    expect(decided.decision?.priceAgeSeconds).toBe(259200)
    expect(decided.decision?.priceAgeLimitSeconds).toBe(43200)
    expect(decided.decision?.reasons[0]!.explanation).toContain('too old')
    expect(decided.market.realBooks).toEqual(['B365', 'PS'])

    // A fixture nobody has forecast is present and honestly empty. It is NOT a
    // refusal, and it must not be mistaken for one.
    const bare = coverage.fixtures[1]!
    expect(bare.prediction).toBeNull()
    expect(bare.quality).toBeNull()
    expect(bare.decision).toBeNull()
    expect(bare.market.realBookCount).toBe(0)
  })

  it('survives an empty window without inventing zeroes for absent measurements', () => {
    const coverage = mapAiCoverage({})
    expect(coverage.totals.fixtures).toBe(0)
    expect(coverage.fixtures).toEqual([])
    expect(coverage.passReasonCounts).toEqual([])
    expect(coverage.window.from).toBeNull()
  })

  it('drops a fixture with no id rather than rendering a row that identifies nothing', () => {
    const coverage = mapAiCoverage({ fixtures: [{ league: 'EPL' }, { fixture_id: 'f-3' }] })
    expect(coverage.fixtures.map((f) => f.fixtureId)).toEqual(['f-3'])
  })
})

describe('mapAiHealth', () => {
  it('reads every stage, and keeps an unrun stage distinguishable from a zero', () => {
    const health = mapAiHealth({
      fixtures: { upcoming_7d: 52, leagues_with_upcoming: 5, played_awaiting_result: 0,
                  last_sync_at: '2026-08-20T05:30:00Z' },
      predictions: { upcoming_fixtures: 52, with_current_forecast: 52,
                     without_forecast: 0, oldest_forecast_at: '2026-08-19T06:00:00Z',
                     last_predict_at: '2026-08-20T05:35:00Z' },
      prices: { last_real_capture_at: '2026-08-20T04:00:00Z',
                last_reference_capture_at: null, real_books_seen_7d: ['B365', 'PS'] },
      value_loop: { last_run_at: '2026-08-20T05:40:00Z', current_bets: 4,
                    current_passes: 48 },
      settlement: { advised: 76, settled: 37, played_and_unsettled: 0,
                    awaiting_closing_benchmark: 2, last_run_at: null },
      odds_api: { collection_enabled: true, monthly_credits: 20000, soft_cap: 18000,
                  credits_used_this_month: 744, last_dispatch_at: '2026-08-20T04:00:00Z',
                  last_successful_call_at: '2026-08-20T04:00:05Z', last_call_status: 200,
                  events_seen: 88, events_matched_to_fixture: 88 },
      models: { current: 9, expected: 9, versions: ['auto-1'],
                oldest_trained_through: '2026-05-02',
                newest_trained_through: '2026-08-09', last_train_at: null },
      generated_at: '2026-08-20T06:00:00Z',
    })

    expect(health.predictions.withoutForecast).toBe(0)
    expect(health.valueLoop.currentBets).toBe(4)
    expect(health.settlement.awaitingClosingBenchmark).toBe(2)
    expect(health.oddsApi.collectionEnabled).toBe(true)
    expect(health.models.current).toBe(9)
    // A job that has never run is null, not "just now" and not zero.
    expect(health.settlement.lastRunAt).toBeNull()
    expect(health.models.lastTrainAt).toBeNull()
    expect(health.prices.lastReferenceCaptureAt).toBeNull()
  })

  it('defaults collection to DISABLED when the payload does not say', () => {
    // Fail closed. Reporting "collecting" for a lab that is not collecting is
    // the one wrong answer this card can give.
    expect(mapAiHealth({}).oddsApi.collectionEnabled).toBe(false)
  })
})

describe('mapAiResultsReview', () => {
  it('carries the scoreline-versus-outcome disagreement as a stated property', () => {
    const review = mapAiResultsReview({
      totals: { graded_fixtures: 1, result_correct: 0, result_accuracy: 0,
                exact_scores: 1, mean_log_loss: 1.3186, mean_rps: 0.1376,
                mean_brier: 0.8115, mean_market_log_loss: null, market_comparisons: 0 },
      by_league: [{ league: 'ECH', graded_fixtures: 1, result_correct: 0,
                    exact_scores: 1, mean_log_loss: 1.3186, mean_rps: 0.1376,
                    mean_brier: 0.8115 }],
      by_predicted_result: [{ predicted_result: 'H', graded_fixtures: 1, result_correct: 0 }],
      by_data_confidence: [{ data_confidence_state: 'sufficient', graded_fixtures: 1,
                             result_correct: 0, mean_log_loss: 1.3186 }],
      fixtures: [{
        fixture_id: 'f-9', league: 'ECH', kickoff_at: '2026-08-17T19:00:00Z',
        home: 'Cardiff', away: 'Wrexham', home_goals: 1, away_goals: 1,
        actual_result: 'D', predicted_result: 'H', predicted_score: '1-1',
        p_home: 0.403, p_draw: 0.272, p_away: 0.325,
        result_correct: false, exact_score_correct: true,
        modal_scoreline_beat_modal_outcome: true,
        log_loss: 1.3186, rps: 0.1376, brier: 0.8115,
        market_log_loss: null, log_loss_vs_market: null, diagnosis: null,
        model_version: 'auto-1', horizon: 'scheduled',
        data_confidence_state: 'sufficient', forecasts_collapsed: 5,
      }],
      duplicate_graded_rows_excluded: 4,
      sample_sufficiency: 'EARLY_SAMPLE',
      sample_note: 'Result accuracy over a few dozen fixtures is dominated by variance.',
      generated_at: '2026-08-18T12:00:00Z',
    })

    // ONE fixture, not five. The five forecasts of it are reported as collapsed.
    expect(review.totals.gradedFixtures).toBe(1)
    expect(review.duplicateGradedRowsExcluded).toBe(4)
    expect(review.fixtures[0]!.forecastsCollapsed).toBe(5)

    // And the pair that reads like corruption and is not.
    expect(review.fixtures[0]!.resultCorrect).toBe(false)
    expect(review.fixtures[0]!.exactScoreCorrect).toBe(true)
    expect(review.fixtures[0]!.modalScorelineBeatModalOutcome).toBe(true)

    // No closing benchmark published, so no comparison — not a comparison of 0.
    expect(review.totals.meanMarketLogLoss).toBeNull()
    expect(review.totals.marketComparisons).toBe(0)
    expect(review.fixtures[0]!.logLossVsMarket).toBeNull()

    expect(review.sampleSufficiency).toBe('EARLY_SAMPLE')
  })

  it('refuses an unknown sufficiency verdict rather than passing it through', () => {
    expect(mapAiResultsReview({ sample_sufficiency: 'DEFINITELY_GREAT' }).sampleSufficiency)
      .toBe('NO_SAMPLE')
  })
})
