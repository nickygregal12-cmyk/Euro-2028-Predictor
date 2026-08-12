import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({ rpc: vi.fn() }))

vi.mock('../../src/services/supabase/client', () => ({
  db: { rpc: mocks.rpc },
}))

import {
  fetchSeasonMatchweekProjection,
  ProjectionUnavailableError,
} from '../../src/services/supabase/seasonMatchweekProjection'

/**
 * Contract 175 at the call boundary.
 *
 * The three things worth asserting here are all about the CALL rather than the
 * payload: that the league argument is omitted when there is no league (so the
 * server's own default applies rather than an explicit null), that a refusal is
 * a typed absence rather than a thrown page, and that a transport fault stays a
 * fault. Everything about the payload is `seasonMatchweekProjectionModel`'s.
 */

const TOURNAMENT = '40000000-0000-0000-0000-000000000001'
const LEAGUE = '50000000-0000-0000-0000-000000000901'

function payload() {
  return {
    server_now: '2026-08-12T14:20:00Z',
    tournament_id: TOURNAMENT,
    matchweek: { matchweek_id: 'r-1', ordinal: 5, label: 'Matchweek 5' },
    locks_at: '2026-08-12T11:30:00Z',
    locked: true,
    joker_played: false,
    projected_points: 8,
    settled: false,
    fixtures: [],
    league: null,
  }
}

describe('fetchSeasonMatchweekProjection', () => {
  beforeEach(() => {
    mocks.rpc.mockReset()
  })

  it('omits the league argument entirely when no league was asked about', async () => {
    mocks.rpc.mockResolvedValue({ data: payload(), error: null })
    await fetchSeasonMatchweekProjection(TOURNAMENT, 5)
    expect(mocks.rpc).toHaveBeenCalledWith('get_season_matchweek_projection', {
      p_tournament_id: TOURNAMENT,
      p_matchweek: 5,
    })
  })

  it('passes the league through when one was', async () => {
    mocks.rpc.mockResolvedValue({ data: payload(), error: null })
    await fetchSeasonMatchweekProjection(TOURNAMENT, 5, LEAGUE)
    expect(mocks.rpc).toHaveBeenCalledWith('get_season_matchweek_projection', {
      p_tournament_id: TOURNAMENT,
      p_matchweek: 5,
      p_league_id: LEAGUE,
    })
  })

  it('turns a server refusal into a typed absence', async () => {
    mocks.rpc.mockResolvedValue({ data: null, error: { code: '42501', message: 'no entry' } })
    await expect(fetchSeasonMatchweekProjection(TOURNAMENT, 5)).rejects.toBeInstanceOf(
      ProjectionUnavailableError,
    )
  })

  it('leaves any other failure as the failure it was', async () => {
    const error = { code: '08006', message: 'connection failure' }
    mocks.rpc.mockResolvedValue({ data: null, error })
    await expect(fetchSeasonMatchweekProjection(TOURNAMENT, 5)).rejects.toBe(error)
  })

  it('refuses a payload it cannot read rather than rendering a hollow projection', async () => {
    mocks.rpc.mockResolvedValue({ data: { tournament_id: TOURNAMENT }, error: null })
    await expect(fetchSeasonMatchweekProjection(TOURNAMENT, 5)).rejects.toThrow(
      /not in the expected shape/,
    )
  })
})
