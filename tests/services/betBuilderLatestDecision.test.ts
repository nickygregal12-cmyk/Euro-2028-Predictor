import { describe, expect, it } from 'vitest'
import {
  currentBetDecisionSnapshot,
  filterCandidatePayloadToCurrentDecisions,
  mapBookmakers,
} from '../../src/services/supabase/betBuilder'

const NOW = Date.parse('2026-08-15T08:00:00Z')

function decision(overrides: Record<string, unknown> = {}) {
  return {
    id: 'rec-default',
    league: 'ECH',
    market: '1X2',
    decision: 'BET',
    decided_at: '2026-08-15T07:59:00Z',
    kickoff_at: '2026-08-15T11:30:00Z',
    bookmaker: 'BFE',
    home_canonical: 'Home FC',
    away_canonical: 'Away FC',
    prediction_quarantined: false,
    ...overrides,
  }
}

describe('Bet Builder latest recommendation authority', () => {
  it('lets a newer PASS supersede an older BET without deleting audit history', () => {
    const snapshot = currentBetDecisionSnapshot({
      recommendations: [
        decision({ id: 'new-pass', decision: 'PASS', decided_at: '2026-08-15T07:59:00Z' }),
        decision({ id: 'old-bet', decision: 'BET', decided_at: '2026-08-15T07:40:00Z' }),
      ],
    }, NOW)

    expect(snapshot.currentBetRecommendationIds.has('old-bet')).toBe(false)
    expect(snapshot.currentBetRecommendationIds.has('new-pass')).toBe(false)
    expect(snapshot.currentBetCountsByBook.get('BFE') ?? 0).toBe(0)
  })

  it('keeps exactly the newest future non-quarantined BET per fixture and market', () => {
    const snapshot = currentBetDecisionSnapshot({
      recommendations: [
        decision({ id: 'current-bet', bookmaker: 'bfe' }),
        decision({ id: 'older-bet', decided_at: '2026-08-15T07:30:00Z' }),
        decision({
          id: 'other-bet',
          home_canonical: 'Third FC',
          away_canonical: 'Fourth FC',
          bookmaker: 'SMK',
        }),
        decision({
          id: 'quarantined',
          home_canonical: 'Fifth FC',
          away_canonical: 'Sixth FC',
          prediction_quarantined: true,
        }),
        decision({
          id: 'past',
          home_canonical: 'Seventh FC',
          away_canonical: 'Eighth FC',
          kickoff_at: '2026-08-15T07:00:00Z',
        }),
      ],
    }, NOW)

    expect([...snapshot.currentBetRecommendationIds].sort()).toEqual(['current-bet', 'other-bet'])
    expect(snapshot.currentBetCountsByBook.get('BFE')).toBe(1)
    expect(snapshot.currentBetCountsByBook.get('SMK')).toBe(1)
  })

  it('filters the legacy BET candidate RPC down to current BET recommendation ids', () => {
    const payload = {
      bookmaker: { code: 'BFE' },
      leg_count: 3,
      legs: [
        { recommendation_id: 'current-bet' },
        { recommendation_id: 'superseded-bet' },
        { recommendation_id: 'another-current-bet' },
      ],
    }
    const filtered = filterCandidatePayloadToCurrentDecisions(
      payload,
      new Set(['current-bet', 'another-current-bet']),
    ) as { leg_count: number; legs: { recommendation_id: string }[] }

    expect(filtered.leg_count).toBe(2)
    expect(filtered.legs.map((row) => row.recommendation_id)).toEqual([
      'current-bet',
      'another-current-bet',
    ])
  })

  it('uses current decision counts instead of historical BET totals for bookmaker choice', () => {
    const rows = mapBookmakers({
      bookmakers: [
        {
          code: 'B365', name: 'Bet365', kind: 'bookmaker', is_real_price: true,
          exchange_commission: null, legs: 20, last_decided_at: null,
        },
        {
          code: 'BFE', name: 'Betfair Exchange', kind: 'exchange', is_real_price: true,
          exchange_commission: 0.02, legs: 50, last_decided_at: null,
        },
      ],
    }, new Map([['B365', 0], ['BFE', 4]]))

    expect(rows.find((row) => row.code === 'B365')?.legs).toBe(0)
    expect(rows.find((row) => row.code === 'BFE')?.legs).toBe(4)
  })
})