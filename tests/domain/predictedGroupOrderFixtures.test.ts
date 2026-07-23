import { execFileSync } from 'node:child_process'
import { describe, expect, it } from 'vitest'
import fixtures from '../../fixtures/predicted-group-order.json'
import {
  calculateGroupTable,
  type MatchScore,
  type TeamStanding,
} from '../../src/domain/tournament/calculateGroupTable'
import {
  resolveGroupTies,
  type ResolveGroupTiesResult,
} from '../../src/domain/tournament/resolveGroupTies'

type ScoreTuple = [string, string, number, number]
type FixtureExpectation = 'resolved' | 'unresolved' | 'partial'
type Criterion =
  | 'head-to-head-points'
  | 'head-to-head-goal-difference'
  | 'head-to-head-goals-scored'
  | 'overall-goal-difference'
  | 'overall-goals-scored'
  | 'recursive-subset-resolved'
  | 'recursive-subset-unresolved'

type ExpectedStanding = Pick<
  TeamStanding,
  'teamId' | 'points' | 'goalDifference' | 'goalsFor'
>

type CriterionProof = {
  criterion: Criterion
  tiedTeams: string[]
  headToHead: ExpectedStanding[]
  overall: ExpectedStanding[]
  recursiveSubset?: string[]
  recursiveHeadToHead?: ExpectedStanding[]
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
  automaticProof?: CriterionProof
  explanation: string
}

const batch2FixtureNames = new Set([
  'two-team-head-to-head-points',
  'three-team-overall-goals-scored-fallback',
  'three-team-head-to-head-goal-difference',
  'three-team-head-to-head-goals-scored',
  'recursive-subset-resolved',
  'recursive-subset-unresolved',
])

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

function valuesFor(
  standings: TeamStanding[],
  teamIds: string[],
  field: 'points' | 'goalDifference' | 'goalsFor',
): number[] {
  return teamIds.map((teamId) => standingByTeam(standings, teamId)[field])
}

function expectEqual(values: number[]): void {
  expect(new Set(values).size).toBe(1)
}

function expectDifferent(values: number[]): void {
  expect(new Set(values).size).toBeGreaterThan(1)
}

function expectTableMatches(
  standings: TeamStanding[],
  expected: ExpectedStanding[],
): void {
  for (const expectedStanding of expected) {
    expect(standingByTeam(standings, expectedStanding.teamId)).toMatchObject(
      expectedStanding,
    )
  }
}

function proofFor(fixture: Fixture): CriterionProof | undefined {
  return fixture.automaticProof ?? fixture.criterionProof
}

function assertRecursiveProof(
  fixture: Fixture,
  proof: CriterionProof,
  matches: MatchScore[],
  overall: TeamStanding[],
  headToHead: TeamStanding[],
): void {
  const recursiveSubset = proof.recursiveSubset
  const recursiveExpected = proof.recursiveHeadToHead

  expect(recursiveSubset).toBeDefined()
  expect(recursiveExpected).toBeDefined()

  if (!recursiveSubset || !recursiveExpected) {
    throw new Error(`${fixture.name}: missing recursive proof data`)
  }

  expectEqual(valuesFor(headToHead, proof.tiedTeams, 'points'))
  expectEqual(valuesFor(headToHead, proof.tiedTeams, 'goalDifference'))
  expectDifferent(valuesFor(headToHead, proof.tiedTeams, 'goalsFor'))

  expectEqual(valuesFor(headToHead, recursiveSubset, 'points'))
  expectEqual(valuesFor(headToHead, recursiveSubset, 'goalDifference'))
  expectEqual(valuesFor(headToHead, recursiveSubset, 'goalsFor'))

  const outsideSubset = proof.tiedTeams.filter(
    (teamId) => !recursiveSubset.includes(teamId),
  )
  expect(outsideSubset).toHaveLength(1)

  const subsetGoalsFor = standingByTeam(
    headToHead,
    recursiveSubset[0],
  ).goalsFor
  const outsideGoalsFor = standingByTeam(
    headToHead,
    outsideSubset[0],
  ).goalsFor

  if (proof.criterion === 'recursive-subset-resolved') {
    expect(outsideGoalsFor).toBeGreaterThan(subsetGoalsFor)
  } else {
    expect(outsideGoalsFor).toBeLessThan(subsetGoalsFor)
  }

  const recursiveHeadToHead = calculateGroupTable(recursiveSubset, matches)
  expectTableMatches(recursiveHeadToHead, recursiveExpected)

  if (proof.criterion === 'recursive-subset-resolved') {
    expectDifferent(valuesFor(recursiveHeadToHead, recursiveSubset, 'points'))
    expect(
      standingByTeam(recursiveHeadToHead, recursiveSubset[0]).points,
    ).toBeGreaterThan(
      standingByTeam(recursiveHeadToHead, recursiveSubset[1]).points,
    )
    return
  }

  expectEqual(valuesFor(recursiveHeadToHead, recursiveSubset, 'points'))
  expectEqual(
    valuesFor(recursiveHeadToHead, recursiveSubset, 'goalDifference'),
  )
  expectEqual(valuesFor(recursiveHeadToHead, recursiveSubset, 'goalsFor'))
  expectEqual(valuesFor(overall, recursiveSubset, 'points'))
  expectEqual(valuesFor(overall, recursiveSubset, 'goalDifference'))
  expectEqual(valuesFor(overall, recursiveSubset, 'goalsFor'))
}

