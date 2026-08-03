import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import {
  resolveMatchweekSettlement,
  type SettlementFixture,
} from '../../../src/domain/season/matchweekSettlement'

/**
 * ADR 0012 reschedules and exceptions, as amended by ADR 0020: three distinct
 * states, never collapsed. Postponement movement belongs to
 * `fixtureReassignment.ts`; this suite covers what remains on the card —
 * completed, abandoned and void — and when a matchweek may settle.
 */

function fixture(overrides: Partial<SettlementFixture> = {}): SettlementFixture {
  return {
    id: 'mw7-ARS-CHE',
    state: 'completed',
    score: { home: 2, away: 1 },
    replayFixtureId: null,
    ...overrides,
  }
}

describe('an ordinary card settles', () => {
  it('declares every completed fixture scoreable with its final score', () => {
    const result = resolveMatchweekSettlement([
      fixture(),
      fixture({ id: 'mw7-LIV-MCI', score: { home: 0, away: 0 } }),
    ])
    expect(result).toEqual({
      ok: true,
      settlement: {
        fixtures: [
          { fixtureId: 'mw7-ARS-CHE', disposition: { kind: 'scoreable', finalScore: { home: 2, away: 1 } } },
          { fixtureId: 'mw7-LIV-MCI', disposition: { kind: 'scoreable', finalScore: { home: 0, away: 0 } } },
        ],
        matchesPlayedDenominator: 2,
        predictionCarries: [],
        settled: true,
      },
    })
  })

  it('does not settle while any fixture still awaits a result', () => {
    const result = resolveMatchweekSettlement([
      fixture(),
      fixture({ id: 'mw7-LIV-MCI', state: 'scheduled', score: null }),
    ])
    expect(result.ok && result.settlement.settled).toBe(false)
    expect(result.ok && result.settlement.matchesPlayedDenominator).toBe(2)
  })

  it('settles an empty card — a round emptied by reassignment has nothing left to wait for', () => {
    expect(resolveMatchweekSettlement([])).toEqual({
      ok: true,
      settlement: { fixtures: [], matchesPlayedDenominator: 0, predictionCarries: [], settled: true },
    })
  })
})

describe('abandoned — the partial score does not stand', () => {
  it('never declares an abandoned fixture scoreable, whatever score it was abandoned at', () => {
    const result = resolveMatchweekSettlement([
      fixture({ state: 'abandoned', score: { home: 3, away: 0 } }),
    ])
    expect(result.ok && result.settlement.fixtures[0].disposition).toEqual({
      kind: 'awaiting_replay',
    })
  })

  it('blocks settlement until the replay fixture exists', () => {
    const result = resolveMatchweekSettlement([
      fixture({ state: 'abandoned', score: { home: 1, away: 0 } }),
    ])
    expect(result.ok && result.settlement.settled).toBe(false)
  })

  it('carries the prediction to the replay in full and hands the slot over', () => {
    const result = resolveMatchweekSettlement([
      fixture({ state: 'abandoned', score: { home: 1, away: 0 }, replayFixtureId: 'mw25-ARS-CHE-replay' }),
      fixture({ id: 'mw7-LIV-MCI' }),
    ])
    expect(result).toEqual({
      ok: true,
      settlement: {
        fixtures: [
          {
            fixtureId: 'mw7-ARS-CHE',
            disposition: { kind: 'carried_to_replay', replayFixtureId: 'mw25-ARS-CHE-replay' },
          },
          { fixtureId: 'mw7-LIV-MCI', disposition: { kind: 'scoreable', finalScore: { home: 2, away: 1 } } },
        ],
        // The replay counts wherever it is played; counting the abandoned
        // slot too would count one match twice.
        matchesPlayedDenominator: 1,
        predictionCarries: [{ fromFixtureId: 'mw7-ARS-CHE', toFixtureId: 'mw25-ARS-CHE-replay' }],
        settled: true,
      },
    })
  })
})

