import { describe, expect, it } from 'vitest'
import type { CoverageFixture } from '../../../src/services/supabase/aiLabCoverageModel'
import {
  forecastVerdict,
  scorelineHealth,
  valueVerdict,
} from '../../../src/features/admin/aiLabInsights'

function fixture(overrides: Partial<CoverageFixture> = {}): CoverageFixture {
  return {
    fixtureId: 'new-liv',
    league: 'EPL',
    kickoffAt: '2026-08-23T15:30:00Z',
    home: 'Newcastle',
    away: 'Liverpool',
    hoursToKickoff: 16,
    prediction: {
      predictionId: 'p-new-liv',
      modelVersion: 'current',
      modelFamily: 'ensemble',
      modelTrainedThrough: '2026-08-22',
      pHome: 0.3372,
      pDraw: 0.2684,
      pAway: 0.3943,
      predictedResult: 'A',
      predictedScore: '1-1',
      expHomeGoals: 1.289,
      expAwayGoals: 1.501,
      horizon: 't24',
      dataSnapshotAt: '2026-08-22T22:00:00Z',
      forecastMadeAt: '2026-08-22T22:00:00Z',
      forecastsCollapsed: 4,
      usesMarket: false,
    },
    quality: {
      dataConfidence: 0.8,
      dataConfidenceState: 'strong',
      missingInputs: [],
      agreement: 0.8,
      uncertaintyWidth: 0.1,
    },
    market: {
      realBooks: ['MTB'],
      realBookCount: 1,
      latestRealCaptureAt: '2026-08-22T22:39:38Z',
      bestRealPrice: {
        bookmaker: 'MTB', oddsHome: 4.2, oddsDraw: 3.6, oddsAway: 1.9,
        capturedAt: '2026-08-22T22:39:38Z',
      },
      aggregateReferenceAvailable: true,
    },
    decision: {
      decision: 'BET',
      selection: 'H',
      market: '1X2',
      reasons: [],
      bookmaker: 'MTB',
      oddsOffered: 4.2,
      modelProbability: 0.3372,
      modelFairOdds: 2.97,
      marketFairProbability: 0.261,
      modelEdge: 0.4164,
      dataConfidence: 0.8,
      dataConfidenceState: 'strong',
      agreementScore: 0.8,
      uncertaintyWidth: 0.1,
      oddsCapturedAt: '2026-08-22T22:39:38Z',
      priceAgeSeconds: 900,
      priceAgeLimitSeconds: 3600,
      decidedAt: '2026-08-22T22:55:31Z',
    },
    ...overrides,
  }
}

describe('AI Lab plain-English fixture verdicts', () => {
  it('keeps most-likely result separate from a contrarian value bet', () => {
    const row = fixture()
    expect(forecastVerdict(row)).toMatchObject({ key: 'A', label: 'Liverpool' })

    const value = valueVerdict(row)
    expect(value.kind).toBe('bet')
    if (value.kind !== 'bet') throw new Error('expected a bet verdict')
    expect(value.alignedWithForecast).toBe(false)
    expect(value.headline).toBe('Contrarian value')
    expect(value.explanation).toMatch(/Liverpool remains the most likely result/)
    expect(value.explanation).toMatch(/Newcastle is the value call only because/)
    expect(value.explanation).toMatch(/34% versus the market's fair 26%/)
  })

  it('fails closed when the canonical forecast has not yet been re-priced', () => {
    const value = valueVerdict(fixture({ decision: null }))
    expect(value.kind).toBe('awaiting')
    expect(value.explanation).toMatch(/Older advice is deliberately not reused/)
  })
})

describe('exact-score health', () => {
  it('flags a collapsed score head instead of presenting repetition as confidence', () => {
    const rows = Array.from({ length: 12 }, (_, index) =>
      fixture({ fixtureId: `f-${index}` }),
    )
    const health = scorelineHealth(rows)
    expect(health).toMatchObject({ sample: 12, topScore: '1-1', topCount: 12, concerning: true })
    expect(health.share).toBe(1)
  })

  it('does not alarm on a small or varied sample', () => {
    const rows = [
      fixture({ fixtureId: 'a' }),
      fixture({
        fixtureId: 'b',
        prediction: { ...fixture().prediction!, predictionId: 'pb', predictedScore: '2-1' },
      }),
    ]
    expect(scorelineHealth(rows).concerning).toBe(false)
  })
})
