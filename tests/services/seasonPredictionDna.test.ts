import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({ rpc: vi.fn() }))

vi.mock('../../src/services/supabase/client', () => ({
  db: { rpc: mocks.rpc },
}))

import {
  fetchSeasonPredictionDna,
  PredictionDnaRefusedError,
} from '../../src/services/supabase/seasonPredictionDna'

/**
 * Contract 176 at the call boundary.
 *
 * The distinction that matters here is the one a component cannot make for
 * itself: a REFUSAL (`42501` — you share no private league with this player) is
 * not the same as a co-member who never entered, which contract 176 answers as
 * an ordinary payload. Flattening the two would show "no predictions yet" to
 * somebody who is simply not allowed to look.
 */

const TOURNAMENT = '40000000-0000-0000-0000-000000000001'
const PLAYER = '50000000-0000-0000-0000-000000000a01'

function payload(over: Record<string, unknown> = {}) {
  return {
    player: { user_id: PLAYER, display_name: 'Craig', is_self: false },
    entered: true,
    server_now: '2026-08-12T14:20:00Z',
    minimum_sample: 10,
    predictions_counted: 0,
    settled_predictions: 0,
    tendencies: null,
    accuracy: null,
    consensus: null,
    clubs: [],
    ...over,
  }
}

describe('fetchSeasonPredictionDna', () => {
  beforeEach(() => {
    mocks.rpc.mockReset()
  })

  it('asks the server about one named player and nothing else', async () => {
    mocks.rpc.mockResolvedValue({ data: payload(), error: null })
    await fetchSeasonPredictionDna(TOURNAMENT, PLAYER)
    expect(mocks.rpc).toHaveBeenCalledWith('get_season_prediction_dna', {
      p_tournament_id: TOURNAMENT,
      p_player_id: PLAYER,
    })
  })

  it('turns the disclosure refusal into a typed refusal', async () => {
    mocks.rpc.mockResolvedValue({
      data: null,
      error: { code: '42501', message: 'You do not share a private league with that player' },
    })
    await expect(fetchSeasonPredictionDna(TOURNAMENT, PLAYER)).rejects.toBeInstanceOf(
      PredictionDnaRefusedError,
    )
  })

  it('carries a co-member who never entered through as an ordinary answer', async () => {
    mocks.rpc.mockResolvedValue({ data: payload({ entered: false }), error: null })
    const dna = await fetchSeasonPredictionDna(TOURNAMENT, PLAYER)
    expect(dna.entered).toBe(false)
    expect(dna.player.displayName).toBe('Craig')
  })

  it('leaves any other failure as the failure it was', async () => {
    const error = { code: '08006', message: 'connection failure' }
    mocks.rpc.mockResolvedValue({ data: null, error })
    await expect(fetchSeasonPredictionDna(TOURNAMENT, PLAYER)).rejects.toBe(error)
  })
})
