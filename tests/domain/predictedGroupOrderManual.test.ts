import { describe, expect, it } from 'vitest'
import type { MatchScore } from '../../src/domain/tournament/calculateGroupTable'
import {
  resolveGroupTies,
  type ResolveGroupTiesResult,
} from '../../src/domain/tournament/resolveGroupTies'
import type { TieResolution } from '../../src/domain/tournament/tieResolutions'

const TEAMS = ['a', 'b', 'c', 'd']

const ALL_DRAWS: MatchScore[] = [
  { homeTeamId: 'a', awayTeamId: 'b', homeScore: 1, awayScore: 1 },
  { homeTeamId: 'a', awayTeamId: 'c', homeScore: 1, awayScore: 1 },
  { homeTeamId: 'a', awayTeamId: 'd', homeScore: 1, awayScore: 1 },
  { homeTeamId: 'b', awayTeamId: 'c', homeScore: 1, awayScore: 1 },
  { homeTeamId: 'b', awayTeamId: 'd', homeScore: 1, awayScore: 1 },
  { homeTeamId: 'c', awayTeamId: 'd', homeScore: 1, awayScore: 1 },
]

const TWO_UNRESOLVED_BLOCKS: MatchScore[] = [
  { homeTeamId: 'a', awayTeamId: 'b', homeScore: 1, awayScore: 0 },
  { homeTeamId: 'a', awayTeamId: 'c', homeScore: 1, awayScore: 0 },
  { homeTeamId: 'a', awayTeamId: 'd', homeScore: 0, awayScore: 0 },
  { homeTeamId: 'b', awayTeamId: 'c', homeScore: 0, awayScore: 0 },
  { homeTeamId: 'b', awayTeamId: 'd', homeScore: 0, awayScore: 1 },
  { homeTeamId: 'c', awayTeamId: 'd', homeScore: 0, awayScore: 1 },
]

const RECURSIVE_UNRESOLVED: MatchScore[] = [
  { homeTeamId: 'a', awayTeamId: 'b', homeScore: 1, awayScore: 1 },
  { homeTeamId: 'a', awayTeamId: 'c', homeScore: 0, awayScore: 0 },
  { homeTeamId: 'b', awayTeamId: 'c', homeScore: 0, awayScore: 0 },
  { homeTeamId: 'a', awayTeamId: 'd', homeScore: 1, awayScore: 0 },
  { homeTeamId: 'b', awayTeamId: 'd', homeScore: 1, awayScore: 0 },
  { homeTeamId: 'c', awayTeamId: 'd', homeScore: 1, awayScore: 0 },
]

function teamOrder(result: ResolveGroupTiesResult): string[] {
  return result.standings.map((standing) => standing.teamId)
}

function standing(result: ResolveGroupTiesResult, teamId: string) {
  const value = result.standings.find((candidate) => candidate.teamId === teamId)
  if (!value) throw new Error(`Missing standing for ${teamId}`)
  return value
}

function canonicalBlocks(blocks: string[][]): string[][] {
  return blocks
    .map((block) => [...block].sort())
    .sort((a, b) => a.join('|').localeCompare(b.join('|')))
}

function expectFullyResolved(result: ResolveGroupTiesResult, order: string[]): void {
  expect(teamOrder(result)).toEqual(order)
  expect(result.unresolvedGroups).toEqual([])
  expect(result.standings.map((value) => value.rank)).toEqual([1, 2, 3, 4])
  expect(result.standings.every((value) => !value.tiedUnresolved)).toBe(true)
}

