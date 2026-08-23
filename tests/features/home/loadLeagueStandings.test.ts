import { describe, expect, it, vi } from 'vitest'
import { loadLeagueStandingsConcurrently } from '../../../src/features/home/loadLeagueStandings'

const leagues = [
  {
    id: 'league-a',
    name: 'Alpha',
    memberCount: 12,
    lastActivityAt: '2026-08-20T12:00:00.000Z',
  },
  {
    id: 'league-b',
    name: 'Beta',
    memberCount: 18,
    lastActivityAt: '2026-08-20T13:00:00.000Z',
  },
] as const

function page(totalPoints: number, rank: number) {
  return {
    rows: [{ totalPoints }],
    you: { totalPoints: totalPoints - 2, rank },
  }
}

describe('Home league summary loading', () => {
  it('starts every bounded league read before waiting for the first one', async () => {
    let resolveA!: (value: ReturnType<typeof page>) => void
    let resolveB!: (value: ReturnType<typeof page>) => void
    const fetchPage = vi.fn((leagueId: string) =>
      new Promise<ReturnType<typeof page>>((resolve) => {
        if (leagueId === 'league-a') resolveA = resolve
        else resolveB = resolve
      }),
    )

    const pending = loadLeagueStandingsConcurrently(leagues, fetchPage)
    await Promise.resolve()

    expect(fetchPage).toHaveBeenCalledTimes(2)
    expect(fetchPage).toHaveBeenNthCalledWith(1, 'league-a')
    expect(fetchPage).toHaveBeenNthCalledWith(2, 'league-b')

    // Resolve out of order: output remains in the league-list order because
    // Promise.allSettled preserves input order, while latency is concurrent.
    resolveB(page(20, 2))
    resolveA(page(15, 1))

    const result = await pending
    expect(result.memberReadFailed).toBe(false)
    expect(result.standings.map((standing) => standing.id)).toEqual([
      'league-a',
      'league-b',
    ])
  })

  it('preserves successful summaries when one league read fails', async () => {
    const fetchPage = vi.fn(async (leagueId: string) => {
      if (leagueId === 'league-a') throw new Error('league unavailable')
      return page(20, 2)
    })

    const result = await loadLeagueStandingsConcurrently(leagues, fetchPage)

    expect(result.memberReadFailed).toBe(true)
    expect(result.standings).toHaveLength(1)
    expect(result.standings[0]?.id).toBe('league-b')
    expect(result.standings[0]?.gapToTop).toBe(2)
  })
})
