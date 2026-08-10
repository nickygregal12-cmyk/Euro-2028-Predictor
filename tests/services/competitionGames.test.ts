import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  rpc: vi.fn(),
  in: vi.fn(),
}))

vi.mock('../../src/services/supabase/client', () => ({
  db: {
    rpc: mocks.rpc,
    from: (table: string) => {
      expect(table).toBe('tournaments')
      return { select: (columns: string) => {
        expect(columns).toBe('id, name, status')
        return { in: mocks.in }
      } }
    },
  },
}))

import { fetchHubMembership } from '../../src/services/supabase/competitionGames'
import {
  decodeSeasonGames,
  isActiveMembership,
} from '../../src/services/supabase/competitionGamesModel'

const PL_ID = '60000000-0000-0000-0000-000000000001'
const EURO_ID = '60000000-0000-0000-0000-000000000002'

function gamePayload(overrides: Record<string, unknown> = {}) {
  return {
    id: '60000000-0000-0000-0000-000000000101',
    game_key: 'main_predictor',
    display_name: 'Main Predictor',
    active: true,
    membership: null,
    ...overrides,
  }
}

function seasonPayload(overrides: Record<string, unknown> = {}) {
  return {
    server_now: '2026-08-06T12:00:00Z',
    competition_member: false,
    games: [gamePayload()],
    ...overrides,
  }
}

describe('fetchHubMembership', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('resolves each returned season row and reads its games', async () => {
    mocks.in.mockResolvedValueOnce({
      data: [
        { id: PL_ID, name: 'Premier League 2026/27', status: 'draft' },
        { id: EURO_ID, name: 'UEFA Euro 2028', status: 'scheduled' },
      ],
      error: null,
    })
    mocks.rpc.mockResolvedValue({ data: seasonPayload(), error: null })

    const seasons = await fetchHubMembership(['Premier League 2026/27', 'UEFA Euro 2028'])

    expect(mocks.rpc).toHaveBeenCalledTimes(2)
    expect(mocks.rpc).toHaveBeenCalledWith('get_competition_games', {
      p_tournament_id: PL_ID,
    })
    expect(seasons.map((season) => season.seasonName)).toEqual([
      'Premier League 2026/27',
      'UEFA Euro 2028',
    ])
    expect(seasons[0]?.seasonStatus).toBe('draft')
  })

  it('omits a season the database does not hold instead of inventing it', async () => {
    mocks.in.mockResolvedValueOnce({
      data: [{ id: PL_ID, name: 'Premier League 2026/27', status: 'draft' }],
      error: null,
    })
    mocks.rpc.mockResolvedValue({ data: seasonPayload(), error: null })

    const seasons = await fetchHubMembership([
      'Premier League 2026/27',
      'Scottish Premiership 2026/27',
    ])

    expect(seasons).toHaveLength(1)
    expect(mocks.rpc).toHaveBeenCalledTimes(1)
  })

  it('reports an unknown season status as null rather than guessing a lifecycle', async () => {
    mocks.in.mockResolvedValueOnce({
      data: [{ id: PL_ID, name: 'Premier League 2026/27', status: 'surprising' }],
      error: null,
    })
    mocks.rpc.mockResolvedValue({ data: seasonPayload(), error: null })

    const seasons = await fetchHubMembership(['Premier League 2026/27'])

    expect(seasons[0]?.seasonStatus).toBeNull()
  })

  it('throws when the season query fails — a failure is never an empty result', async () => {
    mocks.in.mockResolvedValueOnce({ data: null, error: new Error('offline') })

    await expect(fetchHubMembership(['Premier League 2026/27'])).rejects.toThrow('offline')
  })

  it('throws when any games read fails rather than returning partial truth', async () => {
    mocks.in.mockResolvedValueOnce({
      data: [
        { id: PL_ID, name: 'Premier League 2026/27', status: 'draft' },
        { id: EURO_ID, name: 'UEFA Euro 2028', status: 'scheduled' },
      ],
      error: null,
    })
    mocks.rpc
      .mockResolvedValueOnce({ data: seasonPayload(), error: null })
      .mockResolvedValueOnce({ data: null, error: new Error('rpc down') })

    await expect(
      fetchHubMembership(['Premier League 2026/27', 'UEFA Euro 2028']),
    ).rejects.toThrow('rpc down')
  })

  it('asks the database nothing when no season names are given', async () => {
    await expect(fetchHubMembership([])).resolves.toEqual([])
    expect(mocks.in).not.toHaveBeenCalled()
    expect(mocks.rpc).not.toHaveBeenCalled()
  })
})