describe('Batch 3 manual group-order contract', () => {
  it('keeps a full tie unresolved until the user explicitly confirms an order', () => {
    const unresolved = resolveGroupTies(TEAMS, ALL_DRAWS)

    expect(canonicalBlocks(unresolved.unresolvedGroups)).toEqual([TEAMS])
    expect(unresolved.standings.every((value) => value.rank === 1)).toBe(true)
    expect(unresolved.standings.every((value) => value.tiedUnresolved)).toBe(true)
  })

  it('treats Keep this order as an explicit manual prediction', () => {
    const resolution: TieResolution = {
      teamIds: ['a', 'b', 'c', 'd'],
      order: ['a', 'b', 'c', 'd'],
    }

    expectFullyResolved(resolveGroupTies(TEAMS, ALL_DRAWS, [resolution]), TEAMS)
  })

  it('applies a rearranged order and looks it up by the tied set, not key order', () => {
    const resolution: TieResolution = {
      teamIds: ['d', 'b', 'a', 'c'],
      order: ['d', 'c', 'b', 'a'],
    }

    expectFullyResolved(
      resolveGroupTies(['c', 'a', 'd', 'b'], [...ALL_DRAWS].reverse(), [resolution]),
      ['d', 'c', 'b', 'a'],
    )
  })

  it.each([
    ['duplicate team', ['a', 'a', 'c', 'd']],
    ['missing team', ['a', 'b', 'c']],
    ['extra team', ['a', 'b', 'c', 'd', 'x']],
    ['foreign team', ['a', 'b', 'c', 'x']],
    ['empty order', []],
  ])('rejects a hostile stored order with a %s', (_label, order) => {
    const resolution: TieResolution = {
      teamIds: ['a', 'b', 'c', 'd'],
      order,
    }
    const result = resolveGroupTies(TEAMS, ALL_DRAWS, [resolution])

    expect(canonicalBlocks(result.unresolvedGroups)).toEqual([TEAMS])
    expect(result.standings.every((value) => value.tiedUnresolved)).toBe(true)
  })

  it('does not let a malformed duplicate row mask a later valid row', () => {
    const resolutions: TieResolution[] = [
      { teamIds: TEAMS, order: ['a', 'a', 'c', 'd'] },
      { teamIds: [...TEAMS].reverse(), order: ['b', 'a', 'd', 'c'] },
    ]

    expectFullyResolved(
      resolveGroupTies(TEAMS, ALL_DRAWS, resolutions),
      ['b', 'a', 'd', 'c'],
    )
  })

  it('ignores a resolution for a different tied set', () => {
    const result = resolveGroupTies(TEAMS, ALL_DRAWS, [
      { teamIds: ['a', 'b'], order: ['b', 'a'] },
    ])

    expect(canonicalBlocks(result.unresolvedGroups)).toEqual([TEAMS])
  })

  it('automatically invalidates an old decision when changed scores alter the tied set', () => {
    const changedScores = ALL_DRAWS.map((match) =>
      match.homeTeamId === 'a' && match.awayTeamId === 'b'
        ? { ...match, homeScore: 2, awayScore: 1 }
        : match,
    )
    const oldResolution: TieResolution = {
      teamIds: TEAMS,
      order: ['d', 'c', 'b', 'a'],
    }

    const result = resolveGroupTies(TEAMS, changedScores, [oldResolution])

    expect(teamOrder(result)).toEqual(['a', 'c', 'd', 'b'])
    expect(canonicalBlocks(result.unresolvedGroups)).toEqual([['c', 'd']])
    expect(standing(result, 'a')).toMatchObject({ rank: 1, tiedUnresolved: false })
    expect(standing(result, 'c')).toMatchObject({ rank: 2, tiedUnresolved: true })
    expect(standing(result, 'd')).toMatchObject({ rank: 2, tiedUnresolved: true })
    expect(standing(result, 'b')).toMatchObject({ rank: 4, tiedUnresolved: false })
  })

  it('resolves multiple tied blocks independently', () => {
    const topOnly = resolveGroupTies(TEAMS, TWO_UNRESOLVED_BLOCKS, [
      { teamIds: ['a', 'd'], order: ['d', 'a'] },
    ])

    expect(teamOrder(topOnly)).toEqual(['d', 'a', 'b', 'c'])
    expect(canonicalBlocks(topOnly.unresolvedGroups)).toEqual([['b', 'c']])
    expect(standing(topOnly, 'd')).toMatchObject({ rank: 1, tiedUnresolved: false })
    expect(standing(topOnly, 'a')).toMatchObject({ rank: 2, tiedUnresolved: false })
    expect(standing(topOnly, 'b')).toMatchObject({ rank: 3, tiedUnresolved: true })
    expect(standing(topOnly, 'c')).toMatchObject({ rank: 3, tiedUnresolved: true })

    const both = resolveGroupTies(TEAMS, TWO_UNRESOLVED_BLOCKS, [
      { teamIds: ['a', 'd'], order: ['d', 'a'] },
      { teamIds: ['b', 'c'], order: ['c', 'b'] },
    ])
    expectFullyResolved(both, ['d', 'a', 'c', 'b'])
  })

  it('applies a decision to the exact recursive unresolved subset only', () => {
    const result = resolveGroupTies(TEAMS, RECURSIVE_UNRESOLVED, [
      { teamIds: ['a', 'b'], order: ['b', 'a'] },
      { teamIds: ['a', 'b', 'c'], order: ['c', 'b', 'a'] },
    ])

    expectFullyResolved(result, ['b', 'a', 'c', 'd'])
  })

  it('never treats team input order as a saved user decision', () => {
    const result = resolveGroupTies([...TEAMS].reverse(), [...ALL_DRAWS].reverse())

    expect(canonicalBlocks(result.unresolvedGroups)).toEqual([TEAMS])
    expect(result.standings.every((value) => value.rank === 1)).toBe(true)
    expect(result.standings.every((value) => value.tiedUnresolved)).toBe(true)
  })
})
