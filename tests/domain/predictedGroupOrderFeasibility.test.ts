import { describe, expect, it } from 'vitest'
import {
  calculateGroupTable,
  type MatchScore,
} from '../../src/domain/tournament/calculateGroupTable'

const teams = ['a', 'b', 'c', 'd']
const pairings: Array<[string, string]> = [
  ['a', 'b'],
  ['a', 'c'],
  ['a', 'd'],
  ['b', 'c'],
  ['b', 'd'],
  ['c', 'd'],
]
const outcomeScores: Array<[number, number]> = [
  [1, 0],
  [0, 0],
  [0, 1],
]

function generateCompleteGroups(): MatchScore[][] {
  let groups: MatchScore[][] = [[]]

  for (const [homeTeamId, awayTeamId] of pairings) {
    const nextGroups: MatchScore[][] = []

    for (const matches of groups) {
      for (const [homeScore, awayScore] of outcomeScores) {
        nextGroups.push([
          ...matches,
          {
            homeTeamId,
            awayTeamId,
            homeScore,
            awayScore,
          },
        ])
      }
    }

    groups = nextGroups
  }

  return groups
}

function pointPatternsForExactThreeTeamTies(
  groups: MatchScore[][],
): {
  caseCount: number
  patterns: string[]
} {
  let caseCount = 0
  const patterns = new Set<string>()

  for (const matches of groups) {
    const fullTable = calculateGroupTable(teams, matches)
    const pointTotals = new Set(fullTable.map((standing) => standing.points))

    for (const points of pointTotals) {
      const tiedTeams = fullTable
        .filter((standing) => standing.points === points)
        .map((standing) => standing.teamId)

      if (tiedTeams.length !== 3) continue

      caseCount += 1
      const miniTable = calculateGroupTable(tiedTeams, matches)
      const miniTablePoints = miniTable.map((standing) => standing.points)
      const sortedPattern = [...miniTablePoints]
        .sort((first, second) => first - second)
        .join(',')

      patterns.add(sortedPattern)
      expect(new Set(miniTablePoints).size).toBe(1)
    }
  }

  return {
    caseCount,
    patterns: [...patterns].sort(),
  }
}

describe('three-team head-to-head-points feasibility', () => {
  it('checks every complete four-team outcome combination', () => {
    const groups = generateCompleteGroups()
    expect(groups).toHaveLength(729)

    const result = pointPatternsForExactThreeTeamTies(groups)

    expect(result.caseCount).toBeGreaterThan(0)
    expect(result.patterns).toEqual(['2,2,2', '3,3,3'])
  })
})
