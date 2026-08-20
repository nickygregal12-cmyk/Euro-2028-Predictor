import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({ rpc: vi.fn() }))

vi.mock('../../src/services/supabase/client', () => ({
  db: { rpc: mocks.rpc },
}))

import { createSeasonMatchPredictorRpcGateway } from '../../src/services/supabase/seasonMatchPredictor'

const TOURNAMENT_ID = '50000000-0000-0000-0000-000000000001'
const FIXTURE_A = '50000000-0000-0000-0000-000000000101'
const FIXTURE_B = '50000000-0000-0000-0000-000000000102'

const NOW = () => new Date('2027-01-15T12:00:00Z')

function gateway(now: () => Date = NOW) {
  return createSeasonMatchPredictorRpcGateway({
    tournamentId: TOURNAMENT_ID,
    competitionName: 'Premier League',
    seasonLabel: '2026/27',
    timeZone: 'Europe/London',
    now,
  })
}

function basePayload(overrides: Record<string, unknown> = {}) {
  return {
    matchweek: { number: 10, of: 38 },
    card_status: 'provisional',
    joker: { played: false, used_first_half: 2, used_second_half: 1, matchweek_count: 38 },
    settled_points: null,
    fixtures: [
      {
        id: FIXTURE_A,
        kickoff_at: '2027-01-20T15:00:00Z',
        status: 'scheduled',
        home_name: 'Home FC',
        away_name: 'Away FC',
        result_home: null,
        result_away: null,
        prediction: { home: 2, away: 1, version: 3 },
      },
      {
        id: FIXTURE_B,
        kickoff_at: '2027-01-21T15:00:00Z',
        status: 'scheduled',
        home_name: 'Third FC',
        away_name: 'Fourth FC',
        result_home: null,
        result_away: null,
        prediction: null,
      },
    ],
    ...overrides,
  }
}

describe('createSeasonMatchPredictorRpcGateway — load', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('maps a healthy RPC response onto the page read model, open before the earliest kickoff', async () => {
    mocks.rpc.mockResolvedValueOnce({ data: basePayload(), error: null })

    const page = await gateway().load(10)

    expect(mocks.rpc).toHaveBeenCalledWith('get_season_matchweek_card', {
      p_tournament_id: TOURNAMENT_ID,
      p_matchweek: 10,
    })
    expect(page.competition).toEqual({
      name: 'Premier League',
      seasonLabel: '2026/27',
      timeZone: 'Europe/London',
    })
    expect(page.matchweek).toEqual({ number: 10, of: 38 })
    expect(page.cardStatus).toBe('provisional')
    expect(page.settledPoints).toBeNull()
    expect(page.lock).toEqual({
      status: 'open',
      locked: false,
      lockAt: '2027-01-20T15:00:00.000Z',
      reason: 'before_scope_lock',
    })
    expect(page.fixtures).toHaveLength(2)
    expect(page.fixtures[0]).toMatchObject({
      fixtureId: FIXTURE_A,
      kickoffAt: '2027-01-20T15:00:00Z',
      prediction: { home: 2, away: 1 },
      result: null,
      points: null,
    })
    expect(page.fixtures[1]?.prediction).toBeNull()
  })

  it('reports the matchweek locked once the earliest kickoff has passed', async () => {
    mocks.rpc.mockResolvedValueOnce({ data: basePayload(), error: null })

    const page = await gateway(() => new Date('2027-01-20T16:00:00Z')).load(10)

    expect(page.lock.status).toBe('locked')
    expect(page.lock.reason).toBe('scope_lock_reached')
  })

  it('treats a settled matchweek past lock as scored, surfacing settled points', async () => {
    mocks.rpc.mockResolvedValueOnce({
      data: basePayload({ settled_points: 7, card_status: 'confirmed' }),
      error: null,
    })

    const page = await gateway(() => new Date('2027-01-22T00:00:00Z')).load(10)

    expect(page.lock.locked).toBe(true)
    expect(page.settledPoints).toBe(7)
  })

  it('resolves an empty fixture list as missing fixture data rather than open', async () => {
    mocks.rpc.mockResolvedValueOnce({ data: basePayload({ fixtures: [] }), error: null })

    const page = await gateway().load(10)

    expect(page.lock).toEqual({
      status: 'locked',
      locked: true,
      lockAt: null,
      reason: 'missing_fixture_data',
    })
  })

  it('computes remaining Jokers from the first-half tally when the matchweek is in the first half', async () => {
    mocks.rpc.mockResolvedValueOnce({ data: basePayload(), error: null }) // matchweek 10 of 38 -> first half

    const page = await gateway().load(10)

    expect(page.joker).toEqual({ playedHere: false, remainingThisHalf: 3, playable: true })
  })

  it('computes remaining Jokers from the second-half tally when the matchweek is in the second half', async () => {
    mocks.rpc.mockResolvedValueOnce({
      data: basePayload({ matchweek: { number: 25, of: 38 } }),
      error: null,
    })

    const page = await gateway().load(25)

    expect(page.joker).toEqual({ playedHere: false, remainingThisHalf: 4, playable: true })
  })

  it('reports no Jokers playable once a half\'s allowance is exhausted', async () => {
    mocks.rpc.mockResolvedValueOnce({
      data: basePayload({
        joker: { played: false, used_first_half: 5, used_second_half: 0, matchweek_count: 38 },
      }),
      error: null,
    })

    const page = await gateway().load(10)

    expect(page.joker).toEqual({ playedHere: false, remainingThisHalf: 0, playable: false })
  })

  it('propagates the RPC error rather than returning a guessed page', async () => {
    mocks.rpc.mockResolvedValueOnce({ data: null, error: { message: 'boom', code: '42501' } })

    await expect(gateway().load(10)).rejects.toEqual({ message: 'boom', code: '42501' })
  })

  it('fails loudly on a malformed response instead of rendering a guessed card', async () => {
    mocks.rpc.mockResolvedValueOnce({ data: { fixtures: [] }, error: null })

    await expect(gateway().load(10)).rejects.toThrow(
      'The season card response was not in the expected shape.',
    )
  })
})

