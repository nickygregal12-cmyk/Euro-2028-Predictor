import { describe, expect, it } from 'vitest'
import fixtures from '../../fixtures/predicted-group-order.json'
import {
  calculateGroupTable,
  type MatchScore,
  type TeamStanding,
} from '../../src/domain/tournament/calculateGroupTable'
import { resolveGroupTies } from '../../src/domain/tournament/resolveGroupTies'

type ScoreTuple = [string, string, number, number]
type FixtureExpectation = 'resolved' | 'unresolved' | 'partial'
type Criterion = 'overall-goal-difference' | 'overall-goals-scored'

type ExpectedStanding = Pick<
  TeamStanding,
  'teamId' | 'points' | 'goalDifference' | 'goalsFor'
>

type CriterionProof = {
  criterion: Criterion
  tiedTeams: [string, string]
  headToHead: [ExpectedStanding, ExpectedStanding]
  overall: [ExpectedStanding, ExpectedStanding]
}

type Fixture = {
  name: string
  teams: string[]
  matches: ScoreTuple[]
  expectation: FixtureExpectation
  order?: string[]
  unresolved?: string[][]
  ranks?: number[]
  criterionProof?: CriterionProof
  explanation: string
}

function toMatchScores(matches: ScoreTuple[]): MatchScore[] {
  return matches.map(([homeTeamId, awayTeamId, homeScore, awayScore]) => ({
    homeTeamId,
    awayTeamId,
    homeScore,
    awayScore,
  }))
}

function standingByTeam(
  standings: TeamStanding[],
  teamId: string,
): TeamStanding {
  const standing = standings.find((candidate) => candidate.teamId === teamId)
  if (!standing) throw new Error(`Missing standing for ${teamId}`)
  return standing
}

function expectStanding(
  standings: TeamStanding[],
  expected: ExpectedStanding,
): void {
  expect(standingByTeam(standings, expected.teamId)).toMatchObject(expected)
}

function assertCriterionProof(
  fixture: Fixture,
  matches: MatchScore[],
): void {
  const proof = fixture.criterionProof
  if (!proof) return

  const headToHead = calculateGroupTable(proof.tiedTeams, matches)
  const overall = calculateGroupTable(fixture.teams, matches)

  for (const expected of proof.headToHead) {
    expectStanding(headToHead, expected)
  }
  for (const expected of proof.overall) {
    expectStanding(overall, expected)
  }

  const [firstHeadToHead, secondHeadToHead] = proof.headToHead
  expect(firstHeadToHead.points).toBe(secondHeadToHead.points)
  expect(firstHeadToHead.goalDifference).toBe(secondHeadToHead.goalDifference)
  expect(firstHeadToHead.goalsFor).toBe(secondHeadToHead.goalsFor)

  const [firstOverall, secondOverall] = proof.overall
  expect(firstOverall.points).toBe(secondOverall.points)

  if (proof.criterion === 'overall-goal-difference') {
    expect(firstOverall.goalDifference).toBeGreaterThan(
      secondOverall.goalDifference,
    )
  } else {
    expect(firstOverall.goalDifference).toBe(secondOverall.goalDifference)
    expect(firstOverall.goalsFor).toBeGreaterThan(secondOverall.goalsFor)
  }
}

for (const fixture of fixtures as Fixture[]) {
  describe(`fixture: ${fixture.name}`, () => {
    it('matches the production resolver contract', () => {
      const matches = toMatchScores(fixture.matches)
      const result = resolveGroupTies(fixture.teams, matches)

      assertCriterionProof(fixture, matches)

      if (fixture.expectation === 'resolved') {
        expect(result.unresolvedGroups).toEqual([])
        expect(result.standings.map((standing) => standing.teamId)).toEqual(
          fixture.order,
        )
        return
      }

      if (fixture.expectation === 'partial') {
        expect(result.standings.some((standing) => standing.played < 3)).toBe(
          true,
        )
        expect(result.standings.map((standing) => standing.teamId)).toEqual(
          fixture.order,
        )
        expect(result.standings.map((standing) => standing.rank)).toEqual(
          fixture.ranks,
        )
        expect(result.unresolvedGroups).toEqual(fixture.unresolved)
        return
      }

      expect(result.unresolvedGroups).toEqual(fixture.unresolved)
      expect(result.standings.every((standing) => standing.rank === 1)).toBe(
        true,
      )
      expect(
        result.standings.every((standing) => standing.tiedUnresolved),
      ).toBe(true)
    })
  })
}
