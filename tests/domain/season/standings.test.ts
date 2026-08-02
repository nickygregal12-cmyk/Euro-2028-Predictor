import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import {
  computeSeasonStandings,
  matchweekWinners,
  rollingFormPoints,
  type SeasonEntryTotals,
} from '../../../src/domain/season/standings'

function entry(entryId: string, points: readonly number[]): SeasonEntryTotals {
  return {
    entryId,
    matchweeks: points.map((value, index) => ({ matchweek: index + 1, points: value })),
  }
}

describe('cumulative season standings (ADR 0012)', () => {
  it('ranks by cumulative points alone and shows matchweeks played', () => {
    const rows = computeSeasonStandings([
      entry('amara', [10, 12, 8]), // 30 from 3
      entry('bea', [20, 14]), // 34 from 2
      entry('chidi', [5, 5, 5]), // 15 from 3
    ])
    expect(rows).toEqual([
      { entryId: 'bea', rank: 1, points: 34, matchweeksPlayed: 2 },
      { entryId: 'amara', rank: 2, points: 30, matchweeksPlayed: 3 },
      { entryId: 'chidi', rank: 3, points: 15, matchweeksPlayed: 3 },
    ])
  })

  it('shares ranks on equal points and skips the next rank', () => {
    const rows = computeSeasonStandings([
      entry('amara', [30]),
      entry('bea', [30]),
      entry('chidi', [10]),
    ])
    expect(rows?.map((row) => [row.entryId, row.rank])).toEqual([
      ['amara', 1],
      ['bea', 1],
      ['chidi', 3],
    ])
  })

  it('never blends matchweeks played into the ranking', () => {
    // 84 points from 21 matchweeks and 84 from 28 share a rank; matchweeks
    // played is display-only context, like games in hand in a league table.
    const tied = computeSeasonStandings([
      entry('amara', Array.from({ length: 21 }, () => 4)), // 84 from 21
      entry('bea', Array.from({ length: 28 }, () => 3)), // 84 from 28
    ])
    expect(tied?.map((row) => [row.rank, row.matchweeksPlayed])).toEqual([
      [1, 21],
      [1, 28],
    ])
  })

  it('fails closed on malformed totals', () => {
    expect(computeSeasonStandings([entry('amara', [10]), entry('amara', [5])])).toBeNull()
    expect(
      computeSeasonStandings([
        { entryId: 'bea', matchweeks: [{ matchweek: 1, points: -3 }] },
      ]),
    ).toBeNull()
    expect(
      computeSeasonStandings([
        {
          entryId: 'bea',
          matchweeks: [
            { matchweek: 2, points: 3 },
            { matchweek: 2, points: 5 },
          ],
        },
      ]),
    ).toBeNull()
    expect(computeSeasonStandings([{ entryId: '  ', matchweeks: [] }])).toBeNull()
  })
})

describe('matchweek winners', () => {
  const entries = [
    entry('amara', [10, 22]),
    entry('bea', [15, 22]),
    entry('chidi', [15]),
  ]

  it('names every entry on the top score — a tie is several winners', () => {
    expect(matchweekWinners(entries, 1)).toEqual({
      matchweek: 1,
      points: 15,
      entryIds: ['bea', 'chidi'],
    })
    expect(matchweekWinners(entries, 2)).toEqual({
      matchweek: 2,
      points: 22,
      entryIds: ['amara', 'bea'],
    })
  })

  it('treats an unplayed matchweek as absent, not as zero', () => {
    // chidi has no matchweek 2 total and cannot win or lose it.
    expect(matchweekWinners(entries, 2)?.entryIds).not.toContain('chidi')
  })

  it('returns null when nobody settled the matchweek or input is malformed', () => {
    expect(matchweekWinners(entries, 9)).toBeNull()
    expect(matchweekWinners(entries, 0)).toBeNull()
    expect(matchweekWinners([entry('amara', [1]), entry('amara', [2])], 1)).toBeNull()
  })
})

describe('rolling form', () => {
  it('sums the most recent settled matchweeks by matchweek number', () => {
    expect(rollingFormPoints(entry('amara', [10, 20, 30, 40, 50]), 3)).toBe(120)
    expect(rollingFormPoints(entry('amara', [10, 20]), 6)).toBe(30)
  })

  it('fails closed on malformed input', () => {
    expect(rollingFormPoints(entry('amara', [10]), 0)).toBeNull()
    expect(
      rollingFormPoints({ entryId: 'amara', matchweeks: [{ matchweek: 1, points: 0.5 }] }, 3),
    ).toBeNull()
  })
})

describe('authority separation', () => {
  const source = readFileSync(resolve(process.cwd(), 'src/domain/season/standings.ts'), 'utf8')

  it('imports nothing from the tournament implementation', () => {
    expect(source).not.toMatch(/from '.*tournament/)
  })

  it('reads no ambient clock or zone', () => {
    expect(source).not.toMatch(/Date\.now|new Date\(|Intl\./)
  })
})