describe('createSeasonMatchPredictorRpcGateway — apply', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('sends the version last read on a subsequent prediction write, echoed from load', async () => {
    mocks.rpc.mockResolvedValueOnce({ data: basePayload(), error: null })
    const gw = gateway()
    await gw.load(10) // FIXTURE_A last known version 3, FIXTURE_B has no prediction (no version)

    mocks.rpc.mockResolvedValueOnce({ data: { version: 4 }, error: null })
    await gw.apply(10, { kind: 'setPrediction', fixtureId: FIXTURE_A, prediction: { home: 3, away: 0 } })

    expect(mocks.rpc).toHaveBeenLastCalledWith('save_season_prediction', {
      p_tournament_id: TOURNAMENT_ID,
      p_season_fixture_id: FIXTURE_A,
      p_home: 3,
      p_away: 0,
      p_version: 3,
    })
  })

  it('defaults an unseen fixture\'s version to 0 when setting a first prediction', async () => {
    mocks.rpc.mockResolvedValueOnce({ data: basePayload(), error: null })
    const gw = gateway()
    await gw.load(10)

    mocks.rpc.mockResolvedValueOnce({ data: { version: 0 }, error: null })
    await gw.apply(10, { kind: 'setPrediction', fixtureId: FIXTURE_B, prediction: { home: 1, away: 1 } })

    expect(mocks.rpc).toHaveBeenLastCalledWith(
      'save_season_prediction',
      expect.objectContaining({ p_season_fixture_id: FIXTURE_B, p_version: 0 }),
    )
  })

  it('remembers the version the server echoes back, for the next write on that fixture', async () => {
    mocks.rpc.mockResolvedValueOnce({ data: basePayload(), error: null })
    const gw = gateway()
    await gw.load(10)

    mocks.rpc.mockResolvedValueOnce({ data: { version: 9 }, error: null })
    await gw.apply(10, { kind: 'setPrediction', fixtureId: FIXTURE_A, prediction: { home: 3, away: 0 } })

    mocks.rpc.mockResolvedValueOnce({ data: { version: 10 }, error: null })
    await gw.apply(10, { kind: 'setPrediction', fixtureId: FIXTURE_A, prediction: { home: 3, away: 1 } })

    expect(mocks.rpc).toHaveBeenLastCalledWith(
      'save_season_prediction',
      expect.objectContaining({ p_version: 9 }),
    )
  })

  it('clears the remembered version when a prediction is cleared', async () => {
    mocks.rpc.mockResolvedValueOnce({ data: basePayload(), error: null })
    const gw = gateway()
    await gw.load(10)

    mocks.rpc.mockResolvedValueOnce({ data: { version: 4 }, error: null })
    await gw.apply(10, { kind: 'setPrediction', fixtureId: FIXTURE_A, prediction: null })

    expect(mocks.rpc).toHaveBeenLastCalledWith('save_season_prediction', {
      p_tournament_id: TOURNAMENT_ID,
      p_season_fixture_id: FIXTURE_A,
      p_home: null,
      p_away: null,
      p_version: null,
    })
  })

  it('propagates a version-conflict rejection from a prediction write untouched', async () => {
    mocks.rpc.mockResolvedValueOnce({ data: basePayload(), error: null })
    const gw = gateway()
    await gw.load(10)

    mocks.rpc.mockResolvedValueOnce({ data: null, error: { code: 'PT409', message: 'conflict' } })

    await expect(
      gw.apply(10, { kind: 'setPrediction', fixtureId: FIXTURE_A, prediction: { home: 0, away: 0 } }),
    ).rejects.toEqual({ code: 'PT409', message: 'conflict' })
  })

  it('sets the matchweek Joker through its own RPC', async () => {
    mocks.rpc.mockResolvedValueOnce({ data: null, error: null })
    await gateway().apply(10, { kind: 'setJoker', played: true })

    expect(mocks.rpc).toHaveBeenCalledWith('set_season_matchweek_joker', {
      p_tournament_id: TOURNAMENT_ID,
      p_matchweek: 10,
      p_played: true,
    })
  })

  it('confirms the matchweek card through its own RPC', async () => {
    mocks.rpc.mockResolvedValueOnce({ data: null, error: null })
    await gateway().apply(10, { kind: 'confirmCard' })

    expect(mocks.rpc).toHaveBeenCalledWith('confirm_season_matchweek_card', {
      p_tournament_id: TOURNAMENT_ID,
      p_matchweek: 10,
    })
  })

  it('propagates a refusal from the Joker RPC untouched', async () => {
    mocks.rpc.mockResolvedValueOnce({ data: null, error: { code: '23514', message: 'no jokers left' } })

    await expect(gateway().apply(10, { kind: 'setJoker', played: true })).rejects.toEqual({
      code: '23514',
      message: 'no jokers left',
    })
  })
})

