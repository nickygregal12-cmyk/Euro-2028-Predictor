import { describe, it, expect } from 'vitest'
import {
  isVersionConflict,
  VersionConflictError,
  VERSION_CONFLICT_CODE,
} from '../../src/services/supabase/writeConflict'

describe('isVersionConflict', () => {
  it('recognises the server SQLSTATE and the typed error', () => {
    expect(isVersionConflict({ code: VERSION_CONFLICT_CODE })).toBe(true)
    expect(isVersionConflict(new VersionConflictError())).toBe(true)
  })

  it('does not misclassify other errors', () => {
    expect(isVersionConflict({ code: '23514' })).toBe(false) // lock / joker / rate-limit
    expect(isVersionConflict({ code: '42501' })).toBe(false) // insufficient_privilege
    expect(isVersionConflict(new Error('network'))).toBe(false)
    expect(isVersionConflict(null)).toBe(false)
    expect(isVersionConflict(undefined)).toBe(false)
  })
})
