import { describe, expect, it, vi } from 'vitest'
import { buildMatchesLeagueTable } from '../../src/vnext/integration/matches/buildMatchesLeagueTable'
import type { CompetitionTable } from '../../src/services/supabase/competitionTableModel'

const TABLE: CompetitionTable = {
  season: {
    id: 'season-1',
    name: 'Scottish Premiership 2026/27',
    seasonKey: '2026-27',
    status: 'active',
    displayTimeZone: 'Europe/London',
  },
  rules: {
    configured: true,
    pointsWin: 3,
    pointsDraw: 1,
    pointsLoss: 0,
    tieBreakers: ['goal_difference'],
    promotionPlaces: 0,
    playoffPlaces: 0,
    relegationPlaces: 1,
  },
  rows: [
    {
      position: 4,
      teamId: 'club-a',
      teamName: 'A Very Long Football Club Name',
      played: 11,
      won: 4,
      drawn: 3,
      lost: 4,
      goalsFor: 14,
      goalsAgainst: 17,
      goalDifference: -3,
      points: 15,
      adjustment: null,
      boundary: null,
    },
  ],
  provenance: {
    fixturesCounted: 33,
    fixturesOutstanding: 15,
    fixturesExcluded: 0,
    fixturesAwarded: 0,
    lastResultAt: '2026-08-19T20:00:00Z',
    providerConfirmed: 33,
    administratorConfirmed: 0,
    providers: ['provider'],
  },
}

describe('Matches league table context', () => {
  it('keeps the server position and football values without sorting or recalculating them', () => {
    const answer = buildMatchesLeagueTable({ status: 'ready', table: TABLE })
    expect(answer.kind).toBe('ready')
    if (answer.kind !== 'ready') return

    expect(answer.rows).toEqual([
      {
        position: 4,
        teamName: 'A Very Long Football Club Name',
        played: 11,
        goalDifference: -3,
        points: 15,
      },
    ])
    expect(answer.statusLabel).toContain('Provisional')
    expect(answer.statusLabel).toContain('33 results counted')
    expect(answer.statusLabel).toContain('15 fixtures still to play')
  })

  it('does not fabricate rows for a season that has not started', () => {
    const answer = buildMatchesLeagueTable({
      status: 'ready',
      table: {
        ...TABLE,
        rows: [],
        provenance: {
          ...TABLE.provenance,
          fixturesCounted: 0,
          fixturesOutstanding: 48,
          lastResultAt: null,
        },
      },
    })
    expect(answer).toMatchObject({
      kind: 'ready',
      rows: [],
      seasonNotStarted: true,
      provenanceLabel: null,
    })
  })

  it('keeps unavailable, loading and failed reads distinct', () => {
    const retry = vi.fn()
    expect(buildMatchesLeagueTable({ status: 'unavailable' })).toEqual({ kind: 'unavailable' })
    expect(buildMatchesLeagueTable({ status: 'loading' })).toEqual({ kind: 'loading' })
    expect(buildMatchesLeagueTable({ status: 'failed', retry })).toEqual({ kind: 'failed', retry })
  })
})