describe('void — no points to anyone', () => {
  it('leaves the matches-played denominator and never blocks settlement', () => {
    const result = resolveMatchweekSettlement([
      fixture(),
      fixture({ id: 'mw7-EVE-BUR', state: 'void', score: null }),
    ])
    expect(result.ok && result.settlement).toEqual({
      fixtures: [
        { fixtureId: 'mw7-ARS-CHE', disposition: { kind: 'scoreable', finalScore: { home: 2, away: 1 } } },
        { fixtureId: 'mw7-EVE-BUR', disposition: { kind: 'void_no_points' } },
      ],
      matchesPlayedDenominator: 1,
      predictionCarries: [],
      settled: true,
    })
  })
})

describe('contradictory data refuses the whole card', () => {
  it('refuses a completed fixture without a valid final score', () => {
    expect(resolveMatchweekSettlement([fixture({ score: null })])).toEqual({
      ok: false,
      reason: 'completed_without_result',
    })
    expect(resolveMatchweekSettlement([fixture({ score: { home: -1, away: 2 } })])).toEqual({
      ok: false,
      reason: 'completed_without_result',
    })
    expect(resolveMatchweekSettlement([fixture({ score: { home: 1.5, away: 0 } })])).toEqual({
      ok: false,
      reason: 'completed_without_result',
    })
  })

  it('refuses a score on a fixture that never started or will never be played', () => {
    expect(
      resolveMatchweekSettlement([fixture({ state: 'scheduled', score: { home: 1, away: 0 } })]),
    ).toEqual({ ok: false, reason: 'score_on_unplayed_fixture' })
    expect(
      resolveMatchweekSettlement([fixture({ state: 'void', score: { home: 0, away: 0 } })]),
    ).toEqual({ ok: false, reason: 'score_on_unplayed_fixture' })
  })

  it('refuses a replay reference on anything but an abandoned fixture', () => {
    expect(
      resolveMatchweekSettlement([fixture({ replayFixtureId: 'mw25-ARS-CHE-replay' })]),
    ).toEqual({ ok: false, reason: 'replay_on_non_abandoned_fixture' })
  })

  it('refuses a replay that references the fixture itself, or blank identifiers', () => {
    expect(
      resolveMatchweekSettlement([
        fixture({ state: 'abandoned', score: null, replayFixtureId: 'mw7-ARS-CHE' }),
      ]),
    ).toEqual({ ok: false, reason: 'replay_self_reference' })
    expect(
      resolveMatchweekSettlement([
        fixture({ state: 'abandoned', score: null, replayFixtureId: '  ' }),
      ]),
    ).toEqual({ ok: false, reason: 'invalid_input' })
    expect(resolveMatchweekSettlement([fixture({ id: '  ' })])).toEqual({
      ok: false,
      reason: 'invalid_input',
    })
  })

  it('refuses a duplicated fixture id and a malformed abandoned partial score', () => {
    expect(resolveMatchweekSettlement([fixture(), fixture()])).toEqual({
      ok: false,
      reason: 'duplicate_fixture',
    })
    expect(
      resolveMatchweekSettlement([
        fixture({ state: 'abandoned', score: { home: -2, away: 0 } }),
      ]),
    ).toEqual({ ok: false, reason: 'invalid_input' })
  })
})

describe('authority separation', () => {
  const source = readFileSync(
    resolve(process.cwd(), 'src/domain/season/matchweekSettlement.ts'),
    'utf8',
  )

  it('imports nothing from the tournament implementation', () => {
    expect(source).not.toMatch(/from '.*tournament/)
  })

  it('reads no ambient clock or zone', () => {
    expect(source).not.toMatch(/Date\.now|new Date\(|Intl\./)
  })

  it('awards no points — scoring stays in scoring.ts', () => {
    // The settlement declares fixtures scoreable; only the scoring authority
    // may turn a prediction and a result into points.
    expect(source).not.toMatch(/scoreFixture|scoreMatchweek|SEASON_PREDICTOR_POINTS/)
  })
})
