import { describe, expect, it } from 'vitest'
import {
  championshipRefusal,
  isChampionshipRefusal,
} from '../../../src/features/season/championshipRefusal'

/**
 * THE PENALTY NUMBER REFUSAL MAP.
 *
 * Every code below was read out of `submit_cup_penalty_number` rather than
 * assumed — Stage 11's blocker was a classifier that knew one SQLSTATE out of
 * five, written from expectation rather than from the function.
 */

const err = (code: string) => Object.assign(new Error('server said so'), { code })

describe('every refusal the write can raise is classified', () => {
  it.each([
    ['55000', 'settled, unscheduled, or past the first kickoff'],
    ['check_violation', 'out of range, or the wrong lane parity'],
    ['23514', 'the same, by numeric code'],
    ['no_data_found', 'no tie in this round'],
    ['02000', 'the same, by numeric code'],
    ['insufficient_privilege', 'not authenticated'],
    ['42501', 'the same, by numeric code'],
  ])('%s (%s)', (code) => {
    expect(isChampionshipRefusal(err(code))).toBe(true)
    expect(championshipRefusal(err(code))).not.toMatch(/something went wrong/i)
  })
})

describe('a fault is not a refusal', () => {
  it('falls back to safe generic copy for an unknown code', () => {
    expect(isChampionshipRefusal(err('08006'))).toBe(false)
    expect(championshipRefusal(err('08006'))).toBeTruthy()
  })

  it('treats a plain error as a fault', () => {
    expect(isChampionshipRefusal(new Error('network'))).toBe(false)
  })

  /**
   * A VERSION CONFLICT IS NEITHER, and must not be claimed here. It is a lost
   * race resolved by re-reading, and `isVersionConflict` is its one authority.
   * A second copy is the defect this file's docblock warns about.
   */
  it('does not claim PT409', () => {
    expect(isChampionshipRefusal(err('PT409'))).toBe(false)
  })
})

/**
 * THE HONEST-BREADTH RULE. `55000` and `check_violation` each cover three
 * different server rules, so each sentence must be true of ALL of them. A
 * sentence naming one — "the round has been settled", "your lane is ODD" —
 * would be wrong two thirds of the time it appeared.
 */
describe('a sentence never names one rule out of the several its code covers', () => {
  it('does not claim which of the three `55000` situations occurred', () => {
    const sentence = championshipRefusal(err('55000'))
    expect(sentence).not.toMatch(/settled|not scheduled|locked at/i)
    // It says what IS true of all three, and what to do about it.
    expect(sentence).toMatch(/not taking Penalty Numbers/i)
    expect(sentence).toMatch(/reload/i)
  })

  it('does not name a lane it cannot know from the code', () => {
    const sentence = championshipRefusal(err('check_violation'))
    expect(sentence).not.toMatch(/\bodd\b|\beven\b/i)
    expect(sentence).not.toMatch(/0 to 99|1 to 99|0 to 98/)
  })

  it('never passes the server’s own message through', () => {
    for (const code of ['55000', 'check_violation', 'no_data_found']) {
      expect(championshipRefusal(err(code))).not.toContain('server said so')
    }
  })
})
