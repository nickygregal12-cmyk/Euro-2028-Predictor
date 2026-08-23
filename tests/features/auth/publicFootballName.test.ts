import { describe, expect, it } from 'vitest'
import { needsPublicFootballName } from '../../../src/features/auth/publicFootballName'

describe('needsPublicFootballName', () => {
  it('requires an app-owned name for a missing or neutral profile', () => {
    expect(needsPublicFootballName(null)).toBe(true)
    expect(needsPublicFootballName('')).toBe(true)
    expect(needsPublicFootballName(' Player ')).toBe(true)
  })

  it('accepts a player-chosen football name', () => {
    expect(needsPublicFootballName('NickyG')).toBe(false)
  })
})
