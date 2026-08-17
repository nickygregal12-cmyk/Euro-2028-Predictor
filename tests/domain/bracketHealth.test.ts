import { describe, expect, it } from 'vitest'
import { at } from '../support/indexed'
import {
  computeBracketHealth,
  deriveKnockoutState,
  type KnockoutMatchSnapshot,
} from '../../src/domain/tournament/bracketHealth'

function groupMatches(resulted: boolean): KnockoutMatchSnapshot[] {
  return Array.from({ length: 36 }, () => ({
    round: 'group' as const,
    homeTeamId: null,
    awayTeamId: null,
    winnerTeamId: null,
    resulted,
  }))
}

function populatedR16(teamIds: string[]): KnockoutMatchSnapshot[] {
  return Array.from({ length: 8 }, (_, index) => ({
    round: 'r16' as const,
    homeTeamId: at(teamIds, index * 2),
    awayTeamId: at(teamIds, index * 2 + 1),
    winnerTeamId: null,
    resulted: false,
  }))
}

describe('deriveKnockoutState', () => {
  it('keeps group teams possible while an unresolved tie blocks R16 population', () => {
    const teamIds = Array.from({ length: 24 }, (_, index) => `team-${index + 1}`)
    const state = deriveKnockoutState({
      teamIds,
      matches: [
        ...groupMatches(true),
        ...Array.from({ length: 8 }, () => ({
          round: 'r16' as const,
          homeTeamId: null,
          awayTeamId: null,
          winnerTeamId: null,
          resulted: false,
        })),
      ],
    })

    expect(state.eliminatedTeamIds).toEqual(new Set())
  })

  it('eliminates non-qualifiers only after every R16 participant is authoritative', () => {
    const teamIds = Array.from({ length: 24 }, (_, index) => `team-${index + 1}`)
    const state = deriveKnockoutState({
      teamIds,
      matches: [...groupMatches(true), ...populatedR16(teamIds.slice(0, 16))],
    })

    expect(state.reachedByTeam.get('team-1')).toContain('R16')
    expect(state.eliminatedTeamIds.has('team-17')).toBe(true)
    expect(state.eliminatedTeamIds.has('team-1')).toBe(false)
  })
})

describe('computeBracketHealth', () => {
  it('splits stacked knockout milestones into secured, possible and lost value', () => {
    const state = deriveKnockoutState({
      teamIds: ['a', 'b'],
      matches: [
        {
          round: 'r16',
          homeTeamId: 'a',
          awayTeamId: 'b',
          winnerTeamId: 'a',
          resulted: true,
        },
      ],
    })

    const health = computeBracketHealth(
      [
        { teamId: 'a', stage: 'CHAMPION' },
        { teamId: 'b', stage: 'QF' },
      ],
      state,
    )

    expect(health).toMatchObject({
      securedPoints: 35,
      possiblePoints: 85,
      lostPoints: 15,
      totalPredictedPoints: 135,
    })
    expect(
      health.milestones.find((milestone) => milestone.teamId === 'a' && milestone.stage === 'QF'),
    ).toMatchObject({ status: 'secured', points: 15 })
    expect(
      health.milestones.find((milestone) => milestone.teamId === 'b' && milestone.stage === 'QF'),
    ).toMatchObject({ status: 'lost', points: 15 })
  })

  it('secures every stacked milestone for the authoritative champion', () => {
    const state = deriveKnockoutState({
      teamIds: ['winner', 'runner-up'],
      matches: [
        {
          round: 'final',
          homeTeamId: 'winner',
          awayTeamId: 'runner-up',
          winnerTeamId: 'winner',
          resulted: true,
        },
      ],
    })

    expect(computeBracketHealth([{ teamId: 'winner', stage: 'CHAMPION' }], state)).toMatchObject({
      securedPoints: 110,
      possiblePoints: 0,
      lostPoints: 0,
      totalPredictedPoints: 110,
    })
  })
})
