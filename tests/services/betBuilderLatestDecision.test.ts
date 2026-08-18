import { describe, expect, it, vi } from 'vitest'

/**
 * The Bet Builder currency rule, after contract 203 moved it into the database.
 *
 * It used to live here: the module fetched `admin_ai_recommendation_log` for all
 * nine leagues, 500 rows each, kept the newest row per fixture and intersected
 * that against the candidate list — because the candidate RPC filtered to BET
 * *before* taking the newest decision per prediction, and so returned superseded
 * BETs. Nine round trips to re-derive what one query could answer, and a second
 * definition of "current" in TypeScript beside the SQL one.
 *
 * `ai.current_fixture_recommendations` is now that one definition, and a
 * superseded BET never leaves the database. What is asserted HERE is what this
 * layer is still responsible for: it must ask once, and it must not reintroduce
 * a client-side opinion about which decision is current. The rule itself is
 * proved against a real database in `ai/test_db_lifecycle.py` and
 * `supabase/tests/251_ai_bet_builder_current_decision.sql`, in both directions.
 */

const rpc = vi.fn()

vi.mock('../../src/services/supabase/client', () => ({ db: { rpc } }))

const {
  fetchBetBuilderBookmakers,
  fetchBetBuilderCandidates,
  mapBookmakers,
  mapCandidates,
} = await import('../../src/services/supabase/betBuilder')

const BOOKS = {
  bookmakers: [
    {
      code: 'BFE', name: 'Betfair Exchange', kind: 'exchange', is_real_price: true,
      exchange_commission: 0.02, legs: 4, last_decided_at: '2026-08-20T09:00:00Z',
    },
    {
      code: 'B365', name: 'Bet365', kind: 'bookmaker', is_real_price: true,
      exchange_commission: null, legs: 0, last_decided_at: null,
    },
  ],
}

describe('Bet Builder venue picker', () => {
  it('shows the number of CURRENT legs the database counted, not a historical total', () => {
    const rows = mapBookmakers(BOOKS)
    expect(rows.find((row) => row.code === 'BFE')?.legs).toBe(4)
    // Zero is the honest answer for a venue whose BETs have all been superseded,
    // and the picker must say so rather than advertise legs that do not arrive.
    expect(rows.find((row) => row.code === 'B365')?.legs).toBe(0)
  })

  it('asks the database once', async () => {
    rpc.mockReset()
    rpc.mockResolvedValue({ data: BOOKS, error: null })
    await fetchBetBuilderBookmakers()
    expect(rpc).toHaveBeenCalledTimes(1)
    expect(rpc).toHaveBeenCalledWith('admin_ai_bet_builder_books')
  })
})

describe('Bet Builder candidates', () => {
  const payload = {
    bookmaker: {
      code: 'BFE', name: 'Betfair Exchange', kind: 'exchange',
      is_real_price: true, exchange_commission: 0.02,
    },
    legs: [{
      recommendation_id: 'rec-1', league: 'ECH', market: '1X2', selection: 'H',
      bookmaker: 'BFE', odds: 2.4, calibrated_prob: 0.55, fair_odds: 1.82,
      model_edge: 0.32, data_confidence: 0.8, data_confidence_state: 'sufficient',
      agreement_score: 0.9, uncertainty_width: 0.1,
      odds_captured_at: '2026-08-20T08:55:00Z', price_age_seconds: 300,
      price_age_limit_seconds: 43200, kickoff_at: '2026-08-22T14:00:00Z',
      fixture_id: 'f-1', home_canonical: 'Home FC', away_canonical: 'Away FC',
      horizon: 't48', uses_market: false,
    }],
    leg_count: 1,
    truncated_at: 500,
    window: { from: '2026-08-20T09:00:00Z', to: '2026-08-27T09:00:00Z' },
    generated_at: '2026-08-20T09:00:00Z',
  }

  it('asks the database once, and passes its answer through unfiltered', async () => {
    rpc.mockReset()
    rpc.mockResolvedValue({ data: payload, error: null })
    const built = await fetchBetBuilderCandidates({
      bookmaker: 'BFE',
      leagues: ['ECH'],
      from: new Date('2026-08-20T09:00:00Z'),
      to: new Date('2026-08-27T09:00:00Z'),
    })

    // ONE call. The nine-league fan-out this module used to perform to
    // re-derive currency is the regression this asserts against.
    expect(rpc).toHaveBeenCalledTimes(1)
    expect(rpc).toHaveBeenCalledWith('admin_ai_bet_builder_candidates', {
      p_bookmaker: 'BFE',
      p_leagues: ['ECH'],
      p_from: '2026-08-20T09:00:00.000Z',
      p_to: '2026-08-27T09:00:00.000Z',
      p_limit: 200,
    })
    expect(built.legCount).toBe(1)
    expect(built.legs[0]!.fixtureId).toBe('f-1')
    // The age and its limit travel together, so nothing downstream has to work
    // out which limit applied at this distance from kickoff.
    expect(built.legs[0]!.priceAgeSeconds).toBe(300)
    expect(built.legs[0]!.priceAgeLimitSeconds).toBe(43200)
  })

  it('surfaces the error rather than rendering an empty builder that looks like no value', async () => {
    rpc.mockReset()
    rpc.mockResolvedValue({ data: null, error: new Error('denied') })
    await expect(fetchBetBuilderCandidates({
      bookmaker: 'BFE', leagues: null,
      from: new Date('2026-08-20T09:00:00Z'), to: new Date('2026-08-27T09:00:00Z'),
    })).rejects.toThrow('denied')
  })

  it('decodes an empty leg list without inventing a bookmaker', () => {
    const built = mapCandidates({ legs: [], leg_count: 0 })
    expect(built.legs).toEqual([])
    expect(built.bookmaker.code).toBe('')
    expect(built.bookmaker.isRealPrice).toBe(false)
  })
})
