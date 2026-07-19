import { describe, it, expect } from 'vitest'
import {
  applyBracketPick,
  winnersToProgression,
  winnersFromProgression,
  PARENT_OF,
  roundOfRef,
  type ProgressionStage,
} from '../../src/domain/tournament/bracketPicks'
import { resolveRoundOf16 } from '../../src/domain/tournament/resolveRoundOf16'
import { advanceBracket } from '../../src/domain/tournament/advanceBracket'
import type { GroupLetter } from '../../src/domain/tournament/roundOf16Allocation'

const GROUPS: GroupLetter[] = ['A', 'B', 'C', 'D', 'E', 'F']

// The eight R16 fixtures for a fixed qualifying set — used to seed
// reconstruction. Winner/runner-up teamIds are W-A / RU-A etc; thirds 3-A etc.
const r16Fixtures = resolveRoundOf16({
  winners: Object.fromEntries(GROUPS.map((g) => [g, `W-${g}`])) as Record<GroupLetter, string>,
  runnersUp: Object.fromEntries(GROUPS.map((g) => [g, `RU-${g}`])) as Record<GroupLetter, string>,
  qualifyingThirds: (['A', 'B', 'C', 'D'] as GroupLetter[]).map((g) => ({
    groupLetter: g,
    teamId: `3-${g}`,
  })),
})

describe('roundOfRef / PARENT_OF', () => {
  it('classifies refs by round', () => {
    expect(roundOfRef('R16-1')).toBe('R16')
    expect(roundOfRef('QF-3')).toBe('QF')
    expect(roundOfRef('SF-2')).toBe('SF')
    expect(roundOfRef('FINAL')).toBe('FINAL')
  })

  it('maps each feeder to its forward match, with no parent for the final', () => {
    // R16-3 and R16-1 both feed QF-1 (knockoutBracket.ts).
    expect(PARENT_OF['R16-3']).toBe('QF-1')
    expect(PARENT_OF['R16-1']).toBe('QF-1')
    expect(PARENT_OF['QF-1']).toBe('SF-1')
    expect(PARENT_OF['SF-1']).toBe('FINAL')
    expect(PARENT_OF['FINAL']).toBeUndefined()
  })
})

describe('winnersToProgression', () => {
  it('records the furthest stage per team, collapsing a whole path to one row', () => {
    // Team X wins R16-1, QF-1 and SF-1 → furthest stage is the final.
    const rows = winnersToProgression({ 'R16-1': 'X', 'QF-1': 'X', 'SF-1': 'X' })
    expect(rows).toEqual([{ teamId: 'X', stage: 'final' }])
  })

  it('maps each round to the stage its winner reaches', () => {
    const rows = winnersToProgression({
      'R16-2': 'a', // reaches qf
      'QF-2': 'b', // reaches sf
      'SF-2': 'c', // reaches final
      FINAL: 'd', // reaches champion
    })
    const byTeam = Object.fromEntries(rows.map((r) => [r.teamId, r.stage]))
    expect(byTeam).toEqual({ a: 'qf', b: 'sf', c: 'final', d: 'champion' })
  })
})

describe('applyBracketPick', () => {
  it('sets a pick with no downstream to clear', () => {
    const { winners, cleared } = applyBracketPick({}, 'R16-1', 'W-A')
    expect(winners).toEqual({ 'R16-1': 'W-A' })
    expect(cleared).toEqual([])
  })

  it('clears later picks the previous winner carried through', () => {
    // W-A won R16-1, then QF-1, then SF-1. Changing R16-1 to RU-C must clear
    // both QF-1 and SF-1 (W-A can no longer be in them).
    const winners = { 'R16-1': 'W-A', 'QF-1': 'W-A', 'SF-1': 'W-A' }
    const result = applyBracketPick(winners, 'R16-1', 'RU-C')
    expect(result.winners['R16-1']).toBe('RU-C')
    expect(result.cleared.sort()).toEqual(['QF-1', 'SF-1'])
    expect(result.winners['QF-1']).toBeUndefined()
    expect(result.winners['SF-1']).toBeUndefined()
  })

  it('leaves downstream picks that did not depend on the changed team', () => {
    // QF-1 is won by W-C (from R16-3), not by R16-1's winner. Changing R16-1
    // must not touch QF-1.
    const winners = { 'R16-1': 'W-A', 'R16-3': 'W-C', 'QF-1': 'W-C' }
    const result = applyBracketPick(winners, 'R16-1', 'RU-C')
    expect(result.cleared).toEqual([])
    expect(result.winners['QF-1']).toBe('W-C')
  })

  it('does not mutate the input map', () => {
    const winners = { 'R16-1': 'W-A', 'QF-1': 'W-A' }
    applyBracketPick(winners, 'R16-1', 'RU-C')
    expect(winners).toEqual({ 'R16-1': 'W-A', 'QF-1': 'W-A' })
  })
})

describe('winnersFromProgression (reconstruction)', () => {
  it('is empty when there is no stored progression', () => {
    expect(winnersFromProgression(r16Fixtures, {})).toEqual({})
  })

  it('reconstructs a single R16 pick', () => {
    // R16-1 is W-A v RU-C. If W-A reached the QF, it won R16-1.
    const winners = winnersFromProgression(r16Fixtures, { 'W-A': 'qf' })
    expect(winners).toEqual({ 'R16-1': 'W-A' })
  })

  it('round-trips a fully-picked bracket (winners → progression → winners)', () => {
    // Build a complete bracket by always advancing the home side of each tie,
    // using advanceBracket to know each forward fixture's participants.
    const winners: Record<string, string> = {}
    for (const f of r16Fixtures) winners[f.ref] = f.home.teamId
    for (const round of ['QF', 'SF', 'FINAL'] as const) {
      for (const f of advanceBracket(winners)) {
        if (f.round === round) winners[f.ref] = f.home.teamId
      }
    }

    // 15 winners in total: 8 + 4 + 2 + 1.
    expect(Object.keys(winners).length).toBe(15)

    // Collapse to progression and rebuild — the round trip is lossless.
    const collapsed = Object.fromEntries(
      winnersToProgression(winners).map((r) => [r.teamId, r.stage]),
    ) as Record<string, ProgressionStage>
    expect(winnersFromProgression(r16Fixtures, collapsed)).toEqual(winners)
  })

  it('leaves a forward tie unpicked until both its feeders are decided', () => {
    // Only R16-1 decided: QF-1 (fed by R16-3 and R16-1) stays unpicked.
    const winners = winnersFromProgression(r16Fixtures, { 'W-A': 'sf' })
    // W-A reached sf but its QF feeder partner (R16-3) is undecided, so we can
    // still resolve R16-1 but QF-1 has only one known side → no winner set.
    expect(winners['R16-1']).toBe('W-A')
    expect(winners['QF-1']).toBeUndefined()
  })
})
