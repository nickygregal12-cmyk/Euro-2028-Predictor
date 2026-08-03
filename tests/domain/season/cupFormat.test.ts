import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import {
  CUP_GROUP_CAP,
  selectCupFormat,
  type CupFormatDecision,
} from '../../../src/domain/season/cupFormat'

/**
 * ADR 0014 format selection: deterministic from field size and remaining
 * rounds, exact-fit assertions at N = 6, 8, 10, 12, 19 and 20, a group-path
 * assertion at N = 21, and every field size from 3 to at least 100.
 */

const FULL_SEASON = 38

describe('fields too small for a cup', () => {
  it('declines two and three and offers head-to-head instead', () => {
    expect(selectCupFormat(2, FULL_SEASON)).toEqual({ kind: 'declined_head_to_head' })
    expect(selectCupFormat(3, FULL_SEASON)).toEqual({ kind: 'declined_head_to_head' })
  })
})

describe('the six exact fits on a 38-round season', () => {
  it('N=6: seven meetings, 35 league rounds, split of 3', () => {
    expect(selectCupFormat(6, FULL_SEASON)).toEqual({
      kind: 'single_group',
      meetings: 7,
      leagueRounds: 35,
      tail: { kind: 'split', topHalfSize: 3, bottomHalfSize: 3, splitRounds: 3 },
      leftoverRounds: 0,
    })
  })

  it('N=8: five meetings, 35 league rounds, split of 3', () => {
    expect(selectCupFormat(8, FULL_SEASON)).toEqual({
      kind: 'single_group',
      meetings: 5,
      leagueRounds: 35,
      tail: { kind: 'split', topHalfSize: 4, bottomHalfSize: 4, splitRounds: 3 },
      leftoverRounds: 0,
    })
  })

  it('N=10: four meetings, 36 league rounds, playoff window of 2', () => {
    expect(selectCupFormat(10, FULL_SEASON)).toEqual({
      kind: 'single_group',
      meetings: 4,
      leagueRounds: 36,
      tail: { kind: 'seeded_playoff_window', rounds: 2 },
      leftoverRounds: 0,
    })
  })

  it('N=12: three meetings, 33 league rounds, split of 5 — the Scottish shape emerges from arithmetic', () => {
    expect(selectCupFormat(12, FULL_SEASON)).toEqual({
      kind: 'single_group',
      meetings: 3,
      leagueRounds: 33,
      tail: { kind: 'split', topHalfSize: 6, bottomHalfSize: 6, splitRounds: 5 },
      leftoverRounds: 0,
    })
  })

  it('N=19: two meetings, 36 league rounds, playoff window of 2', () => {
    expect(selectCupFormat(19, FULL_SEASON)).toEqual({
      kind: 'single_group',
      meetings: 2,
      leagueRounds: 36,
      tail: { kind: 'seeded_playoff_window', rounds: 2 },
      leftoverRounds: 0,
    })
  })

  it('N=20: two meetings fill the season exactly with no tail — the cap size', () => {
    expect(selectCupFormat(20, FULL_SEASON)).toEqual({
      kind: 'single_group',
      meetings: 2,
      leagueRounds: 38,
      tail: { kind: 'none' },
      leftoverRounds: 0,
    })
  })
})

describe('above the cap: balanced groups', () => {
  it('N=21 takes the group path: two balanced groups, never twenty and one', () => {
    expect(selectCupFormat(21, FULL_SEASON)).toEqual({
      kind: 'groups',
      groupCount: 2,
      groupSizes: [11, 10],
    })
  })

  it('thirty entrants becomes two groups of fifteen, never a twenty and a ten', () => {
    expect(selectCupFormat(30, FULL_SEASON)).toEqual({
      kind: 'groups',
      groupCount: 2,
      groupSizes: [15, 15],
    })
  })

  it('a hundred entrants becomes five full groups', () => {
    expect(selectCupFormat(100, FULL_SEASON)).toEqual({
      kind: 'groups',
      groupCount: 5,
      groupSizes: [20, 20, 20, 20, 20],
    })
  })
})