function assertCriterionProof(
  fixture: Fixture,
  matches: MatchScore[],
): void {
  const proof = proofFor(fixture)
  if (!proof) return

  const overall = calculateGroupTable(fixture.teams, matches)
  const headToHead = calculateGroupTable(proof.tiedTeams, matches)

  expectTableMatches(overall, proof.overall)
  expectTableMatches(headToHead, proof.headToHead)
  expectEqual(valuesFor(overall, proof.tiedTeams, 'points'))

  switch (proof.criterion) {
    case 'head-to-head-points':
      expectDifferent(valuesFor(headToHead, proof.tiedTeams, 'points'))
      break

    case 'head-to-head-goal-difference':
      expectEqual(valuesFor(headToHead, proof.tiedTeams, 'points'))
      expectDifferent(
        valuesFor(headToHead, proof.tiedTeams, 'goalDifference'),
      )
      break

    case 'head-to-head-goals-scored':
      expectEqual(valuesFor(headToHead, proof.tiedTeams, 'points'))
      expectEqual(
        valuesFor(headToHead, proof.tiedTeams, 'goalDifference'),
      )
      expectDifferent(valuesFor(headToHead, proof.tiedTeams, 'goalsFor'))
      break

    case 'overall-goal-difference':
      expectEqual(valuesFor(headToHead, proof.tiedTeams, 'points'))
      expectEqual(
        valuesFor(headToHead, proof.tiedTeams, 'goalDifference'),
      )
      expectEqual(valuesFor(headToHead, proof.tiedTeams, 'goalsFor'))
      expectDifferent(valuesFor(overall, proof.tiedTeams, 'goalDifference'))
      break

    case 'overall-goals-scored':
      expectEqual(valuesFor(headToHead, proof.tiedTeams, 'points'))
      expectEqual(
        valuesFor(headToHead, proof.tiedTeams, 'goalDifference'),
      )
      expectEqual(valuesFor(headToHead, proof.tiedTeams, 'goalsFor'))
      expectEqual(valuesFor(overall, proof.tiedTeams, 'goalDifference'))
      expectDifferent(valuesFor(overall, proof.tiedTeams, 'goalsFor'))
      break

    case 'recursive-subset-resolved':
    case 'recursive-subset-unresolved':
      assertRecursiveProof(fixture, proof, matches, overall, headToHead)
      break
  }
}

function canonicalBlocks(blocks: string[][]): string[][] {
  return blocks
    .map((block) => [...block].sort())
    .sort((first, second) => first.join('|').localeCompare(second.join('|')))
}

function unresolvedTeamIds(blocks: string[][]): Set<string> {
  return new Set(blocks.flat())
}

function expectedRankByTeam(fixture: Fixture): Map<string, number> {
  if (!fixture.order || !fixture.ranks) return new Map()

  return new Map(
    fixture.order.map((teamId, index) => [teamId, fixture.ranks?.[index] ?? 0]),
  )
}

function expectTeamSpecificUnresolvedState(
  result: ResolveGroupTiesResult,
  fixture: Fixture,
): void {
  const expectedBlocks = canonicalBlocks(fixture.unresolved ?? [])
  expect(canonicalBlocks(result.unresolvedGroups)).toEqual(expectedBlocks)

  const expectedUnresolvedTeams = unresolvedTeamIds(expectedBlocks)
  for (const standing of result.standings) {
    expect(standing.tiedUnresolved).toBe(
      expectedUnresolvedTeams.has(standing.teamId),
    )
  }

  const ranks = expectedRankByTeam(fixture)
  for (const [teamId, rank] of ranks) {
    expect(
      result.standings.find((standing) => standing.teamId === teamId)?.rank,
    ).toBe(rank)
  }

  if (fixture.order) {
    const expectedResolvedOrder = fixture.order.filter(
      (teamId) => !expectedUnresolvedTeams.has(teamId),
    )
    const actualResolvedOrder = result.standings
      .filter((standing) => !expectedUnresolvedTeams.has(standing.teamId))
      .map((standing) => standing.teamId)

    expect(actualResolvedOrder).toEqual(expectedResolvedOrder)
  }
}

function expectResolvedContract(
  result: ResolveGroupTiesResult,
  fixture: Fixture,
): void {
  expect(result.unresolvedGroups).toEqual([])
  expect(result.standings.map((standing) => standing.teamId)).toEqual(
    fixture.order,
  )
  expect(result.standings.map((standing) => standing.rank)).toEqual([
    1, 2, 3, 4,
  ])
  expect(
    result.standings.every((standing) => !standing.tiedUnresolved),
  ).toBe(true)
}

