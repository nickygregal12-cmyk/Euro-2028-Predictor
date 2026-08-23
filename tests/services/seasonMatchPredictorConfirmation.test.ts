import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({ rpc: vi.fn() }))

vi.mock('../../src/services/supabase/client', () => ({
  db: { rpc: mocks.rpc },
}))

import { createSeasonMatchPredictorRpcGateway } from '../../src/services/supabase/seasonMatchPredictor'

const TOURNAMENT_ID = '50000000-0000-0000-0000-000000000214'
const FIXTURE_ID = '50000000-0000-0000-0000-000000000215'

function gateway() {
  return createSeasonMatchPredictorRpcGateway({
    tournamentId: TOURNAMENT_ID,
    competitionName: 'Premier League',
    seasonLabel: '2026/27',
    timeZone: 'Europe/London',
    now: () => new Date('2027-01-15T12:00:00Z'),
  })
}

function payload(confirmation: Record<string, unknown> = {}) {
  return {
    matchweek: { number: 10, of: 38 },
    card_status: 'confirmed',
    joker: { played: false, used_first_half: 0, used_second_half: 0, matchweek_count: 38 },
    settled_points: null,
    fixtures: [
      {
        id: FIXTURE_ID,
        kickoff_at: '2027-01-20T15:00:00Z',
        status: 'scheduled',
        home_name: 'Home FC',
        away_name: 'Away FC',
        result_home: null,
        result_away: null,
        prediction: { home: 2, away: 1, version: 3 },
      },
    ],
    ...confirmation,
  }
}

describe('createSeasonMatchPredictorRpcGateway — Contract 214 server-owned confirmation authority', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('maps the server confirmation instant and reference without deriving either', async () => {
    mocks.rpc.mockResolvedValueOnce({
      data: payload({
        confirmed_at: '2027-01-15T11:59:00Z',
        confirmation_reference: 'MW10-A1B2C3D4',
      }),
      error: null,
    })

    const page = await gateway().load(10)

    expect(page.confirmedAt).toBe('2027-01-15T11:59:00Z')
    expect(page.confirmationReference).toBe('MW10-A1B2C3D4')
  })

  it('maps missing evidence to null while hosted Supabase is below Contract 214', async () => {
    mocks.rpc.mockResolvedValueOnce({ data: payload(), error: null })

    const page = await gateway().load(10)

    expect(page.cardStatus).toBe('confirmed')
    expect(page.confirmedAt).toBeNull()
    expect(page.confirmationReference).toBeNull()
  })

  // The confirm RPC is the only place that knows the instant it just stored.
  // Answering void here is what left a confirmed card with no evidence line
  // until an unrelated reload, so the write itself has to carry it back.
  it('answers the confirmation evidence the confirm RPC returned', async () => {
    mocks.rpc.mockResolvedValueOnce({
      data: {
        card_status: 'confirmed',
        confirmed_at: '2027-01-15T12:00:00Z',
        confirmation_reference: 'MW10-9F8E7D6C',
      },
      error: null,
    })

    const outcome = await gateway().apply(10, { kind: 'confirmCard' })

    expect(outcome).toEqual({
      confirmedAt: '2027-01-15T12:00:00Z',
      confirmationReference: 'MW10-9F8E7D6C',
    })
  })

  it('answers null evidence when the confirm RPC predates Contract 214', async () => {
    mocks.rpc.mockResolvedValueOnce({ data: null, error: null })

    const outcome = await gateway().apply(10, { kind: 'confirmCard' })

    expect(outcome).toEqual({ confirmedAt: null, confirmationReference: null })
  })
})