describe('a cup need not fill the season', () => {
  it('fourteen entrants leaves the playoff window to the calendar, not padding', () => {
    const decision = selectCupFormat(14, FULL_SEASON)
    expect(decision).toEqual({
      kind: 'single_group',
      meetings: 2,
      leagueRounds: 26,
      tail: { kind: 'seeded_playoff_window', rounds: 12 },
      leftoverRounds: 0,
    })
  })

  it('an odd field whose split cannot fit plays one meeting fewer instead', () => {
    // Thirteen at 38: three meetings needs 36 + a split of 7 = 43. The even
    // count needs no split.
    expect(selectCupFormat(13, FULL_SEASON)).toEqual({
      kind: 'single_group',
      meetings: 2,
      leagueRounds: 24,
      tail: { kind: 'seeded_playoff_window', rounds: 14 },
      leftoverRounds: 0,
    })
  })

  it('an uneven split puts the larger half first — thirteen becomes seven and six', () => {
    // Give thirteen the calendar its split needs: 36 league + 7 split.
    expect(selectCupFormat(13, 43)).toEqual({
      kind: 'single_group',
      meetings: 3,
      leagueRounds: 36,
      tail: { kind: 'split', topHalfSize: 7, bottomHalfSize: 6, splitRounds: 7 },
      leftoverRounds: 0,
    })
  })
})

describe('mid-season starts compress the format', () => {
  it('lowers the viable single-group ceiling', () => {
    // Eighteen remaining rounds: ten entrants exactly fit home and away.
    expect(selectCupFormat(10, 18)).toEqual({
      kind: 'single_group',
      meetings: 2,
      leagueRounds: 18,
      tail: { kind: 'none' },
      leftoverRounds: 0,
    })
    // Nine remaining: ten entrants can no longer meet twice — groups.
    expect(selectCupFormat(10, 9)).toEqual({
      kind: 'groups',
      groupCount: 2,
      groupSizes: [5, 5],
    })
  })

  it('refuses when no group shape can still play home and away', () => {
    expect(selectCupFormat(4, 2)).toEqual({ kind: 'refused', reason: 'insufficient_rounds' })
    expect(selectCupFormat(9, 7)).toEqual({ kind: 'refused', reason: 'insufficient_rounds' })
  })
})

describe('deterministic and coherent at every field size from 3 to 100', () => {
  it('always returns the same, internally consistent shape', () => {
    for (let fieldSize = 3; fieldSize <= 100; fieldSize += 1) {
      const first = selectCupFormat(fieldSize, FULL_SEASON)
      const second = selectCupFormat(fieldSize, FULL_SEASON)
      expect(second).toEqual(first)

      if (fieldSize === 3) {
        expect(first.kind).toBe('declined_head_to_head')
        continue
      }
      if (fieldSize <= CUP_GROUP_CAP) {
        expect(first.kind).toBe('single_group')
        const single = first as Extract<CupFormatDecision, { kind: 'single_group' }>
        expect(single.meetings).toBeGreaterThanOrEqual(2)
        expect(single.leagueRounds).toBe(single.meetings * (fieldSize - 1))
        continue
      }
      expect(first.kind).toBe('groups')
      const groups = first as Extract<CupFormatDecision, { kind: 'groups' }>
      expect(groups.groupSizes.reduce((sum, size) => sum + size, 0)).toBe(fieldSize)
      expect(Math.max(...groups.groupSizes)).toBeLessThanOrEqual(CUP_GROUP_CAP)
      expect(Math.max(...groups.groupSizes) - Math.min(...groups.groupSizes)).toBeLessThanOrEqual(1)
    }
  })
})

describe('contradictory data refuses', () => {
  it('refuses malformed inputs outright', () => {
    expect(selectCupFormat(1, FULL_SEASON)).toEqual({ kind: 'refused', reason: 'invalid_input' })
    expect(selectCupFormat(6.5, FULL_SEASON)).toEqual({ kind: 'refused', reason: 'invalid_input' })
    expect(selectCupFormat(6, 0)).toEqual({ kind: 'refused', reason: 'invalid_input' })
    expect(selectCupFormat(6, -3)).toEqual({ kind: 'refused', reason: 'invalid_input' })
  })
})

describe('authority separation', () => {
  const source = readFileSync(resolve(process.cwd(), 'src/domain/season/cupFormat.ts'), 'utf8')

  it('imports nothing from the tournament implementation', () => {
    expect(source).not.toMatch(/from '.*tournament/)
  })

  it('reads no ambient clock or zone', () => {
    expect(source).not.toMatch(/Date\.now|new Date\(|Intl\./)
  })
})
