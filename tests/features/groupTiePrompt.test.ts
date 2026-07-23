import { describe, expect, it } from 'vitest'
import type { Prediction } from '../../src/app/providers/PredictionsProvider'
import type { TieResolution } from '../../src/domain/tournament/tieResolutions'
import { buildGroupTableRows } from '../../src/features/predict/groupTable'
import { buildGroupTiePrompt } from '../../src/features/predict/groupTiePrompt'
import type { Match, Team } from '../../src/services/supabase/tournamentData'

const teams: Team[] = [
  { id: 'a', name: 'Team A', groupId: 'group-a', slot: 1 },
  { id: 'b', name: 'Team B', groupId: 'group-a', slot: 2 },
  { id: 'c', name: 'Team C', groupId: 'group-a', slot: 3 },
  { id: 'd', name: 'Team D', groupId: 'group-a', slot: 4 },
]

const pairings = [
  ['a', 'b'],
  ['a', 'c'],
  ['a', 'd'],
  ['b', 'c'],
  ['b', 'd'],
  ['c', 'd'],
] as const

const matches: Match[] = pairings.map(([homeTeamId, awayTeamId], index) => ({
  id: `m${index + 1}`,
  matchRef: `G-A-${index + 1}`,
  round: 'group',
  groupId: 'group-a',
  matchday: Math.floor(index / 2) + 1,
  homeSource: homeTeamId,
  awaySource: awayTeamId,
  homeTeamId,
  awayTeamId,
  matchDate: '2028-06-01',
  kickoffAt: null,
  venue: 'Test venue',
  homeScore: null,
  awayScore: null,
}))

function allDrawPredictions(): Record<string, Prediction> {
  return Object.fromEntries(
    matches.map((match) => [
      match.id,
      { homeScore: 1, awayScore: 1, joker: false },
    ]),
  )
}

function getter(predictions: Record<string, Prediction>) {
  return (matchId: string): Prediction =>
    predictions[matchId] ?? { homeScore: null, awayScore: null, joker: false }
}

describe('groupTiePrompt', () => {
  it('waits until every match in the group has a complete score', () => {
    const predictions = allDrawPredictions()
    predictions.m6 = { homeScore: 1, awayScore: null, joker: false }

    expect(
      buildGroupTiePrompt('A', teams, matches, getter(predictions), []),
    ).toEqual({ complete: false, ties: [], pendingCount: 0 })
  })

  it('surfaces a same-group tie before the user continues', () => {
    const result = buildGroupTiePrompt(
      'A',
      teams,
      matches,
      getter(allDrawPredictions()),
      [],
    )

    expect(result.complete).toBe(true)
    expect(result.pendingCount).toBe(1)
    expect(result.ties).toHaveLength(1)
    expect(result.ties[0]).toMatchObject({
      title: 'Group A needs your decision',
      resolved: false,
    })
    expect(result.ties[0].teams.map((team) => team.id)).toEqual([
      'a',
      'b',
      'c',
      'd',
    ])
  })

  it('records Keep this order as an explicit resolved decision', () => {
    const resolution: TieResolution = {
      teamIds: ['d', 'c', 'b', 'a'],
      order: ['a', 'b', 'c', 'd'],
    }
    const result = buildGroupTiePrompt(
      'A',
      teams,
      matches,
      getter(allDrawPredictions()),
      [resolution],
    )

    expect(result.pendingCount).toBe(0)
    expect(result.ties[0].resolved).toBe(true)
    expect(result.ties[0].teams.map((team) => team.id)).toEqual([
      'a',
      'b',
      'c',
      'd',
    ])
  })

  it('ignores an old decision when changed scores create a different tied set', () => {
    const predictions = allDrawPredictions()
    predictions.m1 = { homeScore: 2, awayScore: 1, joker: false }
    const oldResolution: TieResolution = {
      teamIds: ['a', 'b', 'c', 'd'],
      order: ['d', 'c', 'b', 'a'],
    }

    const result = buildGroupTiePrompt(
      'A',
      teams,
      matches,
      getter(predictions),
      [oldResolution],
    )

    expect(result.pendingCount).toBe(1)
    expect(result.ties[0].resolved).toBe(false)
    expect(result.ties[0].teams.map((team) => team.id).sort()).toEqual(['c', 'd'])
  })

  it('shows a confirmed manual order in the predicted group table', () => {
    const resolution: TieResolution = {
      teamIds: ['a', 'b', 'c', 'd'],
      order: ['d', 'c', 'b', 'a'],
    }

    const rows = buildGroupTableRows(
      teams,
      matches,
      getter(allDrawPredictions()),
      [resolution],
    )

    expect(rows.map((row) => row.team.name)).toEqual([
      'Team D',
      'Team C',
      'Team B',
      'Team A',
    ])
    expect(rows.map((row) => row.position)).toEqual([1, 2, 3, 4])
  })
})
