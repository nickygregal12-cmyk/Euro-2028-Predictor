import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import {
  CUP_GROUP_CAP,
  CUP_MINIMUM_FIELD,
  cupKnockoutRounds,
  cupQualifyingLimit,
  selectCupFormat,
} from '../../src/domain/season/cupFormat'

/**
 * Contract 198 — `CUP-006`, the knockout a Championship reserves.
 *
 * WHAT THIS SUITE EXISTS FOR is that the rule now lives in TWO authorities that
 * must not drift: `predictor_internal.select_season_cup_format` and this
 * module's `selectCupFormat`. They were swept over the same 5,229 cases
 * (field −2..60 × rounds −2..80) with **0 mismatches** while contract 198 was
 * written. The distribution below is what that sweep produced, and it is
 * asserted here so a change to either side that alters the shape shows up as a
 * count that no longer matches.
 *
 * The behavioural half — that a format the launcher ACCEPTS can always be
 * finished inside its own calendar — is driven against a real database in
 * `246_cup_knockout_reservation.sql`, and both halves of the reservation were
 * mutation-tested there.
 */

const migration = readFileSync(
  resolve(process.cwd(), 'supabase/migrations/20260818030000_cup_knockout_reservation.sql'),
  'utf8',
)

/** Comments describe; only code enforces. */
const code = migration
  .split('\n')
  .filter((line) => !line.trim().startsWith('--'))
  .join('\n')

function sweep() {
  const counts = new Map<string, number>()
  for (let field = -2; field <= 60; field += 1) {
    for (let rounds = -2; rounds <= 80; rounds += 1) {
      const decision = selectCupFormat(field, rounds)
      let key: string = decision.kind
      if (decision.kind === 'single_group') {
        key = `single_group/${decision.tail.kind}/${decision.knockout ? 'knockout' : 'no-knockout'}`
      } else if (decision.kind === 'refused') {
        key = `refused/${decision.reason}`
      }
      counts.set(key, (counts.get(key) ?? 0) + 1)
    }
  }
  return counts
}

describe('the two authorities agree on the shape', () => {
  it('reproduces the distribution the SQL sweep produced', () => {
    // Measured on the database while writing contract 198, with 0 mismatches
    // case-for-case against these same inputs.
    expect(Object.fromEntries([...sweep()].sort())).toEqual({
      declined_head_to_head: 160,
      groups: 2907,
      'refused/insufficient_rounds': 650,
      'refused/invalid_input': 509,
      'single_group/none/knockout': 590,
      'single_group/none/no-knockout': 208,
      'single_group/split/knockout': 50,
      'single_group/split/no-knockout': 155,
    })
  })

  it('moved exactly the group cases the calendar cannot hold', () => {
    // Before contract 198 the same sweep gave groups 3180 and
    // refused/insufficient_rounds 377. Reserving moved 273 from one to the
    // other and left `single_group` untouched at 1003 — so the change bit only
    // where a bracket could never have fitted.
    const counts = sweep()
    expect((counts.get('groups') ?? 0) + 273).toBe(3180)
    expect((counts.get('refused/insufficient_rounds') ?? 0) - 273).toBe(377)
    const singleGroup = [...counts]
      .filter(([key]) => key.startsWith('single_group/'))
      .reduce((total, [, count]) => total + count, 0)
    expect(singleGroup).toBe(1003)
  })
})

