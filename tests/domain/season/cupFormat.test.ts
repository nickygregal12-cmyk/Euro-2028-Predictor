import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import {
  CUP_GROUP_CAP,
  cupKnockoutRounds,
  cupQualifyingLimit,
  selectCupFormat,
  type CupFormatDecision,
} from '../../../src/domain/season/cupFormat'

/**
 * ADR 0014 format selection as amended by contract 198 (CUP-006): deterministic
 * from field size and remaining rounds, named shapes at N = 6, 8, 10, 12, 19 and
 * 20, a group-path assertion at N = 21, and every field size from 3 to at least
 * 100.
 *
 * Contract 198 changed two things these assertions carry. The old
 * `seeded_playoff_window` tail reported whatever rounds happened to be left
 * over, whether or not a bracket could finish in them; a knockout is now
 * RESERVED — it appears only when the calendar can hold all of it. And a
 * multi-group field always ends in a knockout, so the reservation is taken off
 * the calendar before the groups are sized, which makes the groups smaller.
 *
 * Every expectation below was checked against
 * `predictor_internal.select_season_cup_format` before being written here; the
 * two authorities are held together by `tests/database-parity/`.
 */

const FULL_SEASON = 38

describe('fields too small for a cup', () => {
  it('declines two and three and offers head-to-head instead', () => {
    expect(selectCupFormat(2, FULL_SEASON)).toEqual({ kind: 'declined_head_to_head' })
    expect(selectCupFormat(3, FULL_SEASON)).toEqual({ kind: 'declined_head_to_head' })
  })
})

describe('the six named single-group shapes on a 38-round season', () => {
  it('N=6: seven meetings, 35 league rounds, split of 3 — no room left for a knockout', () => {
    // 35 + 3 fills the season, so the four who would qualify have nowhere to
    // play and the table decides it.
    expect(selectCupFormat(6, FULL_SEASON)).toEqual({
      kind: 'single_group',
      meetings: 7,
      leagueRounds: 35,
      tail: { kind: 'split', topHalfSize: 3, bottomHalfSize: 3, splitRounds: 3 },
      knockout: null,
      leftoverRounds: 0,
    })
  })

  it('N=8: five meetings, 35 league rounds, split of 3', () => {
    expect(selectCupFormat(8, FULL_SEASON)).toEqual({
      kind: 'single_group',
      meetings: 5,
      leagueRounds: 35,
      tail: { kind: 'split', topHalfSize: 4, bottomHalfSize: 4, splitRounds: 3 },
      knockout: null,
      leftoverRounds: 0,
    })
  })

  it('N=10: four meetings, 36 league rounds, and two spare rounds a knockout cannot use', () => {
    // Seven of ten qualify, which needs a four-then-final bracket of three
    // rounds. Two are left. The league is never shortened to make room, so
    // there is no knockout and the two rounds stay unused.
    expect(selectCupFormat(10, FULL_SEASON)).toEqual({
      kind: 'single_group',
      meetings: 4,
      leagueRounds: 36,
      tail: { kind: 'none' },
      knockout: null,
      leftoverRounds: 2,
    })
  })

  it('N=12: three meetings, 33 league rounds, split of 5 — the Scottish shape emerges from arithmetic', () => {
    expect(selectCupFormat(12, FULL_SEASON)).toEqual({
      kind: 'single_group',
      meetings: 3,
      leagueRounds: 33,
      tail: { kind: 'split', topHalfSize: 6, bottomHalfSize: 6, splitRounds: 5 },
      knockout: null,
      leftoverRounds: 0,
    })
  })

  it('N=19: two meetings, 36 league rounds, two rounds short of its bracket', () => {
    // Thirteen qualify: a sixteen-slot bracket, four rounds, against two spare.
    expect(selectCupFormat(19, FULL_SEASON)).toEqual({
      kind: 'single_group',
      meetings: 2,
      leagueRounds: 36,
      tail: { kind: 'none' },
      knockout: null,
      leftoverRounds: 2,
    })
  })

  it('N=20: two meetings fill the season exactly with no tail — the cap size', () => {
    expect(selectCupFormat(20, FULL_SEASON)).toEqual({
      kind: 'single_group',
      meetings: 2,
      leagueRounds: 38,
      tail: { kind: 'none' },
      knockout: null,
      leftoverRounds: 0,
    })
  })
})

describe('above the cap: balanced groups always reserve their knockout', () => {
  it('N=21 takes the group path: two balanced groups, never twenty and one', () => {
    // Eleven and ten send fifteen on, which needs a preliminary round plus a
    // three-round bracket: four reserved off a 38-round calendar.
    expect(selectCupFormat(21, FULL_SEASON)).toEqual({
      kind: 'groups',
      groupCount: 2,
      groupSizes: [11, 10],
      knockout: { rounds: 4, qualifiers: 15 },
    })
  })

  it('thirty entrants becomes two groups of fifteen, never a twenty and a ten', () => {
    expect(selectCupFormat(30, FULL_SEASON)).toEqual({
      kind: 'groups',
      groupCount: 2,
      groupSizes: [15, 15],
      knockout: { rounds: 5, qualifiers: 20 },
    })
  })

  it('a hundred entrants no longer fills five groups of twenty — the knockout takes its rounds first', () => {
    // Five twenties would send seventy on, and seventy needs seven knockout
    // rounds. Seven off 38 leaves 31, which caps a group at 16, so the field
    // settles at seven groups — still seventy qualifiers, still seven rounds.
    expect(selectCupFormat(100, FULL_SEASON)).toEqual({
      kind: 'groups',
      groupCount: 7,
      groupSizes: [15, 15, 14, 14, 14, 14, 14],
      knockout: { rounds: 7, qualifiers: 70 },
    })
  })
})

