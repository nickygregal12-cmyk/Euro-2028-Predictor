import { describe, expect, it } from 'vitest'
import { buildPrivateLmsModel } from '../../src/vnext/integration/lms/buildPrivateLmsModel'
import type { PrivateLmsSource } from '../../src/vnext/integration/lms/privateLmsSource'

function source(overrides: Partial<PrivateLmsSource> = {}): PrivateLmsSource {
  return {
    generatedAt: '2026-08-21T00:00:00Z',
    context: {
      tournamentId: 'season-1',
      competitionName: 'Scottish Premiership',
      seasonLabel: '2026/27',
    },
    workspace: {
      competition: {
        id: 'private-lms-1',
        name: 'Friday Survivors',
        gameKey: 'last_man_standing',
        gameName: 'Last Man Standing',
        tournamentId: 'season-1',
        seasonName: 'Scottish Premiership 2026/27',
        seasonKey: '2026-27',
        lifecycleState: 'running',
      },
      caller: {
        isOwner: true,
        membershipStatus: 'active',
        inviteCode: 'PRIVATE12345',
        inviteAvailable: true,
      },
      currentRound: {
        windowId: 'window-1',
        sequence: 1,
        label: 'Matchweek 3',
        opensAt: '2026-08-20T10:00:00Z',
        locksAt: '2026-08-22T14:00:00Z',
        locked: false,
      },
      members: [
        {
          userId: 'me',
          displayName: 'Owner',
          isMe: true,
          isOwner: true,
          outcome: 'active',
          membershipStatus: 'active',
          hasPickedCurrentRound: false,
        },
      ],
      memberCount: 1,
    },
    fixtures: {
      matchweek: 3,
      matchweekCount: 38,
      fixtures: [
        {
          id: 'fixture-1',
          kickoffAt: '2026-08-22T15:00:00Z',
          status: 'scheduled',
          homeName: 'Celtic FC',
          awayName: 'Heart of Midlothian FC',
          homeScore: null,
          awayScore: null,
        },
      ],
    },
    clubs: [
      { teamId: 'celtic-id', name: 'Celtic FC' },
      { teamId: 'hearts-id', name: 'Heart of Midlothian FC' },
    ],
    ...overrides,
  }
}

describe('private LMS model', () => {
  it('offers only canonical team ids from the exact-name season authority', () => {
    const model = buildPrivateLmsModel(source())
    expect(model.round.state).toBe('open')
    expect(model.choices.map((choice) => [choice.name, choice.teamId])).toEqual([
      ['Celtic FC', 'celtic-id'],
      ['Heart of Midlothian FC', 'hearts-id'],
    ])
    expect(model.inviteCode).toBe('PRIVATE12345')
  })

  it('stops offering a second first-pick after the private workspace confirms one exists', () => {
    const current = source()
    const model = buildPrivateLmsModel({
      ...current,
      workspace: {
        ...current.workspace,
        members: [
          {
            ...current.workspace.members[0]!,
            hasPickedCurrentRound: true,
          },
        ],
      },
    })
    expect(model.round.state).toBe('picked')
    expect(model.choices).toEqual([])
  })

  it('fails closed when a round is locked or the caller is eliminated', () => {
    const current = source()
    const locked = buildPrivateLmsModel({
      ...current,
      workspace: {
        ...current.workspace,
        currentRound: { ...current.workspace.currentRound!, locked: true },
      },
    })
    expect(locked.round.state).toBe('locked')
    expect(locked.choices).toEqual([])

    const eliminated = buildPrivateLmsModel({
      ...current,
      workspace: {
        ...current.workspace,
        members: [{ ...current.workspace.members[0]!, outcome: 'eliminated' }],
      },
    })
    expect(eliminated.round.state).toBe('eliminated')
    expect(eliminated.choices).toEqual([])
  })
})
