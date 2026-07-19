import { describe, it, expect } from 'vitest'
import { advanceBracket } from '../../src/domain/tournament/advanceBracket'
import { resolveRoundOf16 } from '../../src/domain/tournament/resolveRoundOf16'
import type { GroupLetter } from '../../src/domain/tournament/roundOf16Allocation'
import type { R16Fixture } from '../../src/domain/tournament/resolveRoundOf16'

const byRef = <T extends { ref: string }>(items: T[]) =>
  Object.fromEntries(items.map((f) => [f.ref, f]))

describe('advanceBracket', () => {
  it('feeds R16 winners into the four quarter-finals per sections 4-5', () => {
    const r16Winners = {
      'R16-1': 'w1',
      'R16-2': 'w2',
      'R16-3': 'w3',
      'R16-4': 'w4',
      'R16-5': 'w5',
      'R16-6': 'w6',
      'R16-7': 'w7',
      'R16-8': 'w8',
    }
    const qf = byRef(advanceBracket(r16Winners))

    expect(Object.keys(qf).sort()).toEqual(['QF-1', 'QF-2', 'QF-3', 'QF-4'])
    // QF-1: Winner R16-3 v Winner R16-1
    expect(qf['QF-1'].home).toEqual({ fromRef: 'R16-3', teamId: 'w3' })
    expect(qf['QF-1'].away).toEqual({ fromRef: 'R16-1', teamId: 'w1' })
    // QF-2: Winner R16-5 v Winner R16-6
    expect(qf['QF-2'].home).toEqual({ fromRef: 'R16-5', teamId: 'w5' })
    expect(qf['QF-2'].away).toEqual({ fromRef: 'R16-6', teamId: 'w6' })
    // QF-3: Winner R16-4 v Winner R16-2
    expect(qf['QF-3'].home).toEqual({ fromRef: 'R16-4', teamId: 'w4' })
    expect(qf['QF-3'].away).toEqual({ fromRef: 'R16-2', teamId: 'w2' })
    // QF-4: Winner R16-7 v Winner R16-8
    expect(qf['QF-4'].home).toEqual({ fromRef: 'R16-7', teamId: 'w7' })
    expect(qf['QF-4'].away).toEqual({ fromRef: 'R16-8', teamId: 'w8' })
    expect(qf['QF-1'].round).toBe('QF')
  })

  it('does not produce a fixture until both feeders are decided', () => {
    // Only one R16 result in — no quarter-final can form yet.
    expect(advanceBracket({ 'R16-3': 'w3' })).toEqual([])
    // QF-1 needs R16-3 and R16-1; give it only one feeder.
    const partial = advanceBracket({ 'R16-3': 'w3', 'R16-5': 'w5', 'R16-6': 'w6' })
    // QF-2 (R16-5 + R16-6) is ready; QF-1 (missing R16-1) is not.
    expect(partial.map((f) => f.ref)).toEqual(['QF-2'])
  })

  it('runs a full bracket from a real R16 draw through to the champion', () => {
    const groups: GroupLetter[] = ['A', 'B', 'C', 'D', 'E', 'F']
    const winners = Object.fromEntries(groups.map((g) => [g, `W-${g}`])) as Record<GroupLetter, string>
    const runnersUp = Object.fromEntries(groups.map((g) => [g, `RU-${g}`])) as Record<GroupLetter, string>

    const r16: R16Fixture[] = resolveRoundOf16({
      winners,
      runnersUp,
      qualifyingThirds: (['A', 'B', 'C', 'D'] as GroupLetter[]).map((g) => ({
        groupLetter: g,
        teamId: `3-${g}`,
      })),
    })

    // Winner selections accumulate across rounds. Home side wins every tie.
    const results: Record<string, string> = {}
    const recordHomeWinners = (fixtures: { ref: string; home: { teamId: string } }[]) => {
      for (const f of fixtures) results[f.ref] = f.home.teamId
    }

    recordHomeWinners(r16)

    const qf = advanceBracket(results)
    expect(qf.map((f) => f.ref)).toEqual(['QF-1', 'QF-2', 'QF-3', 'QF-4'])
    // QF-1 = Winner R16-3 (W-B, home of R16-3) v Winner R16-1 (W-A).
    const qfByRef = byRef(qf)
    expect(qfByRef['QF-1'].home.teamId).toBe('W-B')
    expect(qfByRef['QF-1'].away.teamId).toBe('W-A')
    recordHomeWinners(qf)

    const sf = advanceBracket(results)
    expect(sf.map((f) => f.ref)).toEqual(['SF-1', 'SF-2'])
    const sfByRef = byRef(sf)
    // SF-1 = Winner QF-1 v Winner QF-2; SF-2 = Winner QF-4 v Winner QF-3.
    expect(sfByRef['SF-1'].home.fromRef).toBe('QF-1')
    expect(sfByRef['SF-1'].away.fromRef).toBe('QF-2')
    expect(sfByRef['SF-2'].home.fromRef).toBe('QF-4')
    expect(sfByRef['SF-2'].away.fromRef).toBe('QF-3')
    recordHomeWinners(sf)

    const finalRound = advanceBracket(results)
    expect(finalRound.map((f) => f.ref)).toEqual(['FINAL'])
    expect(finalRound[0].home.fromRef).toBe('SF-1')
    expect(finalRound[0].away.fromRef).toBe('SF-2')
    recordHomeWinners(finalRound)

    // Nothing left to play — tournament complete, champion is the final winner.
    expect(advanceBracket(results)).toEqual([])
    expect(results['FINAL']).toBe('W-B')
  })
})
