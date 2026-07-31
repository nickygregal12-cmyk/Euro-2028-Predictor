import { describe, expect, it } from 'vitest'
import { resolveTournamentCompetitionContext } from '../../src/features/shared/tournamentCompetitionContext'
import type { Match, TournamentData } from '../../src/services/supabase/tournamentData'

/**
 * The seam between the competition's persisted calendar zone and the viewer's
 * device zone. Contract 65 stores `display_timezone` on every season; contract
 * 64 fallback remains explicit until the hosted database is deliberately moved.
 */

function match(id: string, kickoffAt: string, scored: boolean): Match {
  return {
    id,
    matchRef: id,
    round: 'group',
    groupId: 'group-a',
    matchday: 1,
    homeSource: '',
    awaySource: '',
    homeTeamId: null,
    awayTeamId: null,
    matchDate: kickoffAt.slice(0, 10),
    kickoffAt,
    venue: '',
    homeScore: scored ? 1 : null,
    awayScore: scored ? 0 : null,
  }
}

const KICKOFF = '2028-06-10T11:00:00.000Z'
const OBSERVED_AT = new Date('2028-06-10T21:00:00.000Z')

const data: TournamentData = {
  tournament: {
    id: 'euro-2028',
    name: 'EURO 2028',
    year: 2028,
    startsOn: '2028-06-09',
    endsOn: '2028-07-09',
    lockAt: '2028-06-09T18:00:00.000Z',
  },
  groups: [{ id: 'group-a', letter: 'A' }],
  teams: [],
  matches: [match('M01', KICKOFF, true)],
}

function resolve(
  zones: { viewerTimeZone: string; competitionTimeZone?: string },
  tournamentData: TournamentData = data,
) {
  return resolveTournamentCompetitionContext({
    data: tournamentData,
    submitted: true,
    entryComplete: true,
    nowServer: OBSERVED_AT,
    ...zones,
  })
}

describe('competition timezone seam', () => {
  it('preserves contract-64 viewer fallback while season metadata is absent', () => {
    expect(resolve({ viewerTimeZone: 'UTC' }).todayISO).toBe('2028-06-10')
    expect(resolve({ viewerTimeZone: 'Pacific/Auckland' }).todayISO).toBe('2028-06-11')
  })

  it('uses persisted season timezone before the viewer timezone', () => {
    const persisted: TournamentData = {
      ...data,
      tournament: { ...data.tournament, displayTimeZone: 'UTC' },
    }

    const london = resolve({ viewerTimeZone: 'Europe/London' }, persisted)
    const auckland = resolve({ viewerTimeZone: 'Pacific/Auckland' }, persisted)

    expect(london.todayISO).toBe('2028-06-10')
    expect(auckland.todayISO).toBe(london.todayISO)
    expect(auckland.context.completedToday.map((item) => item.id)).toEqual(['M01'])
    expect(auckland.context.dayState).toBe('day_complete')
  })

  it('lets an explicit deterministic override win over persisted metadata', () => {
    const persisted: TournamentData = {
      ...data,
      tournament: { ...data.tournament, displayTimeZone: 'Pacific/Auckland' },
    }
    const resolved = resolve(
      { viewerTimeZone: 'Pacific/Auckland', competitionTimeZone: 'UTC' },
      persisted,
    )

    expect(resolved.todayISO).toBe('2028-06-10')
    expect(resolved.context.dayState).toBe('day_complete')
  })

  it('still diverges by viewer only while persisted metadata is absent', () => {
    const utc = resolve({ viewerTimeZone: 'UTC' })
    const auckland = resolve({ viewerTimeZone: 'Pacific/Auckland' })

    expect(utc.context.dayState).toBe('day_complete')
    expect(auckland.context.dayState).toBe('no_matches_today')
  })

  it('falls back to UTC rather than throwing on unusable persisted metadata', () => {
    const persisted: TournamentData = {
      ...data,
      tournament: { ...data.tournament, displayTimeZone: 'Not/AZone' },
    }
    const resolved = resolve({ viewerTimeZone: 'Pacific/Auckland' }, persisted)

    expect(resolved.todayISO).toBe('2028-06-10')
    expect(resolved.context.dayState).toBe('day_complete')
  })

  it('applies the same validation to an explicit override', () => {
    const resolved = resolve({
      viewerTimeZone: 'Europe/London',
      competitionTimeZone: 'Not/AZone',
    })

    expect(resolved.todayISO).toBe('2028-06-10')
    expect(resolved.context.dayState).toBe('day_complete')
  })
})
