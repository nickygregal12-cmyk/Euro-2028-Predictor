import { describe, expect, it } from 'vitest'
import { penaltyLaneRule, penaltyValueAllowed } from '../../src/vnext/models/championship'

/**
 * THE RULE THIS LANE STATES, AGAINST THE RULE THE SERVER ENFORCES.
 *
 * `submit_cup_penalty_number` raises on three things, and these are the numbers
 * those raises sit on:
 *
 *     if p_value is null or p_value < 0 or p_value > 99 then   -- the range
 *     if v_is_home     and p_value % 2 = 0 then                -- odd lane
 *     if not v_is_home and p_value % 2 = 1 then                -- even lane
 *
 * so the odd lane takes 1..99 odd and the even lane 0..98 even. The boundaries
 * are the whole point: a rule that quietly refused 0, 1, 98 or 99 would leave a
 * reader unable to submit a value the server would have accepted, with a
 * disabled button and no explanation. Only 7 and 8 were ever exercised, and a
 * mutation narrowing both lanes by one at each end passed 113 tests.
 */
describe('penaltyValueAllowed sits exactly on the write’s own bounds', () => {
  it.each([1, 3, 51, 97, 99])('takes %i in the odd lane', (value) => {
    expect(penaltyValueAllowed('odd', value)).toBe(true)
  })

  it.each([0, 2, 50, 96, 98])('takes %i in the even lane', (value) => {
    expect(penaltyValueAllowed('even', value)).toBe(true)
  })

  // THE FIRST VALUE PAST EACH END. 100 and -1 are outside the range the server
  // checks first; 0 and 100 are also the wrong parity for the odd lane, and the
  // range raise is the one that fires.
  it.each([-1, 0, 100, 101])('refuses %i in the odd lane', (value) => {
    expect(penaltyValueAllowed('odd', value)).toBe(false)
  })

  it.each([-2, -1, 99, 100])('refuses %i in the even lane', (value) => {
    expect(penaltyValueAllowed('even', value)).toBe(false)
  })

  it('refuses the other lane’s parity throughout', () => {
    for (let value = 0; value <= 99; value += 1) {
      expect(penaltyValueAllowed('odd', value)).toBe(value % 2 === 1)
      expect(penaltyValueAllowed('even', value)).toBe(value % 2 === 0)
    }
  })

  it('refuses a number that is not whole, which no smallint column holds', () => {
    expect(penaltyValueAllowed('odd', 7.5)).toBe(false)
    expect(penaltyValueAllowed('even', Number.NaN)).toBe(false)
  })
})

describe('penaltyLaneRule states the bounds it enforces', () => {
  it('names the odd lane’s range', () => {
    expect(penaltyLaneRule('odd')).toContain('1 to 99')
  })

  it('names the even lane’s range', () => {
    expect(penaltyLaneRule('even')).toContain('0 to 98')
  })
})
