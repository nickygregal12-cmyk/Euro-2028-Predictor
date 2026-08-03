import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import {
  resolveCardAtLock,
  type CardFixture,
} from '../../../src/domain/season/cardSubmission'

/**
 * ADR 0012 friction mitigations and rolling entry: the card pre-fills with a
 * default per fixture and stays provisional until confirmed; partial
 * submissions auto-complete at lock from those defaults; a matchweek the
 * player never engaged is unbanked, never auto-entered.
 */

function fixture(overrides: Partial<CardFixture> = {}): CardFixture {
  return {
    fixtureId: 'mw7-ARS-CHE',
    defaultPrediction: { home: 1, away: 1 },
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

describe('confirmed cards', () => {
  it('submits the player predictions as the player own choices', () => {
    const result = resolveCardAtLock(
      [
        fixture({ playerPrediction: { home: 2, away: 0 } }),
        fixture({ fixtureId: 'mw7-LIV-MCI', playerPrediction: { home: 0, away: 3 } }),
      ],
      'confirmed',
    )
    expect(result).toEqual({
      kind: 'submitted',
      predictions: [
        { fixtureId: 'mw7-ARS-CHE', prediction: { home: 2, away: 0 }, provenance: 'player' },
        { fixtureId: 'mw7-LIV-MCI', prediction: { home: 0, away: 3 }, provenance: 'player' },
      ],
      autoCompleted: false,
      confirmed: true,
    })
  })

  it('treats confirmed prefills as accepted by the player — the one-tap submit', () => {
    const result = resolveCardAtLock([fixture()], 'confirmed')
    expect(result).toEqual({
      kind: 'submitted',
      predictions: [
        { fixtureId: 'mw7-ARS-CHE', prediction: { home: 1, away: 1 }, provenance: 'player' },
      ],
      autoCompleted: false,
      confirmed: true,
    })
  })
})

describe('provisional cards auto-complete at lock', () => {
  it('fills every gap from the default and records which lock filled', () => {
    const result = resolveCardAtLock(
      [
        fixture({ playerPrediction: { home: 2, away: 1 } }),
        fixture({ fixtureId: 'mw7-LIV-MCI' }),
      ],
      'provisional',
    )
    expect(result).toEqual({
      kind: 'submitted',
      predictions: [
        { fixtureId: 'mw7-ARS-CHE', prediction: { home: 2, away: 1 }, provenance: 'player' },
        { fixtureId: 'mw7-LIV-MCI', prediction: { home: 1, away: 1 }, provenance: 'default' },
      ],
      autoCompleted: true,
      confirmed: false,
    })
  })

  it('submits a fully player-filled provisional card without auto-completion', () => {
    const result = resolveCardAtLock(
      [fixture({ playerPrediction: { home: 2, away: 1 } })],
      'provisional',
    )
    expect(result.kind === 'submitted' && result.autoCompleted).toBe(false)
    expect(result.kind === 'submitted' && result.confirmed).toBe(false)
  })
})

describe('contradictory data refuses outright', () => {
  it('refuses an engaged card with no fixtures', () => {
    expect(resolveCardAtLock([], 'provisional')).toEqual({
      kind: 'refused',
      reason: 'invalid_input',
    })
    expect(resolveCardAtLock([], 'confirmed')).toEqual({
      kind: 'refused',
      reason: 'invalid_input',
    })
  })

  it('refuses a missing or malformed default — every fixture must carry one', () => {
    expect(
      resolveCardAtLock([fixture({ defaultPrediction: { home: -1, away: 0 } })], 'provisional'),
    ).toEqual({ kind: 'refused', reason: 'invalid_input' })
    expect(
      resolveCardAtLock([fixture({ defaultPrediction: { home: 0.5, away: 0 } })], 'confirmed'),
    ).toEqual({ kind: 'refused', reason: 'invalid_input' })
  })

  it('refuses a malformed player prediction rather than replacing it', () => {
    expect(
      resolveCardAtLock([fixture({ playerPrediction: { home: 1, away: -2 } })], 'provisional'),
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

  it('awards no points and hard-codes no default scoreline value', () => {
    // The default's value is caller policy; this module owns only what
    // happens to it at lock.
    expect(source).not.toMatch(/scoreFixture|scoreMatchweek|SEASON_PREDICTOR_POINTS/)
  })
})
