import { describe, expect, it } from 'vitest'
import { validateResultEntry, type ResultEntryDraft } from './resultEntry'

const base: ResultEntryDraft = {
  home90: '1',
  away90: '0',
  wentToExtraTime: false,
  homeExtraTime: '',
  awayExtraTime: '',
  wentToPenalties: false,
  homePenalties: '',
  awayPenalties: '',
}

describe('validateResultEntry', () => {
  it('accepts a regulation-time group result', () => {
    expect(validateResultEntry('group', base)).toEqual({
      ok: true,
      value: {
        home90: 1,
        away90: 0,
        homeAfterExtraTime: null,
        awayAfterExtraTime: null,
        homePenalties: null,
        awayPenalties: null,
      },
    })
  })

  it('rejects extra time in the group stage', () => {
    const result = validateResultEntry('group', {
      ...base,
      home90: '1',
      away90: '1',
      wentToExtraTime: true,
      homeExtraTime: '2',
      awayExtraTime: '1',
    })
    expect(result.ok).toBe(false)
  })

  it('requires extra time for a level knockout result', () => {
    const result = validateResultEntry('r16', { ...base, home90: '1', away90: '1' })
    expect(result).toEqual({
      ok: false,
      errors: ['A knockout match cannot finish level after 90 minutes without extra time.'],
    })
  })

  it('accepts a penalty shoot-out with a non-level shoot-out score', () => {
    const result = validateResultEntry('final', {
      ...base,
      home90: '1',
      away90: '1',
      wentToExtraTime: true,
      homeExtraTime: '2',
      awayExtraTime: '2',
      wentToPenalties: true,
      homePenalties: '5',
      awayPenalties: '4',
    })
    expect(result.ok).toBe(true)
  })

  it('rejects a level penalty shoot-out', () => {
    const result = validateResultEntry('qf', {
      ...base,
      home90: '0',
      away90: '0',
      wentToExtraTime: true,
      homeExtraTime: '0',
      awayExtraTime: '0',
      wentToPenalties: true,
      homePenalties: '4',
      awayPenalties: '4',
    })
    expect(result.ok).toBe(false)
  })
})