describe('createSeasonMatchPredictorRpcGateway — the per-fixture lock (contract 212, ING-005)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('carries the published instant and locked flag through, per fixture', async () => {
    // The divergence is the whole point: FIXTURE_A is an ordinary fixture on
    // the matchweek instant, FIXTURE_B has moved and answers for itself.
    mocks.rpc.mockResolvedValueOnce({
      data: basePayload({
        fixtures: [
          {
            id: FIXTURE_A,
            kickoff_at: '2027-01-20T15:00:00Z',
            status: 'scheduled',
            home_name: 'Home FC',
            away_name: 'Away FC',
            lock_at: '2027-01-20T15:00:00Z',
            locked: false,
            result_home: null,
            result_away: null,
            prediction: null,
          },
          {
            id: FIXTURE_B,
            kickoff_at: '2027-02-10T19:45:00Z',
            status: 'postponed',
            home_name: 'Third FC',
            away_name: 'Fourth FC',
            lock_at: '2027-02-10T19:45:00Z',
            locked: false,
            result_home: null,
            result_away: null,
            prediction: null,
          },
        ],
      }),
      error: null,
    })

    const page = await gateway().load(10)

    expect(page.fixtures[0]?.lockAt).toBe('2027-01-20T15:00:00Z')
    expect(page.fixtures[0]?.locked).toBe(false)
    // Not the matchweek instant. This is the field ING-005 said was missing.
    expect(page.fixtures[1]?.lockAt).toBe('2027-02-10T19:45:00Z')
    expect(page.fixtures[1]?.locked).toBe(false)
  })

  it('publishes no instant but an open fixture for a postponement with no known date', async () => {
    // `season_prediction_lock_at` answers `infinity` here, which has nothing to
    // print. The card sends a null instant and `locked` false, and the surface
    // must not turn that absence into a lock.
    mocks.rpc.mockResolvedValueOnce({
      data: basePayload({
        fixtures: [
          {
            id: FIXTURE_A,
            kickoff_at: '2027-01-20T15:00:00Z',
            status: 'postponed',
            home_name: 'Home FC',
            away_name: 'Away FC',
            lock_at: null,
            locked: false,
            result_home: null,
            result_away: null,
            prediction: null,
          },
        ],
      }),
      error: null,
    })

    const page = await gateway().load(10)

    expect(page.fixtures[0]?.lockAt).toBeNull()
    expect(page.fixtures[0]?.locked).toBe(false)
  })

  it('leaves locked undefined when the database has not crossed contract 212', async () => {
    // The rollout gap, asserted rather than assumed. A database at contract 211
    // answers without these fields, and `undefined` is what makes the page fall
    // back to the matchweek lock it drew before — the OLD behaviour, which is
    // the stricter of the two and therefore the safe thing to fall back to.
    mocks.rpc.mockResolvedValueOnce({ data: basePayload(), error: null })

    const page = await gateway().load(10)

    expect(page.fixtures[0]?.locked).toBeUndefined()
    expect(page.fixtures[0]?.lockAt).toBeNull()
  })
})
