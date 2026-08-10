import { describe, expect, it } from 'vitest'
import { EURO_PUBLICATION_STATES } from '../../../src/services/supabase/euroPublicationModel'
import {
  euroPublicationRefusal,
  euroPublicationStateSummary,
} from '../../../src/features/admin/euroPublicationAdminModel'

describe('the Euro publication operator copy', () => {
  it('describes every state, so a new one cannot ship unexplained', () => {
    for (const state of EURO_PUBLICATION_STATES) {
      expect(euroPublicationStateSummary(state).length).toBeGreaterThan(0)
    }
  })

  it('says the hidden state refuses player routes, which is what the guard does', () => {
    expect(euroPublicationStateSummary('hidden')).toMatch(/refused/i)
  })
})

describe('the Euro publication refusal reader', () => {
  it.each([
    ['42501', /owner capability/i],
    ['insufficient_privilege', /owner capability/i],
    ['40001', /changed while this page was open/i],
    ['serialization_failure', /changed while this page was open/i],
    ['22023', /requires a reason/i],
    ['invalid_parameter_value', /requires a reason/i],
    ['55000', /holds no Euro publication state row/i],
  ])('reports %s in the operator’s terms', (code, expected) => {
    expect(euroPublicationRefusal({ code }, 'fallback')).toMatch(expected)
  })

  it('falls back rather than inventing a cause for an unrecognised failure', () => {
    expect(euroPublicationRefusal({ code: 'PGRST999' }, 'fallback')).toBe('fallback')
    expect(euroPublicationRefusal(new Error('offline'), 'fallback')).toBe('fallback')
    expect(euroPublicationRefusal(null, 'fallback')).toBe('fallback')
  })
})
