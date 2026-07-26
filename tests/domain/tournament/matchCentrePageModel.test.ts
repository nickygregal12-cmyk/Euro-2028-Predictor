import { describe, expect, it } from 'vitest'
import type { Group, Match, Team } from '../../../src/services/supabase/tournamentData'
import { createMatchCentrePageModel } from '../../../src/domain/tournament/matchCentrePageModel'

const groups: Group[] = [{ id: 'group-a', letter: 'A' }]
const teams: Team[] = [
  { id: 'home', name: 'Scotland', groupId: 'group-a', slot: 1 },
  { id: 'away', name: 'Germany', groupId: 'group-a', slot: 2 },
]

function fixture(overrides: Partial<Match> = {}): Match {
  return {
    id: 'match-1',
    matchRef: 'M01',
    round: 'group',
    groupId: 'group-a',
    matchday: 1,
    homeSource: 'A1',
    awaySource: 'A2',
    homeTeamId: 'home',
    awayTeamId: 'away',
    matchDate: '2028-06-09',
    kickoffAt: '2028-06-09T20:00:00.000Z',
    venue: 'Wembley Stadium',
    homeScore: null,
    awayScore: null,
    ...overrides,
  }
}

describe('createMatchCentrePageModel', () => {
  it('does not claim a passed kickoff is live without an authoritative feed', () => {
    const model = createMatchCentrePageModel({
      match: fixture(),
      teams,
      groups,
      now: '2028-06-09T21:00:00.000Z',
    })

    expect(model.temporalState).toBe('before')
    expect(model.statusPresentation.label).toBe('Upcoming')
    expect(model.eyebrow).toBe('Group A · Upcoming')
    expect(model.liveMinute).toBeNull()
    expect(model.lifecycleContent.heading).toBe('Match preview')
    expect(model.lifecycleContent.showMatchImpact).toBe(false)
  })

  it('maps a completed repository result to the existing after state', () => {
    const model = createMatchCentrePageModel({
      match: fixture({ homeScore: 2, awayScore: 1 }),
      teams,
      groups,
      now: '2028-06-09T22:00:00.000Z',
    })

    expect(model.temporalState).toBe('after')
    expect(model.result).toEqual({ home: 2, away: 1 })
    expect(model.statusPresentation.label).toBe('Full-time')
    expect(model.countdownLabel).toBeNull()
    expect(model.lifecycleContent).toMatchObject({
      heading: 'Match complete',
      emphasis: 'success',
      showMatchImpact: true,
    })
  })

  it('uses unresolved knockout source labels instead of inventing teams', () => {
    const model = createMatchCentrePageModel({
      match: fixture({
        round: 'qf',
        groupId: null,
        homeTeamId: null,
        awayTeamId: null,
        homeSource: 'Winner R16 1',
        awaySource: 'Winner R16 2',
      }),
      teams,
      groups,
      now: '2028-06-01T12:00:00.000Z',
    })

    expect(model.home.name).toBe('Winner R16 1')
    expect(model.away.name).toBe('Winner R16 2')
    expect(model.eyebrow).toBe('Quarter-final · Upcoming')
  })

  it('keeps repository data visibly provisional before a result exists', () => {
    const model = createMatchCentrePageModel({
      match: fixture(),
      teams,
      groups,
      now: '2028-06-09T19:30:00.000Z',
      fetchedAt: '2028-06-09T19:30:00.000Z',
    })

    expect(model.statusPresentation.label).toBe('Starting soon')
    expect(model.matchSource.dataQuality).toBe('provisional')
    expect(model.countdownLabel).toMatch(/^Kick-off /)
    expect(model.lifecycleContent.heading).toBe('Starting soon')
  })
})