describe('a single group is a league, and its league is never shortened', () => {
  it('adds a knockout only when the rounds left after the league can hold one', () => {
    // Ten over thirty-eight: seven qualifiers need three rounds and two remain.
    const ten = selectCupFormat(10, 38)
    expect(ten).toMatchObject({ kind: 'single_group', leagueRounds: 36, knockout: null })
    // Eighteen over thirty-eight: twelve qualifiers need four and four remain.
    expect(selectCupFormat(18, 38)).toMatchObject({
      leagueRounds: 34,
      knockout: { rounds: 4, qualifiers: 12 },
    })
  })

  it('never spends more calendar than it was given', () => {
    for (let field = CUP_MINIMUM_FIELD; field <= CUP_GROUP_CAP; field += 1) {
      for (let rounds = 1; rounds <= 80; rounds += 1) {
        const decision = selectCupFormat(field, rounds)
        if (decision.kind !== 'single_group') continue
        const split = decision.tail.kind === 'split' ? decision.tail.splitRounds : 0
        expect(
          decision.leagueRounds + split + (decision.knockout?.rounds ?? 0) + decision.leftoverRounds,
        ).toBe(rounds)
      }
    }
  })
})

describe('a multi-group field always reserves, because it cannot be one league', () => {
  it('reserves for every groups decision', () => {
    for (let field = CUP_GROUP_CAP + 1; field <= 60; field += 1) {
      for (let rounds = 1; rounds <= 80; rounds += 1) {
        const decision = selectCupFormat(field, rounds)
        if (decision.kind !== 'groups') continue
        expect(decision.knockout.rounds).toBeGreaterThanOrEqual(
          cupKnockoutRounds(decision.knockout.qualifiers),
        )
      }
    }
  })

  it('shrinks the groups to make the reservation fit', () => {
    // Three groups of twenty before contract 198; the bracket for forty-two
    // qualifiers did not fit, so the groups came down.
    expect(selectCupFormat(60, 38)).toMatchObject({
      groupCount: 4,
      groupSizes: [15, 15, 15, 15],
      knockout: { rounds: 6, qualifiers: 40 },
    })
  })
})

describe('one authority for bracket depth', () => {
  it('is extracted rather than restated, and qualification reads it', () => {
    expect(code).toContain('create or replace function predictor_internal.cup_knockout_rounds(')
    expect(code).toContain('v_needed := predictor_internal.cup_knockout_rounds(v_q);')
    // Patched in place, because that function has been rewritten in place three
    // times and none of it lives in a migration file.
    expect(code).toContain(
      "pg_get_functiondef(\n    'public.admin_finalise_predictor_cup_groups(uuid)'::regprocedure\n  )",
    )
    expect(migration).not.toContain(
      'CREATE OR REPLACE FUNCTION public.admin_finalise_predictor_cup_groups',
    )
  })

  it('keeps the earlier in-place patches on that function', () => {
    for (const guard of [
      'lost contract 102 split-safety',
      'lost contract 102 initial-roster pinning',
      'lost contract 187 window creation',
      'lost contract 196 outcome dating',
    ]) {
      expect(code).toContain(guard)
    }
  })

  it('agrees with the arithmetic it was extracted from', () => {
    // The same check the migration runs at apply time, over the same range.
    for (let q = 1; q <= 300; q += 1) {
      let power = 1
      while (power * 2 <= q) power *= 2
      const expected = Math.log2(power) + (q - power > 0 ? 1 : 0)
      expect(cupKnockoutRounds(q)).toBe(expected)
    }
  })

  it('mirrors the two-thirds qualifying line', () => {
    expect(cupQualifyingLimit(20)).toBe(14)
    expect(cupQualifyingLimit(10)).toBe(7)
    expect(cupQualifyingLimit(4)).toBe(3)
  })
})

describe('ADR 0014’s bounds are untouched', () => {
  it('keeps the minimum field, the cap and the balancing split', () => {
    expect(selectCupFormat(3, 38)).toEqual({ kind: 'declined_head_to_head' })
    expect(selectCupFormat(20, 38).kind).toBe('single_group')
    expect(selectCupFormat(21, 38).kind).toBe('groups')
    expect(selectCupFormat(8, 38)).toMatchObject({ tail: { kind: 'split' } })
  })

  it('no longer reports a window it cannot afford', () => {
    expect(code).not.toContain('seeded_playoff_window')
  })
})
