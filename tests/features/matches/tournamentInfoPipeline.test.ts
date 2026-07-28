import { describe, it, expect } from 'vitest'
import {
  buildLiveTablesView,
  buildBracketView,
  buildStatsView,
} from '../../../src/features/matches/tournamentInfoPipeline'
import type {
  Match,
  TournamentData,
} from '../../../src/services/supabase/tournamentData'

const match = (o: Partial<Match> & { matchRef: string; round: Match['round'] }): Match => ({
  id: o.matchRef,
  groupId: null,
  matchday: null,
  homeSource: '',
  awaySource: '',
  homeTeamId: null,
  awayTeamId: null,
  matchDate: '2028-06-10',
  kickoffAt: null,
  venue: 'Cardiff',
  homeScore: null,
  awayScore: null,
  ...o,
})

const confirmed = (o: Partial<Match> & { matchRef: string; round: Match['round'] }): Match =>
  match({ resultState: 'confirmed', ...o })

// Two 4-team groups; enough real shape to exercise ordering, thirds and the
// knockout views without a full 24-team fixture.
function makeData(matches: Match[]): TournamentData {
  const teams = ['a', 'b'].flatMap((g) =>
    [1, 2, 3, 4].map((slot) => ({
      id: `${g}${slot}`,
      name: `Team ${g.toUpperCase()}${slot}`,
      groupId: `grp-${g}`,
      slot,
    })),
  )
  return {
    tournament: {
      id: 't1',
      name: 'UEFA Euro 2028',
      year: 2028,
      startsOn: '2028-06-09',
      endsOn: '2028-07-09',
      lockAt: '2028-06-09T13:00:00Z',
    },
    groups: [
      { id: 'grp-a', letter: 'A' },
      { id: 'grp-b', letter: 'B' },
    ],
    teams,
    matches,
  }
}

const groupFixtures = [
  confirmed({ matchRef: 'GA-1', round: 'group', groupId: 'grp-a', homeTeamId: 'a1', awayTeamId: 'a2', homeScore: 2, awayScore: 0 }),
  confirmed({ matchRef: 'GA-2', round: 'group', groupId: 'grp-a', homeTeamId: 'a3', awayTeamId: 'a4', homeScore: 1, awayScore: 0 }),
  confirmed({ matchRef: 'GB-1', round: 'group', groupId: 'grp-b', homeTeamId: 'b1', awayTeamId: 'b2', homeScore: 1, awayScore: 1 }),
  // Unplayed — must not count anywhere.
  match({ matchRef: 'GB-2', round: 'group', groupId: 'grp-b', homeTeamId: 'b3', awayTeamId: 'b4' }),
]

describe('buildLiveTablesView', () => {
  it('orders each group by real results and counts only confirmed games', () => {
    const view = buildLiveTablesView(makeData(groupFixtures))

    expect(view.playedCount).toBe(3)
    expect(view.totalCount).toBe(4)
    const groupA = view.groups.find((g) => g.letter === 'A')!
    expect(groupA.rows[0].team.name).toBe('Team A1')
    expect(groupA.rows[0].points).toBe(3)
    expect(groupA.rows[0].position).toBe(1)
    // A3 also won but 1–0 — goal difference splits them.
    expect(groupA.rows[1].team.name).toBe('Team A3')
  })

  it('flags unresolved shared positions instead of inventing an order', () => {
    const view = buildLiveTablesView(makeData(groupFixtures))
    // b1/b2 drew and b3/b4 haven't played — group B is full of level teams.
    expect(view.hasUnresolvedTies).toBe(true)
  })

  it('ranks the best thirds once results exist, and not before', () => {
    const played = buildLiveTablesView(makeData(groupFixtures))
    expect(played.thirds).not.toBeNull()
    expect(played.thirds).toHaveLength(2)

    const untouched = buildLiveTablesView(
      makeData(groupFixtures.map((m) => match({ ...m, resultState: undefined, homeScore: null, awayScore: null }))),
    )
    expect(untouched.thirds).toBeNull()
    expect(untouched.playedCount).toBe(0)
  })

  it('ignores stale scores on a match reset to scheduled', () => {
    const reset = groupFixtures.map((m) =>
      m.matchRef === 'GA-1' ? { ...m, resultState: 'scheduled' as const } : m,
    )
    const view = buildLiveTablesView(makeData(reset))
    expect(view.playedCount).toBe(2)
    const groupA = view.groups.find((g) => g.letter === 'A')!
    expect(groupA.rows.find((r) => r.team.name === 'Team A1')?.played).toBe(0)
  })
})

describe('buildBracketView', () => {
  const knockout = [
    confirmed({
      matchRef: 'R16-1',
      round: 'r16',
      homeSource: 'W-A',
      awaySource: '3RD-WB',
      homeTeamId: 'a1',
      awayTeamId: 'b3',
      homeScore: 1,
      awayScore: 1,
      resultMethod: 'penalties',
      homePenalties: 4,
      awayPenalties: 2,
      winnerTeamId: 'a1',
    }),
    match({ matchRef: 'R16-2', round: 'r16', homeSource: 'RU-B', awaySource: 'W-C' }),
    match({ matchRef: 'FINAL', round: 'final', homeSource: 'W-SF-1', awaySource: 'W-SF-2' }),
  ]

  it('shows resolved teams, slot descriptions for open slots, and drops empty rounds', () => {
    const rounds = buildBracketView(makeData([...groupFixtures, ...knockout]))

    expect(rounds.map((r) => r.label)).toEqual(['Round of 16', 'Final'])
    const r16 = rounds[0]
    expect(r16.ties[0].home).toEqual({ name: 'Team A1', known: true })
    expect(r16.ties[1].home).toEqual({ name: 'Runner-up Group B', known: false })
    expect(rounds[1].ties[0].home.name).toBe('Winner SF-1')
  })

  it('carries the authoritative score, winner and decided-by detail', () => {
    const rounds = buildBracketView(makeData([...groupFixtures, ...knockout]))
    const settled = rounds[0].ties[0]
    expect(settled.score).toEqual({ home: 1, away: 1 })
    expect(settled.winner).toBe('home')
    expect(settled.detail).toBe('Team A1 won 4–2 on penalties')

    const open = rounds[0].ties[1]
    expect(open.score).toBeNull()
    expect(open.winner).toBeNull()
  })
})

describe('buildStatsView', () => {
  it('aggregates confirmed results into totals, records and top teams', () => {
    const view = buildStatsView(makeData(groupFixtures))

    expect(view.played).toBe(3)
    expect(view.totalMatches).toBe(4)
    expect(view.totalGoals).toBe(5)
    expect(view.groupGoals).toEqual({ total: 5, played: 3, matchCount: 4 })
    expect(view.records.map((r) => r.label)).toEqual([
      'Biggest win',
      'Highest-scoring match',
    ])
    expect(view.goalsPerMatch).toBe(1.7)
    expect(view.records[0].value).toBe('Team A1 2–0 Team A2')
    expect(view.topTeams[0]).toEqual({ name: 'Team A1', goals: 2, played: 1 })
  })

  it('reports empty-state facts before any result', () => {
    const view = buildStatsView(
      makeData(groupFixtures.map((m) => match({ ...m, resultState: undefined, homeScore: null, awayScore: null }))),
    )
    expect(view.played).toBe(0)
    expect(view.goalsPerMatch).toBeNull()
    expect(view.records).toEqual([])
    expect(view.topTeams).toEqual([])
  })
})
