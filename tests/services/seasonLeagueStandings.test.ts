import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({ rpc: vi.fn() }))

vi.mock('../../src/services/supabase/client', () => ({
  db: { rpc: mocks.rpc },
}))

import { fetchSeasonLeagueStandingsPage } from '../../src/services/supabase/seasonLeagueStandings'

const LEAGUE_ID = '50000000-0000-0000-0000-000000000901'

function row(overrides: Record<string, unknown> = {}) {
  return {
    userId: '50000000-0000-0000-0000-000000000a01',
    displayName: 'Sam',
    points: 84,
    rank: 1,
    matchweeksPlayed: 22,
    tied: false,
    position: 1,
    isYou: false,
    isOwner: true,
    hasEntry: true,
    joinedAt: '2026-08-01T09:00:00Z',
    ...overrides,
  }
}

function payload(overrides: Record<string, unknown> = {}) {
  return {
    rows: [row()],
    totalCount: 1,
    pageSize: 50,
    hasMore: false,
    nextCursor: null,
    you: null,
    ...overrides,
  }
}

describe('fetchSeasonLeagueStandingsPage', () => {
  beforeEach(() => {
    mocks.rpc.mockReset()
  })

  it('calls contract 128’s season read, never the tournament one', async () => {
    // `get_league_members` derives from the tournament scoring tables and
    // returns every member of a season league on zero. The whole point of this
    // module is that it cannot be the function called here.
    mocks.rpc.mockResolvedValue({ data: payload(), error: null })

    await fetchSeasonLeagueStandingsPage(LEAGUE_ID)

    // `p_after: undefined` rather than `null`, which is a real change to the
    // request: JSON.stringify drops an undefined value, so the key is OMITTED
    // rather than sent as SQL NULL. It is behaviour-identical here and that was
    // verified rather than assumed — `get_season_league_standings` declares
    // `p_after text default null`, so an omitted argument and an explicit null
    // both arrive as NULL. It would NOT be identical for a parameter with a
    // value default; `p_limit integer default 50`, one line above, is exactly
    // that case, which is why it still passes an explicit 50.
    expect(mocks.rpc).toHaveBeenCalledWith('get_season_league_standings', {
      p_league_id: LEAGUE_ID,
      p_limit: 50,
      p_after: undefined,
    })
  })

  it('passes the server’s cursor back exactly as it was issued', async () => {
    // Never reconstructed from the last row: that would put a second paging
    // authority in the browser.
    mocks.rpc.mockResolvedValue({ data: payload(), error: null })

    await fetchSeasonLeagueStandingsPage(LEAGUE_ID, { after: 'deadbeef', limit: 10 })

    expect(mocks.rpc).toHaveBeenCalledWith('get_season_league_standings', {
      p_league_id: LEAGUE_ID,
      p_limit: 10,
      p_after: 'deadbeef',
    })
  })

  it('maps a page through the parser', async () => {
    mocks.rpc.mockResolvedValue({
      data: payload({ rows: [row({ isYou: true, tied: true })], you: row({ tied: true }) }),
      error: null,
    })

    const page = await fetchSeasonLeagueStandingsPage(LEAGUE_ID)

    expect(page.rows).toEqual([
      {
        userId: '50000000-0000-0000-0000-000000000a01',
    displayName: 'Sam',
        points: 84,
        rank: 1,
        matchweeksPlayed: 22,
        tied: true,
        position: 1,
        isYou: true,
        isOwner: true,
        hasEntry: true,
      },
    ])
    expect(page.you?.rank).toBe(1)
  })

  it('propagates a refusal untouched, so the caller can classify it', async () => {
    // The membership refusal has its own sentence upstream; swallowing the code
    // here would leave the surface with nothing to key on.
    mocks.rpc.mockResolvedValue({ data: null, error: { code: 'insufficient_privilege' } })

    await expect(fetchSeasonLeagueStandingsPage(LEAGUE_ID)).rejects.toMatchObject({
      code: 'insufficient_privilege',
    })
  })

  it('rejects a malformed response rather than rendering part of it', async () => {
    mocks.rpc.mockResolvedValue({ data: { rows: 'not an array' }, error: null })

    await expect(fetchSeasonLeagueStandingsPage(LEAGUE_ID)).rejects.toThrow(
      /League standings response was malformed/,
    )
  })
})
