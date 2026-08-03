import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import {
  settleCupTie,
  type CupTieEntrantPoints,
  type CupTieFixture,
} from '../../../src/domain/season/cupTieSettlement'

/**
 * ADR 0014 tie settlement: head-to-head 3/1/0 on raw prediction points
 * through a neutral contract, the cutoff settling on the same confirmed
 * fixture set for both entrants, and the required reduced-set label facts.
 */

function card(confirmed: number, unconfirmed = 0): CupTieFixture[] {
  return [
    ...Array.from({ length: confirmed }, (_, index) => ({
      fixtureId: `f${index + 1}`,
      confirmedByCutoff: true,
    })),
    ...Array.from({ length: unconfirmed }, (_, index) => ({
      fixtureId: `p${index + 1}`,
      confirmedByCutoff: false,
    })),
  ]
}

function entrant(entryId: string, points: readonly number[]): CupTieEntrantPoints {
  return {
    entryId,
    fixturePoints: Object.fromEntries(points.map((value, index) => [`f${index + 1}`, value])),
  }
}

describe('head-to-head settlement at 3/1/0', () => {
  it('scores a win, a loss and the totals from raw fixture points', () => {
    const result = settleCupTie(card(3), entrant('amara', [5, 3, 0]), entrant('dave', [3, 0, 0]))
    expect(result).toEqual({
      ok: true,
      settlement: {
        result: 'home_win',
        home: { entryId: 'amara', points: 8, matchPoints: 3 },
        away: { entryId: 'dave', points: 3, matchPoints: 0 },
        settledOnFixtures: 3,
        fixtureCardSize: 3,
        reducedSet: false,
      },
    })
  })

  it('a drawn group tie is an ordinary one point each', () => {
    const result = settleCupTie(card(2), entrant('amara', [5, 0]), entrant('dave', [0, 5]))
    expect(result.ok && result.settlement.result).toBe('draw')
    expect(result.ok && result.settlement.home.matchPoints).toBe(1)
    expect(result.ok && result.settlement.away.matchPoints).toBe(1)
  })

  it('an away win awards three to the away entrant', () => {
    const result = settleCupTie(card(1), entrant('amara', [0]), entrant('dave', [5]))
    expect(result.ok && result.settlement.result).toBe('away_win')
    expect(result.ok && result.settlement.away.matchPoints).toBe(3)
  })
})

describe('the settlement cutoff and the reduced-set label', () => {
  it('settles on confirmed fixtures only and carries the settled-on facts', () => {
    // Nine of ten confirmed: the tie settles and must say so.
    const result = settleCupTie(
      card(9, 1),
      entrant('amara', [5, 3, 0, 3, 3, 0, 5, 0, 3]),
      entrant('dave', [3, 3, 3, 3, 3, 3, 3, 3, 3]),
    )
    expect(result.ok && result.settlement.settledOnFixtures).toBe(9)
    expect(result.ok && result.settlement.fixtureCardSize).toBe(10)
    expect(result.ok && result.settlement.reducedSet).toBe(true)
  })

  it('a full card is not labelled reduced', () => {
    const result = settleCupTie(card(2), entrant('amara', [3, 3]), entrant('dave', [0, 0]))
    expect(result.ok && result.settlement.reducedSet).toBe(false)
  })

  it('refuses a tie with nothing settled rather than inventing a goalless draw', () => {
    expect(settleCupTie(card(0, 10), entrant('amara', []), entrant('dave', []))).toEqual({
      ok: false,
      reason: 'no_settled_fixtures',
    })
  })
})

describe('the neutral points contract fails closed', () => {
  it('rejects a value only a Joker could have produced — Jokers never apply', () => {
    expect(settleCupTie(card(2), entrant('amara', [10, 3]), entrant('dave', [0, 0]))).toEqual({
      ok: false,
      reason: 'points_off_raw_scale',
    })
    expect(settleCupTie(card(1), entrant('amara', [6]), entrant('dave', [0]))).toEqual({
      ok: false,
      reason: 'points_off_raw_scale',
    })
  })

  it('refuses points missing for a confirmed fixture', () => {
    expect(settleCupTie(card(2), entrant('amara', [5]), entrant('dave', [3, 3]))).toEqual({
      ok: false,
      reason: 'points_missing_for_confirmed_fixture',
    })
  })

  it('refuses points recorded against a fixture the cutoff excluded', () => {
    const offCutoff: CupTieEntrantPoints = {
      entryId: 'amara',
      fixturePoints: { f1: 3, p1: 5 },
    }
    expect(settleCupTie(card(1, 1), offCutoff, entrant('dave', [3]))).toEqual({
      ok: false,
      reason: 'points_for_unconfirmed_fixture',
    })
  })

  it('refuses points for a fixture not on the card at all', () => {
    const strayFixture: CupTieEntrantPoints = {
      entryId: 'amara',
      fixturePoints: { f1: 3, f99: 5 },
    }
    expect(settleCupTie(card(1), strayFixture, entrant('dave', [3]))).toEqual({
      ok: false,
      reason: 'invalid_input',
    })
  })

  it('refuses malformed cards and entrants', () => {
    expect(settleCupTie([], entrant('amara', []), entrant('dave', []))).toEqual({
      ok: false,
      reason: 'invalid_input',
    })
    expect(
      settleCupTie(
        [
          { fixtureId: 'f1', confirmedByCutoff: true },
          { fixtureId: 'f1', confirmedByCutoff: true },
        ],
        entrant('amara', [3]),
        entrant('dave', [3]),
      ),
    ).toEqual({ ok: false, reason: 'duplicate_fixture' })
    expect(settleCupTie(card(1), entrant('amara', [3]), entrant('amara', [3]))).toEqual({
      ok: false,
      reason: 'same_entrant_twice',
    })
    expect(settleCupTie(card(1), entrant('  ', [3]), entrant('dave', [3]))).toEqual({
      ok: false,
      reason: 'invalid_input',
    })
  })
})

describe('authority separation', () => {
  const source = readFileSync(
    resolve(process.cwd(), 'src/domain/season/cupTieSettlement.ts'),
    'utf8',
  )

  it('imports nothing from the tournament implementation', () => {
    expect(source).not.toMatch(/from '.*tournament/)
  })

  it('computes no prediction score of its own — the points source is a contract', () => {
    expect(source).not.toMatch(/scoreFixture|scoreMatchweek|from '\.\/scoring'/)
  })

  it('reads no ambient clock or zone — the cutoff is applied upstream', () => {
    expect(source).not.toMatch(/Date\.now|new Date\(|Intl\./)
  })
})
