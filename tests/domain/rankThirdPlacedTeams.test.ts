import { describe, it, expect } from 'vitest'
import {
  rankThirdPlacedTeams,
  type ThirdPlacedTeam,
} from '../../src/domain/tournament/rankThirdPlacedTeams'

// Builds a third-placed team from just the fields the ranking cares about;
// the rest are filled with consistent-enough placeholders.
function third(
  groupLetter: string,
  teamId: string,
  s: { points: number; goalDifference: number; goalsFor: number; won: number }
): ThirdPlacedTeam {
  return {
    teamId,
    groupLetter,
    played: 3,
    won: s.won,
    drawn: 0,
    lost: 0,
    goalsFor: s.goalsFor,
    goalsAgainst: s.goalsFor - s.goalDifference,
    goalDifference: s.goalDifference,
    points: s.points,
  }
}

const ids = (teams: { teamId: string }[]) => teams.map((t) => t.teamId)

describe('rankThirdPlacedTeams', () => {
  it('ranks cleanly by points and takes the top four', () => {
    const teams = [
      third('A', 'a', { points: 7, goalDifference: 3, goalsFor: 5, won: 2 }),
      third('B', 'b', { points: 6, goalDifference: 2, goalsFor: 4, won: 2 }),
      third('C', 'c', { points: 5, goalDifference: 1, goalsFor: 4, won: 1 }),
      third('D', 'd', { points: 4, goalDifference: 0, goalsFor: 3, won: 1 }),
      third('E', 'e', { points: 3, goalDifference: -2, goalsFor: 2, won: 1 }),
      third('F', 'f', { points: 1, goalDifference: -4, goalsFor: 1, won: 0 }),
    ]
    const result = rankThirdPlacedTeams(teams)

    expect(ids(result.ranking)).toEqual(['a', 'b', 'c', 'd', 'e', 'f'])
    expect(result.ranking.map((t) => t.rank)).toEqual([1, 2, 3, 4, 5, 6])
    expect(result.unresolvedGroups).toEqual([])
    expect(result.qualifiers).not.toBeNull()
    expect(ids(result.qualifiers!)).toEqual(['a', 'b', 'c', 'd'])
  })

  it('breaks a tie on goal difference (criterion 2)', () => {
    // b and c are level on points; b has the better goal difference.
    const teams = [
      third('A', 'a', { points: 9, goalDifference: 5, goalsFor: 6, won: 3 }),
      third('B', 'b', { points: 4, goalDifference: 3, goalsFor: 4, won: 1 }),
      third('C', 'c', { points: 4, goalDifference: 1, goalsFor: 4, won: 1 }),
      third('D', 'd', { points: 3, goalDifference: 0, goalsFor: 3, won: 1 }),
      third('E', 'e', { points: 2, goalDifference: -3, goalsFor: 2, won: 0 }),
      third('F', 'f', { points: 1, goalDifference: -6, goalsFor: 1, won: 0 }),
    ]
    const result = rankThirdPlacedTeams(teams)
    expect(ids(result.ranking)).toEqual(['a', 'b', 'c', 'd', 'e', 'f'])
    expect(result.unresolvedGroups).toEqual([])
  })

  it('breaks a tie on goals scored (criterion 3)', () => {
    // b and c are level on points and goal difference; b scored more.
    const teams = [
      third('A', 'a', { points: 9, goalDifference: 5, goalsFor: 6, won: 3 }),
      third('B', 'b', { points: 4, goalDifference: 2, goalsFor: 5, won: 1 }),
      third('C', 'c', { points: 4, goalDifference: 2, goalsFor: 3, won: 1 }),
      third('D', 'd', { points: 3, goalDifference: 0, goalsFor: 3, won: 1 }),
      third('E', 'e', { points: 2, goalDifference: -3, goalsFor: 2, won: 0 }),
      third('F', 'f', { points: 1, goalDifference: -6, goalsFor: 1, won: 0 }),
    ]
    const result = rankThirdPlacedTeams(teams)
    expect(ids(result.ranking)).toEqual(['a', 'b', 'c', 'd', 'e', 'f'])
    expect(result.unresolvedGroups).toEqual([])
  })

  it('breaks a tie on number of wins (criterion 4)', () => {
    // b and c are level on points, goal difference and goals; b has more wins.
    const teams = [
      third('A', 'a', { points: 9, goalDifference: 5, goalsFor: 6, won: 3 }),
      third('B', 'b', { points: 4, goalDifference: 2, goalsFor: 4, won: 2 }),
      third('C', 'c', { points: 4, goalDifference: 2, goalsFor: 4, won: 1 }),
      third('D', 'd', { points: 3, goalDifference: 0, goalsFor: 3, won: 1 }),
      third('E', 'e', { points: 2, goalDifference: -3, goalsFor: 2, won: 0 }),
      third('F', 'f', { points: 1, goalDifference: -6, goalsFor: 1, won: 0 }),
    ]
    const result = rankThirdPlacedTeams(teams)
    expect(ids(result.ranking)).toEqual(['a', 'b', 'c', 'd', 'e', 'f'])
    expect(result.unresolvedGroups).toEqual([])
  })

  it('flags an unresolvable tie within the top four but still names the qualifying set', () => {
    // b and c are identical on all four criteria at positions 2-3. Their order
    // is undetermined, but both are clearly in the top four, so the qualifying
    // set is still known.
    const teams = [
      third('A', 'a', { points: 9, goalDifference: 5, goalsFor: 6, won: 3 }),
      third('B', 'b', { points: 4, goalDifference: 2, goalsFor: 4, won: 1 }),
      third('C', 'c', { points: 4, goalDifference: 2, goalsFor: 4, won: 1 }),
      third('D', 'd', { points: 3, goalDifference: 0, goalsFor: 3, won: 1 }),
      third('E', 'e', { points: 2, goalDifference: -3, goalsFor: 2, won: 0 }),
      third('F', 'f', { points: 1, goalDifference: -6, goalsFor: 1, won: 0 }),
    ]
    const result = rankThirdPlacedTeams(teams)

    expect(result.unresolvedGroups).toHaveLength(1)
    expect([...result.unresolvedGroups[0].teamIds].sort()).toEqual(['b', 'c'])
    expect(result.unresolvedGroups[0].positions).toEqual([2, 3])
    // Both share the block's top position.
    const b = result.ranking.find((t) => t.teamId === 'b')!
    const c = result.ranking.find((t) => t.teamId === 'c')!
    expect(b.rank).toBe(2)
    expect(c.rank).toBe(2)
    expect(b.tiedUnresolved && c.tiedUnresolved).toBe(true)
    // Qualifying set is still determinable (a, b, c, d in some order).
    expect(result.qualifiers).not.toBeNull()
    expect(ids(result.qualifiers!).sort()).toEqual(['a', 'b', 'c', 'd'])
  })

  it('returns null qualifiers when an unresolvable tie straddles the 4th/5th boundary', () => {
    // d and e are identical on all four criteria at positions 4-5. Exactly one
    // of them advances, but the app cannot say which → qualifiers is null.
    const teams = [
      third('A', 'a', { points: 9, goalDifference: 5, goalsFor: 6, won: 3 }),
      third('B', 'b', { points: 7, goalDifference: 3, goalsFor: 5, won: 2 }),
      third('C', 'c', { points: 5, goalDifference: 1, goalsFor: 4, won: 1 }),
      third('D', 'd', { points: 4, goalDifference: 0, goalsFor: 3, won: 1 }),
      third('E', 'e', { points: 4, goalDifference: 0, goalsFor: 3, won: 1 }),
      third('F', 'f', { points: 1, goalDifference: -6, goalsFor: 1, won: 0 }),
    ]
    const result = rankThirdPlacedTeams(teams)

    expect(result.qualifiers).toBeNull()
    expect(result.unresolvedGroups).toHaveLength(1)
    expect([...result.unresolvedGroups[0].teamIds].sort()).toEqual(['d', 'e'])
    expect(result.unresolvedGroups[0].positions).toEqual([4, 5])
  })
})
