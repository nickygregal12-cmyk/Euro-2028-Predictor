import { describe, it, expect } from 'vitest'
import {
  resolveRoundOf16,
  type RoundOf16Input,
  type R16Fixture,
} from '../../src/domain/tournament/resolveRoundOf16'
import type { GroupLetter } from '../../src/domain/tournament/roundOf16Allocation'

const GROUPS: GroupLetter[] = ['A', 'B', 'C', 'D', 'E', 'F']

// Independent ground-truth transcription of section 7 (NOT imported from the
// source config, so the test actually verifies the shipped table). Values are
// the group whose third-placed team plays each winner slot.
const EXPECTED_ALLOCATION: Record<
  string,
  { WB: GroupLetter; WC: GroupLetter; WE: GroupLetter; WF: GroupLetter }
> = {
  ABCD: { WB: 'A', WC: 'D', WE: 'B', WF: 'C' },
  ABCE: { WB: 'A', WC: 'E', WE: 'B', WF: 'C' },
  ABCF: { WB: 'A', WC: 'F', WE: 'B', WF: 'C' },
  ABDE: { WB: 'D', WC: 'E', WE: 'A', WF: 'B' },
  ABDF: { WB: 'D', WC: 'F', WE: 'A', WF: 'B' },
  ABEF: { WB: 'E', WC: 'F', WE: 'B', WF: 'A' },
  ACDE: { WB: 'E', WC: 'D', WE: 'C', WF: 'A' },
  ACDF: { WB: 'F', WC: 'D', WE: 'C', WF: 'A' },
  ACEF: { WB: 'E', WC: 'F', WE: 'C', WF: 'A' },
  ADEF: { WB: 'E', WC: 'F', WE: 'D', WF: 'A' },
  BCDE: { WB: 'E', WC: 'D', WE: 'B', WF: 'C' },
  BCDF: { WB: 'F', WC: 'D', WE: 'C', WF: 'B' },
  BCEF: { WB: 'F', WC: 'E', WE: 'C', WF: 'B' },
  BDEF: { WB: 'F', WC: 'E', WE: 'D', WF: 'B' },
  CDEF: { WB: 'F', WC: 'E', WE: 'D', WF: 'C' },
}

const winners = Object.fromEntries(
  GROUPS.map((g) => [g, `W-${g}`])
) as Record<GroupLetter, string>
const runnersUp = Object.fromEntries(
  GROUPS.map((g) => [g, `RU-${g}`])
) as Record<GroupLetter, string>

function inputFor(qualifyingGroups: GroupLetter[]): RoundOf16Input {
  return {
    winners,
    runnersUp,
    qualifyingThirds: qualifyingGroups.map((g) => ({
      groupLetter: g,
      teamId: `3-${g}`,
    })),
  }
}

const byRef = (fixtures: R16Fixture[]) =>
  Object.fromEntries(fixtures.map((f) => [f.ref, f]))

// The winner slot each fixture pairs a third against.
const THIRD_FIXTURE_REF = { WB: 'R16-3', WC: 'R16-4', WE: 'R16-7', WF: 'R16-5' } as const

describe('resolveRoundOf16', () => {
  it('places thirds correctly for all 15 qualifying-group combinations', () => {
    for (const [key, expected] of Object.entries(EXPECTED_ALLOCATION)) {
      const qualifyingGroups = key.split('') as GroupLetter[]
      const fixtures = byRef(resolveRoundOf16(inputFor(qualifyingGroups)))

      for (const slot of ['WB', 'WC', 'WE', 'WF'] as const) {
        const fixture = fixtures[THIRD_FIXTURE_REF[slot]]
        const expectedGroup = expected[slot]
        expect(fixture.away.slot).toEqual({ type: 'third', group: expectedGroup })
        expect(fixture.away.teamId).toBe(`3-${expectedGroup}`)
      }

      // The four placed thirds must be exactly the qualifying set.
      const placed = (['WB', 'WC', 'WE', 'WF'] as const)
        .map((s) => expected[s])
        .sort()
      expect(placed).toEqual([...qualifyingGroups].sort())
    }
  })

  it('satisfies the section-7 slot constraints for every combination', () => {
    const allowed = {
      WB: ['A', 'D', 'E', 'F'],
      WC: ['D', 'E', 'F'],
      WE: ['A', 'B', 'C', 'D'],
      WF: ['A', 'B', 'C'],
    } as const

    for (const key of Object.keys(EXPECTED_ALLOCATION)) {
      const qualifyingGroups = key.split('') as GroupLetter[]
      const fixtures = byRef(resolveRoundOf16(inputFor(qualifyingGroups)))

      for (const slot of ['WB', 'WC', 'WE', 'WF'] as const) {
        const side = fixtures[THIRD_FIXTURE_REF[slot]].away
        expect(side.slot.type).toBe('third')
        expect(allowed[slot]).toContain(side.slot.group)
      }
    }
  })

  it('resolves the fixed winner/runner-up fixtures from the skeleton', () => {
    const fixtures = byRef(resolveRoundOf16(inputFor(['A', 'B', 'C', 'D'])))

    expect(fixtures['R16-1'].home).toEqual({ slot: { type: 'winner', group: 'A' }, teamId: 'W-A' })
    expect(fixtures['R16-1'].away).toEqual({ slot: { type: 'runnerUp', group: 'C' }, teamId: 'RU-C' })
    expect(fixtures['R16-2'].home).toEqual({ slot: { type: 'runnerUp', group: 'A' }, teamId: 'RU-A' })
    expect(fixtures['R16-2'].away).toEqual({ slot: { type: 'runnerUp', group: 'B' }, teamId: 'RU-B' })
    expect(fixtures['R16-6'].home).toEqual({ slot: { type: 'runnerUp', group: 'D' }, teamId: 'RU-D' })
    expect(fixtures['R16-6'].away).toEqual({ slot: { type: 'runnerUp', group: 'E' }, teamId: 'RU-E' })
    expect(fixtures['R16-8'].home).toEqual({ slot: { type: 'winner', group: 'D' }, teamId: 'W-D' })
    expect(fixtures['R16-8'].away).toEqual({ slot: { type: 'runnerUp', group: 'F' }, teamId: 'RU-F' })

    // Winner home sides for the third-place fixtures.
    expect(fixtures['R16-3'].home).toEqual({ slot: { type: 'winner', group: 'B' }, teamId: 'W-B' })
    expect(fixtures['R16-4'].home).toEqual({ slot: { type: 'winner', group: 'C' }, teamId: 'W-C' })
    expect(fixtures['R16-5'].home).toEqual({ slot: { type: 'winner', group: 'F' }, teamId: 'W-F' })
    expect(fixtures['R16-7'].home).toEqual({ slot: { type: 'winner', group: 'E' }, teamId: 'W-E' })
  })

  it('returns all eight fixtures in order', () => {
    const fixtures = resolveRoundOf16(inputFor(['A', 'B', 'C', 'D']))
    expect(fixtures.map((f) => f.ref)).toEqual([
      'R16-1', 'R16-2', 'R16-3', 'R16-4', 'R16-5', 'R16-6', 'R16-7', 'R16-8',
    ])
  })

  it('throws when the qualifying set has no allocation row', () => {
    // Only three thirds — not a valid tournament state.
    expect(() => resolveRoundOf16(inputFor(['A', 'B', 'C']))).toThrow()
  })
})
