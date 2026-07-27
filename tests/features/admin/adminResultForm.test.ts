import { describe, expect, it } from 'vitest'
import {
  EMPTY_ADMIN_RESULT_FORM,
  validateAdminResultForm,
  type AdminResultFormValues,
} from '../../../src/features/admin/adminResultForm'

function values(
  overrides: Partial<AdminResultFormValues> = {},
): AdminResultFormValues {
  return { ...EMPTY_ADMIN_RESULT_FORM, ...overrides }
}

describe('validateAdminResultForm', () => {
  it('accepts a group draw as a regulation result', () => {
    const parsed = validateAdminResultForm({
      action: 'confirm',
      matchId: 'match-1',
      round: 'group',
      values: values({ home90: '1', away90: '1' }),
    })

    expect(parsed).toEqual({
      ok: true,
      mutation: {
        matchId: 'match-1',
        method: 'regulation',
        home90: 1,
        away90: 1,
        home120: null,
        away120: null,
        homePenalties: null,
        awayPenalties: null,
        reason: null,
      },
      reason: '',
    })
  })

  it('fails closed when a knockout regulation result is tied', () => {
    const parsed = validateAdminResultForm({
      action: 'confirm',
      matchId: 'match-1',
      round: 'r16',
      values: values({ home90: '2', away90: '2' }),
    })

    expect(parsed).toEqual({
      ok: false,
      errors: {
        form: 'A knockout match cannot finish level in regulation.',
      },
    })
  })

  it('requires a tied 90-minute score and a winner after extra time', () => {
    const notTied = validateAdminResultForm({
      action: 'confirm',
      matchId: 'match-1',
      round: 'qf',
      values: values({
        method: 'extra_time',
        home90: '1',
        away90: '0',
        home120: '2',
        away120: '1',
      }),
    })
    const stillTied = validateAdminResultForm({
      action: 'confirm',
      matchId: 'match-1',
      round: 'qf',
      values: values({
        method: 'extra_time',
        home90: '1',
        away90: '1',
        home120: '2',
        away120: '2',
      }),
    })

    expect(notTied).toMatchObject({
      ok: false,
      errors: {
        form: 'Extra time requires the 90-minute score to be level.',
      },
    })
    expect(stillTied).toMatchObject({
      ok: false,
      errors: {
        form: 'An extra-time result requires a winner after 120 minutes.',
      },
    })
  })

  it('accepts a penalty result only when 90 and 120 are tied and shootout is not', () => {
    const parsed = validateAdminResultForm({
      action: 'confirm',
      matchId: 'match-1',
      round: 'final',
      values: values({
        method: 'penalties',
        home90: '1',
        away90: '1',
        home120: '2',
        away120: '2',
        homePenalties: '5',
        awayPenalties: '4',
        reason: 'Official UEFA result',
      }),
    })

    expect(parsed).toMatchObject({
      ok: true,
      mutation: {
        method: 'penalties',
        home90: 1,
        away90: 1,
        home120: 2,
        away120: 2,
        homePenalties: 5,
        awayPenalties: 4,
        reason: 'Official UEFA result',
      },
    })
  })

  it('rejects missing, negative, decimal and implausibly large scores', () => {
    const parsed = validateAdminResultForm({
      action: 'confirm',
      matchId: 'match-1',
      round: 'group',
      values: values({ home90: '-1', away90: '1.5' }),
    })
    const large = validateAdminResultForm({
      action: 'confirm',
      matchId: 'match-1',
      round: 'group',
      values: values({ home90: '100', away90: '' }),
    })

    expect(parsed).toMatchObject({
      ok: false,
      errors: {
        home90: 'Home 90-minute score must be a whole number from 0 to 99.',
        away90: 'Away 90-minute score must be a whole number from 0 to 99.',
      },
    })
    expect(large).toMatchObject({
      ok: false,
      errors: {
        home90: 'Home 90-minute score must be a whole number from 0 to 99.',
        away90: 'Away 90-minute score is required.',
      },
    })
  })

  it('requires a reason before correction or clear but not confirmation', () => {
    const correction = validateAdminResultForm({
      action: 'correct',
      matchId: 'match-1',
      round: 'group',
      values: values({ home90: '2', away90: '1' }),
    })
    const clear = validateAdminResultForm({
      action: 'clear',
      matchId: 'match-1',
      round: 'group',
      values: values(),
    })
    const reasonedClear = validateAdminResultForm({
      action: 'clear',
      matchId: 'match-1',
      round: 'group',
      values: values({ reason: 'Result assigned to the wrong fixture' }),
    })

    expect(correction).toMatchObject({
      ok: false,
      errors: { reason: 'A correction reason is required.' },
    })
    expect(clear).toEqual({
      ok: false,
      errors: { reason: 'A clear reason is required.' },
    })
    expect(reasonedClear).toEqual({
      ok: true,
      mutation: null,
      reason: 'Result assigned to the wrong fixture',
    })
  })
})
