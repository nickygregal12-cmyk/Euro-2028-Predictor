import { describe, expect, it } from 'vitest'
import { mapAiLabSnapshot } from '../../src/services/supabase/aiLabModel'

const empty = {
  dashboard: {}, upcoming: [], recent: [], breakdown: {}, betting: {}, bettingGate: {}, markets: {}, odds: {},
}

describe('AI Lab admin payload', () => {
  it('keeps CLV observations separate from settled bets and maps all nine-league data', () => {
    const snapshot = mapAiLabSnapshot({
      ...empty,
      dashboard: {
        as_of: '2026-08-12T17:00:00Z',
        performance: { graded: 20, result_correct: 11, accuracy: 0.55, exact_scores: 3 },
        models: [{ id: 'm1', league: 'SL2', version: 'v1', family: 'poisson', status: 'candidate', training_matches: 440 }],
        jobs: { predict: { status: 'succeeded', rows_written: 5 } },
        gate: { public_enabled: false },
      },
      upcoming: [{ id: 'p1', league: 'SL2', home: 'Elgin City', away: 'Forfar Athletic', p_home: 0.45, p_draw: 0.29, p_away: 0.26, predicted_result: 'H' }],
      recent: [{ id: 'p0', league: 'SL2', home: 'Clyde', away: 'Stirling Albion', p_home: 0.4, p_draw: 0.3, p_away: 0.3, predicted_result: 'H', result_correct: true, exact_score_correct: false }],
      markets: { '1X2': { name: 'Match result', settled_bets: 20, clv_observations: 5, mean_clv: 0.013, required_bets: 100 } },
      odds: { month_to_date_credits: 10, monthly_credits: 500, soft_cap: 450, remaining_to_soft_cap: 440, event_matching: { events_seen: 4, matched_to_fixture: 3, unmatched: ['Unknown FC'] } },
    })

    expect(snapshot.performance).toMatchObject({ graded: 20, accuracy: 0.55 })
    expect(snapshot.models[0]).toMatchObject({ league: 'SL2', family: 'poisson' })
    expect(snapshot.jobs[0]).toMatchObject({ name: 'predict', rowsWritten: 5 })
    expect(snapshot.upcoming[0]?.home).toBe('Elgin City')
    expect(snapshot.recent[0]?.resultCorrect).toBe(true)
    expect(snapshot.markets[0]).toMatchObject({ settledBets: 20, clvObservations: 5 })
    expect(snapshot.odds.eventMatching).toMatchObject({ eventsSeen: 4, matchedToFixture: 3 })
    expect(snapshot.publicationPublicEnabled).toBe(false)
  })

  it('fails closed to safe empty and non-public states for absent or malformed fields', () => {
    const snapshot = mapAiLabSnapshot({
      ...empty,
      dashboard: { gate: { public_enabled: 'true' }, performance: { graded: -4, accuracy: 'not-a-number' } },
      betting: { gate: { betting_public_enabled: 'true' } },
      bettingGate: { currently_public: 'true' },
      odds: { monthly_credits: '500', event_matching: null },
    })

    expect(snapshot.performance.graded).toBe(0)
    expect(snapshot.performance.accuracy).toBeNull()
    expect(snapshot.publicationPublicEnabled).toBe(false)
    expect(snapshot.betting.bettingPublicEnabled).toBe(false)
    expect(snapshot.bettingGate.currentlyPublic).toBe(false)
    expect(snapshot.odds.monthlyCredits).toBe(500)
    expect(snapshot.upcoming).toEqual([])
  })
})
