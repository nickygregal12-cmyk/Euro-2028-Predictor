import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { AiLabPage } from '../../../src/features/admin/AiLabPage'
import { mapAiLabSnapshot } from '../../../src/services/supabase/aiLabModel'
import { fetchAiLabSnapshot } from '../../../src/services/supabase/aiLab'

vi.mock('../../../src/services/supabase/aiLab', () => ({
  fetchAiLabSnapshot: vi.fn(),
  promoteAiModel: vi.fn(),
}))

const coverage = {
  window: { from: null, to: null },
  totals: {
    fixtures: 0, withForecast: 0, withoutForecast: 0,
    withRealBookmakerPrice: 0, withoutRealBookmakerPrice: 0,
    withCurrentDecision: 0, withoutCurrentDecision: 0,
    actionableBets: 0, passed: 0, priceWithinFreshnessLimit: 0,
  },
  passReasonCounts: [], byLeague: [], fixtures: [], generatedAt: null,
}

const health = {
  fixtures: { upcoming7d: 0, leaguesWithUpcoming: 0, playedAwaitingResult: 0, lastSyncAt: null },
  predictions: {
    upcomingFixtures: 0, withCurrentForecast: 0, withoutForecast: 0,
    oldestForecastAt: null, lastPredictAt: null,
  },
  prices: { lastRealCaptureAt: null, lastReferenceCaptureAt: null, realBooksSeen7d: [] },
  valueLoop: { lastRunAt: null, currentBets: 0, currentPasses: 0 },
  settlement: {
    advised: 0, settled: 0, playedAndUnsettled: 0,
    awaitingClosingBenchmark: 0, lastRunAt: null,
  },
  oddsApi: {
    collectionEnabled: false, monthlyCredits: null, softCap: null,
    creditsUsedThisMonth: null, lastDispatchAt: null, lastSuccessfulCallAt: null,
    lastCallStatus: null, eventsSeen: 0, eventsMatchedToFixture: 0,
  },
  models: {
    current: 0, expected: 9, versions: [], oldestTrainedThrough: null,
    newestTrainedThrough: null, lastTrainAt: null,
  },
  generatedAt: null,
}

const review = {
  window: { from: null, to: null },
  totals: {
    gradedFixtures: 0, resultCorrect: 0, resultAccuracy: null, exactScores: 0,
    meanLogLoss: null, meanRps: null, meanBrier: null,
    meanMarketLogLoss: null, marketComparisons: 0,
  },
  byLeague: [], byPredictedResult: [], byDataConfidence: [], fixtures: [],
  duplicateGradedRowsExcluded: 0, sampleSufficiency: 'NO_SAMPLE' as const,
  sampleNote: 'No graded fixtures in this window.', generatedAt: null,
}

vi.mock('../../../src/services/supabase/aiLabCoverage', () => ({
  fetchAiCoverage: vi.fn(async () => coverage),
  fetchAiOperationalHealth: vi.fn(async () => health),
  fetchAiResultsReview: vi.fn(async () => review),
}))

vi.mock('../../../src/services/supabase/betBuilder', () => ({
  fetchBetBuilderBookmakers: vi.fn(async () => []),
  fetchBetBuilderCandidates: vi.fn(async () => ({
    bookmaker: { code: '', name: '', kind: 'unknown', isRealPrice: false, exchangeCommission: null },
    legs: [], legCount: 0, truncatedAt: 0,
    window: { from: '', to: '' },
    coverage: {
      fixturesInWindow: 0, withCurrentDecision: 0, actionableAnywhere: 0,
      actionableAtThisBook: 0, passed: 0, passReasonCounts: {},
    },
    generatedAt: '',
  })),
}))

const snapshot = mapAiLabSnapshot({
  dashboard: {
    as_of: '2026-08-12T17:00:00Z',
    performance: { graded: 0 },
    models: [],
    calibration: [],
    jobs: {},
    gate: { public_enabled: false },
  },
  upcoming: [],
  recent: [],
  breakdown: {},
  betting: { clv: { n: 0 }, profit: { settled_bets: 0 }, open: {}, bookmakers: {}, gate: {} },
  bettingGate: { currently_public: false },
  markets: {},
  odds: {
    month_to_date_credits: 0, monthly_credits: 500, soft_cap: 450,
    remaining_to_soft_cap: 450, recent_calls: [],
    event_matching: { events_seen: 0, matched_to_fixture: 0, unmatched: [] },
  },
})

const challengerSnapshot = {
  ...snapshot,
  models: [{
    id: 'challenger-epl',
    league: 'EPL',
    version: 'selected-20260814-v1',
    family: 'ensemble',
    status: 'challenger',
    trainedAt: '2026-08-14T14:30:00Z',
    trainingMatches: 12345,
    validationAccuracy: 0.51,
    validationLogLoss: 0.971,
    baselineLogLoss: 1.02,
    marketLogLoss: 0.96,
  }],
}

describe('AI Lab page', () => {
  beforeEach(() => {
    vi.mocked(fetchAiLabSnapshot).mockReset().mockResolvedValue(snapshot)
  })

  it('opens on the useful forecast/value job and stays truthful before evidence exists', async () => {
    render(<AiLabPage />)

    expect(await screen.findByRole('heading', { name: 'AI Lab' })).toBeTruthy()
    expect(screen.getByText('Nothing places a bet')).toBeTruthy()
    expect(await screen.findByText('No fixtures in this window')).toBeTruthy()
    expect(screen.getByText('Building comparison')).toBeTruthy()
    expect(fetchAiLabSnapshot).toHaveBeenCalledWith(null)
  })

  it('does not expose routine manual promotion as a second model-selection authority', async () => {
    vi.mocked(fetchAiLabSnapshot).mockResolvedValue(challengerSnapshot)
    render(<AiLabPage />)

    await screen.findByRole('heading', { name: 'AI Lab' })
    fireEvent.click(screen.getByRole('button', { name: /Model Lab/ }))

    expect(await screen.findByRole('heading', { name: 'Verified activation is automatic' })).toBeTruthy()
    expect(screen.getByText(/1 challenger observed/)).toBeTruthy()
    expect(screen.queryByRole('button', { name: /Promote/i })).toBeNull()
    expect(screen.queryByRole('button', { name: /Make current/i })).toBeNull()
  })

  it('filters every read by competition and keeps the four user jobs explicit', async () => {
    render(<AiLabPage />)
    await screen.findByText('No fixtures in this window')

    fireEvent.change(screen.getByLabelText('Competition'), { target: { value: 'SL2' } })
    await waitFor(() => expect(fetchAiLabSnapshot).toHaveBeenLastCalledWith('SL2'))

    for (const label of ['Today', 'Performance', 'Bet Builder', 'Model Lab']) {
      expect(screen.getByRole('button', { name: new RegExp(label) })).toBeTruthy()
    }

    fireEvent.click(screen.getByRole('button', { name: /Performance/ }))
    expect(await screen.findByRole('heading', { name: 'Is it actually any good?' })).toBeTruthy()

    fireEvent.click(screen.getByRole('button', { name: /Model Lab/ }))
    expect(await screen.findByRole('heading', { name: "Can today's evidence be trusted?" })).toBeTruthy()
  })
})
