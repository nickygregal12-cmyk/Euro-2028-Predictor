import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import {
  resolveCardAtLock,
  type CardFixture,
} from '../../../src/domain/season/cardSubmission'

/**
 * ADR 0012 as amended 4 August 2026, and rolling entry.
 *
 * THE CARD IS NOT PRE-FILLED. A fixture the player left blank is submitted as
 * no prediction and scores nothing. The ADR originally required a default on
 * every fixture and auto-completion at lock; both were withdrawn, because a
 * player must not benefit from not filling something in — a default that can
 * score is a free entry into every fixture a player ignored, and the benefit
 * grows the less the player engages.
 *
 * A matchweek the player never engaged at all is unbanked, never auto-entered.
 * Absence and an empty card stay different facts.
 */

function fixture(overrides: Partial<CardFixture> = {}): CardFixture {
  return {
    fixtureId: 'mw7-ARS-CHE',
    playerPrediction: null,
    ...overrides,
  }
}

describe('rolling entry — an untouched matchweek is unbanked', () => {
  it('never invents a submission for a player who did not engage', () => {
    expect(resolveCardAtLock([fixture()], 'no_submission')).toEqual({ kind: 'unbanked' })
    // Even an empty card: unbanked is about the player, not the fixtures.
    expect(resolveCardAtLock([], 'no_submission')).toEqual({ kind: 'unbanked' })
  })
})

describe('a blank fixture earns nothing, and is not filled in', () => {
  it('submits no prediction for it', () => {
    // The submission is empty, not a card of zeroes. Scoring awards points for
    // what is in this list, so a fixture absent from it cannot earn anything.
    expect(resolveCardAtLock([fixture()], 'provisional')).toEqual({
      kind: 'submitted',
      predictions: [],
      confirmed: false,
    })
  })

  it('submits the filled fixtures of a partial card, and only those', () => {
    expect(
      resolveCardAtLock(
        [
          fixture({ playerPrediction: { home: 2, away: 0 } }),
          fixture({ fixtureId: 'mw7-LIV-MCI' }),
          fixture({ fixtureId: 'mw7-TOT-EVE', playerPrediction: { home: 1, away: 1 } }),
        ],
        'provisional',
      ),
    ).toEqual({
      kind: 'submitted',
      predictions: [
        { fixtureId: 'mw7-ARS-CHE', prediction: { home: 2, away: 0 } },
        { fixtureId: 'mw7-TOT-EVE', prediction: { home: 1, away: 1 } },
      ],
      confirmed: false,
    })
  })

  it('is not a refusal — silence is the expected case, not an error', () => {
    // Refusing would make a blank something somebody has to resolve. The rule
    // is simply that a blank scores nothing.
    for (const status of ['provisional', 'confirmed'] as const) {
      expect(resolveCardAtLock([fixture()], status).kind).toBe('submitted')
    }
  })
})

describe('confirmation records intent, and changes no scoring', () => {
  const fixtures = [
    fixture({ playerPrediction: { home: 2, away: 0 } }),
    fixture({ fixtureId: 'mw7-LIV-MCI' }),
  ]

  it('submits exactly the same predictions either way', () => {
    // With nothing pre-filled there is nothing for confirmation to adopt, so
    // the two statuses differ only in what they record about the player.
    expect(resolveCardAtLock(fixtures, 'confirmed')).toEqual({
      ...resolveCardAtLock(fixtures, 'provisional'),
      confirmed: true,
    })
  })

  it('still reports which it was', () => {
    expect(resolveCardAtLock(fixtures, 'confirmed')).toMatchObject({ confirmed: true })
    expect(resolveCardAtLock(fixtures, 'provisional')).toMatchObject({ confirmed: false })
  })
})

describe('contradictory cards refuse rather than guess', () => {
  it('refuses an engaged card with no fixtures at all', () => {
    // Not the same as a blank card: this is a matchweek with nothing in it,
    // which is contradictory data rather than a player choosing to skip.
    for (const status of ['provisional', 'confirmed'] as const) {
      expect(resolveCardAtLock([], status)).toEqual({
        kind: 'refused',
        reason: 'invalid_input',
      })
    }
  })

  it('refuses a malformed player prediction rather than replacing it', () => {
    expect(
      resolveCardAtLock([fixture({ playerPrediction: { home: 1, away: -2 } })], 'provisional'),
    ).toEqual({ kind: 'refused', reason: 'invalid_input' })
    expect(
      resolveCardAtLock([fixture({ playerPrediction: { home: 0.5, away: 0 } })], 'confirmed'),
    ).toEqual({ kind: 'refused', reason: 'invalid_input' })
  })

  it('refuses duplicate and blank fixture ids', () => {
    expect(resolveCardAtLock([fixture(), fixture()], 'provisional')).toEqual({
      kind: 'refused',
      reason: 'duplicate_fixture',
    })
    expect(resolveCardAtLock([fixture({ fixtureId: '  ' })], 'provisional')).toEqual({
      kind: 'refused',
      reason: 'invalid_input',
    })
  })
})

describe('authority separation', () => {
  const source = readFileSync(
    resolve(process.cwd(), 'src/domain/season/cardSubmission.ts'),
    'utf8',
  )

  it('imports nothing from the tournament implementation', () => {
    expect(source).not.toMatch(/from '.*tournament/)
  })

  it('reads no ambient clock or zone — the lock instant is the caller event', () => {
    expect(source).not.toMatch(/Date\.now|new Date\(|Intl\./)
  })

  it('awards no points', () => {
    expect(source).not.toMatch(/scoreFixture|scoreMatchweek|SEASON_PREDICTOR_POINTS/)
  })

  it('has no concept of a default prediction left to hard-code', () => {
    // The strongest form of the withdrawal: not "the default is caller policy"
    // but "there is no default". If the word returns, so has the rule.
    expect(source.replace(/\/\*[\s\S]*?\*\/|\/\/[^\n]*/g, '')).not.toMatch(/[Dd]efaultPrediction/)
  })
})
