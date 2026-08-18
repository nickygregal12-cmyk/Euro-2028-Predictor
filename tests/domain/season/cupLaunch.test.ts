import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import {
  PUBLIC_CUP_ENTRANT_THRESHOLD,
  resolvePublicCupLaunch,
} from '../../../src/domain/season/cupLaunch'
import { CUP_GROUP_CAP, selectCupFormat } from '../../../src/domain/season/cupFormat'

/**
 * ADR 0022: the first public Cup opens at 100 entrants, with no time-based
 * fallback. A launch rule, not a format rule.
 */

describe('the entrant threshold', () => {
  it('is 100', () => {
    expect(PUBLIC_CUP_ENTRANT_THRESHOLD).toBe(100)
  })

  it('opens at exactly the threshold and above', () => {
    expect(resolvePublicCupLaunch({ entrants: 100, publicCupRunning: false })).toEqual({
      open: true,
      entrants: 100,
    })
    expect(resolvePublicCupLaunch({ entrants: 240, publicCupRunning: false })).toEqual({
      open: true,
      entrants: 240,
    })
  })

  it('stays shut below it and reports the shortfall', () => {
    expect(resolvePublicCupLaunch({ entrants: 99, publicCupRunning: false })).toEqual({
      open: false,
      entrants: 99,
      shortfall: 1,
      reason: 'below_threshold',
    })
    expect(resolvePublicCupLaunch({ entrants: 0, publicCupRunning: false })).toEqual({
      open: false,
      entrants: 0,
      shortfall: 100,
      reason: 'below_threshold',
    })
  })

  it('has no time-based fallback — a thin season simply never opens one', () => {
    // The input carries no date, matchweek or clock of any kind: there is
    // nothing a caller could pass that opens the gate below the threshold.
    expect(resolvePublicCupLaunch({ entrants: 99, publicCupRunning: false }).open).toBe(false)
  })
})

describe('one public Cup at a time', () => {
  it('refuses while a public Cup is already running, however large the queue', () => {
    expect(resolvePublicCupLaunch({ entrants: 500, publicCupRunning: true })).toEqual({
      open: false,
      entrants: 500,
      shortfall: 0,
      reason: 'already_running',
    })
  })
})

describe('the threshold is chosen against the format arithmetic', () => {
  it('produces seven balanced groups and a finishable knockout for a field of exactly 100', () => {
    // CONTRACT 198. The threshold used to land on five groups at the cap. The
    // knockout is now reserved before the groups are sized: seventy qualifiers
    // need seven rounds, seven off 38 leaves 31, and 31 caps a group at 16 —
    // so the same field settles at seven groups of fifteen and fourteen. The
    // cap still binds; the calendar simply binds first.
    expect(selectCupFormat(PUBLIC_CUP_ENTRANT_THRESHOLD, 38)).toEqual({
      kind: 'groups',
      groupCount: 7,
      groupSizes: [15, 15, 14, 14, 14, 14, 14],
      knockout: { rounds: 7, qualifiers: 70 },
    })
    const decision = selectCupFormat(PUBLIC_CUP_ENTRANT_THRESHOLD, 38)
    expect(decision.kind === 'groups' && Math.max(...decision.groupSizes)).toBeLessThanOrEqual(
      CUP_GROUP_CAP,
    )
  })

  it('is a launch rule, not a format rule — structure still follows the real field', () => {
    // A larger field that clears the gate gets its own shape from the
    // selector, not the threshold's.
    const larger = selectCupFormat(140, 38)
    expect(larger.kind).toBe('groups')
    expect(larger.kind === 'groups' && larger.groupCount).toBe(9)
  })
})

describe('contradictory data refuses', () => {
  it('refuses a malformed entrant count', () => {
    expect(resolvePublicCupLaunch({ entrants: -1, publicCupRunning: false })).toMatchObject({
      open: false,
      reason: 'invalid_input',
    })
    expect(resolvePublicCupLaunch({ entrants: 12.5, publicCupRunning: false })).toMatchObject({
      open: false,
      reason: 'invalid_input',
    })
  })
})

describe('authority separation', () => {
  const source = readFileSync(resolve(process.cwd(), 'src/domain/season/cupLaunch.ts'), 'utf8')

  it('imports nothing from the tournament implementation', () => {
    expect(source).not.toMatch(/from '.*tournament/)
  })

  it('reads no clock — the gate is a count, not a date', () => {
    expect(source).not.toMatch(/Date\.now|new Date\(|Intl\./)
  })
})
