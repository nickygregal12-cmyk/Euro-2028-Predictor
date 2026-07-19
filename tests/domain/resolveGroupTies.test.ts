import { describe, it, expect } from 'vitest'
import { resolveGroupTies } from '../../src/domain/tournament/resolveGroupTies'
import type { MatchScore } from '../../src/domain/tournament/calculateGroupTable'

const teamIds = ['t1', 't2', 't3', 't4']

const order = (r: ReturnType<typeof resolveGroupTies>) =>
  r.standings.map((s) => s.teamId)

describe('resolveGroupTies', () => {
  it('breaks a two-way tie by head-to-head result (step 1)', () => {
    // t1 and t2 finish level on points (4), overall goal difference (+1) and
    // overall goals (3). The ONLY thing separating them is that t1 beat t2,
    // so step 1 (head-to-head points) must decide it.
    const matches: MatchScore[] = [
      { homeTeamId: 't1', awayTeamId: 't2', homeScore: 2, awayScore: 1 },
      { homeTeamId: 't1', awayTeamId: 't3', homeScore: 1, awayScore: 1 },
      { homeTeamId: 't2', awayTeamId: 't3', homeScore: 2, awayScore: 0 },
      { homeTeamId: 't2', awayTeamId: 't4', homeScore: 0, awayScore: 0 },
    ]
    const result = resolveGroupTies(teamIds, matches)

    // Sanity: the two are genuinely level on every overall metric.
    const t1 = result.standings.find((s) => s.teamId === 't1')!
    const t2 = result.standings.find((s) => s.teamId === 't2')!
    expect(t1.points).toBe(t2.points)
    expect(t1.goalDifference).toBe(t2.goalDifference)
    expect(t1.goalsFor).toBe(t2.goalsFor)

    // Head-to-head puts t1 above t2.
    expect(order(result)).toEqual(['t1', 't2', 't4', 't3'])
    expect(result.unresolvedGroups).toEqual([])
    expect(result.standings.every((s) => !s.tiedUnresolved)).toBe(true)
    expect(t1.rank).toBe(1)
    expect(t2.rank).toBe(2)
  })

  it('breaks a three-way tie by overall goal difference when head-to-head cycles (steps 1-3 then 5)', () => {
    // t1, t2, t3 form a perfect head-to-head cycle (each beats one, loses one
    // 1-0), so steps 1-3 among the trio leave them level. Their wins over t4
    // by different margins separate them on overall goal difference (step 5).
    const matches: MatchScore[] = [
      { homeTeamId: 't1', awayTeamId: 't2', homeScore: 1, awayScore: 0 },
      { homeTeamId: 't2', awayTeamId: 't3', homeScore: 1, awayScore: 0 },
      { homeTeamId: 't3', awayTeamId: 't1', homeScore: 1, awayScore: 0 },
      { homeTeamId: 't1', awayTeamId: 't4', homeScore: 3, awayScore: 0 },
      { homeTeamId: 't2', awayTeamId: 't4', homeScore: 2, awayScore: 0 },
      { homeTeamId: 't3', awayTeamId: 't4', homeScore: 1, awayScore: 0 },
    ]
    const result = resolveGroupTies(teamIds, matches)

    // The trio is genuinely level on points before the tie-break.
    const pts = ['t1', 't2', 't3'].map(
      (id) => result.standings.find((s) => s.teamId === id)!.points
    )
    expect(pts).toEqual([6, 6, 6])

    // Overall goal difference: t1 (+3) > t2 (+2) > t3 (+1) > t4.
    expect(order(result)).toEqual(['t1', 't2', 't3', 't4'])
    expect(result.unresolvedGroups).toEqual([])
    expect(result.standings.every((s) => !s.tiedUnresolved)).toBe(true)
    expect(result.standings.map((s) => s.rank)).toEqual([1, 2, 3, 4])
  })

  it('flags a fully tied group as unresolved for the manual step-7 prompt', () => {
    // A complete round-robin of 1-1 draws: every team ends identical on
    // points, goal difference and goals. Steps 1-6 cannot separate anyone.
    const matches: MatchScore[] = [
      { homeTeamId: 't1', awayTeamId: 't2', homeScore: 1, awayScore: 1 },
      { homeTeamId: 't1', awayTeamId: 't3', homeScore: 1, awayScore: 1 },
      { homeTeamId: 't1', awayTeamId: 't4', homeScore: 1, awayScore: 1 },
      { homeTeamId: 't2', awayTeamId: 't3', homeScore: 1, awayScore: 1 },
      { homeTeamId: 't2', awayTeamId: 't4', homeScore: 1, awayScore: 1 },
      { homeTeamId: 't3', awayTeamId: 't4', homeScore: 1, awayScore: 1 },
    ]
    const result = resolveGroupTies(teamIds, matches)

    // One unresolved block containing all four teams.
    expect(result.unresolvedGroups).toHaveLength(1)
    expect([...result.unresolvedGroups[0]].sort()).toEqual([
      't1',
      't2',
      't3',
      't4',
    ])

    // Every team is flagged and shares the top position (nothing separated).
    expect(result.standings).toHaveLength(4)
    expect(result.standings.every((s) => s.tiedUnresolved)).toBe(true)
    expect(result.standings.every((s) => s.rank === 1)).toBe(true)
  })

  it('does not flag anything when the group resolves cleanly', () => {
    const matches: MatchScore[] = [
      { homeTeamId: 't1', awayTeamId: 't2', homeScore: 2, awayScore: 0 },
      { homeTeamId: 't3', awayTeamId: 't4', homeScore: 1, awayScore: 0 },
    ]
    const result = resolveGroupTies(teamIds, matches)
    expect(result.unresolvedGroups).toEqual([])
    expect(result.standings.every((s) => !s.tiedUnresolved)).toBe(true)
  })
})
