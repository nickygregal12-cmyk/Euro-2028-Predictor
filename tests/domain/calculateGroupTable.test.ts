import { describe, it, expect } from 'vitest'
import { calculateGroupTable } from '../../src/domain/tournament/calculateGroupTable'

const teamIds = ['t1', 't2', 't3', 't4']

describe('calculateGroupTable', () => {
  it('awards 3 points for a home win', () => {
    const table = calculateGroupTable(teamIds, [
      { homeTeamId: 't1', awayTeamId: 't2', homeScore: 2, awayScore: 0 },
    ])
    const t1 = table.find((s) => s.teamId === 't1')!
    const t2 = table.find((s) => s.teamId === 't2')!
    expect(t1.points).toBe(3)
    expect(t1.won).toBe(1)
    expect(t2.points).toBe(0)
    expect(t2.lost).toBe(1)
  })

  it('awards 3 points for an away win', () => {
    const table = calculateGroupTable(teamIds, [
      { homeTeamId: 't1', awayTeamId: 't2', homeScore: 0, awayScore: 3 },
    ])
    const t1 = table.find((s) => s.teamId === 't1')!
    const t2 = table.find((s) => s.teamId === 't2')!
    expect(t2.points).toBe(3)
    expect(t2.won).toBe(1)
    expect(t1.points).toBe(0)
    expect(t1.lost).toBe(1)
  })

  it('awards 1 point each for a draw', () => {
    const table = calculateGroupTable(teamIds, [
      { homeTeamId: 't1', awayTeamId: 't2', homeScore: 1, awayScore: 1 },
    ])
    const t1 = table.find((s) => s.teamId === 't1')!
    const t2 = table.find((s) => s.teamId === 't2')!
    expect(t1.points).toBe(1)
    expect(t2.points).toBe(1)
    expect(t1.drawn).toBe(1)
    expect(t2.drawn).toBe(1)
  })

  it('calculates goal difference correctly across multiple matches', () => {
    const table = calculateGroupTable(teamIds, [
      { homeTeamId: 't1', awayTeamId: 't2', homeScore: 3, awayScore: 1 },
      { homeTeamId: 't1', awayTeamId: 't3', homeScore: 0, awayScore: 2 },
    ])
    const t1 = table.find((s) => s.teamId === 't1')!
    expect(t1.goalsFor).toBe(3)
    expect(t1.goalsAgainst).toBe(3)
    expect(t1.goalDifference).toBe(0)
    expect(t1.played).toBe(2)
  })

  it('sorts by points first, then goal difference, then goals for', () => {
    const table = calculateGroupTable(teamIds, [
      // t1 beats t2 big
      { homeTeamId: 't1', awayTeamId: 't2', homeScore: 4, awayScore: 0 },
      // t3 beats t4 by less, same points as t1
      { homeTeamId: 't3', awayTeamId: 't4', homeScore: 1, awayScore: 0 },
    ])
    expect(table[0].teamId).toBe('t1') // better GD, same points
    expect(table[1].teamId).toBe('t3')
  })

  it('includes teams with no matches played as zeroed rows', () => {
    const table = calculateGroupTable(teamIds, [
      { homeTeamId: 't1', awayTeamId: 't2', homeScore: 1, awayScore: 0 },
    ])
    const t4 = table.find((s) => s.teamId === 't4')!
    expect(t4.played).toBe(0)
    expect(t4.points).toBe(0)
  })

  it('ignores matches referencing teams outside the given group', () => {
    const table = calculateGroupTable(teamIds, [
      { homeTeamId: 't1', awayTeamId: 'unknown-team', homeScore: 2, awayScore: 0 },
    ])
    const t1 = table.find((s) => s.teamId === 't1')!
    expect(t1.played).toBe(0)
  })
})