function expectPartialContract(
  result: ResolveGroupTiesResult,
  fixture: Fixture,
): void {
  expect(
    result.standings.some((standing) => standing.played < 3),
  ).toBe(true)
  expect(result.standings.map((standing) => standing.teamId)).toEqual(
    fixture.order,
  )
  expect(result.standings.map((standing) => standing.rank)).toEqual(
    fixture.ranks,
  )
  expectTeamSpecificUnresolvedState(result, fixture)
}

function expectUnresolvedContract(
  result: ResolveGroupTiesResult,
  fixture: Fixture,
): void {
  expectTeamSpecificUnresolvedState(result, fixture)

  if (!fixture.ranks) {
    expect(result.standings.every((standing) => standing.rank === 1)).toBe(
      true,
    )
  }
}

function variants<T>(items: T[]): T[][] {
  return [
    items,
    [...items].reverse(),
    [...items.slice(1), items[0]],
  ]
}

function resultStateByTeam(
  result: ResolveGroupTiesResult,
): Map<string, { rank: number; tiedUnresolved: boolean }> {
  return new Map(
    result.standings.map((standing) => [
      standing.teamId,
      {
        rank: standing.rank,
        tiedUnresolved: standing.tiedUnresolved,
      },
    ]),
  )
}

function expectEquivalentUnresolvedResult(
  actual: ResolveGroupTiesResult,
  expected: ResolveGroupTiesResult,
): void {
  expect(canonicalBlocks(actual.unresolvedGroups)).toEqual(
    canonicalBlocks(expected.unresolvedGroups),
  )

  const expectedState = resultStateByTeam(expected)
  for (const standing of actual.standings) {
    expect({
      rank: standing.rank,
      tiedUnresolved: standing.tiedUnresolved,
    }).toEqual(expectedState.get(standing.teamId))
  }

  const unresolvedTeams = unresolvedTeamIds(expected.unresolvedGroups)
  expect(
    actual.standings
      .filter((standing) => !unresolvedTeams.has(standing.teamId))
      .map((standing) => standing.teamId),
  ).toEqual(
    expected.standings
      .filter((standing) => !unresolvedTeams.has(standing.teamId))
      .map((standing) => standing.teamId),
  )
}

describe('predicted group-order fixture structure', () => {
  it('passes the structural fixture validator', () => {
    expect(() =>
      execFileSync(process.execPath, ['scripts/check-fixtures.mjs'], {
        cwd: process.cwd(),
        stdio: 'pipe',
      }),
    ).not.toThrow()
  })
})

for (const fixture of fixtures as Fixture[]) {
  describe(`fixture: ${fixture.name}`, () => {
    it('matches the production resolver contract', () => {
      const matches = toMatchScores(fixture.matches)
      const result = resolveGroupTies(fixture.teams, matches)

      assertCriterionProof(fixture, matches)

      if (fixture.expectation === 'resolved') {
        expectResolvedContract(result, fixture)
        return
      }

      if (fixture.expectation === 'partial') {
        expectPartialContract(result, fixture)
        return
      }

      expectUnresolvedContract(result, fixture)
    })
  })
}

describe('Batch 2 input-order independence', () => {
  for (const fixture of fixtures as Fixture[]) {
    if (!batch2FixtureNames.has(fixture.name)) continue

    it(fixture.name, () => {
      const canonicalMatches = toMatchScores(fixture.matches)
      const expected = resolveGroupTies(fixture.teams, canonicalMatches)

      for (const teamOrder of variants(fixture.teams)) {
        for (const matchOrder of variants(canonicalMatches)) {
          const actual = resolveGroupTies(teamOrder, matchOrder)

          if (fixture.expectation === 'resolved') {
            expect(actual.standings.map((standing) => standing.teamId)).toEqual(
              fixture.order,
            )
            expect(actual.unresolvedGroups).toEqual([])
            expect(
              actual.standings.every(
                (standing) => !standing.tiedUnresolved,
              ),
            ).toBe(true)
          } else {
            expectEquivalentUnresolvedResult(actual, expected)
          }
        }
      }
    })
  }

  it('keeps all-draws unresolved without an input-order fallback', () => {
    const fixture = (fixtures as Fixture[]).find(
      (candidate) => candidate.name === 'all-draws-unresolved',
    )
    if (!fixture) throw new Error('Missing all-draws-unresolved fixture')

    const matches = toMatchScores(fixture.matches)
    for (const teamOrder of variants(fixture.teams)) {
      for (const matchOrder of variants(matches)) {
        const result = resolveGroupTies(teamOrder, matchOrder)

        expect(canonicalBlocks(result.unresolvedGroups)).toEqual([
          ['a', 'b', 'c', 'd'],
        ])
        expect(
          result.standings.every(
            (standing) =>
              standing.rank === 1 && standing.tiedUnresolved,
          ),
        ).toBe(true)
      }
    }
  })
})
