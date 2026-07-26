import { describe, expect, it } from 'vitest'
import type { Match, Team } from '../../../src/services/supabase/tournamentData'
import { adaptRepositoryMatchToCentre } from '../../../src/domain/tournament/matchCentreRepositoryAdapter'

const teams: Team[] = [
  { id: 'home', name: 'Scotland', groupId: 'group-a', slot: 1 },
  { id: 'away', name: 'Germany', groupId: 'group-a', slot: 2 },
]

function match(overrides: Partial<Match> = {}): Match {
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
    venue: 'Hampden Park',
    homeScore: null,
    awayScore: null,
    ...overrides,
  }
}

describe('adaptRepositoryMatchToCentre', () => {
  it('maps repository identity, teams, venue and the scheduled state', () => {
    const view = adaptRepositoryMatchToCentre({
      match: match(),
      teams,
      now: '2028-06-09T12:00:00.000Z',
    })

    expect(view.external).toMatchObject({
      fixtureId: 'match-1',
      matchRef: 'M01',
      lifecycle: 'SCHEDULED',
      venue: 'Hampden Park',
      home: { id: 'home', name: 'Scotland' },
      away: { id: 'away', name: 'Germany' },
      score: null,
    })
    expect(view.external.source).toMatchObject({
      provider: 'repository',
      dataQuality: 'provisional',
    })
    expect(view.external.events).toEqual([])
    expect(view.external.lineups).toEqual({ home: null, away: null })
    expect(view.enrichment.expectedGoals).toBeNull()
  })

  it('uses pre-match only during the final hour before kickoff', () => {
    const view = adaptRepositoryMatchToCentre({
      match: match(),
      teams,
      now: '2028-06-09T19:15:00.000Z',
    })

    expect(view.external.lifecycle).toBe('PRE_MATCH')
  })

  it('does not invent a live period when kickoff has passed without a provider status', () => {
    const view = adaptRepositoryMatchToCentre({
      match: match(),
      teams,
      now: '2028-06-09T20:30:00.000Z',
    })

    expect(view.external.lifecycle).toBe('SCHEDULED')
    expect(view.external.clockLabel).toBeNull()
  })

  it('maps a stored result to verified full time', () => {
    const view = adaptRepositoryMatchToCentre({
      match: match({ homeScore: 2, awayScore: 1 }),
      teams,
      now: '2028-06-09T22:00:00.000Z',
    })

    expect(view.external.lifecycle).toBe('FULL_TIME')
    expect(view.external.score).toEqual({ home: 2, away: 1 })
    expect(view.external.source.dataQuality).toBe('verified')
  })

  it('falls back to source labels and a deterministic date-only kickoff', () => {
    const view = adaptRepositoryMatchToCentre({
      match: match({
        homeTeamId: null,
        awayTeamId: null,
        homeSource: 'Winner R16 1',
        awaySource: 'Winner R16 2',
        kickoffAt: null,
      }),
      teams,
      now: '2028-01-01T00:00:00.000Z',
    })

    expect(view.external.home.name).toBe('Winner R16 1')
    expect(view.external.away.name).toBe('Winner R16 2')
    expect(view.external.kickoffAt).toBe('2028-06-09T00:00:00.000Z')
  })

  it('preserves supplied predictor data while defaulting missing predictor fields', () => {
    const view = adaptRepositoryMatchToCentre({
      match: match(),
      teams,
      now: '2028-06-09T12:00:00.000Z',
      predictor: {
        userPrediction: { homeScore: 1, awayScore: 0, joker: true },
        points: { status: 'provisional', value: 10 },
      },
    })

    expect(view.predictor.userPrediction).toEqual({ homeScore: 1, awayScore: 0, joker: true })
    expect(view.predictor.points).toEqual({ status: 'provisional', value: 10 })
    expect(view.predictor.leaguePredictionSplit).toBeNull()
  })
})
