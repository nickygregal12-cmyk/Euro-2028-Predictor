import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({ rpc: vi.fn() }))

vi.mock('../../src/services/supabase/client', () => ({
  db: { rpc: mocks.rpc },
}))

import { createSeasonLmsRpcGateway } from '../../src/services/supabase/seasonLms'

const TOURNAMENT_ID = '50000000-0000-0000-0000-000000000201'
const WINDOW_ID = '50000000-0000-0000-0000-000000000301'
const FIXTURE_ID = '50000000-0000-0000-0000-000000000401'
const TEAM_HOME = '50000000-0000-0000-0000-000000000501'
const TEAM_AWAY = '50000000-0000-0000-0000-000000000502'
const TEAM_USED = '50000000-0000-0000-0000-000000000503'

function gateway() {
  return createSeasonLmsRpcGateway({ tournamentId: TOURNAMENT_ID })
}

function roundPayload(overrides: Record<string, unknown> = {}) {
  return {
    available: true,
    entered: true,
    entry_outcome: null,
    used_cycle: 1,
    used_team_ids: [TEAM_USED],
    window: {
      id: WINDOW_ID,
      sequence: 4,
      label: 'Matchweek 4',
      opens_at: '2027-01-10T00:00:00Z',
      locks_at: '2027-01-17T14:30:00Z',
      settles_at: null,
      selection: { team_id: TEAM_HOME, version: 2 },
      pick_outcome: null,
      fixtures: [
        {
          season_fixture_id: FIXTURE_ID,
          kickoff_at: '2027-01-17T15:00:00Z',
          status: 'scheduled',
          home_score: null,
          away_score: null,
          // The legal spellings a provider actually supplies, so the
          // display-name assertion below exercises the real input rather than
          // a placeholder that happens to end in a token.
          home: { team_id: TEAM_HOME, name: 'Aston Villa FC' },
          away: { team_id: TEAM_AWAY, name: 'AFC Bournemouth' },
        },
      ],
    },
    ...overrides,
  }
}

describe('createSeasonLmsRpcGateway — load', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('maps a healthy round onto the read model, marking already-used clubs', async () => {
    mocks.rpc.mockResolvedValueOnce({ data: roundPayload(), error: null })

    const page = await gateway().load()

    expect(mocks.rpc).toHaveBeenCalledWith('get_season_lms_round', {
      p_tournament_id: TOURNAMENT_ID,
    })
    expect(page.available).toBe(true)
    expect(page.entered).toBe(true)
    expect(page.round).toEqual({
      windowId: WINDOW_ID,
      sequence: 4,
      label: 'Matchweek 4',
      opensAt: '2027-01-10T00:00:00Z',
      locksAt: '2027-01-17T14:30:00Z',
    })
    expect(page.pick).toEqual({ teamId: TEAM_HOME })
    expect(page.fixtures).toHaveLength(1)
    // The provider's legal suffix does not reach the pick list: a phone
    // renders these names in a `nowrap`/`ellipsis` column, so 'FC' is what
    // truncates the club rather than what identifies it.
    expect(page.fixtures[0]).toMatchObject({
      fixtureId: FIXTURE_ID,
      home: { teamId: TEAM_HOME, name: 'Aston Villa', used: false },
      away: { teamId: TEAM_AWAY, name: 'Bournemouth', used: false },
      score: null,
    })
  })

  it('marks a club used when it appears in the used-team list, regardless of this round', async () => {
    mocks.rpc.mockResolvedValueOnce({
      data: roundPayload({
        used_team_ids: [TEAM_USED, TEAM_AWAY],
      }),
      error: null,
    })

    const page = await gateway().load()

    expect(page.fixtures[0]?.away.used).toBe(true)
    expect(page.fixtures[0]?.home.used).toBe(false)
  })

  it('reports a settled score once both sides have one', async () => {
    mocks.rpc.mockResolvedValueOnce({
      data: roundPayload({
        window: {
          ...roundPayload().window,
          fixtures: [
            {
              ...(roundPayload().window as { fixtures: Record<string, unknown>[] }).fixtures[0],
              home_score: 2,
              away_score: 1,
            },
          ],
        },
      }),
      error: null,
    })

    const page = await gateway().load()

    expect(page.fixtures[0]?.score).toEqual({ home: 2, away: 1 })
  })

  it('returns no round, no pick and no fixtures when nothing is open to the player', async () => {
    mocks.rpc.mockResolvedValueOnce({
      data: roundPayload({ window: null, entered: false }),
      error: null,
    })

    const page = await gateway().load()

    expect(page.round).toBeNull()
    expect(page.pick).toBeNull()
    expect(page.pickOutcome).toBeNull()
    expect(page.fixtures).toEqual([])
  })

  it('propagates the RPC error rather than returning a guessed round', async () => {
    mocks.rpc.mockResolvedValueOnce({ data: null, error: { message: 'boom', code: '42501' } })

    await expect(gateway().load()).rejects.toEqual({ message: 'boom', code: '42501' })
  })

  it('fails loudly on a malformed response instead of rendering a guessed round', async () => {
    mocks.rpc.mockResolvedValueOnce({ data: { available: true }, error: null })

    await expect(gateway().load()).rejects.toThrow(
      'The season Last Man Standing response was not in the expected shape.',
    )
  })
})

describe('createSeasonLmsRpcGateway — pick', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('refuses to pick before any round has been loaded, without calling the server', async () => {
    await expect(gateway().pick(TEAM_AWAY)).rejects.toThrow('There is no open round to pick in.')
    expect(mocks.rpc).not.toHaveBeenCalled()
  })

  it('refuses to pick once a load found no open window, without calling the server', async () => {
    mocks.rpc.mockResolvedValueOnce({ data: roundPayload({ window: null }), error: null })
    const gw = gateway()
    await gw.load()

    await expect(gw.pick(TEAM_AWAY)).rejects.toThrow('There is no open round to pick in.')
    expect(mocks.rpc).toHaveBeenCalledTimes(1) // only the load
  })

  it('sends the window and version last read alongside the chosen club', async () => {
    mocks.rpc.mockResolvedValueOnce({ data: roundPayload(), error: null })
    const gw = gateway()
    await gw.load()

    mocks.rpc.mockResolvedValueOnce({ data: null, error: null })
    await gw.pick(TEAM_AWAY)

    expect(mocks.rpc).toHaveBeenLastCalledWith('save_lms_selection', {
      p_window_id: WINDOW_ID,
      p_team_id: TEAM_AWAY,
      p_expected_version: 2,
    })
  })

  it('defaults the expected version to 0 when the round carried no prior selection', async () => {
    mocks.rpc.mockResolvedValueOnce({
      data: roundPayload({ window: { ...roundPayload().window, selection: null } }),
      error: null,
    })
    const gw = gateway()
    await gw.load()

    mocks.rpc.mockResolvedValueOnce({ data: null, error: null })
    await gw.pick(TEAM_HOME)

    expect(mocks.rpc).toHaveBeenLastCalledWith('save_lms_selection', {
      p_window_id: WINDOW_ID,
      p_team_id: TEAM_HOME,
      p_expected_version: 0,
    })
  })

  it('propagates a refusal from the pick RPC untouched', async () => {
    mocks.rpc.mockResolvedValueOnce({ data: roundPayload(), error: null })
    const gw = gateway()
    await gw.load()

    mocks.rpc.mockResolvedValueOnce({
      data: null,
      error: { code: '23514', message: 'club already used' },
    })

    await expect(gw.pick(TEAM_USED)).rejects.toEqual({ code: '23514', message: 'club already used' })
  })
})
