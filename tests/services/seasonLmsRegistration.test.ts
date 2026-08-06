import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  fetchBonusGames: vi.fn(),
  registerBonusCompetition: vi.fn(),
}))

vi.mock('../../src/services/supabase/bonusGames', () => ({
  fetchBonusGames: mocks.fetchBonusGames,
  registerBonusCompetition: mocks.registerBonusCompetition,
}))

import { createSeasonLmsRegistrationRpcGateway } from '../../src/services/supabase/seasonLmsRegistration'

const TOURNAMENT_ID = '70000000-0000-0000-0000-000000000101'
const COMPETITION_ID = '70000000-0000-0000-0000-000000000201'
const SUCCESSOR_ID = '70000000-0000-0000-0000-000000000202'
const USER_ID = '70000000-0000-0000-0000-000000000301'

function gateway(competitionId = COMPETITION_ID) {
  return createSeasonLmsRegistrationRpcGateway({
    tournamentId: TOURNAMENT_ID,
    competitionId,
    userId: USER_ID,
  })
}

function game(id: string, overrides: Record<string, unknown> = {}) {
  return {
    competition: {
      id,
      gameKey: 'last_man_standing',
      tournamentId: TOURNAMENT_ID,
      published: true,
      registrationOpensAt: '2027-01-01T09:00:00.000Z',
      registrationClosesAt: '2027-01-20T18:30:00.000Z',
      drawRequired: false,
      drawCompletedAt: null,
      completedAt: null,
      ...overrides,
    },
    windows: [],
    entrant: null,
  }
}

describe('createSeasonLmsRegistrationRpcGateway — load', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('maps the named competition’s registration facts, with the server instant', async () => {
    mocks.fetchBonusGames.mockResolvedValueOnce({
      serverNow: '2027-01-14T12:00:00.000Z',
      games: [game(COMPETITION_ID)],
    })

    const facts = await gateway().load()

    expect(mocks.fetchBonusGames).toHaveBeenCalledWith(TOURNAMENT_ID, USER_ID)
    expect(facts).toEqual({
      competitionId: COMPETITION_ID,
      entered: false,
      joinedAt: null,
      registrationOpensAt: '2027-01-01T09:00:00.000Z',
      registrationClosesAt: '2027-01-20T18:30:00.000Z',
      completedAt: null,
      serverNow: '2027-01-14T12:00:00.000Z',
    })
  })

  it('reports membership from the caller’s own entrant row', async () => {
    mocks.fetchBonusGames.mockResolvedValueOnce({
      serverNow: '2027-01-14T12:00:00.000Z',
      games: [
        {
          ...game(COMPETITION_ID),
          entrant: {
            competitionId: COMPETITION_ID,
            userId: USER_ID,
            joinedAt: '2027-01-10T09:00:00.000Z',
            outcome: 'active',
            pendingInputs: 0,
          },
        },
      ],
    })

    const facts = await gateway().load()

    expect(facts.entered).toBe(true)
    expect(facts.joinedAt).toBe('2027-01-10T09:00:00.000Z')
  })

  it('matches by exact id rather than by game key, so a successor is never guessed at', async () => {
    // Contract 107 creates a fresh successor when a wipeout restarts a
    // competition, so a season can list two. Picking one here would put a
    // second instance-resolution answer in the browser.
    mocks.fetchBonusGames.mockResolvedValueOnce({
      serverNow: '2027-01-14T12:00:00.000Z',
      games: [
        game(COMPETITION_ID, { completedAt: '2027-01-02T21:00:00.000Z' }),
        game(SUCCESSOR_ID),
      ],
    })

    const facts = await gateway(SUCCESSOR_ID).load()

    expect(facts.competitionId).toBe(SUCCESSOR_ID)
    expect(facts.completedAt).toBeNull()
  })

  it('fails loudly when the named competition is not in the listing', async () => {
    mocks.fetchBonusGames.mockResolvedValueOnce({
      serverNow: '2027-01-14T12:00:00.000Z',
      games: [game(SUCCESSOR_ID)],
    })

    await expect(gateway().load()).rejects.toThrow(
      'That Last Man Standing competition is no longer listed.',
    )
  })

  it('surfaces a hub read failure rather than swallowing it', async () => {
    const failure = new Error('hub unavailable')
    mocks.fetchBonusGames.mockRejectedValueOnce(failure)

    await expect(gateway().load()).rejects.toBe(failure)
  })
})

describe('createSeasonLmsRegistrationRpcGateway — join', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('registers the competition the caller named', async () => {
    mocks.registerBonusCompetition.mockResolvedValueOnce(undefined)

    await gateway().join()

    expect(mocks.registerBonusCompetition).toHaveBeenCalledWith(COMPETITION_ID)
  })

  it('surfaces the server refusal with its code intact for classification', async () => {
    const refusal = Object.assign(new Error('Registration has closed'), { code: '55000' })
    mocks.registerBonusCompetition.mockRejectedValueOnce(refusal)

    await expect(gateway().join()).rejects.toBe(refusal)
  })
})