describe('decodeSeasonGames', () => {
  it('decodes games with and without a membership', () => {
    const decoded = decodeSeasonGames(
      seasonPayload({
        competition_member: true,
        games: [
          gamePayload({
            membership: { id: 'm-1', status: 'active', joined_at: '2026-08-01T10:00:00Z' },
          }),
          gamePayload({ game_key: 'last_man_standing', active: false }),
        ],
      }),
    )

    expect(decoded.competitionMember).toBe(true)
    expect(decoded.games).toEqual([
      {
        id: '60000000-0000-0000-0000-000000000101',
        gameKey: 'main_predictor',
        active: true,
        displayName: 'Main Predictor',
        registrationOpensAt: null,
        registrationClosesAt: null,
        completedAt: null,
        allowRejoin: false,
        membership: {
          status: 'active',
          joinedAt: '2026-08-01T10:00:00Z',
          leftAt: null,
          disqualifiedAt: null,
        },
      },
      {
        id: '60000000-0000-0000-0000-000000000101',
        gameKey: 'last_man_standing',
        active: false,
        displayName: 'Main Predictor',
        registrationOpensAt: null,
        registrationClosesAt: null,
        completedAt: null,
        allowRejoin: false,
        membership: null,
      },
    ])
  })

  it('keeps the id, window and rejoin facts the RPC returns — the id is what a join is addressed by', () => {
    const decoded = decodeSeasonGames(
      seasonPayload({
        games: [
          gamePayload({
            id: 'game-competition-1',
            registration_opens_at: '2026-08-01T09:00:00Z',
            registration_closes_at: '2026-09-01T09:00:00Z',
            completed_at: null,
            allow_rejoin: true,
            membership: {
              status: 'left',
              joined_at: '2026-08-02T09:00:00Z',
              left_at: '2026-08-10T09:00:00Z',
              disqualified_at: null,
            },
          }),
        ],
      }),
    )

    expect(decoded.serverNow).toBe('2026-08-06T12:00:00Z')
    expect(decoded.games[0]).toMatchObject({
      id: 'game-competition-1',
      registrationOpensAt: '2026-08-01T09:00:00Z',
      registrationClosesAt: '2026-09-01T09:00:00Z',
      allowRejoin: true,
      membership: { status: 'left', leftAt: '2026-08-10T09:00:00Z' },
    })
  })

  it('treats an absent allow_rejoin as no rejoin rather than the permissive default', () => {
    const decoded = decodeSeasonGames(
      seasonPayload({ games: [gamePayload({ allow_rejoin: undefined })] }),
    )

    expect(decoded.games[0].allowRejoin).toBe(false)
  })

  it('fails loudly on a game with no id, because it could not be joined or left', () => {
    expect(() =>
      decodeSeasonGames(seasonPayload({ games: [gamePayload({ id: undefined })] })),
    ).toThrow('expected shape')
  })

  it('skips an unknown game key rather than failing or guessing', () => {
    const decoded = decodeSeasonGames(
      seasonPayload({ games: [gamePayload({ game_key: 'a_future_game' }), gamePayload()] }),
    )

    expect(decoded.games.map((game) => game.gameKey)).toEqual(['main_predictor'])
  })

  it('fails loudly on a malformed payload instead of reading it as no games', () => {
    expect(() => decodeSeasonGames(null)).toThrow('expected shape')
    expect(() => decodeSeasonGames({ competition_member: 'yes', games: [] })).toThrow(
      'expected shape',
    )
    expect(() => decodeSeasonGames(seasonPayload({ games: 'none' }))).toThrow('expected shape')
    expect(() =>
      decodeSeasonGames(seasonPayload({ games: [gamePayload({ active: 'true' })] })),
    ).toThrow('expected shape')
    expect(() =>
      decodeSeasonGames(seasonPayload({ games: [gamePayload({ membership: { id: 'm' } })] })),
    ).toThrow('expected shape')
  })

  it('counts only an active membership as being in the game', () => {
    const active = decodeSeasonGames(
      seasonPayload({ games: [gamePayload({ membership: { status: 'active' } })] }),
    )
    const left = decodeSeasonGames(
      seasonPayload({ games: [gamePayload({ membership: { status: 'left' } })] }),
    )

    expect(isActiveMembership(active.games[0]!)).toBe(true)
    expect(isActiveMembership(left.games[0]!)).toBe(false)
  })
})
