import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import {
  CoverageFixtures,
  CoverageSummary,
  OperationalHealth,
  ResultsReview,
  humanAge,
  priceFreshness,
} from '../../../src/features/admin/AiLabCoverageViews'
import {
  mapAiCoverage,
  mapAiHealth,
  mapAiResultsReview,
} from '../../../src/services/supabase/aiLabCoverageModel'

/**
 * The surfaces exist to answer one question: is there no value right now, or is
 * the pipeline broken? These assertions are about that question rather than
 * about layout — every fixture must be reachable, every refusal must be
 * readable, and a zero-BET window must say why rather than look empty.
 */

const coverage = mapAiCoverage({
  window: { from: '2026-08-20T00:00:00Z', to: '2026-08-24T00:00:00Z' },
  totals: {
    fixtures: 3, with_forecast: 2, without_forecast: 1,
    with_real_bookmaker_price: 2, without_real_bookmaker_price: 1,
    with_current_decision: 2, without_current_decision: 1,
    actionable_bets: 0, passed: 2, price_within_freshness_limit: 0,
  },
  pass_reason_counts: { PASS_STALE_PRICE: 2, PASS_LOW_EDGE: 1 },
  by_league: [{
    league: 'EPL', fixtures: 3, with_forecast: 2, with_real_bookmaker_price: 2,
    with_current_decision: 2, actionable_bets: 0, passed: 2,
  }],
  fixtures: [
    {
      fixture_id: 'f-1', league: 'EPL', kickoff_at: '2026-08-22T14:00:00Z',
      home: 'Arsenal', away: 'Leeds', hours_to_kickoff: 55,
      prediction: {
        prediction_id: 'p-1', model_version: 'auto-1', model_family: 'poisson',
        model_trained_through: '2026-08-08', p_home: 0.55, p_draw: 0.25, p_away: 0.2,
        predicted_result: 'H', predicted_score: '2-1', exp_home_goals: 1.7,
        exp_away_goals: 1.1, horizon: 't72', data_snapshot_at: null,
        forecast_made_at: '2026-08-20T06:00:00Z', forecasts_collapsed: 3,
        uses_market: false,
      },
      quality: {
        data_confidence: 0.82, data_confidence_state: 'sufficient',
        missing_inputs: [], agreement: 0.91, uncertainty_width: 0.11,
      },
      market: {
        real_books: ['B365'], real_book_count: 1,
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
        reasons: [{
          code: 'PASS_STALE_PRICE',
          explanation: 'The most recent real bookmaker price is older than the limit.',
        }],
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
    {
      fixture_id: 'f-3', league: 'EPL', kickoff_at: '2026-08-23T13:00:00Z',
      home: 'Spurs', away: 'Wolves', hours_to_kickoff: 78,
      prediction: {
        prediction_id: 'p-3', model_version: 'auto-1', model_family: 'poisson',
        model_trained_through: '2026-08-08', p_home: 0.48, p_draw: 0.28, p_away: 0.24,
        predicted_result: 'H', predicted_score: '1-1', exp_home_goals: 1.4,
        exp_away_goals: 1.2, horizon: 't120', data_snapshot_at: null,
        forecast_made_at: '2026-08-20T06:00:00Z', forecasts_collapsed: 1,
        uses_market: false,
      },
      quality: {
        data_confidence: 0.7, data_confidence_state: 'sufficient',
        missing_inputs: [], agreement: 0.8, uncertainty_width: 0.14,
      },
      market: {
        real_books: ['PS'], real_book_count: 1,
        latest_real_capture_at: '2026-08-17T18:45:00Z',
        best_real_price: null, aggregate_reference_available: false,
      },
      decision: {
        decision: 'PASS', selection: 'H', market: '1X2',
        reason_codes: ['PASS_LOW_EDGE'],
        reasons: [{ code: 'PASS_LOW_EDGE', explanation: 'No margin to bet into.' }],
        bookmaker: 'PS', odds_offered: 2.0, model_probability: 0.48,
        model_fair_odds: 2.08, market_fair_probability: 0.49, model_edge: -0.04,
        data_confidence: 0.7, data_confidence_state: 'sufficient',
        agreement_score: 0.8, uncertainty_width: 0.14,
        odds_captured_at: '2026-08-20T08:00:00Z',
        price_age_seconds: 3600, price_age_limit_seconds: 43200,
        decided_at: '2026-08-20T09:00:00Z',
      },
    },
  ],
  generated_at: '2026-08-20T09:05:00Z',
})

describe('humanAge', () => {
  it('reads as a duration rather than a number of seconds', () => {
    expect(humanAge(45)).toBe('45s')
    expect(humanAge(600)).toBe('10 min')
    expect(humanAge(43200)).toBe('12.0 h')
    expect(humanAge(259200)).toBe('3.0 days')
    expect(humanAge(null)).toBe('unknown')
  })
})

describe('priceFreshness', () => {
  it('keeps "no price" and "too old" apart', () => {
    // Different problems, different fixes. Collapsing them into a boolean sends
    // the reader after a stale collector when there is no collector at all.
    expect(priceFreshness(3600, 43200)).toBe('fresh')
    expect(priceFreshness(259200, 43200)).toBe('stale')
    expect(priceFreshness(null, 43200)).toBe('unknown')
    expect(priceFreshness(3600, null)).toBe('unknown')
  })
})

describe('CoverageSummary', () => {
  it('states the count analysed, actionable and passed', () => {
    render(<CoverageSummary coverage={coverage} />)
    expect(screen.getByText(/3 fixtures analysed/)).toBeInTheDocument()
    expect(screen.getByText(/0 actionable/)).toBeInTheDocument()
    expect(screen.getByText(/2 passed/)).toBeInTheDocument()
  })

  it('explains a zero-BET window instead of leaving it blank', () => {
    render(<CoverageSummary coverage={coverage} />)
    expect(screen.getByText('No qualifying value right now')).toBeInTheDocument()
    // And the distribution that tells an operator WHICH answer it is.
    const table = screen.getByRole('table', { name: /Why fixtures did not qualify/i })
    expect(within(table).getByText('PASS_STALE_PRICE')).toBeInTheDocument()
  })
})

describe('CoverageFixtures', () => {
  it('lists every fixture, including the one nothing has touched', () => {
    render(<CoverageFixtures coverage={coverage} />)
    expect(screen.getByText(/Arsenal/)).toBeInTheDocument()
    expect(screen.getByText(/Everton/)).toBeInTheDocument()
    expect(screen.getByText(/Spurs/)).toBeInTheDocument()
  })

  it('says a fixture is undecided rather than showing it as a refusal', () => {
    render(<CoverageFixtures coverage={coverage} />)
    expect(screen.getByText(/No current forecast/)).toBeInTheDocument()
    expect(screen.getAllByText('NOT DECIDED')).toHaveLength(1)
  })

  it('puts the price age beside the limit it was judged against', () => {
    render(<CoverageFixtures coverage={coverage} />)
    expect(screen.getByText(/3\.0 days old of 12\.0 h allowed/)).toBeInTheDocument()
    expect(screen.getByText(/too old to act on/)).toBeInTheDocument()
  })

  it('names the gate that stopped each refusal, in words', () => {
    render(<CoverageFixtures coverage={coverage} />)
    expect(screen.getByText(/older than the limit/)).toBeInTheDocument()
    expect(screen.getByText(/No margin to bet into/)).toBeInTheDocument()
  })

  it('filters to the undecided fixtures without hiding the count', async () => {
    render(<CoverageFixtures coverage={coverage} />)
    await userEvent.click(screen.getByRole('button', { name: /Undecided 1/ }))
    expect(screen.getByText(/Everton/)).toBeInTheDocument()
    expect(screen.queryByText(/Arsenal/)).not.toBeInTheDocument()
  })

  it('reveals model, data and market detail on demand', async () => {
    render(<CoverageFixtures coverage={coverage} />)
    const toggles = screen.getAllByRole('button', { name: /Show model, data and market detail/ })
    await userEvent.click(toggles[0]!)
    expect(screen.getByText(/newest of 3 forecasts of this fixture/)).toBeInTheDocument()
    expect(screen.getByText(/an aggregate reference exists, and is never actionable/))
      .toBeInTheDocument()
  })
})

describe('OperationalHealth', () => {
  it('marks a stale collector and a settlement backlog as problems', () => {
    const health = mapAiHealth({
      fixtures: { upcoming_7d: 52, leagues_with_upcoming: 5, played_awaiting_result: 0,
                  last_sync_at: '2026-08-20T05:30:00Z' },
      predictions: { upcoming_fixtures: 52, with_current_forecast: 40,
                     without_forecast: 12, oldest_forecast_at: null,
                     last_predict_at: '2026-08-20T05:35:00Z' },
      // Older than the loosest limit the gate ever applies, so it cannot be
      // current for any fixture.
      prices: { last_real_capture_at: '2026-08-17T18:45:00Z',
                last_reference_capture_at: null, real_books_seen_7d: ['B365'] },
      value_loop: { last_run_at: null, current_bets: 0, current_passes: 52 },
      settlement: { advised: 76, settled: 0, played_and_unsettled: 37,
                    awaiting_closing_benchmark: 0, last_run_at: null },
      odds_api: { collection_enabled: true, monthly_credits: 20000, soft_cap: 18000,
                  credits_used_this_month: 744, last_dispatch_at: '2026-08-17T18:45:00Z',
                  last_successful_call_at: null, last_call_status: 200,
                  events_seen: 88, events_matched_to_fixture: 88 },
      models: { current: 9, expected: 9, versions: ['auto-1'],
                oldest_trained_through: '2026-05-02',
                newest_trained_through: '2026-08-09', last_train_at: null },
      generated_at: '2026-08-20T09:00:00Z',
    })
    const { container } = render(<OperationalHealth health={health} />)

    const negatives = container.querySelectorAll('[data-tone="negative"]')
    const negativeLabels = [...negatives].map((node) => node.textContent ?? '')
    expect(negativeLabels.some((text) => text.includes('Forecasts'))).toBe(true)
    expect(negativeLabels.some((text) => text.includes('Real prices'))).toBe(true)
    expect(negativeLabels.some((text) => text.includes('Settlement'))).toBe(true)

    expect(screen.getByText(/12 without a forecast/)).toBeInTheDocument()
    expect(screen.getByText('37 waiting')).toBeInTheDocument()
    expect(screen.getByText(/744 of 18000 credits used, 17256 left/)).toBeInTheDocument()
  })
})

describe('ResultsReview', () => {
  const review = mapAiResultsReview({
    totals: { graded_fixtures: 1, result_correct: 0, result_accuracy: 0,
              exact_scores: 1, mean_log_loss: 1.3186, mean_rps: 0.1376,
              mean_brier: 0.8115, mean_market_log_loss: null, market_comparisons: 0 },
    by_league: [{ league: 'ECH', graded_fixtures: 1, result_correct: 0, exact_scores: 1,
                  mean_log_loss: 1.3186, mean_rps: 0.1376, mean_brier: 0.8115 }],
    by_predicted_result: [], by_data_confidence: [],
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

  it('counts fixtures rather than forecasts, and says how many it collapsed', () => {
    render(<ResultsReview review={review} />)
    expect(screen.getByText('4 repeated forecasts collapsed')).toBeInTheDocument()
  })

  it('explains the scoreline-right, outcome-wrong pair rather than leaving it to be read as corruption', () => {
    render(<ResultsReview review={review} />)
    expect(
      screen.getByText(/likeliest single score and the likeliest outcome are different statistics/),
    ).toBeInTheDocument()
  })

  it('refuses to let a tiny sample read as model quality', () => {
    render(<ResultsReview review={review} />)
    expect(screen.getByText(/Sample: early sample/i)).toBeInTheDocument()
    expect(screen.getByText(/variance, not skill/)).toBeInTheDocument()
  })

  it('says there is no closing benchmark rather than showing a comparison of zero', () => {
    render(<ResultsReview review={review} />)
    expect(screen.getByText('no closing benchmark published yet')).toBeInTheDocument()
  })
})