describe('a cup need not fill the season', () => {
  it('fourteen entrants reserve a four-round knockout and leave the rest unused', () => {
    expect(selectCupFormat(14, FULL_SEASON)).toEqual({
      kind: 'single_group',
      meetings: 2,
      leagueRounds: 26,
      tail: { kind: 'none' },
      knockout: { rounds: 4, qualifiers: 10 },
      leftoverRounds: 8,
    })
  })

  it('an odd field whose split cannot fit plays one meeting fewer instead', () => {
    // Thirteen at 38: three meetings needs 36 + a split of 7 = 43. The even
    // count needs no split, and the 14 rounds it frees hold the bracket the
    // nine qualifiers imply with ten to spare.
    expect(selectCupFormat(13, FULL_SEASON)).toEqual({
      kind: 'single_group',
      meetings: 2,
      leagueRounds: 24,
      tail: { kind: 'none' },
      knockout: { rounds: 4, qualifiers: 9 },
      leftoverRounds: 10,
    })
  })

  it('an uneven split puts the larger half first — thirteen becomes seven and six', () => {
    // Give thirteen the calendar its split needs: 36 league + 7 split. That is
    // the whole 43, so the same nine qualifiers get no knockout here.
    expect(selectCupFormat(13, 43)).toEqual({
      kind: 'single_group',
      meetings: 3,
      leagueRounds: 36,
      tail: { kind: 'split', topHalfSize: 7, bottomHalfSize: 6, splitRounds: 7 },
      knockout: null,
      leftoverRounds: 0,
    })
  })
})

describe('mid-season starts compress the format', () => {
  it('lowers the viable single-group ceiling', () => {
    // Eighteen remaining rounds: ten entrants exactly fit home and away, and
    // nothing is left for a knockout.
    expect(selectCupFormat(10, 18)).toEqual({
      kind: 'single_group',
      meetings: 2,
      leagueRounds: 18,
      tail: { kind: 'none' },
      knockout: null,
      leftoverRounds: 0,
    })
  })

  it('refuses a field that would need a knockout it cannot finish', () => {
    // CONTRACT 198. Ten entrants over nine rounds can no longer meet twice in
    // one group, and two groups of five send eight on — three knockout rounds
    // that leave six, which caps a group at four and strands the odd entrants.
    // Before contract 198 this launched two groups of five and simply had
    // nowhere to play the knockout out.
    expect(selectCupFormat(10, 9)).toEqual({ kind: 'refused', reason: 'insufficient_rounds' })
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
        // CONTRACT 198. Every round is accounted for, and a reserved knockout
        // is exactly as deep as its qualifier count needs.
        const splitRounds = single.tail.kind === 'split' ? single.tail.splitRounds : 0
        expect(
          single.leagueRounds + splitRounds + (single.knockout?.rounds ?? 0) + single.leftoverRounds,
        ).toBe(FULL_SEASON)
        if (single.knockout !== null) {
          expect(single.knockout.qualifiers).toBe(cupQualifyingLimit(fieldSize))
          expect(single.knockout.rounds).toBe(cupKnockoutRounds(single.knockout.qualifiers))
        }
        continue
      }
      expect(first.kind).toBe('groups')
      const groups = first as Extract<CupFormatDecision, { kind: 'groups' }>
      expect(groups.groupSizes.reduce((sum, size) => sum + size, 0)).toBe(fieldSize)
      expect(Math.max(...groups.groupSizes)).toBeLessThanOrEqual(CUP_GROUP_CAP)
      expect(Math.max(...groups.groupSizes) - Math.min(...groups.groupSizes)).toBeLessThanOrEqual(1)
      // CONTRACT 198. The knockout is reserved, so the largest group's two
      // meetings AND the whole bracket fit inside the remaining calendar.
      const largestGroup = Math.max(...groups.groupSizes)
      expect(2 * (largestGroup - 1) + groups.knockout.rounds).toBeLessThanOrEqual(FULL_SEASON)
      expect(groups.knockout.qualifiers).toBe(
        groups.groupSizes.reduce((total, size) => total + cupQualifyingLimit(size), 0),
      )
      expect(groups.knockout.rounds).toBe(cupKnockoutRounds(groups.knockout.qualifiers))
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

  it('no longer offers the unreserved playoff window contract 198 replaced', () => {
    expect(source).not.toMatch(/seeded_playoff_window'/)
  })
})
