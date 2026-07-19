import { describe, it, expect } from 'vitest'
import {
  rankThirdPlacedTeams,
  type ThirdPlacedTeam,
} from '../../src/domain/tournament/rankThirdPlacedTeams'
import { resolveRoundOf16 } from '../../src/domain/tournament/resolveRoundOf16'
import type { TieResolution } from '../../src/domain/tournament/tieResolutions'
import type { GroupLetter } from '../../src/domain/tournament/roundOf16Allocation'

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

  it('applies a manual resolution: a within-top-four tie gets a definite order', () => {
    const teams = [
      third('A', 'a', { points: 9, goalDifference: 5, goalsFor: 6, won: 3 }),
      third('B', 'b', { points: 4, goalDifference: 2, goalsFor: 4, won: 1 }),
      third('C', 'c', { points: 4, goalDifference: 2, goalsFor: 4, won: 1 }),
      third('D', 'd', { points: 3, goalDifference: 0, goalsFor: 3, won: 1 }),
      third('E', 'e', { points: 2, goalDifference: -3, goalsFor: 2, won: 0 }),
      third('F', 'f', { points: 1, goalDifference: -6, goalsFor: 1, won: 0 }),
    ]
    // The user orders the b/c tie as c-then-b.
    const resolutions: TieResolution[] = [{ teamIds: ['b', 'c'], order: ['c', 'b'] }]
    const result = rankThirdPlacedTeams(teams, resolutions)

    expect(ids(result.ranking)).toEqual(['a', 'c', 'b', 'd', 'e', 'f'])
    expect(result.ranking.map((t) => t.rank)).toEqual([1, 2, 3, 4, 5, 6])
    expect(result.ranking.every((t) => !t.tiedUnresolved)).toBe(true)
    expect(result.unresolvedGroups).toEqual([])
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

// The whole point of feeding a resolution back into the pipeline: it changes
// which four groups supply the qualifying thirds, which changes the R16 draw.
describe('resolution flows through to the Round of 16 mapping', () => {
  const LETTERS: GroupLetter[] = ['A', 'B', 'C', 'D', 'E', 'F']
  // Full winner/runner-up records so resolveRoundOf16 can resolve every slot.
  const winners = Object.fromEntries(LETTERS.map((g) => [g, `W-${g}`])) as Record<
    GroupLetter,
    string
  >
  const runnersUp = Object.fromEntries(LETTERS.map((g) => [g, `RU-${g}`])) as Record<
    GroupLetter,
    string
  >

  // Thirds from A/B/C clearly qualify; D and E are level on all four criteria
  // straddling the 4th/5th boundary, so exactly one of them advances. Which one
  // decides whether the qualifying set is {A,B,C,D} or {A,B,C,E} — different
  // rows of the allocation table, so different fixtures.
  const thirds = [
    third('A', 'a', { points: 9, goalDifference: 5, goalsFor: 6, won: 3 }),
    third('B', 'b', { points: 7, goalDifference: 3, goalsFor: 5, won: 2 }),
    third('C', 'c', { points: 5, goalDifference: 1, goalsFor: 4, won: 1 }),
    third('D', 'd', { points: 4, goalDifference: 0, goalsFor: 3, won: 1 }),
    third('E', 'e', { points: 4, goalDifference: 0, goalsFor: 3, won: 1 }),
    third('F', 'f', { points: 1, goalDifference: -6, goalsFor: 1, won: 0 }),
  ]

  function r16For(resolutions: TieResolution[]) {
    const { qualifiers } = rankThirdPlacedTeams(thirds, resolutions)
    expect(qualifiers).not.toBeNull()
    return resolveRoundOf16({
      winners,
      runnersUp,
      qualifyingThirds: qualifiers!.map((q) => ({
        groupLetter: q.groupLetter as GroupLetter,
        teamId: q.teamId,
      })),
    })
  }

  it('ordering the straddling tie D-first selects the {A,B,C,D} allocation', () => {
    const fixtures = r16For([{ teamIds: ['d', 'e'], order: ['d', 'e'] }])
    // Allocation ABCD → WC (R16-4) plays 3D.
    const r16_4 = fixtures.find((f) => f.ref === 'R16-4')!
    expect(r16_4.away.slot).toEqual({ type: 'third', group: 'D' })
    expect(r16_4.away.teamId).toBe('d')
    // 3E did not qualify at all.
    const groupsUsed = fixtures.flatMap((f) =>
      [f.home.slot, f.away.slot]
        .filter((s) => s.type === 'third')
        .map((s) => (s as { group: GroupLetter }).group),
    )
    expect(groupsUsed.sort()).toEqual(['A', 'B', 'C', 'D'])
  })

  it('ordering the same tie E-first selects the {A,B,C,E} allocation instead', () => {
    const fixtures = r16For([{ teamIds: ['d', 'e'], order: ['e', 'd'] }])
    // Allocation ABCE → WC (R16-4) plays 3E, not 3D.
    const r16_4 = fixtures.find((f) => f.ref === 'R16-4')!
    expect(r16_4.away.slot).toEqual({ type: 'third', group: 'E' })
    expect(r16_4.away.teamId).toBe('e')
    const groupsUsed = fixtures.flatMap((f) =>
      [f.home.slot, f.away.slot]
        .filter((s) => s.type === 'third')
        .map((s) => (s as { group: GroupLetter }).group),
    )
    expect(groupsUsed.sort()).toEqual(['A', 'B', 'C', 'E'])
  })
})
